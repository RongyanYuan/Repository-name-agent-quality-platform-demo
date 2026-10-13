import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData, EVOLUTION_SEED_VERSION } from './data'
import { EVOLUTION_SCHEMA_VERSION, EvolutionDataService, EvolutionLoadError, createLocalEvolutionRepository } from './repository'
import { resolveIdentity } from './identity'
import { evolutionReducer } from './store'
import type { Experiment } from './domain'
import { automaticOutcomeRevisionId } from './outcomeReviews'
import { selectArtifactOutcomeEvaluations } from './data/artifactOutcomes'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

class BrowserQuotaStorage extends MemoryStorage {
  setItem(key: string, value: string) {
    if (key.length + value.length > 5_000_000) throw new DOMException('Browser localStorage quota exceeded', 'QuotaExceededError')
    super.setItem(key, value)
  }
}

function legacySeedState() {
  const state = createInitialEvolutionData()
  const aliases = state.identityAliases ?? []
  const legacyFor = (kind: 'trace' | 'session', id: string) => aliases.find(alias => alias.kind === kind && alias.canonicalId === id)?.alias ?? id
  const visit = (value: unknown, key = ''): unknown => {
    if (['configSnapshot', 'evaluationSnapshot', 'evalSnapshot', 'reportSnapshot', 'automaticSnapshot'].includes(key)) return value
    if (Array.isArray(value)) {
      if (['traceIds', 'processedTraceIds', 'failedTraceIds', 'conversationTraceIds'].includes(key)) return value.map(id => legacyFor('trace', id as string))
      return value.map(item => visit(item))
    }
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, field === 'traceId' ? legacyFor('trace', item as string) : field === 'sessionId' ? legacyFor('session', item as string) : visit(item, field)]))
  }
  const legacy = visit(state) as typeof state
  legacy.sessions = legacy.sessions.map(session => ({ ...session, id: legacyFor('session', session.id) }))
  legacy.traces = legacy.traces.map(trace => ({ ...trace, id: legacyFor('trace', trace.id) }))
  legacy.identityAliases = []
  legacy.seedVersion = 'office-agent-governance-demo-2.4.1'
  return legacy
}

