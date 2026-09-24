import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../domain'

interface Props {
  products: Product[]
  onCommit: (products: Product[]) => void
}

export function ShowcaseManager({ products, onCommit }: Props) {
  const [draft, setDraft] = useState<Product[]>(products)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(products)
  }, [products, dirty])

  const visibleCount = useMemo(
    () => draft.filter((product) => product.active && product.showOnShowcase).length,
    [draft],
  )

  const heroCount = useMemo(
    () => draft.filter((product) => product.active && product.showOnShowcase && product.featured).length,
    [draft],
  )

  function patch(id: string, changes: Partial<Product>) {
    setDraft((current) => current.map((product) => product.id === id ? { ...product, ...changes } : product))
    setDirty(true)
  }

  function save() {
    onCommit(draft)
    setDirty(false)
  }

  function cancel() {
    setDraft(products)
    setDirty(false)
  }

  return (
    <section className="showcase-manager">
      <div className="showcase-manager-head">
        <div>
          <p className="eyebrow">Contenido TV</p>
          <h3>Qué verá el cliente</h3>
          <p>{visibleCount} productos visibles · {heroCount} destacados rotativos</p>
        </div>
        <div className="showcase-manager-actions">
          {dirty ? <button className="ghost" type="button" onClick={cancel}>Descartar</button> : null}
          <button className="primary save-prices" disabled={!dirty} type="button" onClick={save}>Guardar contenido TV</button>
        </div>
      </div>

      <div className="showcase-manager-list">
        {[...draft].sort((a, b) => a.sortOrder - b.sortOrder).map((product) => (
          <article className={product.active ? 'showcase-product-row' : 'showcase-product-row inactive'} key={product.id}>
            <div className="showcase-manager-code">COD {product.code}</div>
            <div className="showcase-manager-product">
              <strong>{product.name}</strong>
              <span>{product.categoryId} · orden {product.sortOrder}</span>
            </div>
            <label><input type="checkbox" checked={product.showOnShowcase} disabled={!product.active} onChange={(event) => patch(product.id, { showOnShowcase: event.target.checked })} /> Mostrar TV</label>
            <label><input type="checkbox" checked={product.featured} disabled={!product.active || !product.showOnShowcase} onChange={(event) => patch(product.id, { featured: event.target.checked })} /> Destacado</label>
            <input
              className="showcase-order-input"
              type="number"
              min="0"
              value={product.sortOrder}
              onChange={(event) => patch(product.id, { sortOrder: Math.max(0, Number(event.target.value) || 0) })}
              aria-label={`Orden de ${product.name}`}
            />
            <input
              className="showcase-meta-input"
              placeholder="Texto corto: Oferta / Recomendado..."
              value={product.promoText ?? ''}
              onChange={(event) => patch(product.id, { promoText: event.target.value.slice(0, 48) })}
            />
            <input
              className="showcase-meta-input image-url"
              placeholder="URL de imagen premium"
              value={product.imageUrl ?? ''}
              onChange={(event) => patch(product.id, { imageUrl: event.target.value.trim() || undefined })}
            />
          </article>
        ))}
      </div>
    </section>
  )
}
