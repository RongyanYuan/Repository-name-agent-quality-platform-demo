import type { Artifact, AssetCatalogEntry, AssetVersion, EvolutionRecord, EvolutionState, ModuleEvaluationScore, OutcomeEval, Trace, TraceEvaluationModuleCode, TraceEvaluationPackage, VerticalScenario } from '../domain'
import { createIdentityResolver } from '../identity'
import { projectModuleReview } from '../reviews'
import { latestAutomaticOutcomeRevision } from '../outcomeReviews'
import { projectArtifactOutcomeEvaluation, selectArtifactOutcomeEvaluations, outcomeScoreOutOfTwo } from './artifactOutcomes'
import { selectEvolutionRecord } from './moduleEvolution'
import { normalizeSkillVersion } from './skillWorkspace'

export const OVERVIEW_PRODUCT_TYPES: readonly VerticalScenario[] = ['PPT', 'Word', 'Excel', '生图']
export const OVERVIEW_METRIC_DEFINITIONS = {
  resultCases: '至少生成一份 Office 或生图产物的去重 Case（含已生成但不合格的产物）；缺失产物、日志及调试 JSON 不计入。',
  scoreDistribution: '每个 Case 最新产物最终评测的有效评分，分别统计 0 / 1 / 2 分；历史小数独立计数，不使用未定义阈值归档。',
  adoption: '明确采纳 Case /（明确采纳 + 明确拒绝 Case）；未记录事件不进入分母。',
  evolvedAssets: '有明确关联的灰度、正式发布或观察中记录的去重资产；候选及待发布版本不计入。',
  evolutionItems: '当前筛选命中来源 Trace 或已发布候选版本表现的进化项；同一固定资产版本、归因和来源评测轮次只计一项，多条分流路径不重复计数。',
  usedTraces: '上述进化项曾使用的全部历史来源 Trace 去重（来源可早于当前表现窗口）；不含新版本观测及泛化、回归、准出验证 Trace。',
  pendingEvolution: '已确认满足直接优化或已配置聚类条件、但尚无实际发布的进化记录；待确认和规则待配置单列。',
  postEvolution: '明确发布后、执行相应资产候选版本的线上 Trace 的产物最终评分（0–2）；多产物先按 Trace 平均，跨资产去重。',
  efficiency: '按产物类型统计去重 Trace 的原始首 Token、总耗时及输入 + 输出 Token；缺失埋点不按零补齐。',
  quality: '按 PRD 模块平均评分（0–2），优先当前自动版本对应的人工复核；上文仅作证据。Act 缺失时使用 Tool 执行评分，已有 Act 不重复叠加。'
} as const

export interface OverviewOutcomeSummary {
  totalCaseIds: string[]
  resultCaseIds: string[]
  scoreDistribution: Array<{ score: 0 | 1 | 2; count: number; caseIds: string[] }>
  missingScoreCaseIds: string[]
  nonDiscreteCaseIds: string[]
  adoption: { rate?: number; acceptedCaseIds: string[]; rejectedCaseIds: string[]; missingCaseIds: string[] }
}

export interface OverviewAssetSummary {
  evolvedAssetIds: string[]
  evolutionRecordIds: string[]
  /** All route records for navigation; the metric above uses cycle representatives. */
  allEvolutionRecordIds: string[]
  usedTraceIds: string[]
  pendingEvolutionRecordIds: string[]
  pendingRuleRecordIds: string[]
  postEvolutionAverage?: number
  postEvolutionSampleCount: number
  postEvolutionTraceIds: string[]
}

export interface OverviewEfficiencyRow {
  type: VerticalScenario
  caseIds: string[]
  traceIds: string[]
  ttftAverageMs?: number
  latencyAverageMs?: number
  tokenTotal: number
  tokenAverage?: number
  ttftSampleCount: number
  latencySampleCount: number
  tokenSampleCount: number
}

