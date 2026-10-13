import type {
  Case, EvaluationBatch, EvaluationBatchStats, EvaluationCoverageStatus, EvaluationFinding, EvaluationJob,
  EvolutionState, GateDecision, Issue, ModuleEvaluationScore, ReleaseVersion, RoutingDelivery, SkillCategory,
  TraceEvaluationPackage, Variant
} from '../domain'
import { aliasesForIdentity, resolveIdentity } from '../identity'

export type FunnelUnit = 'Case' | '问题' | '变体' | '实验' | '决策'
export interface FunnelStep { id: string; label: string; count: number; unit: FunnelUnit; detailIds: string[] }
export interface OverviewCaseMetric { passedCaseIds: string[]; failedCaseIds: string[]; missingCaseIds: string[]; numerator: number; denominator: number; rate: number }

export function selectOverviewCaseMetrics(state: EvolutionState) {
  const packageByCase = new Map((state.tracePackages ?? []).map((item) => [item.caseId, item]))
  // Every scoped Case with a recorded evaluation contributes to the
  // denominator. Prefixes are fixture implementation details; they must not
  // silently exclude V2 or fixed-version workspace records.
  const metricCases = state.cases
  const summarize = (kind: 'RESULT' | 'PROCESS'): OverviewCaseMetric => {
    const ids = kind === 'RESULT' ? (item: Case) => item.outcomeEvalIds : (item: Case) => item.processEvalIds
    const status = kind === 'RESULT' ? (item: Case) => item.resultStatus : (item: Case) => item.processStatus
    const packageScores = (pkg: TraceEvaluationPackage) => kind === 'RESULT' ? pkg.moduleScores.filter((score) => score.moduleCode === 'OUTCOME') : pkg.moduleScores.filter((score) => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode))
    const hasPackageEvaluation = (pkg: TraceEvaluationPackage | undefined) => Boolean(pkg && ['EVALUATED', 'PARTIAL'].includes(pkg.status) && (kind === 'RESULT' ? pkg.outcomeCoverage : pkg.processCoverage) !== 'MISSING' && packageScores(pkg).length > 0)
    const evaluated = metricCases.filter((item) => {
      const pkg = packageByCase.get(item.id)
      return ids(item).length > 0 || hasPackageEvaluation(pkg)
    })
    const resolvedStatus = (item: Case) => {
      const pkg = packageByCase.get(item.id)
      if (!pkg || !hasPackageEvaluation(pkg)) return status(item)
      const scores = packageScores(pkg)
      const values = scores.map((score) => score.humanStatus ?? score.automaticStatus)
      return values.includes('FAIL') || values.includes('DERIVED_FAIL') ? 'FAIL' : values.includes('UNKNOWN') ? 'UNKNOWN' : values.every(value => value === 'N/A') ? 'NOT_APPLICABLE' : 'PASS'
    }
    const passedCaseIds = evaluated.filter((item) => resolvedStatus(item) === 'PASS').map((item) => item.id)
    const failedCaseIds = evaluated.filter((item) => resolvedStatus(item) === 'FAIL').map((item) => item.id)
    const missingCaseIds = metricCases.filter((item) => !evaluated.includes(item)).map((item) => item.id)
    return { passedCaseIds, failedCaseIds, missingCaseIds, numerator: passedCaseIds.length, denominator: evaluated.length, rate: evaluated.length ? passedCaseIds.length / evaluated.length : 0 }
  }
  const result = summarize('RESULT')
  const process = summarize('PROCESS')
  const badcaseIds = unique([...result.failedCaseIds, ...process.failedCaseIds]).filter((id) => {
    const item = metricCases.find((candidate) => candidate.id === id)
    return Boolean(item && ['CONFIRMED', 'IN_PROGRESS', 'RESOLVED'].includes(item.status))
  })
  return { result, process, badcaseIds }
}

const unique = (values: string[]) => [...new Set(values)]

export interface TasteLibraryTriggerResult {
  clusterId: string
  isTasteRule: boolean
  skillId: string | null
  qualifyingLocalCaseIds: string[]
  localCount: number | null
  externalMockCount: number | null
  totalCount: number | null
  threshold: 100 | null
  eligible: boolean | null
  source: string | null
  snapshotId: string | null
  countingRule: string
}

