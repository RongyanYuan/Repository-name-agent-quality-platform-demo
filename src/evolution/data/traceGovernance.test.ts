import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { AuditEvent, EvolutionState, TraceGovernanceEvent } from '../domain'
import { appendGovernanceEvents, selectTraceGovernance } from './traceGovernance'
import { resolveIdentity } from '../identity'

const seed = createInitialEvolutionData()
const pptTraceId = resolveIdentity(seed, 'trace', 'trace-ppt-generate')
const siblingTraceId = resolveIdentity(seed, 'trace', 'trace-ppt-context')

const event = (patch: Partial<TraceGovernanceEvent>): TraceGovernanceEvent => ({
  id: 'event', traceId: pptTraceId, caseId: 'case-ppt-management', branchId: 'finding-a',
  occurredAt: '2026-10-08T02:00:00Z', recordedAt: '2026-10-08T02:00:00Z', stage: 'ROUTING', statusCode: 'PENDING',
  actor: '复核员', description: '等待确认', targetRefs: [], origin: 'LOCAL', relationType: 'TRACE_SOURCE', ...patch
})
const emptyHistory = (): EvolutionState => {
  const state = createInitialEvolutionData()
  state.governanceEvents = []; state.datasetMemberships = []; state.moduleReviews = []
  state.evaluationFindings = []; state.routingDecisions = []; state.routingDeliveries = []; state.algorithmBadcases = []
  state.attributions = []; state.issues = []; state.issueClusters = []; state.variants = []; state.experiments = []; state.gateDecisions = []; state.releases = []
  state.datasets = []; state.processEvals = []; state.outcomeEvals = []; state.tracePackages = []; state.auditTrail = []
  return state
}

