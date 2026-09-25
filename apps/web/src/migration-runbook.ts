import type { GateState } from './production-gate'

export type RunbookPhase =
  | 'preparation'
  | 'preflight'
  | 'controlled-pilot'
  | 'stabilization'
  | 'closeout'
  | 'rollback'

export type RunbookStepStatus = 'pending' | 'passed' | 'failed'

export type RunbookExecutionState =
  | 'draft'
  | 'in-progress'
  | 'stopped-no-go'
  | 'rollback-required'
  | 'rolled-back'
  | 'completed'

export type GoNoGoDecision = 'pending' | 'go' | 'no-go'

export interface RunbookStepDefinition {
  id: string
  phase: RunbookPhase
  label: string
  detail: string
  critical: boolean
}

export interface RunbookStepRecord {
  status: RunbookStepStatus
  evidence: string
  updatedAt: string | null
}

export interface MigrationRunbookState {
  version: 'orbi-pos-migration-runbook/v1'
  scheduledDate: string
  windowStart: string
  windowEnd: string
  leadOperator: string
  supportNote: string
  executionState: RunbookExecutionState
  decision: GoNoGoDecision
  startedAt: string | null
  completedAt: string | null
  steps: Record<string, RunbookStepRecord>
}

export interface MigrationRunbookEvaluation {
  gateApproved: boolean
  setupReady: boolean
  canStart: boolean
  canSelectGo: boolean
  canComplete: boolean
  rollbackRequired: boolean
  normalCriticalPassed: number
  normalCriticalTotal: number
  rollbackPassed: number
  rollbackTotal: number
  blockers: string[]
}

export const runbookSteps: RunbookStepDefinition[] = [
  {
    id: 'safe-current-flow-available',
    phase: 'preparation',
    label: 'Flujo seguro anterior disponible',
    detail: 'SUNMI/Inputsoft u otra ruta fiscal aprobada sigue utilizable durante el piloto controlado.',
    critical: true,
  },
  {
    id: 'backup-copy-accessible',
    phase: 'preparation',
    label: 'Backup RM-60 accesible ahora',
    detail: 'La copia de respaldo confirmada en OC-24 puede localizarse y recuperarse antes de comenzar.',
    critical: true,
  },
  {
    id: 'support-contacts-ready',
    phase: 'preparation',
    label: 'Responsables y soporte disponibles',
    detail: 'Se confirmó quién detiene, revierte y valida cada sistema durante la ventana.',
    critical: false,
  },
  {
    id: 'catalog-plu-baseline',
    phase: 'preflight',
    label: 'Catálogo + PLU comparados con línea base',
    detail: 'Una muestra controlada de productos, precios y PLU coincide con la información aprobada.',
    critical: true,
  },
  {
    id: 'four-scales-baseline',
    phase: 'preflight',
    label: '4 RM-60 en estado esperado',
    detail: 'Las cuatro balanzas están operativas y sin cambios inesperados antes de cualquier prueba.',
    critical: true,
  },
  {
    id: 'fiscal-baseline',
    phase: 'preflight',
    label: 'Ruta fiscal de referencia verificada',
    detail: 'Se ejecutó/verificó una operación de referencia del flujo fiscal que seguirá disponible.',
    critical: true,
  },
  {
    id: 'physical-point-online',
    phase: 'preflight',
    label: 'Point Smart 2 física disponible',
    detail: 'La terminal física aprobada está asociada, conectada y lista para la prueba controlada.',
    critical: true,
  },
  {
    id: 'rollback-route-reviewed',
    phase: 'preflight',
    label: 'Ruta de reversa revisada',
    detail: 'El equipo sabe cuándo detenerse y cómo volver al flujo seguro anterior.',
    critical: true,
  },
  {
    id: 'pilot-weigh-product',
    phase: 'controlled-pilot',
    label: 'Pesaje y producto validados',
    detail: 'El producto/PLU/peso/precio de la prueba coincide con la referencia antes del cobro.',
    critical: true,
  },
  {
    id: 'pilot-point-payment',
    phase: 'controlled-pilot',
    label: 'Pago Point confirmado de forma autoritativa',
    detail: 'ORBI solo considera pagada la operación tras estado processed confirmado.',
    critical: true,
  },
  {
    id: 'pilot-fiscal-document',
    phase: 'controlled-pilot',
    label: 'Documento fiscal verificado',
    detail: 'La ruta fiscal aprobada produjo el resultado esperado y fue verificada según el procedimiento acordado.',
    critical: true,
  },
  {
    id: 'pilot-scale-postcheck',
    phase: 'controlled-pilot',
    label: 'RM-60 sin cambios inesperados',
    detail: 'Después de la prueba, las cuatro balanzas mantienen el comportamiento y datos esperados.',
    critical: true,
  },
  {
    id: 'stabilization-observation',
    phase: 'stabilization',
    label: 'Ventana limitada observada sin incidentes críticos',
    detail: 'Se mantuvo el piloto limitado durante el período acordado sin disparadores de rollback.',
    critical: true,
  },
  {
    id: 'stabilization-old-flow',
    phase: 'stabilization',
    label: 'Flujo anterior sigue recuperable',
    detail: 'La ruta segura anterior continúa disponible al cierre de la ventana de observación.',
    critical: true,
  },
  {
    id: 'staff-observation',
    phase: 'stabilization',
    label: 'Observación operativa registrada',
    detail: 'Personal anotó fricciones, tiempos o dudas detectadas durante el piloto.',
    critical: false,
  },
  {
    id: 'final-reconciliation',
    phase: 'closeout',
    label: 'Cierre y conciliación final',
    detail: 'Pago, venta, evidencia fiscal y observaciones del piloto fueron conciliados antes de cerrar.',
    critical: true,
  },
  {
    id: 'rollback-stop-orbi',
    phase: 'rollback',
    label: 'Detener flujo ORBI controlado',
    detail: 'Se detiene la ruta nueva para evitar nuevas operaciones mientras se recupera el flujo seguro.',
    critical: true,
  },
  {
    id: 'rollback-restore-safe-flow',
    phase: 'rollback',
    label: 'Restaurar flujo seguro anterior',
    detail: 'La operación vuelve al método previamente validado.',
    critical: true,
  },
  {
    id: 'rollback-verify-fiscal',
    phase: 'rollback',
    label: 'Verificar operación fiscal tras reversa',
    detail: 'Se confirma que la ruta fiscal segura volvió a operar según el procedimiento.',
    critical: true,
  },
  {
    id: 'rollback-verify-scales',
    phase: 'rollback',
    label: 'Verificar 4 RM-60 tras reversa',
    detail: 'Se comprueba que precios/PLU/operación de las balanzas están en el estado esperado.',
    critical: true,
  },
  {
    id: 'rollback-incident-note',
    phase: 'rollback',
    label: 'Incidente y causa observada documentados',
    detail: 'Se registra qué ocurrió, alcance, evidencia disponible y condición para volver a intentar.',
    critical: true,
  },
]

