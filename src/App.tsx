import { useCallback, useEffect, useMemo } from 'react'
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
import { DatasetEvaluationWorkbenchPage } from './evolution/pages/DatasetEvaluationWorkbenchPage'
import { useEvolution } from './evolution/store'
import { importTraceCases } from './evolution/data/traceDataset'
import { scopeEvolutionState } from './evolution/scope'
import { useQuality } from './store'
import { mergeCaseLocalFilters, parseCaseLocalFilters } from './urlState'
import { canonicalizeIdentitySearch, resolveIdentity } from './evolution/identity'
import { automaticModuleRevisionId, type ModuleReviewInput } from './evolution/reviews'
import { groupModuleEvolutionDirections, selectModuleEvolution } from './evolution/data/moduleEvolution'
import { normalizeCaseView } from './evolution/cases/caseViews'
import type { OutcomeReviewInput } from './evolution/outcomeReviews'

export const ROUTE_PATHS = {
  overview: '/overview', cases: '/cases', evaluations: '/datasets-evaluations', issues: '/issues',
  variants: '/variants', experiments: '/experiments', releases: '/releases',
  assetsSkills: '/assets-skills', datasets: '/datasets', rules: '/rules'
} as const

export const REFERENCE_ROUTES: Record<ReferenceKind | 'issue-cluster', { path: string; key: string }> = {
  case: { path: ROUTE_PATHS.cases, key: 'caseId' }, session: { path: ROUTE_PATHS.cases, key: 'sessionId' },
  trace: { path: ROUTE_PATHS.cases, key: 'traceId' }, observation: { path: ROUTE_PATHS.cases, key: 'observationId' }, log: { path: ROUTE_PATHS.cases, key: 'logId' },
  evidence: { path: ROUTE_PATHS.cases, key: 'evidenceId' }, artifact: { path: ROUTE_PATHS.cases, key: 'artifactId' },
  'process-eval': { path: ROUTE_PATHS.cases, key: 'evaluationId' }, 'outcome-eval': { path: ROUTE_PATHS.cases, key: 'evaluationId' },
  attribution: { path: ROUTE_PATHS.evaluations, key: 'attributionId' }, issue: { path: ROUTE_PATHS.evaluations, key: 'issueId' },
  cluster: { path: ROUTE_PATHS.evaluations, key: 'clusterId' }, 'issue-cluster': { path: ROUTE_PATHS.evaluations, key: 'clusterId' },
  variant: { path: ROUTE_PATHS.evaluations, key: 'variantId' }, experiment: { path: ROUTE_PATHS.evaluations, key: 'experimentId' }, 'experiment-run': { path: ROUTE_PATHS.evaluations, key: 'runId' },
  window: { path: ROUTE_PATHS.evaluations, key: 'windowId' }, decision: { path: ROUTE_PATHS.evaluations, key: 'decisionId' },
  release: { path: ROUTE_PATHS.evaluations, key: 'releaseId' }, skill: { path: ROUTE_PATHS.evaluations, key: 'skillId' },
  asset: { path: ROUTE_PATHS.evaluations, key: 'assetId' }, dataset: { path: ROUTE_PATHS.evaluations, key: 'datasetId' }, rule: { path: ROUTE_PATHS.rules, key: 'ruleId' },
  'evaluation-batch': { path: ROUTE_PATHS.evaluations, key: 'batchId' }, 'evaluation-job': { path: ROUTE_PATHS.evaluations, key: 'jobId' },
  'trace-package': { path: ROUTE_PATHS.evaluations, key: 'packageId' }, finding: { path: ROUTE_PATHS.evaluations, key: 'findingId' },
  'routing-policy': { path: ROUTE_PATHS.evaluations, key: 'routingPolicyId' }, 'routing-decision': { path: ROUTE_PATHS.evaluations, key: 'routingDecisionId' },
  'routing-delivery': { path: ROUTE_PATHS.evaluations, key: 'deliveryId' }, badcase: { path: ROUTE_PATHS.evaluations, key: 'badcaseId' }, 'badcase-queue': { path: ROUTE_PATHS.evaluations, key: 'queueId' }
}

