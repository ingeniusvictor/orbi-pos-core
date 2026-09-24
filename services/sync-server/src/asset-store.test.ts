import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore } from './asset-store.js'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-assets-'))
  dirs.push(dir)
  return new AssetStore(dir)
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x00])

describe('AssetStore', () => {
  it('stores and lists a validated shared image', async () => {
    const store = await makeStore()
    const record = await store.put(
      'el-chunchito',
      '12345678-demo.png',
      'image/png',
      png,
    )

    expect(record.url).toBe('/api/stores/el-chunchito/assets/12345678-demo.png')
    expect((await store.list('el-chunchito'))[0].fileName).toBe('12345678-demo.png')
    expect((await store.get('el-chunchito', '12345678-demo.png'))?.contentType).toBe('image/png')
  })

  it('rejects content type / extension mismatches', async () => {
    const store = await makeStore()
    await expect(store.put(
      'el-chunchito',
      '12345678-demo.jpg',
      'image/png',
      png,
    )).rejects.toThrow('does not match')
  })

  it('rejects fake image payloads', async () => {
    const store = await makeStore()
    await expect(store.put(
      'el-chunchito',
      '12345678-demo.png',
      'image/png',
      Buffer.from('not-an-image'),
    )).rejects.toThrow('signature')
  })

  it('rejects unsafe file names', async () => {
    const store = await makeStore()
    await expect(store.put(
      'el-chunchito',
      '../evil.png',
      'image/png',
      png,
    )).rejects.toThrow('Invalid asset file name')
  })
})
