import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { EVOLUTION_SCHEMA_VERSION, EvolutionDataService, createLocalEvolutionRepository } from './repository'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
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

  it('recovers incompatible schema data with an explicit audit event', () => {
    const storage = new MemoryStorage()
    storage.setItem('evolution-test', JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION - 1, state: { cases: [] } }))
    const repository = createLocalEvolutionRepository({ storage, storageKey: 'evolution-test' })

    const recovered = repository.load()

    expect(recovered.cases.length).toBeGreaterThanOrEqual(3)
    expect(recovered.auditTrail.at(-1)).toMatchObject({ action: 'SCHEMA_RESET', entityType: 'EvolutionState' })
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
})
