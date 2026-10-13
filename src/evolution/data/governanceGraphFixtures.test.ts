import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { enrichGovernanceGraphFixtures } from './governanceGraphFixtures'
import { buildGovernanceGraph } from './governanceGraph'
import { selectTraceGovernance } from './traceGovernance'

describe('explicit Mock governance relations', () => {
  it('keeps reports, revisions and action times unchanged while adding a full fork, rerun and rollback history', () => {
    const base = createInitialEvolutionData()
    const before = structuredClone({ experiments: base.experiments, gateDecisions: base.gateDecisions, reviews: base.moduleReviews, releases: base.releases })
    const next = enrichGovernanceGraphFixtures(base)
    const graph = buildGovernanceGraph(selectTraceGovernance(next, 'trace-governance-demo-ppt'))
    expect(graph.edges).toEqual(expect.arrayContaining([expect.objectContaining({ from: 'event-governance-demo-ppt-release', to: 'event-governance-demo-ppt-pending' }), expect.objectContaining({ from: 'event-governance-demo-ppt-pending', to: 'event-governance-demo-ppt-rerun' }), expect.objectContaining({ from: 'event-governance-demo-ppt-gray-release', to: 'event-governance-demo-ppt-rollback' })]))
    const parallel = buildGovernanceGraph(selectTraceGovernance(next, 'trace-governance-demo-parallel'))
    const agentEdge = parallel.edges.find(item => item.to === 'event-governance-demo-parallel-agent')!
    const algorithmEdge = parallel.edges.find(item => item.to === 'event-governance-demo-parallel-algorithm')!
    expect(agentEdge.from).toBe(algorithmEdge.from)
    expect(next.experiments).toEqual(before.experiments)
    expect(next.gateDecisions).toEqual(before.gateDecisions)
    expect(next.moduleReviews).toEqual(before.reviews)
    expect(next.releases).toEqual(before.releases)
    for (const old of base.governanceEvents ?? []) expect(next.governanceEvents?.find(item => item.id === old.id)?.occurredAt).toBe(old.occurredAt)
    expect(enrichGovernanceGraphFixtures(next)).toEqual(next)
  })
})
