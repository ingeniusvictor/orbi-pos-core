export type EvidenceEntryType =
  | 'observation'
  | 'test'
  | 'incident'
  | 'decision'
  | 'document'

export type EvidenceSystem =
  | 'general'
  | 'rm60'
  | 'sunmi-inputsoft'
  | 'sii'
  | 'point'
  | 'pos'
  | 'showcase'
  | 'catalog'
  | 'migration'

export type EvidenceSeverity = 'info' | 'warning' | 'critical'

export type EvidenceStatus = 'open' | 'verified' | 'resolved' | 'superseded'

export interface EvidenceHistoryEvent {
  at: string
  action: 'created' | 'status-change'
  fromStatus: EvidenceStatus | null
  toStatus: EvidenceStatus
  note: string
}

export interface EvidenceEntry {
  id: string
  occurredAt: string
  createdAt: string
  updatedAt: string
  type: EvidenceEntryType
  system: EvidenceSystem
  severity: EvidenceSeverity
  status: EvidenceStatus
  title: string
  summary: string
  actor: string
  evidenceReference: string
  sourceContext: string
  history: EvidenceHistoryEvent[]
}

export interface EvidenceLedgerState {
  version: 'orbi-pos-evidence-ledger/v1'
  entries: EvidenceEntry[]
}

export interface EvidenceDraft {
  occurredAt: string
  type: EvidenceEntryType
  system: EvidenceSystem
  severity: EvidenceSeverity
  status: EvidenceStatus
  title: string
  summary: string
  actor: string
  evidenceReference: string
  sourceContext: string
}

export interface EvidenceLedgerStats {
  totalEntries: number
  openIncidents: number
  criticalOpen: number
  verifiedEntries: number
  decisions: number
  resolvedIncidents: number
}

export const emptyEvidenceLedger: EvidenceLedgerState = {
  version: 'orbi-pos-evidence-ledger/v1',
  entries: [],
}

export const emptyEvidenceDraft: EvidenceDraft = {
  occurredAt: '',
  type: 'observation',
  system: 'general',
  severity: 'info',
  status: 'open',
  title: '',
  summary: '',
  actor: '',
  evidenceReference: '',
  sourceContext: '',
}

const sensitivePatterns: Array<{ label: string; regex: RegExp }> = [
  {
    label: 'contraseña/password',
    regex: /\b(?:password|passwd|contrase(?:ñ|n)a)\s*[:=]\s*\S+/i,
  },
  {
    label: 'API key',
    regex: /\bapi[_ -]?key\s*[:=]\s*\S+/i,
  },
  {
    label: 'access token',
    regex: /\baccess[_ -]?token\s*[:=]\s*\S+/i,
  },
  {
    label: 'client secret',
    regex: /\bclient[_ -]?secret\s*[:=]\s*\S+/i,
  },
  {
    label: 'Bearer token',
    regex: /\bbearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
  },
  {
    label: 'posible número de tarjeta',
    regex: /(?:^|\D)(?:\d[ -]?){13,19}(?:\D|$)/,
  },
]

export function findPotentialSensitivePatterns(value: string): string[] {
  if (!value.trim()) return []
  return sensitivePatterns
    .filter((pattern) => pattern.regex.test(value))
    .map((pattern) => pattern.label)
}

export function evidenceDraftWarnings(draft: EvidenceDraft): string[] {
  const combined = [
    draft.title,
    draft.summary,
    draft.actor,
    draft.evidenceReference,
    draft.sourceContext,
  ].join('\n')

  return findPotentialSensitivePatterns(combined)
}

export function validateEvidenceDraft(draft: EvidenceDraft): string[] {
  const errors: string[] = []

  if (!draft.occurredAt.trim()) errors.push('Fecha/hora del hecho')
  if (draft.title.trim().length < 4) errors.push('Título descriptivo')
  if (draft.summary.trim().length < 8) errors.push('Resumen factual')
  if (draft.actor.trim().length < 2) errors.push('Persona/rol que observó o verificó')

  const warnings = evidenceDraftWarnings(draft)
  if (warnings.length) {
    errors.push(`Posible dato sensible detectado: ${warnings.join(', ')}`)
  }

  return errors
}

export function createEvidenceEntryId(
  now: Date = new Date(),
  suffix = Math.random().toString(36).slice(2, 8).toUpperCase(),
) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `EVD-${stamp}-${suffix}`
}

export function appendEvidenceEntry(
  state: EvidenceLedgerState,
  draft: EvidenceDraft,
  now = new Date().toISOString(),
  id = createEvidenceEntryId(new Date(now)),
): EvidenceLedgerState {
  const errors = validateEvidenceDraft(draft)
  if (errors.length) {
    throw new Error(errors.join(' · '))
  }

  const entry: EvidenceEntry = {
    id,
    occurredAt: draft.occurredAt,
    createdAt: now,
    updatedAt: now,
    type: draft.type,
    system: draft.system,
    severity: draft.severity,
    status: draft.status,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    actor: draft.actor.trim(),
    evidenceReference: draft.evidenceReference.trim(),
    sourceContext: draft.sourceContext.trim(),
    history: [
      {
        at: now,
        action: 'created',
        fromStatus: null,
        toStatus: draft.status,
        note: 'Entrada creada',
      },
    ],
  }

  return {
    ...state,
    entries: [entry, ...state.entries],
  }
}

