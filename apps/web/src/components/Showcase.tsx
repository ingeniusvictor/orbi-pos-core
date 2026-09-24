import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../domain'
import { formatCLP } from '../pos'
import {
  buildShowcasePages,
  DEFAULT_SHOWCASE_ROTATION_MS,
  nextShowcasePage,
} from '../showcase-engine'

function priceUnit(product: Product) {
  if (product.unitType === 'KG') return '/kg'
  if (product.unitType === 'UNIT') return '/un'
  return '/pack'
}

function ProductVisual({ product, className = '' }: { product: Product; className?: string }) {
  return (
    <div className={className}>
      {product.imageUrl
        ? <img src={product.imageUrl} alt={product.name} />
        : <span className="showcase-meat-placeholder">🥩</span>}
    </div>
  )
}

export function Showcase({ products, preview = false }: { products: Product[]; preview?: boolean }) {
  const pages = useMemo(() => buildShowcasePages(products), [products])
  const [pageIndex, setPageIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(0)
  }, [pageIndex, pages.length])

  useEffect(() => {
    if (preview || reducedMotion || pages.length <= 1) return
    const timer = window.setInterval(() => {
      setPageIndex((current) => nextShowcasePage(current, pages.length))
    }, DEFAULT_SHOWCASE_ROTATION_MS)
    return () => window.clearInterval(timer)
  }, [pages.length, preview, reducedMotion])

  const page = pages[pageIndex] ?? pages[0]

  return (
    <div className={preview ? 'showcase showcase-preview' : 'showcase'}>
      <header className="showcase-header">
        <div className="showcase-brand"><span>◉</span><b>ORBI</b> SHOWCASE</div>
        <div className="showcase-business"><small>CARNICERÍA</small><strong>EL CHUNCHITO</strong></div>
        <div className="showcase-tagline">MIRA · ELIGE · PIDE POR CÓDIGO</div>
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
                <p className="hero-helper">Indica el código al personal para una atención más rápida.</p>
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
        <span>PIDE POR EL CÓDIGO EN PANTALLA</span>
      </footer>

      {pages.length > 1 ? (
        <div className="showcase-pagination" aria-label="Páginas del Showcase">
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
