import { useEffect, useMemo, useState } from 'react'
import {
  appendEvidenceCase,
  buildEvidenceCaseExport,
  emptyEvidenceCaseDraft,
  emptyEvidenceCaseState,
  linkAttachmentToCase,
  linkEvidenceEntryToCase,
  sanitizeEvidenceCaseState,
  transitionEvidenceCaseStatus,
  type EvidenceCase,
  type EvidenceCaseDraft,
  type EvidenceCaseState,
  type EvidenceCaseStatus,
  type EvidenceCaseType,
} from '../evidence-case'
import {
  emptyEvidenceLedger,
  sanitizeEvidenceLedger,
  type EvidenceEntry,
  type EvidenceLedgerState,
  type EvidenceSystem,
} from '../evidence-ledger'
import {
  listEvidenceAttachments,
  resolveEvidenceAttachmentUrl,
  uploadEvidenceAttachment,
  validateEvidenceFile,
  type EvidenceAttachmentRecord,
} from '../evidence-attachment-api'

const CASES_KEY = 'orbi-pos:evidence-cases'
const LEDGER_KEY = 'orbi-pos:evidence-ledger'

const systemLabels: Record<EvidenceSystem, string> = {
  general: 'General',
  rm60: 'DIGI RM-60',
  'sunmi-inputsoft': 'SUNMI / Inputsoft',
  sii: 'SII',
  point: 'Point / Mercado Pago',
  pos: 'ORBI POS',
  showcase: 'Showcase',
  catalog: 'Catálogo / precios',
  migration: 'Migración / rollback',
}

const typeLabels: Record<EvidenceCaseType, string> = {
  incident: 'Incidente',
  test: 'Prueba',
  'decision-support': 'Soporte de decisión',
  migration: 'Migración',
}

const statusLabels: Record<EvidenceCaseStatus, string> = {
  open: 'Abierto',
  monitoring: 'Monitoreo',
  closed: 'Cerrado',
  superseded: 'Superado',
}

function loadCases(): EvidenceCaseState {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    if (!raw) return emptyEvidenceCaseState
    return sanitizeEvidenceCaseState(JSON.parse(raw) as Partial<EvidenceCaseState>)
  } catch {
    return emptyEvidenceCaseState
  }
}

function loadLedger(): EvidenceLedgerState {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return emptyEvidenceLedger
    return sanitizeEvidenceLedger(JSON.parse(raw) as Partial<EvidenceLedgerState>)
  } catch {
    return emptyEvidenceLedger
  }
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function go(path: string) {
  window.location.href = path
}

function entryLabel(entry: EvidenceEntry) {
  return `${entry.id} · ${entry.title}`
}

