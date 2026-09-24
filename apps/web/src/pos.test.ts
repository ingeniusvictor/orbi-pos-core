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

const orejasCorazon: Product = {
  id: 'orejas-corazon',
  categoryId: 'pork',
  name: 'Orejas y corazón',
  price: 4800,
  unitType: 'KG',
}

describe('ORBI POS calculations', () => {
  it('matches the RM-60 pernil receipt line', () => {
    expect(lineSubtotal(pernil, 1.146)).toBe(5610)
  })

  it('matches the RM-60 orejas y corazón receipt line', () => {
    expect(lineSubtotal(orejasCorazon, 2.106)).toBe(10110)
  })

  it('matches the complete RM-60 receipt total', () => {
    expect(cartTotal([
      { id: '1', productId: pernil.id, name: pernil.name, unitPrice: pernil.price, quantity: 1.146, unitType: 'KG', subtotal: lineSubtotal(pernil, 1.146) },
      { id: '2', productId: orejasCorazon.id, name: orejasCorazon.name, unitPrice: orejasCorazon.price, quantity: 2.106, unitType: 'KG', subtotal: lineSubtotal(orejasCorazon, 2.106) },
    ])).toBe(15720)
  })
})
