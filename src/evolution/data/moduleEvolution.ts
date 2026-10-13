import type { Attribution, Dataset, EvaluationFinding, EvolutionRecord, EvolutionState, EvolutionTargetIdentity, Experiment, GateDecision, GovernanceReference, ModuleEvolutionBinding, ReleaseVersion, RoutingDelivery, Variant } from '../domain'
import { resolveIdentity } from '../identity'
import { automaticModuleRevisionId } from '../reviews'
import { EVOLUTION_ITEMS, evolutionItemId, evolutionItemLabel } from '../taxonomy'
import { normalizeSkillVersion } from './skillWorkspace'
import { selectTasteLibraryTrigger } from './selectors'

export interface EvolutionStage {
  code: string; label: string; reason: string; at?: string; refs: GovernanceReference[]
  count?: number; threshold?: number; unit?: string; countingRule?: string
}
export interface EvolutionHistoryEntry { id: string; stage: string; label: string; description: string; at?: string; refs: GovernanceReference[] }
export interface ModuleEvolutionPath {
  id: string; record: EvolutionRecord; finding: EvaluationFinding; binding?: ModuleEvolutionBinding; attribution?: Attribution; delivery?: RoutingDelivery
  label: string; isHistorical: boolean; eligibility: EvolutionStage; routing: EvolutionStage; gate: EvolutionStage
  singleGate: EvolutionStage; windowGate: EvolutionStage; release: EvolutionStage; history: EvolutionHistoryEntry[]
  datasets: Dataset[]; experiments: Experiment[]; decisions: GateDecision[]; releases: ReleaseVersion[]; warnings: string[]
}
export interface ModuleEvolutionSelection { currentPaths: ModuleEvolutionPath[]; historicalPaths: ModuleEvolutionPath[]; summary: string; missingReason?: string; contextOnly: boolean }
export interface ModuleEvolutionDirection {
  id: string; target: EvolutionTargetIdentity; attributionId: string
  currentPaths: ModuleEvolutionPath[]; historicalPaths: ModuleEvolutionPath[]
}
export interface ModuleEvolutionQuery { traceId: string; packageId: string; moduleScoreId: string; automaticRevisionId?: string; processEvaluationId?: string; scoreDimensionId?: string }
export interface EvolutionRecordProjection { record: EvolutionRecord; paths: ModuleEvolutionPath[]; datasets: Dataset[]; experiments: Experiment[]; decisions: GateDecision[]; releases: ReleaseVersion[]; warnings: string[] }

const ref = (kind: GovernanceReference['kind'], id: string): GovernanceReference => ({ kind, id })
const stage = (code: string, label: string, reason: string, refs: GovernanceReference[] = [], at?: string): EvolutionStage => ({ code, label, reason, refs, at })
const validTime = (value?: string): value is string => Boolean(value && Number.isFinite(Date.parse(value)))
const latest = <T>(items: T[], at: (item: T) => string | undefined) => [...items].sort((a, b) => (Date.parse(at(a) ?? '') || 0) - (Date.parse(at(b) ?? '') || 0)).at(-1)
const sameIds = (left: string[], right: string[]) => left.length === right.length && new Set(left).size === new Set(right).size && left.every(id => right.includes(id))
const canonicalTrace = (state: EvolutionState, id: string) => resolveIdentity(state, 'trace', id)
const moduleForTarget = (record: EvolutionRecord) => record.target.governanceObject
const targetKey = (record: EvolutionRecord) => JSON.stringify(record.target.kind === 'SKILL'
  ? [record.target.kind, record.target.governanceObject, record.target.skillId, record.target.skillVersion, record.target.attributionId]
  : [record.target.kind, record.target.governanceObject, record.target.targetId, record.target.targetVersion ?? null, record.target.attributionId])
const pathSourceKey = (path: ModuleEvolutionPath) => JSON.stringify([path.binding?.packageId ?? null, path.binding?.moduleScoreId ?? null, path.binding?.automaticRevisionId ?? null, path.id])
const findingModuleMatches = (record: EvolutionRecord, finding: EvaluationFinding) => {
  const module = moduleForTarget(record)
  return module === 'OTHER_BADCASE' || module.toUpperCase() === finding.moduleCode || (module === 'Act' && finding.moduleCode === 'TOOL')
}
const dimensionMatches = (record: EvolutionRecord, value?: string) => evolutionItemId(value) === record.target.attributionId
const attributionDimensionMatches = (record: EvolutionRecord, item: Attribution) => dimensionMatches(record, evolutionItemId(item.dimensionCode) ?? item.dimension)
const findingDimensionMatches = (record: EvolutionRecord, item: EvaluationFinding) => dimensionMatches(record, evolutionItemId(item.dimensionCode) ?? item.dimensionLabel)

