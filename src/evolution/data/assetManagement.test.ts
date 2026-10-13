import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { enrichAssetManagementFixtures, selectAssetCatalog, selectAssetEvolutionHistory, selectAssetEvolutionSourceDatasetIds, selectAssetMonthlyPerformance, selectAssetPerformance, selectAssetPerformanceSummaries, selectAssetVersionMonthlyPerformance, selectAssetVersions, validateAssetManagementState } from './assetManagement'
import { normalizeSkillVersion } from './skillWorkspace'

describe('asset management catalog and performance projections', () => {
  it('seeds every requested asset class with multiple versions', () => {
    const state = createInitialEvolutionData()
    const kinds = new Set((state.assetCatalog ?? []).map(item => item.kind))
    expect(kinds).toEqual(new Set(['TASTE_SKILL', 'PRODUCTION_SKILL', 'PERSONAL_SKILL', 'MEMORY', 'TOOL', 'SYSTEM_PROMPT', 'OTHER_CAPABILITY']))
    for (const item of state.assetCatalog ?? []) expect(selectAssetVersions(state, item.id).length).toBeGreaterThanOrEqual(2)
    expect(validateAssetManagementState(state)).toEqual([])
  })

  it('filters catalog and performance by asset, fixed version and Trace Query time', () => {
    const state = createInitialEvolutionData()
    const production = selectAssetCatalog(state, { kind: 'PRODUCTION_SKILL' })
    expect(production.length).toBeGreaterThan(0)
    const versions = selectAssetVersions(state, production[0].id)
    const records = selectAssetPerformance(state, { assetId: production[0].id, assetVersionId: versions[0].id, from: '2026-09-01T00:00:00.000Z', to: '2026-10-31T23:59:59.000Z' })
    expect(records.every(item => item.assetVersionId === versions[0].id)).toBe(true)
    expect(records.every(item => item.score === undefined || (item.score >= 0 && item.score <= 2))).toBe(true)
  })

  it('uses the released Skill version as current instead of the last synthetic version', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog!.find(item => item.skillId === 'skill-taste-executive')!
    const current = state.assetVersions!.find(item => item.id === catalog.currentVersionId)!
    expect(current).toMatchObject({ version: '0.9.0', status: 'ACTIVE' })
    const skill = state.skills.find(item => item.id === catalog.skillId)!
    expect(current.createdAt).toBe(skill.versions!.find(item => item.version === '0.9.0')!.createdAt)
    expect(state.assetVersions!.find(item => item.assetId === catalog.id && item.version === '1.0.0-rc.1')?.status).toBe('CANDIDATE')
    expect(state.assetVersions!.filter(item => item.assetId === catalog.id && item.status === 'ACTIVE')).toEqual([current])
  })

  it('records deployment explicitly without treating every production Skill version as online', () => {
    const state = createInitialEvolutionData()
    const versions = selectAssetVersions(state, 'asset-catalog-skill-ppt-builder')
    expect(versions.find(item => item.version === '2.6.0')?.deployment).toMatchObject({ environment: 'Production', status: 'ACTIVE', source: 'MOCK' })
    expect(versions.find(item => item.version === '2.6.0-rc.1')?.deployment).toMatchObject({ environment: 'Staging', status: 'ACTIVE', source: 'MOCK' })
    expect(versions.find(item => item.version === '2.5.0')?.deployment).toMatchObject({ status: 'OFFLINE', source: 'MOCK' })
    expect(versions.find(item => item.version === '2.5.0')?.deployment?.environment).toBeUndefined()
    const taste = selectAssetVersions(state, 'asset-catalog-skill-taste-executive')
    expect(taste.find(item => item.version === '0.9.0')?.deployment?.environment).toBe('Production')
    expect(selectAssetVersions(state, 'asset-catalog-memory').find(item => item.status === 'ACTIVE')?.deployment?.environment).toBe('Production')
    expect(selectAssetVersions(state, 'asset-catalog-skill-personal-planned').every(item => item.deployment?.status === 'NOT_DEPLOYED')).toBe(true)
  })

  it('fills only recognized untouched Mock versions when migrating deployment metadata', () => {
    const state = createInitialEvolutionData()
    state.assetVersions!.forEach(item => { delete item.deployment })
    const active = state.assetVersions!.find(item => item.assetId === 'asset-catalog-skill-ppt-builder' && item.version === '2.6.0')!
    const edited = state.assetVersions!.find(item => item.assetId === active.assetId && item.version === '2.5.0')!
    const unrecognized = { ...active, id: 'local-version-without-deployment', version: 'local-1', description: '用户创建的版本', deployment: undefined }
    state.assetVersions!.push(unrecognized)
    state.auditTrail.push({ id: 'audit-local-version', at: state.updatedAt, actor: '当前用户', action: 'UPDATE', entityType: 'assetVersion', entityId: edited.id, reason: '人工修改版本', changes: { description: '人工修改' } })
    const repaired = enrichAssetManagementFixtures(state)
    expect(repaired.assetVersions!.find(item => item.id === active.id)?.deployment).toMatchObject({ environment: 'Production', status: 'ACTIVE', source: 'MOCK' })
    expect(repaired.assetVersions!.find(item => item.id === edited.id)?.deployment).toBeUndefined()
    expect(repaired.assetVersions!.find(item => item.id === unrecognized.id)?.deployment).toBeUndefined()
    expect(enrichAssetManagementFixtures(repaired)).toEqual(repaired)
  })

  it('preserves recorded service and local deployments instead of replacing them with Mock defaults', () => {
    const state = createInitialEvolutionData()
    const active = state.assetVersions!.find(item => item.assetId === 'asset-catalog-skill-ppt-builder' && item.version === '2.6.0')!
    const candidate = state.assetVersions!.find(item => item.assetId === active.assetId && item.version === '2.6.0-rc.1')!
    active.deployment = { environment: 'Production', status: 'CANARY', source: 'SERVICE', updatedAt: '2026-10-12T04:00:00.000Z' }
    candidate.deployment = { status: 'NOT_DEPLOYED', source: 'LOCAL', updatedAt: '2026-10-12T05:00:00.000Z' }
    const repaired = enrichAssetManagementFixtures(state)
    expect(repaired.assetVersions!.find(item => item.id === active.id)?.deployment).toEqual(active.deployment)
    expect(repaired.assetVersions!.find(item => item.id === candidate.id)?.deployment).toEqual(candidate.deployment)
  })

  it('keeps an additional attribution-source version offline rather than deploying it by version name', () => {
    const state = createInitialEvolutionData()
    const record = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-taste-executive')!
    if (record.target.kind !== 'SKILL') throw new Error('Fixture must target a Skill')
    record.target.skillVersion = 'taste-9.0.0-rc.1'
    const repaired = enrichAssetManagementFixtures(state)
    const historical = repaired.assetVersions!.find(item => item.assetId === 'asset-catalog-skill-taste-executive' && item.version === '9.0.0-rc.1')!
    expect(historical.deployment).toMatchObject({ status: 'OFFLINE', source: 'MOCK' })
    expect(historical.deployment?.environment).toBeUndefined()
  })

  it('assigns Skill scores to the recorded execution version and keeps only final Outcome evaluations', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog!.find(item => item.skillId === 'skill-taste-executive')!
    const records = selectAssetPerformance(state, { assetId: catalog.id })
    expect([...new Set(records.map(item => state.assetVersions!.find(version => version.id === item.assetVersionId)!.version))]).toEqual(expect.arrayContaining(['0.9.0', '1.0.0-rc.1']))
    for (const performance of records) {
      const trace = state.traces.find(item => item.id === performance.traceId)!
      const pkg = state.tracePackages.find(item => item.traceId === trace.id)
      const version = state.assetVersions!.find(item => item.id === performance.assetVersionId)!
      expect(version.version).toBe(normalizeSkillVersion(trace.skillVersion ?? pkg?.skillVersion))
      if (performance.outcomeEvalId) expect(state.outcomeEvals.find(item => item.id === performance.outcomeEvalId)?.isFinal).not.toBe(false)
    }
  })

  it('treats an explicit ALL version scope as every historical version', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog![0]
    const all = selectAssetPerformance(state, { assetId: catalog.id, assetVersionId: 'ALL' })
    const aggregate = selectAssetPerformance(state, { assetId: catalog.id })
    expect(new Set(all.map(item => item.id))).toEqual(new Set(aggregate.map(item => item.id)))
    const history = selectAssetEvolutionHistory(state, catalog.id, 'ALL')
    expect(new Set(history.map(item => item.assetVersionId)).size).toBeGreaterThanOrEqual(1)
  })

  it('aggregates evaluated scores by month and keeps unscored records out of the average', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog![0]
    const trend = selectAssetMonthlyPerformance(state, { assetId: catalog.id })
    expect(trend.length).toBeGreaterThan(0)
    expect(trend.every(point => point.averageScore === undefined || (point.averageScore >= 0 && point.averageScore <= 2))).toBe(true)
    const summaries = selectAssetPerformanceSummaries(state, { assetId: catalog.id })
    expect(summaries.length).toBeGreaterThanOrEqual(2)
    expect(summaries.every(item => item.traceCount >= item.evaluatedCount)).toBe(true)
  })

  it('keeps the version label on historical monthly score points', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog![0]
    const trend = selectAssetVersionMonthlyPerformance(state, { assetId: catalog.id, assetVersionId: 'ALL' })
    expect(trend.length).toBeGreaterThan(0)
    expect(trend.every(point => point.assetVersionId && point.assetVersion && point.month)).toBe(true)
    expect(trend.every(point => point.averageScore === undefined || (point.averageScore >= 0 && point.averageScore <= 2))).toBe(true)
  })

  it('deduplicates Trace contribution while preserving attribution and dataset links', () => {
    const state = createInitialEvolutionData()
    const contribution = (state.assetEvolutionContributions ?? []).find(item => item.traceIds.length > 0)
    expect(contribution).toBeDefined()
    expect(new Set(contribution!.traceIds).size).toBe(contribution!.traceIds.length)
    expect(selectAssetEvolutionHistory(state, contribution!.assetId, contribution!.assetVersionId).some(item => item.evolutionRecordId === contribution!.evolutionRecordId)).toBe(true)
    expect(selectAssetPerformance(state, { assetId: contribution!.assetId }).every(item => item.traceId.length > 0)).toBe(true)
  })

  it('keeps only trigger or cluster attribution datasets in evolution history', () => {
    const state = createInitialEvolutionData()
    const contributions = state.assetEvolutionContributions ?? []
    const datasets = new Map(state.datasets.map(item => [item.id, item]))
    for (const contribution of contributions) {
      const record = state.evolutionRecords?.find(item => item.id === contribution.evolutionRecordId)
      const traceDatasetIds = new Set((state.datasetMemberships ?? [])
        .filter(item => item.scope === 'TRACE' && item.traceIds.some(traceId => contribution.traceIds.includes(traceId)))
        .map(item => item.datasetId))
      for (const datasetId of contribution.datasetIds) {
        const dataset = datasets.get(datasetId)
        const isClusterAttribution = Boolean(record && (record.optimizationMode === 'CLUSTER_OPTIMIZATION' || record.sourceClusterIds.length > 0) && dataset && dataset.type === 'ATTRIBUTION')
        const isTriggerAttribution = Boolean(dataset && dataset.type === 'ATTRIBUTION' && dataset.datasetCategory !== 'GOLDEN' && dataset.setRole !== 'GATE' && dataset.setRole !== 'GOLDEN')
        expect(traceDatasetIds.has(datasetId) || isClusterAttribution || isTriggerAttribution).toBe(true)
      }
    }
  })

  it('does not borrow another module, attribution or version dataset from a shared Trace', () => {
    const state = createInitialEvolutionData()
    const record = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-taste-executive' && item.target.skillVersion === '0.9.0' && item.target.attributionId === 'taste-recall')!
    expect(record.target.kind).toBe('SKILL')
    if (record.target.kind !== 'SKILL') throw new Error('Fixture must target a Skill')
    const trace = state.traces[0]
    const template = state.datasets.find(item => item.type === 'ATTRIBUTION')!
    const target = { skillId: record.target.skillId, skillVersion: 'taste-0.9.0', attributionId: record.target.attributionId, evolutionItemId: record.target.attributionId }
    const candidates = [
      { ...template, id: 'source-exact', targets: [target], setRole: 'EVALUATION' as const },
      { ...template, id: 'source-other-version', targets: [{ ...target, skillVersion: '1.0.0-rc.1' }] },
      { ...template, id: 'source-other-attribution', targets: [{ ...target, attributionId: 'taste-quality', evolutionItemId: 'taste-quality' }] },
      { ...template, id: 'source-memory', targets: [] },
      { ...template, id: 'source-gate', targets: [target], setRole: 'GATE' as const },
      { ...template, id: 'source-regression', targets: [target], type: 'REGRESSION' as const }
    ]
    state.datasets = candidates
    state.datasetMemberships = candidates.map(dataset => ({ id: `member-${dataset.id}`, datasetId: dataset.id, datasetVersion: dataset.version, caseId: trace.caseId, traceIds: [trace.id], scope: 'TRACE' as const, joinedAt: trace.createdAt, actor: 'Demo Seeder', origin: 'MOCK' as const }))
    const scopedRecord = { ...record, datasetIds: candidates.map(item => item.id) }
    expect(selectAssetEvolutionSourceDatasetIds(state, scopedRecord, [trace.id])).toEqual(['source-exact'])
  })

  it('preserves a module-owned attribution set without inferring unrelated module sets from Trace membership', () => {
    const state = createInitialEvolutionData()
    const record = state.evolutionRecords!.find(item => item.target.kind === 'MODULE' && item.target.governanceObject === 'Memory')!
    const trace = state.traces[0]
    const template = state.datasets.find(item => item.type === 'ATTRIBUTION')!
    state.datasets = [{ ...template, id: 'owned-memory', targets: [], setRole: 'EVALUATION' }, { ...template, id: 'unrelated-memory', targets: [], setRole: 'EVALUATION' }]
    state.datasetMemberships = state.datasets.map(dataset => ({ id: `member-${dataset.id}`, datasetId: dataset.id, datasetVersion: dataset.version, caseId: trace.caseId, traceIds: [trace.id], scope: 'TRACE' as const, joinedAt: trace.createdAt, actor: 'Demo Seeder', origin: 'MOCK' as const }))
    expect(selectAssetEvolutionSourceDatasetIds(state, { ...record, datasetIds: ['owned-memory'] }, [trace.id])).toEqual(['owned-memory'])
  })

  it('recovers legacy workspace source datasets by exact version and attribution without Trace membership rows', () => {
    const state = createInitialEvolutionData()
    const quality = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-taste-executive' && item.target.skillVersion === '0.9.0' && item.target.attributionId === 'taste-quality' && item.sourceFindingIds.some(id => id.includes('workspace-taste-090-quality')))!
    const recall = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-taste-executive' && item.target.skillVersion === '1.0.0-rc.1' && item.target.attributionId === 'taste-recall' && item.sourceFindingIds.some(id => id.includes('workspace-taste-100rc-recall')))!
    const qualityIds = selectAssetEvolutionSourceDatasetIds(state, quality)
    const recallIds = selectAssetEvolutionSourceDatasetIds(state, recall)
    expect(qualityIds).toContain('dataset-workspace-taste-090-quality-attribution')
    expect(qualityIds).not.toContain('dataset-workspace-taste-100rc-recall-attribution')
    expect(recallIds).toContain('dataset-workspace-taste-100rc-recall-attribution')
    expect(recallIds).not.toContain('dataset-workspace-taste-100rc-shortage-attribution')
    expect(recallIds).not.toContain('dataset-workspace-taste-100rc-recall-generalization')
    const qualityContribution = state.assetEvolutionContributions!.find(item => item.evolutionRecordId === quality.id)!
    expect(qualityContribution.attributionLabel).toBe('品味库资产质量')
  })

  it('obeys explicit Trace or Case-shared source enrollment instead of legacy Case membership', () => {
    const state = createInitialEvolutionData()
    const record = state.evolutionRecords!.find(item => item.target.kind === 'SKILL' && item.target.skillId === 'skill-taste-executive' && item.target.skillVersion === '0.9.0' && item.target.attributionId === 'taste-quality' && item.sourceFindingIds.some(id => id.includes('workspace-taste-090-quality')))!
    const dataset = state.datasets.find(item => item.id === 'dataset-workspace-taste-090-quality-attribution')!
    const source = state.evaluationFindings.find(item => record.sourceFindingIds.includes(item.id))!
    const unrelated = state.traces.find(item => item.id !== source.traceId && item.caseId !== source.caseId)!
    const member = { id: 'member-narrow-source', datasetId: dataset.id, datasetVersion: dataset.version, caseId: source.caseId, traceIds: [unrelated.id], scope: 'TRACE' as const, actor: 'Demo Seeder', origin: 'MOCK' as const }
    state.datasetMemberships!.push(member)
    expect(selectAssetEvolutionSourceDatasetIds(state, record)).not.toContain(dataset.id)
    state.datasetMemberships = state.datasetMemberships!.map(item => item.id === member.id ? { ...item, scope: 'CASE_SHARED' } : item)
    expect(selectAssetEvolutionSourceDatasetIds(state, record)).toContain(dataset.id)
  })

  it('repairs stale generated current-version metadata and cross-module links without removing local rows', () => {
    const state = createInitialEvolutionData()
    const catalog = state.assetCatalog!.find(item => item.skillId === 'skill-taste-executive')!
    const stale = state.assetVersions!.find(item => item.assetId === catalog.id && item.version === '0.8.0')!
    catalog.currentVersionId = stale.id
    stale.status = 'ACTIVE'
    const contribution = state.assetEvolutionContributions!.find(item => item.assetId === catalog.id)!
    contribution.datasetIds = ['dataset-module-path-demo-memory', 'dataset-module-path-demo-1']
    const local = { ...state.assetPerformanceRecords![0], id: 'local-preserved-score', score: 1.37 }
    state.assetPerformanceRecords!.push(local)
    const repaired = enrichAssetManagementFixtures(state)
    expect(repaired.assetVersions!.find(item => item.id === repaired.assetCatalog!.find(item => item.id === catalog.id)!.currentVersionId)?.version).toBe('0.9.0')
    expect(repaired.assetEvolutionContributions!.find(item => item.id === contribution.id)?.datasetIds).not.toEqual(expect.arrayContaining(['dataset-module-path-demo-memory', 'dataset-module-path-demo-1']))
    expect(repaired.assetPerformanceRecords!.find(item => item.id === local.id)).toEqual(local)
    expect(enrichAssetManagementFixtures(repaired)).toEqual(repaired)
  })

  it('registers the actual historical source version instead of assigning an unknown version to current', () => {
    const state = createInitialEvolutionData()
    const contribution = state.assetEvolutionContributions!.find(item => item.assetId === 'asset-catalog-skill-taste-executive')!
    const record = state.evolutionRecords!.find(item => item.id === contribution.evolutionRecordId)!
    if (record.target.kind !== 'SKILL') throw new Error('Fixture must target a Skill')
    record.target.skillVersion = 'taste-3.0.0'
    const repaired = enrichAssetManagementFixtures(state)
    const historical = repaired.assetVersions!.find(item => item.assetId === contribution.assetId && item.version === '3.0.0')!
    expect(historical.status).toBe('DEPRECATED')
    expect(repaired.assetEvolutionContributions!.find(item => item.id === contribution.id)?.assetVersionId).toBe(historical.id)
    expect(repaired.assetCatalog!.find(item => item.id === contribution.assetId)?.currentVersionId).not.toBe(historical.id)
  })

  it('uses exact source evidence Traces instead of every sibling Trace in an Issue Case', () => {
    const state = createInitialEvolutionData()
    const record = state.evolutionRecords!.find(item => item.id === 'evolution-module-path-demo-sop-agent')!
    const finding = state.evaluationFindings.find(item => record.sourceFindingIds.includes(item.id))!
    const task = state.cases.find(item => item.id === finding.caseId)!
    expect(task.traceIds.length).toBeGreaterThan(1)
    const repaired = enrichAssetManagementFixtures(state)
    expect(repaired.assetEvolutionContributions!.find(item => item.evolutionRecordId === record.id)?.traceIds).toEqual([finding.traceId])
  })

  it('preserves an edited generated performance row without duplicating its canonical Trace/version', () => {
    const state = createInitialEvolutionData()
    const performance = state.assetPerformanceRecords!.find(item => item.assetId === 'asset-catalog-skill-taste-executive')!
    performance.score = 1.37
    state.auditTrail.push({ id: 'audit-edited-performance', at: state.updatedAt, actor: '当前用户', action: 'UPDATE', entityType: 'assetPerformanceRecord', entityId: performance.id, reason: '保留历史人工记录', changes: { score: 1.37 } })
    const repaired = enrichAssetManagementFixtures(state)
    expect(repaired.assetPerformanceRecords!.filter(item => item.assetId === performance.assetId && item.traceId === performance.traceId && item.assetVersionId === performance.assetVersionId)).toEqual([performance])
  })

  it('is idempotent for a pre-asset snapshot upgrade', () => {
    const original = createInitialEvolutionData()
    const upgraded = enrichAssetManagementFixtures({ ...original, assetCatalog: undefined, assetVersions: undefined, assetPerformanceRecords: undefined, assetEvolutionContributions: undefined })
    const again = enrichAssetManagementFixtures(upgraded)
    expect(again.assetCatalog?.length).toBe(upgraded.assetCatalog?.length)
    expect(again.assetPerformanceRecords?.length).toBe(upgraded.assetPerformanceRecords?.length)
  })
})
