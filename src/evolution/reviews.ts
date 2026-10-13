import type { EvaluationEvidenceBundle, EvolutionState, ModuleEvaluationScore, ModuleEvaluationStatus, ModuleReviewRevision } from './domain'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from './score'

export interface ModuleReviewInput {
  traceId: string
  packageId: string
  moduleScoreId: string
  automaticRevisionId: string
  humanScore?: number
  auxiliaryVerdict: ModuleEvaluationStatus
  reason: string
  reviewer: string
  reviewedAt: string
  reviewId: string
}

export const automaticModuleRevisionId = (score: Pick<ModuleEvaluationScore, 'id' | 'automaticRevisionId' | 'updatedAt'>) => score.automaticRevisionId ?? `automatic-${score.id}-${score.updatedAt}`

export const automaticScoreScale = (score: Pick<ModuleEvaluationScore, 'scoreScale'>): '0-1' | '0-2' => score.scoreScale ?? '0-1'
export const formatAutomaticModuleScore = (score: Pick<ModuleEvaluationScore, 'score' | 'scoreScale'>, fallback = '待评测') => automaticScoreScale(score) === '0-2' ? formatNormalizedScoreOutOfTwo(score.score, fallback) : formatLegacyScoreOutOfTwo(score.score, fallback)

export function validateModuleReviewInput(input: ModuleReviewInput, score: ModuleEvaluationScore): void {
  if (!input.reviewId.trim()) throw new Error('复核记录 ID 不能为空')
  if (input.traceId !== score.traceId || input.packageId !== score.packageId || input.moduleScoreId !== score.id) throw new Error('复核范围与模块评分不匹配')
  if (input.automaticRevisionId !== automaticModuleRevisionId(score)) throw new Error('自动评测版本已变更，请刷新后重新复核')
  if (!input.reason.trim()) throw new Error('复核说明不能为空')
  if (!input.reviewer.trim()) throw new Error('复核人不能为空')
  if (!input.reviewedAt.trim() || Number.isNaN(Date.parse(input.reviewedAt))) throw new Error('复核时间无效')
  if (score.moduleCode === 'CONTEXT') throw new Error('Context 仅作为证据，不能独立评分')
  if (!['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A'].includes(input.auxiliaryVerdict)) throw new Error('辅助结论无效')
  if (input.auxiliaryVerdict === 'DERIVED_FAIL' && !score.evidence.derivedFromModule) throw new Error('派生失败必须关联来源模块证据')
  if (input.humanScore !== undefined) {
    if (!Number.isFinite(input.humanScore) || input.humanScore < 0 || input.humanScore > 2) throw new Error('人工分数必须是 0–2 的有限数值')
  } else if (input.auxiliaryVerdict !== 'UNKNOWN' && input.auxiliaryVerdict !== 'N/A') {
    throw new Error('已评分复核必须填写人工分数')
  }
}

export function toModuleReviewRevision(input: ModuleReviewInput, score: ModuleEvaluationScore, supersedesReviewId?: string, origin: ModuleReviewRevision['origin'] = 'LOCAL'): ModuleReviewRevision {
  validateModuleReviewInput(input, score)
  const automaticSnapshot: ModuleReviewRevision['automaticSnapshot'] = {
    score: score.score,
    scoreScale: automaticScoreScale(score),
    status: score.automaticStatus,
    judgeReason: score.judgeReason,
    evidence: structuredClone(score.evidence) as EvaluationEvidenceBundle,
    evalAgentVersion: score.evalAgentVersion,
    rubricVersion: score.rubricVersion
  }
  return {
    id: input.reviewId,
    traceId: input.traceId,
    caseId: score.caseId,
    packageId: input.packageId,
    moduleScoreId: input.moduleScoreId,
    automaticRevisionId: input.automaticRevisionId,
    humanScore: input.humanScore,
    auxiliaryVerdict: input.auxiliaryVerdict,
    reason: input.reason.trim(),
    reviewer: input.reviewer.trim(),
    reviewedAt: input.reviewedAt,
    evidenceIds: [...score.evidence.rootEvidenceIds],
    rubricVersion: score.rubricVersion,
    rubricRule: score.evidence.rubricRule,
    evalAgentVersion: score.evalAgentVersion,
    automaticSnapshot,
    supersedesReviewId,
    origin
  }
}

