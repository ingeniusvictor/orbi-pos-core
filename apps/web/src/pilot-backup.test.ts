import { describe, expect, it } from 'vitest'
import {
  PILOT_BACKUP_MODULES,
  PILOT_BACKUP_STORAGE_KEYS,
  buildPilotBackupBundle,
  collectPilotBackupModules,
  restorePilotBackupModules,
  sanitizePilotBackupBundle,
  type StorageReaderWriter,
} from './pilot-backup'

class MemoryStorage implements StorageReaderWriter {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const refs = {
  catalog: {
    revision: 4,
    updatedAt: '2026-09-25T03:00:00.000Z',
    productCount: 2,
  },
  evidenceAttachments: [],
}

describe('pilot backup bundle', () => {
  it('captures all six pilot-control modules even on a fresh browser', () => {
    const storage = new MemoryStorage()
    const modules = collectPilotBackupModules(storage)

    expect(Object.keys(modules)).toEqual([...PILOT_BACKUP_MODULES])
    expect(modules.evidenceLedger.entries).toEqual([])
    expect(modules.evidenceCases.cases).toEqual([])
    expect(modules.productionGate.ownerApprovalRecorded).toBe(false)
  })

  it('builds and validates a portable v1 bundle for the expected store', () => {
    const storage = new MemoryStorage()
    const bundle = buildPilotBackupBundle(storage, {
      storeId: 'el-chunchito',
      label: 'Respaldo manual',
      source: 'manual',
      serverReferences: refs,
      createdAt: '2026-09-25T04:10:00.000Z',
    })

    const sanitized = sanitizePilotBackupBundle(bundle, 'el-chunchito')
    expect(sanitized.format).toBe('orbi-pos-pilot-backup/v1')
    expect(Object.keys(sanitized.modules)).toHaveLength(6)
    expect(sanitized.serverReferences.catalog.revision).toBe(4)
  })

  it('rejects another store, unknown modules and obvious sensitive data', () => {
    const storage = new MemoryStorage()
    const bundle = buildPilotBackupBundle(storage, {
      storeId: 'el-chunchito',
      label: 'Respaldo manual',
      source: 'manual',
      serverReferences: refs,
      createdAt: '2026-09-25T04:10:00.000Z',
    })

    expect(() => sanitizePilotBackupBundle(bundle, 'otra-tienda'))
      .toThrow('otra tienda')

    const unknown = structuredClone(bundle) as unknown as {
      modules: Record<string, unknown>
    }
    unknown.modules.unknownState = {}
    expect(() => sanitizePilotBackupBundle(unknown, 'el-chunchito'))
      .toThrow('no permitido')

    const sensitive = structuredClone(bundle)
    ;(sensitive.modules.evidenceLedger as unknown as Record<string, unknown>).password = 'secret'
    expect(() => sanitizePilotBackupBundle(sensitive, 'el-chunchito'))
      .toThrow('Campo sensible')
  })

  it('restores only the selected local modules', () => {
    const source = new MemoryStorage()
    source.setItem(
      PILOT_BACKUP_STORAGE_KEYS.evidenceLedger,
      JSON.stringify({
        version: 'orbi-pos-evidence-ledger/v1',
        entries: [{
          id: 'EVD-001',
          occurredAt: '2026-09-25T10:00',
          createdAt: '2026-09-25T13:00:00.000Z',
          updatedAt: '2026-09-25T13:00:00.000Z',
          type: 'observation',
          system: 'rm60',
          severity: 'info',
          status: 'open',
          title: 'Flujo observado',
          summary: 'Se observó flujo real de balanza.',
          actor: 'Operador',
          evidenceReference: '',
          sourceContext: 'Terreno',
          history: [],
        }],
      }),
    )

    const bundle = buildPilotBackupBundle(source, {
      storeId: 'el-chunchito',
      label: 'Respaldo selectivo',
      source: 'manual',
      serverReferences: refs,
      createdAt: '2026-09-25T04:10:00.000Z',
    })

    const target = new MemoryStorage()
    const restored = restorePilotBackupModules(
      target,
      bundle,
      'el-chunchito',
      ['evidenceLedger'],
    )

    expect(restored).toEqual(['evidenceLedger'])
    expect(JSON.parse(target.getItem(PILOT_BACKUP_STORAGE_KEYS.evidenceLedger) ?? '{}').entries)
      .toHaveLength(1)
    expect(target.getItem(PILOT_BACKUP_STORAGE_KEYS.productionGate)).toBeNull()
  })
})
