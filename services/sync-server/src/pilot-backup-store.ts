import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PILOT_BACKUP_FORMAT = 'orbi-pos-pilot-backup/v1'
export const MAX_PILOT_BACKUP_BYTES = 3 * 1024 * 1024

export const PILOT_BACKUP_MODULES = [
  'fieldDiscovery',
  'modernizationProposal',
  'productionGate',
  'migrationRunbook',
  'evidenceLedger',
  'evidenceCases',
] as const

export type PilotBackupModuleName = typeof PILOT_BACKUP_MODULES[number]

export interface PilotBackupBundle {
  format: typeof PILOT_BACKUP_FORMAT
  business: string
  storeId: string
  createdAt: string
  label: string
  source: 'manual' | 'pre-restore' | 'portable-import'
  modules: Partial<Record<PilotBackupModuleName, unknown>>
  serverReferences: {
    catalog: {
      revision: number | null
      updatedAt: string | null
      productCount: number | null
    }
    evidenceAttachments: Array<{
      fileName: string
      contentType: string
      size: number
      sha256: string
      uploadedAt: string
      caseId: string | null
      entryId: string | null
    }>
  }
  safety: {
    containsCredentials: false
    performsExternalActions: false
    warning: string
  }
}

export interface PilotBackupMetadata {
  id: string
  createdAt: string
  savedAt: string
  label: string
  source: PilotBackupBundle['source']
  moduleCount: number
  size: number
  sha256: string
}

export interface PilotBackupRecord extends PilotBackupMetadata {
  bundle: PilotBackupBundle
}

const FORBIDDEN_KEY = /(?:^|[_-])(password|passwd|secret|token|api[_-]?key|authorization|credential|cvv|cvc|card[_-]?(?:number|pan))(?:$|[_-])/i
const OBVIOUS_SECRET_PATTERNS = [
  /\b(?:password|passwd|contrase(?:ñ|n)a)\s*[:=]\s*\S+/i,
  /\bapi[_ -]?key\s*[:=]\s*\S+/i,
  /\baccess[_ -]?token\s*[:=]\s*\S+/i,
  /\bclient[_ -]?secret\s*[:=]\s*\S+/i,
  /\bbearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
  /(?:^|\D)(?:\d[ -]?){13,19}(?:\D|$)/,
]

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateBackupId(backupId: string) {
  if (!/^backup-[0-9a-f-]{36}\.json$/.test(backupId)) {
    throw new Error('Invalid pilot backup id')
  }
}

function validIso(value: string) {
  return typeof value === 'string'
    && value.length >= 20
    && !Number.isNaN(Date.parse(value))
}

function scanModuleValue(
  value: unknown,
  pathLabel: string,
  depth = 0,
): void {
  if (depth > 20) throw new Error('Pilot backup module nesting is too deep')

  if (typeof value === 'string') {
    if (OBVIOUS_SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
      throw new Error(`Potential sensitive data detected in ${pathLabel}`)
    }
    return
  }

  if (
    value === null
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === undefined
  ) {
    return
  }

  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error('Pilot backup array is too large')
    value.forEach((item, index) => scanModuleValue(item, `${pathLabel}[${index}]`, depth + 1))
    return
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 10_000) throw new Error('Pilot backup object is too large')
    for (const [key, child] of entries) {
      if (FORBIDDEN_KEY.test(key)) {
        throw new Error(`Forbidden sensitive field in pilot backup: ${pathLabel}.${key}`)
      }
      scanModuleValue(child, `${pathLabel}.${key}`, depth + 1)
    }
    return
  }

  throw new Error(`Unsupported pilot backup value in ${pathLabel}`)
}

function validateEvidenceManifest(
  value: unknown,
): asserts value is PilotBackupBundle['serverReferences']['evidenceAttachments'] {
  if (!Array.isArray(value)) throw new Error('Evidence attachment manifest must be an array')
  if (value.length > 5000) throw new Error('Evidence attachment manifest is too large')

  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('Invalid evidence attachment metadata')
    const record = item as Record<string, unknown>
    if (typeof record.fileName !== 'string' || !record.fileName.startsWith('evidence-')) {
      throw new Error('Invalid evidence attachment fileName')
    }
    if (typeof record.contentType !== 'string') throw new Error('Invalid evidence attachment contentType')
    if (!Number.isFinite(record.size) || Number(record.size) < 0) {
      throw new Error('Invalid evidence attachment size')
    }
    if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error('Invalid evidence attachment sha256')
    }
    if (typeof record.uploadedAt !== 'string' || Number.isNaN(Date.parse(record.uploadedAt))) {
      throw new Error('Invalid evidence attachment uploadedAt')
    }
    if (record.caseId !== null && typeof record.caseId !== 'string') {
      throw new Error('Invalid evidence attachment caseId')
    }
    if (record.entryId !== null && typeof record.entryId !== 'string') {
      throw new Error('Invalid evidence attachment entryId')
    }
  }
}