function exactAttribution(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding, id?: string) {
  const candidates = state.attributions.filter(item => record.sourceAttributionIds.includes(item.id) && (!id || item.id === id) && canonicalTrace(state, item.traceId) === canonicalTrace(state, finding.traceId) && item.caseId === finding.caseId && attributionDimensionMatches(record, item) && (item.module === moduleForTarget(record) || moduleForTarget(record) === 'OTHER_BADCASE'))
  return candidates.length === 1 ? candidates[0] : undefined
}

function sourceFindingValid(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding) {
  const pkg = state.tracePackages.find(item => item.id === finding.packageId)
  return Boolean(pkg && canonicalTrace(state, pkg.traceId) === canonicalTrace(state, finding.traceId) && pkg.caseId === finding.caseId && record.sourceFindingIds.includes(finding.id) && findingModuleMatches(record, finding) && findingDimensionMatches(record, finding))
}

function eventTime(state: EvolutionState, kind: GovernanceReference['kind'], id: string, code?: string, traceId?: string) {
  const events = (state.governanceEvents ?? []).filter(item => item.relationType === 'TRACE_SOURCE' && validTime(item.occurredAt) && (!traceId || canonicalTrace(state, item.traceId) === canonicalTrace(state, traceId)) && (!code || item.statusCode === code) && (item.sourceRef?.kind === kind && item.sourceRef.id === id))
  return latest(events, item => item.occurredAt)?.occurredAt
}

/** Each candidate in this record must have its own single-variant approval.
 * A different candidate's report cannot qualify the window; decisions after
 * this window's report also cannot retroactively validate its prerequisites. */
function windowSinglePrerequisites(experiment: Experiment, variants: Variant[], experiments: Experiment[], decisions: GateDecision[], windowDecision: GateDecision) {
  const included = variants.filter(variant => experiment.variantIds.includes(variant.id))
  return included.length > 0 && included.every(variant => {
    const singles = experiments.filter(item => item.level === 'SINGLE_VARIANT' && sameIds(item.variantIds, [variant.id]) && item.candidateVersion === variant.candidateVersion)
    const related = decisions.filter(item => singles.some(single => single.id === item.experimentId) && validTime(item.decidedAt) && validTime(windowDecision.decidedAt) && Date.parse(item.decidedAt) <= Date.parse(windowDecision.decidedAt))
    return latest(related, item => item.decidedAt)?.conclusion === 'PASS'
  })
}

