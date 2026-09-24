import type { Product } from './domain'

/**
 * Presentation-only data for /showcase-demo.
 *
 * These products/codes/prices are deliberately illustrative. They are not
 * verified El Chunchito business data and are never published to the shared
 * catalog.
 */
export const demoProducts: Product[] = [
  {
    id: 'demo-pernil',
    code: 'D101',
    categoryId: 'pork',
    name: 'Pernil',
    price: 5990,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: true,
    sortOrder: 1,
    promoText: 'IDEAL PARA HORNO',
  },
  {
    id: 'demo-costillar',
    code: 'D102',
    categoryId: 'pork',
    name: 'Costillar',
    price: 7490,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: true,
    sortOrder: 2,
    promoText: 'ESPECIAL PARRILLA',
  },
  {
    id: 'demo-lomo-vetado',
    code: 'D103',
    categoryId: 'meat',
    name: 'Lomo vetado',
    price: 12990,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 3,
    promoText: 'CORTE PREMIUM',
  },
  {
    id: 'demo-pulpa',
    code: 'D104',
    categoryId: 'meat',
    name: 'Pulpa',
    price: 7990,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 4,
    promoText: 'VERSÁTIL Y FRESCA',
  },
  {
    id: 'demo-asado-carnicero',
    code: 'D105',
    categoryId: 'meat',
    name: 'Asado carnicero',
    price: 8490,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 5,
    promoText: 'FAVORITO DE LA PARRILLA',
  },
  {
    id: 'demo-carne-molida',
    code: 'D106',
    categoryId: 'meat',
    name: 'Carne molida',
    price: 6490,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 6,
    promoText: 'PREPARADA AL MOMENTO',
  },
]

export function demoCatalogIsIsolated(products: Product[]): boolean {
  return products.length === 6
    && products.every((product) =>
      product.id.startsWith('demo-')
      && product.code.startsWith('D')
      && product.plu === undefined
      && product.verifiedPilotData !== true,
    )
}
