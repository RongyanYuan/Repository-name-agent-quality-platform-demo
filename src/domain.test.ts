import { describe, expect, it } from 'vitest'
import { qualityData } from './data'
import { defaultFilters, filterTasks, getFirstFailure, getOverviewKpis, getRootCauseMetrics, getToolMetrics, parseFilters, serializeFilters } from './selectors'

describe('quality fixtures', () => {
  it('cover the required task matrix', () => {
    expect(qualityData.tasks.length).toBeGreaterThanOrEqual(24)
    expect(new Set(qualityData.tasks.map((task) => task.businessType))).toEqual(new Set(['PPT', 'Excel', 'Word', 'Coding', 'General']))
    expect(new Set(qualityData.tasks.map((task) => task.complexity))).toEqual(new Set(['Simple', 'Medium', 'Complex']))
    expect(new Set(qualityData.tasks.map((task) => task.status))).toEqual(new Set(['Effective', 'Effective but Inefficient', 'Failed']))
    expect(new Set(qualityData.tasks.map((task) => task.agentVersion))).toEqual(new Set(['agent-2.4.0', 'agent-2.5.0']))
  })

  it('keeps every task, trace, observation and evidence reference valid', () => {
    const taskIds = new Set(qualityData.tasks.map((task) => task.id))
    const traceIds = new Set(qualityData.traces.map((trace) => trace.id))
    const evidenceIds = new Set(qualityData.evidence.map((item) => item.id))
    qualityData.tasks.forEach((task) => {
      expect(traceIds.has(task.traceId)).toBe(true)
      task.evals.concat(task.processEvals).forEach((evaluation) => evaluation.evidenceIds.forEach((id) => expect(evidenceIds.has(id)).toBe(true)))
    })
    qualityData.traces.forEach((trace) => {
      expect(taskIds.has(trace.taskId)).toBe(true)
      trace.observations.forEach((observation) => observation.evidenceIds.forEach((id) => expect(evidenceIds.has(id)).toBe(true)))
    })
  })

  it('contains the required memory-first-failure example', () => {
    const task = qualityData.tasks.find((candidate) => candidate.query.includes('根据刚才的销售 Excel'))
    expect(task).toBeDefined()
    const firstFailure = task && getFirstFailure(qualityData, task)
    expect(firstFailure?.nodeType).toBe('Memory')
    expect(firstFailure?.rootCause).toBe('Memory')
    const context = qualityData.traces.find((trace) => trace.id === task?.traceId)?.observations.find((observation) => observation.nodeType === 'Context Assembly')
    expect(context?.derived).toBe(true)
    expect(context?.status).toBe('FAIL')
  })
})

describe('selectors', () => {
  it('filters by all active dimensions and returns only intersections', () => {
    const filtered = filterTasks(qualityData, { ...defaultFilters, businessType: 'Excel', complexity: 'Complex', rootCause: 'Memory', badcase: 'yes' })
    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach((task) => {
      expect(task.businessType).toBe('Excel')
      expect(task.complexity).toBe('Complex')
      expect(task.rootCause).toBe('Memory')
      expect(task.isBadcase).toBe(true)
    })
  })

  it('produces drillable KPI, root-cause and tool metrics', () => {
    const kpis = getOverviewKpis(qualityData, defaultFilters)
    const roots = getRootCauseMetrics(qualityData, defaultFilters)
    const tools = getToolMetrics(qualityData, defaultFilters)
    expect(kpis).toHaveLength(7)
    expect(roots.every((metric) => metric.sourceTaskIds.length === metric.count)).toBe(true)
    expect(tools.every((metric) => metric.calls >= metric.success)).toBe(true)
  })

  it('round-trips URL filter state', () => {
    const filters = { ...defaultFilters, businessType: 'PPT' as const, agentVersion: 'agent-2.5.0', search: 'trace-001', rootCause: 'Memory' as const, badcase: 'yes' as const }
    expect(parseFilters(`?${serializeFilters(filters)}`)).toMatchObject(filters)
  })
})
