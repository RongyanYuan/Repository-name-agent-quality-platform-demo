import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { resolveIdentity } from '../identity'
import { validateEvolutionState } from './validation'
import { selectTraceGovernance } from './traceGovernance'
import { enrichTraceGovernanceFixtures } from './traceGovernanceFixtures'

function unseededBase() {
  const state = createInitialEvolutionData()
  const fixtureIdentityIds = new Set((state.identityAliases ?? []).filter(item => item.alias.includes('governance-demo')).map(item => item.canonicalId))
  for (const [key, value] of Object.entries(state)) {
    if (!Array.isArray(value)) continue
    if (key === 'identityAliases') {
      state.identityAliases = state.identityAliases?.filter(item => !item.alias.includes('governance-demo'))
      continue
    }
    ;(state as unknown as Record<string, unknown>)[key] = value.filter(item => {
      if (!item || typeof item !== 'object') return true
      const record = item as { id?: string; caseId?: string }
      return !record.id?.includes('governance-demo') && !record.caseId?.includes('governance-demo') && !fixtureIdentityIds.has(record.id ?? '')
    })
  }
  return state
}

describe('Trace governance Mock fixtures', () => {
  it('adds one coherent new PPT full chain and preserves every prior frozen report and experiment', () => {
    const base = unseededBase()
    expect(base.cases.some(item => item.id === 'case-governance-demo-ppt')).toBe(false)
    const frozenBefore = structuredClone({ experiments: base.experiments, gateDecisions: base.gateDecisions, releases: base.releases })
    const state = enrichTraceGovernanceFixtures(base)
    const history = selectTraceGovernance(state, resolveIdentity(state, 'trace', 'trace-governance-demo-ppt'))
    expect(history.events.filter(item => item.origin === 'MOCK').map(item => item.stage)).toEqual(expect.arrayContaining(['TASK', 'EVALUATION', 'REVIEW', 'ATTRIBUTION', 'ROUTING', 'DATASET', 'CLUSTER', 'VARIANT', 'EXPERIMENT', 'WINDOW_EXPERIMENT', 'GATE', 'RELEASE']))
    expect(history.events.filter(item => item.origin === 'MOCK').every(item => !item.occurredAt || Date.parse(item.occurredAt) >= Date.parse('2026-10-06T02:00:00Z'))).toBe(true)
    expect(history.branches.some(item => item.currentEvent?.statusCode === 'RELEASED')).toBe(true)
    expect(history.branches.some(item => item.currentEvent?.statusCode === 'PENDING')).toBe(true)
    expect(history.memberships[0]).toMatchObject({ scope: 'TRACE', joinedAt: '2026-10-07T01:00:00Z', origin: 'MOCK' })
    expect(history.events.filter(item => item.stage === 'DATASET' && item.relationType === 'TRACE_SOURCE')).toHaveLength(1)
    expect(base.experiments).toEqual(frozenBefore.experiments)
    expect(state.experiments.slice(0, base.experiments.length)).toEqual(frozenBefore.experiments)
    expect(state.gateDecisions.slice(0, base.gateDecisions.length)).toEqual(frozenBefore.gateDecisions)
    expect(state.releases.slice(0, base.releases.length)).toEqual(frozenBefore.releases)
    expect(enrichTraceGovernanceFixtures(state)).toEqual(state)
    expect(validateEvolutionState(state)).toEqual([])
    for (const experiment of state.experiments.filter(item => item.id.includes('governance-demo'))) {
      expect(experiment.configSnapshot.repeatCount).toBe(3)
      expect(state.experimentRuns.filter(item => item.experimentId === experiment.id)).toHaveLength(6)
      expect(experiment.runIds).toHaveLength(6)
    }
  })
  it('provides direct Tool repair and parallel algorithm / Agent routes with no sibling release inheritance', () => {
    const state = enrichTraceGovernanceFixtures(unseededBase())
    const direct = selectTraceGovernance(state, 'trace-governance-demo-tool')
    expect(direct.events.find(item => item.stage === 'DIRECT_FIX')).toMatchObject({ statusCode: 'VERIFIED' })
    expect(direct.events.some(item => item.stage === 'CLUSTER' && item.relationType === 'TRACE_SOURCE')).toBe(false)
    const parallel = selectTraceGovernance(state, 'trace-governance-demo-parallel')
    expect(parallel.branches.filter(item => item.id.startsWith('finding:')).map(item => item.currentEvent?.statusCode).sort()).toEqual(['FAILED', 'PENDING'])
    const sibling = selectTraceGovernance(state, 'trace-governance-demo-ppt-context')
    expect(sibling.memberships[0]).toMatchObject({ scope: 'CASE_SHARED', joinedAt: undefined })
    expect(sibling.events.some(item => item.stage === 'RELEASE' && item.relationType === 'TRACE_SOURCE')).toBe(false)
  })
  it('keeps two precise module reviews and rerun history rather than treating a wait as execution duration', () => {
    const state = enrichTraceGovernanceFixtures(unseededBase())
    const traceId = resolveIdentity(state, 'trace', 'trace-governance-demo-ppt')
    const reviews = state.moduleReviews?.filter(item => item.traceId === traceId) ?? []
    expect(reviews.map(item => item.humanScore)).toEqual([1.25, 1.5])
    expect(reviews[1].supersedesReviewId).toBe(reviews[0].id)
    const history = selectTraceGovernance(state, traceId)
    expect(history.events.filter(item => item.stage === 'REVIEW' && item.origin === 'MOCK')).toHaveLength(2)
    expect(history.events.filter(item => item.stage === 'EVALUATION' && item.origin === 'MOCK')).toHaveLength(2)
    expect(state.traces.find(item => item.id === traceId)?.totalLatencyMs).toBe(65000)
    expect(reviews[1].automaticRevisionId).not.toBe(state.tracePackages.find(item => item.traceId === traceId)?.moduleScores[0].automaticRevisionId)
    const context = state.tracePackages.find(item => item.traceId === traceId)?.moduleScores.find(item => item.moduleCode === 'CONTEXT')
    expect(context?.automaticStatus).toBe('N/A')
    expect(context?.score).toBeUndefined()
    expect(history.events.some(item => item.stage === 'GATE' && item.statusCode === 'REJECT')).toBe(true)
    expect(history.events.some(item => item.stage === 'RELEASE' && item.statusCode === 'ROLLED_BACK')).toBe(true)
    for (const decision of state.gateDecisions.filter(item => item.id.includes('governance-demo'))) {
      expect(decision.reportSnapshot.runSnapshots?.every(run => Date.parse(run.updatedAt) <= Date.parse(decision.decidedAt))).toBe(true)
      expect(Date.parse(decision.reportSnapshot.configSnapshot!.createdAt)).toBeLessThanOrEqual(Date.parse(decision.decidedAt))
    }
  })
})