function recordObjects(state: EvolutionState, record: EvolutionRecord, findings: EvaluationFinding[]) {
  const warnings: string[] = []
  const attrIds = new Set(findings.flatMap(finding => state.attributions.filter(item => record.sourceAttributionIds.includes(item.id) && canonicalTrace(state, item.traceId) === canonicalTrace(state, finding.traceId) && item.caseId === finding.caseId && attributionDimensionMatches(record, item)).map(item => item.id)))
  const issues = state.issues.filter(item => record.sourceIssueIds.includes(item.id) && attrIds.has(item.attributionId) && dimensionMatches(record, item.dimension) && findings.some(finding => finding.caseId === item.caseId))
  const clusters = state.issueClusters.filter(item => record.sourceClusterIds.includes(item.id) && dimensionMatches(record, item.dimension) && issues.some(issue => item.issueIds.includes(issue.id)))
  const variants = state.variants.filter(item => {
    if (!record.variantIds.includes(item.id)) return false
    const source = item.sourceIssueIds.some(id => issues.some(issue => issue.id === id)) || item.sourceClusterIds.some(id => clusters.some(cluster => cluster.id === id))
    const module = moduleForTarget(record)
    if (!source || (module !== 'OTHER_BADCASE' && item.targetModule !== module)) return false
    if (record.target.kind === 'SKILL') {
      const target = record.target
      return item.targets?.length ? item.targets.some(value => value.skillId === target.skillId && normalizeSkillVersion(value.skillVersion ?? value.skillVersionId) === normalizeSkillVersion(target.skillVersion) && dimensionMatches(record, value.attributionId ?? value.evolutionItemId)) : normalizeSkillVersion(item.currentVersion) === normalizeSkillVersion(target.skillVersion)
    }
    return !record.target.targetVersion || normalizeSkillVersion(item.currentVersion) === normalizeSkillVersion(record.target.targetVersion)
  })
  const datasets = state.datasets.filter(item => record.datasetIds.includes(item.id))
  const experiments = state.experiments.filter(item => {
    const expectedLevel = record.singleExperimentIds.includes(item.id) ? 'SINGLE_VARIANT' : record.windowExperimentIds.includes(item.id) ? 'WINDOW_COMBINATION' : undefined
    if (!expectedLevel || item.level !== expectedLevel || !item.variantIds.some(id => variants.some(variant => variant.id === id))) return false
    if (!item.datasetIds.length || !item.datasetIds.every(id => datasets.some(dataset => dataset.id === id))) return false
    const versions = item.configSnapshot.datasetVersions
    if (!sameIds(item.datasetIds, versions.map(version => version.datasetId)) || versions.some(version => !version.version)) return false
    if (item.level === 'SINGLE_VARIANT') return item.variantIds.length === 1 && variants.some(variant => variant.id === item.variantIds[0] && variant.candidateVersion === item.candidateVersion && normalizeSkillVersion(variant.currentVersion) === normalizeSkillVersion(item.baselineVersion))
    const window = state.windows.find(value => value.id === item.windowId)
    if (!window || window.combinationExperimentId !== item.id || !sameIds(window.candidateVariantIds, item.variantIds)) return false
    const snapshot = item.configSnapshot.windowSnapshot
    return !snapshot || snapshot.windowId === window.id && sameIds(snapshot.candidateVariantIds, item.variantIds)
  })
  const reportDecisions = state.gateDecisions.filter(item => {
    if (!record.decisionIds.includes(item.id)) return false
    const experiment = experiments.find(value => value.id === item.experimentId)
    if (!experiment || (experiment.gateDecisionId && experiment.gateDecisionId !== item.id) || !['COMPLETED', 'DECIDED'].includes(experiment.status)) return false
    const snapshot = item.reportSnapshot
    if (snapshot.experimentId && snapshot.experimentId !== experiment.id || !sameIds(snapshot.variantIds, experiment.variantIds)) return false
    const versions = experiment.configSnapshot.datasetVersions
    if (snapshot.datasetVersions.length !== versions.length || !versions.every(version => snapshot.datasetVersions.some(value => value.datasetId === version.datasetId && value.version === version.version))) return false
    // Optional immutable report config must agree with the experiment config;
    // legacy reports without it retain their explicit variant/dataset proofs.
    if (snapshot.configSnapshot && JSON.stringify(snapshot.configSnapshot) !== JSON.stringify(experiment.configSnapshot)) return false
    return true
  })
  const windowPrerequisiteMissingIds = reportDecisions.filter(item => item.conclusion === 'PASS').flatMap(item => {
    const experiment = experiments.find(value => value.id === item.experimentId)!
    return experiment.level === 'WINDOW_COMBINATION' && !windowSinglePrerequisites(experiment, variants, experiments, reportDecisions, item) ? [experiment.id] : []
  })
  const decisions = reportDecisions.filter(item => !windowPrerequisiteMissingIds.includes(item.experimentId))
  for (const id of windowPrerequisiteMissingIds) warnings.push(`窗口实验 ${id} 的目标候选未通过对应单能力报告，未将窗口结论用于当前准出。`)
  const releases = state.releases.filter(item => {
    if (!record.releaseIds.includes(item.id) || !item.variantIds.some(id => variants.some(variant => variant.id === id))) return false
    const experiment = experiments.find(value => value.id === item.combinationExperimentId && value.level === 'WINDOW_COMBINATION')
    // Publication is an actual external state. An incomplete single-variant
    // prerequisite cannot erase a recorded publication of this exact window.
    const decision = reportDecisions.find(value => value.id === item.gateDecisionId && value.experimentId === experiment?.id && value.conclusion === 'PASS')
    return Boolean(experiment && decision && item.windowId === experiment.windowId && sameIds(item.variantIds, experiment.variantIds))
  })
  for (const release of releases) {
    const decision = reportDecisions.find(item => item.id === release.gateDecisionId)
    if (decision && validTime(release.releasedAt) && validTime(decision.decidedAt) && Date.parse(release.releasedAt) < Date.parse(decision.decidedAt)) warnings.push(`发布版本 ${release.id} 的记录上线时间早于准出时间；历史时间存在冲突，保留实际发布记录供复核。`)
  }
  for (const [label, requested, found] of [['变体', record.variantIds, variants], ['实验', [...record.singleExperimentIds, ...record.windowExperimentIds], experiments], ['准出报告', record.decisionIds, decisions], ['发布版本', record.releaseIds, releases]] as const) {
    for (const id of requested) if (!found.some(item => item.id === id)) warnings.push(`${label} ${id} 来源或配置不匹配，未用于当前状态。`)
  }
  return { issues, clusters, variants, datasets, experiments, decisions, releases, warnings, windowPrerequisiteMissingIds }
}

