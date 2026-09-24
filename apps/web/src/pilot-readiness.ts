import type { Product } from './domain'
import type { FieldDiscoveryRecord } from './discovery-model'
import { discoveryReadiness } from './discovery-model'
import type { ModernizationInputs } from './proposal-model'
import { calculateModernization } from './proposal-model'

export type ReadinessTone = 'ready' | 'partial' | 'pending'

export interface ReadinessItem {
  id: string
  label: string
  detail: string
  tone: ReadinessTone
}

export interface PilotReadiness {
  demoReadyCount: number
  demoTotal: number
  fieldReadyCount: number
  fieldTotal: number
  demoItems: ReadinessItem[]
  fieldItems: ReadinessItem[]
}

function hasValidPlu(product: Product) {
  return Boolean(product.plu && /^\d{1,6}$/.test(product.plu))
}

function economicComparisonReady(inputs: ModernizationInputs) {
  return calculateModernization(inputs).ready
}

export function buildPilotReadiness(
  products: Product[],
  discovery: FieldDiscoveryRecord,
  proposal: ModernizationInputs,
): PilotReadiness {
  const activeProducts = products.filter((product) => product.active)
  const discoveryState = discoveryReadiness(discovery)

  const demoItems: ReadinessItem[] = [
    {
      id: 'showcase-demo',
      label: 'Showcase visual',
      detail: 'Demo 16:9 disponible con datos claramente ilustrativos.',
      tone: 'ready',
    },
    {
      id: 'pos',
      label: 'ORBI POS',
      detail: activeProducts.length
        ? `${activeProducts.length} producto(s) activo(s) en el catálogo actual.`
        : 'La interfaz está lista, pero el catálogo real todavía está vacío.',
      tone: activeProducts.length ? 'ready' : 'partial',
    },
    {
      id: 'scale-fleet',
      label: 'Flota RM-60',
      detail: 'Las cuatro DIGI RM-60 están representadas sin asumir una sincronización no verificada.',
      tone: 'ready',
    },
    {
      id: 'point-mock',
      label: 'Pago Point simulado',
      detail: 'El flujo crear → terminal → aprobado/rechazado puede demostrarse sin mover dinero.',
      tone: 'ready',
    },
    {
      id: 'proposal',
      label: 'Propuesta de modernización',
      detail: economicComparisonReady(proposal)
        ? 'La comparación económica tiene todos los campos mínimos para calcular.'
        : 'La presentación está lista; la conclusión económica sigue esperando datos reales.',
      tone: economicComparisonReady(proposal) ? 'ready' : 'partial',
    },
  ]

  const pluReady = activeProducts.length > 0 && activeProducts.every(hasValidPlu)
  const scaleWorkflowObserved = discovery.scale.principalWorkflowObserved === 'yes'
  const scalePropagationObserved =
    discovery.scale.secondaryPropagation === 'yes'
    || discovery.scale.secondaryPropagation === 'no'

  const fieldItems: ReadinessItem[] = [
    {
      id: 'plu',
      label: 'PLU reales',
      detail: pluReady
        ? 'Todos los productos activos tienen un PLU numérico documentado.'
        : 'Aún faltan PLU reales en uno o más productos activos.',
      tone: pluReady ? 'ready' : 'pending',
    },
    {
      id: 'scale-topology',
      label: 'Comportamiento entre las 4 RM-60',
      detail: scaleWorkflowObserved && scalePropagationObserved
        ? 'El flujo principal y el comportamiento de las secundarias fueron observados.'
        : 'Falta observar el cambio de precio y qué sucede realmente en las otras tres balanzas.',
      tone: scaleWorkflowObserved && scalePropagationObserved ? 'ready' : 'pending',
    },
    {
      id: 'fiscal-discovery',
      label: 'Levantamiento SUNMI / Inputsoft / SII',
      detail: discoveryState.fiscalReady
        ? 'Las preguntas mínimas están respondidas; esto no equivale a diagnóstico tributario final.'
        : `${discoveryState.fiscalAnswered}/${discoveryState.fiscalTotal} respuestas mínimas registradas.`,
      tone: discoveryState.fiscalReady ? 'ready' : 'pending',
    },
    {
      id: 'commercial-baseline',
      label: 'Línea base comercial actual',
      detail: discoveryState.commercialReady
        ? 'Costos, adquirente, comisión y volumen tienen respuestas explícitas.'
        : `${discoveryState.commercialAnswered}/${discoveryState.commercialTotal} datos comerciales mínimos registrados.`,
      tone: discoveryState.commercialReady ? 'ready' : 'pending',
    },
    {
      id: 'real-point',
      label: 'Point Smart 2 física',
      detail: 'Pendiente de decisión de compra/asociación, credenciales reales, terminal ID y modo PDV.',
      tone: 'pending',
    },
  ]

  return {
    demoReadyCount: demoItems.filter((item) => item.tone === 'ready').length,
    demoTotal: demoItems.length,
    fieldReadyCount: fieldItems.filter((item) => item.tone === 'ready').length,
    fieldTotal: fieldItems.length,
    demoItems,
    fieldItems,
  }
}
