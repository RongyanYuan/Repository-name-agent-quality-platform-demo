import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionState, ModuleEvaluationScore, OutcomeEval, TraceEvaluationPackage, VerticalScenario } from '../domain'
import { automaticModuleRevisionId } from '../reviews'
import { selectOverviewDashboard } from './overviewDashboard'

const templates = createInitialEvolutionData()
const at = '2026-10-10T10:00:00.000Z'
function emptyState(): EvolutionState {
  return Object.fromEntries(Object.entries(structuredClone(templates)).map(([key, value]) => [key, Array.isArray(value) ? [] : value])) as unknown as EvolutionState
}
function addCase(state: EvolutionState, id: string, type: VerticalScenario = 'PPT', score?: number) {
  const traceId = `trace-${id}`
  const artifactId = `artifact-${id}`
  state.cases.push({ ...structuredClone(templates.cases[0]), id, sourceType: 'ONLINE_WINDOW', verticalScenario: type, scenario: type, traceIds: [traceId], artifactIds: [artifactId], acceptanceStatus: 'UNKNOWN', createdAt: at, updatedAt: at })
  state.traces.push({ ...structuredClone(templates.traces[0]), id: traceId, caseId: id, verticalScenario: type, artifactIds: [artifactId], startedAt: at, queryAt: at, createdAt: at, updatedAt: at, inputTokens: 100, outputTokens: 20, telemetry: { ...templates.traces[0].telemetry, ttftMs: 200, totalLatencyMs: 2000 } })
  state.artifacts.push({ ...structuredClone(templates.artifacts[0]), id: artifactId, traceId, caseId: id, kind: type === '生图' ? 'Other' : type, verticalScenario: type, status: 'AVAILABLE' })
  if (score !== undefined) state.outcomeEvals.push(finalEvaluation(id, traceId, artifactId, score))
  return state.traces.at(-1)!
}
function finalEvaluation(caseId: string, traceId: string, artifactId: string, score?: number): OutcomeEval {
  return { id: `eval-${artifactId}`, type: 'OUTCOME', caseId, traceId, artifactId, dimension: '最终评分', isFinal: true, scoreScale: '0-2', score, verdict: 'UNKNOWN', evalVersion: 'v1', revisions: [], evidenceIds: [], createdAt: at, updatedAt: at }
}
function addPackage(state: EvolutionState, caseId: string): TraceEvaluationPackage {
  const pkg = { ...structuredClone(templates.tracePackages[0]), id: `package-${caseId}`, traceId: `trace-${caseId}`, caseId, moduleScores: [], rating: undefined, createdAt: at, updatedAt: at }
  state.tracePackages.push(pkg)
  return pkg
}
function addModule(pkg: TraceEvaluationPackage, moduleCode: ModuleEvaluationScore['moduleCode'], score: number, scoreScale: '0-1' | '0-2' = '0-2'): ModuleEvaluationScore {
  const source = { ...structuredClone(templates.tracePackages[0].moduleScores[0]), id: `score-${pkg.id}-${moduleCode}`, packageId: pkg.id, traceId: pkg.traceId, caseId: pkg.caseId, moduleCode, score, scoreScale, humanScore: undefined, humanStatus: undefined, createdAt: at, updatedAt: at }
  pkg.moduleScores.push(source)
  return source
}

