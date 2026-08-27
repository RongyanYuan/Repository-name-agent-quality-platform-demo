import { describe, expect, it } from 'vitest'
import { qualityData } from './data'
import { defaultFilters, getModuleDiagnostics } from './selectors'

describe('v3 module diagnostics', () => {
  it('reports state counts and evidence coverage instead of a problem percentage', () => {
    const diagnostics = getModuleDiagnostics(qualityData, defaultFilters)
    const memory = diagnostics.find((item) => item.nodeType === 'Memory')
    expect(memory).toMatchObject({
      stateCounts: expect.objectContaining({ FAIL: expect.any(Number), PASS: expect.any(Number) }),
      firstFailureCount: expect.any(Number),
      derivedCount: expect.any(Number),
      evidenceCoverage: expect.objectContaining({ observed: expect.any(Number), total: expect.any(Number), rate: expect.any(Number) })
    })
    expect(memory?.firstFailureCount).toBeGreaterThan(0)
    expect(diagnostics.some((item) => item.nodeType === 'Context Assembly')).toBe(false)
    expect(memory?.evidenceCoverage.rate).toBeLessThanOrEqual(100)
  })

  it('marks absent modules as N/A rather than a 100% problem rate', () => {
    const diagnostics = getModuleDiagnostics({ ...qualityData, tasks: qualityData.tasks.map((task) => ({ ...task, traceId: 'missing-trace' })), traces: [] }, defaultFilters)
    const recovery = diagnostics.find((item) => item.nodeType === 'Recovery')
    expect(recovery?.status).toBe('N/A')
    expect(recovery?.stateCounts['N/A']).toBe(0)
    expect(recovery?.evidenceCoverage.rate).toBe(0)
  })
})
