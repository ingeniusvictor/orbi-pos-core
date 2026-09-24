import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Product } from './domain'
import {
  detectCatalogSync,
  fetchRemoteCatalog,
  ORBI_STORE_ID,
  publishRemoteCatalog,
  RemoteCatalogConflict,
  type CatalogSyncStatus,
} from './catalog-sync'

interface Options {
  products: Product[]
  setProducts: Dispatch<SetStateAction<Product[]>>
  pollMs?: number
}

export function useCatalogSync({ products, setProducts, pollMs = 3000 }: Options) {
  const [status, setStatus] = useState<CatalogSyncStatus>('connecting')
  const [revision, setRevision] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const enabledRef = useRef(false)
  const revisionRef = useRef(0)
  const productsRef = useRef(products)

  useEffect(() => {
    productsRef.current = products
  }, [products])

  const acceptRemote = useCallback((snapshot: {
    revision: number
    updatedAt: string
    products: Product[]
  }) => {
    revisionRef.current = snapshot.revision
    setRevision(snapshot.revision)
    setLastUpdatedAt(snapshot.updatedAt)
    productsRef.current = snapshot.products
    setProducts(snapshot.products)
  }, [setProducts])

  useEffect(() => {
    const controller = new AbortController()
    let stopped = false
    let timer: number | undefined

    async function poll() {
      if (!enabledRef.current || stopped) return
      try {
        const remote = await fetchRemoteCatalog(ORBI_STORE_ID, controller.signal)
        if (remote && remote.revision > revisionRef.current) {
          acceptRemote(remote)
        }
        if (!stopped) setStatus('synced')
      } catch {
        if (!stopped) setStatus('offline')
      }
    }

    async function bootstrap() {
      setStatus('connecting')
      const available = await detectCatalogSync(controller.signal)
      if (stopped) return

      if (!available) {
        enabledRef.current = false
        setStatus('local')
        return
      }

      enabledRef.current = true
      try {
        const remote = await fetchRemoteCatalog(ORBI_STORE_ID, controller.signal)
        if (stopped) return

        if (remote) {
          acceptRemote(remote)
        } else {
          const created = await publishRemoteCatalog(productsRef.current, 0, ORBI_STORE_ID)
          if (!stopped) acceptRemote(created)
        }
        if (!stopped) setStatus('synced')
      } catch {
        if (!stopped) setStatus('offline')
      }

      timer = window.setInterval(poll, pollMs)
    }

    void bootstrap()

    return () => {
      stopped = true
      controller.abort()
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [acceptRemote, pollMs])

  const publish = useCallback(async (nextProducts: Product[]) => {
    productsRef.current = nextProducts
    setProducts(nextProducts)

    if (!enabledRef.current) return

    setStatus('syncing')
    try {
      const remote = await publishRemoteCatalog(nextProducts, revisionRef.current, ORBI_STORE_ID)
      revisionRef.current = remote.revision
      setRevision(remote.revision)
      setLastUpdatedAt(remote.updatedAt)
      setStatus('synced')
    } catch (error) {
      if (error instanceof RemoteCatalogConflict) {
        acceptRemote(error.current)
        setStatus('conflict')
        window.setTimeout(() => setStatus('synced'), 1800)
        return
      }
      setStatus('offline')
    }
  }, [acceptRemote, setProducts])

  return {
    status,
    revision,
    lastUpdatedAt,
    storeId: ORBI_STORE_ID,
    publish,
    shared: status !== 'local' && enabledRef.current,
  }
}
