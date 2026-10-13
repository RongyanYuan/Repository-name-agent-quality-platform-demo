import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import type { EvolutionRepository } from './repository'
import { EvolutionProvider, useEvolution, type EvolutionAction } from './store'

describe('module review durable commit', () => {
  it('rejects failed persistence before publishing review state, then saves once on retry', async () => {
    const seed = createInitialEvolutionData()
    const pkg = seed.tracePackages.find((item) => item.caseId === 'case-ppt-management')!
    const score = pkg.moduleScores.find((item) => item.moduleCode === 'SKILL')!
    score.automaticRevisionId = 'v1'
    const originalCount = seed.moduleReviews?.length ?? 0
    let fail = true
    let saveCount = 0
    const repository: EvolutionRepository = { load: () => seed, reset: () => seed, save(next) { saveCount++; if (fail) throw new Error('存储已满'); expect(next.moduleReviews).toHaveLength(originalCount + 1) } }
    function Probe() {
      const context = useEvolution() as ReturnType<typeof useEvolution> & { commit: (action: EvolutionAction) => Promise<void> }
      return <><p>{context.state.moduleReviews?.length ?? 0} 条复核</p><button onClick={() => context.commit({ type: 'REVIEW_TRACE_MODULE', input: { traceId: pkg.traceId, packageId: pkg.id, moduleScoreId: score.id, automaticRevisionId: 'v1', humanScore: 0, auxiliaryVerdict: 'FAIL', reason: '核对', reviewer: '用户', reviewedAt: '2026-10-12T01:00:00Z', reviewId: 'review-commit' }, meta: { actor: '用户', reason: '核对', at: '2026-10-12T01:00:00Z' } } as unknown as EvolutionAction).catch((error: Error) => { screen.getByTestId('error').textContent = error.message })}>保存</button><p data-testid="error" /></>
    }
    render(<EvolutionProvider repository={repository}><Probe /></EvolutionProvider>)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('存储已满'))
    expect(screen.getByText(`${originalCount} 条复核`)).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.getByText(`${originalCount + 1} 条复核`)).toBeInTheDocument())
    expect(saveCount).toBe(2)
  })
})