export interface OverviewQualityValue { average?: number; sampleCount: number; caseIds: string[]; traceIds: string[] }
export interface OverviewQualityRow extends OverviewQualityValue {
  moduleCode: TraceEvaluationModuleCode
  label: string
  independentScoring: boolean
  byType: Array<OverviewQualityValue & { type: VerticalScenario }>
}
export interface OverviewDashboard {
  outcome: OverviewOutcomeSummary
  assets: OverviewAssetSummary
  process: { efficiency: OverviewEfficiencyRow[]; quality: OverviewQualityRow[] }
}

const unique = <T,>(values: T[]): T[] => [...new Set(values)]
const mean = (values: number[]): number | undefined => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const validScore = (value: unknown): value is number => validNumber(value) && value <= 2
const time = (value?: string) => Date.parse(value ?? '')
const finalOutcome = (evaluation: OutcomeEval) => evaluation.isFinal === true || (evaluation.isFinal !== false && ['产物合格性', '最终评分', '产物最终评分'].includes(evaluation.dimension))
const latestEvaluationAt = (evaluation: OutcomeEval) => time(latestAutomaticOutcomeRevision(evaluation)?.evaluatedAt ?? evaluation.createdAt)

function latestPackages(state: EvolutionState, traces: Trace[]): Map<string, TraceEvaluationPackage> {
  const resolve = createIdentityResolver(state)
  const allowed = new Set(traces.map(trace => resolve('trace', trace.id)))
  const packages = new Map<string, TraceEvaluationPackage>()
  for (const pkg of state.tracePackages) {
    const id = resolve('trace', pkg.traceId)
    if (!allowed.has(id)) continue
    const previous = packages.get(id)
    if (!previous || time(pkg.createdAt) > time(previous.createdAt) || (pkg.createdAt === previous.createdAt && pkg.id.localeCompare(previous.id) > 0)) packages.set(id, pkg)
  }
  return packages
}

function typesForTrace(state: EvolutionState, trace: Trace): VerticalScenario[] {
  const explicit = trace.verticalScenario ?? state.cases.find(item => item.id === trace.caseId)?.verticalScenario
  if (explicit && OVERVIEW_PRODUCT_TYPES.includes(explicit)) return [explicit]
  const resolve = createIdentityResolver(state)
  const artifactTypes = state.artifacts.filter(item => resolve('trace', item.traceId) === resolve('trace', trace.id))
    .map(item => item.verticalScenario ?? item.kind).filter((type): type is VerticalScenario => OVERVIEW_PRODUCT_TYPES.includes(type as VerticalScenario))
  if (artifactTypes.length) return unique(artifactTypes)
  const scenario = state.cases.find(item => item.id === trace.caseId)?.scenario
  return OVERVIEW_PRODUCT_TYPES.includes(scenario as VerticalScenario) ? [scenario as VerticalScenario] : []
}

