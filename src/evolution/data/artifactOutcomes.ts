import type { Artifact, EvaluationRevision, Evidence, EvolutionState, OutcomeEval } from '../domain'
import { automaticOutcomeRevisionId, automaticVersionForOutcomeReview, latestAutomaticOutcomeRevision, latestOutcomeReview } from '../outcomeReviews'
import { resolveIdentity } from '../identity'

export interface ArtifactOutcomeEvaluation {
  evaluation: OutcomeEval
  automatic?: EvaluationRevision
  automaticRevisionId: string
  automaticScore?: number
  manual?: EvaluationRevision
  humanScore?: number
  effectiveScore?: number
  rubricRule: string
  evalAgentVersion: string
  evaluatedAt?: string
  history: Array<EvaluationRevision & { applicable: boolean }>
  evidence: Evidence[]
}

export interface ArtifactOutcomeGroup {
  artifact: Artifact
  finalEvaluation?: ArtifactOutcomeEvaluation
  dimensions: ArtifactOutcomeEvaluation[]
}

/** Strict explicit scale: a stored 0.8 can be 0.8 / 2 or 1.6 / 2. */
export function outcomeScoreOutOfTwo(score: number | undefined, scale: '0-1' | '0-2' = '0-1'): number | undefined {
  if (score === undefined || !Number.isFinite(score) || score < 0 || score > (scale === '0-1' ? 1 : 2)) return undefined
  return Number((score * (scale === '0-1' ? 2 : 1)).toFixed(2))
}

const isFinal = (evaluation: OutcomeEval) => evaluation.isFinal === true || (evaluation.isFinal !== false && ['产物合格性', '最终评分', '产物最终评分'].includes(evaluation.dimension))

export function projectArtifactOutcomeEvaluation(state: EvolutionState, evaluation: OutcomeEval): ArtifactOutcomeEvaluation {
  const automatic = latestAutomaticOutcomeRevision(evaluation)
  const manual = latestOutcomeReview(evaluation)
  const automaticRevisionId = automaticOutcomeRevisionId(evaluation)
  const automaticScore = outcomeScoreOutOfTwo(automatic ? automatic.score : evaluation.score, automatic?.scoreScale ?? evaluation.scoreScale ?? '0-1')
  const humanScore = manual ? outcomeScoreOutOfTwo(manual.score, manual.scoreScale ?? '0-1') : undefined
  const evidenceIds = [...new Set([...(automatic?.evidenceIds ?? evaluation.evidenceIds), ...(manual?.evidenceIds ?? [])])]
  const outcomeModule = state.tracePackages.filter(pkg => resolveIdentity(state, 'trace', pkg.traceId) === resolveIdentity(state, 'trace', evaluation.traceId)).sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)).flatMap(pkg => pkg.moduleScores).filter(score => score.moduleCode === 'OUTCOME' && score.evidence.artifactIds.includes(evaluation.artifactId) && score.evidence.rootEvidenceIds.some(id => evidenceIds.includes(id))).at(-1)
  return {
    evaluation, automatic, automaticRevisionId, automaticScore, manual, humanScore,
    // An explicit unscored review is meaningful; it must not silently fall back to automatic.
    effectiveScore: manual ? humanScore : automaticScore,
    rubricRule: evaluation.rubricRule?.trim() || outcomeModule?.evidence.rubricRule?.trim() || '待配置',
    evalAgentVersion: evaluation.evalAgentVersion?.trim() || outcomeModule?.evalAgentVersion || automatic?.evaluator || '未记录',
    evaluatedAt: automatic?.evaluatedAt,
    history: evaluation.revisions.filter(item => item.source === 'HUMAN').map(item => ({ ...item, applicable: automaticVersionForOutcomeReview(evaluation, item) === automaticRevisionId })),
    evidence: state.evidence.filter(item => evidenceIds.includes(item.id))
  }
}

export function selectArtifactOutcomeEvaluations(state: EvolutionState, traceId: string): ArtifactOutcomeGroup[] {
  const canonicalTraceId = resolveIdentity(state, 'trace', traceId)
  return state.artifacts.filter(artifact => resolveIdentity(state, 'trace', artifact.traceId) === canonicalTraceId).map(artifact => {
    const evaluations = state.outcomeEvals.filter(item => item.artifactId === artifact.id && item.caseId === artifact.caseId && resolveIdentity(state, 'trace', item.traceId) === canonicalTraceId)
    const finals = evaluations.filter(isFinal).sort((a, b) => (Date.parse(latestAutomaticOutcomeRevision(a)?.evaluatedAt ?? a.createdAt) || 0) - (Date.parse(latestAutomaticOutcomeRevision(b)?.evaluatedAt ?? b.createdAt) || 0) || a.id.localeCompare(b.id))
    const final = finals.at(-1)
    return { artifact, finalEvaluation: final ? projectArtifactOutcomeEvaluation(state, final) : undefined, dimensions: evaluations.filter(item => !isFinal(item)).map(item => projectArtifactOutcomeEvaluation(state, item)) }
  })
}
