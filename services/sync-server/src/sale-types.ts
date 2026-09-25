import type { CardPaymentMethod, PaymentProviderId } from './payment-types.js'

export type SaleUnitType = 'KG' | 'UNIT' | 'PACK'
export type SalePaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer'
export type SaleSource = 'orbi-pos-web'

export interface SaleLineRecord {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  unitType: SaleUnitType
  subtotal: number
}

export interface SalePaymentTrace {
  provider: PaymentProviderId
  orderId: string
  providerOrderId: string
  externalReference: string
  terminalId: string
}

export interface SaleAuditEvent {
  event: 'created'
  at: string
  actor: 'orbi-pos-web'
  detail: 'server_authoritative'
}

export interface SaleRecord {
  id: string
  storeId: string
  clientRequestId: string
  createdAt: string
  recordedAt: string
  source: SaleSource
  lines: SaleLineRecord[]
  paymentMethod: SalePaymentMethod
  total: number
  payment?: SalePaymentTrace
  audit: SaleAuditEvent[]
}

export interface CreateSaleInput {
  clientRequestId: string
  createdAt?: string
  lines: SaleLineRecord[]
  paymentMethod: SalePaymentMethod
  total: number
  payment?: SalePaymentTrace
}

export function isCardPaymentMethod(
  method: SalePaymentMethod,
): method is CardPaymentMethod {
  return method === 'debit' || method === 'credit'
}
