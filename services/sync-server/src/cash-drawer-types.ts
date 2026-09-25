export type CashDrawerSessionStatus = 'open' | 'closed'
export type CashDrawerMovementType = 'paid_in' | 'paid_out'

export interface CashDrawerMovement {
  id: string
  type: CashDrawerMovementType
  amount: number
  reason: string
  createdAt: string
}

export interface CashDrawerCashSalesSnapshot {
  count: number
  total: number
  through: string
}

export interface CashDrawerAuditEvent {
  event: 'opened' | 'movement_added' | 'closed'
  at: string
  actor: 'orbi-pos-server'
  detail: string
}

export interface CashDrawerSession {
  id: string
  storeId: string
  businessDate: string
  businessTimeZone: string
  openedAt: string
  closedAt?: string
  openingFloat: number
  status: CashDrawerSessionStatus
  movements: CashDrawerMovement[]
  cashSales?: CashDrawerCashSalesSnapshot
  paidInTotal?: number
  paidOutTotal?: number
  expectedCash?: number
  countedCash?: number
  variance?: number
  sourceFingerprint?: string
  audit: CashDrawerAuditEvent[]
}

export interface CashDrawerPreview {
  sessionId: string
  storeId: string
  businessDate: string
  businessTimeZone: string
  generatedAt: string
  openingFloat: number
  cashSales: CashDrawerCashSalesSnapshot
  paidInTotal: number
  paidOutTotal: number
  expectedCash: number
  sourceFingerprint: string
  providerCallsMade: false
}
