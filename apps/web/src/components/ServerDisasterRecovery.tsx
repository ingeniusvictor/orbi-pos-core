import { useEffect, useMemo, useState } from 'react'
import { fetchRemoteCatalog, ORBI_STORE_ID } from '../catalog-sync'
import {
  listEvidenceAttachments,
  type EvidenceAttachmentRecord,
} from '../evidence-attachment-api'
import {
  buildPilotBackupBundle,
  type PilotBackupServerReferences,
} from '../pilot-backup'
import { createPilotBackup } from '../pilot-backup-api'
import {
  createServerDrArchive,
  importServerDrArchive,
  inspectServerDrArchive,
  listServerDrArchives,
  restoreServerDrArchive,
  serverDrDownloadUrl,
  type ServerDrInspection,
  type ServerDrMetadata,
  type ServerDrRestoreResult,
} from '../disaster-recovery-api'

const componentLabels: Record<string, string> = {
  catalog: 'Catálogo + precios',
  payments: 'Payment Core audit',
  'scale-fleet': 'Fleet DIGI RM-60',
  'product-assets': 'Imágenes de productos',
  'evidence-attachments': 'Evidencia OC-27',
  'pilot-backups': 'Backups OC-28',
}

function go(path: string) {
  window.location.href = path
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL')
}

async function currentServerReferences(): Promise<PilotBackupServerReferences> {
  const [catalogResult, attachmentResult] = await Promise.allSettled([
    fetchRemoteCatalog(),
    listEvidenceAttachments(),
  ])

  const catalog = catalogResult.status === 'fulfilled'
    ? catalogResult.value
    : null
  const attachments: EvidenceAttachmentRecord[] =
    attachmentResult.status === 'fulfilled'
      ? attachmentResult.value
      : []

  return {
    catalog: {
      revision: catalog?.revision ?? null,
      updatedAt: catalog?.updatedAt ?? null,
      productCount: catalog?.products.length ?? null,
    },
    evidenceAttachments: attachments.map((item) => ({
      fileName: item.fileName,
      contentType: item.contentType,
      size: item.size,
      sha256: item.sha256,
      uploadedAt: item.uploadedAt,
      caseId: item.caseId,
      entryId: item.entryId,
    })),
  }
}

