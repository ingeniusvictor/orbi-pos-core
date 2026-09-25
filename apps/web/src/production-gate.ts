import type { Product } from './domain'
import type { FieldDiscoveryRecord } from './discovery-model'
import { discoveryReadiness } from './discovery-model'
import type { ModernizationInputs } from './proposal-model'
import { calculateModernization } from './proposal-model'

export type GateState = 'blocked' | 'ready-for-owner-decision' | 'approval-recorded'

export type FiscalProductionPath =
  | 'pending'
  | 'retain-current-verified'
  | 'new-flow-validated'

export interface ManualGateEvidence {
  fiscalPath: FiscalProductionPath
  fiscalNote: string
  physicalPointTestPassed: boolean
  physicalPointNote: string
  rollbackPlanReady: boolean
  rollbackPlanNote: string
  ownerApprovalRecorded: boolean
  ownerApprovalNote: string
  updatedAt: string | null
}

export const emptyManualGateEvidence: ManualGateEvidence = {
  fiscalPath: 'pending',
  fiscalNote: '',
  physicalPointTestPassed: false,
  physicalPointNote: '',
  rollbackPlanReady: false,
  rollbackPlanNote: '',
  ownerApprovalRecorded: false,
  ownerApprovalNote: '',
  updatedAt: null,
}

export interface GateCheck {
  id: string
  label: string
  detail: string
  passed: boolean
  group: 'automatic' | 'manual'
}

export interface ProductionGateResult {
  state: GateState
  automaticChecks: GateCheck[]
  manualChecks: GateCheck[]
  prerequisiteCount: number
  prerequisitePassed: number
  ownerApprovalEligible: boolean
  blockers: string[]
}

function activeProducts(products: Product[]) {
  return products.filter((product) => product.active)
}

function validPlu(product: Product) {
  return Boolean(product.plu && /^\d{1,6}$/.test(product.plu))
}

function evidenceTextReady(value: string) {
  return value.trim().length >= 4
}

