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
  type ManualGateEvidence,
} from '../production-gate'
import {
  buildMigrationRunbookExport,
  completeMigrationRunbook,
  completeRollback,
  createEmptyMigrationRunbook,
  evaluateMigrationRunbook,
  runbookSteps,
  sanitizeMigrationRunbook,
  setGoNoGoDecision,
  startMigrationRunbook,
  updateMigrationStep,
  type MigrationRunbookState,
  type RunbookPhase,
  type RunbookStepDefinition,
  type RunbookStepStatus,
} from '../migration-runbook'

const DISCOVERY_KEY = 'orbi-pos:field-discovery'
const PROPOSAL_KEY = 'orbi-pos:modernization-proposal'
const MANUAL_GATE_KEY = 'orbi-pos:production-gate'
const RUNBOOK_KEY = 'orbi-pos:migration-runbook'

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

function loadRunbook(): MigrationRunbookState {
  try {
    const raw = localStorage.getItem(RUNBOOK_KEY)
    if (!raw) return createEmptyMigrationRunbook()
    return sanitizeMigrationRunbook(JSON.parse(raw) as Partial<MigrationRunbookState>)
  } catch {
    return createEmptyMigrationRunbook()
  }
}

function phaseTitle(phase: RunbookPhase) {
  if (phase === 'preparation') return 'Preparación'
  if (phase === 'preflight') return 'Preflight'
  if (phase === 'controlled-pilot') return 'Piloto controlado'
  if (phase === 'stabilization') return 'Estabilización'
  if (phase === 'closeout') return 'Cierre'
  return 'Rollback'
}

function phaseNumber(phase: RunbookPhase) {
  if (phase === 'preparation') return '01'
  if (phase === 'preflight') return '02'
  if (phase === 'controlled-pilot') return '04'
  if (phase === 'stabilization') return '05'
  if (phase === 'closeout') return '06'
  return 'RB'
}

function runbookStateCopy(state: MigrationRunbookState['executionState']) {
  if (state === 'in-progress') return ['VENTANA ACTIVA', 'Ejecutar paso a paso y detenerse ante cualquier falla crítica.']
  if (state === 'stopped-no-go') return ['NO-GO REGISTRADO', 'No continuar con el cambio. Mantener la operación segura anterior.']
  if (state === 'rollback-required') return ['STOP / ROLLBACK', 'Una verificación crítica falló. Los pasos normales quedan bloqueados.']
  if (state === 'rolled-back') return ['ROLLBACK CERRADO', 'La recuperación fue documentada y la prueba controlada quedó detenida.']
  if (state === 'completed') return ['PILOTO CONTROLADO CERRADO', 'Las verificaciones críticas del runbook fueron completadas.']
  return ['BORRADOR', 'Puedes preparar la ventana, pero la ejecución depende del gate OC-24.']
}

function phaseSteps(phase: RunbookPhase) {
  return runbookSteps.filter((step) => step.phase === phase)
}

function go(path: string) {
  window.location.href = path
}

interface StepCardProps {
  definition: RunbookStepDefinition
  state: MigrationRunbookState
  gateApproved: boolean
  onUpdate: (
    definition: RunbookStepDefinition,
    status: RunbookStepStatus,
    evidence: string,
  ) => void
}

function StepCard({ definition, state, gateApproved, onUpdate }: StepCardProps) {
  const record = state.steps[definition.id]
  const [evidence, setEvidence] = useState(record?.evidence ?? '')

  useEffect(() => {
    setEvidence(record?.evidence ?? '')
  }, [record?.evidence])

  const rollbackStep = definition.phase === 'rollback'
  const executionLocked =
    !gateApproved
    || (rollbackStep
      ? state.executionState !== 'rollback-required'
      : state.executionState !== 'in-progress')
    || (
      !rollbackStep
      && (
        definition.phase === 'controlled-pilot'
        || definition.phase === 'stabilization'
        || definition.phase === 'closeout'
      )
      && state.decision !== 'go'
    )

  return (
    <article className={`migration-step status-${record?.status ?? 'pending'}`}>
      <header>
        <div className="migration-step-status">
          <span>
            {record?.status === 'passed' ? '✓' : record?.status === 'failed' ? '!' : '○'}
          </span>
          <div>
            <b>{definition.label}</b>
            <small>{definition.detail}</small>
          </div>
        </div>
        <em>{definition.critical ? 'CRÍTICO' : 'APOYO'}</em>
      </header>

      <textarea
        value={evidence}
        onChange={(event) => setEvidence(event.target.value)}
        disabled={executionLocked}
        placeholder="Evidencia/observación no sensible: qué se verificó, resultado, responsable..."
      />

      <div className="migration-step-actions">
        <button
          type="button"
          className="migration-pass"
          disabled={executionLocked}
          onClick={() => onUpdate(definition, 'passed', evidence)}
        >
          ✓ Pasó
        </button>
        <button
          type="button"
          className="migration-fail"
          disabled={executionLocked}
          onClick={() => onUpdate(definition, 'failed', evidence)}
        >
          ! Falló
        </button>
        {record?.status !== 'pending' && !executionLocked ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setEvidence('')
              onUpdate(definition, 'pending', '')
            }}
          >
            Volver a pendiente
          </button>
        ) : null}
      </div>

      {record?.updatedAt ? (
        <small className="migration-step-time">
          Último registro: {new Date(record.updatedAt).toLocaleString('es-CL')}
        </small>
      ) : null}
    </article>
  )
}

