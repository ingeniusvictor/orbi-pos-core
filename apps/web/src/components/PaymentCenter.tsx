import { useEffect, useMemo, useState } from 'react'
import { formatCLP } from '../pos'
import {
  fetchPaymentRuntime,
  fetchPaymentSaleReconciliation,
  type PaymentOrder,
  type PaymentRuntimeInfo,
  type PaymentSaleReconciliationRecord,
  type PaymentSaleReconciliationSnapshot,
} from '../payment-api'

function statusLabel(status: PaymentOrder['status']) {
  const labels: Record<PaymentOrder['status'], string> = {
    created: 'Creada',
    at_terminal: 'En terminal',
    action_required: 'Revisar terminal',
    processed: 'Aprobada',
    failed: 'Fallida',
    canceled: 'Cancelada',
    expired: 'Expirada',
    refunded: 'Reembolsada',
  }
  return labels[status]
}

function reconciliationLabel(record: PaymentSaleReconciliationRecord) {
  if (record.state === 'linked') return record.saleId ?? 'Venta enlazada'
  if (record.state === 'orphan_processed') return 'PAGO SIN VENTA'
  if (record.state === 'refunded_after_sale') return `${record.saleId ?? 'Venta'} · REEMBOLSO`
  return 'Sin venta cerrada'
}