function eligibilityFor(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding, attribution: Attribution | undefined, objects: ReturnType<typeof recordObjects>): EvolutionStage {
  const refs = [ref('finding', finding.id), ...(attribution ? [ref('attribution', attribution.id)] : [])]
  if (finding.status === 'REJECTED' || attribution?.status === 'REJECTED') return stage('REJECTED', '不进入进化', '归因已被人工拒绝。', refs, eventTime(state, attribution ? 'attribution' : 'finding', attribution?.id ?? finding.id, 'REJECTED', finding.traceId))
  const confirmed = attribution ? attribution.confirmed && attribution.status === 'CONFIRMED' : ['CONFIRMED', 'RESOLVED'].includes(finding.status)
  const at = attribution ? latest(attribution.revisions.filter(item => item.confirmed && item.status === 'CONFIRMED'), item => item.revisedAt)?.revisedAt ?? eventTime(state, 'attribution', attribution.id, 'CONFIRMED', finding.traceId) : eventTime(state, 'finding', finding.id, 'CONFIRMED', finding.traceId)
  if (!confirmed) return stage('PENDING', '待确认', '分数仅作候选线索；需确认归因及证据。', refs)
  const definition = EVOLUTION_ITEMS.find(item => item.id === record.target.attributionId)
  const mode = record.optimizationMode ?? attribution?.optimizationMode
  const allowed = mode === 'DIRECT_FIX' ? definition?.condition.includes('直接优化') : mode === 'CLUSTER_OPTIMIZATION' ? definition?.condition.includes('聚类优化') : false
  if (!allowed) return stage('UNKNOWN', '优化方式待确认', '当前方式与 PRD 归因条件不一致，或优化方式尚未记录。', refs, at)
  if (mode === 'DIRECT_FIX') return stage('CONFIRMED', '可直接优化', '归因和证据已确认；PRD 允许单 Case 直接优化，仍需验证。', refs, at)
  const cluster = latest(objects.clusters, item => item.createdAt)
  const ruleId = record.triggerRuleId ?? cluster?.triggerRuleId
  const rule = state.rules.find(item => item.id === ruleId && item.category === 'TRIGGER' && item.status === 'CONFIGURED')
  const taste = cluster?.triggerRuleId === 'rule-taste-100' ? selectTasteLibraryTrigger(state, cluster.id) : undefined
  const count = taste?.totalCount ?? cluster?.currentCount
  const threshold = rule && typeof rule.value === 'number' && Number.isFinite(rule.value) && rule.value > 0 ? rule.value : undefined
  const countingRule = cluster?.countingRule
  const clusterRefs = [...refs, ...(cluster ? [ref('cluster', cluster.id)] : []), ...(rule ? [ref('rule', rule.id)] : [])]
  const details = { count, threshold, unit: rule?.unit ?? '相关 Case', countingRule }
  const tasteScopeMatches = !taste || record.target.kind === 'SKILL' && taste.skillId === record.target.skillId && threshold === 100
  if (!rule || threshold === undefined || !cluster || !countingRule || count === undefined || !Number.isFinite(count) || !tasteScopeMatches || record.triggerRuleId && cluster.triggerRuleId !== record.triggerRuleId) return { ...stage('UNKNOWN', '规则待配置', '聚类门槛、确认数量或统计口径未明确；不按低分或偏好用户比例推断。', clusterRefs, at), ...details }
  const eligible = count >= threshold
  return { ...stage(eligible ? 'CONFIRMED' : 'PENDING', eligible ? '条件满足' : '积累中', `${count} / ${threshold} ${rule.unit ?? '相关 Case'}；${countingRule}`, clusterRefs, cluster.tastePopulation?.countedAt ?? eventTime(state, 'cluster', cluster.id, eligible ? 'READY' : 'COLLECTING', finding.traceId)), ...details }
}

function exactDeliveries(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding) {
  return state.routingDeliveries.filter(item => {
    if (!record.routingDeliveryIds.includes(item.id) || item.findingId !== finding.id || item.packageId !== finding.packageId || item.caseId !== finding.caseId || canonicalTrace(state, item.traceId) !== canonicalTrace(state, finding.traceId)) return false
    const decision = state.routingDecisions.find(value => value.id === item.decisionId && value.findingId === finding.id && value.packageId === finding.packageId && canonicalTrace(state, value.traceId) === canonicalTrace(state, finding.traceId))
    return Boolean(decision && decision.label === item.label && decision.destination === item.destination && decision.deliveryIds.includes(item.id) && finding.routingDeliveryIds.includes(item.id))
  })
}

function routingFor(state: EvolutionState, finding: EvaluationFinding, delivery?: RoutingDelivery): EvolutionStage {
  if (!delivery) return stage('PENDING', '待分流', '没有与本轮归因明确关联的分流记录。', [ref('finding', finding.id)])
  const refs = [ref('routing-delivery', delivery.id), ref('routing-decision', delivery.decisionId), ...(delivery.queueId ? [ref('badcase-queue', delivery.queueId)] : []), ...(delivery.issueId ? [ref('issue', delivery.issueId)] : []), ...(delivery.issueClusterId ? [ref('cluster', delivery.issueClusterId)] : [])]
  const labels: Record<RoutingDelivery['status'], string> = { PENDING: '待分流', QUEUED: '等待接收', DELIVERED: '已分流', ACKNOWLEDGED: delivery.label === '策略迭代' ? '已接收，等待回传' : '处理中', REJECTED: '分流被拒绝', RESOLVED: '已处理' }
  const at = eventTime(state, 'routing-delivery', delivery.id, delivery.status, finding.traceId) ?? (delivery.status === 'ACKNOWLEDGED' ? delivery.acknowledgedAt : delivery.status === 'DELIVERED' ? delivery.deliveredAt : undefined)
  return stage(delivery.status, labels[delivery.status], `${delivery.label} · ${delivery.owner ?? '责任人未记录'}${delivery.note ? ` · ${delivery.note}` : ''}`, refs, at)
}