function useReferenceRoute() {
  const { navigateContext } = useContextNavigation()
  const location = useLocation()
  const { state } = useEvolution()
  return useCallback((target: ReferenceTarget | CaseReference) => {
    const route = REFERENCE_ROUTES[target.kind]
    const canonicalId = target.kind === 'trace' || target.kind === 'session' ? resolveIdentity(state, target.kind, target.id) : target.id
    const targetTraceId = target.kind === 'trace' ? canonicalId : target.kind === 'observation' ? state.observations.find(item=>item.id===target.id)?.traceId : target.kind === 'log' ? state.observations.find(item=>item.logId===target.id)?.traceId : target.kind === 'evidence' ? state.evidence.find(item=>item.id===target.id)?.traceId : target.kind==='artifact' ? state.artifacts.find(item=>item.id===target.id)?.traceId : target.kind==='process-eval' || target.kind==='outcome-eval' ? [...state.processEvals,...state.outcomeEvals].find(item=>item.id===target.id)?.traceId : undefined
    const targetCaseId = targetTraceId ? state.traces.find(item=>item.id===targetTraceId)?.caseId : undefined
    const workbenchView = ['artifact', 'process-eval', 'outcome-eval', 'evaluation-batch', 'evaluation-job', 'trace-package'].includes(target.kind) ? 'traces' : ['dataset', 'skill', 'asset'].includes(target.kind) ? 'datasets' : ['variant', 'experiment', 'experiment-run', 'window', 'decision', 'release', 'issue', 'cluster', 'issue-cluster', 'attribution', 'finding', 'routing-policy', 'routing-decision', 'routing-delivery', 'badcase', 'badcase-queue'].includes(target.kind) ? 'history' : undefined
    if (route) navigateContext(route.path, { clear: DETAIL_KEYS, params: {
      [route.key]: canonicalId, caseClosed: undefined,
      ...(target.kind==='evidence' ? {evaluationId:target.evaluationId,artifactId:target.artifactId} : {}),
      ...(targetTraceId ? {traceId:targetTraceId, caseId:targetCaseId} : {}),
      ...(workbenchView && route.path===ROUTE_PATHS.evaluations ? { view: workbenchView } : {}),
      caseView: target.caseView ? normalizeCaseView(target.caseView) : target.kind === 'session' ? 'session' : ['artifact','outcome-eval'].includes(target.kind) ? 'outcome' : ['process-eval','observation','evidence','log','case','trace'].includes(target.kind) ? 'eval' : undefined,
      returnTo: route.path !== location.pathname ? `${location.pathname}${location.search}` : new URLSearchParams(location.search).get('returnTo') ?? undefined
    } })
  }, [navigateContext, location, state])
}

