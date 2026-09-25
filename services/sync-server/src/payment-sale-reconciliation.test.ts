import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PaymentSaleReconciliationService } from './payment-sale-reconciliation.js'
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
  amount = 5610,
): PaymentOrderRecord {
  return {
    id,
    storeId: 'el-chunchito',
    provider: 'mock',
    providerOrderId: `provider-${id}`,
    externalReference: `ORBI-20260925-${id}`,
    clientRequestId: `request-${id}`,
    idempotencyKey: `idem-${id}`,
    terminalId: 'MOCK_POINT_SMART_2',
    amount,
    currency: 'CLP',
    requestedMethod: 'debit',
    status,
    createdAt: '2026-09-25T05:30:00.000Z',
    updatedAt: '2026-09-25T05:31:00.000Z',
  }
}

function sale(
  id: string,
  order: PaymentOrderRecord,
): SaleRecord {
  return {
    id,
    storeId: 'el-chunchito',
    clientRequestId: `sale-${id}`,
    createdAt: '2026-09-25T05:30:00.000Z',
    recordedAt: '2026-09-25T05:31:00.000Z',
    source: 'orbi-pos-web',
    lines: [{
      id: `line-${id}`,
      productId: 'pernil',
      name: 'Pernil',
      unitPrice: 4898,
      quantity: 1.146,
      unitType: 'KG',
      subtotal: 5610,
    }],
    paymentMethod: 'debit',
    total: 5610,
    payment: {
      provider: order.provider,
      orderId: order.id,
      providerOrderId: order.providerOrderId,
      externalReference: order.externalReference,
      terminalId: order.terminalId,
    },
    audit: [{
      event: 'created',
      at: '2026-09-25T05:31:00.000Z',
      actor: 'orbi-pos-web',
      detail: 'server_authoritative',
    }],
  }
}

describe('PaymentSaleReconciliationService', () => {
  it('classifies linked, orphan processed, refunded and ordinary unlinked orders without provider access', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-reconcile-'))
    dirs.push(dir)

    const payments = new PaymentStore(dir)
    const sales = new SaleStore(dir)

    const linked = payment('pay-linked', 'processed')
    const orphan = payment('pay-orphan', 'processed')
    const refunded = payment('pay-refunded', 'refunded')
    const failed = payment('pay-failed', 'failed')

    for (const order of [linked, orphan, refunded, failed]) {
      await payments.put('el-chunchito', order)
    }

    await sales.append('el-chunchito', sale('SALE-20260925-linked000001', linked))
    await sales.append('el-chunchito', sale('SALE-20260925-refund00001', refunded))

    const service = new PaymentSaleReconciliationService(
      payments,
      sales,
      () => new Date('2026-09-25T05:40:00.000Z'),
    )

    const snapshot = await service.inspect('el-chunchito')

    expect(snapshot.providerCallsMade).toBe(false)
    expect(snapshot.generatedAt).toBe('2026-09-25T05:40:00.000Z')
    expect(snapshot.summary).toEqual({
      total: 4,
      linked: 1,
      orphanProcessed: 1,
      refundedAfterSale: 1,
      unlinkedNonprocessed: 1,
    })

    const orphanRecord = snapshot.records.find((item) => item.order.id === orphan.id)
    expect(orphanRecord).toMatchObject({
      state: 'orphan_processed',
    })
    expect(orphanRecord).not.toHaveProperty('saleId')
    expect(snapshot.records.find((item) => item.order.id === linked.id)).toMatchObject({
      state: 'linked',
      saleId: 'SALE-20260925-linked000001',
    })
    expect(snapshot.records.find((item) => item.order.id === refunded.id)).toMatchObject({
      state: 'refunded_after_sale',
      saleId: 'SALE-20260925-refund00001',
    })
    expect(snapshot.records.find((item) => item.order.id === failed.id)).toMatchObject({
      state: 'unlinked_nonprocessed',
    })
  })

  it('bounds reconciliation to the retained PaymentStore window', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-reconcile-limit-'))
    dirs.push(dir)

    const payments = new PaymentStore(dir)
    const sales = new SaleStore(dir)
    await payments.put('el-chunchito', payment('pay-a000', 'processed'))
    await payments.put('el-chunchito', payment('pay-b000', 'failed'))

    const service = new PaymentSaleReconciliationService(payments, sales)
    const snapshot = await service.inspect('el-chunchito', 1)

    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.summary.total).toBe(1)
  })
})
