import { useEffect, useState } from 'react'
import {
  fallbackScaleFleet,
  fetchScaleFleet,
  saveScaleFleet,
  type FleetSyncBehavior,
  type ScaleDevice,
  type ScaleFleet,
} from '../scale-fleet-api'

function syncBehaviorLabel(value: FleetSyncBehavior) {
  if (value === 'independent') return 'Catálogos independientes'
  if (value === 'principal_distributes') return 'Principal distribuye a secundarias'
  return 'No verificado'
}

export function ScaleFleetPanel() {
  const [fleet, setFleet] = useState<ScaleFleet>(fallbackScaleFleet)
  const [savedFleet, setSavedFleet] = useState<ScaleFleet>(fallbackScaleFleet)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stopped = false

    async function load() {
      try {
        const remote = await fetchScaleFleet()
        if (stopped) return
        setFleet(remote)
        setSavedFleet(remote)
        setMessage('')
      } catch {
        if (stopped) return
        setFleet(fallbackScaleFleet)
        setSavedFleet(fallbackScaleFleet)
        setMessage('Servidor de flota no disponible. Mostrando la topología conocida como referencia local.')
      } finally {
        if (!stopped) setLoading(false)
      }
    }

    void load()
    return () => { stopped = true }
  }, [])

  const dirty = JSON.stringify(fleet) !== JSON.stringify(savedFleet)

  function patchDevice(id: string, changes: Partial<ScaleDevice>) {
    setFleet((current) => ({
      ...current,
      devices: current.devices.map((device) =>
        device.id === id ? { ...device, ...changes } : device),
    }))
  }

  async function save() {
    try {
      const saved = await saveScaleFleet(fleet)
      setFleet(saved)
      setSavedFleet(saved)
      setMessage('Flota RM-60 actualizada.')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <section className="scale-fleet-panel">
      <div className="scale-fleet-head">
        <div>
          <p className="eyebrow">Topología real del negocio</p>
          <h3>Flota DIGI RM-60</h3>
          <p>
            Sabemos que existen cuatro balanzas iguales y que RM60-01 es descrita por el personal como la principal para actualizar precios.
            La sincronización entre equipos sigue marcada como no verificada.
          </p>
        </div>
        <div className="scale-fleet-actions">
          <label>
            <span>Sincronización entre balanzas</span>
            <select
              value={fleet.syncBehavior}
              onChange={(event) => setFleet((current) => ({
                ...current,
                syncBehavior: event.target.value as FleetSyncBehavior,
              }))}
            >
              <option value="unknown">No verificado</option>
              <option value="independent">Catálogos independientes</option>
              <option value="principal_distributes">Principal distribuye a secundarias</option>
            </select>
          </label>
          <button className="primary save-prices" type="button" disabled={!dirty || loading} onClick={() => { void save() }}>
            Guardar flota
          </button>
        </div>
      </div>

      <div className="scale-sync-warning">
        <b>Estado actual: {syncBehaviorLabel(fleet.syncBehavior)}</b>
        <span>
          {fleet.syncBehavior === 'unknown'
            ? ' No asumiremos que la balanza principal replica productos o precios hasta observarlo en terreno.'
            : ' Este valor debe provenir de una verificación real del flujo de las cuatro balanzas.'}
        </span>
      </div>

      <div className="scale-fleet-grid">
        {fleet.devices.map((device) => (
          <article className={device.role === 'principal' ? 'scale-device principal' : 'scale-device'} key={device.id}>
            <div className="scale-device-title">
              <div>
                <span>{device.role === 'principal' ? 'PRINCIPAL' : 'SECUNDARIA'}</span>
                <h4>{device.label}</h4>
              </div>
              <b>{device.model}</b>
            </div>

            {device.priceAdministrationSource ? (
              <div className="scale-device-badge">Actualización de precios observada aquí</div>
            ) : null}

            <div className="scale-device-fields">
              <label>
                <span>N° serie</span>
                <input
                  placeholder="Pendiente"
                  value={device.serialNumber ?? ''}
                  onChange={(event) => patchDevice(device.id, { serialNumber: event.target.value.trimStart() || undefined })}
                />
              </label>

              <label>
                <span>IP / LAN</span>
                <input
                  inputMode="decimal"
                  placeholder="Pendiente"
                  value={device.ipAddress ?? ''}
                  onChange={(event) => patchDevice(device.id, { ipAddress: event.target.value.trim() || undefined })}
                />
              </label>

              <label>
                <span>Ubicación física</span>
                <input
                  placeholder="Ej. mostrador izquierdo"
                  value={device.location ?? ''}
                  onChange={(event) => patchDevice(device.id, { location: event.target.value || undefined })}
                />
              </label>

              <label>
                <span>Conectividad</span>
                <select
                  value={device.connectivity}
                  onChange={(event) => patchDevice(device.id, {
                    connectivity: event.target.value as ScaleDevice['connectivity'],
                  })}
                >
                  <option value="unknown">No comprobada</option>
                  <option value="reachable">Alcanzable</option>
                  <option value="offline">Sin conexión</option>
                </select>
              </label>

              <label className="scale-device-notes">
                <span>Notas de terreno</span>
                <textarea
                  rows={3}
                  placeholder="Qué observamos en esta balanza..."
                  value={device.notes ?? ''}
                  onChange={(event) => patchDevice(device.id, { notes: event.target.value || undefined })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      {message ? <div className="mapping-message">{message}</div> : null}
    </section>
  )
}