function RoutedCasesPage() {
  const { state, commit } = useEvolution()
  const { state: qualityState } = useQuality()
  const location = useLocation()
  const onNavigateReference = useReferenceRoute()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const scopedState = useMemo(() => scopeEvolutionState(state, qualityState.filters), [qualityState.filters, state])
  const linkedTraceId = useMemo(()=>{
    const explicit=params.get('traceId')
    if(explicit)return resolveIdentity(state,'trace',explicit)
    const observation=params.get('observationId') ? state.observations.find(item=>item.id===params.get('observationId')) : undefined
    const log=params.get('logId') ? state.observations.find(item=>item.logId===params.get('logId')) : undefined
    const evidence=params.get('evidenceId') ? state.evidence.find(item=>item.id===params.get('evidenceId')) : undefined
    const artifact=state.artifacts.find(item=>item.id===params.get('artifactId'))
    const evaluation=[...state.processEvals,...state.outcomeEvals].find(item=>item.id===params.get('evaluationId'))
    const finding=params.get('caseView')==='governance' ? state.evaluationFindings.find(item=>item.id===params.get('findingId')) : undefined
    const legacyRecord=params.get('caseView')==='governance' ? state.evolutionRecords?.find(item=>item.id===params.get('evolutionRecordId')) : undefined
    const sourceTraceIds=legacyRecord ? [...new Set(state.evaluationFindings.filter(item=>legacyRecord.sourceFindingIds.includes(item.id)).map(item=>resolveIdentity(state,'trace',item.traceId)))] : []
    return observation?.traceId ?? log?.traceId ?? evidence?.traceId ?? artifact?.traceId ?? evaluation?.traceId ?? (finding ? resolveIdentity(state,'trace',finding.traceId) : sourceTraceIds.length===1 ? sourceTraceIds[0] : undefined)
  },[location.search,state])
  const linkedCaseId = useMemo(() => {
    if (params.get('caseClosed') === '1') return undefined
    if (linkedTraceId) return state.traces.find((item) => item.id === linkedTraceId)?.caseId
    const explicit = params.get('caseId')
    if (explicit) return explicit
    const sessionId = params.get('sessionId') ? resolveIdentity(state, 'session', params.get('sessionId')!) : undefined
    if (sessionId) return state.cases.find((item) => item.sessionId === sessionId)?.id
    const observationId = params.get('observationId')
    if (observationId) return state.observations.find((item) => item.id === observationId)?.caseId
    const logId = params.get('logId')
    if (logId) return state.observations.find((item) => item.logId === logId)?.caseId
    const evidenceId = params.get('evidenceId')
    return evidenceId ? state.evidence.find((item) => item.id === evidenceId)?.caseId : undefined
  }, [location.search, linkedTraceId, state])
  // Old governance bookmarks are translated only through a current, exact
  // Trace -> score -> finding -> cycle binding. Unknown sources stay visible.
  const legacyGovernanceFocus=useMemo(()=>{
    if(params.get('caseView')!=='governance' || !params.get('findingId') && !params.get('evolutionRecordId'))return undefined
    const requestedRecord=state.evolutionRecords?.find(record=>record.id===params.get('evolutionRecordId'))
    const requestedFinding=params.get('findingId')
    if(params.get('evolutionRecordId') && !requestedRecord)return {reason:'旧治理链接对应的进化轮次不存在；未打开其他模块。'}
    if(!linkedTraceId)return {reason:'旧治理链接未关联明确的 Trace；未打开其他模块。'}
    const latestPackage=state.tracePackages.filter(pkg=>pkg.traceId===linkedTraceId).sort((left,right)=>right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0]
    if(!latestPackage)return {reason:'旧治理链接对应的 Trace 没有当前评测包；未打开其他模块。'}
    const matching=(state.moduleEvolutionBindings ?? []).filter(binding=>{
      if(resolveIdentity(state,'trace',binding.traceId)!==linkedTraceId || binding.packageId!==latestPackage?.id || requestedFinding && binding.findingId!==requestedFinding || requestedRecord && !binding.evolutionRecordIds.includes(requestedRecord.id))return false
      const score=latestPackage.moduleScores.find(item=>item.id===binding.moduleScoreId)
      const finding=state.evaluationFindings.find(item=>item.id===binding.findingId && item.traceId===linkedTraceId && item.packageId===latestPackage.id)
      return Boolean(score && finding && binding.automaticRevisionId===automaticModuleRevisionId(score))
    })
    const modules=[...new Set(matching.map(binding=>binding.moduleScoreId))]
    if(modules.length!==1 || !latestPackage)return {reason:'旧治理链接未匹配当前 Trace 的唯一模块评分；未用其他模块或历史评分替代。'}
    const selection=selectModuleEvolution(state,{traceId:linkedTraceId,packageId:latestPackage.id,moduleScoreId:modules[0]})
    const directions=groupModuleEvolutionDirections(selection).filter(direction=>[...direction.currentPaths,...direction.historicalPaths].some(path=>(!requestedFinding || path.finding.id===requestedFinding) && (!requestedRecord || path.record.id===requestedRecord.id)))
    if(directions.length!==1)return {reason:'旧治理链接的归因方向未明确匹配；未打开其他进化方向。'}
    return {moduleScoreId:modules[0],directionId:directions[0].id}
  },[location.search,linkedTraceId,state])
  useEffect(()=>{
    // Case identity aliases and legacy view translation have one writer. The
    // parent App deliberately leaves this route alone so it cannot overwrite
    // an exact module focus with a second, view-only navigation.
    const next=new URLSearchParams(canonicalizeIdentitySearch(state,location.search))
    const oldView=next.get('caseView')
    if(oldView==='governance') {
      if(!legacyGovernanceFocus?.reason) {
        next.set('caseView','eval')
        if(legacyGovernanceFocus?.moduleScoreId){next.set('moduleScoreId',legacyGovernanceFocus.moduleScoreId);next.set('moduleEvolutionDirectionId',legacyGovernanceFocus.directionId!)}
      }
    } else if(oldView && normalizeCaseView(oldView)!==oldView)next.set('caseView',normalizeCaseView(oldView))
    const search=next.toString() ? `?${next}` : ''
    if(search!==location.search)navigate({pathname:location.pathname,search},{replace:true})
  },[state,location.pathname,location.search,legacyGovernanceFocus,navigate])
  const caseSet = params.get('caseSet')?.split(',').filter(Boolean)
  const traceSet = params.get('traceSet')?.split(',').filter(Boolean).map(id=>resolveIdentity(state,'trace',id))
  const caseScopedState = (caseSet?.length || traceSet?.length) ? { ...scopedState, cases: scopedState.cases.filter((item) => !caseSet?.length || caseSet.includes(item.id)), traces: scopedState.traces.filter((item) => !traceSet?.length || traceSet.includes(item.id)) } : scopedState
  const onHumanConfirm = useCallback(async (input: HumanConfirmationInput) => {
    await commit({ type: 'UPDATE_CASE', caseId: input.caseId, patch: { resultStatus: input.status === 'PASS' ? 'PASS' : input.status === 'FAIL' ? 'FAIL' : 'UNKNOWN', status: 'CONFIRMED' }, meta: { actor: input.by, reason: input.note, at: input.createdAt } })
  }, [commit])
  const onAttributionChange = useCallback(async (input: AttributionChangeInput) => {
    const current = state.attributions.find((item) => item.id === input.attributionId && item.caseId === input.caseId)
    if (!current) throw new Error('目标归因不存在，未保存任何变更')
    const now = input.createdAt
    const module = (['Reason', 'Memory', 'Skill', 'Act', 'Context'].includes(input.module) ? input.module : 'Context') as EvolutionModule
    const revision: AttributionRevision = { id: `attribution-revision-${Date.parse(now)}`, source: 'HUMAN', module, dimension: input.dimension || ATTRIBUTION_DIMENSIONS[module][0], evidenceIds: [...current.evidenceIds], routingLabels: input.routingTags.filter((item): item is AttributionRevision['routingLabels'][number] => ['策略迭代', 'Agent 迭代', '个人能力转 Skill（二期）'].includes(item)), optimizationMode: current.optimizationMode, confirmed: true, status: 'CONFIRMED', confidence: current.confidence, reason: input.note, revisedBy: input.by, revisedAt: now, supersedesRevisionId: current.revisions.at(-1)?.id }
    await commit({ type: 'ADD_ATTRIBUTION_REVISION', attributionId: current.id, revision, meta: { actor: input.by, reason: input.note, at: now } })
  }, [commit, state.attributions])
  const onCaseFiltersChange = useCallback((filters: import('./evolution/cases/model').CaseAnalysisFilters) => {
    const next = mergeCaseLocalFilters(location.search, filters)
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate])
  const onBulkTraceImport = useCallback(async (traceIds: string[], kind: 'evaluation' | 'golden') => {
    const result = importTraceCases(state, traceIds, kind, kind === 'golden' ? '黄金集' : '评测集A', new Date().toISOString())
    if (result.addedCaseIds.length) await commit({ type: 'RESET', state: result.state })
    return `${result.addedCaseIds.length} 个 Case 已加入${result.blocked.length ? `；${result.blocked.length} 个未加入：${[...new Set(result.blocked.map(item=>item.reason))].join(' ')}` : ''}`
  }, [commit, state])
  const onModuleReview = useCallback(async (input: ModuleReviewInput) => {
    await commit({ type: 'REVIEW_TRACE_MODULE', input, meta: { actor: input.reviewer, reason: input.reason, at: input.reviewedAt, auditId: `audit-${input.reviewId}` } })
  }, [commit])
  const onOutcomeReview = useCallback(async (input: OutcomeReviewInput) => {
    await commit({type:'REVIEW_OUTCOME_DIMENSION',input,meta:{actor:input.reviewer,reason:input.reason,at:input.reviewedAt,auditId:`audit-${input.reviewId}`}})
  },[commit])
  return <>
    {legacyGovernanceFocus?.reason && <p role="status" className="mb-4 rounded border border-line bg-slate-50 p-3 text-xs leading-5 text-muted">{legacyGovernanceFocus.reason}</p>}
    <EvolutionCasesPage
      evolutionState={caseScopedState}
      detailEvolutionState={state}
      initialCaseId={linkedCaseId}
      initialTraceId={linkedTraceId}
      initialObservationId={params.get('observationId') ?? undefined}
      initialLogId={params.get('logId') ?? undefined}
      initialEvidenceId={params.get('evidenceId') ?? undefined}
      initialArtifactId={params.get('artifactId') ?? undefined}
      initialEvaluationId={params.get('evaluationId') ?? params.get('processEvaluationId') ?? undefined}
      initialModuleScoreId={legacyGovernanceFocus?.reason ? undefined : legacyGovernanceFocus?.moduleScoreId ?? params.get('moduleScoreId') ?? undefined}
      initialScoreDimensionId={params.get('scoreDimensionId') ?? undefined}
      initialEvolutionRecordId={params.get('evolutionRecordId') ?? undefined}
      initialEvolutionDirectionId={legacyGovernanceFocus?.reason ? undefined : legacyGovernanceFocus?.directionId ?? params.get('moduleEvolutionDirectionId') ?? undefined}
      initialFindingId={params.get('findingId') ?? undefined}
      sourceRoute={location.pathname+location.search}
      onOpenEvolutionWorkbench={href=>navigate(href)}
      onEvolutionDirectionChange={id=>{
        const next=new URLSearchParams(location.search)
        if(id)next.set('moduleEvolutionDirectionId',id);else next.delete('moduleEvolutionDirectionId')
        navigate({pathname:location.pathname,search:`?${next}`})
      }}
      onEvolutionDetailChange={selection=>{
        const next=new URLSearchParams(location.search)
        for(const key of ['moduleScoreId','processEvaluationId','scoreDimensionId','moduleEvolutionDirectionId','evolutionRecordId','findingId'])next.delete(key)
        if(selection){
          next.set('caseView','eval');next.set('moduleScoreId',selection.moduleScoreId)
          next.delete('caseClosed');next.delete('evaluationId')
          if(linkedTraceId)next.set('traceId',linkedTraceId)
          if(linkedCaseId)next.set('caseId',linkedCaseId)
          if(selection.processEvaluationId){next.set('processEvaluationId',selection.processEvaluationId);next.set('evaluationId',selection.processEvaluationId)}
          if(selection.scoreDimensionId)next.set('scoreDimensionId',selection.scoreDimensionId)
        }
        navigate({pathname:location.pathname,search:`?${next}`},{replace:!selection})
      }}
      initialView={params.get('caseView') ? normalizeCaseView(params.get('caseView')) : params.get('artifactId') || state.outcomeEvals.some(item=>item.id===params.get('evaluationId')) ? 'outcome' : params.get('observationId') || params.get('evidenceId') || params.get('logId') || params.get('evaluationId') ? 'eval' : params.get('sessionId') && !params.get('traceId') ? 'session' : 'eval'}
      initialPage={Math.max(0, Number(params.get('casePage')) || 0)}
      onPageChange={(page) => { const next = new URLSearchParams(location.search); next.set('casePage', String(page)); navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true }) }}
      onViewChange={(view) => { const next = new URLSearchParams(location.search); next.set('caseView', view); if(view!=='eval') ['moduleScoreId','processEvaluationId','scoreDimensionId','moduleEvolutionDirectionId','evolutionRecordId','findingId'].forEach(key=>next.delete(key)); navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true }) }}
      onCloseCase={() => { const next = new URLSearchParams(location.search); ['caseId', 'traceId', 'sessionId', 'observationId', 'logId', 'evidenceId', 'artifactId', 'evaluationId', 'processEvaluationId', 'caseView','moduleScoreId','scoreDimensionId','moduleEvolutionDirectionId','evolutionRecordId','findingId'].forEach(key => next.delete(key)); next.set('caseClosed', '1'); navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true }) }}
      initialFilters={{
        timeRange: (params.get('timeRange') as '24h' | '7d' | '14d' | '30d' | null) ?? undefined,
        ...parseCaseLocalFilters(location.search),
        traceId: params.get('caseClosed') === '1' ? undefined : params.get('traceId') ? resolveIdentity(state, 'trace', params.get('traceId')!) : undefined,
        sessionId: params.get('caseClosed') === '1' ? undefined : params.get('sessionId') ? resolveIdentity(state, 'session', params.get('sessionId')!) : undefined,
        skillId: params.get('skillId') ?? params.get('skill') ?? undefined
      }}
      onFiltersChange={onCaseFiltersChange}
      onNavigateReference={onNavigateReference}
      onHumanConfirm={onHumanConfirm}
      onAttributionChange={onAttributionChange}
      onBulkTraceImport={onBulkTraceImport}
      onModuleReview={onModuleReview}
      onOutcomeReview={onOutcomeReview}
    />
  </>
}

