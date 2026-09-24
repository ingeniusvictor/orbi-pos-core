import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogSyncStatus } from '../catalog-sync'
import type { Product } from '../domain'
import { resolveProductImageUrl } from '../asset-api'
import { formatCLP } from '../pos'
import {
  buildShowcasePages,
  DEFAULT_SHOWCASE_ROTATION_MS,
  nextShowcasePage,
} from '../showcase-engine'
import {
  previousShowcasePage,
  showcaseConnectionInfo,
} from '../showcase-runtime'

function priceUnit(product: Product) {
  if (product.unitType === 'KG') return '/kg'
  if (product.unitType === 'UNIT') return '/un'
  return '/pack'
}

function ProductVisual({ product, className = '' }: { product: Product; className?: string }) {
  const imageUrl = resolveProductImageUrl(product.imageUrl)

  return (
    <div className={className}>
      {imageUrl
        ? <img src={imageUrl} alt={product.name} />
        : <span className="showcase-meat-placeholder">🥩</span>}
    </div>
  )
}

interface ShowcaseProps {
  products: Product[]
  preview?: boolean
  demo?: boolean
  syncStatus?: CatalogSyncStatus
  lastUpdatedAt?: string | null
}

export function Showcase({
  products,
  preview = false,
  demo = false,
  syncStatus = 'synced',
  lastUpdatedAt = null,
}: ShowcaseProps) {
  const pages = useMemo(() => buildShowcasePages(products), [products])
  const [pageIndex, setPageIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [paused, setPaused] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(preview)
  const hideControlsTimer = useRef<number | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(0)
  }, [pageIndex, pages.length])

  useEffect(() => {
    if (preview || paused || reducedMotion || !documentVisible || pages.length <= 1) return
    const timer = window.setInterval(() => {
      setPageIndex((current) => nextShowcasePage(current, pages.length))
    }, DEFAULT_SHOWCASE_ROTATION_MS)

    return () => window.clearInterval(timer)
  }, [documentVisible, pages.length, paused, preview, reducedMotion])

  useEffect(() => {
    if (preview) {
      setControlsVisible(true)
      return
    }

    function scheduleHide() {
      setControlsVisible(true)
      if (hideControlsTimer.current !== null) window.clearTimeout(hideControlsTimer.current)
      hideControlsTimer.current = window.setTimeout(() => setControlsVisible(false), 2800)
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        setPageIndex((current) => nextShowcasePage(current, pages.length))
        scheduleHide()
      } else if (event.key === 'ArrowLeft') {
        setPageIndex((current) => previousShowcasePage(current, pages.length))
        scheduleHide()
      } else if (event.key === ' ') {
        event.preventDefault()
        setPaused((current) => !current)
        scheduleHide()
      } else if (event.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.()
        } else {
          void document.exitFullscreen?.()
        }
        scheduleHide()
      }
    }

    scheduleHide()
    window.addEventListener('pointermove', scheduleHide)
    window.addEventListener('keydown', handleKey)

    return () => {
      window.removeEventListener('pointermove', scheduleHide)
      window.removeEventListener('keydown', handleKey)
      if (hideControlsTimer.current !== null) window.clearTimeout(hideControlsTimer.current)
    }
  }, [pages.length, preview])

  const page = pages[pageIndex] ?? pages[0]
  const connection = showcaseConnectionInfo(syncStatus, lastUpdatedAt)
  const kioskIdle = !preview && !controlsVisible

  return (
    <div className={[
      'showcase',
      preview ? 'showcase-preview' : 'showcase-kiosk',
      kioskIdle ? 'kiosk-idle' : '',
      demo ? 'showcase-demo' : '',
    ].filter(Boolean).join(' ')}>
      {demo ? (
        <div className="showcase-demo-watermark">
          DEMO VISUAL · PRECIOS ILUSTRATIVOS · NO CORRESPONDEN AL CATÁLOGO REAL
        </div>
      ) : null}

      <header className="showcase-header">
        <div className="showcase-brand"><span>◉</span><b>ORBI</b> SHOWCASE</div>
        <div className="showcase-business"><small>CARNICERÍA</small><strong>EL CHUNCHITO</strong></div>
        <div className="showcase-tagline">{demo ? 'CONCEPTO DE PRESENTACIÓN · ORBI' : 'MIRA · ELIGE · PIDE POR CÓDIGO'}</div>
      </header>

      {!page ? (
        <section className="showcase-empty">
          <div>
            <span>ORBI SHOWCASE</span>
            <h1>Catálogo en preparación</h1>
            <p>Los productos aparecerán aquí cuando estén habilitados para la pantalla.</p>
          </div>
        </section>
      ) : (
        <div className="showcase-stage" key={page.id}>
          {page.type === 'hero' ? (
            <section className="showcase-hero">
              <div className="hero-copy">
                <span className="hero-kicker">{page.product.promoText || 'PRODUCTO DESTACADO'}</span>
                <div className="hero-code">PIDE <b>COD {page.product.code}</b></div>
                <h1>{page.product.name}</h1>
                <div className="hero-price">{formatCLP(page.product.price)}<small>{priceUnit(page.product)}</small></div>
                <p className="hero-helper">{demo
                  ? 'Ejemplo visual para demostrar cómo se verá el catálogo digital en la TV.'
                  : 'Indica el código al personal para una atención más rápida.'}</p>
              </div>
              <div className="hero-meat">
                <ProductVisual product={page.product} className="hero-visual" />
                <b>PRECIO<br/><small>ACTUALIZADO</small></b>
              </div>
            </section>
          ) : (
            <section className="showcase-board">
              <div className="showcase-board-heading">
                <div>
                  <span>NUESTRA SELECCIÓN</span>
                  <h1>Elige por código</h1>
                </div>
                {page.pageCount > 1 ? <b>{page.pageNumber}/{page.pageCount}</b> : null}
              </div>
              <div className={`showcase-grid grid-count-${Math.min(page.products.length, 6)}`}>
                {page.products.map((product) => (
                  <article className="showcase-card" key={product.id}>
                    <div className="showcase-card-code">COD <b>{product.code}</b></div>
                    <ProductVisual product={product} className="showcase-card-image" />
                    {product.promoText ? <span className="showcase-card-badge">{product.promoText}</span> : null}
                    <h2>{product.name}</h2>
                    <div className="showcase-card-price">{formatCLP(product.price)}<small>{priceUnit(product)}</small></div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="showcase-footer">
        <span>◉ CARNICERÍA EL CHUNCHITO</span>
        <span>🥩 CORTES Y PRODUCTOS</span>
        <span>✦ PRECIOS ACTUALIZADOS</span>
        <span>{demo ? 'DEMO · DATOS ILUSTRATIVOS' : 'PIDE POR EL CÓDIGO EN PANTALLA'}</span>
      </footer>

      {!preview && !demo && connection.shouldShow ? (
        <div className={`showcase-connection tone-${connection.tone}`}>
          <i />
          <div>
            <strong>{connection.label}</strong>
            {connection.detail ? <span>{connection.detail}</span> : null}
          </div>
        </div>
      ) : null}

      {!preview && controlsVisible ? (
        <div className="showcase-kiosk-tools">
          <button type="button" onClick={() => setPageIndex((current) => previousShowcasePage(current, pages.length))} aria-label="Anterior">‹</button>
          <button type="button" onClick={() => setPaused((current) => !current)}>{paused ? '▶' : 'Ⅱ'}</button>
          <button type="button" onClick={() => setPageIndex((current) => nextShowcasePage(current, pages.length))} aria-label="Siguiente">›</button>
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.()
              else void document.exitFullscreen?.()
            }}
            aria-label="Pantalla completa"
          >
            ⛶
          </button>
        </div>
      ) : null}

      {paused && !preview ? <div className="showcase-paused">Presentación pausada</div> : null}

      {pages.length > 1 ? (
        <div className={`showcase-pagination ${!preview && !controlsVisible ? 'controls-hidden' : ''}`} aria-label="Páginas del Showcase">
          {pages.map((candidate, index) => (
            <button
              key={candidate.id}
              className={index === pageIndex ? 'active' : ''}
              onClick={() => setPageIndex(index)}
              aria-label={`Ir a presentación ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
