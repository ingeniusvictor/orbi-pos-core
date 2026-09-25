import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../domain'
import {
  emptyFieldDiscovery,
  type FieldDiscoveryRecord,
} from '../discovery-model'
import {
  emptyModernizationInputs,
  type ModernizationInputs,
} from '../proposal-model'
import {
  emptyManualGateEvidence,
  evaluateProductionGate,
  sanitizeManualGateEvidence,
  type FiscalProductionPath,
  type GateCheck,
  type ManualGateEvidence,
} from '../production-gate'

const DISCOVERY_KEY = 'orbi-pos:field-discovery'
const PROPOSAL_KEY = 'orbi-pos:modernization-proposal'
const MANUAL_GATE_KEY = 'orbi-pos:production-gate'

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

function loadManualGate(): ManualGateEvidence {
  try {
    const raw = localStorage.getItem(MANUAL_GATE_KEY)
    if (!raw) return emptyManualGateEvidence
    return sanitizeManualGateEvidence(JSON.parse(raw) as Partial<ManualGateEvidence>)
  } catch {
    return emptyManualGateEvidence
  }
}

function stateCopy(state: ReturnType<typeof evaluateProductionGate>['state']) {
  if (state === 'approval-recorded') {
    return {
      eyebrow: 'DECISIÓN REGISTRADA',
      title: 'Aprobación para migración controlada registrada',
      detail: 'ORBI registra que los prerrequisitos y la decisión del negocio están documentados. Esto no sustituye permisos, obligaciones tributarias ni validaciones externas.',
    }
  }

  if (state === 'ready-for-owner-decision') {
    return {
      eyebrow: 'LISTO PARA DECISIÓN',
      title: 'La dueña ya puede decidir con evidencia suficiente',
      detail: 'Los prerrequisitos técnicos y económicos del gate están completos. ORBI todavía no considera aprobada la migración hasta registrar la decisión del negocio.',
    }
  }

  return {
    eyebrow: 'MIGRACIÓN BLOQUEADA',
    title: 'El piloto puede continuar, pero producción todavía no',
    detail: 'Faltan prerrequisitos verificables. ORBI mantiene el cambio de sistema bloqueado para evitar una migración basada en supuestos.',
  }
}

function CheckRow({ check }: { check: GateCheck }) {
  return (
    <li className={check.passed ? 'gate-check passed' : 'gate-check blocked'}>
      <span>{check.passed ? '✓' : '○'}</span>
      <div>
        <b>{check.label}</b>
        <small>{check.detail}</small>
      </div>
      <em>{check.passed ? 'VERIFICADO' : 'BLOQUEANTE'}</em>
    </li>
  )
}

function go(path: string) {
  window.location.href = path
}