function selectOutcomes(state: EvolutionState, scopedState: EvolutionState, traceIds: Set<string>): OverviewOutcomeSummary {
  const resolve = createIdentityResolver(state)
  const cases = [...new Map(scopedState.cases.map(item => [item.id, item])).values()]
  const allCaseIds = new Set(cases.map(item => item.id))
  const traceById = new Map(state.traces.map(item => [resolve('trace', item.id), item]))
  const validArtifact = (artifact: Artifact) => {
    const traceId = resolve('trace', artifact.traceId)
    return allCaseIds.has(artifact.caseId) && traceIds.has(traceId) && traceById.get(traceId)?.caseId === artifact.caseId && isDeliveryArtifact(artifact)
  }
  const artifactById = new Map(state.artifacts.filter(validArtifact).map(item => [item.id, item]))
  const artifactCaseIds = new Set([...artifactById.values()].filter(item => item.status !== 'MISSING').map(item => item.caseId))
  const latestFinalByArtifact = new Map<string, OutcomeEval>()
  for (const evaluation of state.outcomeEvals) {
    const artifact = artifactById.get(evaluation.artifactId)
    if (!artifact || artifact.caseId !== evaluation.caseId || resolve('trace', artifact.traceId) !== resolve('trace', evaluation.traceId) || !finalOutcome(evaluation)) continue
    const previous = latestFinalByArtifact.get(evaluation.artifactId)
    if (!previous || latestEvaluationAt(evaluation) > latestEvaluationAt(previous) || (latestEvaluationAt(evaluation) === latestEvaluationAt(previous) && evaluation.id.localeCompare(previous.id) > 0)) latestFinalByArtifact.set(evaluation.artifactId, evaluation)
  }
  // One Case may have several artifacts and repeated evaluations. The latest
  // final assessment represents its QA label once, including an unlabelled rerun.
  const latestByCase = new Map<string, OutcomeEval>()
  for (const evaluation of latestFinalByArtifact.values()) {
    const previous = latestByCase.get(evaluation.caseId)
    if (!previous || latestEvaluationAt(evaluation) > latestEvaluationAt(previous) || (latestEvaluationAt(evaluation) === latestEvaluationAt(previous) && evaluation.id.localeCompare(previous.id) > 0)) latestByCase.set(evaluation.caseId, evaluation)
  }
  const scores = new Map([...latestByCase].map(([caseId, evaluation]) => [caseId, projectArtifactOutcomeEvaluation(state, evaluation).effectiveScore]))
  const scoreDistribution = ([0, 1, 2] as const).map(score => {
    const caseIds = cases.filter(item => scores.get(item.id) === score).map(item => item.id)
    return { score, count: caseIds.length, caseIds }
  })
  const acceptedCaseIds = cases.filter(item => item.acceptanceStatus === 'ACCEPTED').map(item => item.id)
  const rejectedCaseIds = cases.filter(item => item.acceptanceStatus === 'REJECTED').map(item => item.id)
  const acceptedOrRejected = new Set([...acceptedCaseIds, ...rejectedCaseIds])
  const denominator = acceptedCaseIds.length + rejectedCaseIds.length
  return {
    totalCaseIds: cases.map(item => item.id), resultCaseIds: cases.filter(item => artifactCaseIds.has(item.id)).map(item => item.id), scoreDistribution,
    missingScoreCaseIds: cases.filter(item => scores.get(item.id) === undefined).map(item => item.id),
    nonDiscreteCaseIds: cases.filter(item => scores.get(item.id) !== undefined && ![0, 1, 2].includes(scores.get(item.id)!)).map(item => item.id),
    adoption: { rate: denominator ? acceptedCaseIds.length / denominator : undefined, acceptedCaseIds, rejectedCaseIds, missingCaseIds: cases.filter(item => !acceptedOrRejected.has(item.id)).map(item => item.id) }
  }
}

function isDeliveryArtifact(artifact: Artifact): boolean {
  return ['PPT', 'Word', 'Excel'].includes(artifact.kind)
    || artifact.kind === 'Other' && Boolean(artifact.verticalScenario && OVERVIEW_PRODUCT_TYPES.includes(artifact.verticalScenario))
}

function sourceTraceIds(state: EvolutionState, record: EvolutionRecord): string[] {
  const resolve = createIdentityResolver(state)
  const findings = state.evaluationFindings.filter(item => record.sourceFindingIds.includes(item.id)).map(item => item.traceId)
  const attributions = state.attributions.filter(item => record.sourceAttributionIds.includes(item.id)).map(item => item.traceId)
  const contributions = (state.assetEvolutionContributions ?? []).filter(item => item.evolutionRecordId === record.id).flatMap(item => item.traceIds)
  const exact = unique([...findings, ...attributions, ...contributions].map(id => resolve('trace', id)))
  if (exact.length) return exact
  const issueIds = new Set([...record.sourceIssueIds, ...state.issueClusters.filter(item => record.sourceClusterIds.includes(item.id)).flatMap(item => item.issueIds)])
  const issueAttributions = state.issues.filter(item => issueIds.has(item.id)).map(item => item.attributionId)
  return unique(state.attributions.filter(item => issueAttributions.includes(item.id)).map(item => resolve('trace', item.traceId)))
}

