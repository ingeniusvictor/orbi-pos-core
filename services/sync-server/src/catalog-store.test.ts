import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CatalogStore, type ProductPayload } from './catalog-store.js'

const dirs: string[] = []

const pernil: ProductPayload = {
  id: 'pernil',
  code: '101',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
  active: true,
  showOnShowcase: true,
  featured: true,
  sortOrder: 1,
}

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-sync-'))
  dirs.push(dir)
  return new CatalogStore(dir, () => '2026-09-24T18:30:00.000Z')
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('CatalogStore', () => {
  it('initializes a store at revision 1', async () => {
    const store = await makeStore()
    const snapshot = await store.put('el-chunchito', [pernil], 0)

    expect(snapshot.revision).toBe(1)
    expect(snapshot.products[0].price).toBe(4898)
    expect(snapshot.priceHistory).toEqual([])
    expect(await store.get('el-chunchito')).toEqual(snapshot)
  })

  it('increments revision on update', async () => {
    const store = await makeStore()
    await store.put('el-chunchito', [pernil], 0)

    const snapshot = await store.put('el-chunchito', [{ ...pernil, price: 5190 }], 1)
    expect(snapshot.revision).toBe(2)
    expect(snapshot.products[0].price).toBe(5190)
    expect(snapshot.priceHistory).toEqual([
      expect.objectContaining({
        productId: 'pernil',
        productName: 'Pernil',
        previousPrice: 4898,
        nextPrice: 5190,
        changedAt: '2026-09-24T18:30:00.000Z',
      }),
    ])
    expect(snapshot.products[0].priceUpdatedAt).toBe('2026-09-24T18:30:00.000Z')
  })

  it('does not create audit entries for metadata-only catalog changes', async () => {
    const store = await makeStore()
    await store.put('el-chunchito', [pernil], 0)

    const snapshot = await store.put('el-chunchito', [{ ...pernil, promoText: 'Destacado' }], 1)
    expect(snapshot.priceHistory).toEqual([])
  })

  it('records rollback as a new append-only shared price entry', async () => {
    const store = await makeStore()
    await store.put('el-chunchito', [pernil], 0)
    const changed = await store.put('el-chunchito', [{ ...pernil, price: 5190 }], 1)
    const rolledBack = await store.put('el-chunchito', [{ ...changed.products[0], price: 4898 }], 2)

    expect(rolledBack.priceHistory).toHaveLength(2)
    expect(rolledBack.priceHistory[0]).toMatchObject({
      productId: 'pernil',
      previousPrice: 5190,
      nextPrice: 4898,
    })
    expect(rolledBack.priceHistory[1]).toMatchObject({
      productId: 'pernil',
      previousPrice: 4898,
      nextPrice: 5190,
    })
  })

  it('rejects stale writes and returns the current snapshot', async () => {
    const store = await makeStore()
    await store.put('el-chunchito', [pernil], 0)
    const current = await store.put('el-chunchito', [{ ...pernil, price: 5190 }], 1)

    await expect(store.put('el-chunchito', [{ ...pernil, price: 5290 }], 1))
      .rejects.toMatchObject({
        current,
      })
  })

  it('rejects duplicate customer codes', async () => {
    const store = await makeStore()
    await expect(store.put('el-chunchito', [
      pernil,
      { ...pernil, id: 'otro', name: 'Otro', code: '101' },
    ], 0)).rejects.toThrow('Duplicate customer code')
  })

  it('rejects duplicate RM-60 PLUs', async () => {
    const store = await makeStore()
    await expect(store.put('el-chunchito', [
      { ...pernil, plu: '0047' },
      { ...pernil, id: 'otro', code: '102', name: 'Otro', plu: '0047' },
    ], 0)).rejects.toThrow('Duplicate PLU')
  })

  it('rejects malformed customer codes', async () => {
    const store = await makeStore()
    await expect(store.put('el-chunchito', [
      { ...pernil, code: 'CODIGO CON ESPACIOS' },
    ], 0)).rejects.toThrow('Invalid customer code')
  })
})
