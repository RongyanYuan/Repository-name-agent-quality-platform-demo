import type { Evidence, EvaluationBatch, EvaluationJob, EvolutionState, Experiment, EvaluationFinding, ObservationLog, OutcomeEval, ProcessEval, ReleaseVersion, RoutingDelivery, Trace, TraceEvaluationPackage } from './domain'
import { resolveIdentity } from './identity'
import { createLocalDatasetExecutionAdapter, type DatasetExecutionServicePort } from './datasetExecutionServices'
export { createLocalDatasetExecutionAdapter, executeDatasetRun } from './datasetExecutionServices'
export type { DatasetExecutionServicePort, DatasetRunExecutionOptions } from './datasetExecutionServices'

export type ServiceProviderKind = 'LOCAL_MOCK' | 'EXTERNAL'
export interface ServiceResult<T> { provider: ServiceProviderKind; isMock: boolean; label: string; data: T }
export interface TraceRecord { trace: Trace; observations: ObservationLog[]; evidence: Evidence[] }
export type EvaluationRecord = ProcessEval | OutcomeEval
export interface ExperimentStartResult { experimentId: Experiment['id']; status: 'QUEUED' | 'RUNNING' }
export interface GenerationPlanRequest { assetId?: string; skillId?: string; name: string }
export interface GenerationPlanResult { planId: string; assetId?: string; skillId?: string; name: string; status: 'PLANNED'; generationExecuted: false }
export interface ReleasePublishResult { releaseId: ReleaseVersion['id']; status: ReleaseVersion['status'] }
export interface EvaluationBatchServicePort {
  listBatches(): Promise<ServiceResult<EvaluationBatch[]>>
  listTracePackages(batchId?: string): Promise<ServiceResult<TraceEvaluationPackage[]>>
  createEvaluationJob(batchId: string, traceIds?: string[]): Promise<ServiceResult<EvaluationJob>>
}
export interface RoutingServicePort { listFindings(traceId?: string): Promise<ServiceResult<EvaluationFinding[]>>; listDeliveries(traceId?: string): Promise<ServiceResult<RoutingDelivery[]>> }

export interface TraceServicePort { getTrace(traceId: string): Promise<ServiceResult<TraceRecord>> }
export interface EvaluationServicePort { run(caseId: string, evaluationType: 'PROCESS'): Promise<ServiceResult<ProcessEval[]>>; run(caseId: string, evaluationType: 'OUTCOME'): Promise<ServiceResult<OutcomeEval[]>> }
export interface ExperimentServicePort { start(experimentId: string): Promise<ServiceResult<ExperimentStartResult>> }
export interface GenerationPlanningServicePort { plan(request: GenerationPlanRequest): Promise<ServiceResult<GenerationPlanResult>> }
export interface ReleaseServicePort { publish(releaseId: string): Promise<ServiceResult<ReleasePublishResult>> }

export interface EvolutionServiceAdapters {
  trace: TraceServicePort
  evaluation: EvaluationServicePort
  experiment: ExperimentServicePort
  generationPlanning: GenerationPlanningServicePort
  release: ReleaseServicePort
  evaluationBatches?: EvaluationBatchServicePort
  routing?: RoutingServicePort
  datasetExecution?: DatasetExecutionServicePort
}

const mockResult = <T>(label: string, data: T): ServiceResult<T> => ({ provider: 'LOCAL_MOCK', isMock: true, label, data })
const clone = <T>(value: T): T => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T
const requireRecord = <T extends { id: string }>(records: T[], id: string, kind: string): T => {
  const record = records.find((item) => item.id === id)
  if (!record) throw new Error(`${kind} ${id} 不存在于本地 Mock 数据中`)
  return record
}

export function createLocalTraceAdapter(getState: () => EvolutionState): TraceServicePort {
  return { async getTrace(traceId) {
    const state = getState(); const trace = requireRecord(state.traces, resolveIdentity(state, 'trace', traceId), 'Trace')
    const observations = trace.observationIds.map((id) => requireRecord(state.observations, id, 'Observation'))
    const evidenceIds = new Set(observations.flatMap((item) => item.evidenceIds))
    return mockResult('本地 Mock Trace / Langfuse 适配器', clone({ trace, observations, evidence: state.evidence.filter((item) => evidenceIds.has(item.id)) }))
  } }
}

