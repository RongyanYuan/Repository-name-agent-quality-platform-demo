import type { FilterState } from './domain'
import type { CaseAnalysisFilters } from './evolution/cases/model'

export const GLOBAL_FILTER_KEYS = ['timeRange', 'agentVersion', 'businessType', 'environment', 'search', 'skill'] as const
export const CASE_LOCAL_FILTER_KEYS = ['sessionId', 'traceId', 'skillId', 'skillVersion', 'processEval', 'outcomeEval', 'logId', 'multiScene', 'routingTag', 'batchId', 'skillCategory', 'evalCoverage', 'routingStatus', 'badcaseStatus', 'owner', 'channel', 'verticalScenario', 'processMin', 'processMax', 'outcomeMin', 'outcomeMax', 'tokenMin', 'tokenMax', 'latencyMin', 'latencyMax', 'evolutionItem'] as const
export const DETAIL_QUERY_KEYS = [
  'taskId', 'caseId', 'observationId', 'evidenceId', 'artifactId', 'evaluationId', 'attributionId', 'issueId', 'clusterId', 'variantId', 'experimentId',
  'windowId', 'decisionId', 'releaseId', 'assetId', 'ruleId', 'datasetId', 'runId', 'entryId', 'benchmarkId', 'batchId', 'jobId', 'packageId', 'findingId', 'routingPolicyId', 'routingDecisionId', 'deliveryId', 'badcaseId', 'queueId', 'comparison', 'bucket', 'caseSet', 'traceSet', 'signal', 'sourceClusterId', 'sourceIssueId', 'caseView', 'caseClosed'
  , 'view'
] as const

export type GlobalFilterState = Pick<FilterState, 'timeRange' | 'agentVersion' | 'businessType' | 'environment' | 'search' | 'skill'>

export function parseGlobalFilters(search: string, defaults: FilterState, options: { includeSkill?: boolean } = {}): GlobalFilterState {
  const params = new URLSearchParams(search)
  const timeRange = params.get('timeRange')
  const businessType = params.get('businessType')
  const environment = params.get('environment')
  return {
    timeRange: (['24h', '7d', '14d', '30d'].includes(timeRange ?? '') ? timeRange : defaults.timeRange) as FilterState['timeRange'],
    agentVersion: params.get('agentVersion') ?? defaults.agentVersion,
    businessType: (businessType ?? defaults.businessType) as FilterState['businessType'],
    environment: (environment ?? defaults.environment) as FilterState['environment'],
    search: params.get('search') ?? defaults.search,
    // `skillId` was used by the previous dataset/evaluation workbench. Treat
    // it as a compatibility alias for the single global Skill filter.
    skill: options.includeSkill === false ? undefined : params.get('skill') ?? params.get('skillId') ?? undefined
  }
}

export function serializeGlobalFilters(filters: GlobalFilterState): string {
  const params = new URLSearchParams()
  if (filters.timeRange) params.set('timeRange', filters.timeRange)
  if (filters.agentVersion && filters.agentVersion !== 'All Versions') params.set('agentVersion', filters.agentVersion)
  if (filters.businessType && filters.businessType !== 'All') params.set('businessType', filters.businessType)
  if (filters.environment) params.set('environment', filters.environment)
  if (filters.search) params.set('search', filters.search)
  if (filters.skill) params.set('skill', filters.skill)
  return params.toString()
}

export function parseCaseLocalFilters(search: string): Partial<CaseAnalysisFilters> {
  const params = new URLSearchParams(search)
  return {
    query: params.get('search') ?? undefined,
    sessionId: params.get('sessionId') ?? undefined,
    traceId: params.get('traceId') ?? undefined,
    skillId: params.get('skillId') ?? undefined,
    // The dataset workbench's aggregate mode is not a literal Case version.
    skillVersion: params.get('skillVersion') === 'all' ? undefined : params.get('skillVersion') ?? undefined,
    processEval: params.get('processEval') ?? undefined,
    outcomeEval: params.get('outcomeEval') ?? undefined,
    logId: params.get('logId') ?? undefined,
    routingTags: params.getAll('routingTag'),
    multiScene: (params.get('multiScene') as CaseAnalysisFilters['multiScene'] | null) ?? undefined,
    batchId: params.get('batchId') ?? undefined,
    skillCategory: params.get('skillCategory') ?? undefined,
    evalCoverage: params.get('evalCoverage') ?? undefined,
    routingStatus: params.get('routingStatus') ?? undefined,
    badcaseStatus: params.get('badcaseStatus') ?? undefined,
    owner: params.get('owner') ?? undefined
    ,channel: params.get('channel') ?? undefined, verticalScenario: params.get('verticalScenario') ?? undefined,
    processMin: params.has('processMin') ? Number(params.get('processMin')) : undefined, processMax: params.has('processMax') ? Number(params.get('processMax')) : undefined,
    outcomeMin: params.has('outcomeMin') ? Number(params.get('outcomeMin')) : undefined, outcomeMax: params.has('outcomeMax') ? Number(params.get('outcomeMax')) : undefined,
    tokenMin: params.has('tokenMin') ? Number(params.get('tokenMin')) : undefined, tokenMax: params.has('tokenMax') ? Number(params.get('tokenMax')) : undefined,
    latencyMin: params.has('latencyMin') ? Number(params.get('latencyMin')) : undefined, latencyMax: params.has('latencyMax') ? Number(params.get('latencyMax')) : undefined,
    evolutionItem: params.get('evolutionItem') ?? undefined
  }
}

export function mergeCaseLocalFilters(search: string, filters: CaseAnalysisFilters): string {
  const params = new URLSearchParams(search)
  const values: Array<[string, unknown]> = [
    ['search', filters.query], ['sessionId', filters.sessionId], ['traceId', filters.traceId], ['skillId', filters.skillId], ['skillVersion', filters.skillVersion],
    ['processEval', filters.processEval], ['outcomeEval', filters.outcomeEval], ['logId', filters.logId], ['multiScene', filters.multiScene],
    ['batchId', filters.batchId], ['skillCategory', filters.skillCategory], ['evalCoverage', filters.evalCoverage], ['routingStatus', filters.routingStatus], ['badcaseStatus', filters.badcaseStatus], ['owner', filters.owner], ['channel', filters.channel], ['verticalScenario', filters.verticalScenario], ['processMin', filters.processMin], ['processMax', filters.processMax], ['outcomeMin', filters.outcomeMin], ['outcomeMax', filters.outcomeMax], ['tokenMin', filters.tokenMin], ['tokenMax', filters.tokenMax], ['latencyMin', filters.latencyMin], ['latencyMax', filters.latencyMax], ['evolutionItem', filters.evolutionItem]
  ]
  values.forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '' && value !== 'all') params.set(key, String(value)); else params.delete(key) })
  params.delete('routingTag'); filters.routingTags?.forEach((tag) => params.append('routingTag', tag))
  return params.toString()
}
