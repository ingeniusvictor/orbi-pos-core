import { PaymentStore } from './payment-store.js'
import type { PaymentOrderRecord } from './payment-types.js'
import { SaleStore } from './sale-store.js'

export type PaymentSaleReconciliationState =
  | 'linked'
  | 'orphan_processed'
  | 'refunded_after_sale'
  | 'unlinked_nonprocessed'

export interface PaymentSaleReconciliationRecord {
  order: PaymentOrderRecord
  state: PaymentSaleReconciliationState
  saleId?: string
}

export interface PaymentSaleReconciliationSnapshot {
  storeId: string
  generatedAt: string
  providerCallsMade: false
  summary: {
    total: number
    linked: number
    orphanProcessed: number
    refundedAfterSale: number
    unlinkedNonprocessed: number
  }
  records: PaymentSaleReconciliationRecord[]
}

export class PaymentSaleReconciliationService {
  constructor(
    private readonly payments: PaymentStore,
    private readonly sales: SaleStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async inspect(
    storeId: string,
    limit = 500,
  ): Promise<PaymentSaleReconciliationSnapshot> {
    const boundedLimit = Math.max(1, Math.min(
      Number.isFinite(limit) ? Math.trunc(limit) : 500,
      1000,
    ))

    const [orders, sales] = await Promise.all([
      this.payments.list(storeId, boundedLimit),
      this.sales.list(storeId, 1000),
    ])

    const saleByPaymentOrderId = new Map(
      sales
        .filter((sale) => sale.payment)
        .map((sale) => [sale.payment!.orderId, sale]),
    )

    const records = orders.map((order): PaymentSaleReconciliationRecord => {
      const sale = saleByPaymentOrderId.get(order.id)

      if (sale) {
        return {
          order,
          state: order.status === 'refunded'
            ? 'refunded_after_sale'
            : 'linked',
          saleId: sale.id,
        }
      }

      return {
        order,
        state: order.status === 'processed'
          ? 'orphan_processed'
          : 'unlinked_nonprocessed',
      }
    })

    return {
      storeId,
      generatedAt: this.now().toISOString(),
      providerCallsMade: false,
      summary: {
        total: records.length,
        linked: records.filter((record) => record.state === 'linked').length,
        orphanProcessed: records.filter((record) => record.state === 'orphan_processed').length,
        refundedAfterSale: records.filter((record) => record.state === 'refunded_after_sale').length,
        unlinkedNonprocessed: records.filter((record) => record.state === 'unlinked_nonprocessed').length,
      },
      records,
    }
  }
}
