import { useMemo } from 'react'
import type { Product } from '../domain'
import { emptyFieldDiscovery, type FieldDiscoveryRecord } from '../discovery-model'
import { emptyModernizationInputs, type ModernizationInputs } from '../proposal-model'
import { buildPilotReadiness, type ReadinessItem } from '../pilot-readiness'

const DISCOVERY_KEY = 'orbi-pos:field-discovery'
const PROPOSAL_KEY = 'orbi-pos:modernization-proposal'

function loadDiscovery(): FieldDiscoveryRecord {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY)
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

function loadProposal(): ModernizationInputs {
  try {
    const raw = localStorage.getItem(PROPOSAL_KEY)
    if (!raw) return emptyModernizationInputs
    return {
      ...emptyModernizationInputs,
      ...JSON.parse(raw),
    } as ModernizationInputs
  } catch {
    return emptyModernizationInputs
  }
}

function go(path: string) {
  window.location.href = path
}

function toneLabel(tone: ReadinessItem['tone']) {
  if (tone === 'ready') return 'LISTO'
  if (tone === 'partial') return 'PARCIAL'
  return 'PENDIENTE'
}

function ReadinessLine({ item }: { item: ReadinessItem }) {
  return (
    <li className={`pilot-readiness-line tone-${item.tone}`}>
      <span>{item.tone === 'ready' ? '✓' : item.tone === 'partial' ? '◐' : '○'}</span>
      <div>
        <b>{item.label}</b>
        <small>{item.detail}</small>
      </div>
      <em>{toneLabel(item.tone)}</em>
    </li>
  )
}

interface DemoCardProps {
  number: string
  eyebrow: string
  title: string
  description: string
  meta: string
  action: string
  path: string
  accent?: boolean
}

function DemoCard({
  number,
  eyebrow,
  title,
  description,
  meta,
  action,
  path,
  accent = false,
}: DemoCardProps) {
  return (
    <article className={accent ? 'pilot-demo-card accent' : 'pilot-demo-card'}>
      <div className="pilot-demo-number">{number}</div>
      <div className="pilot-demo-copy">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
        <small>{meta}</small>
      </div>
      <button className={accent ? 'primary' : 'ghost'} type="button" onClick={() => go(path)}>
        {action} <b>↗</b>
      </button>
    </article>
  )
}