export function PaymentCenter() {
  const [runtime, setRuntime] = useState<PaymentRuntimeInfo | null>(null)
  const [reconciliation, setReconciliation] = useState<PaymentSaleReconciliationSnapshot | null>(null)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false

    async function refresh() {
      try {
        const [nextRuntime, nextReconciliation] = await Promise.all([
          fetchPaymentRuntime(),
          fetchPaymentSaleReconciliation(),
        ])
        if (stopped) return
        setRuntime(nextRuntime)
        setReconciliation(nextReconciliation)
        setError('')
        setCheckedAt(new Date().toISOString())
      } catch (reason) {
        if (!stopped) {
          setError((reason as Error).message)
          setCheckedAt(new Date().toISOString())
        }
      }
    }

    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 3000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  const records = reconciliation?.records ?? []
  const orders = records.map((record) => record.order)

  const summary = useMemo(() => ({
    processed: orders.filter((order) => order.status === 'processed').length,
    pending: orders.filter((order) => ['created', 'at_terminal'].includes(order.status)).length,
    attention: orders.filter((order) => order.status === 'action_required').length,
    failed: orders.filter((order) => ['failed', 'canceled', 'expired'].includes(order.status)).length,
  }), [orders])

  function recover(record: PaymentSaleReconciliationRecord) {
    if (record.state !== 'orphan_processed') return
    const url = new URL(window.location.href)
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('view', 'sale')
    url.searchParams.set('recoverPayment', record.order.id)
    window.location.assign(url.toString())
  }

  return (
    <section className="admin-page payment-center-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Pagos / Point</p>
          <h2>Centro de pagos</h2>
          <p>
            OC-32 reconcilia el historial local de Payment Core con el ledger de ventas.
            Esta lectura no consulta al proveedor.
          </p>
        </div>
        <div className={runtime?.terminal.ready ? 'payment-runtime-ready' : 'payment-runtime-pending'}>
          <i />
          <span>{runtime?.terminal.ready ? 'Terminal lista' : 'Terminal pendiente'}</span>
        </div>
      </div>

      <div className="payment-runtime-grid">
        <article className="payment-runtime-card">
          <small>Proveedor</small>
          <strong>{runtime?.provider === 'mercadopago' ? 'Mercado Pago' : 'Mock Point'}</strong>
          <span>{runtime?.provider === 'mock' ? 'Simulador ORBI para desarrollo' : 'Proveedor productivo configurado en backend'}</span>
        </article>

        <article className="payment-runtime-card">
          <small>Terminal primaria</small>
          <strong>{runtime?.terminal.label ?? 'No disponible'}</strong>
          <span>ID: {runtime?.terminal.id ?? '—'}</span>
        </article>

        <article className="payment-runtime-card">
          <small>Modo</small>
          <strong>{runtime?.terminal.operatingMode ?? '—'}</strong>
          <span>{runtime?.terminal.operatingMode === 'PDV' ? 'Integrada vía API' : runtime?.provider === 'mock' ? 'Simulación local' : 'Pendiente de asociación/configuración'}</span>
        </article>

        <article className="payment-runtime-card">
          <small>Sucursal / caja</small>
          <strong>{runtime?.terminal.storeId ?? 'Pendiente'}</strong>
          <span>Caja: {runtime?.terminal.posId ?? 'Pendiente'}</span>
        </article>
      </div>

      {runtime?.provider === 'mock' ? (
        <div className="payment-demo-banner">
          <b>Modo simulación.</b>
          <span> Podemos demostrar todo el flujo ORBI → Point sin una terminal real. Ningún cobro sale a Mercado Pago.</span>
        </div>
      ) : null}

      {!runtime?.terminal.ready && runtime?.provider === 'mercadopago' ? (
        <div className="payment-demo-banner warning">
          <b>Mercado Pago seleccionado pero incompleto.</b>
          <span> Falta configurar credenciales y/o el ID real de la Point en el servidor ORBI.</span>
        </div>
      ) : null}

      {reconciliation?.summary.orphanProcessed ? (
        <div className="payment-reconciliation-critical">
          <span>!</span>
          <div>
            <b>{reconciliation.summary.orphanProcessed} pago(s) procesado(s) todavía no tienen venta ORBI.</b>
            <p>
              No vuelvas a cobrar. Usa <b>Recuperar venta</b> para reconstruir las líneas y registrar
              la venta contra el mismo pago ya aprobado.
            </p>
          </div>
        </div>
      ) : null}

      {reconciliation?.summary.refundedAfterSale ? (
        <div className="payment-reconciliation-refund">
          <span>↺</span>
          <div>
            <b>{reconciliation.summary.refundedAfterSale} venta(s) tienen un pago marcado como reembolsado.</b>
            <p>La venta histórica permanece inmutable; revisa el caso antes de un cierre operacional.</p>
          </div>
        </div>
      ) : null}

      {error ? <div className="catalog-message">{error}</div> : null}

      <div className="payment-summary-row payment-reconciliation-summary">
        <div><small>Órdenes revisadas</small><strong>{orders.length}</strong></div>
        <div><small>Ventas enlazadas</small><strong>{reconciliation?.summary.linked ?? 0}</strong></div>
        <div><small>Pago sin venta</small><strong>{reconciliation?.summary.orphanProcessed ?? 0}</strong></div>
        <div><small>Reembolso post-venta</small><strong>{reconciliation?.summary.refundedAfterSale ?? 0}</strong></div>
        <div><small>Pend./fallidas sin venta</small><strong>{reconciliation?.summary.unlinkedNonprocessed ?? 0}</strong></div>
      </div>

      <div className="payment-summary-row">
        <div><small>Aprobadas</small><strong>{summary.processed}</strong></div>
        <div><small>Pendientes</small><strong>{summary.pending}</strong></div>
        <div><small>Revisar terminal</small><strong>{summary.attention}</strong></div>
        <div><small>Fallidas/canceladas</small><strong>{summary.failed}</strong></div>
      </div>

      <div className="payment-orders payment-orders-reconciled">
        <div className="payment-order-row payment-order-head">
          <span>Referencia</span>
          <span>Fecha</span>
          <span>Monto</span>
          <span>Método</span>
          <span>Estado</span>
          <span>Venta ORBI</span>
          <span>Terminal</span>
        </div>

        {records.length ? records.map((record) => {
          const order = record.order
          return (
            <div className={`payment-order-row reconciliation-${record.state}`} key={order.id}>
              <strong>{order.externalReference}</strong>
              <span>{new Date(order.createdAt).toLocaleString('es-CL')}</span>
              <strong>{formatCLP(order.amount)}</strong>
              <span>{order.requestedMethod === 'debit' ? 'Débito' : 'Crédito'}</span>
              <span className={`payment-order-state state-${order.status}`}>{statusLabel(order.status)}</span>
              <span className="payment-sale-link">
                <b>{reconciliationLabel(record)}</b>
                {record.state === 'orphan_processed' ? (
                  <button className="primary compact" type="button" onClick={() => recover(record)}>
                    Recuperar venta
                  </button>
                ) : null}
              </span>
              <span>{order.terminalId}</span>
            </div>
          )
        }) : (
          <div className="payment-orders-empty">
            Todavía no hay órdenes Point. Genera una venta de débito o crédito para probar el flujo.
          </div>
        )}
      </div>

      <div className="diagnostic-note">
        <strong>Reconciliación local cada 3 s.</strong>
        <span>
          {checkedAt ? ` Último chequeo: ${new Date(checkedAt).toLocaleTimeString('es-CL')}` : ' Consultando…'}
          {reconciliation?.providerCallsMade === false ? ' · sin llamadas al proveedor' : ''}
        </span>
      </div>
    </section>
  )
}
