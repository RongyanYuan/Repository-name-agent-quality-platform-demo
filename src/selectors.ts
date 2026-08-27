import {
  BUSINESS_TYPES,
  COMPLEXITIES,
  ENVIRONMENTS,
  ROOT_CAUSES,
  type BenchmarkCaseResult,
  type BenchmarkMetric,
  type BenchmarkRun,
  type CaseRecord,
  type Complexity,
  type Dataset,
  type EvalFamily,
  type EvalResult,
  type FilterState,
  type JudgeStatus,
  type LatencyEfficiencyBand,
  type ProductAcceptanceEvent,
  type ProductAcceptanceEventType,
  type ProductValidity,
  type ProcessEfficiency,
  type QualityData,
  type RootCauseAttribution,
  type RootCause,
  type RiskCommercialEvent,
  type Task,
  type TaskStatus
} from './domain'

export const defaultFilters: FilterState = {
  timeRange: '7d',
  agentVersion: 'All Versions',
  businessType: 'All',
  environment: 'Production',
  search: ''
}

export const effectiveEvalStatus = (evaluation: EvalResult): JudgeStatus => evaluation.humanStatus ?? evaluation.status ?? evaluation.autoStatus

/** Public alias map used by KPI links and legacy deep links. */
export const metricDimensionMap: Record<string, string> = {
  'effective-completion': 'Effective Completion',
  'outcome-type': 'Outcome Type Consistency',
  'intent-consistency': 'Intent Consistency',
  'constraint-satisfaction': 'Constraint Satisfaction',
  accuracy: 'Accuracy',
  'result-usability': 'Result Usability',
  'file-validity': 'File Validity',
  'qualified-product': 'Qualified Product',
  'qualified-product-rate': 'Qualified Product',
  'process-efficiency': 'Process Efficiency',
  'process-efficiency-rate': 'Process Efficiency',
  'process-efficiency-out-of-expectation': 'Process Efficiency Out Of Expectation',
  'inefficient-expected-rate': 'Process Efficiency Out Of Expectation',
  'user-satisfaction': 'User Satisfaction',
  'satisfaction': 'User Satisfaction',
  'latency-efficiency': 'Latency Efficiency',
  'token-cost-efficiency': 'Token / Cost Efficiency',
  'necessary-loop': 'Necessary Loop',
  'skill-tool-selection': 'Skill / Tool Selection',
  'tool-result': 'Tool Result',
  'retry-effectiveness': 'Retry Effectiveness',
  'recovery-success': 'Recovery Success',
  'risk-interception': 'Risk Interception',
  'commercial-interception': 'Commercial Interception',
  'latency-band': 'Latency Efficiency',
  'tool-frequency': 'Tool Frequency',
  'one-shot-success': 'One-shot Success',
  'efficient-task': 'Effective but Inefficient',
  'task-understanding': 'Task Understanding',
  'execution-path': 'Execution Path',
  'skill-selection': 'Skill Selection',
  'tool-selection': 'Tool Selection',
  'context-assembly': 'Context Assembly',
  'memory-use': 'Memory Use',
  'unnecessary-tool-call': 'Unnecessary Tool Call',
  'unnecessary-model-call': 'Unnecessary Model Call',
  'redundant-loop': 'Redundant Loop'
}

export const getTaskById = (data: QualityData, taskId?: string) => data.tasks.find((task) => task.id === taskId)

export const getTraceByTask = (data: QualityData, taskId?: string) => {
  const task = getTaskById(data, taskId)
  return data.traces.find((trace) => trace.id === task?.traceId)
}

/**
 * Return the first local failure.  Propagated failures are intentionally
 * skipped when a normalized v2 attribution is available.
 */
export const getFirstFailure = (data: QualityData, task: Task) => {
  const trace = data.traces.find((candidate) => candidate.id === task.traceId)
  return trace?.observations
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .find((observation) => {
      const status = observation.judgeStatus ?? observation.status
      return status === 'FAIL' && !observation.derived
    }) ?? trace?.observations
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .find((observation) => (observation.judgeStatus ?? observation.status) === 'FAIL')
}

/** Derive and normalize first-failure attribution for imported or v1 data. */
export const getFirstFailureAttribution = (data: QualityData, taskOrId: Task | string): RootCauseAttribution => {
  const task = typeof taskOrId === 'string' ? getTaskById(data, taskOrId) : taskOrId
  if (!task) return { taskId: typeof taskOrId === 'string' ? taskOrId : '', traceId: '', firstFailureNode: null, rootCause: 'None', isRootCause: false, derivedFailureObservationIds: [], evidenceIds: [] }
  if (task.rootCauseAttribution) return task.rootCauseAttribution
  const trace = getTraceByTask(data, task.id)
  const ordered = [...(trace?.observations ?? [])].sort((a, b) => a.sequence - b.sequence)
  const first = ordered.find((observation) => (observation.judgeStatus ?? observation.status) === 'FAIL' && !observation.derived)
  const derived = first ? ordered.filter((observation) => observation.sequence > first.sequence && ((observation.judgeStatus ?? observation.status) === 'DERIVED_FAIL' || observation.derived || observation.status === 'FAIL')).map((observation) => observation.id) : []
  return {
    taskId: task.id,
    traceId: task.traceId,
    firstFailureNode: first?.nodeType ?? null,
    firstFailureObservationId: first?.id,
    rootCause: first?.rootCause ?? task.rootCause,
    isRootCause: Boolean(first),
    derivedFailureObservationIds: derived,
    derivedFrom: first?.rootCause,
    derivedFromObservationId: first?.id,
    evidenceIds: first?.evidenceIds ?? []
  }
}

export interface AcceptanceSignals {
  firstAccept: boolean
  finalAccept: boolean
  repeatCorrection: boolean
  negativeFeedback: boolean
  accepted: boolean
  sourceEventIds: string[]
}

const eventsForTask = (data: QualityData, task: Task): ProductAcceptanceEvent[] => {
  const events = task.acceptanceEvents ?? data.acceptanceEvents?.filter((event) => event.taskId === task.id) ?? []
  return [...events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.timestamp.localeCompare(b.timestamp))
}

