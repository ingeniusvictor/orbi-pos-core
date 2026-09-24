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
    expect(await store.get('el-chunchito')).toEqual(snapshot)
  })

  it('increments revision on update', async () => {
    const store = await makeStore()
    await store.put('el-chunchito', [pernil], 0)

    const snapshot = await store.put('el-chunchito', [{ ...pernil, price: 5190 }], 1)
    expect(snapshot.revision).toBe(2)
    expect(snapshot.products[0].price).toBe(5190)
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
})