function experimentGate(state: EvolutionState, finding: EvaluationFinding, experiments: Experiment[], decisions: GateDecision[], level: Experiment['level']): EvolutionStage {
  const experiment = latest(experiments.filter(item => item.level === level), item => item.createdAt)
  if (!experiment) return stage('PENDING', '尚未进入', '本轮没有准确关联的实验。')
  const refs = [ref('experiment', experiment.id), ...(experiment.windowId ? [ref('window', experiment.windowId)] : [])]
  const decision = latest(decisions.filter(item => item.experimentId === experiment.id), item => item.decidedAt)
  if (decision) {
    const label = decision.conclusion === 'PASS' ? '已准出' : decision.conclusion === 'REJECT' ? '不准出' : '人工复核'
    return stage(decision.conclusion === 'REJECT' ? 'REJECTED' : decision.conclusion, label, decision.reason, [...refs, ref('decision', decision.id)], validTime(decision.decidedAt) ? decision.decidedAt : undefined)
  }
  const labels: Record<Experiment['status'], string> = { DRAFT: '待运行', QUEUED: '待运行', RUNNING: '评测中', COMPLETED: '待决策', FAILED: '实验失败', DECIDED: '准出记录未关联' }
  return stage(experiment.status === 'FAILED' ? 'FAILED' : experiment.status === 'RUNNING' ? 'RUNNING' : experiment.status === 'DRAFT' || experiment.status === 'QUEUED' ? 'QUEUED' : 'PENDING', labels[experiment.status], '只使用本轮候选和相同配置的实验与准出记录。', refs, eventTime(state, 'experiment', experiment.id, experiment.status, finding.traceId))
}

function releaseFor(state: EvolutionState, finding: EvaluationFinding, releases: ReleaseVersion[], windowGate: EvolutionStage): EvolutionStage {
  const release = latest(releases, item => item.createdAt)
  if (!release) return windowGate.code === 'PASS' ? stage('PENDING', '待发布', '本轮已准出，没有实际发布记录。') : stage('UNKNOWN', '尚未进入', '上线需明确关联通过窗口验证的实际发布记录。')
  const labels: Record<ReleaseVersion['status'], string> = { PENDING: '待发布', CANARY: '灰度', RELEASED: '正式上线', OBSERVING: '观察中', ROLLED_BACK: '已回滚' }
  const at = eventTime(state, 'release', release.id, release.status, finding.traceId) ?? (['CANARY', 'RELEASED'].includes(release.status) && validTime(release.releasedAt) ? release.releasedAt : undefined)
  return stage(release.status, labels[release.status], `${release.version}${release.rollbackReason ? ` · ${release.rollbackReason}` : ''}`, [ref('release', release.id), ...(release.rollbackVersionId ? [ref('release', release.rollbackVersionId)] : [])], at)
}

