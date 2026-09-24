import { ORBI_STORE_ID, orbiApi } from './catalog-sync'
import type { PaymentMethod } from './domain'

export type PaymentProviderId = 'mock' | 'mercadopago'

export type PaymentOrderStatus =
  | 'created'
  | 'at_terminal'
  | 'action_required'
  | 'processed'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'refunded'

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

export interface PaymentRuntimeInfo {
  provider: PaymentProviderId
  terminal: PaymentTerminal
  storeId: string
}

export interface PaymentOrder {
  id: string
  storeId: string
  provider: PaymentProviderId
  providerOrderId: string
  externalReference: string
  clientRequestId: string
  terminalId: string
  amount: number
  currency: 'CLP'
  requestedMethod: Extract<PaymentMethod, 'debit' | 'credit'>
  status: PaymentOrderStatus
  statusDetail?: string
  createdAt: string
  updatedAt: string
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as
    | T
    | { message?: string }
    | null

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? body.message
      : undefined
    throw new Error(message || `Payment API error ${response.status}`)
  }

  return body as T
}

export async function fetchPaymentRuntime(
  storeId = ORBI_STORE_ID,
): Promise<PaymentRuntimeInfo> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/runtime`),
    { cache: 'no-store' },
  )
  return await jsonOrError<PaymentRuntimeInfo>(response)
}


export async function listPaymentOrders(
  storeId = ORBI_STORE_ID,
  limit = 30,
): Promise<PaymentOrder[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/orders?limit=${limit}`),
    { cache: 'no-store' },
  )
  return await jsonOrError<PaymentOrder[]>(response)
}

export async function createPaymentOrder(
  amount: number,
  requestedMethod: Extract<PaymentMethod, 'debit' | 'credit'>,
  clientRequestId: string,
  storeId = ORBI_STORE_ID,
): Promise<PaymentOrder> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/orders`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount, requestedMethod, clientRequestId }),
    },
  )
  return await jsonOrError<PaymentOrder>(response)
}

export async function fetchPaymentOrder(
  orderId: string,
  storeId = ORBI_STORE_ID,
): Promise<PaymentOrder> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/orders/${encodeURIComponent(orderId)}`),
    { cache: 'no-store' },
  )
  return await jsonOrError<PaymentOrder>(response)
}

export async function cancelPaymentOrder(
  orderId: string,
  storeId = ORBI_STORE_ID,
): Promise<PaymentOrder> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/orders/${encodeURIComponent(orderId)}/cancel`),
    { method: 'POST' },
  )
  return await jsonOrError<PaymentOrder>(response)
}

export async function mockPaymentTransition(
  orderId: string,
  status: PaymentOrderStatus,
  storeId = ORBI_STORE_ID,
): Promise<PaymentOrder> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/payments/orders/${encodeURIComponent(orderId)}/mock-status`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
  return await jsonOrError<PaymentOrder>(response)
}

export function createClientPaymentRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}
