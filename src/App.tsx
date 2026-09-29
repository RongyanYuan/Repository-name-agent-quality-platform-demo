import { useCallback, useMemo } from 'react'
import { Navigate, Route as RouterRoute, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout, DETAIL_KEYS, useContextNavigation } from './layout'
import { EvolutionCasesPage } from './evolution/cases'
import type { AttributionChangeInput, HumanConfirmationInput } from './evolution/cases'
import type { CaseReference } from './evolution/cases/model'
import { ATTRIBUTION_DIMENSIONS, type AttributionRevision, type EvolutionModule } from './evolution/domain'
import type { ReferenceKind, ReferenceTarget } from './evolution/components/ViewPrimitives'
import {
  AssetsSkillsPage, AttributionClustersPage, EvaluationCenterPage, EvolutionDatasetsPage,
  ExperimentsGatesPage, GovernanceOverviewPage, ReleasesPage, RuleConfigurationPage, VariantsPage
} from './evolution/pages'
import { useEvolution } from './evolution/store'
import { scopeEvolutionState } from './evolution/scope'
import { useQuality } from './store'
import { mergeCaseLocalFilters, parseCaseLocalFilters } from './urlState'

export const ROUTE_PATHS = {
  overview: '/overview', cases: '/cases', evaluations: '/evaluations', issues: '/issues',
  variants: '/variants', experiments: '/experiments', releases: '/releases',
  assetsSkills: '/assets-skills', datasets: '/datasets', rules: '/rules'
} as const

export const REFERENCE_ROUTES: Record<ReferenceKind | 'issue-cluster', { path: string; key: string }> = {
  case: { path: ROUTE_PATHS.cases, key: 'caseId' }, session: { path: ROUTE_PATHS.cases, key: 'sessionId' },
  trace: { path: ROUTE_PATHS.cases, key: 'traceId' }, observation: { path: ROUTE_PATHS.cases, key: 'observationId' }, log: { path: ROUTE_PATHS.cases, key: 'logId' },
  evidence: { path: ROUTE_PATHS.cases, key: 'evidenceId' }, artifact: { path: ROUTE_PATHS.evaluations, key: 'artifactId' },
  'process-eval': { path: ROUTE_PATHS.evaluations, key: 'evaluationId' }, 'outcome-eval': { path: ROUTE_PATHS.evaluations, key: 'evaluationId' },
  attribution: { path: ROUTE_PATHS.issues, key: 'attributionId' }, issue: { path: ROUTE_PATHS.issues, key: 'issueId' },
  cluster: { path: ROUTE_PATHS.issues, key: 'clusterId' }, 'issue-cluster': { path: ROUTE_PATHS.issues, key: 'clusterId' },
  variant: { path: ROUTE_PATHS.variants, key: 'variantId' }, experiment: { path: ROUTE_PATHS.experiments, key: 'experimentId' }, 'experiment-run': { path: ROUTE_PATHS.experiments, key: 'runId' },
  window: { path: ROUTE_PATHS.experiments, key: 'windowId' }, decision: { path: ROUTE_PATHS.experiments, key: 'decisionId' },
  release: { path: ROUTE_PATHS.releases, key: 'releaseId' }, skill: { path: ROUTE_PATHS.assetsSkills, key: 'skillId' },
  asset: { path: ROUTE_PATHS.assetsSkills, key: 'assetId' }, dataset: { path: ROUTE_PATHS.datasets, key: 'datasetId' }, rule: { path: ROUTE_PATHS.rules, key: 'ruleId' }
}

function useReferenceRoute() {
  const { navigateContext } = useContextNavigation()
  return useCallback((target: ReferenceTarget | CaseReference) => {
    const route = REFERENCE_ROUTES[target.kind]
    if (route) navigateContext(route.path, { clear: DETAIL_KEYS.filter((key) => target.kind !== 'trace' || key !== 'caseId'), params: { [route.key]: target.id } })
  }, [navigateContext])
}

