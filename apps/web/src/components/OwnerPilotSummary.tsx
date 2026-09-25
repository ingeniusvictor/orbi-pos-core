import { useMemo } from 'react'
import type { Product } from '../domain'
import {
  emptyFieldDiscovery,
  type FieldDiscoveryRecord,
} from '../discovery-model'
import {
  emptyModernizationInputs,
  type ModernizationInputs,
} from '../proposal-model'
import { buildPilotReadiness } from '../pilot-readiness'
import { buildOwnerPilotReport } from '../owner-report'
import { formatCLP } from '../pos'

const DISCOVERY_KEY = 'orbi-pos:field-discovery'
const PROPOSAL_KEY = 'orbi-pos:modernization-proposal'

function loadDiscovery(): FieldDiscoveryRecord {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY)
    if (!raw) return emptyFieldDiscovery
    const parsed = JSON.parse(raw) as Partial<FieldDiscoveryRecord>
    return {
      sunmi: { ...emptyFieldDiscovery.sunmi, ...(parsed.sunmi ?? {}) },
      commercial: { ...emptyFieldDiscovery.commercial, ...(parsed.commercial ?? {}) },
      scale: { ...emptyFieldDiscovery.scale, ...(parsed.scale ?? {}) },
    }
  } catch {
    return emptyFieldDiscovery
  }
}

function loadProposal(): ModernizationInputs {
  try {
    const raw = localStorage.getItem(PROPOSAL_KEY)
    if (!raw) return emptyModernizationInputs
    return {
      ...emptyModernizationInputs,
      ...JSON.parse(raw),
    } as ModernizationInputs
  } catch {
    return emptyModernizationInputs
  }
}

function economicTitle(headline: ReturnType<typeof buildOwnerPilotReport>['economicHeadline']) {
  if (headline === 'lower-estimated-cost') return 'Menor costo mensual estimado'
  if (headline === 'higher-estimated-cost') return 'Mayor costo mensual estimado'
  if (headline === 'equivalent-estimated-cost') return 'Costo mensual estimado equivalente'
  return 'Comparación económica pendiente'
}

function economicDetail(headline: ReturnType<typeof buildOwnerPilotReport>['economicHeadline']) {
  if (headline === 'lower-estimated-cost') {
    return 'Con los datos ingresados, la propuesta presenta un costo mensual estimado menor. La decisión debe considerar además soporte, operación y cumplimiento tributario.'
  }
  if (headline === 'higher-estimated-cost') {
    return 'Con los datos ingresados, la propuesta presenta un costo mensual estimado mayor. La modernización tendría que justificarse por beneficios operativos distintos del ahorro.'
  }
  if (headline === 'equivalent-estimated-cost') {
    return 'Con los datos ingresados, ambas alternativas presentan costos mensuales estimados similares.'
  }
  return 'Todavía no hay suficientes datos reales para afirmar ahorro, sobrecosto o período de retorno.'
}

function readinessTone(tone: 'ready' | 'partial' | 'pending') {
  if (tone === 'ready') return 'LISTO'
  if (tone === 'partial') return 'PARCIAL'
  return 'PENDIENTE'
}

