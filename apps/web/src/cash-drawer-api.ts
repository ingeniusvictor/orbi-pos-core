import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export type CashDrawerMovementType = 'paid_in' | 'paid_out'

export interface CashDrawerMovement {
  id: string
  type: CashDrawerMovementType
  amount: number
  reason: string
  createdAt: string
}

export interface CashDrawerSession {
  id: string
  storeId: string
  businessDate: string
  businessTimeZone: string
  openedAt: string
  closedAt?: string
  openingFloat: number
  status: 'open' | 'closed'
  movements: CashDrawerMovement[]
  cashSales?: { count: number; total: number; through: string }
  paidInTotal?: number
  paidOutTotal?: number
  expectedCash?: number
  countedCash?: number
  variance?: number
  sourceFingerprint?: string
}

export interface CashDrawerPreview {
  sessionId: string
  storeId: string
  businessDate: string
  businessTimeZone: string
  generatedAt: string
  openingFloat: number
  cashSales: { count: number; total: number; through: string }
  paidInTotal: number
  paidOutTotal: number
  expectedCash: number
  sourceFingerprint: string
  providerCallsMade: false
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as T | { message?: string } | null
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? body.message
      : undefined
    throw new Error(message || `Cash drawer API error ${response.status}`)
  }
  return body as T
}

export async function listCashDrawerSessions(storeId = ORBI_STORE_ID) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer`), { cache: 'no-store' })
  return await jsonOrError<CashDrawerSession[]>(response)
}

export async function fetchActiveCashDrawer(storeId = ORBI_STORE_ID) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer/active`), { cache: 'no-store' })
  return await jsonOrError<CashDrawerSession | null>(response)
}

export async function openCashDrawer(openingFloat: number, storeId = ORBI_STORE_ID) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer/open`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ openingFloat }),
  })
  return await jsonOrError<CashDrawerSession>(response)
}

export async function previewCashDrawer(sessionId: string, storeId = ORBI_STORE_ID) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer/${encodeURIComponent(sessionId)}/preview`), { cache: 'no-store' })
  return await jsonOrError<CashDrawerPreview>(response)
}

export async function addCashDrawerMovement(
  sessionId: string,
  type: CashDrawerMovementType,
  amount: number,
  reason: string,
  storeId = ORBI_STORE_ID,
) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer/${encodeURIComponent(sessionId)}/movements`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, amount, reason }),
  })
  return await jsonOrError<CashDrawerSession>(response)
}

export async function closeCashDrawer(sessionId: string, countedCash: number, storeId = ORBI_STORE_ID) {
  const response = await fetch(orbiApi(`/api/stores/${encodeURIComponent(storeId)}/cash-drawer/${encodeURIComponent(sessionId)}/close`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ countedCash }),
  })
  return await jsonOrError<CashDrawerSession>(response)
}
