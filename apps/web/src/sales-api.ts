import { ORBI_STORE_ID, orbiApi } from './catalog-sync'
import type { CartLine, PaymentMethod, Sale, SalePayment } from './domain'

export interface CreateServerSaleInput {
  clientRequestId: string
  createdAt?: string
  lines: CartLine[]
  paymentMethod: PaymentMethod
  total: number
  payment?: SalePayment
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
    throw new Error(message || `Sales API error ${response.status}`)
  }

  return body as T
}

export async function listServerSales(
  storeId = ORBI_STORE_ID,
  limit = 500,
): Promise<Sale[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/sales?limit=${limit}`),
    { cache: 'no-store' },
  )
  return await jsonOrError<Sale[]>(response)
}

export async function fetchServerSale(
  saleId: string,
  storeId = ORBI_STORE_ID,
): Promise<Sale> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/sales/${encodeURIComponent(saleId)}`,
    ),
    { cache: 'no-store' },
  )
  return await jsonOrError<Sale>(response)
}

export async function createServerSale(
  input: CreateServerSaleInput,
  storeId = ORBI_STORE_ID,
): Promise<Sale> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/sales`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return await jsonOrError<Sale>(response)
}

export function createClientSaleRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return `sale_${crypto.randomUUID()}`
  }
  return `sale_${Date.now()}_${Math.random().toString(36).slice(2, 16)}`
}