describe('local evolution repository', () => {
  it('adds explicit module evolution bindings to an older seed without losing manual scores or frozen reports',()=>{
    const storage=new MemoryStorage(),repository=createLocalEvolutionRepository({storage,storageKey:'module-upgrade'})
    const old=createInitialEvolutionData();old.seedVersion='office-agent-governance-demo-2.6.0'
    for(const [key,value] of Object.entries(old))if(Array.isArray(value))(old as unknown as Record<string,unknown>)[key]=value.filter(item=>!item || typeof item!=='object' || !String((item as {id?:string}).id).includes('module-path-demo'))
    delete old.moduleEvolutionBindings;delete old.evolutionRecords
    old.issues=old.issues.map(issue=>({...issue,clusterIds:issue.clusterIds.filter(id=>old.issueClusters.some(cluster=>cluster.id===id))}))
    old.cases=old.cases.map(record=>({...record,issueIds:record.issueIds.filter(id=>old.issues.some(issue=>issue.id===id)),attributionIds:record.attributionIds.filter(id=>old.attributions.some(attribution=>attribution.id===id))}))
    const score=old.tracePackages.find(pkg=>pkg.id==='package-trace-ppt-generate')!.moduleScores.find(item=>item.moduleCode==='SKILL')!
    score.humanScore=1.25;score.humanStatus='FAIL';score.humanNote='保留模块人工说明'
    const frozen=structuredClone(old.gateDecisions)
    repository.save(old)
    const upgraded=repository.load()
    expect(upgraded.moduleEvolutionBindings!.length).toBeGreaterThan(0)
    expect(upgraded.tracePackages.find(pkg=>pkg.id==='package-trace-ppt-generate')!.moduleScores.find(item=>item.moduleCode==='SKILL')).toMatchObject({humanScore:1.25,humanNote:'保留模块人工说明'})
    expect(upgraded.gateDecisions.filter(item=>frozen.some(original=>original.id===item.id))).toEqual(frozen)
    expect(upgraded.issues.find(item=>item.id==='issue-style-mismatch')?.clusterIds).toContain('cluster-module-path-demo-taste')
    repository.save(upgraded)
    expect(repository.load().evolutionRecords).toEqual(upgraded.evolutionRecords)
  })
  it('reloads additive outcome reviews through a seed upgrade without changing the automatic record or frozen reports', () => {
    const storage = new MemoryStorage()
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'outcome-review-upgrade' })
    let state = createInitialEvolutionData()
    const evaluation = state.outcomeEvals.find(item => item.id === 'outcome-eval-ppt-style')!
    const original = structuredClone({ evaluation, reports: state.gateDecisions, experiments: state.experiments, runs: state.experimentRuns })
    state = evolutionReducer(state, { type: 'REVIEW_OUTCOME_DIMENSION', input: { traceId: evaluation.traceId, artifactId: evaluation.artifactId, evaluationId: evaluation.id, automaticRevisionId: automaticOutcomeRevisionId(evaluation), humanScore: 2, verdict: 'UNKNOWN', reason: '产物独立复核保留', reviewer: '复核员', reviewedAt: '2026-10-12T02:00:00Z', reviewId: 'outcome-reload-review' }, meta: { actor: '复核员', reason: '产物独立复核保留', at: '2026-10-12T02:00:00Z' } })
    state.seedVersion = 'office-agent-governance-demo-2.5.0'
    repository.save(state)
    const loaded = repository.load()
    const updated = loaded.outcomeEvals.find(item => item.id === evaluation.id)!
    expect(updated.revisions.at(-1)).toMatchObject({ id: 'outcome-reload-review', score: 2, automaticRevisionId: automaticOutcomeRevisionId(evaluation), automaticSnapshot: { score: 0.48, scoreScale: '0-1' } })
    expect(updated.score).toBe(original.evaluation.score)
    expect(updated.revisions.filter(item => item.source === 'AUTOMATIC')).toEqual(original.evaluation.revisions.filter(item => item.source === 'AUTOMATIC'))
    expect(selectArtifactOutcomeEvaluations(loaded, evaluation.traceId).find(item => item.artifact.id === evaluation.artifactId)?.dimensions.find(item => item.evaluation.id === evaluation.id)?.humanScore).toBe(2)
    expect({ reports: loaded.gateDecisions, experiments: loaded.experiments, runs: loaded.experimentRuns }).toEqual({ reports: original.reports, experiments: original.experiments, runs: original.runs })
    expect(repository.load()).toEqual(loaded)
  })
  it('round-trips a snapshot and isolates callers from stored object mutation', () => {
    const storage = new MemoryStorage()
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' })
    const changed = createInitialEvolutionData()
    changed.cases[0].status = 'RESOLVED'

    repository.save(changed)
    changed.cases[0].status = 'NEW'

    expect(repository.load().cases[0].status).toBe('RESOLVED')
  })

  it('saves and reloads a created completed multi-dataset experiment within the browser storage quota without losing evidence', () => {
    const storage = new BrowserQuotaStorage()
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'bounded-experiment' })
    let state = createInitialEvolutionData()
    const datasets = state.datasets.filter(dataset => dataset.frozen && dataset.type !== 'WINDOW_ONLINE')
    const at = '2026-09-28T10:00:00.000Z'
    const experiment: Experiment = {
      id: 'exp-storage-quota', name: '完整评测集实验', level: 'SINGLE_VARIANT', variantIds: ['variant-reason-office-plan'],
      datasetIds: datasets.map(dataset => dataset.id), baselineVersion: 'reason-current', candidateVersion: 'reason-candidate',
      configSnapshot: { datasetVersions: datasets.map(dataset => ({ datasetId: dataset.id, version: dataset.version, versionId: `${dataset.id}@${dataset.version}`, sampleCount: dataset.sampleCount })), model: 'mock-model', toolPermissions: ['office.read'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'local-mock-runner', createdAt: at },
      runIds: [], metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'DRAFT', createdAt: at, updatedAt: at
    }
    const meta = { actor: '测试用户', reason: '验证完整快照保存', at }
    state = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment, meta })
    state = evolutionReducer(state, { type: 'START_EXPERIMENT_RUN', experimentId: experiment.id, meta })
    state = evolutionReducer(state, { type: 'COMPLETE_EXPERIMENT_RUN', experimentId: experiment.id, meta })
    const completed = state.experiments.find(item => item.id === experiment.id)!
    expect(completed.status).toBe('COMPLETED')
    expect(completed.configSnapshot.evaluationSnapshot?.rootEvidence.length).toBeGreaterThan(0)
    expect(() => repository.save(state)).not.toThrow()
    const envelope = JSON.parse(storage.getItem('bounded-experiment')!)
    expect(Array.isArray(envelope.state.cases)).toBe(true)
    const loaded = repository.load()
    expect(loaded.experiments.find(item => item.id === experiment.id)?.configSnapshot).toEqual(completed.configSnapshot)
    expect(loaded.experimentRuns.filter(run => run.experimentId === experiment.id)).toEqual(state.experimentRuns.filter(run => run.experimentId === experiment.id))
    expect(loaded.auditTrail).toEqual(state.auditTrail)
  })

  it('retains a frozen historical report run instead of replacing it with the current run on reload', () => {
    const state = createInitialEvolutionData()
    const reportRun = state.gateDecisions.find(decision => decision.id === 'gate-single-ppt-routing')!.reportSnapshot.runSnapshots![0]
    reportRun.evalSnapshot!.evalAgentVersion = 'historical-eval-agent-v1'
    reportRun.evalSnapshot!.moduleEvaluations[0].judgeReason = '历史 Judge Reason：用户要求管理层受众，依据原始日志与 Rubric。'
    const frozenRun = structuredClone(reportRun)
    const repository = createLocalEvolutionRepository({ storage: new MemoryStorage(), storageKey: 'frozen-report' })
    repository.save(state)
    const loaded = repository.load()
    expect(loaded.gateDecisions.find(decision => decision.id === 'gate-single-ppt-routing')?.reportSnapshot.runSnapshots?.[0]).toEqual(frozenRun)
    expect(loaded.auditTrail.at(-1)?.action).not.toBe('SCHEMA_RESET')
  })

  it('continues to load an uncompressed same-schema JSON envelope', () => {
    const storage = new MemoryStorage()
    const state = createInitialEvolutionData()
    state.cases[0].title = '旧版 JSON 中保留的人工标题'
    storage.setItem('legacy-plain', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, state, savedAt: '2026-09-28T10:00:00.000Z' }))
    const loaded = createLocalEvolutionRepository({ storage, storageKey: 'legacy-plain' }).load()
    expect(loaded.cases[0].title).toBe('旧版 JSON 中保留的人工标题')
    expect(loaded.gateDecisions[0].reportSnapshot.configSnapshot).toEqual(state.gateDecisions[0].reportSnapshot.configSnapshot)
  })

  it('retains incompatible raw schema data and exposes a readable diagnostic', () => {
    const storage = new MemoryStorage()
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION - 1, state: { cases: [] } }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' })

    const raw = storage.getItem('evolution-test')
    expect(() => repository.load()).toThrow(EvolutionLoadError)
    expect(storage.getItem('evolution-test')).toBe(raw)
  })

  it('migrates a complete V1 snapshot additively without replacing edited Cases', () => {
    const storage = new MemoryStorage()
    const v1 = createInitialEvolutionData()
    v1.schemaVersion = EVOLUTION_SCHEMA_VERSION - 1
    const editedCase = v1.cases[0].id
    v1.cases[0].title = 'V1 用户编辑标题'
    const legacy = { ...v1 } as Partial<typeof v1>
    delete legacy.evaluationBatches
    delete legacy.evaluationJobs
    delete legacy.tracePackages
    delete legacy.evaluationFindings
    delete legacy.routingPolicies
    delete legacy.routingDecisions
    delete legacy.routingDeliveries
    delete legacy.algorithmBadcases
    delete legacy.badcaseQueues
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION - 1, state: legacy }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test', now: () => '2026-09-30T12:00:00.000Z', idFactory: () => 'audit-migrated' })

    const migrated = repository.load()

    expect(migrated.cases.find((item) => item.id === editedCase)?.title).toBe('V1 用户编辑标题')
    expect(migrated.tracePackages.length).toBe(migrated.traces.length)
    const pptPackage = migrated.tracePackages.find((item) => item.traceId === resolveIdentity(migrated, 'trace', 'trace-ppt-generate'))!
    expect(pptPackage.processCoverage).toBe('COMPLETE')
    expect(pptPackage.outcomeCoverage).toBe('COMPLETE')
    expect(pptPackage.moduleScores.some((item) => item.moduleCode === 'SKILL' && item.automaticStatus === 'FAIL')).toBe(true)
    expect(migrated.attributions.find((item) => item.id === 'attribution-skill-recall')?.legacyRawLabel).toBe('skill sop错误')
    expect(migrated.auditTrail.at(-1)).toMatchObject({ action: 'SCHEMA_MIGRATED', id: 'audit-migrated' })
  })

  it('preserves an invalid same-schema graph without writing replacement seed data', () => {
    const storage = new MemoryStorage()
    const invalid = createInitialEvolutionData()
    invalid.cases[0].traceIds = ['trace-does-not-exist']
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: '2026-09-28T00:00:00.000Z', state: invalid }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test', now: () => '2026-09-28T12:00:00.000Z', idFactory: () => 'audit-invalid-graph' })

    const raw = storage.getItem('evolution-test')
    expect(() => repository.load()).toThrow(/trace-does-not-exist/)
    expect(storage.getItem('evolution-test')).toBe(raw)
  })

  it('supports reset and a service abstraction over persistence', () => {
    const repository = createLocalEvolutionRepository({ storage: new MemoryStorage(), storageKey: 'evolution-test' })
    const service = new EvolutionDataService(repository)
    const changed = service.load()
    changed.cases = []
    service.save(changed)

    const reset = service.reset('测试员', '恢复演示数据')

    expect(service.load().cases.length).toBeGreaterThanOrEqual(3)
    expect(reset.auditTrail.at(-1)).toMatchObject({ action: 'DATA_RESET', actor: '测试员', reason: '恢复演示数据' })
  })

  it('loads historical Experiment snapshots after the current Dataset advances', () => {
    const storage = new MemoryStorage()
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'dataset-history-test', now: () => '2026-09-28T12:00:00.000Z' })
    const state = createInitialEvolutionData()
    const snapshot = structuredClone(state.experiments.find((item) => item.id === 'exp-single-ppt-routing')!.configSnapshot.datasetVersions)
    const dataset = state.datasets.find((item) => item.id === 'dataset-attribution')!
    dataset.version = 'v2.0'
    dataset.caseIds = ['case-ppt-management', 'case-tool-export']
    dataset.sampleCount = 2
    dataset.population = { ...dataset.population, localCaseCount: 2, externalSampleCount: 0, totalSampleCount: 2 }
    repository.save(state)

    const loaded = repository.load()

    expect(loaded.datasets.find((item) => item.id === dataset.id)?.version).toBe('v2.0')
    expect(loaded.experiments.find((item) => item.id === 'exp-single-ppt-routing')?.configSnapshot.datasetVersions).toEqual(snapshot)
    expect(loaded.auditTrail.at(-1)?.action).not.toBe('SCHEMA_RESET')
  })

  it('upgrades an existing Mock snapshot with new evaluation fixtures without deleting human edits', () => {
    const storage = new MemoryStorage()
    const old = createInitialEvolutionData()
    old.seedVersion = 'office-agent-governance-demo-2.0.0'
    const generated = old.cases.find((item) => item.id === 'case-v2-05')!
    generated.resultStatus = 'UNKNOWN'
    generated.processStatus = 'UNKNOWN'
    generated.status = 'NEW'
    generated.title = '保留的人工标题'
    old.tastePreferenceSignals = []
    old.auditTrail.push({ id: 'audit-human-preserved', at: '2026-10-08T00:00:00.000Z', actor: '质量运营', action: 'UPDATE_CASE', entityType: 'Case', entityId: generated.id, reason: '保留人工编辑', changes: { title: '保留的人工标题' } })
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: '2026-10-08T00:00:00.000Z', state: old }))
    const loaded = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' }).load()

    expect(loaded.tastePreferenceSignals).toHaveLength(1)
    expect(loaded.cases.find((item) => item.id === generated.id)?.title).toBe('保留的人工标题')
    expect(loaded.cases.some((item) => item.labels.includes('批量偏好聚合'))).toBe(true)
    expect(loaded.auditTrail.some((event) => event.id === 'audit-human-preserved')).toBe(true)
  })

  it('upgrades a partially seeded 2.2 snapshot with the complete Skill catalog and history', () => {
    const storage = new MemoryStorage()
    const old = createInitialEvolutionData()
    old.seedVersion = 'office-agent-governance-demo-2.2.0'
    old.skills = old.skills.filter((skill) => ['skill-ppt-builder', 'skill-taste-executive', 'skill-personal-planned', 'skill-general-docs', 'skill-unclassified', 'skill-spreadsheet'].includes(skill.id))
    old.variants = old.variants.filter((variant) => ['variant-ppt-routing-v3', 'variant-tool-retry-v2', 'variant-memory-latest', 'variant-reason-office-plan', 'variant-taste-red-v1'].includes(variant.id))
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: '2026-10-08T00:00:00.000Z', state: old }))
    const loaded = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' }).load()

    expect(loaded.skills.map((skill) => skill.id)).toEqual(expect.arrayContaining(['skill-word-builder', 'skill-taste-ppt-template-1', 'skill-taste-excel-template-1']))
    expect(loaded.skills.find((skill) => skill.id === 'skill-ppt-builder')?.evolutionHistory?.length).toBeGreaterThanOrEqual(5)
    expect(loaded.seedVersion).toBe(EVOLUTION_SEED_VERSION)
  })

  it('migrates Trace provenance and rating metadata into an older local snapshot', () => {
    const storage = new MemoryStorage()
    const old = createInitialEvolutionData()
    old.seedVersion = 'office-agent-governance-demo-2.1.0'
    old.traces = old.traces.map(trace => ({ ...trace, channel: undefined, verticalScenario: undefined, queryAt: undefined }))
    old.cases = old.cases.map(record => ({ ...record, channel: undefined, verticalScenario: undefined }))
    old.tracePackages = old.tracePackages.map(pkg => ({ ...pkg, rating: undefined }))
    old.datasets = old.datasets.map(dataset => ({ ...dataset, purpose: undefined, targets: undefined }))
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: '2026-10-08T00:00:00.000Z', state: old }))
    const loaded = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' }).load()
    expect(loaded.traces.every(trace => trace.channel && trace.verticalScenario)).toBe(true)
    expect(loaded.cases.every(record => record.channel && record.verticalScenario)).toBe(true)
    expect(loaded.tracePackages.some(pkg => pkg.rating?.scale === '0-2')).toBe(true)
    expect(loaded.datasets.some(dataset => dataset.purpose)).toBe(true)
  })

  it('loads raw legacy seed IDs twice without duplicating entities or losing human records and frozen snapshots', () => {
    const old = legacySeedState()
    const traceCount = old.traces.length
    const sessionCount = old.sessions.length
    old.cases[0].title = '迁移保留人工标题'
    old.tracePackages[0].moduleScores[0].humanScore = 0
    old.tracePackages[0].moduleScores[0].humanStatus = 'FAIL'
    old.tracePackages[0].moduleScores[0].humanNote = '人工原始说明 trace-ppt-context'
    old.evidence[0].content = '原始 Evidence trace-ppt-generate'
    old.auditTrail.push({ id: 'audit-identity-human', action: 'HUMAN_SCORE', actor: '审核人', entityType: 'Trace', entityId: 'trace-ppt-context', at: '2026-10-10T00:00:00.000Z', reason: '保留记录' })
    const frozen = JSON.stringify({ experiments: old.experiments.map(item => item.configSnapshot), runs: old.experimentRuns, reports: old.gateDecisions })
    const storage = new MemoryStorage()
    storage.setItem('identity-legacy', JSON.stringify({ schemaVersion: 2, state: old }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'identity-legacy' })
    const first = repository.load()
    const second = repository.load()
    expect(first.traces).toHaveLength(traceCount)
    expect(first.sessions).toHaveLength(sessionCount)
    expect(second).toEqual(first)
    expect(second.traces.every(trace => /^\d{18,24}$/.test(trace.id))).toBe(true)
    expect(second.cases[0].title).toBe('迁移保留人工标题')
    expect(second.tracePackages[0].moduleScores[0]).toMatchObject({ humanScore: 0, humanStatus: 'FAIL', humanNote: '人工原始说明 trace-ppt-context' })
    expect(second.evidence[0].content).toBe(old.evidence[0].content)
    expect(second.auditTrail.some(event => event.id === 'audit-identity-human')).toBe(true)
    expect(JSON.stringify({ experiments: second.experiments.map(item => item.configSnapshot), runs: second.experimentRuns, reports: second.gateDecisions })).toBe(frozen)
    expect(resolveIdentity(second, 'trace', 'trace-ppt-generate')).toBe(second.cases[0].traceIds[1])
  })

  it('preserves raw storage on an alias conflict and makes the original data available for export', () => {
    const old = createInitialEvolutionData()
    old.identityAliases = [
      { kind: 'trace', alias: 'conflicting-old-trace', canonicalId: old.traces[0].id },
      { kind: 'trace', alias: 'conflicting-old-trace', canonicalId: old.traces[1].id }
    ]
    const raw = JSON.stringify({ schemaVersion: 2, state: old })
    const storage = new MemoryStorage()
    storage.setItem('identity-conflict', raw)
    try {
      createLocalEvolutionRepository({ storage, storageKey: 'identity-conflict' }).load()
      expect.fail('An alias conflict must stop loading')
    } catch (error) {
      expect(error).toBeInstanceOf(EvolutionLoadError)
      expect((error as EvolutionLoadError).rawData).toBe(raw)
      expect((error as Error).message).toContain('conflicting-old-trace')
    }
    expect(storage.getItem('identity-conflict')).toBe(raw)
  })

  it('keeps an already assigned numeric seed identity during later fixture upgrades', () => {
    const old = createInitialEvolutionData()
    old.seedVersion = 'office-agent-governance-demo-2.4.1'
    const original = resolveIdentity(old, 'trace', 'trace-ppt-generate')
    const assigned = '000719925474099201'
    old.traces.find(trace => trace.id === original)!.id = assigned
    old.identityAliases!.push({ kind: 'trace', alias: original, canonicalId: assigned })
    const storage = new MemoryStorage()
    storage.setItem('assigned-identity', JSON.stringify({ schemaVersion: 2, state: old }))
    const loaded = createLocalEvolutionRepository({ storage, storageKey: 'assigned-identity' }).load()
    expect(resolveIdentity(loaded, 'trace', 'trace-ppt-generate')).toBe(assigned)
    expect(loaded.traces).toHaveLength(old.traces.length)
    expect(loaded.traces.some(trace => trace.id === original)).toBe(false)
    expect(loaded.cases[0].traceIds[1]).toBe(assigned)
  })

  it('migrates raw old-schema named IDs before constructing the compatibility evaluation ledger', () => {
    const old = legacySeedState()
    old.schemaVersion = 1
    old.cases[0].title = '旧 ID 和旧 Schema 的人工标题'
    const legacy = { ...old } as Partial<typeof old>
    for (const key of ['evaluationBatches', 'evaluationJobs', 'tracePackages', 'evaluationFindings', 'routingPolicies', 'routingDecisions', 'routingDeliveries', 'algorithmBadcases', 'badcaseQueues', 'tastePreferenceSignals'] as const) delete legacy[key]
    const storage = new MemoryStorage()
    storage.setItem('legacy-identity-schema', JSON.stringify({ schemaVersion: 1, state: legacy }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'legacy-identity-schema' })
    const loaded = repository.load()
    expect(loaded.cases[0].title).toBe('旧 ID 和旧 Schema 的人工标题')
    expect(loaded.tracePackages.find(pkg => pkg.traceId === resolveIdentity(loaded, 'trace', 'trace-ppt-generate'))?.moduleScores.some(score => score.moduleCode === 'SKILL' && score.automaticStatus === 'FAIL')).toBe(true)
    expect(repository.load()).toEqual(loaded)
  })

  it('adds new governance fixtures atomically to an older seed while leaving its frozen reports intact', () => {
    const old = legacySeedState()
    for (const [key, value] of Object.entries(old)) {
      if (Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null)) {
        ;(old as unknown as Record<string, unknown>)[key] = value.filter(item => !String((item as { id?: string }).id ?? '').includes('governance-demo'))
      }
    }
    old.identityAliases = []
    delete old.moduleReviews
    delete old.datasetMemberships
    delete old.governanceEvents
    const snapshots = old.gateDecisions.map(item => ({ id: item.id, reportSnapshot: structuredClone(item.reportSnapshot) }))
    const storage = new MemoryStorage()
    storage.setItem('governance-seed-upgrade', JSON.stringify({ schemaVersion: 2, state: old }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'governance-seed-upgrade' })
    const loaded = repository.load()
    const demoTrace = resolveIdentity(loaded, 'trace', 'trace-governance-demo-ppt')
    expect(loaded.traces.some(trace => trace.id === demoTrace)).toBe(true)
    expect(loaded.moduleReviews?.filter(review => review.traceId === demoTrace)).toHaveLength(2)
    expect(loaded.datasetMemberships?.some(membership => membership.traceIds.includes(demoTrace))).toBe(true)
    expect(loaded.governanceEvents?.some(event => event.traceId === demoTrace)).toBe(true)
    for (const snapshot of snapshots) expect(loaded.gateDecisions.find(item => item.id === snapshot.id)?.reportSnapshot).toEqual(snapshot.reportSnapshot)
    expect(repository.load()).toEqual(loaded)
  })

  it('backfills recorded legacy module reviews once after identity migration without changing automatic evidence', () => {
    const old = legacySeedState()
    const score = old.tracePackages[0].moduleScores.find(item => item.moduleCode === 'SKILL')!
    score.humanStatus = 'FAIL'; score.humanScore = 0; score.humanNote = '已有人工复核说明'; score.humanUpdatedAt = '2026-10-10T03:00:00.000Z'; score.humanUpdatedBy = '历史审核人'
    const automatic = structuredClone({ score: score.score, judgeReason: score.judgeReason, evidence: score.evidence })
    const storage = new MemoryStorage()
    storage.setItem('legacy-review-identity', JSON.stringify({ schemaVersion: 2, state: old }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'legacy-review-identity' })
    const first = repository.load()
    const second = repository.load()
    const revisions = second.moduleReviews?.filter(item => item.moduleScoreId === score.id) ?? []
    expect(revisions).toHaveLength(1)
    expect(revisions[0]).toMatchObject({ traceId: resolveIdentity(second, 'trace', old.tracePackages[0].traceId), humanScore: 0, reason: '已有人工复核说明', reviewer: '历史审核人', origin: 'LEGACY' })
    const loaded = second.tracePackages[0].moduleScores.find(item => item.id === score.id)!
    expect({ score: loaded.score, judgeReason: loaded.judgeReason, evidence: loaded.evidence }).toEqual(automatic)
    expect(second.moduleReviews).toEqual(first.moduleReviews)
  })
})
