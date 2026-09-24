import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export interface SharedImageAsset {
  fileName: string
  url: string
  contentType: string
  size: number
  modifiedAt: string
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function resolveProductImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('/api/')) return orbiApi(url)
  return url
}

export function validateImageFile(file: File): string | null {
  if (!EXTENSIONS[file.type]) return 'Usa una imagen JPG, PNG o WebP.'
  if (file.size <= 0) return 'La imagen está vacía.'
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen supera el límite de 12 MB.'
  return null
}

function assetFileName(file: File): string {
  const extension = EXTENSIONS[file.type]
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().toLowerCase()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
  return `${id}.${extension}`
}

export async function uploadSharedImage(
  file: File,
  storeId = ORBI_STORE_ID,
): Promise<SharedImageAsset> {
  const validation = validateImageFile(file)
  if (validation) throw new Error(validation)

  const fileName = assetFileName(file)
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/assets/${encodeURIComponent(fileName)}`),
    {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `No se pudo subir la imagen (${response.status}).`)
  }

  return await response.json() as SharedImageAsset
}

export async function listSharedImages(
  storeId = ORBI_STORE_ID,
): Promise<SharedImageAsset[]> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/assets`),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('No se pudo consultar la biblioteca de imágenes.')
  return await response.json() as SharedImageAsset[]
}
