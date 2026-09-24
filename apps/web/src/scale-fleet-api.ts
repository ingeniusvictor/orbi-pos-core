import { ORBI_STORE_ID, orbiApi } from './catalog-sync'

export type ScaleRole = 'principal' | 'secondary'
export type ScaleConnectivity = 'unknown' | 'reachable' | 'offline'
export type FleetSyncBehavior = 'unknown' | 'independent' | 'principal_distributes'

export interface ScaleDevice {
  id: string
  label: string
  model: string
  role: ScaleRole
  priceAdministrationSource: boolean
  serialNumber?: string
  ipAddress?: string
  location?: string
  notes?: string
  connectivity: ScaleConnectivity
}

export interface ScaleFleet {
  storeId: string
  updatedAt: string
  syncBehavior: FleetSyncBehavior
  devices: ScaleDevice[]
}

export const fallbackScaleFleet: ScaleFleet = {
  storeId: ORBI_STORE_ID,
  updatedAt: new Date(0).toISOString(),
  syncBehavior: 'unknown',
  devices: [
    {
      id: 'rm60-01',
      label: 'RM60-01',
      model: 'DIGI RM-60',
      role: 'principal',
      priceAdministrationSource: true,
      notes: 'Balanza fotografiada; personal la identifica como principal para actualización de precios.',
      connectivity: 'unknown',
    },
    { id: 'rm60-02', label: 'RM60-02', model: 'DIGI RM-60', role: 'secondary', priceAdministrationSource: false, connectivity: 'unknown' },
    { id: 'rm60-03', label: 'RM60-03', model: 'DIGI RM-60', role: 'secondary', priceAdministrationSource: false, connectivity: 'unknown' },
    { id: 'rm60-04', label: 'RM60-04', model: 'DIGI RM-60', role: 'secondary', priceAdministrationSource: false, connectivity: 'unknown' },
  ],
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as T | { message?: string } | null
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? body.message
      : undefined
    throw new Error(message || `Scale fleet API error ${response.status}`)
  }
  return body as T
}

export async function fetchScaleFleet(storeId = ORBI_STORE_ID): Promise<ScaleFleet> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/scales/fleet`),
    { cache: 'no-store' },
  )
  return await jsonOrError<ScaleFleet>(response)
}

export async function saveScaleFleet(
  fleet: ScaleFleet,
  storeId = ORBI_STORE_ID,
): Promise<ScaleFleet> {
  const response = await fetch(
    orbiApi(`/api/stores/${encodeURIComponent(storeId)}/scales/fleet`),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        syncBehavior: fleet.syncBehavior,
        devices: fleet.devices,
      }),
    },
  )
  return await jsonOrError<ScaleFleet>(response)
}
