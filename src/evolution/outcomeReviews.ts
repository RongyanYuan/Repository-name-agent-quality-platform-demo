import type { EvaluationRevision, EvaluationVerdict, OutcomeEval } from './domain'

export interface OutcomeReviewInput {
  traceId: string
  artifactId: string
  evaluationId: string
  automaticRevisionId: string
  humanScore?: number
  verdict: EvaluationVerdict
  reason: string
  reviewer: string
  reviewedAt: string
  reviewId: string
}

export function latestAutomaticOutcomeRevision(evaluation: OutcomeEval): EvaluationRevision | undefined {
  return evaluation.revisions.filter(item => item.source === 'AUTOMATIC').at(-1)
}

/** The automatic version never depends on an updatedAt changed by a human review. */
export function automaticOutcomeRevisionId(evaluation: OutcomeEval): string {
  return latestAutomaticOutcomeRevision(evaluation)?.id ?? `automatic-${evaluation.id}-${evaluation.evalVersion}-${evaluation.createdAt}`
}

export function automaticVersionForOutcomeReview(evaluation: OutcomeEval, revision: EvaluationRevision): string {
  if (revision.automaticRevisionId) return revision.automaticRevisionId
  const position = evaluation.revisions.findIndex(item => item.id === revision.id)
  const preceding = evaluation.revisions.slice(0, Math.max(0, position)).filter(item => item.source === 'AUTOMATIC').at(-1)
  return preceding?.id ?? `automatic-${evaluation.id}-${evaluation.evalVersion}-${evaluation.createdAt}`
}

export function latestOutcomeReview(evaluation: OutcomeEval): EvaluationRevision | undefined {
  const automaticId = automaticOutcomeRevisionId(evaluation)
  return evaluation.revisions.filter(item => item.source === 'HUMAN' && automaticVersionForOutcomeReview(evaluation, item) === automaticId).at(-1)
}

export function validateOutcomeReviewInput(input: OutcomeReviewInput, evaluation: OutcomeEval): void {
  if (evaluation.isFinal === true || (evaluation.isFinal !== false && ['产物合格性', '最终评分', '产物最终评分'].includes(evaluation.dimension))) throw new Error('最终评分独立保留，请复核对应产物细项')
  if (input.traceId !== evaluation.traceId || input.artifactId !== evaluation.artifactId || input.evaluationId !== evaluation.id) throw new Error('复核范围与产物细项不匹配')
  if (input.automaticRevisionId !== automaticOutcomeRevisionId(evaluation)) throw new Error('自动评测版本已变更，请刷新后重新复核')
  if (!input.reviewId.trim()) throw new Error('复核记录 ID 不能为空')
  if (!input.reason.trim()) throw new Error('复核说明不能为空')
  if (!input.reviewer.trim()) throw new Error('复核人不能为空')
  if (!input.reviewedAt.trim() || Number.isNaN(Date.parse(input.reviewedAt))) throw new Error('复核时间无效')
  if (!['PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE'].includes(input.verdict)) throw new Error('辅助结论无效')
  if (input.humanScore !== undefined) {
    if (!Number.isFinite(input.humanScore) || input.humanScore < 0 || input.humanScore > 2) throw new Error('人工分数必须是 0–2 的有限数值')
  } else if (input.verdict !== 'UNKNOWN' && input.verdict !== 'NOT_APPLICABLE') throw new Error('已评分复核必须填写人工分数')
}

export function toOutcomeReviewRevision(input: OutcomeReviewInput, evaluation: OutcomeEval, metadata?: { rubricRule: string; evalAgentVersion: string }): EvaluationRevision {
  validateOutcomeReviewInput(input, evaluation)
  const automatic = latestAutomaticOutcomeRevision(evaluation)
  return {
    id: input.reviewId, source: 'HUMAN', score: input.humanScore, scoreScale: '0-2', verdict: input.verdict,
    reason: input.reason.trim(), evaluator: input.reviewer.trim(), evaluatedAt: input.reviewedAt,
    evidenceIds: [...(automatic?.evidenceIds ?? evaluation.evidenceIds)], automaticRevisionId: input.automaticRevisionId,
    evalVersion: evaluation.evalVersion, evalAgentVersion: metadata?.evalAgentVersion ?? evaluation.evalAgentVersion ?? automatic?.evaluator,
    rubricRule: metadata?.rubricRule ?? evaluation.rubricRule ?? '待配置',
    automaticSnapshot: {
      score: automatic ? automatic.score : evaluation.score, scoreScale: automatic?.scoreScale ?? evaluation.scoreScale ?? '0-1',
      verdict: automatic?.verdict ?? evaluation.verdict, reason: automatic?.reason ?? '未记录',
      evidenceIds: [...(automatic?.evidenceIds ?? evaluation.evidenceIds)], evaluatedAt: automatic?.evaluatedAt,
      evalVersion: evaluation.evalVersion, evalAgentVersion: metadata?.evalAgentVersion ?? evaluation.evalAgentVersion ?? automatic?.evaluator,
      rubricRule: metadata?.rubricRule ?? evaluation.rubricRule ?? '待配置'
    },
    supersedesRevisionId: evaluation.revisions.filter(item => item.source === 'HUMAN').at(-1)?.id
  }
}
