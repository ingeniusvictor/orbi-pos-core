import { describe, expect, it } from 'vitest'
import {
  bridgeDiscoveryToProposal,
  discoverySourceNote,
  emptyProposalBridgeSnapshot,
} from './proposal-bridge'
import { emptyFieldDiscovery, type FieldDiscoveryRecord } from './discovery-model'
import { emptyModernizationInputs } from './proposal-model'

function discoveryCommercial(
  overrides: Partial<FieldDiscoveryRecord['commercial']> = {},
): FieldDiscoveryRecord {
  return {
    ...emptyFieldDiscovery,
    commercial: {
      ...emptyFieldDiscovery.commercial,
      ...overrides,
    },
  }
}

describe('Discovery → Proposal bridge', () => {
  it('imports only available current-business values and never fills proposed assumptions', () => {
    const result = bridgeDiscoveryToProposal(
      emptyModernizationInputs,
      discoveryCommercial({
        fixedMonthlyCost: 125000,
        cardAcquirer: 'Proveedor actual',
        cardFeePercent: 2.4,
        monthlyCardSales: 6500000,
        evidenceNote: 'Factura septiembre',
      }),
      emptyProposalBridgeSnapshot,
      '2026-09-24T22:00:00.000Z',
    )

    expect(result.inputs.currentFixedMonthly).toBe(125000)
    expect(result.inputs.currentCardFeePercent).toBe(2.4)
    expect(result.inputs.monthlyCardSales).toBe(6500000)
    expect(result.inputs.currentSourceNote).toContain('Proveedor actual')
    expect(result.inputs.currentSourceNote).toContain('Factura septiembre')

    expect(result.inputs.proposedFixedMonthly).toBeNull()
    expect(result.inputs.proposedCardFeePercent).toBeNull()
    expect(result.inputs.pointDeviceCost).toBeNull()
    expect(result.status).toBe('synced')
  })

  it('keeps missing discovery numbers blank', () => {
    const result = bridgeDiscoveryToProposal(
      emptyModernizationInputs,
      discoveryCommercial({
        cardAcquirer: 'Proveedor conocido',
      }),
      emptyProposalBridgeSnapshot,
      '2026-09-24T22:00:00.000Z',
    )

    expect(result.inputs.currentFixedMonthly).toBeNull()
    expect(result.inputs.currentCardFeePercent).toBeNull()
    expect(result.inputs.monthlyCardSales).toBeNull()
    expect(result.status).toBe('partial')
  })

  it('updates a field again while the proposal still contains the prior imported value', () => {
    const first = bridgeDiscoveryToProposal(
      emptyModernizationInputs,
      discoveryCommercial({
        fixedMonthlyCost: 100000,
        cardFeePercent: 2.5,
        monthlyCardSales: 5000000,
      }),
      emptyProposalBridgeSnapshot,
      '2026-09-24T22:00:00.000Z',
    )

    const second = bridgeDiscoveryToProposal(
      first.inputs,
      discoveryCommercial({
        fixedMonthlyCost: 110000,
        cardFeePercent: 2.3,
        monthlyCardSales: 5200000,
      }),
      first.snapshot,
      '2026-09-24T22:05:00.000Z',
    )

    expect(second.inputs.currentFixedMonthly).toBe(110000)
    expect(second.inputs.currentCardFeePercent).toBe(2.3)
    expect(second.inputs.monthlyCardSales).toBe(5200000)
    expect(second.preservedManualFields).toHaveLength(0)
  })

  it('preserves manual proposal overrides when discovery later changes', () => {
    const first = bridgeDiscoveryToProposal(
      emptyModernizationInputs,
      discoveryCommercial({
        fixedMonthlyCost: 100000,
        cardFeePercent: 2.5,
        monthlyCardSales: 5000000,
      }),
      emptyProposalBridgeSnapshot,
      '2026-09-24T22:00:00.000Z',
    )

    const manuallyEdited = {
      ...first.inputs,
      currentFixedMonthly: 99000,
      currentSourceNote: 'Factura revisada directamente por el dueño',
    }

    const second = bridgeDiscoveryToProposal(
      manuallyEdited,
      discoveryCommercial({
        fixedMonthlyCost: 110000,
        cardAcquirer: 'Proveedor nuevo',
        cardFeePercent: 2.3,
        monthlyCardSales: 5200000,
        evidenceNote: 'Nueva cartola',
      }),
      first.snapshot,
      '2026-09-24T22:05:00.000Z',
    )

    expect(second.inputs.currentFixedMonthly).toBe(99000)
    expect(second.inputs.currentCardFeePercent).toBe(2.3)
    expect(second.inputs.monthlyCardSales).toBe(5200000)
    expect(second.inputs.currentSourceNote).toBe('Factura revisada directamente por el dueño')
    expect(second.status).toBe('manual-overrides')
    expect(second.preservedManualFields).toContain('Costo fijo mensual actual')
    expect(second.preservedManualFields).toContain('Fuente / respaldo actual')
  })

  it('builds a readable evidence note without sensitive-data fields', () => {
    const note = discoverySourceNote(discoveryCommercial({
      sunmiArrangement: 'rented',
      cardAcquirer: 'Adquirente verificado',
      evidenceNote: 'Factura + cartola revisadas',
    }))

    expect(note).toBe(
      'Levantamiento ORBI · Adquirente: Adquirente verificado · SUNMI arrendada · Evidencia: Factura + cartola revisadas',
    )
    expect(note).not.toContain('token')
    expect(note).not.toContain('password')
  })
})