export function EvidenceCaseBinder() {
  const [cases, setCases] = useState<EvidenceCaseState>(loadCases)
  const [ledger] = useState<EvidenceLedgerState>(loadLedger)
  const [attachments, setAttachments] = useState<EvidenceAttachmentRecord[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [draft, setDraft] = useState<EvidenceCaseDraft>(emptyEvidenceCaseDraft)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    () => loadCases().cases[0]?.id ?? null,
  )
  const [caseStatus, setCaseStatus] = useState<EvidenceCaseStatus>('monitoring')
  const [statusNote, setStatusNote] = useState('')
  const [selectedEntryForUpload, setSelectedEntryForUpload] = useState('')
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EvidenceCaseStatus>('all')
  const [systemFilter, setSystemFilter] = useState<'all' | EvidenceSystem>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | EvidenceCaseType>('all')

  useEffect(() => {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases))
  }, [cases])

  useEffect(() => {
    let active = true
    listEvidenceAttachments()
      .then((records) => {
        if (!active) return
        setAttachments(records)
        setAttachmentError('')
      })
      .catch((error) => {
        if (!active) return
        setAttachmentError((error as Error).message)
      })

    return () => {
      active = false
    }
  }, [])

  const filteredCases = useMemo(() => cases.cases
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .filter((item) => systemFilter === 'all' || item.system === systemFilter)
    .filter((item) => typeFilter === 'all' || item.type === typeFilter),
  [cases.cases, statusFilter, systemFilter, typeFilter])

  const selectedCase = useMemo(
    () => cases.cases.find((item) => item.id === selectedCaseId) ?? null,
    [cases.cases, selectedCaseId],
  )

  const selectedAttachments = useMemo(() => {
    if (!selectedCase) return []
    const ids = new Set(selectedCase.attachmentIds)
    return attachments.filter((item) => ids.has(item.fileName))
  }, [attachments, selectedCase])

  const availableEntries = useMemo(() => {
    if (!selectedCase) return ledger.entries
    return [...ledger.entries].sort((a, b) => {
      const aLinked = selectedCase.entryIds.includes(a.id) ? 0 : 1
      const bLinked = selectedCase.entryIds.includes(b.id) ? 0 : 1
      if (aLinked !== bLinked) return aLinked - bLinked
      return b.occurredAt.localeCompare(a.occurredAt)
    })
  }, [ledger.entries, selectedCase])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  function createCase() {
    try {
      const next = appendEvidenceCase(cases, draft)
      setCases(next)
      setSelectedCaseId(next.cases[0].id)
      setDraft(emptyEvidenceCaseDraft)
      flash('Expediente creado. Ya puedes vincular entradas y archivos.')
    } catch (error) {
      flash((error as Error).message)
    }
  }

  function toggleEntry(entryId: string, linked: boolean) {
    if (!selectedCase) return
    try {
      setCases((current) =>
        linkEvidenceEntryToCase(current, selectedCase.id, entryId, linked),
      )
      flash(linked ? 'Entrada vinculada al expediente.' : 'Entrada desvinculada del expediente.')
    } catch (error) {
      flash((error as Error).message)
    }
  }

  async function uploadFile(file: File | null) {
    if (!file || !selectedCase) return
    const validation = validateEvidenceFile(file)
    if (validation) {
      flash(validation)
      return
    }

    setUploading(true)
    try {
      const record = await uploadEvidenceAttachment(file, {
        caseId: selectedCase.id,
        entryId: selectedEntryForUpload || undefined,
      })
      setAttachments((current) => [record, ...current])
      setCases((current) =>
        linkAttachmentToCase(current, selectedCase.id, record.fileName, true),
      )
      flash('Archivo validado, hasheado y vinculado al expediente.')
    } catch (error) {
      flash((error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function unlinkAttachment(fileName: string) {
    if (!selectedCase) return
    setCases((current) =>
      linkAttachmentToCase(current, selectedCase.id, fileName, false),
    )
    flash('Archivo desvinculado del expediente. El binario se conserva en el servidor.')
  }

  function changeCaseStatus() {
    if (!selectedCase) return
    try {
      setCases((current) =>
        transitionEvidenceCaseStatus(
          current,
          selectedCase.id,
          caseStatus,
          statusNote,
        ),
      )
      setStatusNote('')
      flash('Estado del expediente actualizado con historial.')
    } catch (error) {
      flash((error as Error).message)
    }
  }

  function exportBinder() {
    const payload = {
      ...buildEvidenceCaseExport(cases),
      attachments,
      safety: {
        includesBinaryFiles: false,
        warning: 'Metadata only. Review filenames/references before sharing. Binary evidence files are not embedded.',
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbi-el-chunchito-case-binder.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="case-binder-page">
      <header className="case-binder-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>← Hub</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/evidencia')}>Ledger OC-26</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/migracion')}>Runbook OC-25</button>
        </div>
        <button className="ghost" type="button" onClick={exportBinder}>Exportar expediente JSON</button>
      </header>

      <section className="case-binder-hero">
        <div className="case-binder-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · CASE BINDER</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>
        <div className="case-binder-title">
          <p className="eyebrow">OC-27 · Archivos + expedientes</p>
          <h1>Un incidente deja de ser una nota suelta.</h1>
          <p>
            Agrupa entradas del ledger, fotos, capturas y PDFs en un expediente trazable.
            Los archivos se guardan con nombre opaco, firma validada y SHA-256.
          </p>
        </div>
        <div className="case-binder-stats">
          <article><span>EXPEDIENTES</span><strong>{cases.cases.length}</strong><small>totales</small></article>
          <article><span>ABIERTOS</span><strong>{cases.cases.filter((item) => item.status === 'open').length}</strong><small>requieren trabajo</small></article>
          <article><span>ARCHIVOS</span><strong>{attachments.length}</strong><small>JPG/PNG/WebP/PDF</small></article>
          <article><span>ENTRADAS LEDGER</span><strong>{ledger.entries.length}</strong><small>disponibles para vincular</small></article>
        </div>
      </section>

      <section className="case-binder-security">
        <span>⚠</span>
        <div>
          <b>Los archivos pueden contener información que el filtro de texto no puede detectar.</b>
          <p>
            Antes de subir una foto o PDF revisa que no incluya contraseñas, tokens, datos de tarjeta
            ni información personal de clientes. OC-27 valida formato e integridad, no el contenido semántico del archivo.
          </p>
        </div>
      </section>

      <section className="case-binder-create">
        <div className="case-section-head">
          <span>+</span>
          <div>
            <p className="eyebrow">Nuevo expediente</p>
            <h2>Crear carpeta lógica de evidencia</h2>
          </div>
        </div>
        <div className="case-create-grid">
          <label>
            <span>Tipo</span>
            <select
              value={draft.type}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as EvidenceCaseType }))}
            >
              {Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Sistema</span>
            <select
              value={draft.system}
              onChange={(event) => setDraft((current) => ({ ...current, system: event.target.value as EvidenceSystem }))}
            >
              {Object.entries(systemLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="case-wide">
            <span>Título</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej. Investigación SUNMI/Inputsoft/SII"
            />
          </label>
          <label className="case-wide">
            <span>Resumen factual</span>
            <textarea
              value={draft.summary}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Qué pregunta o incidente agrupa este expediente. Sin secretos ni datos personales."
            />
          </label>
        </div>
        <div className="case-create-actions">
          <p>El expediente no modifica las entradas originales del ledger.</p>
          <button className="primary" type="button" onClick={createCase}>Crear expediente</button>
        </div>
      </section>

      <section className="case-binder-workspace">
        <aside className="case-binder-list">
          <div className="case-binder-filters">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | EvidenceCaseStatus)}>
              <option value="all">Todos los estados</option>
              {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={systemFilter} onChange={(event) => setSystemFilter(event.target.value as 'all' | EvidenceSystem)}>
              <option value="all">Todos los sistemas</option>
              {Object.entries(systemLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | EvidenceCaseType)}>
              <option value="all">Todos los tipos</option>
              {Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>

          <div className="case-list-items">
            {filteredCases.length ? filteredCases.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedCaseId === item.id ? 'case-list-item selected' : 'case-list-item'}
                onClick={() => setSelectedCaseId(item.id)}
              >
                <div>
                  <span>{typeLabels[item.type]}</span>
                  <em>{statusLabels[item.status]}</em>
                </div>
                <strong>{item.title}</strong>
                <small>{systemLabels[item.system]} · {item.entryIds.length} entradas · {item.attachmentIds.length} archivos</small>
              </button>
            )) : (
              <div className="case-list-empty">Sin expedientes para estos filtros.</div>
            )}
          </div>
        </aside>

        <section className="case-binder-detail">
          {selectedCase ? (
            <>
              <header className="case-detail-head">
                <div>
                  <p className="eyebrow">{selectedCase.id}</p>
                  <h2>{selectedCase.title}</h2>
                  <p>{selectedCase.summary}</p>
                </div>
                <div className="case-detail-badges">
                  <span>{systemLabels[selectedCase.system]}</span>
                  <span>{typeLabels[selectedCase.type]}</span>
                  <b>{statusLabels[selectedCase.status]}</b>
                </div>
              </header>

              <section className="case-status-control">
                <div>
                  <b>Cambiar estado con nota</b>
                  <small>El cambio queda registrado en el historial del expediente.</small>
                </div>
                <select value={caseStatus} onChange={(event) => setCaseStatus(event.target.value as EvidenceCaseStatus)}>
                  {Object.entries(statusLabels)
                    .filter(([value]) => value !== selectedCase.status)
                    .map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
                <input
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="Motivo/evidencia del cambio..."
                />
                <button className="primary" type="button" onClick={changeCaseStatus}>Registrar</button>
              </section>

              <section className="case-panel">
                <div className="case-panel-head">
                  <div><p className="eyebrow">Ledger OC-26</p><h3>Entradas vinculadas</h3></div>
                  <span>{selectedCase.entryIds.length}/{ledger.entries.length}</span>
                </div>
                <div className="case-entry-links">
                  {availableEntries.length ? availableEntries.map((entry) => {
                    const linked = selectedCase.entryIds.includes(entry.id)
                    return (
                      <label className={linked ? 'case-entry-link linked' : 'case-entry-link'} key={entry.id}>
                        <input
                          type="checkbox"
                          checked={linked}
                          onChange={(event) => toggleEntry(entry.id, event.target.checked)}
                        />
                        <div>
                          <b>{entry.title}</b>
                          <small>{entry.id} · {systemLabels[entry.system]} · {entry.status}</small>
                        </div>
                      </label>
                    )
                  }) : <div className="case-empty-panel">Todavía no hay entradas en OC-26.</div>}
                </div>
              </section>

              <section className="case-panel">
                <div className="case-panel-head">
                  <div><p className="eyebrow">Archivos</p><h3>Adjuntar evidencia validada</h3></div>
                  <span>{selectedAttachments.length}</span>
                </div>

                {attachmentError ? (
                  <div className="case-server-warning">
                    <b>Servidor de archivos no disponible:</b> {attachmentError}
                  </div>
                ) : null}

                <div className="case-upload-row">
                  <select
                    value={selectedEntryForUpload}
                    onChange={(event) => setSelectedEntryForUpload(event.target.value)}
                  >
                    <option value="">Sin vínculo directo a una entrada</option>
                    {selectedCase.entryIds
                      .map((id) => ledger.entries.find((entry) => entry.id === id))
                      .filter((entry): entry is EvidenceEntry => Boolean(entry))
                      .map((entry) => <option value={entry.id} key={entry.id}>{entryLabel(entry)}</option>)}
                  </select>
                  <label className={uploading ? 'case-file-button disabled' : 'case-file-button'}>
                    {uploading ? 'Subiendo…' : 'Elegir JPG / PNG / WebP / PDF'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      disabled={uploading}
                      onChange={(event) => {
                        void uploadFile(event.target.files?.[0] ?? null)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                </div>

                <div className="case-attachment-list">
                  {selectedAttachments.length ? selectedAttachments.map((attachment) => (
                    <article key={attachment.fileName}>
                      <div className="case-file-icon">{attachment.contentType === 'application/pdf' ? 'PDF' : 'IMG'}</div>
                      <div className="case-file-copy">
                        <b>{attachment.originalName}</b>
                        <span>{formatBytes(attachment.size)} · {new Date(attachment.uploadedAt).toLocaleString('es-CL')}</span>
                        <small>SHA-256 {attachment.sha256}</small>
                        {attachment.entryId ? <small>Ledger: {attachment.entryId}</small> : null}
                      </div>
                      <div className="case-file-actions">
                        <a
                          className="ghost"
                          href={resolveEvidenceAttachmentUrl(attachment.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
                        <button className="ghost" type="button" onClick={() => unlinkAttachment(attachment.fileName)}>
                          Desvincular
                        </button>
                      </div>
                    </article>
                  )) : (
                    <div className="case-empty-panel">Sin archivos vinculados a este expediente.</div>
                  )}
                </div>
              </section>

              <details className="case-history">
                <summary>Historial del expediente · {selectedCase.history.length} evento(s)</summary>
                <ol>
                  {selectedCase.history.map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      <time>{new Date(event.at).toLocaleString('es-CL')}</time>
                      <b>{event.action}</b>
                      <span>{event.note}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <div className="case-no-selection">
              <span>📁</span>
              <h2>Crea o selecciona un expediente</h2>
              <p>Luego podrás vincular entradas del ledger y adjuntar evidencia binaria validada.</p>
            </div>
          )}
        </section>
      </section>

      <section className="case-binder-safety">
        <article><b>Integridad</b><span>Cada archivo conserva tamaño, MIME, fecha y SHA-256.</span></article>
        <article><b>Sin borrado</b><span>OC-27 no expone endpoint de eliminación de archivos.</span></article>
        <article><b>Ledger intacto</b><span>Vincular/desvincular no modifica la entrada OC-26 original.</span></article>
        <article><b>Exportación</b><span>El JSON del binder incluye metadatos, nunca inserta los binarios.</span></article>
      </section>

      <footer className="case-binder-footer">
        <span>OC-27 · Evidence Attachments & Case Binder</span>
        <span>Trusted LAN pilot · archivos locales al servidor ORBI · sin acciones externas</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
