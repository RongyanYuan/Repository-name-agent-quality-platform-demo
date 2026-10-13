import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleEvaluationMatrix } from './ModuleEvaluationMatrix'

describe('module evolution entry owns its exact score context', () => {
  const skill = { id: 'score-skill', moduleCode: 'SKILL', score: 0.8, scoreScale: '0-2', judgeReason: 'SOP 参数不正确' }
  it('shows separate compact evolution progress and opens the selected module without Evidence click-through', () => {
    const onOpenEvolution = vi.fn()
    const onSelect = vi.fn()
    render(<ModuleEvaluationMatrix modules={[skill]} mode="process" onSelect={onSelect} onOpenEvolution={onOpenEvolution} getEvolutionSummary={() => '2 条路径：等待回传 / 已准出待发布'} />)
    expect(screen.getByRole('columnheader', { name: '进化状态' })).toBeInTheDocument()
    const row = screen.getByText('skill', { exact: true }).closest('tr')!
    expect(within(row).getByText('2 条路径：等待回传 / 已准出待发布')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: '查看 skill 进化详情' }))
    expect(onOpenEvolution).toHaveBeenCalledWith({ module: skill })
    expect(onSelect).not.toHaveBeenCalled()
    const context = screen.getByText('上文', { exact: true }).closest('tr')!
    expect(within(context).queryByRole('button', { name: /进化详情/ })).not.toBeInTheDocument()
    expect(within(context).getByText('仅证据')).toBeInTheDocument()
  })

  it('opens the module history from the module name or ordinary row while Evidence keeps its own action', () => {
    const onOpenEvolution = vi.fn()
    const onSelect = vi.fn()
    const context = { id: 'context-score', moduleCode: 'CONTEXT', judgeReason: '只记录上文证据' }
    render(<ModuleEvaluationMatrix modules={[skill, context]} mode="process" onSelect={onSelect} onOpenEvolution={onOpenEvolution} />)
    const row = screen.getByRole('button', { name: '查看 skill 进化历史' }).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: '查看 skill 进化历史' }))
    fireEvent.click(within(row).getByText('0.80 / 2'))
    expect(onOpenEvolution).toHaveBeenCalledTimes(2)
    expect(onOpenEvolution).toHaveBeenLastCalledWith({ module: skill })
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(within(row).getByRole('button', { name: '查看 skill Evidence' }))
    expect(onSelect).toHaveBeenCalledWith(skill)
    expect(onOpenEvolution).toHaveBeenCalledTimes(2)
    const contextRow = screen.getByText('上文', { exact: true }).closest('tr')!
    expect(within(contextRow).queryByRole('button', { name: /进化历史|进化详情/ })).not.toBeInTheDocument()
    fireEvent.click(within(contextRow).getByRole('button', { name: '查看 上文 Evidence' }))
    expect(onSelect).toHaveBeenLastCalledWith(context)
    expect(onOpenEvolution).toHaveBeenCalledTimes(2)
  })

  it('keeps independent Rubric and ProcessEval entries precisely identified', () => {
    const onOpenEvolution = vi.fn()
    render(<ModuleEvaluationMatrix modules={[skill]} mode="process" onOpenEvolution={onOpenEvolution} getEvolutionSummary={selection => selection.processEvaluationId ? '过程细项待确认' : selection.scoreDimensionId ? 'SOP 路径' : '模块路径'} dimensions={[{ id: 'rubric-sop', module: 'SKILL', dimension: 'SOP 参数', score: 0.4, scoreId: skill.id }]} evaluations={[{ id: 'process-recall', taskId: 'case-1', family: 'Process Eval', moduleCode: 'SKILL', dimension: '召回准确率', score: 0.3, autoStatus: 'FAIL', autoReason: '召回错误', evidenceIds: [], judgeVersion: 'judge-1' }]} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 细项评分' }))
    const details = screen.getByLabelText('skill 细项评分')
    fireEvent.click(within(details).getByRole('button', { name: '查看 SOP 参数 进化详情' }))
    expect(onOpenEvolution).toHaveBeenLastCalledWith({ module: skill, scoreDimensionId: 'rubric-sop' })
    fireEvent.click(within(details).getByRole('button', { name: '查看 召回准确率 进化详情' }))
    expect(onOpenEvolution).toHaveBeenLastCalledWith({ module: skill, processEvaluationId: 'process-recall' })
    expect(within(details).getByText('过程细项待确认')).toBeInTheDocument()
  })
})
