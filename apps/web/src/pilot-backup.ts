import {
  emptyFieldDiscovery,
  type FieldDiscoveryRecord,
} from './discovery-model'
import {
  emptyModernizationInputs,
  type ModernizationInputs,
} from './proposal-model'
import {
  emptyManualGateEvidence,
  sanitizeManualGateEvidence,
  type ManualGateEvidence,
} from './production-gate'
import {
  createEmptyMigrationRunbook,
  sanitizeMigrationRunbook,
  type MigrationRunbookState,
} from './migration-runbook'
import {
  emptyEvidenceLedger,
  sanitizeEvidenceLedger,
  type EvidenceLedgerState,
} from './evidence-ledger'
import {
  emptyEvidenceCaseState,
  sanitizeEvidenceCaseState,
  type EvidenceCaseState,
} from './evidence-case'

export const PILOT_BACKUP_FORMAT = 'orbi-pos-pilot-backup/v1' as const

export const PILOT_BACKUP_MODULES = [
  'fieldDiscovery',
  'modernizationProposal',
  'productionGate',
  'migrationRunbook',
  'evidenceLedger',
  'evidenceCases',
] as const

export type PilotBackupModuleName = typeof PILOT_BACKUP_MODULES[number]
export type PilotBackupSource = 'manual' | 'pre-restore' | 'portable-import'

export interface PilotBackupModules {
  fieldDiscovery: FieldDiscoveryRecord
  modernizationProposal: ModernizationInputs
  productionGate: ManualGateEvidence
  migrationRunbook: MigrationRunbookState
  evidenceLedger: EvidenceLedgerState
  evidenceCases: EvidenceCaseState
}

export interface PilotBackupEvidenceReference {
  fileName: string
  contentType: string
  size: number
  sha256: string
  uploadedAt: string
  caseId: string | null
  entryId: string | null
}

export interface PilotBackupServerReferences {
  catalog: {
    revision: number | null
    updatedAt: string | null
    productCount: number | null
  }
  evidenceAttachments: PilotBackupEvidenceReference[]
}

export interface PilotBackupBundle {
  format: typeof PILOT_BACKUP_FORMAT
  business: 'Carnicería El Chunchito'
  storeId: string
  createdAt: string
  label: string
  source: PilotBackupSource
  modules: PilotBackupModules
  serverReferences: PilotBackupServerReferences
  safety: {
    containsCredentials: false
    performsExternalActions: false
    warning: string
  }
}

export interface StorageReaderWriter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const PILOT_BACKUP_STORAGE_KEYS: Record<PilotBackupModuleName, string> = {
  fieldDiscovery: 'orbi-pos:field-discovery',
  modernizationProposal: 'orbi-pos:modernization-proposal',
  productionGate: 'orbi-pos:production-gate',
  migrationRunbook: 'orbi-pos:migration-runbook',
  evidenceLedger: 'orbi-pos:evidence-ledger',
  evidenceCases: 'orbi-pos:evidence-cases',
}

export const PILOT_BACKUP_MODULE_LABELS: Record<PilotBackupModuleName, string> = {
  fieldDiscovery: 'Levantamiento',
  modernizationProposal: 'Propuesta',
  productionGate: 'Gate de producción',
  migrationRunbook: 'Runbook de migración',
  evidenceLedger: 'Ledger de evidencia',
  evidenceCases: 'Expedientes',
}

const triState = ['pending', 'yes', 'no', 'unknown'] as const
const issueFrequency = ['pending', 'always', 'intermittent', 'resolved', 'unknown'] as const
const incidentReporter = ['pending', 'owner', 'staff', 'accountant', 'inputsoft', 'sii', 'other', 'unknown'] as const
const siiState = ['pending', 'found', 'missing', 'mixed', 'not_checked'] as const
const fiscalScope = ['pending', 'individual_boletas', 'daily_summary', 'both', 'unknown'] as const
const sunmiArrangement = ['pending', 'purchased', 'rented', 'bundled', 'unknown'] as const

const obviousSecretPatterns = [
  /\b(?:password|passwd|contrase(?:ñ|n)a)\s*[:=]\s*\S+/i,
  /\bapi[_ -]?key\s*[:=]\s*\S+/i,
  /\baccess[_ -]?token\s*[:=]\s*\S+/i,
  /\bclient[_ -]?secret\s*[:=]\s*\S+/i,
  /\bbearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
]

function forbiddenSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return [
    'password',
    'passwd',
    'secret',
    'token',
    'apikey',
    'authorization',
    'credential',
    'cvv',
    'cvc',
    'cardnumber',
    'cardpan',
  ].some((part) => normalized.includes(part))
}

function passesLuhn(digits: string) {
  let sum = 0
  let doubleDigit = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index])
    if (doubleDigit) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

