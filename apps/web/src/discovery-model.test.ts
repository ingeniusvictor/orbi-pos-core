import { describe, expect, it } from 'vitest'
import {
  buildDiscoveryExport,
  discoveryReadiness,
  emptyFieldDiscovery,
  questionPack,
  type FieldDiscoveryRecord,
} from './discovery-model'

function completedRecord(): FieldDiscoveryRecord {
  return {
    sunmi: {
      ...emptyFieldDiscovery.sunmi,
      boletaPrints: 'yes',
      errorVisible: 'no',
      issueFrequency: 'intermittent',
      reporter: 'accountant',
      siiVerification: 'mixed',
      suspectedScope: 'unknown',
    },
    commercial: {
      ...emptyFieldDiscovery.commercial,
      sunmiArrangement: 'rented',
      fixedMonthlyCost: 100000,
      cardAcquirer: 'Proveedor verificado',
      cardFeePercent: 2.3,
      monthlyCardSales: 5000000,
    },
    scale: {
      ...emptyFieldDiscovery.scale,
      principalWorkflowObserved: 'yes',
      secondaryPropagation: 'unknown',
      managementSystemIdentified: 'unknown',
      pluExportAvailable: 'unknown',
      backupAvailable: 'yes',
    },
  }
}

describe('field discovery model', () => {
  it('starts incomplete and exposes concrete blockers instead of inferring answers', () => {
    const readiness = discoveryReadiness(emptyFieldDiscovery)

    expect(readiness.fiscalReady).toBe(false)
    expect(readiness.commercialReady).toBe(false)
    expect(readiness.scaleReady).toBe(false)
    expect(readiness.blockers.length).toBeGreaterThan(5)
  })

  it('treats explicit unknown as an answered field observation', () => {
    const readiness = discoveryReadiness(completedRecord())

    expect(readiness.fiscalReady).toBe(true)
    expect(readiness.commercialReady).toBe(true)
    expect(readiness.scaleReady).toBe(true)
  })

  it('exports only operational discovery with an explicit credential warning', () => {
    const exported = buildDiscoveryExport(
      completedRecord(),
      '2026-09-24T21:40:00.000Z',
    )

    expect(exported.format).toBe('orbi-pos-field-discovery/v1')
    expect(exported.knownFacts.scaleCount).toBe(4)
    expect(exported.knownFacts.scaleSynchronizationVerified).toBe(false)
    expect(exported.safety.containsCredentials).toBe(false)
    expect(JSON.stringify(exported)).not.toContain('accessToken')
  })

  it('generates only the questions that are still pending', () => {
    const questions = questionPack(emptyFieldDiscovery)
    expect(questions.length).toBeGreaterThan(7)

    const completed = questionPack(completedRecord())
    expect(completed).toHaveLength(0)
  })
})