export function selectTasteLibraryTrigger(state: EvolutionState, clusterId: string): TasteLibraryTriggerResult {
  const cluster = state.issueClusters.find((item) => item.id === clusterId)
  const pending = { clusterId, isTasteRule: false, skillId: null, qualifyingLocalCaseIds: [], localCount: null, externalMockCount: null, totalCount: null, threshold: null, eligible: null, source: null, snapshotId: null, countingRule: cluster?.countingRule ?? '触发门槛待配置。' } satisfies TasteLibraryTriggerResult
  if (!cluster || cluster.triggerRuleId !== 'rule-taste-100') return pending

  const skillId = cluster.tastePopulation?.skillId ?? null
  const clusterCaseIds = new Set(cluster.caseIds)
  const clusterIssueIds = new Set(cluster.issueIds)
  const clusterEvidenceIds = new Set(cluster.evidenceIds)
  const qualifyingLocalCaseIds = unique(state.cases.filter((caseRecord) => {
    if (!skillId || !clusterCaseIds.has(caseRecord.id) || !caseRecord.skillIds.includes(skillId)) return false
    if (!['CONFIRMED', 'IN_PROGRESS', 'RESOLVED'].includes(caseRecord.status)) return false
    return state.issues.some((issue) => {
      if (!clusterIssueIds.has(issue.id) || issue.caseId !== caseRecord.id || issue.dimension !== '品味库召回错误' || issue.status === 'PENDING') return false
      const attribution = state.attributions.find((item) => item.id === issue.attributionId)
      if (!attribution || attribution.caseId !== caseRecord.id || attribution.module !== 'Skill' || attribution.dimension !== '品味库召回错误' || !attribution.confirmed || attribution.status !== 'CONFIRMED') return false
      return [...issue.evidenceIds, ...attribution.evidenceIds].some((id) => clusterEvidenceIds.has(id))
    })
  }).map((item) => item.id))
  const externalMockCount = Math.max(0, cluster.tastePopulation?.externalMockConfirmedCaseCount ?? 0)
  const totalCount = qualifyingLocalCaseIds.length + externalMockCount
  return { clusterId, isTasteRule: true, skillId, qualifyingLocalCaseIds, localCount: qualifyingLocalCaseIds.length, externalMockCount, totalCount, threshold: 100, eligible: totalCount >= 100, source: cluster.tastePopulation?.source ?? null, snapshotId: cluster.tastePopulation?.snapshotId ?? null, countingRule: cluster.countingRule }
}

export function selectEvolutionFunnel(state: EvolutionState): FunnelStep[] {
  const onlineCases = state.cases.map((item) => item.id)
  const evaluatedCases = state.cases.filter((item) => item.processEvalIds.length > 0 || item.outcomeEvalIds.length > 0).map((item) => item.id)
  const confirmedIssues = state.issues.filter((item) => item.status !== 'PENDING').map((item) => item.id)
  const routedIssues = state.issues.filter((item) => item.routingLabels.length > 0 && (item.optimizationMode === 'DIRECT_FIX' || item.clusterIds.length > 0)).map((item) => item.id)
  const variants = state.variants.map((item) => item.id)
  const single = state.experiments.filter((item) => item.level === 'SINGLE_VARIANT').map((item) => item.id)
  const window = state.experiments.filter((item) => item.level === 'WINDOW_COMBINATION').map((item) => item.id)
  const decisions = state.gateDecisions.map((item) => item.id)
  return [
    { id: 'online-cases', label: '线上 Case', unit: 'Case', detailIds: onlineCases, count: onlineCases.length },
    { id: 'evaluated-cases', label: '完成评测', unit: 'Case', detailIds: evaluatedCases, count: evaluatedCases.length },
    { id: 'confirmed-issues', label: '确认问题', unit: '问题', detailIds: confirmedIssues, count: confirmedIssues.length },
    { id: 'routed-issues', label: '直接修复 / 问题簇', unit: '问题', detailIds: routedIssues, count: routedIssues.length },
    { id: 'variants', label: '能力变体', unit: '变体', detailIds: variants, count: variants.length },
    { id: 'single-experiments', label: '单变体实验', unit: '实验', detailIds: single, count: single.length },
    { id: 'window-experiments', label: '窗口组合实验', unit: '实验', detailIds: window, count: window.length },
    { id: 'gate-decisions', label: '准出 / 拒绝 / 人工复核', unit: '决策', detailIds: decisions, count: decisions.length }
  ]
}

