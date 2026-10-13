import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildDatasetSamplingSnapshot } from './datasetSampling'
import { evolutionReducer } from '../store'
import { validateEvolutionState } from './validation'
import { createLocalEvolutionRepository } from '../repository'

const meta = { actor: '测试用户', reason: '自定义数据集测试', at: '2026-10-13T00:00:00.000Z', auditId: 'audit-custom-dataset-test' }

describe('custom dataset and proportional sampling', () => {
  it('creates a local custom dataset, adds exact Trace members and persists the audit event', () => {
    const seed = createInitialEvolutionData()
    const caseId = seed.cases[0].id
    const traceId = seed.cases[0].traceIds[0]
    const dataset = {
      id: 'dataset-custom-test', name: '我的复核集', description: '用于验证 SOP 修复', type: 'ATTRIBUTION' as const, version: 'v1',
      caseIds: [], sampleCount: 0, source: '当前用户创建', scope: '自定义数据集', frozen: false,
      population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock 数据层', countingRule: '按 Trace 去重' },
      purpose: '自定义数据集' as const, datasetOrigin: 'USER_CUSTOM' as const, datasetCategory: 'PERSONAL' as const, ownerScope: 'USER' as const,
      createdBy: '测试用户', createdAt: meta.at, updatedAt: meta.at
    }
    const created = evolutionReducer(seed, { type: 'CREATE_CUSTOM_DATASET', dataset, meta })
    const added = evolutionReducer(created, { type: 'ADD_DATASET_TRACES', datasetId: dataset.id, traceIds: [traceId], meta: { ...meta, auditId: 'audit-custom-dataset-add' } })
    expect(added.datasets.find(item => item.id === dataset.id)).toMatchObject({ datasetOrigin: 'USER_CUSTOM', description: '用于验证 SOP 修复', caseIds: [caseId], sampleCount: 1, timeRange: { from: seed.traces[0].queryAt, to: seed.traces[0].queryAt } })
    expect(added.datasetMemberships?.find(item => item.datasetId === dataset.id)?.traceIds).toEqual([traceId])
    expect(added.auditTrail.at(-1)).toMatchObject({ entityType: 'Dataset', entityId: dataset.id })
    expect(evolutionReducer(added, { type: 'ADD_DATASET_TRACES', datasetId: dataset.id, traceIds: [traceId], meta: { ...meta, auditId: 'audit-duplicate-add' } })).toBe(added)
  })

  it('allocates history proportionally and never duplicates a Trace hit by multiple evolution items', () => {
    const state = createInitialEvolutionData()
    const skill = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-ppt-builder')
    expect(skill).toBeTruthy()
    const snapshot = buildDatasetSamplingSnapshot(state, { datasetId: 'dataset-custom-test', assetKind: 'SKILL', assetId: 'skill-ppt-builder', assetVersion: skill!.target.kind === 'SKILL' ? skill!.target.skillVersion : undefined, requestedCount: 3, at: meta.at })
    const selected = snapshot.allocations.flatMap(item => item.sampledTraceIds)
    expect(new Set(selected).size).toBe(selected.length)
    expect(snapshot.deduplicatedTraceCount).toBe(selected.length)
    expect(snapshot.allocations.every(item => item.historicalShare >= 0 && item.historicalShare <= 1)).toBe(true)
  })

  it('applies the sampling snapshot into TRACE memberships and blocks writes after freeze', () => {
    const seed = createInitialEvolutionData()
    const dataset = { id: 'dataset-custom-apply', name: '抽样集', description: 'Mock', type: 'REGRESSION' as const, version: 'v1', caseIds: [], sampleCount: 0, source: '当前用户创建', scope: '自定义数据集', frozen: false, population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock 数据层', countingRule: '按 Trace 去重' }, purpose: '自定义数据集' as const, datasetOrigin: 'USER_CUSTOM' as const, datasetCategory: 'PERSONAL' as const, ownerScope: 'USER' as const, createdBy: '测试用户', createdAt: meta.at, updatedAt: meta.at }
    const created = evolutionReducer(seed, { type: 'CREATE_CUSTOM_DATASET', dataset, meta })
    const traceId = seed.traces[0].id
    const snapshot = { id: 'sampling-custom-apply', datasetId: dataset.id, assetKind: 'SKILL' as const, assetId: 'skill-ppt-builder', requestedCount: 1, candidateTraceIds: [traceId], allocations: [{ evolutionRecordId: 'record', attributionId: 'attr', attributionLabel: 'skill sop错误', historicalTraceCount: 1, historicalShare: 1, requestedCount: 1, sampledTraceIds: [traceId] }], deduplicatedTraceCount: 1, samplingRule: '按历史进化项占比', status: 'PREVIEW' as const, createdBy: '测试用户', createdAt: meta.at, updatedAt: meta.at }
    const applied = evolutionReducer(created, { type: 'APPLY_DATASET_SAMPLING', datasetId: dataset.id, snapshot, meta: { ...meta, auditId: 'audit-sampling-apply' } })
    expect(applied.datasetSamplingSnapshots?.[0]).toMatchObject({ status: 'APPLIED', datasetId: dataset.id })
    expect(applied.datasetMemberships?.some(item => item.datasetId === dataset.id && item.traceIds.includes(traceId))).toBe(true)
    expect(evolutionReducer(applied, { type: 'APPLY_DATASET_SAMPLING', datasetId: dataset.id, snapshot, meta: { ...meta, auditId: 'audit-sampling-duplicate' } })).toBe(applied)
    const frozen = evolutionReducer(applied, { type: 'FREEZE_DATASET_VERSION', datasetId: dataset.id, meta: { ...meta, auditId: 'audit-sampling-freeze' } })
    expect(evolutionReducer(frozen, { type: 'ADD_DATASET_TRACES', datasetId: dataset.id, traceIds: [seed.traces[1].id], meta: { ...meta, auditId: 'audit-frozen-write' } })).toBe(frozen)
    expect(validateEvolutionState(applied)).toEqual([])
  })

  it('round-trips custom dataset metadata and the immutable sampling audit through local persistence', () => {
    const storage = new Map<string, string>()
    const adapter = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(), key: (index: number) => [...storage.keys()][index] ?? null, get length() { return storage.size } } as Storage
    const repository = createLocalEvolutionRepository({ storage: adapter, storageKey: 'dataset-sampling-roundtrip' })
    const seed = repository.load()
    const dataset = { id: 'dataset-custom-roundtrip', name: 'Roundtrip 自定义集', description: '保留自定义用途', type: 'REGRESSION' as const, version: 'v1', caseIds: [], sampleCount: 0, source: '当前用户创建', scope: '自定义数据集', frozen: false, population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock 数据层', countingRule: '按 Trace 去重' }, purpose: '自定义数据集' as const, datasetOrigin: 'USER_CUSTOM' as const, datasetCategory: 'PERSONAL' as const, ownerScope: 'USER' as const, createdBy: '测试用户', createdAt: meta.at, updatedAt: meta.at }
    const created = evolutionReducer(seed, { type: 'CREATE_CUSTOM_DATASET', dataset, meta })
    const applied = evolutionReducer(created, { type: 'APPLY_DATASET_SAMPLING', datasetId: dataset.id, snapshot: { id: 'sampling-roundtrip', datasetId: dataset.id, assetKind: 'SKILL', assetId: 'skill-ppt-builder', requestedCount: 0, candidateTraceIds: [], allocations: [], deduplicatedTraceCount: 0, samplingRule: '按历史进化项占比', status: 'PREVIEW', createdBy: '测试用户', createdAt: meta.at, updatedAt: meta.at }, meta: { ...meta, auditId: 'audit-roundtrip' } })
    repository.save(applied)
    const loaded = repository.load()
    expect(loaded.datasets.find(item => item.id === dataset.id)).toMatchObject({ datasetOrigin: 'USER_CUSTOM', description: '保留自定义用途' })
    expect(loaded.datasetSamplingSnapshots?.find(item => item.id === 'sampling-roundtrip')).toMatchObject({ status: 'APPLIED', datasetId: dataset.id })
  })
})
