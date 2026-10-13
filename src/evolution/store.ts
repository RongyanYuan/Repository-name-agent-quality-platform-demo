import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type PropsWithChildren } from 'react'
import { createInitialEvolutionData } from './data'
import { TRACE_MODULE_LABELS, type AlgorithmBadcaseItem, type Asset, type Attribution, type AttributionRevision, type AuditEvent, type BadcaseQueue, type Case, type Dataset, type DatasetMembershipRecord, type DatasetSamplingSnapshot, type EvaluationBatch, type EvaluationEvidenceBundle, type EvaluationFinding, type EvaluationJob, type EvaluationRevision, type Evidence, type EvolutionState, type Experiment, type ExperimentConfigSnapshot, type ExperimentMetric, type ExperimentRun, type GateDecision, type Issue, type IssueCluster, type ModuleEvaluationScore, type ReleaseVersion, type RoutingDecision, type RoutingDelivery, type RuleConfig, type Skill, type TraceEvaluationModuleCode, type TraceEvaluationPackage, type Variant, type Window } from './domain'
import { createLocalEvolutionRepository, type EvolutionRepository } from './repository'
import { selectTasteLibraryTrigger } from './data/selectors'
import type { ModuleReviewInput } from './reviews'
import { toModuleReviewRevision, automaticModuleRevisionId } from './reviews'
import { appendGovernanceEvents } from './data/traceGovernance'
import { resolveIdentity } from './identity'
import { toOutcomeReviewRevision, validateOutcomeReviewInput, type OutcomeReviewInput } from './outcomeReviews'
import { projectArtifactOutcomeEvaluation } from './data/artifactOutcomes'
import { validateScopedRule } from './data/scopedRules'
import { datasetExecutionMutation, type DatasetExecutionAction } from './datasetExecutionMutations'

export interface EvolutionActionMeta { actor: string; reason: string; at?: string; auditId?: string }
export type EvolutionAction =
  | DatasetExecutionAction
  | { type: 'UPDATE_CASE'; caseId: string; patch: Partial<Case>; meta: EvolutionActionMeta }
  | { type: 'ADD_EVALUATION_REVISION'; evaluationType: 'PROCESS' | 'OUTCOME'; evaluationId: string; revision: EvaluationRevision; meta: EvolutionActionMeta }
  | { type: 'UPSERT_ATTRIBUTION'; attribution: Attribution; meta: EvolutionActionMeta }
  | { type: 'ADD_ATTRIBUTION_REVISION'; attributionId: string; revision: AttributionRevision; meta: EvolutionActionMeta }
  | { type: 'UPSERT_ISSUE'; issue: Issue; meta: EvolutionActionMeta }
  | { type: 'ADD_CASE_TO_CLUSTER'; clusterId: string; caseId: string; issueId: string; meta: EvolutionActionMeta }
  | { type: 'CREATE_ISSUE_CLUSTER'; cluster: IssueCluster; meta: EvolutionActionMeta }
  | { type: 'CREATE_VARIANT'; variant: Variant; meta: EvolutionActionMeta }
  | { type: 'CREATE_EXPERIMENT'; experiment: Experiment; runs?: ExperimentRun[]; meta: EvolutionActionMeta }
  | { type: 'UPDATE_EXPERIMENT'; experimentId: string; patch: Partial<Pick<Experiment, 'name' | 'rollbackItems' | 'knownRisks'>>; meta: EvolutionActionMeta }
  | { type: 'START_EXPERIMENT_RUN'; experimentId: string; caseIds?: string[]; retry?: boolean; meta: EvolutionActionMeta }
  | { type: 'COMPLETE_EXPERIMENT_RUN'; experimentId: string; meta: EvolutionActionMeta }
  | { type: 'FAIL_EXPERIMENT_RUN'; experimentId: string; error: string; meta: EvolutionActionMeta }
  | { type: 'UPDATE_EXPERIMENT_DECISION'; experimentId: string; decision: GateDecision; meta: EvolutionActionMeta }
  | { type: 'CREATE_RELEASE'; release: ReleaseVersion; meta: EvolutionActionMeta }
  | { type: 'UPDATE_RELEASE'; releaseId: string; patch: Partial<Omit<ReleaseVersion, 'id' | 'createdAt'>>; meta: EvolutionActionMeta }
  | { type: 'UPDATE_RULE'; ruleId: string; patch: Partial<Omit<RuleConfig, 'id' | 'createdAt'>>; meta: EvolutionActionMeta }
  | { type: 'UPSERT_SCOPED_RULE'; rule: RuleConfig; meta: EvolutionActionMeta }
  | { type: 'UPDATE_ASSET'; assetId: string; patch: Partial<Omit<Asset, 'id' | 'createdAt'>>; meta: EvolutionActionMeta }
  | { type: 'UPLOAD_ASSET'; asset: Asset; meta: EvolutionActionMeta }
  | { type: 'CREATE_PLANNED_PERSONAL_SKILL'; skill: Skill; meta: EvolutionActionMeta }
  | { type: 'CREATE_DATASET_VERSION'; dataset: Dataset; sourceDatasetId?: string; meta: EvolutionActionMeta }
  | { type: 'CREATE_CUSTOM_DATASET'; dataset: Dataset; meta: EvolutionActionMeta }
  | { type: 'UPDATE_DATASET_VERSION'; datasetId: string; patch: Partial<Pick<Dataset, 'name' | 'scope' | 'source' | 'timeRange' | 'population'>>; meta: EvolutionActionMeta }
  | { type: 'SET_DATASET_MEMBERS'; datasetId: string; caseIds: string[]; meta: EvolutionActionMeta }
  | { type: 'ADD_DATASET_TRACES'; datasetId: string; traceIds: string[]; meta: EvolutionActionMeta }
  | { type: 'APPLY_DATASET_SAMPLING'; datasetId: string; snapshot: DatasetSamplingSnapshot; meta: EvolutionActionMeta }
  | { type: 'FREEZE_DATASET_VERSION'; datasetId: string; meta: EvolutionActionMeta }
  | { type: 'CREATE_EVALUATION_BATCH'; batch: EvaluationBatch; meta: EvolutionActionMeta }
  | { type: 'QUEUE_EVALUATION_JOB'; job: EvaluationJob; meta: EvolutionActionMeta }
  | { type: 'START_EVALUATION_JOB'; jobId: string; meta: EvolutionActionMeta }
  | { type: 'COMPLETE_EVALUATION_JOB'; jobId: string; meta: EvolutionActionMeta }
  | { type: 'FAIL_EVALUATION_JOB'; jobId: string; error: string; meta: EvolutionActionMeta }
  | { type: 'RETRY_EVALUATION_JOB'; jobId: string; meta: EvolutionActionMeta }
  | { type: 'UPDATE_MODULE_EVALUATION'; packageId: string; scoreId: string; patch: Partial<ModuleEvaluationScore>; meta: EvolutionActionMeta }
  | { type: 'REVIEW_TRACE_MODULE'; input: ModuleReviewInput; meta: EvolutionActionMeta }
  | { type: 'REVIEW_OUTCOME_DIMENSION'; input: OutcomeReviewInput; meta: EvolutionActionMeta }
  | { type: 'UPDATE_EVALUATION_FINDING'; findingId: string; patch: Partial<EvaluationFinding>; meta: EvolutionActionMeta }
  | { type: 'UPDATE_ROUTING_DECISION'; decisionId: string; patch: Partial<RoutingDecision>; meta: EvolutionActionMeta }
  | { type: 'UPDATE_ROUTING_DELIVERY'; deliveryId: string; patch: Partial<RoutingDelivery>; meta: EvolutionActionMeta }
  | { type: 'UPDATE_ALGORITHM_BADCASE'; badcaseId: string; patch: Partial<AlgorithmBadcaseItem>; meta: EvolutionActionMeta }
  | { type: 'RESET'; state: EvolutionState }

