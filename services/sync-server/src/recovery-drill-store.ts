import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AssetStore } from './asset-store.js'
import { CatalogStore } from './catalog-store.js'
import { EvidenceAttachmentStore } from './evidence-attachment-store.js'
import { PaymentStore } from './payment-store.js'
import { PilotBackupStore } from './pilot-backup-store.js'
import { ScaleFleetStore } from './scale-fleet-store.js'
import {
  ServerDisasterRecoveryStore,
  isAllowedServerDrPath,
  type ServerDrBundle,
  type ServerDrMetadata,
} from './server-disaster-recovery-store.js'

export const RECOVERY_DRILL_FORMAT = 'orbi-pos-recovery-drill/v1'

export type RecoveryDrillResult =
  | 'certified'
  | 'certified_with_drift'
  | 'failed'

export type RecoveryDrillCheckStatus =
  | 'pass'
  | 'warning'
  | 'fail'
  | 'not_present'

export interface RecoveryDrillCheck {
  id: string
  label: string
  status: RecoveryDrillCheckStatus
  detail: string
}

export interface RecoveryDrillComponent {
  id:
    | 'catalog'
    | 'payments'
    | 'scale-fleet'
    | 'product-assets'
    | 'evidence-attachments'
    | 'pilot-backups'
  status: RecoveryDrillCheckStatus
  files: number
  bytes: number
  detail: string
}

export interface RecoveryDrillLiveDrift {
  comparisonAvailable: boolean
  matching: string[]
  changed: string[]
  newLive: string[]
  archiveOnly: string[]
  note: string
}

export interface RecoveryDrillCertificate {
  format: typeof RECOVERY_DRILL_FORMAT
  id: string
  storeId: string
  archiveId: string
  archiveSha256: string | null
  startedAt: string
  completedAt: string
  durationMs: number
  result: RecoveryDrillResult
  archiveFileCount: number
  archiveBytes: number
  stagedFiles: number
  stagedBytes: number
  checks: RecoveryDrillCheck[]
  components: RecoveryDrillComponent[]
  liveDrift: RecoveryDrillLiveDrift
  safety: {
    liveDataReplaced: false
    providerCallsMade: false
    siiActionsMade: false
    rm60WritesMade: false
    secretsCaptured: false
    sandboxCleaned: boolean
    warning: string
  }
}

export interface RecoveryDrillRecord {
  certificate: RecoveryDrillCertificate
  reportSha256: string
}

export interface RecoveryDrillMetadata {
  id: string
  archiveId: string
  archiveSha256: string | null
  startedAt: string
  completedAt: string
  durationMs: number
  result: RecoveryDrillResult
  archiveFileCount: number
  archiveBytes: number
  reportSha256: string
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateCertificateId(value: string) {
  if (!/^cert-[0-9a-f-]{36}\.json$/.test(value)) {
    throw new Error('Invalid recovery drill certification id')
  }
}

function check(
  id: string,
  label: string,
  status: RecoveryDrillCheckStatus,
  detail: string,
): RecoveryDrillCheck {
  return { id, label, status, detail }
}

function component(
  id: RecoveryDrillComponent['id'],
  status: RecoveryDrillCheckStatus,
  files: number,
  bytes: number,
  detail: string,
): RecoveryDrillComponent {
  return { id, status, files, bytes, detail }
}

function parseJson(body: Buffer, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body.toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new Error(`${label} does not contain valid JSON object data`)
  }
}

