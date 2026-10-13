import type { EvolutionState } from '../domain'

export function validateDatasetExecutions(state: EvolutionState): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = []
  const add = (path: string, message: string) => errors.push({ path, message })
  const datasets = new Map(state.datasets.map(item => [item.id, item]))
  const queries = new Map((state.datasetQueries ?? []).map(item => [item.id, item]))
  const runs = new Map((state.datasetExecutionRuns ?? []).map(item => [item.id, item]))
  const cases = new Map(state.cases.map(item => [item.id, item]))
  const traces = new Map(state.traces.map(item => [item.id, item]))
  const sessions = new Set(state.sessions.map(item => item.id))
  const artifacts = new Set(state.artifacts.map(item => item.id))
  const evidence = new Set(state.evidence.map(item => item.id))
  const assets = new Set((state.assetCatalog ?? []).map(item => item.id))
  const versions = new Map((state.assetVersions ?? []).map(item => [item.id, item]))
  const statuses = ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED']
  const validTime = (value?: string) => value === undefined || Number.isFinite(Date.parse(value))
  const assetRef = (item: { assetId?: string; assetVersionId?: string }, path: string) => {
    if (item.assetId && !assets.has(item.assetId)) add(path + '.assetId', '关联资产不存在')
    if (item.assetVersionId && versions.get(item.assetVersionId)?.assetId !== item.assetId) add(path + '.assetVersionId', '固定版本必须属于关联资产')
  }
  if (queries.size !== (state.datasetQueries ?? []).length) add('datasetQueries', '人工 Query ID 不可重复')
  if (runs.size !== (state.datasetExecutionRuns ?? []).length) add('datasetExecutionRuns', '运行批次 ID 不可重复')
  for (const query of state.datasetQueries ?? []) {
    const path = `datasetQueries.${query.id}`
    if (!datasets.has(query.datasetId)) add(path + '.datasetId', '所属数据集不存在')
    if (!query.datasetVersion || !query.query.trim() || !['PPT', 'Word', 'Excel', '生图'].includes(query.verticalScenario)) add(path, '人工 Query 必须包含固定数据集版本、任务内容和支持的产物类型')
    if (!statuses.includes(query.status)) add(path + '.status', '人工 Query 状态无效')
    if (query.latestRunId && !runs.get(query.latestRunId)?.items.some(item => item.input.sourceQueryId === query.id)) add(path + '.latestRunId', '最近运行必须包含当前 Query')
    assetRef(query, path)
  }
  for (const run of state.datasetExecutionRuns ?? []) {
    const path = `datasetExecutionRuns.${run.id}`
    if (!datasets.has(run.datasetId)) add(path + '.datasetId', '运行数据集不存在')
    if (!statuses.includes(run.status) || !['GENERATE_AND_EVALUATE', 'EVALUATE_ONLY'].includes(run.mode)) add(path, '运行状态或模式无效')
    if (run.datasetId !== run.configSnapshot.datasetSnapshot.id || run.datasetVersion !== run.configSnapshot.datasetSnapshot.version) add(path + '.configSnapshot', '运行的数据集身份与固定快照不一致')
    if (!run.items.length || new Set(run.items.map(item => item.id)).size !== run.items.length || JSON.stringify(run.items.map(item => item.input)) !== JSON.stringify(run.configSnapshot.inputs)) add(path + '.items', '运行成员必须唯一并与配置输入快照一致')
    if (!validTime(run.startedAt) || !validTime(run.completedAt)) add(path, '运行时间必须有效')
    assetRef(run.configSnapshot, path + '.configSnapshot')
    for (const item of run.items) {
      const itemPath = `${path}.items.${item.id}`
      if (!statuses.includes(item.status)) add(itemPath + '.status', '运行记录状态无效')
      const input = item.input
      if (!input.query.trim() || !['PPT', 'Word', 'Excel', '生图'].includes(input.verticalScenario)) add(itemPath + '.input', '运行输入必须包含任务与产物类型')
      if (input.sourceQueryId && (!queries.has(input.sourceQueryId) || queries.get(input.sourceQueryId)?.datasetId !== run.datasetId)) add(itemPath + '.input.sourceQueryId', '来源 Query 必须属于对应数据集')
      if (input.sourceTraceId && !traces.has(input.sourceTraceId)) add(itemPath + '.input.sourceTraceId', '来源 Trace 不存在')
      if (input.sourceCaseId && !cases.has(input.sourceCaseId)) add(itemPath + '.input.sourceCaseId', '来源 Case 不存在')
      assetRef(input, itemPath + '.input')
      if (item.traceId && (!traces.has(item.traceId) || traces.get(item.traceId)?.caseId !== item.caseId)) add(itemPath + '.traceId', '执行 Trace 必须属于对应 Case')
      if (item.sessionId && (!sessions.has(item.sessionId) || traces.get(item.traceId ?? '')?.sessionId !== item.sessionId)) add(itemPath + '.sessionId', '执行 Session 必须属于对应 Trace')
      if (item.packageId && !state.tracePackages.some(pkg => pkg.id === item.packageId && pkg.traceId === item.traceId && pkg.caseId === item.caseId)) add(itemPath + '.packageId', '评测包必须属于对应执行')
      item.artifactIds.forEach(id => { if (!artifacts.has(id)) add(itemPath + '.artifactIds', '执行产物不存在') })
      item.evidenceIds.forEach(id => { if (!evidence.has(id)) add(itemPath + '.evidenceIds', '执行 Evidence 不存在') })
      for (const value of [item.processFinal, item.outcomeFinal]) if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 2)) add(itemPath, '评测最终分必须在 0–2 范围')
      if (item.status === 'COMPLETED' && (!item.traceId || !item.caseId || !item.packageId || !item.artifactIds.length || item.processFinal === undefined || item.outcomeFinal === undefined || !item.resultSnapshot)) add(itemPath, '已完成记录必须保留执行身份、产物、评分及结果快照')
      if ((item.status === 'FAILED' || item.status === 'PARTIAL') && !item.errorReason?.trim()) add(itemPath + '.errorReason', '失败或部分失败必须记录原因')
      if (!validTime(item.startedAt) || !validTime(item.completedAt)) add(itemPath, '运行记录时间必须有效')
    }
    if (run.status === 'COMPLETED' && run.items.some(item => item.status !== 'COMPLETED')) add(path + '.status', '已完成批次不能包含未完成记录')
    if (run.status === 'FAILED' && run.items.some(item => item.status !== 'FAILED')) add(path + '.status', '全失败批次只能包含失败记录')
    if (run.status === 'PARTIAL' && !run.items.some(item => item.status === 'FAILED' || item.status === 'PARTIAL')) add(path + '.status', '部分失败批次必须含失败记录')
  }
  return errors
}
