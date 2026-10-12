import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData, EVOLUTION_SEED_VERSION } from './data'
import { EVOLUTION_SCHEMA_VERSION, EvolutionDataService, createLocalEvolutionRepository } from './repository'
import { evolutionReducer } from './store'
import type { Experiment } from './domain'

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

describe('local evolution repository', () => {
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

  it('recovers incompatible schema data with an explicit audit event', () => {
    const storage = new MemoryStorage()
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION - 1, state: { cases: [] } }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' })

    const recovered = repository.load()

    expect(recovered.cases.length).toBeGreaterThanOrEqual(3)
    expect(recovered.auditTrail.at(-1)).toMatchObject({ action: 'SCHEMA_RESET', entityType: 'EvolutionState' })
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
    const pptPackage = migrated.tracePackages.find((item) => item.traceId === 'trace-ppt-generate')!
    expect(pptPackage.processCoverage).toBe('COMPLETE')
    expect(pptPackage.outcomeCoverage).toBe('COMPLETE')
    expect(pptPackage.moduleScores.some((item) => item.moduleCode === 'SKILL' && item.automaticStatus === 'FAIL')).toBe(true)
    expect(migrated.attributions.find((item) => item.id === 'attribution-skill-recall')?.legacyRawLabel).toBe('skill sop错误')
    expect(migrated.auditTrail.at(-1)).toMatchObject({ action: 'SCHEMA_MIGRATED', id: 'audit-migrated' })
  })

  it('recovers a same-schema snapshot when its entity graph is invalid', () => {
    const storage = new MemoryStorage()
    const invalid = createInitialEvolutionData()
    invalid.cases[0].traceIds = ['trace-does-not-exist']
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: '2026-09-28T00:00:00.000Z', state: invalid }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test', now: () => '2026-09-28T12:00:00.000Z', idFactory: () => 'audit-invalid-graph' })

    const recovered = repository.load()

    expect(recovered.cases[0].traceIds).not.toContain('trace-does-not-exist')
    expect(recovered.auditTrail.at(-1)).toMatchObject({ id: 'audit-invalid-graph', action: 'SCHEMA_RESET' })
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
})