function emptyStepRecord(): RunbookStepRecord {
  return {
    status: 'pending',
    evidence: '',
    updatedAt: null,
  }
}

export function createEmptyMigrationRunbook(): MigrationRunbookState {
  return {
    version: 'orbi-pos-migration-runbook/v1',
    scheduledDate: '',
    windowStart: '',
    windowEnd: '',
    leadOperator: '',
    supportNote: '',
    executionState: 'draft',
    decision: 'pending',
    startedAt: null,
    completedAt: null,
    steps: Object.fromEntries(
      runbookSteps.map((step) => [step.id, emptyStepRecord()]),
    ),
  }
}

function evidenceReady(value: string) {
  return value.trim().length >= 4
}

function stepPassed(state: MigrationRunbookState, id: string) {
  return state.steps[id]?.status === 'passed'
}

function normalCriticalSteps() {
  return runbookSteps.filter(
    (step) => step.critical && step.phase !== 'rollback',
  )
}

function rollbackCriticalSteps() {
  return runbookSteps.filter(
    (step) => step.critical && step.phase === 'rollback',
  )
}

function preflightCriticalSteps() {
  return runbookSteps.filter(
    (step) =>
      step.critical
      && (step.phase === 'preparation' || step.phase === 'preflight'),
  )
}

export function evaluateMigrationRunbook(
  gateState: GateState,
  state: MigrationRunbookState,
): MigrationRunbookEvaluation {
  const gateApproved = gateState === 'approval-recorded'
  const setupReady =
    Boolean(state.scheduledDate)
    && Boolean(state.windowStart)
    && Boolean(state.windowEnd)
    && evidenceReady(state.leadOperator)

  const preflightPassed = preflightCriticalSteps().every(
    (step) => stepPassed(state, step.id),
  )

  const normalCritical = normalCriticalSteps()
  const rollbackCritical = rollbackCriticalSteps()

  const normalCriticalPassed = normalCritical.filter(
    (step) => stepPassed(state, step.id),
  ).length
  const rollbackPassed = rollbackCritical.filter(
    (step) => stepPassed(state, step.id),
  ).length

  const rollbackRequired = state.executionState === 'rollback-required'
  const canStart =
    gateApproved
    && setupReady
    && state.executionState === 'draft'

  const canSelectGo =
    gateApproved
    && state.executionState === 'in-progress'
    && state.decision === 'pending'
    && preflightPassed
    && !rollbackRequired

  const allNormalCriticalPassed =
    normalCriticalPassed === normalCritical.length

  const canComplete =
    gateApproved
    && state.executionState === 'in-progress'
    && state.decision === 'go'
    && allNormalCriticalPassed
    && !rollbackRequired

  const blockers: string[] = []

  if (!gateApproved) blockers.push('OC-24 debe estar en aprobación registrada')
  if (!state.scheduledDate) blockers.push('Definir fecha de la ventana')
  if (!state.windowStart || !state.windowEnd) blockers.push('Definir inicio y término de la ventana')
  if (!evidenceReady(state.leadOperator)) blockers.push('Registrar responsable principal')

  if (state.executionState === 'in-progress' && state.decision === 'pending') {
    for (const step of preflightCriticalSteps()) {
      if (!stepPassed(state, step.id)) blockers.push(step.label)
    }
  }

  if (state.decision === 'go' && state.executionState === 'in-progress') {
    for (const step of normalCritical) {
      if (!stepPassed(state, step.id)) blockers.push(step.label)
    }
  }

  if (rollbackRequired) {
    for (const step of rollbackCritical) {
      if (!stepPassed(state, step.id)) blockers.push(step.label)
    }
  }

  return {
    gateApproved,
    setupReady,
    canStart,
    canSelectGo,
    canComplete,
    rollbackRequired,
    normalCriticalPassed,
    normalCriticalTotal: normalCritical.length,
    rollbackPassed,
    rollbackTotal: rollbackCritical.length,
    blockers: [...new Set(blockers)],
  }
}