export function evaluateProductionGate(
  products: Product[],
  discovery: FieldDiscoveryRecord,
  proposal: ModernizationInputs,
  manual: ManualGateEvidence,
): ProductionGateResult {
  const active = activeProducts(products)
  const discoveryState = discoveryReadiness(discovery)
  const economics = calculateModernization(proposal)

  const catalogReady = active.length > 0
  const pluReady = catalogReady && active.every(validPlu)
  const principalWorkflowReady = discovery.scale.principalWorkflowObserved === 'yes'
  const secondaryObserved =
    discovery.scale.secondaryPropagation === 'yes'
    || discovery.scale.secondaryPropagation === 'no'
  const backupConfirmed = discovery.scale.backupAvailable === 'yes'

  const automaticChecks: GateCheck[] = [
    {
      id: 'catalog',
      label: 'Catálogo real activo',
      detail: catalogReady
        ? `${active.length} producto(s) activo(s) disponibles.`
        : 'No hay productos activos en el catálogo real.',
      passed: catalogReady,
      group: 'automatic',
    },
    {
      id: 'plu',
      label: 'PLU reales completos',
      detail: pluReady
        ? 'Todos los productos activos tienen un PLU numérico documentado.'
        : 'Uno o más productos activos todavía no tienen PLU real documentado.',
      passed: pluReady,
      group: 'automatic',
    },
    {
      id: 'rm60-principal',
      label: 'Flujo principal RM-60 observado',
      detail: principalWorkflowReady
        ? 'El procedimiento real de cambio de precio en la balanza principal fue observado.'
        : 'Falta observar el procedimiento real de cambio de precio.',
      passed: principalWorkflowReady,
      group: 'automatic',
    },
    {
      id: 'rm60-secondary',
      label: 'Comportamiento de las 3 RM-60 secundarias observado',
      detail: secondaryObserved
        ? 'Se registró si las otras tres balanzas propagan o no el cambio.'
        : 'Falta comprobar qué ocurre en las otras tres balanzas.',
      passed: secondaryObserved,
      group: 'automatic',
    },
    {
      id: 'rm60-backup',
      label: 'Respaldo recuperable RM-60 confirmado',
      detail: backupConfirmed
        ? 'Existe un respaldo/exportación recuperable confirmado antes de cualquier cambio sensible.'
        : 'No hay confirmación positiva de un respaldo recuperable.',
      passed: backupConfirmed,
      group: 'automatic',
    },
    {
      id: 'fiscal-discovery',
      label: 'Levantamiento SUNMI / Inputsoft / SII completo',
      detail: discoveryState.fiscalReady
        ? 'Las preguntas mínimas están respondidas. Esto no equivale por sí solo a aprobación tributaria.'
        : `${discoveryState.fiscalAnswered}/${discoveryState.fiscalTotal} respuestas mínimas registradas.`,
      passed: discoveryState.fiscalReady,
      group: 'automatic',
    },
    {
      id: 'commercial',
      label: 'Línea base comercial completa',
      detail: discoveryState.commercialReady
        ? 'Costos, adquirente, comisión y volumen tienen respuestas explícitas.'
        : `${discoveryState.commercialAnswered}/${discoveryState.commercialTotal} datos mínimos registrados.`,
      passed: discoveryState.commercialReady,
      group: 'automatic',
    },
    {
      id: 'economics',
      label: 'Comparación económica calculable',
      detail: economics.ready
        ? 'Hay datos suficientes para comparar costos. No se exige que ORBI sea más barato.'
        : `Faltan: ${economics.missing.join(' · ')}`,
      passed: economics.ready,
      group: 'automatic',
    },
  ]

  const fiscalEvidenceReady =
    manual.fiscalPath !== 'pending'
    && evidenceTextReady(manual.fiscalNote)

  const pointEvidenceReady =
    manual.physicalPointTestPassed
    && evidenceTextReady(manual.physicalPointNote)

  const rollbackEvidenceReady =
    manual.rollbackPlanReady
    && evidenceTextReady(manual.rollbackPlanNote)

  const ownerEvidenceReady =
    manual.ownerApprovalRecorded
    && evidenceTextReady(manual.ownerApprovalNote)

  const manualChecks: GateCheck[] = [
    {
      id: 'fiscal-path',
      label: 'Ruta fiscal de producción validada',
      detail: fiscalEvidenceReady
        ? manual.fiscalPath === 'retain-current-verified'
          ? 'Se registró mantener el flujo fiscal actual y verificarlo antes de la migración.'
          : 'Se registró una nueva ruta fiscal validada para producción.'
        : 'Debe definirse la ruta fiscal de producción y dejar evidencia no sensible.',
      passed: fiscalEvidenceReady,
      group: 'manual',
    },
    {
      id: 'point-physical',
      label: 'Point Smart 2 física probada',
      detail: pointEvidenceReady
        ? 'Existe evidencia operativa de una prueba física controlada.'
        : 'La simulación no reemplaza una prueba física real.',
      passed: pointEvidenceReady,
      group: 'manual',
    },
    {
      id: 'rollback',
      label: 'Plan de reversa documentado',
      detail: rollbackEvidenceReady
        ? 'Existe un plan para volver al flujo seguro anterior si el piloto real falla.'
        : 'Debe documentarse cómo recuperar la operación si la migración falla.',
      passed: rollbackEvidenceReady,
      group: 'manual',
    },
    {
      id: 'owner-approval',
      label: 'Decisión de la dueña registrada',
      detail: ownerEvidenceReady
        ? 'La aprobación fue registrada con una nota de evidencia.'
        : 'ORBI no toma esta decisión: la aprobación final debe quedar registrada por el negocio.',
      passed: ownerEvidenceReady,
      group: 'manual',
    },
  ]

  const automaticReady = automaticChecks.every((check) => check.passed)
  const manualTechnicalReady = manualChecks
    .filter((check) => check.id !== 'owner-approval')
    .every((check) => check.passed)

  const ownerApprovalEligible = automaticReady && manualTechnicalReady

  let state: GateState = 'blocked'
  if (ownerApprovalEligible) state = 'ready-for-owner-decision'
  if (ownerApprovalEligible && ownerEvidenceReady) state = 'approval-recorded'

  const prerequisiteChecks = [
    ...automaticChecks,
    ...manualChecks.filter((check) => check.id !== 'owner-approval'),
  ]

  const blockers = prerequisiteChecks
    .filter((check) => !check.passed)
    .map((check) => check.label)

  if (ownerApprovalEligible && !ownerEvidenceReady) {
    blockers.push('Decisión de la dueña todavía no registrada')
  }

  return {
    state,
    automaticChecks,
    manualChecks,
    prerequisiteCount: prerequisiteChecks.length,
    prerequisitePassed: prerequisiteChecks.filter((check) => check.passed).length,
    ownerApprovalEligible,
    blockers,
  }
}

export function sanitizeManualGateEvidence(
  value: Partial<ManualGateEvidence>,
): ManualGateEvidence {
  return {
    fiscalPath:
      value.fiscalPath === 'retain-current-verified'
      || value.fiscalPath === 'new-flow-validated'
        ? value.fiscalPath
        : 'pending',
    fiscalNote: typeof value.fiscalNote === 'string' ? value.fiscalNote : '',
    physicalPointTestPassed: value.physicalPointTestPassed === true,
    physicalPointNote: typeof value.physicalPointNote === 'string' ? value.physicalPointNote : '',
    rollbackPlanReady: value.rollbackPlanReady === true,
    rollbackPlanNote: typeof value.rollbackPlanNote === 'string' ? value.rollbackPlanNote : '',
    ownerApprovalRecorded: value.ownerApprovalRecorded === true,
    ownerApprovalNote: typeof value.ownerApprovalNote === 'string' ? value.ownerApprovalNote : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  }
}
