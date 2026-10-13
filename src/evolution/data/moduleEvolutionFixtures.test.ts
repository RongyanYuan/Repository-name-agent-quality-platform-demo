import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { enrichModuleEvolutionFixtures } from './moduleEvolutionFixtures'
import { validateEvolutionState } from './validation'
import { selectEvolutionRecord } from './moduleEvolution'
import { datasetTraceRows } from './traceDataset'
import { upgradeMockFixtures } from './upgradeMockFixtures'

function beforeModuleFixtures(){
  const state=createInitialEvolutionData()
  for(const [key,value] of Object.entries(state))if(Array.isArray(value))(state as unknown as Record<string,unknown>)[key]=value.filter(item=>!item || typeof item!=='object' || !String((item as {id?:string}).id).includes('module-path-demo'))
  delete state.moduleEvolutionBindings;delete state.evolutionRecords
  state.cases=state.cases.map(item=>({...item,issueIds:item.issueIds.filter(id=>state.issues.some(issue=>issue.id===id)),attributionIds:item.attributionIds.filter(id=>state.attributions.some(attr=>attr.id===id))}))
  state.issues=state.issues.map(item=>({...item,clusterIds:item.clusterIds.filter(id=>state.issueClusters.some(cluster=>cluster.id===id))}))
  return state
}

