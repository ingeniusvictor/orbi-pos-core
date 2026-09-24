import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { buildCatalogCsv, previewCatalogImport } from './catalog-csv'

const current: Product[] = [{
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
}]

const categories = ['meat', 'pork', 'chicken', 'cold-cuts', 'other']

describe('catalog CSV', () => {
  it('preserves PLU leading zeroes on export/import round trip', () => {
    const csv = buildCatalogCsv(current)
    const preview = previewCatalogImport(csv, current, categories)

    expect(csv).toContain('0047')
    expect(preview.rejected).toBe(0)
    expect(preview.nextProducts[0].plu).toBe('0047')
  })

  it('adds and updates by customer-facing code without deleting absent products', () => {
    const csv = [
      'code,name,category,price_clp,unit,plu,image_url,promo_text,show_on_showcase,featured,active,sort_order',
      '101,Pernil,pork,5190,KG,0047,,,true,true,true,1',
      '102,Costillar,pork,6990,KG,0050,,,true,false,true,2',
    ].join('\n')

    const preview = previewCatalogImport(csv, current, categories)

    expect(preview.updated).toBe(1)
    expect(preview.added).toBe(1)
    expect(preview.nextProducts).toHaveLength(2)
    expect(preview.nextProducts.find((product) => product.code === '101')?.price).toBe(5190)
  })

  it('rejects invalid prices and duplicate CSV codes', () => {
    const csv = [
      'code,name,category,price_clp,unit',
      '200,Producto,pork,0,KG',
      '200,Otro,pork,5000,KG',
    ].join('\n')

    const preview = previewCatalogImport(csv, current, categories)

    expect(preview.rejected).toBe(2)
    expect(preview.nextProducts).toEqual(current)
  })

  it('rejects duplicate PLUs against the existing catalog', () => {
    const csv = [
      'code,name,category,price_clp,unit,plu',
      '102,Costillar,pork,6990,KG,0047',
    ].join('\n')

    const preview = previewCatalogImport(csv, current, categories)
    expect(preview.rejected).toBe(1)
    expect(preview.nextProducts).toEqual(current)
  })
})
