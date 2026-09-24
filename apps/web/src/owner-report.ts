import type { Product } from './domain'
import type { FieldDiscoveryRecord } from './discovery-model'
import { discoveryReadiness } from './discovery-model'
import type { ModernizationInputs } from './proposal-model'
import { calculateModernization } from './proposal-model'
import { buildPilotReadiness } from './pilot-readiness'

export type EconomicHeadline =
  | 'pending'
  | 'lower-estimated-cost'
  | 'higher-estimated-cost'
  | 'equivalent-estimated-cost'

export interface OwnerPilotReport {
  demoReadyCount: number
  demoTotal: number
  fieldReadyCount: number
  fieldTotal: number
  economicHeadline: EconomicHeadline
  currentMonthlyCost: number | null
  proposedMonthlyCost: number | null
  monthlyDifference: number | null
  annualDifference: number | null
  paybackMonths: number | null
  commercialSource: string
  fiscalDiscoveryComplete: boolean
  commercialDiscoveryComplete: boolean
  scaleDiscoveryComplete: boolean
  blockers: string[]
}

export function buildOwnerPilotReport(
  products: Product[],
  discovery: FieldDiscoveryRecord,
  proposal: ModernizationInputs,
): OwnerPilotReport {
  const readiness = buildPilotReadiness(products, discovery, proposal)
  const discoveryState = discoveryReadiness(discovery)
  const economics = calculateModernization(proposal)

  let economicHeadline: EconomicHeadline = 'pending'
  if (economics.ready) {
    if (economics.outcome === 'saving') economicHeadline = 'lower-estimated-cost'
    else if (economics.outcome === 'increase') economicHeadline = 'higher-estimated-cost'
    else economicHeadline = 'equivalent-estimated-cost'
  }

  return {
    demoReadyCount: readiness.demoReadyCount,
    demoTotal: readiness.demoTotal,
    fieldReadyCount: readiness.fieldReadyCount,
    fieldTotal: readiness.fieldTotal,
    economicHeadline,
    currentMonthlyCost: economics.currentMonthlyCost,
    proposedMonthlyCost: economics.proposedMonthlyCost,
    monthlyDifference: economics.monthlyDifference,
    annualDifference: economics.annualDifference,
    paybackMonths: economics.paybackMonths,
    commercialSource: proposal.currentSourceNote.trim(),
    fiscalDiscoveryComplete: discoveryState.fiscalReady,
    commercialDiscoveryComplete: discoveryState.commercialReady,
    scaleDiscoveryComplete: discoveryState.scaleReady,
    blockers: discoveryState.blockers,
  }
}
