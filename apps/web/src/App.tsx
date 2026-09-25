import { useEffect, useMemo, useState } from 'react'
import { categories } from './catalog'
import { loadCatalog, loadPriceHistory, saveCatalog, savePriceHistory } from './catalog-storage'
import { PriceBoard } from './components/PriceBoard'
import { ProductAdmin } from './components/ProductAdmin'
import { Showcase } from './components/Showcase'
import { ShowcaseManager } from './components/ShowcaseManager'
import { ScaleMapping } from './components/ScaleMapping'
import { Diagnostics } from './components/Diagnostics'
import { PaymentDialog } from './components/PaymentDialog'
import { PaymentCenter } from './components/PaymentCenter'
import { ModernizationProposal } from './components/ModernizationProposal'
import { FieldDiscovery } from './components/FieldDiscovery'
import { PilotDemoHub } from './components/PilotDemoHub'
import { OwnerDemoSession } from './components/OwnerDemoSession'
import { OwnerPilotSummary } from './components/OwnerPilotSummary'
import { ProductionDecisionGate } from './components/ProductionDecisionGate'
import { ControlledMigrationRunbook } from './components/ControlledMigrationRunbook'
import { EvidenceIncidentLedger } from './components/EvidenceIncidentLedger'
import { EvidenceCaseBinder } from './components/EvidenceCaseBinder'
import type { CartLine, PaymentMethod, PriceChange, Product, Sale, SalePayment, UnitType } from './domain'
import { cartTotal, completeSale, formatCLP, lineSubtotal, makeCartLine, paymentLabel } from './pos'
import { useCatalogSync } from './use-catalog-sync'
import { resolveProductImageUrl } from './asset-api'
import { demoProducts } from './demo-catalog'

const SALES_KEY = 'orbi-pos:pilot-sales'

type AppView = 'sale' | 'prices' | 'products' | 'scale' | 'payments' | 'showcase' | 'discovery' | 'proposal' | 'diagnostics'

const appViews: AppView[] = ['sale', 'prices', 'products', 'scale', 'payments', 'showcase', 'discovery', 'proposal', 'diagnostics']

function initialAppView(): AppView {
  const requested = new URLSearchParams(window.location.search).get('view')
  return requested && appViews.includes(requested as AppView)
    ? requested as AppView
    : 'sale'
}

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