function catalogForRecord(state: EvolutionState, record: EvolutionRecord): AssetCatalogEntry[] {
  if (record.target.kind === 'SKILL') {
    const skillId = record.target.skillId
    return (state.assetCatalog ?? []).filter(item => item.skillId === skillId)
  }
  // Non-Skill catalog rows have no canonical targetId yet. Use explicit
  // contribution linkage rather than assigning every Memory/Tool row by kind.
  const ids = new Set((state.assetEvolutionContributions ?? []).filter(item => item.evolutionRecordId === record.id).map(item => item.assetId))
  return (state.assetCatalog ?? []).filter(item => ids.has(item.id))
}

interface ReleasedEvolutionVersion { assetId: string; version: AssetVersion; recordId: string; releasedAt: string }
function releasedVersionsForRecord(state: EvolutionState, record: EvolutionRecord): ReleasedEvolutionVersion[] {
  const catalog = catalogForRecord(state, record)
  const result: ReleasedEvolutionVersion[] = []
  for (const release of state.releases) {
    if (!record.releaseIds.includes(release.id) || !['CANARY', 'RELEASED', 'OBSERVING'].includes(release.status) || !Number.isFinite(time(release.releasedAt))) continue
    const candidates = state.variants.filter(item => record.variantIds.includes(item.id) && release.variantIds.includes(item.id)
      && (record.target.kind === 'SKILL' ? item.targetModule === 'Skill' && normalizeSkillVersion(item.currentVersion) === normalizeSkillVersion(record.target.skillVersion)
        : record.target.governanceObject === 'OTHER_BADCASE' || item.targetModule === record.target.governanceObject))
    for (const asset of catalog) for (const variant of candidates) {
      if (record.target.kind === 'SKILL' && variant.targets?.length) {
        const skillId = record.target.skillId
        if (!variant.targets.some(item => item.skillId === skillId && (!item.attributionId || item.attributionId === record.target.attributionId))) continue
      }
      const version = (state.assetVersions ?? []).find(item => item.assetId === asset.id && normalizeSkillVersion(item.version) === normalizeSkillVersion(variant.candidateVersion))
      if (version) result.push({ assetId: asset.id, version, recordId: record.id, releasedAt: release.releasedAt! })
    }
  }
  return result
}

/** Destination records can split one observation into strategy and Agent
 * routes. Their IDs are not evolution items. Explicit superseding records
 * remain a new cycle even when they reuse the same original evidence. */
function evolutionCycleKey(record: EvolutionRecord): string {
  const target = record.target.kind === 'SKILL'
    ? ['SKILL', record.target.skillId, normalizeSkillVersion(record.target.skillVersion), record.target.attributionId]
    : ['MODULE', record.target.governanceObject, record.target.targetId, record.target.targetVersion ?? '', record.target.attributionId]
  const findingIds = unique(record.sourceFindingIds).sort()
  const attributionIds = unique(record.sourceAttributionIds).sort()
  const source = findingIds.length || attributionIds.length ? [findingIds, attributionIds]
    : [unique(record.sourceIssueIds).sort(), unique(record.sourceClusterIds).sort(), record.createdAt]
  return JSON.stringify([target, source, record.supersedesRecordId ?? null])
}