function pathHistory(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding, attribution: Attribution | undefined, delivery: RoutingDelivery | undefined, objects: ReturnType<typeof recordObjects>): EvolutionHistoryEntry[] {
  const entries: EvolutionHistoryEntry[] = []
  const add = (id: string, stageName: string, label: string, description: string, at: string | undefined, refs: GovernanceReference[]) => entries.push({ id, stage: stageName, label, description, at: validTime(at) ? at : undefined, refs })
  add(`record:${record.id}`, 'ELIGIBILITY', '本轮进化建立', record.name, record.createdAt, [ref('finding', finding.id)])
  for (const revision of attribution?.revisions ?? []) add(`attribution-revision:${revision.id}`, 'ELIGIBILITY', revision.confirmed ? '归因确认' : '归因修订', revision.reason, revision.revisedAt, [ref('attribution', attribution!.id)])
  for (const issue of objects.issues) add(`issue-created:${issue.id}`, 'ISSUE', '问题建立', issue.title, issue.createdAt, [ref('issue', issue.id)])
  for (const cluster of objects.clusters) add(`cluster-created:${cluster.id}`, 'CLUSTER', '问题簇建立', cluster.name, cluster.createdAt, [ref('cluster', cluster.id)])
  for (const variant of objects.variants) add(`variant-created:${variant.id}`, 'VARIANT', '候选变体建立', `${variant.name} · ${variant.currentVersion} → ${variant.candidateVersion}`, variant.createdAt, [ref('variant', variant.id)])
  if (delivery?.deliveredAt) add(`delivered:${delivery.id}`, 'ROUTING', '已分流', `${delivery.label} · ${delivery.note ?? ''}`, delivery.deliveredAt, [ref('routing-delivery', delivery.id)])
  if (delivery?.acknowledgedAt) add(`acknowledged:${delivery.id}`, 'ROUTING', '已接收', delivery.owner ?? '接收责任人未记录', delivery.acknowledgedAt, [ref('routing-delivery', delivery.id)])
  for (const membership of (state.datasetMemberships ?? []).filter(item => record.datasetIds.includes(item.datasetId) && item.scope === 'TRACE' && item.traceIds.some(id => canonicalTrace(state, id) === canonicalTrace(state, finding.traceId)))) {
    const dataset = objects.datasets.find(item => item.id === membership.datasetId)
    add(`membership:${membership.id}`, 'DATASET', '纳入数据集', `${dataset?.name ?? membership.datasetId} · ${membership.datasetVersion} · ${dataset?.purpose ?? '用途未记录'}`, membership.joinedAt, [ref('dataset', membership.datasetId)])
  }
  for (const experiment of objects.experiments) add(`experiment-created:${experiment.id}`, 'GATE', '实验配置建立', `${experiment.name} · ${experiment.level === 'SINGLE_VARIANT' ? '单能力变体实验' : '窗口版本实验'}，运行状态时间单独记录。`, experiment.createdAt, [ref('experiment', experiment.id)])
  for (const decision of objects.decisions) add(`decision:${decision.id}`, 'GATE', decision.conclusion === 'PASS' ? '已准出' : decision.conclusion === 'REJECT' ? '不准出' : '人工复核', decision.reason, decision.decidedAt, [ref('decision', decision.id), ref('experiment', decision.experimentId)])
  for (const release of objects.releases) {
    if (release.releasedAt) add(`publication:${release.id}`, 'RELEASE', '上线记录', release.version, release.releasedAt, [ref('release', release.id)])
    if (release.status !== 'RELEASED') add(`release-status:${release.id}`, 'RELEASE', release.status === 'ROLLED_BACK' ? '已回滚' : release.status === 'CANARY' ? '灰度' : release.status === 'OBSERVING' ? '观察中' : '待发布', release.rollbackReason ?? release.version, eventTime(state, 'release', release.id, release.status, finding.traceId), [ref('release', release.id)])
  }
  const sourceKeys = new Set([`finding:${finding.id}`, ...(attribution ? [`attribution:${attribution.id}`] : []), ...(delivery ? [`routing-delivery:${delivery.id}`, `routing-decision:${delivery.decisionId}`] : []), ...objects.issues.map(item => `issue:${item.id}`), ...objects.clusters.map(item => `cluster:${item.id}`), ...objects.variants.map(item => `variant:${item.id}`), ...objects.experiments.map(item => `experiment:${item.id}`), ...objects.decisions.map(item => `decision:${item.id}`), ...objects.releases.map(item => `release:${item.id}`)])
  for (const event of (state.governanceEvents ?? []).filter(item => item.relationType === 'TRACE_SOURCE' && canonicalTrace(state, item.traceId) === canonicalTrace(state, finding.traceId) && item.sourceRef && sourceKeys.has(`${item.sourceRef.kind}:${item.sourceRef.id}`))) {
    if (entries.some(item => item.at === event.occurredAt && item.refs.some(value => value.kind === event.sourceRef?.kind && value.id === event.sourceRef.id))) continue
    add(`event:${event.id}`, event.stage, event.statusCode, event.description, event.occurredAt, event.targetRefs.length ? event.targetRefs : [event.sourceRef!])
  }
  return entries.sort((a, b) => a.at && b.at ? Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id) : a.at ? -1 : b.at ? 1 : a.id.localeCompare(b.id))
}

