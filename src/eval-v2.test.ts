import { describe, expect, it } from 'vitest'
import { qualityData } from './data'
import { JUDGE_STATUSES, PRODUCT_ACCEPTANCE_EVENT_TYPES } from './domain'
import {
  defaultFilters,
  filterTasks,
  getAcceptanceSignals,
  getFirstFailureAttribution,
  getInefficientExpectedRate,
  getModuleDiagnostics,
  getPerformanceMetrics,
  getProcessEfficiencyMetrics,
  getQualifiedProductMetrics,
  getRootCauseMetrics,
  getUserSatisfactionMetrics,
  metricDimensionMap,
  parseFilters,
  serializeFilters
} from './selectors'
import { initialState, reducer } from './store'

describe('Office Agent eval v2 fixtures', () => {
  it('covers every acceptance event and every judge has a bounded score', () => {
    expect(new Set(qualityData.acceptanceEvents?.map((event) => event.type))).toEqual(new Set(PRODUCT_ACCEPTANCE_EVENT_TYPES))
    qualityData.tasks.forEach((task) => {
      task.evals.concat(task.processEvals).forEach((evaluation) => {
        expect(JUDGE_STATUSES).toContain(evaluation.autoStatus)
        expect(evaluation.score).toBeGreaterThanOrEqual(0)
        expect(evaluation.score).toBeLessThanOrEqual(1)
        expect(evaluation.rubricEvidence?.length).toBeGreaterThan(0)
      })
    })
    qualityData.observations.forEach((observation) => {
      expect(JUDGE_STATUSES).toContain(observation.judgeStatus)
      expect(observation.score).toBeGreaterThanOrEqual(0)
      expect(observation.score).toBeLessThanOrEqual(1)
    })
  })

  it('keeps Memory as the only first failure and treats Context as full-assembly evidence', () => {
    const task = qualityData.tasks.find((item) => item.id === 'task-001')!
    const trace = qualityData.traces.find((item) => item.id === task.traceId)!
    const memory = trace.observations.find((item) => item.nodeType === 'Memory')!
    const context = trace.observations.find((item) => item.nodeType === 'Context Assembly')!
    const attribution = getFirstFailureAttribution(qualityData, task)

    expect(memory.judgeStatus).toBe('FAIL')
    expect(memory.isRootCause).toBe(true)
    expect(memory.metadata).toMatchObject({ query_requirement: '面向管理层', memory_value: '面向普通员工' })
    expect(context.judgeStatus).toBe('N/A')
    expect(context.derivedFrom).toBeUndefined()
    expect(context.derivedFromObservationId).toBeUndefined()
    expect(context.isRootCause).toBe(false)
    expect(attribution).toMatchObject({ firstFailureNode: 'Memory', rootCause: 'Memory', firstFailureObservationId: memory.id })
    expect(trace.observations.filter((item) => item.isRootCause)).toHaveLength(1)
  })

  it('represents missing latency and TTFT as UNKNOWN and absent modules as N/A', () => {
    const task = qualityData.tasks.find((item) => item.id === 'task-001')!
    expect(task.performance?.expectedLatencyMs).toBeUndefined()
    expect(task.performance?.ttftMs).toBeUndefined()
    expect(task.processEfficiency).toMatchObject({ latencyBand: 'UNKNOWN', totalLatencyEfficiency: 'UNKNOWN', targetMet: null })

    const taskScope = { ...defaultFilters, search: task.id }
    expect(getPerformanceMetrics(qualityData, taskScope).ttft.status).toBe('UNKNOWN')
    expect(getModuleDiagnostics(qualityData, taskScope).find((item) => item.nodeType === 'Recovery')?.status).toBe('N/A')
  })
})

