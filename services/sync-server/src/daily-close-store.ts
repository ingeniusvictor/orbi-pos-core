import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DailyClosePreview, DailyCloseRecord } from './daily-close-types.js'

interface DailyCloseData {
  closes: DailyCloseRecord[]
}

export interface DailyCloseDraft extends DailyClosePreview {
  id: string
  createdAt: string
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

export class DailyCloseStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly dataDir: string) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'daily-closes.json')
  }

  private async read(storeId: string): Promise<DailyCloseData> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DailyCloseData>
      return {
        closes: Array.isArray(parsed.closes) ? parsed.closes : [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { closes: [] }
      }
      throw error
    }
  }

  private async write(storeId: string, data: DailyCloseData) {
    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
    await rename(temp, file)
  }

  async list(storeId: string, limit = 200): Promise<DailyCloseRecord[]> {
    const data = await this.read(storeId)
    return [...data.closes]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 5_000)))
  }

  async latestForDate(
    storeId: string,
    businessDate: string,
  ): Promise<DailyCloseRecord | null> {
    const data = await this.read(storeId)
    return data.closes
      .filter((close) => close.businessDate === businessDate)
      .sort((a, b) => b.revision - a.revision)[0] ?? null
  }

  async append(
    storeId: string,
    draft: DailyCloseDraft,
  ): Promise<DailyCloseRecord> {
    let result: DailyCloseRecord | null = null

    const task = this.writeQueue.then(async () => {
      const data = await this.read(storeId)
      const latest = data.closes
        .filter((close) => close.businessDate === draft.businessDate)
        .sort((a, b) => b.revision - a.revision)[0] ?? null

      if (latest?.sourceFingerprint === draft.sourceFingerprint) {
        result = latest
        return
      }

      if (data.closes.some((close) => close.id === draft.id)) {
        throw new Error('Daily close id already exists')
      }

      const record: DailyCloseRecord = {
        ...draft,
        revision: (latest?.revision ?? 0) + 1,
        supersedesCloseId: latest?.id,
        audit: [{
          event: 'created',
          at: draft.createdAt,
          actor: 'orbi-pos-server',
          detail: 'daily_close_snapshot',
        }],
      }

      data.closes.unshift(record)
      data.closes = data.closes.slice(0, 5_000)
      await this.write(storeId, data)
      result = record
    })

    this.writeQueue = task.catch(() => undefined)
    await task

    if (!result) throw new Error('Daily close append failed')
    return result
  }
}
