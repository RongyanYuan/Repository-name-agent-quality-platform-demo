import { describe, expect, it } from 'vitest'
import type { AssetCatalogEntry, AssetCatalogKind, AssetEvolutionContribution, AssetPerformanceRecord, AssetVersion, EvolutionState, OutcomeEval, Trace } from '../domain'
import { selectAssetCategoryWorkbench } from './assetCategoryWorkbench'

const at = '2026-10-01T08:00:00.000Z'
const asset = (id: string, kind: AssetCatalogKind = 'PRODUCTION_SKILL'): AssetCatalogEntry => ({
  id, name: `${id} 生产资产`, kind, description: `${id} 描述`, status: 'ACTIVE', ownerScope: 'SYSTEM',
  visibility: 'PUBLIC', currentVersionId: `${id}@2`, createdAt: at, updatedAt: at
})
const version = (assetId: string, label = '2'): AssetVersion => ({
  id: `${assetId}@${label}`, assetId, version: label, status: label === '2' ? 'ACTIVE' : 'DEPRECATED',
  description: '版本', sourceEvolutionRecordIds: [], createdAt: at, updatedAt: at,
  deployment: { status: label === '2' ? 'ACTIVE' : 'OFFLINE', environment: label === '2' ? 'Production' : undefined, source: 'MOCK', updatedAt: at }
})
const performance = (id: string, assetId: string, score?: number, fields: Partial<AssetPerformanceRecord> = {}): AssetPerformanceRecord => ({
  id, assetId, assetVersionId: `${assetId}@2`, traceId: `trace-${id}`, caseId: `case-${id}`, artifactId: `artifact-${id}`,
  score, scoreScale: '0-2', queryAt: at, scoredAt: at, datasetIds: [], evolutionRecordIds: [], createdAt: at, updatedAt: at, ...fields
})
const contribution = (id: string, assetId: string, fields: Partial<AssetEvolutionContribution> = {}): AssetEvolutionContribution => ({
  id, assetId, assetVersionId: `${assetId}@2`, evolutionRecordId: `evolution-${id}`, attributionId: 'skill-sop', attributionLabel: 'skill sop错误',
  traceIds: [`trace-${id}`], datasetIds: [], status: 'COMPLETED', createdAt: at, updatedAt: at, ...fields
})
const evaluation = (id: string, isFinal: boolean): OutcomeEval => ({
  id, type: 'OUTCOME', traceId: 'trace', caseId: 'case', artifactId: 'shared-artifact', dimension: '最终评分',
  evalVersion: 'v1', verdict: 'PASS', revisions: [], evidenceIds: [], isFinal, createdAt: at, updatedAt: at
})
const trace = (id: string, fields: Partial<Trace> = {}): Trace => ({
  id, sessionId: 'session', caseId: 'case', sequence: 1, startedAt: at, endedAt: at, observationIds: [], artifactIds: [],
  status: 'SUCCEEDED', totalLatencyMs: 0, inputTokens: 0, outputTokens: 0, createdAt: at, updatedAt: at,
  telemetry: {
    totalLatencyMs: 0, ttftMs: 0, inputTokens: 0, outputTokens: 0, cacheHitCount: 0, cacheRequestCount: 0,
    modelCallCount: 0, toolCallCount: 0, toolOneShotSuccessCount: 0, toolExecutionCount: 0, loopCount: 0, retryCount: 0,
    riskInterception: { blocked: false, reason: '' }, commercialInterception: { blocked: false, reason: '' }
  }, ...fields
})
function state(fields: Partial<EvolutionState> = {}): EvolutionState {
  return {
    schemaVersion: 1, seedVersion: 'test', isMockData: true, updatedAt: at, sessions: [], cases: [], traces: [], observations: [], evidence: [],
    artifacts: [], processEvals: [], outcomeEvals: [], attributions: [], issues: [], issueClusters: [], skills: [], assets: [], variants: [],
    datasets: [], experiments: [], experimentRuns: [], windows: [], gateDecisions: [], releases: [], rules: [], auditTrail: [],
    evaluationBatches: [], evaluationJobs: [], tracePackages: [], evaluationFindings: [], routingPolicies: [], routingDecisions: [],
    routingDeliveries: [], algorithmBadcases: [], badcaseQueues: [], tastePreferenceSignals: [], ...fields
  }
}

