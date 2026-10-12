import { describe, it, expect } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { traceRows, filterTraceRows, datasetRows, datasetTraceRows, importTraceCases } from './traceDataset'
import { mergeCaseLocalFilters, parseCaseLocalFilters } from '../../urlState'

describe('Trace and dataset contracts', () => {
  it('returns every Trace once, including online and dataset members', () => {
    const state = createInitialEvolutionData()
    const rows = traceRows(state)
    expect(new Set(rows.map(row => row.trace.id)).size).toBe(state.traces.length)
    expect(rows.some(row => row.labels.includes('线上'))).toBe(true)
    expect(rows.some(row => row.labels.includes('回归数据集A'))).toBe(true)
    expect(rows.filter(row => row.trace.verticalScenario === '生图').length).toBeGreaterThanOrEqual(3)
  })
  it('combines score, Channel, vertical and cost filters without treating missing scores as zero', () => {
    const rows = traceRows(createInitialEvolutionData())
    const row = rows.find(row => row.rating?.processFinal !== undefined && row.trace.verticalScenario === 'PPT')!
    expect(filterTraceRows(rows, { channel: row.trace.channel, verticalScenario: 'PPT', processMin: 0, processMax: 2, tokenMin: row.tokens, latencyMax: row.trace.totalLatencyMs }).map(row => row.trace.id)).toContain(row.trace.id)
    expect(filterTraceRows(rows, { processMax: 0 }).every(row => row.rating?.processFinal === 0)).toBe(true)
    expect(filterTraceRows(rows, { tokenMin: 99999999 })).toEqual([])
    expect(filterTraceRows(rows, { processMin: 2, processMax: 1 })).toEqual([])
  })
  it('retains zero ranges and all new filters in URL', () => {
    const search = mergeCaseLocalFilters('?environment=Production', { channel: '小程序', verticalScenario: '生图', processMin: 0, processMax: 2, outcomeMin: 0, tokenMax: 3000, evolutionItem: 'skill-sop' })
    expect(parseCaseLocalFilters(search)).toMatchObject({ channel: '小程序', verticalScenario: '生图', processMin: 0, processMax: 2, outcomeMin: 0, tokenMax: 3000, evolutionItem: 'skill-sop' })
    expect(search).toContain('environment=Production')
  })
  it('filters target pairs exactly and does not infer gate PASS from completed experiments', () => {
    const state = createInitialEvolutionData()
    const rows = datasetRows(state, { skillId: 'skill-ppt-builder', evolutionItem: 'skill-sop' })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.targets.some(target => target.skillId === 'skill-ppt-builder' && target.evolutionItemId === 'skill-sop'))).toBe(true)
    expect(rows.some(row => row.gate === '已准出')).toBe(true)
    state.gateDecisions = []
    expect(datasetRows(state, { skillId: 'skill-ppt-builder', evolutionItem: 'skill-sop' }).some(row => row.gate === '已准出')).toBe(false)
    expect(datasetRows(state, { skillId: 'skill-word-builder', evolutionItem: 'memory-production' })).toEqual([])
  })
  it('deduplicates Case membership, prevents dataset re-adds and allows only evaluated online Golden cases', () => {
    const state = createInitialEvolutionData()
    const rows = traceRows(state)
    const eligible = rows.find(row => row.case.sourceType === 'ONLINE_WINDOW' && row.package?.status === 'EVALUATED' && !row.datasets.length)!
    const result = importTraceCases(state, [eligible.trace.id, eligible.trace.id], 'golden', '黄金集', '2026-10-10T10:00:00Z')
    expect(result.addedCaseIds).toEqual([eligible.case.id])
    expect(result.state.auditTrail.at(-1)?.action).toBe('BULK_TRACE_IMPORT')
    expect(importTraceCases(result.state, [eligible.trace.id], 'golden', '黄金集', '2026-10-10T10:00:01Z').blocked[0].reason).toContain('黄金集')
    expect(importTraceCases(state, [rows.find(row => row.datasets.length)!.trace.id], 'evaluation', '评测集', '2026-10-10T10:00:01Z').addedCaseIds).toEqual([])
  })
  it('requires Skill, normalized version and attribution to match one target rather than different targets', () => {
    const state = createInitialEvolutionData()
    state.datasets = [{ ...state.datasets[0], targets: [
      { skillId: 'skill-ppt-builder', skillVersion: 'ppt-builder-2.5.0', evolutionItemId: 'skill-sop' },
      { skillId: 'skill-spreadsheet', skillVersion: 'spreadsheet-2.5.1', evolutionItemId: 'act-failed' }
    ] }]
    expect(datasetRows(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.1', attribution: 'act-failed' })).toEqual([])
    expect(datasetRows(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })).toHaveLength(1)
  })
  it('uses the current gate decision and isolates experiments sharing a dataset across targets', () => {
    const state = createInitialEvolutionData()
    const dataset = state.datasets[0]
    dataset.targets = [{ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }]
    dataset.gateStatus = '已准出'
    state.datasets = [dataset]
    const own = { ...state.experiments[0], targets: dataset.targets, datasetIds: [dataset.id], gateDecisionId: 'gate-current' }
    const other = { ...state.experiments[1], targets: [{ skillId: 'skill-spreadsheet', skillVersion: '2.5.1', evolutionItemId: 'act-failed' }], datasetIds: [dataset.id] }
    state.experiments = [own, other]
    state.gateDecisions = [
      { ...state.gateDecisions[0], id: 'gate-old', experimentId: own.id, conclusion: 'PASS', decidedAt: '2026-10-10T00:00:00Z' },
      { ...state.gateDecisions[0], id: 'gate-current', experimentId: own.id, conclusion: 'REJECT', decidedAt: '2026-10-11T00:00:00Z' }
    ]
    const row = datasetRows(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })[0]
    expect(row.experimentIds).toEqual([own.id])
    expect(row.gate).toBe('不准出')
    expect(row.decisionIds).toEqual(['gate-current'])
  })
  it('falls back to an exact Variant target when a legacy experiment has no own targets', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.variants = [{ ...state.variants[0], targets: [target] }]
    state.experiments = [{ ...state.experiments[0], targets: undefined, variantIds: [state.variants[0].id], datasetIds: [state.datasets[0].id] }]
    expect(datasetRows(state, target)[0].experimentIds).toEqual([state.experiments[0].id])
  })
  it('shows only member Trace rows and does not invent unexpanded external samples', () => {
    const state = createInitialEvolutionData()
    const dataset = { ...state.datasets[0], caseIds: ['case-ppt-management'], sampleCount: 100 }
    expect(datasetTraceRows(state, dataset).map(row => row.trace.id)).toEqual(['trace-ppt-context', 'trace-ppt-generate'])
    expect(datasetTraceRows(state, { ...dataset, caseIds: [] })).toEqual([])
  })
  it('does not label queued or draft experiments as evaluated before any result exists', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.experiments = [{ ...state.experiments[0], targets: [target], datasetIds: [state.datasets[0].id], status: 'QUEUED', metrics: [], runIds: [], gateDecisionId: undefined }]
    state.experimentRuns = []
    const filter = { skillId: target.skillId, skillVersion: target.skillVersion, attribution: target.evolutionItemId }
    expect(datasetRows(state, filter)[0].evaluationResult).toBe('待运行')
    state.experiments[0].status = 'RUNNING'
    expect(datasetRows(state, filter)[0].evaluationResult).toBe('评测中')
    state.experiments[0].status = 'FAILED'
    expect(datasetRows(state, filter)[0].evaluationResult).toBe('评测失败')
    state.experiments[0].status = 'COMPLETED'
    expect(datasetRows(state, filter)[0].evaluationResult).toBe('暂无评测结果')
    state.experiments[0].metrics = [{ key: 'local', label: '目标模块评分', category: 'LOCAL', baselineMean: 1, candidateMean: 1.5, baselineStdDev: 0, candidateStdDev: 0, unit: 'score', gateStatus: 'PENDING' }]
    expect(datasetRows(state, filter)[0].evaluationResult).toBe('已有评测结果')
  })
  it('does not reuse a prior experiment PASS while a newer experiment is running on the same target dataset', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target], gateStatus: '已准出' }]
    state.experiments = [
      { ...state.experiments[0], id: 'old-pass', targets: [target], datasetIds: [state.datasets[0].id], status: 'DECIDED', gateDecisionId: 'gate-old-pass', updatedAt: '2026-10-10T10:00:00Z' },
      { ...state.experiments[0], id: 'new-running', targets: [target], datasetIds: [state.datasets[0].id], status: 'RUNNING', gateDecisionId: undefined, metrics: [], updatedAt: '2026-10-11T10:00:00Z' }
    ]
    state.gateDecisions = [{ ...state.gateDecisions[0], id: 'gate-old-pass', experimentId: 'old-pass', conclusion: 'PASS', decidedAt: '2026-10-10T10:00:00Z' }]
    const row = datasetRows(state, { skillId: target.skillId, skillVersion: target.skillVersion, attribution: target.evolutionItemId })[0]
    expect(row).toMatchObject({ evaluationResult: '评测中', gate: '待决策', decisionIds: [] })
    expect(state.gateDecisions[0]).toMatchObject({ id: 'gate-old-pass', conclusion: 'PASS' })
    state.gateDecisions[0].experimentId = 'new-running'
    expect(datasetRows(state, { skillId: target.skillId, skillVersion: target.skillVersion, attribution: target.evolutionItemId })[0].gate).toBe('待决策')
  })
})