/** Convert the ordered event stream into the four PRD behavior signals. */
export const getAcceptanceSignals = (data: QualityData, task: Task): AcceptanceSignals => {
  const events = eventsForTask(data, task)
  const firstAcceptanceIndex = events.findIndex((event) => ['download', 'copy', 'like', 'accept'].includes(event.type))
  const negativeFeedback = events.some((event) => event.type === 'dislike')
  const correctionEvents = events.filter((event) => event.type === 'correction' && !event.isNewRequirement)
  const repeatCorrection = correctionEvents.length > 1
  const hasNewRequirement = events.some((event) => event.type === 'new_requirement' || event.isNewRequirement)
  const finalAcceptanceIndex = [...events].reverse().findIndex((event) => ['download', 'copy', 'like', 'accept'].includes(event.type))
  const finalAccepted = finalAcceptanceIndex >= 0
  const firstAccepted = firstAcceptanceIndex >= 0 && !events.slice(0, firstAcceptanceIndex).some((event) => event.type === 'correction' || event.type === 'regeneration')
  return {
    firstAccept: firstAccepted && !hasNewRequirement && !repeatCorrection,
    finalAccept: finalAccepted && !negativeFeedback,
    repeatCorrection,
    negativeFeedback,
    accepted: Boolean(task.productValidity?.qualified && finalAccepted && !negativeFeedback),
    sourceEventIds: events.filter((event) => ['download', 'copy', 'like', 'accept', 'dislike', 'correction', 'new_requirement'].includes(event.type)).map((event) => event.id)
  }
}

const roundRate = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0
const trendFor = (value: number, seed = 0) => Array.from({ length: 7 }, (_, point) => Math.max(0, Math.round((value + Math.sin(point + seed) * 1.8 + point * 0.12) * 10) / 10))

export interface SatisfactionSignalMetric {
  id: 'first_accept' | 'final_accept' | 'repeat_correction' | 'negative_feedback'
  label: string
  count: number
  rate: number
  sourceTaskIds: string[]
  sourceEventIds: string[]
}

export interface UserSatisfactionMetrics {
  id: 'user-satisfaction'
  label: '用户满意度'
  value: number
  rate: number
  acceptedQualifiedProducts: number
  allProducts: number
  denominator: number
  numerator: number
  firstAccept: number
  finalAccept: number
  repeatCorrection: number
  negativeFeedback: number
  signals: SatisfactionSignalMetric[]
  trend: number[]
  sourceTaskIds: string[]
}

/** North-star metric: accepted qualified products divided by all products. */
export const getUserSatisfactionMetrics = (data: QualityData, filters: FilterState): UserSatisfactionMetrics => {
  const tasks = filterTasks(data, filters)
  const rows = tasks.map((task) => ({ task, signals: getAcceptanceSignals(data, task) }))
  const acceptedQualifiedProducts = rows.filter(({ task, signals }) => Boolean((task.productValidity?.qualified ?? task.status !== 'Failed') && signals.accepted)).length
  const firstAcceptRows = rows.filter(({ signals }) => signals.firstAccept)
  const finalAcceptRows = rows.filter(({ signals }) => signals.finalAccept)
  const repeatRows = rows.filter(({ signals }) => signals.repeatCorrection)
  const negativeRows = rows.filter(({ signals }) => signals.negativeFeedback)
  const makeSignal = (id: SatisfactionSignalMetric['id'], label: string, selected: typeof rows) => ({
    id,
    label,
    count: selected.length,
    rate: roundRate(selected.length, tasks.length),
    sourceTaskIds: selected.map(({ task }) => task.id),
    sourceEventIds: selected.flatMap(({ signals }) => signals.sourceEventIds)
  })
  return {
    id: 'user-satisfaction',
    label: '用户满意度',
    value: roundRate(acceptedQualifiedProducts, tasks.length),
    rate: roundRate(acceptedQualifiedProducts, tasks.length),
    acceptedQualifiedProducts,
    allProducts: tasks.length,
    denominator: tasks.length,
    numerator: acceptedQualifiedProducts,
    firstAccept: firstAcceptRows.length,
    finalAccept: finalAcceptRows.length,
    repeatCorrection: repeatRows.length,
    negativeFeedback: negativeRows.length,
    signals: [
      makeSignal('first_accept', '首轮接受', firstAcceptRows),
      makeSignal('final_accept', '最终接受', finalAcceptRows),
      makeSignal('repeat_correction', '持续重复纠错', repeatRows),
      makeSignal('negative_feedback', '明确负反馈', negativeRows)
    ],
    trend: trendFor(roundRate(acceptedQualifiedProducts, tasks.length), 1),
    sourceTaskIds: tasks.map((task) => task.id)
  }
}

export const getUserSatisfaction = getUserSatisfactionMetrics

export interface QualifiedProductChildMetric {
  id: string
  label: string
  dimension: string
  value: number
  rate: number
  pass: number
  fail: number
  unknown: number
  sourceTaskIds: string[]
  trend: number[]
}

export interface QualifiedProductMetrics {
  id: 'qualified-product'
  label: '合格产物率'
  value: number
  rate: number
  qualifiedProducts: number
  allProducts: number
  denominator: number
  numerator: number
  pass: number
  fail: number
  children: QualifiedProductChildMetric[]
  metrics: QualifiedProductChildMetric[]
  trend: number[]
  sourceTaskIds: string[]
}

const validityForTask = (task: Task): ProductValidity | undefined => task.productValidity

/** Product qualification is the conjunction of the five hard result gates. */
export const getQualifiedProductMetrics = (data: QualityData, filters: FilterState): QualifiedProductMetrics => {
  const tasks = filterTasks(data, filters)
  const dimensions: Array<{ id: string; label: string; key: keyof ProductValidity; legacy?: keyof ProductValidity }> = [
    { id: 'outcome-type', label: '结果类型一致性', key: 'outcomeType' },
    { id: 'intent-consistency', label: '意图一致性', key: 'intentConsistency' },
    { id: 'constraint-satisfaction', label: '约束满足', key: 'constraintSatisfaction' },
    { id: 'accuracy', label: '准确性', key: 'accuracy' },
    { id: 'file-validity', label: '文件有效性', key: 'fileValidity', legacy: 'resultUsability' }
  ]
  const statusFor = (task: Task, key: keyof ProductValidity, legacy?: keyof ProductValidity): JudgeStatus => {
    const validity = validityForTask(task)
    const direct = validity?.[key]
    if (typeof direct === 'string') return direct as JudgeStatus
    if (legacy && typeof validity?.[legacy] === 'string') return validity[legacy] as JudgeStatus
    const legacyDimension = key === 'fileValidity' ? 'Result Usability' : key === 'outcomeType' ? 'Outcome Type Consistency' : key === 'intentConsistency' ? 'Intent Consistency' : key === 'constraintSatisfaction' ? 'Constraint Satisfaction' : 'Accuracy'
    return task.evals.find((evaluation) => evaluation.dimension === legacyDimension)?.autoStatus ?? 'UNKNOWN'
  }
  const children = dimensions.map((dimension, index) => {
    const statuses = tasks.map((task) => statusFor(task, dimension.key, dimension.legacy))
    const pass = statuses.filter((status) => status === 'PASS').length
    const fail = statuses.filter((status) => status === 'FAIL' || status === 'DERIVED_FAIL').length
    const unknown = statuses.filter((status) => status === 'UNKNOWN' || status === 'N/A').length
    return { id: dimension.id, label: dimension.label, dimension: dimension.key, value: roundRate(pass, tasks.length), rate: roundRate(pass, tasks.length), pass, fail, unknown, sourceTaskIds: tasks.filter((task) => statusFor(task, dimension.key, dimension.legacy) !== 'PASS').map((task) => task.id), trend: trendFor(roundRate(pass, tasks.length), index) }
  })
  const qualifiedTasks = tasks.filter((task) => {
    const validity = validityForTask(task)
    if (validity) return validity.qualified && dimensions.every((dimension) => statusFor(task, dimension.key, dimension.legacy) === 'PASS')
    return dimensions.every((dimension) => statusFor(task, dimension.key, dimension.legacy) === 'PASS')
  })
  const value = roundRate(qualifiedTasks.length, tasks.length)
  return { id: 'qualified-product', label: '合格产物率', value, rate: value, qualifiedProducts: qualifiedTasks.length, allProducts: tasks.length, denominator: tasks.length, numerator: qualifiedTasks.length, pass: qualifiedTasks.length, fail: Math.max(0, tasks.length - qualifiedTasks.length), children, metrics: children, trend: trendFor(value, 3), sourceTaskIds: tasks.map((task) => task.id) }
}

