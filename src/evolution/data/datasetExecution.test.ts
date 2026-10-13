import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetExecutionRun, DatasetQueryRecord, EvolutionState } from '../domain'
import { createInitialEvolutionData } from '../data'
import { createDatasetExecutionRun, materializeDatasetExecutionItem, selectDatasetExecutionInputs, validateDatasetQueryInput } from './datasetExecution'
import { validateEvolutionState } from './validation'

const at = '2026-10-13T04:00:00.000Z'
function fixture(queryCount = 1): EvolutionState {
  const state = createInitialEvolutionData()
  const dataset: Dataset = { id: 'dataset-manual-query-test', name: '人工新增任务测试集', description: 'Mock 手动测试', type: 'REGRESSION', version: 'v1', caseIds: [], sampleCount: 0, source: '本地用户', scope: '自定义数据集', frozen: false, population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock', countingRule: '输入 Trace 与人工 Query 分开统计' }, datasetCategory: 'PERSONAL', datasetOrigin: 'USER_CUSTOM', ownerScope: 'USER', purpose: '自定义数据集', createdAt: at, updatedAt: at }
  state.datasets.push(dataset)
  state.datasetQueries = Array.from({ length: queryCount }, (_, index): DatasetQueryRecord => ({ id: `query-manual-test-${index}`, datasetId: dataset.id, datasetVersion: dataset.version, query: index ? '把季度业绩整理成 Word，列出行动项。' : '制作管理层经营 PPT，结论先行。', verticalScenario: index ? 'Word' : 'PPT', status: 'PENDING', createdBy: '测试用户', createdAt: at, updatedAt: at }))
  return state
}
const createRun = (state: EvolutionState, options: Partial<Parameters<typeof createDatasetExecutionRun>[1]> = {}) => createDatasetExecutionRun(state, { id: 'dataset-run-test-1', datasetId: 'dataset-manual-query-test', mode: 'GENERATE_AND_EVALUATE', scope: 'ALL', actor: '测试用户', at, ...options })
function applyItem(state: EvolutionState, run: DatasetExecutionRun, index: number, completedAt = at) {
  const result = materializeDatasetExecutionItem(state, run, run.items[index], completedAt)
  const nextRun = { ...run, items: run.items.map(item => item.id === result.item.id ? result.item : item) }
  const nextState = { ...state, ...result.graph, datasetExecutionRuns: [...(state.datasetExecutionRuns ?? []).filter(item => item.id !== run.id), nextRun] }
  return { state: nextState, run: nextRun, item: result.item, graph: result.graph }
}
function withTraceInput(state: EvolutionState, unavailableArtifact = false) {
  const source = state.traces.find(trace => trace.artifactIds.length && trace.observationIds.length && state.artifacts.some(artifact => trace.artifactIds.includes(artifact.id) && artifact.status === 'AVAILABLE'))!
  const dataset = state.datasets.find(item => item.id === 'dataset-manual-query-test')!
  dataset.caseIds = [source.caseId]
  dataset.sampleCount = 1
  dataset.population = { ...dataset.population, totalSampleCount: 1, localCaseCount: 1 }
  state.datasetMemberships = [...(state.datasetMemberships ?? []), { id: 'membership-manual-query-test', datasetId: dataset.id, datasetVersion: dataset.version, caseId: source.caseId, traceIds: [source.id], scope: 'TRACE', joinedAt: at, actor: '测试用户', origin: 'LOCAL' }]
  if (unavailableArtifact) state.artifacts = state.artifacts.map(artifact => source.artifactIds.includes(artifact.id) ? { ...artifact, status: 'MISSING' } : artifact)
  return source
}

describe('dataset execution input and immutable result contract', () => {
  it('validates manual inputs and blocks frozen or system dataset writes', () => {
    const state = fixture()
    const input = { datasetId: 'dataset-manual-query-test', query: '创建预算表', verticalScenario: 'Excel' as const }
    expect(() => validateDatasetQueryInput(state, input)).not.toThrow()
    expect(() => validateDatasetQueryInput(state, { ...input, query: '   ' })).toThrow('任务内容')
    const dataset = state.datasets.find(item => item.id === input.datasetId)!
    dataset.datasetOrigin = 'SYSTEM'
    expect(() => validateDatasetQueryInput(state, input)).not.toThrow() // a user-owned personal set
    dataset.ownerScope = 'SYSTEM'
    expect(() => validateDatasetQueryInput(state, input)).toThrow('自定义数据集')
    dataset.datasetOrigin = 'USER_CUSTOM'
    dataset.frozen = true
    expect(() => validateDatasetQueryInput(state, input)).toThrow('冻结')
    expect(() => createRun(state)).not.toThrow() // freeze locks membership, not execution
  })

  it('selects exact Trace membership and manual Query inputs without materializing external totals', () => {
    const state = fixture()
    const source = withTraceInput(state)
    const dataset = state.datasets.find(item => item.id === 'dataset-manual-query-test')!
    dataset.sampleCount = 501
    dataset.population.totalSampleCount = 501
    dataset.population.externalSampleCount = 500
    const inputs = selectDatasetExecutionInputs(state, dataset.id, 'GENERATE_AND_EVALUATE', 'ALL')
    expect(inputs).toHaveLength(2)
    expect(inputs.map(input => input.sourceTraceId).filter(Boolean)).toEqual([source.id])
    expect(selectDatasetExecutionInputs(state, dataset.id, 'EVALUATE_ONLY', 'ALL')).toHaveLength(1)
    dataset.caseIds = []
    state.datasetQueries = []
    expect(selectDatasetExecutionInputs(state, dataset.id)).toEqual([])
    expect(() => createRun(state)).toThrow('外部统计样本')
  })

  it('captures independently cloned dataset membership, inputs and a fixed asset version', () => {
    const state = fixture()
    const asset = state.assetCatalog!.find(item => item.skillId === 'skill-ppt-builder')!
    const version = state.assetVersions!.find(item => item.assetId === asset.id)!
    const originalVersion = version.version
    const run = createRun(state, { assetId: asset.id, assetVersionId: version.id })
    expect(run.configSnapshot.inputs[0]).toMatchObject({ assetId: asset.id, assetVersionId: version.id, skillId: asset.skillId, skillVersion: version.version })
    state.datasets.find(item => item.id === run.datasetId)!.name = '以后改名'
    state.datasetQueries![0].query = '以后改内容'
    state.assetVersions!.find(item => item.id === version.id)!.version = '后来修改版本'
    expect(run.configSnapshot.datasetSnapshot.name).toBe('人工新增任务测试集')
    expect(run.configSnapshot.inputs[0].query).toBe('制作管理层经营 PPT，结论先行。')
    expect(run.configSnapshot.inputs[0].skillVersion).toBe(originalVersion)
    run.items[0].input.query = '执行项对象变化'
    expect(run.configSnapshot.inputs[0].query).toBe('制作管理层经营 PPT，结论先行。')
    expect(() => createRun(state, { assetVersionId: version.id })).toThrow('先选择资产')
  })

  it('generates a valid linked Session / Case / Trace / HTML Artifact and numeric module/dimension assessments', () => {
    const state = fixture()
    const oldDataset = structuredClone(state.datasets.find(item => item.id === 'dataset-manual-query-test'))
    const run = createRun(state)
    const result = applyItem(state, run, 0)
    expect(result.item.status).toBe('COMPLETED')
    expect(result.item.traceId).toMatch(/^\d{22}$/)
    expect(result.item.sessionId).toMatch(/^\d{22}$/)
    expect(result.item.sessionId).not.toBe(result.item.traceId)
    expect(result.state.cases.find(item => item.id === result.item.caseId)).toMatchObject({ sourceType: 'MOCK_SET', environment: 'Staging', traceIds: [result.item.traceId] })
    const artifact = result.state.artifacts.find(item => result.item.artifactIds.includes(item.id))!
    expect(artifact.name).toMatch(/Mock.*html/)
    expect(artifact.uri).toMatch(/^data:text\/html;charset=utf-8,/)
    expect(decodeURIComponent(artifact.uri)).toContain('非真实 Office 文件')
    const snapshot = result.item.resultSnapshot!
    expect(snapshot.moduleScores.filter(item => item.moduleCode !== 'CONTEXT')).toHaveLength(4)
    expect(snapshot.moduleScores.find(item => item.moduleCode === 'CONTEXT')?.automaticStatus).toBe('N/A')
    expect(snapshot.moduleScores.find(item => item.moduleCode === 'CONTEXT')?.score).toBeUndefined()
    for (const item of [...snapshot.processEvals, ...snapshot.outcomeEvals]) {
      expect(item.score).toBeGreaterThanOrEqual(0)
      expect(item.score).toBeLessThanOrEqual(2)
      expect(item.evidenceIds.length).toBeGreaterThan(0)
      expect(item.revisions[0].scoreScale).toBe('0-2')
    }
    expect(result.state.datasets.find(item => item.id === run.datasetId)).toEqual(oldDataset)
    expect(result.state.gateDecisions).toEqual(state.gateDecisions)
    expect(validateEvolutionState(result.state)).toEqual([])
  })

  it('replays an applied result idempotently without changing timestamps or snapshots', () => {
    const state = fixture()
    const run = createRun(state)
    const completed = applyItem(state, run, 0)
    const replay = materializeDatasetExecutionItem(completed.state, run, run.items[0], '2026-10-14T04:00:00.000Z')
    expect(replay.graph).toEqual({})
    expect(replay.item).toEqual(completed.item)
    const detached = { ...completed.state, datasetExecutionRuns: [] }
    const replayFromGraph = materializeDatasetExecutionItem(detached, run, run.items[0], '2026-10-14T04:00:00.000Z')
    expect(replayFromGraph.graph).toEqual({})
    expect(replayFromGraph.item.completedAt).toBe(completed.item.completedAt)
    expect(replayFromGraph.item.resultSnapshot).toEqual(completed.item.resultSnapshot)
  })

  it('reevaluates existing outputs additively and preserves execution, previous scores, and human reviews', () => {
    const state = fixture(0)
    const source = withTraceInput(state)
    const original = structuredClone({ traces: state.traces, sessions: state.sessions, artifacts: state.artifacts, processEvals: state.processEvals, outcomeEvals: state.outcomeEvals, packages: state.tracePackages, reviews: state.moduleReviews, dataset: state.datasets.find(item => item.id === 'dataset-manual-query-test') })
    const run = createRun(state, { mode: 'EVALUATE_ONLY' })
    const result = applyItem(state, run, 0)
    expect(result.item).toMatchObject({ status: 'COMPLETED', traceId: source.id, caseId: source.caseId, sessionId: source.sessionId })
    expect(result.state.traces).toEqual(original.traces)
    expect(result.state.sessions).toEqual(original.sessions)
    expect(result.state.artifacts).toEqual(original.artifacts)
    expect(result.state.cases).toHaveLength(state.cases.length)
    expect(result.state.moduleReviews).toEqual(original.reviews)
    expect(result.state.processEvals.slice(0, original.processEvals.length)).toEqual(original.processEvals)
    expect(result.state.outcomeEvals.slice(0, original.outcomeEvals.length)).toEqual(original.outcomeEvals)
    expect(result.state.tracePackages.slice(0, original.packages.length)).toEqual(original.packages)
    expect(result.state.datasets.find(item => item.id === run.datasetId)).toEqual(original.dataset)
    expect(validateEvolutionState(result.state)).toEqual([])
    const asset = state.assetCatalog![0]
    expect(() => createRun(state, { mode: 'EVALUATE_ONLY', assetId: asset.id })).toThrow('沿用来源资产版本')
  })

  it('reports absent artifacts as failed reevaluation without inventing a deliverable', () => {
    const state = fixture(0)
    const source = withTraceInput(state, true)
    const run = createRun(state, { mode: 'EVALUATE_ONLY' })
    const result = applyItem(state, run, 0)
    expect(result.item).toMatchObject({ status: 'FAILED', traceId: source.id, artifactIds: [], errorReason: expect.stringContaining('没有可用交付物') })
    expect(result.state.artifacts).toEqual(state.artifacts)
    expect(result.state.tracePackages).toEqual(state.tracePackages)
    expect(validateEvolutionState(result.state)).toEqual([])
  })

  it('retains successful items in a partial batch and never adds outputs into frozen source membership', () => {
    let state = fixture(2)
    state.datasets.find(item => item.id === 'dataset-manual-query-test')!.frozen = true
    const before = structuredClone(state.datasets)
    let run = createRun(state, { mockScenario: 'PARTIAL_FAILURE' })
    const success = applyItem(state, run, 0)
    state = success.state; run = success.run
    const snapshot = structuredClone(success.item.resultSnapshot)
    const failed = applyItem(state, run, 1)
    expect(failed.run.items.map(item => item.status)).toEqual(['COMPLETED', 'FAILED'])
    expect(failed.state.evaluationBatches.find(item => item.id === run.evaluationBatchId)).toMatchObject({ status: 'PARTIAL', stats: { inputTraceCount: 1, successCount: 1 } })
    expect(failed.run.items[0].resultSnapshot).toEqual(snapshot)
    expect(failed.state.datasets).toEqual(before)
    expect(selectDatasetExecutionInputs(failed.state, run.datasetId, run.mode, 'PENDING')).toHaveLength(1)
    expect(selectDatasetExecutionInputs(failed.state, run.datasetId, run.mode, 'ALL')).toHaveLength(2)
    expect(validateEvolutionState(failed.state)).toEqual([])
  })

  it('keeps every historical batch independent when a second generation runs the same source', () => {
    const state = fixture()
    const first = applyItem(state, createRun(state), 0)
    const history = structuredClone(first.run)
    const secondRun = createRun(first.state, { id: 'dataset-run-test-2', at: '2026-10-14T04:00:00.000Z' })
    const second = applyItem(first.state, secondRun, 0, '2026-10-14T04:00:00.000Z')
    expect(second.item.traceId).not.toBe(first.item.traceId)
    expect(second.item.packageId).not.toBe(first.item.packageId)
    expect(second.state.datasetExecutionRuns!.find(item => item.id === first.run.id)).toEqual(history)
    expect(second.state.datasets.find(item => item.id === first.run.datasetId)!.caseIds).toEqual([])
    expect(validateEvolutionState(second.state)).toEqual([])
  })

  it('reevaluates the latest successful output of an authored Query without promoting outputs to source members', () => {
    const state = fixture(2)
    expect(selectDatasetExecutionInputs(state, 'dataset-manual-query-test', 'EVALUATE_ONLY', 'ALL')).toEqual([])
    const generation = applyItem(state, createRun(state), 0)
    const query = generation.state.datasetQueries![0]
    query.latestRunId = 'a-later-evaluation-batch'
    query.status = 'FAILED' // status / latestRunId cannot replace generation lineage
    const inputs = selectDatasetExecutionInputs(generation.state, query.datasetId, 'EVALUATE_ONLY', 'ALL')
    expect(inputs).toHaveLength(1) // the other Query has no generated output
    expect(inputs[0]).toMatchObject({ id: `query:${query.id}`, sourceQueryId: query.id, sourceTraceId: generation.item.traceId, sourceCaseId: generation.item.caseId })
    const run = createRun(generation.state, { id: 'reevaluate-query-output', mode: 'EVALUATE_ONLY' })
    const evaluated = applyItem(generation.state, run, 0)
    expect(evaluated.item.status).toBe('COMPLETED')
    expect(evaluated.item.traceId).toBe(generation.item.traceId)
    expect(evaluated.state.traces).toEqual(generation.state.traces)
    expect(evaluated.state.artifacts).toEqual(generation.state.artifacts)
    expect(selectDatasetExecutionInputs(evaluated.state, query.datasetId, 'EVALUATE_ONLY', 'PENDING')).toEqual([])
    expect(selectDatasetExecutionInputs(evaluated.state, query.datasetId, 'EVALUATE_ONLY', 'ALL')).toHaveLength(1)
    expect(selectDatasetExecutionInputs(evaluated.state, query.datasetId, 'GENERATE_AND_EVALUATE', 'ALL')).toHaveLength(2)
    expect(evaluated.state.datasets.find(dataset => dataset.id === query.datasetId)!.caseIds).toEqual([])
    expect(validateEvolutionState(evaluated.state)).toEqual([])
  })

  it('retains the actual generated asset/version and task snapshot when rerating a frozen Query set', () => {
    const state = fixture()
    const asset = state.assetCatalog!.find(item => item.skillId === 'skill-ppt-builder')!
    const versions = state.assetVersions!.filter(item => item.assetId === asset.id)
    const originalVersion = versions.find(version => version.id !== asset.currentVersionId)!
    const generation = applyItem(state, createRun(state, { assetId: asset.id, assetVersionId: originalVersion.id }), 0)
    const originalRun = structuredClone(generation.run)
    generation.state.datasets.find(dataset => dataset.id === 'dataset-manual-query-test')!.frozen = true
    generation.state.datasetQueries![0].query = '后来输入字段被修改'
    generation.state.datasetQueries![0].assetVersionId = asset.currentVersionId
    const reevaluation = createRun(generation.state, { id: 'rerate-frozen-query', mode: 'EVALUATE_ONLY' })
    expect(reevaluation.configSnapshot.inputs[0]).toMatchObject({ assetId: asset.id, assetVersionId: originalVersion.id, skillVersion: originalVersion.version, query: '制作管理层经营 PPT，结论先行。' })
    const result = applyItem(generation.state, reevaluation, 0)
    expect(result.item.status).toBe('COMPLETED')
    expect(result.state.tracePackages.find(pkg => pkg.id === result.item.packageId)?.skillVersion).toBe(originalVersion.version)
    expect(result.state.datasetExecutionRuns!.find(run => run.id === originalRun.id)).toEqual(originalRun)
    expect(result.state.datasets.find(dataset => dataset.id === originalRun.datasetId)!.caseIds).toEqual([])
    expect(validateEvolutionState(result.state)).toEqual([])
  })
})