describe('Trace governance projection', () => {
  it('keeps distinct branch positions and stable time order without copying another Trace events', () => {
    const state = emptyHistory()
    state.governanceEvents = [
      event({ id: 'b', statusCode: 'RELEASED', stage: 'RELEASE', branchId: 'completed' }),
      event({ id: 'a', statusCode: 'PASS', stage: 'GATE', branchId: 'completed' }),
      event({ id: 'new', occurredAt: '2026-10-09T00:00:00Z', stage: 'ATTRIBUTION', branchId: 'pending' }),
      event({ id: 'other', traceId: siblingTraceId, stage: 'RELEASE', statusCode: 'RELEASED' }),
      event({ id: 'unknown', branchId: 'pending', occurredAt: undefined, recordedAt: '2026-10-01T00:00:00Z', relationType: 'CASE_SHARED' }),
      event({ id: 'duplicate', sourceEventId: 'source-one' }), event({ id: 'duplicate-again', sourceEventId: 'source-one' })
    ]
    const history = selectTraceGovernance(state, 'trace-ppt-generate')
    expect(history.events.filter(item => ['a', 'b'].includes(item.id)).map(item => item.id)).toEqual(['a', 'b'])
    expect(history.events.some(item => item.id === 'other')).toBe(false)
    expect(history.events.filter(item => item.sourceEventId === 'source-one')).toHaveLength(1)
    expect(history.branches.find(item => item.id === 'completed')?.currentEvent?.statusCode).toBe('RELEASED')
    expect(history.branches.find(item => item.id === 'pending')?.currentEvent?.statusCode).toBe('PENDING')
    expect(history.lastOccurredAt).toBe('2026-10-09T00:00:00Z')
    expect(history.currentLabel).toContain('待处理')
  })

  it('shows only explicitly enrolled Trace membership and leaves a sibling Case association undated', () => {
    const state = emptyHistory()
    const dataset = createInitialEvolutionData().datasets[0]
    state.datasets = [{ ...dataset, id: 'enrolled', name: '原始集', caseIds: ['case-ppt-management'], updatedAt: '2026-10-10T00:00:00Z' }]
    state.datasetMemberships = [{ id: 'membership', datasetId: 'enrolled', datasetVersion: 'v3', caseId: 'case-ppt-management', traceIds: [pptTraceId], scope: 'TRACE', joinedAt: '2026-10-08T05:00:00Z', actor: '用户', origin: 'LOCAL' }]
    const direct = selectTraceGovernance(state, 'trace-ppt-generate')
    const shared = selectTraceGovernance(state, 'trace-ppt-context')
    expect(direct.memberships[0]).toMatchObject({ scope: 'TRACE', joinedAt: '2026-10-08T05:00:00Z', datasetVersion: 'v3', name: '原始集' })
    expect(direct.events.find(item => item.stage === 'DATASET')).toMatchObject({ occurredAt: '2026-10-08T05:00:00Z', relationType: 'TRACE_SOURCE' })
    expect(shared.memberships[0]).toMatchObject({ scope: 'CASE_SHARED', joinedAt: undefined })
    expect(shared.events.filter(item => item.stage === 'DATASET').every(item => item.occurredAt === undefined && item.relationType === 'CASE_SHARED')).toBe(true)
    expect(shared.events.some(item => item.occurredAt === '2026-10-10T00:00:00Z')).toBe(false)
  })

  it('labels regression coverage as validation and never gives it the source variant release branch', () => {
    const original = createInitialEvolutionData()
    const state = emptyHistory()
    state.datasets = [{ ...original.datasets[0], id: 'regression', type: 'REGRESSION', caseIds: ['case-ppt-management'] }]
    state.variants = [{ ...original.variants[0], id: 'unrelated', sourceCaseIds: ['case-tool-export'], sourceIssueIds: [], sourceClusterIds: [], status: 'RELEASED' }]
    state.experiments = [{ ...original.experiments[0], id: 'validation-run', variantIds: ['unrelated'], datasetIds: ['regression'] }]
    state.gateDecisions = [{ ...original.gateDecisions[0], id: 'validation-pass', experimentId: 'validation-run', conclusion: 'PASS' }]
    state.releases = [{ ...original.releases[0], id: 'unrelated-release', combinationExperimentId: 'validation-run', variantIds: ['unrelated'], gateDecisionId: 'validation-pass', status: 'RELEASED' }]
    const history = selectTraceGovernance(state, 'trace-ppt-context')
    expect(history.events.find(item => item.sourceRef?.id === 'validation-run')?.relationType).toBe('VALIDATION')
    expect(history.events.filter(item => ['GATE', 'RELEASE'].includes(item.stage)).every(item => item.relationType === 'VALIDATION')).toBe(true)
    expect(history.branches.some(item => item.currentEvent?.stage === 'RELEASE')).toBe(false)
    expect(history.currentLabel).not.toContain('已发布')
  })
  it('retains a dedicated historical publication time without using it as the later rollback time', () => {
    const state = createInitialEvolutionData()
    state.governanceEvents = []
    const published = state.releases.find(item => item.id === 'release-agent-2-5-0')!
    const rollback = state.releases.find(item => item.id === 'release-agent-2-5-rollback')!
    const history = selectTraceGovernance(state, 'trace-ppt-generate')
    expect(history.events.find(item => item.sourceRef?.id === published.id && item.statusCode === 'RELEASED')?.occurredAt).toBe(published.releasedAt)
    expect(history.events.find(item => item.sourceRef?.id === rollback.id && item.statusCode === 'ROLLED_BACK')?.occurredAt).toBeUndefined()
  })
  it('keeps canonical task events and alias task events in one branch and merges the same Issue attribution path', () => {
    const state = createInitialEvolutionData()
    const history = selectTraceGovernance(state, 'trace-governance-demo-parallel')
    expect(history.branches.filter(item => item.id.startsWith('trace:'))).toHaveLength(1)
    expect(history.branches.filter(item => item.id.startsWith('attribution:'))).toHaveLength(0)
    expect(history.branches.filter(item => item.id.startsWith('finding:'))).toHaveLength(2)
    expect(history.branches.find(item => item.id === 'finding:finding-governance-demo-parallel-agent')?.currentEvent?.statusCode).toBe('FAILED')
  })
  it('preserves independent same-package module reviews at the same second using exact review identity', () => {
    const state = createInitialEvolutionData()
    const first = state.moduleReviews![0]
    const second = { ...structuredClone(first), id: 'review-other-module', moduleScoreId: 'second-module', reason: '第二个模块的独立复核' }
    state.moduleReviews = [first, second]
    state.governanceEvents = [{ ...event({}), id: `review:${first.id}`, traceId: first.traceId, caseId: first.caseId, occurredAt: first.reviewedAt, stage: 'REVIEW', sourceRef: { kind: 'trace-package', id: first.packageId }, targetRefs: [{ kind: 'trace-package', id: first.packageId }] }]
    const history = selectTraceGovernance(state, first.traceId)
    expect(history.events.filter(item => item.stage === 'REVIEW' && item.occurredAt === first.reviewedAt)).toHaveLength(2)
    expect(history.reviewModuleIds?.[`review:${second.id}`]).toBe('second-module')
  })
})