export function startMigrationRunbook(
  gateState: GateState,
  state: MigrationRunbookState,
  now = new Date().toISOString(),
): MigrationRunbookState {
  const evaluation = evaluateMigrationRunbook(gateState, state)
  if (!evaluation.canStart) {
    throw new Error('Migration runbook cannot start until OC-24 approval and scheduling prerequisites are complete')
  }

  return {
    ...state,
    executionState: 'in-progress',
    startedAt: now,
    completedAt: null,
  }
}

export function updateMigrationStep(
  gateState: GateState,
  state: MigrationRunbookState,
  stepId: string,
  status: RunbookStepStatus,
  evidence: string,
  now = new Date().toISOString(),
): MigrationRunbookState {
  if (gateState !== 'approval-recorded') {
    throw new Error('Migration execution is locked until OC-24 approval is recorded')
  }
  if (state.executionState !== 'in-progress' && state.executionState !== 'rollback-required') {
    throw new Error('Migration runbook is not active')
  }

  const definition = runbookSteps.find((step) => step.id === stepId)
  if (!definition) throw new Error('Unknown migration runbook step')

  if (definition.phase === 'rollback' && state.executionState !== 'rollback-required') {
    throw new Error('Rollback steps are available only after rollback is required')
  }

  if (definition.phase !== 'rollback' && state.executionState === 'rollback-required') {
    throw new Error('Normal migration steps are locked while rollback is required')
  }

  if (
    (definition.phase === 'controlled-pilot'
      || definition.phase === 'stabilization'
      || definition.phase === 'closeout')
    && state.decision !== 'go'
  ) {
    throw new Error('Controlled-pilot execution steps are locked until GO is selected')
  }

  if (status !== 'pending' && !evidenceReady(evidence)) {
    throw new Error('Passed/failed migration steps require an evidence note')
  }

  const next: MigrationRunbookState = {
    ...state,
    steps: {
      ...state.steps,
      [stepId]: {
        status,
        evidence,
        updatedAt: status === 'pending' ? null : now,
      },
    },
  }

  if (status === 'failed' && definition.critical) {
    return {
      ...next,
      executionState: 'rollback-required',
      decision: state.decision === 'pending' ? 'no-go' : state.decision,
    }
  }

  return next
}

