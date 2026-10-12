import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import type { Experiment } from './domain'
import { evolutionReducer } from './store'

const meta = { actor: '快照测试员', reason: '验证实验上下文冻结', at: '2026-09-30T10:00:00.000Z' }

const experimentFor = (state: ReturnType<typeof createInitialEvolutionData>): Experiment => {
  const datasetIds = ['dataset-attribution', 'dataset-generalization', 'dataset-regression']
  const variant = state.variants.find((item) => item.id === 'variant-reason-office-plan')!
  return {
    id: 'exp-freeze-context-test', name: '冻结评测上下文测试', level: 'SINGLE_VARIANT', variantIds: [variant.id], windowId: 'window-2026w36', datasetIds,
    configSnapshot: {
      datasetVersions: state.datasets.filter((item) => datasetIds.includes(item.id)).map(({ id, version, sampleCount }) => ({ datasetId: id, version, versionId: `${id}@${version}`, sampleCount })),
      model: 'gpt-5.3-eval', toolPermissions: ['slides.render'], timeoutMs: 90000, repeatCount: 2, runEnvironment: 'Staging',
      evalAgentVersion: 'eval-agent-test', rubricVersion: 'rubric-test', createdAt: meta.at
    },
    runIds: [], baselineVersion: variant.currentVersion, candidateVersion: variant.candidateVersion, metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'QUEUED', createdAt: meta.at, updatedAt: meta.at
  }
}

