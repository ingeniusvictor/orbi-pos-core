import { useEffect, useMemo, useState } from 'react'
import {
  appendEvidenceEntry,
  buildEvidenceLedgerExport,
  emptyEvidenceDraft,
  emptyEvidenceLedger,
  evidenceDraftWarnings,
  evidenceLedgerStats,
  sanitizeEvidenceLedger,
  transitionEvidenceStatus,
  type EvidenceDraft,
  type EvidenceEntry,
  type EvidenceEntryType,
  type EvidenceLedgerState,
  type EvidenceSeverity,
  type EvidenceStatus,
  type EvidenceSystem,
} from '../evidence-ledger'

const LEDGER_KEY = 'orbi-pos:evidence-ledger'

const typeLabels: Record<EvidenceEntryType, string> = {
  observation: 'Observación',
  test: 'Prueba',
  incident: 'Incidente',
  decision: 'Decisión',
  document: 'Documento / referencia',
}

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

const severityLabels: Record<EvidenceSeverity, string> = {
  info: 'Informativo',
  warning: 'Advertencia',
  critical: 'Crítico',
}

const statusLabels: Record<EvidenceStatus, string> = {
  open: 'Abierto',
  verified: 'Verificado',
  resolved: 'Resuelto',
  superseded: 'Superado',
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
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

function freshDraft(): EvidenceDraft {
  return {
    ...emptyEvidenceDraft,
    occurredAt: localDateTimeValue(),
  }
}

function statusIcon(status: EvidenceStatus) {
  if (status === 'verified') return '✓'
  if (status === 'resolved') return '✓'
  if (status === 'superseded') return '↪'
  return '○'
}

function formatOccurredAt(value: string) {
  if (!value) return 'Sin fecha'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('es-CL')
}

function go(path: string) {
  window.location.href = path
}

export function EvidenceIncidentLedger() {
  const [ledger, setLedger] = useState<EvidenceLedgerState>(loadLedger)
  const [draft, setDraft] = useState<EvidenceDraft>(freshDraft)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | EvidenceEntryType>('all')
  const [systemFilter, setSystemFilter] = useState<'all' | EvidenceSystem>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EvidenceStatus>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | EvidenceSeverity>('all')
  const [transitionEntryId, setTransitionEntryId] = useState<string | null>(null)
  const [transitionStatus, setTransitionStatus] = useState<EvidenceStatus>('verified')
  const [transitionNote, setTransitionNote] = useState('')

  useEffect(() => {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  }, [ledger])

  const stats = useMemo(() => evidenceLedgerStats(ledger), [ledger])
  const draftWarnings = useMemo(() => evidenceDraftWarnings(draft), [draft])

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return [...ledger.entries]
      .filter((entry) => typeFilter === 'all' || entry.type === typeFilter)
      .filter((entry) => systemFilter === 'all' || entry.system === systemFilter)
      .filter((entry) => statusFilter === 'all' || entry.status === statusFilter)
      .filter((entry) => severityFilter === 'all' || entry.severity === severityFilter)
      .filter((entry) => {
        if (!normalizedQuery) return true
        return [
          entry.id,
          entry.title,
          entry.summary,
          entry.actor,
          entry.evidenceReference,
          entry.sourceContext,
        ].join(' ').toLowerCase().includes(normalizedQuery)
      })
      .sort((a, b) => {
        const aTime = new Date(a.occurredAt || a.createdAt).getTime()
        const bTime = new Date(b.occurredAt || b.createdAt).getTime()
        return bTime - aTime
      })
  }, [
    ledger.entries,
    query,
    severityFilter,
    statusFilter,
    systemFilter,
    typeFilter,
  ])

  function patchDraft<K extends keyof EvidenceDraft>(
    key: K,
    value: EvidenceDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function saveEntry() {
    try {
      const next = appendEvidenceEntry(ledger, draft)
      setLedger(next)
      setDraft(freshDraft())
      setNotice('Entrada agregada al ledger. El registro no se elimina desde la interfaz.')
    } catch (error) {
      setNotice((error as Error).message)
    }
    window.setTimeout(() => setNotice(''), 3400)
  }

  function openTransition(entry: EvidenceEntry) {
    setTransitionEntryId(entry.id)
    setTransitionStatus(entry.status === 'open' ? 'verified' : 'resolved')
    setTransitionNote('')
  }

  function applyTransition() {
    if (!transitionEntryId) return

    try {
      const next = transitionEvidenceStatus(
        ledger,
        transitionEntryId,
        transitionStatus,
        transitionNote,
      )
      setLedger(next)
      setTransitionEntryId(null)
      setTransitionNote('')
      setNotice('Cambio de estado registrado con historial de auditoría.')
    } catch (error) {
      setNotice((error as Error).message)
    }

    window.setTimeout(() => setNotice(''), 3400)
  }

  function exportJson() {
    const payload = buildEvidenceLedgerExport(ledger)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbi-el-chunchito-evidence-ledger.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="evidence-ledger-page">
      <header className="evidence-ledger-topbar">
        <div>
          <button className="ghost" type="button" onClick={() => go('/piloto')}>← Hub</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/decision')}>Gate OC-24</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/migracion')}>Runbook OC-25</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/expedientes')}>Expedientes OC-27</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/respaldo')}>Respaldo OC-28</button>
          <button className="ghost" type="button" onClick={() => go('/piloto/desastre')}>DR OC-29</button>
        </div>
        <button className="ghost" type="button" onClick={exportJson}>Exportar ledger JSON</button>
      </header>

      <section className="evidence-ledger-hero">
        <div className="evidence-ledger-brand">
          <span>O</span>
          <div>
            <p>ORBI ECOSYSTEM · PILOT EVIDENCE LEDGER</p>
            <strong>Carnicería El Chunchito</strong>
          </div>
        </div>

        <div className="evidence-ledger-title">
          <p className="eyebrow">OC-26 · Evidencia e incidentes</p>
          <h1>Que cada decisión pueda rastrearse hasta un hecho.</h1>
          <p>
            Centraliza observaciones, pruebas, incidentes, decisiones y referencias sin mezclar el ledger
            con ventas, pagos, catálogo, Levantamiento, Gate o Runbook.
          </p>
        </div>

        <div className="evidence-ledger-stats">
          <article>
            <span>INCIDENTES ABIERTOS</span>
            <strong>{stats.openIncidents}</strong>
            <small>requieren seguimiento</small>
          </article>
          <article className={stats.criticalOpen ? 'critical' : ''}>
            <span>CRÍTICOS ACTIVOS</span>
            <strong>{stats.criticalOpen}</strong>
            <small>abiertos o verificados</small>
          </article>
          <article>
            <span>EVIDENCIA VERIFICADA</span>
            <strong>{stats.verifiedEntries}</strong>
            <small>entradas en estado verificado</small>
          </article>
          <article>
            <span>DECISIONES</span>
            <strong>{stats.decisions}</strong>
            <small>registradas en el ledger</small>
          </article>
        </div>
      </section>

      <section className="evidence-ledger-security">
        <span>⚠</span>
        <div>
          <b>Registro operacional, no bóveda de secretos.</b>
          <p>
            No ingresar contraseñas, Access Tokens, API keys, datos de tarjeta ni información personal de clientes.
            El detector automático bloquea algunos patrones obvios, pero no reemplaza la revisión humana.
          </p>
        </div>
      </section>

      <section className="evidence-ledger-compose">
        <div className="evidence-section-head">
          <span>+</span>
          <div>
            <p className="eyebrow">Nueva entrada</p>
            <h2>Registrar lo que realmente ocurrió</h2>
          </div>
        </div>

        <div className="evidence-compose-grid">
          <label>
            <span>Fecha / hora del hecho</span>
            <input
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(event) => patchDraft('occurredAt', event.target.value)}
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              value={draft.type}
              onChange={(event) => patchDraft('type', event.target.value as EvidenceEntryType)}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Sistema / dominio</span>
            <select
              value={draft.system}
              onChange={(event) => patchDraft('system', event.target.value as EvidenceSystem)}
            >
              {Object.entries(systemLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Severidad</span>
            <select
              value={draft.severity}
              onChange={(event) => patchDraft('severity', event.target.value as EvidenceSeverity)}
            >
              {Object.entries(severityLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Estado inicial</span>
            <select
              value={draft.status}
              onChange={(event) => patchDraft('status', event.target.value as EvidenceStatus)}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Observó / verificó</span>
            <input
              value={draft.actor}
              onChange={(event) => patchDraft('actor', event.target.value)}
              placeholder="Nombre o rol, sin datos sensibles"
            />
          </label>

          <label className="evidence-wide">
            <span>Título</span>
            <input
              value={draft.title}
              onChange={(event) => patchDraft('title', event.target.value)}
              placeholder="Ej. Point quedó en processed durante prueba física"
            />
          </label>

          <label className="evidence-wide">
            <span>Resumen factual</span>
            <textarea
              value={draft.summary}
              onChange={(event) => patchDraft('summary', event.target.value)}
              placeholder="Qué ocurrió, qué se observó y cuál fue el resultado. Evitar conclusiones no verificadas."
            />
          </label>

          <label>
            <span>Referencia segura de evidencia</span>
            <input
              value={draft.evidenceReference}
              onChange={(event) => patchDraft('evidenceReference', event.target.value)}
              placeholder="captura-001.png / ticket / documento / URL no secreta"
            />
          </label>

          <label>
            <span>Contexto / módulo</span>
            <input
              value={draft.sourceContext}
              onChange={(event) => patchDraft('sourceContext', event.target.value)}
              placeholder="OC-24 Gate / OC-25 Preflight / visita terreno..."
            />
          </label>
        </div>

        {draftWarnings.length ? (
          <div className="evidence-sensitive-warning">
            <b>Posible información sensible detectada:</b> {draftWarnings.join(' · ')}
          </div>
        ) : null}

        <div className="evidence-compose-actions">
          <p>
            Las entradas no tienen botón de eliminar. Si una conclusión cambia, registra el nuevo estado
            o agrega una nueva evidencia.
          </p>
          <button className="primary" type="button" onClick={saveEntry}>
            Agregar al ledger
          </button>
        </div>
      </section>

      <section className="evidence-ledger-timeline">
        <div className="evidence-section-head timeline-head">
          <span>↕</span>
          <div>
            <p className="eyebrow">Timeline auditada</p>
            <h2>{visibleEntries.length} de {stats.totalEntries} entrada(s)</h2>
          </div>
        </div>

        <div className="evidence-filters">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar título, evidencia, actor, referencia..."
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | EvidenceEntryType)}
          >
            <option value="all">Todos los tipos</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>

          <select
            value={systemFilter}
            onChange={(event) => setSystemFilter(event.target.value as 'all' | EvidenceSystem)}
          >
            <option value="all">Todos los sistemas</option>
            {Object.entries(systemLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | EvidenceStatus)}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as 'all' | EvidenceSeverity)}
          >
            <option value="all">Todas las severidades</option>
            {Object.entries(severityLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </div>

        {visibleEntries.length ? (
          <div className="evidence-entry-list">
            {visibleEntries.map((entry) => (
              <article
                className={`evidence-entry severity-${entry.severity} status-${entry.status}`}
                key={entry.id}
              >
                <div className="evidence-entry-rail">
                  <span>{statusIcon(entry.status)}</span>
                  <i />
                </div>

                <div className="evidence-entry-main">
                  <header>
                    <div className="evidence-entry-badges">
                      <span>{typeLabels[entry.type]}</span>
                      <span>{systemLabels[entry.system]}</span>
                      <span className={`severity-badge severity-${entry.severity}`}>
                        {severityLabels[entry.severity]}
                      </span>
                    </div>
                    <time>{formatOccurredAt(entry.occurredAt)}</time>
                  </header>

                  <h3>{entry.title}</h3>
                  <p>{entry.summary}</p>

                  <div className="evidence-entry-meta">
                    <span><b>Observó/verificó:</b> {entry.actor}</span>
                    {entry.sourceContext ? <span><b>Contexto:</b> {entry.sourceContext}</span> : null}
                    {entry.evidenceReference ? (
                      <span><b>Referencia:</b> {entry.evidenceReference}</span>
                    ) : null}
                    <span><b>ID:</b> {entry.id}</span>
                  </div>

                  <details className="evidence-history">
                    <summary>Historial · {entry.history.length} evento(s)</summary>
                    <ol>
                      {entry.history.map((event, index) => (
                        <li key={`${event.at}-${index}`}>
                          <time>{new Date(event.at).toLocaleString('es-CL')}</time>
                          <span>
                            {event.action === 'created'
                              ? `Creada como ${statusLabels[event.toStatus]}`
                              : `${event.fromStatus ? statusLabels[event.fromStatus] : '—'} → ${statusLabels[event.toStatus]}`}
                          </span>
                          <small>{event.note}</small>
                        </li>
                      ))}
                    </ol>
                  </details>

                  {transitionEntryId === entry.id ? (
                    <div className="evidence-transition">
                      <select
                        value={transitionStatus}
                        onChange={(event) => setTransitionStatus(event.target.value as EvidenceStatus)}
                      >
                        {Object.entries(statusLabels)
                          .filter(([value]) => value !== entry.status)
                          .map(([value, label]) => (
                            <option value={value} key={value}>{label}</option>
                          ))}
                      </select>
                      <input
                        value={transitionNote}
                        onChange={(event) => setTransitionNote(event.target.value)}
                        placeholder="Nota obligatoria: qué evidencia justifica el cambio..."
                      />
                      <button className="primary" type="button" onClick={applyTransition}>
                        Registrar cambio
                      </button>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => {
                          setTransitionEntryId(null)
                          setTransitionNote('')
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="ghost evidence-status-action"
                      type="button"
                      onClick={() => openTransition(entry)}
                    >
                      Cambiar estado con evidencia
                    </button>
                  )}
                </div>

                <div className={`evidence-entry-status status-${entry.status}`}>
                  {statusLabels[entry.status]}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="evidence-empty">
            <span>🗂️</span>
            <h3>Sin entradas para estos filtros</h3>
            <p>Registra la primera observación o ajusta los filtros.</p>
          </div>
        )}
      </section>

      <section className="evidence-ledger-footer-note">
        <div>
          <p className="eyebrow">Regla del ledger</p>
          <h2>Corregir con trazabilidad, no borrar la historia.</h2>
        </div>
        <p>
          Una evidencia posterior puede verificar, resolver o superar una entrada anterior.
          El historial de cambio queda conservado para reconstruir por qué se tomó una decisión.
        </p>
      </section>

      <footer className="evidence-ledger-footer">
        <span>OC-26 · Pilot Evidence & Incident Ledger</span>
        <span>Local · sin adjuntos binarios · sin acciones automáticas sobre sistemas externos</span>
      </footer>

      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  )
}
