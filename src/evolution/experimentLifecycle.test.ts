import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import type { Experiment } from './domain'
import { selectReleaseLineage } from './data/selectors'
import { validateEvolutionState } from './data/validation'
import { evolutionReducer, type EvolutionAction } from './store'

const meta = { actor: '实验测试员', reason: '实验生命周期测试', at: '2026-09-28T16:00:00.000Z' }
const draftExperiment = (state = createInitialEvolutionData(), patch: Partial<Experiment> = {}): Experiment => {
  const variant = state.variants.find((item) => item.id === 'variant-reason-office-plan')!
  const repeatRule = state.rules.find((item) => item.id === 'rule-repeat-count')!
  const datasetIds = ['dataset-attribution', 'dataset-generalization', 'dataset-regression']
  return {
    id: 'exp-lifecycle-test', name: '完整配置单变体实验', level: 'SINGLE_VARIANT', variantIds: [variant.id], windowId: 'window-2026w36', datasetIds,
    configSnapshot: { datasetVersions: state.datasets.filter((item) => datasetIds.includes(item.id)).map(({ id, version, sampleCount }) => ({ datasetId: id, version, versionId: `${id}@${version}`, sampleCount })), model: 'gpt-5.3-eval', toolPermissions: ['slides.render'], timeoutMs: 90000, repeatCount: Number(repeatRule.value), runEnvironment: 'Staging', createdAt: meta.at },
    runIds: [], baselineVersion: variant.currentVersion, candidateVersion: variant.candidateVersion, metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'DRAFT', createdAt: meta.at, updatedAt: meta.at, ...patch
  }
}

