import { ORBI_STORE_ID, orbiApi } from './catalog-sync'
import type { ServerDrMetadata } from './disaster-recovery-api'

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
  format: 'orbi-pos-recovery-drill/v1'
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

export interface RecoveryDrillDashboardData {
  archives: ServerDrMetadata[]
  certifications: RecoveryDrillMetadata[]
}

export async function listRecoveryDrillCertifications(
  storeId = ORBI_STORE_ID,
): Promise<RecoveryDrillMetadata[]> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/certifications`,
    ),
    { cache: 'no-store' },
  )
  if (!response.ok) {
    throw new Error('No se pudo consultar las certificaciones de recuperación.')
  }
  return await response.json() as RecoveryDrillMetadata[]
}

export async function fetchRecoveryDrillCertification(
  certificateId: string,
  storeId = ORBI_STORE_ID,
): Promise<RecoveryDrillRecord> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/certifications/${encodeURIComponent(certificateId)}`,
    ),
    { cache: 'no-store' },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || 'No se pudo abrir la certificación seleccionada.')
  }
  return await response.json() as RecoveryDrillRecord
}

export async function runRecoveryDrill(
  archiveId: string,
  storeId = ORBI_STORE_ID,
): Promise<RecoveryDrillRecord> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives/${encodeURIComponent(archiveId)}/drill`,
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo ejecutar el simulacro (${response.status}).`)
  }

  return await response.json() as RecoveryDrillRecord
}
