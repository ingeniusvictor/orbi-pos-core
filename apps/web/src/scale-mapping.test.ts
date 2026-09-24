import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { applyPluPatches, buildRm60MappingCsv, isValidPlu } from './scale-mapping'

const base: Product[] = [
  {
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
  },
  {
    id: 'orejas',
    code: '102',
    categoryId: 'pork',
    name: 'Orejas y corazón',
    price: 4800,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 2,
  },
]

describe('RM-60 PLU mapping', () => {
  it('preserves leading zeroes because PLU is an identifier, not a number', () => {
    const result = applyPluPatches(base, [{ productId: 'pernil', plu: '0047' }])
    expect(result[0].plu).toBe('0047')
  })

  it('rejects duplicate PLUs', () => {
    expect(() => applyPluPatches(base, [
      { productId: 'pernil', plu: '47' },
      { productId: 'orejas', plu: '47' },
    ])).toThrow('PLU 47')
  })

  it('accepts empty PLU while discovery is pending', () => {
    expect(isValidPlu('')).toBe(true)
    expect(isValidPlu('ABC')).toBe(false)
  })

  it('exports a mapping CSV for field comparison', () => {
    const mapped = applyPluPatches(base, [{ productId: 'pernil', plu: '0047' }])
    const csv = buildRm60MappingCsv(mapped)
    expect(csv).toContain('101,Pernil,0047,4898,KG,mapped')
    expect(csv).toContain('102,Orejas y corazón,,4800,KG,pending')
  })
})
