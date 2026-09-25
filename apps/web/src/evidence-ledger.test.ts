import { describe, expect, it } from 'vitest'
import {
  appendEvidenceEntry,
  buildEvidenceLedgerExport,
  emptyEvidenceDraft,
  emptyEvidenceLedger,
  evidenceLedgerStats,
  findPotentialSensitivePatterns,
  transitionEvidenceStatus,
} from './evidence-ledger'

const draft = {
  ...emptyEvidenceDraft,
  occurredAt: '2026-09-25T10:00',
  type: 'incident' as const,
  system: 'sii' as const,
  severity: 'critical' as const,
  title: 'Boleta no verificada en prueba',
  summary: 'La prueba fiscal quedó pendiente de verificación antes de continuar.',
  actor: 'Operador piloto',
  evidenceReference: 'captura-sii-001.png',
  sourceContext: 'OC-25 Preflight',
}

describe('pilot evidence ledger', () => {
  it('appends immutable evidence entries with creation history', () => {
    const state = appendEvidenceEntry(
      emptyEvidenceLedger,
      draft,
      '2026-09-25T13:00:00.000Z',
      'EVD-TEST-001',
    )

    expect(state.entries).toHaveLength(1)
    expect(state.entries[0].id).toBe('EVD-TEST-001')
    expect(state.entries[0].history).toHaveLength(1)
    expect(state.entries[0].history[0].action).toBe('created')
  })

  it('records audited status transitions instead of replacing history', () => {
    const created = appendEvidenceEntry(
      emptyEvidenceLedger,
      draft,
      '2026-09-25T13:00:00.000Z',
      'EVD-TEST-002',
    )

    const resolved = transitionEvidenceStatus(
      created,
      'EVD-TEST-002',
      'resolved',
      'Proveedor confirmó recepción y se adjuntó referencia segura',
      '2026-09-25T14:00:00.000Z',
    )

    expect(resolved.entries[0].status).toBe('resolved')
    expect(resolved.entries[0].history).toHaveLength(2)
    expect(resolved.entries[0].history[1].fromStatus).toBe('open')
    expect(resolved.entries[0].history[1].toStatus).toBe('resolved')
  })

  it('counts critical open evidence and incidents separately', () => {
    let state = appendEvidenceEntry(
      emptyEvidenceLedger,
      draft,
      '2026-09-25T13:00:00.000Z',
      'EVD-INC-1',
    )

    state = appendEvidenceEntry(
      state,
      {
        ...draft,
        type: 'decision',
        severity: 'info',
        title: 'Decisión de mantener flujo actual',
        summary: 'Se mantiene el flujo anterior hasta cerrar la investigación.',
        status: 'verified',
      },
      '2026-09-25T13:05:00.000Z',
      'EVD-DEC-1',
    )

    const stats = evidenceLedgerStats(state)

    expect(stats.openIncidents).toBe(1)
    expect(stats.criticalOpen).toBe(1)
    expect(stats.verifiedEntries).toBe(1)
    expect(stats.decisions).toBe(1)
  })

  it('blocks obvious credentials and possible card-number patterns', () => {
    expect(findPotentialSensitivePatterns('access_token=ABCDEF1234567890'))
      .toContain('access token')
    expect(findPotentialSensitivePatterns('4111 1111 1111 1111'))
      .toContain('posible número de tarjeta')

    expect(() => appendEvidenceEntry(
      emptyEvidenceLedger,
      {
        ...draft,
        summary: 'password=SuperSecret123',
      },
    )).toThrow('Posible dato sensible')
  })

  it('requires evidence notes for status transitions', () => {
    const created = appendEvidenceEntry(
      emptyEvidenceLedger,
      draft,
      '2026-09-25T13:00:00.000Z',
      'EVD-TEST-003',
    )

    expect(() => transitionEvidenceStatus(
      created,
      'EVD-TEST-003',
      'verified',
      '',
    )).toThrow('nota de evidencia')
  })

  it('exports only ledger content and explicit safety metadata', () => {
    const state = appendEvidenceEntry(
      emptyEvidenceLedger,
      draft,
      '2026-09-25T13:00:00.000Z',
      'EVD-TEST-004',
    )

    const exported = buildEvidenceLedgerExport(
      state,
      '2026-09-25T15:00:00.000Z',
    )

    expect(exported.format).toBe('orbi-pos-evidence-ledger-export/v1')
    expect(exported.entries).toHaveLength(1)
    expect(exported.safety.performsExternalActions).toBe(false)
  })
})
