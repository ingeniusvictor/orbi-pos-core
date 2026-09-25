import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PILOT_BACKUP_FORMAT,
  PilotBackupStore,
  type PilotBackupBundle,
} from './pilot-backup-store.js'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-pilot-backups-'))
  dirs.push(dir)

  return new PilotBackupStore(
    dir,
    () => '2026-09-25T04:00:00.000Z',
    () => '12345678-1234-1234-1234-123456789abc',
  )
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function bundle(): PilotBackupBundle {
  return {
    format: PILOT_BACKUP_FORMAT,
    business: 'Carnicería El Chunchito',
    storeId: 'el-chunchito',
    createdAt: '2026-09-25T03:55:00.000Z',
    label: 'Respaldo antes de visita',
    source: 'manual',
    modules: {
      evidenceLedger: {
        version: 'orbi-pos-evidence-ledger/v1',
        entries: [],
      },
      productionGate: {
        fiscalPath: 'pending',
        fiscalNote: '',
      },
    },
    serverReferences: {
      catalog: {
        revision: 7,
        updatedAt: '2026-09-25T03:00:00.000Z',
        productCount: 2,
      },
      evidenceAttachments: [{
        fileName: 'evidence-12345678-1234-1234-1234-123456789abc.pdf',
        contentType: 'application/pdf',
        size: 1234,
        sha256: 'a'.repeat(64),
        uploadedAt: '2026-09-25T03:30:00.000Z',
        caseId: 'CASE-001',
        entryId: 'EVD-001',
      }],
    },
    safety: {
      containsCredentials: false,
      performsExternalActions: false,
      warning: 'Pilot control state only.',
    },
  }
}

describe('PilotBackupStore', () => {
  it('persists, hashes, lists and fetches a validated pilot backup', async () => {
    const store = await makeStore()
    const saved = await store.put('el-chunchito', bundle())

    expect(saved.id).toBe('backup-12345678-1234-1234-1234-123456789abc.json')
    expect(saved.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(saved.moduleCount).toBe(2)

    const listed = await store.list('el-chunchito')
    expect(listed).toHaveLength(1)
    expect(listed[0].sha256).toBe(saved.sha256)

    const fetched = await store.get('el-chunchito', saved.id)
    expect(fetched?.bundle.modules.evidenceLedger).toBeDefined()
  })

  it('rejects store mismatches and unsupported modules', async () => {
    const store = await makeStore()
    const wrongStore = { ...bundle(), storeId: 'other-store' }

    await expect(store.put('el-chunchito', wrongStore))
      .rejects.toThrow('store id does not match')

    const unknownModule = bundle() as PilotBackupBundle & {
      modules: Record<string, unknown>
    }
    unknownModule.modules = {
      ...unknownModule.modules,
      paymentSecrets: { value: 'x' },
    }

    await expect(store.put('el-chunchito', unknownModule))
      .rejects.toThrow('Unsupported pilot backup module')
  })

  it('allows timestamp-shaped audit ids while rejecting obvious secrets and Luhn-valid card numbers', async () => {
    const store = await makeStore()
    const safeIds = bundle()
    safeIds.modules.evidenceLedger = {
      entries: [{
        id: 'EVD-20260925130000-ABC123',
        createdAt: '2026-09-25T13:00:00.000Z',
        note: 'Evidencia operacional sin secretos',
      }],
    }

    await expect(store.put('el-chunchito', safeIds)).resolves.toBeDefined()

    const secret = bundle()

    secret.modules.evidenceLedger = {
      password: 'SuperSecret123',
    }

    await expect(store.put('el-chunchito', secret))
      .rejects.toThrow('Forbidden sensitive field')

    const card = bundle()
    card.modules.evidenceLedger = {
      note: '4111 1111 1111 1111',
    }

    await expect(store.put('el-chunchito', card))
      .rejects.toThrow('Potential sensitive data')
  })

  it('does not expose a mutation API for deletion at the store layer', async () => {
    const store = await makeStore()
    expect('delete' in store).toBe(false)
  })
})
