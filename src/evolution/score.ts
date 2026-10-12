/** Display/interaction contract for evaluation scores. */
function clampScore(value: number): number {
  return Math.max(0, Math.min(2, Number(value.toFixed(2))))
}

/** Existing EvalResult records store scores as legacy 0–1 fractions. */
export function legacyScoreOutOfTwo(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return clampScore(value >= 0 && value <= 1 ? value * 2 : value)
}

/** New TraceRating/module override records already use the 0–2 scale. */
export function normalizedScoreOutOfTwo(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return clampScore(value)
}

export function formatLegacyScoreOutOfTwo(value: unknown, fallback = '待评测') {
  const score = legacyScoreOutOfTwo(value)
  return score === undefined ? fallback : `${score.toFixed(2)} / 2`
}

export function formatNormalizedScoreOutOfTwo(value: unknown, fallback = '待评测') {
  const score = normalizedScoreOutOfTwo(value)
  return score === undefined ? fallback : `${score.toFixed(2)} / 2`
}

/** Backward-compatible alias for legacy EvalResult consumers. */
export const scoreOutOfTwo = legacyScoreOutOfTwo
export const formatScoreOutOfTwo = formatLegacyScoreOutOfTwo