export function ServerDisasterRecovery() {
  const [archives, setArchives] = useState<ServerDrMetadata[]>([])
  const [inspection, setInspection] = useState<ServerDrInspection | null>(null)
  const [label, setLabel] = useState('Respaldo completo del servidor ORBI')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [restoreResult, setRestoreResult] = useState<ServerDrRestoreResult | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const next = await listServerDrArchives()
      setArchives(next)
      setServerError('')
    } catch (error) {
      setServerError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const latest = archives[0] ?? null
  const requiredConfirmation = `RESTORE ${ORBI_STORE_ID}`

  const protectedComponents = useMemo(
    () => [
      'Catálogo y auditoría de precios',
      'Payment Core: registros históricos, sin credenciales',
      'Configuración documentada de las 4 RM-60',
      'Imágenes JPG/PNG/WebP del catálogo',
      'Fotos/PDF + metadata de evidencia OC-27',
      'Snapshots OC-28 con estado de navegador',
    ],
    [],
  )

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4200)
  }

  async function captureBrowserStateForDr() {
    const refs = await currentServerReferences()
    const bundle = buildPilotBackupBundle(localStorage, {
      storeId: ORBI_STORE_ID,
      label: `Pre-DR browser capture · ${new Date().toLocaleString('es-CL')}`,
      source: 'manual',
      serverReferences: refs,
    })
    return await createPilotBackup(bundle)
  }

  async function createFullArchive() {
    setBusy(true)
    setRestoreResult(null)
    try {
      const browserSnapshot = await captureBrowserStateForDr()
      const archive = await createServerDrArchive(label)
      setArchives((current) => [
        archive,
        ...current.filter((item) => item.id !== archive.id),
      ])
      const preview = await inspectServerDrArchive(archive.id)
      setInspection(preview)
      setConfirmation('')
      flash(
        `Archivo completo creado. Estado del navegador capturado primero en ${browserSnapshot.id}.`,
      )
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function previewArchive(archive: ServerDrMetadata) {
    setBusy(true)
    setRestoreResult(null)
    try {
      const preview = await inspectServerDrArchive(archive.id)
      setInspection(preview)
      setConfirmation('')
      flash('Archivo verificado: hash general y hashes individuales consistentes.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function importArchive(file: File | null) {
    if (!file) return
    setBusy(true)
    setRestoreResult(null)
    try {
      const imported = await importServerDrArchive(file)
      setArchives((current) => [
        imported,
        ...current.filter((item) => item.id !== imported.id),
      ])
      const preview = await inspectServerDrArchive(imported.id)
      setInspection(preview)
      setConfirmation('')
      flash('Archivo portátil importado, validado y almacenado. Todavía no se restauró nada.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function restoreSelected() {
    if (!inspection) return
    if (confirmation !== requiredConfirmation) {
      flash(`Escribe exactamente: ${requiredConfirmation}`)
      return
    }

    setBusy(true)
    try {
      const result = await restoreServerDrArchive(
        inspection.metadata.id,
        confirmation,
      )
      setRestoreResult(result)
      setConfirmation('')
      await refresh()
      flash(
        `Servidor restaurado. ORBI creó primero el safety archive ${result.safetyArchive.id}.`,
      )
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="server-dr-page">
      <header className="server-dr-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>← Hub</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/respaldo')}>Backup OC-28</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/expedientes')}>Expedientes</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/migracion')}>Runbook</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/certificacion')}>Certificación OC-30</button>
        </div>
        <button className="ghost" type="button" disabled={busy} onClick={() => void refresh()}>
          Actualizar archivos
        </button>
      </header>

      <section className="server-dr-hero">
        <div className="server-dr-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · DISASTER RECOVERY</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="server-dr-title">
          <p className="eyebrow">OC-29 · Recuperación total del servidor</p>
          <h1>Perder el mini-PC ya no significa reconstruir el piloto desde cero.</h1>
          <p>
            Empaqueta los datos allowlisted del servidor en un archivo portátil comprimido,
            verificable por SHA-256 y restaurable en otro equipo sin copiar credenciales de
            Mercado Pago ni secretos del entorno.
          </p>
        </div>

        <div className="server-dr-stats">
          <article>
            <span>ARCHIVOS DR</span>
            <strong>{archives.length}</strong>
            <small>{loading ? 'consultando…' : 'almacenados localmente'}</small>
          </article>
          <article>
            <span>ÚLTIMO SNAPSHOT</span>
            <strong>{latest ? formatDate(latest.savedAt).split(',')[0] : '—'}</strong>
            <small>{latest?.label ?? 'sin snapshots completos'}</small>
          </article>
          <article>
            <span>COMPONENTES</span>
            <strong>{latest?.components.length ?? 6}</strong>
            <small>servidor allowlisted</small>
          </article>
          <article>
            <span>FORMATO</span>
            <strong>.GZ</strong>
            <small>orbi-pos-server-dr/v1</small>
          </article>
        </div>
      </section>

      <section className="server-dr-boundary">
        <span>🔐</span>
        <div>
          <b>El archivo no contiene variables de entorno ni credenciales de proveedores.</b>
          <p>
            Access Token de Mercado Pago, HMAC/Webhook secrets, API keys, llaves privadas y
            configuración secreta del sistema operativo deben configurarse nuevamente en el
            servidor reemplazo. Restaurar datos tampoco ejecuta pagos, SII ni comandos RM-60.
          </p>
        </div>
      </section>

      <section className="server-dr-grid">
        <article className="server-dr-panel">
          <div className="server-dr-section-head">
            <span>01</span>
            <div>
              <p className="eyebrow">Cobertura</p>
              <h2>Qué entra en el archivo completo</h2>
            </div>
          </div>

          <div className="server-dr-component-list">
            {protectedComponents.map((item) => (
              <div key={item}>
                <span>✓</span>
                <b>{item}</b>
              </div>
            ))}
          </div>

          <div className="server-dr-exclusions">
            <b>Excluido deliberadamente</b>
            <span>env · secretos · node_modules · repositorio fuente · archivos del SO · backups DR anteriores</span>
          </div>
        </article>

        <article className="server-dr-panel">
          <div className="server-dr-section-head">
            <span>02</span>
            <div>
              <p className="eyebrow">Crear</p>
              <h2>Snapshot servidor + navegador actual</h2>
            </div>
          </div>

          <label className="server-dr-label">
            <span>Etiqueta del archivo</span>
            <input
              value={label}
              maxLength={120}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. Antes de reemplazar mini-PC"
            />
          </label>

          <button
            className="primary server-dr-create"
            type="button"
            disabled={busy}
            onClick={() => void createFullArchive()}
          >
            Crear archivo completo de recuperación
          </button>

          <div className="server-dr-sequence">
            <div><span>1</span><b>OC-28 snapshot</b><small>Captura primero el estado actual del navegador.</small></div>
            <i>→</i>
            <div><span>2</span><b>Server archive</b><small>Empaqueta catálogo, backend y archivos binarios.</small></div>
            <i>→</i>
            <div><span>3</span><b>SHA-256</b><small>Genera integridad del archivo comprimido y de cada archivo interno.</small></div>
          </div>

          {serverError ? (
            <div className="server-dr-error">
              <b>Servidor DR no disponible</b>
              <span>{serverError}</span>
            </div>
          ) : null}
        </article>
      </section>

      <section className="server-dr-panel server-dr-history">
        <div className="server-dr-section-head">
          <span>03</span>
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Archivos completos sin endpoint DELETE</h2>
          </div>
        </div>

        {archives.length ? (
          <div className="server-dr-records">
            {archives.map((archive) => (
              <article key={archive.id}>
                <div className="server-dr-record-title">
                  <div>
                    <span className={archive.ingest === 'imported' ? 'imported' : ''}>
                      {archive.ingest === 'imported' ? 'IMPORTADO' : archive.source === 'pre-restore' ? 'SAFETY' : 'CREADO'}
                    </span>
                    <b>{archive.label}</b>
                  </div>
                  <small>{archive.id}</small>
                </div>

                <div className="server-dr-record-meta">
                  <span><b>Guardado:</b> {formatDate(archive.savedAt)}</span>
                  <span><b>Archivos:</b> {archive.fileCount}</span>
                  <span><b>Datos:</b> {formatBytes(archive.totalFileBytes)}</span>
                  <span><b>Comprimido:</b> {formatBytes(archive.compressedSize)}</span>
                  <span className="server-dr-hash"><b>SHA-256:</b> {archive.sha256}</span>
                </div>

                <div className="server-dr-record-actions">
                  <button className="ghost" type="button" disabled={busy} onClick={() => void previewArchive(archive)}>
                    Verificar / preview
                  </button>
                  <a
                    className="ghost"
                    href={serverDrDownloadUrl(archive.id)}
                    download={archive.id}
                  >
                    Descargar
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="server-dr-empty">
            <span>🧰</span>
            <h3>{loading ? 'Consultando…' : 'Todavía no existe un archivo completo'}</h3>
            <p>El primer snapshot es recomendable antes de cualquier cambio del mini-PC.</p>
          </div>
        )}
      </section>

      <section className="server-dr-panel">
        <div className="server-dr-section-head">
          <span>04</span>
          <div>
            <p className="eyebrow">Equipo reemplazo</p>
            <h2>Importar .orbi-dr.gz</h2>
          </div>
        </div>

        <label className={busy ? 'server-dr-file disabled' : 'server-dr-file'}>
          Seleccionar archivo portátil
          <input
            type="file"
            accept=".gz,.orbi-dr.gz,application/gzip,application/octet-stream"
            disabled={busy}
            onChange={(event) => {
              void importArchive(event.target.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <p className="server-dr-import-note">
          Importar solo almacena y valida el archivo. No reemplaza ningún dato hasta completar
          la previsualización y escribir la frase de confirmación exacta.
        </p>
      </section>

      {inspection ? (
        <section className="server-dr-preview">
          <header>
            <div>
              <p className="eyebrow">Archivo verificado</p>
              <h2>{inspection.metadata.label}</h2>
              <span>
                {inspection.metadata.id} · creado {formatDate(inspection.metadata.createdAt)}
              </span>
            </div>
            <div>
              <a
                className="ghost"
                href={serverDrDownloadUrl(inspection.metadata.id)}
                download={inspection.metadata.id}
              >
                Descargar copia
              </a>
              <button className="ghost" type="button" onClick={() => {
                setInspection(null)
                setConfirmation('')
                setRestoreResult(null)
              }}>
                Cerrar preview
              </button>
            </div>
          </header>

          <div className="server-dr-integrity">
            <article><span>ARCHIVOS</span><strong>{inspection.metadata.fileCount}</strong><small>{formatBytes(inspection.metadata.totalFileBytes)} sin comprimir</small></article>
            <article><span>ARCHIVO .GZ</span><strong>{formatBytes(inspection.metadata.compressedSize)}</strong><small>gzip portable</small></article>
            <article><span>SHA-256 ARCHIVO</span><b>{inspection.metadata.sha256}</b></article>
          </div>

          <div className="server-dr-components">
            {inspection.manifest.summary.components.map((component) => (
              <span key={component}>{componentLabels[component] ?? component}</span>
            ))}
          </div>

          <details className="server-dr-manifest">
            <summary>Manifest interno · {inspection.manifest.files.length} archivo(s)</summary>
            <div>
              {inspection.manifest.files.slice(0, 100).map((file) => (
                <article key={file.path}>
                  <b>{file.path}</b>
                  <span>{formatBytes(file.size)}</span>
                  <small>{file.sha256}</small>
                </article>
              ))}
              {inspection.manifest.files.length > 100 ? (
                <p>Se muestran los primeros 100 archivos de {inspection.manifest.files.length}.</p>
              ) : null}
            </div>
          </details>

          <section className="server-dr-restore-box">
            <div className="server-dr-restore-warning">
              <span>!</span>
              <div>
                <b>Esta acción reemplaza los datos allowlisted actuales del servidor.</b>
                <p>
                  ORBI crea primero otro archivo completo de seguridad del estado actual.
                  Si la preparación o validación falla, intenta revertir la transacción.
                  La carpeta de Disaster Recovery nunca se reemplaza.
                </p>
              </div>
            </div>

            <label>
              <span>Para habilitar la restauración escribe exactamente:</span>
              <code>{requiredConfirmation}</code>
              <input
                value={confirmation}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={requiredConfirmation}
              />
            </label>

            <button
              className="primary"
              type="button"
              disabled={busy || confirmation !== requiredConfirmation}
              onClick={() => void restoreSelected()}
            >
              Crear safety archive y restaurar servidor
            </button>
          </section>

          {restoreResult ? (
            <div className="server-dr-restored">
              <span>✓</span>
              <div>
                <b>Restauración de servidor completada</b>
                <p>
                  {restoreResult.restoredFiles} archivo(s), {formatBytes(restoreResult.restoredBytes)}.
                  Safety archive: <code>{restoreResult.safetyArchive.id}</code>.
                </p>
                <p>
                  Para recuperar también Levantamiento/Gate/Ledger en este navegador,
                  abre OC-28 y restaura el snapshot de navegador incluido en los pilot-backups recuperados.
                </p>
              </div>
              <button className="ghost" type="button" onClick={() => go('/piloto/respaldo')}>
                Ir a OC-28
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="server-dr-safety-grid">
        <article><b>Sin credenciales</b><span>El entorno del proceso y los secretos de proveedores quedan fuera del archivo.</span></article>
        <article><b>Allowlist</b><span>Rutas desconocidas no se empaquetan y una ruta importada fuera del contrato se rechaza.</span></article>
        <article><b>Doble integridad</b><span>SHA-256 del .gz completo y SHA-256 independiente de cada archivo interno.</span></article>
        <article><b>Rollback previo</b><span>Una restauración válida crea primero un snapshot completo del servidor actual.</span></article>
      </section>

      <footer className="server-dr-footer">
        <span>OC-29 · Full Server Disaster Recovery Archive</span>
        <span>Trusted LAN · no provider credentials · no external payment/SII/RM-60 actions</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
