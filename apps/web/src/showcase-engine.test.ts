import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { buildShowcasePages, nextShowcasePage, visibleShowcaseProducts } from './showcase-engine'

function makeProduct(index: number, changes: Partial<Product> = {}): Product {
  return {
    id: `p${index}`,
    code: String(100 + index),
    categoryId: 'meat',
    name: `Producto ${index}`,
    price: 4990 + index * 10,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: index,
    ...changes,
  }
}

describe('Showcase content engine', () => {
  it('filters hidden products and sorts by display order', () => {
    const products = [
      makeProduct(1, { sortOrder: 3 }),
      makeProduct(2, { sortOrder: 1 }),
      makeProduct(3, { showOnShowcase: false }),
    ]
    expect(visibleShowcaseProducts(products).map((product) => product.id)).toEqual(['p2', 'p1'])
  })

  it('builds hero pages for featured products plus paginated boards', () => {
    const products = Array.from({ length: 8 }, (_, index) =>
      makeProduct(index + 1, { featured: index < 2 }),
    )
    const pages = buildShowcasePages(products, 6)

    expect(pages.filter((page) => page.type === 'hero')).toHaveLength(2)
    expect(pages.filter((page) => page.type === 'board')).toHaveLength(2)
  })

  it('falls back to the first visible product when no hero is selected', () => {
    const pages = buildShowcasePages([makeProduct(1), makeProduct(2)])
    expect(pages[0]).toMatchObject({ type: 'hero', product: { id: 'p1' } })
  })

  it('wraps rotation back to the first slide', () => {
    expect(nextShowcasePage(3, 4)).toBe(0)
    expect(nextShowcasePage(0, 1)).toBe(0)
  })
})
