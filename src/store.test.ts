import { describe, expect, it } from 'vitest'
import { initialState, reducer } from './store'

describe('QualityStore reducer', () => {
  it('keeps automatic eval and applies an auditable human override', () => {
    const task = initialState.tasks[0]
    const evaluation = task.evals[0]
    const next = reducer(initialState, { type: 'OVERRIDE_EVAL', taskId: task.id, evalId: evaluation.id, status: 'PASS', reason: 'Human evidence supports the result.', by: 'Reviewer' })
    const updated = next.tasks[0].evals[0]
    expect(updated.autoStatus).toBe(evaluation.autoStatus)
    expect(updated.humanStatus).toBe('PASS')
    expect(updated.humanBy).toBe('Reviewer')
    expect(next.cases.find((record) => record.taskId === task.id)?.humanStatus).toBe('PASS')
  })

  it('updates case governance fields without replacing unrelated records', () => {
    const record = initialState.cases[0]
    const next = reducer(initialState, { type: 'UPDATE_CASE', caseId: record.id, patch: { status: 'Resolved', owner: 'Infra', note: 'Resolved in the demo.' } })
    expect(next.cases.find((candidate) => candidate.id === record.id)).toMatchObject({ status: 'Resolved', owner: 'Infra', note: 'Resolved in the demo.' })
    expect(next.cases.length).toBe(initialState.cases.length)
  })

  it('toggles dataset entries and creates deterministic benchmark runs', () => {
    const dataset = initialState.datasets[0]
    const entry = dataset.entries[0]
    const toggled = reducer(initialState, { type: 'TOGGLE_DATASET_ENTRY', datasetId: dataset.id, entryId: entry.id, enabled: false })
    expect(toggled.datasets[0].entries[0].enabled).toBe(false)
    const runState = reducer(initialState, { type: 'CREATE_BENCHMARK', input: { id: 'benchmark-test', datasetId: dataset.id, versionA: 'agent-2.4.0', versionB: 'agent-2.5.0', environment: 'Staging', rubricVersion: 'rubric-2026.08' } })
    expect(runState.benchmarks[0].id).toBe('benchmark-test')
    expect(runState.benchmarks[0].status).toBe('Completed')
    expect(runState.benchmarks[0].metrics.length).toBeGreaterThanOrEqual(5)
  })
})
