import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { validateEvolutionState } from './validation'

describe('governance parent relationships',()=>{
  it('rejects missing, cross-Trace and cyclic parents without changing the source',()=>{
    const state=createInitialEvolutionData()
    const event=state.governanceEvents!.find(item=>item.id==='event-governance-demo-ppt-attribution')!
    const before=structuredClone(state)
    event.parentEventIds=['missing-parent']
    expect(validateEvolutionState(state).some(error=>error.path.includes('parentEventIds'))).toBe(true)
    event.parentEventIds=[state.governanceEvents!.find(item=>item.caseId==='case-governance-demo-tool')!.id]
    expect(validateEvolutionState(state).some(error=>error.message.includes('same Trace'))).toBe(true)
    event.parentEventIds=['event-governance-demo-ppt-routing']
    expect(validateEvolutionState(state).some(error=>error.message.includes('cycle'))).toBe(true)
    expect(before.gateDecisions).toEqual(state.gateDecisions)
  })
})
