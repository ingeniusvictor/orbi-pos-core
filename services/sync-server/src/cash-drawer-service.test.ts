import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CashDrawerService } from './cash-drawer-service.js'
import { CashDrawerStore } from './cash-drawer-store.js'
import { SaleStore } from './sale-store.js'
import type { SaleRecord } from './sale-types.js'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function cashSale(id: string, recordedAt: string, total: number): SaleRecord {
  return {
    id,
    storeId: 'el-chunchito',
    clientRequestId: `sale-${id}`,
    createdAt: recordedAt,
    recordedAt,
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
    paymentMethod: 'cash',
    total,
    audit: [{
      event: 'created',
      at: recordedAt,
      actor: 'orbi-pos-web',
      detail: 'server_authoritative',
    }],
  }
}

async function makeService(times: string[]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-cash-drawer-'))
  dirs.push(dir)
  const sales = new SaleStore(dir)
  const drawers = new CashDrawerStore(dir)
  let clock = 0
  let ids = 0
  const service = new CashDrawerService(
    drawers,
    sales,
    'America/Santiago',
    () => new Date(times[Math.min(clock++, times.length - 1)]),
    () => `12345678-1234-1234-1234-${String(++ids).padStart(12, '0')}`,
  )
  return { sales, drawers, service }
}

describe('CashDrawerService', () => {
  it('allows only one open drawer session per store', async () => {
    const { service } = await makeService([
      '2026-09-25T13:00:00.000Z',
      '2026-09-25T13:01:00.000Z',
    ])
    await service.open('el-chunchito', 20_000)
    await expect(service.open('el-chunchito', 10_000)).rejects.toThrow(
      'already open',
    )
  })

  it('computes expected cash from server-recorded cash sales and append-only movements', async () => {
    const { service, sales } = await makeService([
      '2026-09-25T13:00:00.000Z',
      '2026-09-25T14:00:00.000Z',
      '2026-09-25T14:10:00.000Z',
      '2026-09-25T15:00:00.000Z',
    ])
    const session = await service.open('el-chunchito', 20_000)

    await sales.append('el-chunchito', cashSale(
      'SALE-20260925-before000001',
      '2026-09-25T12:59:59.000Z',
      99_000,
    ))
    await sales.append('el-chunchito', cashSale(
      'SALE-20260925-inside000001',
      '2026-09-25T13:30:00.000Z',
      12_000,
    ))

    await service.addMovement('el-chunchito', session.id, 'paid_in', 5_000, 'Cambio adicional')
    await service.addMovement('el-chunchito', session.id, 'paid_out', 2_000, 'Compra urgente')

    const preview = await service.preview('el-chunchito', session.id)
    expect(preview.providerCallsMade).toBe(false)
    expect(preview.cashSales).toMatchObject({ count: 1, total: 12_000 })
    expect(preview.paidInTotal).toBe(5_000)
    expect(preview.paidOutTotal).toBe(2_000)
    expect(preview.expectedCash).toBe(35_000)
    expect(preview.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('closes immutably with physical count and idempotent retry', async () => {
    const { service, drawers } = await makeService([
      '2026-09-25T13:00:00.000Z',
      '2026-09-25T14:00:00.000Z',
      '2026-09-25T14:01:00.000Z',
      '2026-09-25T14:02:00.000Z',
      '2026-09-25T14:03:00.000Z',
    ])
    const session = await service.open('el-chunchito', 10_000)
    const closed = await service.close('el-chunchito', session.id, 9_500)

    expect(closed.status).toBe('closed')
    expect(closed.expectedCash).toBe(10_000)
    expect(closed.countedCash).toBe(9_500)
    expect(closed.variance).toBe(-500)

    const retry = await service.close('el-chunchito', session.id, 9_500)
    expect(retry.id).toBe(closed.id)
    await expect(
      service.close('el-chunchito', session.id, 9_400),
    ).rejects.toThrow('different physical count')

    expect((await drawers.list('el-chunchito'))).toHaveLength(1)
  })

  it('rejects invalid manual movements and mutations after close', async () => {
    const { service } = await makeService([
      '2026-09-25T13:00:00.000Z',
      '2026-09-25T14:00:00.000Z',
      '2026-09-25T14:01:00.000Z',
    ])
    const session = await service.open('el-chunchito', 0)

    await expect(
      service.addMovement('el-chunchito', session.id, 'paid_in', 0, 'x'),
    ).rejects.toThrow()

    await service.close('el-chunchito', session.id, 0)
    await expect(
      service.addMovement('el-chunchito', session.id, 'paid_out', 1_000, 'Retiro'),
    ).rejects.toThrow('already closed')
  })
})