function unitLabel(unitType: UnitType) {
  if (unitType === 'KG') return 'kg'
  if (unitType === 'UNIT') return 'un'
  return 'pack'
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
  const isWeighted = product.unitType === 'KG'

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
          {product.imageUrl ? <img src={resolveProductImageUrl(product.imageUrl)} alt={product.name} /> : <span>🥩</span>}
        </div>
        <p className="eyebrow">COD {product.code} · Agregar a la venta</p>
        <h2>{product.name}</h2>
        <p className="price">{formatCLP(product.price)} <span>/ {unitLabel(product.unitType)}</span></p>

        <label className="weight-label" htmlFor="quantity">{isWeighted ? 'Peso en kg' : 'Cantidad'}</label>
        <div className="weight-control">
          <input
            id="quantity"
            autoFocus
            inputMode="decimal"
            placeholder={isWeighted ? 'Ej. 1,146' : 'Ej. 2'}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <span>{unitLabel(product.unitType)}</span>
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

function SaleView({ products, sales, setSales }: {
  products: Product[]
  sales: Sale[]
  setSales: (updater: (sales: Sale[]) => Sale[]) => void
}) {
  const [categoryId, setCategoryId] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notice, setNotice] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)

  const visibleProducts = useMemo(
    () => products.filter((product) => product.active && (categoryId === 'all' || product.categoryId === categoryId)),
    [categoryId, products],
  )

  const today = new Date().toDateString()
  const todaySales = sales.filter((sale) => new Date(sale.createdAt).toDateString() === today)
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const total = cartTotal(cart)

  function recordSale(payment?: SalePayment) {
    const sale = completeSale(cart, paymentMethod, payment)
    setSales((current) => [sale, ...current])
    setCart([])
    setPaymentOpen(false)
    setNotice(`Venta registrada · ${formatCLP(sale.total)} · ${paymentLabel(paymentMethod)}`)
    window.setTimeout(() => setNotice(''), 3200)
  }

  function checkout() {
    if (!cart.length) return

    if (paymentMethod === 'debit' || paymentMethod === 'credit') {
      setPaymentOpen(true)
      return
    }

    recordSale()
  }

  return (
    <>
      <div className="daily-ribbon">
        <div><small>Ventas hoy</small><strong>{formatCLP(todayTotal)}</strong></div>
        <span>{todaySales.length} operaciones</span>
      </div>

      <main className="workspace">
        <section className="catalog-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nueva venta</p>
              <h2>¿Qué vamos a vender?</h2>
            </div>
          </div>

          <div className="category-strip" aria-label="Categorías">
            {categories.map((category) => (
              <button
                key={category.id}
                className={categoryId === category.id ? 'category active' : 'category'}
                onClick={() => setCategoryId(category.id)}
              >
                <span>{category.icon}</span>{category.name}
              </button>
            ))}
          </div>

          {visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <button className="product-card" key={product.id} onClick={() => setSelectedProduct(product)}>
                  <div className="product-image">
                    {product.imageUrl ? <img src={resolveProductImageUrl(product.imageUrl)} alt={product.name} /> : <span>🥩</span>}
                    <b>COD {product.code}</b>
                  </div>
                  <div className="product-copy">
                    <h3>{product.name}</h3>
                    <p>{formatCLP(product.price)} <span>/ {unitLabel(product.unitType)}</span></p>
                    <small>{product.plu ? `PLU ${product.plu}` : 'Tocar para agregar'}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>📦</span><h3>Sin productos activos</h3><p>Carga productos desde la sección Productos.</p>
            </div>
          )}
        </section>

        <aside className="cart-panel">
          <div className="cart-heading">
            <div><p className="eyebrow">Venta actual</p><h2>{cart.length ? `${cart.length} línea${cart.length === 1 ? '' : 's'}` : 'Carrito vacío'}</h2></div>
            {cart.length ? <button className="link-danger" onClick={() => setCart([])}>Vaciar</button> : null}
          </div>
          <div className="cart-lines">
            {cart.length ? cart.map((line) => (
              <div className="cart-line" key={line.id}>
                <div><strong>{line.name}</strong><span>{line.quantity.toFixed(line.unitType === 'KG' ? 3 : 0).replace('.', ',')} {unitLabel(line.unitType)} × {formatCLP(line.unitPrice)}</span></div>
                <div className="line-price"><strong>{formatCLP(line.subtotal)}</strong><button onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))}>×</button></div>
              </div>
            )) : <div className="cart-empty"><div>🛒</div><strong>Empieza tocando un producto</strong><span>El subtotal aparecerá aquí.</span></div>}
          </div>
          <div className="checkout">
            <div className="total-row"><span>Total</span><strong>{formatCLP(total)}</strong></div>
            <p className="payment-title">Forma de pago</p>
            <div className="payment-grid">
              {([
                ['cash', '💵', 'Efectivo'],
                ['debit', '💳', 'Débito'],
                ['credit', '▣', 'Crédito'],
                ['transfer', '↗', 'Transferencia'],
              ] as const).map(([value, icon, label]) => (
                <button key={value} className={paymentMethod === value ? 'payment active' : 'payment'} onClick={() => setPaymentMethod(value)}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
            <button className="primary checkout-button" onClick={checkout} disabled={!cart.length}>
              {paymentMethod === 'debit' || paymentMethod === 'credit'
                ? `Cobrar con Point ${cart.length ? formatCLP(total) : ''}`
                : `Registrar cobro ${cart.length ? formatCLP(total) : ''}`}
            </button>
            {paymentMethod === 'debit' || paymentMethod === 'credit' ? (
              <small className="point-checkout-note">La venta se cerrará solo cuando Point confirme el pago.</small>
            ) : null}
          </div>
        </aside>
      </main>

      {selectedProduct ? (
        <ProductDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(product, quantity) => setCart((current) => [...current, makeCartLine(product, quantity)])}
        />
      ) : null}
      {paymentOpen && (paymentMethod === 'debit' || paymentMethod === 'credit') ? (
        <PaymentDialog
          amount={total}
          method={paymentMethod}
          onClose={() => setPaymentOpen(false)}
          onApproved={(order) => {
            recordSale({
              provider: order.provider,
              orderId: order.id,
              providerOrderId: order.providerOrderId,
              externalReference: order.externalReference,
              terminalId: order.terminalId,
            })
          }}
        />
      ) : null}
      {notice ? <div className="toast">{notice}</div> : null}
    </>
  )
}

