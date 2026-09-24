import { randomUUID } from 'node:crypto'
import { PaymentStore } from './payment-store.js'
import {
  isFinalPaymentStatus,
  type CardPaymentMethod,
  type PaymentOrderRecord,
  type PaymentOrderStatus,
} from './payment-types.js'
import type { PaymentRuntimeConfig } from './payment-providers.js'

const MOCK_TRANSITIONS: Record<PaymentOrderStatus, PaymentOrderStatus[]> = {
  created: ['at_terminal', 'processed', 'failed', 'canceled', 'expired'],
  at_terminal: ['processed', 'failed', 'canceled', 'expired'],
  processed: ['refunded'],
  failed: [],
  canceled: [],
  expired: [],
  refunded: [],
}

function compactDate(date: Date): string {
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function externalReference(now: Date): string {
  return `ORBI-${compactDate(now)}-${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export class PaymentService {
  constructor(
    private readonly store: PaymentStore,
    private readonly runtime: PaymentRuntimeConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  terminal() {
    return this.runtime.terminal
  }

  providerId() {
    return this.runtime.providerId
  }

  async list(storeId: string) {
    return await this.store.list(storeId)
  }

  async create(
    storeId: string,
    input: {
      clientRequestId: string
      amount: number
      requestedMethod: CardPaymentMethod
    },
  ): Promise<PaymentOrderRecord> {
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.clientRequestId)) {
      throw new Error('Invalid client request id')
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error('Amount must be a positive integer CLP value')
    }
    if (!['debit', 'credit'].includes(input.requestedMethod)) {
      throw new Error('Card payment method must be debit or credit')
    }
    if (!this.runtime.terminal.ready) {
      throw new Error('Payment terminal is not configured')
    }

    const existing = await this.store.findByClientRequestId(storeId, input.clientRequestId)
    if (existing) return existing

    const now = this.now()
    const id = randomUUID()
    const idempotencyKey = randomUUID()
    const reference = externalReference(now)

    const providerState = await this.runtime.provider.createOrder({
      externalReference: reference,
      idempotencyKey,
      terminalId: this.runtime.terminal.id,
      amount: input.amount,
    })

    const record: PaymentOrderRecord = {
      id,
      storeId,
      provider: this.runtime.providerId,
      providerOrderId: providerState.providerOrderId,
      externalReference: reference,
      clientRequestId: input.clientRequestId,
      idempotencyKey,
      terminalId: this.runtime.terminal.id,
      amount: input.amount,
      currency: 'CLP',
      requestedMethod: input.requestedMethod,
      status: providerState.status,
      statusDetail: providerState.statusDetail,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    return await this.store.put(storeId, record)
  }

  async get(storeId: string, id: string, refresh = true): Promise<PaymentOrderRecord | null> {
    const current = await this.store.get(storeId, id)
    if (!current) return null

    if (
      refresh
      && current.provider === 'mercadopago'
      && !isFinalPaymentStatus(current.status)
    ) {
      const providerState = await this.runtime.provider.getOrder(current.providerOrderId)
      const updated: PaymentOrderRecord = {
        ...current,
        status: providerState.status,
        statusDetail: providerState.statusDetail,
        updatedAt: this.now().toISOString(),
      }
      return await this.store.put(storeId, updated)
    }

    return current
  }

  async cancel(storeId: string, id: string): Promise<PaymentOrderRecord> {
    const current = await this.store.get(storeId, id)
    if (!current) throw new Error('Payment order not found')
    if (isFinalPaymentStatus(current.status)) return current
    if (current.status !== 'created' && current.provider === 'mercadopago') {
      throw new Error('Mercado Pago orders can only be canceled by API while status=created')
    }

    const cancelIdempotencyKey = current.cancelIdempotencyKey ?? randomUUID()
    const providerState = await this.runtime.provider.cancelOrder(
      current.providerOrderId,
      cancelIdempotencyKey,
    )

    return await this.store.put(storeId, {
      ...current,
      cancelIdempotencyKey,
      status: providerState.status,
      statusDetail: providerState.statusDetail,
      updatedAt: this.now().toISOString(),
    })
  }

  async mockTransition(
    storeId: string,
    id: string,
    nextStatus: PaymentOrderStatus,
  ): Promise<PaymentOrderRecord> {
    if (this.runtime.providerId !== 'mock') {
      throw new Error('Mock transitions are disabled for the active payment provider')
    }

    const current = await this.store.get(storeId, id)
    if (!current) throw new Error('Payment order not found')

    const allowed = MOCK_TRANSITIONS[current.status]
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid mock transition: ${current.status} -> ${nextStatus}`)
    }

    return await this.store.put(storeId, {
      ...current,
      status: nextStatus,
      statusDetail: `mock_${nextStatus}`,
      updatedAt: this.now().toISOString(),
    })
  }
}
