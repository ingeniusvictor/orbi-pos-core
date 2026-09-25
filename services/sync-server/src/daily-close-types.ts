import type { SalePaymentMethod } from './sale-types.js'

export type DailyCloseStatus = 'reconciled' | 'attention_required'

export interface DailyCloseMethodSummary {
  count: number
  total: number
}

export type DailyCloseMethodBreakdown = Record<
  SalePaymentMethod,
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

export interface DailyCloseAuditEvent {
  event: 'created'
  at: string
  actor: 'orbi-pos-server'
  detail: 'daily_close_snapshot'
}

export interface DailyCloseRecord extends DailyClosePreview {
  id: string
  revision: number
  createdAt: string
  supersedesCloseId?: string
  audit: DailyCloseAuditEvent[]
}