const addUnique = (values: string[], value: string) => values.includes(value) ? values : [...values, value]
const mergeDatasetTraces = (state: EvolutionState, datasetId: string, traceIds: string[], at: string, actor: string): Pick<EvolutionState, 'datasets' | 'datasetMemberships'> | undefined => {
  const current = state.datasets.find(item => item.id === datasetId)
  if (!current || current.frozen) return undefined
  const validTraceIds = [...new Set(traceIds)].filter(traceId => state.traces.some(trace => trace.id === traceId))
  if (validTraceIds.length !== new Set(traceIds).size) return undefined
  const memberships = (state.datasetMemberships ?? []).map(item => ({ ...item, traceIds: [...item.traceIds] }))
  const isMember = (traceId: string) => memberships.some(item => item.datasetId === datasetId && item.datasetVersion === current.version && item.traceIds.includes(traceId))
  const additions = validTraceIds.filter(traceId => !isMember(traceId))
  const grouped = new Map<string, string[]>()
  additions.forEach(traceId => {
    const trace = state.traces.find(item => item.id === traceId)
    if (!trace) return
    grouped.set(trace.caseId, [...(grouped.get(trace.caseId) ?? []), traceId])
  })
  grouped.forEach((ids, caseId) => {
    const existing = memberships.find(item => item.datasetId === datasetId && item.datasetVersion === current.version && item.caseId === caseId && item.scope === 'TRACE')
    if (existing) existing.traceIds = [...new Set([...existing.traceIds, ...ids])]
    else memberships.push({ id: `membership-${datasetId}-${caseId}-${memberships.length + 1}`, datasetId, datasetVersion: current.version, caseId, traceIds: ids, scope: 'TRACE', joinedAt: at, actor, origin: 'LOCAL' })
  })
  const caseIds = [...new Set([...current.caseIds, ...[...grouped.keys()]])]
  const datasetMemberships = memberships.filter(item => item.datasetId === datasetId && item.datasetVersion === current.version)
  const rangeTraceIds = new Set<string>()
  for (const caseId of caseIds) {
    const caseMemberships = datasetMemberships.filter(item => item.caseId === caseId)
    if (!caseMemberships.length) {
      state.traces.filter(trace => trace.caseId === caseId).forEach(trace => rangeTraceIds.add(trace.id))
      continue
    }
    for (const membership of caseMemberships) {
      if (membership.scope === 'CASE_SHARED') state.traces.filter(trace => trace.caseId === caseId).forEach(trace => rangeTraceIds.add(trace.id))
      else membership.traceIds.forEach(traceId => rangeTraceIds.add(traceId))
    }
  }
  const rangeTraces = state.traces.filter(trace => rangeTraceIds.has(trace.id))
  const rangeStarts = rangeTraces.map(trace => Date.parse(trace.queryAt ?? trace.startedAt)).filter(Number.isFinite)
  const rangeEnds = rangeTraces.map(trace => Date.parse(trace.queryAt ?? trace.endedAt)).filter(Number.isFinite)
  const timeRange = rangeStarts.length && rangeEnds.length
    ? { from: new Date(Math.min(...rangeStarts)).toISOString(), to: new Date(Math.max(...rangeEnds)).toISOString() }
    : current.timeRange
  const externalSampleCount = current.population.externalSampleCount
  const sampleCount = caseIds.length + externalSampleCount
  return {
    datasets: state.datasets.map(item => item.id === datasetId ? { ...item, caseIds, timeRange, sampleCount, population: { ...item.population, localCaseCount: caseIds.length, totalSampleCount: sampleCount }, updatedAt: at } : item),
    datasetMemberships: memberships
  }
}
const traceModuleCodes = Object.keys(TRACE_MODULE_LABELS) as TraceEvaluationModuleCode[]
const batchPackageId = (batchId: string, traceId: string) => `package-${batchId}-${traceId}`
const unknownEvidence = (): EvaluationEvidenceBundle => ({ rootEvidenceIds: [], rubricRule: '待评测：无可复用的同 Trace Rubric 结果', observationIds: [], logIds: [], artifactIds: [], firstFailure: false, derivedFailure: false, completeness: 'MISSING' })
const unknownModuleScores = (packageId: string, traceId: string, caseId: string, job: Pick<EvaluationJob, 'evalAgentVersion' | 'rubricVersion'>, at: string): ModuleEvaluationScore[] => traceModuleCodes.map((moduleCode) => ({
  id: `module-score-${packageId}-${moduleCode.toLowerCase()}`, packageId, traceId, caseId, moduleCode, moduleLabel: TRACE_MODULE_LABELS[moduleCode],
  automaticStatus: 'UNKNOWN', judgeReason: '本地 Mock 无同 Trace 评测模板；未执行真实 Eval Agent，不能推断 PASS。',
  evalAgentVersion: job.evalAgentVersion, rubricVersion: job.rubricVersion, evidence: unknownEvidence(), createdAt: at, updatedAt: at
}))
const batchCounts = (traceIds: string[], packages: TraceEvaluationPackage[]): EvaluationBatch['stats'] => {
  const byTrace = new Map(packages.map((pkg) => [pkg.traceId, pkg.status]))
  const counts = { inputTraceCount: traceIds.length, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 0 }
  traceIds.forEach((traceId) => {
    const status = byTrace.get(traceId)
    if (status === 'EVALUATED') counts.successCount += 1
    else if (status === 'PARTIAL') counts.partialCount += 1
    else if (status === 'FAILED') counts.failedCount += 1
    else counts.pendingCount += 1
  })
  return counts
}
const pendingPackage = (state: EvolutionState, batch: EvaluationBatch, traceId: string, at: string): TraceEvaluationPackage => {
  const trace = state.traces.find((item) => item.id === traceId)!
  const sourceCase = state.cases.find((item) => item.id === trace.caseId)
  const packageId = batchPackageId(batch.id, traceId)
  return {
    id: packageId, batchId: batch.id, caseId: trace.caseId, sessionId: trace.sessionId, traceId, query: sourceCase?.query ?? '',
    agentVersion: trace.agentVersion ?? sourceCase?.agentVersion ?? 'unknown', skillVersion: trace.skillVersion,
    skillIds: sourceCase?.skillIds ?? [], skillCategory: trace.skillCategory ?? 'UNCLASSIFIED', processCoverage: 'MISSING', outcomeCoverage: 'MISSING',
    status: 'PENDING', moduleScores: unknownModuleScores(packageId, traceId, trace.caseId, batch, at),
    findingIds: [], routingDecisionIds: [], routingDeliveryIds: [], badcaseIds: [], owner: sourceCase?.owner,
    revaluationJobIds: [], createdAt: at, updatedAt: at
  }
}
interface MaterializedTrace {
  packageRecord: TraceEvaluationPackage
  findings: EvaluationFinding[]
  decisions: RoutingDecision[]
  deliveries: RoutingDelivery[]
  badcases: AlgorithmBadcaseItem[]
}
/** Deterministic local replay only: a same-Trace seed package is the Mock provider.
 * Missing templates never become successful evaluations. */