export { buildVariantWorkbench as selectVariantWorkbench, selectVariantLineage } from './variantWorkbench'
export type { VariantWorkbench, VariantWorkbenchSection, VariantWorkbenchSkillRow, VariantWorkbenchVariant } from './variantWorkbench'

export interface CaseLineage {
  case: Case
  session: EvolutionState['sessions'][number] | undefined
  traces: EvolutionState['traces']
  observations: EvolutionState['observations']
  artifacts: EvolutionState['artifacts']
  processEvals: EvolutionState['processEvals']
  outcomeEvals: EvolutionState['outcomeEvals']
  attributions: EvolutionState['attributions']
  issues: Issue[]
  clusters: EvolutionState['issueClusters']
  variants: Variant[]
  experiments: EvolutionState['experiments']
  gateDecisions: GateDecision[]
  releases: ReleaseVersion[]
}

export function selectCaseLineage(state: EvolutionState, caseId: string): CaseLineage | undefined {
  const record = state.cases.find((item) => item.id === caseId)
  if (!record) return undefined
  const traces = state.traces.filter((item) => item.caseId === caseId)
  const traceIds = new Set(traces.map((item) => item.id))
  const attributions = state.attributions.filter((item) => item.caseId === caseId)
  const issues = state.issues.filter((item) => item.caseId === caseId)
  const issueIds = new Set(issues.map((item) => item.id))
  const clusters = state.issueClusters.filter((item) => item.caseIds.includes(caseId) || item.issueIds.some((id) => issueIds.has(id)))
  const clusterIds = new Set(clusters.map((item) => item.id))
  const variants = state.variants.filter((item) => item.sourceCaseIds.includes(caseId) || item.sourceIssueIds.some((id) => issueIds.has(id)) || item.sourceClusterIds.some((id) => clusterIds.has(id)))
  const variantIds = new Set(variants.map((item) => item.id))
  const experiments = state.experiments.filter((item) => item.variantIds.some((id) => variantIds.has(id)))
  const experimentIds = new Set(experiments.map((item) => item.id))
  const gateDecisions = state.gateDecisions.filter((item) => experimentIds.has(item.experimentId))
  const releases = state.releases.filter((item) => item.variantIds.some((id) => variantIds.has(id)))
  return {
    case: record, session: state.sessions.find((item) => item.id === record.sessionId), traces,
    observations: state.observations.filter((item) => traceIds.has(item.traceId)),
    artifacts: state.artifacts.filter((item) => item.caseId === caseId),
    processEvals: state.processEvals.filter((item) => item.caseId === caseId),
    outcomeEvals: state.outcomeEvals.filter((item) => item.caseId === caseId),
    attributions, issues, clusters, variants, experiments, gateDecisions, releases
  }
}

export interface ReleaseLineage {
  release: ReleaseVersion
  window: EvolutionState['windows'][number] | undefined
  combinationExperiment: EvolutionState['experiments'][number] | undefined
  singleExperiments: EvolutionState['experiments']
  gateDecision: GateDecision | undefined
  variants: Variant[]
  issues: Issue[]
  clusters: EvolutionState['issueClusters']
  cases: Case[]
}

