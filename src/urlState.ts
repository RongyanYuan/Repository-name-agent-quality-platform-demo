import type { FilterState, JudgeStatus } from './domain'
import type { CaseAnalysisFilters } from './evolution/cases/model'

export const GLOBAL_FILTER_KEYS = ['timeRange', 'agentVersion', 'businessType', 'environment', 'search', 'skill'] as const
export const CASE_LOCAL_FILTER_KEYS = ['sessionId', 'traceId', 'skillId', 'skillVersion', 'processEval', 'outcomeEval', 'logId', 'multiScene', 'routingTag'] as const
export const DETAIL_QUERY_KEYS = [
  'taskId', 'caseId', 'observationId', 'evidenceId', 'artifactId', 'evaluationId', 'attributionId', 'issueId', 'clusterId', 'variantId', 'experimentId',
  'windowId', 'decisionId', 'releaseId', 'assetId', 'ruleId', 'datasetId', 'runId', 'entryId', 'benchmarkId', 'comparison', 'bucket', 'caseSet', 'traceSet', 'signal'
] as const

export type GlobalFilterState = Pick<FilterState, 'timeRange' | 'agentVersion' | 'businessType' | 'environment' | 'search' | 'skill'>

export function parseGlobalFilters(search: string, defaults: FilterState): GlobalFilterState {
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
    skill: params.get('skill') ?? undefined
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
    skillVersion: params.get('skillVersion') ?? undefined,
    processEval: (params.get('processEval') as JudgeStatus | null) ?? undefined,
    outcomeEval: (params.get('outcomeEval') as JudgeStatus | null) ?? undefined,
    logId: params.get('logId') ?? undefined,
    routingTags: params.getAll('routingTag'),
    multiScene: (params.get('multiScene') as CaseAnalysisFilters['multiScene'] | null) ?? undefined
  }
}

export function mergeCaseLocalFilters(search: string, filters: CaseAnalysisFilters): string {
  const params = new URLSearchParams(search)
  const values: Array<[string, unknown]> = [
    ['search', filters.query], ['sessionId', filters.sessionId], ['traceId', filters.traceId], ['skillId', filters.skillId], ['skillVersion', filters.skillVersion],
    ['processEval', filters.processEval], ['outcomeEval', filters.outcomeEval], ['logId', filters.logId], ['multiScene', filters.multiScene]
  ]
  values.forEach(([key, value]) => { if (value && value !== 'all') params.set(key, String(value)); else params.delete(key) })
  params.delete('routingTag'); filters.routingTags?.forEach((tag) => params.append('routingTag', tag))
  return params.toString()
}
