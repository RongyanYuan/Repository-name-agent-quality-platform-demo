import type { DatasetExecutionItem, DatasetExecutionRun, DatasetQueryRecord, EvolutionState } from './domain'
import type { EvolutionActionMeta } from './store'
import { validateDatasetQueryInput } from './data/datasetExecution'

export type DatasetExecutionAction =
  | { type: 'ADD_DATASET_QUERY'; query: DatasetQueryRecord; meta: EvolutionActionMeta }
  | { type: 'CREATE_DATASET_RUN'; run: DatasetExecutionRun; meta: EvolutionActionMeta }
  | { type: 'START_DATASET_RUN'; runId: string; meta: EvolutionActionMeta }
  | { type: 'SET_DATASET_RUN_ITEM_PHASE'; runId: string; itemId: string; phase: 'GENERATING' | 'EVALUATING'; meta: EvolutionActionMeta }
  | { type: 'APPLY_DATASET_RUN_ITEM_RESULT'; runId: string; itemId: string; result: { graph: Partial<EvolutionState>; item: DatasetExecutionItem }; meta: EvolutionActionMeta }
  | { type: 'COMPLETE_DATASET_RUN'; runId: string; meta: EvolutionActionMeta }
  | { type: 'FAIL_DATASET_RUN'; runId: string; error: string; meta: EvolutionActionMeta }

const clone = <T,>(value: T): T => structuredClone(value)
const terminal = (status: DatasetExecutionItem['status']) => ['COMPLETED', 'PARTIAL', 'FAILED'].includes(status)
const appendOnly = <T extends { id: string }>(current: T[], incoming?: T[]) => {
  if (!incoming?.length) return current
  const known = new Set(current.map(item => item.id))
  return [...current, ...incoming.filter(item => !known.has(item.id) && Boolean(known.add(item.id))).map(clone)]
}
const conclusion = (items: DatasetExecutionItem[]): DatasetExecutionRun['status'] => {
  if (items.some(item => !terminal(item.status))) return 'RUNNING'
  if (items.every(item => item.status === 'COMPLETED')) return 'COMPLETED'
  return items.some(item => item.status === 'COMPLETED' || item.status === 'PARTIAL') ? 'PARTIAL' : 'FAILED'
}

/** Original execution and assessment objects are never replaced by a provider replay. */
function mergeResultGraph(state: EvolutionState, run: DatasetExecutionRun, result: { graph: Partial<EvolutionState>; item: DatasetExecutionItem }, at: string): Partial<EvolutionState> {
  const graph = result.graph
  const patch: Partial<EvolutionState> = {
    sessions: appendOnly(state.sessions, graph.sessions), traces: appendOnly(state.traces, graph.traces),
    observations: appendOnly(state.observations, graph.observations), evidence: appendOnly(state.evidence, graph.evidence),
    artifacts: appendOnly(state.artifacts, graph.artifacts), processEvals: appendOnly(state.processEvals, graph.processEvals),
    outcomeEvals: appendOnly(state.outcomeEvals, graph.outcomeEvals), tracePackages: appendOnly(state.tracePackages, graph.tracePackages),
    evaluationJobs: appendOnly(state.evaluationJobs, graph.evaluationJobs)
  }
  const newProcesses = (graph.processEvals ?? []).filter(item => item.caseId === result.item.caseId && item.traceId === result.item.traceId)
  const newOutcomes = (graph.outcomeEvals ?? []).filter(item => item.caseId === result.item.caseId && item.traceId === result.item.traceId)
  const cases = state.cases.map(record => {
    if (record.id !== result.item.caseId) return record
    return { ...record, processEvalIds: [...new Set([...record.processEvalIds, ...newProcesses.map(item => item.id)])], outcomeEvalIds: [...new Set([...record.outcomeEvalIds, ...newOutcomes.map(item => item.id)])], updatedAt: at }
  })
  patch.cases = appendOnly(cases, graph.cases)
  const batch = graph.evaluationBatches?.find(item => item.id === run.evaluationBatchId)
  patch.evaluationBatches = batch
    ? [...state.evaluationBatches.filter(item => item.id !== batch.id), clone(batch)]
    : state.evaluationBatches
  return patch
}

function queryStatuses(state: EvolutionState, run: DatasetExecutionRun, at: string): DatasetQueryRecord[] {
  return (state.datasetQueries ?? []).map(query => {
    if (query.latestRunId !== run.id) return query
    const item = run.items.find(item => item.input.sourceQueryId === query.id)
    return item ? { ...query, status: item.status, updatedAt: at } : query
  })
}

