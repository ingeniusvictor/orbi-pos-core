import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type ScaleRole = 'principal' | 'secondary'
export type ScaleConnectivity = 'unknown' | 'reachable' | 'offline'
export type FleetSyncBehavior = 'unknown' | 'independent' | 'principal_distributes'

export interface ScaleDeviceRecord {
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

export interface ScaleFleetSnapshot {
  storeId: string
  updatedAt: string
  syncBehavior: FleetSyncBehavior
  devices: ScaleDeviceRecord[]
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

export function defaultElChunchitoFleet(storeId: string): ScaleFleetSnapshot {
  return {
    storeId,
    updatedAt: new Date(0).toISOString(),
    syncBehavior: 'unknown',
    devices: [
      {
        id: 'rm60-01',
        label: 'RM60-01',
        model: 'DIGI RM-60',
        role: 'principal',
        priceAdministrationSource: true,
        notes: 'Balanza fotografiada. Personal la describe como principal y desde aquí actualizan precios.',
        connectivity: 'unknown',
      },
      {
        id: 'rm60-02',
        label: 'RM60-02',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
      {
        id: 'rm60-03',
        label: 'RM60-03',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
      {
        id: 'rm60-04',
        label: 'RM60-04',
        model: 'DIGI RM-60',
        role: 'secondary',
        priceAdministrationSource: false,
        connectivity: 'unknown',
      },
    ],
  }
}

function validateFleet(snapshot: ScaleFleetSnapshot) {
  if (!['unknown', 'independent', 'principal_distributes'].includes(snapshot.syncBehavior)) {
    throw new Error('Invalid fleet sync behavior')
  }

  if (!Array.isArray(snapshot.devices) || snapshot.devices.length < 1 || snapshot.devices.length > 16) {
    throw new Error('Scale fleet must contain 1 to 16 devices')
  }

  const ids = new Set<string>()
  let principals = 0

  for (const device of snapshot.devices) {
    if (!/^[a-z0-9-]{2,40}$/.test(device.id)) throw new Error(`Invalid scale id: ${device.id}`)
    if (!device.label.trim() || !device.model.trim()) throw new Error('Scale label/model are required')
    if (!['principal', 'secondary'].includes(device.role)) throw new Error(`Invalid role for ${device.id}`)
    if (!['unknown', 'reachable', 'offline'].includes(device.connectivity)) {
      throw new Error(`Invalid connectivity for ${device.id}`)
    }
    if (device.ipAddress && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(device.ipAddress)) {
      throw new Error(`Invalid IP address for ${device.id}`)
    }
    if (ids.has(device.id)) throw new Error(`Duplicate scale id: ${device.id}`)
    ids.add(device.id)
    if (device.role === 'principal') principals += 1
  }

  if (principals !== 1) throw new Error('Scale fleet must have exactly one principal device')
}

export class ScaleFleetStore {
  constructor(
    private readonly dataDir: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'scale-fleet.json')
  }

  async get(storeId: string): Promise<ScaleFleetSnapshot> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as ScaleFleetSnapshot
      validateFleet(parsed)
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultElChunchitoFleet(storeId)
      }
      throw error
    }
  }

  async put(
    storeId: string,
    input: Omit<ScaleFleetSnapshot, 'storeId' | 'updatedAt'>,
  ): Promise<ScaleFleetSnapshot> {
    const snapshot: ScaleFleetSnapshot = {
      storeId,
      updatedAt: this.now(),
      syncBehavior: input.syncBehavior,
      devices: input.devices,
    }
    validateFleet(snapshot)

    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8')
    await rename(temp, file)

    return snapshot
  }
}
