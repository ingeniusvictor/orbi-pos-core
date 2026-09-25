import { useEffect, useMemo, useState } from 'react'
import {
  listServerDrArchives,
  type ServerDrMetadata,
} from '../disaster-recovery-api'
import {
  fetchRecoveryDrillCertification,
  listRecoveryDrillCertifications,
  runRecoveryDrill,
  type RecoveryDrillCheckStatus,
  type RecoveryDrillMetadata,
  type RecoveryDrillRecord,
  type RecoveryDrillResult,
} from '../recovery-drill-api'

const resultLabels: Record<RecoveryDrillResult, string> = {
  certified: 'CERTIFICADO',
  certified_with_drift: 'CERTIFICADO + DRIFT',
  failed: 'FALLÓ',
}

const resultDetails: Record<RecoveryDrillResult, string> = {
  certified: 'El archivo se reconstruyó en sandbox y el estado allowlisted actual coincide con el snapshot.',
  certified_with_drift: 'El archivo se reconstruyó correctamente, pero el servidor actual cambió desde ese snapshot.',
  failed: 'Una comprobación de integridad, reconstrucción o dominio no pudo completarse.',
}

const statusLabels: Record<RecoveryDrillCheckStatus, string> = {
  pass: 'PASS',
  warning: 'ADVERTENCIA',
  fail: 'FAIL',
  not_present: 'NO PRESENTE',
}

const componentLabels: Record<string, string> = {
  catalog: 'Catálogo + precios',
  payments: 'Payment Core histórico',
  'scale-fleet': 'Fleet DIGI RM-60',
  'product-assets': 'Imágenes de productos',
  'evidence-attachments': 'Evidencia OC-27',
  'pilot-backups': 'Backups OC-28',
}