export function selectReleaseLineage(state: EvolutionState, releaseId: string): ReleaseLineage | undefined {
  const release = state.releases.find((item) => item.id === releaseId)
  if (!release) return undefined
  const variants = state.variants.filter((item) => release.variantIds.includes(item.id))
  const issueIds = unique(variants.flatMap((item) => item.sourceIssueIds))
  const clusterIds = unique(variants.flatMap((item) => item.sourceClusterIds))
  const caseIds = unique(variants.flatMap((item) => item.sourceCaseIds).concat(state.issues.filter((item) => issueIds.includes(item.id)).map((item) => item.caseId)))
  const window = state.windows.find((item) => item.id === release.windowId)
  return {
    release, window, combinationExperiment: state.experiments.find((item) => item.id === release.combinationExperimentId),
    singleExperiments: state.experiments.filter((item) => window?.singleExperimentIds.includes(item.id) && item.level === 'SINGLE_VARIANT' && item.variantIds.length === 1 && release.variantIds.includes(item.variantIds[0]) && Boolean(item.gateDecisionId && state.gateDecisions.some((decision) => decision.id === item.gateDecisionId && decision.conclusion === 'PASS'))),
    gateDecision: state.gateDecisions.find((item) => item.id === release.gateDecisionId), variants,
    issues: state.issues.filter((item) => issueIds.includes(item.id)),
    clusters: state.issueClusters.filter((item) => clusterIds.includes(item.id)),
    cases: state.cases.filter((item) => caseIds.includes(item.id))
  }
}

export interface EvolutionFilters {
  query?: string; environment?: Case['environment'] | 'All'; scenario?: string; skillId?: string; agentVersion?: string
}
export function selectFilteredCases(state: EvolutionState, filters: EvolutionFilters): Case[] {
  const query = filters.query?.trim().toLowerCase()
  return state.cases.filter((item) => {
    if (query && ![item.id, item.sessionId, item.query, item.title, ...item.traceIds, ...aliasesForIdentity(state, 'session', item.sessionId), ...item.traceIds.flatMap(id => aliasesForIdentity(state, 'trace', id))].some((value) => value.toLowerCase().includes(query))) return false
    if (filters.environment && filters.environment !== 'All' && item.environment !== filters.environment) return false
    if (filters.scenario && filters.scenario !== 'All' && item.scenario !== filters.scenario) return false
    if (filters.skillId && filters.skillId !== 'All' && !item.skillIds.includes(filters.skillId)) return false
    if (filters.agentVersion && filters.agentVersion !== 'All' && item.agentVersion !== filters.agentVersion) return false
    return true
  })
}

export interface DistributionEntry { reason: string; count: number }
export interface EvolutionMonitoring {
  traceCount: number
  latencyMs: { average: number; p50: number; p90: number; p95: number }
  ttftMs: { average: number; p50: number; p90: number; p95: number }
  tokens: { input: number; output: number }
  cache: { hitCount: number; requestCount: number; hitRate: number }
  modelCallCount: number; toolCallCount: number; loopCount: number; retryCount: number
  model: { latencyMs: { average: number; p50: number; p90: number; p95: number }; throughputTokensPerSecond: number }
  toolOneShot: { successCount: number; executionCount: number; successRate: number }
  toolFrequency: Array<{ toolName: string; callCount: number; frequency: number; oneShotSuccessCount: number; oneShotSuccessRate: number }>
  risk: { blockedCount: number; rate: number; reasonDistribution: DistributionEntry[] }
  commercial: { blockedCount: number; rate: number; reasonDistribution: DistributionEntry[] }
}
export type MonitoringSignal = 'latency' | 'ttft' | 'latency-percentiles' | 'tool-frequency' | 'tool-one-shot' | 'risk' | 'commercial'
export interface MonitoringDrilldown { caseIds: string[]; traceIds: string[] }
export function selectMonitoringDrilldown(state: EvolutionState, signal: MonitoringSignal): MonitoringDrilldown {
  const traces = state.traces.filter((trace) => {
    // V1 signal drilldowns remain deterministic for existing deep links. V2
    // monitoring pages can pass `includeV2` to selectEvolutionMonitoring and
    // use package selectors for the expanded ledger.
    if ((signal === 'risk' || signal === 'commercial' || signal === 'tool-frequency' || signal === 'tool-one-shot') && trace.skillCategory) return false
    if (signal === 'risk') return trace.telemetry.riskInterception.blocked
    if (signal === 'commercial') return trace.telemetry.commercialInterception.blocked
    if (signal === 'tool-frequency') return trace.telemetry.toolCallCount > 0
    if (signal === 'tool-one-shot') return trace.telemetry.toolExecutionCount > 0
    if (signal === 'ttft') return trace.telemetry.ttftMs >= 0
    return trace.telemetry.totalLatencyMs >= 0
  })
  return { caseIds: unique(traces.map((trace) => trace.caseId)), traceIds: traces.map((trace) => trace.id) }
}
export const selectMonitoringCaseIds = (state: EvolutionState, signal: MonitoringSignal) => selectMonitoringDrilldown(state, signal).caseIds

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}
const stats = (values: number[]) => ({ average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, p50: percentile(values, 0.5), p90: percentile(values, 0.9), p95: percentile(values, 0.95) })
const distribution = (values: string[]): DistributionEntry[] => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))

