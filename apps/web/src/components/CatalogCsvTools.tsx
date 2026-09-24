import { useRef, useState } from 'react'
import type { Product } from '../domain'
import {
  buildCatalogCsv,
  buildCatalogTemplateCsv,
  previewCatalogImport,
  type CatalogImportPreview,
} from '../catalog-csv'

interface Props {
  products: Product[]
  categoryIds: string[]
  onImport: (products: Product[]) => void
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function CatalogCsvTools({ products, categoryIds, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null)
  const [filename, setFilename] = useState('')

  async function chooseFile(file: File | undefined) {
    if (!file) return
    const csv = await file.text()
    setFilename(file.name)
    setPreview(previewCatalogImport(csv, products, categoryIds))
  }

  function apply() {
    if (!preview || preview.rejected > 0 || (preview.added === 0 && preview.updated === 0)) return
    onImport(preview.nextProducts)
    setPreview(null)
    setFilename('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="catalog-tools">
      <div className="catalog-tools-copy">
        <p className="eyebrow">Carga masiva</p>
        <h3>Importar / exportar catálogo</h3>
        <p>Cuando llegue la lista real de El Chunchito podremos cargar decenas de productos en una sola operación, con vista previa antes de guardar.</p>
      </div>

      <div className="catalog-tools-actions">
        <button className="ghost" type="button" onClick={() => downloadText('orbi-el-chunchito-catalog.csv', buildCatalogCsv(products))}>Exportar catálogo</button>
        <button className="ghost" type="button" onClick={() => downloadText('orbi-catalog-template.csv', buildCatalogTemplateCsv())}>Plantilla CSV</button>
        <button className="primary catalog-import-button" type="button" onClick={() => inputRef.current?.click()}>Importar CSV</button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => { void chooseFile(event.target.files?.[0]) }}
        />
      </div>

      {preview ? (
        <div className="import-preview">
          <div className="import-preview-head">
            <div>
              <strong>{filename}</strong>
              <span>
                {preview.added} nuevos · {preview.updated} actualizados · {preview.unchanged} sin cambios · {preview.rejected} rechazados
              </span>
            </div>
            <div className="import-preview-actions">
              <button className="ghost compact" type="button" onClick={() => setPreview(null)}>Cancelar</button>
              <button className="primary compact" type="button" disabled={preview.rejected > 0 || (preview.added === 0 && preview.updated === 0)} onClick={apply}>Aplicar importación</button>
            </div>
          </div>

          <div className="import-rows">
            {preview.rows.slice(0, 12).map((row) => (
              <div className={`import-row ${row.status}`} key={`${row.line}-${row.code}`}>
                <span>Línea {row.line}</span>
                <strong>{row.code || '—'}</strong>
                <b>{row.status}</b>
                <small>{row.errors.join(' · ') || row.product?.name || ''}</small>
              </div>
            ))}
            {preview.rows.length > 12 ? <div className="import-more">+ {preview.rows.length - 12} filas adicionales</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
