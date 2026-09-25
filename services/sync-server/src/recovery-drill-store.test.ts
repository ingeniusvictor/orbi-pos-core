import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore } from './asset-store.js'
import { EvidenceAttachmentStore } from './evidence-attachment-store.js'
import { PilotBackupStore, PILOT_BACKUP_FORMAT } from './pilot-backup-store.js'
import { RecoveryDrillStore } from './recovery-drill-store.js'
import { ScaleFleetStore } from './scale-fleet-store.js'
import { SaleStore } from './sale-store.js'
import { DailyCloseStore } from './daily-close-store.js'
import { CashDrawerStore } from './cash-drawer-store.js'
import { ServerDisasterRecoveryStore } from './server-disaster-recovery-store.js'

const dirs: string[] = []

function uuidFromCounter(counter: number) {
  return `12345678-1234-1234-1234-${String(counter).padStart(12, '0')}`
}

async function makeStores() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-recovery-cert-'))
  dirs.push(dir)

  let drId = 0
  const dr = new ServerDisasterRecoveryStore(
    dir,
    () => '2026-09-25T05:20:00.000Z',
    () => uuidFromCounter(++drId),
  )

  let certId = 100
  let clock = 1_000
  const drill = new RecoveryDrillStore(
    dir,
    dr,
    () => '2026-09-25T05:21:00.000Z',
    () => {
      clock += 25
      return clock
    },
    () => uuidFromCounter(++certId),
  )

  return { dir, dr, drill }
}