function containsLikelyCardNumber(value: string, path: string) {
  if (/(?:^|\.)(?:id|[A-Za-z]+At|fileName|sha256|version|format)$/i.test(path)) {
    return false
  }
  const candidates = value.match(/\d(?:[ -]?\d){12,18}/g) ?? []
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '')
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)
  })
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && allowed.includes(value)
    ? value as T[number]
    : fallback
}

function moneyValue(value: unknown, fallback: number | null = null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function percentValue(value: unknown, fallback: number | null = null) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 100
    ? value
    : fallback
}

export function sanitizeFieldDiscoveryForBackup(
  input: unknown,
): FieldDiscoveryRecord {
  const root = objectValue(input)
  const sunmi = objectValue(root.sunmi)
  const commercial = objectValue(root.commercial)
  const scale = objectValue(root.scale)

  return {
    sunmi: {
      boletaPrints: enumValue(sunmi.boletaPrints, triState, emptyFieldDiscovery.sunmi.boletaPrints),
      errorVisible: enumValue(sunmi.errorVisible, triState, emptyFieldDiscovery.sunmi.errorVisible),
      issueFrequency: enumValue(sunmi.issueFrequency, issueFrequency, emptyFieldDiscovery.sunmi.issueFrequency),
      reporter: enumValue(sunmi.reporter, incidentReporter, emptyFieldDiscovery.sunmi.reporter),
      affectedFrom: textValue(sunmi.affectedFrom),
      affectedTo: textValue(sunmi.affectedTo),
      siiVerification: enumValue(sunmi.siiVerification, siiState, emptyFieldDiscovery.sunmi.siiVerification),
      suspectedScope: enumValue(sunmi.suspectedScope, fiscalScope, emptyFieldDiscovery.sunmi.suspectedScope),
      systemReference: textValue(sunmi.systemReference),
      errorText: textValue(sunmi.errorText),
      evidenceNote: textValue(sunmi.evidenceNote),
    },
    commercial: {
      sunmiArrangement: enumValue(
        commercial.sunmiArrangement,
        sunmiArrangement,
        emptyFieldDiscovery.commercial.sunmiArrangement,
      ),
      fixedMonthlyCost: moneyValue(commercial.fixedMonthlyCost),
      cardAcquirer: textValue(commercial.cardAcquirer),
      cardFeePercent: percentValue(commercial.cardFeePercent),
      monthlyCardSales: moneyValue(commercial.monthlyCardSales),
      evidenceNote: textValue(commercial.evidenceNote),
    },
    scale: {
      principalWorkflowObserved: enumValue(
        scale.principalWorkflowObserved,
        triState,
        emptyFieldDiscovery.scale.principalWorkflowObserved,
      ),
      secondaryPropagation: enumValue(
        scale.secondaryPropagation,
        triState,
        emptyFieldDiscovery.scale.secondaryPropagation,
      ),
      propagationDelay: textValue(scale.propagationDelay),
      managementSystemIdentified: enumValue(
        scale.managementSystemIdentified,
        triState,
        emptyFieldDiscovery.scale.managementSystemIdentified,
      ),
      managementSystemReference: textValue(scale.managementSystemReference),
      pluExportAvailable: enumValue(
        scale.pluExportAvailable,
        triState,
        emptyFieldDiscovery.scale.pluExportAvailable,
      ),
      backupAvailable: enumValue(
        scale.backupAvailable,
        triState,
        emptyFieldDiscovery.scale.backupAvailable,
      ),
      notes: textValue(scale.notes),
    },
  }
}

export function sanitizeModernizationForBackup(
  input: unknown,
): ModernizationInputs {
  const root = objectValue(input)
  return {
    currentFixedMonthly: moneyValue(root.currentFixedMonthly),
    currentCardFeePercent: percentValue(root.currentCardFeePercent),
    monthlyCardSales: moneyValue(root.monthlyCardSales),
    proposedFixedMonthly: moneyValue(root.proposedFixedMonthly),
    proposedCardFeePercent: percentValue(root.proposedCardFeePercent),
    pointDeviceCost: moneyValue(root.pointDeviceCost),
    showcaseTvCost: moneyValue(root.showcaseTvCost),
    miniPcCost: moneyValue(root.miniPcCost),
    currentSourceNote: textValue(root.currentSourceNote),
    proposedSourceNote: textValue(root.proposedSourceNote),
  }
}