export function selectEvolutionMonitoring(state: EvolutionState, includeV2 = false): EvolutionMonitoring {
  const telemetry = state.traces.filter((trace) => includeV2 || !trace.skillCategory).map((trace) => trace.telemetry)
  const sum = (read: (item: EvolutionState['traces'][number]['telemetry']) => number) => telemetry.reduce((total, item) => total + read(item), 0)
  const toolCounts = new Map<string, { callCount: number; successCount: number }>()
  const selectedTraceIds = new Set(state.traces.filter((trace) => includeV2 || !trace.skillCategory).map((trace) => trace.id))
  state.observations.filter((item) => item.toolName && selectedTraceIds.has(item.traceId)).forEach((item) => {
    const current = toolCounts.get(item.toolName!) ?? { callCount: 0, successCount: 0 }
    current.callCount += 1
    if (item.status === 'SUCCEEDED' && item.retryCount === 0) current.successCount += 1
    toolCounts.set(item.toolName!, current)
  })
  const toolCallCount = sum((item) => item.toolCallCount)
  const oneShotSuccessCount = sum((item) => item.toolOneShotSuccessCount)
  const toolExecutionCount = sum((item) => item.toolExecutionCount)
  const riskBlocked = telemetry.filter((item) => item.riskInterception.blocked)
  const commercialBlocked = telemetry.filter((item) => item.commercialInterception.blocked)
  const modelTraces = state.traces.filter((trace) => (includeV2 || !trace.skillCategory) && trace.telemetry.modelLatencyMs !== undefined)
  const modelLatencies = modelTraces.map((trace) => trace.telemetry.modelLatencyMs as number)
  const modelThroughputs = modelTraces.filter((trace) => trace.telemetry.modelThroughputTokensPerSecond !== undefined).map((trace) => trace.telemetry.modelThroughputTokensPerSecond as number)
  return {
    traceCount: telemetry.length, latencyMs: stats(telemetry.map((item) => item.totalLatencyMs)), ttftMs: stats(telemetry.map((item) => item.ttftMs)),
    tokens: { input: sum((item) => item.inputTokens), output: sum((item) => item.outputTokens) },
    cache: { hitCount: sum((item) => item.cacheHitCount), requestCount: sum((item) => item.cacheRequestCount), hitRate: sum((item) => item.cacheRequestCount) ? sum((item) => item.cacheHitCount) / sum((item) => item.cacheRequestCount) : 0 },
    modelCallCount: sum((item) => item.modelCallCount), toolCallCount, loopCount: sum((item) => item.loopCount), retryCount: sum((item) => item.retryCount),
    model: { latencyMs: stats(modelLatencies), throughputTokensPerSecond: modelThroughputs.length ? modelThroughputs.reduce((total, value) => total + value, 0) / modelThroughputs.length : 0 },
    toolOneShot: { successCount: oneShotSuccessCount, executionCount: toolExecutionCount, successRate: toolExecutionCount ? oneShotSuccessCount / toolExecutionCount : 0 },
    toolFrequency: [...toolCounts].map(([toolName, value]) => ({ toolName, callCount: value.callCount, frequency: toolCallCount ? value.callCount / toolCallCount : 0, oneShotSuccessCount: value.successCount, oneShotSuccessRate: value.callCount ? value.successCount / value.callCount : 0 })).sort((a, b) => b.callCount - a.callCount || a.toolName.localeCompare(b.toolName)),
    risk: { blockedCount: riskBlocked.length, rate: telemetry.length ? riskBlocked.length / telemetry.length : 0, reasonDistribution: distribution(riskBlocked.map((item) => item.riskInterception.category ?? item.riskInterception.reason)) },
    commercial: { blockedCount: commercialBlocked.length, rate: telemetry.length ? commercialBlocked.length / telemetry.length : 0, reasonDistribution: distribution(commercialBlocked.map((item) => item.commercialInterception.category ?? item.commercialInterception.reason)) }
  }
}

