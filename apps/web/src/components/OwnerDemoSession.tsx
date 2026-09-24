import { useMemo, useState } from 'react'
import { demoProducts } from '../demo-catalog'
import {
  completeDemoReceipt,
  createDemoReference,
  demoCartTotal,
  makeDemoLine,
  transitionDemoPayment,
  type DemoCartLine,
  type DemoPaymentMethod,
  type DemoPaymentStatus,
  type DemoReceipt,
} from '../demo-session'
import type { Product } from '../domain'
import { formatCLP } from '../pos'

function unitLabel(product: Product) {
  if (product.unitType === 'KG') return 'kg'
  if (product.unitType === 'UNIT') return 'un'
  return 'pack'
}

function statusCopy(status: DemoPaymentStatus) {
  if (status === 'created') {
    return ['Orden demo creada', 'ORBI preparó el cobro, pero todavía no lo ha recibido la terminal simulada.']
  }
  if (status === 'at_terminal') {
    return ['Esperando al cliente', 'La Point Smart 2 simulada recibió la orden.']
  }
  if (status === 'processed') {
    return ['Pago demo aprobado', 'La venta demo puede cerrarse porque el estado llegó a processed.']
  }
  if (status === 'failed') {
    return ['Pago demo rechazado', 'No se genera una venta completada. El carrito permanece como demostración.']
  }
  if (status === 'canceled') {
    return ['Cobro demo cancelado', 'No se registró una venta demo aprobada.']
  }
  if (status === 'expired') {
    return ['Orden demo expirada', 'La demostración puede reiniciarse sin dejar registros.']
  }
  return ['Listo para demostrar', 'Agrega productos y elige débito o crédito.']
}

function nextStep(status: DemoPaymentStatus, cartSize: number, receipt: DemoReceipt | null) {
  if (receipt) return 5
  if (status !== 'idle') return 4
  if (cartSize) return 3
  return 1
}

