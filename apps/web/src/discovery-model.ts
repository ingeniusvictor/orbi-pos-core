export type TriState = 'pending' | 'yes' | 'no' | 'unknown'

export type IssueFrequency =
  | 'pending'
  | 'always'
  | 'intermittent'
  | 'resolved'
  | 'unknown'

export type IncidentReporter =
  | 'pending'
  | 'owner'
  | 'staff'
  | 'accountant'
  | 'inputsoft'
  | 'sii'
  | 'other'
  | 'unknown'

export type SiiVerificationState =
  | 'pending'
  | 'found'
  | 'missing'
  | 'mixed'
  | 'not_checked'

export type SuspectedFiscalScope =
  | 'pending'
  | 'individual_boletas'
  | 'daily_summary'
  | 'both'
  | 'unknown'

export type SunmiArrangement =
  | 'pending'
  | 'purchased'
  | 'rented'
  | 'bundled'
  | 'unknown'

export interface FieldDiscoveryRecord {
  sunmi: {
    boletaPrints: TriState
    errorVisible: TriState
    issueFrequency: IssueFrequency
    reporter: IncidentReporter
    affectedFrom: string
    affectedTo: string
    siiVerification: SiiVerificationState
    suspectedScope: SuspectedFiscalScope
    systemReference: string
    errorText: string
    evidenceNote: string
  }
  commercial: {
    sunmiArrangement: SunmiArrangement
    fixedMonthlyCost: number | null
    cardAcquirer: string
    cardFeePercent: number | null
    monthlyCardSales: number | null
    evidenceNote: string
  }
  scale: {
    principalWorkflowObserved: TriState
    secondaryPropagation: TriState
    propagationDelay: string
    managementSystemIdentified: TriState
    managementSystemReference: string
    pluExportAvailable: TriState
    backupAvailable: TriState
    notes: string
  }
}

export interface DiscoveryReadiness {
  fiscalAnswered: number
  fiscalTotal: number
  fiscalReady: boolean
  commercialAnswered: number
  commercialTotal: number
  commercialReady: boolean
  scaleAnswered: number
  scaleTotal: number
  scaleReady: boolean
  blockers: string[]
}

export const emptyFieldDiscovery: FieldDiscoveryRecord = {
  sunmi: {
    boletaPrints: 'pending',
    errorVisible: 'pending',
    issueFrequency: 'pending',
    reporter: 'pending',
    affectedFrom: '',
    affectedTo: '',
    siiVerification: 'pending',
    suspectedScope: 'pending',
    systemReference: '',
    errorText: '',
    evidenceNote: '',
  },
  commercial: {
    sunmiArrangement: 'pending',
    fixedMonthlyCost: null,
    cardAcquirer: '',
    cardFeePercent: null,
    monthlyCardSales: null,
    evidenceNote: '',
  },
  scale: {
    principalWorkflowObserved: 'pending',
    secondaryPropagation: 'pending',
    propagationDelay: '',
    managementSystemIdentified: 'pending',
    managementSystemReference: '',
    pluExportAvailable: 'pending',
    backupAvailable: 'pending',
    notes: '',
  },
}

function answered(value: string): boolean {
  return value !== 'pending' && value.trim().length > 0
}

function knownNumber(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && value >= 0
}

