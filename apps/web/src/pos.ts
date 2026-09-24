import type { CartLine, PaymentMethod, Product, Sale } from './domain'

export function roundMoney(value: number): number {
  return Math.round(value)
}

export function lineSubtotal(product: Product, quantity: number): number {
  return roundMoney(product.price * quantity)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.subtotal, 0)
}

export function makeCartLine(product: Product, quantity: number): CartLine {
  return {
    id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    unitType: product.unitType,
    subtotal: lineSubtotal(product, quantity),
  }
}

export function completeSale(lines: CartLine[], paymentMethod: PaymentMethod): Sale {
  return {
    id: `sale-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lines,
    paymentMethod,
    total: cartTotal(lines),
  }
}

export function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function paymentLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: 'Efectivo',
    debit: 'Débito',
    credit: 'Crédito',
    transfer: 'Transferencia',
  }
  return labels[method]
}
