import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from '../cases/model'
import { CaseEvaluations } from '../cases/CaseEvaluations'

describe('Trace module attribution to exact evolution workbench', () => {
  it('opens independent Skill deliveries and preserves the original module, Trace and filters on return', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = data.cases.find(item => item.id === 'case-ppt-management')!
    const skill = record.moduleEvaluations!.find(item => item.moduleCode === 'SKILL')!
    const onWorkbench = vi.fn()
    render(<CaseEvaluations record={record} data={data} onBackToTrace={() => undefined} sourceRoute="/cases?timeRange=30d&environment=Production&page=3" onOpenEvolutionWorkbench={onWorkbench} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 进化详情' }))
    const drawer = screen.getByRole('dialog', { name: 'skill · 进化详情' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'skill sop错误' }))
    const agent = drawer.querySelector('[data-evolution-record-id="evolution-module-path-demo-sop-agent"]')! as HTMLElement
    const strategy = drawer.querySelector('[data-evolution-record-id="evolution-module-path-demo-sop-strategy"]')! as HTMLElement
    expect(within(agent).getAllByRole('status', { name: '已准出' })).toHaveLength(3)
    expect(within(agent).getByRole('status', { name: '待发布' })).toBeInTheDocument()
    expect(within(strategy).getByRole('status', { name: '等待回传' })).toBeInTheDocument()
    expect(within(strategy).queryByRole('status', { name: '已准出' })).not.toBeInTheDocument()
    fireEvent.click(within(agent).getByRole('link', { name: '查看准出评测' }))
    const destination = new URL(onWorkbench.mock.calls[0][0], 'http://local.demo')
    expect(destination.searchParams.get('skill')).toBe('skill-ppt-builder')
    expect(destination.searchParams.get('skillVersion')).toBe('2.5.0')
    expect(destination.searchParams.get('attribution')).toBe('skill-sop')
    expect(destination.searchParams.get('evolutionRecordId')).toBe('evolution-module-path-demo-sop-agent')
    const returnTo = new URL(destination.searchParams.get('returnTo')!, 'http://local.demo')
    expect(returnTo.searchParams.get('moduleScoreId')).toBe(skill.id)
    expect(returnTo.searchParams.get('traceId')).toBe(record.trace!.id)
    expect(returnTo.searchParams.get('page')).toBe('3')
    expect(returnTo.searchParams.get('timeRange')).toBe('30d')
    expect(returnTo.searchParams.get('environment')).toBe('Production')
    expect(returnTo.searchParams.get('evolutionRecordId')).toBe('evolution-module-path-demo-sop-agent')
    const gateStage = within(agent).getByRole('region', { name: '3 准出状态' })
    const singleGate = within(gateStage).getByText('单能力变体实验').parentElement!
    fireEvent.click(within(singleGate).getByRole('button', { name: 'experiment-module-path-demo-single' }))
    const report = new URL(onWorkbench.mock.calls.at(-1)![0], 'http://local.demo')
    expect(report.searchParams.get('experimentId')).toBe('experiment-module-path-demo-single')
    expect(report.searchParams.get('evolutionRecordId')).toBe('evolution-module-path-demo-sop-agent')
  })

  it('restores an exact process fine item and refuses to replace a missing fine item with its module score', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = data.cases.find(item => item.id === 'case-ppt-management')!
    const skill = record.moduleEvaluations!.find(item => item.moduleCode === 'SKILL')!
    const evaluation = record.processEvals.find(item => data.evolutionState?.moduleEvolutionBindings?.some(binding => binding.moduleScoreId === skill.id && binding.processEvaluationId === item.id))!
    const { rerender } = render(<CaseEvaluations record={record} data={data} initialModuleScoreId={String(skill.id)} initialEvaluationId={evaluation.id} onBackToTrace={() => undefined} />)
    const drawer = screen.getByRole('dialog', { name: 'skill · 进化详情' })
    expect(within(drawer).getByRole('heading', { name: `skill · ${evaluation.dimension}评分依据` })).toBeInTheDocument()
    expect(within(drawer).getByText(evaluation.autoReason)).toBeInTheDocument()
    rerender(<CaseEvaluations record={record} data={data} initialModuleScoreId={String(skill.id)} initialEvaluationId="missing-fine-evaluation" onBackToTrace={() => undefined} />)
    expect(within(drawer).getByText('当前 Trace 未找到对应评分细项，未用模块总分或其他 Trace 替代。')).toBeInTheDocument()
    expect(within(drawer).getByText('未评测')).toBeInTheDocument()
    expect(within(drawer).getByRole('heading', { name: '当前归因与进化路径' })).toBeInTheDocument()
    expect(within(drawer).queryByRole('article', { name: /归因路径/ })).not.toBeInTheDocument()
  })

  it('lets route state own the open module layer and clears it when the route closes', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = data.cases.find(item => item.id === 'case-ppt-management')!
    const skill = record.moduleEvaluations!.find(item => item.moduleCode === 'SKILL')!
    const onEvolutionDetailChange = vi.fn()
    const props = { record, data, onBackToTrace: () => undefined, onEvolutionDetailChange }
    const { rerender } = render(<CaseEvaluations {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 进化详情' }))
    expect(onEvolutionDetailChange).toHaveBeenCalledWith({ moduleScoreId: skill.id, processEvaluationId: undefined, scoreDimensionId: undefined })
    expect(screen.queryByRole('dialog', { name: 'skill · 进化详情' })).not.toBeInTheDocument()
    rerender(<CaseEvaluations {...props} initialModuleScoreId={String(skill.id)} />)
    const layer = screen.getByRole('dialog', { name: 'skill · 进化详情' })
    expect(layer).toBeVisible()
    fireEvent.click(within(layer).getByRole('button', { name: 'Close panel' }))
    expect(onEvolutionDetailChange).toHaveBeenLastCalledWith()
    rerender(<CaseEvaluations {...props} />)
    expect(screen.queryByRole('dialog', { name: 'skill · 进化详情' })).not.toBeInTheDocument()
    rerender(<CaseEvaluations {...props} initialModuleScoreId={String(skill.id)} />)
    expect(screen.getByRole('dialog', { name: 'skill · 进化详情' })).toBeVisible()
  })
})