export function ProductionDecisionGate({ products }: { products: Product[] }) {
  const [discovery] = useState<FieldDiscoveryRecord>(loadDiscovery)
  const [proposal] = useState<ModernizationInputs>(loadProposal)
  const [manual, setManual] = useState<ManualGateEvidence>(loadManualGate)
  const [notice, setNotice] = useState('')

  const result = useMemo(
    () => evaluateProductionGate(products, discovery, proposal, manual),
    [products, discovery, proposal, manual],
  )

  const copy = stateCopy(result.state)
  const progress = Math.round((result.prerequisitePassed / result.prerequisiteCount) * 100)

  useEffect(() => {
    const next = {
      ...manual,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(MANUAL_GATE_KEY, JSON.stringify(next))
  }, [
    manual.fiscalPath,
    manual.fiscalNote,
    manual.physicalPointTestPassed,
    manual.physicalPointNote,
    manual.rollbackPlanReady,
    manual.rollbackPlanNote,
    manual.ownerApprovalRecorded,
    manual.ownerApprovalNote,
  ])

  function patch<K extends keyof ManualGateEvidence>(
    key: K,
    value: ManualGateEvidence[K],
  ) {
    setManual((current) => ({ ...current, [key]: value }))
  }

  function resetManualEvidence() {
    setManual(emptyManualGateEvidence)
    localStorage.removeItem(MANUAL_GATE_KEY)
    setNotice('Evidencia manual reiniciada. Catálogo, Levantamiento y Propuesta no fueron modificados.')
    window.setTimeout(() => setNotice(''), 3200)
  }

  function fiscalLabel(value: FiscalProductionPath) {
    if (value === 'retain-current-verified') return 'Mantener flujo fiscal actual verificado'
    if (value === 'new-flow-validated') return 'Nueva ruta fiscal validada'
    return 'Pendiente'
  }

  return (
    <main className="production-gate-page">
      <header className="production-gate-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>
            ← Volver al Hub
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/resumen')}>
            Resumen / PDF
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/migracion')}>
            Runbook migración
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/evidencia')}>
            Evidencia
          </button>
        </div>
        <button className="ghost" type="button" onClick={resetManualEvidence}>
          Reiniciar evidencia manual
        </button>
      </header>

      <section className={`production-gate-hero gate-state-${result.state}`}>
        <div className="production-gate-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · PRODUCTION GATE</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="production-gate-hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
        </div>

        <div className="production-gate-meter">
          <div>
            <small>PRERREQUISITOS</small>
            <strong>{result.prerequisitePassed}/{result.prerequisiteCount}</strong>
            <span>{progress}% verificado</span>
          </div>
          <div className="production-gate-meter-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="production-gate-state-label">
            {result.state === 'blocked'
              ? 'NO PASAR A PRODUCCIÓN'
              : result.state === 'ready-for-owner-decision'
                ? 'ESPERANDO DECISIÓN DE LA DUEÑA'
                : 'APROBACIÓN REGISTRADA'}
          </div>
        </div>
      </section>

      <section className="production-gate-grid">
        <article className="production-gate-panel">
          <header>
            <div>
              <p className="eyebrow">Automático</p>
              <h2>Evidencia que ORBI puede comprobar</h2>
            </div>
            <span>{result.automaticChecks.filter((check) => check.passed).length}/{result.automaticChecks.length}</span>
          </header>

          <ul>
            {result.automaticChecks.map((check) => <CheckRow key={check.id} check={check} />)}
          </ul>

          <div className="production-gate-links">
            <button type="button" className="ghost" onClick={() => go('/?view=discovery')}>Levantamiento</button>
            <button type="button" className="ghost" onClick={() => go('/?view=scale')}>Balanza</button>
            <button type="button" className="ghost" onClick={() => go('/?view=proposal')}>Propuesta</button>
          </div>
        </article>

        <article className="production-gate-panel manual">
          <header>
            <div>
              <p className="eyebrow">Manual con evidencia</p>
              <h2>Decisiones que ORBI no puede inventar</h2>
            </div>
            <span>{result.manualChecks.filter((check) => check.passed).length}/{result.manualChecks.length}</span>
          </header>

          <div className="production-gate-form">
            <section>
              <div className="production-gate-field-head">
                <div>
                  <b>Ruta fiscal de producción</b>
                  <small>Completar Levantamiento no equivale a validar el camino tributario.</small>
                </div>
                <span>{manual.fiscalPath === 'pending' ? 'PENDIENTE' : 'SELECCIONADO'}</span>
              </div>

              <select
                value={manual.fiscalPath}
                onChange={(event) => patch('fiscalPath', event.target.value as FiscalProductionPath)}
              >
                <option value="pending">Pendiente</option>
                <option value="retain-current-verified">Mantener SUNMI/Inputsoft u otro flujo actual, verificado</option>
                <option value="new-flow-validated">Nueva ruta fiscal validada para producción</option>
              </select>

              <textarea
                value={manual.fiscalNote}
                onChange={(event) => patch('fiscalNote', event.target.value)}
                placeholder="Evidencia no sensible: prueba realizada, fecha, responsable, documento revisado..."
              />

              {manual.fiscalPath !== 'pending' ? (
                <small className="gate-selected-path">Ruta seleccionada: {fiscalLabel(manual.fiscalPath)}</small>
              ) : null}
            </section>

            <section>
              <label className="production-gate-toggle">
                <input
                  type="checkbox"
                  checked={manual.physicalPointTestPassed}
                  onChange={(event) => patch('physicalPointTestPassed', event.target.checked)}
                />
                <div>
                  <b>Point Smart 2 física probada</b>
                  <small>La simulación del software no cuenta como prueba de hardware real.</small>
                </div>
              </label>

              <textarea
                value={manual.physicalPointNote}
                onChange={(event) => patch('physicalPointNote', event.target.value)}
                placeholder="Evidencia: terminal, fecha, prueba controlada, resultado..."
              />

              <button className="ghost gate-inline-link" type="button" onClick={() => go('/?view=payments')}>
                Abrir Pagos ↗
              </button>
            </section>

            <section>
              <label className="production-gate-toggle">
                <input
                  type="checkbox"
                  checked={manual.rollbackPlanReady}
                  onChange={(event) => patch('rollbackPlanReady', event.target.checked)}
                />
                <div>
                  <b>Plan de reversa documentado</b>
                  <small>Debe existir una forma clara de volver al flujo seguro anterior si el piloto real falla.</small>
                </div>
              </label>

              <textarea
                value={manual.rollbackPlanNote}
                onChange={(event) => patch('rollbackPlanNote', event.target.value)}
                placeholder="Ej. mantener sistema actual disponible, backup, responsable y criterio de reversa..."
              />
            </section>

            <section className={result.ownerApprovalEligible ? 'owner-gate eligible' : 'owner-gate locked'}>
              <div className="owner-gate-banner">
                <span>{result.ownerApprovalEligible ? '✓' : '🔒'}</span>
                <div>
                  <b>Decisión final de la dueña</b>
                  <small>
                    {result.ownerApprovalEligible
                      ? 'Los demás prerrequisitos están completos. Ya se puede registrar la decisión del negocio.'
                      : 'Se habilita solamente cuando todos los prerrequisitos técnicos/económicos y manuales anteriores pasan.'}
                  </small>
                </div>
              </div>

              <label className="production-gate-toggle">
                <input
                  type="checkbox"
                  checked={manual.ownerApprovalRecorded}
                  disabled={!result.ownerApprovalEligible}
                  onChange={(event) => patch('ownerApprovalRecorded', event.target.checked)}
                />
                <div>
                  <b>Registrar aprobación para piloto/migración controlada</b>
                  <small>ORBI registra la decisión; no reemplaza contratos, obligaciones legales o tributarias.</small>
                </div>
              </label>

              <textarea
                value={manual.ownerApprovalNote}
                disabled={!result.ownerApprovalEligible}
                onChange={(event) => patch('ownerApprovalNote', event.target.value)}
                placeholder="Evidencia: nombre/rol, fecha, alcance aprobado y condiciones..."
              />
            </section>
          </div>
        </article>
      </section>

      <section className="production-gate-blockers">
        <div className="production-gate-blockers-head">
          <div>
            <p className="eyebrow">Bloqueadores actuales</p>
            <h2>{result.blockers.length ? `${result.blockers.length} condición(es) pendiente(s)` : 'Sin bloqueadores pendientes'}</h2>
          </div>
          <span>{result.state === 'approval-recorded' ? 'REGISTRADO' : 'CONTROL ACTIVO'}</span>
        </div>

        {result.blockers.length ? (
          <ol>
            {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ol>
        ) : (
          <div className="production-gate-clear">
            <b>Todos los gates del piloto están documentados.</b>
            <span>Antes de ejecutar cambios reales, aplicar el alcance aprobado y el plan de reversa registrado.</span>
          </div>
        )}
      </section>

      <section className="production-gate-safety">
        <div>
          <p className="eyebrow">Límites que siguen vigentes</p>
          <h2>Pasar el gate no activa integraciones automáticamente.</h2>
        </div>
        <div className="production-gate-safety-grid">
          <article>
            <b>RM-60</b>
            <span>El gate exige PLU, topología y backup. No certifica escritura automática a la balanza.</span>
          </article>
          <article>
            <b>SII</b>
            <span>La investigación y la ruta fiscal deben validarse; ORBI no infiere aprobación tributaria.</span>
          </article>
          <article>
            <b>Point</b>
            <span>La demo local no sustituye una prueba física con terminal y configuración reales.</span>
          </article>
          <article>
            <b>Economía</b>
            <span>El gate exige comparación calculable, no exige que la propuesta resulte más barata.</span>
          </article>
        </div>
      </section>

      <footer className="production-gate-footer">
        <span>OC-24 · Production Decision Gate</span>
        <span>Evidencia manual local · sin credenciales · sin datos de tarjeta · sin datos de clientes</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
