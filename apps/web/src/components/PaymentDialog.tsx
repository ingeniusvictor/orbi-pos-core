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
  onApproved: (order: PaymentOrder) => void
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
  if (order.status === 'processed') {
    return ['Pago aprobado', 'Mercado Pago confirmó la operación.']
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
  const approvedRef = useRef(false)
  const [runtime, setRuntime] = useState<PaymentRuntimeInfo | null>(null)
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(true)

  useEffect(() => {
    let stopped = false
    let timer: number | undefined

    async function refresh(nextOrder: PaymentOrder) {
      if (stopped) return

      if (nextOrder.status === 'processed') {
        if (!approvedRef.current) {
          approvedRef.current = true
          onApproved(nextOrder)
        }
        return
      }

      if (['failed', 'canceled', 'expired', 'refunded'].includes(nextOrder.status)) {
        setWorking(false)
        return
      }

      timer = window.setTimeout(async () => {
        try {
          const latest = await fetchPaymentOrder(nextOrder.id)
          if (stopped) return
          setOrder(latest)
          void refresh(latest)
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

      try {
        const [nextRuntime, nextOrder] = await Promise.all([
          fetchPaymentRuntime(),
          createPaymentOrder(amount, method, requestId.current),
        ])

        if (stopped) return
        setRuntime(nextRuntime)
        setOrder(nextOrder)
        setWorking(false)
        void refresh(nextOrder)
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
  }, [amount, method, onApproved])

  const [title, detail] = statusCopy(order)
  const isMock = runtime?.provider === 'mock'
  const finalFailure = Boolean(order && ['failed', 'canceled', 'expired'].includes(order.status))

  async function transition(status: 'at_terminal' | 'processed' | 'failed' | 'expired') {
    if (!order) return
    setWorking(true)
    setError('')
    try {
      const next = await mockPaymentTransition(order.id, status)
      setOrder(next)
      if (next.status === 'processed' && !approvedRef.current) {
        approvedRef.current = true
        onApproved(next)
      }
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setWorking(false)
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
              <button type="button" onClick={() => { void transition('failed') }} disabled={working}>Rechazar</button>
              <button type="button" onClick={() => { void transition('expired') }} disabled={working}>Expirar</button>
            </div>
          </div>
        ) : null}

        <div className="payment-modal-actions">
          {order?.status === 'created' ? (
            <button className="ghost" type="button" onClick={() => { void cancel() }} disabled={working}>Cancelar orden</button>
          ) : null}
          {(finalFailure || error) ? (
            <button className="primary" type="button" onClick={onClose}>Volver a la venta</button>
          ) : null}
          {working ? <span>Procesando…</span> : null}
        </div>

        <p className="payment-footnote">
          La venta ORBI solo se cierra cuando el proveedor confirma <b>processed</b>.
        </p>
      </section>
    </div>
  )
}
