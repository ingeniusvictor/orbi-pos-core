import { findPotentialSensitivePatterns, type EvidenceSystem } from './evidence-ledger'

export type EvidenceCaseType =
  | 'incident'
  | 'test'
  | 'decision-support'
  | 'migration'

export type EvidenceCaseStatus =
  | 'open'
  | 'monitoring'
  | 'closed'
  | 'superseded'

export type EvidenceCaseHistoryAction =
  | 'created'
  | 'status-change'
  | 'link-entry'
  | 'unlink-entry'
  | 'link-attachment'
  | 'unlink-attachment'

export interface EvidenceCaseHistoryEvent {
  at: string
  action: EvidenceCaseHistoryAction
  note: string
}

export interface EvidenceCase {
  id: string
  title: string
  system: EvidenceSystem
  type: EvidenceCaseType
  status: EvidenceCaseStatus
  summary: string
  createdAt: string
  updatedAt: string
  entryIds: string[]
  attachmentIds: string[]
  history: EvidenceCaseHistoryEvent[]
}

export interface EvidenceCaseState {
  version: 'orbi-pos-evidence-cases/v1'
  cases: EvidenceCase[]
}

export interface EvidenceCaseDraft {
  title: string
  system: EvidenceSystem
  type: EvidenceCaseType
  summary: string
}

export const emptyEvidenceCaseState: EvidenceCaseState = {
  version: 'orbi-pos-evidence-cases/v1',
  cases: [],
}

export const emptyEvidenceCaseDraft: EvidenceCaseDraft = {
  title: '',
  system: 'general',
  type: 'incident',
  summary: '',
}

export function createEvidenceCaseId(
  now: Date = new Date(),
  suffix = Math.random().toString(36).slice(2, 8).toUpperCase(),
) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `CASE-${stamp}-${suffix}`
}

export function validateEvidenceCaseDraft(draft: EvidenceCaseDraft) {
  const errors: string[] = []
  if (draft.title.trim().length < 4) errors.push('Título del expediente')
  if (draft.summary.trim().length < 8) errors.push('Resumen factual del expediente')

  const sensitive = findPotentialSensitivePatterns(
    [draft.title, draft.summary].join('\n'),
  )
  if (sensitive.length) {
    errors.push(`Posible dato sensible detectado: ${sensitive.join(', ')}`)
  }
  return errors
}

export function appendEvidenceCase(
  state: EvidenceCaseState,
  draft: EvidenceCaseDraft,
  now = new Date().toISOString(),
  id = createEvidenceCaseId(new Date(now)),
): EvidenceCaseState {
  const errors = validateEvidenceCaseDraft(draft)
  if (errors.length) throw new Error(errors.join(' · '))

  const next: EvidenceCase = {
    id,
    title: draft.title.trim(),
    system: draft.system,
    type: draft.type,
    status: 'open',
    summary: draft.summary.trim(),
    createdAt: now,
    updatedAt: now,
    entryIds: [],
    attachmentIds: [],
    history: [{
      at: now,
      action: 'created',
      note: 'Expediente creado',
    }],
  }

  return {
    ...state,
    cases: [next, ...state.cases],
  }
}

function mutateCase(
  state: EvidenceCaseState,
  caseId: string,
  mutator: (current: EvidenceCase) => EvidenceCase,
): EvidenceCaseState {
  let found = false
  const cases = state.cases.map((candidate) => {
    if (candidate.id !== caseId) return candidate
    found = true
    return mutator(candidate)
  })
  if (!found) throw new Error('Expediente no encontrado')
  return { ...state, cases }
}

function validateLinkId(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)) {
    throw new Error('Identificador de vínculo inválido')
  }
}

export function transitionEvidenceCaseStatus(
  state: EvidenceCaseState,
  caseId: string,
  status: EvidenceCaseStatus,
  note: string,
  now = new Date().toISOString(),
): EvidenceCaseState {
  if (note.trim().length < 4) {
    throw new Error('El cambio de estado requiere una nota')
  }
  const sensitive = findPotentialSensitivePatterns(note)
  if (sensitive.length) {
    throw new Error(`Posible dato sensible detectado: ${sensitive.join(', ')}`)
  }

  return mutateCase(state, caseId, (current) => {
    if (current.status === status) throw new Error('El expediente ya tiene ese estado')
    return {
      ...current,
      status,
      updatedAt: now,
      history: [
        ...current.history,
        {
          at: now,
          action: 'status-change',
          note: `${current.status} → ${status}: ${note.trim()}`,
        },
      ],
    }
  })
}

