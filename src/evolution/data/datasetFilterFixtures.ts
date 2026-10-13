import type { Dataset, DatasetCategory, DatasetMembershipRecord, EvolutionState } from '../domain'

/**
 * Adds the named dataset populations needed by the Case / Trace workbench.
 *
 * The original seed predates the dataset filter and only has gate datasets
 * attached through an evolution record.  This fixture makes ownership an
 * explicit, queryable field and supplies stable Golden/Personal examples.
 * Membership is recorded at Trace scope so filtering one dataset cannot pull
 * in sibling traces from the same Case.
 */
export function enrichDatasetFilterFixtures(state: EvolutionState): EvolutionState {
  const next = structuredClone(state)
  const now = '2026-10-10T04:00:00.000Z'
  next.datasetMemberships ??= []

  const categoryFor = (dataset: Dataset): DatasetCategory => {
    if (dataset.datasetCategory) return dataset.datasetCategory
    if (dataset.setRole === 'GOLDEN' || dataset.purpose === '黄金集') return 'GOLDEN'
    if (dataset.ownerScope === 'USER') return 'PERSONAL'
    return 'GATE'
  }
  next.datasets = next.datasets.map(dataset => ({
    ...dataset,
    datasetCategory: categoryFor(dataset),
    createdBy: dataset.createdBy ?? (categoryFor(dataset) === 'PERSONAL' ? '当前用户' : '治理平台 Mock'),
    ownerScope: dataset.ownerScope ?? (categoryFor(dataset) === 'PERSONAL' ? 'USER' : 'SYSTEM')
  }))

  const selected = next.traces.filter(trace => trace.caseId && trace.id).slice(0, 4)
  const addDataset = (dataset: Dataset, traces = selected.slice(0, 2)) => {
    if (next.datasets.some(item => item.id === dataset.id)) return
    next.datasets.push(dataset)
    traces.forEach((trace, index) => {
      if (!next.cases.some(item => item.id === trace.caseId)) return
      const joinedAt = new Date(Date.parse(now) + index * 60_000).toISOString()
      const membership: DatasetMembershipRecord = {
        id: `membership:${dataset.id}:${trace.id}`,
        datasetId: dataset.id,
        datasetVersion: dataset.version,
        caseId: trace.caseId,
        traceIds: [trace.id],
        scope: 'TRACE',
        joinedAt,
        actor: dataset.createdBy ?? '治理平台 Mock',
        origin: 'MOCK'
      }
      next.datasetMemberships!.push(membership)
    })
  }
  const makeDataset = (input: Pick<Dataset, 'id' | 'name' | 'type' | 'version' | 'datasetCategory' | 'createdBy' | 'ownerScope' | 'purpose' | 'setRole' | 'frozen' | 'source' | 'scope'> & Partial<Pick<Dataset, 'timeRange' | 'windowIds'>>, traces = selected.slice(0, 2)): Dataset => {
    const caseIds = [...new Set(traces.map(trace => trace.caseId))]
    const timestamps = traces.flatMap(trace => [trace.startedAt, trace.endedAt]).filter(Boolean).sort()
    return {
      ...input,
      caseIds,
      sampleCount: caseIds.length,
      // Dataset timeRange is the sample coverage window, rather than the
      // dataset creation time.  Keep the fixture deterministic so the
      // workbench's custom datetime filter can be exercised against both
      // local Trace samples and external Mock populations.
      timeRange: input.timeRange ?? (timestamps.length ? { from: timestamps[0], to: timestamps[timestamps.length - 1] } : undefined),
      population: {
        totalSampleCount: caseIds.length,
        localCaseCount: caseIds.length,
        externalSampleCount: 0,
        sourceSystem: '本地 Mock 数据层',
        countingRule: '按 Trace 成员去重；筛选仅展示明确 TRACE 关联'
      },
      targets: [],
      createdAt: now,
      updatedAt: now
    }
  }

  const goldenTraces = selected.slice(0, 3)
  const personalTraces = selected.slice(1, 3).length ? selected.slice(1, 3) : selected.slice(0, 1)
  addDataset(makeDataset({
    id: 'dataset-golden-test-set-a',
    name: '黄金测试集A · 全链路基线',
    type: 'ATTRIBUTION',
    version: 'v1.0',
    datasetCategory: 'GOLDEN',
    createdBy: '治理平台 Mock',
    ownerScope: 'SYSTEM',
    purpose: '黄金集',
    setRole: 'GOLDEN',
    frozen: true,
    source: '黄金测试集（Mock）',
    scope: '长期回归基线'
  }, goldenTraces), goldenTraces)
  addDataset(makeDataset({
    id: 'dataset-golden-test-set-b',
    name: '黄金测试集B · 多轮上下文',
    type: 'GENERALIZATION',
    version: 'v1.1',
    datasetCategory: 'GOLDEN',
    createdBy: '治理平台 Mock',
    ownerScope: 'SYSTEM',
    purpose: '黄金集',
    setRole: 'GOLDEN',
    frozen: false,
    source: '黄金测试集（Mock）',
    scope: '多轮任务长期回归'
  }, selected.slice(0, 2)), selected.slice(0, 2))
  addDataset(makeDataset({
    id: 'dataset-personal-ppt-regression',
    name: '我的 PPT 回归集 · 管理层样式',
    type: 'REGRESSION',
    version: 'v1.0',
    datasetCategory: 'PERSONAL',
    createdBy: 'user-demo-a',
    ownerScope: 'USER',
    purpose: '相邻及无关回归集',
    setRole: 'EVALUATION',
    frozen: false,
    source: '个人创建集（Mock）',
    scope: '当前用户的管理层 PPT 复核样本'
  }, personalTraces), personalTraces)
  addDataset(makeDataset({
    id: 'dataset-personal-excel-tool',
    name: '我的 Excel 工具回归集 · 导出',
    type: 'REGRESSION',
    version: 'v2.0',
    datasetCategory: 'PERSONAL',
    createdBy: 'user-demo-b',
    ownerScope: 'USER',
    purpose: '相邻及无关回归集',
    setRole: 'EVALUATION',
    frozen: false,
    source: '个人创建集（Mock）',
    scope: '个人工具失败复核样本'
  }, selected.slice(-2)), selected.slice(-2))

  // Additional time-separated Mock datasets make the datetime overlap
  // semantics visible in the workbench.  The scenario fixtures are all
  // explicit, evaluated Traces; using non-overlapping slices lets a user
  // verify that an interval selects the expected dataset without relying on
  // an opaque "unknown" time value.
  const scenarioTraces = next.traces.filter(trace => trace.id.startsWith('trace-v2-'))
  const byScenario = (...ids: string[]) => ids
    .map(id => scenarioTraces.find(trace => trace.id === `trace-v2-${id}`))
    .filter((trace): trace is typeof scenarioTraces[number] => Boolean(trace))
  const tasteScenarioTraces = byScenario('taste-red', 'taste-asset-quality', 'taste-asset-shortage')
  const productionScenarioTraces = byScenario('production-file', 'production-sop', 'production-metadata')
  const memoryScenarioTraces = byScenario('memory-production', 'memory-management', 'memory-recall', 'memory-accuracy')

  addDataset(makeDataset({
    id: 'dataset-golden-test-set-c',
    name: '黄金测试集C · 品味偏好历史',
    type: 'GENERALIZATION',
    version: 'v1.0',
    datasetCategory: 'GOLDEN',
    createdBy: '治理平台 Mock',
    ownerScope: 'SYSTEM',
    purpose: '黄金集',
    setRole: 'GOLDEN',
    frozen: false,
    source: '黄金测试集（Mock）',
    scope: '品味偏好与多轮反馈长期基线'
  }, tasteScenarioTraces), tasteScenarioTraces)
  addDataset(makeDataset({
    id: 'dataset-gate-production-skill-sop-b',
    name: '生产 Skill SOP 归因集B',
    type: 'ATTRIBUTION',
    version: 'v1.0',
    datasetCategory: 'GATE',
    createdBy: '算法团队 Mock',
    ownerScope: 'TEAM',
    purpose: '原始归因集',
    setRole: 'EVALUATION',
    frozen: false,
    source: '线上 Badcase 快照（Mock）',
    scope: '生产 Skill SOP 错误的算法 Badcase 归因样本'
  }, productionScenarioTraces), productionScenarioTraces)
  addDataset(makeDataset({
    id: 'dataset-personal-memory-history',
    name: '我的 Memory 历史复核集',
    type: 'GENERALIZATION',
    version: 'v1.0',
    datasetCategory: 'PERSONAL',
    createdBy: 'user-demo-memory',
    ownerScope: 'USER',
    purpose: '同类泛化集',
    setRole: 'EVALUATION',
    frozen: false,
    source: '个人创建集（Mock）',
    scope: '记忆生产、管理与召回准确性历史样本'
  }, memoryScenarioTraces), memoryScenarioTraces)
  addDataset(makeDataset({
    id: 'dataset-personal-recent-mixed',
    name: '我的近期跨模块复核集',
    type: 'REGRESSION',
    version: 'v1.0',
    datasetCategory: 'PERSONAL',
    createdBy: '当前用户',
    ownerScope: 'USER',
    purpose: '相邻及无关回归集',
    setRole: 'EVALUATION',
    frozen: false,
    source: '个人创建集（Mock）',
    scope: '最近一轮 Skill、Memory 与 Reason 复核样本'
  }, byScenario('production-sop', 'memory-recall', 'reason-choice')), byScenario('production-sop', 'memory-recall', 'reason-choice'))

  // Keep dataset sample/population counts internally consistent after a
  // re-seed or a local fixture merge.
  next.datasets = next.datasets.map(dataset => {
    const memberships = next.datasetMemberships!.filter(item => item.datasetId === dataset.id && item.datasetVersion === dataset.version)
    if (!memberships.length) return dataset
    const caseIds = [...new Set(memberships.map(item => item.caseId))]
    return {
      ...dataset,
      caseIds,
      sampleCount: caseIds.length,
      population: { ...dataset.population, totalSampleCount: caseIds.length, localCaseCount: caseIds.length, externalSampleCount: 0 }
    }
  })
  return next
}
