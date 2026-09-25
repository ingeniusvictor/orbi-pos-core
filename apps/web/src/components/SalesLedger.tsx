import { useEffect, useMemo, useState } from 'react'
import type { Sale } from '../domain'
import { formatCLP, paymentLabel } from '../pos'
import { listServerSales } from '../sales-api'

const LEGACY_SALES_KEY = 'orbi-pos:pilot-sales'

function loadLegacySales(): Sale[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_SALES_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed as Sale[] : []
  } catch {
    return []
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL')
}

function downloadLegacySales(sales: Sale[]) {
  const blob = new Blob([JSON.stringify({
    format: 'orbi-pos-legacy-browser-sales/v1',
    exportedAt: new Date().toISOString(),
    warning: 'Browser-only legacy sales. Not automatically imported into the server-authoritative ledger.',
    sales,
  }, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `orbi-el-chunchito-legacy-browser-sales-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SalesLedger() {
  const [sales, setSales] = useState<Sale[]>([])
  const [legacySales] = useState<Sale[]>(loadLegacySales)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      setSales(await listServerSales())
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

  const todayKey = new Date().toDateString()
  const todaySales = useMemo(
    () => sales.filter((sale) => new Date(sale.createdAt).toDateString() === todayKey),
    [sales, todayKey],
  )
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const cardSales = sales.filter((sale) =>
    sale.paymentMethod === 'debit' || sale.paymentMethod === 'credit',
  ).length

  return (
    <section className="sales-ledger-page">
      <div className="admin-heading sales-ledger-heading">
        <div>
          <p className="eyebrow">OC-31 · Ledger servidor</p>
          <h2>Ventas completadas</h2>
          <p>
            Estas ventas provienen de <b>sales.json</b> en el servidor ORBI.
            No se pueden editar ni borrar desde la interfaz.
          </p>
        </div>
        <button className="ghost" type="button" disabled={loading} onClick={() => void refresh()}>
          Actualizar
        </button>
      </div>

      <div className="sales-ledger-stats">
        <article><span>VENTAS HOY</span><strong>{todaySales.length}</strong><small>server-authoritative</small></article>
        <article><span>TOTAL HOY</span><strong>{formatCLP(todayTotal)}</strong><small>suma de ventas persistidas</small></article>
        <article><span>VENTAS EN SERVIDOR</span><strong>{sales.length}</strong><small>últimas cargadas</small></article>
        <article><span>CON TRACE POINT</span><strong>{cardSales}</strong><small>débito/crédito</small></article>
      </div>

      {legacySales.length ? (
        <div className="legacy-sales-warning">
          <span>!</span>
          <div>
            <b>{legacySales.length} venta(s) antiguas existen solo en este navegador.</b>
            <p>
              ORBI no las mezcla automáticamente con el ledger servidor porque no podemos
              tratarlas como evidencia operativa verificada. Puedes exportarlas para revisión manual.
            </p>
          </div>
          <button className="ghost" type="button" onClick={() => downloadLegacySales(legacySales)}>
            Exportar legacy JSON
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="sales-ledger-error">
          <b>Ledger servidor no disponible</b>
          <span>{error}</span>
        </div>
      ) : null}

      {sales.length ? (
        <div className="sales-ledger-table-wrap">
          <table className="sales-ledger-table">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Fecha</th>
                <th>Medio</th>
                <th>Líneas</th>
                <th>Total</th>
                <th>Payment Core</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <b>{sale.id}</b>
                    <small>{sale.clientRequestId ?? 'sin client request id'}</small>
                  </td>
                  <td>
                    <span>{formatDate(sale.createdAt)}</span>
                    <small>{sale.recordedAt ? `registrada ${formatDate(sale.recordedAt)}` : 'legacy shape'}</small>
                  </td>
                  <td>{paymentLabel(sale.paymentMethod)}</td>
                  <td>{sale.lines.length}</td>
                  <td><strong>{formatCLP(sale.total)}</strong></td>
                  <td>
                    {sale.payment ? (
                      <div className="sales-ledger-payment">
                        <b>{sale.payment.externalReference}</b>
                        <small>{sale.payment.provider} · {sale.payment.orderId}</small>
                        <small>terminal {sale.payment.terminalId}</small>
                      </div>
                    ) : (
                      <span className="sales-ledger-manual">Sin provider</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state sales-ledger-empty">
          <span>🧾</span>
          <h3>{loading ? 'Cargando ledger…' : 'Sin ventas servidor todavía'}</h3>
          <p>Las próximas ventas cerrarán el carrito solo después de persistirse aquí.</p>
        </div>
      )}
    </section>
  )
}
