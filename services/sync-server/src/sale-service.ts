import { randomUUID } from 'node:crypto'
import { PaymentStore } from './payment-store.js'
import { SaleStore } from './sale-store.js'
import {
  isCardPaymentMethod,
  type CreateSaleInput,
  type SaleLineRecord,
  type SalePaymentMethod,
  type SaleRecord,
} from './sale-types.js'

function compactDate(date: Date) {
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function saleId(now: Date) {
  return `SALE-${compactDate(now)}-${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function roundMoney(value: number) {
  return Math.round(value / 10) * 10
}

function validDate(value: string | undefined) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function validateLine(line: SaleLineRecord, index: number) {
  if (!line || typeof line !== 'object') {
    throw new Error(`Invalid sale line at index ${index}`)
  }
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(line.id)) {
    throw new Error(`Invalid sale line id at index ${index}`)
  }
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(line.productId)) {
    throw new Error(`Invalid sale product id at index ${index}`)
  }
  if (
    typeof line.name !== 'string'
    || !line.name.trim()
    || line.name.trim().length > 160
  ) {
    throw new Error(`Invalid sale product name at index ${index}`)
  }
  if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0 || line.unitPrice > 100_000_000) {
    throw new Error(`Invalid sale unit price at index ${index}`)
  }
  if (
    typeof line.quantity !== 'number'
    || !Number.isFinite(line.quantity)
    || line.quantity <= 0
    || line.quantity > 100_000
  ) {
    throw new Error(`Invalid sale quantity at index ${index}`)
  }
  if (!['KG', 'UNIT', 'PACK'].includes(line.unitType)) {
    throw new Error(`Invalid sale unit type at index ${index}`)
  }
  if (!Number.isInteger(line.subtotal) || line.subtotal < 0) {
    throw new Error(`Invalid sale subtotal at index ${index}`)
  }
  if (line.subtotal !== roundMoney(line.unitPrice * line.quantity)) {
    throw new Error(`Sale subtotal does not match ORBI CLP-10 rounding at index ${index}`)
  }
}

function validateMethod(method: SalePaymentMethod) {
  if (!['cash', 'debit', 'credit', 'transfer'].includes(method)) {
    throw new Error('Invalid sale payment method')
  }
}

export class SaleService {
  constructor(
    private readonly sales: SaleStore,
    private readonly payments: PaymentStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(storeId: string, limit = 200) {
    return await this.sales.list(storeId, limit)
  }

  async get(storeId: string, saleIdValue: string) {
    return await this.sales.get(storeId, saleIdValue)
  }

  async create(
    storeId: string,
    input: CreateSaleInput,
  ): Promise<SaleRecord> {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.clientRequestId)) {
      throw new Error('Invalid sale client request id')
    }

    const existing = await this.sales.findByClientRequestId(
      storeId,
      input.clientRequestId,
    )
    if (existing) return existing

    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 200) {
      throw new Error('Sale must contain 1–200 lines')
    }

    const lineIds = new Set<string>()
    input.lines.forEach((line, index) => {
      validateLine(line, index)
      if (lineIds.has(line.id)) throw new Error('Duplicate sale line id')
      lineIds.add(line.id)
    })

    validateMethod(input.paymentMethod)

    const computedTotal = input.lines.reduce((sum, line) => sum + line.subtotal, 0)
    if (
      !Number.isInteger(input.total)
      || input.total <= 0
      || input.total !== computedTotal
    ) {
      throw new Error('Sale total does not match line subtotals')
    }

    if (isCardPaymentMethod(input.paymentMethod)) {
      if (!input.payment) {
        throw new Error('Card sale requires Payment Core trace')
      }

      const payment = await this.payments.get(storeId, input.payment.orderId)
      if (!payment) throw new Error('Payment Core order not found for card sale')
      if (payment.status !== 'processed') {
        throw new Error('Card sale requires Payment Core status=processed')
      }
      if (payment.amount !== input.total) {
        throw new Error('Card sale total does not match Payment Core amount')
      }
      if (payment.requestedMethod !== input.paymentMethod) {
        throw new Error('Card sale method does not match Payment Core')
      }
      if (
        payment.provider !== input.payment.provider
        || payment.providerOrderId !== input.payment.providerOrderId
        || payment.externalReference !== input.payment.externalReference
        || payment.terminalId !== input.payment.terminalId
      ) {
        throw new Error('Card sale payment trace does not match Payment Core')
      }

      const existingPaymentSale = await this.sales.findByPaymentOrderId(
        storeId,
        payment.id,
      )
      if (
        existingPaymentSale
        && existingPaymentSale.clientRequestId !== input.clientRequestId
      ) {
        throw new Error('Payment Core order is already linked to another sale')
      }
    } else if (input.payment) {
      throw new Error('Cash/transfer sale cannot contain card payment trace')
    }

    const now = this.now()
    const createdAt = validDate(input.createdAt)
      ? new Date(input.createdAt as string).toISOString()
      : now.toISOString()

    const sale: SaleRecord = {
      id: saleId(now),
      storeId,
      clientRequestId: input.clientRequestId,
      createdAt,
      recordedAt: now.toISOString(),
      source: 'orbi-pos-web',
      lines: input.lines.map((line) => ({
        ...line,
        name: line.name.trim(),
      })),
      paymentMethod: input.paymentMethod,
      total: input.total,
      payment: isCardPaymentMethod(input.paymentMethod)
        ? input.payment
        : undefined,
      audit: [{
        event: 'created',
        at: now.toISOString(),
        actor: 'orbi-pos-web',
        detail: 'server_authoritative',
      }],
    }

    return await this.sales.append(storeId, sale)
  }
}
