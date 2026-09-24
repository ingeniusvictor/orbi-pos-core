import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ScaleFleetStore } from './scale-fleet-store.js'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-scales-'))
  dirs.push(dir)
  return new ScaleFleetStore(dir, () => '2026-09-24T21:00:00.000Z')
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ScaleFleetStore', () => {
  it('starts from the four RM-60 field facts without inventing network topology', async () => {
    const store = await makeStore()
    const fleet = await store.get('el-chunchito')

    expect(fleet.devices).toHaveLength(4)
    expect(fleet.devices.every((device) => device.model === 'DIGI RM-60')).toBe(true)
    expect(fleet.devices.filter((device) => device.role === 'principal')).toHaveLength(1)
    expect(fleet.devices[0].priceAdministrationSource).toBe(true)
    expect(fleet.syncBehavior).toBe('unknown')
    expect(fleet.devices.every((device) => device.connectivity === 'unknown')).toBe(true)
  })

  it('persists serial, IP and notes without changing unknown sync behavior', async () => {
    const store = await makeStore()
    const fleet = await store.get('el-chunchito')
    fleet.devices[0] = {
      ...fleet.devices[0],
      serialNumber: 'FIELD-SERIAL-01',
      ipAddress: '192.168.1.50',
      location: 'Mostrador principal',
    }

    const saved = await store.put('el-chunchito', {
      syncBehavior: fleet.syncBehavior,
      devices: fleet.devices,
    })

    expect(saved.updatedAt).toBe('2026-09-24T21:00:00.000Z')
    expect(saved.devices[0].ipAddress).toBe('192.168.1.50')
    expect(saved.syncBehavior).toBe('unknown')
  })

  it('requires exactly one principal scale', async () => {
    const store = await makeStore()
    const fleet = await store.get('el-chunchito')
    const noPrincipal = fleet.devices.map((device) => ({ ...device, role: 'secondary' as const }))

    await expect(store.put('el-chunchito', {
      syncBehavior: 'unknown',
      devices: noPrincipal,
    })).rejects.toThrow('exactly one principal')
  })
})