export function OwnerDemoSession() {
  const [selectedProduct, setSelectedProduct] = useState<Product>(demoProducts[0])
  const [quantity, setQuantity] = useState('1,000')
  const [lines, setLines] = useState<DemoCartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<DemoPaymentMethod>('debit')
  const [paymentStatus, setPaymentStatus] = useState<DemoPaymentStatus>('idle')
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState<DemoReceipt | null>(null)
  const [message, setMessage] = useState('')

  const parsedQuantity = Number(quantity.replace(',', '.'))
  const total = useMemo(() => demoCartTotal(lines), [lines])
  const step = nextStep(paymentStatus, lines.length, receipt)
  const [statusTitle, statusDetail] = statusCopy(paymentStatus)

  function addProduct() {
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setMessage('Ingresa un peso o cantidad válida para la demostración.')
      window.setTimeout(() => setMessage(''), 2500)
      return
    }

    const line = makeDemoLine(
      selectedProduct,
      parsedQuantity,
      `demo-line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    )

    setLines((current) => [...current, line])
    setQuantity(selectedProduct.unitType === 'KG' ? '1,000' : '1')
    setMessage(`${selectedProduct.name} agregado al carrito demo.`)
    window.setTimeout(() => setMessage(''), 2200)
  }

  function createPayment() {
    if (!lines.length) return
    const ref = createDemoReference(new Date())
    setReference(ref)
    setPaymentStatus(transitionDemoPayment('idle', 'created'))
    setReceipt(null)
  }

  function transition(next: DemoPaymentStatus) {
    try {
      const status = transitionDemoPayment(paymentStatus, next)
      setPaymentStatus(status)

      if (status === 'processed') {
        setReceipt(completeDemoReceipt(
          status,
          reference,
          lines,
          paymentMethod,
        ))
      }
    } catch (error) {
      setMessage((error as Error).message)
      window.setTimeout(() => setMessage(''), 2500)
    }
  }

  function resetSession() {
    setSelectedProduct(demoProducts[0])
    setQuantity('1,000')
    setLines([])
    setPaymentMethod('debit')
    setPaymentStatus('idle')
    setReference('')
    setReceipt(null)
    setMessage('Sesión demo reiniciada. No se conservó ninguna venta.')
    window.setTimeout(() => setMessage(''), 2600)
  }

  return (
    <main className="owner-demo-session">
      <header className="owner-demo-topbar">
        <div className="owner-demo-brand">
          <span>O</span>
          <div>
            <p>ORBI POS · OWNER SESSION</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="owner-demo-actions">
          <button className="ghost" type="button" onClick={() => { window.location.href = '/piloto' }}>
            ← Volver al Hub
          </button>
          <button className="ghost" type="button" onClick={resetSession}>
            Reiniciar sesión
          </button>
        </div>
      </header>

      <section className="owner-demo-warning">
        <b>DEMO AISLADA</b>
        <span>
          No usa catálogo real, no registra ventas, no crea órdenes en el Payment Core, no mueve dinero y no emite boleta SII.
          Al salir o recargar, la sesión comienza de cero.
        </span>
      </section>

      <section className="owner-demo-progress">
        {[
          ['01', 'Producto'],
          ['02', 'Peso'],
          ['03', 'Carrito'],
          ['04', 'Point'],
          ['05', 'Resultado'],
        ].map(([number, label], index) => {
          const current = index + 1
          return (
            <div
              className={
                current < step
                  ? 'owner-demo-step done'
                  : current === step
                    ? 'owner-demo-step active'
                    : 'owner-demo-step'
              }
              key={number}
            >
              <span>{current < step ? '✓' : number}</span>
              <b>{label}</b>
            </div>
          )
        })}
      </section>

      <section className="owner-demo-layout">
        <div className="owner-demo-products">
          <div className="owner-demo-section-title">
            <div>
              <p className="eyebrow">01 · Producto + 02 · Peso</p>
              <h1>Arma una venta de ejemplo</h1>
              <p>Todos los códigos y precios de esta pantalla son exclusivamente ilustrativos.</p>
            </div>
            <span>DEMO</span>
          </div>

          <div className="owner-demo-product-grid">
            {demoProducts.map((product) => (
              <button
                className={
                  selectedProduct.id === product.id
                    ? 'owner-demo-product selected'
                    : 'owner-demo-product'
                }
                type="button"
                key={product.id}
                onClick={() => {
                  if (paymentStatus !== 'idle') return
                  setSelectedProduct(product)
                  setQuantity(product.unitType === 'KG' ? '1,000' : '1')
                }}
                disabled={paymentStatus !== 'idle'}
              >
                <span>{product.code}</span>
                <h3>{product.name}</h3>
                <strong>{formatCLP(product.price)}</strong>
                <small>/ {unitLabel(product)}</small>
              </button>
            ))}
          </div>

          <div className="owner-demo-weight">
            <div>
              <p className="eyebrow">Peso / cantidad de demostración</p>
              <h2>{selectedProduct.name}</h2>
              <span>{formatCLP(selectedProduct.price)} / {unitLabel(selectedProduct)}</span>
            </div>

            <label>
              <span>{selectedProduct.unitType === 'KG' ? 'Peso' : 'Cantidad'}</span>
              <div>
                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.,]/g, ''))}
                  inputMode="decimal"
                  disabled={paymentStatus !== 'idle'}
                />
                <b>{unitLabel(selectedProduct)}</b>
              </div>
            </label>

            <button
              className="primary"
              type="button"
              onClick={addProduct}
              disabled={paymentStatus !== 'idle'}
            >
              Agregar al carrito demo
            </button>
          </div>
        </div>

        <aside className="owner-demo-cart">
          <div className="owner-demo-cart-head">
            <div>
              <p className="eyebrow">03 · Carrito</p>
              <h2>{lines.length ? `${lines.length} línea${lines.length === 1 ? '' : 's'} demo` : 'Carrito vacío'}</h2>
            </div>
            {lines.length && paymentStatus === 'idle' ? (
              <button className="link-danger" type="button" onClick={() => setLines([])}>
                Vaciar
              </button>
            ) : null}
          </div>

          <div className="owner-demo-cart-lines">
            {lines.length ? lines.map((line) => (
              <div className="owner-demo-cart-line" key={line.id}>
                <div>
                  <strong>{line.name}</strong>
                  <span>
                    {line.quantity.toFixed(line.unitType === 'KG' ? 3 : 0).replace('.', ',')} {line.unitType === 'KG' ? 'kg' : 'un'}
                    {' '}× {formatCLP(line.unitPrice)}
                  </span>
                </div>
                <div>
                  <strong>{formatCLP(line.subtotal)}</strong>
                  {paymentStatus === 'idle' ? (
                    <button
                      type="button"
                      onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="owner-demo-cart-empty">
                <span>🛒</span>
                <b>Agrega un producto demo</b>
                <small>La venta existe solo en esta pantalla.</small>
              </div>
            )}
          </div>

          <div className="owner-demo-cart-total">
            <span>Total demo</span>
            <strong>{formatCLP(total)}</strong>
          </div>

          <div className="owner-demo-payment-method">
            <span>Forma de pago demo</span>
            <div>
              <button
                className={paymentMethod === 'debit' ? 'active' : ''}
                type="button"
                disabled={paymentStatus !== 'idle'}
                onClick={() => setPaymentMethod('debit')}
              >
                💳 Débito
              </button>
              <button
                className={paymentMethod === 'credit' ? 'active' : ''}
                type="button"
                disabled={paymentStatus !== 'idle'}
                onClick={() => setPaymentMethod('credit')}
              >
                ▣ Crédito
              </button>
            </div>
          </div>

          {paymentStatus === 'idle' ? (
            <button
              className="primary owner-demo-send-point"
              type="button"
              onClick={createPayment}
              disabled={!lines.length}
            >
              Enviar {formatCLP(total)} a Point simulada
            </button>
          ) : null}
        </aside>
      </section>

      {paymentStatus !== 'idle' ? (
        <section className="owner-demo-point">
          <div className="owner-demo-point-device">
            <div className="owner-demo-point-screen">
              <span>POINT SMART 2 · SIMULADOR LOCAL</span>
              <small>Orden</small>
              <b>{reference}</b>
              <strong>{formatCLP(total)}</strong>
              <em>{paymentMethod === 'debit' ? 'DÉBITO' : 'CRÉDITO'}</em>
            </div>
          </div>

          <div className="owner-demo-point-control">
            <p className="eyebrow">04 · Point simulada</p>
            <h2>{statusTitle}</h2>
            <p>{statusDetail}</p>

            <div className={`owner-demo-point-status status-${paymentStatus}`}>
              <i />
              <span>{paymentStatus}</span>
            </div>

            {!receipt && paymentStatus === 'created' ? (
              <div className="owner-demo-point-buttons">
                <button className="primary" type="button" onClick={() => transition('at_terminal')}>
                  Terminal recibió orden
                </button>
                <button className="ghost" type="button" onClick={() => transition('canceled')}>
                  Cancelar
                </button>
                <button className="ghost" type="button" onClick={() => transition('expired')}>
                  Expirar
                </button>
              </div>
            ) : null}

            {!receipt && paymentStatus === 'at_terminal' ? (
              <div className="owner-demo-point-buttons">
                <button className="primary owner-demo-approve" type="button" onClick={() => transition('processed')}>
                  ✓ Aprobar pago demo
                </button>
                <button className="ghost" type="button" onClick={() => transition('failed')}>
                  Rechazar
                </button>
                <button className="ghost" type="button" onClick={() => transition('canceled')}>
                  Cancelar
                </button>
                <button className="ghost" type="button" onClick={() => transition('expired')}>
                  Expirar
                </button>
              </div>
            ) : null}

            {!receipt && ['failed', 'canceled', 'expired'].includes(paymentStatus) ? (
              <button className="primary" type="button" onClick={resetSession}>
                Reiniciar demostración
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {receipt ? (
        <section className="owner-demo-result">
          <div className="owner-demo-result-mark">✓</div>
          <div className="owner-demo-result-copy">
            <p className="eyebrow">05 · Resultado</p>
            <h2>Venta demo completada</h2>
            <p>
              ORBI cerró la venta solamente después de que la Point simulada llegó a <b>processed</b>.
              Esta operación no fue persistida en ningún sistema real.
            </p>
          </div>

          <div className="owner-demo-receipt">
            <div>
              <span>Referencia</span>
              <b>{receipt.reference}</b>
            </div>
            <div>
              <span>Método</span>
              <b>{receipt.paymentMethod === 'debit' ? 'Débito' : 'Crédito'}</b>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCLP(receipt.total)}</strong>
            </div>
            <div>
              <span>Estado</span>
              <b>DEMO · PROCESSED</b>
            </div>
          </div>

          <button className="primary" type="button" onClick={resetSession}>
            Nueva demostración
          </button>
        </section>
      ) : null}

      <footer className="owner-demo-footer">
        <b>Sesión aislada ORBI</b>
        <span>Memoria temporal únicamente · sin ventas reales · sin SII · sin Mercado Pago API</span>
      </footer>

      {message ? <div className="toast">{message}</div> : null}
    </main>
  )
}
