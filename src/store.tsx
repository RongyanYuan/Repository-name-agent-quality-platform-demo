import { createContext, useContext, useMemo, useReducer, type Dispatch, type PropsWithChildren } from 'react'
import { qualityData } from './data'
import type { CaseRecord, DatasetEntry, EvalStatus, FilterState, JudgeStatus, ProductAcceptanceEventType, ProductValidity, ProcessEfficiency, QualityData, QualityState, RubricEvidence } from './domain'
import { buildBenchmark, defaultFilters } from './selectors'

export type QualityAction =
  | { type: 'SET_FILTERS'; filters: Partial<FilterState> }
  | { type: 'RESET_FILTERS' }
  | { type: 'OVERRIDE_EVAL'; taskId: string; evalId: string; status: EvalStatus; score?: number; rubricEvidence?: RubricEvidence[]; reason: string; by: string }
  | { type: 'OVERRIDE_JUDGE'; taskId: string; evalId: string; status: JudgeStatus; score?: number; rubricEvidence?: RubricEvidence[]; reason: string; by: string }
  | { type: 'REVIEW_ACCEPTANCE_EVENT'; taskId: string; eventId: string; label: ProductAcceptanceEventType; reason: string; by: string }
  | { type: 'UPDATE_ACCEPTANCE_EVENT'; taskId: string; eventId: string; label: ProductAcceptanceEventType; reason: string; by: string }
  | { type: 'OVERRIDE_PRODUCT_VALIDITY'; taskId: string; patch: Partial<ProductValidity>; reason: string; by: string }
  | { type: 'UPDATE_PRODUCT_VALIDITY'; taskId: string; patch: Partial<ProductValidity>; reason: string; by: string }
  | { type: 'REVIEW_PROCESS_EFFICIENCY'; taskId: string; patch: Partial<ProcessEfficiency>; reason: string; by: string }
  | { type: 'UPDATE_PROCESS_EFFICIENCY'; taskId: string; patch: Partial<ProcessEfficiency>; reason: string; by: string }
  | { type: 'UPDATE_CASE'; caseId: string; patch: Partial<CaseRecord> }
  | { type: 'ADD_DATASET_ENTRY'; datasetId: string; entry: DatasetEntry }
  | { type: 'TOGGLE_DATASET_ENTRY'; datasetId: string; entryId: string; enabled: boolean }
  | { type: 'CREATE_DATASET'; dataset: QualityData['datasets'][number] }
  | { type: 'CREATE_BENCHMARK'; input: Parameters<typeof buildBenchmark>[1] }

const cloneData = (): QualityData => ({
  tasks: qualityData.tasks.map((task) => ({
    ...task,
    evals: task.evals.map((evaluation) => ({ ...evaluation, rubricEvidence: evaluation.rubricEvidence?.map((item) => ({ ...item })), humanRubricEvidence: evaluation.humanRubricEvidence?.map((item) => ({ ...item })) })),
    processEvals: task.processEvals.map((evaluation) => ({ ...evaluation, rubricEvidence: evaluation.rubricEvidence?.map((item) => ({ ...item })), humanRubricEvidence: evaluation.humanRubricEvidence?.map((item) => ({ ...item })) })),
    acceptanceEvents: task.acceptanceEvents?.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })),
    productValidity: task.productValidity ? { ...task.productValidity, accuracyBreakdown: task.productValidity.accuracyBreakdown ? { ...task.productValidity.accuracyBreakdown } : undefined, evidenceIds: task.productValidity.evidenceIds ? [...task.productValidity.evidenceIds] : undefined } : undefined,
    processEfficiency: task.processEfficiency ? { ...task.processEfficiency, evidenceIds: task.processEfficiency.evidenceIds ? [...task.processEfficiency.evidenceIds] : undefined } : undefined,
    riskCommercialEvents: task.riskCommercialEvents?.map((event) => ({ ...event }))
  })),
  traces: qualityData.traces.map((trace) => ({ ...trace, observations: trace.observations.map((observation) => ({ ...observation, metadata: { ...observation.metadata }, evidenceIds: [...observation.evidenceIds], rubricEvidence: observation.rubricEvidence?.map((item) => ({ ...item })), judgeResult: observation.judgeResult ? { ...observation.judgeResult, rubricEvidence: observation.judgeResult.rubricEvidence.map((item) => ({ ...item })) } : undefined })) })),
  observations: qualityData.observations.map((observation) => ({ ...observation, metadata: { ...observation.metadata }, evidenceIds: [...observation.evidenceIds], rubricEvidence: observation.rubricEvidence?.map((item) => ({ ...item })), judgeResult: observation.judgeResult ? { ...observation.judgeResult, rubricEvidence: observation.judgeResult.rubricEvidence.map((item) => ({ ...item })) } : undefined })),
  evidence: qualityData.evidence.map((item) => ({ ...item })),
  cases: qualityData.cases.map((record) => ({ ...record })),
  datasets: qualityData.datasets.map((dataset) => ({ ...dataset, entries: dataset.entries.map((entry) => ({ ...entry, capabilityTags: [...entry.capabilityTags], history: entry.history.map((item) => ({ ...item })) })) })),
  benchmarks: qualityData.benchmarks.map((benchmark) => ({ ...benchmark, metrics: benchmark.metrics.map((metric) => ({ ...metric, sourceTaskIds: [...metric.sourceTaskIds] })), caseResults: benchmark.caseResults.map((result) => ({ ...result })) })),
  evalConfigs: qualityData.evalConfigs.map((config) => ({ ...config })),
  updatedAt: qualityData.updatedAt,
  acceptanceEvents: qualityData.acceptanceEvents?.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })),
  productValidities: qualityData.productValidities?.map((item) => ({ ...item, accuracyBreakdown: item.accuracyBreakdown ? { ...item.accuracyBreakdown } : undefined, evidenceIds: item.evidenceIds ? [...item.evidenceIds] : undefined })),
  processEfficiencies: qualityData.processEfficiencies?.map((item) => ({ ...item, evidenceIds: item.evidenceIds ? [...item.evidenceIds] : undefined })),
  rootCauseAttributions: qualityData.rootCauseAttributions?.map((item) => ({ ...item, derivedFailureObservationIds: [...item.derivedFailureObservationIds], evidenceIds: [...item.evidenceIds] })),
  riskCommercialEvents: qualityData.riskCommercialEvents?.map((event) => ({ ...event }))
})

