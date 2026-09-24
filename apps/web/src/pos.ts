import type { CartLine, PaymentMethod, Product, Sale, SalePayment } from './domain'

/**
 * The DIGI RM-60 pilot receipt rounds line totals to the nearest CLP 10.
 * Example: 1.146 kg × CLP 4,898/kg = CLP 5,613.108 -> CLP 5,610.
 */
export function roundMoney(value: number): number {
  return Math.round(value / 10) * 10
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

export function completeSale(
  lines: CartLine[],
  paymentMethod: PaymentMethod,
  payment?: SalePayment,
): Sale {
  return {
    id: payment?.externalReference ?? `sale-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lines,
    paymentMethod,
    total: cartTotal(lines),
    payment,
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
