import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

export const SERVER_DR_FORMAT = 'orbi-pos-server-dr/v1'
export const MAX_DR_FILE_COUNT = 5_000
export const MAX_DR_TOTAL_FILE_BYTES = 128 * 1024 * 1024
export const MAX_DR_ENVELOPE_BYTES = 180 * 1024 * 1024
export const MAX_DR_COMPRESSED_BYTES = 160 * 1024 * 1024

export type ServerDrSource = 'manual' | 'pre-restore'

export interface ServerDrFile {
  path: string
  size: number
  sha256: string
  encoding: 'base64'
  content: string
}

export interface ServerDrBundle {
  format: typeof SERVER_DR_FORMAT
  business: string
  storeId: string
  createdAt: string
  label: string
  source: ServerDrSource
  files: ServerDrFile[]
  summary: {
    fileCount: number
    totalFileBytes: number
    components: string[]
  }
  safety: {
    runtimeSecretsIncluded: false
    providerCredentialsIncluded: false
    performsExternalActions: false
    warning: string
  }
}

export interface ServerDrMetadata {
  id: string
  createdAt: string
  savedAt: string
  label: string
  source: ServerDrSource
  ingest: 'created' | 'imported'
  fileCount: number
  totalFileBytes: number
  compressedSize: number
  sha256: string
  components: string[]
}

export interface ServerDrInspection {
  metadata: ServerDrMetadata
  manifest: {
    format: typeof SERVER_DR_FORMAT
    business: string
    storeId: string
    createdAt: string
    label: string
    source: ServerDrSource
    summary: ServerDrBundle['summary']
    files: Array<Omit<ServerDrFile, 'content'>>
    safety: ServerDrBundle['safety']
  }
}

const ASSET_FILE = /^assets\/[a-z0-9][a-z0-9-]{7,79}\.(?:jpg|jpeg|png|webp)$/
const EVIDENCE_FILE = /^evidence\/attachments\/evidence-[a-z0-9-]{20,80}\.(?:jpg|jpeg|png|webp|pdf)(?:\.meta\.json)?$/
const PILOT_BACKUP_FILE = /^pilot-backups\/backup-[0-9a-f-]{36}\.json$/
const EXACT_FILES = new Set([
  'catalog.json',
  'payments.json',
  'sales.json',
  'daily-closes.json',
  'scale-fleet.json',
])

const PROTECTED_TARGETS = [
  'catalog.json',
  'payments.json',
  'sales.json',
  'daily-closes.json',
  'scale-fleet.json',
  'assets',
  'evidence/attachments',
  'pilot-backups',
] as const

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateArchiveId(archiveId: string) {
  if (!/^dr-[0-9a-f-]{36}\.orbi-dr\.gz$/.test(archiveId)) {
    throw new Error('Invalid disaster-recovery archive id')
  }
}

function validIso(value: string) {
  return typeof value === 'string'
    && value.length >= 20
    && !Number.isNaN(Date.parse(value))
}

function normalizeRelativePath(value: string) {
  if (!value || value.includes('\\') || value.startsWith('/') || value.includes('\0')) {
    throw new Error('Invalid disaster-recovery relative path')
  }
  const normalized = path.posix.normalize(value)
  if (
    normalized !== value
    || normalized === '.'
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.length > 220
  ) {
    throw new Error('Unsafe disaster-recovery relative path')
  }
  return normalized
}

export function isAllowedServerDrPath(value: string) {
  let relative: string
  try {
    relative = normalizeRelativePath(value)
  } catch {
    return false
  }

  return EXACT_FILES.has(relative)
    || ASSET_FILE.test(relative)
    || EVIDENCE_FILE.test(relative)
    || PILOT_BACKUP_FILE.test(relative)
}

