import type { AuditEvent, DatasetMembershipRecord, EvolutionState, GovernanceReference, TraceGovernanceEvent } from '../domain'
import { resolveIdentity } from '../identity'

export const GOVERNANCE_STAGE_LABELS: Record<string, string> = {
  TASK: '任务产生', EVALUATION: '过程 / 产物评测', REVIEW: '人工复核', ATTRIBUTION: '归因', ROUTING: '分流',
  DATASET: '加入数据集', DIRECT_FIX: '直接修复', CLUSTER: '问题簇', VARIANT: '能力变体',
  EXPERIMENT: '单能力实验', WINDOW_EXPERIMENT: '窗口实验', GATE: '准出', RELEASE: '发布 / 回滚'
}
const statusLabels: Record<string, string> = { RELEASED: '已发布', ROLLED_BACK: '已回滚', PENDING: '待处理', OPEN: '待处理', QUEUED: '待运行', RUNNING: '进行中', FIXING: '修复中', FAILED: '失败', FAIL: '失败', REJECT: '拒绝', REJECTED: '已拒绝', MANUAL_REVIEW: '待人工复核', PASS: '通过', CONFIRMED: '已确认', RESOLVED: '已解决', VERIFIED: '已验证', COMPLETED: '已完成', REVIEWED: '已复核', DELIVERED: '已分流', ACKNOWLEDGED: '已接收', DRAFT: '草稿', OBSERVING: '观察中', CANARY: '灰度中' }
export const governanceStageLabel = (stage: string) => GOVERNANCE_STAGE_LABELS[stage] ?? stage
export function formatGovernanceTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '时间未记录'
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} GMT+8`
}
export interface TraceGovernanceMembership extends DatasetMembershipRecord {
  name: string; purpose: string; frozen: boolean; source: string; experimentIds: string[]
  relationType: TraceGovernanceEvent['relationType']
}
export interface TraceGovernanceHistory {
  events: TraceGovernanceEvent[]
  branches: Array<{ id: string; label: string; currentEvent?: TraceGovernanceEvent }>
  memberships: TraceGovernanceMembership[]
  currentLabel: string
  lastOccurredAt?: string
  reviewModuleIds?: Record<string, string>
}
const ref = (kind: GovernanceReference['kind'], id: string): GovernanceReference => ({ kind, id })
const time = (value?: string) => value && Number.isFinite(Date.parse(value)) ? value : undefined
const chronological = (a: TraceGovernanceEvent, b: TraceGovernanceEvent) => {
  const at = time(a.occurredAt), bt = time(b.occurredAt)
  if (at && bt) return Date.parse(at) - Date.parse(bt) || a.id.localeCompare(b.id)
  return at ? -1 : bt ? 1 : a.id.localeCompare(b.id)
}
const uniqueEvents = (events: TraceGovernanceEvent[]) => {
  const seen = new Set<string>()
  return [...events].sort((a, b) => a.id.localeCompare(b.id)).filter(event => {
    const key = event.sourceEventId ? `${event.sourceEventId}|${event.traceId}|${event.branchId ?? ''}|${event.stage}|${event.sourceRef?.kind ?? ''}|${event.sourceRef?.id ?? ''}|${event.relationType}` : event.id
    if (seen.has(key)) return false
    seen.add(key); return true
  }).sort(chronological)
}

/** Direct provenance is proved by a Finding/Attribution/Issue edge, never by Case membership alone. */
function traceRelations(state: EvolutionState, traceId: string) {
  const trace = state.traces.find(item => item.id === traceId)
  const attributions = state.attributions.filter(item => item.traceId === traceId)
  const deliveries = state.routingDeliveries.filter(item => item.traceId === traceId)
  const issues = state.issues.filter(item => attributions.some(attribution => attribution.id === item.attributionId) || deliveries.some(delivery => delivery.issueId === item.id))
  const clusters = state.issueClusters.filter(item => item.issueIds.some(id => issues.some(issue => issue.id === id)) || deliveries.some(delivery => delivery.issueClusterId === item.id))
  const directVariants = state.variants.filter(item => item.sourceIssueIds.some(id => issues.some(issue => issue.id === id)) || item.sourceClusterIds.some(id => clusters.some(cluster => cluster.id === id)) || deliveries.some(delivery => delivery.variantId === item.id))
  const sharedVariants = state.variants.filter(item => !directVariants.includes(item) && Boolean(trace && item.sourceCaseIds.includes(trace.caseId)))
  const datasetIds = state.datasets.filter(item => trace && item.caseIds.includes(trace.caseId)).map(item => item.id)
  const relationForExperiment = (experiment: EvolutionState['experiments'][number]): TraceGovernanceEvent['relationType'] | undefined =>
    experiment.variantIds.some(id => directVariants.some(variant => variant.id === id)) ? 'TRACE_SOURCE'
      : experiment.variantIds.some(id => sharedVariants.some(variant => variant.id === id)) ? 'CASE_SHARED'
      : experiment.datasetIds.some(id => datasetIds.includes(id)) ? 'VALIDATION' : undefined
  return { trace, issues, clusters, directVariants, sharedVariants, relationForExperiment }
}

export function selectTraceGovernance(state: EvolutionState, traceId: string): TraceGovernanceHistory {
  traceId = resolveIdentity(state, 'trace', traceId)
  const relations = traceRelations(state, traceId), trace = relations.trace
  if (!trace) return { events: [], branches: [], memberships: [], currentLabel: '尚未进入' }
  const normalizeBranch = (branchId?: string) => {
    if (branchId?.startsWith('trace:')) return `trace:${resolveIdentity(state, 'trace', branchId.slice(6))}`
    if (branchId?.startsWith('attribution:')) {
      const issue = relations.issues.find(item => item.attributionId === branchId.slice(12))
      const delivery = issue && state.routingDeliveries.find(item => item.traceId === traceId && item.issueId === issue.id)
      if (delivery) return `finding:${delivery.findingId}`
    }
    return branchId
  }
  const explicit = (state.governanceEvents ?? []).filter(item => item.traceId === traceId).map(item => ({ ...item, branchId: normalizeBranch(item.branchId) }))
  const events = [...explicit]
  const add = (stage: string, sourceRef: GovernanceReference, statusCode: string, description: string, occurredAt?: string, options: Partial<TraceGovernanceEvent> = {}) => {
    const independentRevision = Boolean(options.sourceEventId && ['EVALUATION', 'REVIEW', 'ATTRIBUTION'].includes(stage))
    if (!independentRevision && explicit.some(item => item.stage === stage && item.sourceRef?.kind === sourceRef.kind && item.sourceRef.id === sourceRef.id && item.relationType === (options.relationType ?? 'TRACE_SOURCE'))) return
    const recordedAt = options.recordedAt ?? occurredAt ?? trace.updatedAt
    events.push({ id: `legacy:${traceId}:${sourceRef.kind}:${sourceRef.id}:${stage}`, traceId, caseId: trace.caseId, branchId: `trace:${traceId}`, occurredAt: time(occurredAt), recordedAt, stage, statusCode, actor: '历史记录', description, sourceRef, targetRefs: [sourceRef], origin: 'LEGACY', relationType: 'TRACE_SOURCE', ...options })
  }
  add('TASK', ref('trace', trace.id), trace.status, '任务执行开始；治理等待时间不计入 Agent 执行耗时。', trace.startedAt)
  for (const pkg of state.tracePackages.filter(item => item.traceId === traceId)) {
    add('EVALUATION', ref('trace-package', pkg.id), pkg.status === 'EVALUATED' ? 'COMPLETED' : pkg.status, '评测包记录；仅有记录更新时间，评测完成时间未记录。', undefined, { recordedAt: pkg.updatedAt })
  }
  for (const evaluation of [...state.processEvals, ...state.outcomeEvals].filter(item => item.traceId === traceId)) {
    for (const revision of evaluation.revisions) {
      const kind = evaluation.type === 'PROCESS' ? 'process-eval' : 'outcome-eval'
      if (events.some(item => item.sourceEventId === revision.id && item.sourceRef?.kind === kind && item.sourceRef.id === evaluation.id)) continue
      add(revision.source === 'HUMAN' ? 'REVIEW' : 'EVALUATION', ref(kind, evaluation.id), revision.verdict, revision.reason, revision.evaluatedAt, { id: `legacy:revision:${revision.id}`, actor: revision.evaluator, sourceEventId: revision.id, targetRefs: [ref(kind, evaluation.id), ...revision.evidenceIds.map(id => ref('evidence', id))] })
    }
  }
  for (const review of (state.moduleReviews ?? []).filter(item => item.traceId === traceId)) {
    if (events.some(item => item.sourceEventId === review.id || item.id === `review:${review.id}`)) continue
    add('REVIEW', ref('trace-package', review.packageId), 'REVIEWED', `${review.humanScore === undefined ? review.auxiliaryVerdict : `${review.humanScore.toFixed(2)} / 2`} · ${review.reason}`, review.reviewedAt, { id: `review:${review.id}`, actor: review.reviewer, sourceEventId: review.id, origin: review.origin, targetRefs: [ref('trace-package', review.packageId), ...review.evidenceIds.map(id => ref('evidence', id))] })
  }
  for (const finding of state.evaluationFindings.filter(item => item.traceId === traceId)) add('ATTRIBUTION', ref('finding', finding.id), finding.status, finding.description, finding.createdAt, { branchId: `finding:${finding.id}` })
  for (const attribution of state.attributions.filter(item => item.traceId === traceId)) {
    if (!attribution.revisions.length) add('ATTRIBUTION', ref('attribution', attribution.id), attribution.status, attribution.description ?? attribution.dimension, undefined, { branchId: `attribution:${attribution.id}`, recordedAt: attribution.updatedAt })
    for (const revision of attribution.revisions) add('ATTRIBUTION', ref('attribution', attribution.id), revision.status, revision.reason, revision.revisedAt, { id: `legacy:attribution-revision:${revision.id}`, branchId: `attribution:${attribution.id}`, actor: revision.revisedBy, sourceEventId: revision.id })
  }
  for (const decision of state.routingDecisions.filter(item => item.traceId === traceId)) add('ROUTING', ref('routing-decision', decision.id), decision.status, `${decision.label} · ${decision.reason}`, decision.confirmedAt, { branchId: `finding:${decision.findingId}`, actor: decision.confirmedBy ?? '分流系统', recordedAt: decision.updatedAt })
  for (const delivery of state.routingDeliveries.filter(item => item.traceId === traceId)) add('ROUTING', ref('routing-delivery', delivery.id), delivery.status, `${delivery.label} · ${delivery.destination}${delivery.note ? ` · ${delivery.note}` : ''}`, delivery.acknowledgedAt ?? delivery.deliveredAt, { branchId: `finding:${delivery.findingId}`, actor: delivery.owner ?? '分流系统', recordedAt: delivery.updatedAt, targetRefs: [ref('routing-delivery', delivery.id), ...(delivery.issueId ? [ref('issue', delivery.issueId)] : []), ...(delivery.issueClusterId ? [ref('cluster', delivery.issueClusterId)] : []), ...(delivery.algorithmBadcaseId ? [ref('badcase', delivery.algorithmBadcaseId)] : [])] })
  const memberships: TraceGovernanceMembership[] = []
  for (const dataset of state.datasets.filter(item => item.caseIds.includes(trace.caseId))) {
    const records = (state.datasetMemberships ?? []).filter(item => item.datasetId === dataset.id && item.caseId === trace.caseId && (item.scope === 'CASE_SHARED' || item.traceIds.includes(traceId)))
    const selected = records.some(item => item.scope === 'TRACE') ? records.filter(item => item.scope === 'TRACE') : records
    const relevant = selected.length ? selected : [{ id: `legacy-membership:${dataset.id}:${trace.caseId}`, datasetId: dataset.id, datasetVersion: dataset.version, caseId: trace.caseId, traceIds: [], scope: 'CASE_SHARED' as const, actor: '历史记录', origin: 'LEGACY' as const }]
    for (const record of relevant) {
      const membership = { ...record, joinedAt: time(record.joinedAt), name: dataset.name, purpose: dataset.purpose ?? dataset.type, frozen: dataset.frozen, source: dataset.source, experimentIds: state.experiments.filter(item => item.datasetIds.includes(dataset.id)).map(item => item.id), relationType: record.scope === 'TRACE' ? 'TRACE_SOURCE' as const : 'CASE_SHARED' as const }
      memberships.push(membership)
      add('DATASET', ref('dataset', dataset.id), 'CONFIRMED', `${dataset.name} · ${record.datasetVersion} · ${membership.purpose} · ${dataset.frozen ? '已冻结' : '未冻结'}${record.scope === 'CASE_SHARED' ? ' · Case 共享归属' : ''}${record.joinedAt ? '' : ' · 加入时间未记录'}`, record.joinedAt, { id: `membership-event:${record.id}:${traceId}`, branchId: `dataset:${dataset.id}`, actor: record.actor, origin: record.origin, sourceEventId: record.sourceEventId ?? record.id, relationType: membership.relationType, recordedAt: record.joinedAt ?? dataset.updatedAt, targetRefs: [ref('dataset', dataset.id), ...membership.experimentIds.map(id => ref('experiment', id))] })
    }
  }
  const issueBranch = (issueId: string) => {
    const delivery = state.routingDeliveries.find(item => item.traceId === traceId && item.issueId === issueId)
    const issue = relations.issues.find(item => item.id === issueId)
    return delivery ? `finding:${delivery.findingId}` : issue ? `attribution:${issue.attributionId}` : `issue:${issueId}`
  }
  for (const issue of relations.issues) add(issue.optimizationMode === 'DIRECT_FIX' ? 'DIRECT_FIX' : 'CLUSTER', ref('issue', issue.id), issue.status, `${issue.title} · 记录更新时间；实际处理动作时间未记录。`, undefined, { branchId: issueBranch(issue.id), recordedAt: issue.updatedAt, actor: issue.owner ?? '历史记录' })
  for (const cluster of relations.clusters) add('CLUSTER', ref('cluster', cluster.id), cluster.status, cluster.name, cluster.createdAt, { branchId: issueBranch(cluster.issueIds.find(id => relations.issues.some(issue => issue.id === id)) ?? cluster.id) })
  const variantBranch = (variantId: string) => {
    const variant = relations.directVariants.find(item => item.id === variantId)
    const issueId = variant?.sourceIssueIds.find(id => relations.issues.some(issue => issue.id === id)) ?? relations.clusters.find(item => variant?.sourceClusterIds.includes(item.id))?.issueIds.find(id => relations.issues.some(issue => issue.id === id))
    return issueId ? issueBranch(issueId) : `variant:${variantId}`
  }
  for (const variant of [...relations.directVariants, ...relations.sharedVariants]) add('VARIANT', ref('variant', variant.id), variant.status, `${variant.name} · 记录更新时间；实际状态变化时间未记录。`, undefined, { branchId: variantBranch(variant.id), relationType: relations.directVariants.includes(variant) ? 'TRACE_SOURCE' : 'CASE_SHARED', recordedAt: variant.updatedAt })
  const experimentRelation = new Map<string, { relationType: TraceGovernanceEvent['relationType']; branchId: string }>()
  for (const experiment of state.experiments) {
    const relationType = relations.relationForExperiment(experiment)
    if (!relationType) continue
    const branchId = relationType === 'TRACE_SOURCE' ? variantBranch(experiment.variantIds.find(id => relations.directVariants.some(item => item.id === id))!) : `validation:${experiment.id}`
    experimentRelation.set(experiment.id, { relationType, branchId })
    add(experiment.level === 'WINDOW_COMBINATION' ? 'WINDOW_EXPERIMENT' : 'EXPERIMENT', ref('experiment', experiment.id), experiment.status, `${experiment.name}${relationType === 'VALIDATION' ? ' · 用于验证' : relationType === 'CASE_SHARED' ? ' · Case 共享关联' : ''} · 记录更新时间，运行时间未记录。`, undefined, { branchId, relationType, recordedAt: experiment.updatedAt, targetRefs: [ref('experiment', experiment.id), ...(experiment.windowId ? [ref('window', experiment.windowId)] : [])] })
  }
  for (const decision of state.gateDecisions) {
    const relation = experimentRelation.get(decision.experimentId)
    if (relation) add('GATE', ref('decision', decision.id), decision.conclusion, decision.reason, decision.decidedAt, { ...relation, actor: decision.decidedBy, targetRefs: [ref('decision', decision.id), ref('experiment', decision.experimentId)] })
  }
  for (const release of state.releases) {
    const relation = experimentRelation.get(release.combinationExperimentId)
    const sourceVariant = release.variantIds.find(id => relations.directVariants.some(item => item.id === id))
    if (!relation && !sourceVariant) continue
    const options: Partial<TraceGovernanceEvent> = { ...(relation ?? { relationType: 'TRACE_SOURCE', branchId: variantBranch(sourceVariant!) }), actor: release.approvedBy, recordedAt: release.updatedAt, targetRefs: [ref('release', release.id), ref('decision', release.gateDecisionId), ref('window', release.windowId)] }
    if (time(release.releasedAt)) add('RELEASE', ref('release', release.id), 'RELEASED', `${release.version} · 记录中明确的发布时间。`, release.releasedAt, { ...options, id: `legacy:publication:${traceId}:${release.id}` })
    if (!time(release.releasedAt) || release.status !== 'RELEASED') add('RELEASE', ref('release', release.id), release.status, `${release.version} · 记录更新时间；${release.status === 'ROLLED_BACK' ? '回滚' : '状态变化'}动作时间未记录。`, undefined, { ...options, id: `legacy:release-state:${traceId}:${release.id}` })
  }
  const sorted = uniqueEvents(events.map(item => ({ ...item, branchId: normalizeBranch(item.branchId) })))
  const directEvents = sorted.filter(item => item.relationType === 'TRACE_SOURCE')
  const branchMap = new Map<string, TraceGovernanceEvent[]>()
  for (const item of directEvents) {
    const id = item.branchId ?? `trace:${traceId}`
    branchMap.set(id, [...(branchMap.get(id) ?? []), item])
  }
  const branches = [...branchMap].map(([id, items]) => {
    const currentEvent = [...items].sort((a, b) => Date.parse(a.occurredAt ?? a.recordedAt) - Date.parse(b.occurredAt ?? b.recordedAt) || a.id.localeCompare(b.id)).at(-1)
    const source = state.evaluationFindings.find(item => id === `finding:${item.id}`)
    return { id, label: source ? `${source.moduleLabel} · ${source.dimensionLabel}` : id.startsWith('dataset:') ? '数据集去向' : id.startsWith('trace:') ? '任务与评测' : '改进分支', currentEvent }
  }).sort((a, b) => a.id.localeCompare(b.id))
  const governanceBranches = branches.filter(item => item.currentEvent && !['TASK', 'EVALUATION', 'REVIEW', 'DATASET'].includes(item.currentEvent.stage))
  const summary = governanceBranches.length ? governanceBranches : branches
  const currentLabel = [...new Set(summary.flatMap(item => item.currentEvent ? [`${governanceStageLabel(item.currentEvent.stage)} · ${statusLabels[item.currentEvent.statusCode] ?? item.currentEvent.statusCode}`] : []))].join(' / ') || '尚未进入'
  const lastOccurredAt = sorted.filter(item => item.relationType === 'TRACE_SOURCE' && time(item.occurredAt)).at(-1)?.occurredAt
  const reviewModuleIds: Record<string, string> = {}
  for (const review of (state.moduleReviews ?? []).filter(item => item.traceId === traceId)) {
    for (const item of sorted.filter(item => item.stage === 'REVIEW' && (item.id === `review:${review.id}` || item.sourceEventId === review.id))) reviewModuleIds[item.id] = review.moduleScoreId
  }
  return { events: sorted, branches, memberships, currentLabel, lastOccurredAt, reviewModuleIds }
}

/** Called inside reducer finalization so entity state and append-only history persist together. */
export function appendGovernanceEvents(previous: EvolutionState, next: EvolutionState, audit: AuditEvent): EvolutionState {
  const events = [...(next.governanceEvents ?? [])]
  const memberships = [...(next.datasetMemberships ?? [])]
  const businessFields = (item?: object) => item ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'updatedAt')) : undefined
  const changed = <T extends { id: string }>(before: T[], after: T[]) => after.filter(item => JSON.stringify(businessFields(before.find(old => old.id === item.id))) !== JSON.stringify(businessFields(item)))
  const append = (traceId: string, stage: string, sourceRef: GovernanceReference, statusCode: string, description: string, options: Partial<TraceGovernanceEvent> = {}) => {
    const trace = next.traces.find(item => item.id === traceId)
    if (!trace) return
    const branchId = options.branchId ?? `trace:${traceId}`
    const id = `local:${audit.id}:${traceId}:${sourceRef.kind}:${sourceRef.id}:${stage}`
    if (events.some(item => item.id === id)) return
    events.push({ id, traceId, caseId: trace.caseId, branchId, occurredAt: audit.at, recordedAt: audit.at, stage, statusCode, actor: audit.actor, description, sourceRef, targetRefs: [sourceRef], origin: 'LOCAL', relationType: 'TRACE_SOURCE', sourceEventId: audit.id, ...options })
  }
  for (const review of changed(previous.moduleReviews ?? [], next.moduleReviews ?? [])) append(review.traceId, 'REVIEW', ref('trace-package', review.packageId), 'REVIEWED', `${review.humanScore === undefined ? review.auxiliaryVerdict : `${review.humanScore.toFixed(2)} / 2`} · ${review.reason}`, { id: `review:${review.id}`, occurredAt: review.reviewedAt, targetRefs: [ref('trace-package', review.packageId), ...review.evidenceIds.map(id => ref('evidence', id))] })
  if (audit.action === 'REVIEW_OUTCOME_DIMENSION') {
    const evaluation = next.outcomeEvals.find(item => item.id === audit.entityId)
    const revision = evaluation?.revisions.find(item => item.id === audit.changes?.reviewId && item.source === 'HUMAN')
    const exists = previous.outcomeEvals.find(item => item.id === evaluation?.id)?.revisions.some(item => item.id === revision?.id)
    if (evaluation && revision && !exists) {
      const prior = selectTraceGovernance(previous, evaluation.traceId).events
      const parent = prior.find(item => item.sourceRef?.kind === 'outcome-eval' && item.sourceRef.id === evaluation.id && item.sourceEventId === (revision.supersedesRevisionId ?? revision.automaticRevisionId))
      append(evaluation.traceId, 'REVIEW', ref('outcome-eval', evaluation.id), 'REVIEWED', `${revision.score === undefined ? '未评分' : `${revision.score.toFixed(2)} / 2`} · ${revision.reason}`, { id: `outcome-review:${revision.id}`, sourceEventId: revision.id, occurredAt: revision.evaluatedAt, actor: revision.evaluator, parentEventIds: parent ? [parent.id] : undefined, targetRefs: [ref('outcome-eval', evaluation.id), ref('artifact', evaluation.artifactId), ...revision.evidenceIds.map(id => ref('evidence', id))] })
    }
  }
  if (audit.action === 'UPDATE_MODULE_EVALUATION') for (const pkg of next.tracePackages) for (const score of pkg.moduleScores) {
    const old = previous.tracePackages.find(item => item.id === pkg.id)?.moduleScores.find(item => item.id === score.id)
    const hasNewReview = (next.moduleReviews ?? []).some(review => review.moduleScoreId === score.id && !(previous.moduleReviews ?? []).some(item => item.id === review.id))
    if (!hasNewReview && score.id === audit.entityId && old && ['humanStatus', 'humanScore', 'humanNote'].some(key => old[key as keyof typeof old] !== score[key as keyof typeof score])) append(pkg.traceId, 'REVIEW', ref('trace-package', pkg.id), 'REVIEWED', score.humanNote ?? audit.reason, { targetRefs: [ref('trace-package', pkg.id), ...score.evidence.rootEvidenceIds.map(id => ref('evidence', id))] })
  }
  for (const attribution of changed(previous.attributions, next.attributions)) append(attribution.traceId, 'ATTRIBUTION', ref('attribution', attribution.id), attribution.status, audit.reason, { branchId: `attribution:${attribution.id}` })
  for (const finding of changed(previous.evaluationFindings, next.evaluationFindings)) append(finding.traceId, 'ATTRIBUTION', ref('finding', finding.id), finding.status, finding.description, { branchId: `finding:${finding.id}` })
  for (const decision of changed(previous.routingDecisions, next.routingDecisions)) append(decision.traceId, 'ROUTING', ref('routing-decision', decision.id), decision.status, `${decision.label} · ${decision.reason}`, { branchId: `finding:${decision.findingId}` })
  for (const delivery of changed(previous.routingDeliveries, next.routingDeliveries)) append(delivery.traceId, 'ROUTING', ref('routing-delivery', delivery.id), delivery.status, `${delivery.label} · ${delivery.note ?? audit.reason}`, { branchId: `finding:${delivery.findingId}`, targetRefs: [ref('routing-delivery', delivery.id), ...(delivery.issueId ? [ref('issue', delivery.issueId)] : []), ...(delivery.issueClusterId ? [ref('cluster', delivery.issueClusterId)] : [])] })
  for (const badcase of changed(previous.algorithmBadcases, next.algorithmBadcases)) append(badcase.traceId, 'ROUTING', ref('badcase', badcase.id), badcase.status, badcase.note ?? audit.reason, { branchId: `finding:${badcase.findingId}` })
  if (/EVALUATION_(JOB|BATCH)/.test(audit.entityType.toUpperCase()) || /EVALUATION_JOB|EVALUATION_BATCH/.test(audit.action)) for (const pkg of changed(previous.tracePackages, next.tracePackages)) append(pkg.traceId, 'EVALUATION', ref('trace-package', pkg.id), pkg.status === 'EVALUATED' ? 'COMPLETED' : pkg.status, audit.reason)
  for (const dataset of next.datasets) {
    const before = previous.datasets.find(item => item.id === dataset.id)
    for (const caseId of dataset.caseIds.filter(id => !before?.caseIds.includes(id))) {
      if (!memberships.some(item => item.datasetId === dataset.id && item.caseId === caseId)) memberships.push({ id: `membership:${audit.id}:${dataset.id}:${caseId}`, datasetId: dataset.id, datasetVersion: dataset.version, caseId, traceIds: [], scope: 'CASE_SHARED', joinedAt: audit.at, actor: audit.actor, origin: 'LOCAL', sourceEventId: audit.id })
    }
  }
  for (const member of changed(previous.datasetMemberships ?? [], memberships)) {
    const traceIds = member.scope === 'TRACE' ? member.traceIds : next.traces.filter(item => item.caseId === member.caseId).map(item => item.id)
    for (const traceId of traceIds) append(traceId, 'DATASET', ref('dataset', member.datasetId), 'CONFIRMED', `${next.datasets.find(item => item.id === member.datasetId)?.name ?? member.datasetId} · ${member.datasetVersion}${member.scope === 'CASE_SHARED' ? ' · Case 共享归属' : ''}`, { branchId: `dataset:${member.datasetId}`, occurredAt: member.joinedAt, relationType: member.scope === 'TRACE' ? 'TRACE_SOURCE' : 'CASE_SHARED' })
  }
  const changedIssues = changed(previous.issues, next.issues), changedClusters = changed(previous.issueClusters, next.issueClusters)
  const changedVariants = changed(previous.variants, next.variants), changedExperiments = changed(previous.experiments, next.experiments)
  const changedDecisions = changed(previous.gateDecisions, next.gateDecisions), changedReleases = changed(previous.releases, next.releases)
  if (![changedIssues, changedClusters, changedVariants, changedExperiments, changedDecisions, changedReleases].some(items => items.length)) return { ...next, governanceEvents: uniqueEvents(events), datasetMemberships: memberships }
  for (const trace of next.traces) {
    const relation = traceRelations(next, trace.id)
    const branch = (issueId?: string) => {
      const delivery = next.routingDeliveries.find(item => item.traceId === trace.id && item.issueId === issueId)
      const issue = relation.issues.find(item => item.id === issueId)
      return delivery ? `finding:${delivery.findingId}` : issue ? `attribution:${issue.attributionId}` : `trace:${trace.id}`
    }
    for (const issue of changedIssues.filter(item => relation.issues.includes(item))) append(trace.id, issue.optimizationMode === 'DIRECT_FIX' ? 'DIRECT_FIX' : 'CLUSTER', ref('issue', issue.id), issue.status, audit.reason, { branchId: branch(issue.id) })
    for (const cluster of changedClusters.filter(item => relation.clusters.includes(item))) append(trace.id, 'CLUSTER', ref('cluster', cluster.id), cluster.status, audit.reason, { branchId: branch(cluster.issueIds.find(id => relation.issues.some(item => item.id === id))) })
    const variantBranch = (variantIds: string[]) => branch(relation.directVariants.find(item => variantIds.includes(item.id))?.sourceIssueIds.find(id => relation.issues.some(issue => issue.id === id)))
    for (const variant of changedVariants.filter(item => relation.directVariants.includes(item))) append(trace.id, 'VARIANT', ref('variant', variant.id), variant.status, audit.reason, { branchId: variantBranch([variant.id]) })
    for (const experiment of changedExperiments) {
      const relationType = relation.relationForExperiment(experiment)
      if (relationType) append(trace.id, experiment.level === 'WINDOW_COMBINATION' ? 'WINDOW_EXPERIMENT' : 'EXPERIMENT', ref('experiment', experiment.id), experiment.status, audit.reason, { relationType, branchId: relationType === 'TRACE_SOURCE' ? variantBranch(experiment.variantIds) : `validation:${experiment.id}`, targetRefs: [ref('experiment', experiment.id), ...(experiment.windowId ? [ref('window', experiment.windowId)] : [])] })
    }
    for (const decision of changedDecisions) {
      const experiment = next.experiments.find(item => item.id === decision.experimentId)
      const relationType = experiment && relation.relationForExperiment(experiment)
      if (experiment && relationType) append(trace.id, 'GATE', ref('decision', decision.id), decision.conclusion, decision.reason, { relationType, branchId: relationType === 'TRACE_SOURCE' ? variantBranch(experiment.variantIds) : `validation:${experiment.id}`, targetRefs: [ref('decision', decision.id), ref('experiment', experiment.id)] })
    }
    for (const release of changedReleases) {
      const experiment = next.experiments.find(item => item.id === release.combinationExperimentId)
      const relationType = experiment && relation.relationForExperiment(experiment)
      if (relationType) append(trace.id, 'RELEASE', ref('release', release.id), release.status, audit.reason, { relationType, branchId: relationType === 'TRACE_SOURCE' ? variantBranch(release.variantIds) : `validation:${experiment!.id}`, targetRefs: [ref('release', release.id), ref('decision', release.gateDecisionId), ref('window', release.windowId)] })
    }
  }
  return { ...next, governanceEvents: uniqueEvents(events), datasetMemberships: memberships }
}