/** ------------------------------ V2 selectors ------------------------------ */

export interface BatchStatistics extends EvaluationBatchStats {
  batchId: string
  status: EvaluationBatch['status'] | 'UNKNOWN'
  traceIds: string[]
  jobIds: string[]
}

const emptyBatchStatistics = (batchId: string): BatchStatistics => ({ batchId, status: 'UNKNOWN', traceIds: [], jobIds: [], inputTraceCount: 0, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 0 })

/** Computes counts from Packages instead of trusting hand-authored totals. */
export function selectBatchStatistics(state: EvolutionState, batchId: string): BatchStatistics {
  const batch = (state.evaluationBatches ?? []).find((item) => item.id === batchId)
  if (!batch) return emptyBatchStatistics(batchId)
  const packages = (state.tracePackages ?? []).filter((item) => item.batchId === batchId)
  const counts = packages.reduce((summary, item) => {
    if (item.status === 'EVALUATED') summary.successCount += 1
    else if (item.status === 'PARTIAL') summary.partialCount += 1
    else if (item.status === 'FAILED') summary.failedCount += 1
    else summary.pendingCount += 1
    return summary
  }, { successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 0 })
  return { batchId, status: batch.status, traceIds: [...batch.traceIds], jobIds: [...batch.jobIds], inputTraceCount: batch.traceIds.length, ...counts }
}

export const selectAllBatchStatistics = (state: EvolutionState): BatchStatistics[] => (state.evaluationBatches ?? []).map((batch) => selectBatchStatistics(state, batch.id))

export type LedgerRoutingStatus = RoutingDelivery['status'] | 'NONE'
export type LedgerBadcaseStatus = 'NONE' | 'CANDIDATE' | 'CONFIRMED' | 'REJECTED' | 'RESOLVED'
export interface TraceLedgerRow {
  package: TraceEvaluationPackage
  batch: EvaluationBatch | undefined
  case: Case | undefined
  session: EvolutionState['sessions'][number] | undefined
  trace: EvolutionState['traces'][number] | undefined
  query: string
  skillCategory: SkillCategory
  processCoverage: EvaluationCoverageStatus
  outcomeCoverage: EvaluationCoverageStatus
  moduleFailureCount: number
  evidenceCompleteness: 'COMPLETE' | 'PARTIAL' | 'MISSING'
  routingStatus: LedgerRoutingStatus
  badcaseStatus: LedgerBadcaseStatus
  owner?: string
}
export interface TraceLedgerFilters {
  query?: string
  batchId?: string
  caseId?: string
  sessionId?: string
  traceId?: string
  agentVersion?: string
  skillVersion?: string
  skillCategory?: SkillCategory | 'All'
  processCoverage?: EvaluationCoverageStatus | 'All'
  outcomeCoverage?: EvaluationCoverageStatus | 'All'
  evidenceCompleteness?: TraceLedgerRow['evidenceCompleteness'] | 'All'
  routingStatus?: LedgerRoutingStatus | 'All'
  badcaseStatus?: LedgerBadcaseStatus | 'All'
  owner?: string
  minModuleFailures?: number
}

