import { useEffect, useMemo, useState } from 'react'
import { formatCLP } from '../pos'
import {
  createDailyClose,
  listDailyCloses,
  previewDailyClose,
  type DailyClosePaymentMethod,
  type DailyClosePreview,
  type DailyCloseRecord,
} from '../daily-close-api'

const methodLabels: Record<DailyClosePaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL')
}

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

export function DailyClose() {
  const [date, setDate] = useState('')
  const [preview, setPreview] = useState<DailyClosePreview | null>(null)
  const [history, setHistory] = useState<DailyCloseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh(nextDate?: string) {
    setLoading(true)
    try {
      const [nextPreview, nextHistory] = await Promise.all([
        previewDailyClose(nextDate || undefined),
        listDailyCloses(),
      ])
      setPreview(nextPreview)
      setDate(nextPreview.businessDate)
      setHistory(nextHistory)
      setError('')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function closeDay() {
    if (!date || creating) return
    setCreating(true)
    try {
      const record = await createDailyClose(date)
      setNotice(
        `Cierre ${record.businessDate} · revisión ${record.revision} guardada de forma inmutable.`,
      )
      window.setTimeout(() => setNotice(''), 5000)
      await refresh(date)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const dateHistory = useMemo(
    () => history.filter((record) => record.businessDate === date),
    [date, history],
  )
  const latest = dateHistory[0] ?? null
  const previewAlreadyClosed = Boolean(
    latest && preview && latest.sourceFingerprint === preview.sourceFingerprint,
  )

  return (
    <section className="daily-close-page">
      <div className="admin-heading daily-close-heading">
        <div>
          <p className="eyebrow">OC-33 · Cierre operacional</p>
          <h2>Cierre diario de ventas</h2>
          <p>
            Fotografía inmutable del ledger ORBI + Payment Core.
            No es arqueo físico, conciliación bancaria ni cierre tributario SII.
          </p>
        </div>
        <div className="daily-close-date-control">
          <label htmlFor="daily-close-date">Fecha comercial</label>
          <div>
            <input
              id="daily-close-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <button
              className="ghost"
              type="button"
              disabled={!date || loading}
              onClick={() => void refresh(date)}
            >
              Previsualizar
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="daily-close-error">{error}</div> : null}
      {notice ? <div className="daily-close-notice">{notice}</div> : null}

      {preview ? (
        <>
          <div className={`daily-close-status status-${preview.status}`}>
            <div>
              <small>ESTADO LOCAL</small>
              <strong>
                {preview.status === 'reconciled'
                  ? 'RECONCILIADO'
                  : 'REQUIERE ATENCIÓN'}
              </strong>
            </div>
            <span>
              {preview.businessDate} · {preview.businessTimeZone}
              {' · '}sin llamadas al proveedor
            </span>
          </div>

          <div className="daily-close-hero-stats">
            <article>
              <span>VENTAS</span>
              <strong>{preview.salesCount}</strong>
              <small>persistidas en sales.json</small>
            </article>
            <article>
              <span>TOTAL ORBI</span>
              <strong>{formatCLP(preview.salesTotal)}</strong>
              <small>suma del ledger servidor</small>
            </article>
            <article>
              <span>PAGOS SIN VENTA</span>
              <strong>{preview.reconciliation.orphanProcessed}</strong>
              <small>processed huérfanos</small>
            </article>
            <article>
              <span>REEMBOLSOS POST-VENTA</span>
              <strong>{preview.reconciliation.refundedAfterSale}</strong>
              <small>ventas históricas afectadas</small>
            </article>
          </div>

          <div className="daily-close-methods">
            {(Object.keys(methodLabels) as DailyClosePaymentMethod[]).map((method) => (
              <article key={method}>
                <span>{methodLabels[method]}</span>
                <strong>{formatCLP(preview.methods[method].total)}</strong>
                <small>{preview.methods[method].count} venta(s)</small>
              </article>
            ))}
          </div>

          <div className="daily-close-reconciliation">
            <div><span>Tarjetas enlazadas</span><strong>{preview.reconciliation.linkedCardSales}</strong></div>
            <div><span>Processed sin venta</span><strong>{preview.reconciliation.orphanProcessed}</strong></div>
            <div><span>Refunded tras venta</span><strong>{preview.reconciliation.refundedAfterSale}</strong></div>
            <div><span>Trace/estado incompatible</span><strong>{preview.reconciliation.cardLinkMismatches}</strong></div>
          </div>

          {preview.warnings.length ? (
            <div className="daily-close-warnings">
              <b>Antes de usar este cierre como referencia operacional:</b>
              {preview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
            </div>
          ) : (
            <div className="daily-close-ok">
              <b>Sin discrepancias locales detectadas para esta fecha.</b>
              <span>Payment Core y el ledger ORBI están reconciliados dentro del alcance del piloto.</span>
            </div>
          )}

          <div className="daily-close-boundary">
            <div>
              <b>Lo que este cierre NO demuestra</b>
              <p>
                ORBI no está contando billetes de la caja, consultando la cuenta bancaria,
                comprobando que una transferencia llegó ni realizando un cierre SII.
              </p>
            </div>
            <div>
              <b>Fingerprint de fuente</b>
              <code title={preview.sourceFingerprint}>{shortHash(preview.sourceFingerprint)}</code>
            </div>
          </div>

          <div className="daily-close-actions">
            <div>
              <b>
                {previewAlreadyClosed
                  ? `Esta fotografía ya está guardada como revisión ${latest?.revision}.`
                  : latest
                    ? `El estado cambió desde la revisión ${latest.revision}; se creará una nueva revisión.`
                    : 'Todavía no existe un cierre guardado para esta fecha.'}
              </b>
              <span>Los cierres anteriores nunca se editan ni se borran.</span>
            </div>
            <button
              className="primary"
              type="button"
              disabled={creating || loading || !date}
              onClick={() => void closeDay()}
            >
              {creating
                ? 'Guardando cierre…'
                : previewAlreadyClosed
                  ? 'Verificar / reutilizar cierre'
                  : 'Crear cierre inmutable'}
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <span>📊</span>
          <h3>{loading ? 'Calculando cierre…' : 'Sin vista previa'}</h3>
          <p>Selecciona una fecha comercial para calcular el estado ORBI.</p>
        </div>
      )}

      <div className="daily-close-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historial append-only</p>
            <h2>Revisiones guardadas</h2>
          </div>
        </div>

        {dateHistory.length ? (
          <div className="daily-close-history-list">
            {dateHistory.map((record) => (
              <article key={record.id}>
                <div>
                  <b>Revisión {record.revision}</b>
                  <span>{formatDateTime(record.createdAt)}</span>
                </div>
                <div>
                  <span>{record.salesCount} venta(s)</span>
                  <strong>{formatCLP(record.salesTotal)}</strong>
                </div>
                <div>
                  <span className={`daily-close-chip chip-${record.status}`}>
                    {record.status === 'reconciled' ? 'Reconciliado' : 'Atención'}
                  </span>
                  <code title={record.sourceFingerprint}>
                    {shortHash(record.sourceFingerprint)}
                  </code>
                </div>
                <small>
                  {record.supersedesCloseId
                    ? `Supera: ${record.supersedesCloseId}`
                    : 'Primera revisión de la fecha'}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="daily-close-history-empty">
            No hay cierres guardados para {date || 'la fecha seleccionada'}.
          </div>
        )}
      </div>
    </section>
  )
}