export function ControlledMigrationRunbook({ products }: { products: Product[] }) {
  const [discovery] = useState<FieldDiscoveryRecord>(loadDiscovery)
  const [proposal] = useState<ModernizationInputs>(loadProposal)
  const [manualGate] = useState<ManualGateEvidence>(loadManualGate)
  const [state, setState] = useState<MigrationRunbookState>(loadRunbook)
  const [notice, setNotice] = useState('')

  const gate = useMemo(
    () => evaluateProductionGate(products, discovery, proposal, manualGate),
    [products, discovery, proposal, manualGate],
  )
  const evaluation = useMemo(
    () => evaluateMigrationRunbook(gate.state, state),
    [gate.state, state],
  )

  useEffect(() => {
    localStorage.setItem(RUNBOOK_KEY, JSON.stringify(state))
  }, [state])

  const [stateLabel, stateDetail] = runbookStateCopy(state.executionState)

  function patch<K extends keyof MigrationRunbookState>(
    key: K,
    value: MigrationRunbookState[K],
  ) {
    if (state.executionState !== 'draft') return
    setState((current) => ({ ...current, [key]: value }))
  }

  function withNotice(action: () => MigrationRunbookState, success: string) {
    try {
      setState(action())
      setNotice(success)
    } catch (error) {
      setNotice((error as Error).message)
    }
    window.setTimeout(() => setNotice(''), 3200)
  }

  function start() {
    withNotice(
      () => startMigrationRunbook(gate.state, state),
      'Runbook iniciado. Ejecuta cada verificación sin saltar controles.',
    )
  }

  function updateStep(
    definition: RunbookStepDefinition,
    status: RunbookStepStatus,
    evidence: string,
  ) {
    withNotice(
      () => updateMigrationStep(
        gate.state,
        state,
        definition.id,
        status,
        evidence,
      ),
      status === 'passed'
        ? `${definition.label}: verificado.`
        : status === 'failed'
          ? `${definition.label}: falla registrada.`
          : `${definition.label}: volvió a pendiente.`,
    )
  }

  function decision(decisionValue: 'go' | 'no-go') {
    withNotice(
      () => setGoNoGoDecision(gate.state, state, decisionValue),
      decisionValue === 'go'
        ? 'GO registrado. Se habilita el piloto controlado.'
        : 'NO-GO registrado. No ejecutar cambios de producción.',
    )
  }

  function complete() {
    withNotice(
      () => completeMigrationRunbook(gate.state, state),
      'Piloto controlado cerrado con verificaciones críticas completas.',
    )
  }

  function closeRollback() {
    withNotice(
      () => completeRollback(gate.state, state),
      'Rollback cerrado y documentado.',
    )
  }

  function reset() {
    setState(createEmptyMigrationRunbook())
    localStorage.removeItem(RUNBOOK_KEY)
    setNotice('Runbook reiniciado. OC-24, catálogo, Levantamiento y Propuesta no fueron modificados.')
    window.setTimeout(() => setNotice(''), 3200)
  }

  function exportJson() {
    const payload = buildMigrationRunbookExport(state, gate.state)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbi-el-chunchito-migration-runbook.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="migration-runbook-page">
      <header className="migration-runbook-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>
            ← Hub
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/decision')}>
            Gate OC-24
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/resumen')}>
            Resumen / PDF
          </button>
          <button className="ghost" type="button" onClick={() => go('/piloto/evidencia')}>
            Evidencia / incidentes
          </button>
        </div>
        <div>
          <button className="ghost" type="button" onClick={exportJson}>
            Exportar JSON
          </button>
          <button className="ghost" type="button" onClick={reset}>
            Reiniciar runbook
          </button>
        </div>
      </header>

      <section className={`migration-runbook-hero runbook-${state.executionState}`}>
        <div className="migration-runbook-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · CONTROLLED MIGRATION</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="migration-runbook-hero-copy">
          <p className="eyebrow">{stateLabel}</p>
          <h1>Migrar solamente si podemos volver atrás.</h1>
          <p>
            Este runbook organiza una futura ventana controlada. No ejecuta comandos sobre RM-60,
            Mercado Pago, SUNMI, Inputsoft ni SII.
          </p>
        </div>

        <div className="migration-runbook-summary">
          <div>
            <small>OC-24</small>
            <strong>{gate.state === 'approval-recorded' ? 'APROBADO' : 'BLOQUEADO'}</strong>
            <span>{gate.state.replaceAll('-', ' ')}</span>
          </div>
          <div>
            <small>CRÍTICOS NORMALES</small>
            <strong>{evaluation.normalCriticalPassed}/{evaluation.normalCriticalTotal}</strong>
            <span>verificaciones completadas</span>
          </div>
          <div>
            <small>DECISIÓN</small>
            <strong>{state.decision.toUpperCase()}</strong>
            <span>{stateDetail}</span>
          </div>
        </div>
      </section>

      {!evaluation.gateApproved ? (
        <section className="migration-runbook-lock">
          <span>🔒</span>
          <div>
            <p className="eyebrow">MODO PREVISUALIZACIÓN</p>
            <h2>La ejecución está bloqueada por OC-24.</h2>
            <p>
              Puedes preparar fecha, responsables y revisar el procedimiento. Los controles de ejecución
              se habilitan únicamente cuando el Production Decision Gate esté en <b>approval-recorded</b>.
            </p>
          </div>
          <button className="primary" type="button" onClick={() => go('/piloto/decision')}>
            Revisar gate
          </button>
        </section>
      ) : null}

      <section className="migration-runbook-setup">
        <div className="migration-section-head">
          <span>00</span>
          <div>
            <p className="eyebrow">Ventana controlada</p>
            <h2>Programación y responsables</h2>
          </div>
        </div>

        <div className="migration-setup-grid">
          <label>
            <span>Fecha</span>
            <input
              type="date"
              value={state.scheduledDate}
              disabled={state.executionState !== 'draft'}
              onChange={(event) => patch('scheduledDate', event.target.value)}
            />
          </label>
          <label>
            <span>Inicio</span>
            <input
              type="time"
              value={state.windowStart}
              disabled={state.executionState !== 'draft'}
              onChange={(event) => patch('windowStart', event.target.value)}
            />
          </label>
          <label>
            <span>Término objetivo</span>
            <input
              type="time"
              value={state.windowEnd}
              disabled={state.executionState !== 'draft'}
              onChange={(event) => patch('windowEnd', event.target.value)}
            />
          </label>
          <label>
            <span>Responsable principal</span>
            <input
              type="text"
              value={state.leadOperator}
              disabled={state.executionState !== 'draft'}
              placeholder="Nombre / rol"
              onChange={(event) => patch('leadOperator', event.target.value)}
            />
          </label>
          <label className="migration-setup-wide">
            <span>Soporte / coordinación</span>
            <textarea
              value={state.supportNote}
              disabled={state.executionState !== 'draft'}
              placeholder="Responsables disponibles, contacto operativo, condiciones de la ventana. No incluir claves ni tokens."
              onChange={(event) => patch('supportNote', event.target.value)}
            />
          </label>
        </div>

        <div className="migration-runbook-start">
          <div>
            <b>{evaluation.setupReady ? 'Programación mínima completa' : 'Programación incompleta'}</b>
            <span>
              {evaluation.canStart
                ? 'OC-24 aprobado y ventana preparada.'
                : 'El botón de inicio permanece bloqueado hasta cumplir OC-24 y los datos mínimos de la ventana.'}
            </span>
          </div>
          <button
            className="primary"
            type="button"
            disabled={!evaluation.canStart}
            onClick={start}
          >
            Iniciar ventana controlada
          </button>
        </div>
      </section>

      {(['preparation', 'preflight'] as RunbookPhase[]).map((phase) => (
        <section className="migration-runbook-phase" key={phase}>
          <div className="migration-section-head">
            <span>{phaseNumber(phase)}</span>
            <div>
              <p className="eyebrow">{phase === 'preparation' ? 'Antes de tocar nada' : 'GO / NO-GO depende de esto'}</p>
              <h2>{phaseTitle(phase)}</h2>
            </div>
          </div>
          <div className="migration-step-grid">
            {phaseSteps(phase).map((definition) => (
              <StepCard
                key={definition.id}
                definition={definition}
                state={state}
                gateApproved={evaluation.gateApproved}
                onUpdate={updateStep}
              />
            ))}
          </div>
        </section>
      ))}

      <section className={`migration-checkpoint decision-${state.decision}`}>
        <div className="migration-section-head">
          <span>03</span>
          <div>
            <p className="eyebrow">Checkpoint irreversible</p>
            <h2>GO / NO-GO</h2>
          </div>
        </div>

        <div className="migration-checkpoint-body">
          <div>
            <h3>
              {state.decision === 'go'
                ? 'GO registrado'
                : state.decision === 'no-go'
                  ? 'NO-GO registrado'
                  : evaluation.canSelectGo
                    ? 'Preflight completo: decisión habilitada'
                    : 'GO todavía bloqueado'}
            </h3>
            <p>
              GO solo se habilita cuando todas las verificaciones críticas de Preparación y Preflight
              están en PASÓ. NO-GO mantiene el flujo seguro anterior.
            </p>
          </div>

          <div className="migration-checkpoint-actions">
            <button
              className="migration-no-go"
              type="button"
              disabled={state.executionState !== 'in-progress' || state.decision !== 'pending'}
              onClick={() => decision('no-go')}
            >
              NO-GO · Detener
            </button>
            <button
              className="migration-go"
              type="button"
              disabled={!evaluation.canSelectGo}
              onClick={() => decision('go')}
            >
              GO · Piloto controlado
            </button>
          </div>
        </div>
      </section>

      {(['controlled-pilot', 'stabilization', 'closeout'] as RunbookPhase[]).map((phase) => (
        <section className="migration-runbook-phase" key={phase}>
          <div className="migration-section-head">
            <span>{phaseNumber(phase)}</span>
            <div>
              <p className="eyebrow">
                {phase === 'controlled-pilot'
                  ? 'Una operación a la vez'
                  : phase === 'stabilization'
                    ? 'Observar antes de ampliar'
                    : 'Cerrar con evidencia'}
              </p>
              <h2>{phaseTitle(phase)}</h2>
            </div>
          </div>
          <div className="migration-step-grid">
            {phaseSteps(phase).map((definition) => (
              <StepCard
                key={definition.id}
                definition={definition}
                state={state}
                gateApproved={evaluation.gateApproved}
                onUpdate={updateStep}
              />
            ))}
          </div>
        </section>
      ))}

      {state.executionState === 'rollback-required' || state.executionState === 'rolled-back' ? (
        <section className="migration-rollback">
          <div className="migration-section-head">
            <span>RB</span>
            <div>
              <p className="eyebrow">STOP / RECUPERACIÓN</p>
              <h2>Rollback obligatorio</h2>
            </div>
          </div>

          <div className="migration-rollback-warning">
            <b>No continuar el piloto normal.</b>
            <span>
              Recupera el flujo seguro, valida operación fiscal y balanzas, y documenta el incidente antes de cerrar.
            </span>
          </div>

          <div className="migration-step-grid">
            {phaseSteps('rollback').map((definition) => (
              <StepCard
                key={definition.id}
                definition={definition}
                state={state}
                gateApproved={evaluation.gateApproved}
                onUpdate={updateStep}
              />
            ))}
          </div>

          <button
            className="primary migration-close-rollback"
            type="button"
            disabled={
              state.executionState !== 'rollback-required'
              || evaluation.rollbackPassed !== evaluation.rollbackTotal
            }
            onClick={closeRollback}
          >
            Cerrar rollback documentado
          </button>
        </section>
      ) : null}

      <section className="migration-runbook-close">
        <div>
          <p className="eyebrow">Cierre de ventana</p>
          <h2>
            {state.executionState === 'completed'
              ? 'Piloto controlado completado'
              : state.executionState === 'rolled-back'
                ? 'Piloto cerrado por rollback'
                : state.executionState === 'stopped-no-go'
                  ? 'Ventana cerrada en NO-GO'
                  : 'Cierre todavía bloqueado'}
          </h2>
          <p>
            Completar el runbook no amplía automáticamente el despliegue. Cualquier siguiente etapa debe respetar
            el alcance aprobado y la evidencia registrada.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          disabled={!evaluation.canComplete}
          onClick={complete}
        >
          Cerrar piloto controlado
        </button>
      </section>

      {evaluation.blockers.length ? (
        <section className="migration-runbook-blockers">
          <p className="eyebrow">Pendientes del estado actual</p>
          <h2>{evaluation.blockers.length} bloqueo(s)</h2>
          <ol>
            {evaluation.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ol>
        </section>
      ) : null}

      <section className="migration-runbook-safety">
        <article>
          <b>RM-60</b>
          <span>Este runbook observa y documenta. No escribe precios ni PLU en las balanzas.</span>
        </article>
        <article>
          <b>Point</b>
          <span>No envía cobros. La prueba real se ejecutará únicamente mediante la integración aprobada.</span>
        </article>
        <article>
          <b>SII</b>
          <span>No emite documentos. Solo registra el resultado de la ruta fiscal previamente validada.</span>
        </article>
        <article>
          <b>Datos</b>
          <span>No registrar contraseñas, tokens, datos de tarjeta ni información personal de clientes.</span>
        </article>
      </section>

      <footer className="migration-runbook-footer">
        <span>OC-25 · Controlled Migration Runbook</span>
        <span>Registro operacional local · reversible · sin acciones automáticas sobre sistemas externos</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
