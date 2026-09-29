import type { Case, EvolutionState, GateDecision, Issue, ReleaseVersion, Variant } from '../domain'

export type FunnelUnit = 'Case' | '问题' | '变体' | '实验' | '决策'
export interface FunnelStep { id: string; label: string; count: number; unit: FunnelUnit; detailIds: string[] }
export interface OverviewCaseMetric { passedCaseIds: string[]; failedCaseIds: string[]; missingCaseIds: string[]; numerator: number; denominator: number; rate: number }

export function selectOverviewCaseMetrics(state: EvolutionState) {
  const summarize = (kind: 'RESULT' | 'PROCESS'): OverviewCaseMetric => {
    const ids = kind === 'RESULT' ? (item: Case) => item.outcomeEvalIds : (item: Case) => item.processEvalIds
    const status = kind === 'RESULT' ? (item: Case) => item.resultStatus : (item: Case) => item.processStatus
    const evaluated = state.cases.filter((item) => ids(item).length > 0)
    const passedCaseIds = evaluated.filter((item) => status(item) === 'PASS').map((item) => item.id)
    const failedCaseIds = evaluated.filter((item) => status(item) === 'FAIL').map((item) => item.id)
    const missingCaseIds = state.cases.filter((item) => ids(item).length === 0).map((item) => item.id)
    return { passedCaseIds, failedCaseIds, missingCaseIds, numerator: passedCaseIds.length, denominator: evaluated.length, rate: evaluated.length ? passedCaseIds.length / evaluated.length : 0 }
  }
  const result = summarize('RESULT')
  const process = summarize('PROCESS')
  const badcaseIds = unique([...result.failedCaseIds, ...process.failedCaseIds]).filter((id) => {
    const item = state.cases.find((candidate) => candidate.id === id)
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
    if (query && ![item.id, item.sessionId, item.query, item.title, ...item.traceIds].some((value) => value.toLowerCase().includes(query))) return false
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
  toolOneShot: { successCount: number; executionCount: number; successRate: number }
  toolFrequency: Array<{ toolName: string; callCount: number; frequency: number; oneShotSuccessCount: number; oneShotSuccessRate: number }>
  risk: { blockedCount: number; rate: number; reasonDistribution: DistributionEntry[] }
  commercial: { blockedCount: number; rate: number; reasonDistribution: DistributionEntry[] }
}
export type MonitoringSignal = 'latency' | 'ttft' | 'latency-percentiles' | 'tool-frequency' | 'tool-one-shot' | 'risk' | 'commercial'
export interface MonitoringDrilldown { caseIds: string[]; traceIds: string[] }
export function selectMonitoringDrilldown(state: EvolutionState, signal: MonitoringSignal): MonitoringDrilldown {
  const traces = state.traces.filter((trace) => {
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

export function selectEvolutionMonitoring(state: EvolutionState): EvolutionMonitoring {
  const telemetry = state.traces.map((trace) => trace.telemetry)
  const sum = (read: (item: EvolutionState['traces'][number]['telemetry']) => number) => telemetry.reduce((total, item) => total + read(item), 0)
  const toolCounts = new Map<string, { callCount: number; successCount: number }>()
  state.observations.filter((item) => item.toolName).forEach((item) => {
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
  return {
    traceCount: telemetry.length, latencyMs: stats(telemetry.map((item) => item.totalLatencyMs)), ttftMs: stats(telemetry.map((item) => item.ttftMs)),
    tokens: { input: sum((item) => item.inputTokens), output: sum((item) => item.outputTokens) },
    cache: { hitCount: sum((item) => item.cacheHitCount), requestCount: sum((item) => item.cacheRequestCount), hitRate: sum((item) => item.cacheRequestCount) ? sum((item) => item.cacheHitCount) / sum((item) => item.cacheRequestCount) : 0 },
    modelCallCount: sum((item) => item.modelCallCount), toolCallCount, loopCount: sum((item) => item.loopCount), retryCount: sum((item) => item.retryCount),
    toolOneShot: { successCount: oneShotSuccessCount, executionCount: toolExecutionCount, successRate: toolExecutionCount ? oneShotSuccessCount / toolExecutionCount : 0 },
    toolFrequency: [...toolCounts].map(([toolName, value]) => ({ toolName, callCount: value.callCount, frequency: toolCallCount ? value.callCount / toolCallCount : 0, oneShotSuccessCount: value.successCount, oneShotSuccessRate: value.callCount ? value.successCount / value.callCount : 0 })).sort((a, b) => b.callCount - a.callCount || a.toolName.localeCompare(b.toolName)),
    risk: { blockedCount: riskBlocked.length, rate: telemetry.length ? riskBlocked.length / telemetry.length : 0, reasonDistribution: distribution(riskBlocked.map((item) => item.riskInterception.category ?? item.riskInterception.reason)) },
    commercial: { blockedCount: commercialBlocked.length, rate: telemetry.length ? commercialBlocked.length / telemetry.length : 0, reasonDistribution: distribution(commercialBlocked.map((item) => item.commercialInterception.category ?? item.commercialInterception.reason)) }
  }
}
