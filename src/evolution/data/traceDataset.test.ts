import { describe, it, expect } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { traceRows, filterTraceRows, datasetRows, datasetTraceRows, importTraceCases } from './traceDataset'
import { mergeCaseLocalFilters, parseCaseLocalFilters } from '../../urlState'
import { resolveIdentity } from '../identity'

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
    const search = mergeCaseLocalFilters('?environment=Production', { channel: '小程序', verticalScenario: '生图', processMin: 0, processMax: 2, outcomeMin: 0, tokenMax: 3000, evolutionItem: 'skill-sop', timeFrom: '2026-10-01T00:00:00.000Z', timeTo: '2026-10-07T23:59:59.999Z', timeWindowId: 'window-2026w35', datasetCategory: 'PERSONAL', datasetPurpose: '相邻及无关回归集', datasetId: 'dataset-personal-ppt-regression' })
    expect(parseCaseLocalFilters(search)).toMatchObject({ channel: '小程序', verticalScenario: '生图', processMin: 0, processMax: 2, outcomeMin: 0, tokenMax: 3000, evolutionItem: 'skill-sop', timeFrom: '2026-10-01T00:00:00.000Z', timeTo: '2026-10-07T23:59:59.999Z', timeWindowId: 'window-2026w35', datasetCategory: 'PERSONAL', datasetPurpose: '相邻及无关回归集', datasetId: 'dataset-personal-ppt-regression' })
    expect(search).toContain('environment=Production')
    const custom = mergeCaseLocalFilters('?timeRange=30d', { timeFrom: '2026-09-01T00:00:00.000Z', timeTo: '2026-09-03T23:59:59.999Z' })
    expect(parseCaseLocalFilters(custom)).toMatchObject({ timeRange: 'all', timeFrom: '2026-09-01T00:00:00.000Z', timeTo: '2026-09-03T23:59:59.999Z' })
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
    expect(datasetTraceRows(state, dataset).map(row => row.trace.id)).toEqual(['trace-ppt-context', 'trace-ppt-generate'].map(id => resolveIdentity(state, 'trace', id)))
    expect(datasetTraceRows(state, { ...dataset, caseIds: [] })).toEqual([])
  })
  it('uses explicit Trace membership for samples, counts and labels without enrolling a sibling Trace', () => {
    const state = createInitialEvolutionData()
    const dataset = { ...state.datasets[0], id: 'dataset-exact-trace-scope', name: '精确来源集', caseIds: ['case-ppt-management'], sampleCount: 1 }
    const generation = resolveIdentity(state, 'trace', 'trace-ppt-generate')
    const sibling = resolveIdentity(state, 'trace', 'trace-ppt-context')
    state.datasets = [dataset]
    state.datasetMemberships = [{ id: 'membership-exact-trace-scope', datasetId: dataset.id, datasetVersion: dataset.version, caseId: 'case-ppt-management', traceIds: [generation], scope: 'TRACE', joinedAt: '2026-10-06T01:00:00Z', actor: 'Mock 评测 Agent', origin: 'MOCK' }]
    expect(datasetTraceRows(state, dataset).map(row => row.trace.id)).toEqual([generation])
    expect(datasetRows(state)[0].traceIds).toEqual([generation])
    expect(traceRows(state).find(row => row.trace.id === sibling)?.datasets).toEqual([])
    expect(traceRows(state).find(row => row.trace.id === generation)?.datasets.map(item => item.id)).toEqual([dataset.id])
    state.datasetMemberships[0].scope = 'CASE_SHARED'
    expect(datasetTraceRows(state, dataset).map(row => row.trace.id)).toEqual([sibling, generation])
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
  it('records the actual selected Traces together when a shared Case is successfully imported', () => {
    const state = createInitialEvolutionData()
    state.datasets = []; state.datasetMemberships = []; state.governanceEvents = []
    const rows = traceRows(state).filter(row => row.case.id === 'case-ppt-management')
    const result = importTraceCases(state, [rows[1].trace.id, rows[0].trace.id, rows[1].trace.id], 'evaluation', '新评测集', '2026-10-12T04:05:06Z')
    expect(result.addedCaseIds).toEqual(['case-ppt-management'])
    expect(result.state.datasetMemberships).toHaveLength(1)
    expect(result.state.datasetMemberships?.[0]).toMatchObject({ traceIds: [rows[1].trace.id, rows[0].trace.id], scope: 'TRACE', joinedAt: '2026-10-12T04:05:06Z', origin: 'LOCAL' })
    expect(result.state.governanceEvents?.filter(item => item.stage === 'DATASET').map(item => item.traceId).sort()).toEqual(rows.map(row => row.trace.id).sort())
    expect(traceRows(result.state).find(row => row.trace.id === rows[1].trace.id)?.governance.memberships[0].scope).toBe('TRACE')
  })
  it('records a single selected Trace without treating its sibling as individually enrolled', () => {
    const state = createInitialEvolutionData()
    state.datasets = []; state.datasetMemberships = []; state.governanceEvents = []
    const rows = traceRows(state).filter(row => row.case.id === 'case-ppt-management')
    const result = importTraceCases(state, [rows[1].trace.id], 'evaluation', '新评测集', '2026-10-12T04:05:06Z')
    expect(result.state.datasetMemberships?.[0].traceIds).toEqual([rows[1].trace.id])
    expect(traceRows(result.state).find(row => row.trace.id === rows[0].trace.id)?.governance.memberships[0]).toMatchObject({ scope: 'CASE_SHARED', joinedAt: undefined })
  })
  it('does not rewrite frozen datasets or append enrollment events on blocked imports', () => {
    const state = createInitialEvolutionData()
    const source = traceRows(state).find(row => !row.datasets.length)!
    state.datasets = [{ ...state.datasets[0], purpose: '原始归因集', frozen: true }]
    state.governanceEvents = []; state.datasetMemberships = []
    const before = structuredClone(state.datasets[0])
    const result = importTraceCases(state, [source.trace.id], 'evaluation', '冻结集', '2026-10-12T04:05:06Z')
    expect(result.addedCaseIds).toEqual([])
    expect(result.blocked[0].reason).toContain('冻结')
    expect(result.state.datasets[0]).toEqual(before)
    expect(result.state.governanceEvents).toEqual([])
    expect(result.state.datasetMemberships).toEqual([])
  })
  it('uses the newest evaluation package for dataset rows instead of a prior completed score', () => {
    const state = createInitialEvolutionData()
    const source = state.tracePackages.find(item => item.rating?.processFinal !== undefined)!
    state.tracePackages.push({ ...structuredClone(source), id: 'newer-trace-package', createdAt: '2026-10-12T12:00:00Z', updatedAt: '2026-10-12T12:00:00Z', rating: { ...source.rating!, processFinal: 0.11 } })
    const row = traceRows(state).find(item => item.trace.id === source.traceId)!
    expect(row.package?.id).toBe('newer-trace-package')
    expect(row.rating?.processFinal).toBe(0.11)
  })
  it('leaves unrecorded final scores missing while respecting each module explicit scale', () => {
    const state = createInitialEvolutionData()
    const source = state.tracePackages[0]
    source.rating = undefined
    source.moduleScores = source.moduleScores.slice(0, 2).map((score, index) => ({ ...score, moduleCode: index === 0 ? 'SKILL' : 'ACT', score: index === 0 ? 0.5 : 0.75, scoreScale: index === 0 ? '0-2' : '0-1' }))
    state.tracePackages = [source]
    const rating = traceRows(state).find(item => item.trace.id === source.traceId)?.rating
    expect(rating?.processFinal).toBeUndefined()
    expect(rating?.outcomeFinal).toBeUndefined()
    expect(rating?.processDimensions.map(item => item.score)).toEqual([0.5, 1.5])
  })
})
