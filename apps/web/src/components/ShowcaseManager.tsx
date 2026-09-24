import { useEffect, useMemo, useState } from 'react'
import {
  listSharedImages,
  resolveProductImageUrl,
  uploadSharedImage,
  type SharedImageAsset,
} from '../asset-api'
import type { Product } from '../domain'

interface Props {
  products: Product[]
  onCommit: (products: Product[]) => void
}

export function ShowcaseManager({ products, onCommit }: Props) {
  const [draft, setDraft] = useState<Product[]>(products)
  const [dirty, setDirty] = useState(false)
  const [assets, setAssets] = useState<SharedImageAsset[]>([])
  const [libraryMessage, setLibraryMessage] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty) setDraft(products)
  }, [products, dirty])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const next = await listSharedImages()
        if (!cancelled) {
          setAssets(next)
          setLibraryMessage('')
        }
      } catch {
        if (!cancelled) setLibraryMessage('Biblioteca compartida no disponible en modo local.')
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const visibleCount = useMemo(
    () => draft.filter((product) => product.active && product.showOnShowcase).length,
    [draft],
  )

  const heroCount = useMemo(
    () => draft.filter((product) => product.active && product.showOnShowcase && product.featured).length,
    [draft],
  )

  function patch(id: string, changes: Partial<Product>) {
    setDraft((current) => current.map((product) => product.id === id ? { ...product, ...changes } : product))
    setDirty(true)
  }

  async function upload(productId: string, file: File | undefined) {
    if (!file) return
    setUploadingId(productId)
    setLibraryMessage('')

    try {
      const asset = await uploadSharedImage(file)
      setAssets((current) => [asset, ...current.filter((item) => item.fileName !== asset.fileName)])
      patch(productId, { imageUrl: asset.url })
      setLibraryMessage('Imagen cargada. Guarda el contenido TV para asociarla al producto.')
    } catch (error) {
      setLibraryMessage((error as Error).message)
    } finally {
      setUploadingId(null)
    }
  }

  function save() {
    onCommit(draft)
    setDirty(false)
    setLibraryMessage('Contenido TV guardado en el catálogo compartido.')
  }

  function cancel() {
    setDraft(products)
    setDirty(false)
    setLibraryMessage('')
  }

  return (
    <section className="showcase-manager">
      <div className="showcase-manager-head">
        <div>
          <p className="eyebrow">Contenido TV</p>
          <h3>Qué verá el cliente</h3>
          <p>{visibleCount} productos visibles · {heroCount} destacados rotativos · {assets.length} imágenes compartidas</p>
        </div>
        <div className="showcase-manager-actions">
          {dirty ? <button className="ghost" type="button" onClick={cancel}>Descartar</button> : null}
          <button className="primary save-prices" disabled={!dirty} type="button" onClick={save}>Guardar contenido TV</button>
        </div>
      </div>

      {libraryMessage ? <div className="asset-library-message">{libraryMessage}</div> : null}

      {assets.length ? (
        <div className="asset-library-strip">
          <div className="asset-library-title">
            <strong>Biblioteca compartida</strong>
            <span>Últimas imágenes disponibles para la TV</span>
          </div>
          <div className="asset-library-thumbs">
            {assets.slice(0, 8).map((asset) => (
              <img
                key={asset.fileName}
                src={resolveProductImageUrl(asset.url)}
                alt={asset.fileName}
                title={asset.fileName}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="showcase-manager-list">
        {[...draft].sort((a, b) => a.sortOrder - b.sortOrder).map((product) => {
          const resolvedImage = resolveProductImageUrl(product.imageUrl)
          const sharedValue = product.imageUrl?.startsWith('/api/') ? product.imageUrl : ''

          return (
            <article className={product.active ? 'showcase-product-row' : 'showcase-product-row inactive'} key={product.id}>
              <div className="showcase-manager-thumb">
                {resolvedImage ? <img src={resolvedImage} alt={product.name} /> : <span>🥩</span>}
              </div>
              <div className="showcase-manager-code">COD {product.code}</div>
              <div className="showcase-manager-product">
                <strong>{product.name}</strong>
                <span>{product.categoryId} · orden {product.sortOrder}</span>
              </div>
              <label><input type="checkbox" checked={product.showOnShowcase} disabled={!product.active} onChange={(event) => patch(product.id, { showOnShowcase: event.target.checked })} /> Mostrar TV</label>
              <label><input type="checkbox" checked={product.featured} disabled={!product.active || !product.showOnShowcase} onChange={(event) => patch(product.id, { featured: event.target.checked })} /> Destacado</label>
              <input
                className="showcase-order-input"
                type="number"
                min="0"
                value={product.sortOrder}
                onChange={(event) => patch(product.id, { sortOrder: Math.max(0, Number(event.target.value) || 0) })}
                aria-label={`Orden de ${product.name}`}
              />
              <input
                className="showcase-meta-input"
                placeholder="Texto corto: Oferta / Recomendado..."
                value={product.promoText ?? ''}
                onChange={(event) => patch(product.id, { promoText: event.target.value.slice(0, 48) })}
              />
              <div className="showcase-image-controls">
                <select
                  value={sharedValue}
                  onChange={(event) => patch(product.id, { imageUrl: event.target.value || undefined })}
                  aria-label={`Imagen compartida de ${product.name}`}
                >
                  <option value="">Biblioteca...</option>
                  {assets.map((asset) => (
                    <option key={asset.fileName} value={asset.url}>{asset.fileName}</option>
                  ))}
                </select>
                <label className="image-upload-button">
                  {uploadingId === product.id ? 'Subiendo...' : 'Subir imagen'}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingId !== null}
                    onChange={(event) => {
                      void upload(product.id, event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>
              <input
                className="showcase-meta-input image-url"
                placeholder="O pega una URL externa"
                value={product.imageUrl?.startsWith('/api/') ? '' : product.imageUrl ?? ''}
                onChange={(event) => patch(product.id, { imageUrl: event.target.value.trim() || undefined })}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