async function seedRecoverableStore(dataDir: string) {
  const root = path.join(dataDir, 'stores', 'el-chunchito')
  await writeFile(
    path.join(root, 'catalog.json'),
    JSON.stringify({
      storeId: 'el-chunchito',
      revision: 4,
      updatedAt: '2026-09-25T05:00:00.000Z',
      products: [],
      priceHistory: [],
    }, null, 2),
    { encoding: 'utf8', flag: 'w' },
  ).catch(async (error) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const { mkdir } = await import('node:fs/promises')
    await mkdir(root, { recursive: true })
    await writeFile(
      path.join(root, 'catalog.json'),
      JSON.stringify({
        storeId: 'el-chunchito',
        revision: 4,
        updatedAt: '2026-09-25T05:00:00.000Z',
        products: [],
        priceHistory: [],
      }, null, 2),
      'utf8',
    )
  })

  await writeFile(
    path.join(root, 'payments.json'),
    JSON.stringify({ orders: [] }, null, 2),
    'utf8',
  )

  await new SaleStore(dataDir).append('el-chunchito', {
    id: 'SALE-20260925-abcdef123456',
    storeId: 'el-chunchito',
    clientRequestId: 'sale-request-drill-001',
    createdAt: '2026-09-25T05:02:00.000Z',
    recordedAt: '2026-09-25T05:02:01.000Z',
    source: 'orbi-pos-web',
    lines: [{
      id: 'pernil-drill-001',
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
      at: '2026-09-25T05:02:01.000Z',
      actor: 'orbi-pos-web',
      detail: 'server_authoritative',
    }],
  })

  await new DailyCloseStore(dataDir).append('el-chunchito', {
    id: 'CLOSE-20260925-drill000001',
    storeId: 'el-chunchito',
    businessDate: '2026-09-25',
    businessTimeZone: 'America/Santiago',
    generatedAt: '2026-09-25T05:03:00.000Z',
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
    sourceFingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    createdAt: '2026-09-25T05:03:00.000Z',
  })

  const cashDrawerStore = new CashDrawerStore(dataDir)
  await cashDrawerStore.open('el-chunchito', {
    id: 'DRAWER-12345678123412341234123456789012',
    storeId: 'el-chunchito',
    businessDate: '2026-09-25',
    businessTimeZone: 'America/Santiago',
    openedAt: '2026-09-25T05:00:00.000Z',
    openingFloat: 20000,
    status: 'open',
    movements: [],
    audit: [{
      event: 'opened',
      at: '2026-09-25T05:00:00.000Z',
      actor: 'orbi-pos-server',
      detail: 'cash_drawer_session',
    }],
  })
  await cashDrawerStore.close(
    'el-chunchito',
    'DRAWER-12345678123412341234123456789012',
    {
      id: 'DRAWER-12345678123412341234123456789012',
      storeId: 'el-chunchito',
      businessDate: '2026-09-25',
      businessTimeZone: 'America/Santiago',
      openedAt: '2026-09-25T05:00:00.000Z',
      closedAt: '2026-09-25T05:10:00.000Z',
      openingFloat: 20000,
      status: 'closed',
      movements: [],
      cashSales: { count: 1, total: 5610, through: '2026-09-25T05:10:00.000Z' },
      paidInTotal: 0,
      paidOutTotal: 0,
      expectedCash: 25610,
      countedCash: 25500,
      variance: -110,
      sourceFingerprint: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      audit: [{
        event: 'opened',
        at: '2026-09-25T05:00:00.000Z',
        actor: 'orbi-pos-server',
        detail: 'cash_drawer_session',
      }, {
        event: 'closed',
        at: '2026-09-25T05:10:00.000Z',
        actor: 'orbi-pos-server',
        detail: 'physical_count_reconciliation',
      }],
    },
  )

  await new ScaleFleetStore(
    dataDir,
    () => '2026-09-25T05:00:00.000Z',
  ).put('el-chunchito', {
    syncBehavior: 'unknown',
    devices: [
      {
        id: 'rm60-01',
        label: 'RM60-01',
        model: 'DIGI RM-60',
        role: 'principal',
        priceAdministrationSource: true,
        connectivity: 'unknown',
      },
      {
        id: 'rm60-02',
        label: 'RM60-02',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
      {
        id: 'rm60-03',
        label: 'RM60-03',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
      {
        id: 'rm60-04',
        label: 'RM60-04',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
    ],
  })

  await new AssetStore(dataDir).put(
    'el-chunchito',
    'product-12345678.png',
    'image/png',
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x01]),
  )

  await new EvidenceAttachmentStore(dataDir).put(
    'el-chunchito',
    'evidence-12345678-1234-1234-1234-123456789abc.pdf',
    'application/pdf',
    Buffer.from('%PDF-1.7\nORBI certified evidence\n'),
    'informe-piloto.pdf',
    'CASE-001',
    'EVD-001',
  )

  await new PilotBackupStore(
    dataDir,
    () => '2026-09-25T05:05:00.000Z',
    () => '87654321-4321-4321-4321-123456789abc',
  ).put('el-chunchito', {
    format: PILOT_BACKUP_FORMAT,
    business: 'Carnicería El Chunchito',
    storeId: 'el-chunchito',
    createdAt: '2026-09-25T05:04:00.000Z',
    label: 'Browser state before recovery drill',
    source: 'manual',
    modules: {
      fieldDiscovery: {},
      modernizationProposal: {},
      productionGate: {},
      migrationRunbook: {},
      evidenceLedger: {},
      evidenceCases: {},
    },
    serverReferences: {
      catalog: {
        revision: 4,
        updatedAt: '2026-09-25T05:00:00.000Z',
        productCount: 0,
      },
      evidenceAttachments: [],
    },
    safety: {
      containsCredentials: false,
      performsExternalActions: false,
      warning: 'test',
    },
  })
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) =>
    rm(dir, { recursive: true, force: true }),
  ))
})