export function discoveryReadiness(record: FieldDiscoveryRecord): DiscoveryReadiness {
  const fiscalChecks = [
    answered(record.sunmi.boletaPrints),
    answered(record.sunmi.errorVisible),
    answered(record.sunmi.issueFrequency),
    answered(record.sunmi.reporter),
    answered(record.sunmi.siiVerification),
    answered(record.sunmi.suspectedScope),
  ]

  const commercialChecks = [
    answered(record.commercial.sunmiArrangement),
    knownNumber(record.commercial.fixedMonthlyCost),
    record.commercial.cardAcquirer.trim().length > 0,
    knownNumber(record.commercial.cardFeePercent),
    knownNumber(record.commercial.monthlyCardSales),
  ]

  const scaleChecks = [
    answered(record.scale.principalWorkflowObserved),
    answered(record.scale.secondaryPropagation),
    answered(record.scale.managementSystemIdentified),
    answered(record.scale.pluExportAvailable),
    answered(record.scale.backupAvailable),
  ]

  const fiscalAnswered = fiscalChecks.filter(Boolean).length
  const commercialAnswered = commercialChecks.filter(Boolean).length
  const scaleAnswered = scaleChecks.filter(Boolean).length

  const blockers: string[] = []

  if (!fiscalChecks[0]) blockers.push('Confirmar si la boleta se imprime cuando ocurre el problema.')
  if (!fiscalChecks[4]) blockers.push('Verificar si las boletas afectadas aparecen o no en la revisión del SII.')
  if (!fiscalChecks[5]) blockers.push('Identificar si el problema corresponde a boletas individuales, resumen diario u otro proceso.')
  if (!commercialChecks[0]) blockers.push('Confirmar si la SUNMI se compra, arrienda o viene incluida en otro servicio.')
  if (!commercialChecks[1]) blockers.push('Obtener costo fijo mensual actual desde factura/contrato.')
  if (!commercialChecks[2] || !commercialChecks[3]) blockers.push('Identificar proveedor de tarjetas y comisión efectiva actual.')
  if (!commercialChecks[4]) blockers.push('Obtener un rango de ventas mensuales con tarjeta para comparar costos.')
  if (!scaleChecks[0]) blockers.push('Observar el procedimiento real de cambio de precio en la RM-60 principal.')
  if (!scaleChecks[1]) blockers.push('Observar qué sucede en las otras tres RM-60 después de cambiar un precio.')
  if (!scaleChecks[4]) blockers.push('Confirmar si existe respaldo/exportación recuperable antes de cualquier integración de escritura.')

  return {
    fiscalAnswered,
    fiscalTotal: fiscalChecks.length,
    fiscalReady: fiscalAnswered === fiscalChecks.length,
    commercialAnswered,
    commercialTotal: commercialChecks.length,
    commercialReady: commercialAnswered === commercialChecks.length,
    scaleAnswered,
    scaleTotal: scaleChecks.length,
    scaleReady: scaleAnswered === scaleChecks.length,
    blockers,
  }
}

export function buildDiscoveryExport(record: FieldDiscoveryRecord, generatedAt: string) {
  return {
    format: 'orbi-pos-field-discovery/v1',
    business: 'Carnicería El Chunchito',
    generatedAt,
    knownFacts: {
      scaleCount: 4,
      scaleModel: 'DIGI RM-60',
      principalScaleObserved: true,
      priceAdministrationObservedOnPrincipal: true,
      scaleSynchronizationVerified: false,
      currentCheckoutHardware: 'SUNMI V2',
      currentFiscalSoftware: 'Inputsoft',
    },
    record,
    safety: {
      containsCredentials: false,
      purpose: 'operational discovery only',
      warning: 'Do not add passwords, API keys, card data or customer personal data to free-text notes.',
    },
  }
}

export function questionPack(record: FieldDiscoveryRecord): string[] {
  const questions: string[] = []

  if (record.sunmi.boletaPrints === 'pending') {
    questions.push('Cuando ocurre el problema en la SUNMI, ¿la boleta igual se imprime?')
  }
  if (record.sunmi.errorVisible === 'pending') {
    questions.push('¿Aparece algún mensaje de error, pendiente, rechazado o sin enviar?')
  }
  if (record.sunmi.siiVerification === 'pending') {
    questions.push('¿Cómo comprobaron que la información no estaba llegando al SII: portal SII, contador o aviso de Inputsoft?')
  }
  if (record.sunmi.suspectedScope === 'pending') {
    questions.push('¿Les dijeron que faltaban boletas individuales, el resumen diario, o no saben todavía cuál de los dos?')
  }
  if (record.commercial.sunmiArrangement === 'pending') {
    questions.push('¿La SUNMI se arrienda, se compró o viene incluida junto con Inputsoft/otro servicio?')
  }
  if (!knownNumber(record.commercial.fixedMonthlyCost)) {
    questions.push('¿Pueden revisar una factura reciente para saber cuánto pagan al mes por el sistema actual?')
  }
  if (!record.commercial.cardAcquirer.trim()) {
    questions.push('¿Qué empresa usan hoy para cobrar tarjetas y cuál es la comisión que les cobran?')
  }
  if (record.scale.principalWorkflowObserved === 'pending') {
    questions.push('¿Puedes mostrar en foto o video cómo cambian hoy el precio de un producto en la balanza principal?')
  }
  if (record.scale.secondaryPropagation === 'pending') {
    questions.push('Después de cambiar un precio en la balanza principal, ¿las otras tres cambian solas o hay que actualizarlas por separado?')
  }
  if (record.scale.managementSystemIdentified === 'pending') {
    questions.push('¿La balanza principal usa alguna página/programa para administrar productos? Si aparece una dirección o nombre, ¿puedes fotografiarlo?')
  }

  return questions
}