const evidenceCompletenessForPackage = (record: TraceEvaluationPackage): TraceLedgerRow['evidenceCompleteness'] => {
  if (!record.moduleScores.length) return 'MISSING'
  if (record.moduleScores.some((item) => item.evidence.completeness === 'MISSING')) return 'MISSING'
  if (record.moduleScores.some((item) => item.evidence.completeness === 'PARTIAL')) return 'PARTIAL'
  return 'COMPLETE'
}
const routingStatusForPackage = (state: EvolutionState, record: TraceEvaluationPackage): LedgerRoutingStatus => {
  const deliveries = (state.routingDeliveries ?? []).filter((item) => record.routingDeliveryIds.includes(item.id))
  return deliveries.length ? deliveries.some((item) => item.status === 'PENDING') ? 'PENDING' : deliveries.some((item) => item.status === 'QUEUED') ? 'QUEUED' : deliveries[0].status : 'NONE'
}
const badcaseStatusForPackage = (state: EvolutionState, record: TraceEvaluationPackage): LedgerBadcaseStatus => {
  const items = (state.algorithmBadcases ?? []).filter((item) => record.badcaseIds.includes(item.id))
  return items.length ? (items.find((item) => item.status === 'CONFIRMED')?.status ?? items[0].status) : 'NONE'
}
const includesQuery = (state: EvolutionState, record: TraceLedgerRow, query?: string) => {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) return true
  return [record.package.id, record.package.traceId, record.package.caseId, record.package.sessionId, record.query, record.package.agentVersion, record.package.skillVersion ?? '', ...aliasesForIdentity(state, 'trace', record.package.traceId), ...aliasesForIdentity(state, 'session', record.package.sessionId)].some((value) => value.toLowerCase().includes(normalized))
}

export function selectTraceEvaluationLedger(state: EvolutionState, filters: TraceLedgerFilters = {}): TraceLedgerRow[] {
  return (state.tracePackages ?? []).map((record): TraceLedgerRow => {
    const trace = state.traces.find((item) => item.id === record.traceId)
    const caseRecord = state.cases.find((item) => item.id === record.caseId)
    return {
      package: record, batch: (state.evaluationBatches ?? []).find((item) => item.id === record.batchId), case: caseRecord,
      session: state.sessions.find((item) => item.id === record.sessionId), trace, query: record.query,
      skillCategory: record.skillCategory,
      processCoverage: record.processCoverage, outcomeCoverage: record.outcomeCoverage,
      moduleFailureCount: record.moduleScores.filter((item) => item.automaticStatus === 'FAIL' || item.automaticStatus === 'DERIVED_FAIL').length,
      evidenceCompleteness: evidenceCompletenessForPackage(record), routingStatus: routingStatusForPackage(state, record),
      badcaseStatus: badcaseStatusForPackage(state, record), owner: record.owner ?? caseRecord?.owner
    }
  }).filter((row) => {
    if (!includesQuery(state, row, filters.query)) return false
    if (filters.batchId && filters.batchId !== 'All' && row.package.batchId !== filters.batchId) return false
    if (filters.caseId && filters.caseId !== 'All' && row.package.caseId !== filters.caseId) return false
    if (filters.sessionId && filters.sessionId !== 'All' && row.package.sessionId !== resolveIdentity(state, 'session', filters.sessionId)) return false
    if (filters.traceId && filters.traceId !== 'All' && row.package.traceId !== resolveIdentity(state, 'trace', filters.traceId)) return false
    if (filters.agentVersion && filters.agentVersion !== 'All' && row.package.agentVersion !== filters.agentVersion) return false
    if (filters.skillVersion && filters.skillVersion !== 'All' && row.package.skillVersion !== filters.skillVersion) return false
    if (filters.skillCategory && filters.skillCategory !== 'All' && row.package.skillCategory !== filters.skillCategory) return false
    if (filters.processCoverage && filters.processCoverage !== 'All' && row.processCoverage !== filters.processCoverage) return false
    if (filters.outcomeCoverage && filters.outcomeCoverage !== 'All' && row.outcomeCoverage !== filters.outcomeCoverage) return false
    if (filters.evidenceCompleteness && filters.evidenceCompleteness !== 'All' && row.evidenceCompleteness !== filters.evidenceCompleteness) return false
    if (filters.routingStatus && filters.routingStatus !== 'All' && row.routingStatus !== filters.routingStatus) return false
    if (filters.badcaseStatus && filters.badcaseStatus !== 'All' && row.badcaseStatus !== filters.badcaseStatus) return false
    if (filters.owner && filters.owner !== 'All' && row.owner !== filters.owner) return false
    if (filters.minModuleFailures !== undefined && row.moduleFailureCount < filters.minModuleFailures) return false
    return true
  })
}