export function datasetExecutionMutation(state: EvolutionState, action: DatasetExecutionAction): Partial<EvolutionState> | undefined {
  const at = action.meta.at ?? new Date().toISOString()
  const runs = state.datasetExecutionRuns ?? []
  if (action.type === 'ADD_DATASET_QUERY') {
    if ((state.datasetQueries ?? []).some(query => query.id === action.query.id)) return undefined
    validateDatasetQueryInput(state, action.query)
    const dataset = state.datasets.find(item => item.id === action.query.datasetId)!
    if (action.query.datasetVersion !== dataset.version) throw new Error('Query 必须属于当前数据集版本')
    if (!action.query.id.trim() || action.query.status !== 'PENDING') throw new Error('新增 Query 必须有唯一 ID 且处于待运行状态')
    return { datasetQueries: [...(state.datasetQueries ?? []), clone({ ...action.query, query: action.query.query.trim() })] }
  }
  if (action.type === 'CREATE_DATASET_RUN') {
    if (runs.some(run => run.id === action.run.id)) return undefined
    const dataset = state.datasets.find(item => item.id === action.run.datasetId)
    const run = action.run
    if (!dataset || dataset.version !== run.datasetVersion || run.configSnapshot.datasetSnapshot.id !== dataset.id || run.configSnapshot.datasetSnapshot.version !== dataset.version) throw new Error('运行快照必须属于当前数据集及固定版本')
    if (runs.some(item => item.datasetId === dataset.id && (item.status === 'PENDING' || item.status === 'RUNNING'))) throw new Error('该数据集已有未完成批次，请继续当前批次或等待其完成')
    if (run.status !== 'PENDING' || !run.items.length || run.items.some(item => item.status !== 'PENDING') || new Set(run.items.map(item => item.id)).size !== run.items.length) throw new Error('批次必须包含唯一的待运行样本')
    if (JSON.stringify(run.items.map(item => item.input)) !== JSON.stringify(run.configSnapshot.inputs)) throw new Error('运行成员必须与输入快照完全一致')
    const stored = clone(run)
    const queryIds = new Set(stored.items.flatMap(item => item.input.sourceQueryId ?? []))
    return { datasetExecutionRuns: [...runs, stored], datasetQueries: (state.datasetQueries ?? []).map(query => queryIds.has(query.id) ? { ...query, status: 'PENDING', latestRunId: stored.id, updatedAt: at } : query) }
  }
  const current = runs.find(run => run.id === action.runId)
  if (!current) throw new Error('运行批次不存在，请刷新后重试')
  if (terminal(current.status)) return undefined
  let run: DatasetExecutionRun
  let graph: Partial<EvolutionState> = {}
  switch (action.type) {
    case 'START_DATASET_RUN':
      if (current.status === 'RUNNING') return undefined
      run = { ...current, status: 'RUNNING', startedAt: current.startedAt ?? at, updatedAt: at }
      break
    case 'SET_DATASET_RUN_ITEM_PHASE': {
      const item = current.items.find(item => item.id === action.itemId)
      if (!item) throw new Error('运行记录不属于当前批次')
      if (terminal(item.status) || (item.status === 'RUNNING' && item.phase === action.phase)) return undefined
      run = { ...current, status: 'RUNNING', startedAt: current.startedAt ?? at, updatedAt: at, items: current.items.map(item => item.id === action.itemId ? { ...item, status: 'RUNNING', phase: action.phase, startedAt: item.startedAt ?? at } : item) }
      break
    }
    case 'APPLY_DATASET_RUN_ITEM_RESULT': {
      const prior = current.items.find(item => item.id === action.itemId)
      if (!prior || action.result.item.id !== prior.id || JSON.stringify(action.result.item.input) !== JSON.stringify(prior.input)) throw new Error('运行结果必须属于对应输入快照')
      if (terminal(prior.status)) return undefined
      if (!terminal(action.result.item.status)) throw new Error('只能保存完成或失败的运行结果')
      for (const value of [action.result.item.processFinal, action.result.item.outcomeFinal]) if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 2)) throw new Error('评测分数必须在 0–2 范围')
      graph = mergeResultGraph(state, current, action.result, at)
      run = { ...current, status: 'RUNNING', updatedAt: at, items: current.items.map(item => item.id === action.itemId ? clone(action.result.item) : item) }
      break
    }
    case 'COMPLETE_DATASET_RUN':
      if (current.items.some(item => !terminal(item.status))) return undefined
      run = { ...current, status: conclusion(current.items), completedAt: at, updatedAt: at, errorReason: current.items.filter(item => item.errorReason).map(item => item.errorReason).join('；') || undefined }
      break
    case 'FAIL_DATASET_RUN': {
      if (!action.error.trim()) throw new Error('运行失败必须记录原因')
      const items = current.items.map(item => terminal(item.status) ? item : { ...item, status: 'FAILED' as const, phase: undefined, errorReason: action.error, completedAt: at })
      run = { ...current, items, status: conclusion(items), completedAt: at, updatedAt: at, errorReason: action.error }
      break
    }
  }
  return { ...graph, datasetExecutionRuns: runs.map(item => item.id === run.id ? run : item), datasetQueries: queryStatuses(state, run, at) }
}