export const getQualifiedProductRate = getQualifiedProductMetrics

export type QualifiedProductLayerId = 'office' | 'other'

export interface QualifiedProductLayerMetric {
  id: QualifiedProductLayerId
  label: 'Office 产物' | '其他产物'
  evaluator: string
  productTypes: string[]
  allProducts: number
  qualifiedProducts: number
  qualifiedRate: number
  averageScore: number | null
  passCount: number
  failCount: number
  unknownCount: number
  reasons: Array<{ label: string; count: number }>
  sourceTaskIds: string[]
  trend: number[]
}

const OFFICE_BUSINESS_TYPES = new Set(['PPT', 'Excel', 'Word'])

/** Layer qualified-product results by the evaluator coverage defined in the PRD. */
export const getQualifiedProductLayers = (data: QualityData, filters: FilterState): QualifiedProductLayerMetric[] => {
  const tasks = filterTasks(data, filters)
  const definitions: Array<{ id: QualifiedProductLayerId; label: QualifiedProductLayerMetric['label']; evaluator: string; productTypes: string[]; matches: (task: Task) => boolean }> = [
    { id: 'office', label: 'Office 产物', evaluator: 'Office Eval Agent', productTypes: ['PPT', 'Excel', 'Word'], matches: (task) => OFFICE_BUSINESS_TYPES.has(task.businessType) },
    { id: 'other', label: '其他产物', evaluator: '通用规则评测', productTypes: ['Coding', 'General'], matches: (task) => !OFFICE_BUSINESS_TYPES.has(task.businessType) }
  ]
  return definitions.map((definition, index) => {
    const scoped = tasks.filter(definition.matches)
    const validity = scoped.map((task) => task.productValidity)
    const qualified = scoped.filter((task) => task.productValidity?.qualified === true || (!task.productValidity && task.status !== 'Failed'))
    const scores = validity.map((item) => item?.score).filter((score): score is number => typeof score === 'number')
    const reasonMap = new Map<string, number>()
    scoped.forEach((task) => {
      const item = task.productValidity
      if (item?.qualified) return
      const failedDimensions = [
        ['交付类型偏差', item?.outcomeType],
        ['用户意图偏差', item?.intentConsistency],
        ['约束缺失', item?.constraintSatisfaction],
        ['准确性异常', item?.accuracy],
        ['文件有效性异常', item?.fileValidity ?? item?.resultUsability]
      ].filter(([, status]) => status !== 'PASS' && status !== undefined).map(([label]) => label as string)
      ;(failedDimensions.length ? failedDimensions : [item?.reason ?? '缺少结果评测证据']).forEach((reason) => reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1))
    })
    const unknownCount = scoped.filter((task) => !task.productValidity || [task.productValidity.outcomeType, task.productValidity.intentConsistency, task.productValidity.constraintSatisfaction, task.productValidity.accuracy, task.productValidity.fileValidity].some((status) => status === 'UNKNOWN' || status === 'N/A')).length
    const qualifiedRate = roundRate(qualified.length, scoped.length)
    return {
      id: definition.id,
      label: definition.label,
      evaluator: definition.evaluator,
      productTypes: definition.productTypes,
      allProducts: scoped.length,
      qualifiedProducts: qualified.length,
      qualifiedRate,
      averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : null,
      passCount: qualified.length,
      failCount: Math.max(0, scoped.length - qualified.length),
      unknownCount,
      reasons: [...reasonMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 4),
      sourceTaskIds: scoped.map((task) => task.id),
      trend: trendFor(qualifiedRate, index + 11)
    }
  })
}

export interface ProcessEfficiencyChildMetric {
  id: string
  label: string
  value: number
  rate: number
  pass: number
  fail: number
  unknown: number
  sourceTaskIds: string[]
  trend: number[]
}

export interface ProcessEfficiencyMetrics {
  id: 'process-efficiency'
  label: '过程效率达标率'
  value: number
  rate: number
  targetMetProducts: number
  allProducts: number
  denominator: number
  numerator: number
  unknownProducts: number
  children: ProcessEfficiencyChildMetric[]
  metrics: ProcessEfficiencyChildMetric[]
  trend: number[]
  sourceTaskIds: string[]
}

const processForTask = (data: QualityData, task: Task): ProcessEfficiency | undefined => task.processEfficiency ?? data.processEfficiencies?.find((item) => item.taskId === task.id)

/** Process efficiency is independent from product qualification. */
export const getProcessEfficiencyMetrics = (data: QualityData, filters: FilterState): ProcessEfficiencyMetrics => {
  const tasks = filterTasks(data, filters)
  const rows = tasks.map((task) => processForTask(data, task))
  const targetMetProducts = rows.filter((item) => item?.targetMet === true).length
  const unknownProducts = rows.filter((item) => item?.targetMet === null || item === undefined).length
  const definitions: Array<[string, string, (item: ProcessEfficiency) => JudgeStatus]> = [
    ['latency-efficiency', '时延效率', (item) => item.totalLatencyEfficiency],
    ['token-cost-efficiency', 'Token / 成本效率', (item) => item.tokenEfficiency === 'PASS' && item.costEfficiency === 'PASS' ? 'PASS' : item.tokenEfficiency === 'UNKNOWN' || item.costEfficiency === 'UNKNOWN' ? 'UNKNOWN' : 'FAIL'],
    ['necessary-loop', '必要 Loop', (item) => item.necessaryLoop],
    ['skill-tool-selection', 'Skill / Tool 选择', (item) => item.skillToolSelection],
    ['tool-result', 'Tool 结果', (item) => item.toolResult],
    ['retry-effectiveness', 'Retry 有效率', (item) => item.retryEffectiveness],
    ['recovery-success', 'Recovery 成功率', (item) => item.recoverySuccess]
  ]
  const children = definitions.map(([id, label, getter], index) => {
    const statuses = rows.map((item) => item ? getter(item) : 'UNKNOWN' as JudgeStatus)
    const pass = statuses.filter((status) => status === 'PASS').length
    const fail = statuses.filter((status) => status === 'FAIL' || status === 'DERIVED_FAIL').length
    const unknown = statuses.filter((status) => status === 'UNKNOWN' || status === 'N/A').length
    return { id, label, value: roundRate(pass, tasks.length), rate: roundRate(pass, tasks.length), pass, fail, unknown, sourceTaskIds: tasks.filter((task, taskIndex) => statuses[taskIndex] !== 'PASS').map((task) => task.id), trend: trendFor(roundRate(pass, tasks.length), index + 5) }
  })
  const value = roundRate(targetMetProducts, tasks.length)
  return { id: 'process-efficiency', label: '过程效率达标率', value, rate: value, targetMetProducts, allProducts: tasks.length, denominator: tasks.length, numerator: targetMetProducts, unknownProducts, children, metrics: children, trend: trendFor(value, 6), sourceTaskIds: tasks.map((task) => task.id) }
}