describe('asset category workbench', () => {
  it('includes historical execution versions and assets with no evaluations while displaying current deployment separately', () => {
    const source = state({
      assetCatalog: [asset('ppt'), asset('word'), asset('taste', 'TASTE_SKILL')],
      assetVersions: [version('ppt', '1'), version('ppt'), version('word')],
      assetPerformanceRecords: [performance('old', 'ppt', 0, { assetVersionId: 'ppt@1' }), performance('current', 'ppt', 2)]
    })
    const result = selectAssetCategoryWorkbench(source, { kind: 'PRODUCTION_SKILL' })
    expect(result.assets.map(item => item.id)).toEqual(['ppt', 'word'])
    expect(result.averageScore).toBe(1)
    expect(result.evaluatedCount).toBe(2)
    expect(result.rows[0]).toMatchObject({ averageScore: 1, evaluatedCount: 2, currentVersion: { id: 'ppt@2', deployment: { environment: 'Production', status: 'ACTIVE' } } })
    expect(result.rows[1]).toMatchObject({ averageScore: undefined, evaluatedCount: 0, traceCount: 0, evolutionCount: 0 })
  })

  it('weights the category average by unique scored artifacts, not by asset averages', () => {
    const result = selectAssetCategoryWorkbench(state({
      assetCatalog: [asset('ppt'), asset('word')],
      assetPerformanceRecords: [performance('one', 'ppt', 0), performance('two', 'ppt', 0), performance('three', 'ppt', 0), performance('four', 'word', 2)]
    }))
    expect(result.averageScore).toBe(0.5)
    expect(result.evaluatedCount).toBe(4)
    expect(result.rows.map(row => row.averageScore)).toEqual([0, 2])
  })

  it('deduplicates shared artifacts across assets globally but keeps each asset association in its row', () => {
    const result = selectAssetCategoryWorkbench(state({
      assetCatalog: [asset('ppt'), asset('word')],
      assetPerformanceRecords: [performance('first', 'ppt', 1, { artifactId: 'shared' }),
        performance('second', 'word', 2, { artifactId: 'shared', scoredAt: '2026-10-02T00:00:00.000Z' })]
    }))
    expect(result.averageScore).toBe(2)
    expect(result.evaluatedCount).toBe(1)
    expect(result.performance.map(record => record.id)).toEqual(['second'])
    expect(result.rows.map(row => row.evaluatedCount)).toEqual([1, 1])
    expect(result.rows.map(row => row.averageScore)).toEqual([1, 2])
  })

  it('prefers final assessments over later dimension scores and retains the newest missing final score', () => {
    const source = state({
      assetCatalog: [asset('ppt')], outcomeEvals: [evaluation('final', true), evaluation('dimension', false)],
      assetPerformanceRecords: [
        performance('older-final', 'ppt', 2, { artifactId: 'shared', outcomeEvalId: 'final' }),
        performance('new-dimension', 'ppt', 0, { artifactId: 'shared', outcomeEvalId: 'dimension', scoredAt: '2026-10-03T00:00:00.000Z' })
      ]
    })
    expect(selectAssetCategoryWorkbench(source).performance[0].id).toBe('older-final')
    source.assetPerformanceRecords!.push(performance('newest-final', 'ppt', undefined, {
      artifactId: 'shared', outcomeEvalId: 'final', scoredAt: '2026-10-02T00:00:00.000Z'
    }))
    const result = selectAssetCategoryWorkbench(source)
    expect(result.performance[0].id).toBe('newest-final')
    expect(result.averageScore).toBeUndefined()
    expect(result.evaluatedCount).toBe(0)
    expect(result.monthly).toEqual([{ month: '2026-10', score: undefined, evaluatedCount: 0 }])
  })

  it('does not display an isolated dimension rating as a final artifact score', () => {
    const result = selectAssetCategoryWorkbench(state({
      assetCatalog: [asset('ppt')], outcomeEvals: [evaluation('only-dimension', false)],
      assetPerformanceRecords: [performance('dimension-only', 'ppt', 2, { outcomeEvalId: 'only-dimension' })]
    }))
    expect(result.performance).toEqual([])
    expect(result.evaluatedCount).toBe(0)
    expect(result.averageScore).toBeUndefined()
    expect(result.monthly).toEqual([])
    expect(result.rows[0]).toMatchObject({ evaluatedCount: 0, averageScore: undefined, monthly: [] })
  })

  it('requires ordinary dimensions to be explicitly final while preserving legacy final labels and unlinked analytical scores', () => {
    const result = selectAssetCategoryWorkbench(state({
      assetCatalog: [asset('ppt')], outcomeEvals: [
        { ...evaluation('ordinary-dimension', true), dimension: '视觉风格', isFinal: undefined },
        { ...evaluation('legacy-final', true), dimension: '产物最终评分', isFinal: undefined }
      ], assetPerformanceRecords: [
        performance('ordinary', 'ppt', 0, { outcomeEvalId: 'ordinary-dimension' }),
        performance('legacy-final-score', 'ppt', 2, { outcomeEvalId: 'legacy-final' }),
        performance('analytical', 'ppt', 1)
      ]
    }))
    expect(new Set(result.performance.map(record => record.id))).toEqual(new Set(['legacy-final-score', 'analytical']))
    expect(result.evaluatedCount).toBe(2)
    expect(result.averageScore).toBe(1.5)
    expect(result.rows[0].averageScore).toBe(1.5)
    expect(result.monthly).toEqual([{ month: '2026-10', score: 1.5, evaluatedCount: 2 }])
  })

  it('recovers the artifact identity from the linked assessment before deduplicating shared output', () => {
    const result = selectAssetCategoryWorkbench(state({
      assetCatalog: [asset('ppt'), asset('word')], outcomeEvals: [evaluation('final-assessment', true)],
      assetPerformanceRecords: [
        performance('with-artifact', 'ppt', 2, { artifactId: 'shared-artifact', outcomeEvalId: 'final-assessment' }),
        performance('without-artifact', 'word', 1, { artifactId: undefined, outcomeEvalId: 'final-assessment', scoredAt: '2026-10-02T08:00:00.000Z' })
      ]
    }))
    expect(result.performance.map(record => record.id)).toEqual(['without-artifact'])
    expect(result.evaluatedCount).toBe(1)
    expect(result.averageScore).toBe(1)
    expect(result.monthly).toEqual([{ month: '2026-10', score: 1, evaluatedCount: 1 }])
    expect(result.rows.map(row => row.evaluatedCount)).toEqual([1, 1])
  })

  it('excludes nonnumeric and out-of-scale scores from every score denominator', () => {
    const result = selectAssetCategoryWorkbench(state({ assetCatalog: [asset('ppt')], assetPerformanceRecords: [
      performance('zero', 'ppt', 0), performance('two', 'ppt', 2), performance('fraction', 'ppt', 1.5),
      performance('missing', 'ppt'), performance('nan', 'ppt', NaN), performance('infinite', 'ppt', Infinity),
      performance('negative', 'ppt', -1), performance('too-high', 'ppt', 3)
    ] }))
    expect(result.evaluatedCount).toBe(3)
    expect(result.averageScore).toBe(1.17)
    expect(result.monthly[0]).toEqual({ month: '2026-10', score: 1.17, evaluatedCount: 3 })
    expect(result.rows[0].evaluatedCount).toBe(3)
  })

  it('uses assessment and canonical Trace identity fallbacks when an artifact is missing', () => {
    const result = selectAssetCategoryWorkbench(state({
      identityAliases: [{ kind: 'trace', alias: 'legacy', canonicalId: '2017090237966576789545' }],
      assetCatalog: [asset('ppt')], assetPerformanceRecords: [
        performance('eval-first', 'ppt', 0, { artifactId: undefined, outcomeEvalId: 'same-eval' }),
        performance('eval-latest', 'ppt', 2, { artifactId: undefined, outcomeEvalId: 'same-eval', scoredAt: '2026-10-02T00:00:00.000Z' }),
        performance('trace-first', 'ppt', 0, { artifactId: undefined, traceId: 'legacy' }),
        performance('trace-latest', 'ppt', 2, { artifactId: undefined, traceId: '2017090237966576789545', scoredAt: '2026-10-02T00:00:00.000Z' })
      ]
    }))
    expect(new Set(result.performance.map(record => record.id))).toEqual(new Set(['eval-latest', 'trace-latest']))
    expect(result.evaluatedCount).toBe(2)
  })

  it('counts source Traces and evolution records once across assets and versions', () => {
    const result = selectAssetCategoryWorkbench(state({
      identityAliases: [{ kind: 'trace', alias: 'legacy', canonicalId: '2017090237966576789545' }],
      assetCatalog: [asset('ppt'), asset('word')], assetEvolutionContributions: [
        contribution('one', 'ppt', { traceIds: ['legacy', 'shared'], evolutionRecordId: 'evolution-shared' }),
        contribution('two', 'ppt', { traceIds: ['shared'], assetVersionId: 'ppt@1', evolutionRecordId: 'evolution-shared' }),
        contribution('three', 'word', { traceIds: ['2017090237966576789545', 'word-source'], evolutionRecordId: 'evolution-word' })
      ]
    }))
    expect(result.traceCount).toBe(3)
    expect(result.evolutionCount).toBe(2)
    expect(result.rows.map(row => row.traceCount)).toEqual([2, 2])
    expect(result.rows.map(row => row.evolutionCount)).toEqual([1, 1])
  })

  it('applies search to the same asset population used by rows, metrics and history', () => {
    const source = state({
      assetCatalog: [asset('ppt'), asset('word'), asset('taste', 'TASTE_SKILL')],
      assetVersions: [version('ppt', '2.5.0'), version('word', '1.0.0')],
      assetPerformanceRecords: [performance('ppt-score', 'ppt', 2), performance('word-score', 'word', 0), performance('taste-score', 'taste', 1)],
      assetEvolutionContributions: [contribution('ppt-source', 'ppt', { attributionLabel: 'skill name/description错误' }), contribution('word-source', 'word')]
    })
    for (const query of ['PPT', '2.5.0', 'skill name/description错误']) {
      const result = selectAssetCategoryWorkbench(source, { kind: 'PRODUCTION_SKILL', query })
      expect(result.assets.map(item => item.id)).toEqual(['ppt'])
      expect(result.performance.map(item => item.assetId)).toEqual(['ppt'])
      expect(result.contributions.map(item => item.assetId)).toEqual(['ppt'])
      expect(result.averageScore).toBe(2)
      expect(result.monthly[0].score).toBe(2)
    }
    expect(selectAssetCategoryWorkbench(source, { kind: 'TASTE_SKILL', query: '品味库' }).assets.map(item => item.id)).toEqual(['taste'])
  })

  it('filters scores and monthly history by Query time and source contributions by creation time, inclusively', () => {
    const source = state({
      assetCatalog: [asset('ppt'), asset('word')], assetPerformanceRecords: [
        performance('boundary', 'ppt', 2, { queryAt: '2026-09-30T08:00:00.000Z', scoredAt: '2026-10-02T08:00:00.000Z' }),
        performance('outside', 'ppt', 0, { queryAt: '2026-10-01T08:00:00.000Z' }),
        performance('legacy', 'ppt', 1, { queryAt: undefined, scoredAt: '2026-09-30T09:00:00.000Z' }),
        performance('invalid', 'ppt', 0, { queryAt: 'invalid' })
      ], assetEvolutionContributions: [
        contribution('inside', 'ppt', { createdAt: '2026-09-30T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z' }),
        contribution('outside', 'ppt', { createdAt: '2026-10-01T08:00:00.000Z' }),
        contribution('missing', 'ppt', { createdAt: '' })
      ]
    })
    const result = selectAssetCategoryWorkbench(source, { from: '2026-09-30T08:00:00.000Z', to: '2026-09-30T09:00:00.000Z' })
    expect(result.assets).toHaveLength(2)
    expect(result.performance.map(record => record.id)).toEqual(['boundary', 'legacy'])
    expect(result.contributions.map(record => record.id)).toEqual(['inside'])
    expect(result.averageScore).toBe(1.5)
    expect(result.traceCount).toBe(1)
    expect(result.monthly).toEqual([{ month: '2026-09', score: 1.5, evaluatedCount: 2 }])
    expect(result.rows[1].evaluatedCount).toBe(0)
  })

  it('projects missing Query times from canonical Traces for filtering, month labels and display without mutating records', () => {
    const source = state({
      assetCatalog: [asset('ppt')], identityAliases: [{ kind: 'trace', alias: 'legacy-query', canonicalId: '2017090237966576789545' }],
      traces: [
        trace('2017090237966576789545', { queryAt: '2026-09-30T08:00:00.000Z', startedAt: '2026-10-01T08:00:00.000Z' }),
        trace('started-only', { startedAt: '2026-09-29T08:00:00.000Z' })
      ], assetPerformanceRecords: [
        performance('query-in-trace', 'ppt', 2, { traceId: 'legacy-query', queryAt: undefined, scoredAt: '2026-10-02T08:00:00.000Z' }),
        performance('started-in-trace', 'ppt', 1, { traceId: 'started-only', queryAt: undefined, scoredAt: '2026-10-02T08:00:00.000Z' }),
        performance('explicit-query', 'ppt', 0, { traceId: 'legacy-query', queryAt: '2026-10-01T08:00:00.000Z' })
      ]
    })
    const result = selectAssetCategoryWorkbench(source, { from: '2026-09-29T08:00:00.000Z', to: '2026-09-30T08:00:00.000Z' })
    expect(result.performance.map(record => [record.id, record.queryAt])).toEqual([
      ['started-in-trace', '2026-09-29T08:00:00.000Z'], ['query-in-trace', '2026-09-30T08:00:00.000Z']
    ])
    expect(result.averageScore).toBe(1.5)
    expect(result.monthly).toEqual([{ month: '2026-09', score: 1.5, evaluatedCount: 2 }])
    expect(source.assetPerformanceRecords!.slice(0, 2).every(record => record.queryAt === undefined)).toBe(true)
    expect(source.assetPerformanceRecords![2].queryAt).toBe('2026-10-01T08:00:00.000Z')
    expect(result.rows[0].monthly).toEqual(result.monthly)
  })

  it('keeps all catalog rows but returns no statistics for invalid or reversed windows', () => {
    const source = state({ assetCatalog: [asset('ppt')], assetPerformanceRecords: [performance('one', 'ppt', 2)], assetEvolutionContributions: [contribution('one', 'ppt')] })
    for (const filters of [{ from: 'invalid' }, { to: 'invalid' }, { from: '2026-10-02', to: '2026-10-01' }]) {
      const result = selectAssetCategoryWorkbench(source, filters)
      expect(result.assets).toHaveLength(1)
      expect(result.performance).toEqual([])
      expect(result.contributions).toEqual([])
      expect(result.averageScore).toBeUndefined()
      expect(result.evaluatedCount).toBe(0)
      expect(result.traceCount).toBe(0)
      expect(result.monthly).toEqual([])
    }
  })
})
