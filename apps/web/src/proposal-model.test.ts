import { describe, expect, it } from 'vitest'
import {
  calculateModernization,
  emptyModernizationInputs,
  parseOptionalNumber,
} from './proposal-model'

describe('modernization proposal calculator', () => {
  it('does not claim savings until the required real inputs exist', () => {
    const result = calculateModernization(emptyModernizationInputs)

    expect(result.ready).toBe(false)
    expect(result.outcome).toBe('incomplete')
    expect(result.monthlyDifference).toBeNull()
    expect(result.missing).toContain('Costo fijo mensual actual')
  })

  it('calculates monthly, annual and payback values from supplied assumptions', () => {
    const result = calculateModernization({
      currentFixedMonthly: 100000,
      currentCardFeePercent: 2.5,
      monthlyCardSales: 8000000,
      proposedFixedMonthly: 50000,
      proposedCardFeePercent: 2,
      pointDeviceCost: 50000,
      showcaseTvCost: 250000,
      miniPcCost: 150000,
      currentSourceNote: 'Factura actual',
      proposedSourceNote: 'Cotización vigente',
    })

    expect(result.ready).toBe(true)
    expect(result.currentMonthlyCost).toBe(300000)
    expect(result.proposedMonthlyCost).toBe(210000)
    expect(result.monthlyDifference).toBe(90000)
    expect(result.annualDifference).toBe(1080000)
    expect(result.initialInvestment).toBe(450000)
    expect(result.paybackMonths).toBe(5)
    expect(result.outcome).toBe('saving')
  })

  it('reports an increase instead of forcing a positive recommendation', () => {
    const result = calculateModernization({
      currentFixedMonthly: 10000,
      currentCardFeePercent: 1.5,
      monthlyCardSales: 2000000,
      proposedFixedMonthly: 30000,
      proposedCardFeePercent: 2.5,
      pointDeviceCost: null,
      showcaseTvCost: null,
      miniPcCost: null,
      currentSourceNote: '',
      proposedSourceNote: '',
    })

    expect(result.outcome).toBe('increase')
    expect(result.monthlyDifference).toBeLessThan(0)
    expect(result.paybackMonths).toBeNull()
  })

  it('parses Chilean-style money inputs', () => {
    expect(parseOptionalNumber('$49.900')).toBe(49900)
    expect(parseOptionalNumber('2,19')).toBe(2.19)
    expect(parseOptionalNumber('')).toBeNull()
  })
})
