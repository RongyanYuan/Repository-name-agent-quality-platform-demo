import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from './model'
import { CaseAnalysisWorkbench } from './CaseAnalysisWorkbench'

describe('three-tab Trace reading with module-owned evolution',()=>{
  it('opens process evaluation first with three tabs and one latest status column',()=>{
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())} initialCaseId="case-governance-demo-ppt"/>)
    const dialog=screen.getByRole('dialog',{name:/Case 详情/})
    expect(within(dialog).getAllByRole('tab').map(node=>node.textContent)).toEqual(['Session 对话','评测中心','产物评测'])
    expect(within(dialog).getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
    expect(within(dialog).queryByRole('tab',{name:'治理链路'})).not.toBeInTheDocument()
    const table=screen.getByRole('table',{name:'Case / Trace 列表'})
    expect(within(table).getByRole('columnheader',{name:'状态'})).toBeVisible()
    expect(within(table).queryByRole('columnheader',{name:'执行 / 模块复核'})).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader',{name:'治理去向 / 最近流转'})).not.toBeInTheDocument()
  })
  it('keeps process scoring and Artifact scoring in separate owning tabs',()=>{
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())} initialCaseId="case-governance-demo-ppt"/>)
    fireEvent.click(screen.getByRole('tab',{name:'评测中心'}))
    const panel=screen.getByRole('tabpanel')
    expect(within(panel).queryByRole('heading',{name:'过程评测'})).not.toBeInTheDocument()
    expect(within(panel).queryByRole('heading',{name:'产物 / 结果评测'})).not.toBeInTheDocument()
    expect(within(panel).queryByRole('row',{name:/^Outcome/})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab',{name:'产物评测'}))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('管理层 PPT')
  })
  it('restores routed evaluation and its module after Session without retaining a local tab override',()=>{
    const data=buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record=data.cases.find(item=>item.id==='case-ppt-management')!
    const skill=record.moduleEvaluations!.find(item=>item.moduleCode==='SKILL')!
    const onEvolutionDetailChange=vi.fn()
    const props={data,initialCaseId:record.id,initialTraceId:record.trace!.id,onEvolutionDetailChange,onViewChange:vi.fn()}
    const {rerender}=render(<CaseAnalysisWorkbench {...props} initialView="eval" initialModuleScoreId={String(skill.id)}/>)
    expect(screen.getByRole('dialog',{name:'skill · 进化详情'})).toBeVisible()
    rerender(<CaseAnalysisWorkbench {...props} initialView="session"/>)
    expect(screen.getByRole('tab',{name:'Session 对话'})).toHaveAttribute('aria-selected','true')
    expect(screen.queryByRole('dialog',{name:'skill · 进化详情'})).not.toBeInTheDocument()
    rerender(<CaseAnalysisWorkbench {...props} initialView="eval" initialModuleScoreId={String(skill.id)}/>)
    expect(screen.getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
    expect(screen.getByRole('dialog',{name:'skill · 进化详情'})).toBeVisible()
  })
  it('keeps Case and the merged module direction objects clickable after removing the governance tab',()=>{
    const onNavigateReference=vi.fn(),onOpenEvolutionWorkbench=vi.fn()
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())} initialCaseId="case-ppt-management" onNavigateReference={onNavigateReference} onOpenEvolutionWorkbench={onOpenEvolutionWorkbench}/>)
    const caseDetail=screen.getByRole('dialog',{name:/Case 详情/})
    fireEvent.click(within(caseDetail).getByRole('button',{name:'case-ppt-management'}))
    expect(onNavigateReference).toHaveBeenCalledWith(expect.objectContaining({kind:'case',id:'case-ppt-management'}))
    fireEvent.click(screen.getByRole('button',{name:'查看 skill 进化详情'}))
    const detail=screen.getByRole('dialog',{name:'skill · 进化详情'})
    const sop=within(detail).getAllByRole('region',{name:/^进化方向 ·/}).find(item=>item.getAttribute('data-evolution-direction-id')===JSON.stringify(['SKILL','Skill','skill-ppt-builder','2.5.0','skill-sop']))!
    expect(within(sop).getByRole('button',{name:'skill sop错误'})).toHaveAttribute('aria-expanded','false')
    fireEvent.click(within(sop).getByRole('button',{name:'skill sop错误'}))
    const agentPath=within(sop).getAllByRole('article',{name:/^归因路径 ·/}).find(item=>item.getAttribute('data-evolution-record-id')==='evolution-module-path-demo-sop-agent')!
    for(const [id,key] of [
      ['issue-module-path-demo-sop','issueId'],['variant-module-path-demo-sop','variantId'],
      ['experiment-module-path-demo-single','experimentId'],['decision-experiment-module-path-demo-window','decisionId'],
      ['release-module-path-demo-pending','releaseId']
    ]){
      fireEvent.click(within(agentPath).getAllByRole('button',{name:id})[0])
      const href=onOpenEvolutionWorkbench.mock.calls.at(-1)![0]
      const url=new URL(href,'http://demo')
      expect(url.pathname).toBe('/datasets-evaluations')
      expect(url.searchParams.get(key)).toBe(id)
      expect(url.searchParams.get('evolutionRecordId')).toBe('evolution-module-path-demo-sop-agent')
      expect(url.searchParams.get('skillVersion')).toBe('2.5.0')
    }
    fireEvent.click(within(agentPath).getByText(/关联数据集（/))
    fireEvent.click(within(agentPath).getByRole('link',{name:'dataset-module-path-demo-1'}))
    expect(new URL(onOpenEvolutionWorkbench.mock.calls.at(-1)![0],'http://demo').searchParams.get('datasetId')).toBe('dataset-module-path-demo-1')
    const taste=within(detail).getAllByRole('region',{name:/^进化方向 ·/}).find(item=>item.getAttribute('data-evolution-direction-id')===JSON.stringify(['SKILL','Skill','skill-taste-executive','0.9.0','taste-recall']))!
    fireEvent.click(within(taste).getByRole('button',{name:'品味库召回错误'}))
    fireEvent.click(within(taste).getAllByRole('button',{name:'cluster-module-path-demo-taste'})[0])
    const clusterURL=new URL(onOpenEvolutionWorkbench.mock.calls.at(-1)![0],'http://demo')
    expect(clusterURL.searchParams.get('clusterId')).toBe('cluster-module-path-demo-taste')
    expect(clusterURL.searchParams.get('skill')).toBe('skill-taste-executive')
    expect(screen.queryByRole('tab',{name:'治理链路'})).not.toBeInTheDocument()
  })
})