function buildPaths(state: EvolutionState, record: EvolutionRecord, finding: EvaluationFinding, binding?: ModuleEvolutionBinding): ModuleEvolutionPath[] {
  const attribution = exactAttribution(state, record, finding, binding?.attributionRecordId)
  if (binding?.attributionRecordId && !attribution) return []
  const objects = recordObjects(state, record, [finding])
  const deliveries = exactDeliveries(state, record, finding)
  const eligibility = eligibilityFor(state, record, finding, attribution, objects)
  return (deliveries.length ? deliveries : [undefined]).map(delivery => {
    // A record can carry parallel deliveries for compatibility. A shared record
    // does not prove the strategy branch received the Agent's reports. Only an
    // explicit branch variant/source edge can scope its downstream objects.
    let branchObjects = objects
    if (deliveries.length > 1 && delivery) {
      const variants = objects.variants.filter(item => delivery.variantId ? item.id === delivery.variantId : delivery.label !== '策略迭代' && (item.sourceIssueIds.includes(delivery.issueId ?? '') || item.sourceClusterIds.includes(delivery.issueClusterId ?? '')))
      const experiments = objects.experiments.filter(item => item.variantIds.some(id => variants.some(variant => variant.id === id)))
      const decisions = objects.decisions.filter(item => experiments.some(experiment => experiment.id === item.experimentId))
      const releases = objects.releases.filter(item => experiments.some(experiment => experiment.id === item.combinationExperimentId) && decisions.some(decision => decision.id === item.gateDecisionId))
      branchObjects = { ...objects, variants, experiments, decisions, releases, warnings: [...objects.warnings, ...(!variants.length && objects.variants.length ? ['并行分流未关联本分支候选与报告，未借用其它分支结果。'] : [])] }
    }
    const latestWindow = latest(branchObjects.experiments.filter(item => item.level === 'WINDOW_COMBINATION'), item => item.createdAt)
    const relevantSingles = latestWindow ? branchObjects.experiments.filter(item => item.level !== 'SINGLE_VARIANT' || item.variantIds.some(id => latestWindow.variantIds.includes(id))) : branchObjects.experiments
    const singleGate = experimentGate(state, finding, relevantSingles, branchObjects.decisions, 'SINGLE_VARIANT')
    const candidateWindowGate = experimentGate(state, finding, branchObjects.experiments, branchObjects.decisions, 'WINDOW_COMBINATION')
    const windowGate = latestWindow && branchObjects.windowPrerequisiteMissingIds.includes(latestWindow.id) ? stage('PENDING', '单能力准出未确认', '窗口所含的本轮目标候选未逐一通过各自的单能力实验；不能借用其它候选的通过结论。', candidateWindowGate.refs) : candidateWindowGate
    const routing = routingFor(state, finding, delivery)
    const waitingStrategy = delivery?.label === '策略迭代' && delivery.status === 'ACKNOWLEDGED' && !branchObjects.experiments.length
    const gate = waitingStrategy ? stage('PENDING', '等待回传', '策略团队尚未回传本轮验证和准出结果。', routing.refs) : branchObjects.experiments.some(item => item.level === 'WINDOW_COMBINATION') ? windowGate : singleGate
    const release = releaseFor(state, finding, branchObjects.releases, windowGate)
    return { id: `${record.id}:${finding.id}:${delivery?.id ?? 'unrouted'}`, record, finding, binding, attribution, delivery, label: `${evolutionItemLabel(record.target.attributionId)} · ${delivery?.label ?? '待分流'}`, isHistorical: false, eligibility, routing, gate, singleGate, windowGate, release, history: pathHistory(state, record, finding, attribution, delivery, branchObjects), datasets: branchObjects.datasets, experiments: branchObjects.experiments, decisions: branchObjects.decisions, releases: branchObjects.releases, warnings: branchObjects.warnings }
  })
}

export function selectModuleEvolution(state: EvolutionState, query: ModuleEvolutionQuery): ModuleEvolutionSelection {
  const traceId = canonicalTrace(state, query.traceId)
  const pkg = state.tracePackages.find(item => item.id === query.packageId && canonicalTrace(state, item.traceId) === traceId)
  const score = pkg?.moduleScores.find(item => item.id === query.moduleScoreId && item.packageId === pkg.id && canonicalTrace(state, item.traceId) === traceId)
  const empty: ModuleEvolutionSelection = { currentPaths: [], historicalPaths: [], summary: '未关联进化路径', missingReason: '当前评分未关联明确的归因与进化轮次。', contextOnly: false }
  if (!score || !pkg) return { ...empty, missingReason: 'Trace、评测包或模块评分不匹配。' }
  if (score.moduleCode === 'CONTEXT') return { ...empty, contextOnly: true, summary: '仅作上文证据', missingReason: '上文仅作为证据；需求待补充，不独立评分或判断进化。' }
  const revision = query.automaticRevisionId ?? automaticModuleRevisionId(score)
  const paths: ModuleEvolutionPath[] = []
  for (const binding of (state.moduleEvolutionBindings ?? []).filter(item => canonicalTrace(state, item.traceId) === traceId && (!query.processEvaluationId || item.processEvaluationId === query.processEvaluationId) && (!query.scoreDimensionId || item.scoreDimensionId === query.scoreDimensionId))) {
    const sourcePackage = state.tracePackages.find(item => item.id === binding.packageId && canonicalTrace(state, item.traceId) === traceId && item.caseId === pkg.caseId)
    const sourceScore = sourcePackage?.moduleScores.find(item => item.id === binding.moduleScoreId && item.packageId === sourcePackage.id && canonicalTrace(state, item.traceId) === traceId && item.caseId === pkg.caseId && item.moduleCode === score.moduleCode)
    if (!sourcePackage || !sourceScore || !binding.automaticRevisionId.trim()) continue
    const samePackage = sourcePackage.id === pkg.id
    if (samePackage && sourceScore.id !== score.id) continue
    // Other packages are immutable historical sources, never current results.
    // The timestamp is package creation, not its later human-review updatedAt.
    if (!samePackage && (!validTime(sourcePackage.createdAt) || !validTime(pkg.createdAt) || Date.parse(sourcePackage.createdAt) > Date.parse(pkg.createdAt))) continue
    if (binding.processEvaluationId && !state.processEvals.some(item => item.id === binding.processEvaluationId && canonicalTrace(state, item.traceId) === traceId && item.caseId === pkg.caseId)) continue
    const finding = state.evaluationFindings.find(item => item.id === binding.findingId && item.packageId === sourcePackage.id && canonicalTrace(state, item.traceId) === traceId && item.caseId === pkg.caseId && item.moduleCode === score.moduleCode)
    if (!finding) continue
    for (const id of binding.evolutionRecordIds) {
      const record = state.evolutionRecords?.find(item => item.id === id)
      if (!record || !sourceFindingValid(state, record, finding)) continue
      paths.push(...buildPaths(state, record, finding, binding).map(item => ({ ...item, isHistorical: !samePackage || binding.automaticRevisionId !== revision })))
    }
  }
  const pathMap = new Map<string, ModuleEvolutionPath>()
  for (const path of paths) {
    const key = pathSourceKey(path)
    if (!pathMap.has(key)) pathMap.set(key, path)
  }
  const unique = [...pathMap.values()]
  for (const path of unique) if (unique.some(item => !item.isHistorical && item.record.supersedesRecordId === path.record.id && targetKey(item.record) === targetKey(path.record))) path.isHistorical = true
  const currentPaths = unique.filter(item => !item.isHistorical)
  const historicalPaths = unique.filter(item => item.isHistorical)
  const status = (path: ModuleEvolutionPath) => path.release.code !== 'UNKNOWN' ? path.release.label : path.gate.code !== 'PENDING' || path.gate.label === '等待回传' ? path.gate.label : path.routing.code !== 'PENDING' ? path.routing.label : path.eligibility.label
  const summary = currentPaths.length ? `${currentPaths.length} 条路径：${[...new Set(currentPaths.map(status))].join(' / ')}` : historicalPaths.length ? '当前未关联，存在历史进化路径' : empty.summary
  return { currentPaths, historicalPaths, summary, missingReason: currentPaths.length ? undefined : empty.missingReason, contextOnly: false }
}