function componentFor(relative: string) {
  if (relative === 'catalog.json') return 'catalog'
  if (relative === 'payments.json') return 'payments'
  if (relative === 'sales.json') return 'sales'
  if (relative === 'daily-closes.json') return 'daily-closes'
  if (relative === 'scale-fleet.json') return 'scale-fleet'
  if (relative.startsWith('assets/')) return 'product-assets'
  if (relative.startsWith('evidence/attachments/')) return 'evidence-attachments'
  if (relative.startsWith('pilot-backups/')) return 'pilot-backups'
  return 'unknown'
}

function safeLabel(value: string) {
  const label = value.trim()
  if (label.length < 2 || label.length > 120) {
    throw new Error('Disaster-recovery label must contain 2–120 characters')
  }
  if (
    /\b(?:password|passwd|contrase(?:ñ|n)a|api[_ -]?key|access[_ -]?token|client[_ -]?secret)\s*[:=]/i
      .test(label)
    || /\bbearer\s+[A-Za-z0-9._~+\/-]{12,}/i.test(label)
  ) {
    throw new Error('Potential secret detected in disaster-recovery label')
  }
  return label
}

function bundleManifest(bundle: ServerDrBundle): ServerDrInspection['manifest'] {
  return {
    format: bundle.format,
    business: bundle.business,
    storeId: bundle.storeId,
    createdAt: bundle.createdAt,
    label: bundle.label,
    source: bundle.source,
    summary: bundle.summary,
    files: bundle.files.map(({ content: _content, ...file }) => file),
    safety: bundle.safety,
  }
}

export function validateServerDrBundle(
  storeId: string,
  input: unknown,
): asserts input is ServerDrBundle {
  validateStoreId(storeId)

  if (!input || typeof input !== 'object') {
    throw new Error('Disaster-recovery bundle must be an object')
  }

  const bundle = input as Partial<ServerDrBundle>
  if (bundle.format !== SERVER_DR_FORMAT) {
    throw new Error('Unsupported disaster-recovery format')
  }
  if (bundle.storeId !== storeId) {
    throw new Error('Disaster-recovery store id does not match request')
  }
  if (typeof bundle.business !== 'string' || !bundle.business.trim()) {
    throw new Error('Disaster-recovery business is required')
  }
  if (!validIso(bundle.createdAt ?? '')) {
    throw new Error('Disaster-recovery createdAt is invalid')
  }
  if (bundle.source !== 'manual' && bundle.source !== 'pre-restore') {
    throw new Error('Invalid disaster-recovery source')
  }
  safeLabel(bundle.label ?? '')

  if (!Array.isArray(bundle.files)) {
    throw new Error('Disaster-recovery files must be an array')
  }
  if (bundle.files.length > MAX_DR_FILE_COUNT) {
    throw new Error('Disaster-recovery archive contains too many files')
  }

  const paths = new Set<string>()
  let totalBytes = 0
  const components = new Set<string>()

  for (const candidate of bundle.files) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Invalid disaster-recovery file record')
    }

    const relative = normalizeRelativePath(candidate.path)
    if (!isAllowedServerDrPath(relative)) {
      throw new Error(`Disaster-recovery path is not allowlisted: ${relative}`)
    }
    if (paths.has(relative)) {
      throw new Error(`Duplicate disaster-recovery path: ${relative}`)
    }
    paths.add(relative)

    if (
      !Number.isInteger(candidate.size)
      || candidate.size < 0
      || candidate.size > MAX_DR_TOTAL_FILE_BYTES
    ) {
      throw new Error(`Invalid disaster-recovery file size: ${relative}`)
    }
    if (typeof candidate.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.sha256)) {
      throw new Error(`Invalid disaster-recovery file hash: ${relative}`)
    }
    if (candidate.encoding !== 'base64' || typeof candidate.content !== 'string') {
      throw new Error(`Invalid disaster-recovery file encoding: ${relative}`)
    }

    const body = Buffer.from(candidate.content, 'base64')
    if (body.length !== candidate.size) {
      throw new Error(`Disaster-recovery file size mismatch: ${relative}`)
    }
    const digest = createHash('sha256').update(body).digest('hex')
    if (digest !== candidate.sha256) {
      throw new Error(`Disaster-recovery file hash mismatch: ${relative}`)
    }

    totalBytes += body.length
    if (totalBytes > MAX_DR_TOTAL_FILE_BYTES) {
      throw new Error('Disaster-recovery file payload exceeds 128 MB limit')
    }
    components.add(componentFor(relative))
  }

  if (!bundle.summary || typeof bundle.summary !== 'object') {
    throw new Error('Disaster-recovery summary is required')
  }
  if (
    bundle.summary.fileCount !== bundle.files.length
    || bundle.summary.totalFileBytes !== totalBytes
  ) {
    throw new Error('Disaster-recovery summary does not match file manifest')
  }
  const expectedComponents = [...components].sort()
  const suppliedComponents = Array.isArray(bundle.summary.components)
    ? [...bundle.summary.components].sort()
    : []
  if (JSON.stringify(expectedComponents) !== JSON.stringify(suppliedComponents)) {
    throw new Error('Disaster-recovery component summary does not match manifest')
  }

  if (
    !bundle.safety
    || bundle.safety.runtimeSecretsIncluded !== false
    || bundle.safety.providerCredentialsIncluded !== false
    || bundle.safety.performsExternalActions !== false
    || typeof bundle.safety.warning !== 'string'
  ) {
    throw new Error('Disaster-recovery safety metadata is invalid')
  }

  const envelopeSize = Buffer.byteLength(JSON.stringify(bundle), 'utf8')
  if (envelopeSize > MAX_DR_ENVELOPE_BYTES) {
    throw new Error('Disaster-recovery envelope exceeds 180 MB limit')
  }
}