describe('atomic local governance append', () => {
  const audit: AuditEvent = { id: 'audit-local', at: '2026-10-12T02:00:00Z', actor: '当前用户', action: 'UPDATE_ROUTING_DECISION', entityType: 'RoutingDecision', entityId: 'route', reason: '确认分流' }
  it('appends an actual routing transition once and leaves rejected/no-op transitions without success events', () => {
    const state = emptyHistory()
    const template = createInitialEvolutionData().routingDecisions.find(item => item.traceId === pptTraceId)!
    state.routingDecisions = [{ ...template, id: 'route', status: 'PENDING' }]
    const next = { ...state, routingDecisions: [{ ...state.routingDecisions[0], status: 'CONFIRMED' as const, confirmedAt: audit.at }] }
    const saved = appendGovernanceEvents(state, next, audit)
    expect(saved.governanceEvents).toHaveLength(1)
    expect(saved.governanceEvents?.[0]).toMatchObject({ traceId: pptTraceId, occurredAt: audit.at, statusCode: 'CONFIRMED', sourceEventId: audit.id, origin: 'LOCAL' })
    expect(appendGovernanceEvents(saved, saved, audit).governanceEvents).toHaveLength(1)
    expect(appendGovernanceEvents(state, state, audit).governanceEvents).toEqual([])
    const timestampOnly = { ...next, routingDecisions: [{ ...next.routingDecisions[0], updatedAt: '2026-10-12T02:05:00Z' }] }
    expect(appendGovernanceEvents(next, timestampOnly, { ...audit, id: 'audit-repeat', at: '2026-10-12T02:05:00Z' }).governanceEvents).toEqual([])
  })
  it('records a changed human module override with the exact module and never affects the sibling Trace', () => {
    const state = emptyHistory()
    state.tracePackages = [createInitialEvolutionData().tracePackages.find(item => item.traceId === pptTraceId)!]
    const score = state.tracePackages[0].moduleScores[0]
    const next = structuredClone(state)
    next.tracePackages[0].moduleScores[0].humanScore = 1.25
    next.tracePackages[0].moduleScores[0].humanNote = '更正评分'
    const saved = appendGovernanceEvents(state, next, { ...audit, action: 'UPDATE_MODULE_EVALUATION', entityType: 'ModuleEvaluationScore', entityId: score.id })
    expect(saved.governanceEvents?.[0]).toMatchObject({ traceId: pptTraceId, stage: 'REVIEW', sourceRef: { kind: 'trace-package', id: state.tracePackages[0].id } })
    expect(saved.governanceEvents?.[0].targetRefs).toContainEqual({ kind: 'evidence', id: score.evidence.rootEvidenceIds[0] })
    expect(selectTraceGovernance(saved, 'trace-ppt-context').events.some(item => item.stage === 'REVIEW')).toBe(false)
  })
  it('records exact outcome review identity once and binds its time, artifact and original automatic revision', () => {
    const state = emptyHistory()
    const automatic = { id: 'automatic-outcome-1', source: 'AUTOMATIC' as const, verdict: 'FAIL' as const, score: 0.4, reason: 'Mock 自动判定', evidenceIds: [], evaluator: 'Eval Agent', evaluatedAt: '2026-10-10T01:00:00Z' }
    const evaluation = { ...seed.outcomeEvals[0], id: 'outcome-dimension', traceId: pptTraceId, caseId: 'case-ppt-management', artifactId: 'artifact-ppt', revisions: [automatic] }
    state.outcomeEvals = [evaluation]
    const review = { id: 'outcome-review-1', source: 'HUMAN' as const, verdict: 'FAIL' as const, score: 1.25, scoreScale: '0-2' as const, automaticRevisionId: automatic.id, reason: '人工更正该产物细项', evidenceIds: ['evidence-1'], evaluator: '产物复核员', evaluatedAt: '2026-10-12T01:00:00Z' }
    const next = { ...state, outcomeEvals: [{ ...evaluation, revisions: [...evaluation.revisions, review] }] }
    const outcomeAudit: AuditEvent = { ...audit, action: 'REVIEW_OUTCOME_DIMENSION', entityType: 'OutcomeEval', entityId: evaluation.id, changes: { reviewId: review.id, traceId: pptTraceId, artifactId: evaluation.artifactId, automaticRevisionId: automatic.id } }
    const saved = appendGovernanceEvents(state, next, outcomeAudit)
    expect(saved.governanceEvents).toHaveLength(1)
    expect(saved.governanceEvents?.[0]).toMatchObject({ sourceEventId: review.id, occurredAt: review.evaluatedAt, actor: '产物复核员', origin: 'LOCAL', description: '1.25 / 2 · 人工更正该产物细项', parentEventIds: ['legacy:revision:automatic-outcome-1'], targetRefs: [{ kind: 'outcome-eval', id: evaluation.id }, { kind: 'artifact', id: evaluation.artifactId }, { kind: 'evidence', id: 'evidence-1' }] })
    expect(selectTraceGovernance(saved, pptTraceId).events.filter(item => item.sourceEventId === review.id)).toHaveLength(1)
    expect(appendGovernanceEvents(saved, saved, outcomeAudit).governanceEvents).toHaveLength(1)
    expect(selectTraceGovernance(saved, siblingTraceId).events.some(item => item.sourceEventId === review.id)).toBe(false)
  })
})
