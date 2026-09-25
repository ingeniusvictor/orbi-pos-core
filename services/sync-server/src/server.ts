import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CatalogConflictError, CatalogStore } from './catalog-store.js'
import { AssetStore } from './asset-store.js'
import { PaymentStore } from './payment-store.js'
import { createPaymentRuntime } from './payment-providers.js'
import { PaymentService } from './payment-service.js'
import type { PaymentOrderStatus } from './payment-types.js'
import { ScaleFleetStore } from './scale-fleet-store.js'
import { EvidenceAttachmentStore } from './evidence-attachment-store.js'
import { PilotBackupStore } from './pilot-backup-store.js'
import { ServerDisasterRecoveryStore } from './server-disaster-recovery-store.js'
import { RecoveryDrillStore } from './recovery-drill-store.js'
import { SaleStore } from './sale-store.js'
import { SaleService } from './sale-service.js'
import { PaymentSaleReconciliationService } from './payment-sale-reconciliation.js'
import { DailyCloseStore } from './daily-close-store.js'
import { DailyCloseService } from './daily-close-service.js'
import { CashDrawerStore } from './cash-drawer-store.js'
import { CashDrawerService } from './cash-drawer-service.js'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = process.env.ORBI_POS_DATA_DIR
  ? path.resolve(process.env.ORBI_POS_DATA_DIR)
  : path.resolve(process.cwd(), 'data')

const store = new CatalogStore(DATA_DIR)
const assetStore = new AssetStore(DATA_DIR)
const paymentRuntime = createPaymentRuntime(process.env)
const paymentStore = new PaymentStore(DATA_DIR)
const paymentService = new PaymentService(paymentStore, paymentRuntime)
const saleStore = new SaleStore(DATA_DIR)
const saleService = new SaleService(saleStore, paymentStore)
const paymentSaleReconciliation = new PaymentSaleReconciliationService(paymentStore, saleStore)
const dailyCloseStore = new DailyCloseStore(DATA_DIR)
const dailyCloseService = new DailyCloseService(
  dailyCloseStore,
  saleStore,
  paymentStore,
  process.env.ORBI_BUSINESS_TIME_ZONE ?? 'America/Santiago',
)
const cashDrawerStore = new CashDrawerStore(DATA_DIR)
const cashDrawerService = new CashDrawerService(
  cashDrawerStore,
  saleStore,
  process.env.ORBI_BUSINESS_TIME_ZONE ?? 'America/Santiago',
)
const scaleFleetStore = new ScaleFleetStore(DATA_DIR)
const evidenceAttachmentStore = new EvidenceAttachmentStore(DATA_DIR)
const pilotBackupStore = new PilotBackupStore(DATA_DIR)
const disasterRecoveryStore = new ServerDisasterRecoveryStore(DATA_DIR)
const recoveryDrillStore = new RecoveryDrillStore(DATA_DIR, disasterRecoveryStore)
const app = express()
const startedAt = new Date().toISOString()

app.use(express.json({ limit: '4mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'orbi-pos-sync',
    mode: 'lan-pilot',
    startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    capabilities: {
      sharedCatalog: true,
      sharedImages: true,
      payments: true,
      paymentProvider: paymentRuntime.providerId,
      scaleFleet: true,
      evidenceAttachments: true,
      pilotBackups: true,
      disasterRecovery: true,
      recoveryDrills: true,
      serverSalesLedger: true,
      paymentSaleReconciliation: true,
      dailyClose: true,
      cashDrawer: true,
      businessTimeZone: process.env.ORBI_BUSINESS_TIME_ZONE ?? 'America/Santiago',
    },
  })
})

app.get('/api/stores/:storeId/assets', async (req, res) => {
  try {
    return res.json(await assetStore.list(req.params.storeId))
  } catch (error) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/assets/:fileName', async (req, res) => {
  try {
    const asset = await assetStore.get(req.params.storeId, req.params.fileName)
    if (!asset) {
      return res.status(404).json({ code: 'ASSET_NOT_FOUND' })
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.type(asset.contentType)
    return res.sendFile(asset.filePath)
  } catch (error) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: (error as Error).message })
  }
})