/** Destination branches are independent paths inside one precise direction.
 * Skill source versions and module target versions remain separate groups. */
export function groupModuleEvolutionDirections(selection: ModuleEvolutionSelection): ModuleEvolutionDirection[] {
  const groups = new Map<string, ModuleEvolutionDirection>()
  for (const [kind, paths] of [['currentPaths', selection.currentPaths], ['historicalPaths', selection.historicalPaths]] as const) {
    for (const path of paths) {
      const id = targetKey(path.record)
      let group = groups.get(id)
      if (!group) {
        group = { id, target: path.record.target, attributionId: path.record.target.attributionId, currentPaths: [], historicalPaths: [] }
        groups.set(id, group)
      }
      const key = pathSourceKey(path)
      if (!group[kind].some(item => pathSourceKey(item) === key)) group[kind].push(path)
    }
  }
  return [...groups.values()]
}

export function selectEvolutionRecord(state: EvolutionState, recordId: string): EvolutionRecordProjection | undefined {
  const record = state.evolutionRecords?.find(item => item.id === recordId)
  if (!record) return undefined
  const findings = state.evaluationFindings.filter(item => sourceFindingValid(state, record, item))
  const paths = findings.flatMap(finding => {
    const binding = state.moduleEvolutionBindings?.find(item => item.evolutionRecordIds.includes(record.id) && item.findingId === finding.id && item.packageId === finding.packageId && canonicalTrace(state, item.traceId) === canonicalTrace(state, finding.traceId))
    return buildPaths(state, record, finding, binding)
  })
  const objects = recordObjects(state, record, findings)
  return { record, paths, datasets: objects.datasets, experiments: objects.experiments, decisions: objects.decisions, releases: objects.releases, warnings: [...objects.warnings, ...(!findings.length ? ['来源 Finding 未匹配；不能将其它 Case 或 Skill 的结果作为本轮结论。'] : [])] }
}

export function buildEvolutionWorkbenchHref(record: EvolutionRecord, view: 'datasets' | 'history', returnTo?: string): string {
  const params = new URLSearchParams({ view, governanceObject: record.target.governanceObject, attribution: record.target.attributionId, evolutionRecordId: record.id })
  if(returnTo){const source=new URL(returnTo,'http://local.demo');for(const key of ['timeRange','environment','agentVersion','businessType']){const value=source.searchParams.get(key);if(value)params.set(key,value)}}
  if (record.target.kind === 'SKILL') {
    params.set('skill', record.target.skillId); params.set('skillVersion', record.target.skillVersion)
    params.set('targetId', record.target.skillId); params.set('targetVersion', record.target.skillVersion)
  } else {
    params.set('targetId', record.target.targetId)
    if (record.target.targetVersion) params.set('targetVersion', record.target.targetVersion)
  }
  if (returnTo) params.set('returnTo', returnTo)
  return `/datasets-evaluations?${params.toString()}`
}