function LinkedPage({ kind }: { kind: 'evaluations' | 'issues' | 'variants' | 'experiments' | 'releases' | 'assetsSkills' | 'datasets' | 'datasetEvaluation' }) {
  const onNavigateReference = useReferenceRoute()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (kind === 'datasetEvaluation') return <DatasetEvaluationWorkbenchPage onNavigateReference={onNavigateReference} initialDatasetId={params.get('datasetId') ?? undefined} />
  if (kind === 'evaluations') { const key = `${params.get('evaluationId') ?? ''}:${params.get('artifactId') ?? ''}`; return <EvaluationCenterPage key={key} onNavigateReference={onNavigateReference} initialEvaluationId={params.get('evaluationId') ?? undefined} initialArtifactId={params.get('artifactId') ?? undefined} /> }
  if (kind === 'issues') { const key = `${params.get('issueId') ?? params.get('attributionId') ?? ''}:${params.get('clusterId') ?? ''}`; return <AttributionClustersPage key={key} onNavigateReference={onNavigateReference} initialIssueId={params.get('issueId') ?? params.get('attributionId') ?? undefined} initialClusterId={params.get('clusterId') ?? undefined} /> }
  if (kind === 'variants') return <VariantsPage key={`${params.get('variantId') ?? ''}:${params.get('skillId') ?? ''}:${params.get('sourceClusterId') ?? ''}:${params.get('sourceIssueId') ?? ''}`} onNavigateReference={onNavigateReference} initialVariantId={params.get('variantId') ?? undefined} initialSkillId={params.get('skillId') ?? undefined} initialSourceClusterId={params.get('sourceClusterId') ?? undefined} initialSourceIssueId={params.get('sourceIssueId') ?? undefined} />
  if (kind === 'experiments') { const key = `${params.get('experimentId') ?? ''}:${params.get('decisionId') ?? ''}:${params.get('windowId') ?? ''}:${params.get('runId') ?? ''}`; return <ExperimentsGatesPage key={key} onNavigateReference={onNavigateReference} initialExperimentId={params.get('experimentId') ?? undefined} initialDecisionId={params.get('decisionId') ?? undefined} initialWindowId={params.get('windowId') ?? undefined} initialRunId={params.get('runId') ?? undefined} /> }
  if (kind === 'releases') return <ReleasesPage key={params.get('releaseId') ?? ''} onNavigateReference={onNavigateReference} initialReleaseId={params.get('releaseId') ?? undefined} />
  if (kind === 'assetsSkills') { const key = `${params.get('skillId') ?? ''}:${params.get('assetId') ?? ''}`; return <AssetsSkillsPage key={key} onNavigateReference={onNavigateReference} initialSkillId={params.get('skillId') ?? undefined} initialAssetId={params.get('assetId') ?? undefined} /> }
  return <DatasetEvaluationWorkbenchPage key={params.get('datasetId') ?? ''} onNavigateReference={onNavigateReference} initialDatasetId={params.get('datasetId') ?? undefined} />
}

