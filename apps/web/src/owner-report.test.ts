import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { emptyFieldDiscovery } from './discovery-model'
import { buildOwnerPilotReport } from './owner-report'
import { emptyModernizationInputs } from './proposal-model'

const product: Product = {
  id: 'p1',
  code: '101',
  categoryId: 'pork',
  name: 'Pernil',
  price: 4898,
  unitType: 'KG',
  active: true,
  showOnShowcase: true,
  featured: true,
  sortOrder: 1,
}

describe('owner pilot report', () => {
  it('never claims economic savings while required inputs are incomplete', () => {
    const report = buildOwnerPilotReport(
      [product],
      emptyFieldDiscovery,
      emptyModernizationInputs,
    )

    expect(report.economicHeadline).toBe('pending')
    expect(report.currentMonthlyCost).toBeNull()
    expect(report.proposedMonthlyCost).toBeNull()
  })

  it('reports lower estimated cost only from complete supplied assumptions', () => {
    const proposal = {
      ...emptyModernizationInputs,
      currentFixedMonthly: 100000,
      currentCardFeePercent: 2.5,
      monthlyCardSales: 8000000,
      proposedFixedMonthly: 50000,
      proposedCardFeePercent: 2,
      pointDeviceCost: 50000,
      showcaseTvCost: 250000,
      miniPcCost: 150000,
    }

    const report = buildOwnerPilotReport(
      [product],
      emptyFieldDiscovery,
      proposal,
    )

    expect(report.economicHeadline).toBe('lower-estimated-cost')
    expect(report.currentMonthlyCost).toBe(300000)
    expect(report.proposedMonthlyCost).toBe(210000)
    expect(report.monthlyDifference).toBe(90000)
    expect(report.paybackMonths).toBe(5)
  })

  it('keeps field readiness independent from software demo readiness', () => {
    const report = buildOwnerPilotReport(
      [product],
      emptyFieldDiscovery,
      emptyModernizationInputs,
    )

    expect(report.demoReadyCount).toBeGreaterThan(report.fieldReadyCount)
    expect(report.fiscalDiscoveryComplete).toBe(false)
    expect(report.blockers.length).toBeGreaterThan(0)
  })
})
