import type { Product } from './domain'

export type CatalogSyncStatus = 'connecting' | 'local' | 'synced' | 'syncing' | 'offline' | 'conflict'

export interface RemoteCatalogSnapshot {
  storeId: string
  revision: number
  updatedAt: string
  products: Product[]
}

const API_BASE = (import.meta.env.VITE_ORBI_SYNC_URL ?? '').replace(/\/$/, '')
export const ORBI_STORE_ID = import.meta.env.VITE_ORBI_STORE_ID ?? 'el-chunchito'

function api(path: string) {
  return `${API_BASE}${path}`
}

export class RemoteCatalogConflict extends Error {
  constructor(public readonly current: RemoteCatalogSnapshot) {
    super('Remote catalog revision conflict')
  }
}

export async function detectCatalogSync(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(api('/api/health'), { signal, cache: 'no-store' })
    if (!response.ok) return false
    const body = await response.json() as { service?: string }
    return body.service === 'orbi-pos-sync'
  } catch {
    return false
  }
}

export async function fetchRemoteCatalog(
  storeId = ORBI_STORE_ID,
  signal?: AbortSignal,
): Promise<RemoteCatalogSnapshot | null> {
  const response = await fetch(api(`/api/stores/${encodeURIComponent(storeId)}/catalog`), {
    signal,
    cache: 'no-store',
  })

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status}`)
  return await response.json() as RemoteCatalogSnapshot
}

export async function publishRemoteCatalog(
  products: Product[],
  baseRevision: number,
  storeId = ORBI_STORE_ID,
): Promise<RemoteCatalogSnapshot> {
  const response = await fetch(api(`/api/stores/${encodeURIComponent(storeId)}/catalog`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ products, baseRevision }),
  })

  if (response.status === 409) {
    const body = await response.json() as { current: RemoteCatalogSnapshot }
    throw new RemoteCatalogConflict(body.current)
  }
  if (!response.ok) throw new Error(`Catalog publish failed: ${response.status}`)

  return await response.json() as RemoteCatalogSnapshot
}
