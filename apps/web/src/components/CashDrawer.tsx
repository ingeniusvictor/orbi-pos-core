import { useEffect, useState } from 'react'
import { formatCLP } from '../pos'
import {
  addCashDrawerMovement,
  closeCashDrawer,
  fetchActiveCashDrawer,
  listCashDrawerSessions,
  openCashDrawer,
  previewCashDrawer,
  type CashDrawerPreview,
  type CashDrawerSession,
} from '../cash-drawer-api'

function moneyInput(value: string) {
  const parsed = Number(value.replace(/[^0-9]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL')
}

export function CashDrawer() {
  const [active, setActive] = useState<CashDrawerSession | null>(null)
  const [preview, setPreview] = useState<CashDrawerPreview | null>(null)
  const [history, setHistory] = useState<CashDrawerSession[]>([])
  const [openingFloat, setOpeningFloat] = useState('20000')
  const [movementType, setMovementType] = useState<'paid_in' | 'paid_out'>('paid_in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [nextActive, nextHistory] = await Promise.all([
        fetchActiveCashDrawer(),
        listCashDrawerSessions(),
      ])
      setActive(nextActive)
      setHistory(nextHistory)
      setPreview(nextActive ? await previewCashDrawer(nextActive.id) : null)
      setError('')
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  async function openDrawer() {
    setWorking(true)
    try {
      await openCashDrawer(moneyInput(openingFloat))
      await refresh()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setWorking(false)
    }
  }

  async function addMovement() {
    if (!active) return
    setWorking(true)
    try {
      await addCashDrawerMovement(
        active.id,
        movementType,
        moneyInput(movementAmount),
        movementReason,
      )
      setMovementAmount('')
      setMovementReason('')
      await refresh()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setWorking(false)
    }
  }

  async function closeDrawer() {
    if (!active) return
    setWorking(true)
    try {
      await closeCashDrawer(active.id, moneyInput(countedCash))
      setCountedCash('')
      await refresh()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="cash-drawer-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">OC-34 · Arqueo físico</p>
          <h2>Caja</h2>
          <p>
            ORBI calcula el efectivo esperado desde ventas servidor y movimientos manuales.
            El efectivo físico siempre lo ingresa el operador.
          </p>
        </div>
      </div>

      <div className="cash-drawer-boundary">
        No es conciliación bancaria, cierre SII ni sensor de caja. Las ventas en efectivo realizadas sin una sesión abierta quedan fuera de este arqueo.
      </div>

      {error ? <div className="daily-close-error">{error}</div> : null}

      {!active ? (
        <div className="cash-drawer-open-card">
          <h3>Abrir nueva sesión de caja</h3>
          <label>
            Fondo inicial CLP
            <input inputMode="numeric" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
          </label>
          <button className="primary" disabled={working} onClick={() => { void openDrawer() }}>
            Abrir caja
          </button>
        </div>
      ) : preview ? (
        <>
          <div className="cash-drawer-status">
            <div><small>SESIÓN ABIERTA</small><strong>{active.businessDate}</strong></div>
            <span>{active.businessTimeZone} · abierta {formatDate(active.openedAt)}</span>
          </div>

          <div className="cash-drawer-stats">
            <article><span>FONDO INICIAL</span><strong>{formatCLP(preview.openingFloat)}</strong></article>
            <article><span>VENTAS EFECTIVO</span><strong>{formatCLP(preview.cashSales.total)}</strong><small>{preview.cashSales.count} venta(s)</small></article>
            <article><span>ENTRADAS</span><strong>{formatCLP(preview.paidInTotal)}</strong></article>
            <article><span>SALIDAS</span><strong>{formatCLP(preview.paidOutTotal)}</strong></article>
            <article className="cash-drawer-expected"><span>EFECTIVO ESPERADO</span><strong>{formatCLP(preview.expectedCash)}</strong></article>
          </div>

          <div className="cash-drawer-actions-grid">
            <div>
              <h3>Movimiento manual</h3>
              <select value={movementType} onChange={(event) => setMovementType(event.target.value as 'paid_in' | 'paid_out')}>
                <option value="paid_in">Entrada de efectivo</option>
                <option value="paid_out">Salida de efectivo</option>
              </select>
              <input inputMode="numeric" placeholder="Monto CLP" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} />
              <input placeholder="Motivo operacional" value={movementReason} onChange={(event) => setMovementReason(event.target.value)} />
              <button className="ghost" disabled={working || !movementAmount || movementReason.trim().length < 2} onClick={() => { void addMovement() }}>
                Registrar movimiento
              </button>
            </div>

            <div>
              <h3>Cerrar y conciliar</h3>
              <p>Cuenta físicamente el efectivo de la caja e ingresa ese valor.</p>
              <input inputMode="numeric" placeholder="Efectivo contado CLP" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
              <button className="primary" disabled={working || !countedCash} onClick={() => { void closeDrawer() }}>
                Cerrar sesión de caja
              </button>
            </div>
          </div>

          {active.movements.length ? (
            <div className="cash-drawer-history">
              <h3>Movimientos de la sesión</h3>
              {active.movements.map((movement) => (
                <div key={movement.id}>
                  <b>{movement.type === 'paid_in' ? 'Entrada' : 'Salida'} · {formatCLP(movement.amount)}</b>
                  <span>{movement.reason}</span>
                  <small>{formatDate(movement.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="cash-drawer-history">
        <h3>Sesiones inmutables</h3>
        {history.map((session) => (
          <div key={session.id}>
            <b>{session.businessDate} · {session.status === 'open' ? 'ABIERTA' : 'CERRADA'}</b>
            <span>
              {session.status === 'closed'
                ? `Esperado ${formatCLP(session.expectedCash ?? 0)} · contado ${formatCLP(session.countedCash ?? 0)} · variación ${formatCLP(session.variance ?? 0)}`
                : `Fondo inicial ${formatCLP(session.openingFloat)}`}
            </span>
            <small>{session.id}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
