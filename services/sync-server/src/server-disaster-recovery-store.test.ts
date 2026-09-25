import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SERVER_DR_FORMAT,
  ServerDisasterRecoveryStore,
  type ServerDrBundle,
} from './server-disaster-recovery-store.js'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-dr-'))
  dirs.push(dir)
  let id = 0

  return {
    dir,
    store: new ServerDisasterRecoveryStore(
      dir,
      () => '2026-09-25T05:00:00.000Z',
      () => {
        id += 1
        return `12345678-1234-1234-1234-${String(id).padStart(12, '0')}`
      },
    ),
  }
}

async function seedStore(dataDir: string) {
  const root = path.join(dataDir, 'stores', 'el-chunchito')
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await mkdir(path.join(root, 'evidence', 'attachments'), { recursive: true })
  await mkdir(path.join(root, 'pilot-backups'), { recursive: true })
  await mkdir(path.join(root, 'disaster-recovery', 'archives'), { recursive: true })

  await writeFile(
    path.join(root, 'catalog.json'),
    JSON.stringify({
      storeId: 'el-chunchito',
      revision: 4,
      updatedAt: '2026-09-25T04:00:00.000Z',
      products: [],
      priceHistory: [],
    }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'payments.json'),
    JSON.stringify({ orders: [{ id: 'pay-1', status: 'processed' }] }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'sales.json'),
    JSON.stringify({
      sales: [{
        id: 'SALE-20260925-abcdef123456',
        storeId: 'el-chunchito',
        clientRequestId: 'sale-request-001',
        createdAt: '2026-09-25T04:05:00.000Z',
        recordedAt: '2026-09-25T04:05:01.000Z',
        source: 'orbi-pos-web',
        lines: [{
          id: 'pernil-001',
          productId: 'pernil',
          name: 'Pernil',
          unitPrice: 4898,
          quantity: 1.146,
          unitType: 'KG',
          subtotal: 5610,
        }],
        paymentMethod: 'cash',
        total: 5610,
        audit: [{
          event: 'created',
          at: '2026-09-25T04:05:01.000Z',
          actor: 'orbi-pos-web',
          detail: 'server_authoritative',
        }],
      }],
    }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'daily-closes.json'),
    JSON.stringify({
      closes: [{
        id: 'CLOSE-20260925-abcdef123456',
        storeId: 'el-chunchito',
        businessDate: '2026-09-25',
        businessTimeZone: 'America/Santiago',
        generatedAt: '2026-09-25T23:00:00.000Z',
        providerCallsMade: false,
        salesCount: 1,
        salesTotal: 5610,
        methods: {
          cash: { count: 1, total: 5610 },
          debit: { count: 0, total: 0 },
          credit: { count: 0, total: 0 },
          transfer: { count: 0, total: 0 },
        },
        reconciliation: {
          linkedCardSales: 0,
          orphanProcessed: 0,
          refundedAfterSale: 0,
          cardLinkMismatches: 0,
        },
        status: 'reconciled',
        warnings: [],
        sourceFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        revision: 1,
        createdAt: '2026-09-25T23:00:00.000Z',
        audit: [{
          event: 'created',
          at: '2026-09-25T23:00:00.000Z',
          actor: 'orbi-pos-server',
          detail: 'daily_close_snapshot',
        }],
      }],
    }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'scale-fleet.json'),
    JSON.stringify({
      storeId: 'el-chunchito',
      updatedAt: '2026-09-25T04:00:00.000Z',
      syncBehavior: 'unknown',
      devices: [],
    }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'assets', 'product-12345678.png'),
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x01]),
  )
  await writeFile(
    path.join(root, 'evidence', 'attachments', 'evidence-12345678-1234-1234-1234-123456789abc.pdf'),
    Buffer.from('%PDF-1.7\nORBI evidence\n'),
  )
  await writeFile(
    path.join(root, 'evidence', 'attachments', 'evidence-12345678-1234-1234-1234-123456789abc.pdf.meta.json'),
    JSON.stringify({ originalName: 'evidence.pdf' }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'pilot-backups', 'backup-12345678-1234-1234-1234-123456789abc.json'),
    JSON.stringify({ format: 'orbi-pos-pilot-backup/v1' }),
    'utf8',
  )

  await writeFile(path.join(root, 'unknown-secret.env'), 'MERCADO_PAGO_ACCESS_TOKEN=do-not-archive')
  await writeFile(
    path.join(root, 'disaster-recovery', 'archives', 'old.orbi-dr.gz'),
    'must-not-be-recursive',
  )
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ServerDisasterRecoveryStore', () => {
  it('archives only allowlisted server state with file hashes and no recursion', async () => {
    const { dir, store } = await makeStore()
    await seedStore(dir)

    const metadata = await store.create(
      'el-chunchito',
      'Full pilot snapshot',
      'manual',
    )
    const inspection = await store.inspect('el-chunchito', metadata.id)
    const paths = inspection.manifest.files.map((file) => file.path)

    expect(paths).toContain('catalog.json')
    expect(paths).toContain('payments.json')
    expect(paths).toContain('sales.json')
    expect(paths).toContain('daily-closes.json')
    expect(paths).toContain('scale-fleet.json')
    expect(paths).toContain('assets/product-12345678.png')
    expect(paths).toContain('evidence/attachments/evidence-12345678-1234-1234-1234-123456789abc.pdf')
    expect(paths).toContain('pilot-backups/backup-12345678-1234-1234-1234-123456789abc.json')
    expect(paths.some((item) => item.includes('disaster-recovery'))).toBe(false)
    expect(paths.some((item) => item.includes('unknown-secret.env'))).toBe(false)
    expect(inspection.manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true)
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('imports a portable archive only after validating store, paths, sizes and hashes', async () => {
    const { dir, store } = await makeStore()
    await seedStore(dir)
    const created = await store.create('el-chunchito', 'Portable source', 'manual')
    const archivePath = await store.getArchivePath('el-chunchito', created.id)
    const bytes = await readFile(archivePath)

    const imported = await store.import('el-chunchito', bytes)
    expect(imported.ingest).toBe('imported')
    expect((await store.inspect('el-chunchito', imported.id)).manifest.storeId)
      .toBe('el-chunchito')

    const malicious: ServerDrBundle = {
      format: SERVER_DR_FORMAT,
      business: 'Carnicería El Chunchito',
      storeId: 'el-chunchito',
      createdAt: '2026-09-25T05:00:00.000Z',
      label: 'Unsafe archive',
      source: 'manual',
      files: [{
        path: '../outside.json',
        size: 2,
        sha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
        encoding: 'base64',
        content: 'e30=',
      }],
      summary: {
        fileCount: 1,
        totalFileBytes: 2,
        components: ['unknown'],
      },
      safety: {
        runtimeSecretsIncluded: false,
        providerCredentialsIncluded: false,
        performsExternalActions: false,
        warning: 'test',
      },
    }

    await expect(
      store.import(
        'el-chunchito',
        gzipSync(Buffer.from(JSON.stringify(malicious))),
      ),
    ).rejects.toThrow(/relative path|allowlisted|Unsafe/)
  })

  it('restores staged allowlisted data and first creates a full safety archive', async () => {
    const { dir, store } = await makeStore()
    await seedStore(dir)
    const root = path.join(dir, 'stores', 'el-chunchito')
    const source = await store.create('el-chunchito', 'Known good state', 'manual')

    await writeFile(
      path.join(root, 'catalog.json'),
      JSON.stringify({ storeId: 'el-chunchito', revision: 999, products: [{ id: 'bad' }] }),
      'utf8',
    )
    await rm(path.join(root, 'assets'), { recursive: true, force: true })
    await writeFile(
      path.join(root, 'payments.json'),
      JSON.stringify({ orders: [{ id: 'new-current-order' }] }),
      'utf8',
    )
    await writeFile(
      path.join(root, 'sales.json'),
      JSON.stringify({ sales: [{ id: 'SALE-CHANGED' }] }),
      'utf8',
    )
    await writeFile(
      path.join(root, 'daily-closes.json'),
      JSON.stringify({ closes: [{ id: 'CLOSE-CHANGED' }] }),
      'utf8',
    )

    const result = await store.restore(
      'el-chunchito',
      source.id,
      'RESTORE el-chunchito',
    )

    expect(result.safetyArchive.source).toBe('pre-restore')
    expect(result.restoredArchiveId).toBe(source.id)

    const restoredCatalog = JSON.parse(
      await readFile(path.join(root, 'catalog.json'), 'utf8'),
    ) as { revision: number }
    expect(restoredCatalog.revision).toBe(4)

    const restoredSales = JSON.parse(
      await readFile(path.join(root, 'sales.json'), 'utf8'),
    ) as { sales: Array<{ id: string }> }
    expect(restoredSales.sales[0].id).toBe('SALE-20260925-abcdef123456')

    const restoredCloses = JSON.parse(
      await readFile(path.join(root, 'daily-closes.json'), 'utf8'),
    ) as { closes: Array<{ id: string }> }
    expect(restoredCloses.closes[0].id).toBe('CLOSE-20260925-abcdef123456')

    const restoredAsset = await readFile(
      path.join(root, 'assets', 'product-12345678.png'),
    )
    expect(restoredAsset.length).toBeGreaterThan(8)

    const safetyInspection = await store.inspect(
      'el-chunchito',
      result.safetyArchive.id,
    )
    const safetyCatalog = safetyInspection.manifest.files
      .find((file) => file.path === 'catalog.json')
    expect(safetyCatalog).toBeDefined()
  })

  it('rejects restore without the exact confirmation phrase and exposes no delete API', async () => {
    const { dir, store } = await makeStore()
    await seedStore(dir)
    const created = await store.create('el-chunchito', 'Known good state', 'manual')

    await expect(
      store.restore('el-chunchito', created.id, 'restore'),
    ).rejects.toThrow('RESTORE el-chunchito')

    expect('delete' in store).toBe(false)
  })
})
