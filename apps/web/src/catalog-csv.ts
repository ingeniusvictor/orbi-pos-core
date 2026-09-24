import { createProductId } from './catalog-service'
import type { Product, UnitType } from './domain'
import { isValidPlu } from './scale-mapping'

export interface CatalogImportRow {
  line: number
  code: string
  status: 'add' | 'update' | 'unchanged' | 'rejected'
  product?: Product
  errors: string[]
}

export interface CatalogImportPreview {
  rows: CatalogImportRow[]
  nextProducts: Product[]
  added: number
  updated: number
  unchanged: number
  rejected: number
}

const EXPORT_HEADERS = [
  'code',
  'name',
  'category',
  'price_clp',
  'unit',
  'plu',
  'image_url',
  'promo_text',
  'show_on_showcase',
  'featured',
  'active',
  'sort_order',
] as const

function parseRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

function csvCell(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function parseBoolean(value: string, fallback: boolean): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'true', 'yes', 'si', 'sí', 'y'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  return null
}

function parseUnit(value: string): UnitType | null {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'KG' || normalized === 'UNIT' || normalized === 'PACK') return normalized
  return null
}

function sameProduct(a: Product, b: Product): boolean {
  return a.id === b.id
    && a.code === b.code
    && a.name === b.name
    && a.categoryId === b.categoryId
    && a.price === b.price
    && a.unitType === b.unitType
    && (a.plu ?? '') === (b.plu ?? '')
    && (a.imageUrl ?? '') === (b.imageUrl ?? '')
    && (a.promoText ?? '') === (b.promoText ?? '')
    && a.active === b.active
    && a.showOnShowcase === b.showOnShowcase
    && a.featured === b.featured
    && a.sortOrder === b.sortOrder
}

export function buildCatalogCsv(products: Product[]): string {
  const lines = [EXPORT_HEADERS.join(',')]

  const ordered = [...products].sort((a, b) =>
    a.code.localeCompare(b.code, 'es', { numeric: true }),
  )

  for (const product of ordered) {
    lines.push([
      product.code,
      product.name,
      product.categoryId,
      product.price,
      product.unitType,
      product.plu,
      product.imageUrl,
      product.promoText,
      product.showOnShowcase,
      product.featured,
      product.active,
      product.sortOrder,
    ].map(csvCell).join(','))
  }

  return lines.join('\n')
}

export function buildCatalogTemplateCsv(): string {
  return [
    EXPORT_HEADERS.join(','),
    '101,Pernil,pork,4898,KG,,,Corte fresco,true,true,true,1',
    ',,,,,,,,,,,',
  ].join('\n')
}

