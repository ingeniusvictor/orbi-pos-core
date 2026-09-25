import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PaymentStore } from './payment-store.js'
import { SaleService } from './sale-service.js'
import { SaleStore } from './sale-store.js'
import type { PaymentOrderRecord } from './payment-types.js'

const dirs: string[] = []

async function makeService() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-sales-'))
  dirs.push(dir)
  const payments = new PaymentStore(dir)
  const sales = new SaleStore(dir)
  const service = new SaleService(
    sales,
    payments,
    () => new Date('2026-09-25T05:40:00.000Z'),
  )
  return { dir, payments, sales, service }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) =>
    rm(dir, { recursive: true, force: true }),
  ))
})

function lines() {
  return [{
    id: 'pernil-001',
    productId: 'pernil',
    name: 'Pernil',
    unitPrice: 4898,
    quantity: 1.146,
    unitType: 'KG' as const,
    subtotal: 5610,
  }]
}

function processedPayment(
  overrides: Partial<PaymentOrderRecord> = {},
): PaymentOrderRecord {
  return {
    id: 'pay-001',
    storeId: 'el-chunchito',
    provider: 'mock',
    providerOrderId: 'mock-order-001',
    externalReference: 'ORBI-20260925-ABCDEF123456',
    clientRequestId: 'payment-request-001',
    idempotencyKey: 'payment-idem-001',
    terminalId: 'mock-point-smart-2',
    amount: 5610,
    currency: 'CLP',
    requestedMethod: 'debit',
    status: 'processed',
    createdAt: '2026-09-25T05:30:00.000Z',
    updatedAt: '2026-09-25T05:31:00.000Z',
    ...overrides,
  }
}

describe('SaleService', () => {
  it('persists a cash sale as server-authoritative and retries idempotently', async () => {
    const { service, sales } = await makeService()
    const input = {
      clientRequestId: 'sale-request-001',
      createdAt: '2026-09-25T05:39:00.000Z',
      lines: lines(),
      paymentMethod: 'cash' as const,
      total: 5610,
    }

    const first = await service.create('el-chunchito', input)
    const retry = await service.create('el-chunchito', input)

    expect(retry.id).toBe(first.id)
    expect(first.id).toMatch(/^SALE-20260925-[a-f0-9]{12}$/)
    expect(first.audit).toEqual([{
      event: 'created',
      at: '2026-09-25T05:40:00.000Z',
      actor: 'orbi-pos-web',
      detail: 'server_authoritative',
    }])
    expect(await sales.list('el-chunchito')).toHaveLength(1)

    await expect(service.create('el-chunchito', {
      ...input,
      total: 5620,
      lines: [{ ...lines()[0], subtotal: 5620 }],
    })).rejects.toThrow(/CLP-10 rounding|idempotency conflict/)
  })

  it('requires exact subtotal and sale total calculations', async () => {
    const { service } = await makeService()

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-bad-subtotal',
      lines: [{ ...lines()[0], subtotal: 5620 }],
      paymentMethod: 'cash',
      total: 5620,
    })).rejects.toThrow('CLP-10 rounding')

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-bad-total',
      lines: lines(),
      paymentMethod: 'cash',
      total: 5600,
    })).rejects.toThrow('does not match line subtotals')
  })

  it('requires a processed Payment Core order with exact card trace', async () => {
    const { payments, service } = await makeService()
    const payment = processedPayment()
    await payments.put('el-chunchito', payment)

    const sale = await service.create('el-chunchito', {
      clientRequestId: 'sale-request-card-001',
      lines: lines(),
      paymentMethod: 'debit',
      total: 5610,
      payment: {
        provider: payment.provider,
        orderId: payment.id,
        providerOrderId: payment.providerOrderId,
        externalReference: payment.externalReference,
        terminalId: payment.terminalId,
      },
    })

    expect(sale.payment?.orderId).toBe(payment.id)

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-card-bad-trace',
      lines: lines(),
      paymentMethod: 'debit',
      total: 5610,
      payment: {
        provider: payment.provider,
        orderId: payment.id,
        providerOrderId: 'wrong-provider-order',
        externalReference: payment.externalReference,
        terminalId: payment.terminalId,
      },
    })).rejects.toThrow(/trace|already linked/)
  })

  it('rejects pending/refunded card orders and duplicate payment reuse', async () => {
    const { payments, service } = await makeService()
    const payment = processedPayment()
    await payments.put('el-chunchito', payment)

    const trace = {
      provider: payment.provider,
      orderId: payment.id,
      providerOrderId: payment.providerOrderId,
      externalReference: payment.externalReference,
      terminalId: payment.terminalId,
    }

    await service.create('el-chunchito', {
      clientRequestId: 'sale-request-card-original',
      lines: lines(),
      paymentMethod: 'debit',
      total: 5610,
      payment: trace,
    })

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-card-duplicate',
      lines: lines(),
      paymentMethod: 'debit',
      total: 5610,
      payment: trace,
    })).rejects.toThrow('already linked')

    const pending = processedPayment({
      id: 'pay-002',
      providerOrderId: 'mock-order-002',
      externalReference: 'ORBI-20260925-OTHER123456',
      clientRequestId: 'payment-request-002',
      idempotencyKey: 'payment-idem-002',
      status: 'at_terminal',
    })
    await payments.put('el-chunchito', pending)

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-card-pending',
      lines: lines(),
      paymentMethod: 'debit',
      total: 5610,
      payment: {
        provider: pending.provider,
        orderId: pending.id,
        providerOrderId: pending.providerOrderId,
        externalReference: pending.externalReference,
        terminalId: pending.terminalId,
      },
    })).rejects.toThrow('status=processed')
  })

  it('rejects card traces on cash/transfer sales', async () => {
    const { service } = await makeService()
    const payment = processedPayment()

    await expect(service.create('el-chunchito', {
      clientRequestId: 'sale-request-cash-trace',
      lines: lines(),
      paymentMethod: 'cash',
      total: 5610,
      payment: {
        provider: payment.provider,
        orderId: payment.id,
        providerOrderId: payment.providerOrderId,
        externalReference: payment.externalReference,
        terminalId: payment.terminalId,
      },
    })).rejects.toThrow('cannot contain card payment trace')
  })

  it('deduplicates concurrent retries and exposes no sale delete API', async () => {
    const { service, sales } = await makeService()
    const input = {
      clientRequestId: 'sale-request-concurrent',
      lines: lines(),
      paymentMethod: 'transfer' as const,
      total: 5610,
    }

    const [first, second] = await Promise.all([
      service.create('el-chunchito', input),
      service.create('el-chunchito', input),
    ])

    expect(first.id).toBe(second.id)
    expect(await sales.list('el-chunchito')).toHaveLength(1)
    expect('delete' in sales).toBe(false)
  })
})
