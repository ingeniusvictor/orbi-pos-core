import { useEffect, useMemo, useState } from 'react'
import { formatCLP } from '../pos'
import {
  calculateModernization,
  emptyModernizationInputs,
  type ModernizationInputs,
} from '../proposal-model'

const STORAGE_KEY = 'orbi-pos:modernization-proposal'

function loadInputs(): ModernizationInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyModernizationInputs
    return { ...emptyModernizationInputs, ...JSON.parse(raw) } as ModernizationInputs
  } catch {
    return emptyModernizationInputs
  }
}

function moneyValue(value: number | null) {
  return value === null ? '' : String(value)
}

function percentValue(value: number | null) {
  return value === null ? '' : String(value)
}

function numberFromInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function Fact({
  state,
  title,
  detail,
}: {
  state: 'confirmed' | 'pending' | 'proposal'
  title: string
  detail: string
}) {
  return (
    <li className={`modernization-fact fact-${state}`}>
      <span>{state === 'confirmed' ? '✓' : state === 'proposal' ? '→' : '?'}</span>
      <div>
        <b>{title}</b>
        <small>{detail}</small>
      </div>
    </li>
  )
}

interface Props {
  presentation?: boolean
}

export function ModernizationProposal({ presentation = false }: Props) {
  const [inputs, setInputs] = useState<ModernizationInputs>(loadInputs)
  const result = useMemo(() => calculateModernization(inputs), [inputs])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
  }, [inputs])

  function patch<K extends keyof ModernizationInputs>(
    key: K,
    value: ModernizationInputs[K],
  ) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  function reset() {
    setInputs(emptyModernizationInputs)
  }

  return (
    <section className={presentation ? 'modernization-page presentation' : 'modernization-page'}>
      <div className="modernization-hero">
        <div>
          <p className="eyebrow">ORBI Ecosystem · Propuesta de modernización</p>
          <h2>Carnicería El Chunchito</h2>
          <p>
            Mantener lo que ya funciona, conectar los procesos y tomar la decisión de cambio con costos reales.
          </p>
        </div>

        {!presentation ? (
          <button
            className="primary modernization-open"
            type="button"
            onClick={() => window.open('/modernizacion', '_blank', 'noopener,noreferrer')}
          >
            Abrir presentación ↗
          </button>
        ) : (
          <div className="modernization-presentation-tag">PRESENTACIÓN · BORRADOR DE PILOTO</div>
        )}
      </div>

      <div className="modernization-columns">
        <article className="modernization-system current-system">
          <header>
            <span>HOY</span>
            <h3>Operación actual</h3>
            <p>Información confirmada por terreno y puntos que todavía debemos verificar.</p>
          </header>

          <ul>
            <Fact state="confirmed" title="4 × DIGI RM-60" detail="Las cuatro balanzas son del mismo modelo." />
            <Fact state="confirmed" title="RM-60 principal" detail="El personal indica que desde esa balanza actualizan los precios." />
            <Fact state="confirmed" title="SUNMI V2 + Inputsoft" detail="Terminal actual usada para la operación de boletas." />
            <Fact state="pending" title="Incidencia SII" detail="Se reportó que información no estaría llegando como se esperaba; falta diagnosticar la causa exacta." />
            <Fact state="pending" title="Costo mensual actual" detail="Esperando factura/contrato real para separar arriendo, software y otros cargos." />
            <Fact state="pending" title="Comisiones actuales" detail="Falta identificar adquirente, tasas y volumen real por medio de pago." />
          </ul>
        </article>

        <div className="modernization-arrow" aria-hidden="true">
          <span>ORBI</span>
          <b>→</b>
        </div>

        <article className="modernization-system proposed-system">
          <header>
            <span>PROPUESTA</span>
            <h3>Operación conectada</h3>
            <p>Arquitectura objetivo; los componentes fiscales solo se migran después de validación.</p>
          </header>

          <ul>
            <Fact state="proposal" title="Mantener las 4 RM-60" detail="No reemplazar balanzas que ya cumplen su función de pesaje." />
            <Fact state="proposal" title="ORBI Catálogo + Precios" detail="Una capa moderna para productos, códigos, imágenes, historial y cambios rápidos." />
            <Fact state="proposal" title="ORBI Showcase" detail="TV 16:9 con productos, códigos y precios para clientes." />
            <Fact state="proposal" title="ORBI POS" detail="Venta visual con trazabilidad del pago y sin cerrar tarjeta antes de confirmación." />
            <Fact state="proposal" title="Point Smart 2 + API" detail="Candidata para recibir automáticamente el monto de ORBI y devolver el estado de pago." />
            <Fact state="pending" title="Migración tributaria" detail="Se decide solo después de conciliar SUNMI/Inputsoft/SII y confirmar la modalidad adecuada." />
          </ul>
        </article>
      </div>

      <div className="modernization-flow">
        <p className="eyebrow">Arquitectura objetivo</p>
        <div className="modernization-flow-grid">
          <div><b>4 × RM-60</b><span>pesaje / PLU</span></div>
          <i>→</i>
          <div><b>ORBI</b><span>catálogo · precios · POS · Showcase</span></div>
          <i>→</i>
          <div><b>Point Smart 2</b><span>orden API · pago confirmado</span></div>
          <i>→</i>
          <div><b>SII</b><span>flujo fiscal a validar antes de migrar</span></div>
        </div>
      </div>

      <div className="modernization-cost-section">
        <div className="modernization-cost-head">
          <div>
            <p className="eyebrow">Costo / beneficio</p>
            <h3>Calculadora con datos reales</h3>
            <p>
              ORBI no afirma que la propuesta sea más barata hasta completar los costos del negocio y una cotización vigente.
            </p>
          </div>
          {!presentation ? <button className="ghost" type="button" onClick={reset}>Limpiar datos</button> : null}
        </div>

        <div className="modernization-cost-grid">
          <article>
            <h4>Sistema actual</h4>

            <label>
              <span>Costo fijo mensual actual</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Pendiente"
                value={moneyValue(inputs.currentFixedMonthly)}
                onChange={(event) => patch('currentFixedMonthly', numberFromInput(event.target.value))}
              /></div>
              <small>Arriendo/equipo/software fijo según factura real.</small>
            </label>

            <label>
              <span>Comisión promedio efectiva actual</span>
              <div className="percent-field"><input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Pendiente"
                value={percentValue(inputs.currentCardFeePercent)}
                onChange={(event) => patch('currentCardFeePercent', numberFromInput(event.target.value))}
              /><b>%</b></div>
              <small>Usar una tasa promedio basada en la mezcla real de tarjetas.</small>
            </label>

            <label>
              <span>Ventas mensuales con tarjeta</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Pendiente"
                value={moneyValue(inputs.monthlyCardSales)}
                onChange={(event) => patch('monthlyCardSales', numberFromInput(event.target.value))}
              /></div>
            </label>

            <label>
              <span>Fuente / respaldo</span>
              <input
                type="text"
                placeholder="Ej. factura septiembre + cartola POS"
                value={inputs.currentSourceNote}
                onChange={(event) => patch('currentSourceNote', event.target.value)}
              />
            </label>
          </article>

          <article>
            <h4>Propuesta Point + ORBI</h4>

            <label>
              <span>Costo fijo mensual propuesto</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Pendiente"
                value={moneyValue(inputs.proposedFixedMonthly)}
                onChange={(event) => patch('proposedFixedMonthly', numberFromInput(event.target.value))}
              /></div>
              <small>Boleta/factura, nube u otros cargos recurrentes confirmados.</small>
            </label>

            <label>
              <span>Comisión promedio efectiva propuesta</span>
              <div className="percent-field"><input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Pendiente"
                value={percentValue(inputs.proposedCardFeePercent)}
                onChange={(event) => patch('proposedCardFeePercent', numberFromInput(event.target.value))}
              /><b>%</b></div>
              <small>Completar con la tasa vigente aplicable al negocio.</small>
            </label>

            <label>
              <span>Compra Point / terminal</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0 si ya está disponible"
                value={moneyValue(inputs.pointDeviceCost)}
                onChange={(event) => patch('pointDeviceCost', numberFromInput(event.target.value))}
              /></div>
            </label>

            <label>
              <span>TV Showcase</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Opcional"
                value={moneyValue(inputs.showcaseTvCost)}
                onChange={(event) => patch('showcaseTvCost', numberFromInput(event.target.value))}
              /></div>
            </label>

            <label>
              <span>Mini-PC / reproductor</span>
              <div className="money-field"><b>$</b><input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Opcional"
                value={moneyValue(inputs.miniPcCost)}
                onChange={(event) => patch('miniPcCost', numberFromInput(event.target.value))}
              /></div>
            </label>

            <label>
              <span>Fuente / respaldo</span>
              <input
                type="text"
                placeholder="Ej. cotización Mercado Pago fecha..."
                value={inputs.proposedSourceNote}
                onChange={(event) => patch('proposedSourceNote', event.target.value)}
              />
            </label>
          </article>
        </div>

        {!result.ready ? (
          <div className="modernization-result incomplete">
            <div>
              <span>ANÁLISIS PENDIENTE</span>
              <h3>No hay suficiente información para afirmar ahorro o sobrecosto.</h3>
              <p>Faltan: {result.missing.join(' · ')}.</p>
            </div>
            <strong>Sin conclusión</strong>
          </div>
        ) : (
          <div className={`modernization-result result-${result.outcome}`}>
            <div className="modernization-result-copy">
              <span>ESTIMACIÓN CON LOS DATOS INGRESADOS</span>
              <h3>
                {result.outcome === 'saving'
                  ? 'La propuesta presenta un menor costo mensual estimado.'
                  : result.outcome === 'increase'
                    ? 'La propuesta presenta un mayor costo mensual estimado.'
                    : 'Los costos mensuales estimados son equivalentes.'}
              </h3>
              <p>La decisión final también debe considerar confiabilidad, soporte, integración y operación tributaria.</p>
            </div>

            <div className="modernization-result-metrics">
              <div><small>Actual / mes</small><strong>{formatCLP(result.currentMonthlyCost ?? 0)}</strong></div>
              <div><small>Propuesta / mes</small><strong>{formatCLP(result.proposedMonthlyCost ?? 0)}</strong></div>
              <div>
                <small>{(result.monthlyDifference ?? 0) >= 0 ? 'Diferencia a favor / mes' : 'Costo adicional / mes'}</small>
                <strong>{formatCLP(Math.abs(result.monthlyDifference ?? 0))}</strong>
              </div>
              <div>
                <small>{(result.annualDifference ?? 0) >= 0 ? 'Diferencia a favor / año' : 'Costo adicional / año'}</small>
                <strong>{formatCLP(Math.abs(result.annualDifference ?? 0))}</strong>
              </div>
              <div><small>Inversión inicial</small><strong>{formatCLP(result.initialInvestment)}</strong></div>
              <div><small>Retorno estimado</small><strong>{result.paybackMonths === null ? '—' : `${result.paybackMonths.toFixed(1)} meses`}</strong></div>
            </div>
          </div>
        )}

        <p className="modernization-disclaimer">
          Estimación operacional. Las comisiones pueden variar por medio de pago, volumen, impuestos, promociones y contrato.
          La parte tributaria debe validarse con la configuración real del negocio y su proveedor/contador antes de cualquier migración.
        </p>
      </div>
    </section>
  )
}
