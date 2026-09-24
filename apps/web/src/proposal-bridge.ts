import {
  emptyFieldDiscovery,
  type FieldDiscoveryRecord,
  type SunmiArrangement,
} from './discovery-model'
import type { ModernizationInputs } from './proposal-model'

export const DISCOVERY_STORAGE_KEY = 'orbi-pos:field-discovery'
export const PROPOSAL_BRIDGE_STORAGE_KEY = 'orbi-pos:proposal-bridge'

export interface ProposalBridgeSnapshot {
  currentFixedMonthly: number | null
  currentCardFeePercent: number | null
  monthlyCardSales: number | null
  currentSourceNote: string
  syncedAt: string | null
}

export type ProposalBridgeStatus =
  | 'empty'
  | 'partial'
  | 'synced'
  | 'manual-overrides'

export interface ProposalBridgeResult {
  inputs: ModernizationInputs
  snapshot: ProposalBridgeSnapshot
  status: ProposalBridgeStatus
  importedFields: string[]
  preservedManualFields: string[]
  availableRequired: number
  totalRequired: number
}

export const emptyProposalBridgeSnapshot: ProposalBridgeSnapshot = {
  currentFixedMonthly: null,
  currentCardFeePercent: null,
  monthlyCardSales: null,
  currentSourceNote: '',
  syncedAt: null,
}

function validNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0
}

function arrangementLabel(value: SunmiArrangement): string | null {
  if (value === 'purchased') return 'SUNMI comprada'
  if (value === 'rented') return 'SUNMI arrendada'
  if (value === 'bundled') return 'SUNMI incluida en otro servicio'
  if (value === 'unknown') return 'modalidad SUNMI consultada, aún no determinada'
  return null
}

export function discoverySourceNote(record: FieldDiscoveryRecord): string {
  const parts = ['Levantamiento ORBI']

  if (record.commercial.cardAcquirer.trim()) {
    parts.push(`Adquirente: ${record.commercial.cardAcquirer.trim()}`)
  }

  const arrangement = arrangementLabel(record.commercial.sunmiArrangement)
  if (arrangement) parts.push(arrangement)

  if (record.commercial.evidenceNote.trim()) {
    parts.push(`Evidencia: ${record.commercial.evidenceNote.trim()}`)
  }

  return parts.length > 1 ? parts.join(' · ') : ''
}

function mergeNumber(
  current: number | null,
  previousImported: number | null,
  incoming: number | null,
): { value: number | null; imported: boolean; manual: boolean } {
  if (!validNumber(incoming)) {
    return { value: current, imported: false, manual: false }
  }

  if (current === null || current === previousImported) {
    return {
      value: incoming,
      imported: current !== incoming,
      manual: false,
    }
  }

  return {
    value: current,
    imported: false,
    manual: current !== incoming,
  }
}

function mergeText(
  current: string,
  previousImported: string,
  incoming: string,
): { value: string; imported: boolean; manual: boolean } {
  if (!incoming) {
    return { value: current, imported: false, manual: false }
  }

  if (!current.trim() || current === previousImported) {
    return {
      value: incoming,
      imported: current !== incoming,
      manual: false,
    }
  }

  return {
    value: current,
    imported: false,
    manual: current !== incoming,
  }
}

export function bridgeDiscoveryToProposal(
  current: ModernizationInputs,
  discovery: FieldDiscoveryRecord,
  previous: ProposalBridgeSnapshot = emptyProposalBridgeSnapshot,
  syncedAt = new Date().toISOString(),
): ProposalBridgeResult {
  const source = {
    currentFixedMonthly: validNumber(discovery.commercial.fixedMonthlyCost)
      ? discovery.commercial.fixedMonthlyCost
      : null,
    currentCardFeePercent: validNumber(discovery.commercial.cardFeePercent)
      ? discovery.commercial.cardFeePercent
      : null,
    monthlyCardSales: validNumber(discovery.commercial.monthlyCardSales)
      ? discovery.commercial.monthlyCardSales
      : null,
    currentSourceNote: discoverySourceNote(discovery),
  }

  const fixed = mergeNumber(
    current.currentFixedMonthly,
    previous.currentFixedMonthly,
    source.currentFixedMonthly,
  )
  const fee = mergeNumber(
    current.currentCardFeePercent,
    previous.currentCardFeePercent,
    source.currentCardFeePercent,
  )
  const sales = mergeNumber(
    current.monthlyCardSales,
    previous.monthlyCardSales,
    source.monthlyCardSales,
  )
  const note = mergeText(
    current.currentSourceNote,
    previous.currentSourceNote,
    source.currentSourceNote,
  )

  const importedFields: string[] = []
  const preservedManualFields: string[] = []

  if (fixed.imported) importedFields.push('Costo fijo mensual actual')
  if (fee.imported) importedFields.push('Comisión promedio actual')
  if (sales.imported) importedFields.push('Ventas mensuales con tarjeta')
  if (note.imported) importedFields.push('Fuente / respaldo actual')

  if (fixed.manual) preservedManualFields.push('Costo fijo mensual actual')
  if (fee.manual) preservedManualFields.push('Comisión promedio actual')
  if (sales.manual) preservedManualFields.push('Ventas mensuales con tarjeta')
  if (note.manual) preservedManualFields.push('Fuente / respaldo actual')

  const availableRequired = [
    source.currentFixedMonthly,
    source.currentCardFeePercent,
    source.monthlyCardSales,
  ].filter(validNumber).length

  const hasAnySource = availableRequired > 0 || Boolean(source.currentSourceNote)

  let status: ProposalBridgeStatus = 'empty'
  if (hasAnySource) {
    status = availableRequired === 3 ? 'synced' : 'partial'
  }
  if (preservedManualFields.length) {
    status = 'manual-overrides'
  }

  const snapshot: ProposalBridgeSnapshot = {
    ...source,
    syncedAt: hasAnySource ? syncedAt : previous.syncedAt,
  }

  return {
    inputs: {
      ...current,
      currentFixedMonthly: fixed.value,
      currentCardFeePercent: fee.value,
      monthlyCardSales: sales.value,
      currentSourceNote: note.value,
    },
    snapshot,
    status,
    importedFields,
    preservedManualFields,
    availableRequired,
    totalRequired: 3,
  }
}

export function loadDiscoveryForBridge(): FieldDiscoveryRecord {
  if (typeof localStorage === 'undefined') return emptyFieldDiscovery

  try {
    const raw = localStorage.getItem(DISCOVERY_STORAGE_KEY)
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

export function loadProposalBridgeSnapshot(): ProposalBridgeSnapshot {
  if (typeof localStorage === 'undefined') return emptyProposalBridgeSnapshot

  try {
    const raw = localStorage.getItem(PROPOSAL_BRIDGE_STORAGE_KEY)
    if (!raw) return emptyProposalBridgeSnapshot
    return {
      ...emptyProposalBridgeSnapshot,
      ...JSON.parse(raw),
    } as ProposalBridgeSnapshot
  } catch {
    return emptyProposalBridgeSnapshot
  }
}

export function saveProposalBridgeSnapshot(snapshot: ProposalBridgeSnapshot) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PROPOSAL_BRIDGE_STORAGE_KEY, JSON.stringify(snapshot))
}
