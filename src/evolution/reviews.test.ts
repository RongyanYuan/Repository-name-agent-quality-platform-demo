import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { evolutionReducer, type EvolutionAction } from './store'
import type { EvaluationJob } from './domain'
import { automaticScoreScale, latestModuleReview, migrateLegacyModuleReviews, projectModuleReview } from './reviews'

const at = '2026-10-12T01:02:03.000Z'
const meta = { actor: '复核员', reason: '人工核对根证据', at, auditId: 'audit-module-review' }
function fixture() {
  const state = createInitialEvolutionData()
  const pkg = state.tracePackages.find((item) => item.caseId === 'case-ppt-management' && item.moduleScores.some((score) => score.moduleCode === 'SKILL'))!
  const score = pkg.moduleScores.find((item) => item.moduleCode === 'SKILL')!
  score.automaticRevisionId = 'automatic-v1'
  return { state, pkg, score }
}
function review(overrides: Record<string, unknown> = {}) {
  const { state, pkg, score } = fixture()
  const input = { traceId: pkg.traceId, packageId: pkg.id, moduleScoreId: score.id, automaticRevisionId: 'automatic-v1', humanScore: 0, auxiliaryVerdict: 'FAIL', reason: '根证据确认失败', reviewer: '复核员', reviewedAt: at, reviewId: 'review-1', ...overrides }
  return { state, pkg, score, input, action: { type: 'REVIEW_TRACE_MODULE', input, meta } as unknown as EvolutionAction }
}

