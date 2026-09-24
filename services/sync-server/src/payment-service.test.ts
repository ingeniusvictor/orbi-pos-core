import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PaymentService } from './payment-service.js'
import { createPaymentRuntime } from './payment-providers.js'
import { PaymentStore } from './payment-store.js'

const dirs: string[] = []

async function makeService() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-payments-'))
  dirs.push(dir)

  return new PaymentService(
    new PaymentStore(dir),
    createPaymentRuntime({ ORBI_PAYMENT_PROVIDER: 'mock' }),
    () => new Date('2026-09-24T20:00:00.000Z'),
  )
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('PaymentService', () => {
  it('creates a unique ORBI payment order for integer CLP amounts', async () => {
    const service = await makeService()
    const order = await service.create('el-chunchito', {
      clientRequestId: 'request-0001',
      amount: 15720,
      requestedMethod: 'debit',
    })

    expect(order.amount).toBe(15720)
    expect(order.currency).toBe('CLP')
    expect(order.externalReference).toMatch(/^ORBI-20260924-/)
    expect(order.provider).toBe('mock')
    expect(order.status).toBe('created')
    expect(order.terminalId).toBe('MOCK_POINT_SMART_2')
  })

  it('is idempotent for the same client request id', async () => {
    const service = await makeService()
    const input = {
      clientRequestId: 'request-0002',
      amount: 15720,
      requestedMethod: 'credit' as const,
    }

    const first = await service.create('el-chunchito', input)
    const second = await service.create('el-chunchito', input)

    expect(second.id).toBe(first.id)
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
    expect((await service.list('el-chunchito'))).toHaveLength(1)
  })

  it('supports the mock Point terminal payment lifecycle', async () => {
    const service = await makeService()
    const created = await service.create('el-chunchito', {
      clientRequestId: 'request-0003',
      amount: 15720,
      requestedMethod: 'debit',
    })

    const atTerminal = await service.mockTransition('el-chunchito', created.id, 'at_terminal')
    expect(atTerminal.status).toBe('at_terminal')

    const processed = await service.mockTransition('el-chunchito', created.id, 'processed')
    expect(processed.status).toBe('processed')

    await expect(
      service.mockTransition('el-chunchito', created.id, 'failed'),
    ).rejects.toThrow('Invalid mock transition')
  })

  it('keeps a failed order final and available for audit', async () => {
    const service = await makeService()
    const created = await service.create('el-chunchito', {
      clientRequestId: 'request-0004',
      amount: 5000,
      requestedMethod: 'credit',
    })

    await service.mockTransition('el-chunchito', created.id, 'failed')
    const order = await service.get('el-chunchito', created.id)

    expect(order?.status).toBe('failed')
    expect((await service.list('el-chunchito'))[0].id).toBe(created.id)
  })

  it('rejects non-integer or zero amounts', async () => {
    const service = await makeService()

    await expect(service.create('el-chunchito', {
      clientRequestId: 'request-0005',
      amount: 0,
      requestedMethod: 'debit',
    })).rejects.toThrow('positive integer')

    await expect(service.create('el-chunchito', {
      clientRequestId: 'request-0006',
      amount: 1000.5,
      requestedMethod: 'debit',
    })).rejects.toThrow('positive integer')
  })
})
