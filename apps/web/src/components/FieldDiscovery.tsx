import { useEffect, useMemo, useState } from 'react'
import {
  buildDiscoveryExport,
  discoveryReadiness,
  emptyFieldDiscovery,
  questionPack,
  type FieldDiscoveryRecord,
  type IncidentReporter,
  type IssueFrequency,
  type SiiVerificationState,
  type SunmiArrangement,
  type SuspectedFiscalScope,
  type TriState,
} from '../discovery-model'
import { formatCLP } from '../pos'

const STORAGE_KEY = 'orbi-pos:field-discovery'

function loadDiscovery(): FieldDiscoveryRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

function numberValue(value: number | null) {
  return value === null ? '' : String(value)
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function triLabel(value: TriState) {
  if (value === 'yes') return 'Sí'
  if (value === 'no') return 'No'
  if (value === 'unknown') return 'Consultado, aún no se sabe'
  return 'Pendiente'
}

function ReadinessCard({
  title,
  answered,
  total,
  ready,
}: {
  title: string
  answered: number
  total: number
  ready: boolean
}) {
  return (
    <article className={ready ? 'discovery-readiness ready' : 'discovery-readiness pending'}>
      <span>{ready ? 'LISTO PARA DECIDIR' : 'LEVANTAMIENTO'}</span>
      <h3>{title}</h3>
      <strong>{answered}/{total}</strong>
      <div><i style={{ width: `${Math.round((answered / total) * 100)}%` }} /></div>
    </article>
  )
}

function TriSelect({
  value,
  onChange,
}: {
  value: TriState
  onChange: (value: TriState) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as TriState)}>
      <option value="pending">Pendiente</option>
      <option value="yes">Sí</option>
      <option value="no">No</option>
      <option value="unknown">Consultado, aún no se sabe</option>
    </select>
  )
}