export const getProcessEfficiencyRate = getProcessEfficiencyMetrics

export interface InefficientExpectedRate {
  id: 'process-efficiency-out-of-expectation'
  label: '过程效率不符业务预期率'
  value: number
  rate: number
  processOutOfExpectationProducts: number
  allProducts: number
  denominator: number
  numerator: number
  sourceTaskIds: string[]
  trend: number[]
}

/** The denominator is deliberately all products, including failed products. */
export const getInefficientExpectedRate = (data: QualityData, filters: FilterState): InefficientExpectedRate => {
  const tasks = filterTasks(data, filters)
  const rows = tasks.map((task) => processForTask(data, task))
  const out = tasks.filter((_, index) => rows[index]?.outOfExpectation === true)
  const value = roundRate(out.length, tasks.length)
  return { id: 'process-efficiency-out-of-expectation', label: '过程效率不符业务预期率', value, rate: value, processOutOfExpectationProducts: out.length, allProducts: tasks.length, denominator: tasks.length, numerator: out.length, sourceTaskIds: out.map((task) => task.id), trend: trendFor(value, 8) }
}

export const getProcessEfficiencyOutOfExpectationRate = getInefficientExpectedRate

const matchesSearch = (task: Task, search: string) => {
  if (!search.trim()) return true
  const query = search.trim().toLowerCase()
  return [task.id, task.traceId, task.sessionId, task.query].some((value) => value.toLowerCase().includes(query))
}

export const filterTasks = (data: QualityData, filters: FilterState): Task[] => data.tasks.filter((task) => {
  const resultFail = task.evals.some((evaluation) => effectiveEvalStatus(evaluation) === 'FAIL')
  const matchesStatus = !filters.status || filters.status === task.status || filters.status === (resultFail ? 'FAIL' : 'PASS')
  const matchesVersion = filters.agentVersion === 'All Versions' || task.agentVersion === filters.agentVersion
  const matchesBusiness = filters.businessType === 'All' || task.businessType === filters.businessType
  const matchesEnvironment = task.environment === filters.environment
  const matchesOutcome = !filters.outcomeType || task.outcomeType === filters.outcomeType
  const matchesComplexity = !filters.complexity || task.complexity === filters.complexity
  const matchesRootCause = !filters.rootCause || task.rootCause === filters.rootCause
  const matchesSkill = !filters.skill || task.skill === filters.skill
  const matchesBadcase = !filters.badcase || (filters.badcase === 'yes' ? task.isBadcase : !task.isBadcase)
  const matchesGolden = !filters.golden || (filters.golden === 'yes' ? task.isGolden : !task.isGolden)
  const metricDimension = filters.metric ? metricDimensionMap[filters.metric] ?? filters.metric : undefined
  const validity = task.productValidity
  const process = task.processEfficiency
  const acceptance = getAcceptanceSignals(data, task)
  const matchesMetric = !metricDimension || (
    metricDimension === 'Effective Completion' ? task.status === 'Failed' :
      metricDimension === 'Effective but Inefficient' ? task.status === 'Effective but Inefficient' :
        metricDimension === 'Qualified Product' ? validity?.qualified === false :
          metricDimension === 'Process Efficiency' ? process?.targetMet === false :
            metricDimension === 'Process Efficiency Out Of Expectation' ? process?.outOfExpectation === true :
              metricDimension === 'User Satisfaction' ? acceptance.accepted === false :
            metricDimension === 'File Validity' ? (validity?.fileValidity ?? validity?.resultUsability) !== 'PASS' :
              metricDimension === 'Latency Efficiency' ? process?.totalLatencyEfficiency === 'FAIL' :
                metricDimension === 'Token / Cost Efficiency' ? process?.tokenEfficiency === 'FAIL' || process?.costEfficiency === 'FAIL' :
                  metricDimension === 'Necessary Loop' ? process?.necessaryLoop === 'FAIL' :
                    metricDimension === 'Skill / Tool Selection' ? process?.skillToolSelection === 'FAIL' :
                      metricDimension === 'Tool Result' ? process?.toolResult === 'FAIL' :
                        metricDimension === 'Retry Effectiveness' ? process?.retryEffectiveness === 'FAIL' :
              metricDimension === 'Recovery Success' ? process?.recoverySuccess === 'FAIL' :
                metricDimension === 'Risk Interception' ? Boolean(task.riskCommercialEvents?.some((event) => event.type === 'risk_interception' && event.blocked)) :
                  metricDimension === 'Commercial Interception' ? Boolean(task.riskCommercialEvents?.some((event) => event.type === 'commercial_interception' && event.blocked)) :
                    metricDimension === 'Tool Frequency' ? task.toolCalls > 0 :
                      metricDimension === 'One-shot Success' ? task.performance?.oneShotToolSuccess === false :
              task.evals.concat(task.processEvals).some((evaluation) => {
                    const evaluationDimension = metricDimension === 'Result Usability' ? 'Result Usability' : metricDimension
                    return evaluation.dimension === evaluationDimension && effectiveEvalStatus(evaluation) === 'FAIL'
                  })
  )
  const matchesTool = !filters.anomalyTool || data.traces.some((trace) => trace.id === task.traceId && trace.observations.some((observation) => observation.tool === filters.anomalyTool))
  const matchesAcceptance = !filters.acceptanceSignal || (
    filters.acceptanceSignal === 'first_accept' ? acceptance.firstAccept :
      filters.acceptanceSignal === 'final_accept' ? acceptance.finalAccept :
        filters.acceptanceSignal === 'repeat_correction' ? acceptance.repeatCorrection :
          filters.acceptanceSignal === 'negative_feedback' ? acceptance.negativeFeedback :
            eventsForTask(data, task).some((event) => event.type === filters.acceptanceSignal)
  )
  const matchesValidity = !filters.validity || (validity ? [validity.outcomeType, validity.intentConsistency, validity.constraintSatisfaction, validity.accuracy, validity.fileValidity].includes(filters.validity) : false)
  const matchesProcess = !filters.processStatus || (filters.processStatus === 'out_of_expectation' ? process?.outOfExpectation === true : [process?.totalLatencyEfficiency, process?.tokenEfficiency, process?.costEfficiency, process?.necessaryLoop, process?.skillToolSelection, process?.toolResult, process?.retryEffectiveness, process?.recoverySuccess].includes(filters.processStatus))
  return matchesStatus && matchesVersion && matchesBusiness && matchesEnvironment && matchesOutcome && matchesComplexity && matchesRootCause && matchesSkill && matchesBadcase && matchesGolden && matchesMetric && matchesTool && matchesAcceptance && matchesValidity && matchesProcess && matchesSearch(task, filters.search)
})