function go(path: string) {
  window.location.href = path
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL')
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function latestForArchive(
  archiveId: string,
  certifications: RecoveryDrillMetadata[],
) {
  return certifications.find((item) => item.archiveId === archiveId) ?? null
}

function downloadCertificate(record: RecoveryDrillRecord) {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = record.certificate.id.replace('.json', '-certificate.json')
  anchor.click()
  URL.revokeObjectURL(url)
}

export function RecoveryDrillCertification() {
  const [archives, setArchives] = useState<ServerDrMetadata[]>([])
  const [certifications, setCertifications] = useState<RecoveryDrillMetadata[]>([])
  const [selected, setSelected] = useState<RecoveryDrillRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyArchiveId, setBusyArchiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function refresh(loadLatest = false) {
    setLoading(true)
    try {
      const [nextArchives, nextCertifications] = await Promise.all([
        listServerDrArchives(),
        listRecoveryDrillCertifications(),
      ])
      setArchives(nextArchives)
      setCertifications(nextCertifications)
      setError('')

      if (loadLatest && nextCertifications[0]) {
        const record = await fetchRecoveryDrillCertification(nextCertifications[0].id)
        setSelected(record)
      }
    } catch (refreshError) {
      setError((refreshError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh(true)
  }, [])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4200)
  }

  async function runDrill(archive: ServerDrMetadata) {
    setBusyArchiveId(archive.id)
    try {
      const record = await runRecoveryDrill(archive.id)
      setSelected(record)
      await refresh(false)
      flash(
        record.certificate.result === 'failed'
          ? 'Simulacro registrado con fallas. Revisa las comprobaciones antes de confiar en este archivo.'
          : record.certificate.result === 'certified_with_drift'
            ? 'Archivo recuperable. El servidor actual tiene cambios posteriores al snapshot.'
            : 'Archivo certificado: reconstrucción aislada e integridad completas.',
      )
    } catch (drillError) {
      flash((drillError as Error).message)
    } finally {
      setBusyArchiveId(null)
    }
  }

  async function openCertification(metadata: RecoveryDrillMetadata) {
    setBusyArchiveId(metadata.archiveId)
    try {
      const record = await fetchRecoveryDrillCertification(metadata.id)
      setSelected(record)
    } catch (openError) {
      flash((openError as Error).message)
    } finally {
      setBusyArchiveId(null)
    }
  }

  const certifiedCount = certifications.filter((item) => item.result === 'certified').length
  const driftCount = certifications.filter((item) => item.result === 'certified_with_drift').length
  const failedCount = certifications.filter((item) => item.result === 'failed').length

  const selectedDriftCount = useMemo(() => {
    if (!selected) return 0
    return selected.certificate.liveDrift.changed.length
      + selected.certificate.liveDrift.newLive.length
      + selected.certificate.liveDrift.archiveOnly.length
  }, [selected])

  return (
    <main className="recovery-cert-page">
      <header className="recovery-cert-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>← Hub</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/desastre')}>OC-29 Disaster Recovery</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/respaldo')}>OC-28 Backup</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/evidencia')}>Evidencia</button>
        </div>
        <button className="ghost" type="button" disabled={loading} onClick={() => void refresh(false)}>
          Actualizar
        </button>
      </header>

      <section className="recovery-cert-hero">
        <div className="recovery-cert-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · RECOVERY CERTIFICATION</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="recovery-cert-title">
          <p className="eyebrow">OC-30 · Recovery Drill & Integrity Certification</p>
          <h1>Un backup no se considera confiable solo porque existe.</h1>
          <p>
            ORBI reconstruye físicamente el archivo OC-29 dentro de un sandbox temporal,
            vuelve a calcular hashes, abre los datos con los stores reales y compara el snapshot
            con el servidor actual sin reemplazar un solo archivo de producción.
          </p>
        </div>

        <div className="recovery-cert-stats">
          <article><span>ARCHIVOS OC-29</span><strong>{archives.length}</strong><small>candidatos a drill</small></article>
          <article><span>CERTIFICADOS</span><strong>{certifiedCount}</strong><small>sin drift</small></article>
          <article><span>CON DRIFT</span><strong>{driftCount}</strong><small>recuperables pero antiguos</small></article>
          <article><span>FALLIDOS</span><strong>{failedCount}</strong><small>requieren atención</small></article>
        </div>
      </section>

      <section className="recovery-cert-boundary">
        <span>🧪</span>
        <div>
          <b>El simulacro es no destructivo.</b>
          <p>
            Se extrae a un directorio temporal aislado, se reabre con CatalogStore, PaymentStore,
            ScaleFleetStore, AssetStore, EvidenceAttachmentStore y PilotBackupStore, y luego se elimina
            el sandbox. No llama Mercado Pago, SII ni escribe en ninguna RM-60.
          </p>
        </div>
      </section>

      {error ? (
        <section className="recovery-cert-error">
          <b>No se pudo cargar el centro de certificación.</b>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="recovery-cert-panel">
        <div className="recovery-cert-section-head">
          <span>01</span>
          <div>
            <p className="eyebrow">Archivos disponibles</p>
            <h2>Ejecutar un drill real</h2>
          </div>
        </div>

        {archives.length ? (
          <div className="recovery-cert-archives">
            {archives.map((archive) => {
              const latestCertification = latestForArchive(archive.id, certifications)
              return (
                <article key={archive.id}>
                  <div className="recovery-cert-archive-title">
                    <div>
                      <span>{archive.ingest === 'imported' ? 'IMPORTADO' : archive.source === 'pre-restore' ? 'SAFETY' : 'SNAPSHOT'}</span>
                      <b>{archive.label}</b>
                    </div>
                    <small>{archive.id}</small>
                  </div>

                  <div className="recovery-cert-archive-meta">
                    <span><b>Creado:</b> {formatDate(archive.createdAt)}</span>
                    <span><b>Archivos:</b> {archive.fileCount}</span>
                    <span><b>Datos:</b> {formatBytes(archive.totalFileBytes)}</span>
                    <span className="hash"><b>SHA-256:</b> {archive.sha256}</span>
                  </div>

                  <div className="recovery-cert-archive-state">
                    {latestCertification ? (
                      <>
                        <span className={`cert-result result-${latestCertification.result}`}>
                          {resultLabels[latestCertification.result]}
                        </span>
                        <small>{formatDate(latestCertification.completedAt)}</small>
                      </>
                    ) : (
                      <>
                        <span className="cert-result result-untested">SIN PROBAR</span>
                        <small>No existe certificación para este snapshot.</small>
                      </>
                    )}
                  </div>

                  <button
                    className="primary"
                    type="button"
                    disabled={busyArchiveId !== null}
                    onClick={() => void runDrill(archive)}
                  >
                    {busyArchiveId === archive.id ? 'Ejecutando simulacro…' : 'Ejecutar simulacro'}
                  </button>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="recovery-cert-empty">
            <span>🗃️</span>
            <h3>{loading ? 'Consultando archivos…' : 'No hay archivos OC-29 para probar'}</h3>
            <p>Crea primero un snapshot completo en /piloto/desastre.</p>
          </div>
        )}
      </section>

      <section className="recovery-cert-panel">
        <div className="recovery-cert-section-head">
          <span>02</span>
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Certificaciones inmutables por hash</h2>
          </div>
        </div>

        {certifications.length ? (
          <div className="recovery-cert-history">
            {certifications.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selected?.certificate.id === item.id ? 'selected' : ''}
                onClick={() => void openCertification(item)}
              >
                <div>
                  <span className={`cert-result result-${item.result}`}>
                    {resultLabels[item.result]}
                  </span>
                  <b>{item.id}</b>
                </div>
                <small>Archivo: {item.archiveId}</small>
                <small>{formatDate(item.completedAt)} · {(item.durationMs / 1000).toFixed(2)} s</small>
                <small className="hash">Report SHA-256: {item.reportSha256}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="recovery-cert-empty compact">
            <span>✓</span>
            <h3>Sin certificaciones todavía</h3>
            <p>Ejecuta el primer drill sobre un archivo OC-29.</p>
          </div>
        )}
      </section>

      {selected ? (
        <section className="recovery-cert-detail">
          <header>
            <div>
              <p className="eyebrow">Certificado técnico interno</p>
              <h2>{resultLabels[selected.certificate.result]}</h2>
              <p>{resultDetails[selected.certificate.result]}</p>
            </div>
            <div className="recovery-cert-detail-actions">
              <button className="ghost" type="button" onClick={() => downloadCertificate(selected)}>
                Descargar certificado JSON
              </button>
              <button className="ghost" type="button" onClick={() => setSelected(null)}>
                Cerrar detalle
              </button>
            </div>
          </header>

          <div className="recovery-cert-integrity">
            <article><span>ARCHIVE ID</span><b>{selected.certificate.archiveId}</b></article>
            <article><span>ARCHIVE SHA-256</span><b>{selected.certificate.archiveSha256 ?? 'no disponible'}</b></article>
            <article><span>REPORT SHA-256</span><b>{selected.reportSha256}</b></article>
          </div>

          <div className="recovery-cert-run-stats">
            <article><span>RECONSTRUIDOS</span><strong>{selected.certificate.stagedFiles}</strong><small>{formatBytes(selected.certificate.stagedBytes)}</small></article>
            <article><span>DURACIÓN</span><strong>{(selected.certificate.durationMs / 1000).toFixed(2)} s</strong><small>drill completo</small></article>
            <article><span>DRIFT ACTUAL</span><strong>{selectedDriftCount}</strong><small>diferencias de ruta/hash</small></article>
            <article><span>SANDBOX</span><strong>{selected.certificate.safety.sandboxCleaned ? 'LIMPIO' : 'REVISAR'}</strong><small>post drill</small></article>
          </div>

          <section className="recovery-cert-components">
            <div className="recovery-cert-subhead">
              <p className="eyebrow">Componentes</p>
              <h3>¿Qué fue realmente reabierto?</h3>
            </div>
            <div className="recovery-cert-component-grid">
              {selected.certificate.components.map((item) => (
                <article className={`status-${item.status}`} key={item.id}>
                  <span>{statusLabels[item.status]}</span>
                  <b>{componentLabels[item.id] ?? item.id}</b>
                  <strong>{item.files} archivo(s)</strong>
                  <small>{formatBytes(item.bytes)}</small>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="recovery-cert-checks">
            <div className="recovery-cert-subhead">
              <p className="eyebrow">Checks</p>
              <h3>Secuencia verificable</h3>
            </div>
            <div>
              {selected.certificate.checks.map((item) => (
                <article className={`status-${item.status}`} key={item.id}>
                  <span>{statusLabels[item.status]}</span>
                  <div>
                    <b>{item.label}</b>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="recovery-cert-drift">
            <div className="recovery-cert-subhead">
              <p className="eyebrow">Comparación live</p>
              <h3>Drift no significa corrupción</h3>
            </div>

            <p>{selected.certificate.liveDrift.note}</p>

            <div className="recovery-cert-drift-stats">
              <article><span>IGUALES</span><strong>{selected.certificate.liveDrift.matching.length}</strong></article>
              <article><span>CAMBIADOS</span><strong>{selected.certificate.liveDrift.changed.length}</strong></article>
              <article><span>NUEVOS LIVE</span><strong>{selected.certificate.liveDrift.newLive.length}</strong></article>
              <article><span>SOLO ARCHIVE</span><strong>{selected.certificate.liveDrift.archiveOnly.length}</strong></article>
            </div>

            {selectedDriftCount ? (
              <details>
                <summary>Ver rutas con diferencias</summary>
                <div className="recovery-cert-drift-paths">
                  {selected.certificate.liveDrift.changed.map((path) => (
                    <span key={`changed-${path}`}><b>CAMBIÓ</b>{path}</span>
                  ))}
                  {selected.certificate.liveDrift.newLive.map((path) => (
                    <span key={`new-${path}`}><b>NUEVO LIVE</b>{path}</span>
                  ))}
                  {selected.certificate.liveDrift.archiveOnly.map((path) => (
                    <span key={`old-${path}`}><b>SOLO ARCHIVE</b>{path}</span>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <section className="recovery-cert-safety">
            <article><b>Live reemplazado</b><span>{selected.certificate.safety.liveDataReplaced ? 'SÍ' : 'NO'}</span></article>
            <article><b>Provider calls</b><span>{selected.certificate.safety.providerCallsMade ? 'SÍ' : 'NO'}</span></article>
            <article><b>SII actions</b><span>{selected.certificate.safety.siiActionsMade ? 'SÍ' : 'NO'}</span></article>
            <article><b>RM-60 writes</b><span>{selected.certificate.safety.rm60WritesMade ? 'SÍ' : 'NO'}</span></article>
          </section>
        </section>
      ) : null}

      <footer className="recovery-cert-footer">
        <span>OC-30 · Recovery Drill & Integrity Certification</span>
        <span>Sandbox temporal · no restore live · reporte SHA-256 · sin DELETE</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
