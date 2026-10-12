import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import {
  selectBatchStatistics,
  selectEvidenceCompleteness,
  selectFirstNonDerivedFailure,
  selectModuleEvaluationSummary,
  selectRoutingQueue,
  selectTraceEvaluationLedger,
} from './selectors'

describe('V2 evaluation ledger selectors', () => {
  it('summarizes every batch state without mixing trace and package counts', () => {
    const state = createInitialEvolutionData()
    expect(new Set(state.evaluationBatches.map((batch) => batch.status))).toEqual(new Set(['DRAFT', 'QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED']))
    const completed = selectBatchStatistics(state, 'batch-completed-005')
    expect(completed.inputTraceCount).toBe(completed.successCount + completed.partialCount + completed.failedCount + completed.pendingCount)
    expect(completed.inputTraceCount).toBeGreaterThan(0)
    for (const batch of state.evaluationBatches) {
      const stats = selectBatchStatistics(state, batch.id)
      expect(stats.inputTraceCount).toBe(stats.successCount + stats.partialCount + stats.failedCount + stats.pendingCount)
    }
  })

  it('filters the full evaluated Trace ledger by category and coverage', () => {
    const state = createInitialEvolutionData()
    const production = selectTraceEvaluationLedger(state, { skillCategory: 'PRODUCTION_SKILL' })
    expect(production.length).toBeGreaterThan(0)
    expect(production.every((row) => row.skillCategory === 'PRODUCTION_SKILL')).toBe(true)
    expect(selectTraceEvaluationLedger(state, { evidenceCompleteness: 'MISSING' }).length).toBeGreaterThan(0)
  })

  it('returns seven module summaries and first non-derived failure', () => {
    const state = createInitialEvolutionData()
    const packageRecord = state.tracePackages.find((item) => item.moduleScores.some((score) => score.automaticStatus === 'FAIL'))!
    expect(selectModuleEvaluationSummary(state, packageRecord.traceId)).toHaveLength(7)
    const first = selectFirstNonDerivedFailure(packageRecord)
    expect(first).toBeDefined()
    expect(first?.automaticStatus).toBe('FAIL')
    expect(first?.evidence.derivedFailure).toBe(false)
  })

  it('calculates evidence completeness and exposes routing queue deliveries', () => {
    const state = createInitialEvolutionData()
    const packageRecord = state.tracePackages.find((item) => item.moduleScores.some((score) => score.evidence.completeness === 'MISSING'))!
    expect(selectEvidenceCompleteness(state, packageRecord.traceId)).toBe('MISSING')
    const queue = selectRoutingQueue(state, 'queue-algorithm-badcase')
    expect(queue.deliveryIds.length).toBeGreaterThan(0)
    expect(queue.itemIds.length).toBeGreaterThan(0)
  })

  it('keeps all three V1 core governance chains in completed V2 batch with independent routes', () => {
    const state = createInitialEvolutionData()
    const completed = state.evaluationBatches.find((batch) => batch.id === 'batch-completed-005')!
    expect(completed.traceIds).toEqual(expect.arrayContaining(['trace-ppt-generate', 'trace-tool-export', 'trace-multi-route']))
    const ppt = state.tracePackages.find((record) => record.traceId === 'trace-ppt-generate')!
    expect(ppt.moduleScores.filter((score) => score.automaticStatus === 'FAIL').map((score) => score.moduleCode)).toEqual(['SKILL', 'OUTCOME'])
    expect(ppt.badcaseIds.length).toBeGreaterThan(0)
    const tool = state.tracePackages.find((record) => record.traceId === 'trace-tool-export')!
    expect(state.routingDeliveries.filter((delivery) => tool.routingDeliveryIds.includes(delivery.id)).some((delivery) => delivery.destination === 'DIRECT_FIX')).toBe(true)
    const multi = state.tracePackages.find((record) => record.traceId === 'trace-multi-route')!
    expect(new Set(state.routingDeliveries.filter((delivery) => multi.routingDeliveryIds.includes(delivery.id)).map((delivery) => delivery.destination)).size).toBeGreaterThan(1)
    expect(selectBatchStatistics(state, completed.id).inputTraceCount).toBe(8)
  })
})
