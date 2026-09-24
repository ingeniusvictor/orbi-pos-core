import { describe, expect, it } from 'vitest'
import type { Product } from './domain'
import { emptyFieldDiscovery } from './discovery-model'
import { emptyModernizationInputs } from './proposal-model'
import { buildPilotReadiness } from './pilot-readiness'

const baseProduct: Product = {
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

describe('pilot readiness', () => {
  it('separates demo readiness from real field validation', () => {
    const result = buildPilotReadiness(
      [baseProduct],
      emptyFieldDiscovery,
      emptyModernizationInputs,
    )

    expect(result.demoReadyCount).toBeGreaterThan(2)
    expect(result.fieldReadyCount).toBe(0)
    expect(result.fieldItems.find((item) => item.id === 'plu')?.tone).toBe('pending')
    expect(result.fieldItems.find((item) => item.id === 'real-point')?.tone).toBe('pending')
  })

  it('marks PLU coverage ready only when every active product has a numeric PLU', () => {
    const result = buildPilotReadiness(
      [
        { ...baseProduct, plu: '0047' },
        { ...baseProduct, id: 'p2', code: '102', name: 'Orejas', plu: '0048' },
      ],
      emptyFieldDiscovery,
      emptyModernizationInputs,
    )

    expect(result.fieldItems.find((item) => item.id === 'plu')?.tone).toBe('ready')
  })

  it('does not count an explicit unknown scale propagation answer as observed topology', () => {
    const discovery = {
      ...emptyFieldDiscovery,
      scale: {
        ...emptyFieldDiscovery.scale,
        principalWorkflowObserved: 'yes' as const,
        secondaryPropagation: 'unknown' as const,
      },
    }

    const result = buildPilotReadiness([baseProduct], discovery, emptyModernizationInputs)

    expect(result.fieldItems.find((item) => item.id === 'scale-topology')?.tone).toBe('pending')
  })

  it('marks economic comparison ready only when both current and proposed minimums exist', () => {
    const proposal = {
      ...emptyModernizationInputs,
      currentFixedMonthly: 100000,
      currentCardFeePercent: 2.4,
      monthlyCardSales: 6000000,
      proposedFixedMonthly: 50000,
      proposedCardFeePercent: 2.1,
    }

    const result = buildPilotReadiness([baseProduct], emptyFieldDiscovery, proposal)

    expect(result.demoItems.find((item) => item.id === 'proposal')?.tone).toBe('ready')
  })
})
