import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from '../cases/model'
import { CaseEvaluations } from '../cases/CaseEvaluations'

describe('process evaluation belongs to one module presentation', () => {
  it('opens an exact linked process evaluation with its reason and Evidence, and never substitutes a sibling Trace record', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = data.cases.find(item => item.id === 'case-ppt-management')!
    const evaluation = record.processEvals[0]
    const { rerender } = render(<CaseEvaluations record={record} data={data} initialEvaluationId={evaluation.id} onBackToTrace={() => undefined} onNavigate={() => undefined} />)
    const linked = screen.getByRole('article', { name: `过程细项 · ${evaluation.dimension}` })
    expect(linked).toBeVisible()
    expect(linked).toHaveFocus()
    expect(within(linked).getByText(`LLM Judge Reason：${evaluation.autoReason}`)).toBeVisible()
    expect(within(linked).getByRole('button', { name: `查看 Evidence ${evaluation.evidenceIds[0]}` })).toBeVisible()
    const sibling = data.traceRecords!.find(item => item.id === record.id && item.trace?.id !== record.trace?.id)!
    rerender(<CaseEvaluations record={sibling} data={data} initialEvaluationId={evaluation.id} onBackToTrace={() => undefined} />)
    expect(screen.getByRole('status', { name: '关联过程评测未找到' })).toHaveTextContent(evaluation.id)
    expect(screen.queryByRole('article', { name: `过程细项 · ${evaluation.dimension}` })).not.toBeInTheDocument()
  })

  it('keeps Outcome out of the process view and reveals scored dimensions and independent reasons in the matching module', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const original = data.cases.find(item => item.id === 'case-ppt-management')!
    const skill = original.moduleEvaluations!.find(item => item.moduleCode === 'SKILL')!
    const onOpenObservation = vi.fn()
    const onNavigate = vi.fn()
    const record = {
      ...original,
      processDimensions: [{ module: 'SKILL', dimension: 'SOP 参数规则', score: 0.8, scoreId: String(skill.id) }],
      processEvals: [{
        ...original.processEvals[0], id: 'independent-process', moduleCode: 'SKILL',
        observationId: 'obs-ppt-skill', dimension: 'Skill 召回准确率', score: 0.42,
        autoReason: '未召回管理层汇报 SOP。', humanReason: '人工确认过程原因。',
        humanScore: 1.2, humanStatus: 'FAIL' as const,
      }],
    }
    render(<CaseEvaluations record={record} data={data} onBackToTrace={onOpenObservation} onNavigate={onNavigate} />)
    expect(screen.queryByText('Outcome / 产物', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '过程评测' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '产物 / 结果评测' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 细项评分' }))
    const details = screen.getByLabelText('skill 细项评分')
    expect(within(details).getByText('SOP 参数规则')).toBeInTheDocument()
    expect(within(details).getByText('0.80 / 2')).toBeInTheDocument()
    expect(within(details).getByText('0.84 / 2')).toBeInTheDocument()
    expect(within(details).getByText('LLM Judge Reason：未召回管理层汇报 SOP。')).toBeInTheDocument()
    expect(within(details).getByText('人工说明：人工确认过程原因。')).toBeInTheDocument()
    fireEvent.click(within(details).getByRole('button', { name: '查看相关执行节点 obs-ppt-skill' }))
    expect(onOpenObservation).toHaveBeenCalledWith('obs-ppt-skill')
    fireEvent.click(within(details).getByRole('button', { name: /查看 Evidence evidence-ppt-recall/ }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'evidence', id: 'evidence-ppt-recall' }))
  })

  it('does not create independent Context scores or silently assign an unlinked result to Reason', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const original = data.cases.find(item => item.id === 'case-ppt-management')!
    const record = {
      ...original,
      processDimensions: [{ module: 'CONTEXT', dimension: '上文证据', score: 1.4 }],
      processEvals: [{ ...original.processEvals[0], id: 'unlinked-process', moduleCode: undefined, observationId: undefined, evidenceIds: [], dimension: '未归属维度', score: 0.3, autoReason: '独立记录尚无模块关联' }],
    }
    render(<CaseEvaluations record={record} data={data} onBackToTrace={() => undefined} />)
    const context = screen.getByText('上文', { exact: true }).closest('tr')!
    expect(within(context).queryByText('1.40 / 2')).not.toBeInTheDocument()
    expect(within(context).queryByRole('button', { name: /细项评分|人工复核/ })).not.toBeInTheDocument()
    expect(screen.getByText('未关联模块')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看 未关联模块 细项评分' }))
    expect(screen.getByText('未归属维度')).toBeInTheDocument()
    expect(screen.getByText('LLM Judge Reason：独立记录尚无模块关联')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '人工复核 未关联模块' })).not.toBeInTheDocument()
  })

  it('preserves explicit 0–2 automatic scores and leaves final aggregation unchanged', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const original = data.cases.find(item => item.id === 'case-ppt-management')!
    const record = {
      ...original,
      processFinalScore: undefined,
      processDimensions: [],
      moduleEvaluations: original.moduleEvaluations!.map(item => item.moduleCode === 'SKILL' ? { ...item, score: 0.8, scoreScale: '0-2' } : item),
      processEvals: [{ ...original.processEvals[0], moduleCode: 'SKILL', score: 0.25, scoreScale: '0-2' as const }],
    }
    render(<CaseEvaluations record={record} data={data} onBackToTrace={() => undefined} />)
    const skill = screen.getByText('skill', { exact: true }).closest('tr')!
    expect(within(skill).getByText('0.80 / 2')).toBeInTheDocument()
    expect(within(skill).queryByText('1.60 / 2')).not.toBeInTheDocument()
    fireEvent.click(within(skill).getByRole('button', { name: '查看 skill 细项评分' }))
    expect(within(screen.getByLabelText('skill 细项评分')).getByText('0.25 / 2')).toBeInTheDocument()
    expect(screen.getByText(/过程最终评分（0–2）/)).toHaveTextContent('未评测')
  })
})
