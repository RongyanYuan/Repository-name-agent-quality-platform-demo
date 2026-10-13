import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleReviewEditor } from './ModuleReviewEditor'
import type { ModuleEvaluationScore } from '../domain'

const module = { id: 'score-1', packageId: 'package-1', traceId: 'trace-1', caseId: 'case-1', moduleCode: 'SKILL', moduleLabel: 'skill', automaticStatus: 'FAIL', score: 0.5, judgeReason: '命中错误 SOP', evalAgentVersion: 'eval-v1', rubricVersion: 'rubric-v1', evidence: { rootEvidenceIds: ['evidence-1'], rubricRule: 'rule', observationIds: [], logIds: [], artifactIds: [], firstFailure: true, derivedFailure: false, completeness: 'COMPLETE' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as ModuleEvaluationScore

describe('ModuleReviewEditor', () => {
  it('submits an independent human review and keeps the input on persistence failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('磁盘不可用'))
    render(<ModuleReviewEditor module={module} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('人工分数（0–2）'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('辅助结论'), { target: { value: 'FAIL' } })
    fireEvent.change(screen.getByLabelText('复核说明'), { target: { value: '根证据确认' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(screen.getByText(/磁盘不可用/)).toBeInTheDocument())
    expect(screen.getByLabelText('人工分数（0–2）')).toHaveValue(0)
    expect(screen.getByLabelText('复核说明')).toHaveValue('根证据确认')
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ humanScore: 0, reason: '根证据确认', moduleScoreId: 'score-1' }))
  })

  it('blocks empty and out-of-range scores before sending, while exposing evidence and versions', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ModuleReviewEditor module={module} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('辅助结论'), { target: { value: 'PASS' } })
    fireEvent.change(screen.getByLabelText('复核说明'), { target: { value: '已核对' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(screen.getByText(/必须填写人工分数/)).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('人工分数（0–2）'), { target: { value: '2.01' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(screen.getByText(/0–2 的有限数值/)).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('evidence-1')).toBeInTheDocument()
    expect(screen.getByText(/eval-v1/)).toBeInTheDocument()
    expect(screen.getByLabelText('自动分数（0–2）')).toHaveValue('1.00 / 2')
  })
})
