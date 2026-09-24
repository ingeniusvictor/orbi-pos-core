export interface ModernizationInputs {
  currentFixedMonthly: number | null
  currentCardFeePercent: number | null
  monthlyCardSales: number | null
  proposedFixedMonthly: number | null
  proposedCardFeePercent: number | null
  pointDeviceCost: number | null
  showcaseTvCost: number | null
  miniPcCost: number | null
  currentSourceNote: string
  proposedSourceNote: string
}

export type ModernizationOutcome = 'incomplete' | 'saving' | 'increase' | 'equal'

export interface ModernizationResult {
  ready: boolean
  outcome: ModernizationOutcome
  missing: string[]
  currentMonthlyCost: number | null
  proposedMonthlyCost: number | null
  monthlyDifference: number | null
  annualDifference: number | null
  initialInvestment: number
  paybackMonths: number | null
}

export const emptyModernizationInputs: ModernizationInputs = {
  currentFixedMonthly: null,
  currentCardFeePercent: null,
  monthlyCardSales: null,
  proposedFixedMonthly: null,
  proposedCardFeePercent: null,
  pointDeviceCost: null,
  showcaseTvCost: null,
  miniPcCost: null,
  currentSourceNote: '',
  proposedSourceNote: '',
}

function validMoney(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0
}

function validPercent(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100
}

export function calculateModernization(
  input: ModernizationInputs,
): ModernizationResult {
  const missing: string[] = []

  if (!validMoney(input.currentFixedMonthly)) missing.push('Costo fijo mensual actual')
  if (!validPercent(input.currentCardFeePercent)) missing.push('Comisión promedio actual')
  if (!validMoney(input.monthlyCardSales)) missing.push('Ventas mensuales con tarjeta')
  if (!validMoney(input.proposedFixedMonthly)) missing.push('Costo fijo mensual propuesto')
  if (!validPercent(input.proposedCardFeePercent)) missing.push('Comisión promedio propuesta')

  const initialInvestment = [
    input.pointDeviceCost,
    input.showcaseTvCost,
    input.miniPcCost,
  ].reduce<number>((sum, value) => {
    const amount = typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : 0
    return sum + amount
  }, 0)

  if (missing.length) {
    return {
      ready: false,
      outcome: 'incomplete',
      missing,
      currentMonthlyCost: null,
      proposedMonthlyCost: null,
      monthlyDifference: null,
      annualDifference: null,
      initialInvestment,
      paybackMonths: null,
    }
  }

  const cardSales = input.monthlyCardSales ?? 0
  const currentMonthlyCost =
    (input.currentFixedMonthly ?? 0)
    + cardSales * ((input.currentCardFeePercent ?? 0) / 100)

  const proposedMonthlyCost =
    (input.proposedFixedMonthly ?? 0)
    + cardSales * ((input.proposedCardFeePercent ?? 0) / 100)

  const monthlyDifference = currentMonthlyCost - proposedMonthlyCost
  const annualDifference = monthlyDifference * 12

  let outcome: ModernizationOutcome = 'equal'
  if (monthlyDifference > 0.5) outcome = 'saving'
  if (monthlyDifference < -0.5) outcome = 'increase'

  const paybackMonths = monthlyDifference > 0 && initialInvestment > 0
    ? initialInvestment / monthlyDifference
    : initialInvestment === 0 && monthlyDifference > 0
      ? 0
      : null

  return {
    ready: true,
    outcome,
    missing: [],
    currentMonthlyCost,
    proposedMonthlyCost,
    monthlyDifference,
    annualDifference,
    initialInvestment,
    paybackMonths,
  }
}

export function parseOptionalNumber(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
