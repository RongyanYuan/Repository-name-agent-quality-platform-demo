import { describe, expect, it } from 'vitest'
import type { TraceGovernanceEvent } from '../domain'
import type { TraceGovernanceHistory } from './traceGovernance'
import { buildGovernanceGraph, buildGovernanceOverview, selectLatestTraceState } from './governanceGraph'

const event = (id: string, occurredAt?: string, patch: Partial<TraceGovernanceEvent> = {}): TraceGovernanceEvent => ({ id, traceId: 'trace-1', caseId: 'case-1', branchId: 'trace:trace-1', stage: 'EVALUATION', statusCode: 'COMPLETED', occurredAt, recordedAt: '2026-10-12T00:00:00Z', actor: 'Mock', description: id, origin: 'MOCK', relationType: 'TRACE_SOURCE', targetRefs: [], ...patch })
const history = (events: TraceGovernanceEvent[]): TraceGovernanceHistory => ({ events, branches: [{ id: 'trace:trace-1', label: '任务与评测', currentEvent: events.find(item => item.id === 'end') }], memberships: [], currentLabel: '—' })

describe('latest actual Trace state', () => {
  it('chooses the latest timed direct event across parallel branches, excluding newer validation and unknown time', () => {
    const value = history([event('released', '2026-10-08T01:00:00Z', { stage: 'RELEASE', statusCode: 'RELEASED', branchId: 'skill' }), event('pending', '2026-10-09T01:00:00Z', { stage: 'ATTRIBUTION', statusCode: 'PENDING', branchId: 'reason' }), event('validation', '2026-10-11T01:00:00Z', { relationType: 'VALIDATION' }), event('unknown', undefined, { statusCode: 'FAILED' })])
    expect(selectLatestTraceState(value)).toMatchObject({ event: { id: 'pending' }, status: 'PENDING', label: '归因', timeKnown: true })
  })
  it('does not use recordedAt as an action time when only unknown history exists', () => {
    const value = history([event('undated', undefined, { statusCode: 'PENDING' })])
    expect(selectLatestTraceState(value)).toMatchObject({ event: { id: 'undated' }, status: 'PENDING', timeKnown: false })
    expect(selectLatestTraceState(history([event('shared', '2026-10-11T01:00:00Z', { relationType: 'CASE_SHARED' })]))).toEqual({ status: 'NOT_ENTERED', label: '尚未进入', timeKnown: false })
  })
})

