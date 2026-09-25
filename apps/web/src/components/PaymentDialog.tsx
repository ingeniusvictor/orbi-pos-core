import { useEffect, useRef, useState } from 'react'
import type { PaymentMethod } from '../domain'
import { formatCLP } from '../pos'
import {
  cancelPaymentOrder,
  createClientPaymentRequestId,
  createPaymentOrder,
  fetchPaymentOrder,
  fetchPaymentRuntime,
  mockPaymentTransition,
  type PaymentOrder,
  type PaymentRuntimeInfo,
} from '../payment-api'

interface Props {
  amount: number
  method: Extract<PaymentMethod, 'debit' | 'credit'>
  onApproved: (order: PaymentOrder) => Promise<void> | void
  onClose: () => void
}

function statusCopy(order: PaymentOrder | null) {
  if (!order) return ['Preparando cobro', 'ORBI está creando la orden de pago.']

  if (order.status === 'created') {
    return ['Orden enviada', 'Esperando que la terminal reciba el cobro.']
  }
  if (order.status === 'at_terminal') {
    return ['Esperando al cliente', 'La orden está en la terminal. Inserta, acerca o desliza la tarjeta.']
  }
  if (order.status === 'action_required') {
    return ['Revisar terminal', 'Mercado Pago requiere confirmar el resultado directamente en la Point. ORBI no cerrará la venta automáticamente.']
  }
  if (order.status === 'processed') {
    return ['Pago aprobado', 'Mercado Pago confirmó la operación. ORBI está registrando la venta en el ledger servidor.']
  }
  if (order.status === 'failed') {
    return ['Pago rechazado', 'La venta sigue abierta. Puedes reintentar o cambiar el medio de pago.']
  }
  if (order.status === 'canceled') {
    return ['Cobro cancelado', 'No se registró una venta pagada.']
  }
  if (order.status === 'expired') {
    return ['Orden expirada', 'La venta sigue abierta y puede generar un nuevo intento.']
  }
  return ['Pago reembolsado', 'La orden fue reembolsada.']
}

