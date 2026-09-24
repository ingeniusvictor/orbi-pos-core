import { describe, expect, it } from 'vitest'
import {
  applyPricePatches,
  normalizeProductCode,
  revertLatestPriceBatch,
  validatePrice,
  validateProductCode,
  validateProductDraft,
} from './catalog-service'
import type { Product } from './domain'

const product: Product = {
  id: 'pernil',
  code: '101',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
  plu: '0047',
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

  it('rolls back the latest multi-product price batch as one operation', () => {
    const second: Product = {
      ...product,
      id: 'orejas',
      code: '102',
      name: 'Orejas y corazón',
      price: 4800,
      plu: '0048',
      featured: false,
      sortOrder: 2,
    }

    const changed = applyPricePatches(
      [product, second],
      [
        { productId: 'pernil', nextPrice: 5190 },
        { productId: 'orejas', nextPrice: 4990 },
      ],
      '2026-09-24T18:00:00.000Z',
    )

    const rollback = revertLatestPriceBatch(
      changed.products,
      changed.history,
      '2026-09-24T18:10:00.000Z',
    )

    expect(rollback.revertedCount).toBe(2)
    expect(rollback.skippedCount).toBe(0)
    expect(rollback.products.map((item) => item.price)).toEqual([4898, 4800])
    expect(rollback.history).toHaveLength(2)
    expect(rollback.history[0].changedAt).toBe('2026-09-24T18:10:00.000Z')
  })

  it('does not overwrite a newer price while rolling back an older local batch', () => {
    const changed = applyPricePatches(
      [product],
      [{ productId: 'pernil', nextPrice: 5190 }],
      '2026-09-24T18:00:00.000Z',
    )

    const remotelyChanged = changed.products.map((item) => ({ ...item, price: 5290 }))
    const rollback = revertLatestPriceBatch(
      remotelyChanged,
      changed.history,
      '2026-09-24T18:10:00.000Z',
    )

    expect(rollback.revertedCount).toBe(0)
    expect(rollback.skippedCount).toBe(1)
    expect(rollback.products[0].price).toBe(5290)
  })
})

describe('master catalog identity integrity', () => {
  it('normalizes short customer codes', () => {
    expect(normalizeProductCode('  a-12 ')).toBe('A-12')
    expect(validateProductCode('A-12')).toBe(true)
    expect(validateProductCode('código largo con espacios')).toBe(false)
  })

  it('rejects duplicate customer codes', () => {
    const errors = validateProductDraft([product], {
      code: '101',
      name: 'Otro corte',
      categoryId: 'pork',
      price: 5000,
      unitType: 'KG',
    })

    expect(errors.some((error) => error.includes('código 101'))).toBe(true)
  })

  it('rejects duplicate PLUs', () => {
    const errors = validateProductDraft([product], {
      code: '102',
      name: 'Otro corte',
      categoryId: 'pork',
      price: 5000,
      unitType: 'KG',
      plu: '0047',
    })

    expect(errors.some((error) => error.includes('PLU 0047'))).toBe(true)
  })

  it('allows editing a product without conflicting with itself', () => {
    const errors = validateProductDraft([product], {
      code: '101',
      name: 'Pernil de cerdo',
      categoryId: 'pork',
      price: 4898,
      unitType: 'KG',
      plu: '0047',
    }, 'pernil')

    expect(errors).toEqual([])
  })
})
