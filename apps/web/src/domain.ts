export type UnitType = 'KG' | 'UNIT' | 'PACK'
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer'

export interface Category {
  id: string
  name: string
  icon: string
}

export interface Product {
  id: string
  code: string
  categoryId: string
  name: string
  price: number
  unitType: UnitType
  plu?: string
  imageUrl?: string
  promoText?: string
  active: boolean
  showOnShowcase: boolean
  featured: boolean
  sortOrder: number
  priceUpdatedAt?: string
  verifiedPilotData?: boolean
}

export interface PriceChange {
  id: string
  productId: string
  productName: string
  previousPrice: number
  nextPrice: number
  changedAt: string
}

export interface CartLine {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  unitType: UnitType
  subtotal: number
}

export interface SalePayment {
  provider: 'mock' | 'mercadopago'
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

export interface Sale {
  id: string
  storeId?: string
  clientRequestId?: string
  createdAt: string
  recordedAt?: string
  source?: 'orbi-pos-web'
  lines: CartLine[]
  paymentMethod: PaymentMethod
  total: number
  payment?: SalePayment
  audit?: SaleAuditEvent[]
}
