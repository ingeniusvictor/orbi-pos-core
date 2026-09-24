import { useEffect, useMemo, useState } from 'react'
import { categories, products } from './catalog'
import type { CartLine, PaymentMethod, Product, Sale } from './domain'
import { cartTotal, completeSale, formatCLP, lineSubtotal, makeCartLine, paymentLabel } from './pos'

const SALES_KEY = 'orbi-pos:pilot-sales'

function loadSales(): Sale[] {
  try {
    return JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]
  } catch {
    return []
  }
}

function saveSales(sales: Sale[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(sales))
}

function ProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product
  onClose: () => void
  onAdd: (product: Product, quantity: number) => void
}) {
  const [quantity, setQuantity] = useState('')

  const parsed = Number(quantity.replace(',', '.'))
  const subtotal = Number.isFinite(parsed) && parsed > 0 ? lineSubtotal(product, parsed) : 0

  function submit() {
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onAdd(product, parsed)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="product-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="product-hero">
          <span>🥩</span>
        </div>
        <p className="eyebrow">Agregar a la venta</p>
        <h2>{product.name}</h2>
        <p className="price">{formatCLP(product.price)} <span>/ kg</span></p>

        <label className="weight-label" htmlFor="weight">Peso en kg</label>
        <div className="weight-control">
          <input
            id="weight"
            autoFocus
            inputMode="decimal"
            placeholder="Ej. 1,146"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <span>kg</span>
        </div>

        <div className="modal-total">
          <span>Subtotal</span>
          <strong>{formatCLP(subtotal)}</strong>
        </div>

        <button className="primary big" onClick={submit} disabled={subtotal <= 0}>
          Agregar a la venta
        </button>
      </section>
    </div>
  )
}

export function App() {
  const [categoryId, setCategoryId] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [sales, setSales] = useState<Sale[]>(loadSales)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    saveSales(sales)
  }, [sales])

  const visibleProducts = useMemo(
    () => products.filter((product) => categoryId === 'all' || product.categoryId === categoryId),
    [categoryId],
  )

  const today = new Date().toDateString()
  const todaySales = sales.filter((sale) => new Date(sale.createdAt).toDateString() === today)
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const total = cartTotal(cart)

  function addToCart(product: Product, quantity: number) {
    setCart((current) => [...current, makeCartLine(product, quantity)])
  }

  function removeLine(id: string) {
    setCart((current) => current.filter((line) => line.id !== id))
  }

  function checkout() {
    if (!cart.length) return
    const sale = completeSale(cart, paymentMethod)
    setSales((current) => [sale, ...current])
    setCart([])
    setNotice(`Venta registrada · ${formatCLP(sale.total)} · ${paymentLabel(paymentMethod)}`)
    window.setTimeout(() => setNotice(''), 3200)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div>
            <p className="eyebrow">ORBI POS</p>
            <h1>El Chunchito</h1>
          </div>
        </div>
        <div className="top-actions">
          <span className="status"><i /> Demo local</span>
          <div className="daily-mini">
            <small>Ventas hoy</small>
            <strong>{formatCLP(todayTotal)}</strong>
            <span>{todaySales.length} operaciones</span>
          </div>
        </div>
      </header>

      <div className="pilot-banner">
        Piloto de interfaz · No emite boleta SII · Los productos cargados son datos de prueba verificados del vale RM-60.
      </div>

      <main className="workspace">
        <section className="catalog-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nueva venta</p>
              <h2>¿Qué vamos a vender?</h2>
            </div>
            <button className="ghost" type="button">＋ Producto</button>
          </div>

          <div className="category-strip" aria-label="Categorías">
            {categories.map((category) => (
              <button
                key={category.id}
                className={categoryId === category.id ? 'category active' : 'category'}
                onClick={() => setCategoryId(category.id)}
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          {visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <button className="product-card" key={product.id} onClick={() => setSelectedProduct(product)}>
                  <div className="product-image">
                    <span>🥩</span>
                    {product.verifiedPilotData ? <b>Dato real piloto</b> : null}
                  </div>
                  <div className="product-copy">
                    <h3>{product.name}</h3>
                    <p>{formatCLP(product.price)} <span>/ kg</span></p>
                    <small>Tocar para pesar</small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>📦</span>
              <h3>Esta categoría está lista</h3>
              <p>Falta cargar los productos reales de El Chunchito.</p>
            </div>
          )}
        </section>

        <aside className="cart-panel">
          <div className="cart-heading">
            <div>
              <p className="eyebrow">Venta actual</p>
              <h2>{cart.length ? `${cart.length} producto${cart.length === 1 ? '' : 's'}` : 'Carrito vacío'}</h2>
            </div>
            {cart.length ? <button className="link-danger" onClick={() => setCart([])}>Vaciar</button> : null}
          </div>

          <div className="cart-lines">
            {cart.length ? cart.map((line) => (
              <div className="cart-line" key={line.id}>
                <div>
                  <strong>{line.name}</strong>
                  <span>{line.quantity.toFixed(3).replace('.', ',')} kg × {formatCLP(line.unitPrice)}</span>
                </div>
                <div className="line-price">
                  <strong>{formatCLP(line.subtotal)}</strong>
                  <button onClick={() => removeLine(line.id)} aria-label={`Quitar ${line.name}`}>×</button>
                </div>
              </div>
            )) : (
              <div className="cart-empty">
                <div>🛒</div>
                <strong>Empieza tocando un producto</strong>
                <span>El peso y subtotal aparecerán aquí.</span>
              </div>
            )}
          </div>

          <div className="checkout">
            <div className="total-row">
              <span>Total</span>
              <strong>{formatCLP(total)}</strong>
            </div>

            <p className="payment-title">Forma de pago</p>
            <div className="payment-grid">
              {([
                ['cash', '💵', 'Efectivo'],
                ['debit', '💳', 'Débito'],
                ['credit', '▣', 'Crédito'],
                ['transfer', '↗', 'Transferencia'],
              ] as const).map(([value, icon, label]) => (
                <button
                  key={value}
                  className={paymentMethod === value ? 'payment active' : 'payment'}
                  onClick={() => setPaymentMethod(value)}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <button className="primary checkout-button" onClick={checkout} disabled={!cart.length}>
              Cobrar {cart.length ? formatCLP(total) : ''}
            </button>
          </div>
        </aside>
      </main>

      {selectedProduct ? (
        <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      ) : null}

      {notice ? <div className="toast">{notice}</div> : null}
    </div>
  )
}