describe('Office Agent eval v2 selectors', () => {
  it('uses the active all-product scope for every composite denominator', () => {
    const tasks = filterTasks(qualityData, defaultFilters)
    const satisfaction = getUserSatisfactionMetrics(qualityData, defaultFilters)
    const qualified = getQualifiedProductMetrics(qualityData, defaultFilters)
    const process = getProcessEfficiencyMetrics(qualityData, defaultFilters)
    const inefficient = getInefficientExpectedRate(qualityData, defaultFilters)

    expect(satisfaction.denominator).toBe(tasks.length)
    expect(qualified.denominator).toBe(tasks.length)
    expect(process.denominator).toBe(tasks.length)
    expect(inefficient.denominator).toBe(tasks.length)
    expect(inefficient.numerator).toBe(tasks.filter((task) => task.processEfficiency?.outOfExpectation).length)
    expect(inefficient.value).toBe(Math.round((inefficient.numerator / inefficient.denominator) * 1000) / 10)
    expect(satisfaction.signals.every((signal) => signal.sourceTaskIds.length === signal.count)).toBe(true)
  })

  it('counts only accepted products that are both qualified and process-effective', () => {
    const tasks = filterTasks(qualityData, defaultFilters)
    const expectedValidAccepted = tasks.filter((task) => task.productValidity?.qualified === true && task.processEfficiency?.targetMet === true && getAcceptanceSignals(qualityData, task).accepted)
    const satisfaction = getUserSatisfactionMetrics(qualityData, defaultFilters)
    expect(satisfaction.numerator).toBe(expectedValidAccepted.length)
    expect(satisfaction.acceptedQualifiedProducts).toBe(expectedValidAccepted.length)
  })

  it('counts each first non-derived root once and preserves old metric aliases', () => {
    const roots = getRootCauseMetrics(qualityData, defaultFilters)
    const expectedRootTasks = filterTasks(qualityData, defaultFilters).filter((task) => getFirstFailureAttribution(qualityData, task).rootCause !== 'None')
    expect(roots.reduce((sum, metric) => sum + metric.count, 0)).toBe(expectedRootTasks.length)
    expect(roots.every((metric) => new Set(metric.sourceTaskIds).size === metric.count)).toBe(true)
    expect(metricDimensionMap['result-usability']).toBe('Result Usability')
    expect(metricDimensionMap['file-validity']).toBe('File Validity')
    const oldLinkTasks = filterTasks(qualityData, { ...defaultFilters, metric: 'result-usability' })
    const newLinkTasks = filterTasks(qualityData, { ...defaultFilters, metric: 'file-validity' })
    expect(new Set(newLinkTasks.map((task) => task.id))).toEqual(new Set(oldLinkTasks.map((task) => task.id)))
  })

  it('treats Context as full-assembly evidence instead of a standalone evaluation metric', () => {
    const diagnostics = getModuleDiagnostics(qualityData, defaultFilters)
    expect(diagnostics.some((item) => item.nodeType === 'Context Assembly')).toBe(false)
    const task = qualityData.tasks.find((item) => item.id === 'task-002')!
    const trace = qualityData.traces.find((item) => item.id === task.traceId)!
    const context = trace.observations.find((item) => item.nodeType === 'Context Assembly')!
    expect(context.judgeStatus).toBe('N/A')
    expect(context.reason).toMatch(/full Context|not evaluated/i)
    expect(task.evals.some((item) => item.reason?.includes('Context evidence'))).toBe(true)
  })

  it('returns raw performance signals and evaluates cost only for qualified products', () => {
    const performance = getPerformanceMetrics(qualityData, defaultFilters)
    const tasks = filterTasks(qualityData, defaultFilters)
    const qualified = tasks.filter((task) => task.productValidity?.qualified)
    const expectedOneShot = tasks.filter((task) => task.toolCalls > 0 && task.retryCount === 0 && task.performance?.oneShotToolSuccess === true)

    expect(performance.latencyBands.reduce((sum, band) => sum + band.count, 0)).toBe(tasks.length)
    expect(performance.cost.evaluatedProducts).toBe(qualified.length)
    expect(performance.cost.sourceTaskIds.every((taskId) => qualityData.tasks.find((task) => task.id === taskId)?.productValidity?.qualified)).toBe(true)
    expect(performance.oneShotSuccess.successes).toBe(expectedOneShot.length)
    expect(performance.tokens.total).toBe(performance.tokens.input + performance.tokens.output)
    expect(performance.cache.hitRate).toBeGreaterThanOrEqual(0)
  })

  it('round-trips v2 URL filters', () => {
    const filters = { ...defaultFilters, acceptanceSignal: 'negative_feedback' as const, validity: 'FAIL' as const, processStatus: 'out_of_expectation' as const, benchmarkId: 'benchmark-2026-08-24', interceptionReason: 'Potentially sensitive content detected' }
    expect(parseFilters(`?${serializeFilters(filters)}`)).toMatchObject(filters)
  })

  it('drills TTFT and interception reason signals to the matching tasks', () => {
    const ttftTasks = filterTasks(qualityData, { ...defaultFilters, metric: 'ttft-efficiency' })
    expect(ttftTasks.every((task) => task.performance?.ttftMs !== undefined && task.performance.expectedTtftMs !== undefined && task.performance.ttftMs / task.performance.expectedTtftMs > 1.5)).toBe(true)
    const reason = qualityData.riskCommercialEvents?.[0]?.reason
    expect(reason).toBeTruthy()
    const reasonTasks = filterTasks(qualityData, { ...defaultFilters, interceptionReason: reason })
    expect(reasonTasks.length).toBeGreaterThan(0)
    expect(reasonTasks.every((task) => task.riskCommercialEvents?.some((event) => event.reason === reason))).toBe(true)
  })
})