export function selectModuleEvaluationSummary(state: EvolutionState, traceId: string): ModuleEvaluationScore[] {
  const canonical = resolveIdentity(state, 'trace', traceId)
  return (state.tracePackages ?? []).find((item) => item.traceId === canonical)?.moduleScores ?? []
}

export interface FiveStateModuleSummary {
  moduleCode: ModuleEvaluationScore['moduleCode']
  moduleLabel: string
  pass: number
  fail: number
  derivedFail: number
  unknown: number
  notApplicable: number
  firstFailure: boolean
}
/** Aggregates the five-state matrix without treating derived failures as root failures. */
export function selectFiveStateModuleSummary(state: EvolutionState, traceId: string): FiveStateModuleSummary[] {
  return selectModuleEvaluationSummary(state, traceId).map((score) => ({
    moduleCode: score.moduleCode,
    moduleLabel: score.moduleLabel,
    pass: score.automaticStatus === 'PASS' ? 1 : 0,
    fail: score.automaticStatus === 'FAIL' ? 1 : 0,
    derivedFail: score.automaticStatus === 'DERIVED_FAIL' ? 1 : 0,
    unknown: score.automaticStatus === 'UNKNOWN' ? 1 : 0,
    notApplicable: score.automaticStatus === 'N/A' ? 1 : 0,
    firstFailure: score.evidence.firstFailure
  }))
}
export const selectTraceModuleSummary = selectFiveStateModuleSummary

export function selectFirstNonDerivedFailure(record: TraceEvaluationPackage | undefined): ModuleEvaluationScore | undefined {
  return record?.moduleScores.find((item) => item.automaticStatus === 'FAIL' && !item.evidence.derivedFailure)
}

export function selectEvidenceCompleteness(state: EvolutionState, traceId: string): TraceLedgerRow['evidenceCompleteness'] {
  const canonical = resolveIdentity(state, 'trace', traceId)
  const record = (state.tracePackages ?? []).find((item) => item.traceId === canonical)
  return record ? evidenceCompletenessForPackage(record) : 'MISSING'
}

export interface RoutingQueueSelection {
  queue: EvolutionState['badcaseQueues'][number] | undefined
  deliveryIds: string[]
  itemIds: string[]
  deliveries: RoutingDelivery[]
  badcases: EvolutionState['algorithmBadcases']
}
export function selectRoutingQueue(state: EvolutionState, queueId: string): RoutingQueueSelection {
  const queue = (state.badcaseQueues ?? []).find((item) => item.id === queueId)
  const deliveryIds = queue?.deliveryIds ?? []
  const itemIds = queue?.itemIds ?? []
  return { queue, deliveryIds, itemIds, deliveries: (state.routingDeliveries ?? []).filter((item) => deliveryIds.includes(item.id)), badcases: (state.algorithmBadcases ?? []).filter((item) => itemIds.includes(item.id)) }
}

export const selectRoutingDeliveries = (state: EvolutionState, filters: { destination?: RoutingDelivery['destination']; status?: RoutingDelivery['status']; traceId?: string } = {}): RoutingDelivery[] => {
  const canonical = filters.traceId ? resolveIdentity(state, 'trace', filters.traceId) : undefined
  return (state.routingDeliveries ?? []).filter((item) => (!filters.destination || item.destination === filters.destination) && (!filters.status || item.status === filters.status) && (!canonical || item.traceId === canonical))
}

export const selectEvaluationFindingsForTrace = (state: EvolutionState, traceId: string): EvaluationFinding[] => {
  const canonical = resolveIdentity(state, 'trace', traceId)
  return (state.evaluationFindings ?? []).filter((item) => item.traceId === canonical)
}