describe('Trace module human review revisions', () => {
  it('appends two reviews, projects the latest, and preserves automatic records, routing and frozen reports', () => {
    const { state, pkg, score, input, action } = review()
    const original = structuredClone(state)
    const first = evolutionReducer(state, action)
    const second = evolutionReducer(first, { type: 'REVIEW_TRACE_MODULE', input: { ...input, humanScore: 2, auxiliaryVerdict: 'PASS', reason: '第二次复核', reviewId: 'review-2' }, meta: { ...meta, auditId: 'audit-review-2' } } as unknown as EvolutionAction)
    expect(second.moduleReviews?.filter((item) => item.moduleScoreId === score.id)).toHaveLength(2)
    expect(second.moduleReviews?.at(-1)).toMatchObject({ humanScore: 2, supersedesReviewId: 'review-1', automaticSnapshot: { score: score.score, status: score.automaticStatus, judgeReason: score.judgeReason, scoreScale: '0-1' } })
    const latest = second.tracePackages.find((item) => item.id === pkg.id)!.moduleScores.find((item) => item.id === score.id)!
    expect(latest).toMatchObject({ humanScore: 2, humanStatus: 'PASS', humanNote: '第二次复核', score: score.score, automaticStatus: score.automaticStatus, judgeReason: score.judgeReason })
    expect(second.routingDeliveries).toEqual(original.routingDeliveries)
    expect(second.gateDecisions).toEqual(original.gateDecisions)
    expect(second.experimentRuns).toEqual(original.experimentRuns)
    expect(state).toEqual(original)
    expect(second.moduleReviews?.[0].automaticSnapshot.evidence).not.toBe(score.evidence)
  })

  it.each([0, 2, 1.23])('accepts the valid 0–2 human score %s', (humanScore) => {
    const { state, action } = review({ humanScore })
    expect(evolutionReducer(state, action).moduleReviews?.at(-1)?.humanScore).toBe(humanScore)
  })

  it.each([-0.01, 2.01, Number.NaN, Infinity, undefined])('rejects invalid scored review %s without changing state', (humanScore) => {
    const { state, action } = review({ humanScore })
    const original = structuredClone(state.moduleReviews ?? [])
    expect(() => evolutionReducer(state, action)).toThrow(/人工分数/)
    expect(state.moduleReviews ?? []).toEqual(original)
  })

  it('requires a reason and permits an empty score only for UNKNOWN / N/A', () => {
    const invalid = review({ reason: '   ' })
    expect(() => evolutionReducer(invalid.state, invalid.action)).toThrow(/复核说明/)
    for (const auxiliaryVerdict of ['UNKNOWN', 'N/A']) {
      const valid = review({ humanScore: undefined, auxiliaryVerdict })
      expect(evolutionReducer(valid.state, valid.action).moduleReviews?.at(-1)).toMatchObject({ auxiliaryVerdict, humanScore: undefined })
    }
  })

  it('rejects wrong Trace, automatic revision, Context scoring and unsupported derived links', () => {
    for (const patch of [{ traceId: 'wrong-trace' }, { automaticRevisionId: 'obsolete' }, { auxiliaryVerdict: 'DERIVED_FAIL' }]) {
      const item = review(patch)
      item.score.evidence.derivedFromModule = undefined
      expect(() => evolutionReducer(item.state, item.action)).toThrow()
    }
    const item = review()
    item.score.moduleCode = 'CONTEXT'
    expect(() => evolutionReducer(item.state, item.action)).toThrow(/证据/)
  })

  it('deduplicates a repeated review id and rejects reuse for a different revision', () => {
    const { state, action, input } = review()
    const first = evolutionReducer(state, action)
    expect(evolutionReducer(first, action)).toBe(first)
    expect(() => evolutionReducer(first, { ...action, input: { ...input, reason: '不同内容' } } as unknown as EvolutionAction)).toThrow(/重复/)
  })

  it('uses an explicit score scale so an automatic 0.8 / 2 is not saved as a legacy fraction', () => {
    const item = review()
    item.score.score = 0.8
    item.score.scoreScale = '0-2'
    expect(automaticScoreScale(item.score)).toBe('0-2')
    expect(evolutionReducer(item.state, item.action).moduleReviews?.at(-1)?.automaticSnapshot).toMatchObject({ score: 0.8, scoreScale: '0-2' })
  })

  it('keeps old review history while a new automatic run clears the current human projection', () => {
    const { state, pkg } = fixture()
    const batch = { ...structuredClone(state.evaluationBatches.find((item) => item.id === pkg.batchId)!), id: 'rerun-batch', traceIds: [pkg.traceId], packageIds: [], jobIds: ['rerun-job'] }
    const targetId = `package-${batch.id}-${pkg.traceId}`
    const target = { ...structuredClone(pkg), id: targetId, batchId: batch.id, moduleScores: pkg.moduleScores.map((score) => ({ ...structuredClone(score), packageId: targetId, id: `module-score-${targetId}-${score.moduleCode.toLowerCase()}`, automaticRevisionId: 'before-rerun' })) }
    state.tracePackages.push(target)
    state.evaluationBatches.push(batch)
    const job: EvaluationJob = { id: 'rerun-job', batchId: batch.id, status: 'RUNNING', attempt: 2, traceIds: [pkg.traceId], processedTraceIds: [], failedTraceIds: [], evalAgentVersion: 'eval-new', rubricVersion: 'rubric-new', runEnvironment: 'local', configurationSnapshot: {}, createdAt: at, updatedAt: at }
    state.evaluationJobs.push(job)
    const targetScore = target.moduleScores.find((score) => score.moduleCode === 'SKILL')!
    const reviewed = evolutionReducer(state, { type: 'REVIEW_TRACE_MODULE', input: { traceId: pkg.traceId, packageId: targetId, moduleScoreId: targetScore.id, automaticRevisionId: 'before-rerun', humanScore: 0, auxiliaryVerdict: 'FAIL', reason: '旧版本复核', reviewer: '复核员', reviewedAt: at, reviewId: 'before-rerun-review' }, meta })
    const completed = evolutionReducer(reviewed, { type: 'COMPLETE_EVALUATION_JOB', jobId: job.id, meta })
    const updated = completed.tracePackages.find((item) => item.id === targetId)!.moduleScores.find((item) => item.moduleCode === 'SKILL')!
    expect(completed.moduleReviews).toEqual(reviewed.moduleReviews)
    expect(updated.humanStatus).toBeUndefined()
    expect(updated.humanScore).toBeUndefined()
    expect(updated.automaticRevisionId).not.toBe('before-rerun')
    expect(latestModuleReview(completed.moduleReviews, updated)).toBeUndefined()
  })

  it('translates a valid legacy override into an append-only legacy review', () => {
    const { state, pkg, score } = fixture()
    const next = evolutionReducer(state, { type: 'UPDATE_MODULE_EVALUATION', packageId: pkg.id, scoreId: score.id, patch: { humanStatus: 'PASS', humanScore: 2, humanNote: '兼容入口复核' }, meta })
    expect(next.moduleReviews?.at(-1)).toMatchObject({ moduleScoreId: score.id, origin: 'LEGACY', humanScore: 2, reason: '兼容入口复核' })
  })

  it('projects only the latest applicable review and marks historical revisions stale after rerun', () => {
    const { state, score, action } = review()
    const reviewed = evolutionReducer(state, action)
    expect(projectModuleReview(score, reviewed.moduleReviews)).toMatchObject({ humanScore: 0, humanStatus: 'FAIL', reviewState: 'REVIEWED' })
    const rerun = { ...score, automaticRevisionId: 'new-auto', humanStatus: 'PASS' as const, humanScore: 2 }
    expect(projectModuleReview(rerun, reviewed.moduleReviews)).toMatchObject({ humanScore: undefined, humanStatus: undefined, reviewState: 'STALE' })
  })

  it('migrates recorded legacy review metadata once and keeps automatic and frozen snapshots unchanged', () => {
    const { state, pkg, score } = fixture()
    score.humanStatus = 'PASS'; score.humanScore = 0; score.humanNote = '历史说明'; score.humanUpdatedAt = at; score.humanUpdatedBy = '历史复核人'
    const snapshot = structuredClone({ score, reports: state.gateDecisions })
    const migrated = migrateLegacyModuleReviews(state)
    const records = migrated.moduleReviews!.filter((item) => item.moduleScoreId === score.id)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ origin: 'LEGACY', humanScore: 0, reviewedAt: at, reviewer: '历史复核人', reason: '历史说明', automaticSnapshot: { score: score.score, judgeReason: score.judgeReason } })
    expect(migrateLegacyModuleReviews(migrated)).toEqual(migrated)
    expect(migrated.gateDecisions).toEqual(snapshot.reports)
    expect(state.tracePackages.find((item) => item.id === pkg.id)!.moduleScores.find((item) => item.id === score.id)).toEqual(snapshot.score)
  })

  it('preserves a missing-time legacy projection without inventing a review timestamp', () => {
    const { state, score } = fixture()
    score.humanStatus = 'PASS'; score.humanScore = 1.8; score.humanNote = '旧说明'; score.humanUpdatedAt = undefined
    const migrated = migrateLegacyModuleReviews(state)
    expect(migrated.moduleReviews?.filter((item) => item.moduleScoreId === score.id) ?? []).toHaveLength(0)
    expect(projectModuleReview(score, migrated.moduleReviews)).toMatchObject({ humanStatus: 'PASS', humanScore: 1.8 })
  })

  it('rejects invalid legacy override writes without publishing fields, review or governance success', () => {
    for (const patch of [{ humanScore: 2.01, humanStatus: 'PASS' as const, humanNote: '非法分数' }, { humanStatus: 'PASS' as const, humanNote: '缺少评分' }, { humanScore: 0, humanStatus: 'FAIL' as const, humanNote: '   ' }]) {
      const { state, pkg, score } = fixture()
      const before = structuredClone(state)
      expect(() => evolutionReducer(state, { type: 'UPDATE_MODULE_EVALUATION', packageId: pkg.id, scoreId: score.id, patch, meta })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('never promotes existing stale history to the current automatic revision during legacy migration', () => {
    const { state, pkg, score, action } = review()
    const reviewed = evolutionReducer(state, action)
    const rerun = structuredClone(reviewed)
    const current = rerun.tracePackages.find((item) => item.id === pkg.id)!.moduleScores.find((item) => item.id === score.id)!
    current.automaticRevisionId = 'auto-after-rerun'
    current.updatedAt = '2026-10-12T02:00:00.000Z'
    const priorRevisions = structuredClone(rerun.moduleReviews!.filter((item) => item.moduleScoreId === score.id))
    const migrated = migrateLegacyModuleReviews(rerun)
    const targetRevisions = migrated.moduleReviews!.filter((item) => item.moduleScoreId === score.id)
    expect(targetRevisions).toEqual(priorRevisions)
    const projected = projectModuleReview(migrated.tracePackages.find((item) => item.id === pkg.id)!.moduleScores.find((item) => item.id === score.id)!, migrated.moduleReviews)
    expect(projected).toMatchObject({ humanScore: undefined, humanStatus: undefined, reviewState: 'STALE' })
    expect(migrateLegacyModuleReviews(migrated)).toEqual(migrated)
  })
})
