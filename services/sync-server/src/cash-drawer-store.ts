import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CashDrawerMovement,
  CashDrawerSession,
} from './cash-drawer-types.js'

interface CashDrawerData {
  sessions: CashDrawerSession[]
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

export class CashDrawerStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly dataDir: string) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'cash-drawer.json')
  }

  private async read(storeId: string): Promise<CashDrawerData> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<CashDrawerData>
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { sessions: [] }
      }
      throw error
    }
  }

  private async write(storeId: string, data: CashDrawerData) {
    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
    await rename(temp, file)
  }

  async list(storeId: string, limit = 200): Promise<CashDrawerSession[]> {
    const data = await this.read(storeId)
    return [...data.sessions]
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .slice(0, Math.max(1, Math.min(limit, 5_000)))
  }

  async get(storeId: string, sessionId: string): Promise<CashDrawerSession | null> {
    const data = await this.read(storeId)
    return data.sessions.find((session) => session.id === sessionId) ?? null
  }

  async active(storeId: string): Promise<CashDrawerSession | null> {
    const data = await this.read(storeId)
    return data.sessions.find((session) => session.status === 'open') ?? null
  }

  async open(storeId: string, session: CashDrawerSession): Promise<CashDrawerSession> {
    let result: CashDrawerSession | null = null

    const task = this.writeQueue.then(async () => {
      const data = await this.read(storeId)
      if (data.sessions.some((candidate) => candidate.status === 'open')) {
        throw new Error('A cash drawer session is already open')
      }
      if (data.sessions.some((candidate) => candidate.id === session.id)) {
        throw new Error('Cash drawer session id already exists')
      }
      data.sessions.unshift(session)
      data.sessions = data.sessions.slice(0, 5_000)
      await this.write(storeId, data)
      result = session
    })

    this.writeQueue = task.catch(() => undefined)
    await task
    if (!result) throw new Error('Cash drawer open failed')
    return result
  }

  async addMovement(
    storeId: string,
    sessionId: string,
    movement: CashDrawerMovement,
    auditAt: string,
  ): Promise<CashDrawerSession> {
    let result: CashDrawerSession | null = null

    const task = this.writeQueue.then(async () => {
      const data = await this.read(storeId)
      const index = data.sessions.findIndex((session) => session.id === sessionId)
      if (index < 0) throw new Error('Cash drawer session not found')
      const session = data.sessions[index]
      if (session.status !== 'open') throw new Error('Cash drawer session is already closed')
      if (session.movements.some((candidate) => candidate.id === movement.id)) {
        throw new Error('Cash drawer movement id already exists')
      }

      const updated: CashDrawerSession = {
        ...session,
        movements: [...session.movements, movement],
        audit: [...session.audit, {
          event: 'movement_added',
          at: auditAt,
          actor: 'orbi-pos-server',
          detail: `${movement.type}:${movement.id}`,
        }],
      }
      data.sessions[index] = updated
      await this.write(storeId, data)
      result = updated
    })

    this.writeQueue = task.catch(() => undefined)
    await task
    if (!result) throw new Error('Cash drawer movement append failed')
    return result
  }

  async close(
    storeId: string,
    sessionId: string,
    closed: CashDrawerSession,
  ): Promise<CashDrawerSession> {
    let result: CashDrawerSession | null = null

    const task = this.writeQueue.then(async () => {
      const data = await this.read(storeId)
      const index = data.sessions.findIndex((session) => session.id === sessionId)
      if (index < 0) throw new Error('Cash drawer session not found')
      const existing = data.sessions[index]

      if (existing.status === 'closed') {
        if (existing.countedCash === closed.countedCash) {
          result = existing
          return
        }
        throw new Error('Cash drawer session is already closed with a different physical count')
      }

      data.sessions[index] = closed
      await this.write(storeId, data)
      result = closed
    })

    this.writeQueue = task.catch(() => undefined)
    await task
    if (!result) throw new Error('Cash drawer close failed')
    return result
  }
}