function parseStoredObject(
  storage: StorageReaderWriter,
  key: string,
): unknown {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Estado local inválido en ${key}`)
  }
}

function scanBackupModule(value: unknown, path = 'module', depth = 0): void {
  if (depth > 20) throw new Error('El respaldo tiene una profundidad inválida')

  if (typeof value === 'string') {
    if (
      obviousSecretPatterns.some((pattern) => pattern.test(value))
      || containsLikelyCardNumber(value, path)
    ) {
      throw new Error(`Posible dato sensible en ${path}`)
    }
    return
  }

  if (
    value === null
    || value === undefined
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return
  }

  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error('El respaldo contiene una lista demasiado grande')
    value.forEach((child, index) => scanBackupModule(child, `${path}[${index}]`, depth + 1))
    return
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (forbiddenSensitiveKey(key)) {
        throw new Error(`Campo sensible no permitido en respaldo: ${path}.${key}`)
      }
      scanBackupModule(child, `${path}.${key}`, depth + 1)
    }
    return
  }

  throw new Error(`Valor no compatible en respaldo: ${path}`)
}

function sanitizeModule(
  moduleName: PilotBackupModuleName,
  input: unknown,
): PilotBackupModules[PilotBackupModuleName] {
  if (moduleName === 'fieldDiscovery') {
    return sanitizeFieldDiscoveryForBackup(input)
  }
  if (moduleName === 'modernizationProposal') {
    return sanitizeModernizationForBackup(input)
  }
  if (moduleName === 'productionGate') {
    return sanitizeManualGateEvidence(
      objectValue(input) as Partial<ManualGateEvidence>,
    )
  }
  if (moduleName === 'migrationRunbook') {
    return sanitizeMigrationRunbook(
      objectValue(input) as Partial<MigrationRunbookState>,
    )
  }
  if (moduleName === 'evidenceLedger') {
    return sanitizeEvidenceLedger(
      objectValue(input) as Partial<EvidenceLedgerState>,
    )
  }
  return sanitizeEvidenceCaseState(
    objectValue(input) as Partial<EvidenceCaseState>,
  )
}

export function collectPilotBackupModules(
  storage: StorageReaderWriter,
): PilotBackupModules {
  const rawDiscovery = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.fieldDiscovery,
  )
  const rawProposal = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.modernizationProposal,
  )
  const rawGate = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.productionGate,
  )
  const rawRunbook = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.migrationRunbook,
  )
  const rawLedger = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.evidenceLedger,
  )
  const rawCases = parseStoredObject(
    storage,
    PILOT_BACKUP_STORAGE_KEYS.evidenceCases,
  )

  const modules: PilotBackupModules = {
    fieldDiscovery: rawDiscovery
      ? sanitizeFieldDiscoveryForBackup(rawDiscovery)
      : emptyFieldDiscovery,
    modernizationProposal: rawProposal
      ? sanitizeModernizationForBackup(rawProposal)
      : emptyModernizationInputs,
    productionGate: rawGate
      ? sanitizeManualGateEvidence(objectValue(rawGate) as Partial<ManualGateEvidence>)
      : emptyManualGateEvidence,
    migrationRunbook: rawRunbook
      ? sanitizeMigrationRunbook(objectValue(rawRunbook) as Partial<MigrationRunbookState>)
      : createEmptyMigrationRunbook(),
    evidenceLedger: rawLedger
      ? sanitizeEvidenceLedger(objectValue(rawLedger) as Partial<EvidenceLedgerState>)
      : emptyEvidenceLedger,
    evidenceCases: rawCases
      ? sanitizeEvidenceCaseState(objectValue(rawCases) as Partial<EvidenceCaseState>)
      : emptyEvidenceCaseState,
  }

  for (const moduleName of PILOT_BACKUP_MODULES) {
    scanBackupModule(modules[moduleName], moduleName)
  }

  return modules
}

function sanitizeEvidenceReferences(
  value: unknown,
): PilotBackupEvidenceReference[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    const item = objectValue(candidate)
    if (
      typeof item.fileName !== 'string'
      || !item.fileName.startsWith('evidence-')
      || typeof item.contentType !== 'string'
      || typeof item.size !== 'number'
      || !Number.isFinite(item.size)
      || item.size < 0
      || typeof item.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(item.sha256)
      || typeof item.uploadedAt !== 'string'
      || Number.isNaN(Date.parse(item.uploadedAt))
    ) {
      return []
    }

    return [{
      fileName: item.fileName,
      contentType: item.contentType,
      size: item.size,
      sha256: item.sha256,
      uploadedAt: item.uploadedAt,
      caseId: typeof item.caseId === 'string' ? item.caseId : null,
      entryId: typeof item.entryId === 'string' ? item.entryId : null,
    }]
  }).slice(0, 5000)
}

export function sanitizePilotBackupBundle(
  input: unknown,
  expectedStoreId: string,
): PilotBackupBundle {
  const wrapper = objectValue(input)
  const candidate = wrapper.bundle && typeof wrapper.bundle === 'object'
    ? objectValue(wrapper.bundle)
    : wrapper

  if (candidate.format !== PILOT_BACKUP_FORMAT) {
    throw new Error('Formato de respaldo ORBI no compatible')
  }
  if (candidate.storeId !== expectedStoreId) {
    throw new Error('El respaldo pertenece a otra tienda')
  }
  if (
    typeof candidate.createdAt !== 'string'
    || Number.isNaN(Date.parse(candidate.createdAt))
  ) {
    throw new Error('Fecha de respaldo inválida')
  }

  const source: PilotBackupSource =
    candidate.source === 'manual'
    || candidate.source === 'pre-restore'
    || candidate.source === 'portable-import'
      ? candidate.source
      : 'portable-import'

  if (
    typeof candidate.label !== 'string'
    || candidate.label.trim().length < 2
    || candidate.label.length > 120
  ) {
    throw new Error('Etiqueta de respaldo inválida')
  }
  scanBackupModule(candidate.label, 'label')

  const rawModules = objectValue(candidate.modules)
  const unknownModules = Object.keys(rawModules).filter(
    (key) => !PILOT_BACKUP_MODULES.includes(key as PilotBackupModuleName),
  )
  if (unknownModules.length) {
    throw new Error(`Módulo de respaldo no permitido: ${unknownModules.join(', ')}`)
  }

  const modules = {} as PilotBackupModules
  for (const moduleName of PILOT_BACKUP_MODULES) {
    if (!(moduleName in rawModules)) {
      throw new Error(`El respaldo no contiene ${PILOT_BACKUP_MODULE_LABELS[moduleName]}`)
    }
    scanBackupModule(rawModules[moduleName], moduleName)
    ;(modules as Record<PilotBackupModuleName, unknown>)[moduleName] =
      sanitizeModule(moduleName, rawModules[moduleName])
  }

  const refs = objectValue(candidate.serverReferences)
  const catalog = objectValue(refs.catalog)
  const revision = typeof catalog.revision === 'number'
    && Number.isInteger(catalog.revision)
    && catalog.revision >= 0
      ? catalog.revision
      : null
  const productCount = typeof catalog.productCount === 'number'
    && Number.isInteger(catalog.productCount)
    && catalog.productCount >= 0
      ? catalog.productCount
      : null
  const updatedAt = typeof catalog.updatedAt === 'string'
    && !Number.isNaN(Date.parse(catalog.updatedAt))
      ? catalog.updatedAt
      : null

  return {
    format: PILOT_BACKUP_FORMAT,
    business: 'Carnicería El Chunchito',
    storeId: expectedStoreId,
    createdAt: candidate.createdAt,
    label: candidate.label.trim(),
    source,
    modules,
    serverReferences: {
      catalog: {
        revision,
        updatedAt,
        productCount,
      },
      evidenceAttachments: sanitizeEvidenceReferences(
        refs.evidenceAttachments,
      ),
    },
    safety: {
      containsCredentials: false,
      performsExternalActions: false,
      warning: 'Pilot control-state backup only. Review portable copies before sharing.',
    },
  }
}

export function buildPilotBackupBundle(
  storage: StorageReaderWriter,
  options: {
    storeId: string
    label: string
    source: PilotBackupSource
    serverReferences: PilotBackupServerReferences
    createdAt?: string
  },
): PilotBackupBundle {
  const label = options.label.trim()
  if (label.length < 2 || label.length > 120) {
    throw new Error('La etiqueta debe tener entre 2 y 120 caracteres')
  }
  scanBackupModule(label, 'label')

  return {
    format: PILOT_BACKUP_FORMAT,
    business: 'Carnicería El Chunchito',
    storeId: options.storeId,
    createdAt: options.createdAt ?? new Date().toISOString(),
    label,
    source: options.source,
    modules: collectPilotBackupModules(storage),
    serverReferences: options.serverReferences,
    safety: {
      containsCredentials: false,
      performsExternalActions: false,
      warning: 'Pilot control-state backup only. Does not contain payment credentials or perform external actions.',
    },
  }
}

export function restorePilotBackupModules(
  storage: StorageReaderWriter,
  bundleInput: unknown,
  expectedStoreId: string,
  selectedModules: PilotBackupModuleName[],
): PilotBackupModuleName[] {
  const bundle = sanitizePilotBackupBundle(bundleInput, expectedStoreId)
  const selected = [...new Set(selectedModules)].filter((moduleName) =>
    PILOT_BACKUP_MODULES.includes(moduleName),
  )
  if (!selected.length) throw new Error('Selecciona al menos un módulo para restaurar')

  for (const moduleName of selected) {
    storage.setItem(
      PILOT_BACKUP_STORAGE_KEYS[moduleName],
      JSON.stringify(bundle.modules[moduleName]),
    )
  }

  return selected
}