const initialState: QualityState = { ...cloneData(), filters: { ...defaultFilters } }

const nowLabel = () => new Date().toISOString()

const reducer = (state: QualityState, action: QualityAction): QualityState => {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'RESET_FILTERS':
      return { ...state, filters: { ...defaultFilters } }
    case 'OVERRIDE_EVAL': {
      const updatedAt = nowLabel()
      const updateEvaluation = (evaluation: QualityData['tasks'][number]['evals'][number]) => evaluation.id !== action.evalId ? evaluation : { ...evaluation, humanStatus: action.status, humanScore: action.score ?? evaluation.humanScore ?? evaluation.score, humanRubricEvidence: action.rubricEvidence?.map((item) => ({ ...item })), humanReason: action.reason, humanBy: action.by, humanAt: updatedAt }
      const tasks = state.tasks.map((task) => task.id !== action.taskId ? task : {
        ...task,
        evals: task.evals.map(updateEvaluation),
        processEvals: task.processEvals.map(updateEvaluation)
      })
      const cases = state.cases.map((record) => record.taskId !== action.taskId ? record : { ...record, humanStatus: action.status, humanReason: action.reason, updatedAt })
      return { ...state, tasks, cases }
    }
    case 'OVERRIDE_JUDGE': {
      const updatedAt = nowLabel()
      const updateEvaluation = (evaluation: QualityData['tasks'][number]['evals'][number]) => evaluation.id !== action.evalId ? evaluation : {
        ...evaluation,
        humanStatus: action.status,
        humanScore: action.score ?? evaluation.humanScore ?? evaluation.score,
        humanRubricEvidence: action.rubricEvidence?.map((item) => ({ ...item })),
        humanReason: action.reason,
        humanBy: action.by,
        humanAt: updatedAt,
        status: action.status
      }
      const tasks = state.tasks.map((task) => task.id !== action.taskId ? task : { ...task, evals: task.evals.map(updateEvaluation), processEvals: task.processEvals.map(updateEvaluation) })
      const cases = state.cases.map((record) => record.taskId !== action.taskId ? record : { ...record, humanStatus: action.status, humanReason: action.reason, updatedAt })
      return { ...state, tasks, cases, updatedAt }
    }
    case 'REVIEW_ACCEPTANCE_EVENT':
    case 'UPDATE_ACCEPTANCE_EVENT': {
      const updatedAt = nowLabel()
      const patchEvent = (event: NonNullable<QualityData['acceptanceEvents']>[number]) => event.id !== action.eventId ? event : { ...event, humanLabel: action.label, humanReason: action.reason, reviewedBy: action.by, reviewedAt: updatedAt }
      const tasks = state.tasks.map((task) => task.id !== action.taskId ? task : { ...task, acceptanceEvents: task.acceptanceEvents?.map(patchEvent) })
      const events = state.acceptanceEvents?.map(patchEvent)
      return { ...state, tasks, acceptanceEvents: events, updatedAt }
    }
    case 'OVERRIDE_PRODUCT_VALIDITY':
    case 'UPDATE_PRODUCT_VALIDITY': {
      const updatedAt = nowLabel()
      const tasks = state.tasks.map((task) => task.id !== action.taskId ? task : {
        ...task,
        productValidity: task.productValidity ? { ...task.productValidity, automaticQualified: task.productValidity.automaticQualified ?? task.productValidity.qualified, automaticScore: task.productValidity.automaticScore ?? task.productValidity.score, ...action.patch, humanQualified: action.patch.qualified ?? task.productValidity.humanQualified, humanScore: action.patch.score ?? task.productValidity.humanScore, humanOverride: action.patch.humanOverride ?? task.productValidity.humanOverride, humanReason: action.reason, humanBy: action.by, updatedAt } : undefined
      })
      const productValidities = state.productValidities?.map((item) => item.taskId !== action.taskId ? item : { ...item, automaticQualified: item.automaticQualified ?? item.qualified, automaticScore: item.automaticScore ?? item.score, ...action.patch, humanQualified: action.patch.qualified ?? item.humanQualified, humanScore: action.patch.score ?? item.humanScore, humanOverride: action.patch.humanOverride ?? item.humanOverride, humanReason: action.reason, humanBy: action.by, updatedAt })
      return { ...state, tasks, productValidities, updatedAt }
    }
    case 'REVIEW_PROCESS_EFFICIENCY':
    case 'UPDATE_PROCESS_EFFICIENCY': {
      const updatedAt = nowLabel()
      const tasks = state.tasks.map((task) => task.id !== action.taskId ? task : {
        ...task,
        processEfficiency: task.processEfficiency ? { ...task.processEfficiency, automaticTargetMet: task.processEfficiency.automaticTargetMet ?? task.processEfficiency.targetMet, automaticScore: task.processEfficiency.automaticScore ?? task.processEfficiency.score, ...action.patch, humanTargetMet: action.patch.targetMet ?? task.processEfficiency.humanTargetMet, humanScore: action.patch.score ?? task.processEfficiency.humanScore, humanReason: action.reason, humanBy: action.by, humanAt: updatedAt } : undefined
      })
      const processEfficiencies = state.processEfficiencies?.map((item) => item.taskId !== action.taskId ? item : { ...item, automaticTargetMet: item.automaticTargetMet ?? item.targetMet, automaticScore: item.automaticScore ?? item.score, ...action.patch, humanTargetMet: action.patch.targetMet ?? item.humanTargetMet, humanScore: action.patch.score ?? item.humanScore, humanReason: action.reason, humanBy: action.by, humanAt: updatedAt })
      return { ...state, tasks, processEfficiencies, updatedAt }
    }
    case 'UPDATE_CASE':
      return { ...state, cases: state.cases.map((record) => record.id === action.caseId ? { ...record, ...action.patch, updatedAt: nowLabel() } : record) }
    case 'ADD_DATASET_ENTRY':
      return { ...state, datasets: state.datasets.map((dataset) => dataset.id === action.datasetId ? { ...dataset, entries: dataset.entries.some((entry) => entry.id === action.entry.id) ? dataset.entries : [...dataset.entries, action.entry], updatedAt: nowLabel() } : dataset) }
    case 'TOGGLE_DATASET_ENTRY':
      return { ...state, datasets: state.datasets.map((dataset) => dataset.id !== action.datasetId ? dataset : { ...dataset, entries: dataset.entries.map((entry) => entry.id === action.entryId ? { ...entry, enabled: action.enabled } : entry), updatedAt: nowLabel() }) }
    case 'CREATE_DATASET':
      return { ...state, datasets: [...state.datasets, action.dataset] }
    case 'CREATE_BENCHMARK': {
      const run = buildBenchmark(state, action.input)
      return { ...state, benchmarks: [run, ...state.benchmarks] }
    }
    default:
      return state
  }
}

interface QualityContextValue {
  state: QualityState
  dispatch: Dispatch<QualityAction>
}

const QualityContext = createContext<QualityContextValue | null>(null)

export function QualityProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>
}

export function useQuality() {
  const context = useContext(QualityContext)
  if (!context) throw new Error('useQuality must be used inside QualityProvider')
  return context
}

export { initialState, reducer }