export function PaymentDialog({ amount, method, onApproved, onClose }: Props) {
  const requestId = useRef(createClientPaymentRequestId())
  const onApprovedRef = useRef(onApproved)
  const settlementCompleteRef = useRef(false)
  const settlementInFlightRef = useRef(false)
  const [runtime, setRuntime] = useState<PaymentRuntimeInfo | null>(null)
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [error, setError] = useState('')
  const [settlementError, setSettlementError] = useState('')
  const [working, setWorking] = useState(true)

  useEffect(() => {
    onApprovedRef.current = onApproved
  }, [onApproved])

  async function persistApprovedSale(nextOrder: PaymentOrder) {
    if (settlementCompleteRef.current || settlementInFlightRef.current) return

    settlementInFlightRef.current = true
    setWorking(true)
    setSettlementError('')

    try {
      await onApprovedRef.current(nextOrder)
      settlementCompleteRef.current = true
    } catch (reason) {
      setSettlementError((reason as Error).message)
    } finally {
      settlementInFlightRef.current = false
      setWorking(false)
    }
  }

  useEffect(() => {
    let stopped = false
    let timer: number | undefined

    async function refresh(nextOrder: PaymentOrder) {
      if (stopped) return

      if (nextOrder.status === 'processed') {
        await persistApprovedSale(nextOrder)
        return
      }

      if (['action_required', 'failed', 'canceled', 'expired', 'refunded'].includes(nextOrder.status)) {
        setWorking(false)
        return
      }

      timer = window.setTimeout(async () => {
        try {
          const latest = await fetchPaymentOrder(nextOrder.id)
          if (stopped) return
          setOrder(latest)
          await refresh(latest)
        } catch (reason) {
          if (!stopped) {
            setError((reason as Error).message)
            setWorking(false)
          }
        }
      }, 1200)
    }

    async function start() {
      setWorking(true)
      setError('')
      setSettlementError('')

      try {
        const [nextRuntime, nextOrder] = await Promise.all([
          fetchPaymentRuntime(),
          createPaymentOrder(amount, method, requestId.current),
        ])

        if (stopped) return
        setRuntime(nextRuntime)
        setOrder(nextOrder)
        setWorking(false)
        await refresh(nextOrder)
      } catch (reason) {
        if (!stopped) {
          setError((reason as Error).message)
          setWorking(false)
        }
      }
    }

    void start()

    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [amount, method])

  const [title, detail] = statusCopy(order)
  const isMock = runtime?.provider === 'mock'
  const finalFailure = Boolean(
    order && ['action_required', 'failed', 'canceled', 'expired'].includes(order.status),
  )

  async function transition(
    status: 'at_terminal' | 'action_required' | 'processed' | 'failed' | 'expired',
  ) {
    if (!order) return
    setWorking(true)
    setError('')
    setSettlementError('')

    try {
      const next = await mockPaymentTransition(order.id, status)
      setOrder(next)
      if (next.status === 'processed') {
        await persistApprovedSale(next)
      }
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      if (status !== 'processed') setWorking(false)
    }
  }

  async function cancel() {
    if (!order) return
    setWorking(true)
    try {
      setOrder(await cancelPaymentOrder(order.id))
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="modal-backdrop payment-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true">
        <div className="payment-terminal-head">
          <div className="payment-terminal-icon">▣</div>
          <div>
            <p className="eyebrow">{isMock ? 'Simulador Point Smart 2' : 'Mercado Pago Point'}</p>
            <h2>{runtime?.terminal.label ?? 'Terminal de pago'}</h2>
          </div>
          <span className={runtime?.terminal.ready ? 'terminal-ready' : 'terminal-pending'}>
            {runtime?.terminal.ready ? runtime.terminal.operatingMode : 'Pendiente'}
          </span>
        </div>

        <div className="payment-amount">
          <small>Total a cobrar</small>
          <strong>{formatCLP(amount)}</strong>
          <span>{method === 'debit' ? 'Débito' : 'Crédito'}</span>
        </div>

        <div className={`payment-status payment-status-${order?.status ?? 'starting'}`}>
          <i />
          <div>
            <h3>{error ? 'No se pudo continuar' : title}</h3>
            <p>{error || detail}</p>
          </div>
        </div>

        {settlementError && order?.status === 'processed' ? (
          <div className="payment-ledger-critical">
            <span>!</span>
            <div>
              <b>El pago ya fue procesado, pero la venta todavía no quedó confirmada en ORBI.</b>
              <p>
                No vuelvas a cobrar. Reintenta únicamente el registro de la venta.
                La solicitud es idempotente y reutiliza este mismo pago.
              </p>
              <small>{settlementError}</small>
            </div>
          </div>
        ) : null}

        {order ? (
          <div className="payment-trace">
            <span>ORBI ref.</span><b>{order.externalReference}</b>
            <span>Estado</span><b>{order.status}</b>
            <span>Terminal</span><b>{order.terminalId}</b>
          </div>
        ) : null}

        {isMock && order && !finalFailure && order.status !== 'processed' ? (
          <div className="mock-point">
            <p><b>Controles de demostración</b> — simulan lo que después responderá la Point Smart 2 real.</p>
            <div>
              {order.status === 'created' ? (
                <button type="button" onClick={() => { void transition('at_terminal') }} disabled={working}>Terminal recibió orden</button>
              ) : null}
              <button className="mock-approve" type="button" onClick={() => { void transition('processed') }} disabled={working}>✓ Aprobar pago</button>
              <button type="button" onClick={() => { void transition('action_required') }} disabled={working}>Requiere revisión</button>
              <button type="button" onClick={() => { void transition('failed') }} disabled={working}>Rechazar</button>
              <button type="button" onClick={() => { void transition('expired') }} disabled={working}>Expirar</button>
            </div>
          </div>
        ) : null}

        <div className="payment-modal-actions">
          {order?.status === 'created' ? (
            <button className="ghost" type="button" onClick={() => { void cancel() }} disabled={working}>Cancelar orden</button>
          ) : null}

          {settlementError && order?.status === 'processed' ? (
            <button
              className="primary"
              type="button"
              disabled={working}
              onClick={() => { void persistApprovedSale(order) }}
            >
              Reintentar registro de venta
            </button>
          ) : null}

          {(finalFailure || error) ? (
            <button className="primary" type="button" onClick={onClose}>Volver a la venta</button>
          ) : null}

          {working ? <span>{order?.status === 'processed' ? 'Registrando venta…' : 'Procesando…'}</span> : null}
        </div>

        <p className="payment-footnote">
          La venta ORBI solo se cierra cuando el proveedor confirma <b>processed</b>
          {' '}y el ledger servidor confirma la persistencia.
        </p>
      </section>
    </div>
  )
}