describe('explicit module evolution fixtures',()=>{
  it('adds distinct bindings and records without rewriting earlier score or frozen history',()=>{
    const base=beforeModuleFixtures()
    const protectedBefore=structuredClone({packages:base.tracePackages,reviews:base.moduleReviews,decisions:base.gateDecisions,experiments:base.experiments})
    const state=enrichModuleEvolutionFixtures(base)
    expect(state.moduleEvolutionBindings!.length).toBeGreaterThan(0)
    expect(state.evolutionRecords!.some(item=>item.target.kind==='MODULE' && item.target.governanceObject==='Memory')).toBe(true)
    expect(state.evolutionRecords!.some(item=>item.target.kind==='SKILL')).toBe(true)
    expect(enrichModuleEvolutionFixtures(state)).toEqual(state)
    expect({packages:state.tracePackages,reviews:state.moduleReviews,decisions:state.gateDecisions.filter(item=>base.gateDecisions.some(original=>original.id===item.id)),experiments:state.experiments.filter(item=>base.experiments.some(original=>original.id===item.id))}).toEqual(protectedBefore)
    for(const original of base.issues){const updated=state.issues.find(item=>item.id===original.id)!;expect({...updated,clusterIds:original.clusterIds}).toEqual(original);expect(updated.clusterIds).toEqual(expect.arrayContaining(original.clusterIds))}
    expect(validateEvolutionState(state)).toEqual([])
  })
  it('keeps declared fine-score associations and independent strategy/Agent gates in one scored module',()=>{
    const state=createInitialEvolutionData()
    const bindings=state.moduleEvolutionBindings!.filter(item=>item.moduleScoreId==='module-score-trace-ppt-generate-skill')
    expect(bindings.some(item=>item.processEvaluationId==='process-eval-ppt-recall')).toBe(true)
    expect(bindings.some(item=>item.scoreDimensionId)).toBe(true)
    const strategy=state.evolutionRecords!.find(item=>item.id==='evolution-module-path-demo-sop-strategy')!
    const agent=state.evolutionRecords!.find(item=>item.id==='evolution-module-path-demo-sop-agent')!
    expect(strategy.decisionIds).toHaveLength(0);expect(strategy.releaseIds).toHaveLength(0)
    expect(agent.decisionIds).toHaveLength(2);expect(agent.releaseIds).toHaveLength(1)
    expect(state.releases.find(item=>item.id===agent.releaseIds[0])?.status).toBe('PENDING')
  })
  it('uses an independent fixed-version taste Skill population instead of production Skill cluster counts',()=>{
    const state=createInitialEvolutionData()
    const record=state.evolutionRecords!.find(item=>item.sourceFindingIds.includes('finding-module-path-demo-taste'))!
    expect(record.target).toMatchObject({kind:'SKILL',skillId:'skill-taste-executive',skillVersion:'0.9.0',attributionId:'taste-recall'})
    expect(record.sourceClusterIds).toEqual(['cluster-module-path-demo-taste'])
    const cluster=state.issueClusters.find(item=>item.id==='cluster-module-path-demo-taste')!
    expect(cluster.tastePopulation).toMatchObject({skillId:'skill-taste-executive',externalMockConfirmedCaseCount:37,snapshotId:'mock-taste-executive-090-module-path-demo'})
    expect(selectEvolutionRecord(state,record.id)!.paths[0].eligibility).toMatchObject({code:'PENDING',label:'积累中',count:37,threshold:100})
    expect(state.issueClusters.find(item=>item.id==='cluster-ppt-taste-pending')!.tastePopulation?.skillId).toBe('skill-ppt-builder')
  })
  it('enrolls only the explicit generation Trace in every new dataset with the declared Mock enrollment time',()=>{
    const state=createInitialEvolutionData()
    const traceId=state.tracePackages.find(item=>item.id==='package-trace-ppt-generate')!.traceId
    const contextTraceId=state.tracePackages.find(item=>item.id==='package-trace-ppt-context')!.traceId
    const datasets=state.datasets.filter(item=>item.id.startsWith('dataset-module-path-demo-'))
    expect(datasets).toHaveLength(7)
    for(const dataset of datasets){
      const membership=state.datasetMemberships!.find(item=>item.datasetId===dataset.id)!
      expect(membership).toMatchObject({scope:'TRACE',origin:'MOCK',traceIds:[traceId],datasetVersion:dataset.version,joinedAt:dataset.createdAt})
      expect(membership.traceIds).not.toContain(contextTraceId)
      expect(datasetTraceRows(state,dataset).map(item=>item.trace.id)).toEqual([traceId])
    }
  })
  it('repairs the exact interim preview taste relation without resetting manual scores or frozen reports',()=>{
    const seed=createInitialEvolutionData(),previous=structuredClone(seed)
    previous.seedVersion='office-agent-governance-demo-2.7.0'
    const id='evolution-finding-module-path-demo-taste-undistributed'
    const record=previous.evolutionRecords!.find(item=>item.id===id)!
    record.target={kind:'SKILL',governanceObject:'Skill',skillId:'skill-ppt-builder',skillVersion:'2.5.0',attributionId:'taste-recall'}
    record.sourceClusterIds=['cluster-ppt-taste-pending'];record.datasetIds=[]
    previous.issueClusters=previous.issueClusters.filter(item=>item.id!=='cluster-module-path-demo-taste')
    previous.issues=previous.issues.map(issue=>({...issue,clusterIds:issue.clusterIds.filter(id=>id!=='cluster-module-path-demo-taste')}))
    const score=previous.tracePackages.find(pkg=>pkg.id==='package-trace-ppt-generate')!.moduleScores.find(item=>item.moduleCode==='SKILL')!
    score.humanScore=1.2;score.humanNote='已有人工记录保持'
    const protectedBefore=structuredClone({packages:previous.tracePackages,reviews:previous.moduleReviews,decisions:previous.gateDecisions,experiments:previous.experiments})
    const upgraded=upgradeMockFixtures(previous,seed,'2026-10-12T13:00:00Z','audit-preview-upgrade')
    expect(upgraded.evolutionRecords!.find(item=>item.id===id)?.target).toMatchObject({skillId:'skill-taste-executive',skillVersion:'0.9.0'})
    expect(selectEvolutionRecord(upgraded,id)!.paths[0].eligibility).toMatchObject({label:'积累中',count:37,threshold:100})
    expect({packages:upgraded.tracePackages,reviews:upgraded.moduleReviews,decisions:upgraded.gateDecisions,experiments:upgraded.experiments}).toEqual(protectedBefore)
    expect(validateEvolutionState(upgraded)).toEqual([])
    previous.auditTrail.push({id:'audit-manual-target',at:'2026-10-12T12:00:00Z',actor:'人工复核员',action:'MANUAL_TARGET_EDIT',entityType:'EvolutionRecord',entityId:id,reason:'人工修订目标'})
    expect(upgradeMockFixtures(previous,seed,'2026-10-12T13:00:00Z','audit-preview-touched').evolutionRecords!.find(item=>item.id===id)?.target).toEqual(record.target)
  })
})
