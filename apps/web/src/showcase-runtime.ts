import type { CatalogSyncStatus } from './catalog-sync'

export interface ShowcaseConnectionInfo {
  tone: 'ok' | 'working' | 'warning'
  label: string
  detail?: string
  shouldShow: boolean
}

export function showcaseConnectionInfo(
  status: CatalogSyncStatus,
  lastUpdatedAt: string | null,
): ShowcaseConnectionInfo {
  const lastSync = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : null

  if (status === 'synced') {
    return { tone: 'ok', label: 'Sincronizado', shouldShow: false }
  }

  if (status === 'syncing' || status === 'connecting') {
    return {
      tone: 'working',
      label: status === 'syncing' ? 'Actualizando precios…' : 'Conectando…',
      shouldShow: true,
    }
  }

  if (status === 'conflict') {
    return {
      tone: 'warning',
      label: 'Actualizando catálogo',
      detail: lastSync ? `Última sincronización ${lastSync}` : undefined,
      shouldShow: true,
    }
  }

  return {
    tone: 'warning',
    label: status === 'local' ? 'Servidor no disponible' : 'Sin conexión',
    detail: lastSync
      ? `Mostrando última información · ${lastSync}`
      : 'Mostrando información guardada',
    shouldShow: true,
  }
}

export function previousShowcasePage(current: number, pageCount: number): number {
  if (pageCount <= 1) return 0
  return current <= 0 ? pageCount - 1 : current - 1
}