app.put(
  '/api/stores/:storeId/assets/:fileName',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '12mb' }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({ code: 'UNSUPPORTED_IMAGE', message: 'Expected JPG, PNG or WebP image body' })
      }

      const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
      const record = await assetStore.put(
        req.params.storeId,
        req.params.fileName,
        contentType,
        req.body,
      )
      return res.status(201).json(record)
    } catch (error) {
      return res.status(400).json({ code: 'INVALID_IMAGE', message: (error as Error).message })
    }
  },
)


app.get('/api/stores/:storeId/disaster-recovery/certifications', async (req, res) => {
  try {
    return res.json(await recoveryDrillStore.list(req.params.storeId))
  } catch (error) {
    return res.status(400).json({
      code: 'RECOVERY_DRILL_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/disaster-recovery/certifications/:certificateId', async (req, res) => {
  try {
    const record = await recoveryDrillStore.get(
      req.params.storeId,
      req.params.certificateId,
    )
    if (!record) {
      return res.status(404).json({ code: 'RECOVERY_DRILL_CERTIFICATION_NOT_FOUND' })
    }
    return res.json(record)
  } catch (error) {
    return res.status(400).json({
      code: 'RECOVERY_DRILL_READ_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/disaster-recovery/archives/:archiveId/drill', async (req, res) => {
  try {
    return res.status(201).json(await recoveryDrillStore.run(
      req.params.storeId,
      req.params.archiveId,
    ))
  } catch (error) {
    return res.status(400).json({
      code: 'RECOVERY_DRILL_RUN_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/disaster-recovery/archives', async (req, res) => {
  try {
    return res.json(await disasterRecoveryStore.list(req.params.storeId))
  } catch (error) {
    return res.status(400).json({
      code: 'DR_ARCHIVE_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/disaster-recovery/archives', async (req, res) => {
  try {
    const archive = await disasterRecoveryStore.create(
      req.params.storeId,
      String(req.body?.label ?? ''),
      'manual',
    )
    return res.status(201).json(archive)
  } catch (error) {
    return res.status(400).json({
      code: 'DR_ARCHIVE_CREATE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post(
  '/api/stores/:storeId/disaster-recovery/import',
  express.raw({
    type: ['application/gzip', 'application/octet-stream'],
    limit: '160mb',
  }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({
          code: 'DR_ARCHIVE_BODY_REQUIRED',
          message: 'Expected a gzip disaster-recovery archive body',
        })
      }

      const archive = await disasterRecoveryStore.import(
        req.params.storeId,
        req.body,
      )
      return res.status(201).json(archive)
    } catch (error) {
      return res.status(400).json({
        code: 'DR_ARCHIVE_IMPORT_FAILED',
        message: (error as Error).message,
      })
    }
  },
)

app.get('/api/stores/:storeId/disaster-recovery/archives/:archiveId', async (req, res) => {
  try {
    return res.json(await disasterRecoveryStore.inspect(
      req.params.storeId,
      req.params.archiveId,
    ))
  } catch (error) {
    return res.status(400).json({
      code: 'DR_ARCHIVE_INSPECT_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/disaster-recovery/archives/:archiveId/download', async (req, res) => {
  try {
    const filePath = await disasterRecoveryStore.getArchivePath(
      req.params.storeId,
      req.params.archiveId,
    )
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.params.archiveId}"`,
    )
    res.type('application/gzip')
    return res.sendFile(filePath)
  } catch (error) {
    return res.status(400).json({
      code: 'DR_ARCHIVE_DOWNLOAD_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/disaster-recovery/archives/:archiveId/restore', async (req, res) => {
  try {
    return res.json(await disasterRecoveryStore.restore(
      req.params.storeId,
      req.params.archiveId,
      String(req.body?.confirmation ?? ''),
    ))
  } catch (error) {
    return res.status(409).json({
      code: 'DR_ARCHIVE_RESTORE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/pilot-backups', async (req, res) => {
  try {
    return res.json(await pilotBackupStore.list(req.params.storeId))
  } catch (error) {
    return res.status(400).json({
      code: 'PILOT_BACKUP_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/pilot-backups/:backupId', async (req, res) => {
  try {
    const record = await pilotBackupStore.get(
      req.params.storeId,
      req.params.backupId,
    )
    if (!record) {
      return res.status(404).json({ code: 'PILOT_BACKUP_NOT_FOUND' })
    }
    return res.json(record)
  } catch (error) {
    return res.status(400).json({
      code: 'PILOT_BACKUP_READ_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/pilot-backups', async (req, res) => {
  try {
    const record = await pilotBackupStore.put(
      req.params.storeId,
      req.body?.bundle,
    )
    return res.status(201).json(record)
  } catch (error) {
    return res.status(400).json({
      code: 'PILOT_BACKUP_CREATE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/evidence/attachments', async (req, res) => {
  try {
    return res.json(await evidenceAttachmentStore.list(req.params.storeId))
  } catch (error) {
    return res.status(400).json({
      code: 'EVIDENCE_ATTACHMENT_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/evidence/attachments/:fileName', async (req, res) => {
  try {
    const attachment = await evidenceAttachmentStore.get(
      req.params.storeId,
      req.params.fileName,
    )
    if (!attachment) {
      return res.status(404).json({ code: 'EVIDENCE_ATTACHMENT_NOT_FOUND' })
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.record.originalName)}`,
    )
    res.type(attachment.record.contentType)
    return res.sendFile(attachment.filePath)
  } catch (error) {
    return res.status(400).json({
      code: 'EVIDENCE_ATTACHMENT_READ_FAILED',
      message: (error as Error).message,
    })
  }
})

app.put(
  '/api/stores/:storeId/evidence/attachments/:fileName',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    limit: '20mb',
  }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({
          code: 'UNSUPPORTED_EVIDENCE_ATTACHMENT',
          message: 'Expected JPG, PNG, WebP or PDF body',
        })
      }

      const contentType = String(req.headers['content-type'] ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase()

      const encodedOriginalName = String(req.headers['x-orbi-original-name'] ?? '')
      let originalName = encodedOriginalName
      try {
        originalName = decodeURIComponent(encodedOriginalName)
      } catch {
        return res.status(400).json({
          code: 'INVALID_EVIDENCE_FILENAME',
          message: 'Invalid original evidence file name',
        })
      }

      const record = await evidenceAttachmentStore.put(
        req.params.storeId,
        req.params.fileName,
        contentType,
        req.body,
        originalName,
        String(req.headers['x-orbi-case-id'] ?? '') || undefined,
        String(req.headers['x-orbi-entry-id'] ?? '') || undefined,
      )

      return res.status(201).json(record)
    } catch (error) {
      return res.status(400).json({
        code: 'EVIDENCE_ATTACHMENT_UPLOAD_FAILED',
        message: (error as Error).message,
      })
    }
  },
)

app.get('/api/stores/:storeId/scales/fleet', async (req, res) => {
  try {
    return res.json(await scaleFleetStore.get(req.params.storeId))
  } catch (error) {
    return res.status(400).json({ code: 'SCALE_FLEET_READ_FAILED', message: (error as Error).message })
  }
})

app.put('/api/stores/:storeId/scales/fleet', async (req, res) => {
  try {
    return res.json(await scaleFleetStore.put(req.params.storeId, {
      syncBehavior: req.body?.syncBehavior,
      devices: req.body?.devices,
    }))
  } catch (error) {
    return res.status(400).json({ code: 'SCALE_FLEET_SAVE_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/cash-drawer', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200)
    return res.json(await cashDrawerService.list(req.params.storeId, limit))
  } catch (error) {
    return res.status(400).json({ code: 'CASH_DRAWER_LIST_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/cash-drawer/active', async (req, res) => {
  try {
    return res.json(await cashDrawerService.active(req.params.storeId))
  } catch (error) {
    return res.status(400).json({ code: 'CASH_DRAWER_ACTIVE_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/cash-drawer/open', async (req, res) => {
  try {
    return res.status(201).json(await cashDrawerService.open(
      req.params.storeId,
      req.body?.openingFloat,
    ))
  } catch (error) {
    return res.status(409).json({ code: 'CASH_DRAWER_OPEN_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/cash-drawer/:sessionId/preview', async (req, res) => {
  try {
    return res.json(await cashDrawerService.preview(
      req.params.storeId,
      req.params.sessionId,
    ))
  } catch (error) {
    return res.status(400).json({ code: 'CASH_DRAWER_PREVIEW_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/cash-drawer/:sessionId/movements', async (req, res) => {
  try {
    return res.status(201).json(await cashDrawerService.addMovement(
      req.params.storeId,
      req.params.sessionId,
      req.body?.type,
      req.body?.amount,
      req.body?.reason,
    ))
  } catch (error) {
    return res.status(409).json({ code: 'CASH_DRAWER_MOVEMENT_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/cash-drawer/:sessionId/close', async (req, res) => {
  try {
    return res.json(await cashDrawerService.close(
      req.params.storeId,
      req.params.sessionId,
      req.body?.countedCash,
    ))
  } catch (error) {
    return res.status(409).json({ code: 'CASH_DRAWER_CLOSE_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/daily-close/preview', async (req, res) => {
  try {
    const requestedDate = typeof req.query.date === 'string'
      ? req.query.date
      : undefined
    return res.json(await dailyCloseService.preview(
      req.params.storeId,
      requestedDate,
    ))
  } catch (error) {
    return res.status(400).json({
      code: 'DAILY_CLOSE_PREVIEW_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/daily-close', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200)
    return res.json(await dailyCloseService.list(req.params.storeId, limit))
  } catch (error) {
    return res.status(400).json({
      code: 'DAILY_CLOSE_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/daily-close', async (req, res) => {
  try {
    const requestedDate = typeof req.body?.date === 'string'
      ? req.body.date
      : undefined
    return res.status(201).json(await dailyCloseService.close(
      req.params.storeId,
      requestedDate,
    ))
  } catch (error) {
    return res.status(409).json({
      code: 'DAILY_CLOSE_CREATE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/sales', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200)
    return res.json(await saleService.list(req.params.storeId, limit))
  } catch (error) {
    return res.status(400).json({
      code: 'SALE_LIST_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/sales/:saleId', async (req, res) => {
  try {
    const sale = await saleService.get(
      req.params.storeId,
      req.params.saleId,
    )
    if (!sale) return res.status(404).json({ code: 'SALE_NOT_FOUND' })
    return res.json(sale)
  } catch (error) {
    return res.status(400).json({
      code: 'SALE_READ_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/sales', async (req, res) => {
  try {
    const sale = await saleService.create(req.params.storeId, {
      clientRequestId: req.body?.clientRequestId,
      createdAt: req.body?.createdAt,
      lines: req.body?.lines,
      paymentMethod: req.body?.paymentMethod,
      total: req.body?.total,
      payment: req.body?.payment,
    })
    return res.status(201).json(sale)
  } catch (error) {
    return res.status(409).json({
      code: 'SALE_CREATE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/payments/runtime', (req, res) => {
  return res.json({
    provider: paymentService.providerId(),
    terminal: paymentService.terminal(),
    storeId: req.params.storeId,
  })
})

app.get('/api/stores/:storeId/payments/reconciliation', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 500)
    return res.json(await paymentSaleReconciliation.inspect(req.params.storeId, limit))
  } catch (error) {
    return res.status(400).json({
      code: 'PAYMENT_SALE_RECONCILIATION_FAILED',
      message: (error as Error).message,
    })
  }
})

app.get('/api/stores/:storeId/payments/orders', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100)
    return res.json(await paymentService.list(req.params.storeId, limit))
  } catch (error) {
    return res.status(400).json({ code: 'PAYMENT_LIST_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/payments/orders', async (req, res) => {
  try {
    const order = await paymentService.create(req.params.storeId, {
      clientRequestId: req.body?.clientRequestId,
      amount: req.body?.amount,
      requestedMethod: req.body?.requestedMethod,
    })
    return res.status(201).json(order)
  } catch (error) {
    return res.status(400).json({ code: 'PAYMENT_CREATE_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/payments/orders/:orderId', async (req, res) => {
  try {
    const order = await paymentService.get(req.params.storeId, req.params.orderId)
    if (!order) return res.status(404).json({ code: 'PAYMENT_ORDER_NOT_FOUND' })
    return res.json(order)
  } catch (error) {
    return res.status(400).json({ code: 'PAYMENT_REFRESH_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/payments/reconcile-provider-order', async (req, res) => {
  try {
    const providerOrderId = String(req.body?.providerOrderId ?? '')
    if (!providerOrderId) {
      return res.status(400).json({
        code: 'PROVIDER_ORDER_ID_REQUIRED',
        message: 'providerOrderId is required',
      })
    }

    return res.json(await paymentService.reconcileProviderOrder(
      req.params.storeId,
      providerOrderId,
    ))
  } catch (error) {
    return res.status(409).json({
      code: 'PAYMENT_RECONCILE_FAILED',
      message: (error as Error).message,
    })
  }
})

app.post('/api/stores/:storeId/payments/orders/:orderId/cancel', async (req, res) => {
  try {
    return res.json(await paymentService.cancel(req.params.storeId, req.params.orderId))
  } catch (error) {
    return res.status(409).json({ code: 'PAYMENT_CANCEL_FAILED', message: (error as Error).message })
  }
})

app.post('/api/stores/:storeId/payments/orders/:orderId/mock-status', async (req, res) => {
  try {
    const status = req.body?.status as PaymentOrderStatus
    return res.json(await paymentService.mockTransition(
      req.params.storeId,
      req.params.orderId,
      status,
    ))
  } catch (error) {
    return res.status(400).json({ code: 'MOCK_PAYMENT_TRANSITION_FAILED', message: (error as Error).message })
  }
})

app.get('/api/stores/:storeId/catalog', async (req, res) => {
  try {
    const snapshot = await store.get(req.params.storeId)
    if (!snapshot) {
      return res.status(404).json({ code: 'CATALOG_NOT_FOUND' })
    }
    return res.json(snapshot)
  } catch (error) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: (error as Error).message })
  }
})

app.put('/api/stores/:storeId/catalog', async (req, res) => {
  try {
    const snapshot = await store.put(
      req.params.storeId,
      req.body?.products,
      req.body?.baseRevision,
    )
    return res.json(snapshot)
  } catch (error) {
    if (error instanceof CatalogConflictError) {
      return res.status(409).json({
        code: 'REVISION_CONFLICT',
        current: error.current,
      })
    }
    return res.status(400).json({ code: 'INVALID_REQUEST', message: (error as Error).message })
  }
})

app.use('/api', (_req, res) => {
  res.status(404).json({ code: 'API_NOT_FOUND' })
})

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const webDist = path.resolve(currentDir, '../../../apps/web/dist')

if (existsSync(webDist)) {
  app.use(express.static(webDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'))
  })
}

app.listen(PORT, HOST, () => {
  console.log(`ORBI POS sync server listening on http://${HOST}:${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
  if (!existsSync(webDist)) {
    console.log('Web build not found. Run npm run build to serve the ORBI POS UI.')
  }
})
