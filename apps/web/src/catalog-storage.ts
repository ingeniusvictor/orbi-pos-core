import { initialProducts } from './catalog'
import type { PriceChange, Product } from './domain'

const CATALOG_KEY = 'orbi-pos:catalog:v1'
const PRICE_HISTORY_KEY = 'orbi-pos:price-history:v1'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadCatalog(): Product[] {
  const saved = safeParse<Product[]>(localStorage.getItem(CATALOG_KEY), [])
  return saved.length ? saved : initialProducts
}

export function saveCatalog(products: Product[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(products))
}

export function loadPriceHistory(): PriceChange[] {
  return safeParse<PriceChange[]>(localStorage.getItem(PRICE_HISTORY_KEY), [])
}

export function savePriceHistory(history: PriceChange[]): void {
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history.slice(0, 500)))
}
