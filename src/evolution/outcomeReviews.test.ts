import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { evolutionReducer } from './store'
import { automaticOutcomeRevisionId, type OutcomeReviewInput } from './outcomeReviews'
import { selectArtifactOutcomeEvaluations } from './data/artifactOutcomes'

const at = '2026-10-12T02:00:00Z'
const meta = { actor: '复核人', reason: '验证产物证据', at, auditId: 'outcome-audit' }
function fixture() {
  const state = createInitialEvolutionData()
  const evaluation = state.outcomeEvals.find(item => item.id === 'outcome-eval-ppt-style')!
  const input: OutcomeReviewInput = { traceId: evaluation.traceId, artifactId: evaluation.artifactId, evaluationId: evaluation.id, automaticRevisionId: automaticOutcomeRevisionId(evaluation), humanScore: 0, verdict: 'FAIL', reason: '核对产物证据', reviewer: '复核人', reviewedAt: at, reviewId: 'outcome-review-1' }
  return { state, evaluation, input }
}
describe('Outcome dimension review revisions', () => {
  it('appends two reviews without changing automatic, final scores, other artifacts or frozen reports', () => {
    const { state, evaluation, input } = fixture()
    const original = structuredClone(state)
    const first = evolutionReducer(state, { type: 'REVIEW_OUTCOME_DIMENSION', input, meta })
    const second = evolutionReducer(first, { type: 'REVIEW_OUTCOME_DIMENSION', input: { ...input, humanScore: 2, verdict: 'PASS', reason: '第二次复核', reviewId: 'outcome-review-2' }, meta: { ...meta, auditId: 'outcome-audit-2' } })
    const updated = second.outcomeEvals.find(item => item.id === evaluation.id)!
    expect(updated.score).toBe(evaluation.score)
    expect(updated.verdict).toBe(evaluation.verdict)
    expect(updated.revisions.slice(0, evaluation.revisions.length)).toEqual(evaluation.revisions)
    expect(updated.revisions.at(-1)).toMatchObject({ score: 2, scoreScale: '0-2', automaticRevisionId: input.automaticRevisionId, supersedesRevisionId: input.reviewId })
    expect(updated.revisions.at(-1)?.automaticSnapshot).toMatchObject({ score: evaluation.revisions.find(item => item.source === 'AUTOMATIC')?.score, scoreScale: '0-1', evalVersion: evaluation.evalVersion, evidenceIds: evaluation.evidenceIds })
    expect(selectArtifactOutcomeEvaluations(second, evaluation.traceId).find(item => item.artifact.id === evaluation.artifactId)!.dimensions.find(item => item.evaluation.id === evaluation.id)?.humanScore).toBe(2)
    expect(second.experiments).toEqual(original.experiments)
    expect(second.experimentRuns).toEqual(original.experimentRuns)
    expect(second.gateDecisions).toEqual(original.gateDecisions)
    expect(second.outcomeEvals.filter(item => item.id !== evaluation.id)).toEqual(original.outcomeEvals.filter(item => item.id !== evaluation.id))
    expect(state).toEqual(original)
  })

  it.each([-1, 2.01, Infinity, Number.NaN, undefined])('rejects invalid scored review %s', (humanScore) => {
    const { state, input } = fixture()
    expect(() => evolutionReducer(state, { type: 'REVIEW_OUTCOME_DIMENSION', input: { ...input, humanScore }, meta })).toThrow(/分数/)
  })

  it.each([{ reason: ' ' }, { artifactId: 'wrong' }, { traceId: 'wrong' }, { automaticRevisionId: 'obsolete' }, { reviewer: '' }, { reviewedAt: 'bad-time' }])('rejects mismatched or incomplete review %j', patch => {
    const { state, input } = fixture()
    expect(() => evolutionReducer(state, { type: 'REVIEW_OUTCOME_DIMENSION', input: { ...input, ...patch }, meta })).toThrow()
  })

  it('allows unscored unknown conclusions and makes repeated save idempotent', () => {
    const { state, input } = fixture()
    const action = { type: 'REVIEW_OUTCOME_DIMENSION' as const, input: { ...input, humanScore: undefined, verdict: 'UNKNOWN' as const }, meta }
    const next = evolutionReducer(state, action)
    expect(evolutionReducer(next, action)).toBe(next)
    expect(() => evolutionReducer(next, { ...action, input: { ...action.input, reason: 'changed' } })).toThrow(/重复/)
  })

  it('keeps final evaluation scores outside the dimension review action', () => {
    const { state, evaluation, input } = fixture()
    evaluation.isFinal = true
    expect(() => evolutionReducer(state, { type: 'REVIEW_OUTCOME_DIMENSION', input, meta })).toThrow(/最终评分/)
  })
})
