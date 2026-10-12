import { describe, expect, it } from 'vitest'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from './score'

describe('evaluation score display', () => {
  it('converts legacy 0–1 EvalResult scores exactly once', () => {
    expect(formatLegacyScoreOutOfTwo(0.58)).toBe('1.16 / 2')
    expect(formatLegacyScoreOutOfTwo(1)).toBe('2.00 / 2')
  })

  it('keeps normalized TraceRating and human override scores unchanged', () => {
    expect(formatNormalizedScoreOutOfTwo(0.58)).toBe('0.58 / 2')
    expect(formatNormalizedScoreOutOfTwo(1.4)).toBe('1.40 / 2')
    expect(formatNormalizedScoreOutOfTwo(2)).toBe('2.00 / 2')
  })
})
