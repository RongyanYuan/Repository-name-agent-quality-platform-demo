import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { evolutionReducer } from './store'
import type { Dataset, DatasetQueryRecord } from './domain'

const at = '2026-10-13T08:00:00.000Z'
const meta = { actor: '当前用户', reason: '数据集执行验收', at }
const dataset: Dataset = { id: 'dataset-query-test', name: '人工任务测试集', type: 'REGRESSION', version: 'v1', caseIds: [], sampleCount: 0, source: '用户创建', scope: '人工 Query', frozen: false, datasetOrigin: 'USER_CUSTOM', ownerScope: 'USER', datasetCategory: 'PERSONAL', population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock', countingRule: '按输入去重' }, createdAt: at, updatedAt: at }
const query: DatasetQueryRecord = { id: 'query-manual-test', datasetId: dataset.id, datasetVersion: 'v1', query: '生成管理层季度经营 PPT', verticalScenario: 'PPT', createdBy: '当前用户', status: 'PENDING', createdAt: at, updatedAt: at }
const setup = () => evolutionReducer(createInitialEvolutionData(), { type: 'CREATE_CUSTOM_DATASET', dataset, meta })

describe('dataset execution atomic mutations', () => {
  it('persists manual inputs without pretending a Case or Trace already exists', () => {
    const before = setup()
    const after = evolutionReducer(before, { type: 'ADD_DATASET_QUERY', query, meta } as never)
    expect(after.datasetQueries).toEqual([query])
    expect(after.cases).toEqual(before.cases)
    expect(after.traces).toEqual(before.traces)
    expect(after.datasets.find(item => item.id === dataset.id)?.caseIds).toEqual([])
    expect(evolutionReducer(after, { type: 'ADD_DATASET_QUERY', query, meta } as never)).toBe(after)
  })

  it('rejects new inputs after freezing instead of silently changing the frozen version', () => {
    const before = setup()
    const frozen = { ...before, datasets: before.datasets.map(item => item.id === dataset.id ? { ...item, frozen: true } : item) }
    expect(() => evolutionReducer(frozen, { type: 'ADD_DATASET_QUERY', query, meta } as never)).toThrow(/冻结/)
    expect(frozen.datasetQueries ?? []).toEqual([])
    expect(frozen.datasets.find(item => item.id === dataset.id)?.caseIds).toEqual([])
  })

  it('rejects a Query with no task text or an unsupported product type', () => {
    const before = setup()
    expect(() => evolutionReducer(before, { type: 'ADD_DATASET_QUERY', query: { ...query, query: '  ' }, meta } as never)).toThrow(/Query|任务/)
    expect(() => evolutionReducer(before, { type: 'ADD_DATASET_QUERY', query: { ...query, verticalScenario: 'Other' }, meta } as never)).toThrow(/PPT|Word|Excel|生图/)
  })
})
