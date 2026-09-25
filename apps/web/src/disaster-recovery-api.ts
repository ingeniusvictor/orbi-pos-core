import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export type ServerDrSource = 'manual' | 'pre-restore'

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
    format: 'orbi-pos-server-dr/v1'
    business: string
    storeId: string
    createdAt: string
    label: string
    source: ServerDrSource
    summary: {
      fileCount: number
      totalFileBytes: number
      components: string[]
    }
    files: Array<{
      path: string
      size: number
      sha256: string
      encoding: 'base64'
    }>
    safety: {
      runtimeSecretsIncluded: false
      providerCredentialsIncluded: false
      performsExternalActions: false
      warning: string
    }
  }
}

export interface ServerDrRestoreResult {
  restoredArchiveId: string
  safetyArchive: ServerDrMetadata
  restoredFiles: number
  restoredBytes: number
}

export async function listServerDrArchives(
  storeId = ORBI_STORE_ID,
): Promise<ServerDrMetadata[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives`),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('No se pudo consultar el historial de recuperación.')
  return await response.json() as ServerDrMetadata[]
}

export async function createServerDrArchive(
  label: string,
  storeId = ORBI_STORE_ID,
): Promise<ServerDrMetadata> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label }),
    },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo crear el archivo de desastre (${response.status}).`)
  }
  return await response.json() as ServerDrMetadata
}

export async function inspectServerDrArchive(
  archiveId: string,
  storeId = ORBI_STORE_ID,
): Promise<ServerDrInspection> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives/${encodeURIComponent(archiveId)}`,
    ),
    { cache: 'no-store' },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || 'No se pudo verificar el archivo de recuperación.')
  }
  return await response.json() as ServerDrInspection
}

export async function importServerDrArchive(
  file: File,
  storeId = ORBI_STORE_ID,
): Promise<ServerDrMetadata> {
  if (!file.size) throw new Error('El archivo de recuperación está vacío.')
  if (file.size > 160 * 1024 * 1024) {
    throw new Error('El archivo supera el límite comprimido de 160 MB.')
  }

  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/import`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/gzip' },
      body: file,
    },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo importar el archivo (${response.status}).`)
  }
  return await response.json() as ServerDrMetadata
}

export async function restoreServerDrArchive(
  archiveId: string,
  confirmation: string,
  storeId = ORBI_STORE_ID,
): Promise<ServerDrRestoreResult> {
  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives/${encodeURIComponent(archiveId)}/restore`,
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation }),
    },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo restaurar el servidor (${response.status}).`)
  }
  return await response.json() as ServerDrRestoreResult
}

export function serverDrDownloadUrl(
  archiveId: string,
  storeId = ORBI_STORE_ID,
) {
  return orbiApi(
    `/api/stores/${encodeURIComponent(storeId)}/disaster-recovery/archives/${encodeURIComponent(archiveId)}/download`,
  )
}