export function transitionEvidenceStatus(
  state: EvidenceLedgerState,
  entryId: string,
  nextStatus: EvidenceStatus,
  note: string,
  now = new Date().toISOString(),
): EvidenceLedgerState {
  if (note.trim().length < 4) {
    throw new Error('El cambio de estado requiere una nota de evidencia')
  }

  const warnings = findPotentialSensitivePatterns(note)
  if (warnings.length) {
    throw new Error(`Posible dato sensible detectado: ${warnings.join(', ')}`)
  }

  let found = false
  const entries = state.entries.map((entry) => {
    if (entry.id !== entryId) return entry
    found = true

    if (entry.status === nextStatus) {
      throw new Error('La entrada ya tiene ese estado')
    }

    return {
      ...entry,
      status: nextStatus,
      updatedAt: now,
      history: [
        ...entry.history,
        {
          at: now,
          action: 'status-change' as const,
          fromStatus: entry.status,
          toStatus: nextStatus,
          note: note.trim(),
        },
      ],
    }
  })

  if (!found) throw new Error('Entrada de evidencia no encontrada')

  return {
    ...state,
    entries,
  }
}

export function evidenceLedgerStats(
  state: EvidenceLedgerState,
): EvidenceLedgerStats {
  return {
    totalEntries: state.entries.length,
    openIncidents: state.entries.filter(
      (entry) => entry.type === 'incident' && entry.status === 'open',
    ).length,
    criticalOpen: state.entries.filter(
      (entry) =>
        entry.severity === 'critical'
        && (entry.status === 'open' || entry.status === 'verified'),
    ).length,
    verifiedEntries: state.entries.filter(
      (entry) => entry.status === 'verified',
    ).length,
    decisions: state.entries.filter(
      (entry) => entry.type === 'decision',
    ).length,
    resolvedIncidents: state.entries.filter(
      (entry) => entry.type === 'incident' && entry.status === 'resolved',
    ).length,
  }
}

export function sanitizeEvidenceLedger(
  value: Partial<EvidenceLedgerState>,
): EvidenceLedgerState {
  if (!Array.isArray(value.entries)) return emptyEvidenceLedger

  const allowedTypes: EvidenceEntryType[] = [
    'observation',
    'test',
    'incident',
    'decision',
    'document',
  ]
  const allowedSystems: EvidenceSystem[] = [
    'general',
    'rm60',
    'sunmi-inputsoft',
    'sii',
    'point',
    'pos',
    'showcase',
    'catalog',
    'migration',
  ]
  const allowedSeverity: EvidenceSeverity[] = ['info', 'warning', 'critical']
  const allowedStatus: EvidenceStatus[] = ['open', 'verified', 'resolved', 'superseded']

  const entries = value.entries
    .filter((candidate): candidate is EvidenceEntry =>
      Boolean(candidate && typeof candidate.id === 'string' && candidate.id.trim()),
    )
    .map((entry) => ({
      id: entry.id,
      occurredAt: typeof entry.occurredAt === 'string' ? entry.occurredAt : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      type: allowedTypes.includes(entry.type) ? entry.type : 'observation',
      system: allowedSystems.includes(entry.system) ? entry.system : 'general',
      severity: allowedSeverity.includes(entry.severity) ? entry.severity : 'info',
      status: allowedStatus.includes(entry.status) ? entry.status : 'open',
      title: typeof entry.title === 'string' ? entry.title : '',
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      actor: typeof entry.actor === 'string' ? entry.actor : '',
      evidenceReference:
        typeof entry.evidenceReference === 'string' ? entry.evidenceReference : '',
      sourceContext: typeof entry.sourceContext === 'string' ? entry.sourceContext : '',
      history: Array.isArray(entry.history)
        ? entry.history
            .filter((event) => event && typeof event.at === 'string')
            .map((event) => ({
              at: event.at,
              action: event.action === 'status-change' ? 'status-change' as const : 'created' as const,
              fromStatus:
                event.fromStatus && allowedStatus.includes(event.fromStatus)
                  ? event.fromStatus
                  : null,
              toStatus: allowedStatus.includes(event.toStatus) ? event.toStatus : 'open',
              note: typeof event.note === 'string' ? event.note : '',
            }))
        : [],
    }))

  return {
    version: 'orbi-pos-evidence-ledger/v1',
    entries,
  }
}

export function buildEvidenceLedgerExport(
  state: EvidenceLedgerState,
  generatedAt = new Date().toISOString(),
) {
  return {
    format: 'orbi-pos-evidence-ledger-export/v1',
    business: 'Carnicería El Chunchito',
    generatedAt,
    stats: evidenceLedgerStats(state),
    entries: state.entries,
    safety: {
      containsBinaryAttachments: false,
      performsExternalActions: false,
      warning: 'Guardrail only. Review export before sharing and do not include passwords, API keys, tokens, card data or customer personal information.',
    },
  }
}
