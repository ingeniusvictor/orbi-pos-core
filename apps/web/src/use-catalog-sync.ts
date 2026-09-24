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
  const pendingRef = useRef<Product[] | null>(null)
  const busyRef = useRef(false)

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
    pendingRef.current = null
    setProducts(snapshot.products)
  }, [setProducts])

  useEffect(() => {
    const controller = new AbortController()
    let stopped = false

    async function tick() {
      if (stopped || busyRef.current) return
      busyRef.current = true

      try {
        if (!enabledRef.current) {
          const available = await detectCatalogSync(controller.signal)
          if (stopped) return
          if (!available) {
            setStatus((current) => current === 'connecting' ? 'local' : current === 'offline' ? 'offline' : 'local')
            return
          }
          enabledRef.current = true
        }

        const remote = await fetchRemoteCatalog(ORBI_STORE_ID, controller.signal)
        if (stopped) return

        if (!remote) {
          const created = await publishRemoteCatalog(productsRef.current, 0, ORBI_STORE_ID)
          if (!stopped) {
            acceptRemote(created)
            setStatus('synced')
          }
          return
        }

        const pending = pendingRef.current
        if (pending) {
          if (remote.revision === revisionRef.current) {
            const published = await publishRemoteCatalog(pending, remote.revision, ORBI_STORE_ID)
            if (!stopped) {
              acceptRemote(published)
              setStatus('synced')
            }
            return
          }

          acceptRemote(remote)
          if (!stopped) setStatus('conflict')
          return
        }

        if (remote.revision > revisionRef.current) {
          acceptRemote(remote)
        }
        if (!stopped) setStatus('synced')
      } catch {
        if (!stopped) setStatus('offline')
      } finally {
        busyRef.current = false
      }
    }

    setStatus('connecting')
    void tick()
    const timer = window.setInterval(() => { void tick() }, pollMs)

    return () => {
      stopped = true
      controller.abort()
      window.clearInterval(timer)
    }
  }, [acceptRemote, pollMs])

  const publish = useCallback(async (nextProducts: Product[]) => {
    productsRef.current = nextProducts
    setProducts(nextProducts)
    pendingRef.current = nextProducts

    if (!enabledRef.current) {
      setStatus('local')
      return
    }

    setStatus('syncing')
    try {
      const remote = await publishRemoteCatalog(nextProducts, revisionRef.current, ORBI_STORE_ID)
      pendingRef.current = null
      revisionRef.current = remote.revision
      setRevision(remote.revision)
      setLastUpdatedAt(remote.updatedAt)
      setStatus('synced')
    } catch (error) {
      if (error instanceof RemoteCatalogConflict) {
        acceptRemote(error.current)
        setStatus('conflict')
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
