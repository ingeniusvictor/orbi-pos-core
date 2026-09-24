import { FormEvent, useMemo, useState } from 'react'
import {
  createProductId,
  normalizeProductCode,
  validateProductDraft,
} from '../catalog-service'
import type { Category, Product, UnitType } from '../domain'
import { formatCLP } from '../pos'
import { CatalogCsvTools } from './CatalogCsvTools'

interface Props {
  categories: Category[]
  products: Product[]
  onChange: (products: Product[]) => void
}

interface EditDraft {
  code: string
  name: string
  categoryId: string
  unitType: UnitType
}

export function ProductAdmin({ categories, products, onChange }: Props) {
  const sellableCategories = categories.filter((category) => category.id !== 'all')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(sellableCategories[0]?.id ?? 'other')
  const [unitType, setUnitType] = useState<UnitType>('KG')
  const [plu, setPlu] = useState('')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [message, setMessage] = useState('')

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return products

    return products.filter((product) =>
      product.name.toLowerCase().includes(term)
      || product.code.toLowerCase().includes(term)
      || Boolean(product.plu?.toLowerCase().includes(term)),
    )
  }, [products, query])

  function showMessage(value: string) {
    setMessage(value)
    window.setTimeout(() => setMessage(''), 3200)
  }

  function create(event: FormEvent) {
    event.preventDefault()
    const parsedPrice = Number(price.replace(/[^0-9]/g, ''))
    const normalizedCode = normalizeProductCode(code)
    const normalizedPlu = plu.trim()

    const errors = validateProductDraft(products, {
      code: normalizedCode,
      name,
      price: parsedPrice,
      categoryId,
      unitType,
      plu: normalizedPlu || undefined,
    })

    if (errors.length) {
      showMessage(errors[0])
      return
    }

    const product: Product = {
      id: createProductId(normalizedCode, name),
      code: normalizedCode,
      plu: normalizedPlu || undefined,
      categoryId,
      name: name.trim(),
      price: parsedPrice,
      unitType,
      active: true,
      showOnShowcase: true,
      featured: products.length === 0,
      sortOrder: products.length + 1,
      priceUpdatedAt: new Date().toISOString(),
    }

    onChange([...products, product])
    setCode('')
    setName('')
    setPrice('')
    setPlu('')
    showMessage(`${product.name} agregado al catálogo.`)
  }

  function patch(id: string, changes: Partial<Product>) {
    onChange(products.map((product) => product.id === id ? { ...product, ...changes } : product))
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditDraft({
      code: product.code,
      name: product.name,
      categoryId: product.categoryId,
      unitType: product.unitType,
    })
    setMessage('')
  }

  function saveEdit(product: Product) {
    if (!editDraft) return

    const errors = validateProductDraft(products, {
      code: editDraft.code,
      name: editDraft.name,
      categoryId: editDraft.categoryId,
      price: product.price,
      unitType: editDraft.unitType,
      plu: product.plu,
    }, product.id)

    if (errors.length) {
      showMessage(errors[0])
      return
    }

    patch(product.id, {
      code: normalizeProductCode(editDraft.code),
      name: editDraft.name.trim(),
      categoryId: editDraft.categoryId,
      unitType: editDraft.unitType,
    })
    setEditingId(null)
    setEditDraft(null)
    showMessage('Datos del producto actualizados.')
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Catálogo maestro</p>
          <h2>Productos</h2>
          <p>Identidad y categorías aquí. Precios en Precios. PLU de la balanza en Balanza.</p>
        </div>
      </div>

      <form className="product-create" onSubmit={create}>
        <input
          placeholder="Código cliente"
          maxLength={12}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
        />
        <input placeholder="Nombre del producto" value={name} onChange={(event) => setName(event.target.value)} />
        <input inputMode="numeric" placeholder="Precio" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ''))} />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {sellableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={unitType} onChange={(event) => setUnitType(event.target.value as UnitType)}>
          <option value="KG">Por kilo</option>
          <option value="UNIT">Unidad</option>
          <option value="PACK">Pack</option>
        </select>
        <input
          inputMode="numeric"
          maxLength={6}
          placeholder="PLU balanza (opcional)"
          value={plu}
          onChange={(event) => setPlu(event.target.value.replace(/[^0-9]/g, ''))}
        />
        <button className="primary" type="submit">Agregar producto</button>
      </form>

      {message ? <div className="catalog-message">{message}</div> : null}

      <CatalogCsvTools
        products={products}
        categoryIds={sellableCategories.map((category) => category.id)}
        onImport={onChange}
      />

      <div className="product-admin-toolbar">
        <input
          className="search-input"
          placeholder="Buscar por producto, código o PLU..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{visibleProducts.length} de {products.length} productos</span>
      </div>

      <div className="admin-products">
        {visibleProducts.map((product) => (
          <div className="admin-product-stack" key={product.id}>
            <article className={product.active ? 'admin-product' : 'admin-product inactive'}>
              <div className="admin-product-code">{product.code}</div>
              <div className="admin-product-main">
                <strong>{product.name}</strong>
                <span>{formatCLP(product.price)} · {product.unitType} · {product.plu ? `PLU ${product.plu}` : 'PLU pendiente'}</span>
              </div>
              <label><input type="checkbox" checked={product.showOnShowcase} onChange={(event) => patch(product.id, { showOnShowcase: event.target.checked })} /> TV</label>
              <label><input type="checkbox" checked={product.featured} onChange={(event) => patch(product.id, { featured: event.target.checked })} /> Destacado</label>
              <div className="admin-product-actions">
                <button className="ghost compact" type="button" onClick={() => startEdit(product)}>Editar</button>
                <button className="ghost compact" type="button" onClick={() => patch(product.id, { active: !product.active })}>
                  {product.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </article>

            {editingId === product.id && editDraft ? (
              <div className="product-edit-panel">
                <div>
                  <label>Código cliente</label>
                  <input
                    maxLength={12}
                    value={editDraft.code}
                    onChange={(event) => setEditDraft({
                      ...editDraft,
                      code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
                    })}
                  />
                </div>
                <div>
                  <label>Nombre</label>
                  <input
                    value={editDraft.name}
                    onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                  />
                </div>
                <div>
                  <label>Categoría</label>
                  <select
                    value={editDraft.categoryId}
                    onChange={(event) => setEditDraft({ ...editDraft, categoryId: event.target.value })}
                  >
                    {sellableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Unidad</label>
                  <select
                    value={editDraft.unitType}
                    onChange={(event) => setEditDraft({ ...editDraft, unitType: event.target.value as UnitType })}
                  >
                    <option value="KG">Por kilo</option>
                    <option value="UNIT">Unidad</option>
                    <option value="PACK">Pack</option>
                  </select>
                </div>
                <div className="product-edit-actions">
                  <button className="ghost" type="button" onClick={() => { setEditingId(null); setEditDraft(null) }}>Cancelar</button>
                  <button className="primary save-prices" type="button" onClick={() => saveEdit(product)}>Guardar</button>
                </div>
                <p>
                  El precio se modifica desde <b>Precios</b>. El PLU real se documenta desde <b>Balanza</b>.
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