function LegacyWorkbenchRedirect({ view, assetRoute = false }: { view: 'traces' | 'datasets' | 'history'; assetRoute?: boolean }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('view')) params.set('view', assetRoute && !params.get('assetId') ? 'datasets' : view)
  return <Navigate replace to={{ pathname: ROUTE_PATHS.evaluations, search: `?${params.toString()}` }} />
}

function RoutedRulesPage() {
  const location = useLocation()
  const ruleId = new URLSearchParams(location.search).get('ruleId') ?? undefined
  return <RuleConfigurationPage key={ruleId ?? ''} initialRuleId={ruleId} />
}

function LegacyRedirect({ target, sourceKey, targetKey, extra }: { target: string; sourceKey?: string; targetKey?: string; extra?: Record<string, string> }) {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  const sourceValue = sourceKey ? search.get(sourceKey) ?? routeParams[sourceKey] : undefined
  if (sourceKey) search.delete(sourceKey)
  if (targetKey && sourceValue) search.set(targetKey, sourceValue)
  Object.entries(extra ?? {}).forEach(([key, value]) => search.set(key, value))
  return <Navigate replace to={{ pathname: target, search: search.toString() ? `?${search.toString()}` : '' }} />
}

function LegacyMonitoringRedirect() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  search.set('view', 'monitoring')
  return <Navigate replace to={{ pathname: ROUTE_PATHS.overview, search: `?${search.toString()}` }} />
}