export function linkEvidenceEntryToCase(
  state: EvidenceCaseState,
  caseId: string,
  entryId: string,
  linked: boolean,
  now = new Date().toISOString(),
): EvidenceCaseState {
  validateLinkId(entryId)
  return mutateCase(state, caseId, (current) => {
    const already = current.entryIds.includes(entryId)
    if (already === linked) return current

    return {
      ...current,
      entryIds: linked
        ? [...current.entryIds, entryId]
        : current.entryIds.filter((id) => id !== entryId),
      updatedAt: now,
      history: [
        ...current.history,
        {
          at: now,
          action: linked ? 'link-entry' : 'unlink-entry',
          note: `${linked ? 'Vinculada' : 'Desvinculada'} evidencia ${entryId}`,
        },
      ],
    }
  })
}

export function linkAttachmentToCase(
  state: EvidenceCaseState,
  caseId: string,
  attachmentId: string,
  linked: boolean,
  now = new Date().toISOString(),
): EvidenceCaseState {
  validateLinkId(attachmentId)
  return mutateCase(state, caseId, (current) => {
    const already = current.attachmentIds.includes(attachmentId)
    if (already === linked) return current

    return {
      ...current,
      attachmentIds: linked
        ? [...current.attachmentIds, attachmentId]
        : current.attachmentIds.filter((id) => id !== attachmentId),
      updatedAt: now,
      history: [
        ...current.history,
        {
          at: now,
          action: linked ? 'link-attachment' : 'unlink-attachment',
          note: `${linked ? 'Vinculado' : 'Desvinculado'} archivo ${attachmentId}`,
        },
      ],
    }
  })
}

export function sanitizeEvidenceCaseState(
  value: Partial<EvidenceCaseState>,
): EvidenceCaseState {
  if (!Array.isArray(value.cases)) return emptyEvidenceCaseState

  const systems: EvidenceSystem[] = [
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
  const types: EvidenceCaseType[] = ['incident', 'test', 'decision-support', 'migration']
  const statuses: EvidenceCaseStatus[] = ['open', 'monitoring', 'closed', 'superseded']
  const actions: EvidenceCaseHistoryAction[] = [
    'created',
    'status-change',
    'link-entry',
    'unlink-entry',
    'link-attachment',
    'unlink-attachment',
  ]

  const cases = value.cases
    .filter((candidate): candidate is EvidenceCase =>
      Boolean(candidate && typeof candidate.id === 'string' && candidate.id.trim()),
    )
    .map((candidate) => ({
      id: candidate.id,
      title: typeof candidate.title === 'string' ? candidate.title : '',
      system: systems.includes(candidate.system) ? candidate.system : 'general',
      type: types.includes(candidate.type) ? candidate.type : 'incident',
      status: statuses.includes(candidate.status) ? candidate.status : 'open',
      summary: typeof candidate.summary === 'string' ? candidate.summary : '',
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : '',
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
      entryIds: Array.isArray(candidate.entryIds)
        ? [...new Set(candidate.entryIds.filter((id): id is string => typeof id === 'string'))]
        : [],
      attachmentIds: Array.isArray(candidate.attachmentIds)
        ? [...new Set(candidate.attachmentIds.filter((id): id is string => typeof id === 'string'))]
        : [],
      history: Array.isArray(candidate.history)
        ? candidate.history
            .filter((event) => event && typeof event.at === 'string')
            .map((event) => ({
              at: event.at,
              action: actions.includes(event.action) ? event.action : 'created',
              note: typeof event.note === 'string' ? event.note : '',
            }))
        : [],
    }))

  return {
    version: 'orbi-pos-evidence-cases/v1',
    cases,
  }
}

export function buildEvidenceCaseExport(
  state: EvidenceCaseState,
  generatedAt = new Date().toISOString(),
) {
  return {
    format: 'orbi-pos-evidence-case-binder-export/v1',
    business: 'Carnicería El Chunchito',
    generatedAt,
    cases: state.cases,
    safety: {
      includesBinaryFiles: false,
      warning: 'Metadata only. Review before sharing. Binary evidence files are not embedded.',
    },
  }
}
