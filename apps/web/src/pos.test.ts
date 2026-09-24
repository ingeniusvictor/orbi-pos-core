import { describe, expect, it } from 'vitest'
import { cartTotal, lineSubtotal } from './pos'
import type { Product } from './domain'

const pernil: Product = {
  id: 'pernil',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
}

describe('ORBI POS calculations', () => {
  it('reproduces the rounded RM-60 pernil example', () => {
    expect(lineSubtotal(pernil, 1.146)).toBe(5613)
  })

  it('adds cart line subtotals', () => {
    expect(cartTotal([
      { id: '1', productId: 'a', name: 'A', unitPrice: 1000, quantity: 1, unitType: 'KG', subtotal: 1000 },
      { id: '2', productId: 'b', name: 'B', unitPrice: 2000, quantity: 1, unitType: 'KG', subtotal: 2000 },
    ])).toBe(3000)
  })
})
