import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CatalogConflictError, CatalogStore } from './catalog-store.js'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = process.env.ORBI_POS_DATA_DIR
  ? path.resolve(process.env.ORBI_POS_DATA_DIR)
  : path.resolve(process.cwd(), 'data')

const store = new CatalogStore(DATA_DIR)
const app = express()

app.use(express.json({ limit: '4mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'orbi-pos-sync',
    mode: 'lan-pilot',
  })
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
