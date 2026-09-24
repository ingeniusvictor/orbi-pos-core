import type { Product } from './domain'

export interface PluPatch {
  productId: string
  plu: string
}

export function normalizePlu(value: string): string {
  return value.trim()
}

export function isValidPlu(value: string): boolean {
  const normalized = normalizePlu(value)
  return normalized === '' || /^\d{1,6}$/.test(normalized)
}

export function applyPluPatches(products: Product[], patches: PluPatch[]): Product[] {
  const patchMap = new Map(patches.map((patch) => [patch.productId, normalizePlu(patch.plu)]))

  const next = products.map((product) => {
    if (!patchMap.has(product.id)) return product
    const plu = patchMap.get(product.id) ?? ''
    if (!isValidPlu(plu)) throw new Error(`PLU inválido para ${product.name}`)
    return { ...product, plu: plu || undefined }
  })

  const owners = new Map<string, string>()
  for (const product of next) {
    if (!product.plu) continue
    const existing = owners.get(product.plu)
    if (existing) {
      throw new Error(`El PLU ${product.plu} está repetido en ${existing} y ${product.name}`)
    }
    owners.set(product.plu, product.name)
  }

  return next
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildRm60MappingCsv(products: Product[]): string {
  const rows = [
    ['customer_code', 'orbi_product', 'rm60_plu', 'price_clp', 'unit', 'status'],
    ...products
      .filter((product) => product.active)
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
      .map((product) => [
        product.code,
        product.name,
        product.plu ?? '',
        product.price,
        product.unitType,
        product.plu ? 'mapped' : 'pending',
      ]),
  ]

  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}