function RoutedCasesPage() {
  const { state, dispatch } = useEvolution()
  const { state: qualityState } = useQuality()
  const location = useLocation()
  const onNavigateReference = useReferenceRoute()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const scopedState = useMemo(() => scopeEvolutionState(state, qualityState.filters), [qualityState.filters, state])
  const linkedCaseId = useMemo(() => {
    const explicit = params.get('caseId')
    if (explicit) return explicit
    const sessionId = params.get('sessionId')
    if (sessionId) return state.cases.find((item) => item.sessionId === sessionId)?.id
    const traceId = params.get('traceId')
    if (traceId) return state.traces.find((item) => item.id === traceId)?.caseId
    const observationId = params.get('observationId')
    if (observationId) return state.observations.find((item) => item.id === observationId)?.caseId
    const logId = params.get('logId')
    if (logId) return state.observations.find((item) => item.logId === logId)?.caseId
    const evidenceId = params.get('evidenceId')
    return evidenceId ? state.evidence.find((item) => item.id === evidenceId)?.caseId : undefined
  }, [location.search, state.cases, state.evidence, state.observations, state.traces])
  const caseSet = params.get('caseSet')?.split(',').filter(Boolean)
  const traceSet = params.get('traceSet')?.split(',').filter(Boolean)
  const caseScopedState = (caseSet?.length || traceSet?.length) ? { ...scopedState, cases: scopedState.cases.filter((item) => !caseSet?.length || caseSet.includes(item.id)), traces: scopedState.traces.filter((item) => !traceSet?.length || traceSet.includes(item.id)) } : scopedState
  const onHumanConfirm = useCallback((input: HumanConfirmationInput) => {
    dispatch({ type: 'UPDATE_CASE', caseId: input.caseId, patch: { resultStatus: input.status === 'PASS' ? 'PASS' : input.status === 'FAIL' ? 'FAIL' : 'UNKNOWN', status: 'CONFIRMED' }, meta: { actor: input.by, reason: input.note, at: input.createdAt } })
  }, [dispatch])
  const onAttributionChange = useCallback((input: AttributionChangeInput) => {
    const current = state.attributions.find((item) => item.id === input.attributionId && item.caseId === input.caseId) ?? state.attributions.find((item) => item.caseId === input.caseId)
    if (!current) return
    const now = input.createdAt
    const module = (['Reason', 'Memory', 'Skill', 'Act', 'Context'].includes(input.module) ? input.module : 'Context') as EvolutionModule
    const revision: AttributionRevision = { id: `attribution-revision-${Date.parse(now)}`, source: 'HUMAN', module, dimension: input.dimension || ATTRIBUTION_DIMENSIONS[module][0], evidenceIds: [...current.evidenceIds], routingLabels: input.routingTags.filter((item): item is AttributionRevision['routingLabels'][number] => ['策略迭代', 'Agent 迭代', '个人能力转 Skill（二期）'].includes(item)), optimizationMode: current.optimizationMode, confirmed: true, status: 'CONFIRMED', confidence: current.confidence, reason: input.note, revisedBy: input.by, revisedAt: now, supersedesRevisionId: current.revisions.at(-1)?.id }
    dispatch({ type: 'ADD_ATTRIBUTION_REVISION', attributionId: current.id, revision, meta: { actor: input.by, reason: input.note, at: now } })
  }, [dispatch, state.attributions, state.cases])
  const onCaseFiltersChange = useCallback((filters: import('./evolution/cases/model').CaseAnalysisFilters) => {
    const next = mergeCaseLocalFilters(location.search, filters)
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate])
  return (
    <EvolutionCasesPage
      evolutionState={caseScopedState}
      initialCaseId={linkedCaseId}
      initialTraceId={params.get('traceId') ?? undefined}
      initialObservationId={params.get('observationId') ?? undefined}
      initialLogId={params.get('logId') ?? undefined}
      initialEvidenceId={params.get('evidenceId') ?? undefined}
      initialFilters={{
        timeRange: (params.get('timeRange') as '24h' | '7d' | '14d' | '30d' | null) ?? undefined,
        ...parseCaseLocalFilters(location.search),
        skillId: params.get('skillId') ?? params.get('skill') ?? undefined
      }}
      onFiltersChange={onCaseFiltersChange}
      onNavigateReference={onNavigateReference}
      onHumanConfirm={onHumanConfirm}
      onAttributionChange={onAttributionChange}
    />
  )
}

function LinkedPage({ kind }: { kind: 'evaluations' | 'issues' | 'variants' | 'experiments' | 'releases' | 'assetsSkills' | 'datasets' }) {
  const onNavigateReference = useReferenceRoute()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (kind === 'evaluations') { const key = `${params.get('evaluationId') ?? ''}:${params.get('artifactId') ?? ''}`; return <EvaluationCenterPage key={key} onNavigateReference={onNavigateReference} initialEvaluationId={params.get('evaluationId') ?? undefined} initialArtifactId={params.get('artifactId') ?? undefined} /> }
  if (kind === 'issues') { const key = `${params.get('issueId') ?? params.get('attributionId') ?? ''}:${params.get('clusterId') ?? ''}`; return <AttributionClustersPage key={key} onNavigateReference={onNavigateReference} initialIssueId={params.get('issueId') ?? params.get('attributionId') ?? undefined} initialClusterId={params.get('clusterId') ?? undefined} /> }
  if (kind === 'variants') return <VariantsPage key={params.get('variantId') ?? ''} onNavigateReference={onNavigateReference} initialVariantId={params.get('variantId') ?? undefined} />
  if (kind === 'experiments') { const key = `${params.get('experimentId') ?? ''}:${params.get('decisionId') ?? ''}:${params.get('windowId') ?? ''}:${params.get('runId') ?? ''}`; return <ExperimentsGatesPage key={key} onNavigateReference={onNavigateReference} initialExperimentId={params.get('experimentId') ?? undefined} initialDecisionId={params.get('decisionId') ?? undefined} initialWindowId={params.get('windowId') ?? undefined} initialRunId={params.get('runId') ?? undefined} /> }
  if (kind === 'releases') return <ReleasesPage key={params.get('releaseId') ?? ''} onNavigateReference={onNavigateReference} initialReleaseId={params.get('releaseId') ?? undefined} />
  if (kind === 'assetsSkills') { const key = `${params.get('skillId') ?? ''}:${params.get('assetId') ?? ''}`; return <AssetsSkillsPage key={key} onNavigateReference={onNavigateReference} initialSkillId={params.get('skillId') ?? undefined} initialAssetId={params.get('assetId') ?? undefined} /> }
  return <EvolutionDatasetsPage key={params.get('datasetId') ?? ''} onNavigateReference={onNavigateReference} initialDatasetId={params.get('datasetId') ?? undefined} />
}

