import { useEffect, useMemo, useState } from 'react'
import { listSharedImages } from '../asset-api'
import { fetchSystemHealth, type CatalogSyncStatus, type OrbiSystemHealth } from '../catalog-sync'
import type { Product } from '../domain'

interface Props {
  status: CatalogSyncStatus
  revision: number
  lastUpdatedAt: string | null
  storeId: string
  products: Product[]
}

function statusText(status: CatalogSyncStatus) {
  if (status === 'synced') return 'Sincronizado'
  if (status === 'syncing') return 'Guardando cambios'
  if (status === 'connecting') return 'Conectando'
  if (status === 'conflict') return 'Reconciliando cambios'
  if (status === 'offline') return 'Sin conexión'
  return 'Modo local'
}

export function Diagnostics({ status, revision, lastUpdatedAt, storeId, products }: Props) {
  const [health, setHealth] = useState<OrbiSystemHealth | null>(null)
  const [assetCount, setAssetCount] = useState<number | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  const metrics = useMemo(() => ({
    active: products.filter((product) => product.active).length,
    showcase: products.filter((product) => product.active && product.showOnShowcase).length,
    images: products.filter((product) => Boolean(product.imageUrl)).length,
    mappedPlu: products.filter((product) => Boolean(product.plu)).length,
  }), [products])

  useEffect(() => {
    let stopped = false

    async function check() {
      const [healthResult, assetsResult] = await Promise.allSettled([
        fetchSystemHealth(),
        listSharedImages(),
      ])

      if (stopped) return
      setHealth(healthResult.status === 'fulfilled' ? healthResult.value : null)
      setAssetCount(assetsResult.status === 'fulfilled' ? assetsResult.value.length : null)
      setCheckedAt(new Date().toISOString())
    }

    void check()
    const timer = window.setInterval(() => { void check() }, 10000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  const lastCatalogSync = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString('es-CL')
    : 'Aún no sincronizado'

  return (
    <section className="admin-page diagnostics-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Piloto / diagnóstico</p>
          <h2>Estado del sistema</h2>
          <p>Una vista simple para comprobar el host ORBI, la TV, el catálogo y el avance de la balanza.</p>
        </div>
        <div className={`diagnostic-main-state state-${status}`}>
          <i />
          <span>{statusText(status)}</span>
        </div>
      </div>

      <div className="diagnostic-grid">
        <article className="diagnostic-card">
          <small>Servidor ORBI</small>
          <strong>{health?.ok ? 'Disponible' : 'No detectado'}</strong>
          <span>{health?.service ?? 'orbi-pos-sync'} · {health?.mode ?? 'caché local'}</span>
          <b>{health?.capabilities?.sharedImages ? 'Catálogo + imágenes compartidas' : 'Esperando servidor compartido'}</b>
        </article>

        <article className="diagnostic-card">
          <small>Catálogo compartido</small>
          <strong>Revisión {revision || '—'}</strong>
          <span>Tienda: {storeId}</span>
          <b>{lastCatalogSync}</b>
        </article>

        <article className="diagnostic-card">
          <small>Productos activos</small>
          <strong>{metrics.active}</strong>
          <span>{metrics.showcase} visibles en Showcase</span>
          <b>{metrics.images} con imagen asignada</b>
        </article>

        <article className="diagnostic-card">
          <small>Biblioteca visual</small>
          <strong>{assetCount ?? '—'}</strong>
          <span>JPG / PNG / WebP compartidos</span>
          <b>{assetCount === null ? 'Servidor de imágenes no disponible' : 'Disponible para la TV'}</b>
        </article>

        <article className="diagnostic-card">
          <small>DIGI RM-60</small>
          <strong>{metrics.mappedPlu}/{metrics.active}</strong>
          <span>PLU documentados</span>
          <b>Solo mapeo · sin escritura a balanza</b>
        </article>

        <article className="diagnostic-card">
          <small>Showcase TV</small>
          <strong>{metrics.showcase ? 'Listo para mostrar' : 'Sin contenido'}</strong>
          <span>Ruta: /showcase</span>
          <b>Rotación y recuperación automáticas</b>
        </article>
      </div>

      <div className="diagnostic-note">
        <strong>Chequeo automático cada 10 s.</strong>
        <span>
          {checkedAt ? ` Último chequeo: ${new Date(checkedAt).toLocaleTimeString('es-CL')}` : ' Iniciando chequeo…'}
        </span>
      </div>
    </section>
  )
}
