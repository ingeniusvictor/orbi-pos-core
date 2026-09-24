import type { Product } from './domain'

export type ShowcasePage =
  | { id: string; type: 'hero'; product: Product }
  | { id: string; type: 'board'; products: Product[]; pageNumber: number; pageCount: number }

export const DEFAULT_SHOWCASE_ROTATION_MS = 8000

export function visibleShowcaseProducts(products: Product[]): Product[] {
  return products
    .filter((product) => product.active && product.showOnShowcase)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'es', { numeric: true }))
}

export function buildShowcasePages(products: Product[], pageSize = 6): ShowcasePage[] {
  const visible = visibleShowcaseProducts(products)
  if (!visible.length) return []

  const featured = visible.filter((product) => product.featured)
  const heroes = (featured.length ? featured : [visible[0]]).map<ShowcasePage>((product) => ({
    id: `hero-${product.id}`,
    type: 'hero',
    product,
  }))

  const chunks: Product[][] = []
  for (let index = 0; index < visible.length; index += pageSize) {
    chunks.push(visible.slice(index, index + pageSize))
  }

  const boards = chunks.map<ShowcasePage>((chunk, index) => ({
    id: `board-${index + 1}`,
    type: 'board',
    products: chunk,
    pageNumber: index + 1,
    pageCount: chunks.length,
  }))

  return [...heroes, ...boards]
}

export function nextShowcasePage(current: number, pageCount: number): number {
  if (pageCount <= 1) return 0
  return (current + 1) % pageCount
}