function imageSignatureOk(body: Buffer, fileName: string) {
  const extension = path.extname(fileName).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') {
    return body.length >= 3
      && body[0] === 0xff
      && body[1] === 0xd8
      && body[2] === 0xff
  }
  if (extension === '.png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return body.length >= signature.length
      && signature.every((byte, index) => body[index] === byte)
  }
  if (extension === '.webp') {
    return body.length >= 12
      && body.subarray(0, 4).toString('ascii') === 'RIFF'
      && body.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

function fileStats(files: ServerDrBundle['files']) {
  return {
    files: files.length,
    bytes: files.reduce((sum, item) => sum + item.size, 0),
  }
}

function compareManifests(
  archive: ServerDrBundle,
  liveFiles: Array<{ path: string; sha256: string }>,
): RecoveryDrillLiveDrift {
  const archiveMap = new Map(archive.files.map((file) => [file.path, file.sha256]))
  const liveMap = new Map(liveFiles.map((file) => [file.path, file.sha256]))

  const matching: string[] = []
  const changed: string[] = []
  const newLive: string[] = []
  const archiveOnly: string[] = []

  for (const [relative, archiveHash] of archiveMap) {
    const liveHash = liveMap.get(relative)
    if (!liveHash) archiveOnly.push(relative)
    else if (liveHash === archiveHash) matching.push(relative)
    else changed.push(relative)
  }

  for (const relative of liveMap.keys()) {
    if (!archiveMap.has(relative)) newLive.push(relative)
  }

  matching.sort()
  changed.sort()
  newLive.sort()
  archiveOnly.sort()

  const driftCount = changed.length + newLive.length + archiveOnly.length
  return {
    comparisonAvailable: true,
    matching,
    changed,
    newLive,
    archiveOnly,
    note: driftCount
      ? 'Archive is reconstructable, but current live allowlisted state has changed since this snapshot.'
      : 'Current live allowlisted state exactly matches the tested archive.',
  }
}

export class RecoveryDrillStore {
  constructor(
    private readonly dataDir: string,
    private readonly disasterRecovery: ServerDisasterRecoveryStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly clockMs: () => number = () => Date.now(),
    private readonly idFactory: () => string = () => randomUUID(),
  ) {}

  private certificateDir(storeId: string) {
    validateStoreId(storeId)
    return path.join(
      this.dataDir,
      'stores',
      storeId,
      'disaster-recovery',
      'certifications',
    )
  }

  private certificatePath(storeId: string, certificateId: string) {
    validateCertificateId(certificateId)
    return path.join(this.certificateDir(storeId), certificateId)
  }

  private async save(
    storeId: string,
    certificate: RecoveryDrillCertificate,
  ): Promise<RecoveryDrillRecord> {
    const reportSha256 = createHash('sha256')
      .update(JSON.stringify(certificate))
      .digest('hex')
    const record: RecoveryDrillRecord = { certificate, reportSha256 }

    const dir = this.certificateDir(storeId)
    await mkdir(dir, { recursive: true })
    const file = this.certificatePath(storeId, certificate.id)
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(record, null, 2), 'utf8')
    await rename(temp, file)

    return record
  }

  private validateStoredRecord(
    storeId: string,
    fileName: string,
    record: RecoveryDrillRecord,
  ) {
    validateCertificateId(fileName)
    if (!record || typeof record !== 'object' || !record.certificate) {
      throw new Error('Invalid recovery drill certification record')
    }

    const certificate = record.certificate
    if (certificate.format !== RECOVERY_DRILL_FORMAT) {
      throw new Error('Unsupported recovery drill certification format')
    }
    if (certificate.id !== fileName) {
      throw new Error('Recovery drill certification id mismatch')
    }
    if (certificate.storeId !== storeId) {
      throw new Error('Recovery drill certification store mismatch')
    }
    if (
      certificate.result !== 'certified'
      && certificate.result !== 'certified_with_drift'
      && certificate.result !== 'failed'
    ) {
      throw new Error('Invalid recovery drill certification result')
    }
    if (typeof record.reportSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.reportSha256)) {
      throw new Error('Invalid recovery drill report hash')
    }

    const expected = createHash('sha256')
      .update(JSON.stringify(certificate))
      .digest('hex')
    if (expected !== record.reportSha256) {
      throw new Error('Recovery drill certification integrity check failed')
    }

    return record
  }

  async get(
    storeId: string,
    certificateId: string,
  ): Promise<RecoveryDrillRecord | null> {
    const file = this.certificatePath(storeId, certificateId)
    try {
      const raw = await readFile(file, 'utf8')
      return this.validateStoredRecord(
        storeId,
        certificateId,
        JSON.parse(raw) as RecoveryDrillRecord,
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(storeId: string): Promise<RecoveryDrillMetadata[]> {
    const dir = this.certificateDir(storeId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const records: RecoveryDrillMetadata[] = []
    for (const name of names) {
      if (!name.startsWith('cert-') || !name.endsWith('.json')) continue
      try {
        const raw = await readFile(path.join(dir, name), 'utf8')
        const record = this.validateStoredRecord(
          storeId,
          name,
          JSON.parse(raw) as RecoveryDrillRecord,
        )
        const certificate = record.certificate
        records.push({
          id: certificate.id,
          archiveId: certificate.archiveId,
          archiveSha256: certificate.archiveSha256,
          startedAt: certificate.startedAt,
          completedAt: certificate.completedAt,
          durationMs: certificate.durationMs,
          result: certificate.result,
          archiveFileCount: certificate.archiveFileCount,
          archiveBytes: certificate.archiveBytes,
          reportSha256: record.reportSha256,
        })
      } catch {
        // Corrupt/tampered certification records are omitted from the list.
      }
    }

    return records.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  }

  private async stageBundle(
    sandboxDataDir: string,
    storeId: string,
    bundle: ServerDrBundle,
  ) {
    const stagedStoreDir = path.join(sandboxDataDir, 'stores', storeId)
    let stagedBytes = 0

    for (const file of bundle.files) {
      if (!isAllowedServerDrPath(file.path)) {
        throw new Error(`Drill staging rejected non-allowlisted path: ${file.path}`)
      }

      const destination = path.join(
        stagedStoreDir,
        ...file.path.split('/'),
      )
      await mkdir(path.dirname(destination), { recursive: true })
      const body = Buffer.from(file.content, 'base64')
      await writeFile(destination, body)

      const reread = await readFile(destination)
      const digest = createHash('sha256').update(reread).digest('hex')
      if (reread.length !== file.size || digest !== file.sha256) {
        throw new Error(`Drill staged verification failed: ${file.path}`)
      }

      stagedBytes += reread.length
    }

    return {
      stagedFiles: bundle.files.length,
      stagedBytes,
      stagedStoreDir,
    }
  }

  private async validateComponents(
    sandboxDataDir: string,
    storeId: string,
    bundle: ServerDrBundle,
  ): Promise<{
    checks: RecoveryDrillCheck[]
    components: RecoveryDrillComponent[]
  }> {
    const checks: RecoveryDrillCheck[] = []
    const components: RecoveryDrillComponent[] = []
    const stagedStoreDir = path.join(sandboxDataDir, 'stores', storeId)
    const fileMap = new Map(bundle.files.map((file) => [file.path, file]))

    const catalogFile = fileMap.get('catalog.json')
    if (!catalogFile) {
      components.push(component('catalog', 'not_present', 0, 0, 'catalog.json is not present in this archive.'))
    } else {
      try {
        const raw = await readFile(path.join(stagedStoreDir, 'catalog.json'))
        const parsed = parseJson(raw, 'catalog.json')
        if (parsed.storeId !== storeId) throw new Error('catalog storeId mismatch')
        if (!Number.isInteger(parsed.revision) || Number(parsed.revision) < 0) {
          throw new Error('catalog revision is invalid')
        }
        if (!Array.isArray(parsed.products)) throw new Error('catalog products is not an array')
        if (!Array.isArray(parsed.priceHistory)) throw new Error('catalog priceHistory is not an array')

        const snapshot = await new CatalogStore(sandboxDataDir).get(storeId)
        if (!snapshot || snapshot.storeId !== storeId) {
          throw new Error('CatalogStore could not reopen reconstructed catalog')
        }

        components.push(component(
          'catalog',
          'pass',
          1,
          catalogFile.size,
          `CatalogStore reopened revision ${snapshot.revision} with ${snapshot.products.length} product(s).`,
        ))
        checks.push(check('catalog-domain', 'Catálogo recuperable', 'pass', 'JSON and CatalogStore checks passed.'))
      } catch (error) {
        components.push(component('catalog', 'fail', 1, catalogFile.size, (error as Error).message))
        checks.push(check('catalog-domain', 'Catálogo recuperable', 'fail', (error as Error).message))
      }
    }

    const paymentFile = fileMap.get('payments.json')
    if (!paymentFile) {
      components.push(component('payments', 'not_present', 0, 0, 'payments.json is not present in this archive.'))
    } else {
      try {
        const raw = await readFile(path.join(stagedStoreDir, 'payments.json'))
        const parsed = parseJson(raw, 'payments.json')
        if (!Array.isArray(parsed.orders)) throw new Error('payments orders is not an array')
        const orders = await new PaymentStore(sandboxDataDir).list(storeId, 500)
        components.push(component(
          'payments',
          'pass',
          1,
          paymentFile.size,
          `PaymentStore reopened historical audit data; ${orders.length} order(s) visible in drill query.`,
        ))
        checks.push(check(
          'payments-domain',
          'Payment Core histórico recuperable',
          'pass',
          'Historical records reopened without any provider call.',
        ))
      } catch (error) {
        components.push(component('payments', 'fail', 1, paymentFile.size, (error as Error).message))
        checks.push(check('payments-domain', 'Payment Core histórico recuperable', 'fail', (error as Error).message))
      }
    }

    const fleetFile = fileMap.get('scale-fleet.json')
    if (!fleetFile) {
      components.push(component('scale-fleet', 'not_present', 0, 0, 'scale-fleet.json is not present in this archive.'))
    } else {
      try {
        const fleet = await new ScaleFleetStore(sandboxDataDir).get(storeId)
        const principals = fleet.devices.filter((device) => device.role === 'principal')
        if (fleet.storeId !== storeId) throw new Error('RM-60 fleet storeId mismatch')
        if (!fleet.devices.length) throw new Error('RM-60 fleet contains no devices')
        if (principals.length !== 1) throw new Error('RM-60 fleet must contain exactly one principal')

        components.push(component(
          'scale-fleet',
          'pass',
          1,
          fleetFile.size,
          `ScaleFleetStore reopened ${fleet.devices.length} device(s) with one principal.`,
        ))
        checks.push(check('scale-domain', 'Fleet RM-60 recuperable', 'pass', 'Scale fleet domain validation passed.'))
      } catch (error) {
        components.push(component('scale-fleet', 'fail', 1, fleetFile.size, (error as Error).message))
        checks.push(check('scale-domain', 'Fleet RM-60 recuperable', 'fail', (error as Error).message))
      }
    }

    const assetFiles = bundle.files.filter((file) => file.path.startsWith('assets/'))
    if (!assetFiles.length) {
      components.push(component('product-assets', 'not_present', 0, 0, 'No product image assets are present in this archive.'))
    } else {
      try {
        for (const asset of assetFiles) {
          const body = await readFile(path.join(stagedStoreDir, ...asset.path.split('/')))
          if (!imageSignatureOk(body, asset.path)) {
            throw new Error(`Invalid reconstructed image signature: ${asset.path}`)
          }
        }
        const listed = await new AssetStore(sandboxDataDir).list(storeId)
        if (listed.length !== assetFiles.length) {
          throw new Error(`AssetStore listed ${listed.length}/${assetFiles.length} reconstructed asset(s)`)
        }
        const stats = fileStats(assetFiles)
        components.push(component(
          'product-assets',
          'pass',
          stats.files,
          stats.bytes,
          `${stats.files} product image(s) passed magic-signature and AssetStore listing checks.`,
        ))
        checks.push(check('asset-domain', 'Imágenes recuperables', 'pass', 'All reconstructed product images passed signature checks.'))
      } catch (error) {
        const stats = fileStats(assetFiles)
        components.push(component('product-assets', 'fail', stats.files, stats.bytes, (error as Error).message))
        checks.push(check('asset-domain', 'Imágenes recuperables', 'fail', (error as Error).message))
      }
    }

    const evidenceFiles = bundle.files.filter((file) => file.path.startsWith('evidence/attachments/'))
    const evidenceBinaries = evidenceFiles.filter((file) => !file.path.endsWith('.meta.json'))
    const evidenceMetadata = evidenceFiles.filter((file) => file.path.endsWith('.meta.json'))
    if (!evidenceFiles.length) {
      components.push(component('evidence-attachments', 'not_present', 0, 0, 'No OC-27 evidence attachments are present in this archive.'))
    } else {
      try {
        if (evidenceBinaries.length !== evidenceMetadata.length) {
          throw new Error('Evidence binary/metadata pair count mismatch')
        }

        for (const binary of evidenceBinaries) {
          const metadataPath = `${binary.path}.meta.json`
          const metadataRecord = fileMap.get(metadataPath)
          if (!metadataRecord) throw new Error(`Evidence metadata missing: ${metadataPath}`)

          const binaryBody = await readFile(
            path.join(stagedStoreDir, ...binary.path.split('/')),
          )
          const metadataBody = await readFile(
            path.join(stagedStoreDir, ...metadataPath.split('/')),
          )
          const metadata = parseJson(metadataBody, metadataPath)
          const expectedFileName = path.posix.basename(binary.path)
          const digest = createHash('sha256').update(binaryBody).digest('hex')

          if (metadata.fileName !== expectedFileName) {
            throw new Error(`Evidence metadata filename mismatch: ${metadataPath}`)
          }
          if (metadata.sha256 !== digest) {
            throw new Error(`Evidence metadata hash mismatch: ${metadataPath}`)
          }
        }

        const listed = await new EvidenceAttachmentStore(sandboxDataDir).list(storeId)
        if (listed.length !== evidenceBinaries.length) {
          throw new Error(`EvidenceAttachmentStore listed ${listed.length}/${evidenceBinaries.length} reconstructed attachment(s)`)
        }

        const stats = fileStats(evidenceFiles)
        components.push(component(
          'evidence-attachments',
          'pass',
          stats.files,
          stats.bytes,
          `${evidenceBinaries.length} evidence attachment(s) reconstructed with matching metadata/hash pairs.`,
        ))
        checks.push(check('evidence-domain', 'Evidencia OC-27 recuperable', 'pass', 'Binary/metadata pairs and EvidenceAttachmentStore checks passed.'))
      } catch (error) {
        const stats = fileStats(evidenceFiles)
        components.push(component('evidence-attachments', 'fail', stats.files, stats.bytes, (error as Error).message))
        checks.push(check('evidence-domain', 'Evidencia OC-27 recuperable', 'fail', (error as Error).message))
      }
    }

    const pilotBackupFiles = bundle.files.filter((file) => file.path.startsWith('pilot-backups/'))
    if (!pilotBackupFiles.length) {
      components.push(component('pilot-backups', 'not_present', 0, 0, 'No OC-28 pilot backups are present in this archive.'))
    } else {
      try {
        const listed = await new PilotBackupStore(sandboxDataDir).list(storeId)
        if (listed.length !== pilotBackupFiles.length) {
          throw new Error(`PilotBackupStore validated ${listed.length}/${pilotBackupFiles.length} reconstructed backup(s)`)
        }

        const stats = fileStats(pilotBackupFiles)
        components.push(component(
          'pilot-backups',
          'pass',
          stats.files,
          stats.bytes,
          `${listed.length} OC-28 backup(s) reopened with stored integrity validation.`,
        ))
        checks.push(check('pilot-backup-domain', 'Backups OC-28 recuperables', 'pass', 'All reconstructed OC-28 records passed PilotBackupStore validation.'))
      } catch (error) {
        const stats = fileStats(pilotBackupFiles)
        components.push(component('pilot-backups', 'fail', stats.files, stats.bytes, (error as Error).message))
        checks.push(check('pilot-backup-domain', 'Backups OC-28 recuperables', 'fail', (error as Error).message))
      }
    }

    return { checks, components }
  }

  async run(
    storeId: string,
    archiveId: string,
  ): Promise<RecoveryDrillRecord> {
    validateStoreId(storeId)
    const startedAt = this.now()
    const startedMs = this.clockMs()
    const id = `cert-${this.idFactory()}.json`
    validateCertificateId(id)

    const knownMetadata = (await this.disasterRecovery.list(storeId))
      .find((item) => item.id === archiveId)

    let sandboxRoot: string | null = null
    let archiveSha256 = knownMetadata?.sha256 ?? null
    let archiveFileCount = knownMetadata?.fileCount ?? 0
    let archiveBytes = knownMetadata?.totalFileBytes ?? 0
    let stagedFiles = 0
    let stagedBytes = 0
    const checks: RecoveryDrillCheck[] = []
    let components: RecoveryDrillComponent[] = []
    let liveDrift: RecoveryDrillLiveDrift = {
      comparisonAvailable: false,
      matching: [],
      changed: [],
      newLive: [],
      archiveOnly: [],
      note: 'Live coverage comparison was not completed.',
    }
    let result: RecoveryDrillResult = 'failed'
    let failureWarning = 'Certification failed before proving a complete isolated reconstruction.'

    try {
      const { metadata, bundle } = await this.disasterRecovery.loadValidatedArchive(
        storeId,
        archiveId,
      )

      archiveSha256 = metadata.sha256
      archiveFileCount = bundle.summary.fileCount
      archiveBytes = bundle.summary.totalFileBytes
      checks.push(check(
        'archive-integrity',
        'Integridad del archivo OC-29',
        'pass',
        `Whole archive SHA-256 and ${bundle.files.length} internal file hashes validated.`,
      ))

      sandboxRoot = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-recovery-drill-'))
      const sandboxDataDir = path.join(sandboxRoot, 'data')
      const staged = await this.stageBundle(sandboxDataDir, storeId, bundle)
      stagedFiles = staged.stagedFiles
      stagedBytes = staged.stagedBytes
      checks.push(check(
        'sandbox-reconstruction',
        'Reconstrucción aislada',
        'pass',
        `${stagedFiles} file(s) were physically reconstructed and re-hashed in an isolated temporary data directory.`,
      ))

      const componentResults = await this.validateComponents(
        sandboxDataDir,
        storeId,
        bundle,
      )
      checks.push(...componentResults.checks)
      components = componentResults.components

      try {
        const liveManifest = await this.disasterRecovery.currentManifest(storeId)
        liveDrift = compareManifests(
          bundle,
          liveManifest.files.map((file) => ({
            path: file.path,
            sha256: file.sha256,
          })),
        )
        const driftCount = liveDrift.changed.length
          + liveDrift.newLive.length
          + liveDrift.archiveOnly.length

        checks.push(check(
          'live-coverage',
          'Cobertura contra servidor actual',
          driftCount ? 'warning' : 'pass',
          driftCount
            ? `Archive remains recoverable; ${driftCount} live path difference(s) were detected since snapshot.`
            : 'Current allowlisted server state exactly matches the archive manifest.',
        ))
      } catch (error) {
        liveDrift = {
          comparisonAvailable: false,
          matching: [],
          changed: [],
          newLive: [],
          archiveOnly: [],
          note: `Live comparison unavailable: ${(error as Error).message}`,
        }
        checks.push(check(
          'live-coverage',
          'Cobertura contra servidor actual',
          'warning',
          liveDrift.note,
        ))
      }

      const anyFailure = components.some((item) => item.status === 'fail')
        || checks.some((item) => item.status === 'fail')
      const hasDrift = !liveDrift.comparisonAvailable
        || liveDrift.changed.length > 0
        || liveDrift.newLive.length > 0
        || liveDrift.archiveOnly.length > 0

      result = anyFailure
        ? 'failed'
        : hasDrift
          ? 'certified_with_drift'
          : 'certified'
      failureWarning = anyFailure
        ? 'One or more reconstruction/domain checks failed.'
        : 'Certification reconstructs only inside an isolated temporary sandbox and never restores live data.'
    } catch (error) {
      checks.push(check(
        'drill-failure',
        'Simulacro de recuperación',
        'fail',
        (error as Error).message,
      ))
      result = 'failed'
    }

    let sandboxCleaned = true
    if (sandboxRoot) {
      try {
        await rm(sandboxRoot, { recursive: true, force: true })
      } catch (error) {
        sandboxCleaned = false
        checks.push(check(
          'sandbox-cleanup',
          'Limpieza del sandbox temporal',
          'warning',
          `Recovery drill completed but temporary sandbox cleanup failed: ${(error as Error).message}`,
        ))
      }
    }

    const certificate: RecoveryDrillCertificate = {
      format: RECOVERY_DRILL_FORMAT,
      id,
      storeId,
      archiveId,
      archiveSha256,
      startedAt,
      completedAt: this.now(),
      durationMs: Math.max(0, this.clockMs() - startedMs),
      result,
      archiveFileCount,
      archiveBytes,
      stagedFiles,
      stagedBytes,
      checks,
      components,
      liveDrift,
      safety: {
        liveDataReplaced: false,
        providerCallsMade: false,
        siiActionsMade: false,
        rm60WritesMade: false,
        secretsCaptured: false,
        sandboxCleaned,
        warning: failureWarning,
      },
    }

    return await this.save(storeId, certificate)
  }
}
