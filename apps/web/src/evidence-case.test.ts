import { describe, expect, it } from 'vitest'
import {
  appendEvidenceCase,
  buildEvidenceCaseExport,
  emptyEvidenceCaseDraft,
  emptyEvidenceCaseState,
  linkAttachmentToCase,
  linkEvidenceEntryToCase,
  transitionEvidenceCaseStatus,
} from './evidence-case'

const draft = {
  ...emptyEvidenceCaseDraft,
  title: 'Incidencia fiscal piloto',
  summary: 'Seguimiento de evidencia vinculada a la ruta fiscal del piloto.',
  system: 'sii' as const,
  type: 'incident' as const,
}

describe('evidence case binder', () => {
  it('creates a case with immutable id and history', () => {
    const state = appendEvidenceCase(
      emptyEvidenceCaseState,
      draft,
      '2026-09-25T03:20:00.000Z',
      'CASE-001',
    )

    expect(state.cases[0].id).toBe('CASE-001')
    expect(state.cases[0].history[0].action).toBe('created')
  })

  it('links and unlinks ledger entries without modifying ledger data', () => {
    let state = appendEvidenceCase(
      emptyEvidenceCaseState,
      draft,
      '2026-09-25T03:20:00.000Z',
      'CASE-002',
    )
    state = linkEvidenceEntryToCase(state, 'CASE-002', 'EVD-001', true)
    expect(state.cases[0].entryIds).toEqual(['EVD-001'])

    state = linkEvidenceEntryToCase(state, 'CASE-002', 'EVD-001', false)
    expect(state.cases[0].entryIds).toEqual([])
    expect(state.cases[0].history.at(-1)?.action).toBe('unlink-entry')
  })

  it('links attachment ids with audited history', () => {
    let state = appendEvidenceCase(
      emptyEvidenceCaseState,
      draft,
      '2026-09-25T03:20:00.000Z',
      'CASE-003',
    )
    state = linkAttachmentToCase(
      state,
      'CASE-003',
      'evidence-12345678-1234-1234-1234-123456789abc.pdf',
      true,
    )

    expect(state.cases[0].attachmentIds).toHaveLength(1)
    expect(state.cases[0].history.at(-1)?.action).toBe('link-attachment')
  })

  it('requires a note for status changes', () => {
    const state = appendEvidenceCase(
      emptyEvidenceCaseState,
      draft,
      '2026-09-25T03:20:00.000Z',
      'CASE-004',
    )

    expect(() => transitionEvidenceCaseStatus(
      state,
      'CASE-004',
      'closed',
      '',
    )).toThrow('requiere una nota')
  })

  it('exports binder metadata without embedding binary files', () => {
    const state = appendEvidenceCase(
      emptyEvidenceCaseState,
      draft,
      '2026-09-25T03:20:00.000Z',
      'CASE-005',
    )

    const exported = buildEvidenceCaseExport(state)
    expect(exported.format).toBe('orbi-pos-evidence-case-binder-export/v1')
    expect(exported.safety.includesBinaryFiles).toBe(false)
  })
})
