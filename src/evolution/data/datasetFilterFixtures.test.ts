import { describe, expect, it } from 'vitest'
import { initialEvolutionData } from '../data'
import { validateEvolutionState } from './validation'

describe('dataset filter fixtures', () => {
  it('exposes explicit gate, golden and personal dataset categories', () => {
    const categories = new Set(initialEvolutionData.datasets.map(dataset => dataset.datasetCategory))
    expect(categories).toEqual(new Set(['GATE', 'GOLDEN', 'PERSONAL']))
    const gatePurposes = new Set(initialEvolutionData.datasets.filter(dataset => dataset.datasetCategory === 'GATE').map(dataset => dataset.purpose))
    expect(['原始归因集', '同类泛化集', '相邻及无关回归集', '窗口线上数据全集'].every(purpose => gatePurposes.has(purpose as never))).toBe(true)
    expect(initialEvolutionData.datasets.some(dataset => dataset.name.includes('黄金测试集A'))).toBe(true)
    expect(initialEvolutionData.datasets.some(dataset => dataset.ownerScope === 'USER' && dataset.source.includes('个人创建集'))).toBe(true)
  })

  it('has trace-scoped memberships for named golden and personal datasets', () => {
    const memberships = initialEvolutionData.datasetMemberships ?? []
    for (const id of ['dataset-golden-test-set-a', 'dataset-personal-ppt-regression']) {
      const dataset = initialEvolutionData.datasets.find(item => item.id === id)
      expect(dataset).toBeDefined()
      const linked = memberships.filter(item => item.datasetId === id && item.scope === 'TRACE')
      expect(linked.length).toBeGreaterThan(0)
      expect(linked.every(item => item.traceIds.length > 0 && dataset!.caseIds.includes(item.caseId))).toBe(true)
    }
  })

  it('provides distinct sample coverage windows for datetime filtering', () => {
    const ids = [
      'dataset-golden-test-set-c',
      'dataset-gate-production-skill-sop-b',
      'dataset-personal-memory-history',
      'dataset-personal-recent-mixed'
    ]
    const datasets = ids.map(id => initialEvolutionData.datasets.find(dataset => dataset.id === id))
    expect(datasets.every(dataset => Boolean(dataset?.timeRange))).toBe(true)
    const ranges = new Set(datasets.map(dataset => `${dataset!.timeRange!.from}/${dataset!.timeRange!.to}`))
    expect(ranges.size).toBe(ids.length)
    expect(datasets.every(dataset => dataset!.timeRange!.from < dataset!.timeRange!.to)).toBe(true)
    expect(datasets.every(dataset => (initialEvolutionData.datasetMemberships ?? []).some(member => member.datasetId === dataset!.id && member.scope === 'TRACE'))).toBe(true)
  })

  it('keeps the seeded state referentially valid', () => {
    expect(validateEvolutionState(initialEvolutionData)).toEqual([])
  })
})