export class ServerDisasterRecoveryStore {
  constructor(
    private readonly dataDir: string,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly idFactory: () => string = () => randomUUID(),
  ) {}

  private storeDir(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId)
  }

  private archiveDir(storeId: string) {
    return path.join(this.storeDir(storeId), 'disaster-recovery', 'archives')
  }

  private archivePath(storeId: string, archiveId: string) {
    validateArchiveId(archiveId)
    return path.join(this.archiveDir(storeId), archiveId)
  }

  private metadataPath(storeId: string, archiveId: string) {
    return `${this.archivePath(storeId, archiveId)}.meta.json`
  }

  private async readOptionalFile(storeId: string, relative: string): Promise<ServerDrFile | null> {
    if (!isAllowedServerDrPath(relative)) return null
    const file = path.join(this.storeDir(storeId), ...relative.split('/'))

    try {
      const info = await stat(file)
      if (!info.isFile()) return null
      const body = await readFile(file)
      return {
        path: relative,
        size: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        encoding: 'base64',
        content: body.toString('base64'),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private async collectDirectory(
    storeId: string,
    relativeDir: string,
  ): Promise<ServerDrFile[]> {
    const dir = path.join(this.storeDir(storeId), ...relativeDir.split('/'))
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const files: ServerDrFile[] = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const relative = `${relativeDir}/${entry.name}`
      if (!isAllowedServerDrPath(relative)) continue
      const record = await this.readOptionalFile(storeId, relative)
      if (record) files.push(record)
    }
    return files
  }

  async buildBundle(
    storeId: string,
    label: string,
    source: ServerDrSource,
  ): Promise<ServerDrBundle> {
    validateStoreId(storeId)
    const normalizedLabel = safeLabel(label)

    const files = (
      await Promise.all([
        this.readOptionalFile(storeId, 'catalog.json'),
        this.readOptionalFile(storeId, 'payments.json'),
        this.readOptionalFile(storeId, 'sales.json'),
        this.readOptionalFile(storeId, 'daily-closes.json'),
        this.readOptionalFile(storeId, 'scale-fleet.json'),
      ])
    ).filter((item): item is ServerDrFile => Boolean(item))

    files.push(
      ...(await this.collectDirectory(storeId, 'assets')),
      ...(await this.collectDirectory(storeId, 'evidence/attachments')),
      ...(await this.collectDirectory(storeId, 'pilot-backups')),
    )

    files.sort((a, b) => a.path.localeCompare(b.path))

    if (files.length > MAX_DR_FILE_COUNT) {
      throw new Error('Disaster-recovery archive contains too many files')
    }

    const totalFileBytes = files.reduce((sum, file) => sum + file.size, 0)
    if (totalFileBytes > MAX_DR_TOTAL_FILE_BYTES) {
      throw new Error('Disaster-recovery file payload exceeds 128 MB limit')
    }

    const components = [...new Set(files.map((file) => componentFor(file.path)))].sort()

    const bundle: ServerDrBundle = {
      format: SERVER_DR_FORMAT,
      business: 'Carnicería El Chunchito',
      storeId,
      createdAt: this.now(),
      label: normalizedLabel,
      source,
      files,
      summary: {
        fileCount: files.length,
        totalFileBytes,
        components,
      },
      safety: {
        runtimeSecretsIncluded: false,
        providerCredentialsIncluded: false,
        performsExternalActions: false,
        warning: 'Allowlisted server data only. Runtime environment credentials/API secrets are intentionally excluded.',
      },
    }

    validateServerDrBundle(storeId, bundle)
    return bundle
  }

  private compressBundle(storeId: string, bundle: ServerDrBundle) {
    validateServerDrBundle(storeId, bundle)
    const json = Buffer.from(JSON.stringify(bundle), 'utf8')
    if (json.length > MAX_DR_ENVELOPE_BYTES) {
      throw new Error('Disaster-recovery envelope exceeds 180 MB limit')
    }

    const compressed = gzipSync(json, { level: 6 })
    if (compressed.length > MAX_DR_COMPRESSED_BYTES) {
      throw new Error('Compressed disaster-recovery archive exceeds 160 MB limit')
    }
    return compressed
  }

  private decodeArchive(storeId: string, compressed: Buffer): ServerDrBundle {
    if (!compressed.length) throw new Error('Disaster-recovery archive is empty')
    if (compressed.length > MAX_DR_COMPRESSED_BYTES) {
      throw new Error('Compressed disaster-recovery archive exceeds 160 MB limit')
    }

    let json: Buffer
    try {
      json = gunzipSync(compressed, { maxOutputLength: MAX_DR_ENVELOPE_BYTES })
    } catch {
      throw new Error('Invalid or oversized disaster-recovery gzip archive')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json.toString('utf8'))
    } catch {
      throw new Error('Disaster-recovery archive does not contain valid JSON')
    }

    validateServerDrBundle(storeId, parsed)
    return parsed
  }

  private metadata(
    id: string,
    bundle: ServerDrBundle,
    compressed: Buffer,
    ingest: ServerDrMetadata['ingest'],
  ): ServerDrMetadata {
    return {
      id,
      createdAt: bundle.createdAt,
      savedAt: this.now(),
      label: bundle.label,
      source: bundle.source,
      ingest,
      fileCount: bundle.summary.fileCount,
      totalFileBytes: bundle.summary.totalFileBytes,
      compressedSize: compressed.length,
      sha256: createHash('sha256').update(compressed).digest('hex'),
      components: bundle.summary.components,
    }
  }

  private async saveCompressed(
    storeId: string,
    compressed: Buffer,
    bundle: ServerDrBundle,
    ingest: ServerDrMetadata['ingest'],
  ): Promise<ServerDrMetadata> {
    const id = `dr-${this.idFactory()}.orbi-dr.gz`
    const metadata = this.metadata(id, bundle, compressed, ingest)
    const dir = this.archiveDir(storeId)
    await mkdir(dir, { recursive: true })

    const archivePath = this.archivePath(storeId, id)
    const metaPath = this.metadataPath(storeId, id)
    const archiveTemp = `${archivePath}.tmp-${process.pid}-${Date.now()}`
    const metaTemp = `${metaPath}.tmp-${process.pid}-${Date.now()}`

    await writeFile(archiveTemp, compressed)
    await writeFile(metaTemp, JSON.stringify(metadata, null, 2), 'utf8')
    await rename(archiveTemp, archivePath)
    await rename(metaTemp, metaPath)

    return metadata
  }

  async create(
    storeId: string,
    label: string,
    source: ServerDrSource = 'manual',
  ): Promise<ServerDrMetadata> {
    const bundle = await this.buildBundle(storeId, label, source)
    const compressed = this.compressBundle(storeId, bundle)
    return await this.saveCompressed(storeId, compressed, bundle, 'created')
  }

  async import(
    storeId: string,
    compressed: Buffer,
  ): Promise<ServerDrMetadata> {
    const bundle = this.decodeArchive(storeId, compressed)
    return await this.saveCompressed(storeId, compressed, bundle, 'imported')
  }

  private async readMetadata(
    storeId: string,
    archiveId: string,
  ): Promise<ServerDrMetadata> {
    const raw = await readFile(this.metadataPath(storeId, archiveId), 'utf8')
    const metadata = JSON.parse(raw) as ServerDrMetadata
    if (metadata.id !== archiveId) throw new Error('Disaster-recovery metadata id mismatch')
    if (!validIso(metadata.createdAt) || !validIso(metadata.savedAt)) {
      throw new Error('Invalid disaster-recovery metadata timestamps')
    }
    if (typeof metadata.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.sha256)) {
      throw new Error('Invalid disaster-recovery metadata hash')
    }
    return metadata
  }

  async list(storeId: string): Promise<ServerDrMetadata[]> {
    const dir = this.archiveDir(storeId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const records: ServerDrMetadata[] = []
    for (const name of names) {
      if (!name.endsWith('.orbi-dr.gz')) continue
      try {
        validateArchiveId(name)
        const metadata = await this.readMetadata(storeId, name)
        await stat(this.archivePath(storeId, name))
        records.push(metadata)
      } catch {
        // Corrupt/incomplete archives are omitted from the pilot list.
      }
    }

    return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }

  async loadValidatedArchive(
    storeId: string,
    archiveId: string,
  ): Promise<{ metadata: ServerDrMetadata; bundle: ServerDrBundle }> {
    const archivePath = this.archivePath(storeId, archiveId)
    const [compressed, metadata] = await Promise.all([
      readFile(archivePath),
      this.readMetadata(storeId, archiveId),
    ])

    if (compressed.length !== metadata.compressedSize) {
      throw new Error('Disaster-recovery compressed-size integrity check failed')
    }
    const digest = createHash('sha256').update(compressed).digest('hex')
    if (digest !== metadata.sha256) {
      throw new Error('Disaster-recovery archive SHA-256 integrity check failed')
    }

    const bundle = this.decodeArchive(storeId, compressed)
    if (
      bundle.createdAt !== metadata.createdAt
      || bundle.label !== metadata.label
      || bundle.source !== metadata.source
      || bundle.summary.fileCount !== metadata.fileCount
      || bundle.summary.totalFileBytes !== metadata.totalFileBytes
    ) {
      throw new Error('Disaster-recovery metadata does not match archive')
    }

    return { metadata, bundle }
  }

  async inspect(
    storeId: string,
    archiveId: string,
  ): Promise<ServerDrInspection> {
    const { metadata, bundle } = await this.loadValidatedArchive(
      storeId,
      archiveId,
    )

    return {
      metadata,
      manifest: bundleManifest(bundle),
    }
  }

  async currentManifest(
    storeId: string,
  ): Promise<ServerDrInspection['manifest']> {
    const bundle = await this.buildBundle(
      storeId,
      'Recovery drill live coverage',
      'manual',
    )
    return bundleManifest(bundle)
  }

  async getArchivePath(
    storeId: string,
    archiveId: string,
  ): Promise<string> {
    await this.inspect(storeId, archiveId)
    return this.archivePath(storeId, archiveId)
  }

  private async targetExists(target: string) {
    try {
      await stat(target)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  async restore(
    storeId: string,
    archiveId: string,
    confirmation: string,
  ): Promise<{
    restoredArchiveId: string
    safetyArchive: ServerDrMetadata
    restoredFiles: number
    restoredBytes: number
  }> {
    if (confirmation !== `RESTORE ${storeId}`) {
      throw new Error(`Restore confirmation must equal RESTORE ${storeId}`)
    }

    const archivePath = this.archivePath(storeId, archiveId)
    const compressed = await readFile(archivePath)
    const bundle = this.decodeArchive(storeId, compressed)
    await this.inspect(storeId, archiveId)

    const safetyArchive = await this.create(
      storeId,
      `Pre-restore server safety · ${this.now()}`,
      'pre-restore',
    )

    const transactionId = randomUUID()
    const transactionRoot = path.join(
      this.storeDir(storeId),
      `.dr-restore-${transactionId}`,
    )
    const stagedRoot = path.join(transactionRoot, 'staged')
    const previousRoot = path.join(transactionRoot, 'previous')
    await mkdir(stagedRoot, { recursive: true })
    await mkdir(previousRoot, { recursive: true })

    const movedTargets: string[] = []
    const installedTargets: string[] = []

    try {
      for (const file of bundle.files) {
        const relative = normalizeRelativePath(file.path)
        if (!isAllowedServerDrPath(relative)) {
          throw new Error(`Restore path is not allowlisted: ${relative}`)
        }
        const body = Buffer.from(file.content, 'base64')
        const stagedPath = path.join(stagedRoot, ...relative.split('/'))
        await mkdir(path.dirname(stagedPath), { recursive: true })
        await writeFile(stagedPath, body)

        const verifyBody = await readFile(stagedPath)
        const digest = createHash('sha256').update(verifyBody).digest('hex')
        if (verifyBody.length !== file.size || digest !== file.sha256) {
          throw new Error(`Staged restore verification failed: ${relative}`)
        }
      }

      for (const relativeTarget of PROTECTED_TARGETS) {
        const live = path.join(this.storeDir(storeId), ...relativeTarget.split('/'))
        const staged = path.join(stagedRoot, ...relativeTarget.split('/'))
        const previous = path.join(previousRoot, ...relativeTarget.split('/'))

        if (await this.targetExists(live)) {
          await mkdir(path.dirname(previous), { recursive: true })
          await rename(live, previous)
          movedTargets.push(relativeTarget)
        }

        if (await this.targetExists(staged)) {
          await mkdir(path.dirname(live), { recursive: true })
          await rename(staged, live)
          installedTargets.push(relativeTarget)
        }
      }

      await rm(transactionRoot, { recursive: true, force: true })
      return {
        restoredArchiveId: archiveId,
        safetyArchive,
        restoredFiles: bundle.summary.fileCount,
        restoredBytes: bundle.summary.totalFileBytes,
      }
    } catch (error) {
      for (const relativeTarget of [...installedTargets].reverse()) {
        const live = path.join(this.storeDir(storeId), ...relativeTarget.split('/'))
        await rm(live, { recursive: true, force: true }).catch(() => undefined)
      }
      for (const relativeTarget of [...movedTargets].reverse()) {
        const live = path.join(this.storeDir(storeId), ...relativeTarget.split('/'))
        const previous = path.join(previousRoot, ...relativeTarget.split('/'))
        if (await this.targetExists(previous)) {
          await mkdir(path.dirname(live), { recursive: true })
          await rename(previous, live).catch(() => undefined)
        }
      }
      await rm(transactionRoot, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  }
}