export interface KpiMetric {
  id: string
  label: string
  value: number
  delta: number
  trend: number[]
  pass: number
  fail: number
  description: string
}

const rate = (tasks: Task[], predicate: (task: Task) => boolean) => tasks.length ? Math.round((tasks.filter(predicate).length / tasks.length) * 1000) / 10 : 0

export const getOverviewKpis = (data: QualityData, filters: FilterState): KpiMetric[] => {
  const tasks = filterTasks(data, filters)
  const resultRate = (dimension: string, predicate: (evaluation: EvalResult) => boolean) => rate(tasks, (task) => {
    const evaluation = task.evals.find((candidate) => candidate.dimension === dimension)
    return Boolean(evaluation && predicate(evaluation))
  })
  const definitions: Array<[string, string, number, string]> = [
    ['effective-completion', '有效任务完成率', rate(tasks, (task) => task.status !== 'Failed'), '任务最终交付并可用'],
    ['outcome-type', '结果类型一致率', resultRate('Outcome Type Consistency', (evaluation) => effectiveEvalStatus(evaluation) === 'PASS'), '交付类型与用户意图一致'],
    ['intent-consistency', '意图一致率', resultRate('Intent Consistency', (evaluation) => effectiveEvalStatus(evaluation) === 'PASS'), '最终结果满足用户真实意图'],
    ['constraint-satisfaction', '约束满足率', resultRate('Constraint Satisfaction', (evaluation) => effectiveEvalStatus(evaluation) === 'PASS'), '显式约束被完整遵守'],
    ['accuracy', '准确率', resultRate('Accuracy', (evaluation) => effectiveEvalStatus(evaluation) === 'PASS'), '事实与计算结果通过校验'],
    ['result-usability', '结果可用率', resultRate('Result Usability', (evaluation) => effectiveEvalStatus(evaluation) === 'PASS'), '产物可直接被用户采用'],
    ['efficient-task', '有效但低效任务率', rate(tasks, (task) => task.status === 'Effective but Inefficient'), '结果有效但执行成本偏高']
  ]
  return definitions.map(([id, label, value, description], index) => {
    const fail = tasks.filter((task) => {
      if (id === 'effective-completion') return task.status === 'Failed'
      if (id === 'efficient-task') return task.status === 'Effective but Inefficient'
      const dimension = task.evals.find((evaluation) => evaluation.dimension === ({
        'outcome-type': 'Outcome Type Consistency',
        'intent-consistency': 'Intent Consistency',
        'constraint-satisfaction': 'Constraint Satisfaction',
        accuracy: 'Accuracy',
        'result-usability': 'Result Usability'
      } as Record<string, string>)[id])
      return dimension ? effectiveEvalStatus(dimension) === 'FAIL' : false
    }).length
    const pass = Math.max(tasks.length - fail, 0)
    return {
      id,
      label,
      value,
      delta: [1.8, 0.9, 1.6, -0.7, 2.1, 1.2, -1.4][index],
      trend: Array.from({ length: 7 }, (_, point) => Math.max(0, value + Math.sin(point + index) * 2.2 + point * 0.22)),
      pass,
      fail,
      description
    }
  })
}

export interface ProcessMetric {
  id: string
  label: string
  value: number
  delta: number
  anomaly: boolean
  series: number[]
  sourceTaskIds: string[]
}

const processMetricMap: Record<string, string> = {
  'Task Understanding': 'Task Understanding',
  'Execution Path': 'Execution Path',
  'Skill Selection': 'Skill Selection',
  'Tool Selection': 'Tool Selection',
  'Context Assembly': 'Context Assembly',
  'Memory Use': 'Memory Use',
  'Unnecessary Tool Call': 'Unnecessary Tool Call',
  'Unnecessary Model Call': 'Unnecessary Model Call',
  'Redundant Loop': 'Redundant Loop',
  'Retry Effectiveness': 'Retry Effectiveness',
  'Recovery Success': 'Recovery Success'
}

export const getProcessMetrics = (data: QualityData, filters: FilterState): ProcessMetric[] => {
  const tasks = filterTasks(data, filters)
  return Object.keys(processMetricMap).map((label, index) => {
    const relevant = tasks.flatMap((task) => task.processEvals.filter((evaluation) => evaluation.dimension === label))
    const value = relevant.length ? Math.round((relevant.filter((evaluation) => effectiveEvalStatus(evaluation) === 'PASS').length / relevant.length) * 1000) / 10 : 0
    const sourceTaskIds = relevant.map((evaluation) => evaluation.taskId)
    return {
      id: label.toLowerCase().replace(/[^a-z]+/g, '-'),
      label,
      value,
      delta: [2.2, 1.1, -0.4, 3.7, 1.8, -2.4, -1.2, 0.8, -0.8, 2.4, 3.1][index],
      anomaly: value < 82 || label === 'Memory Use',
      series: Array.from({ length: 7 }, (_, point) => Math.max(0, value + Math.cos(point + index) * 3 + point * 0.15)),
      sourceTaskIds
    }
  })
}

export interface RootCauseMetric {
  rootCause: RootCause
  count: number
  percent: number
  sourceTaskIds: string[]
}

export const getRootCauseMetrics = (data: QualityData, filters: FilterState): RootCauseMetric[] => {
  const tasks = filterTasks(data, filters)
  const attributed = tasks.map((task) => ({ task, attribution: getFirstFailureAttribution(data, task) })).filter(({ attribution }) => attribution.rootCause !== 'None' && attribution.firstFailureNode !== null)
  const total = attributed.length || 1
  return ROOT_CAUSES.filter((rootCause) => rootCause !== 'None').map((rootCause) => {
    const sourceTaskIds = attributed.filter(({ attribution }) => attribution.rootCause === rootCause).map(({ task }) => task.id)
    return { rootCause, count: sourceTaskIds.length, percent: Math.round((sourceTaskIds.length / total) * 100), sourceTaskIds }
  }).filter((metric) => metric.count > 0).sort((a, b) => b.count - a.count)
}