describe('RecoveryDrillStore', () => {
  it('physically reconstructs and certifies an unchanged full archive without touching live data', async () => {
    const { dir, dr, drill } = await makeStores()
    await seedRecoverableStore(dir)

    const catalogPath = path.join(dir, 'stores', 'el-chunchito', 'catalog.json')
    const before = await readFile(catalogPath, 'utf8')
    const archive = await dr.create(
      'el-chunchito',
      'Known-good complete archive',
      'manual',
    )

    const record = await drill.run('el-chunchito', archive.id)
    const after = await readFile(catalogPath, 'utf8')

    expect(record.certificate.result).toBe('certified')
    expect(record.certificate.stagedFiles).toBe(10)
    expect(record.certificate.stagedBytes).toBeGreaterThan(0)
    expect(record.certificate.safety.liveDataReplaced).toBe(false)
    expect(record.certificate.safety.providerCallsMade).toBe(false)
    expect(record.certificate.safety.sandboxCleaned).toBe(true)
    expect(after).toBe(before)

    const byId = new Map(record.certificate.components.map((item) => [item.id, item]))
    expect(byId.get('catalog')?.status).toBe('pass')
    expect(byId.get('payments')?.status).toBe('pass')
    expect(byId.get('sales')?.status).toBe('pass')
    expect(byId.get('daily-closes')?.status).toBe('pass')
    expect(byId.get('cash-drawer')?.status).toBe('pass')
    expect(byId.get('scale-fleet')?.status).toBe('pass')
    expect(byId.get('product-assets')?.status).toBe('pass')
    expect(byId.get('evidence-attachments')?.status).toBe('pass')
    expect(byId.get('pilot-backups')?.status).toBe('pass')
    expect(record.certificate.liveDrift.changed).toEqual([])
    expect(record.reportSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('distinguishes live drift from archive corruption', async () => {
    const { dir, dr, drill } = await makeStores()
    await seedRecoverableStore(dir)
    const archive = await dr.create(
      'el-chunchito',
      'Before catalog drift',
      'manual',
    )

    const catalogPath = path.join(dir, 'stores', 'el-chunchito', 'catalog.json')
    await writeFile(
      catalogPath,
      JSON.stringify({
        storeId: 'el-chunchito',
        revision: 5,
        updatedAt: '2026-09-25T05:10:00.000Z',
        products: [],
        priceHistory: [],
      }, null, 2),
      'utf8',
    )

    const record = await drill.run('el-chunchito', archive.id)

    expect(record.certificate.result).toBe('certified_with_drift')
    expect(record.certificate.liveDrift.changed).toContain('catalog.json')
    expect(record.certificate.checks.some((item) =>
      item.id === 'archive-integrity' && item.status === 'pass',
    )).toBe(true)
    expect(record.certificate.checks.some((item) =>
      item.id === 'live-coverage' && item.status === 'warning',
    )).toBe(true)
  })

  it('persists a failed certification when the archive bytes are corrupted', async () => {
    const { dir, dr, drill } = await makeStores()
    await seedRecoverableStore(dir)
    const archive = await dr.create(
      'el-chunchito',
      'Archive to corrupt',
      'manual',
    )

    const archivePath = path.join(
      dir,
      'stores',
      'el-chunchito',
      'disaster-recovery',
      'archives',
      archive.id,
    )
    const bytes = await readFile(archivePath)
    const tampered = Buffer.from(bytes)
    tampered[Math.max(0, tampered.length - 1)] ^= 0xff
    await writeFile(archivePath, tampered)

    const record = await drill.run('el-chunchito', archive.id)

    expect(record.certificate.result).toBe('failed')
    expect(record.certificate.safety.liveDataReplaced).toBe(false)
    expect(record.certificate.checks.some((item) =>
      item.status === 'fail'
      && /SHA-256|gzip|integrity/i.test(item.detail),
    )).toBe(true)

    const listed = await drill.list('el-chunchito')
    expect(listed.some((item) => item.id === record.certificate.id)).toBe(true)
  })

  it('detects tampering of the persisted certification report and exposes no delete API', async () => {
    const { dir, dr, drill } = await makeStores()
    await seedRecoverableStore(dir)
    const archive = await dr.create(
      'el-chunchito',
      'Certification integrity source',
      'manual',
    )
    const record = await drill.run('el-chunchito', archive.id)

    const certificatePath = path.join(
      dir,
      'stores',
      'el-chunchito',
      'disaster-recovery',
      'certifications',
      record.certificate.id,
    )
    const parsed = JSON.parse(
      await readFile(certificatePath, 'utf8'),
    ) as Record<string, any>
    parsed.certificate.result = 'failed'
    await writeFile(certificatePath, JSON.stringify(parsed, null, 2), 'utf8')

    await expect(
      drill.get('el-chunchito', record.certificate.id),
    ).rejects.toThrow('integrity check failed')
    expect(await drill.list('el-chunchito')).toEqual([])
    expect('delete' in drill).toBe(false)
  })
})