function selectAssets(state: EvolutionState, traceIds: Set<string>): OverviewAssetSummary {
  const resolve = createIdentityResolver(state)
  const allRecords = state.evolutionRecords ?? []
  const allReleasedVersions = allRecords.flatMap(record => releasedVersionsForRecord(state, record))
  const scopedPerformance = (state.assetPerformanceRecords ?? []).filter(item => traceIds.has(resolve('trace', item.traceId)))
  const relevantRecords = allRecords.filter(record => sourceTraceIds(state, record).some(id => traceIds.has(id))
    || allReleasedVersions.some(version => version.recordId === record.id && scopedPerformance.some(item => item.assetId === version.assetId && item.assetVersionId === version.version.id)))
  const relevantCycles = new Set(relevantRecords.map(evolutionCycleKey))
  // Include every route of a relevant cycle so one published Agent route
  // cannot leave its sibling strategy route counted as another pending item.
  const records = allRecords.filter(record => relevantCycles.has(evolutionCycleKey(record)))
  const recordIds = new Set(records.map(record => record.id))
  const releasedVersions = allReleasedVersions.filter(item => recordIds.has(item.recordId))
  const evolvedRecordIds = new Set(releasedVersions.map(item => item.recordId))
  const pendingEvolutionRecordIds: string[] = []
  const pendingRuleRecordIds: string[] = []
  const cycles = new Map<string, EvolutionRecord[]>()
  for (const record of records) { const key = evolutionCycleKey(record); cycles.set(key, [...(cycles.get(key) ?? []), record]) }
  for (const cycle of cycles.values()) {
    if (cycle.some(record => evolvedRecordIds.has(record.id))) continue
    const paths = cycle.flatMap(record => selectEvolutionRecord(state, record.id)?.paths ?? [])
    if (paths.some(path => path.eligibility.code === 'CONFIRMED') && !paths.every(path => path.gate.code === 'REJECTED')) pendingEvolutionRecordIds.push(cycle[0].id)
    else if (!paths.length || paths.some(path => ['PENDING', 'UNKNOWN'].includes(path.eligibility.code))) pendingRuleRecordIds.push(cycle[0].id)
  }
  const matchingPerformance = (state.assetPerformanceRecords ?? []).filter(performance => {
    const traceId = resolve('trace', performance.traceId)
    if (!traceIds.has(traceId)) return false
    const trace = state.traces.find(item => resolve('trace', item.id) === traceId)
    const record = state.cases.find(item => item.id === trace?.caseId)
    if (performance.caseId !== trace?.caseId || record?.sourceType !== 'ONLINE_WINDOW' || record.environment !== 'Production') return false
    const occurredAt = time(trace?.queryAt ?? trace?.startedAt ?? performance.queryAt)
    return releasedVersions.some(item => item.assetId === performance.assetId && item.version.id === performance.assetVersionId && occurredAt >= time(item.releasedAt))
  })
  const performancesByTrace = new Map<string, typeof matchingPerformance>()
  for (const performance of matchingPerformance) {
    const id = resolve('trace', performance.traceId)
    performancesByTrace.set(id, [...(performancesByTrace.get(id) ?? []), performance])
  }
  const scoredTraces: Array<{ traceId: string; score: number }> = []
  for (const [traceId, performances] of performancesByTrace) {
    const artifactIds = new Set(performances.map(item => item.artifactId).filter(Boolean))
    const finals = selectArtifactOutcomeEvaluations(state, traceId).filter(item => artifactIds.has(item.artifact.id) && isDeliveryArtifact(item.artifact))
      .map(item => item.finalEvaluation?.effectiveScore).filter(validScore)
    const average = mean(finals)
    if (average !== undefined) scoredTraces.push({ traceId, score: average })
  }
  return {
    evolvedAssetIds: unique(releasedVersions.map(item => item.assetId)), evolutionRecordIds: [...cycles.values()].map(cycle => cycle[0].id), allEvolutionRecordIds: unique(records.map(item => item.id)),
    usedTraceIds: unique(records.flatMap(record => sourceTraceIds(state, record))),
    pendingEvolutionRecordIds: unique(pendingEvolutionRecordIds), pendingRuleRecordIds: unique(pendingRuleRecordIds),
    postEvolutionAverage: mean(scoredTraces.map(item => item.score)), postEvolutionSampleCount: scoredTraces.length, postEvolutionTraceIds: scoredTraces.map(item => item.traceId)
  }
}