export interface ModuleDiagnostic {
  nodeType: string
  status: JudgeStatus
  count: number
  percent: number
  sourceTaskIds: string[]
  sourceObservationIds: string[]
  rootCauseCount: number
  derivedCount: number
  stateCounts: Record<JudgeStatus, number>
  firstFailureCount: number
  evidenceCoverage: { observed: number; total: number; rate: number }
}

/** Aggregate local five-state observations without treating final outcome as a proxy. */
export const getModuleDiagnostics = (data: QualityData, filters: FilterState): ModuleDiagnostic[] => {
  const tasks = filterTasks(data, filters)
  const nodes = ['Task Understanding', 'Planning / Decision', 'Context Assembly', 'Memory', 'Skill Routing', 'Skill', 'Tool', 'Loop / Retry', 'Recovery']
  const denominator = tasks.length || 1
  return nodes.map((nodeType) => {
    const rows = tasks.flatMap((task) => {
      const trace = getTraceByTask(data, task.id)
      return (trace?.observations ?? []).filter((observation) => observation.nodeType === nodeType).map((observation) => ({ task, observation }))
    })
    const statusCounts = new Map<JudgeStatus, number>()
    rows.forEach(({ observation }) => {
      const status = observation.judgeStatus ?? observation.judgeResult?.status ?? (observation.derived ? 'DERIVED_FAIL' : observation.status)
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
    })
    const stateCounts: Record<JudgeStatus, number> = { PASS: 0, FAIL: 0, DERIVED_FAIL: 0, UNKNOWN: 0, 'N/A': 0 }
    statusCounts.forEach((count, state) => { stateCounts[state] = count })
    const status: JudgeStatus = rows.length === 0 ? 'N/A' : [...statusCounts.entries()].sort((a, b) => {
      const rank: Record<JudgeStatus, number> = { FAIL: 5, DERIVED_FAIL: 4, UNKNOWN: 3, PASS: 2, 'N/A': 1 }
      return rank[b[0]] - rank[a[0]]
    })[0]?.[0] ?? 'UNKNOWN'
    const selected = rows.filter(({ observation }) => (observation.judgeStatus ?? observation.judgeResult?.status ?? (observation.derived ? 'DERIVED_FAIL' : observation.status)) === status)
    const firstFailureCount = rows.filter(({ task, observation }) => getFirstFailureAttribution(data, task).firstFailureObservationId === observation.id).length
    const observed = rows.filter(({ observation }) => observation.input.trim() || observation.output.trim() || observation.evidenceIds.length > 0).length
    return {
      nodeType,
      status,
      count: rows.length,
      percent: Math.round((rows.length / denominator) * 100),
      sourceTaskIds: [...new Set(selected.map(({ task }) => task.id))],
      sourceObservationIds: selected.map(({ observation }) => observation.id),
      rootCauseCount: rows.filter(({ observation }) => observation.isRootCause || observation.judgeResult?.isRootCause).length,
      derivedCount: rows.filter(({ observation }) => observation.derived || observation.judgeStatus === 'DERIVED_FAIL' || observation.judgeResult?.status === 'DERIVED_FAIL').length,
      stateCounts,
      firstFailureCount,
      evidenceCoverage: { observed, total: rows.length, rate: rows.length ? Math.round((observed / rows.length) * 100) : 0 }
    }
  })
}

export interface LatencyBandMetric {
  band: LatencyEfficiencyBand
  count: number
  rate: number
  sourceTaskIds: string[]
}

export interface PerformanceMetrics {
  taskCount: number
  latencyBands: LatencyBandMetric[]
  totalLatencyEfficiency: { value: number; rate: number; status: JudgeStatus; sourceTaskIds: string[] }
  ttft: { value: number | null; status: JudgeStatus; averageMs: number | null; sourceTaskIds: string[] }
  throughput: { tokensPerSecond: number; sourceTaskIds: string[] }
  tokens: { input: number; output: number; total: number; sourceTaskIds: string[] }
  cache: { hits: number; misses: number; hitRate: number; sourceTaskIds: string[] }
  toolFrequency: { calls: number; perTask: number; perSecond: number; sourceTaskIds: string[] }
  oneShotSuccess: { successes: number; eligible: number; rate: number; sourceTaskIds: string[] }
  cost: { evaluatedProducts: number; total: number; average: number; deviation: number | null; sourceTaskIds: string[] }
  risk: { blocked: number; rate: number; reasons: Record<string, number>; sourceTaskIds: string[] }
  commercial: { blocked: number; rate: number; reasons: Record<string, number>; sourceTaskIds: string[] }
}

const performanceForTask = (task: Task): Task['performance'] => task.performance

