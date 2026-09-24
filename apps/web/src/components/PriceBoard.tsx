import { useMemo, useState } from 'react'
import type { Category, PriceChange, Product } from '../domain'
import { applyPricePatches } from '../catalog-service'
import { formatCLP } from '../pos'

interface Props {
  categories: Category[]
  products: Product[]
  history: PriceChange[]
  onCommit: (products: Product[], changes: PriceChange[]) => void
}

export function PriceBoard({ categories, products, history, onCommit }: Props) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [bulkPercent, setBulkPercent] = useState('')

  const visible = useMemo(() => products.filter((product) => {
    const matchesCategory = categoryId === 'all' || product.categoryId === categoryId
    const term = query.trim().toLowerCase()
    const matchesQuery = !term || product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term) || product.plu?.toLowerCase().includes(term)
    return matchesCategory && matchesQuery && product.active
  }), [categoryId, products, query])

  const patches = visible
    .map((product) => {
      const raw = drafts[product.id]
      if (raw === undefined || raw === '') return null
      const nextPrice = Number(raw.replace(/[^0-9]/g, ''))
      return Number.isFinite(nextPrice) && nextPrice > 0 && nextPrice !== product.price
        ? { productId: product.id, nextPrice }
        : null
    })
    .filter((patch): patch is { productId: string; nextPrice: number } => patch !== null)

  function applyBulk() {
    const percent = Number(bulkPercent.replace(',', '.'))
    if (!Number.isFinite(percent) || percent === 0) return
    const nextDrafts = { ...drafts }
    visible.forEach((product) => {
      nextDrafts[product.id] = String(Math.max(10, Math.round((product.price * (1 + percent / 100)) / 10) * 10))
    })
    setDrafts(nextDrafts)
  }

  function save() {
    if (!patches.length) return
    const result = applyPricePatches(products, patches)
    onCommit(result.products, [...result.history, ...history])
    setDrafts({})
    setBulkPercent('')
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Operación diaria</p>
          <h2>Precios rápidos</h2>
          <p>Cambia uno o varios precios sin abrir la ficha completa del producto.</p>
        </div>
        <button className="primary save-prices" disabled={!patches.length} onClick={save}>
          Guardar {patches.length ? `${patches.length} cambio${patches.length === 1 ? '' : 's'}` : 'cambios'}
        </button>
      </div>

      <div className="price-toolbar">
        <input
          className="search-input"
          placeholder="Buscar por nombre, código o PLU..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <div className="bulk-control">
          <input
            inputMode="decimal"
            placeholder="+5 o -3"
            value={bulkPercent}
            onChange={(event) => setBulkPercent(event.target.value.replace(/[^0-9,+\-.]/g, ''))}
          />
          <button className="ghost" onClick={applyBulk}>Aplicar % a visibles</button>
        </div>
      </div>

      <div className="price-table">
        <div className="price-row price-head">
          <span>Código</span><span>Producto</span><span>Actual</span><span>Nuevo precio</span>
        </div>
        {visible.map((product) => {
          const draft = drafts[product.id]
          const changed = draft !== undefined && Number(draft.replace(/[^0-9]/g, '')) !== product.price
          return (
            <div className={changed ? 'price-row changed' : 'price-row'} key={product.id}>
              <strong>{product.code}</strong>
              <div>
                <b>{product.name}</b>
                <small>{product.plu ? `PLU ${product.plu}` : 'PLU pendiente'} · {product.unitType}</small>
              </div>
              <strong>{formatCLP(product.price)}<small> / {product.unitType === 'KG' ? 'kg' : product.unitType.toLowerCase()}</small></strong>
              <div className="price-editor">
                <button onClick={() => setDrafts((current) => ({ ...current, [product.id]: String(Math.max(10, (Number(current[product.id] ?? product.price) || product.price) - 100) }))}>−100</button>
                <input
                  inputMode="numeric"
                  value={draft ?? String(product.price)}
                  onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: event.target.value.replace(/[^0-9]/g, '') }))}
                />
                <button onClick={() => setDrafts((current) => ({ ...current, [product.id]: String((Number(current[product.id] ?? product.price) || product.price) + 100) }))}>+100</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="history-card">
        <h3>Últimos cambios</h3>
        {history.length ? history.slice(0, 8).map((change) => (
          <div className="history-line" key={change.id}>
            <span>{change.productName}</span>
            <span>{formatCLP(change.previousPrice)} → <b>{formatCLP(change.nextPrice)}</b></span>
            <small>{new Date(change.changedAt).toLocaleString('es-CL')}</small>
          </div>
        )) : <p className="muted">Todavía no hay cambios de precio registrados.</p>}
      </div>
    </section>
  )
}