export function createLocalEvaluationAdapter(getState: () => EvolutionState): EvaluationServicePort {
  async function run(caseId: string, evaluationType: 'PROCESS'): Promise<ServiceResult<ProcessEval[]>>
  async function run(caseId: string, evaluationType: 'OUTCOME'): Promise<ServiceResult<OutcomeEval[]>>
  async function run(caseId: string, evaluationType: 'PROCESS' | 'OUTCOME'): Promise<ServiceResult<ProcessEval[] | OutcomeEval[]>> {
    const state = getState(); requireRecord(state.cases, caseId, 'Case')
    const data = evaluationType === 'PROCESS' ? state.processEvals.filter((item) => item.caseId === caseId) : state.outcomeEvals.filter((item) => item.caseId === caseId)
    return mockResult(`本地 Mock ${evaluationType === 'PROCESS' ? '过程' : '结果'} Eval 适配器`, clone(data))
  }
  return { run }
}

export function createLocalExperimentAdapter(getState: () => EvolutionState): ExperimentServicePort {
  return { async start(experimentId) { requireRecord(getState().experiments, experimentId, 'Experiment'); return mockResult('本地 Mock Experiment Runner 适配器', { experimentId, status: 'QUEUED' as const }) } }
}

export function createLocalGenerationPlanningAdapter(getState: () => EvolutionState, idFactory = () => `generation-plan-${Date.now()}`): GenerationPlanningServicePort {
  return { async plan(request) {
    const state = getState()
    if (request.assetId) requireRecord(state.assets, request.assetId, 'Asset')
    if (request.skillId) requireRecord(state.skills, request.skillId, 'Skill')
    return mockResult('本地 Mock 生成规划适配器（生成服务待建设）', { planId: idFactory(), ...request, status: 'PLANNED' as const, generationExecuted: false as const })
  } }
}

export function createLocalReleaseAdapter(getState: () => EvolutionState): ReleaseServicePort {
  return { async publish(releaseId) { requireRecord(getState().releases, releaseId, 'Release'); return mockResult('本地 Mock Release Service 适配器', { releaseId, status: 'PENDING' as const }) } }
}

export function createLocalEvaluationBatchAdapter(getState: () => EvolutionState, idFactory = () => `job-local-${Date.now()}`): EvaluationBatchServicePort {
  return {
    async listBatches() { return mockResult('本地 Mock Evaluation Batch Repository', clone(getState().evaluationBatches)) },
    async listTracePackages(batchId) { return mockResult('本地 Mock Trace Evaluation Ledger Repository', clone(getState().tracePackages.filter((item) => !batchId || item.batchId === batchId))) },
    async createEvaluationJob(batchId, traceIds) {
      const state = getState(); const batch = requireRecord(state.evaluationBatches, batchId, 'EvaluationBatch')
      const canonicalTraceIds = (traceIds?.length ? traceIds : batch.traceIds).map(id => requireRecord(state.traces, resolveIdentity(state, 'trace', id), 'Trace').id)
      const job: EvaluationJob = { id: idFactory(), batchId, attempt: Math.max(0, ...state.evaluationJobs.filter((item) => item.batchId === batchId).map((item) => item.attempt)) + 1, status: 'QUEUED', traceIds: canonicalTraceIds, processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'local-mock-repository' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      return mockResult('本地 Mock Evaluation Job Repository', clone(job))
    }
  }
}

export function createLocalRoutingAdapter(getState: () => EvolutionState): RoutingServicePort {
  return {
    async listFindings(traceId) { const state = getState(); const canonical = traceId ? resolveIdentity(state, 'trace', traceId) : undefined; return mockResult('本地 Mock Evaluation Finding Repository', clone(state.evaluationFindings.filter((item) => !canonical || item.traceId === canonical))) },
    async listDeliveries(traceId) { const state = getState(); const canonical = traceId ? resolveIdentity(state, 'trace', traceId) : undefined; return mockResult('本地 Mock Routing Delivery Repository', clone(state.routingDeliveries.filter((item) => !canonical || item.traceId === canonical))) }
  }
}

export function createLocalEvolutionServices(getState: () => EvolutionState, replacements: Partial<EvolutionServiceAdapters> = {}): EvolutionServiceAdapters {
  return {
    trace: replacements.trace ?? createLocalTraceAdapter(getState),
    evaluation: replacements.evaluation ?? createLocalEvaluationAdapter(getState),
    experiment: replacements.experiment ?? createLocalExperimentAdapter(getState),
    generationPlanning: replacements.generationPlanning ?? createLocalGenerationPlanningAdapter(getState),
    release: replacements.release ?? createLocalReleaseAdapter(getState),
    evaluationBatches: replacements.evaluationBatches ?? createLocalEvaluationBatchAdapter(getState),
    routing: replacements.routing ?? createLocalRoutingAdapter(getState),
    datasetExecution: replacements.datasetExecution ?? createLocalDatasetExecutionAdapter(getState)
  }
}
