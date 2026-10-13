import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionState, OutcomeEval } from '../domain'
import type { EvolutionRepository } from '../repository'
import { EvolutionProvider, useEvolution } from '../store'
import { CaseOutcomeEvaluations } from './CaseOutcomeEvaluations'

const at = '2026-10-12T02:00:00Z'
function fixture(): { state: EvolutionState; traceId: string } {
  const state = createInitialEvolutionData()
  const artifact = state.artifacts.find(item => item.id === 'artifact-ppt-management')!
  state.artifacts.push({ ...artifact, id: 'second-artifact', name: '独立摘要.pptx' })
  const row = (id: string, artifactId: string, score: number): OutcomeEval => ({ id, artifactId, caseId: artifact.caseId, traceId: artifact.traceId, type: 'OUTCOME', dimension: id === 'main-dimension' ? '风格匹配' : '摘要准确性', evalVersion: 'v1', evalAgentVersion: 'Mock Agent', scoreScale: '0-2', score, verdict: 'UNKNOWN', evidenceIds: artifact.evidenceIds, rubricRule: '用户指定约束检查', revisions: [{ id: `automatic-${id}`, source: 'AUTOMATIC', score, scoreScale: '0-2', reason: id === 'main-dimension' ? '主文件依据' : '摘要依据', verdict: 'UNKNOWN', evaluator: 'Mock Agent', evidenceIds: artifact.evidenceIds, evaluatedAt: at }], createdAt: at, updatedAt: at })
  state.outcomeEvals = [row('main-dimension', artifact.id, 0.8), row('summary-dimension', 'second-artifact', 1.7)]
  return { state, traceId: artifact.traceId }
}

describe('Artifact outcome tab', () => {
  it('preserves the exact Artifact and evaluation context when opening root Evidence', () => {
    const { state, traceId } = fixture()
    const onNavigateReference = vi.fn()
    render(<CaseOutcomeEvaluations state={state} traceId={traceId} onNavigateReference={onNavigateReference} />)
    fireEvent.click(screen.getByRole('button', { name: '评分依据' }))
    const drawer = screen.getByRole('dialog', { name: '风格匹配 · 评分依据' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'evidence-ppt-style' }))
    expect(onNavigateReference).toHaveBeenCalledWith({ kind: 'evidence', id: 'evidence-ppt-style', caseView: 'outcome', artifactId: 'artifact-ppt-management', evaluationId: 'main-dimension' })
  })
  it('switches Artifact scores and details without copying another artifact or manufacturing a final score', () => {
    const { state, traceId } = fixture()
    render(<CaseOutcomeEvaluations state={state} traceId={traceId} onReview={vi.fn()} />)
    expect(screen.getByText('风格匹配')).toBeInTheDocument()
    expect(screen.queryByText('摘要准确性')).not.toBeInTheDocument()
    expect(screen.getByText('0.80 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '评分依据' }))
    expect(screen.getByText('主文件依据')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.change(screen.getByLabelText('选择评测产物'), { target: { value: 'second-artifact' } })
    expect(screen.getByText('摘要准确性')).toBeInTheDocument()
    expect(screen.queryByText('风格匹配')).not.toBeInTheDocument()
    expect(screen.getByText('1.70 / 2')).toBeInTheDocument()
    expect(screen.getByText('未评测')).toBeInTheDocument()
  })

  it('opens a requested outcome dimension on its Artifact and preserves inputs when persistence fails', async () => {
    const { state, traceId } = fixture()
    const onReview = vi.fn().mockRejectedValue(new Error('存储已满'))
    render(<CaseOutcomeEvaluations state={state} traceId={traceId} initialEvaluationId="summary-dimension" onReview={onReview} />)
    expect(screen.getByLabelText('选择评测产物')).toHaveValue('second-artifact')
    expect(screen.getByText('摘要依据')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.click(screen.getByRole('button', { name: '人工复核' }))
    fireEvent.change(screen.getByLabelText('产物人工分数（0–2）'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('产物辅助结论'), { target: { value: 'FAIL' } })
    fireEvent.change(screen.getByLabelText('产物复核说明'), { target: { value: '证据确认' } })
    fireEvent.click(screen.getByRole('button', { name: '保存产物复核' }))
    await waitFor(() => expect(screen.getByText(/存储已满/)).toBeInTheDocument())
    expect(screen.getByLabelText('产物人工分数（0–2）')).toHaveValue(0)
    expect(screen.getByLabelText('产物复核说明')).toHaveValue('证据确认')
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ evaluationId: 'summary-dimension', artifactId: 'second-artifact', humanScore: 0, automaticRevisionId: 'automatic-summary-dimension' }))
  })

  it('saves two reviews, reloads history and never publishes a failed durable save', async () => {
    const { state, traceId } = fixture()
    let saved = state, fail = true
    const repository: EvolutionRepository = { load: () => saved, reset: () => state, save(next) { if (fail) throw new Error('存储已满'); saved = structuredClone(next) } }
    function Probe() { const { state: current, commit } = useEvolution(); return <CaseOutcomeEvaluations state={current} traceId={traceId} onReview={input => commit({ type: 'REVIEW_OUTCOME_DIMENSION', input, meta: { actor: input.reviewer, reason: input.reason, at: input.reviewedAt } })} /> }
    const rendered = render(<EvolutionProvider repository={repository}><Probe /></EvolutionProvider>)
    fireEvent.click(screen.getByRole('button', { name: '人工复核' }))
    fireEvent.change(screen.getByLabelText('产物人工分数（0–2）'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('产物复核说明'), { target: { value: '第一次' } })
    fireEvent.click(screen.getByRole('button', { name: '保存产物复核' }))
    await waitFor(() => expect(screen.getByText(/存储已满/)).toBeInTheDocument())
    expect(saved.outcomeEvals[0].revisions).toHaveLength(1)
    fail = false
    fireEvent.click(screen.getByRole('button', { name: '保存产物复核' }))
    await waitFor(() => expect(screen.queryByLabelText('产物人工分数（0–2）')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '人工复核' }))
    fireEvent.change(screen.getByLabelText('产物人工分数（0–2）'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('产物复核说明'), { target: { value: '第二次' } })
    fireEvent.click(screen.getByRole('button', { name: '保存产物复核' }))
    await waitFor(() => expect(screen.queryByLabelText('产物人工分数（0–2）')).not.toBeInTheDocument())
    rendered.unmount()
    render(<EvolutionProvider repository={repository}><Probe /></EvolutionProvider>)
    expect(within(screen.getByRole('table')).getByText('2.00 / 2')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('0.80 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '评分依据' }))
    fireEvent.click(screen.getByText('复核历史（2 条）'))
    expect(screen.getByText('第一次')).toBeInTheDocument()
    expect(screen.getAllByText('第二次').length).toBeGreaterThan(0)
    expect(saved.outcomeEvals[0].score).toBe(0.8)
    expect(saved.outcomeEvals[1].revisions).toHaveLength(1)
  })
})
