import type { Case, Dataset, EvolutionState, Trace, TraceEvaluationPackage, TraceRating, VerticalScenario } from '../domain'
import { evolutionItemId } from '../taxonomy'
import { currentGateDecision, governanceTracks, targetAttributionId, targetMatchesScope, type GovernanceScope } from './skillWorkspace'

export interface TraceWorkbenchRow {
  trace: Trace; case: Case; package?: TraceEvaluationPackage; artifact?: EvolutionState['artifacts'][number]
  labels: string[]; datasets: Dataset[]; rating?: TraceRating; tokens: number; latency: number
  processStatus: string; outcomeStatus: string
}

const sourceLabel = (record: Case) => record.sourceType === 'ONLINE_WINDOW' ? '线上' : record.sourceType === 'GOLDEN_DATASET' ? '黄金集' : 'mock集'
const datasetLabel = (dataset: Dataset) => dataset.type === 'REGRESSION' ? '回归数据集A' : dataset.type === 'GENERALIZATION' ? '泛化数据集A' : dataset.type === 'WINDOW_ONLINE' ? '线上时间窗口' : dataset.purpose ?? dataset.name
const clamp2 = (value: number) => Math.max(0, Math.min(2, Number(value.toFixed(2))))

function buildRating(pkg?: TraceEvaluationPackage): TraceRating | undefined {
  if (!pkg) return undefined
  if (pkg.rating) return pkg.rating
  const process = pkg.moduleScores.filter(score => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode) && score.score !== undefined)
  const outcome = pkg.moduleScores.filter(score => score.moduleCode === 'OUTCOME' && score.score !== undefined)
  if (!process.length && !outcome.length) return undefined
  return {
    scale: '0-2', rubric: pkg.skillCategory === 'TASTE_SKILL' ? '对应垂类品味评测标准' : '对应过程模块评测标准',
    processFinal: process.length ? clamp2(process.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / process.length) : undefined,
    outcomeFinal: outcome.length ? clamp2(outcome.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / outcome.length) : undefined,
    processDimensions: process.map(score => ({ module: score.moduleCode, dimension: score.moduleLabel, score: score.score === undefined ? undefined : clamp2(score.score * 2), scoreId: score.id })),
    outcomeDimensions: outcome.map(score => ({ dimension: score.moduleLabel, score: score.score === undefined ? undefined : clamp2(score.score * 2), evaluationId: score.id }))
  }
}

export function traceRows(state: EvolutionState): TraceWorkbenchRow[] {
  return state.traces.map(trace => {
    const record = state.cases.find(item => item.id === trace.caseId)!
    const pkg = state.tracePackages.find(item => item.traceId === trace.id && item.status !== 'PENDING') ?? state.tracePackages.find(item => item.traceId === trace.id)
    const datasets = state.datasets.filter(dataset => dataset.caseIds.includes(record.id))
    return { trace, case: record, package: pkg, artifact: state.artifacts.find(item => trace.artifactIds.includes(item.id)), labels: [...new Set([sourceLabel(record), ...datasets.map(datasetLabel)])], datasets, rating: buildRating(pkg), tokens: trace.inputTokens + trace.outputTokens, latency: trace.totalLatencyMs, processStatus: pkg?.processCoverage === 'COMPLETE' ? '已评测' : pkg?.processCoverage === 'PARTIAL' ? '评测中' : '待评测', outcomeStatus: pkg?.outcomeCoverage === 'COMPLETE' ? '已评测' : pkg?.outcomeCoverage === 'PARTIAL' ? '评测中' : '待评测' }
  })
}

export function filterTraceRows(rows: TraceWorkbenchRow[], filters: { channel?: string; verticalScenario?: VerticalScenario; evolutionItem?: string; processMin?: number; processMax?: number; outcomeMin?: number; outcomeMax?: number; tokenMin?: number; tokenMax?: number; latencyMin?: number; latencyMax?: number }) {
  const matches = (value: number | undefined, min?: number, max?: number) => (min === undefined || (value !== undefined && value >= min)) && (max === undefined || (value !== undefined && value <= max))
  return rows.filter(row => (!filters.channel || row.trace.channel === filters.channel) && (!filters.verticalScenario || row.trace.verticalScenario === filters.verticalScenario) && (!filters.evolutionItem || row.package?.moduleScores.some(score => evolutionItemId(score.moduleLabel) === filters.evolutionItem)) && matches(row.rating?.processFinal, filters.processMin, filters.processMax) && matches(row.rating?.outcomeFinal, filters.outcomeMin, filters.outcomeMax) && matches(row.tokens, filters.tokenMin, filters.tokenMax) && matches(row.latency, filters.latencyMin, filters.latencyMax))
}

export interface DatasetWorkbenchRow { dataset: Dataset; targets: Array<{ skillId: string; skillVersion?: string; skillVersionId?: string; evolutionItemId: string; attributionId?: string }>; experimentType: string; evaluationResult: string; gate: string; traceIds: string[]; experimentIds: string[]; decisionIds: string[] }