export function previewCatalogImport(
  csv: string,
  currentProducts: Product[],
  validCategoryIds: string[],
): CatalogImportPreview {
  const rawRows = parseRows(csv)
  if (!rawRows.length) {
    return { rows: [], nextProducts: currentProducts, added: 0, updated: 0, unchanged: 0, rejected: 0 }
  }

  const headers = rawRows[0].map((header) => header.trim().toLowerCase())
  const required = ['code', 'name', 'category', 'price_clp', 'unit']
  const missing = required.filter((header) => !headers.includes(header))
  if (missing.length) {
    const row: CatalogImportRow = {
      line: 1,
      code: '',
      status: 'rejected',
      errors: [`Faltan columnas requeridas: ${missing.join(', ')}`],
    }
    return { rows: [row], nextProducts: currentProducts, added: 0, updated: 0, unchanged: 0, rejected: 1 }
  }

  const valueAt = (cells: string[], name: string) => {
    const index = headers.indexOf(name)
    return index >= 0 ? (cells[index] ?? '').trim() : ''
  }

  const byCode = new Map(currentProducts.map((product) => [product.code, product]))
  const seenCodes = new Set<string>()
  const rows: CatalogImportRow[] = []
  const candidates = new Map<string, Product>()

  rawRows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2
    const code = valueAt(cells, 'code')
    const name = valueAt(cells, 'name')
    const categoryId = valueAt(cells, 'category')
    const priceText = valueAt(cells, 'price_clp').replace(/[^0-9]/g, '')
    const price = Number(priceText)
    const unitType = parseUnit(valueAt(cells, 'unit'))
    const plu = valueAt(cells, 'plu')
    const imageUrl = valueAt(cells, 'image_url')
    const promoText = valueAt(cells, 'promo_text')
    const existing = byCode.get(code)
    const errors: string[] = []

    if (!code) errors.push('Código requerido')
    if (code && seenCodes.has(code)) errors.push('Código repetido dentro del CSV')
    if (!name) errors.push('Nombre requerido')
    if (!validCategoryIds.includes(categoryId)) errors.push(`Categoría desconocida: ${categoryId || '(vacía)'}`)
    if (!Number.isInteger(price) || price <= 0) errors.push('Precio debe ser un entero CLP mayor que 0')
    if (!unitType) errors.push('Unidad debe ser KG, UNIT o PACK')
    if (!isValidPlu(plu)) errors.push('PLU debe tener 1 a 6 dígitos o quedar vacío')

    const showOnShowcase = parseBoolean(valueAt(cells, 'show_on_showcase'), existing?.showOnShowcase ?? true)
    const featured = parseBoolean(valueAt(cells, 'featured'), existing?.featured ?? false)
    const active = parseBoolean(valueAt(cells, 'active'), existing?.active ?? true)

    if (showOnShowcase === null) errors.push('show_on_showcase debe ser true/false')
    if (featured === null) errors.push('featured debe ser true/false')
    if (active === null) errors.push('active debe ser true/false')

    const sortText = valueAt(cells, 'sort_order')
    const sortOrder = sortText ? Number(sortText) : (existing?.sortOrder ?? currentProducts.length + rowIndex + 1)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) errors.push('sort_order debe ser un entero >= 0')

    if (code) seenCodes.add(code)

    if (errors.length || !unitType || showOnShowcase === null || featured === null || active === null) {
      rows.push({ line, code, status: 'rejected', errors })
      return
    }

    const product: Product = {
      id: existing?.id ?? createProductId(code, name),
      code,
      name,
      categoryId,
      price,
      unitType,
      plu: plu || existing?.plu,
      imageUrl: imageUrl || existing?.imageUrl,
      promoText: promoText || existing?.promoText,
      active,
      showOnShowcase,
      featured,
      sortOrder,
      priceUpdatedAt: existing && existing.price === price
        ? existing.priceUpdatedAt
        : new Date().toISOString(),
      verifiedPilotData: existing?.verifiedPilotData,
    }

    candidates.set(code, product)
    const status = !existing ? 'add' : sameProduct(existing, product) ? 'unchanged' : 'update'
    rows.push({ line, code, status, product, errors: [] })
  })

  const combined = currentProducts.map((product) => candidates.get(product.code) ?? product)
  const existingCodes = new Set(currentProducts.map((product) => product.code))
  for (const [code, product] of candidates) {
    if (!existingCodes.has(code)) combined.push(product)
  }

  const pluOwners = new Map<string, string>()
  const duplicatePlus = new Set<string>()
  for (const product of combined) {
    if (!product.plu) continue
    if (pluOwners.has(product.plu) && pluOwners.get(product.plu) !== product.code) {
      duplicatePlus.add(product.plu)
    } else {
      pluOwners.set(product.plu, product.code)
    }
  }

  if (duplicatePlus.size) {
    for (const row of rows) {
      if (row.product?.plu && duplicatePlus.has(row.product.plu)) {
        row.status = 'rejected'
        row.errors.push(`PLU repetido en catálogo: ${row.product.plu}`)
        candidates.delete(row.code)
      }
    }
  }

  const safeCombined = currentProducts.map((product) => candidates.get(product.code) ?? product)
  for (const [code, product] of candidates) {
    if (!existingCodes.has(code)) safeCombined.push(product)
  }

  return {
    rows,
    nextProducts: safeCombined,
    added: rows.filter((row) => row.status === 'add').length,
    updated: rows.filter((row) => row.status === 'update').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
  }
}