const materializeTrace = (state: EvolutionState, batch: EvaluationBatch, job: EvaluationJob, traceId: string, at: string): MaterializedTrace => {
  const packageId = batchPackageId(batch.id, traceId)
  const existing = state.tracePackages.find((item) => item.id === packageId) ?? pendingPackage(state, batch, traceId, at)
  const template = state.tracePackages.find((item) => item.id === `package-${traceId}` && ['EVALUATED', 'PARTIAL'].includes(item.status))
    ?? state.tracePackages.find((item) => item.batchId !== batch.id && item.traceId === traceId && ['EVALUATED', 'PARTIAL'].includes(item.status))
  if (!template) {
    const moduleScores = (existing.moduleScores.length ? existing.moduleScores : unknownModuleScores(packageId, traceId, existing.caseId, job, at)).map((score) => ({ ...score, automaticRevisionId: `automatic-${job.id}-${packageId}-${score.moduleCode}`, evalAgentVersion: job.evalAgentVersion, rubricVersion: job.rubricVersion, humanStatus: undefined, humanScore: undefined, humanNote: undefined, humanUpdatedAt: undefined, humanUpdatedBy: undefined, updatedAt: at }))
    return { packageRecord: { ...existing, status: 'PARTIAL', processCoverage: 'MISSING', outcomeCoverage: 'MISSING', moduleScores, revaluationJobIds: addUnique(existing.revaluationJobIds, job.id), updatedAt: at }, findings: [], decisions: [], deliveries: [], badcases: [] }
  }
  const scores = template.moduleScores.map((score): ModuleEvaluationScore => {
    return {
      ...score, id: `module-score-${packageId}-${score.moduleCode.toLowerCase()}`, packageId,
      automaticRevisionId: `automatic-${job.id}-${packageId}-${score.moduleCode}`,
      evidence: structuredClone(score.evidence),
      evalAgentVersion: job.evalAgentVersion, rubricVersion: job.rubricVersion,
      judgeReason: `${score.judgeReason}（本地 Mock 复用 ${template.id} 的同 Trace 结果；非实时 ${job.evalAgentVersion} 运行。）`,
      humanStatus: undefined, humanScore: undefined, humanNote: undefined,
      humanUpdatedAt: undefined, humanUpdatedBy: undefined,
      createdAt: at, updatedAt: at
    }
  })
  const findings: EvaluationFinding[] = []
  const decisions: RoutingDecision[] = []
  const deliveries: RoutingDelivery[] = []
  const badcases: AlgorithmBadcaseItem[] = []
  for (const sourceFinding of state.evaluationFindings.filter((item) => item.packageId === template.id)) {
    const findingId = `finding-${packageId}-${sourceFinding.moduleCode.toLowerCase()}`
    const finding: EvaluationFinding = { ...sourceFinding, id: findingId, packageId, batchId: batch.id, status: 'OPEN', routingDecisionIds: [], routingDeliveryIds: [], evidenceBundle: structuredClone(sourceFinding.evidenceBundle), createdAt: at, updatedAt: at }
    findings.push(finding)
    for (const sourceDecision of state.routingDecisions.filter((item) => sourceFinding.routingDecisionIds.includes(item.id))) {
      const decisionId = `routing-decision-${packageId}-${sourceDecision.id}`
      const decision: RoutingDecision = { ...sourceDecision, id: decisionId, findingId, packageId, status: 'PENDING', confirmedBy: undefined, confirmedAt: undefined, deliveryIds: [], createdAt: at, updatedAt: at }
      decisions.push(decision)
      finding.routingDecisionIds.push(decisionId)
      for (const sourceDelivery of state.routingDeliveries.filter((item) => sourceDecision.deliveryIds.includes(item.id))) {
        const deliveryId = `routing-delivery-${packageId}-${sourceDelivery.id}`
        const delivery: RoutingDelivery = { ...sourceDelivery, id: deliveryId, findingId, decisionId, packageId, status: 'PENDING', owner: undefined, note: sourceDelivery.destination === 'PERSONAL_SKILL_PLANNING' ? '二期规划入口，不调用生成服务。' : undefined, algorithmBadcaseId: undefined, issueId: undefined, issueClusterId: undefined, variantId: undefined, deliveredAt: undefined, acknowledgedAt: undefined, createdAt: at, updatedAt: at }
        deliveries.push(delivery)
        decision.deliveryIds.push(deliveryId)
        finding.routingDeliveryIds.push(deliveryId)
        if (sourceDelivery.destination === 'ALGORITHM_BADCASE' && sourceDelivery.queueId) {
          const badcaseId = `badcase-${deliveryId}`
          badcases.push({ id: badcaseId, findingId, packageId, traceId, deliveryId, queueId: sourceDelivery.queueId, status: 'CANDIDATE', title: `${traceId} · ${finding.moduleLabel} 算法 Badcase`, note: 'Mock 自动评测产生，待人工确认。', sourceEvidenceIds: [...finding.evidenceBundle.rootEvidenceIds], createdAt: at, updatedAt: at })
          delivery.algorithmBadcaseId = badcaseId
        }
      }
    }
  }
  return {
    packageRecord: { ...existing, status: template.status, processCoverage: template.processCoverage, outcomeCoverage: template.outcomeCoverage, moduleScores: scores, findingIds: findings.map((item) => item.id), routingDecisionIds: decisions.map((item) => item.id), routingDeliveryIds: deliveries.map((item) => item.id), badcaseIds: badcases.map((item) => item.id), revaluationJobIds: addUnique(existing.revaluationJobIds, job.id), updatedAt: at },
    findings, decisions, deliveries, badcases
  }
}
const eventFor = (action: Exclude<EvolutionAction, { type: 'RESET' }>, entityType: string, entityId: string, changes?: Record<string, unknown>): AuditEvent => {
  const at = action.meta.at ?? new Date().toISOString()
  return { id: action.meta.auditId ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at, actor: action.meta.actor, action: action.type, entityType, entityId, reason: action.meta.reason, changes }
}
const finalize = (state: EvolutionState, event: AuditEvent, patch: Partial<EvolutionState>): EvolutionState => appendGovernanceEvents(state, { ...state, ...patch, updatedAt: event.at, auditTrail: [...state.auditTrail, event] }, event)
const deterministicScore = (text: string) => {
  let hash = 2166136261
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  return 0.55 + (hash % 31) / 100
}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
const stdDev = (values: number[]) => { const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))) }
const experimentMetrics = (runs: ExperimentRun[]): ExperimentMetric[] => {
  const baseline = runs.filter((run) => run.arm === 'BASELINE').map((run) => run.outcomeScore ?? 0)
  const candidate = runs.filter((run) => run.arm === 'CANDIDATE').map((run) => run.outcomeScore ?? 0)
  return [
    { key: 'target_module', label: '目标模块评分', category: 'LOCAL', baselineMean: mean(baseline), candidateMean: mean(candidate), baselineStdDev: stdDev(baseline), candidateStdDev: stdDev(candidate), unit: 'score', gateStatus: 'PENDING' },
    { key: 'end_to_end', label: 'Case 最终结果有效率', category: 'END_TO_END', baselineMean: mean(baseline), candidateMean: mean(candidate), baselineStdDev: stdDev(baseline), candidateStdDev: stdDev(candidate), unit: 'rate', gateStatus: 'PENDING' },
    { key: 'generalization', label: '泛化集通过率', category: 'GENERALIZATION', baselineMean: mean(baseline), candidateMean: mean(candidate), baselineStdDev: stdDev(baseline), candidateStdDev: stdDev(candidate), unit: 'rate', gateStatus: 'PENDING' }
  ]
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * Freeze all inputs that can affect an experiment report at creation time.
 * Dataset case membership is copied instead of being looked up again when a
 * run starts; evaluation IDs are similarly copied from the current package
 * graph so later re-evaluation cannot rewrite an historical run.
 */
const buildEvaluationSnapshot = (state: EvolutionState, config: ExperimentConfigSnapshot, capturedAt: string): NonNullable<ExperimentRun['evalSnapshot']> => {
  const caseIds = [...new Set(config.datasetVersions.flatMap((entry) => entry.caseIds ?? []))]
  const packages = state.tracePackages.filter((item) => (config.tracePackageIds ?? []).includes(item.id) || caseIds.includes(item.caseId))
  const moduleEvaluations = packages.flatMap((item) => item.moduleScores).map((item) => clone(item))
  const artifacts = state.artifacts.filter((item) => (config.artifactIds ?? []).includes(item.id) || caseIds.includes(item.caseId)).map((item) => clone(item))
  const rootEvidenceIds = config.evidenceBundleIds?.length ? config.evidenceBundleIds : moduleEvaluations.flatMap((score) => score.evidence.rootEvidenceIds)
  const rootEvidence = rootEvidenceIds.map((id) => state.evidence.find((item) => item.id === id)).filter((item): item is Evidence => Boolean(item)).map((item) => clone(item))
  const observations = state.observations.filter((item) => caseIds.includes(item.caseId)).map((item) => clone(item))
  const processEvals = state.processEvals.filter((item) => caseIds.includes(item.caseId)).map((item) => clone(item))
  const outcomeEvals = state.outcomeEvals.filter((item) => caseIds.includes(item.caseId)).map((item) => clone(item))
  return clone({ capturedAt, evalAgentVersion: config.evalAgentVersion, rubricVersion: config.rubricVersion, artifactIds: artifacts.map((item) => item.id), evidenceBundleIds: rootEvidence.map((item) => item.id), tracePackageIds: packages.map((item) => item.id), moduleEvaluations, tracePackages: packages.map(({ id, batchId, caseId, sessionId, traceId, query, agentVersion, skillVersion, skillCategory }) => ({ id, batchId, caseId, sessionId, traceId, query, agentVersion, skillVersion, skillCategory })), artifacts, rootEvidence, observations, processEvals, outcomeEvals })
}

const freezeExperimentConfig = (state: EvolutionState, source: Experiment, capturedAt: string): ExperimentConfigSnapshot => {
  const selectedDatasets = source.datasetIds.map((id) => state.datasets.find((dataset) => dataset.id === id)).filter((dataset): dataset is Dataset => Boolean(dataset))
  const datasetVersions = selectedDatasets.map((dataset) => ({ datasetId: dataset.id, version: dataset.version, versionId: `${dataset.id}@${dataset.version}`, sampleCount: dataset.sampleCount, caseIds: [...dataset.caseIds] }))
  const caseIds = [...new Set(datasetVersions.flatMap((entry) => entry.caseIds ?? []))]
  const packages = state.tracePackages.filter((item) => caseIds.includes(item.caseId))
  const packageIds = packages.map((item) => item.id)
  const artifactIds = [...new Set(state.artifacts.filter((item) => caseIds.includes(item.caseId)).map((item) => item.id))]
  const evidenceBundleIds = [...new Set(packages.flatMap((item) => item.moduleScores.flatMap((score) => score.evidence.rootEvidenceIds)))]
  const firstScore = packages.flatMap((item) => item.moduleScores)[0]
  const evalAgentVersion = source.configSnapshot.evalAgentVersion ?? firstScore?.evalAgentVersion
  const rubricVersion = source.configSnapshot.rubricVersion ?? firstScore?.rubricVersion
  const config = clone({
    ...source.configSnapshot,
    datasetVersions,
    evalAgentVersion,
    rubricVersion,
    artifactIds: source.configSnapshot.artifactIds?.length ? [...source.configSnapshot.artifactIds] : artifactIds,
    evidenceBundleIds: source.configSnapshot.evidenceBundleIds?.length ? [...source.configSnapshot.evidenceBundleIds] : evidenceBundleIds,
    tracePackageIds: source.configSnapshot.tracePackageIds?.length ? [...source.configSnapshot.tracePackageIds] : packageIds
  })
  config.evaluationSnapshot = buildEvaluationSnapshot(state, config, capturedAt)
  return config
}

const runEvalSnapshot = (state: EvolutionState, config: ExperimentConfigSnapshot, capturedAt: string): NonNullable<ExperimentRun['evalSnapshot']> => clone(config.evaluationSnapshot ?? buildEvaluationSnapshot(state, config, capturedAt))

const runWindowSnapshot = (state: EvolutionState, experiment: Experiment): ExperimentRun['windowSnapshot'] => {
  if (!experiment.windowId) return undefined
  const window = state.windows.find((item) => item.id === experiment.windowId)
  if (!window) return undefined
  return clone({ windowId: window.id, candidateVariantIds: window.candidateVariantIds, cutoffAt: window.cutoffAt, frozenAt: window.frozenAt, nextWindowRule: window.nextWindowRule, nextWindowRuleId: window.nextWindowRuleId, nextWindowId: window.nextWindowId })
}

const normalizeSuppliedRun = (state: EvolutionState, experiment: Experiment, run: ExperimentRun, at: string): ExperimentRun => ({
  ...clone(run),
  configSnapshot: clone(experiment.configSnapshot),
  evalSnapshot: runEvalSnapshot(state, experiment.configSnapshot, at),
  windowSnapshot: runWindowSnapshot(state, experiment),
  createdAt: run.createdAt ?? at,
  updatedAt: run.updatedAt ?? at
})

export function evolutionReducer(state: EvolutionState, action: EvolutionAction): EvolutionState {
  switch (action.type) {
    case 'ADD_DATASET_QUERY':
    case 'CREATE_DATASET_RUN':
    case 'START_DATASET_RUN':
    case 'SET_DATASET_RUN_ITEM_PHASE':
    case 'APPLY_DATASET_RUN_ITEM_RESULT':
    case 'COMPLETE_DATASET_RUN':
    case 'FAIL_DATASET_RUN': {
      const patch = datasetExecutionMutation(state, action)
      if (!patch) return state
      const entityId = action.type === 'ADD_DATASET_QUERY' ? action.query.id : action.type === 'CREATE_DATASET_RUN' ? action.run.id : action.runId
      const event = eventFor(action, action.type === 'ADD_DATASET_QUERY' ? 'DatasetQuery' : 'DatasetExecutionRun', entityId)
      return finalize(state, event, patch)
    }
    case 'UPDATE_CASE': {
      const event = eventFor(action, 'Case', action.caseId, action.patch as Record<string, unknown>)
      return finalize(state, event, { cases: state.cases.map((item) => item.id === action.caseId ? { ...item, ...action.patch, updatedAt: event.at } : item) })
    }
    case 'ADD_EVALUATION_REVISION': {
      const event = eventFor(action, `${action.evaluationType === 'PROCESS' ? 'Process' : 'Outcome'}Eval`, action.evaluationId, { revisionId: action.revision.id })
      if (action.evaluationType === 'PROCESS') {
        const processEvals = state.processEvals.map((item) => item.id !== action.evaluationId || item.revisions.some((revision) => revision.id === action.revision.id) ? item : { ...item, verdict: action.revision.verdict, score: action.revision.score, revisions: [...item.revisions, action.revision], updatedAt: event.at })
        return finalize(state, event, { processEvals })
      }
      const outcomeEvals = state.outcomeEvals.map((item) => item.id !== action.evaluationId || item.revisions.some((revision) => revision.id === action.revision.id) ? item : { ...item, verdict: action.revision.verdict, score: action.revision.score, revisions: [...item.revisions, action.revision], updatedAt: event.at })
      return finalize(state, event, { outcomeEvals })
    }
    case 'UPSERT_ATTRIBUTION': {
      const exists = state.attributions.some((item) => item.id === action.attribution.id)
      const event = eventFor(action, 'Attribution', action.attribution.id)
      const attributions = exists ? state.attributions.map((item) => item.id === action.attribution.id ? { ...action.attribution, updatedAt: event.at } : item) : [...state.attributions, action.attribution]
      const cases = state.cases.map((item) => item.id === action.attribution.caseId ? { ...item, attributionIds: addUnique(item.attributionIds, action.attribution.id), updatedAt: event.at } : item)
      return finalize(state, event, { attributions, cases })
    }
    case 'ADD_ATTRIBUTION_REVISION': {
      const event = eventFor(action, 'Attribution', action.attributionId, { revisionId: action.revision.id })
      const attributions = state.attributions.map((item) => item.id !== action.attributionId || item.revisions.some((revision) => revision.id === action.revision.id) ? item : {
        ...item, module: action.revision.module, dimension: action.revision.dimension, evidenceIds: [...action.revision.evidenceIds], routingLabels: [...action.revision.routingLabels],
        optimizationMode: action.revision.optimizationMode, confirmed: action.revision.confirmed, status: action.revision.status, confidence: action.revision.confidence, source: action.revision.source,
        revisions: [...item.revisions, action.revision], updatedAt: event.at
      })
      return finalize(state, event, { attributions })
    }
    case 'UPSERT_ISSUE': {
      const exists = state.issues.some((item) => item.id === action.issue.id)
      const event = eventFor(action, 'Issue', action.issue.id)
      const issues = exists ? state.issues.map((item) => item.id === action.issue.id ? { ...action.issue, updatedAt: event.at } : item) : [...state.issues, action.issue]
      const cases = state.cases.map((item) => item.id === action.issue.caseId ? { ...item, issueIds: addUnique(item.issueIds, action.issue.id), updatedAt: event.at } : item)
      return finalize(state, event, { issues, cases })
    }
    case 'ADD_CASE_TO_CLUSTER': {
      const issue = state.issues.find((item) => item.id === action.issueId)
      const cluster = state.issueClusters.find((item) => item.id === action.clusterId)
      if (!issue || !cluster || issue.caseId !== action.caseId || !state.cases.some((item) => item.id === action.caseId)) return state
      const event = eventFor(action, 'IssueCluster', action.clusterId, { caseId: action.caseId, issueId: action.issueId })
      const issueClusters = state.issueClusters.map((item) => item.id === action.clusterId ? { ...item, caseIds: addUnique(item.caseIds, action.caseId), issueIds: addUnique(item.issueIds, action.issueId), currentCount: new Set([...item.caseIds, action.caseId]).size, updatedAt: event.at } : item)
      const issues = state.issues.map((item) => item.id === action.issueId ? { ...item, clusterIds: addUnique(item.clusterIds, action.clusterId), updatedAt: event.at } : item)
      return finalize(state, event, { issueClusters, issues })
    }
    case 'CREATE_ISSUE_CLUSTER': {
      if (state.issueClusters.some((item) => item.id === action.cluster.id)) return state
      const event = eventFor(action, 'IssueCluster', action.cluster.id)
      const cluster = { ...action.cluster, caseIds: [...new Set(action.cluster.caseIds)], issueIds: [...new Set(action.cluster.issueIds)], currentCount: new Set(action.cluster.caseIds).size, updatedAt: event.at }
      const issues = state.issues.map((item) => cluster.issueIds.includes(item.id) ? { ...item, clusterIds: addUnique(item.clusterIds, cluster.id), updatedAt: event.at } : item)
      return finalize(state, event, { issueClusters: [...state.issueClusters, cluster], issues })
    }
    case 'CREATE_VARIANT': {
      if (state.variants.some((item) => item.id === action.variant.id)) return state
      const blockedTasteCluster = action.variant.sourceClusterIds.some((clusterId) => {
        const cluster = state.issueClusters.find((item) => item.id === clusterId)
        return cluster?.triggerRuleId === 'rule-taste-100' && selectTasteLibraryTrigger(state, clusterId).eligible !== true
      })
      if (blockedTasteCluster) return state
      const event = eventFor(action, 'Variant', action.variant.id)
      const issues = state.issues.map((item) => action.variant.sourceIssueIds.includes(item.id) ? { ...item, variantIds: addUnique(item.variantIds, action.variant.id), updatedAt: event.at } : item)
      const issueClusters = state.issueClusters.map((item) => action.variant.sourceClusterIds.includes(item.id) ? { ...item, variantIds: addUnique(item.variantIds, action.variant.id), status: 'VARIANT_CREATED' as const, updatedAt: event.at } : item)
      return finalize(state, event, { variants: [...state.variants, action.variant], issues, issueClusters })
    }
    case 'CREATE_EXPERIMENT': {
      if (state.experiments.some((item) => item.id === action.experiment.id)) return state
      const selectedDatasets = action.experiment.datasetIds.map((id) => state.datasets.find((item) => item.id === id))
      if (!selectedDatasets.length || selectedDatasets.some((dataset) => !dataset?.frozen)) return state
      const snapshotMatches = selectedDatasets.every((dataset) => action.experiment.configSnapshot.datasetVersions.some((entry) => entry.datasetId === dataset!.id && entry.version === dataset!.version && entry.sampleCount === dataset!.sampleCount && entry.versionId === `${entry.datasetId}@${entry.version}`)) && action.experiment.configSnapshot.datasetVersions.length === selectedDatasets.length
      if (!snapshotMatches || action.experiment.configSnapshot.repeatCount < 1 || action.experiment.configSnapshot.timeoutMs < 1 || !action.experiment.configSnapshot.model.trim() || !action.experiment.configSnapshot.runEnvironment.trim()) return state
      if (action.experiment.level === 'WINDOW_COMBINATION') {
        const window = state.windows.find((item) => item.id === action.experiment.windowId)
        const sameMembership = window && JSON.stringify([...window.candidateVariantIds].sort()) === JSON.stringify([...action.experiment.variantIds].sort())
        const allPassed = window?.candidateVariantIds.every((variantId) => state.experiments.some((candidate) => candidate.level === 'SINGLE_VARIANT' && candidate.variantIds.length === 1 && candidate.variantIds[0] === variantId && candidate.gateDecisionId && state.gateDecisions.some((decision) => decision.id === candidate.gateDecisionId && decision.conclusion === 'PASS')))
        if (!sameMembership || !allPassed) return state
      }
      const configSnapshot = freezeExperimentConfig(state, action.experiment, action.meta.at ?? new Date().toISOString())
      const event = eventFor(action, 'Experiment', action.experiment.id, { configSnapshot: clone(configSnapshot) })
      const suppliedRuns = (action.runs ?? []).filter((run) => run.experimentId === action.experiment.id)
      const experiment = { ...clone(action.experiment), runIds: [...new Set([...action.experiment.runIds, ...suppliedRuns.map((run) => run.id)])], configSnapshot, updatedAt: event.at }
      const variants = state.variants.map((item) => experiment.variantIds.includes(item.id) ? { ...item, experimentIds: addUnique(item.experimentIds, experiment.id), status: item.status === 'DRAFT' || item.status === 'READY' ? 'EXPERIMENTING' as const : item.status, updatedAt: event.at } : item)
      const windows = state.windows.map((item) => item.id !== experiment.windowId ? item : experiment.level === 'SINGLE_VARIANT' ? { ...item, singleExperimentIds: addUnique(item.singleExperimentIds, experiment.id), updatedAt: event.at } : { ...item, combinationExperimentId: experiment.id, updatedAt: event.at })
      return finalize(state, event, { experiments: [...state.experiments, experiment], experimentRuns: [...state.experimentRuns, ...suppliedRuns.map((run) => normalizeSuppliedRun(state, experiment, run, event.at))], variants, windows })
    }
    case 'UPDATE_EXPERIMENT': {
      const current = state.experiments.find((item) => item.id === action.experimentId)
      if (!current) return state
      const allowed = new Set(['name', 'rollbackItems', 'knownRisks'])
      const safePatch = Object.fromEntries(Object.entries(action.patch).filter(([key]) => allowed.has(key))) as Partial<Pick<Experiment, 'name' | 'rollbackItems' | 'knownRisks'>>
      const event = eventFor(action, 'Experiment', action.experimentId, action.patch as Record<string, unknown>)
      const experiments = state.experiments.map((item) => item.id === action.experimentId ? { ...item, ...safePatch, updatedAt: event.at } : item)
      return finalize(state, event, { experiments })
    }
    case 'START_EXPERIMENT_RUN': {
      const experiment = state.experiments.find((item) => item.id === action.experimentId)
      if (!experiment || (!['DRAFT', 'QUEUED'].includes(experiment.status) && !(action.retry && experiment.status === 'FAILED'))) return state
      if (experiment.level === 'WINDOW_COMBINATION' && experiment.variantIds.some((variantId) => !state.experiments.some((candidate) => candidate.level === 'SINGLE_VARIANT' && candidate.variantIds.length === 1 && candidate.variantIds[0] === variantId && candidate.gateDecisionId && state.gateDecisions.some((decision) => decision.id === candidate.gateDecisionId && decision.conclusion === 'PASS')))) return state
      const frozenCaseIds = experiment.configSnapshot.datasetVersions.flatMap((version) => version.caseIds ?? state.datasets.find((dataset) => dataset.id === version.datasetId)?.caseIds ?? [])
      const caseIds = [...new Set(action.caseIds?.filter((id) => frozenCaseIds.includes(id) && state.cases.some((item) => item.id === id)) ?? frozenCaseIds)]
      if (!caseIds.length) return state
      const event = eventFor(action, 'Experiment', experiment.id, { caseIds, retry: Boolean(action.retry) })
      const configHash = `cfg-${experiment.id}-${experiment.configSnapshot.createdAt}`
      const runs = caseIds.flatMap((caseId) => (['BASELINE', 'CANDIDATE'] as const).flatMap((arm) => Array.from({ length: experiment.configSnapshot.repeatCount }, (_, offset): ExperimentRun => ({ id: `run-${experiment.id}-${caseId}-${arm.toLowerCase()}-${offset + 1}`, experimentId: experiment.id, caseId, repetition: offset + 1, arm, status: 'RUNNING', durationMs: 0, configHash, configSnapshot: clone(experiment.configSnapshot), evalSnapshot: runEvalSnapshot(state, experiment.configSnapshot, event.at), windowSnapshot: runWindowSnapshot(state, experiment), createdAt: event.at, updatedAt: event.at }))))
      const experiments = state.experiments.map((item) => item.id === experiment.id ? { ...item, runIds: runs.map((run) => run.id), metrics: [], failedCaseIds: [], status: 'RUNNING' as const, gateDecisionId: undefined, updatedAt: event.at } : item)
      return finalize(state, event, { experiments, experimentRuns: [...state.experimentRuns.filter((run) => run.experimentId !== experiment.id), ...runs] })
    }
    case 'COMPLETE_EXPERIMENT_RUN': {
      const experiment = state.experiments.find((item) => item.id === action.experimentId)
      const existingRuns = state.experimentRuns.filter((run) => run.experimentId === action.experimentId)
      if (!experiment || experiment.status !== 'RUNNING' || !existingRuns.length) return state
      const event = eventFor(action, 'Experiment', experiment.id)
      const runs = existingRuns.map((run) => { const baseline = deterministicScore(`${experiment.id}:${run.caseId}:${run.repetition}`); const processScore = Math.min(1, baseline + (run.arm === 'CANDIDATE' ? 0.09 : 0)); return { ...run, status: 'COMPLETED' as const, processScore, outcomeScore: Math.max(0, processScore - 0.03), durationMs: 30000 + Math.round(processScore * 10000), error: undefined, updatedAt: event.at } })
      const failedCaseIds = [...new Set(runs.filter((run) => (run.outcomeScore ?? 1) < 0.5).map((run) => run.caseId))]
      const experiments = state.experiments.map((item) => item.id === experiment.id ? { ...item, metrics: experimentMetrics(runs), failedCaseIds, status: 'COMPLETED' as const, updatedAt: event.at } : item)
      return finalize(state, event, { experiments, experimentRuns: [...state.experimentRuns.filter((run) => run.experimentId !== experiment.id), ...runs] })
    }
    case 'FAIL_EXPERIMENT_RUN': {
      const experiment = state.experiments.find((item) => item.id === action.experimentId)
      const existingRuns = state.experimentRuns.filter((run) => run.experimentId === action.experimentId)
      if (!experiment || experiment.status !== 'RUNNING' || !existingRuns.length || !action.error.trim()) return state
      const event = eventFor(action, 'Experiment', experiment.id, { error: action.error })
      const runs = existingRuns.map((run) => ({ ...run, status: 'FAILED' as const, error: action.error, updatedAt: event.at }))
      const experiments = state.experiments.map((item) => item.id === experiment.id ? { ...item, status: 'FAILED' as const, updatedAt: event.at } : item)
      return finalize(state, event, { experiments, experimentRuns: [...state.experimentRuns.filter((run) => run.experimentId !== experiment.id), ...runs] })
    }
    case 'UPDATE_EXPERIMENT_DECISION': {
      const experiment = state.experiments.find((item) => item.id === action.experimentId)
      if (!experiment || experiment.status !== 'COMPLETED' || action.decision.experimentId !== experiment.id) return state
      const event = eventFor(action, 'GateDecision', action.decision.id, { experimentId: action.experimentId, conclusion: action.decision.conclusion })
      const exists = state.gateDecisions.some((item) => item.id === action.decision.id)
      const gateDecisions = exists ? state.gateDecisions.map((item) => item.id === action.decision.id ? action.decision : item) : [...state.gateDecisions, action.decision]
      const experiments = state.experiments.map((item) => item.id === action.experimentId ? { ...item, gateDecisionId: action.decision.id, status: 'DECIDED' as const, updatedAt: event.at } : item)
      return finalize(state, event, { gateDecisions, experiments })
    }
    case 'CREATE_RELEASE': {
      if (state.releases.some((item) => item.id === action.release.id)) return state
      const window = state.windows.find((item) => item.id === action.release.windowId)
      const experiment = state.experiments.find((item) => item.id === action.release.combinationExperimentId)
      const decision = state.gateDecisions.find((item) => item.id === action.release.gateDecisionId)
      const exactMembership = window && experiment && JSON.stringify([...window.candidateVariantIds].sort()) === JSON.stringify([...action.release.variantIds].sort()) && JSON.stringify([...experiment.variantIds].sort()) === JSON.stringify([...action.release.variantIds].sort())
      if (!window || !experiment || experiment.level !== 'WINDOW_COMBINATION' || experiment.windowId !== window.id || window.combinationExperimentId !== experiment.id || decision?.experimentId !== experiment.id || decision.conclusion !== 'PASS' || !exactMembership) return state
      const event = eventFor(action, 'ReleaseVersion', action.release.id)
      return finalize(state, event, { releases: [...state.releases, { ...action.release, updatedAt: event.at }] })
    }
    case 'UPDATE_RELEASE': {
      const existing = state.releases.find((item) => item.id === action.releaseId)
      if (!existing || (action.patch.status === 'ROLLED_BACK' && (!(action.patch.rollbackVersionId ?? existing.rollbackVersionId) || !(action.patch.rollbackReason ?? existing.rollbackReason)?.trim() || (action.patch.rollbackVersionId ?? existing.rollbackVersionId) === existing.id || !state.releases.some((item) => item.id === (action.patch.rollbackVersionId ?? existing.rollbackVersionId))))) return state
      const event = eventFor(action, 'ReleaseVersion', action.releaseId, action.patch as Record<string, unknown>)
      const releases = state.releases.map((item) => item.id === action.releaseId ? { ...item, ...action.patch, updatedAt: event.at } : item)
      return finalize(state, event, { releases })
    }
    case 'UPDATE_RULE': {
      const event = eventFor(action, 'RuleConfig', action.ruleId, action.patch as Record<string, unknown>)
      const rules = state.rules.map((item) => item.id === action.ruleId ? { ...item, ...action.patch, updatedAt: event.at } : item)
      return finalize(state, event, { rules })
    }
    case 'UPSERT_SCOPED_RULE': {
      if (!action.rule.configuration || validateScopedRule(state, action.rule).length) return state
      const existing = state.rules.find(item => item.id === action.rule.id)
      const event = eventFor(action, 'RuleConfig', action.rule.id, { configuration: action.rule.configuration, status: action.rule.status })
      const rule = { ...structuredClone(action.rule), createdAt: existing?.createdAt ?? event.at, updatedAt: event.at }
      const rules = existing ? state.rules.map(item => item.id === rule.id ? rule : item) : [...state.rules, rule]
      return finalize(state, event, { rules })
    }
    case 'UPDATE_ASSET': {
      const existing = state.assets.find((item) => item.id === action.assetId)
      if (!existing) return state
      const requestedPublic = action.patch.visibility === 'PUBLIC' || action.patch.publishStatus === 'PUBLISHED'
      const sanitized = action.patch.sanitizationStatus ?? existing.sanitizationStatus
      const reviewed = action.patch.reviewStatus ?? existing.reviewStatus
      const allowed = !requestedPublic || (sanitized === 'PASSED' && reviewed === 'APPROVED')
      const effectivePatch = allowed ? action.patch : { ...action.patch, visibility: existing.visibility, publishStatus: existing.publishStatus }
      const event = eventFor(action, 'Asset', action.assetId, { ...effectivePatch, ...(allowed ? {} : { rejectedPublication: true }) } as Record<string, unknown>)
      const assets = state.assets.map((item) => item.id === action.assetId ? { ...item, ...effectivePatch, updatedAt: event.at } : item)
      return finalize(state, event, { assets })
    }
    case 'UPLOAD_ASSET': {
      if (state.assets.some((item) => item.id === action.asset.id)) return state
      const event = eventFor(action, 'Asset', action.asset.id)
      const asset: Asset = { ...action.asset, visibility: 'PRIVATE', sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED', updatedAt: event.at }
      return finalize(state, event, { assets: [...state.assets, asset] })
    }
    case 'CREATE_PLANNED_PERSONAL_SKILL': {
      if (state.skills.some((item) => item.id === action.skill.id) || action.skill.type !== 'PERSONAL') return state
      const event = eventFor(action, 'Skill', action.skill.id)
      const skill: Skill = { ...action.skill, type: 'PERSONAL', version: '未生成', visibility: 'PRIVATE', generationStatus: 'PLANNED', updatedAt: event.at }
      const assets = state.assets.map((item) => skill.assetIds.includes(item.id) ? { ...item, skillIds: addUnique(item.skillIds, skill.id), updatedAt: event.at } : item)
      return finalize(state, event, { skills: [...state.skills, skill], assets })
    }
    case 'CREATE_DATASET_VERSION': {
      if (state.datasets.some((item) => item.id === action.dataset.id) || action.dataset.caseIds.some((id) => !state.cases.some((item) => item.id === id))) return state
      const source = action.sourceDatasetId ? state.datasets.find((item) => item.id === action.sourceDatasetId) : undefined
      if (action.sourceDatasetId && (!source || !source.frozen)) return state
      const caseIds = [...new Set(action.dataset.caseIds)]
      const externalSampleCount = Math.max(0, action.dataset.population.externalSampleCount)
      const sampleCount = caseIds.length + externalSampleCount
      const event = eventFor(action, 'Dataset', action.dataset.id, { sourceDatasetId: source?.id, version: action.dataset.version })
      const dataset: Dataset = { ...action.dataset, frozen: false, caseIds, sampleCount, population: { ...action.dataset.population, localCaseCount: caseIds.length, externalSampleCount, totalSampleCount: sampleCount }, updatedAt: event.at }
      return finalize(state, event, { datasets: [...state.datasets, dataset] })
    }
    case 'CREATE_CUSTOM_DATASET': {
      const input = action.dataset
      if (state.datasets.some(item => item.id === input.id) || input.caseIds.some(id => !state.cases.some(item => item.id === id))) return state
      const caseIds = [...new Set(input.caseIds)]
      const externalSampleCount = Math.max(0, input.population.externalSampleCount)
      const sampleCount = caseIds.length + externalSampleCount
      const event = eventFor(action, 'Dataset', input.id, { datasetOrigin: 'USER_CUSTOM', version: input.version })
      const dataset: Dataset = { ...input, datasetOrigin: 'USER_CUSTOM', purpose: input.purpose ?? '自定义数据集', datasetCategory: input.datasetCategory ?? 'PERSONAL', ownerScope: input.ownerScope ?? 'USER', createdBy: input.createdBy ?? action.meta.actor, frozen: false, caseIds, sampleCount, population: { ...input.population, localCaseCount: caseIds.length, externalSampleCount, totalSampleCount: sampleCount }, updatedAt: event.at }
      return finalize(state, event, { datasets: [...state.datasets, dataset] })
    }
    case 'UPDATE_DATASET_VERSION': {
      const current = state.datasets.find((item) => item.id === action.datasetId)
      if (!current || current.frozen) return state
      const event = eventFor(action, 'Dataset', action.datasetId, action.patch as Record<string, unknown>)
      const population = action.patch.population ? { ...action.patch.population, localCaseCount: current.caseIds.length, externalSampleCount: Math.max(0, action.patch.population.externalSampleCount), totalSampleCount: current.caseIds.length + Math.max(0, action.patch.population.externalSampleCount) } : current.population
      const datasets = state.datasets.map((item) => item.id === action.datasetId ? { ...item, ...action.patch, population, id: item.id, version: item.version, caseIds: item.caseIds, sampleCount: population.totalSampleCount, frozen: false, updatedAt: event.at } : item)
      return finalize(state, event, { datasets })
    }
    case 'SET_DATASET_MEMBERS': {
      const current = state.datasets.find((item) => item.id === action.datasetId)
      if (!current || current.frozen || action.caseIds.some((id) => !state.cases.some((item) => item.id === id))) return state
      const caseIds = [...new Set(action.caseIds)]
      const externalSampleCount = current.population.externalSampleCount
      const sampleCount = caseIds.length + externalSampleCount
      const event = eventFor(action, 'Dataset', action.datasetId, { caseIds })
      const datasets = state.datasets.map((item) => item.id === action.datasetId ? { ...item, caseIds, sampleCount, population: { ...item.population, localCaseCount: caseIds.length, totalSampleCount: sampleCount }, updatedAt: event.at } : item)
      return finalize(state, event, { datasets })
    }
    case 'ADD_DATASET_TRACES': {
      const traceIds = [...new Set(action.traceIds.map(id => resolveIdentity(state, 'trace', id)))]
      if (!traceIds.length) return state
      const current = state.datasets.find(item => item.id === action.datasetId)
      const existingMemberships = state.datasetMemberships ?? []
      if (current && traceIds.length > 0 && traceIds.every(traceId => existingMemberships.some(item => item.datasetId === current.id && item.datasetVersion === current.version && item.traceIds.includes(traceId)))) return state
      const merged = mergeDatasetTraces(state, action.datasetId, traceIds, action.meta.at ?? new Date().toISOString(), action.meta.actor)
      if (!merged) return state
      const event = eventFor(action, 'Dataset', action.datasetId, { traceIds })
      return finalize(state, event, merged)
    }
    case 'APPLY_DATASET_SAMPLING': {
      const snapshot = action.snapshot
      if (snapshot.datasetId !== action.datasetId || !['PREVIEW', 'APPLIED'].includes(snapshot.status)) return state
      if ((state.datasetSamplingSnapshots ?? []).some(item => item.id === snapshot.id)) return state
      const traceIds = [...new Set(snapshot.allocations.flatMap(item => item.sampledTraceIds))].map(id => resolveIdentity(state, 'trace', id))
      const merged = mergeDatasetTraces(state, action.datasetId, traceIds, action.meta.at ?? new Date().toISOString(), action.meta.actor)
      if (!merged) return state
      const event = eventFor(action, 'DatasetSamplingSnapshot', snapshot.id, { datasetId: action.datasetId, traceCount: traceIds.length, assetId: snapshot.assetId, assetVersion: snapshot.assetVersion })
      const applied: DatasetSamplingSnapshot = { ...snapshot, status: 'APPLIED', appliedAt: event.at, updatedAt: event.at, candidateTraceIds: [...new Set(snapshot.candidateTraceIds.map(id => resolveIdentity(state, 'trace', id)))], allocations: snapshot.allocations.map(item => ({ ...item, sampledTraceIds: item.sampledTraceIds.map(id => resolveIdentity(state, 'trace', id)) })) }
      const snapshots = [...(state.datasetSamplingSnapshots ?? []), applied]
      return finalize(state, event, { ...merged, datasetSamplingSnapshots: snapshots })
    }
    case 'FREEZE_DATASET_VERSION': {
      const current = state.datasets.find((item) => item.id === action.datasetId)
      if (!current || current.frozen || !current.name.trim() || !current.scope.trim() || !current.source.trim() || !current.population.sourceSystem.trim() || !current.population.countingRule.trim()) return state
      const event = eventFor(action, 'Dataset', action.datasetId, { frozen: true })
      return finalize(state, event, { datasets: state.datasets.map((item) => item.id === action.datasetId ? { ...item, frozen: true, updatedAt: event.at } : item) })
    }
    case 'CREATE_EVALUATION_BATCH': {
      const traceIds = [...new Set(action.batch.traceIds.map((id) => resolveIdentity(state, 'trace', id)))]
      if (state.evaluationBatches.some((item) => item.id === action.batch.id) || traceIds.some((id) => !state.traces.some((trace) => trace.id === id))) return state
      const eventAt = action.meta.at ?? new Date().toISOString()
      const placeholders = traceIds.map((traceId) => pendingPackage(state, action.batch, traceId, eventAt))
      const event = eventFor(action, 'EvaluationBatch', action.batch.id, { traceCount: traceIds.length, packageIds: placeholders.map((item) => item.id) })
      const batch = { ...action.batch, traceIds, packageIds: [...new Set([...action.batch.packageIds, ...placeholders.map((item) => item.id)])], jobIds: [...new Set(action.batch.jobIds)], stats: { ...action.batch.stats, inputTraceCount: traceIds.length, pendingCount: traceIds.length, successCount: 0, partialCount: 0, failedCount: 0 }, updatedAt: event.at }
      return finalize(state, event, { evaluationBatches: [...state.evaluationBatches, batch], tracePackages: [...state.tracePackages, ...placeholders] })
    }
    case 'QUEUE_EVALUATION_JOB': {
      const traceIds = [...new Set(action.job.traceIds.map((id) => resolveIdentity(state, 'trace', id)))]
      if (state.evaluationJobs.some((item) => item.id === action.job.id) || !state.evaluationBatches.some((batch) => batch.id === action.job.batchId) || traceIds.some((id) => !state.traces.some((trace) => trace.id === id))) return state
      const event = eventFor(action, 'EvaluationJob', action.job.id, { batchId: action.job.batchId, attempt: action.job.attempt })
      const job = { ...action.job, traceIds, processedTraceIds: action.job.processedTraceIds.map((id) => resolveIdentity(state, 'trace', id)), failedTraceIds: action.job.failedTraceIds.map((id) => resolveIdentity(state, 'trace', id)), status: action.job.status, updatedAt: event.at } as EvaluationJob
      const batches = state.evaluationBatches.map((batch) => batch.id !== job.batchId ? batch : { ...batch, jobIds: addUnique(batch.jobIds, job.id), status: batch.status === 'DRAFT' ? 'QUEUED' as const : batch.status, updatedAt: event.at })
      return finalize(state, event, { evaluationJobs: [...state.evaluationJobs, job], evaluationBatches: batches })
    }
    case 'START_EVALUATION_JOB': {
      const current = state.evaluationJobs.find((item) => item.id === action.jobId)
      if (!current || current.status !== 'QUEUED') return state
      const event = eventFor(action, 'EvaluationJob', current.id, { status: 'RUNNING' })
      const evaluationJobs = state.evaluationJobs.map((item) => item.id === current.id ? { ...item, status: 'RUNNING' as const, startedAt: event.at, updatedAt: event.at } : item)
      const evaluationBatches = state.evaluationBatches.map((item) => item.id === current.batchId ? { ...item, status: 'RUNNING' as const, startedAt: item.startedAt ?? event.at, updatedAt: event.at } : item)
      return finalize(state, event, { evaluationJobs, evaluationBatches })
    }
    case 'COMPLETE_EVALUATION_JOB': {
      const current = state.evaluationJobs.find((item) => item.id === action.jobId)
      if (!current || current.status !== 'RUNNING') return state
      const currentBatch = state.evaluationBatches.find((item) => item.id === current.batchId)
      if (!currentBatch) return state
      const materialized = current.traceIds.map((traceId) => materializeTrace(state, currentBatch, current, traceId, action.meta.at ?? new Date().toISOString()))
      const materializedById = new Map(materialized.map((item) => [item.packageRecord.id, item]))
      const packageIds = [...new Set([...currentBatch.packageIds, ...materialized.map((item) => item.packageRecord.id)])]
      const event = eventFor(action, 'EvaluationJob', current.id, { status: 'COMPLETED', packageIds: materialized.map((item) => item.packageRecord.id), traceIds: current.traceIds })
      const evaluationJobs = state.evaluationJobs.map((item) => item.id === current.id ? { ...item, status: 'COMPLETED' as const, processedTraceIds: [...current.traceIds], failedTraceIds: [], completedAt: event.at, updatedAt: event.at } : item)
      const tracePackages = state.tracePackages
        .filter((pkg) => !materializedById.has(pkg.id))
        .concat(materialized.map((item) => item.packageRecord))
      const evaluationFindings = state.evaluationFindings
        .filter((finding) => !materialized.some((item) => item.packageRecord.findingIds.includes(finding.id)))
        .concat(materialized.flatMap((item) => item.findings))
      const routingDecisions = state.routingDecisions
        .filter((decision) => !materialized.some((item) => item.packageRecord.routingDecisionIds.includes(decision.id)))
        .concat(materialized.flatMap((item) => item.decisions))
      const routingDeliveries = state.routingDeliveries
        .filter((delivery) => !materialized.some((item) => item.packageRecord.routingDeliveryIds.includes(delivery.id)))
        .concat(materialized.flatMap((item) => item.deliveries))
      const algorithmBadcases = state.algorithmBadcases
        .filter((badcase) => !materialized.some((item) => item.packageRecord.badcaseIds.includes(badcase.id)))
        .concat(materialized.flatMap((item) => item.badcases))
      const badcaseQueues = state.badcaseQueues.map((queue) => {
        const newDeliveries = materialized.flatMap((item) => item.deliveries.filter((delivery) => delivery.queueId === queue.id).map((delivery) => delivery.id))
        const newItems = materialized.flatMap((item) => item.badcases.filter((badcase) => badcase.queueId === queue.id).map((badcase) => badcase.id))
        return { ...queue, deliveryIds: [...new Set([...queue.deliveryIds, ...newDeliveries])], itemIds: [...new Set([...queue.itemIds, ...newItems])], updatedAt: event.at }
      })
      const evaluationBatches = state.evaluationBatches.map((item) => {
        if (item.id !== current.batchId) return item
        const packages = tracePackages.filter((pkg) => pkg.batchId === item.id)
        const stats = batchCounts(item.traceIds, packages)
        const nextStatus: EvaluationBatch['status'] = stats.successCount === stats.inputTraceCount ? 'COMPLETED' : stats.failedCount === stats.inputTraceCount && stats.successCount === 0 ? 'FAILED' : 'PARTIAL'
        return { ...item, packageIds, status: nextStatus, completedAt: event.at, stats, updatedAt: event.at }
      })
      return finalize(state, event, { evaluationJobs, evaluationBatches, tracePackages, evaluationFindings, routingDecisions, routingDeliveries, algorithmBadcases, badcaseQueues })
    }
    case 'FAIL_EVALUATION_JOB': {
      const current = state.evaluationJobs.find((item) => item.id === action.jobId)
      if (!current || !['QUEUED', 'RUNNING'].includes(current.status) || !action.error.trim()) return state
      const event = eventFor(action, 'EvaluationJob', current.id, { status: 'FAILED', error: action.error })
      const evaluationJobs = state.evaluationJobs.map((item) => item.id === current.id ? { ...item, status: 'FAILED' as const, failedTraceIds: [...current.traceIds], errorReason: action.error, completedAt: event.at, updatedAt: event.at } : item)
      const tracePackages = state.tracePackages.map((pkg) => pkg.batchId === current.batchId && current.traceIds.includes(pkg.traceId) && pkg.status === 'PENDING' ? { ...pkg, status: 'FAILED' as const, processCoverage: 'MISSING' as const, outcomeCoverage: 'MISSING' as const, updatedAt: event.at } : pkg)
      const evaluationBatches = state.evaluationBatches.map((item) => {
        if (item.id !== current.batchId) return item
        const stats = batchCounts(item.traceIds, tracePackages.filter((pkg) => pkg.batchId === item.id))
        return { ...item, status: stats.failedCount === stats.inputTraceCount ? 'FAILED' as const : 'PARTIAL' as const, errorReason: action.error, stats, updatedAt: event.at }
      })
      return finalize(state, event, { evaluationJobs, evaluationBatches, tracePackages })
    }
    case 'RETRY_EVALUATION_JOB': {
      const previous = state.evaluationJobs.find((item) => item.id === action.jobId)
      if (!previous || !['FAILED', 'PARTIAL', 'CANCELLED'].includes(previous.status)) return state
      const event = eventFor(action, 'EvaluationJob', previous.id, { retry: true })
      const retry: EvaluationJob = { ...previous, id: `${previous.id}-retry-${previous.attempt + 1}`, attempt: previous.attempt + 1, status: 'QUEUED', processedTraceIds: [], failedTraceIds: [], queuedAt: event.at, startedAt: undefined, completedAt: undefined, errorReason: undefined, createdAt: event.at, updatedAt: event.at }
      const batches = state.evaluationBatches.map((batch) => batch.id !== previous.batchId ? batch : { ...batch, jobIds: addUnique(batch.jobIds, retry.id), status: 'QUEUED' as const, updatedAt: event.at })
      return finalize(state, event, { evaluationJobs: [...state.evaluationJobs, retry], evaluationBatches: batches })
    }
    case 'REVIEW_OUTCOME_DIMENSION': {
      const input = { ...action.input, traceId: resolveIdentity(state, 'trace', action.input.traceId) }
      const evaluation = state.outcomeEvals.find(item => item.id === input.evaluationId)
      if (!evaluation) throw new Error('产物细项评测不存在，请刷新后重试')
      validateOutcomeReviewInput(input, evaluation)
      const trace = state.traces.find(item => item.id === input.traceId)
      if (!trace || trace.caseId !== evaluation.caseId) throw new Error('产物评测不属于当前 Trace 或 Case')
      const artifact = state.artifacts.find(item => item.id === input.artifactId)
      if (!artifact || artifact.traceId !== input.traceId || artifact.caseId !== evaluation.caseId) throw new Error('产物不属于当前 Trace')
      const projected = projectArtifactOutcomeEvaluation(state, evaluation)
      const metadata = { rubricRule: projected.rubricRule, evalAgentVersion: projected.evalAgentVersion }
      const duplicate = state.outcomeEvals.flatMap(item => item.revisions.map(revision => ({ evaluationId: item.id, revision }))).find(item => item.revision.id === input.reviewId)
      if (duplicate) {
        const candidate = toOutcomeReviewRevision(input, evaluation, metadata)
        const { supersedesRevisionId: _old, ...old } = duplicate.revision
        const { supersedesRevisionId: _candidate, ...next } = candidate
        if (duplicate.evaluationId === evaluation.id && JSON.stringify(old) === JSON.stringify(next)) return state
        throw new Error('复核记录 ID 重复，不能覆盖已有历史')
      }
      const revision = toOutcomeReviewRevision(input, evaluation, metadata)
      const event = eventFor(action, 'OutcomeEval', evaluation.id, { reviewId: revision.id, traceId: input.traceId, artifactId: input.artifactId, automaticRevisionId: input.automaticRevisionId })
      const outcomeEvals = state.outcomeEvals.map(item => item.id === evaluation.id ? { ...item, revisions: [...item.revisions, revision], updatedAt: event.at } : item)
      return finalize(state, event, { outcomeEvals })
    }
    case 'REVIEW_TRACE_MODULE': {
      const { input } = action
      const pkg = state.tracePackages.find((item) => item.id === input.packageId)
      const score = pkg?.moduleScores.find((item) => item.id === input.moduleScoreId)
      if (!pkg || !score || pkg.traceId !== input.traceId || pkg.caseId !== score.caseId) throw new Error('复核范围与当前 Trace 评测包不匹配')
      const revisions = state.moduleReviews ?? []
      const duplicate = revisions.find((item) => item.id === input.reviewId)
      if (duplicate) {
        if (duplicate.moduleScoreId === input.moduleScoreId && duplicate.traceId === input.traceId && duplicate.packageId === input.packageId && duplicate.automaticRevisionId === input.automaticRevisionId && duplicate.humanScore === input.humanScore && duplicate.auxiliaryVerdict === input.auxiliaryVerdict && duplicate.reason === input.reason.trim() && duplicate.reviewer === input.reviewer.trim() && duplicate.reviewedAt === input.reviewedAt) return state
        throw new Error('重复的复核记录 ID 已被其他内容使用')
      }
      const previous = revisions.filter((item) => item.moduleScoreId === score.id && item.traceId === score.traceId).at(-1)
      const revision = toModuleReviewRevision(input, score, previous?.id)
      const event = eventFor(action, 'ModuleReviewRevision', revision.id, { reviewId: revision.id, moduleScoreId: score.id, packageId: pkg.id, traceId: pkg.traceId })
      const moduleScores = pkg.moduleScores.map((item) => item.id === score.id ? { ...item, automaticRevisionId: revision.automaticRevisionId, humanStatus: revision.auxiliaryVerdict, humanScore: revision.humanScore, humanNote: revision.reason, humanUpdatedAt: revision.reviewedAt, humanUpdatedBy: revision.reviewer, updatedAt: event.at } : item)
      return finalize(state, event, { moduleReviews: [...revisions, revision], tracePackages: state.tracePackages.map((item) => item.id === pkg.id ? { ...item, moduleScores, updatedAt: event.at } : item) })
    }
    case 'UPDATE_MODULE_EVALUATION': {
      const pkg = state.tracePackages.find((item) => item.id === action.packageId)
      if (!pkg || !pkg.moduleScores.some((score) => score.id === action.scoreId)) return state
      const event = eventFor(action, 'ModuleEvaluationScore', action.scoreId, action.patch as Record<string, unknown>)
      const score = pkg.moduleScores.find((item) => item.id === action.scoreId)!
      const previous = (state.moduleReviews ?? []).filter((item) => item.moduleScoreId === score.id).at(-1)
      const revision = toModuleReviewRevision({ traceId: pkg.traceId, packageId: pkg.id, moduleScoreId: score.id, automaticRevisionId: automaticModuleRevisionId(score), humanScore: action.patch.humanScore, auxiliaryVerdict: action.patch.humanStatus ?? 'UNKNOWN', reason: action.patch.humanNote ?? action.meta.reason, reviewer: action.patch.humanUpdatedBy ?? action.meta.actor, reviewedAt: action.patch.humanUpdatedAt ?? event.at, reviewId: `module-review-${event.id}` }, score, previous?.id, 'LEGACY')
      if (state.moduleReviews?.some((item) => item.id === revision.id)) return state
      const humanPatch: Partial<ModuleEvaluationScore> = {
        humanStatus: revision.auxiliaryVerdict,
        humanScore: revision.humanScore,
        humanNote: revision.reason,
        humanUpdatedAt: revision.reviewedAt,
        humanUpdatedBy: revision.reviewer
      }
      const moduleScores = pkg.moduleScores.map((score) => score.id === action.scoreId ? { ...score, ...humanPatch, automaticRevisionId: revision.automaticRevisionId, updatedAt: event.at } : score)
      const tracePackages = state.tracePackages.map((item) => item.id === pkg.id ? { ...item, moduleScores, updatedAt: event.at } : item)
      return finalize(state, event, { tracePackages, moduleReviews: [...(state.moduleReviews ?? []), revision] })
    }
    case 'UPDATE_EVALUATION_FINDING': {
      const current = state.evaluationFindings.find((item) => item.id === action.findingId)
      if (!current) return state
      const event = eventFor(action, 'EvaluationFinding', action.findingId, action.patch as Record<string, unknown>)
      const allowedPatch = Object.fromEntries(Object.entries({
        status: action.patch.status,
        optimizationDimension: action.patch.optimizationDimension,
        selectedOptimizationCondition: action.patch.selectedOptimizationCondition,
        description: action.patch.description,
        routingDecisionIds: action.patch.routingDecisionIds,
        routingDeliveryIds: action.patch.routingDeliveryIds
      }).filter(([, value]) => value !== undefined)) as Partial<EvaluationFinding>
      const evaluationFindings = state.evaluationFindings.map((item) => item.id === action.findingId ? { ...item, ...allowedPatch, updatedAt: event.at } : item)
      return finalize(state, event, { evaluationFindings })
    }
    case 'UPDATE_ROUTING_DECISION': {
      const current = state.routingDecisions.find((item) => item.id === action.decisionId)
      if (!current) return state
      const event = eventFor(action, 'RoutingDecision', action.decisionId, action.patch as Record<string, unknown>)
      const allowedPatch = Object.fromEntries(Object.entries({ status: action.patch.status, reason: action.patch.reason, confirmedBy: action.patch.confirmedBy, confirmedAt: action.patch.confirmedAt, deliveryIds: action.patch.deliveryIds }).filter(([, value]) => value !== undefined)) as Partial<RoutingDecision>
      const routingDecisions = state.routingDecisions.map((item) => item.id === action.decisionId ? { ...item, ...allowedPatch, updatedAt: event.at } : item)
      return finalize(state, event, { routingDecisions })
    }
    case 'UPDATE_ROUTING_DELIVERY': {
      const current = state.routingDeliveries.find((item) => item.id === action.deliveryId)
      if (!current) return state
      const event = eventFor(action, 'RoutingDelivery', action.deliveryId, action.patch as Record<string, unknown>)
      const allowedPatch = Object.fromEntries(Object.entries({ status: action.patch.status, owner: action.patch.owner, note: action.patch.note, deliveredAt: action.patch.deliveredAt, acknowledgedAt: action.patch.acknowledgedAt, issueId: action.patch.issueId, issueClusterId: action.patch.issueClusterId, variantId: action.patch.variantId, regressionDatasetId: action.patch.regressionDatasetId }).filter(([, value]) => value !== undefined)) as Partial<RoutingDelivery>
      const routingDeliveries = state.routingDeliveries.map((item) => item.id === action.deliveryId ? { ...item, ...allowedPatch, updatedAt: event.at } : item)
      return finalize(state, event, { routingDeliveries })
    }
    case 'UPDATE_ALGORITHM_BADCASE': {
      const current = state.algorithmBadcases.find((item) => item.id === action.badcaseId)
      if (!current) return state
      const event = eventFor(action, 'AlgorithmBadcaseItem', action.badcaseId, action.patch as Record<string, unknown>)
      const allowedPatch = Object.fromEntries(Object.entries({ status: action.patch.status, owner: action.patch.owner, note: action.patch.note, confirmedBy: action.patch.confirmedBy, confirmedAt: action.patch.confirmedAt, regressionDatasetId: action.patch.regressionDatasetId, issueId: action.patch.issueId, issueClusterId: action.patch.issueClusterId, variantId: action.patch.variantId }).filter(([, value]) => value !== undefined)) as Partial<AlgorithmBadcaseItem>
      const algorithmBadcases = state.algorithmBadcases.map((item) => item.id === action.badcaseId ? { ...item, ...allowedPatch, updatedAt: event.at } : item)
      return finalize(state, event, { algorithmBadcases })
    }
    case 'RESET': return action.state
    default: return state
  }
}

export const initialEvolutionData = createInitialEvolutionData()
interface EvolutionContextValue { state: EvolutionState; data: EvolutionState; getState: () => EvolutionState; dispatch: Dispatch<EvolutionAction>; commit: (action: EvolutionAction) => Promise<void>; reset: (actor?: string, reason?: string) => void }
const EvolutionContext = createContext<EvolutionContextValue | null>(null)

export interface EvolutionProviderProps extends PropsWithChildren { repository?: EvolutionRepository; initialState?: EvolutionState }
export function EvolutionProvider({ children, repository, initialState }: EvolutionProviderProps) {
  const persistence = useMemo(() => repository ?? createLocalEvolutionRepository(), [repository])
  const [state, publish] = useReducer(evolutionReducer, initialState, (provided) => provided ?? persistence.load())
  const current = useRef(state)
  const persisted = useRef(state)
  const getState = useCallback(() => current.current, [])
  const dispatch = useCallback<Dispatch<EvolutionAction>>((action) => {
    const next = evolutionReducer(current.current, action)
    current.current = next
    publish({ type: 'RESET', state: next })
  }, [])
  const commit = useCallback(async (action: EvolutionAction): Promise<void> => {
    const next = evolutionReducer(current.current, action)
    if (next === current.current) return
    persistence.save(next)
    persisted.current = next
    current.current = next
    publish({ type: 'RESET', state: next })
  }, [persistence])
  useEffect(() => {
    if (persisted.current === state) return
    persistence.save(state)
    persisted.current = state
  }, [persistence, state])
  const value = useMemo<EvolutionContextValue>(() => ({
    state, data: state, getState, dispatch, commit,
    reset: (actor, reason) => dispatch({ type: 'RESET', state: persistence.reset(actor, reason) })
  }), [persistence, state, getState, dispatch, commit])
  return createElement(EvolutionContext.Provider, { value }, children)
}

export function useEvolution(): EvolutionContextValue {
  const context = useContext(EvolutionContext)
  if (!context) throw new Error('useEvolution must be used inside EvolutionProvider')
  return context
}

export function resetEvolutionData(repository = createLocalEvolutionRepository(), actor?: string, reason?: string) {
  return repository.reset(actor, reason)
}
