import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionRecord, TastePreferenceSignal } from '../domain'
import { groupModuleEvolutionDirections, type ModuleEvolutionPath } from '../data/moduleEvolution'
import { ModuleEvolutionDetail } from './ModuleEvolutionDetail'

const seed = createInitialEvolutionData()
const record: EvolutionRecord = { id: 'round-memory-2', name: '记忆召回第二轮', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-11T02:00:00Z', target: { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-policy', targetVersion: 'v2', attributionId: 'memory-recall' }, origin: 'MOCK', sourceFindingIds: ['finding-memory'], sourceAttributionIds: [], sourceIssueIds: [], sourceClusterIds: [], routingDeliveryIds: [], datasetIds: [], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [] }
const stage = (label: string, code = 'PENDING') => ({ label, code, reason: `${label}依据`, at: '2026-10-11T02:00:00Z', refs: [] })
const path = (label: string, id: string, isHistorical = false): ModuleEvolutionPath => ({ id, record, label, finding: seed.evaluationFindings[0], isHistorical, eligibility: { ...stage('规则待配置', 'UNKNOWN'), count: 12, unit: '条相关数据', countingRule: '按 Trace 去重' }, routing: stage(label === '策略迭代' ? '已接收，等待回传' : 'Agent 处理中'), gate: stage('已准出', 'PASS'), singleGate: stage('单能力通过', 'PASS'), windowGate: stage('窗口通过', 'PASS'), release: stage('待发布'), history: [{ id: 'event-1', stage: '归因', label: '人工确认', description: '根证据支持召回错误', at: '2026-10-10T02:00:00Z', refs: [] }], datasets: [], experiments: [], decisions: [], releases: [], warnings: [] })

