import { ORBI_STORE_ID, orbiApi } from './catalog-sync'
import type {
  PilotBackupBundle,
  PilotBackupSource,
} from './pilot-backup'

export interface PilotBackupMetadata {
  id: string
  createdAt: string
  savedAt: string
  label: string
  source: PilotBackupSource
  moduleCount: number
  size: number
  sha256: string
}

export interface PilotBackupRecord extends PilotBackupMetadata {
  bundle: PilotBackupBundle
}

export async function listPilotBackups(
  storeId = ORBI_STORE_ID,
): Promise<PilotBackupMetadata[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/pilot-backups`),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('No se pudo consultar los respaldos del piloto.')
  return await response.json() as PilotBackupMetadata[]
}

export async function createPilotBackup(
  bundle: PilotBackupBundle,
  storeId = ORBI_STORE_ID,
): Promise<PilotBackupRecord> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/pilot-backups`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bundle }),
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo crear el respaldo (${response.status}).`)
  }

  return await response.json() as PilotBackupRecord
}

export async function fetchPilotBackup(
  backupId: string,
  storeId = ORBI_STORE_ID,
): Promise<PilotBackupRecord> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/pilot-backups/${encodeURIComponent(backupId)}`,
    ),
    { cache: 'no-store' },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || 'No se pudo abrir el respaldo seleccionado.')
  }

  return await response.json() as PilotBackupRecord
}