export function validatePilotBackupBundle(
  storeId: string,
  input: unknown,
): asserts input is PilotBackupBundle {
  validateStoreId(storeId)

  if (!input || typeof input !== 'object') {
    throw new Error('Pilot backup bundle must be an object')
  }

  const bundle = input as Partial<PilotBackupBundle>

  if (bundle.format !== PILOT_BACKUP_FORMAT) {
    throw new Error('Unsupported pilot backup format')
  }
  if (bundle.storeId !== storeId) {
    throw new Error('Pilot backup store id does not match request')
  }
  if (typeof bundle.business !== 'string' || !bundle.business.trim()) {
    throw new Error('Pilot backup business is required')
  }
  if (!validIso(bundle.createdAt ?? '')) {
    throw new Error('Pilot backup createdAt is invalid')
  }
  if (
    bundle.source !== 'manual'
    && bundle.source !== 'pre-restore'
    && bundle.source !== 'portable-import'
  ) {
    throw new Error('Invalid pilot backup source')
  }
  if (typeof bundle.label !== 'string' || bundle.label.trim().length < 2 || bundle.label.length > 120) {
    throw new Error('Pilot backup label must contain 2–120 characters')
  }

  if (!bundle.modules || typeof bundle.modules !== 'object' || Array.isArray(bundle.modules)) {
    throw new Error('Pilot backup modules must be an object')
  }

  const moduleEntries = Object.entries(bundle.modules)
  if (!moduleEntries.length) throw new Error('Pilot backup must contain at least one module')
  if (moduleEntries.length > PILOT_BACKUP_MODULES.length) {
    throw new Error('Pilot backup contains too many modules')
  }

  for (const [moduleName, moduleValue] of moduleEntries) {
    if (!PILOT_BACKUP_MODULES.includes(moduleName as PilotBackupModuleName)) {
      throw new Error(`Unsupported pilot backup module: ${moduleName}`)
    }
    if (!moduleValue || typeof moduleValue !== 'object') {
      throw new Error(`Pilot backup module must be an object: ${moduleName}`)
    }
    scanModuleValue(moduleValue, moduleName)
  }

  if (!bundle.serverReferences || typeof bundle.serverReferences !== 'object') {
    throw new Error('Pilot backup server references are required')
  }

  const catalog = bundle.serverReferences.catalog
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Pilot backup catalog reference is required')
  }
  if (
    catalog.revision !== null
    && (!Number.isInteger(catalog.revision) || catalog.revision < 0)
  ) {
    throw new Error('Pilot backup catalog revision is invalid')
  }
  if (
    catalog.updatedAt !== null
    && (typeof catalog.updatedAt !== 'string' || Number.isNaN(Date.parse(catalog.updatedAt)))
  ) {
    throw new Error('Pilot backup catalog updatedAt is invalid')
  }
  if (
    catalog.productCount !== null
    && (!Number.isInteger(catalog.productCount) || catalog.productCount < 0)
  ) {
    throw new Error('Pilot backup product count is invalid')
  }

  validateEvidenceManifest(bundle.serverReferences.evidenceAttachments)

  if (
    !bundle.safety
    || bundle.safety.containsCredentials !== false
    || bundle.safety.performsExternalActions !== false
    || typeof bundle.safety.warning !== 'string'
  ) {
    throw new Error('Pilot backup safety metadata is invalid')
  }

  const bytes = Buffer.byteLength(JSON.stringify(bundle), 'utf8')
  if (bytes > MAX_PILOT_BACKUP_BYTES) {
    throw new Error('Pilot backup exceeds 3 MB limit')
  }
}

export class PilotBackupStore {
  constructor(
    private readonly dataDir: string,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly idFactory: () => string = () => randomUUID(),
  ) {}

  private dir(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'pilot-backups')
  }

  private filePath(storeId: string, backupId: string) {
    validateBackupId(backupId)
    return path.join(this.dir(storeId), backupId)
  }

  async put(storeId: string, input: unknown): Promise<PilotBackupRecord> {
    validatePilotBackupBundle(storeId, input)
    const bundle = input
    const serialized = JSON.stringify(bundle)
    const size = Buffer.byteLength(serialized, 'utf8')
    const sha256 = createHash('sha256').update(serialized).digest('hex')
    const savedAt = this.now()
    const id = `backup-${this.idFactory()}.json`

    const record: PilotBackupRecord = {
      id,
      createdAt: bundle.createdAt,
      savedAt,
      label: bundle.label.trim(),
      source: bundle.source,
      moduleCount: Object.keys(bundle.modules).length,
      size,
      sha256,
      bundle,
    }

    const dir = this.dir(storeId)
    await mkdir(dir, { recursive: true })
    const file = this.filePath(storeId, id)
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(record, null, 2), 'utf8')
    await rename(temp, file)

    return record
  }

  async get(storeId: string, backupId: string): Promise<PilotBackupRecord | null> {
    const file = this.filePath(storeId, backupId)
    try {
      const raw = await readFile(file, 'utf8')
      return JSON.parse(raw) as PilotBackupRecord
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(storeId: string): Promise<PilotBackupMetadata[]> {
    const dir = this.dir(storeId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const records: PilotBackupMetadata[] = []
    for (const name of names) {
      try {
        validateBackupId(name)
        const raw = await readFile(path.join(dir, name), 'utf8')
        const parsed = JSON.parse(raw) as PilotBackupRecord
        await stat(path.join(dir, name))
        records.push({
          id: parsed.id,
          createdAt: parsed.createdAt,
          savedAt: parsed.savedAt,
          label: parsed.label,
          source: parsed.source,
          moduleCount: parsed.moduleCount,
          size: parsed.size,
          sha256: parsed.sha256,
        })
      } catch {
        // Ignore incomplete/corrupt backup files in the pilot listing.
      }
    }

    return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }
}