function RoutedRulesPage() {
  const location = useLocation()
  const ruleId = new URLSearchParams(location.search).get('ruleId') ?? undefined
  return <RuleConfigurationPage key={ruleId ?? ''} initialRuleId={ruleId} />
}

function LegacyRedirect({ target, sourceKey, targetKey }: { target: string; sourceKey?: string; targetKey?: string }) {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  const sourceValue = sourceKey ? search.get(sourceKey) ?? routeParams[sourceKey] : undefined
  if (sourceKey) search.delete(sourceKey)
  if (targetKey && sourceValue) search.set(targetKey, sourceValue)
  return <Navigate replace to={{ pathname: target, search: search.toString() ? `?${search.toString()}` : '' }} />
}

function LegacyBenchmarkCaseRedirect() {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  if (routeParams.benchmarkId) search.set('experimentId', routeParams.benchmarkId)
  if (routeParams.caseId) search.set('caseId', routeParams.caseId)
  search.set('comparison', 'true')
  return <Navigate replace to={{ pathname: ROUTE_PATHS.experiments, search: `?${search.toString()}` }} />
}

function LegacyTaskRedirect() {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  const taskId = search.get('taskId') ?? routeParams.taskId
  const traceId = search.get('traceId') ?? routeParams.traceId
  search.delete('taskId')
  if (taskId) search.set('caseId', taskId)
  if (traceId) search.set('traceId', traceId)
  return <Navigate replace to={{ pathname: ROUTE_PATHS.cases, search: search.toString() ? `?${search.toString()}` : '' }} />
}

function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  return <section className="rounded-lg border border-line bg-panel p-8 text-center shadow-panel"><h2 className="text-lg font-semibold text-ink">页面不存在</h2><p className="mt-2 text-xs text-muted">请返回治理总览，或从左侧选择一个自进化治理模块。</p><button type="button" className="button button--primary mt-4" onClick={() => navigate({ pathname: ROUTE_PATHS.overview, search: location.search })}>返回治理总览</button></section>
}

export default function App() {
  return (
    <Routes>
      <RouterRoute element={<DashboardLayout />}>
        <RouterRoute index element={<Navigate to={ROUTE_PATHS.overview} replace />} />
        <RouterRoute path="overview" element={<GovernanceOverviewPage />} />
        <RouterRoute path="cases" element={<RoutedCasesPage />} />
        <RouterRoute path="cases/:caseId" element={<LegacyRedirect target={ROUTE_PATHS.cases} sourceKey="caseId" targetKey="caseId" />} />
        <RouterRoute path="evaluations" element={<LinkedPage kind="evaluations" />} />
        <RouterRoute path="issues" element={<LinkedPage kind="issues" />} />
        <RouterRoute path="variants" element={<LinkedPage kind="variants" />} />
        <RouterRoute path="experiments" element={<LinkedPage kind="experiments" />} />
        <RouterRoute path="releases" element={<LinkedPage kind="releases" />} />
        <RouterRoute path="assets-skills" element={<LinkedPage kind="assetsSkills" />} />
        <RouterRoute path="datasets" element={<LinkedPage kind="datasets" />} />
        <RouterRoute path="rules" element={<RoutedRulesPage />} />
        <RouterRoute path="tasks" element={<LegacyTaskRedirect />} />
        <RouterRoute path="tasks/:taskId" element={<LegacyTaskRedirect />} />
        <RouterRoute path="traces/:traceId" element={<LegacyTaskRedirect />} />
        <RouterRoute path="performance" element={<LegacyRedirect target={ROUTE_PATHS.overview} />} />
        <RouterRoute path="anomaly-monitoring" element={<LegacyRedirect target={ROUTE_PATHS.overview} />} />
        <RouterRoute path="benchmarks" element={<LegacyRedirect target={ROUTE_PATHS.experiments} sourceKey="benchmarkId" targetKey="experimentId" />} />
        <RouterRoute path="benchmarks/:benchmarkId" element={<LegacyRedirect target={ROUTE_PATHS.experiments} sourceKey="benchmarkId" targetKey="experimentId" />} />
        <RouterRoute path="benchmarks/:benchmarkId/cases/:caseId" element={<LegacyBenchmarkCaseRedirect />} />
        <RouterRoute path="evaluation-config" element={<LegacyRedirect target={ROUTE_PATHS.rules} />} />
        <RouterRoute path="*" element={<NotFoundPage />} />
      </RouterRoute>
    </Routes>
  )
}
