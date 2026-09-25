import { createHash, randomUUID } from 'node:crypto'
import { DailyCloseStore } from './daily-close-store.js'
import type {
  DailyCloseMethodBreakdown,
  DailyClosePreview,
  DailyCloseRecord,
} from './daily-close-types.js'
import { PaymentStore } from './payment-store.js'
import { SaleStore } from './sale-store.js'

function validBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
}

function assertBusinessTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
  } catch {
    throw new Error('Invalid ORBI business time zone')
  }
}

export function businessDateFor(
  value: string | Date,
  timeZone: string,
): string {
  assertBusinessTimeZone(timeZone)
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) throw new Error('Invalid timestamp for business date')

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

function emptyMethods(): DailyCloseMethodBreakdown {
  return {
    cash: { count: 0, total: 0 },
    debit: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
  }
}

function closeId(businessDate: string, uuid: string) {
  return `CLOSE-${businessDate.replace(/-/g, '')}-${uuid.replace(/-/g, '').slice(0, 12)}`
}

export class DailyCloseService {
  constructor(
    private readonly closes: DailyCloseStore,
    private readonly sales: SaleStore,
    private readonly payments: PaymentStore,
    private readonly businessTimeZone = 'America/Santiago',
    private readonly now: () => Date = () => new Date(),
    private readonly idFactory: () => string = () => randomUUID(),
  ) {
    assertBusinessTimeZone(businessTimeZone)
  }

  todayBusinessDate() {
    return businessDateFor(this.now(), this.businessTimeZone)
  }

  async list(storeId: string, limit = 200) {
    return await this.closes.list(storeId, limit)
  }

  async preview(
    storeId: string,
    requestedDate?: string,
  ): Promise<DailyClosePreview> {
    const businessDate = requestedDate || this.todayBusinessDate()
    if (!validBusinessDate(businessDate)) {
      throw new Error('Daily close business date must be YYYY-MM-DD')
    }

    const [allSales, allPayments] = await Promise.all([
      this.sales.list(storeId, 20_000),
      this.payments.list(storeId, 1_000),
    ])

    const sales = allSales.filter((sale) =>
      businessDateFor(sale.createdAt, this.businessTimeZone) === businessDate,
    )
    const saleByPaymentOrderId = new Map(
      allSales
        .filter((sale) => sale.payment)
        .map((sale) => [sale.payment!.orderId, sale]),
    )
    const paymentById = new Map(allPayments.map((payment) => [payment.id, payment]))

    const methods = emptyMethods()
    for (const sale of sales) {
      methods[sale.paymentMethod].count += 1
      methods[sale.paymentMethod].total += sale.total
    }

    const cardSales = sales.filter((sale) =>
      sale.paymentMethod === 'debit' || sale.paymentMethod === 'credit',
    )

    let linkedCardSales = 0
    let refundedAfterSale = 0
    let cardLinkMismatches = 0

    for (const sale of cardSales) {
      const order = sale.payment ? paymentById.get(sale.payment.orderId) : undefined
      if (!order) {
        cardLinkMismatches += 1
        continue
      }
      if (order.status === 'refunded') {
        refundedAfterSale += 1
        continue
      }
      if (order.status === 'processed') {
        linkedCardSales += 1
        continue
      }
      cardLinkMismatches += 1
    }

    const orphanProcessedOrders = allPayments.filter((order) =>
      order.status === 'processed'
      && businessDateFor(order.createdAt, this.businessTimeZone) === businessDate
      && !saleByPaymentOrderId.has(order.id),
    )

    const warnings: string[] = []
    if (orphanProcessedOrders.length) {
      warnings.push(
        `${orphanProcessedOrders.length} pago(s) processed del día no tienen venta ORBI enlazada.`,
      )
    }
    if (refundedAfterSale) {
      warnings.push(
        `${refundedAfterSale} venta(s) del día tienen un pago posteriormente marcado como refunded.`,
      )
    }
    if (cardLinkMismatches) {
      warnings.push(
        `${cardLinkMismatches} venta(s) con tarjeta no tienen un estado Payment Core compatible con el cierre.`,
      )
    }

    const fingerprintSales = sales
      .map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        total: sale.total,
        paymentOrderId: sale.payment?.orderId ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    const relevantPaymentIds = new Set([
      ...cardSales.flatMap((sale) => sale.payment ? [sale.payment.orderId] : []),
      ...orphanProcessedOrders.map((order) => order.id),
    ])
    const fingerprintPayments = allPayments
      .filter((order) => relevantPaymentIds.has(order.id))
      .map((order) => ({
        id: order.id,
        status: order.status,
        amount: order.amount,
        requestedMethod: order.requestedMethod,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        externalReference: order.externalReference,
        terminalId: order.terminalId,
        updatedAt: order.updatedAt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    const sourceFingerprint = createHash('sha256')
      .update(JSON.stringify({
        businessDate,
        businessTimeZone: this.businessTimeZone,
        sales: fingerprintSales,
        payments: fingerprintPayments,
      }))
      .digest('hex')

    return {
      storeId,
      businessDate,
      businessTimeZone: this.businessTimeZone,
      generatedAt: this.now().toISOString(),
      providerCallsMade: false,
      salesCount: sales.length,
      salesTotal: sales.reduce((sum, sale) => sum + sale.total, 0),
      methods,
      reconciliation: {
        linkedCardSales,
        orphanProcessed: orphanProcessedOrders.length,
        refundedAfterSale,
        cardLinkMismatches,
      },
      status: warnings.length ? 'attention_required' : 'reconciled',
      warnings,
      sourceFingerprint,
    }
  }

  async close(
    storeId: string,
    requestedDate?: string,
  ): Promise<DailyCloseRecord> {
    const preview = await this.preview(storeId, requestedDate)
    const createdAt = this.now().toISOString()

    return await this.closes.append(storeId, {
      ...preview,
      id: closeId(preview.businessDate, this.idFactory()),
      createdAt,
      generatedAt: createdAt,
    })
  }
}
