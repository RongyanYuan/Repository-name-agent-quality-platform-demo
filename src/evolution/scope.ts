import { useMemo } from 'react'
import type { FilterState } from '../domain'
import { useQuality } from '../store'
import type { EvolutionState } from './domain'
import { useEvolution } from './store'

const intersects = (values: string[], scope: Set<string>) => values.some((value) => scope.has(value))

export function scopeEvolutionState(state: EvolutionState, filters: FilterState): EvolutionState {
  // Mutations update state.updatedAt; using it as the mock clock would make old
  // cases disappear immediately after a label/edit. Anchor the demo window to
  // immutable Case event time instead.
  const referenceTime = Math.max(...state.cases.map((item) => Date.parse(item.createdAt)).filter(Number.isFinite))
  const days = filters.timeRange === '24h' ? 1 : filters.timeRange === '7d' ? 7 : filters.timeRange === '14d' ? 14 : 30
  const cutoff = Number.isFinite(referenceTime) ? referenceTime - days * 86_400_000 : Number.NEGATIVE_INFINITY
  const query = filters.search.trim().toLocaleLowerCase()
  const selectedSkill = filters.skill?.toLocaleLowerCase()
  const skillById = new Map(state.skills.map((skill) => [skill.id, skill]))
  const cases = state.cases.filter((item) => {
    if (Date.parse(item.createdAt) < cutoff) return false
    if (filters.environment && item.environment !== filters.environment) return false
    if (filters.agentVersion !== 'All Versions' && item.agentVersion !== filters.agentVersion) return false
    if (filters.businessType !== 'All' && !item.scenario.toLocaleLowerCase().includes(filters.businessType.toLocaleLowerCase())) return false
    if (selectedSkill && !item.skillIds.some((id) => id.toLocaleLowerCase().includes(selectedSkill) || skillById.get(id)?.name.toLocaleLowerCase().includes(selectedSkill))) return false
    if (query && ![item.id, item.sessionId, item.title, item.query, ...item.traceIds, ...item.skillIds].some((value) => value.toLocaleLowerCase().includes(query))) return false
    return true
  })
  const caseIds = new Set(cases.map((item) => item.id))
  const sessions = state.sessions.filter((item) => intersects(item.caseIds, caseIds))
  const traces = state.traces.filter((item) => caseIds.has(item.caseId))
  const observations = state.observations.filter((item) => caseIds.has(item.caseId))
  const evidence = state.evidence.filter((item) => caseIds.has(item.caseId))
  const artifacts = state.artifacts.filter((item) => caseIds.has(item.caseId))
  const processEvals = state.processEvals.filter((item) => caseIds.has(item.caseId))
  const outcomeEvals = state.outcomeEvals.filter((item) => caseIds.has(item.caseId))
  const attributions = state.attributions.filter((item) => caseIds.has(item.caseId))
  const issues = state.issues.filter((item) => caseIds.has(item.caseId))
  const issueIds = new Set(issues.map((item) => item.id))
  const issueClusters = state.issueClusters.filter((item) => intersects(item.caseIds, caseIds) || intersects(item.issueIds, issueIds))
  const clusterIds = new Set(issueClusters.map((item) => item.id))
  const variants = state.variants.filter((item) => intersects(item.sourceCaseIds, caseIds) || intersects(item.sourceIssueIds, issueIds) || intersects(item.sourceClusterIds, clusterIds))
  const variantIds = new Set(variants.map((item) => item.id))
  const experiments = state.experiments.filter((item) => intersects(item.variantIds, variantIds))
  const experimentIds = new Set(experiments.map((item) => item.id))
  const experimentRuns = state.experimentRuns.filter((item) => experimentIds.has(item.experimentId) && caseIds.has(item.caseId))
  const windows = state.windows.filter((item) => intersects(item.candidateVariantIds, variantIds) || intersects(item.singleExperimentIds, experimentIds) || Boolean(item.combinationExperimentId && experimentIds.has(item.combinationExperimentId)))
  const gateDecisions = state.gateDecisions.filter((item) => experimentIds.has(item.experimentId))
  const releases = state.releases.filter((item) => intersects(item.variantIds, variantIds) || experimentIds.has(item.combinationExperimentId))
  const skillIds = new Set(cases.flatMap((item) => item.skillIds))
  const skills = filters.skill ? state.skills.filter((item) => skillIds.has(item.id)) : state.skills
  const assets = state.assets
  const datasets = state.datasets.filter((item) => intersects(item.caseIds, caseIds))
  return { ...state, sessions, cases, traces, observations, evidence, artifacts, processEvals, outcomeEvals, attributions, issues, issueClusters, skills, assets, variants, datasets, experiments, experimentRuns, windows, gateDecisions, releases }
}

export function useScopedEvolution() {
  const evolution = useEvolution()
  const { state: qualityState } = useQuality()
  const scopedState = useMemo(() => scopeEvolutionState(evolution.state, qualityState.filters), [evolution.state, qualityState.filters])
  return { ...evolution, scopedState }
}