function OperationalApp() {
  const [view, setView] = useState<AppView>(initialAppView)
  const [products, setProducts] = useState<Product[]>(loadCatalog)
  const [history, setHistory] = useState<PriceChange[]>(loadPriceHistory)
  const [sales, setSales] = useState<Sale[]>(loadSales)
  const sync = useCatalogSync({ products, setProducts, setPriceHistory: setHistory })

  useEffect(() => saveCatalog(products), [products])
  useEffect(() => savePriceHistory(history), [history])
  useEffect(() => saveSales(sales), [sales])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [view])

  if (window.location.pathname.replace(/\/$/, '').endsWith('/showcase')) {
    return (
      <Showcase
        products={products}
        syncStatus={sync.status}
        lastUpdatedAt={sync.lastUpdatedAt}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div><p className="eyebrow">ORBI POS</p><h1>El Chunchito</h1></div>
        </div>
        <nav className="main-nav">
          <button className={view === 'sale' ? 'active' : ''} onClick={() => setView('sale')}>Venta</button>
          <button className={view === 'prices' ? 'active' : ''} onClick={() => setView('prices')}>Precios</button>
          <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>Productos</button>
          <button className={view === 'scale' ? 'active' : ''} onClick={() => setView('scale')}>Balanza</button>
          <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>Pagos</button>
          <button className={view === 'showcase' ? 'active' : ''} onClick={() => setView('showcase')}>Showcase</button>
          <button className={view === 'discovery' ? 'active' : ''} onClick={() => setView('discovery')}>Levantamiento</button>
          <button className={view === 'proposal' ? 'active' : ''} onClick={() => setView('proposal')}>Propuesta</button>
          <button className="nav-pilot" onClick={() => window.open('/piloto', '_blank', 'noopener,noreferrer')}>Piloto ↗</button>
          <button className={view === 'diagnostics' ? 'active' : ''} onClick={() => setView('diagnostics')}>Estado</button>
        </nav>
        <span className={`status sync-${sync.status}`}><i /> {
          sync.status === 'synced' ? `TV sincronizada · r${sync.revision}`
            : sync.status === 'syncing' ? 'Actualizando TV...'
            : sync.status === 'offline' ? 'Sin conexión · usando caché'
            : sync.status === 'conflict' ? 'Cambio remoto detectado'
            : sync.status === 'connecting' ? 'Buscando servidor...'
            : 'Piloto local'
        }</span>
      </header>

      <div className="pilot-banner">
        {sync.status === 'local'
          ? 'Catálogo maestro local · No emite boleta SII · Sin sincronización automática con RM-60 todavía.'
          : `Catálogo compartido ${sync.storeId} · Showcase consulta cambios cada 3 s · RM-60 todavía no recibe precios automáticamente.`}
      </div>

      {view === 'sale' ? <SaleView products={products} sales={sales} setSales={setSales} /> : null}
      {view === 'prices' ? (
        <PriceBoard
          categories={categories}
          products={products}
          history={history}
          onCommit={(nextProducts, nextHistory) => { setHistory(nextHistory); void sync.publish(nextProducts) }}
        />
      ) : null}
      {view === 'products' ? <ProductAdmin categories={categories} products={products} onChange={(nextProducts) => { void sync.publish(nextProducts) }} /> : null}
      {view === 'scale' ? <ScaleMapping products={products} onChange={(nextProducts) => { void sync.publish(nextProducts) }} /> : null}
      {view === 'payments' ? <PaymentCenter /> : null}
      {view === 'discovery' ? <FieldDiscovery /> : null}
      {view === 'proposal' ? <ModernizationProposal /> : null}
      {view === 'diagnostics' ? (
        <Diagnostics
          status={sync.status}
          revision={sync.revision}
          lastUpdatedAt={sync.lastUpdatedAt}
          storeId={sync.storeId}
          products={products}
        />
      ) : null}
      {view === 'showcase' ? (
        <section className="showcase-admin-page">
          <div className="admin-heading">
            <div><p className="eyebrow">Pantalla cliente</p><h2>ORBI Showcase</h2><p>Esta vista usa exactamente los mismos precios del catálogo maestro.</p></div>
            <div className="showcase-heading-actions">
              <button className="ghost" onClick={() => window.open('/showcase-demo', '_blank', 'noopener,noreferrer')}>Abrir demo visual ↗</button>
              <button className="primary showcase-open-button" onClick={() => window.open('/showcase', '_blank', 'noopener,noreferrer')}>Abrir pantalla real ↗</button>
            </div>
          </div>
          <ShowcaseManager products={products} onCommit={(nextProducts) => { void sync.publish(nextProducts) }} />
          <Showcase products={products} preview />
        </section>
      ) : null}
    </div>
  )
}


function DemoShowcasePage() {
  return (
    <Showcase
      products={demoProducts}
      demo
      syncStatus="synced"
      lastUpdatedAt={null}
    />
  )
}

export function App() {
  const path = window.location.pathname.replace(/\/$/, '')

  if (path.endsWith('/showcase-demo')) {
    return <DemoShowcasePage />
  }

  if (path.endsWith('/modernizacion')) {
    return <ModernizationProposal presentation />
  }

  if (path.endsWith('/piloto/sesion')) {
    return <OwnerDemoSession />
  }

  if (path.endsWith('/piloto/resumen')) {
    return <OwnerPilotSummary products={loadCatalog()} />
  }

  if (path.endsWith('/piloto/decision')) {
    return <ProductionDecisionGate products={loadCatalog()} />
  }

  if (path.endsWith('/piloto/migracion')) {
    return <ControlledMigrationRunbook products={loadCatalog()} />
  }

  if (path.endsWith('/piloto/evidencia')) {
    return <EvidenceIncidentLedger />
  }

  if (path.endsWith('/piloto/expedientes')) {
    return <EvidenceCaseBinder />
  }

  if (path.endsWith('/piloto')) {
    return <PilotDemoHub products={loadCatalog()} />
  }

  return <OperationalApp />
}