function LegacyBenchmarkCaseRedirect() {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  if (routeParams.benchmarkId) search.set('experimentId', routeParams.benchmarkId)
  if (routeParams.caseId) search.set('caseId', routeParams.caseId)
  search.set('comparison', 'true')
  search.set('view', 'history')
  return <Navigate replace to={{ pathname: ROUTE_PATHS.evaluations, search: `?${search.toString()}` }} />
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

function LegacyEvaluationRedirect() {
  const location = useLocation()
  const { state } = useEvolution()
  const params = new URLSearchParams(location.search)
  const evaluation = [...state.processEvals, ...state.outcomeEvals].find(item => item.id === params.get('evaluationId'))
  const artifact = state.artifacts.find(item => item.id === params.get('artifactId'))
  const packageRecord = state.tracePackages.find(item => item.id === params.get('packageId'))
  const rawTraceId = params.get('traceId') ?? evaluation?.traceId ?? artifact?.traceId ?? packageRecord?.traceId
  const traceId = rawTraceId ? resolveIdentity(state, 'trace', rawTraceId) : undefined
  const trace = state.traces.find(item => item.id === traceId)
  params.delete('view')
  params.set('caseView', evaluation?.type==='OUTCOME' || artifact ? 'outcome' : 'eval')
  if (trace?.caseId) params.set('caseId', trace.caseId)
  if (traceId) params.set('traceId', traceId)
  return <Navigate replace to={{ pathname: ROUTE_PATHS.cases, search: `?${params.toString()}` }} />
}

function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  return <section className="rounded-lg border border-line bg-panel p-8 text-center shadow-panel"><h2 className="text-lg font-semibold text-ink">页面不存在</h2><p className="mt-2 text-xs text-muted">请返回治理总览，或从左侧选择一个自进化治理模块。</p><button type="button" className="button button--primary mt-4" onClick={() => navigate({ pathname: ROUTE_PATHS.overview, search: location.search })}>返回治理总览</button></section>
}