export function FieldDiscovery() {
  const [record, setRecord] = useState<FieldDiscoveryRecord>(loadDiscovery)
  const [message, setMessage] = useState('')

  const readiness = useMemo(() => discoveryReadiness(record), [record])
  const questions = useMemo(() => questionPack(record), [record])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  }, [record])

  function patchSunmi(changes: Partial<FieldDiscoveryRecord['sunmi']>) {
    setRecord((current) => ({
      ...current,
      sunmi: { ...current.sunmi, ...changes },
    }))
  }

  function patchCommercial(changes: Partial<FieldDiscoveryRecord['commercial']>) {
    setRecord((current) => ({
      ...current,
      commercial: { ...current.commercial, ...changes },
    }))
  }

  function patchScale(changes: Partial<FieldDiscoveryRecord['scale']>) {
    setRecord((current) => ({
      ...current,
      scale: { ...current.scale, ...changes },
    }))
  }

  function exportJson() {
    const payload = buildDiscoveryExport(record, new Date().toISOString())
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbi-el-chunchito-levantamiento.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyQuestions() {
    const text = [
      'Preguntas pendientes — Carnicería El Chunchito',
      '',
      ...questions.map((question, index) => `${index + 1}. ${question}`),
      '',
      'Importante: no enviar contraseñas, claves SII, datos de tarjetas ni credenciales de APIs.',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setMessage('Preguntas pendientes copiadas. Ya puedes pegarlas en WhatsApp.')
    } catch {
      setMessage('No fue posible copiar automáticamente. Puedes revisar las preguntas al final de la pantalla.')
    }

    window.setTimeout(() => setMessage(''), 3200)
  }

  function reset() {
    setRecord(emptyFieldDiscovery)
    setMessage('Levantamiento reiniciado. Los hechos conocidos del proyecto siguen visibles como referencia.')
    window.setTimeout(() => setMessage(''), 3200)
  }

  return (
    <section className="admin-page discovery-page">
      <div className="admin-heading discovery-heading">
        <div>
          <p className="eyebrow">Terreno / Discovery</p>
          <h2>Levantamiento El Chunchito</h2>
          <p>
            Registra lo que Diana o la dueña confirmen sin cambiar todavía SII, Inputsoft, SUNMI ni las balanzas.
          </p>
        </div>

        <div className="discovery-actions">
          <button className="ghost" type="button" onClick={() => { void copyQuestions() }} disabled={!questions.length}>
            Copiar preguntas ({questions.length})
          </button>
          <button className="ghost" type="button" onClick={exportJson}>Exportar JSON</button>
          <button className="link-danger" type="button" onClick={reset}>Reiniciar</button>
        </div>
      </div>

      <div className="discovery-security">
        <b>Modo de levantamiento seguro.</b>
        <span>
          No escribas contraseñas del SII, claves de Inputsoft, Access Tokens, datos de tarjetas ni información personal de clientes.
        </span>
      </div>

      <div className="discovery-known-facts">
        <div><span>✓</span><b>4 × DIGI RM-60</b><small>Confirmado por Diana</small></div>
        <div><span>✓</span><b>RM-60 principal</b><small>Desde allí administran precios</small></div>
        <div><span>✓</span><b>SUNMI V2 + Inputsoft</b><small>Flujo actual de boletas</small></div>
        <div><span>?</span><b>Problema SII</b><small>Causa exacta aún no diagnosticada</small></div>
      </div>

      <div className="discovery-readiness-grid">
        <ReadinessCard
          title="Incidente SUNMI / SII"
          answered={readiness.fiscalAnswered}
          total={readiness.fiscalTotal}
          ready={readiness.fiscalReady}
        />
        <ReadinessCard
          title="Comparación comercial"
          answered={readiness.commercialAnswered}
          total={readiness.commercialTotal}
          ready={readiness.commercialReady}
        />
        <ReadinessCard
          title="Integración RM-60"
          answered={readiness.scaleAnswered}
          total={readiness.scaleTotal}
          ready={readiness.scaleReady}
        />
      </div>

      <div className="discovery-section">
        <header>
          <div><span>01</span><h3>SUNMI V2 · Inputsoft · SII</h3></div>
          <p>El objetivo es identificar qué falla exactamente antes de recomendar una migración tributaria.</p>
        </header>

        <div className="discovery-form-grid">
          <label>
            <span>¿La boleta se imprime cuando ocurre el problema?</span>
            <TriSelect value={record.sunmi.boletaPrints} onChange={(value) => patchSunmi({ boletaPrints: value })} />
            <small>Actual: {triLabel(record.sunmi.boletaPrints)}</small>
          </label>

          <label>
            <span>¿Aparece un error visible?</span>
            <TriSelect value={record.sunmi.errorVisible} onChange={(value) => patchSunmi({ errorVisible: value })} />
          </label>

          <label>
            <span>Frecuencia</span>
            <select
              value={record.sunmi.issueFrequency}
              onChange={(event) => patchSunmi({ issueFrequency: event.target.value as IssueFrequency })}
            >
              <option value="pending">Pendiente</option>
              <option value="always">Siempre</option>
              <option value="intermittent">Intermitente</option>
              <option value="resolved">Aparentemente resuelto</option>
              <option value="unknown">No determinado</option>
            </select>
          </label>

          <label>
            <span>¿Quién detectó/reportó el problema?</span>
            <select
              value={record.sunmi.reporter}
              onChange={(event) => patchSunmi({ reporter: event.target.value as IncidentReporter })}
            >
              <option value="pending">Pendiente</option>
              <option value="owner">Dueña</option>
              <option value="staff">Personal</option>
              <option value="accountant">Contador/a</option>
              <option value="inputsoft">Inputsoft / proveedor</option>
              <option value="sii">SII</option>
              <option value="other">Otro</option>
              <option value="unknown">No se sabe</option>
            </select>
          </label>

          <label>
            <span>Comprobación frente al SII</span>
            <select
              value={record.sunmi.siiVerification}
              onChange={(event) => patchSunmi({ siiVerification: event.target.value as SiiVerificationState })}
            >
              <option value="pending">Pendiente de comprobar</option>
              <option value="found">Documentos encontrados</option>
              <option value="missing">Documentos no encontrados</option>
              <option value="mixed">Algunos sí / algunos no</option>
              <option value="not_checked">Todavía no se revisó</option>
            </select>
          </label>

          <label>
            <span>Proceso sospechado</span>
            <select
              value={record.sunmi.suspectedScope}
              onChange={(event) => patchSunmi({ suspectedScope: event.target.value as SuspectedFiscalScope })}
            >
              <option value="pending">Pendiente</option>
              <option value="individual_boletas">Boletas individuales</option>
              <option value="daily_summary">Resumen de ventas diarias</option>
              <option value="both">Ambos</option>
              <option value="unknown">Todavía no se sabe</option>
            </select>
          </label>

          <label>
            <span>Desde aproximadamente</span>
            <input type="date" value={record.sunmi.affectedFrom} onChange={(event) => patchSunmi({ affectedFrom: event.target.value })} />
          </label>

          <label>
            <span>Hasta aproximadamente</span>
            <input type="date" value={record.sunmi.affectedTo} onChange={(event) => patchSunmi({ affectedTo: event.target.value })} />
          </label>

          <label className="discovery-wide">
            <span>Página / nombre del sistema visible</span>
            <input
              type="text"
              placeholder="Ej. nombre de pantalla o URL sin usuario/contraseña"
              value={record.sunmi.systemReference}
              onChange={(event) => patchSunmi({ systemReference: event.target.value })}
            />
          </label>

          <label className="discovery-wide">
            <span>Texto exacto del error, si existe</span>
            <textarea
              rows={2}
              placeholder="Solo mensaje visible. No copiar claves ni datos sensibles."
              value={record.sunmi.errorText}
              onChange={(event) => patchSunmi({ errorText: event.target.value })}
            />
          </label>

          <label className="discovery-wide">
            <span>Evidencia / notas</span>
            <textarea
              rows={3}
              placeholder="Ej. foto de pantalla, boleta de ejemplo, explicación del contador..."
              value={record.sunmi.evidenceNote}
              onChange={(event) => patchSunmi({ evidenceNote: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="discovery-section">
        <header>
          <div><span>02</span><h3>Costos actuales y pagos</h3></div>
          <p>Estos datos alimentarán después la propuesta de costo/beneficio; no se inventa ningún ahorro.</p>
        </header>

        <div className="discovery-form-grid">
          <label>
            <span>Relación comercial de la SUNMI</span>
            <select
              value={record.commercial.sunmiArrangement}
              onChange={(event) => patchCommercial({ sunmiArrangement: event.target.value as SunmiArrangement })}
            >
              <option value="pending">Pendiente</option>
              <option value="purchased">Comprada</option>
              <option value="rented">Arrendada</option>
              <option value="bundled">Incluida en otro servicio/plan</option>
              <option value="unknown">No determinado</option>
            </select>
          </label>

          <label>
            <span>Costo fijo mensual verificado</span>
            <div className="discovery-money">
              <b>$</b>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Pendiente"
                value={numberValue(record.commercial.fixedMonthlyCost)}
                onChange={(event) => patchCommercial({ fixedMonthlyCost: parseNumber(event.target.value) })}
              />
            </div>
            <small>{record.commercial.fixedMonthlyCost === null ? 'Pendiente' : formatCLP(record.commercial.fixedMonthlyCost)}</small>
          </label>

          <label>
            <span>Proveedor / adquirente actual de tarjetas</span>
            <input
              type="text"
              placeholder="Ej. Transbank, Getnet, otro"
              value={record.commercial.cardAcquirer}
              onChange={(event) => patchCommercial({ cardAcquirer: event.target.value })}
            />
          </label>

          <label>
            <span>Comisión promedio efectiva actual</span>
            <div className="discovery-percent">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Pendiente"
                value={numberValue(record.commercial.cardFeePercent)}
                onChange={(event) => patchCommercial({ cardFeePercent: parseNumber(event.target.value) })}
              />
              <b>%</b>
            </div>
          </label>

          <label>
            <span>Ventas mensuales aproximadas con tarjeta</span>
            <div className="discovery-money">
              <b>$</b>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Pendiente"
                value={numberValue(record.commercial.monthlyCardSales)}
                onChange={(event) => patchCommercial({ monthlyCardSales: parseNumber(event.target.value) })}
              />
            </div>
          </label>

          <label className="discovery-wide">
            <span>Fuente / evidencia comercial</span>
            <textarea
              rows={3}
              placeholder="Ej. factura mensual, contrato, cartola del proveedor de pagos..."
              value={record.commercial.evidenceNote}
              onChange={(event) => patchCommercial({ evidenceNote: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="discovery-section">
        <header>
          <div><span>03</span><h3>Cuatro DIGI RM-60</h3></div>
          <p>Confirmamos la existencia de cuatro equipos. Ahora necesitamos entender el flujo real sin escribir nada en ellos.</p>
        </header>

        <div className="discovery-form-grid">
          <label>
            <span>¿Se observó el procedimiento completo de cambio de precio?</span>
            <TriSelect value={record.scale.principalWorkflowObserved} onChange={(value) => patchScale({ principalWorkflowObserved: value })} />
          </label>

          <label>
            <span>¿Las otras tres balanzas cambian automáticamente?</span>
            <TriSelect value={record.scale.secondaryPropagation} onChange={(value) => patchScale({ secondaryPropagation: value })} />
          </label>

          <label>
            <span>Tiempo / comportamiento observado</span>
            <input
              type="text"
              placeholder="Ej. inmediato, 30 s, al reiniciar..."
              value={record.scale.propagationDelay}
              onChange={(event) => patchScale({ propagationDelay: event.target.value })}
            />
          </label>

          <label>
            <span>¿Se identificó programa/página de administración?</span>
            <TriSelect value={record.scale.managementSystemIdentified} onChange={(value) => patchScale({ managementSystemIdentified: value })} />
          </label>

          <label className="discovery-wide">
            <span>Referencia del programa/página</span>
            <input
              type="text"
              placeholder="Nombre o URL visible, sin credenciales"
              value={record.scale.managementSystemReference}
              onChange={(event) => patchScale({ managementSystemReference: event.target.value })}
            />
          </label>

          <label>
            <span>¿Existe export/listado de PLU?</span>
            <TriSelect value={record.scale.pluExportAvailable} onChange={(value) => patchScale({ pluExportAvailable: value })} />
          </label>

          <label>
            <span>¿Existe backup recuperable antes de escribir?</span>
            <TriSelect value={record.scale.backupAvailable} onChange={(value) => patchScale({ backupAvailable: value })} />
          </label>

          <label className="discovery-wide">
            <span>Notas de terreno</span>
            <textarea
              rows={3}
              placeholder="Qué pantalla usan, qué teclas presionan, qué ocurre en las otras balanzas..."
              value={record.scale.notes}
              onChange={(event) => patchScale({ notes: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="discovery-blockers">
        <div>
          <p className="eyebrow">Próximos datos útiles</p>
          <h3>{readiness.blockers.length ? `${readiness.blockers.length} pendientes clave` : 'Levantamiento suficiente para la siguiente decisión'}</h3>
        </div>

        {readiness.blockers.length ? (
          <ol>
            {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ol>
        ) : (
          <p>Ya tenemos respuestas explícitas para evaluar el diagnóstico SUNMI/SII, la comparación comercial y el siguiente paso con las RM-60.</p>
        )}
      </div>

      <div className="discovery-question-pack">
        <div>
          <p className="eyebrow">Mensaje para Diana</p>
          <h3>Preguntas que todavía faltan</h3>
          <p>Esta lista se reduce automáticamente a medida que completamos el levantamiento.</p>
        </div>
        {questions.length ? (
          <ol>{questions.map((question) => <li key={question}>{question}</li>)}</ol>
        ) : (
          <strong>No quedan preguntas básicas pendientes.</strong>
        )}
      </div>

      {message ? <div className="toast">{message}</div> : null}
    </section>
  )
}
