import type { PriceChange, Product, UnitType } from './domain'
import { isValidPlu } from './scale-mapping'

export interface PricePatch {
  productId: string
  nextPrice: number
}

export interface ProductIdentityDraft {
  code: string
  name: string
  categoryId: string
  price: number
  unitType: UnitType
  plu?: string
}

export function validatePrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value)
}

export function normalizeProductCode(value: string): string {
  return value.trim().toUpperCase()
}

export function validateProductCode(value: string): boolean {
  return /^[A-Z0-9-]{1,12}$/.test(normalizeProductCode(value))
}

export function validateProductDraft(
  products: Product[],
  draft: ProductIdentityDraft,
  ignoreProductId?: string,
): string[] {
  const errors: string[] = []
  const code = normalizeProductCode(draft.code)
  const name = draft.name.trim()
  const plu = draft.plu?.trim() ?? ''

  if (!validateProductCode(code)) {
    errors.push('El código debe tener 1 a 12 caracteres: letras, números o guion.')
  }
  if (!name) errors.push('El nombre del producto es obligatorio.')
  if (!draft.categoryId.trim()) errors.push('La categoría es obligatoria.')
  if (!validatePrice(draft.price)) errors.push('El precio debe ser un valor CLP entero mayor que 0.')
  if (!['KG', 'UNIT', 'PACK'].includes(draft.unitType)) errors.push('La unidad de venta no es válida.')
  if (!isValidPlu(plu)) errors.push('El PLU debe tener 1 a 6 dígitos o quedar vacío.')

  const others = products.filter((product) => product.id !== ignoreProductId)

  if (code && others.some((product) => normalizeProductCode(product.code) === code)) {
    errors.push(`El código ${code} ya pertenece a otro producto.`)
  }

  if (plu && others.some((product) => product.plu === plu)) {
    errors.push(`El PLU ${plu} ya pertenece a otro producto.`)
  }

  return errors
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
  const slug = `${normalizeProductCode(code)}-${name}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `product-${Date.now()}`
}