/** Raw runtime and risk signals used by the Performance page. */
export const getPerformanceMetrics = (data: QualityData, filters: FilterState): PerformanceMetrics => {
  const tasks = filterTasks(data, filters)
  const performance = tasks.map((task) => performanceForTask(task))
  const byBand = new Map<LatencyEfficiencyBand, string[]>()
  tasks.forEach((task) => {
    const band = task.processEfficiency?.latencyBand ?? 'UNKNOWN'
    const ids = byBand.get(band) ?? []
    ids.push(task.id)
    byBand.set(band, ids)
  })
  const orderedBands: LatencyEfficiencyBand[] = ['<=1', '1-1.5', '1.5-2', '>2', 'UNKNOWN']
  const latencyBands = orderedBands.map((band) => ({ band, count: byBand.get(band)?.length ?? 0, rate: roundRate(byBand.get(band)?.length ?? 0, tasks.length), sourceTaskIds: byBand.get(band) ?? [] }))
  const targetRows = tasks.filter((task) => task.processEfficiency?.targetMet !== null && task.processEfficiency?.targetMet !== undefined)
  const targetPass = targetRows.filter((task) => task.processEfficiency?.targetMet === true)
  const ttftRows = tasks.filter((task) => performanceForTask(task)?.ttftMs !== undefined)
  const ttftValues = ttftRows.map((task) => performanceForTask(task)?.ttftMs ?? 0)
  const allInput = performance.reduce((sum, item) => sum + (item?.inputTokens ?? 0), 0)
  const allOutput = performance.reduce((sum, item) => sum + (item?.outputTokens ?? 0), 0)
  const allTokens = allInput + allOutput
  const totalLatencyMs = tasks.reduce((sum, task) => sum + (performanceForTask(task)?.actualLatencyMs ?? task.latency), 0)
  const cacheRows = performance.filter((item) => item?.cacheHit !== undefined)
  const cacheHits = cacheRows.filter((item) => item?.cacheHit).length
  const toolEligible = tasks.filter((task) => (performanceForTask(task)?.oneShotToolSuccess ?? task.toolCalls > 0) !== null && task.toolCalls > 0)
  const oneShotTasks = toolEligible.filter((task) => performanceForTask(task)?.oneShotToolSuccess === true || (performanceForTask(task)?.oneShotToolSuccess === undefined && task.retryCount === 0 && task.toolCalls > 0))
  const successfulProducts = tasks.filter((task) => task.productValidity?.qualified === true || (task.productValidity === undefined && task.status !== 'Failed'))
  const totalCost = successfulProducts.reduce((sum, task) => sum + task.cost, 0)
  const costDeviations = successfulProducts.map((task) => performanceForTask(task)?.costDeviation).filter((item): item is number => item !== undefined)
  const taskIds = new Set(tasks.map((task) => task.id))
  const events = (data.riskCommercialEvents ?? tasks.flatMap((task) => task.riskCommercialEvents ?? [])).filter((event) => taskIds.has(event.taskId))
  const riskEvents = events.filter((event) => event.type === 'risk_interception' && event.blocked)
  const commercialEvents = events.filter((event) => event.type === 'commercial_interception' && event.blocked)
  const reasonCounts = (items: RiskCommercialEvent[]) => items.reduce<Record<string, number>>((result, item) => { result[item.reason] = (result[item.reason] ?? 0) + 1; return result }, {})
  return {
    taskCount: tasks.length,
    latencyBands,
    totalLatencyEfficiency: { value: roundRate(targetPass.length, targetRows.length), rate: roundRate(targetPass.length, targetRows.length), status: targetRows.length ? targetPass.length === targetRows.length ? 'PASS' : 'FAIL' : 'UNKNOWN', sourceTaskIds: targetRows.map((task) => task.id) },
    ttft: { value: ttftValues.length ? Math.round(ttftValues.reduce((sum, value) => sum + value, 0) / ttftValues.length) : null, status: ttftValues.length ? 'PASS' : 'UNKNOWN', averageMs: ttftValues.length ? Math.round(ttftValues.reduce((sum, value) => sum + value, 0) / ttftValues.length) : null, sourceTaskIds: ttftRows.map((task) => task.id) },
    throughput: { tokensPerSecond: totalLatencyMs ? Math.round((allTokens / (totalLatencyMs / 1000)) * 10) / 10 : 0, sourceTaskIds: tasks.map((task) => task.id) },
    tokens: { input: allInput, output: allOutput, total: allTokens, sourceTaskIds: tasks.map((task) => task.id) },
    cache: { hits: cacheHits, misses: Math.max(0, cacheRows.length - cacheHits), hitRate: roundRate(cacheHits, cacheRows.length), sourceTaskIds: tasks.filter((task) => performanceForTask(task)?.cacheHit !== undefined).map((task) => task.id) },
    toolFrequency: { calls: tasks.reduce((sum, task) => sum + task.toolCalls, 0), perTask: tasks.length ? Math.round((tasks.reduce((sum, task) => sum + task.toolCalls, 0) / tasks.length) * 100) / 100 : 0, perSecond: totalLatencyMs ? Math.round((tasks.reduce((sum, task) => sum + task.toolCalls, 0) / (totalLatencyMs / 1000)) * 100) / 100 : 0, sourceTaskIds: tasks.filter((task) => task.toolCalls > 0).map((task) => task.id) },
    oneShotSuccess: { successes: oneShotTasks.length, eligible: toolEligible.length, rate: roundRate(oneShotTasks.length, toolEligible.length), sourceTaskIds: toolEligible.map((task) => task.id) },
    cost: { evaluatedProducts: successfulProducts.length, total: Number(totalCost.toFixed(3)), average: successfulProducts.length ? Number((totalCost / successfulProducts.length).toFixed(3)) : 0, deviation: costDeviations.length ? Math.round((costDeviations.reduce((sum, value) => sum + value, 0) / costDeviations.length) * 10) / 10 : null, sourceTaskIds: successfulProducts.map((task) => task.id) },
    risk: { blocked: riskEvents.length, rate: roundRate(riskEvents.length, tasks.length), reasons: reasonCounts(riskEvents), sourceTaskIds: [...new Set(riskEvents.map((event) => event.taskId))] },
    commercial: { blocked: commercialEvents.length, rate: roundRate(commercialEvents.length, tasks.length), reasons: reasonCounts(commercialEvents), sourceTaskIds: [...new Set(commercialEvents.map((event) => event.taskId))] }
  }
}

export const getPerformanceSummary = getPerformanceMetrics
export const getLatencyEfficiencyBands = (data: QualityData, filters: FilterState) => getPerformanceMetrics(data, filters).latencyBands

export interface ToolMetric {
  tool: string
  calls: number
  success: number
  failed: number
  failureRate: number
  p50: number
  p95: number
  baseline7: number
  baseline14: number
  deviation: number
  warning: boolean
  anomalyCount: number
  topErrors: string[]
  highestLatencyTaskId?: string
}

export const getToolMetrics = (data: QualityData, filters: FilterState): ToolMetric[] => {
  const tasks = filterTasks(data, filters)
  return Array.from(new Set(data.observations.map((observation) => observation.tool).filter(Boolean) as string[])).map((tool, index) => {
    const observations = data.observations.filter((observation) => observation.tool === tool && tasks.some((task) => task.traceId === observation.traceId))
    const latencies = observations.map((observation) => observation.latency).sort((a, b) => a - b)
    const failed = observations.filter((observation) => observation.status === 'FAIL').length
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0
    const p95 = latencies.length ? latencies[Math.max(0, Math.floor(latencies.length * 0.95) - 1)] : 0
    const baseline7 = 900 + (index * 145)
    const baseline14 = 1020 + (index * 122)
    const deviation = p95 ? Math.round(((p95 - baseline7) / baseline7) * 100) : 0
    const relatedTasks = tasks.filter((task) => data.traces.some((trace) => trace.taskId === task.id && trace.observations.some((observation) => observation.tool === tool)))
    const highest = relatedTasks.slice().sort((a, b) => b.latency - a.latency)[0]
    return {
      tool,
      calls: observations.length,
      success: observations.length - failed,
      failed,
      failureRate: observations.length ? Math.round((failed / observations.length) * 1000) / 10 : 0,
      p50,
      p95,
      baseline7,
      baseline14,
      deviation,
      warning: deviation > 35 || tool === 'slides.render',
      anomalyCount: Math.max(1, Math.round(observations.length / 3)),
      topErrors: [`${tool} timeout`, 'payload validation', 'upstream 5xx'],
      highestLatencyTaskId: highest?.id
    }
  })
}

export interface ModelMetric {
  model: string
  calls: number
  tokens: number
  latency: number
  failures: number
  timeouts: number
  unnecessaryRate: number
}

