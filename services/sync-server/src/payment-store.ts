import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PaymentOrderRecord } from './payment-types.js'

interface PaymentData {
  orders: PaymentOrderRecord[]
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

export class PaymentStore {
  constructor(private readonly dataDir: string) {}

  private filePath(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'payments.json')
  }

  private async read(storeId: string): Promise<PaymentData> {
    const file = this.filePath(storeId)
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PaymentData>
      return {
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { orders: [] }
      throw error
    }
  }

  private async write(storeId: string, data: PaymentData): Promise<void> {
    const file = this.filePath(storeId)
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
    await rename(temp, file)
  }

  async list(storeId: string, limit = 100): Promise<PaymentOrderRecord[]> {
    const data = await this.read(storeId)
    return data.orders
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 1000)))
  }

  async get(storeId: string, id: string): Promise<PaymentOrderRecord | null> {
    const data = await this.read(storeId)
    return data.orders.find((order) => order.id === id) ?? null
  }

  async findByClientRequestId(
    storeId: string,
    clientRequestId: string,
  ): Promise<PaymentOrderRecord | null> {
    const data = await this.read(storeId)
    return data.orders.find((order) => order.clientRequestId === clientRequestId) ?? null
  }

  async findByProviderOrderId(
    storeId: string,
    providerOrderId: string,
  ): Promise<PaymentOrderRecord | null> {
    const data = await this.read(storeId)
    return data.orders.find((order) =>
      order.providerOrderId.toLowerCase() === providerOrderId.toLowerCase(),
    ) ?? null
  }

  async put(storeId: string, order: PaymentOrderRecord): Promise<PaymentOrderRecord> {
    const data = await this.read(storeId)
    const index = data.orders.findIndex((candidate) => candidate.id === order.id)

    if (index >= 0) data.orders[index] = order
    else data.orders.unshift(order)

    data.orders = data.orders.slice(0, 1000)
    await this.write(storeId, data)
    return order
  }
}