describe('V2 experiment context snapshots', () => {
  it('freezes evaluation, artifact, evidence and trace-package IDs when an experiment is created', () => {
    const state = createInitialEvolutionData()
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: experimentFor(state), meta })
    const experiment = created.experiments.find((item) => item.id === 'exp-freeze-context-test')!

    expect(experiment.configSnapshot.evalAgentVersion).toBe('eval-agent-test')
    expect(experiment.configSnapshot.rubricVersion).toBe('rubric-test')
    expect(experiment.configSnapshot.artifactIds?.length).toBeGreaterThan(0)
    expect(experiment.configSnapshot.evidenceBundleIds?.length).toBeGreaterThan(0)
    expect(experiment.configSnapshot.tracePackageIds?.length).toBeGreaterThan(0)
    expect(experiment.configSnapshot.datasetVersions.every((entry) => entry.caseIds?.length)).toBe(true)
  })

  it('starts runs from frozen dataset membership and copies the full evaluation snapshot to every arm', () => {
    const state = createInitialEvolutionData()
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: experimentFor(state), meta })
    const frozenCases = created.experiments.find((item) => item.id === 'exp-freeze-context-test')!.configSnapshot.datasetVersions.flatMap((entry) => entry.caseIds ?? [])
    const dataset = created.datasets.find((item) => item.id === 'dataset-attribution')!
    dataset.caseIds = []
    dataset.sampleCount = 0
    dataset.population = { ...dataset.population, totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0 }

    const running = evolutionReducer(created, { type: 'START_EXPERIMENT_RUN', experimentId: 'exp-freeze-context-test', meta })
    const runs = running.experimentRuns.filter((run) => run.experimentId === 'exp-freeze-context-test')
    const experiment = running.experiments.find((item) => item.id === 'exp-freeze-context-test')!

    expect(new Set(runs.map((run) => run.caseId))).toEqual(new Set(frozenCases))
    expect(runs).not.toHaveLength(0)
    expect(runs.every((run) => run.evalSnapshot?.evalAgentVersion === 'eval-agent-test')).toBe(true)
    expect(runs.every((run) => run.evalSnapshot?.rubricVersion === 'rubric-test')).toBe(true)
    expect(runs.every((run) => JSON.stringify(run.evalSnapshot?.artifactIds) === JSON.stringify(experiment.configSnapshot.artifactIds))).toBe(true)
    expect(runs.every((run) => JSON.stringify(run.evalSnapshot?.evidenceBundleIds) === JSON.stringify(experiment.configSnapshot.evidenceBundleIds))).toBe(true)
    expect(runs.every((run) => JSON.stringify(run.evalSnapshot?.tracePackageIds) === JSON.stringify(experiment.configSnapshot.tracePackageIds))).toBe(true)
  })

  it('preserves Judge Reason, Rubric, root evidence and artifact content after later source edits', () => {
    const state = createInitialEvolutionData()
    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment: experimentFor(state), meta })
    const sourcePackage = created.tracePackages.find((item) => item.traceId === 'trace-ppt-generate')!
    const sourceScore = sourcePackage.moduleScores.find((item) => item.moduleCode === 'SKILL')!
    const beforeReason = sourceScore.judgeReason
    const beforeRubric = sourceScore.evidence.rubricRule
    const beforeEvidence = created.evidence.find((item) => item.id === 'evidence-ppt-recall')!.content
    const beforeArtifact = created.artifacts.find((item) => item.id === 'artifact-ppt-management')!.name

    const revised = evolutionReducer(created, { type: 'UPDATE_MODULE_EVALUATION', packageId: sourcePackage.id, scoreId: sourceScore.id, patch: { humanStatus: 'PASS', humanScore: 0.93, humanNote: '之后的人工修订' }, meta })
    revised.tracePackages.find((item) => item.id === sourcePackage.id)!.moduleScores.find((item) => item.id === sourceScore.id)!.judgeReason = '新评测结论'
    revised.tracePackages.find((item) => item.id === sourcePackage.id)!.moduleScores.find((item) => item.id === sourceScore.id)!.evidence.rubricRule = 'new-rubric'
    revised.evidence.find((item) => item.id === 'evidence-ppt-recall')!.content = '更新后的根证据'
    revised.artifacts.find((item) => item.id === 'artifact-ppt-management')!.name = '新的产物名称'

    const running = evolutionReducer(revised, { type: 'START_EXPERIMENT_RUN', experimentId: 'exp-freeze-context-test', caseIds: ['case-ppt-management'], meta })
    const run = running.experimentRuns.find((item) => item.experimentId === 'exp-freeze-context-test')!

    expect(run.evalSnapshot?.moduleEvaluations.find((item) => item.id === sourceScore.id)?.judgeReason).toBe(beforeReason)
    expect(run.evalSnapshot?.moduleEvaluations.find((item) => item.id === sourceScore.id)?.evidence.rubricRule).toBe(beforeRubric)
    expect(run.evalSnapshot?.rootEvidence.find((item) => item.id === 'evidence-ppt-recall')?.content).toBe(beforeEvidence)
    expect(run.evalSnapshot?.artifacts.find((item) => item.id === 'artifact-ppt-management')?.name).toBe(beforeArtifact)
    expect(run.configSnapshot?.repeatCount).toBe(2)
    expect(run.configSnapshot?.model).toBe('gpt-5.3-eval')
  })

  it('keeps seed experiment runs and Gate reports auditable instead of empty V2 ID placeholders', () => {
    const state = createInitialEvolutionData()
    const run = state.experimentRuns.find((item) => item.experimentId === 'exp-window-2026w35')!
    const reportRun = state.gateDecisions.find((item) => item.id === 'gate-window-2026w35')!.reportSnapshot.runSnapshots![0]

    expect(run.evalSnapshot?.tracePackageIds).toContain('package-trace-ppt-generate')
    expect(run.evalSnapshot?.artifactIds).toContain('artifact-ppt-management')
    expect(run.evalSnapshot?.evidenceBundleIds.length).toBeGreaterThan(0)
    expect(run.evalSnapshot?.moduleEvaluations.some((item) => item.evidence.rootEvidenceIds.includes('evidence-ppt-recall'))).toBe(true)
    expect(run.windowSnapshot).toMatchObject({ windowId: 'window-2026w35', cutoffAt: '2026-09-26T14:00:00.000Z', frozenAt: '2026-09-25T12:00:00.000Z' })
    expect(reportRun.evalSnapshot).toEqual(run.evalSnapshot)
    expect(reportRun.windowSnapshot).toEqual(run.windowSnapshot)
  })
})
