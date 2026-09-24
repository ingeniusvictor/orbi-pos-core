export type PaymentProviderId = 'mock' | 'mercadopago'

export type PaymentOrderStatus =
  | 'created'
  | 'at_terminal'
  | 'processed'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'refunded'

export type CardPaymentMethod = 'debit' | 'credit'

export interface PaymentTerminal {
  id: string
  provider: PaymentProviderId
  label: string
  storeId?: string
  posId?: string
  operatingMode: 'PDV' | 'STANDALONE' | 'SELF_SERVICE' | 'UNDEFINED' | 'MOCK'
  ready: boolean
  isPrimary: boolean
}

export interface PaymentOrderRecord {
  id: string
  storeId: string
  provider: PaymentProviderId
  providerOrderId: string
  externalReference: string
  clientRequestId: string
  idempotencyKey: string
  cancelIdempotencyKey?: string
  terminalId: string
  amount: number
  currency: 'CLP'
  requestedMethod: CardPaymentMethod
  status: PaymentOrderStatus
  statusDetail?: string
  createdAt: string
  updatedAt: string
}

export interface ProviderCreateOrderInput {
  externalReference: string
  idempotencyKey: string
  terminalId: string
  amount: number
}

export interface ProviderOrderState {
  providerOrderId: string
  status: PaymentOrderStatus
  statusDetail?: string
}

export interface PaymentProvider {
  readonly id: PaymentProviderId
  createOrder(input: ProviderCreateOrderInput): Promise<ProviderOrderState>
  getOrder(providerOrderId: string): Promise<ProviderOrderState>
  cancelOrder(providerOrderId: string, idempotencyKey: string): Promise<ProviderOrderState>
}

export function isFinalPaymentStatus(status: PaymentOrderStatus): boolean {
  return ['processed', 'failed', 'canceled', 'expired', 'refunded'].includes(status)
}