describe('Office Agent eval v2 reducer audit trail', () => {
  it('retains automatic judge, event, validity and process values on review', () => {
    const task = initialState.tasks.find((item) => item.id === 'task-001')!
    const evaluation = task.evals[0]
    const event = task.acceptanceEvents![0]
    const judgeState = reducer(initialState, { type: 'OVERRIDE_JUDGE', taskId: task.id, evalId: evaluation.id, status: 'UNKNOWN', score: 0.5, reason: 'Evidence incomplete.', by: 'QA' })
    const updatedEval = judgeState.tasks.find((item) => item.id === task.id)!.evals[0]
    expect(updatedEval.autoStatus).toBe(evaluation.autoStatus)
    expect(updatedEval).toMatchObject({ humanStatus: 'UNKNOWN', humanScore: 0.5, humanReason: 'Evidence incomplete.', humanBy: 'QA' })

    const eventState = reducer(initialState, { type: 'UPDATE_ACCEPTANCE_EVENT', taskId: task.id, eventId: event.id, label: 'copy', reason: 'Reviewer reclassified signal.', by: 'QA' })
    const updatedEvent = eventState.tasks.find((item) => item.id === task.id)!.acceptanceEvents![0]
    expect(updatedEvent.type).toBe(event.type)
    expect(updatedEvent).toMatchObject({ humanLabel: 'copy', humanReason: 'Reviewer reclassified signal.', reviewedBy: 'QA' })

    const validityState = reducer(initialState, { type: 'UPDATE_PRODUCT_VALIDITY', taskId: task.id, patch: { qualified: true, score: 0.88 }, reason: 'Artifact opened successfully.', by: 'QA' })
    const validity = validityState.tasks.find((item) => item.id === task.id)!.productValidity!
    expect(validity.automaticQualified).toBe(task.productValidity!.qualified)
    expect(validity).toMatchObject({ qualified: true, humanQualified: true, humanScore: 0.88, humanBy: 'QA' })

    const processState = reducer(initialState, { type: 'UPDATE_PROCESS_EFFICIENCY', taskId: task.id, patch: { targetMet: true, score: 0.9 }, reason: 'Business owner approved.', by: 'QA' })
    const process = processState.tasks.find((item) => item.id === task.id)!.processEfficiency!
    expect(process.automaticTargetMet).toBe(task.processEfficiency!.targetMet)
    expect(process).toMatchObject({ targetMet: true, humanTargetMet: true, humanScore: 0.9, humanBy: 'QA' })
  })
})
