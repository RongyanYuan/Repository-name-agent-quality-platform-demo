import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from '../cases/model'
import { CaseEvaluations } from '../cases/CaseEvaluations'
import { ModuleEvaluationMatrix } from './ModuleEvaluationMatrix'
import { EvidenceBundleDrawer } from './EvidenceBundleDrawer'

describe('current Trace module review UI', () => {
  it('opens the current module review explicitly and targets its independent history drawer callback', async () => {
    const state = createInitialEvolutionData()
    const data = buildCaseAnalysisDataFromEvolution(state)
    const record = data.cases.find((item) => item.id === 'case-ppt-management')!
    const onModuleReview = vi.fn().mockResolvedValue(undefined)
    const onReviewHistory = vi.fn()
    render(<CaseEvaluations record={record} data={data} onBackToTrace={() => undefined} onModuleReview={onModuleReview} onReviewHistory={onReviewHistory} />)
    const row = screen.getByText('skill', { exact: true }).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: '人工复核 skill' }))
    expect(screen.getByLabelText('人工复核编辑器')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('人工分数（0–2）'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('辅助结论'), { target: { value: 'FAIL' } })
    fireEvent.change(screen.getByLabelText('复核说明'), { target: { value: '根证据确认' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(onModuleReview).toHaveBeenCalledWith(expect.objectContaining({ traceId: record.trace?.id, moduleScoreId: record.moduleEvaluations!.find((item) => item.moduleCode === 'SKILL')!.id, humanScore: 0 })))
    fireEvent.click(within(row).getByRole('button', { name: '查看 skill 复核历史' }))
    expect(onReviewHistory).toHaveBeenCalledWith(record.moduleEvaluations!.find((item) => item.moduleCode === 'SKILL')!.id)
  })

  it('separates automatic / human reasons and flags same-verdict score disagreement, with Context evidence only', () => {
    const onSelect = vi.fn()
    const onReview = vi.fn()
    render(<ModuleEvaluationMatrix modules={[{ id: 'skill-score', module: 'SKILL', autoStatus: 'PASS', score: 0.5, humanScore: 1.2, humanStatus: 'PASS', judgeReason: '自动说明', humanNote: '人工说明' }, { id: 'context-score', module: 'CONTEXT', score: 0.8, autoStatus: 'PASS' }]} onSelect={onSelect} onReview={onReview} />)
    const row = screen.getByText('skill', { exact: true }).closest('tr')!
    expect(within(row).getByText('自动 / 人工不一致')).toBeInTheDocument()
    expect(within(row).getByText(/自动说明/)).toBeInTheDocument()
    expect(within(row).getByText(/人工说明/)).toBeInTheDocument()
    const context = screen.getByText('上文', { exact: true }).closest('tr')!
    expect(within(context).queryByRole('button', { name: /人工复核/ })).not.toBeInTheDocument()
    expect(within(context).queryByText('1.60 / 2')).not.toBeInTheDocument()
    expect(within(context).getByRole('button', { name: '查看 上文 Evidence' })).toBeInTheDocument()
  })

  it('opens Evidence read-only and never exposes a second hidden override form', () => {
    render(<EvidenceBundleDrawer open onClose={() => undefined} module={{ id: 'score', module: 'SKILL', traceId: 'trace', judgeReason: '原始自动说明', humanNote: '独立人工说明', humanStatus: 'PASS' }} />)
    expect(screen.queryByLabelText('人工分数（0–2）')).not.toBeInTheDocument()
    expect(screen.getByText('原始自动说明')).toBeInTheDocument()
    expect(screen.getByText('独立人工说明')).toBeInTheDocument()
  })

  it('keeps explicit 0–2 automatic scores unchanged in Evidence and hides Context scoring', () => {
    const { rerender } = render(<EvidenceBundleDrawer open onClose={() => undefined} module={{ id: 'score', module: 'SKILL', score: 0.8, scoreScale: '0-2' }} />)
    expect(screen.getAllByText('0.80 / 2')).not.toHaveLength(0)
    expect(screen.queryByText('1.60 / 2')).not.toBeInTheDocument()
    rerender(<EvidenceBundleDrawer open onClose={() => undefined} module={{ id: 'context', module: 'CONTEXT', score: 0.8, scoreScale: '0-2' }} />)
    expect(screen.queryByText('0.80 / 2')).not.toBeInTheDocument()
    expect(screen.getByText('上文证据说明')).toBeInTheDocument()
  })

  it('shows an independent evaluation automatic reason and human reason in separate fields', () => {
    const data = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = data.cases.find((item) => item.id === 'case-ppt-management')!
    const evaluation = record.processEvals[0]
    render(<CaseEvaluations data={data} record={{ ...record, processEvals: [{ ...evaluation, moduleCode: 'SKILL', id: 'evaluation-reason-separation', dimension: '独立维度', autoStatus: 'PASS', autoReason: '自动原始说明', humanStatus: 'FAIL', humanReason: '人工改判说明', reason: '人工改判说明', evidenceIds: [] }], outcomeEvals: [] }} onBackToTrace={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 细项评分' }))
    expect(screen.getByText('LLM Judge Reason：自动原始说明')).toBeInTheDocument()
    expect(screen.getByText('人工说明：人工改判说明')).toBeInTheDocument()
  })
})