describe('experiment lifecycle, snapshots, and release lineage', () => {
  it('keeps the existing repeat snapshot after the repeat rule changes and lets only new configs consume five', () => {
    const state = createInitialEvolutionData()
    const existing = state.experiments.find((item) => item.id === 'exp-single-memory-latest')!
    const updated = evolutionReducer(state, { type: 'UPDATE_RULE', ruleId: 'rule-repeat-count', patch: { value: 5, status: 'CONFIGURED' }, meta })
    const created = evolutionReducer(updated, { type: 'CREATE_EXPERIMENT', experiment: draftExperiment(updated), meta })

    expect(existing.configSnapshot.repeatCount).toBe(3)
    expect(created.experiments.find((item) => item.id === existing.id)?.configSnapshot.repeatCount).toBe(3)
    expect(created.experiments.find((item) => item.id === 'exp-lifecycle-test')?.configSnapshot.repeatCount).toBe(5)
  })

  it('validates historical Dataset snapshots independently from later current metadata', () => {
    const state = createInitialEvolutionData()
    const historical = structuredClone(state.experiments.find((item) => item.id === 'exp-single-ppt-routing')!.configSnapshot.datasetVersions)
    const dataset = state.datasets.find((item) => item.id === 'dataset-attribution')!
    dataset.version = 'v2.0'
    dataset.caseIds = ['case-ppt-management', 'case-tool-export']
    dataset.sampleCount = 2
    dataset.population = { ...dataset.population, localCaseCount: 2, externalSampleCount: 0, totalSampleCount: 2 }

    expect(validateEvolutionState(state)).toEqual([])
    expect(state.experiments.find((item) => item.id === 'exp-single-ppt-routing')!.configSnapshot.datasetVersions).toEqual(historical)
  })

  it('ignores the removed immediate-run action and requires the observable lifecycle', () => {
    const state = createInitialEvolutionData()
    const before = structuredClone(state.experiments.find((item) => item.id === 'exp-single-memory-latest'))
    const deprecated = { type: 'RUN_EXPERIMENT', experimentId: before!.id, caseIds: ['case-ppt-management'], meta } as unknown as EvolutionAction

    const next = evolutionReducer(state, deprecated)

    expect(next).toBe(state)
    expect(next.experiments.find((item) => item.id === before!.id)).toEqual(before)
    expect(next.experimentRuns.some((item) => item.experimentId === before!.id)).toBe(false)
  })

  it('restricts Experiment updates to mutable descriptive fields and preserves frozen setup', () => {
    const state = createInitialEvolutionData()
    const experiment = state.experiments.find((item) => item.id === 'exp-single-memory-latest')!
    const frozen = structuredClone({ datasetIds: experiment.datasetIds, variantIds: experiment.variantIds, windowId: experiment.windowId, baselineVersion: experiment.baselineVersion, candidateVersion: experiment.candidateVersion, configSnapshot: experiment.configSnapshot, status: experiment.status })
    const maliciousPatch = { name: '更新后的实验名称', datasetIds: ['dataset-window-online'], variantIds: ['variant-tool-retry-v2'], windowId: 'window-2026w35', baselineVersion: 'tampered-baseline', candidateVersion: 'tampered-candidate', configSnapshot: { ...experiment.configSnapshot, repeatCount: 99 }, status: 'COMPLETED' }

    const next = evolutionReducer(state, { type: 'UPDATE_EXPERIMENT', experimentId: experiment.id, patch: maliciousPatch as never, meta })
    const after = next.experiments.find((item) => item.id === experiment.id)!

    expect(after.name).toBe('更新后的实验名称')
    expect({ datasetIds: after.datasetIds, variantIds: after.variantIds, windowId: after.windowId, baselineVersion: after.baselineVersion, candidateVersion: after.candidateVersion, configSnapshot: after.configSnapshot, status: after.status }).toEqual(frozen)
  })

  it('stores configured and pending monitoring baseline rules without inventing values', () => {
    const state = createInitialEvolutionData()
    const baselineRules = ['rule-monitor-latency-baseline', 'rule-monitor-ttft-baseline', 'rule-monitor-cost-baseline'].map((id) => state.rules.find((item) => item.id === id)!)
    baselineRules.forEach((rule) => { expect(rule).toMatchObject({ category: 'MONITORING', status: 'PENDING' }); expect(rule.value).toBeUndefined() })
  })

  it('rejects an Experiment whose selected datasets are editable or whose snapshot does not exactly match them', () => {
    const state = createInitialEvolutionData()
    state.datasets.find((item) => item.id === 'dataset-attribution')!.frozen = false
    const editableAttempt = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: draftExperiment(state), meta })
    expect(editableAttempt).toBe(state)

    const healthy = createInitialEvolutionData()
    const wrongVersion = draftExperiment(healthy)
    wrongVersion.configSnapshot.datasetVersions[0].version = 'wrong-version'
    expect(evolutionReducer(healthy, { type: 'CREATE_EXPERIMENT', experiment: wrongVersion, meta })).toBe(healthy)
  })

  it('creates an exact selected-Window combination only when every declared member has a passing single report', () => {
    const state = createInitialEvolutionData()
    const valid = draftExperiment(state, {
      id: 'exp-window-exact', level: 'WINDOW_COMBINATION', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'],
      datasetIds: ['dataset-window-online', 'dataset-generalization'],
      configSnapshot: { ...draftExperiment(state).configSnapshot, datasetVersions: state.datasets.filter((item) => ['dataset-window-online', 'dataset-generalization'].includes(item.id)).map(({ id, version, sampleCount }) => ({ datasetId: id, version, versionId: `${id}@${version}`, sampleCount })) },
      baselineVersion: 'agent-2.5.0', candidateVersion: 'agent-window-candidate'
    })
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: valid, meta })
    expect(created.experiments.find((item) => item.id === valid.id)?.variantIds).toEqual(['variant-ppt-routing-v3', 'variant-tool-retry-v2'])

    const mismatch = { ...valid, id: 'exp-window-mismatch', variantIds: ['variant-ppt-routing-v3'] }
    expect(evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: mismatch, meta })).toBe(state)
    const missingPass = { ...valid, id: 'exp-window-unpassed', windowId: 'window-2026w36', variantIds: ['variant-memory-latest', 'variant-reason-office-plan'] }
    expect(evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: missingPass, meta })).toBe(state)
  })

  it('moves queued runs through RUNNING and COMPLETED while preserving one paired config hash', () => {
    const state = createInitialEvolutionData()
    const experiment = draftExperiment(state, { status: 'QUEUED' })
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment, meta })
    const running = evolutionReducer(created, { type: 'START_EXPERIMENT_RUN', experimentId: experiment.id, caseIds: ['case-ppt-management'], meta: { ...meta, auditId: 'audit-start' } })
    const runningRuns = running.experimentRuns.filter((item) => item.experimentId === experiment.id)

    expect(running.experiments.find((item) => item.id === experiment.id)?.status).toBe('RUNNING')
    expect(runningRuns).toHaveLength(6)
    expect(runningRuns.every((item) => item.status === 'RUNNING')).toBe(true)
    expect(new Set(runningRuns.map((item) => item.configHash))).toHaveLength(1)
    expect(evolutionReducer(running, { type: 'START_EXPERIMENT_RUN', experimentId: experiment.id, caseIds: ['case-ppt-management'], meta })).toBe(running)

    const completed = evolutionReducer(running, { type: 'COMPLETE_EXPERIMENT_RUN', experimentId: experiment.id, meta: { ...meta, auditId: 'audit-complete' } })
    expect(completed.experiments.find((item) => item.id === experiment.id)?.status).toBe('COMPLETED')
    expect(completed.experimentRuns.filter((item) => item.experimentId === experiment.id).every((item) => item.status === 'COMPLETED')).toBe(true)
    expect(completed.experiments.find((item) => item.id === experiment.id)?.metrics.map((item) => item.category)).toEqual(['LOCAL', 'END_TO_END', 'GENERALIZATION'])
    expect(validateEvolutionState(completed)).toEqual([])
  })

  it('records a FAILED lifecycle and retries safely without duplicate run IDs', () => {
    const state = createInitialEvolutionData(); const experiment = draftExperiment(state, { status: 'QUEUED' })
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment, meta })
    const running = evolutionReducer(created, { type: 'START_EXPERIMENT_RUN', experimentId: experiment.id, caseIds: ['case-ppt-management'], meta })
    const failed = evolutionReducer(running, { type: 'FAIL_EXPERIMENT_RUN', experimentId: experiment.id, error: 'Mock runner timeout', meta })
    expect(failed.experiments.find((item) => item.id === experiment.id)?.status).toBe('FAILED')
    expect(failed.experimentRuns.filter((item) => item.experimentId === experiment.id).every((item) => item.status === 'FAILED' && item.error === 'Mock runner timeout')).toBe(true)

    const retried = evolutionReducer(failed, { type: 'START_EXPERIMENT_RUN', experimentId: experiment.id, caseIds: ['case-ppt-management'], retry: true, meta })
    const retryRuns = retried.experimentRuns.filter((item) => item.experimentId === experiment.id)
    expect(retried.experiments.find((item) => item.id === experiment.id)?.status).toBe('RUNNING')
    expect(retryRuns).toHaveLength(6)
    expect(new Set(retryRuns.map((item) => item.id)).size).toBe(6)
  })

  it('resolves exact Window, source single reports, Gate, Issues, Clusters, and Cases for a release', () => {
    const state = createInitialEvolutionData(); const lineage = selectReleaseLineage(state, 'release-agent-3-0-0')!
    expect(lineage.window?.id).toBe('window-2026w35')
    expect(lineage.combinationExperiment?.id).toBe('exp-window-2026w35')
    expect(lineage.singleExperiments.map((item) => item.id)).toEqual(['exp-single-ppt-routing', 'exp-single-tool-retry'])
    expect(lineage.gateDecision?.id).toBe('gate-window-2026w35')
    expect(lineage.variants.map((item) => item.id)).toEqual(['variant-ppt-routing-v3', 'variant-tool-retry-v2'])
    expect(lineage.clusters.map((item) => item.id)).toContain('cluster-ppt-routing-ready')
    expect(lineage.cases.map((item) => item.id)).toEqual(expect.arrayContaining(['case-ppt-management', 'case-tool-export']))
  })

  it('reports exact Release Window/report mismatches with authoritative paths', () => {
    const state = createInitialEvolutionData()
    state.releases.find((item) => item.id === 'release-agent-3-0-0')!.windowId = 'window-2026w36'
    const paths = validateEvolutionState(state).map((item) => item.path)
    expect(paths).toContain('releases.release-agent-3-0-0.combinationExperimentId')
    expect(paths).toContain('releases.release-agent-3-0-0.windowId')
  })
})
