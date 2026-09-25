import { createHash, randomUUID } from 'node:crypto'
import { businessDateFor } from './daily-close-service.js'
import { CashDrawerStore } from './cash-drawer-store.js'
import type {
  CashDrawerMovement,
  CashDrawerMovementType,
  CashDrawerPreview,
  CashDrawerSession,
} from './cash-drawer-types.js'
import { SaleStore } from './sale-store.js'

function integerMoney(value: unknown, label: string, allowZero = true) {
  if (!Number.isInteger(value) || Number(value) < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} integer CLP amount`)
  }
  return Number(value)
}

function safeReason(value: unknown) {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (reason.length < 2 || reason.length > 160) {
    throw new Error('Cash movement reason must contain 2–160 characters')
  }
  return reason
}

function id(prefix: string, uuid: string) {
  return `${prefix}-${uuid.replace(/-/g, '')}`
}

function validIso(value: string) {
  return typeof value === 'string'
    && value.length >= 20
    && !Number.isNaN(Date.parse(value))
}

export class CashDrawerService {
  constructor(
    private readonly drawers: CashDrawerStore,
    private readonly sales: SaleStore,
    private readonly businessTimeZone = 'America/Santiago',
    private readonly now: () => Date = () => new Date(),
    private readonly idFactory: () => string = () => randomUUID(),
  ) {
    businessDateFor(this.now(), businessTimeZone)
  }

  async list(storeId: string, limit = 200) {
    return await this.drawers.list(storeId, limit)
  }

  async active(storeId: string) {
    return await this.drawers.active(storeId)
  }

  async open(storeId: string, openingFloatInput: unknown): Promise<CashDrawerSession> {
    const openingFloat = integerMoney(openingFloatInput, 'Opening float')
    const openedAt = this.now().toISOString()
    const businessDate = businessDateFor(openedAt, this.businessTimeZone)

    return await this.drawers.open(storeId, {
      id: id('DRAWER', this.idFactory()),
      storeId,
      businessDate,
      businessTimeZone: this.businessTimeZone,
      openedAt,
      openingFloat,
      status: 'open',
      movements: [],
      audit: [{
        event: 'opened',
        at: openedAt,
        actor: 'orbi-pos-server',
        detail: 'cash_drawer_session',
      }],
    })
  }

  async addMovement(
    storeId: string,
    sessionId: string,
    type: CashDrawerMovementType,
    amountInput: unknown,
    reasonInput: unknown,
  ) {
    if (type !== 'paid_in' && type !== 'paid_out') {
      throw new Error('Cash movement type must be paid_in or paid_out')
    }
    const createdAt = this.now().toISOString()
    const movement: CashDrawerMovement = {
      id: id('MOVE', this.idFactory()),
      type,
      amount: integerMoney(amountInput, 'Cash movement', false),
      reason: safeReason(reasonInput),
      createdAt,
    }
    return await this.drawers.addMovement(storeId, sessionId, movement, createdAt)
  }

  async preview(storeId: string, sessionId: string): Promise<CashDrawerPreview> {
    const session = await this.drawers.get(storeId, sessionId)
    if (!session) throw new Error('Cash drawer session not found')

    if (session.status === 'closed') {
      return {
        sessionId: session.id,
        storeId,
        businessDate: session.businessDate,
        businessTimeZone: session.businessTimeZone,
        generatedAt: session.closedAt!,
        openingFloat: session.openingFloat,
        cashSales: session.cashSales!,
        paidInTotal: session.paidInTotal!,
        paidOutTotal: session.paidOutTotal!,
        expectedCash: session.expectedCash!,
        sourceFingerprint: session.sourceFingerprint!,
        providerCallsMade: false,
      }
    }

    const generatedAt = this.now().toISOString()
    const allSales = await this.sales.list(storeId, 20_000)
    const cashSales = allSales.filter((sale) =>
      sale.paymentMethod === 'cash'
      && validIso(sale.recordedAt)
      && sale.recordedAt >= session.openedAt
      && sale.recordedAt <= generatedAt,
    )

    const paidInTotal = session.movements
      .filter((movement) => movement.type === 'paid_in')
      .reduce((sum, movement) => sum + movement.amount, 0)
    const paidOutTotal = session.movements
      .filter((movement) => movement.type === 'paid_out')
      .reduce((sum, movement) => sum + movement.amount, 0)
    const cashSalesTotal = cashSales.reduce((sum, sale) => sum + sale.total, 0)
    const expectedCash = session.openingFloat + cashSalesTotal + paidInTotal - paidOutTotal

    const sourceFingerprint = createHash('sha256')
      .update(JSON.stringify({
        sessionId: session.id,
        openingFloat: session.openingFloat,
        movements: session.movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          amount: movement.amount,
          reason: movement.reason,
          createdAt: movement.createdAt,
        })),
        cashSales: cashSales.map((sale) => ({
          id: sale.id,
          recordedAt: sale.recordedAt,
          total: sale.total,
        })).sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .digest('hex')

    return {
      sessionId: session.id,
      storeId,
      businessDate: session.businessDate,
      businessTimeZone: session.businessTimeZone,
      generatedAt,
      openingFloat: session.openingFloat,
      cashSales: {
        count: cashSales.length,
        total: cashSalesTotal,
        through: generatedAt,
      },
      paidInTotal,
      paidOutTotal,
      expectedCash,
      sourceFingerprint,
      providerCallsMade: false,
    }
  }

  async close(
    storeId: string,
    sessionId: string,
    countedCashInput: unknown,
  ): Promise<CashDrawerSession> {
    const countedCash = integerMoney(countedCashInput, 'Counted cash')
    const existing = await this.drawers.get(storeId, sessionId)
    if (!existing) throw new Error('Cash drawer session not found')
    if (existing.status === 'closed') {
      return await this.drawers.close(storeId, sessionId, {
        ...existing,
        countedCash,
      })
    }

    const preview = await this.preview(storeId, sessionId)
    const closedAt = this.now().toISOString()
    const closed: CashDrawerSession = {
      ...existing,
      status: 'closed',
      closedAt,
      cashSales: { ...preview.cashSales, through: closedAt },
      paidInTotal: preview.paidInTotal,
      paidOutTotal: preview.paidOutTotal,
      expectedCash: preview.expectedCash,
      countedCash,
      variance: countedCash - preview.expectedCash,
      sourceFingerprint: preview.sourceFingerprint,
      audit: [...existing.audit, {
        event: 'closed',
        at: closedAt,
        actor: 'orbi-pos-server',
        detail: 'physical_count_reconciliation',
      }],
    }
    return await this.drawers.close(storeId, sessionId, closed)
  }
}
