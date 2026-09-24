import { useMemo, useState } from 'react'
import type { Product } from '../domain'
import { formatCLP } from '../pos'
import { applyPluPatches, buildRm60MappingCsv } from '../scale-mapping'
import { ScaleFleetPanel } from './ScaleFleetPanel'

interface Props {
  products: Product[]
  onChange: (products: Product[]) => void
}

export function ScaleMapping({ products, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  const active = useMemo(
    () => products.filter((product) => product.active),
    [products],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return active
    return active.filter((product) =>
      product.name.toLowerCase().includes(term)
      || product.code.toLowerCase().includes(term)
      || product.plu?.toLowerCase().includes(term),
    )
  }, [active, query])

  const mapped = active.filter((product) => product.plu).length
  const pending = active.length - mapped
  const changedIds = visible.filter((product) => {
    const draft = drafts[product.id]
    return draft !== undefined && draft.trim() !== (product.plu ?? '')
  }).map((product) => product.id)

  function save() {
    const patches = changedIds.map((productId) => ({
      productId,
      plu: drafts[productId] ?? '',
    }))

    try {
      const next = applyPluPatches(products, patches)
      onChange(next)
      setDrafts({})
      setMessage('Mapeo PLU guardado en el catálogo ORBI.')
      window.setTimeout(() => setMessage(''), 2800)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  function exportCsv() {
    const csv = buildRm60MappingCsv(products)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbi-el-chunchito-rm60-plu-mapping.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">DIGI RM-60 · descubrimiento</p>
          <h2>Mapa de códigos y PLU</h2>
          <p>Relaciona el código que verá el cliente con el PLU real de la balanza. Esta pantalla todavía no escribe nada en la RM-60.</p>
        </div>
        <div className="scale-actions">
          <button className="ghost" onClick={exportCsv}>Exportar CSV</button>
          <button className="primary save-prices" disabled={!changedIds.length} onClick={save}>
            Guardar {changedIds.length ? changedIds.length : ''} {changedIds.length === 1 ? 'cambio' : 'cambios'}
          </button>
        </div>
      </div>

      <ScaleFleetPanel />

      <div className="mapping-section-heading">
        <div>
          <p className="eyebrow">Catálogo / producto</p>
          <h3>Mapa de códigos y PLU</h3>
          <p>El PLU pertenece al producto. La identidad de cada una de las cuatro balanzas se documenta por separado arriba.</p>
        </div>
      </div>

      <div className="mapping-summary">
        <div><small>Productos activos</small><strong>{active.length}</strong></div>
        <div><small>PLU identificados</small><strong>{mapped}</strong></div>
        <div><small>Pendientes</small><strong>{pending}</strong></div>
        <div className="mapping-warning"><b>Modo seguro</b><span>Solo documentación y mapeo. Sin escritura a la balanza.</span></div>
      </div>

      <div className="mapping-toolbar">
        <input
          className="search-input"
          placeholder="Buscar producto, código cliente o PLU..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mapping-table">
        <div className="mapping-row mapping-head">
          <span>Código cliente</span>
          <span>Producto ORBI</span>
          <span>Precio ORBI</span>
          <span>PLU RM-60</span>
          <span>Estado</span>
        </div>

        {visible.map((product) => {
          const draft = drafts[product.id]
          const current = draft ?? product.plu ?? ''
          const changed = draft !== undefined && draft.trim() !== (product.plu ?? '')

          return (
            <div className={changed ? 'mapping-row changed' : 'mapping-row'} key={product.id}>
              <strong className="mapping-code">{product.code}</strong>
              <div className="mapping-product">
                <b>{product.name}</b>
                <small>{product.unitType === 'KG' ? 'Venta por kilo' : product.unitType === 'UNIT' ? 'Venta por unidad' : 'Venta por pack'}</small>
              </div>
              <strong>{formatCLP(product.price)}</strong>
              <input
                className="plu-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="Pendiente"
                value={current}
                onChange={(event) => setDrafts((state) => ({
                  ...state,
                  [product.id]: event.target.value.replace(/[^0-9]/g, ''),
                }))}
              />
              <span className={current ? 'mapping-state mapped' : 'mapping-state pending'}>
                {current ? 'PLU identificado' : 'Por verificar'}
              </span>
            </div>
          )
        })}
      </div>

      {message ? <div className="mapping-message">{message}</div> : null}

      <div className="mapping-notes">
        <h3>Qué necesitamos observar en terreno</h3>
        <p>Cuando Diana o quien administre la balanza cambie un producto/precio, debemos registrar el PLU mostrado, nombre, precio y desde qué pantalla o programa lo modifican. Con eso llenamos este mapa sin intervenir el equipo.</p>
      </div>
    </section>
  )
}