describe('module evolution secondary detail', () => {
  it('keeps four independent stages for two deliveries and links the exact non-Skill round', () => {
    const onWorkbench = vi.fn()
    render(<ModuleEvolutionDetail selection={{ module: { id: 'memory-score', moduleLabel: '记忆', score: 0.4, scoreScale: '0-2', humanScore: 0.6, judgeReason: '自动召回不足', humanNote: '人工确认不足', evidence: { rubricRule: '召回规则 R1' } } }} evolution={{ currentPaths: [path('策略迭代', 'path-strategy'), path('Agent 迭代', 'path-agent')], historicalPaths: [], summary: '2 条路径', contextOnly: false }} onOpenWorkbench={onWorkbench} returnTo="/cases?traceId=123&caseView=eval&moduleScoreId=memory-score" />)
    expect(screen.getByText('0.40 / 2')).toBeInTheDocument()
    expect(screen.getByText('0.60 / 2')).toBeInTheDocument()
    const scoreDetails=screen.getByRole('heading',{name:'记忆评分依据'}).closest('details')!
    expect(scoreDetails).not.toHaveAttribute('open')
    fireEvent.click(scoreDetails.querySelector('summary')!)
    expect(screen.getByText('自动召回不足')).toBeInTheDocument()
    expect(screen.getByText('人工确认不足')).toBeInTheDocument()
    expect(screen.getByText('召回规则 R1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'召回率低'}))
    const strategy = screen.getByRole('article', { name: '归因路径 · 策略迭代' })
    const agent = screen.getByRole('article', { name: '归因路径 · Agent 迭代' })
    for (const row of [strategy, agent]) {
      expect(within(row).getByRole('heading', { name: '1 是否可进化' })).toBeInTheDocument()
      expect(within(row).getByRole('heading', { name: '2 流转去向' })).toBeInTheDocument()
      expect(within(row).getByRole('heading', { name: '3 准出状态' })).toBeInTheDocument()
      expect(within(row).getByRole('heading', { name: '4 是否上线' })).toBeInTheDocument()
      expect(within(row).getByRole('status', { name: '待发布' })).toHaveAttribute('data-color', 'yellow')
      expect(within(row).getByText('按 Trace 去重')).toBeInTheDocument()
    }
    fireEvent.click(within(agent).getByRole('link', { name: '查看进化数据集' }))
    const params = new URL(onWorkbench.mock.calls[0][0], 'http://localhost').searchParams
    expect(params.get('governanceObject')).toBe('Memory')
    expect(params.get('evolutionRecordId')).toBe(record.id)
    expect(params.has('skill')).toBe(false)
    expect(params.get('returnTo')).toContain('moduleScoreId=memory-score')
    expect(screen.queryByRole('button',{name:'定位治理路径'})).not.toBeInTheDocument()
    expect(within(agent).getByText('流转历史（1 条）').closest('details')).toHaveAttribute('open')
    expect(within(agent).getByText('根证据支持召回错误')).toBeVisible()
    expect(within(agent).getAllByText(/2026\/10\/10/).length).toBeGreaterThan(0)
  })

  it('groups the same direction current and history and filters different targets without losing source versions', () => {
    const current=path('记忆当前', 'memory-current')
    const old={...path('记忆历史', 'memory-history',true),record:{...record,id:'round-memory-1',name:'记忆召回第一轮',createdAt:'2026-10-01T02:00:00Z'}}
    const other={...path('Skill 修复', 'skill-path'),record:{...record,id:'round-skill',target:{kind:'SKILL' as const,governanceObject:'Skill' as const,skillId:'skill-ppt-builder',skillVersion:'2.5.0',attributionId:'skill-sop'}}}
    const evolution={currentPaths:[current,other],historicalPaths:[old],summary:'2 条路径',contextOnly:false}
    const onWorkbench=vi.fn()
    render(<ModuleEvolutionDetail selection={{module:{id:'score',moduleLabel:'Reason'}}} evolution={evolution} onOpenWorkbench={onWorkbench} returnTo="/cases?traceId=123&moduleScoreId=score" />)
    expect(screen.queryByRole('article',{name:'归因路径 · 记忆当前'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'召回率低'}))
    expect(screen.getByRole('article',{name:'归因路径 · 记忆当前'})).toBeVisible()
    expect(screen.getByRole('article',{name:'归因路径 · 记忆历史'})).toBeVisible()
    const direction=groupModuleEvolutionDirections(evolution).find(group=>group.target.kind==='MODULE')!
    fireEvent.change(screen.getByRole('combobox',{name:'进化方向'}),{target:{value:direction.id}})
    expect(screen.getByRole('article',{name:'归因路径 · 记忆当前'})).toBeVisible()
    expect(screen.getByRole('article',{name:'归因路径 · 记忆历史'})).toBeVisible()
    expect(screen.queryByRole('article',{name:'归因路径 · Skill 修复'})).not.toBeInTheDocument()
    expect(screen.getAllByText(/固定源版本 v2/).length).toBeGreaterThan(0)
    fireEvent.click(within(screen.getByRole('article',{name:'归因路径 · 记忆当前'})).getByRole('link',{name:'查看进化数据集'}))
    const url=new URL(onWorkbench.mock.calls[0][0],'http://local.demo')
    const returnTo=new URL(url.searchParams.get('returnTo')!,'http://local.demo')
    expect(returnTo.searchParams.get('moduleEvolutionDirectionId')).toBe(direction.id)
    expect(url.searchParams.get('targetVersion')).toBe('v2')
  })

  it('presents the complete chronological history before the current four-stage state',()=>{
    const current={...path('可回查路径','history-reading'),history:[{id:'event-late',stage:'GATE',label:'已准出',description:'回归通过，记录准出',at:'2026-10-11T02:00:00Z',refs:[]},{id:'event-early',stage:'ROUTING',label:'已分流',description:'归因确认后进入 Agent 迭代',at:'2026-10-10T02:00:00Z',refs:[]}]}
    render(<ModuleEvolutionDetail selection={{module:{id:'memory-score',moduleLabel:'记忆'}}} evolution={{currentPaths:[current],historicalPaths:[],summary:'1 条路径',contextOnly:false}}/>)
    fireEvent.click(screen.getByRole('button',{name:'召回率低'}))
    const article=screen.getByRole('article',{name:'归因路径 · 可回查路径'})
    const history=within(article).getByRole('list',{name:'完整流转历史'})
    expect(history.closest('details')).toHaveAttribute('open')
    expect(within(history).getAllByRole('listitem').map(item=>item.textContent)).toEqual([expect.stringContaining('归因确认后进入 Agent 迭代'),expect.stringContaining('回归通过，记录准出')])
    const status=within(article).getByRole('region',{name:'1 是否可进化'})
    expect(history.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(history).getByText('回归通过，记录准出')).toBeVisible()
    expect(screen.getByText(/当前 1 条路径 \/ 历史 0 条路径/)).toBeVisible()
  })

  it('uses the route direction as source of truth and leaves an exact unknown direction empty',()=>{
    const evolution={currentPaths:[path('当前路径','current')],historicalPaths:[],summary:'1 条路径',contextOnly:false}
    const direction=groupModuleEvolutionDirections(evolution)[0]
    const onEvolutionDirectionChange=vi.fn()
    const selection={module:{id:'memory-score',moduleLabel:'记忆'}}
    const {rerender}=render(<ModuleEvolutionDetail selection={selection} evolution={evolution} onEvolutionDirectionChange={onEvolutionDirectionChange}/>)
    fireEvent.change(screen.getByRole('combobox',{name:'进化方向'}),{target:{value:direction.id}})
    expect(onEvolutionDirectionChange).toHaveBeenCalledWith(direction.id)
    expect(screen.getByRole('combobox',{name:'进化方向'})).toHaveValue('')
    rerender(<ModuleEvolutionDetail selection={selection} evolution={evolution} onEvolutionDirectionChange={onEvolutionDirectionChange} initialEvolutionDirectionId="missing-direction"/>)
    expect(screen.getByText('当前模块未找到所选进化方向；没有显示其他方向替代。')).toBeVisible()
    expect(screen.queryByRole('article',{name:'归因路径 · 当前路径'})).not.toBeInTheDocument()
  })

  it('keeps same-worded attributions for different target versions independent and collapsed by default',()=>{
    const source={...path('PPT 旧版本修复','ppt-old'),record:{...record,id:'ppt-old-record',target:{kind:'SKILL' as const,governanceObject:'Skill' as const,skillId:'skill-ppt-builder',skillVersion:'2.5.0',attributionId:'skill-sop'}}}
    const newer={...path('PPT 新版本修复','ppt-new'),record:{...record,id:'ppt-new-record',target:{kind:'SKILL' as const,governanceObject:'Skill' as const,skillId:'skill-ppt-builder',skillVersion:'2.6.0',attributionId:'skill-sop'}}}
    render(<ModuleEvolutionDetail selection={{module:{id:'skill-score',moduleLabel:'skill'}}} evolution={{currentPaths:[source,newer],historicalPaths:[],summary:'2 条路径',contextOnly:false}}/>)
    const buttons=screen.getAllByRole('button',{name:'skill sop错误'})
    expect(buttons).toHaveLength(2)
    expect(buttons.map(button=>button.textContent)).toEqual(['skill sop错误','skill sop错误'])
    buttons.forEach(button=>expect(button).toHaveAttribute('aria-expanded','false'))
    expect(screen.queryByRole('article',{name:'归因路径 · PPT 旧版本修复'})).not.toBeInTheDocument()
    expect(screen.queryByRole('article',{name:'归因路径 · PPT 新版本修复'})).not.toBeInTheDocument()
    fireEvent.click(buttons[0])
    expect(buttons[0]).toHaveAttribute('aria-expanded','true')
    expect(buttons[1]).toHaveAttribute('aria-expanded','false')
    expect(screen.getByRole('article',{name:'归因路径 · PPT 旧版本修复'})).toBeVisible()
    expect(screen.queryByRole('article',{name:'归因路径 · PPT 新版本修复'})).not.toBeInTheDocument()
    fireEvent.click(buttons[1])
    expect(screen.getByRole('article',{name:'归因路径 · PPT 新版本修复'})).toBeVisible()
    fireEvent.click(buttons[0])
    expect(screen.queryByRole('article',{name:'归因路径 · PPT 旧版本修复'})).not.toBeInTheDocument()
    expect(screen.getByRole('article',{name:'归因路径 · PPT 新版本修复'})).toBeVisible()
  })

  it('does not expand a selected filter, but restores only the exact referenced record on return',()=>{
    const memory=path('记忆当前','memory-current')
    const skill={...path('Skill 当前','skill-current'),record:{...record,id:'skill-record',target:{kind:'SKILL' as const,governanceObject:'Skill' as const,skillId:'skill-ppt-builder',skillVersion:'2.5.0',attributionId:'skill-description'}}}
    const evolution={currentPaths:[memory,skill],historicalPaths:[],summary:'2 条路径',contextOnly:false}
    const selection={module:{id:'skill-score',moduleLabel:'skill'}}
    const skillDirection=groupModuleEvolutionDirections(evolution).find(group=>group.target.kind==='SKILL')!
    const {rerender}=render(<ModuleEvolutionDetail selection={selection} evolution={evolution} initialEvolutionDirectionId={skillDirection.id}/>)
    expect(screen.getByRole('button',{name:'skill name/description错误'})).toHaveAttribute('aria-expanded','false')
    expect(screen.queryByRole('article',{name:'归因路径 · Skill 当前'})).not.toBeInTheDocument()
    rerender(<ModuleEvolutionDetail selection={selection} evolution={evolution} initialEvolutionDirectionId={skillDirection.id} initialEvolutionRecordId="skill-record"/>)
    expect(screen.getByRole('button',{name:'skill name/description错误'})).toHaveAttribute('aria-expanded','true')
    expect(screen.getByRole('article',{name:'归因路径 · Skill 当前'})).toBeVisible()
    expect(screen.queryByRole('article',{name:'归因路径 · 记忆当前'})).not.toBeInTheDocument()
    rerender(<ModuleEvolutionDetail selection={selection} evolution={evolution}/>)
    expect(screen.getByRole('button',{name:'召回率低'})).toHaveAttribute('aria-expanded','false')
    expect(screen.getByRole('button',{name:'skill name/description错误'})).toHaveAttribute('aria-expanded','false')
    expect(screen.queryByRole('article',{name:'归因路径 · Skill 当前'})).not.toBeInTheDocument()
  })

  it('preserves taste preference context only on its explicit Finding, Skill and Case source',()=>{
    const target={kind:'SKILL' as const,governanceObject:'Skill' as const,skillId:'skill-taste-red',skillVersion:'1.2.0',attributionId:'taste-recall'}
    const taste={...path('品味偏好归因','taste-path'),record:{...record,id:'taste-record',target},finding:{...seed.evaluationFindings[0],id:'taste-finding',caseId:'taste-case',preferenceSignalId:'taste-signal'}}
    const unrelated={...path('其他 Skill 归因','other-path'),record:{...record,id:'other-record',target:{...target,skillId:'skill-taste-blue'}}}
    const signal:TastePreferenceSignal={id:'taste-signal',skillId:'skill-taste-red',populationTotal:1000,preferenceCount:950,preferenceValue:'红色',preferenceRate:0.95,caseIds:['taste-case'],evidenceIds:[],judgeReason:'1000 名去重用户反馈中，950 名偏好红色。',routingLabel:'Agent迭代',optimizationPath:'Agent迭代 → 品味库聚类',relatedDataCount:120,relatedDataThreshold:100,source:'MOCK_SET',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}
    const evolution={currentPaths:[taste,unrelated],historicalPaths:[],summary:'2 条路径',contextOnly:false}
    const selection={module:{id:'skill-score',moduleLabel:'skill'}}
    const {rerender}=render(<ModuleEvolutionDetail selection={selection} evolution={evolution} preferenceSignals={[signal]}/>)
    expect(screen.queryByRole('region',{name:'品味 Skill 批量偏好聚合'})).not.toBeInTheDocument()
    screen.getAllByRole('button',{name:'品味库召回错误'}).forEach(button=>fireEvent.click(button))
    const tasteArticle=screen.getByRole('article',{name:'归因路径 · 品味偏好归因'})
    const otherArticle=screen.getByRole('article',{name:'归因路径 · 其他 Skill 归因'})
    expect(within(tasteArticle).getByRole('region',{name:'品味 Skill 批量偏好聚合'})).toHaveTextContent('950 人 / 1000 人 · 偏好红色 95%')
    expect(within(tasteArticle).getByRole('region',{name:'品味 Skill 批量偏好聚合'})).toHaveTextContent('相关数据 120 / 100 条')
    expect(within(otherArticle).queryByRole('region',{name:'品味 Skill 批量偏好聚合'})).not.toBeInTheDocument()
    rerender(<ModuleEvolutionDetail selection={selection} evolution={evolution} preferenceSignals={[{...signal,caseIds:['different-case']}]}/>)
    expect(screen.queryByRole('region',{name:'品味 Skill 批量偏好聚合'})).not.toBeInTheDocument()
    expect(within(tasteArticle).getByRole('region',{name:'1 是否可进化'})).toHaveTextContent('规则待配置')
  })

  it('separates historical automatic bindings from current progress and leaves Context evidence-only', () => {
    const selection = { module: { id: 'skill-score', moduleLabel: 'skill' } }
    const { rerender } = render(<ModuleEvolutionDetail selection={selection} evolution={{ currentPaths: [], historicalPaths: [path('旧版 Agent 迭代', 'historical', true)], summary: '当前未关联', missingReason: '自动版本变更，当前归因尚未确认', contextOnly: false }} />)
    fireEvent.click(screen.getByRole('button',{name:'召回率低'}))
    expect(screen.getByRole('heading', { name: '历史自动版本 / 历史轮次' })).toBeInTheDocument()
    expect(screen.getByText('自动版本变更，当前归因尚未确认')).toBeInTheDocument()
    expect(screen.getByText('历史记录，不代表当前结论')).toBeInTheDocument()
    rerender(<ModuleEvolutionDetail selection={{ module: { id: 'context-score', moduleLabel: '上文', score: 2 } }} evolution={{ currentPaths: [], historicalPaths: [], summary: '仅证据', contextOnly: true }} />)
    expect(screen.getByText('上文仅作为证据')).toBeInTheDocument()
    expect(screen.queryByText('2.00 / 2')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '1 是否可进化' })).not.toBeInTheDocument()
  })
})
