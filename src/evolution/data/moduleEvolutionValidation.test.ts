import { describe,expect,it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { validateEvolutionState } from './validation'

describe('module evolution binding validation',()=>{
  it('rejects mismatched score/finding Trace and nonexistent independent records',()=>{
    const state=createInitialEvolutionData()
    const binding=state.moduleEvolutionBindings![0]
    binding.findingId='missing-finding'
    expect(validateEvolutionState(state).some(error=>error.path.includes('moduleEvolutionBindings'))).toBe(true)
    binding.evolutionRecordIds=['missing-record']
    expect(validateEvolutionState(state).some(error=>error.message.includes('missing-record'))).toBe(true)
  })
  it('rejects a module target carrying Skill identity or a Skill target without its fixed version',()=>{
    const state=createInitialEvolutionData()
    const record=state.evolutionRecords!.find(item=>item.target.kind==='MODULE')!
    Object.assign(record.target,{skillId:'skill-ppt-builder'})
    expect(validateEvolutionState(state).some(error=>error.path.includes('evolutionRecords') && error.message.includes('Skill'))).toBe(true)
    const skill=state.evolutionRecords!.find(item=>item.target.kind==='SKILL')!
    if(skill.target.kind==='SKILL')skill.target.skillVersion=''
    expect(validateEvolutionState(state).some(error=>error.path.includes('evolutionRecords') && error.message.includes('version'))).toBe(true)
  })
})
