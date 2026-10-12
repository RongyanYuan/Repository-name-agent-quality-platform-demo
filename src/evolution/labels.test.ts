import { expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { resolveCaseSource, governanceLabel } from './labels'

it('keeps explicit Case source separate from environment and resolves legacy relationships', () => {
  const state = createInitialEvolutionData()
  const record = state.cases[0]
  expect(resolveCaseSource(state, { ...record, sourceType: 'GOLDEN_DATASET' }).label).toBe('黄金测试集')
  expect(resolveCaseSource(state, { ...record, sourceType: 'MOCK_SET', environment: 'Production' }).label).toBe('mock集')
  expect(resolveCaseSource(state, record).label).toBe('线上+时间窗口')
  expect(resolveCaseSource({ ...state, datasets: [], windows: [], evaluationBatches: [] }, record).label).toBe('mock集')
})
it('normalizes routing aliases and lifecycle labels without changing IDs', () => {
  expect(governanceLabel('Agent迭代')).toBe('Agent 迭代')
  expect(governanceLabel('SINGLE_PASSED')).toBe('单变体已通过')
  expect(governanceLabel('DERIVED_FAIL')).toBe('派生失败')
})