describe('three-dashboard metric contracts', () => {
  it('deduplicates Cases, latest final assessments and known adoption events without discretizing historical decimals', () => {
    const state = emptyState()
    addCase(state, 'zero', 'PPT', 0)
    addCase(state, 'one', 'Word', 1)
    addCase(state, 'two', 'Excel', 2)
    addCase(state, 'decimal', '生图', 1.45)
    addCase(state, 'missing')
    state.artifacts = state.artifacts.filter(item => item.caseId !== 'missing')
    state.cases[0].acceptanceStatus = 'ACCEPTED'
    state.cases[1].acceptanceStatus = 'REJECTED'
    state.cases.push(structuredClone(state.cases[0]))
    state.traces.push(structuredClone(state.traces[0]))
    state.outcomeEvals.push({ ...structuredClone(state.outcomeEvals[0]), id: 'older-zero-eval', score: 2, createdAt: '2026-10-01T00:00:00Z' })
    state.outcomeEvals.push({ ...structuredClone(state.outcomeEvals[0]), id: 'zero-style-dimension', score: 2, isFinal: false, dimension: '风格', createdAt: '2026-10-11T00:00:00Z' })
    const outcome = selectOverviewDashboard(state).outcome
    expect(outcome.totalCaseIds).toHaveLength(5)
    expect(outcome.resultCaseIds).toHaveLength(4)
    expect(outcome.scoreDistribution.map(item => item.count)).toEqual([1, 1, 1])
    expect(outcome.nonDiscreteCaseIds).toEqual(['decimal'])
    expect(outcome.missingScoreCaseIds).toEqual(['missing'])
    expect(outcome.adoption.rate).toBe(0.5)
    expect(outcome.adoption.missingCaseIds).toHaveLength(3)
  })

  it('keeps zero-denominator averages and adoption absent, with all requested product types available', () => {
    const dashboard = selectOverviewDashboard(emptyState())
    expect(dashboard.outcome.adoption.rate).toBeUndefined()
    expect(dashboard.assets.postEvolutionAverage).toBeUndefined()
    expect(dashboard.process.efficiency.map(item => item.type)).toEqual(['PPT', 'Word', 'Excel', '生图'])
    expect(dashboard.process.efficiency.every(item => item.ttftAverageMs === undefined && item.tokenAverage === undefined)).toBe(true)
    expect(dashboard.process.quality.find(item => item.moduleCode === 'CONTEXT')).toMatchObject({ independentScoring: false, sampleCount: 0, average: undefined })
  })

  it('uses latest finals and excludes an unscored explicit human result instead of falling back to automatic', () => {
    const state = emptyState()
    addCase(state, 'human', 'PPT', 2)
    state.outcomeEvals[0].revisions = [
      { id: 'auto-final', source: 'AUTOMATIC', score: 2, scoreScale: '0-2', verdict: 'PASS', reason: '自动结果', evidenceIds: [], evaluator: 'Eval Agent', evaluatedAt: at },
      { id: 'human-final', source: 'HUMAN', score: undefined, scoreScale: '0-2', verdict: 'UNKNOWN', reason: '证据待补充', evidenceIds: [], evaluator: '复核员', automaticRevisionId: 'auto-final', evaluatedAt: '2026-10-11T10:00:00Z' }
    ]
    expect(selectOverviewDashboard(state).outcome.missingScoreCaseIds).toEqual(['human'])
  })

  it('counts generated invalid deliveries as results and excludes debug artifacts and mismatched assessment ownership', () => {
    const state = emptyState()
    addCase(state, 'invalid', 'PPT', 0)
    addCase(state, 'log', 'PPT', 2)
    addCase(state, 'missing', 'PPT', 0)
    state.artifacts.find(item => item.caseId === 'invalid')!.status = 'INVALID'
    state.artifacts.find(item => item.caseId === 'log')!.kind = 'Log'
    state.artifacts.find(item => item.caseId === 'missing')!.status = 'MISSING'
    state.outcomeEvals.push({ ...finalEvaluation('invalid', 'trace-invalid', 'artifact-missing', 2), id: 'invalid-borrowed-evaluation', createdAt: '2026-10-11T10:00:00Z' })
    const outcome = selectOverviewDashboard(state).outcome
    expect(outcome.resultCaseIds).toEqual(['invalid'])
    expect(outcome.scoreDistribution.map(item => item.count)).toEqual([2, 0, 0])
    expect(outcome.missingScoreCaseIds).toEqual(['log'])
  })

  it('groups actual telemetry by product and ignores missing fields while preserving explicit zero', () => {
    const state = emptyState()
    const pptA = addCase(state, 'ppt-a')
    const pptB = addCase(state, 'ppt-b')
    addCase(state, 'excel', 'Excel')
    pptA.telemetry.ttftMs = 0
    pptB.telemetry.ttftMs = Number.NaN
    pptB.inputTokens = Number.NaN
    state.traces.push(structuredClone(pptA))
    const process = selectOverviewDashboard(state).process
    const ppt = process.efficiency.find(item => item.type === 'PPT')!
    expect(ppt.traceIds).toHaveLength(2)
    expect(ppt).toMatchObject({ ttftAverageMs: 0, ttftSampleCount: 1, latencyAverageMs: 2000, tokenTotal: 120, tokenAverage: 120, tokenSampleCount: 1 })
    expect(process.efficiency.find(item => item.type === 'Excel')?.traceIds).toEqual(['trace-excel'])
  })

  it('uses PRD modules, current human review, explicit scales and Tool fallback without double counting Act', () => {
    const state = emptyState()
    addCase(state, 'ppt')
    addCase(state, 'word', 'Word')
    const ppt = addPackage(state, 'ppt')
    const word = addPackage(state, 'word')
    const skill = addModule(ppt, 'SKILL', 0.5, '0-1')
    skill.humanScore = 0
    skill.humanStatus = 'FAIL'
    addModule(ppt, 'ACT', 1)
    addModule(ppt, 'TOOL', 2)
    addModule(ppt, 'CONTEXT', 2)
    addModule(word, 'TOOL', 2)
    const process = selectOverviewDashboard(state).process
    expect(process.quality.map(item => item.label)).toEqual(['记忆', '上文', 'skill', 'Reason', 'Act'])
    expect(process.quality.find(item => item.moduleCode === 'SKILL')).toMatchObject({ average: 0, sampleCount: 1 })
    expect(process.quality.find(item => item.moduleCode === 'ACT')).toMatchObject({ average: 1.5, sampleCount: 2 })
    expect(process.quality.find(item => item.moduleCode === 'ACT')?.byType.find(item => item.type === 'PPT')?.average).toBe(1)
    expect(process.quality.find(item => item.moduleCode === 'CONTEXT')?.average).toBeUndefined()
  })

  it('does not reuse stale module reviews or older packages after a new automatic evaluation', () => {
    const state = emptyState()
    addCase(state, 'rerun')
    const old = addPackage(state, 'rerun')
    addModule(old, 'MEMORY', 0)
    const current = { ...structuredClone(old), id: 'package-rerun-new', createdAt: '2026-10-11T10:00:00Z', moduleScores: [] }
    state.tracePackages.push(current)
    const module = addModule(current, 'MEMORY', 0.8, '0-1')
    module.humanScore = 0
    module.humanStatus = 'FAIL'
    state.moduleReviews = [{ ...structuredClone(templates.moduleReviews![0]), id: 'stale', traceId: module.traceId, caseId: module.caseId, packageId: module.packageId, moduleScoreId: module.id, automaticRevisionId: `${automaticModuleRevisionId(module)}-older`, humanScore: 0 }]
    expect(selectOverviewDashboard(state).process.quality.find(item => item.moduleCode === 'MEMORY')).toMatchObject({ average: 1.6, sampleCount: 1 })
  })

  it('scopes all metrics by selected Trace identities including aliases, not the retained global asset catalog', () => {
    const state = emptyState()
    addCase(state, 'a', 'PPT', 0)
    addCase(state, 'b', 'Word', 2)
    const pkg = addPackage(state, 'a')
    addModule(pkg, 'SKILL', 1)
    state.identityAliases = [{ kind: 'trace', alias: 'legacy-trace-a', canonicalId: 'trace-a' }]
    const scope = { ...state, cases: [state.cases[0]], traces: [{ ...state.traces[0], id: 'legacy-trace-a' }] }
    const dashboard = selectOverviewDashboard(state, scope)
    expect(dashboard.outcome.totalCaseIds).toEqual(['a'])
    expect(dashboard.outcome.scoreDistribution.map(item => item.count)).toEqual([1, 0, 0])
    expect(dashboard.process.quality.find(item => item.moduleCode === 'SKILL')?.traceIds).toEqual(['trace-a'])
    expect(dashboard.process.efficiency.find(item => item.type === 'Word')?.traceIds).toEqual([])
    expect(dashboard.assets.evolvedAssetIds).toEqual([])
  })

  it('counts a confirmed released candidate once and only averages online final results after its actual release', () => {
    const state = emptyState()
    addCase(state, 'trigger', 'PPT', 0)
    const before = addCase(state, 'before', 'PPT', 0)
    const online = addCase(state, 'online', 'PPT', 2)
    const golden = addCase(state, 'golden', 'PPT', 0)
    before.queryAt = '2026-10-01T10:00:00Z'
    state.cases.find(item => item.id === golden.caseId)!.sourceType = 'GOLDEN_DATASET'
    const record = { ...structuredClone(templates.evolutionRecords![0]), id: 'record-evolved', target: { kind: 'SKILL' as const, governanceObject: 'Skill' as const, skillId: 'skill-demo', skillVersion: '1.0.0', attributionId: 'skill-sop' }, sourceFindingIds: [], sourceAttributionIds: [], sourceIssueIds: [], sourceClusterIds: [], variantIds: ['variant-demo'], releaseIds: ['release-demo'] }
    state.evolutionRecords = [record]
    state.assetCatalog = [{ ...structuredClone(templates.assetCatalog![0]), id: 'asset-demo', skillId: 'skill-demo' }]
    state.assetVersions = [{ ...structuredClone(templates.assetVersions![0]), id: 'asset-version-2', assetId: 'asset-demo', version: '2.0.0', status: 'ACTIVE' }]
    state.variants = [{ ...structuredClone(templates.variants[0]), id: 'variant-demo', targetModule: 'Skill', currentVersion: '1.0.0', candidateVersion: '2.0.0', targets: [] }]
    state.releases = [{ ...structuredClone(templates.releases[0]), id: 'release-demo', variantIds: ['variant-demo'], status: 'RELEASED', releasedAt: '2026-10-05T10:00:00Z' }]
    state.assetEvolutionContributions = [{ ...structuredClone(templates.assetEvolutionContributions![0]), id: 'contribution-demo', assetId: 'asset-demo', assetVersionId: 'asset-version-2', evolutionRecordId: record.id, traceIds: ['trace-trigger', 'trace-trigger'] }]
    state.assetPerformanceRecords = [before, online, golden].flatMap(trace => [1, 2].map(index => ({ ...structuredClone(templates.assetPerformanceRecords![0]), id: `performance-${trace.id}-${index}`, assetId: 'asset-demo', assetVersionId: 'asset-version-2', traceId: trace.id, caseId: trace.caseId, artifactId: trace.artifactIds[0], score: 0 })))
    const summary = selectOverviewDashboard(state).assets
    expect(summary.evolvedAssetIds).toEqual(['asset-demo'])
    expect(summary.evolutionRecordIds).toEqual([record.id])
    expect(summary.usedTraceIds).toEqual(['trace-trigger'])
    expect(summary).toMatchObject({ postEvolutionAverage: 2, postEvolutionSampleCount: 1, postEvolutionTraceIds: ['trace-online'] })
    // The older trigger is outside the currently selected online query
    // window. Exact published-version usage still discovers its history.
    const onlineOnly = { ...state, cases: state.cases.filter(item => item.id === 'online'), traces: [online] }
    const recent = selectOverviewDashboard(state, onlineOnly).assets
    expect(recent.evolvedAssetIds).toEqual(['asset-demo'])
    expect(recent.usedTraceIds).toEqual(['trace-trigger'])
    expect(recent.postEvolutionAverage).toBe(2)
    // A strategy route and an Agent route belong to one evolution cycle.
    const strategy = { ...structuredClone(record), id: 'record-strategy-route', releaseIds: [] }
    state.evolutionRecords!.push(strategy)
    state.assetEvolutionContributions!.push({ ...structuredClone(state.assetEvolutionContributions![0]), id: 'strategy-contribution', evolutionRecordId: strategy.id })
    const routed = selectOverviewDashboard(state, onlineOnly).assets
    expect(routed.evolutionRecordIds).toEqual([record.id])
    expect(routed.allEvolutionRecordIds).toEqual([record.id, strategy.id])
    expect(routed.pendingEvolutionRecordIds).toEqual([])
    expect(routed.pendingRuleRecordIds).toEqual([])
    // A genuine later cycle must not be collapsed into its predecessor.
    state.evolutionRecords!.push({ ...structuredClone(record), id: 'record-later-cycle', supersedesRecordId: record.id, releaseIds: [], createdAt: '2026-10-12T10:00:00Z' })
    state.assetEvolutionContributions!.push({ ...structuredClone(state.assetEvolutionContributions![0]), id: 'later-contribution', evolutionRecordId: 'record-later-cycle' })
    expect(selectOverviewDashboard(state).assets.evolutionRecordIds).toEqual([record.id, 'record-later-cycle'])
    state.releases[0].status = 'PENDING'
    expect(selectOverviewDashboard(state).assets.evolvedAssetIds).toEqual([])
    expect(selectOverviewDashboard(state).assets.postEvolutionAverage).toBeUndefined()
  })
})
