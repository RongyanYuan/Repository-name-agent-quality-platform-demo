import type { DatasetExecutionItem, DatasetExecutionRun, EvolutionState } from './domain'
import type { EvolutionAction } from './store'
import type { ServiceResult, ServiceProviderKind } from './services'
import { materializeDatasetExecutionItem, type MaterializedDatasetExecutionItem } from './data/datasetExecution'

export interface DatasetExecutionServicePort {
  readonly provider: ServiceProviderKind
  executeItem(run: DatasetExecutionRun, item: DatasetExecutionItem, onPhase: (phase: 'GENERATING' | 'EVALUATING') => Promise<void>): Promise<ServiceResult<MaterializedDatasetExecutionItem>>
}

export function createLocalDatasetExecutionAdapter(getState: () => EvolutionState, options: { delayMs?: number; now?: () => string } = {}): DatasetExecutionServicePort {
  const pause = () => options.delayMs === 0 ? Promise.resolve() : new Promise<void>(resolve => setTimeout(resolve, options.delayMs ?? 65))
  return {
    provider: 'LOCAL_MOCK',
    async executeItem(run, item, onPhase) {
      if (run.mode === 'GENERATE_AND_EVALUATE') { await onPhase('GENERATING'); await pause() }
      await onPhase('EVALUATING'); await pause()
      const state = getState()
      const current = state.datasetExecutionRuns?.find(candidate => candidate.id === run.id) ?? run
      const input = current.items.find(candidate => candidate.id === item.id) ?? item
      return { provider: 'LOCAL_MOCK', isMock: true, label: '本地 Mock 生成与 Eval Agent', data: materializeDatasetExecutionItem(state, current, input, options.now?.() ?? new Date().toISOString()) }
    }
  }
}

const active = new Map<string, Promise<void>>()
const terminal = (status: DatasetExecutionItem['status']) => ['COMPLETED', 'PARTIAL', 'FAILED'].includes(status)

export interface DatasetRunExecutionOptions {
  run: DatasetExecutionRun
  commit: (action: EvolutionAction) => Promise<void>
  getState: () => EvolutionState
  adapter?: DatasetExecutionServicePort
}

/** Every phase is committed before execution advances; completed items are
 * skipped on resume and replay never replaces earlier batches or source data. */
export function executeDatasetRun(options: DatasetRunExecutionOptions): Promise<void> {
  const alreadyRunning = active.get(options.run.id)
  if (alreadyRunning) return alreadyRunning
  const task = performDatasetRun(options).finally(() => active.delete(options.run.id))
  active.set(options.run.id, task)
  return task
}

async function performDatasetRun({ run, commit, getState, adapter = createLocalDatasetExecutionAdapter(getState) }: DatasetRunExecutionOptions): Promise<void> {
  const persisted = getState().datasetExecutionRuns?.find(candidate => candidate.id === run.id)
  if (!persisted) throw new Error('运行批次尚未保存，请先创建批次')
  if (terminal(persisted.status)) return
  const meta = (reason: string) => ({ actor: run.createdBy, reason, at: new Date().toISOString() })
  await commit({ type: 'START_DATASET_RUN', runId: run.id, meta: meta('开始或继续数据集执行') })
  for (const planned of persisted.items) {
    const current = getState().datasetExecutionRuns?.find(candidate => candidate.id === run.id)
    const item = current?.items.find(candidate => candidate.id === planned.id)
    if (!current || !item || terminal(item.status)) continue
    let result: MaterializedDatasetExecutionItem
    try {
      const response = await adapter.executeItem(current, item, phase => commit({ type: 'SET_DATASET_RUN_ITEM_PHASE', runId: run.id, itemId: item.id, phase, meta: meta(phase === 'GENERATING' ? '生成任务结果' : '评测过程与产物') }))
      result = response.data
    } catch (error) {
      const liveItem = getState().datasetExecutionRuns?.find(candidate => candidate.id === run.id)?.items.find(candidate => candidate.id === item.id) ?? item
      result = { graph: {}, item: { ...liveItem, status: 'FAILED', phase: undefined, caseId: run.mode === 'EVALUATE_ONLY' ? item.input.sourceCaseId : undefined, traceId: run.mode === 'EVALUATE_ONLY' ? item.input.sourceTraceId : undefined, errorReason: error instanceof Error ? error.message : '执行服务未完成本条任务', completedAt: new Date().toISOString() } }
    }
    await commit({ type: 'APPLY_DATASET_RUN_ITEM_RESULT', runId: run.id, itemId: item.id, result, meta: meta('保存任务结果与评测快照') })
  }
  await commit({ type: 'COMPLETE_DATASET_RUN', runId: run.id, meta: meta('汇总批次运行状态；准出结论独立留存') })
}
