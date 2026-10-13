import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { createInitialEvolutionData } from '../data'
import type { ModuleEvaluationScore, ModuleReviewRevision } from '../domain'
import { resolveIdentity } from '../identity'
import { automaticModuleRevisionId } from '../reviews'
import { EvolutionProvider } from '../store'
import { CASE_DETAIL_VIEWS, normalizeCaseView } from './caseViews'

beforeEach(() => localStorage.clear())
function RouteProbe() { const location=useLocation();return <output data-testid="three-tab-route">{location.pathname+location.search}</output> }
function open(extra='', state=createInitialEvolutionData()) {
  const traceId=resolveIdentity(state,'trace','trace-ppt-generate')
  render(<MemoryRouter initialEntries={[`/cases?traceId=${traceId}&timeRange=30d&environment=Production&${extra}`]}><QualityProvider><EvolutionProvider initialState={state}><App/><RouteProbe/></EvolutionProvider></QualityProvider></MemoryRouter>)
  return {state,traceId}
}
function url(){return new URL(screen.getByTestId('three-tab-route').textContent!,'http://local.demo')}
function review(score:ModuleEvaluationScore,id:string,reason:string,at:string):ModuleReviewRevision {
  return {id,traceId:score.traceId,caseId:score.caseId,packageId:score.packageId,moduleScoreId:score.id,automaticRevisionId:automaticModuleRevisionId(score),humanScore:1.5,auxiliaryVerdict:'PASS',reason,reviewer:'测试复核员',reviewedAt:at,evidenceIds:[...score.evidence.rootEvidenceIds],rubricVersion:score.rubricVersion,rubricRule:score.evidence.rubricRule,evalAgentVersion:score.evalAgentVersion,automaticSnapshot:{score:score.score,scoreScale:score.scoreScale ?? '0-1',status:score.automaticStatus,judgeReason:score.judgeReason,evidence:structuredClone(score.evidence),evalAgentVersion:score.evalAgentVersion,rubricVersion:score.rubricVersion},origin:'MOCK'}
}

describe('Case has three distinct views with module-owned evolution history',()=>{
  it('defaults to process evaluation and normalizes old Trace/governance views without a governance tab',()=>{
    expect(CASE_DETAIL_VIEWS.map(view=>view.id)).toEqual(['session','eval','outcome'])
    expect(normalizeCaseView()).toBe('eval')
    expect(normalizeCaseView('governance')).toBe('eval')
    expect(normalizeCaseView('trace')).toBe('eval')
    open()
    const tabs=screen.getByRole('tablist',{name:'Case detail views'})
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3)
    expect(within(tabs).getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
    expect(screen.queryByRole('tab',{name:'治理链路'})).not.toBeInTheDocument()
    expect(screen.queryByRole('region',{name:'治理时间分支图'})).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog',{name:/Case 详情/})).getByRole('table')).toBeVisible()
  })

  it('resolves an old governance record link to the exact current module and evolution direction',async()=>{
    open('caseView=governance&evolutionRecordId=evolution-module-path-demo-sop-agent&findingId=finding-module-path-demo-sop')
    await waitFor(()=>expect(url().searchParams.get('caseView')).toBe('eval'))
    expect(url().searchParams.get('moduleScoreId')).toBe('module-score-trace-ppt-generate-skill')
    expect(url().searchParams.get('moduleEvolutionDirectionId')).toBe(JSON.stringify(['SKILL','Skill','skill-ppt-builder','2.5.0','skill-sop']))
    expect(screen.getByRole('dialog',{name:'skill · 进化详情'})).toBeVisible()
    expect(screen.queryByRole('tab',{name:'治理链路'})).not.toBeInTheDocument()
  })

  it('shows an unmatched old governance source without choosing another module',()=>{
    open('caseView=governance&evolutionRecordId=missing-record&findingId=missing-finding')
    expect(screen.getByText('旧治理链接对应的进化轮次不存在；未打开其他模块。')).toBeVisible()
    expect(screen.queryByRole('dialog',{name:/进化详情/})).not.toBeInTheDocument()
    expect(screen.getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
  })

  it('opens independent exact module review history and keeps every automatic snapshot and Evidence',()=>{
    const state=createInitialEvolutionData()
    const traceId=resolveIdentity(state,'trace','trace-ppt-generate')
    const pkg=state.tracePackages.find(item=>item.traceId===traceId)!
    const score=pkg.moduleScores.find(item=>item.moduleCode==='SKILL')!
    const memory=pkg.moduleScores.find(item=>item.moduleCode==='MEMORY')!
    const otherTrace=state.tracePackages.filter(item=>item.traceId!==traceId).flatMap(item=>item.moduleScores).find(item=>item.moduleCode==='SKILL')!
    state.moduleReviews=[review(score,'review-first','第一次核对保留','2026-10-09T01:00:00Z'),review(score,'review-second','第二次核对保留','2026-10-10T01:00:00Z'),review(memory,'review-memory','其他模块不能串入','2026-10-10T02:00:00Z'),review(otherTrace,'review-other-trace','其他 Trace 不能串入','2026-10-10T03:00:00Z')]
    const snapshots=structuredClone(state.moduleReviews)
    open('caseView=eval',state)
    fireEvent.click(screen.getByRole('button',{name:'查看 skill 复核历史'}))
    const history=screen.getByRole('dialog',{name:'模块人工复核历史'})
    expect(history).toHaveTextContent('第一次核对保留')
    expect(history).toHaveTextContent('第二次核对保留')
    expect(history).not.toHaveTextContent('其他模块不能串入')
    expect(history).not.toHaveTextContent('其他 Trace 不能串入')
    expect(history).toHaveTextContent(score.judgeReason)
    expect(history).toHaveTextContent(score.evidence.rubricRule)
    expect(history.querySelectorAll('[data-review-id]')).toHaveLength(2)
    fireEvent.click(within(history).getAllByText('完整自动评测快照 / Evidence')[0])
    expect(history).toHaveTextContent(score.evidence.rootEvidenceIds[0])
    fireEvent.click(within(history).getByRole('button',{name:'关闭模块人工复核历史'}))
    expect(screen.getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
    expect(state.moduleReviews).toEqual(snapshots)
  })

  it('preserves Case shared audit under Session instead of repeating it in module evaluation',()=>{
    const state=createInitialEvolutionData()
    state.auditTrail.push({id:'test-shared-case-audit',at:'2026-10-10T05:00:00Z',actor:'测试治理员',action:'UPDATE_CASE',entityType:'Case',entityId:'case-ppt-management',reason:'Case 共享确认保留在 Session',changes:{status:'CONFIRMED'}})
    open('caseView=session',state)
    fireEvent.click(screen.getByText('Case 共享处理审计'))
    expect(screen.getByRole('region',{name:'Case 共享处理审计'})).toHaveTextContent('Case 共享确认保留在 Session')
    fireEvent.click(screen.getByRole('tab',{name:'评测中心'}))
    expect(screen.queryByText('Case 共享处理审计')).not.toBeInTheDocument()
  })
})
