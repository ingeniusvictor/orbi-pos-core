import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DailyCloseService, businessDateFor } from './daily-close-service.js'
import { DailyCloseStore } from './daily-close-store.js'
import { PaymentStore } from './payment-store.js'
import type { PaymentOrderRecord } from './payment-types.js'
import { SaleStore } from './sale-store.js'
import type { SaleRecord } from './sale-types.js'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) =>
    rm(dir, { recursive: true, force: true }),
  ))
})

function payment(
  id: string,
  status: PaymentOrderRecord['status'],
  createdAt: string,
  amount = 10_000,
): PaymentOrderRecord {
  return {
    id,
    storeId: 'el-chunchito',
    provider: 'mock',
    providerOrderId: `provider-${id}`,
    externalReference: `ORBI-${id}`,
    clientRequestId: `request-${id}`,
    idempotencyKey: `idem-${id}`,
    terminalId: 'MOCK_POINT_SMART_2',
    amount,
    currency: 'CLP',
    requestedMethod: 'debit',
    status,
    createdAt,
    updatedAt: createdAt,
  }
}

function sale(
  id: string,
  createdAt: string,
  method: SaleRecord['paymentMethod'],
  total: number,
  order?: PaymentOrderRecord,
): SaleRecord {
  return {
    id,
    storeId: 'el-chunchito',
    clientRequestId: `sale-${id}`,
    createdAt,
    recordedAt: createdAt,
    source: 'orbi-pos-web',
    lines: [{
      id: `line-${id}`,
      productId: 'product',
      name: 'Producto',
      unitPrice: total,
      quantity: 1,
      unitType: 'UNIT',
      subtotal: total,
    }],
    paymentMethod: method,
    total,
    payment: order ? {
      provider: order.provider,
      orderId: order.id,
      providerOrderId: order.providerOrderId,
      externalReference: order.externalReference,
      terminalId: order.terminalId,
    } : undefined,
    audit: [{
      event: 'created',
      at: createdAt,
      actor: 'orbi-pos-web',
      detail: 'server_authoritative',
    }],
  }
}

async function makeService(now = '2026-09-26T02:45:00.000Z') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-daily-close-'))
  dirs.push(dir)
  const sales = new SaleStore(dir)
  const payments = new PaymentStore(dir)
  const closes = new DailyCloseStore(dir)
  let ids = 0
  const service = new DailyCloseService(
    closes,
    sales,
    payments,
    'America/Santiago',
    () => new Date(now),
    () => `12345678-1234-1234-1234-${String(++ids).padStart(12, '0')}`,
  )
  return { dir, sales, payments, closes, service }
}

describe('DailyCloseService', () => {
  it('uses the configured Chile business timezone across UTC midnight', () => {
    expect(
      businessDateFor('2026-09-26T02:30:00.000Z', 'America/Santiago'),
    ).toBe('2026-09-25')
  })

  it('builds exact method totals and surfaces processed payment orphans without provider calls', async () => {
    const { sales, payments, service } = await makeService()
    const linked = payment('pay-linked-001', 'processed', '2026-09-25T18:00:00.000Z')
    const orphan = payment('pay-orphan-001', 'processed', '2026-09-25T19:00:00.000Z', 7_000)
    await payments.put('el-chunchito', linked)
    await payments.put('el-chunchito', orphan)

    await sales.append('el-chunchito', sale(
      'SALE-20260925-cash0000001',
      '2026-09-25T15:00:00.000Z',
      'cash',
      5_610,
    ))
    await sales.append('el-chunchito', sale(
      'SALE-20260925-card0000001',
      '2026-09-25T18:01:00.000Z',
      'debit',
      10_000,
      linked,
    ))
    await sales.append('el-chunchito', sale(
      'SALE-20260925-trans000001',
      '2026-09-25T20:00:00.000Z',
      'transfer',
      3_000,
    ))

    const preview = await service.preview('el-chunchito', '2026-09-25')

    expect(preview.providerCallsMade).toBe(false)
    expect(preview.salesCount).toBe(3)
    expect(preview.salesTotal).toBe(18_610)
    expect(preview.methods.cash).toEqual({ count: 1, total: 5_610 })
    expect(preview.methods.debit).toEqual({ count: 1, total: 10_000 })
    expect(preview.methods.credit).toEqual({ count: 0, total: 0 })
    expect(preview.methods.transfer).toEqual({ count: 1, total: 3_000 })
    expect(preview.reconciliation).toEqual({
      linkedCardSales: 1,
      orphanProcessed: 1,
      refundedAfterSale: 0,
      cardLinkMismatches: 0,
    })
    expect(preview.status).toBe('attention_required')
    expect(preview.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same immutable close for an identical retry and appends a new revision after source drift', async () => {
    const { sales, service, closes } = await makeService()
    await sales.append('el-chunchito', sale(
      'SALE-20260925-cash0000002',
      '2026-09-25T17:00:00.000Z',
      'cash',
      4_000,
    ))

    const first = await service.close('el-chunchito', '2026-09-25')
    const retry = await service.close('el-chunchito', '2026-09-25')

    expect(retry.id).toBe(first.id)
    expect(retry.revision).toBe(1)

    await sales.append('el-chunchito', sale(
      'SALE-20260925-cash0000003',
      '2026-09-25T18:00:00.000Z',
      'cash',
      2_000,
    ))

    const second = await service.close('el-chunchito', '2026-09-25')
    expect(second.id).not.toBe(first.id)
    expect(second.revision).toBe(2)
    expect(second.supersedesCloseId).toBe(first.id)
    expect(second.salesTotal).toBe(6_000)

    const history = await closes.list('el-chunchito')
    expect(history).toHaveLength(2)
  })

  it('marks a sale with a refunded linked payment as attention required', async () => {
    const { sales, payments, service } = await makeService()
    const refunded = payment('pay-refund-001', 'refunded', '2026-09-25T18:00:00.000Z')
    await payments.put('el-chunchito', refunded)
    await sales.append('el-chunchito', sale(
      'SALE-20260925-refund00001',
      '2026-09-25T18:01:00.000Z',
      'debit',
      10_000,
      refunded,
    ))

    const preview = await service.preview('el-chunchito', '2026-09-25')
    expect(preview.reconciliation.refundedAfterSale).toBe(1)
    expect(preview.status).toBe('attention_required')
  })
})
