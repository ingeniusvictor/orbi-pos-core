import { FormEvent, useState } from 'react'
import { createProductId } from '../catalog-service'
import type { Category, Product, UnitType } from '../domain'
import { formatCLP } from '../pos'
import { CatalogCsvTools } from './CatalogCsvTools'

interface Props {
  categories: Category[]
  products: Product[]
  onChange: (products: Product[]) => void
}

export function ProductAdmin({ categories, products, onChange }: Props) {
  const sellableCategories = categories.filter((category) => category.id !== 'all')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(sellableCategories[0]?.id ?? 'other')
  const [unitType, setUnitType] = useState<UnitType>('KG')
  const [plu, setPlu] = useState('')

  function create(event: FormEvent) {
    event.preventDefault()
    const parsedPrice = Number(price.replace(/[^0-9]/g, ''))
    if (!code.trim() || !name.trim() || parsedPrice <= 0) return

    const product: Product = {
      id: createProductId(code, name),
      code: code.trim(),
      plu: plu.trim() || undefined,
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
  }

  function patch(id: string, changes: Partial<Product>) {
    onChange(products.map((product) => product.id === id ? { ...product, ...changes } : product))
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Catálogo maestro</p>
          <h2>Productos</h2>
          <p>Un solo catálogo alimentará precios, Showcase y la futura relación con la balanza.</p>
        </div>
      </div>

      <form className="product-create" onSubmit={create}>
        <input placeholder="Código cliente" value={code} onChange={(e) => setCode(e.target.value)} />
        <input placeholder="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} />
        <input inputMode="numeric" placeholder="Precio" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {sellableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
          <option value="KG">Por kilo</option>
          <option value="UNIT">Unidad</option>
          <option value="PACK">Pack</option>
        </select>
        <input placeholder="PLU balanza (opcional)" value={plu} onChange={(e) => setPlu(e.target.value)} />
        <button className="primary" type="submit">Agregar producto</button>
      </form>

      <CatalogCsvTools
        products={products}
        categoryIds={sellableCategories.map((category) => category.id)}
        onImport={onChange}
      />

      <div className="admin-products">
        {products.map((product) => (
          <article className={product.active ? 'admin-product' : 'admin-product inactive'} key={product.id}>
            <div className="admin-product-code">{product.code}</div>
            <div className="admin-product-main">
              <strong>{product.name}</strong>
              <span>{formatCLP(product.price)} · {product.unitType} · {product.plu ? `PLU ${product.plu}` : 'PLU pendiente'}</span>
            </div>
            <label><input type="checkbox" checked={product.showOnShowcase} onChange={(e) => patch(product.id, { showOnShowcase: e.target.checked })} /> TV</label>
            <label><input type="checkbox" checked={product.featured} onChange={(e) => patch(product.id, { featured: e.target.checked })} /> Destacado</label>
            <button className="ghost compact" onClick={() => patch(product.id, { active: !product.active })}>
              {product.active ? 'Desactivar' : 'Activar'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
