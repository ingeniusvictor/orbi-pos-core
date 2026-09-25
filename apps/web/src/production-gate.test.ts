import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { emptyFieldDiscovery } from './discovery-model'
import { emptyModernizationInputs } from './proposal-model'
import {
  emptyManualGateEvidence,
  evaluateProductionGate,
  sanitizeManualGateEvidence,
} from './production-gate'

const product: Product = {
  id: 'p1',
  code: '101',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
  plu: '0047',
  active: true,
  showOnShowcase: true,
  featured: true,
  sortOrder: 1,
}

function readyDiscovery() {
  return {
    ...emptyFieldDiscovery,
    sunmi: {
      ...emptyFieldDiscovery.sunmi,
      boletaPrints: 'yes' as const,
      errorVisible: 'yes' as const,
      issueFrequency: 'intermittent' as const,
      reporter: 'staff' as const,
      siiVerification: 'mixed' as const,
      suspectedScope: 'unknown' as const,
    },
    commercial: {
      ...emptyFieldDiscovery.commercial,
      sunmiArrangement: 'rented' as const,
      fixedMonthlyCost: 100000,
      cardAcquirer: 'Proveedor actual',
      cardFeePercent: 2.5,
      monthlyCardSales: 8000000,
    },
    scale: {
      ...emptyFieldDiscovery.scale,
      principalWorkflowObserved: 'yes' as const,
      secondaryPropagation: 'no' as const,
      managementSystemIdentified: 'yes' as const,
      pluExportAvailable: 'yes' as const,
      backupAvailable: 'yes' as const,
    },
  }
}

const readyProposal = {
  ...emptyModernizationInputs,
  currentFixedMonthly: 100000,
  currentCardFeePercent: 2.5,
  monthlyCardSales: 8000000,
  proposedFixedMonthly: 50000,
  proposedCardFeePercent: 2,
}

describe('production decision gate', () => {
  it('starts blocked when field evidence is missing', () => {
    const result = evaluateProductionGate(
      [product],
      emptyFieldDiscovery,
      emptyModernizationInputs,
      emptyManualGateEvidence,
    )

    expect(result.state).toBe('blocked')
    expect(result.ownerApprovalEligible).toBe(false)
    expect(result.blockers.length).toBeGreaterThan(3)
  })

  it('does not require ORBI to be cheaper, only that economics are calculable', () => {
    const expensiveProposal = {
      ...readyProposal,
      proposedFixedMonthly: 400000,
      proposedCardFeePercent: 3,
    }

    const manual = {
      ...emptyManualGateEvidence,
      fiscalPath: 'retain-current-verified' as const,
      fiscalNote: 'Flujo actual revisado',
      physicalPointTestPassed: true,
      physicalPointNote: 'Pago físico de prueba controlado',
      rollbackPlanReady: true,
      rollbackPlanNote: 'Plan de reversa documentado',
    }

    const result = evaluateProductionGate(
      [product],
      readyDiscovery(),
      expensiveProposal,
      manual,
    )

    expect(result.ownerApprovalEligible).toBe(true)
    expect(result.state).toBe('ready-for-owner-decision')
  })

  it('requires an evidence note for each manual technical gate', () => {
    const manual = {
      ...emptyManualGateEvidence,
      fiscalPath: 'retain-current-verified' as const,
      fiscalNote: '',
      physicalPointTestPassed: true,
      physicalPointNote: '',
      rollbackPlanReady: true,
      rollbackPlanNote: '',
    }

    const result = evaluateProductionGate(
      [product],
      readyDiscovery(),
      readyProposal,
      manual,
    )

    expect(result.state).toBe('blocked')
    expect(result.manualChecks.filter((check) => check.passed)).toHaveLength(0)
  })

  it('only records final approval after all prerequisites are ready', () => {
    const manual = {
      ...emptyManualGateEvidence,
      fiscalPath: 'new-flow-validated' as const,
      fiscalNote: 'Ruta fiscal validada en ambiente controlado',
      physicalPointTestPassed: true,
      physicalPointNote: 'Terminal física aprobó transacción de prueba',
      rollbackPlanReady: true,
      rollbackPlanNote: 'Retorno a flujo anterior documentado',
      ownerApprovalRecorded: true,
      ownerApprovalNote: 'Dueña aprobó avanzar a piloto controlado',
    }

    const result = evaluateProductionGate(
      [product],
      readyDiscovery(),
      readyProposal,
      manual,
    )

    expect(result.ownerApprovalEligible).toBe(true)
    expect(result.state).toBe('approval-recorded')
    expect(result.blockers).toHaveLength(0)
  })

  it('does not count owner approval when technical prerequisites are missing', () => {
    const manual = {
      ...emptyManualGateEvidence,
      ownerApprovalRecorded: true,
      ownerApprovalNote: 'Aprobación registrada',
    }

    const result = evaluateProductionGate(
      [product],
      emptyFieldDiscovery,
      emptyModernizationInputs,
      manual,
    )

    expect(result.state).toBe('blocked')
    expect(result.ownerApprovalEligible).toBe(false)
  })

  it('sanitizes unknown persisted values', () => {
    const sanitized = sanitizeManualGateEvidence({
      fiscalPath: 'pending',
      fiscalNote: 'ok',
      physicalPointTestPassed: true,
      ownerApprovalRecorded: true,
      updatedAt: '2026-09-25T01:00:00.000Z',
    })

    expect(sanitized.fiscalPath).toBe('pending')
    expect(sanitized.physicalPointTestPassed).toBe(true)
    expect(sanitized.rollbackPlanReady).toBe(false)
    expect(sanitized.updatedAt).toBe('2026-09-25T01:00:00.000Z')
  })
})
