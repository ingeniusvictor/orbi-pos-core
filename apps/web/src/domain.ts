export type UnitType = 'KG' | 'UNIT' | 'PACK'
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer'

export interface Category {
  id: string
  name: string
  icon: string
}

export interface Product {
  id: string
  categoryId: string
  name: string
  price: number
  unitType: UnitType
  plu?: string
  imageUrl?: string
  verifiedPilotData?: boolean
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

export interface Sale {
  id: string
  createdAt: string
  lines: CartLine[]
  paymentMethod: PaymentMethod
  total: number
}
