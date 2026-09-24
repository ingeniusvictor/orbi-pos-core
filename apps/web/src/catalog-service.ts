import type { PriceChange, Product } from './domain'

export interface PricePatch {
  productId: string
  nextPrice: number
}

export function validatePrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value)
}

export function applyPricePatches(
  products: Product[],
  patches: PricePatch[],
  changedAt = new Date().toISOString(),
): { products: Product[]; history: PriceChange[] } {
  const patchMap = new Map(patches.map((patch) => [patch.productId, patch.nextPrice]))
  const history: PriceChange[] = []

  const nextProducts = products.map((product) => {
    const nextPrice = patchMap.get(product.id)
    if (nextPrice === undefined || nextPrice === product.price) return product
    if (!validatePrice(nextPrice)) throw new Error(`Invalid price for ${product.id}`)

    history.push({
      id: `${product.id}-${changedAt}-${nextPrice}`,
      productId: product.id,
      productName: product.name,
      previousPrice: product.price,
      nextPrice,
      changedAt,
    })

    return { ...product, price: nextPrice, priceUpdatedAt: changedAt }
  })

  return { products: nextProducts, history }
}

export function createProductId(code: string, name: string): string {
  const slug = `${code}-${name}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `product-${Date.now()}`
}
