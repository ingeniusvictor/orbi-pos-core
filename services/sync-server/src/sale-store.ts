import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SaleRecord } from './sale-types.js'

interface SaleData {
  sales: SaleRecord[]
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

export class SaleStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly dataDir: string) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'sales.json')
  }

  private async read(storeId: string): Promise<SaleData> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<SaleData>
      return {
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { sales: [] }
      }
      throw error
    }
  }

  private async write(storeId: string, data: SaleData) {
    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
    await rename(temp, file)
  }

  async list(storeId: string, limit = 200): Promise<SaleRecord[]> {
    const data = await this.read(storeId)
    return data.sales
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 1000)))
  }

  async get(storeId: string, saleId: string): Promise<SaleRecord | null> {
    const data = await this.read(storeId)
    return data.sales.find((sale) => sale.id === saleId) ?? null
  }

  async findByClientRequestId(
    storeId: string,
    clientRequestId: string,
  ): Promise<SaleRecord | null> {
    const data = await this.read(storeId)
    return data.sales.find((sale) =>
      sale.clientRequestId === clientRequestId,
    ) ?? null
  }

  async findByPaymentOrderId(
    storeId: string,
    paymentOrderId: string,
  ): Promise<SaleRecord | null> {
    const data = await this.read(storeId)
    return data.sales.find((sale) =>
      sale.payment?.orderId === paymentOrderId,
    ) ?? null
  }

  async append(storeId: string, sale: SaleRecord): Promise<SaleRecord> {
    let result: SaleRecord | null = null

    const task = this.writeQueue.then(async () => {
      const data = await this.read(storeId)

      const sameRequest = data.sales.find((candidate) =>
        candidate.clientRequestId === sale.clientRequestId,
      )
      if (sameRequest) {
        result = sameRequest
        return
      }

      if (data.sales.some((candidate) => candidate.id === sale.id)) {
        throw new Error('Sale id already exists')
      }

      if (
        sale.payment
        && data.sales.some((candidate) =>
          candidate.payment?.orderId === sale.payment?.orderId,
        )
      ) {
        throw new Error('Payment order is already linked to another sale')
      }

      data.sales.unshift(sale)
      data.sales = data.sales.slice(0, 20_000)
      await this.write(storeId, data)
      result = sale
    })

    this.writeQueue = task.catch(() => undefined)
    await task

    if (!result) throw new Error('Sale append failed')
    return result
  }
}