describe('time and relation governance graph', () => {
  it('uses actual elapsed time for x and refuses to invent an edge from chronological neighbors', () => {
    const graph = buildGovernanceGraph(history([event('start', '2026-10-06T00:00:00Z'), event('middle', '2026-10-06T01:00:00Z'), event('end', '2026-10-06T04:00:00Z')]), { timeWidth: 800 })
    const [start, middle, end] = ['start', 'middle', 'end'].map(id => graph.nodes.find(item => item.id === id)!)
    expect(middle.x - start.x).toBe(200)
    expect(end.x - start.x).toBe(800)
    expect(graph.edges).toEqual([])
  })
  it('separates same-second nodes without changing time and keeps explicit fork, rerun and rollback edges', () => {
    const events = [event('start', '2026-10-06T00:00:00Z', { stage: 'TASK' }), event('fork', '2026-10-06T01:00:00Z', { stage: 'ATTRIBUTION', parentEventIds: ['start'] }), event('agent', '2026-10-06T01:00:00Z', { branchId: 'agent', parentEventIds: ['fork'], statusCode: 'FAILED' }), event('algorithm', '2026-10-06T01:00:00Z', { branchId: 'algorithm', parentEventIds: ['fork'], statusCode: 'PENDING' }), event('rerun', '2026-10-07T00:00:00Z', { parentEventIds: ['agent'], branchId: 'agent' }), event('rollback', '2026-10-08T00:00:00Z', { parentEventIds: ['rerun'], branchId: 'agent', stage: 'RELEASE', statusCode: 'ROLLED_BACK' })]
    const value = history(events)
    value.branches = [{ id: 'trace:trace-1', label: '主干', currentEvent: events[1] }, { id: 'agent', label: 'Agent 迭代', currentEvent: events[5] }, { id: 'algorithm', label: '策略迭代', currentEvent: events[3] }]
    const graph = buildGovernanceGraph(value)
    expect(graph.edges.map(item => `${item.from}->${item.to}`)).toEqual(expect.arrayContaining(['start->fork', 'fork->agent', 'fork->algorithm', 'agent->rerun', 'rerun->rollback']))
    expect(graph.nodes.find(item => item.id === 'agent')!.x).toBe(graph.nodes.find(item => item.id === 'algorithm')!.x)
    expect(graph.nodes.find(item => item.id === 'agent')!.y).not.toBe(graph.nodes.find(item => item.id === 'algorithm')!.y)
    expect(graph.currentNodeIds).toEqual(expect.arrayContaining(['rollback', 'algorithm']))
    const sameLane = buildGovernanceGraph(history([event('one', '2026-10-06T00:00:00Z'), event('two', '2026-10-06T00:00:00Z')]))
    expect(sameLane.nodes[0].x).toBe(sameLane.nodes[1].x)
    expect(Math.abs(sameLane.nodes[0].y - sameLane.nodes[1].y)).toBeGreaterThanOrEqual(sameLane.nodes[0].height)
  })
  it('keeps invalid or missing time outside the graph, preserves dashed validation and uses only unique typed provenance', () => {
    const events = [event('dataset', '2026-10-06T00:00:00Z', { stage: 'DATASET', sourceRef: { kind: 'dataset', id: 'dataset-A' } }), event('validation', '2026-10-07T00:00:00Z', { stage: 'EXPERIMENT', relationType: 'VALIDATION', branchId: 'validation:experiment-A', sourceRef: { kind: 'experiment', id: 'experiment-A' }, targetRefs: [{ kind: 'dataset', id: 'dataset-A' }] }), event('missing', undefined, { parentEventIds: ['dataset'] }), event('invalid', 'not-a-date')]
    const graph = buildGovernanceGraph(history(events))
    expect(graph.nodes.map(item => item.id)).toEqual(['dataset', 'validation'])
    expect(graph.undatedEvents.map(item => item.id)).toEqual(['missing', 'invalid'])
    expect(graph.edges).toMatchObject([{ from: 'dataset', to: 'validation', dashed: true, provenance: 'OBJECT_RELATION' }])
    expect(graph.currentNodeIds).not.toContain('validation')
  })
  it('groups close events into bounded branch rows while retaining their exact times and underlying forks', () => {
    const events = [event('task', '2026-10-06T00:00:00Z', { stage: 'TASK' }), event('eval', '2026-10-06T00:01:00Z', { parentEventIds: ['task'] }), event('review', '2026-10-06T00:02:00Z', { stage: 'REVIEW', parentEventIds: ['eval'] }), event('route', '2026-10-06T00:03:00Z', { stage: 'ROUTING', branchId: 'algorithm', statusCode: 'PENDING', parentEventIds: ['review'] }), event('repair', '2026-10-06T00:04:00Z', { stage: 'DIRECT_FIX', branchId: 'agent', statusCode: 'FAILED', parentEventIds: ['review'] }), event('release', '2026-10-10T00:00:00Z', { stage: 'RELEASE', branchId: 'agent', statusCode: 'RELEASED', parentEventIds: ['repair'] })]
    const graph = buildGovernanceGraph(history(events), { timeWidth: 500 })
    const overview = buildGovernanceOverview(graph)
    const group = overview.groups.find(item => item.events.some(item => item.id === 'task'))!
    expect(group.events.map(item => item.id)).toEqual(['task', 'eval', 'review'])
    expect(group.x).toBe(graph.nodes.find(item => item.id === 'task')!.x)
    expect(group.endX).toBe(graph.nodes.find(item => item.id === 'review')!.x)
    expect(group.internalEdges.map(item => `${item.from}->${item.to}`)).toEqual(['task->eval', 'eval->review'])
    expect(overview.edges.filter(item => item.from === group.id)).toHaveLength(2)
    expect(overview.height).toBeLessThanOrEqual(420)
    expect(overview.groups.find(item => item.events.some(item => item.id === 'route'))?.current).toBe(true)
    expect(overview.groups.flatMap(item => item.events).map(item => item.occurredAt)).toEqual(expect.arrayContaining(events.map(item => item.occurredAt)))
  })
  it('does not turn mutual same-second object associations into a causal cycle', () => {
    const events = [event('issue', '2026-10-06T00:00:00Z', { stage: 'DIRECT_FIX', sourceRef: { kind: 'issue', id: 'issue-A' }, targetRefs: [{ kind: 'variant', id: 'variant-A' }] }), event('variant', '2026-10-06T00:00:00Z', { stage: 'VARIANT', sourceRef: { kind: 'variant', id: 'variant-A' }, targetRefs: [{ kind: 'issue', id: 'issue-A' }] })]
    expect(buildGovernanceGraph(history(events)).edges).toEqual([])
    const malformed = [event('first', '2026-10-06T00:00:00Z', { parentEventIds: ['second'] }), event('second', '2026-10-06T00:00:00Z', { parentEventIds: ['first'] })]
    expect(buildGovernanceGraph(history(malformed)).edges).toHaveLength(1)
  })
})
