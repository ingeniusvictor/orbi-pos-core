import { describe, expect, it } from 'vitest'
import {
  completeMigrationRunbook,
  completeRollback,
  createEmptyMigrationRunbook,
  evaluateMigrationRunbook,
  runbookSteps,
  setGoNoGoDecision,
  startMigrationRunbook,
  updateMigrationStep,
} from './migration-runbook'

function scheduledRunbook() {
  return {
    ...createEmptyMigrationRunbook(),
    scheduledDate: '2026-10-10',
    windowStart: '19:00',
    windowEnd: '21:00',
    leadOperator: 'Responsable piloto',
  }
}

function passPhase(
  state: ReturnType<typeof createEmptyMigrationRunbook>,
  phase: 'preparation' | 'preflight' | 'controlled-pilot' | 'stabilization' | 'closeout' | 'rollback',
) {
  let next = state
  for (const step of runbookSteps.filter((item) => item.phase === phase && item.critical)) {
    next = updateMigrationStep(
      'approval-recorded',
      next,
      step.id,
      'passed',
      'Evidencia controlada registrada',
      '2026-10-10T22:00:00.000Z',
    )
  }
  return next
}

describe('controlled migration runbook', () => {
  it('can be prepared but cannot start before OC-24 approval-recorded', () => {
    const state = scheduledRunbook()
    const evaluation = evaluateMigrationRunbook('ready-for-owner-decision', state)

    expect(evaluation.canStart).toBe(false)
    expect(() => startMigrationRunbook('ready-for-owner-decision', state))
      .toThrow('cannot start')
  })

  it('requires scheduling metadata before starting an approved migration runbook', () => {
    const state = createEmptyMigrationRunbook()

    expect(evaluateMigrationRunbook('approval-recorded', state).canStart).toBe(false)
  })

  it('does not permit GO until critical preparation and preflight checks pass', () => {
    let state = startMigrationRunbook(
      'approval-recorded',
      scheduledRunbook(),
      '2026-10-10T21:00:00.000Z',
    )

    expect(() => setGoNoGoDecision('approval-recorded', state, 'go'))
      .toThrow('critical preparation and preflight')

    state = passPhase(state, 'preparation')
    state = passPhase(state, 'preflight')

    expect(evaluateMigrationRunbook('approval-recorded', state).canSelectGo).toBe(true)
    expect(setGoNoGoDecision('approval-recorded', state, 'go').decision).toBe('go')
  })

  it('forces rollback-required when a critical active step fails', () => {
    let state = startMigrationRunbook('approval-recorded', scheduledRunbook())
    state = passPhase(state, 'preparation')
    state = passPhase(state, 'preflight')
    state = setGoNoGoDecision('approval-recorded', state, 'go')

    state = updateMigrationStep(
      'approval-recorded',
      state,
      'pilot-point-payment',
      'failed',
      'Point no confirmó processed',
    )

    expect(state.executionState).toBe('rollback-required')
    expect(evaluateMigrationRunbook('approval-recorded', state).rollbackRequired).toBe(true)
  })

  it('requires evidence notes for passed or failed steps', () => {
    const state = startMigrationRunbook('approval-recorded', scheduledRunbook())

    expect(() => updateMigrationStep(
      'approval-recorded',
      state,
      'safe-current-flow-available',
      'passed',
      '',
    )).toThrow('evidence note')
  })

  it('completes only after GO and every critical normal-flow verification passes', () => {
    let state = startMigrationRunbook('approval-recorded', scheduledRunbook())
    state = passPhase(state, 'preparation')
    state = passPhase(state, 'preflight')
    state = setGoNoGoDecision('approval-recorded', state, 'go')
    state = passPhase(state, 'controlled-pilot')
    state = passPhase(state, 'stabilization')
    state = passPhase(state, 'closeout')

    const completed = completeMigrationRunbook(
      'approval-recorded',
      state,
      '2026-10-10T23:30:00.000Z',
    )

    expect(completed.executionState).toBe('completed')
    expect(completed.completedAt).toBe('2026-10-10T23:30:00.000Z')
  })

  it('requires every rollback step before rollback can close', () => {
    let state = startMigrationRunbook('approval-recorded', scheduledRunbook())
    state = updateMigrationStep(
      'approval-recorded',
      state,
      'safe-current-flow-available',
      'failed',
      'Flujo seguro no disponible durante precheck',
    )

    expect(() => completeRollback('approval-recorded', state))
      .toThrow('every critical recovery step')

    state = passPhase(state, 'rollback')
    expect(completeRollback('approval-recorded', state).executionState).toBe('rolled-back')
  })
})