export default function App() {
  const { state } = useEvolution()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    // Legacy routes own their redirect; a second navigation here can overwrite it.
    if (!['/overview','/datasets-evaluations','/rules'].includes(location.pathname)) return
    if (location.pathname==='/datasets-evaluations' && new URLSearchParams(location.search).get('view')==='traces') return
    const canonicalSearch = canonicalizeIdentitySearch(state, location.search)
    if (canonicalSearch !== location.search) navigate({ pathname:location.pathname, search:canonicalSearch }, {replace:true})
  }, [state, location.pathname, location.search, navigate])
  return (
    <Routes>
      <RouterRoute element={<DashboardLayout />}>
        <RouterRoute index element={<Navigate to={ROUTE_PATHS.overview} replace />} />
        <RouterRoute path="overview" element={<GovernanceOverviewPage />} />
        <RouterRoute path="cases" element={<RoutedCasesPage />} />
        <RouterRoute path="cases/:caseId" element={<LegacyRedirect target={ROUTE_PATHS.cases} sourceKey="caseId" targetKey="caseId" />} />
        <RouterRoute path="evaluations" element={<LegacyEvaluationRedirect />} />
        <RouterRoute path="datasets-evaluations" element={<LinkedPage kind="datasetEvaluation" />} />
        <RouterRoute path="issues" element={<LegacyWorkbenchRedirect view="history" />} />
        <RouterRoute path="variants" element={<LegacyWorkbenchRedirect view="history" />} />
        <RouterRoute path="experiments" element={<LegacyWorkbenchRedirect view="history" />} />
        <RouterRoute path="releases" element={<LegacyWorkbenchRedirect view="history" />} />
        <RouterRoute path="assets-skills" element={<LinkedPage kind="assetsSkills" />} />
        <RouterRoute path="datasets" element={<LegacyWorkbenchRedirect view="datasets" />} />
        <RouterRoute path="rules" element={<RoutedRulesPage />} />
        <RouterRoute path="tasks" element={<LegacyTaskRedirect />} />
        <RouterRoute path="tasks/:taskId" element={<LegacyTaskRedirect />} />
        <RouterRoute path="traces/:traceId" element={<LegacyTaskRedirect />} />
        <RouterRoute path="performance" element={<LegacyRedirect target={ROUTE_PATHS.overview} />} />
        <RouterRoute path="anomaly-monitoring" element={<LegacyMonitoringRedirect />} />
        <RouterRoute path="benchmarks" element={<LegacyRedirect target={ROUTE_PATHS.evaluations} sourceKey="benchmarkId" targetKey="experimentId" />} />
        <RouterRoute path="benchmarks/:benchmarkId" element={<LegacyRedirect target={ROUTE_PATHS.evaluations} sourceKey="benchmarkId" targetKey="experimentId" />} />
        <RouterRoute path="benchmarks/:benchmarkId/cases/:caseId" element={<LegacyBenchmarkCaseRedirect />} />
        <RouterRoute path="evaluation-config" element={<LegacyRedirect target={ROUTE_PATHS.rules} />} />
        <RouterRoute path="*" element={<NotFoundPage />} />
      </RouterRoute>
    </Routes>
  )
}