export const getModelMetrics = (data: QualityData, filters: FilterState): ModelMetric[] => {
  const tasks = filterTasks(data, filters)
  return modelsFromData(data).map((model) => {
    const modelObservations = data.observations.filter((observation) => observation.model === model && tasks.some((task) => task.traceId === observation.traceId))
    const taskCalls = tasks.filter((task) => data.traces.some((trace) => trace.taskId === task.id && trace.observations.some((observation) => observation.model === model)))
    return {
      model,
      calls: modelObservations.length,
      tokens: modelObservations.reduce((sum, observation) => sum + (observation.tokenUsage ?? 0), 0),
      latency: modelObservations.length ? Math.round(modelObservations.reduce((sum, observation) => sum + observation.latency, 0) / modelObservations.length) : 0,
      failures: modelObservations.filter((observation) => observation.status === 'FAIL').length,
      timeouts: modelObservations.filter((observation) => observation.error?.includes('timeout')).length,
      unnecessaryRate: taskCalls.length ? Math.round((taskCalls.filter((task) => task.modelCalls > 4).length / taskCalls.length) * 1000) / 10 : 0
    }
  })
}

const modelsFromData = (data: QualityData) => Array.from(new Set(data.observations.map((observation) => observation.model).filter(Boolean) as string[]))

export const getCasesForTasks = (data: QualityData, tasks: Task[]) => data.cases.filter((record) => tasks.some((task) => task.id === record.taskId))

export const getDatasetById = (data: QualityData, id?: string) => data.datasets.find((dataset) => dataset.id === id)

export const getBenchmarkById = (data: QualityData, id?: string) => data.benchmarks.find((benchmark) => benchmark.id === id)

export const getBenchmarkBuckets = (run?: BenchmarkRun) => {
  const buckets: Record<BenchmarkCaseResult['bucket'], BenchmarkCaseResult[]> = {
    'Improved Cases': [],
    'Regressed Cases': [],
    'Unchanged Failed Cases': [],
    'Newly Failed Cases': []
  }
  run?.caseResults.forEach((result) => buckets[result.bucket].push(result))
  return buckets
}

export const familyColor = (family: EvalFamily) => family === 'Result Eval' ? 'blue' : family === 'Process Eval' ? 'violet' : 'orange'

export const serializeFilters = (filters: FilterState) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'All Versions' && value !== 'All') params.set(key, String(value))
  })
  return params.toString()
}

export const parseFilters = (search: string): FilterState => {
  const params = new URLSearchParams(search)
  const result: FilterState = { ...defaultFilters }
  const timeRange = params.get('timeRange') as FilterState['timeRange'] | null
  const businessType = params.get('businessType') as FilterState['businessType'] | null
  const environment = params.get('environment') as FilterState['environment'] | null
  if (timeRange && ['24h', '7d', '14d', '30d'].includes(timeRange)) result.timeRange = timeRange
  if (businessType && (BUSINESS_TYPES as readonly string[]).includes(businessType)) result.businessType = businessType as FilterState['businessType']
  if (environment && (ENVIRONMENTS as readonly string[]).includes(environment)) result.environment = environment as FilterState['environment']
  for (const key of ['agentVersion', 'search', 'status', 'outcomeType', 'complexity', 'rootCause', 'skill', 'badcase', 'golden', 'metric', 'anomalyTool', 'anomalyWindow', 'acceptanceSignal', 'validity', 'processStatus', 'benchmarkId'] as const) {
    const value = params.get(key)
    if (value) (result as unknown as Record<string, unknown>)[key] = value
  }
  return result
}

export const formatPercent = (value: number) => `${value.toFixed(value % 1 ? 1 : 0)}%`
export const formatDuration = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`
export const formatCurrency = (value: number) => `$${value.toFixed(3)}`

export const getScopeLabel = (filters: FilterState) => `${filters.environment} · ${filters.businessType === 'All' ? 'All business' : filters.businessType} · ${filters.agentVersion === 'All Versions' ? 'All versions' : filters.agentVersion}`

export const getPercentile = (values: number[], percentile: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))]
}

export const buildBenchmark = (data: QualityData, input: { datasetId: string; versionA: string; versionB: string; environment: 'Production' | 'Staging'; rubricVersion: string; id: string }): BenchmarkRun => {
  const dataset = getDatasetById(data, input.datasetId)
  const entries = dataset?.entries.filter((entry) => entry.enabled) ?? []
  const sourceTasks = data.tasks.filter((task) => entries.some((entry) => entry.taskId === task.id))
  const metrics: BenchmarkMetric[] = [
    ['completion', '有效任务完成率', 'Result Eval', sourceTasks.filter((task) => task.status !== 'Failed').length],
    ['intent', '意图一致率', 'Result Eval', sourceTasks.filter((task) => task.evals.find((evaluation) => evaluation.dimension === 'Intent Consistency' && evaluation.autoStatus === 'PASS')).length],
    ['context', 'Context 有效率', 'Process Eval', sourceTasks.filter((task) => task.processEvals.find((evaluation) => evaluation.dimension === 'Context Assembly' && evaluation.autoStatus === 'PASS')).length],
    ['memory', 'Memory 有效率', 'Process Eval', sourceTasks.filter((task) => task.processEvals.find((evaluation) => evaluation.dimension === 'Memory Use' && evaluation.autoStatus === 'PASS')).length]
  ].map(([id, label, family, count], index) => {
    const valueA = sourceTasks.length ? Math.round((Number(count) / sourceTasks.length) * 100) : 0
    const valueB = Math.min(100, valueA + 3 + (index % 3))
    return { id: String(id), label: String(label), family: family as EvalFamily, unit: 'percent', versionA: valueA, versionB: valueB, delta: valueB - valueA, sourceTaskIds: sourceTasks.map((task) => task.id) }
  })
  const latencyA = getPercentile(sourceTasks.map((task) => task.latency), 0.95)
  metrics.push({ id: 'latency', label: 'P95 Latency', family: 'Performance Metric', unit: 'duration', versionA: latencyA, versionB: Math.max(500, latencyA - 430), delta: latencyA ? Math.round(((latencyA - Math.max(500, latencyA - 430)) / latencyA) * -1000) / 10 : 0, sourceTaskIds: sourceTasks.map((task) => task.id) })
  const caseResults: BenchmarkCaseResult[] = sourceTasks.map((task, index) => {
    const bucket: BenchmarkCaseResult['bucket'] = index % 4 === 0 ? 'Improved Cases' : index % 4 === 1 ? 'Regressed Cases' : index % 4 === 2 ? 'Unchanged Failed Cases' : 'Newly Failed Cases'
    return { id: `${input.id}-${task.id}`, taskId: task.id, bucket, reason: `Deterministic mock comparison for ${task.id}`, traceAId: task.traceId, traceBId: task.traceId }
  })
  const createdAt = new Date().toISOString()
  return { id: input.id, datasetId: input.datasetId, datasetVersion: dataset?.version ?? 'unknown', versionA: input.versionA, versionB: input.versionB, environment: input.environment, rubricVersion: input.rubricVersion, status: 'Completed', createdAt, completedAt: createdAt, metrics, caseResults }
}