function selectProcess(state: EvolutionState, traces: Trace[]): OverviewDashboard['process'] {
  const resolve = createIdentityResolver(state)
  const types = new Map(traces.map(trace => [resolve('trace', trace.id), typesForTrace(state, trace)]))
  const efficiency = OVERVIEW_PRODUCT_TYPES.map(type => {
    const members = traces.filter(trace => types.get(resolve('trace', trace.id))?.includes(type))
    const ttft = members.map(trace => trace.telemetry?.ttftMs).filter(validNumber)
    const latencies = members.map(trace => trace.telemetry?.totalLatencyMs ?? trace.totalLatencyMs).filter(validNumber)
    const tokens = members.filter(trace => validNumber(trace.inputTokens) && validNumber(trace.outputTokens)).map(trace => trace.inputTokens + trace.outputTokens)
    return { type, caseIds: unique(members.map(trace => trace.caseId)), traceIds: members.map(trace => resolve('trace', trace.id)), ttftAverageMs: mean(ttft), latencyAverageMs: mean(latencies), tokenTotal: tokens.reduce((sum, value) => sum + value, 0), tokenAverage: mean(tokens), ttftSampleCount: ttft.length, latencySampleCount: latencies.length, tokenSampleCount: tokens.length }
  })
  const packages = latestPackages(state, traces)
  const moduleDefinitions: Array<{ moduleCode: TraceEvaluationModuleCode; label: string }> = [
    { moduleCode: 'MEMORY', label: '记忆' }, { moduleCode: 'CONTEXT', label: '上文' },
    { moduleCode: 'SKILL', label: 'skill' }, { moduleCode: 'REASON', label: 'Reason' }, { moduleCode: 'ACT', label: 'Act' }
  ]
  const quality: OverviewQualityRow[] = moduleDefinitions.map(({ moduleCode, label }) => {
    const observations: Array<{ traceId: string; caseId: string; score: number }> = []
    if (moduleCode !== 'CONTEXT') for (const [traceId, pkg] of packages) {
      // Module reruns contribute once. Tool and Act describe the same
      // execution family, so an explicit Act assessment takes precedence.
      const code = moduleCode === 'ACT' && !pkg.moduleScores.some(item => item.moduleCode === 'ACT') ? 'TOOL' : moduleCode
      const source = pkg.moduleScores.filter(item => item.moduleCode === code).sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id)).at(-1)
      if (!source) continue
      const score = effectiveModuleScore(source, state)
      if (score !== undefined) observations.push({ traceId, caseId: pkg.caseId, score })
    }
    const summarize = (values: typeof observations): OverviewQualityValue => ({ average: mean(values.map(item => item.score)), sampleCount: values.length, caseIds: unique(values.map(item => item.caseId)), traceIds: values.map(item => item.traceId) })
    return { moduleCode, label, independentScoring: moduleCode !== 'CONTEXT', ...summarize(observations), byType: OVERVIEW_PRODUCT_TYPES.map(type => ({ type, ...summarize(observations.filter(item => types.get(item.traceId)?.includes(type))) })) }
  })
  return { efficiency, quality }
}

function effectiveModuleScore(source: ModuleEvaluationScore, state: EvolutionState): number | undefined {
  const reviewed = projectModuleReview(source, state.moduleReviews)
  // Explicit unscored human reviews exclude the current assessment; stale
  // reviews cannot override a newer automatic result.
  if (reviewed.reviewState === 'REVIEWED' || reviewed.humanStatus !== undefined || reviewed.humanScore !== undefined) return validScore(reviewed.humanScore) ? reviewed.humanScore : undefined
  return outcomeScoreOutOfTwo(source.score, source.scoreScale ?? '0-1')
}

/** The scope contributes only Case / Trace identities. All lineage and latest
 * evaluation lookups use the full store so filters cannot fabricate a missing
 * publication or borrow global catalog/contribution totals. */
export function selectOverviewDashboard(fullState: EvolutionState, scopedState: EvolutionState = fullState): OverviewDashboard {
  const resolve = createIdentityResolver(fullState)
  const allowedCases = new Set(scopedState.cases.map(item => item.id))
  const traces = [...new Map(scopedState.traces.filter(item => allowedCases.has(item.caseId)).map(item => [resolve('trace', item.id), item])).values()]
  const traceIds = new Set(traces.map(item => resolve('trace', item.id)))
  return { outcome: selectOutcomes(fullState, scopedState, traceIds), assets: selectAssets(fullState, traceIds), process: selectProcess(fullState, traces) }
}
