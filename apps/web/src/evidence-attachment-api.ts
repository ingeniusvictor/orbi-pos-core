import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export interface EvidenceAttachmentRecord {
  fileName: string
  url: string
  originalName: string
  contentType: string
  size: number
  sha256: string
  uploadedAt: string
  caseId: string | null
  entryId: string | null
}

export interface EvidenceAttachmentLink {
  caseId?: string
  entryId?: string
}

const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export function validateEvidenceFile(file: File): string | null {
  if (!EXTENSIONS[file.type]) return 'Usa JPG, PNG, WebP o PDF.'
  if (file.size <= 0) return 'El archivo está vacío.'
  if (file.size > MAX_EVIDENCE_BYTES) return 'El archivo supera el límite de 20 MB.'
  return null
}

function evidenceFileName(file: File) {
  const extension = EXTENSIONS[file.type]
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().toLowerCase()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 16)}-${Math.random().toString(36).slice(2, 16)}`
  return `evidence-${id}.${extension}`
}

export function resolveEvidenceAttachmentUrl(url: string) {
  return url.startsWith('/api/') ? orbiApi(url) : url
}

export async function uploadEvidenceAttachment(
  file: File,
  link: EvidenceAttachmentLink,
  storeId = ORBI_STORE_ID,
): Promise<EvidenceAttachmentRecord> {
  const validation = validateEvidenceFile(file)
  if (validation) throw new Error(validation)

  const fileName = evidenceFileName(file)
  const headers: Record<string, string> = {
    'content-type': file.type,
    'x-orbi-original-name': encodeURIComponent(file.name),
  }
  if (link.caseId) headers['x-orbi-case-id'] = link.caseId
  if (link.entryId) headers['x-orbi-entry-id'] = link.entryId

  const response = await fetch(
    orbiApi(
      `/api/stores/${encodeURIComponent(storeId)}/evidence/attachments/${encodeURIComponent(fileName)}`,
    ),
    {
      method: 'PUT',
      headers,
      body: file,
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo subir la evidencia (${response.status}).`)
  }

  return await response.json() as EvidenceAttachmentRecord
}

export async function listEvidenceAttachments(
  storeId = ORBI_STORE_ID,
): Promise<EvidenceAttachmentRecord[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/evidence/attachments`),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('No se pudo consultar la biblioteca de evidencia.')
  return await response.json() as EvidenceAttachmentRecord[]
}
