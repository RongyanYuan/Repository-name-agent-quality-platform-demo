import { createContext, createElement, useContext, useEffect, useMemo, useReducer, type Dispatch, type PropsWithChildren } from 'react'
import { createInitialEvolutionData } from './data'
import type { Asset, Attribution, AttributionRevision, AuditEvent, Case, Dataset, EvaluationRevision, EvolutionState, Experiment, ExperimentMetric, ExperimentRun, GateDecision, Issue, IssueCluster, ReleaseVersion, RuleConfig, Skill, Variant } from './domain'
import { createLocalEvolutionRepository, type EvolutionRepository } from './repository'
import { selectTasteLibraryTrigger } from './data/selectors'

export interface EvolutionActionMeta { actor: string; reason: string; at?: string; auditId?: string }
export type EvolutionAction =
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
  | { type: 'UPDATE_ASSET'; assetId: string; patch: Partial<Omit<Asset, 'id' | 'createdAt'>>; meta: EvolutionActionMeta }
  | { type: 'UPLOAD_ASSET'; asset: Asset; meta: EvolutionActionMeta }
  | { type: 'CREATE_PLANNED_PERSONAL_SKILL'; skill: Skill; meta: EvolutionActionMeta }
  | { type: 'CREATE_DATASET_VERSION'; dataset: Dataset; sourceDatasetId?: string; meta: EvolutionActionMeta }
  | { type: 'UPDATE_DATASET_VERSION'; datasetId: string; patch: Partial<Pick<Dataset, 'name' | 'scope' | 'source' | 'timeRange' | 'population'>>; meta: EvolutionActionMeta }
  | { type: 'SET_DATASET_MEMBERS'; datasetId: string; caseIds: string[]; meta: EvolutionActionMeta }
  | { type: 'FREEZE_DATASET_VERSION'; datasetId: string; meta: EvolutionActionMeta }
  | { type: 'RESET'; state: EvolutionState }

const addUnique = (values: string[], value: string) => values.includes(value) ? values : [...values, value]
const eventFor = (action: Exclude<EvolutionAction, { type: 'RESET' }>, entityType: string, entityId: string, changes?: Record<string, unknown>): AuditEvent => {
  const at = action.meta.at ?? new Date().toISOString()
  return { id: action.meta.auditId ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at, actor: action.meta.actor, action: action.type, entityType, entityId, reason: action.meta.reason, changes }
}
const finalize = (state: EvolutionState, event: AuditEvent, patch: Partial<EvolutionState>): EvolutionState => ({ ...state, ...patch, updatedAt: event.at, auditTrail: [...state.auditTrail, event] })
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
const normalizeDatasetSnapshot = (snapshot: Experiment['configSnapshot']): Experiment['configSnapshot'] => ({ ...snapshot, datasetVersions: snapshot.datasetVersions.map((entry) => ({ ...entry, versionId: `${entry.datasetId}@${entry.version}` })) })

export function evolutionReducer(state: EvolutionState, action: EvolutionAction): EvolutionState {
  switch (action.type) {
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
      const event = eventFor(action, 'Experiment', action.experiment.id, { configSnapshot: action.experiment.configSnapshot })
      const suppliedRuns = (action.runs ?? []).filter((run) => run.experimentId === action.experiment.id)
      const experiment = { ...action.experiment, runIds: [...new Set([...action.experiment.runIds, ...suppliedRuns.map((run) => run.id)])], configSnapshot: normalizeDatasetSnapshot(JSON.parse(JSON.stringify(action.experiment.configSnapshot)) as Experiment['configSnapshot']), updatedAt: event.at }
      const variants = state.variants.map((item) => experiment.variantIds.includes(item.id) ? { ...item, experimentIds: addUnique(item.experimentIds, experiment.id), status: item.status === 'DRAFT' || item.status === 'READY' ? 'EXPERIMENTING' as const : item.status, updatedAt: event.at } : item)
      const windows = state.windows.map((item) => item.id !== experiment.windowId ? item : experiment.level === 'SINGLE_VARIANT' ? { ...item, singleExperimentIds: addUnique(item.singleExperimentIds, experiment.id), updatedAt: event.at } : { ...item, combinationExperimentId: experiment.id, updatedAt: event.at })
      return finalize(state, event, { experiments: [...state.experiments, experiment], experimentRuns: [...state.experimentRuns, ...suppliedRuns], variants, windows })
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
      const caseIds = [...new Set(action.caseIds?.filter((id) => state.cases.some((item) => item.id === id)) ?? experiment.configSnapshot.datasetVersions.flatMap((version) => state.datasets.find((dataset) => dataset.id === version.datasetId)?.caseIds ?? []))]
      if (!caseIds.length) return state
      const event = eventFor(action, 'Experiment', experiment.id, { caseIds, retry: Boolean(action.retry) })
      const configHash = `cfg-${experiment.id}-${experiment.configSnapshot.createdAt}`
      const runs = caseIds.flatMap((caseId) => (['BASELINE', 'CANDIDATE'] as const).flatMap((arm) => Array.from({ length: experiment.configSnapshot.repeatCount }, (_, offset): ExperimentRun => ({ id: `run-${experiment.id}-${caseId}-${arm.toLowerCase()}-${offset + 1}`, experimentId: experiment.id, caseId, repetition: offset + 1, arm, status: 'RUNNING', durationMs: 0, configHash, createdAt: event.at, updatedAt: event.at }))))
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
    case 'FREEZE_DATASET_VERSION': {
      const current = state.datasets.find((item) => item.id === action.datasetId)
      if (!current || current.frozen || !current.name.trim() || !current.scope.trim() || !current.source.trim() || !current.population.sourceSystem.trim() || !current.population.countingRule.trim()) return state
      const event = eventFor(action, 'Dataset', action.datasetId, { frozen: true })
      return finalize(state, event, { datasets: state.datasets.map((item) => item.id === action.datasetId ? { ...item, frozen: true, updatedAt: event.at } : item) })
    }
    case 'RESET': return action.state
    default: return state
  }
}

export const initialEvolutionData = createInitialEvolutionData()
interface EvolutionContextValue { state: EvolutionState; data: EvolutionState; dispatch: Dispatch<EvolutionAction>; reset: (actor?: string, reason?: string) => void }
const EvolutionContext = createContext<EvolutionContextValue | null>(null)

export interface EvolutionProviderProps extends PropsWithChildren { repository?: EvolutionRepository; initialState?: EvolutionState }
export function EvolutionProvider({ children, repository, initialState }: EvolutionProviderProps) {
  const persistence = useMemo(() => repository ?? createLocalEvolutionRepository(), [repository])
  const [state, dispatch] = useReducer(evolutionReducer, initialState, (provided) => provided ?? persistence.load())
  useEffect(() => { persistence.save(state) }, [persistence, state])
  const value = useMemo<EvolutionContextValue>(() => ({
    state, data: state, dispatch,
    reset: (actor, reason) => dispatch({ type: 'RESET', state: persistence.reset(actor, reason) })
  }), [persistence, state])
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
