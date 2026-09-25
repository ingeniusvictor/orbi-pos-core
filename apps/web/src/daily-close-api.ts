import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export type DailyCloseStatus = 'reconciled' | 'attention_required'
export type DailyClosePaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer'

export interface DailyCloseMethodSummary {
  count: number
  total: number
}

export type DailyCloseMethodBreakdown = Record<
  DailyClosePaymentMethod,
  DailyCloseMethodSummary
>

export interface DailyCloseReconciliationSummary {
  linkedCardSales: number
  orphanProcessed: number
  refundedAfterSale: number
  cardLinkMismatches: number
}

export interface DailyClosePreview {
  storeId: string
  businessDate: string
  businessTimeZone: string
  generatedAt: string
  providerCallsMade: false
  salesCount: number
  salesTotal: number
  methods: DailyCloseMethodBreakdown
  reconciliation: DailyCloseReconciliationSummary
  status: DailyCloseStatus
  warnings: string[]
  sourceFingerprint: string
}

export interface DailyCloseRecord extends DailyClosePreview {
  id: string
  revision: number
  createdAt: string
  supersedesCloseId?: string
  audit: Array<{
    event: 'created'
    at: string
    actor: 'orbi-pos-server'
    detail: 'daily_close_snapshot'
  }>
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
    throw new Error(message || `Daily close API error ${response.status}`)
  }

  return body as T
}

export async function previewDailyClose(
  date?: string,
  storeId = ORBI_STORE_ID,
): Promise<DailyClosePreview> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/daily-close/preview${query}`),
    { cache: 'no-store' },
  )
  return await jsonOrError<DailyClosePreview>(response)
}

export async function listDailyCloses(
  storeId = ORBI_STORE_ID,
  limit = 200,
): Promise<DailyCloseRecord[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/daily-close?limit=${limit}`),
    { cache: 'no-store' },
  )
  return await jsonOrError<DailyCloseRecord[]>(response)
}

export async function createDailyClose(
  date: string,
  storeId = ORBI_STORE_ID,
): Promise<DailyCloseRecord> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/daily-close`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date }),
    },
  )
  return await jsonOrError<DailyCloseRecord>(response)
}
