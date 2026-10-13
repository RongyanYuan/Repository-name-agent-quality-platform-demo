import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution, filterCaseAnalysisRecords } from './model'
import { resolveIdentity } from '../identity'

describe('complete Trace-specific reading model', () => {
  it('does not inherit a sibling verdict or search match when the active Trace was never evaluated',()=>{
    const state=createInitialEvolutionData(), data=buildCaseAnalysisDataFromEvolution(state)
    const id=resolveIdentity(state,'trace','trace-governance-demo-ppt-context')
    const sibling=data.traceRecords!.find(item=>item.trace?.id===id)!
    expect(sibling.processSummary).toBe('UNKNOWN');expect(sibling.outcomeSummary).toBe('UNKNOWN')
    expect(sibling.artifacts).toHaveLength(0)
    expect(filterCaseAnalysisRecords(data.traceRecords!,{traceId:'trace-governance-demo-ppt-context',timeRange:'all'},data.referenceTime).map(item=>item.trace?.id)).toEqual([id])
  })
  it('isolates scores, latency, artifacts, evaluations and root failure for two Traces in one Case', () => {
    const state = createInitialEvolutionData()
    const source = state.cases.find(item => item.id === 'case-ppt-management')!
    const [first, last] = state.traces.filter(item => item.caseId === source.id).sort((a,b) => a.sequence-b.sequence)
    state.observations.find(item => item.traceId === first.id)!.status = 'FAILED'
    first.totalLatencyMs = 1111; last.totalLatencyMs = 9999
    const firstPkg = state.tracePackages.find(item => item.traceId === first.id)!
    firstPkg.rating = { scale: '0-2', rubric: 'independent', processFinal: 0.1, outcomeFinal: 0.2, processDimensions: [], outcomeDimensions: [] }
    state.tracePackages.find(item => item.traceId === last.id)!.rating = { ...firstPkg.rating, processFinal: 1.8, outcomeFinal: 1.9 }
    const data = buildCaseAnalysisDataFromEvolution(state)
    const a = data.traceRecords?.find(item => item.trace?.id === first.id)!
    const b = data.traceRecords?.find(item => item.trace?.id === last.id)!
    expect(a).toBeDefined(); expect(b).toBeDefined()
    expect(a.task.latency).toBe(1111); expect(b.task.latency).toBe(9999)
    expect(a.processFinalScore).toBe(0.1); expect(b.processFinalScore).toBe(1.8)
    expect(a.outcomeFinalScore).toBe(0.2); expect(b.outcomeFinalScore).toBe(1.9)
    expect(a.artifacts).toHaveLength(0)
    expect(b.artifacts.map(item=>item.id)).toContain('artifact-ppt-management')
    expect(a.processEvals.map(item=>item.id)).not.toContain('process-eval-ppt-recall')
    expect(b.processEvals.map(item=>item.id)).toContain('process-eval-ppt-recall')
    expect(a.failureObservation?.traceId).toBe(first.id)
    expect(b.failureObservation?.traceId).toBe(last.id)
    expect(a.session.turns).toHaveLength(4)
  })
})