export function OwnerPilotSummary({ products }: { products: Product[] }) {
  const discovery = useMemo(loadDiscovery, [])
  const proposal = useMemo(loadProposal, [])
  const report = useMemo(
    () => buildOwnerPilotReport(products, discovery, proposal),
    [products, discovery, proposal],
  )
  const readiness = useMemo(
    () => buildPilotReadiness(products, discovery, proposal),
    [products, discovery, proposal],
  )

  return (
    <main className="owner-report-page">
      <header className="owner-report-toolbar print-hidden">
        <button className="ghost" type="button" onClick={() => { window.location.href = '/piloto' }}>
          ← Volver al Hub
        </button>
        <div>
          <button className="ghost" type="button" onClick={() => { window.location.href = '/?view=discovery' }}>
            Actualizar levantamiento
          </button>
          <button className="ghost" type="button" onClick={() => { window.location.href = '/piloto/decision' }}>
            Gate de producción
          </button>
          <button className="primary" type="button" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
        </div>
      </header>

      <section className="owner-report-cover">
        <div className="owner-report-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · PILOTO 2026</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="owner-report-cover-copy">
          <p className="eyebrow">Resumen ejecutivo del piloto</p>
          <h1>Modernizar sin reemplazar a ciegas.</h1>
          <p>
            ORBI propone conectar catálogo, precios, pantalla cliente, venta y pagos,
            manteniendo las cuatro balanzas existentes y separando claramente lo que ya
            puede demostrarse de lo que todavía debe validarse en terreno.
          </p>
        </div>

        <div className="owner-report-score">
          <article>
            <span>SOFTWARE DEMOSTRABLE</span>
            <strong>{report.demoReadyCount}/{report.demoTotal}</strong>
            <small>módulos listos o parcialmente listos para mostrar</small>
          </article>
          <article>
            <span>VALIDACIÓN DE TERRENO</span>
            <strong>{report.fieldReadyCount}/{report.fieldTotal}</strong>
            <small>hitos verificados para una decisión real</small>
          </article>
        </div>
      </section>

      <section className="owner-report-section">
        <div className="owner-report-section-head">
          <span>01</span>
          <div>
            <p className="eyebrow">Situación actual</p>
            <h2>Lo que sabemos del negocio hoy</h2>
          </div>
        </div>

        <div className="owner-report-facts">
          <article>
            <b>4 × DIGI RM-60</b>
            <p>Se mantienen como base de pesaje. Una es descrita por el personal como la principal para actualización de precios.</p>
          </article>
          <article>
            <b>SUNMI V2 + Inputsoft</b>
            <p>Es el flujo actual asociado a boletas. Existe una incidencia reportada respecto del envío/registro en SII que todavía debe caracterizarse con precisión.</p>
          </article>
          <article>
            <b>Costos actuales</b>
            <p>{report.commercialDiscoveryComplete ? 'La línea base comercial mínima ya tiene respuestas explícitas.' : 'Aún faltan datos de contrato, adquirente, comisión o volumen para cerrar la comparación.'}</p>
          </article>
          <article>
            <b>Topología RM-60</b>
            <p>{report.scaleDiscoveryComplete ? 'Las preguntas mínimas de operación de balanzas están respondidas.' : 'Todavía falta observar completamente cómo se propagan —o no— los cambios entre las cuatro balanzas.'}</p>
          </article>
        </div>
      </section>

      <section className="owner-report-section">
        <div className="owner-report-section-head">
          <span>02</span>
          <div>
            <p className="eyebrow">Arquitectura objetivo</p>
            <h2>Qué propone ORBI</h2>
          </div>
        </div>

        <div className="owner-report-architecture">
          <div><b>4 × RM-60</b><span>pesaje / PLU</span></div>
          <i>→</i>
          <div><b>ORBI</b><span>catálogo · precios · POS · Showcase</span></div>
          <i>→</i>
          <div><b>Point Smart 2</b><span>orden API · pago confirmado</span></div>
          <i>→</i>
          <div><b>SII</b><span>flujo tributario solo tras validación</span></div>
        </div>

        <div className="owner-report-boundary">
          <b>Principio del piloto:</b>
          <span>
            primero demostrar, después verificar, luego comparar y recién entonces decidir una migración real.
          </span>
        </div>
      </section>

      <section className="owner-report-section owner-report-two-column">
        <div>
          <div className="owner-report-section-head compact">
            <span>03</span>
            <div>
              <p className="eyebrow">Software</p>
              <h2>Qué puede mostrarse hoy</h2>
            </div>
          </div>

          <ul className="owner-report-status-list">
            {readiness.demoItems.map((item) => (
              <li className={`tone-${item.tone}`} key={item.id}>
                <span>{item.tone === 'ready' ? '✓' : item.tone === 'partial' ? '◐' : '○'}</span>
                <div><b>{item.label}</b><small>{item.detail}</small></div>
                <em>{readinessTone(item.tone)}</em>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="owner-report-section-head compact">
            <span>04</span>
            <div>
              <p className="eyebrow">Terreno</p>
              <h2>Qué falta validar</h2>
            </div>
          </div>

          <ul className="owner-report-status-list">
            {readiness.fieldItems.map((item) => (
              <li className={`tone-${item.tone}`} key={item.id}>
                <span>{item.tone === 'ready' ? '✓' : '○'}</span>
                <div><b>{item.label}</b><small>{item.detail}</small></div>
                <em>{readinessTone(item.tone)}</em>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="owner-report-section">
        <div className="owner-report-section-head">
          <span>05</span>
          <div>
            <p className="eyebrow">Costo / beneficio</p>
            <h2>{economicTitle(report.economicHeadline)}</h2>
          </div>
        </div>

        <div className={`owner-report-economics economic-${report.economicHeadline}`}>
          <div>
            <p>{economicDetail(report.economicHeadline)}</p>
            {report.commercialSource ? (
              <small><b>Fuente actual:</b> {report.commercialSource}</small>
            ) : (
              <small><b>Fuente actual:</b> pendiente de factura/contrato/cartola verificada.</small>
            )}
          </div>

          {report.economicHeadline !== 'pending' ? (
            <div className="owner-report-economic-grid">
              <article><span>Actual / mes</span><strong>{formatCLP(report.currentMonthlyCost ?? 0)}</strong></article>
              <article><span>Propuesta / mes</span><strong>{formatCLP(report.proposedMonthlyCost ?? 0)}</strong></article>
              <article>
                <span>{(report.monthlyDifference ?? 0) >= 0 ? 'Diferencia / mes' : 'Sobrecosto / mes'}</span>
                <strong>{formatCLP(Math.abs(report.monthlyDifference ?? 0))}</strong>
              </article>
              <article>
                <span>{(report.annualDifference ?? 0) >= 0 ? 'Diferencia / año' : 'Sobrecosto / año'}</span>
                <strong>{formatCLP(Math.abs(report.annualDifference ?? 0))}</strong>
              </article>
              <article>
                <span>Retorno estimado</span>
                <strong>{report.paybackMonths === null ? '—' : `${report.paybackMonths.toFixed(1)} meses`}</strong>
              </article>
            </div>
          ) : (
            <div className="owner-report-pending-economics">
              <strong>Sin conclusión económica todavía</strong>
              <span>Completar los datos reales en Levantamiento / Propuesta.</span>
            </div>
          )}
        </div>
      </section>

      <section className="owner-report-section">
        <div className="owner-report-section-head">
          <span>06</span>
          <div>
            <p className="eyebrow">Próximos pasos</p>
            <h2>Qué falta antes de una decisión de producción</h2>
          </div>
        </div>

        <ol className="owner-report-blockers">
          {(report.blockers.length ? report.blockers : [
            'Revisar la evidencia disponible y confirmar que no queden preguntas de levantamiento abiertas.',
          ]).slice(0, 8).map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
          <li>Diagnosticar formalmente la incidencia SUNMI/Inputsoft/SII antes de retirar o reemplazar el flujo tributario actual.</li>
          <li>Probar una Point Smart 2 real únicamente en un piloto controlado después de comparar costos y requisitos.</li>
        </ol>
      </section>

      <section className="owner-report-final">
        <div>
          <p className="eyebrow">Conclusión del piloto</p>
          <h2>La propuesta ya puede demostrarse; la migración real todavía depende de evidencia de terreno.</h2>
          <p>
            ORBI busca reducir pasos manuales y conectar sistemas, no sustituir equipos que funcionan sin una razón técnica o económica comprobada.
          </p>
        </div>
        <div className="owner-report-final-mark">
          <span>ORBI</span>
          <b>POS + Showcase</b>
        </div>
      </section>

      <footer className="owner-report-footer">
        <span>Resumen de piloto · Carnicería El Chunchito</span>
        <span>ORBI Ecosystem · Documento generado desde el estado local del piloto</span>
      </footer>
    </main>
  )
}