export function setGoNoGoDecision(
  gateState: GateState,
  state: MigrationRunbookState,
  decision: Exclude<GoNoGoDecision, 'pending'>,
): MigrationRunbookState {
  if (gateState !== 'approval-recorded') {
    throw new Error('GO/NO-GO is locked until OC-24 approval is recorded')
  }
  if (state.executionState !== 'in-progress') {
    throw new Error('Migration runbook is not active')
  }

  if (decision === 'go') {
    const evaluation = evaluateMigrationRunbook(gateState, state)
    if (!evaluation.canSelectGo) {
      throw new Error('GO requires all critical preparation and preflight checks to pass')
    }
    return {
      ...state,
      decision: 'go',
    }
  }

  return {
    ...state,
    decision: 'no-go',
    executionState: 'stopped-no-go',
    completedAt: new Date().toISOString(),
  }
}

export function completeMigrationRunbook(
  gateState: GateState,
  state: MigrationRunbookState,
  now = new Date().toISOString(),
): MigrationRunbookState {
  const evaluation = evaluateMigrationRunbook(gateState, state)
  if (!evaluation.canComplete) {
    throw new Error('Migration cannot complete until every critical normal-flow verification passes')
  }

  return {
    ...state,
    executionState: 'completed',
    completedAt: now,
  }
}

export function completeRollback(
  gateState: GateState,
  state: MigrationRunbookState,
  now = new Date().toISOString(),
): MigrationRunbookState {
  if (gateState !== 'approval-recorded') {
    throw new Error('Rollback record is locked until OC-24 approval is recorded')
  }
  if (state.executionState !== 'rollback-required') {
    throw new Error('Rollback is not currently required')
  }

  const rollback = rollbackCriticalSteps()
  if (!rollback.every((step) => stepPassed(state, step.id))) {
    throw new Error('Rollback cannot close until every critical recovery step passes')
  }

  return {
    ...state,
    executionState: 'rolled-back',
    completedAt: now,
  }
}

export function sanitizeMigrationRunbook(
  value: Partial<MigrationRunbookState>,
): MigrationRunbookState {
  const empty = createEmptyMigrationRunbook()
  const allowedExecution: RunbookExecutionState[] = [
    'draft',
    'in-progress',
    'stopped-no-go',
    'rollback-required',
    'rolled-back',
    'completed',
  ]
  const allowedDecision: GoNoGoDecision[] = ['pending', 'go', 'no-go']

  const steps = { ...empty.steps }
  if (value.steps && typeof value.steps === 'object') {
    for (const definition of runbookSteps) {
      const candidate = value.steps[definition.id]
      if (!candidate) continue
      const status: RunbookStepStatus =
        candidate.status === 'passed' || candidate.status === 'failed'
          ? candidate.status
          : 'pending'
      steps[definition.id] = {
        status,
        evidence: typeof candidate.evidence === 'string' ? candidate.evidence : '',
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
      }
    }
  }

  return {
    ...empty,
    scheduledDate: typeof value.scheduledDate === 'string' ? value.scheduledDate : '',
    windowStart: typeof value.windowStart === 'string' ? value.windowStart : '',
    windowEnd: typeof value.windowEnd === 'string' ? value.windowEnd : '',
    leadOperator: typeof value.leadOperator === 'string' ? value.leadOperator : '',
    supportNote: typeof value.supportNote === 'string' ? value.supportNote : '',
    executionState: allowedExecution.includes(value.executionState as RunbookExecutionState)
      ? value.executionState as RunbookExecutionState
      : 'draft',
    decision: allowedDecision.includes(value.decision as GoNoGoDecision)
      ? value.decision as GoNoGoDecision
      : 'pending',
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
    steps,
  }
}

export function buildMigrationRunbookExport(
  state: MigrationRunbookState,
  gateState: GateState,
  generatedAt = new Date().toISOString(),
) {
  return {
    format: 'orbi-pos-migration-runbook-export/v1',
    business: 'Carnicería El Chunchito',
    generatedAt,
    productionGateState: gateState,
    runbook: state,
    safety: {
      containsCredentials: false,
      performsMigrationActions: false,
      warning: 'Operational record only. Do not store passwords, API tokens, card data or customer personal information.',
    },
  }
}
