import { describe, expect, it } from 'vitest'
import { applyPricePatches, validatePrice } from './catalog-service'
import type { Product } from './domain'

const product: Product = {
  id: 'pernil',
  code: '101',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
  active: true,
  showOnShowcase: true,
  featured: true,
  sortOrder: 1,
}

describe('master catalog pricing', () => {
  it('records old and new price in history', () => {
    const changedAt = '2026-09-24T18:00:00.000Z'
    const result = applyPricePatches([product], [{ productId: 'pernil', nextPrice: 5190 }], changedAt)

    expect(result.products[0].price).toBe(5190)
    expect(result.history).toEqual([
      expect.objectContaining({
        productId: 'pernil',
        previousPrice: 4898,
        nextPrice: 5190,
        changedAt,
      }),
    ])
  })

  it('does not create history when price did not change', () => {
    const result = applyPricePatches([product], [{ productId: 'pernil', nextPrice: 4898 }])
    expect(result.history).toHaveLength(0)
  })

  it('rejects invalid prices', () => {
    expect(validatePrice(0)).toBe(false)
    expect(validatePrice(4990.5)).toBe(false)
    expect(validatePrice(4990)).toBe(true)
  })
})
