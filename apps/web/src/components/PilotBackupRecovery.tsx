import { useEffect, useMemo, useState } from 'react'
import { fetchRemoteCatalog, ORBI_STORE_ID } from '../catalog-sync'
import {
  listEvidenceAttachments,
  type EvidenceAttachmentRecord,
} from '../evidence-attachment-api'
import {
  PILOT_BACKUP_MODULES,
  PILOT_BACKUP_MODULE_LABELS,
  PILOT_BACKUP_STORAGE_KEYS,
  buildPilotBackupBundle,
  restorePilotBackupModules,
  sanitizePilotBackupBundle,
  type PilotBackupBundle,
  type PilotBackupModuleName,
  type PilotBackupServerReferences,
} from '../pilot-backup'
import {
  createPilotBackup,
  fetchPilotBackup,
  listPilotBackups,
  type PilotBackupMetadata,
  type PilotBackupRecord,
} from '../pilot-backup-api'

interface PreviewState {
  bundle: PilotBackupBundle
  origin: 'server' | 'file'
  record: PilotBackupRecord | null
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

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
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

function localModulePresence() {
  return Object.fromEntries(
    PILOT_BACKUP_MODULES.map((moduleName) => [
      moduleName,
      Boolean(localStorage.getItem(PILOT_BACKUP_STORAGE_KEYS[moduleName])),
    ]),
  ) as Record<PilotBackupModuleName, boolean>
}

export function PilotBackupRecovery() {
  const [backups, setBackups] = useState<PilotBackupMetadata[]>([])
  const [serverError, setServerError] = useState('')
  const [loadingServer, setLoadingServer] = useState(true)
  const [label, setLabel] = useState('Respaldo manual del piloto')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [selectedModules, setSelectedModules] = useState<PilotBackupModuleName[]>(
    [...PILOT_BACKUP_MODULES],
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [references, setReferences] = useState<PilotBackupServerReferences>({
    catalog: {
      revision: null,
      updatedAt: null,
      productCount: null,
    },
    evidenceAttachments: [],
  })
  const [presence, setPresence] = useState<Record<PilotBackupModuleName, boolean>>(
    localModulePresence,
  )

  async function refreshServer() {
    setLoadingServer(true)
    const [backupResult, refsResult] = await Promise.allSettled([
      listPilotBackups(),
      currentServerReferences(),
    ])

    if (backupResult.status === 'fulfilled') {
      setBackups(backupResult.value)
      setServerError('')
    } else {
      setServerError((backupResult.reason as Error).message)
    }

    if (refsResult.status === 'fulfilled') {
      setReferences(refsResult.value)
    }

    setLoadingServer(false)
  }

  useEffect(() => {
    void refreshServer()
  }, [])

  const latestBackup = backups[0] ?? null

  const portableFileName = useMemo(() => {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
    return `orbi-el-chunchito-pilot-backup-${stamp}.json`
  }, [preview?.bundle.createdAt])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  async function buildCurrentBundle(
    source: 'manual' | 'pre-restore',
    bundleLabel: string,
  ) {
    const refs = await currentServerReferences()
    setReferences(refs)
    return buildPilotBackupBundle(localStorage, {
      storeId: ORBI_STORE_ID,
      label: bundleLabel,
      source,
      serverReferences: refs,
    })
  }

  async function createServerSnapshot() {
    setBusy(true)
    try {
      const bundle = await buildCurrentBundle('manual', label)
      const record = await createPilotBackup(bundle)
      setBackups((current) => [
        {
          id: record.id,
          createdAt: record.createdAt,
          savedAt: record.savedAt,
          label: record.label,
          source: record.source,
          moduleCount: record.moduleCount,
          size: record.size,
          sha256: record.sha256,
        },
        ...current.filter((item) => item.id !== record.id),
      ])
      setPreview({ bundle: record.bundle, origin: 'server', record })
      setSelectedModules([...PILOT_BACKUP_MODULES])
      flash('Respaldo guardado en el servidor ORBI con SHA-256.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function downloadCurrentBundle() {
    setBusy(true)
    try {
      const bundle = await buildCurrentBundle('manual', label)
      downloadJson(portableFileName, bundle)
      flash('Copia portátil JSON generada. Guárdala fuera del equipo del piloto.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function previewServerBackup(metadata: PilotBackupMetadata) {
    setBusy(true)
    try {
      const record = await fetchPilotBackup(metadata.id)
      const bundle = sanitizePilotBackupBundle(record.bundle, ORBI_STORE_ID)
      setPreview({ bundle, origin: 'server', record: { ...record, bundle } })
      setSelectedModules([...PILOT_BACKUP_MODULES])
      flash('Respaldo cargado en modo previsualización.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function importPortableFile(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('El respaldo portátil supera el límite de 3 MB')
      }
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      const bundle = sanitizePilotBackupBundle(parsed, ORBI_STORE_ID)
      setPreview({ bundle, origin: 'file', record: null })
      setSelectedModules([...PILOT_BACKUP_MODULES])
      flash('Archivo importado y validado. Aún no se ha restaurado nada.')
    } catch (error) {
      flash(error instanceof SyntaxError
        ? 'El archivo no contiene JSON válido.'
        : (error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function toggleModule(moduleName: PilotBackupModuleName, checked: boolean) {
    setSelectedModules((current) =>
      checked
        ? [...new Set([...current, moduleName])]
        : current.filter((item) => item !== moduleName),
    )
  }

  async function restorePreview() {
    if (!preview) return
    if (!selectedModules.length) {
      flash('Selecciona al menos un módulo para restaurar.')
      return
    }

    setBusy(true)
    try {
      const preRestoreLabel = `Pre-restore safety · ${new Date().toLocaleString('es-CL')}`
      const safetyBundle = await buildCurrentBundle(
        'pre-restore',
        preRestoreLabel,
      )
      const safetyRecord = await createPilotBackup(safetyBundle)

      const restored = restorePilotBackupModules(
        localStorage,
        preview.bundle,
        ORBI_STORE_ID,
        selectedModules,
      )

      setPresence(localModulePresence())
      flash(
        `Restaurados ${restored.length} módulo(s). Copia de seguridad previa: ${safetyRecord.id}. Recargando…`,
      )
      window.setTimeout(() => window.location.reload(), 1400)
    } catch (error) {
      flash(
        `Restauración detenida: ${(error as Error).message}. No se reemplazó el estado si no pudo crearse el respaldo previo.`,
      )
    } finally {
      setBusy(false)
    }
  }

  function downloadPreview() {
    if (!preview) return
    downloadJson(
      preview.origin === 'server' && preview.record
        ? preview.record.id.replace('.json', '-portable.json')
        : portableFileName,
      preview.bundle,
    )
  }

  return (
    <main className="pilot-backup-page">
      <header className="pilot-backup-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>← Hub</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/evidencia')}>Ledger</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/expedientes')}>Expedientes</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/migracion')}>Runbook</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/desastre')}>DR servidor OC-29</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/certificacion')}>Certificación OC-30</button>
        </div>
        <button className="ghost" type="button" disabled={busy} onClick={() => void refreshServer()}>
          Actualizar estado
        </button>
      </header>

      <section className="pilot-backup-hero">
        <div className="pilot-backup-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · PILOT RECOVERY</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="pilot-backup-title">
          <p className="eyebrow">OC-28 · Respaldo y recuperación</p>
          <h1>Que perder un navegador no signifique perder el piloto.</h1>
          <p>
            Copia al servidor ORBI los estados de Levantamiento, Propuesta, Gate, Runbook,
            Ledger y Expedientes, y permite restaurarlos de forma selectiva con un respaldo
            automático previo.
          </p>
        </div>

        <div className="pilot-backup-stats">
          <article>
            <span>MÓDULOS PROTEGIDOS</span>
            <strong>{PILOT_BACKUP_MODULES.length}</strong>
            <small>estado browser-local</small>
          </article>
          <article>
            <span>RESPALDOS SERVIDOR</span>
            <strong>{backups.length}</strong>
            <small>{loadingServer ? 'consultando…' : 'persistidos en LAN ORBI'}</small>
          </article>
          <article>
            <span>ARCHIVOS EVIDENCIA</span>
            <strong>{references.evidenceAttachments.length}</strong>
            <small>ya persistidos en servidor</small>
          </article>
          <article>
            <span>ÚLTIMO RESPALDO</span>
            <strong>{latestBackup ? formatDate(latestBackup.savedAt).split(',')[0] : '—'}</strong>
            <small>{latestBackup?.label ?? 'todavía no existe'}</small>
          </article>
        </div>
      </section>

      <section className="pilot-backup-boundary">
        <span>🛡️</span>
        <div>
          <b>La restauración afecta únicamente los seis módulos locales del piloto.</b>
          <p>
            No publica catálogo, no cambia precios ni PLU, no toca Payment Core, no envía cobros,
            no escribe en RM-60 y no emite documentos SII. Los archivos OC-27 permanecen en el servidor.
          </p>
        </div>
      </section>

      <section className="pilot-backup-grid">
        <article className="pilot-backup-panel">
          <div className="pilot-backup-section-head">
            <span>01</span>
            <div>
              <p className="eyebrow">Estado actual</p>
              <h2>Qué se incluye en cada snapshot</h2>
            </div>
          </div>

          <div className="pilot-backup-module-list">
            {PILOT_BACKUP_MODULES.map((moduleName) => (
              <div key={moduleName}>
                <span>{presence[moduleName] ? '●' : '○'}</span>
                <div>
                  <b>{PILOT_BACKUP_MODULE_LABELS[moduleName]}</b>
                  <small>
                    {presence[moduleName]
                      ? 'Hay estado local actual; se sanitiza antes de respaldar.'
                      : 'Sin estado guardado todavía; el respaldo conserva el estado inicial seguro.'}
                  </small>
                </div>
                <em>{presence[moduleName] ? 'LOCAL' : 'DEFAULT'}</em>
              </div>
            ))}
          </div>

          <div className="pilot-backup-server-reference">
            <div>
              <b>Catálogo servidor</b>
              <span>
                rev {references.catalog.revision ?? '—'} · {references.catalog.productCount ?? '—'} productos
              </span>
            </div>
            <div>
              <b>Adjuntos OC-27</b>
              <span>{references.evidenceAttachments.length} archivo(s) referenciados por hash</span>
            </div>
          </div>
        </article>

        <article className="pilot-backup-panel">
          <div className="pilot-backup-section-head">
            <span>02</span>
            <div>
              <p className="eyebrow">Crear respaldo</p>
              <h2>Servidor + copia portátil</h2>
            </div>
          </div>

          <label className="pilot-backup-label">
            <span>Etiqueta</span>
            <input
              value={label}
              maxLength={120}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. Antes de visita a terreno"
            />
          </label>

          <div className="pilot-backup-actions">
            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() => void createServerSnapshot()}
            >
              Guardar en servidor ORBI
            </button>
            <button
              className="ghost"
              type="button"
              disabled={busy}
              onClick={() => void downloadCurrentBundle()}
            >
              Descargar JSON portátil
            </button>
          </div>

          <div className="pilot-backup-copy-note">
            <b>Dos niveles de recuperación</b>
            <span>
              El snapshot del servidor protege frente a cambiar/limpiar el navegador.
              El JSON portátil puede guardarse fuera del computador para recuperar el estado
              aunque cambie el equipo de trabajo.
            </span>
          </div>

          {serverError ? (
            <div className="pilot-backup-error">
              <b>Servidor de respaldos no disponible.</b>
              <span>{serverError}</span>
            </div>
          ) : null}
        </article>
      </section>

      <section className="pilot-backup-panel pilot-backup-server-list">
        <div className="pilot-backup-section-head">
          <span>03</span>
          <div>
            <p className="eyebrow">Historial servidor</p>
            <h2>Snapshots sin botón de borrar</h2>
          </div>
        </div>

        {backups.length ? (
          <div className="pilot-backup-records">
            {backups.map((backup) => (
              <article key={backup.id}>
                <div className="pilot-backup-record-main">
                  <div>
                    <span className={`backup-source source-${backup.source}`}>
                      {backup.source === 'pre-restore' ? 'PRE-RESTORE' : backup.source.toUpperCase()}
                    </span>
                    <b>{backup.label}</b>
                  </div>
                  <small>{backup.id}</small>
                </div>
                <div className="pilot-backup-record-meta">
                  <span><b>Guardado:</b> {formatDate(backup.savedAt)}</span>
                  <span><b>Módulos:</b> {backup.moduleCount}</span>
                  <span><b>Tamaño:</b> {formatBytes(backup.size)}</span>
                  <span><b>SHA-256:</b> {backup.sha256}</span>
                </div>
                <button
                  className="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void previewServerBackup(backup)}
                >
                  Previsualizar / restaurar
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="pilot-backup-empty">
            <span>🗄️</span>
            <h3>{loadingServer ? 'Consultando respaldos…' : 'Todavía no hay snapshots'}</h3>
            <p>Crea el primero antes de una visita o cambio importante.</p>
          </div>
        )}
      </section>

      <section className="pilot-backup-panel">
        <div className="pilot-backup-section-head">
          <span>04</span>
          <div>
            <p className="eyebrow">Copia portátil</p>
            <h2>Importar sin restaurar automáticamente</h2>
          </div>
        </div>

        <label className={busy ? 'pilot-backup-file disabled' : 'pilot-backup-file'}>
          Elegir archivo .json de respaldo
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => {
              void importPortableFile(event.target.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <p className="pilot-backup-import-note">
          El archivo primero se valida y abre en previsualización. Importarlo no escribe nada
          en localStorage hasta que confirmes la restauración.
        </p>
      </section>

      {preview ? (
        <section className="pilot-backup-preview">
          <header>
            <div>
              <p className="eyebrow">Previsualización de recuperación</p>
              <h2>{preview.bundle.label}</h2>
              <span>
                {preview.origin === 'server' ? 'Servidor ORBI' : 'Archivo portátil'} · creado {formatDate(preview.bundle.createdAt)}
              </span>
            </div>
            <div className="pilot-backup-preview-actions">
              <button className="ghost" type="button" onClick={downloadPreview}>Descargar esta copia</button>
              <button className="ghost" type="button" onClick={() => setPreview(null)}>Cerrar preview</button>
            </div>
          </header>

          {preview.record ? (
            <div className="pilot-backup-integrity">
              <div><span>Backup ID</span><b>{preview.record.id}</b></div>
              <div><span>SHA-256</span><b>{preview.record.sha256}</b></div>
              <div><span>Tamaño</span><b>{formatBytes(preview.record.size)}</b></div>
            </div>
          ) : (
            <div className="pilot-backup-integrity portable">
              <div>
                <span>Origen</span>
                <b>JSON portátil validado localmente</b>
              </div>
              <div>
                <span>Regla</span>
                <b>Se creará un snapshot pre-restore en servidor antes de escribir.</b>
              </div>
            </div>
          )}

          <div className="pilot-backup-reference-preview">
            <article>
              <span>CATÁLOGO CUANDO SE CREÓ</span>
              <strong>rev {preview.bundle.serverReferences.catalog.revision ?? '—'}</strong>
              <small>{preview.bundle.serverReferences.catalog.productCount ?? '—'} productos · {formatDate(preview.bundle.serverReferences.catalog.updatedAt)}</small>
            </article>
            <article>
              <span>ADJUNTOS OC-27 CUANDO SE CREÓ</span>
              <strong>{preview.bundle.serverReferences.evidenceAttachments.length}</strong>
              <small>solo metadatos/hash en el bundle; los binarios no se restauran aquí</small>
            </article>
          </div>

          <div className="pilot-backup-restore-modules">
            {PILOT_BACKUP_MODULES.map((moduleName) => (
              <label
                className={selectedModules.includes(moduleName) ? 'selected' : ''}
                key={moduleName}
              >
                <input
                  type="checkbox"
                  checked={selectedModules.includes(moduleName)}
                  onChange={(event) => toggleModule(moduleName, event.target.checked)}
                />
                <div>
                  <b>{PILOT_BACKUP_MODULE_LABELS[moduleName]}</b>
                  <small>{PILOT_BACKUP_STORAGE_KEYS[moduleName]}</small>
                </div>
              </label>
            ))}
          </div>

          <div className="pilot-backup-restore-warning">
            <span>!</span>
            <div>
              <b>Antes de restaurar, ORBI intentará guardar automáticamente el estado actual.</b>
              <p>
                Si ese snapshot pre-restore falla, la restauración se detiene. Después de restaurar,
                la página se recarga para que los módulos vuelvan a leer su estado.
              </p>
            </div>
          </div>

          <div className="pilot-backup-restore-actions">
            <span>{selectedModules.length} de {PILOT_BACKUP_MODULES.length} módulos seleccionados</span>
            <button
              className="primary"
              type="button"
              disabled={busy || !selectedModules.length}
              onClick={() => void restorePreview()}
            >
              Crear safety backup y restaurar seleccionados
            </button>
          </div>
        </section>
      ) : null}

      <section className="pilot-backup-safety-grid">
        <article><b>Catálogo</b><span>Solo se registra revisión/fecha/cantidad como referencia. No se restaura ni publica.</span></article>
        <article><b>Evidencia binaria</b><span>OC-27 permanece en el servidor; el bundle guarda manifiesto y SHA-256, no archivos.</span></article>
        <article><b>Pagos / SII</b><span>No se respaldan credenciales, no se crean órdenes y no se emiten documentos.</span></article>
        <article><b>RM-60</b><span>Restaurar el piloto no envía datos ni comandos a ninguna balanza.</span></article>
      </section>

      <footer className="pilot-backup-footer">
        <span>OC-28 · Pilot State Backup & Recovery Bundle</span>
        <span>Trusted LAN · snapshots append-only · restore selectivo con safety backup</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