export function datasetRows(state: EvolutionState, filter: GovernanceScope = {}): DatasetWorkbenchRow[] {
  const scoped = Boolean(filter.skillId || filter.skillVersion || filter.attribution || filter.evolutionItem || filter.governanceObject)
  const legacyTracks = scoped && state.experiments.some(experiment => !experiment.targets?.length) ? governanceTracks(state, filter) : []
  return state.datasets.filter(dataset => !scoped || dataset.targets?.some(target => targetMatchesScope(target, filter))).map(dataset => {
    const targets = (dataset.targets ?? []).filter(target => !scoped || targetMatchesScope(target, filter))
    const experiments = state.experiments.filter(experiment => experiment.datasetIds.includes(dataset.id) && (!scoped || (experiment.targets?.length
      ? experiment.targets.some(target => targets.some(datasetTarget => targetMatchesScope(target, { skillId: datasetTarget.skillId, skillVersion: datasetTarget.skillVersion, attribution: targetAttributionId(datasetTarget) })))
      : legacyTracks.some(track => track.experimentIds.includes(experiment.id) && track.datasetIds.includes(dataset.id)))))
    const latestExperiment = [...experiments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    const decision = latestExperiment ? currentGateDecision(state, latestExperiment) : undefined
    const decisions = decision ? [decision] : []
    const latest = decisions[0]
    const gate = latest?.conclusion === 'PASS' ? '已准出' : latest?.conclusion === 'MANUAL_REVIEW' ? '人工复核' : latest ? '不准出' : '待决策'
    const hasResult = latestExperiment && (latestExperiment.metrics.length > 0 || state.experimentRuns.some(run => run.experimentId === latestExperiment.id && run.status === 'COMPLETED'))
    const evaluationResult = !latestExperiment ? '待评测'
      : latestExperiment.status === 'RUNNING' ? '评测中'
      : ['DRAFT', 'QUEUED'].includes(latestExperiment.status) ? '待运行'
      : latestExperiment.status === 'FAILED' ? '评测失败'
      : hasResult ? '已有评测结果' : '暂无评测结果'
    return { dataset, targets, experimentType: experiments.some(experiment => experiment.level === 'WINDOW_COMBINATION') ? '窗口版本实验' : '单能力变体实验', evaluationResult, gate: latestExperiment ? gate : dataset.gateStatus ?? gate, traceIds: state.traces.filter(trace => dataset.caseIds.includes(trace.caseId)).map(trace => trace.id), experimentIds: experiments.map(experiment => experiment.id), decisionIds: decisions.map(decision => decision.id) }
  })
}

export function datasetTraceRows(state: EvolutionState, dataset: Dataset): TraceWorkbenchRow[] {
  const members = new Set(dataset.caseIds)
  return traceRows(state).filter(row => members.has(row.case.id))
}

export function importTraceCases(state: EvolutionState, traceIds: string[], kind: 'evaluation' | 'golden', name: string, at: string) {
  const next = structuredClone(state); const blocked: Array<{ caseId: string; reason: string }> = []; const addedCaseIds: string[] = []
  const target = next.datasets.find(dataset => kind === 'golden' ? dataset.purpose === '黄金集' : dataset.purpose === '原始归因集')
  const dataset: Dataset = target ?? { id: kind === 'golden' ? 'dataset-golden-set' : 'dataset-evaluation-import', name, type: 'ATTRIBUTION', version: 'v1', caseIds: [], sampleCount: 0, source: '用户批量导入', scope: name, frozen: false, population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock', countingRule: '按 Case ID 去重' }, purpose: kind === 'golden' ? '黄金集' : '原始归因集', setRole: kind === 'golden' ? 'GOLDEN' : 'EVALUATION', targets: [], createdAt: at, updatedAt: at }
  if (!target) next.datasets.push(dataset)
  for (const traceId of [...new Set(traceIds)]) {
    const row = traceRows(next).find(item => item.trace.id === traceId)
    if (!row) continue
    if (kind === 'golden' && (row.case.sourceType !== 'ONLINE_WINDOW' || row.package?.status !== 'EVALUATED')) { blocked.push({ caseId: row.case.id, reason: '只有已评测的线上 Case 可以加入黄金集。' }); continue }
    const existing = next.datasets.filter(item => item.caseIds.includes(row.case.id))
    if (existing.length) { blocked.push({ caseId: row.case.id, reason: `已属于${existing.map(item => item.name).join('、')}，不能重复加入。` }); continue }
    dataset.caseIds.push(row.case.id); addedCaseIds.push(row.case.id)
  }
  dataset.caseIds = [...new Set(dataset.caseIds)]; dataset.sampleCount = dataset.caseIds.length; dataset.population = { ...dataset.population, totalSampleCount: dataset.sampleCount, localCaseCount: dataset.caseIds.length, externalSampleCount: 0 }; dataset.updatedAt = at
  next.auditTrail.push({ id: `audit-bulk-trace-import-${Date.parse(at)}`, at, actor: '当前用户', action: 'BULK_TRACE_IMPORT', entityType: 'Dataset', entityId: dataset.id, reason: `批量导入${kind === 'golden' ? '黄金集' : '评测集'}`, changes: { addedCaseIds } })
  return { state: next, addedCaseIds, blocked, datasetId: dataset.id }
}
