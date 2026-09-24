import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ProductPayload {
  id: string
  code: string
  categoryId: string
  name: string
  price: number
  unitType: 'KG' | 'UNIT' | 'PACK'
  plu?: string
  imageUrl?: string
  promoText?: string
  active: boolean
  showOnShowcase: boolean
  featured: boolean
  sortOrder: number
  priceUpdatedAt?: string
  verifiedPilotData?: boolean
}

export interface PriceChangePayload {
  id: string
  productId: string
  productName: string
  previousPrice: number
  nextPrice: number
  changedAt: string
}

export interface CatalogSnapshot {
  storeId: string
  revision: number
  updatedAt: string
  products: ProductPayload[]
  priceHistory: PriceChangePayload[]
}

export class CatalogConflictError extends Error {
  constructor(public readonly current: CatalogSnapshot) {
    super('Catalog revision conflict')
  }
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateProducts(products: unknown): asserts products is ProductPayload[] {
  if (!Array.isArray(products)) throw new Error('products must be an array')

  const ids = new Set<string>()
  const codes = new Set<string>()
  const plus = new Set<string>()

  for (const candidate of products) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Invalid product')
    const product = candidate as Partial<ProductPayload>

    if (!product.id || !product.code || !product.name || !product.categoryId) {
      throw new Error('Product identity fields are required')
    }
    if (!/^[A-Z0-9-]{1,12}$/.test(product.code)) {
      throw new Error(`Invalid customer code: ${product.code}`)
    }
    if (product.plu !== undefined && !/^\d{1,6}$/.test(product.plu)) {
      throw new Error(`Invalid PLU for ${product.id}`)
    }
    if (!Number.isInteger(product.price) || (product.price ?? 0) <= 0) {
      throw new Error(`Invalid price for ${product.id}`)
    }
    if (!['KG', 'UNIT', 'PACK'].includes(product.unitType ?? '')) {
      throw new Error(`Invalid unit type for ${product.id}`)
    }
    if (!Number.isInteger(product.sortOrder) || (product.sortOrder ?? -1) < 0) {
      throw new Error(`Invalid sort order for ${product.id}`)
    }
    if (typeof product.active !== 'boolean'
      || typeof product.showOnShowcase !== 'boolean'
      || typeof product.featured !== 'boolean') {
      throw new Error(`Invalid product flags for ${product.id}`)
    }
    if (ids.has(product.id)) throw new Error(`Duplicate product id: ${product.id}`)
    if (codes.has(product.code)) throw new Error(`Duplicate customer code: ${product.code}`)
    if (product.plu && plus.has(product.plu)) throw new Error(`Duplicate PLU: ${product.plu}`)

    ids.add(product.id)
    codes.add(product.code)
    if (product.plu) plus.add(product.plu)
  }
}

function buildPriceChanges(
  current: CatalogSnapshot | null,
  nextProducts: ProductPayload[],
  changedAt: string,
  revision: number,
): PriceChangePayload[] {
  if (!current) return []

  const previousById = new Map(current.products.map((product) => [product.id, product]))

  return nextProducts.flatMap((product) => {
    const previous = previousById.get(product.id)
    if (!previous || previous.price === product.price) return []

    return [{
      id: `${product.id}-r${revision}-${changedAt}-${product.price}`,
      productId: product.id,
      productName: product.name,
      previousPrice: previous.price,
      nextPrice: product.price,
      changedAt,
    }]
  })
}

export class CatalogStore {
  constructor(
    private readonly dataDir: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'catalog.json')
  }

  async get(storeId: string): Promise<CatalogSnapshot | null> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as Omit<CatalogSnapshot, 'priceHistory'> & {
        priceHistory?: PriceChangePayload[]
      }

      return {
        ...parsed,
        priceHistory: Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async put(storeId: string, productsInput: unknown, baseRevision: number): Promise<CatalogSnapshot> {
    validateProducts(productsInput)
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new Error('baseRevision must be a non-negative integer')
    }

    const current = await this.get(storeId)
    const currentRevision = current?.revision ?? 0

    if (baseRevision !== currentRevision && current) {
      throw new CatalogConflictError(current)
    }
    if (!current && baseRevision !== 0) {
      throw new Error('Cannot initialize catalog from a non-zero revision')
    }

    const revision = currentRevision + 1
    const updatedAt = this.now()
    const priceChanges = buildPriceChanges(current, productsInput, updatedAt, revision)
    const changedIds = new Set(priceChanges.map((change) => change.productId))

    const products = productsInput.map((product) =>
      changedIds.has(product.id)
        ? { ...product, priceUpdatedAt: updatedAt }
        : product,
    )

    const snapshot: CatalogSnapshot = {
      storeId,
      revision,
      updatedAt,
      products,
      priceHistory: [
        ...priceChanges,
        ...(current?.priceHistory ?? []),
      ].slice(0, 1000),
    }

    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8')
    await rename(temp, file)

    return snapshot
  }
}