export function latestModuleReview(reviews: ModuleReviewRevision[] | undefined, score: ModuleEvaluationScore) {
  const revision = automaticModuleRevisionId(score)
  return (reviews ?? []).filter((item) => item.moduleScoreId === score.id && item.packageId === score.packageId && item.traceId === score.traceId && item.automaticRevisionId === revision).at(-1)
}

export function projectModuleReview(score: ModuleEvaluationScore, reviews: ModuleReviewRevision[] | undefined): ModuleEvaluationScore & { reviewState?: 'REVIEWED' | 'STALE' } {
  const latest = latestModuleReview(reviews, score)
  if (latest) return { ...score, humanStatus: latest.auxiliaryVerdict, humanScore: latest.humanScore, humanNote: latest.reason, humanUpdatedBy: latest.reviewer, humanUpdatedAt: latest.reviewedAt, reviewState: 'REVIEWED' }
  const hasHistory = reviews?.some((item) => item.moduleScoreId === score.id && item.packageId === score.packageId && item.traceId === score.traceId)
  return hasHistory ? { ...score, humanStatus: undefined, humanScore: undefined, humanNote: undefined, humanUpdatedBy: undefined, humanUpdatedAt: undefined, reviewState: 'STALE' } : score
}

/** Preserve recorded legacy human data without assigning a review time to records that did not have one. */
export function migrateLegacyModuleReviews(state: EvolutionState): EvolutionState {
  const revisions = [...(state.moduleReviews ?? [])]
  let changed = false
  const tracePackages = state.tracePackages.map((pkg) => {
    let packageChanged = false
    const moduleScores = pkg.moduleScores.map((score) => {
      if (!score.humanUpdatedAt || Number.isNaN(Date.parse(score.humanUpdatedAt)) || (score.humanStatus === undefined && score.humanScore === undefined && !score.humanNote)) return score
      const automaticRevisionId = automaticModuleRevisionId(score)
      // Existing revisions are authoritative. A stale compatibility projection
      // cannot prove that the user reviewed a newer automatic result.
      if (revisions.some((item) => item.moduleScoreId === score.id && item.packageId === pkg.id && item.traceId === score.traceId)) return score
      const previous = revisions.filter((item) => item.moduleScoreId === score.id && item.packageId === pkg.id).at(-1)
      revisions.push({
        id: `legacy-module-review-${pkg.id}-${score.id}-${automaticRevisionId}`,
        traceId: score.traceId, caseId: score.caseId, packageId: pkg.id, moduleScoreId: score.id, automaticRevisionId,
        humanScore: score.humanScore, auxiliaryVerdict: score.humanStatus ?? 'UNKNOWN', reason: score.humanNote?.trim() || '历史人工说明未记录',
        reviewer: score.humanUpdatedBy?.trim() || '历史复核人员未记录', reviewedAt: score.humanUpdatedAt,
        evidenceIds: [...score.evidence.rootEvidenceIds], rubricVersion: score.rubricVersion, rubricRule: score.evidence.rubricRule, evalAgentVersion: score.evalAgentVersion,
        automaticSnapshot: { score: score.score, scoreScale: automaticScoreScale(score), status: score.automaticStatus, judgeReason: score.judgeReason, evidence: structuredClone(score.evidence), evalAgentVersion: score.evalAgentVersion, rubricVersion: score.rubricVersion },
        supersedesReviewId: previous?.id, origin: 'LEGACY'
      })
      changed = true; packageChanged = true
      return { ...score, automaticRevisionId }
    })
    return packageChanged ? { ...pkg, moduleScores } : pkg
  })
  return changed ? { ...state, tracePackages, moduleReviews: revisions } : state
}
