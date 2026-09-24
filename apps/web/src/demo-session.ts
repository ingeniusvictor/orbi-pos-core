import type { PaymentMethod, Product } from './domain'
import { cartTotal, lineSubtotal } from './pos'

export type DemoPaymentMethod = Extract<PaymentMethod, 'debit' | 'credit'>

export type DemoPaymentStatus =
  | 'idle'
  | 'created'
  | 'at_terminal'
  | 'processed'
  | 'failed'
  | 'canceled'
  | 'expired'

export interface DemoCartLine {
  id: string
  productId: string
  code: string
  name: string
  unitPrice: number
  quantity: number
  unitType: Product['unitType']
  subtotal: number
}

export interface DemoReceipt {
  reference: string
  createdAt: string
  paymentMethod: DemoPaymentMethod
  total: number
  lines: DemoCartLine[]
}

const allowedTransitions: Record<DemoPaymentStatus, DemoPaymentStatus[]> = {
  idle: ['created'],
  created: ['at_terminal', 'canceled', 'expired'],
  at_terminal: ['processed', 'failed', 'canceled', 'expired'],
  processed: [],
  failed: [],
  canceled: [],
  expired: [],
}

export function makeDemoLine(
  product: Product,
  quantity: number,
  id = `demo-line-${product.id}`,
): DemoCartLine {
  if (!product.id.startsWith('demo-')) {
    throw new Error('Owner demo session accepts demo products only')
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Demo quantity must be positive')
  }

  return {
    id,
    productId: product.id,
    code: product.code,
    name: product.name,
    unitPrice: product.price,
    quantity,
    unitType: product.unitType,
    subtotal: lineSubtotal(product, quantity),
  }
}

export function demoCartTotal(lines: DemoCartLine[]): number {
  return cartTotal(lines)
}

export function transitionDemoPayment(
  current: DemoPaymentStatus,
  next: DemoPaymentStatus,
): DemoPaymentStatus {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid demo payment transition: ${current} -> ${next}`)
  }
  return next
}

export function createDemoReference(now: Date, suffix = 'OWNER'): string {
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const sec = String(now.getSeconds()).padStart(2, '0')
  return `DEMO-${yyyy}${mm}${dd}-${hh}${min}${sec}-${suffix}`
}

export function completeDemoReceipt(
  status: DemoPaymentStatus,
  reference: string,
  lines: DemoCartLine[],
  paymentMethod: DemoPaymentMethod,
  createdAt = new Date().toISOString(),
): DemoReceipt {
  if (status !== 'processed') {
    throw new Error('Demo receipt can only be completed after processed payment')
  }
  if (!lines.length) {
    throw new Error('Demo receipt requires at least one cart line')
  }

  return {
    reference,
    createdAt,
    paymentMethod,
    total: demoCartTotal(lines),
    lines: lines.map((line) => ({ ...line })),
  }
}

export function demoSessionIsIsolated(products: Product[]): boolean {
  return products.length > 0
    && products.every((product) =>
      product.id.startsWith('demo-')
      && product.code.startsWith('D')
      && product.verifiedPilotData !== true,
    )
}