export function PilotDemoHub({ products }: { products: Product[] }) {
  const discovery = useMemo(loadDiscovery, [])
  const proposal = useMemo(loadProposal, [])
  const readiness = useMemo(
    () => buildPilotReadiness(products, discovery, proposal),
    [discovery, products, proposal],
  )

  const demoPercent = Math.round((readiness.demoReadyCount / readiness.demoTotal) * 100)
  const fieldPercent = Math.round((readiness.fieldReadyCount / readiness.fieldTotal) * 100)

  return (
    <main className="pilot-hub">
      <section className="pilot-hub-hero">
        <div className="pilot-hub-brand">
          <span className="pilot-orbi-mark">O</span>
          <div>
            <p>ORBI ECOSYSTEM · PILOTO 2026</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="pilot-hub-title">
          <p className="eyebrow">Propuesta de modernización</p>
          <h1>De una operación aislada a un flujo conectado.</h1>
          <p>
            Esta presentación muestra lo que ORBI ya puede demostrar hoy, qué información falta validar en terreno
            y qué componentes requieren una decisión real antes de una puesta en producción.
          </p>
        </div>

        <div className="pilot-hub-summary">
          <div>
            <small>DEMO DE SOFTWARE</small>
            <strong>{readiness.demoReadyCount}/{readiness.demoTotal}</strong>
            <span>{demoPercent}% de módulos demostrables</span>
          </div>
          <div>
            <small>VALIDACIÓN DE TERRENO</small>
            <strong>{readiness.fieldReadyCount}/{readiness.fieldTotal}</strong>
            <span>{fieldPercent}% de hitos verificados</span>
          </div>
          <div className="pilot-hub-hero-actions">
            <button type="button" className="primary" onClick={() => go('/piloto/sesion')}>
              ▶ Iniciar demo completa
            </button>
            <button type="button" className="ghost" onClick={() => go('/piloto/resumen')}>
              Resumen imprimible
            </button>
            <button type="button" className="ghost" onClick={() => go('/piloto/decision')}>
              Gate de producción
            </button>
            <button type="button" className="ghost" onClick={() => go('/?view=discovery')}>
              Completar levantamiento ↗
            </button>
          </div>
        </div>
      </section>

      <section className="pilot-story">
        <div className="pilot-section-heading">
          <div>
            <p className="eyebrow">Recorrido recomendado</p>
            <h2>5 minutos para entender la propuesta</h2>
          </div>
          <p>Empieza por lo que verá el cliente y termina en la decisión económica.</p>
        </div>

        <div className="pilot-demo-grid">
          <DemoCard
            number="01"
            eyebrow="CLIENTE"
            title="ORBI Showcase"
            description="Pantalla 16:9 con productos, códigos y precios para pedir más rápido en el mesón."
            meta="La demo visual usa datos ilustrativos claramente identificados."
            action="Ver Showcase"
            path="/showcase-demo"
            accent
          />
          <DemoCard
            number="02"
            eyebrow="CAJA"
            title="ORBI POS"
            description="Venta visual, productos por código, carrito y flujo de cobro preparado para integración."
            meta="El piloto todavía no reemplaza la emisión tributaria actual."
            action="Abrir POS"
            path="/?view=sale"
          />
          <DemoCard
            number="03"
            eyebrow="PESAJE"
            title="4 × DIGI RM-60"
            description="Registro de la balanza principal, tres secundarias, PLU y evidencia de terreno."
            meta="No enviamos precios a las balanzas hasta verificar protocolo, respaldo y topología."
            action="Ver balanzas"
            path="/?view=scale"
          />
          <DemoCard
            number="04"
            eyebrow="PAGOS"
            title="Point Smart 2"
            description="ORBI crea la orden, espera el estado del terminal y solo cierra la venta si el pago queda procesado."
            meta="Actualmente se demuestra con un simulador sin dinero real."
            action="Ver pagos"
            path="/?view=payments"
          />
          <DemoCard
            number="05"
            eyebrow="DECISIÓN"
            title="Costo / beneficio"
            description="Compara el sistema actual con la propuesta usando únicamente costos, comisiones y ventas respaldadas."
            meta="Sin datos suficientes, ORBI no fuerza una conclusión económica."
            action="Ver propuesta"
            path="/modernizacion"
            accent
          />
        </div>
      </section>

      <section className="pilot-readiness">
        <div className="pilot-section-heading">
          <div>
            <p className="eyebrow">Estado del piloto</p>
            <h2>Qué está listo y qué todavía depende del negocio</h2>
          </div>
          <p>“Listo para demo” no significa “listo para reemplazar el sistema actual”.</p>
        </div>

        <div className="pilot-readiness-columns">
          <article>
            <header>
              <span>SOFTWARE</span>
              <h3>Demostrable ahora</h3>
              <strong>{readiness.demoReadyCount}/{readiness.demoTotal}</strong>
            </header>
            <ul>
              {readiness.demoItems.map((item) => <ReadinessLine item={item} key={item.id} />)}
            </ul>
          </article>

          <article>
            <header>
              <span>TERRENO / PRODUCCIÓN</span>
              <h3>Validaciones pendientes</h3>
              <strong>{readiness.fieldReadyCount}/{readiness.fieldTotal}</strong>
            </header>
            <ul>
              {readiness.fieldItems.map((item) => <ReadinessLine item={item} key={item.id} />)}
            </ul>
          </article>
        </div>
      </section>

      <section className="pilot-boundary">
        <div>
          <p className="eyebrow">Límite del piloto</p>
          <h2>ORBI demuestra primero. El negocio decide después.</h2>
          <p>
            No estamos proponiendo desconectar hoy SUNMI/Inputsoft, escribir en las RM-60 ni comprar una Point
            sin antes comprobar el problema actual, los costos reales y la compatibilidad técnica.
          </p>
        </div>

        <div className="pilot-boundary-flow">
          <div><span>1</span><b>Demostrar</b><small>Showcase · POS · Point mock</small></div>
          <i>→</i>
          <div><span>2</span><b>Verificar</b><small>RM-60 · SII · costos</small></div>
          <i>→</i>
          <div><span>3</span><b>Comparar</b><small>Actual vs propuesta</small></div>
          <i>→</i>
          <div><span>4</span><b>Decidir</b><small>Piloto real controlado</small></div>
        </div>
      </section>

      <footer className="pilot-hub-footer">
        <div>
          <b>ORBI POS + ORBI Showcase</b>
          <span>Piloto Carnicería El Chunchito</span>
        </div>
        <div className="pilot-footer-actions">
          <button type="button" className="ghost" onClick={() => go('/?view=discovery')}>Levantamiento</button>
          <button type="button" className="ghost" onClick={() => go('/modernizacion')}>Abrir propuesta</button>
          <button type="button" className="ghost" onClick={() => go('/piloto/resumen')}>Resumen / PDF</button>
          <button type="button" className="ghost" onClick={() => go('/piloto/decision')}>Gate producción</button>
          <button type="button" className="primary" onClick={() => go('/piloto/sesion')}>Iniciar demo completa</button>
        </div>
      </footer>
    </main>
  )
}
