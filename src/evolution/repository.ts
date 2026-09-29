import { createInitialEvolutionData, EVOLUTION_SCHEMA_VERSION } from './data'
import { validateEvolutionState } from './data/validation'
import type { AuditEvent, EvolutionState } from './domain'

export { EVOLUTION_SCHEMA_VERSION }
export const EVOLUTION_STORAGE_KEY = 'office-agent-evolution-governance:v1'

export interface EvolutionRepository {
  load(): EvolutionState
  save(state: EvolutionState): void
  reset(actor?: string, reason?: string): EvolutionState
}

interface PersistedEnvelope { schemaVersion: number; savedAt: string; state: EvolutionState }
interface RepositoryOptions { storage?: Storage; storageKey?: string; now?: () => string; idFactory?: () => string }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const fallbackStorage = new Map<string, string>()
const memoryStorage: Storage = {
  get length() { return fallbackStorage.size }, clear: () => fallbackStorage.clear(),
  getItem: (key) => fallbackStorage.get(key) ?? null, key: (index) => [...fallbackStorage.keys()][index] ?? null,
  removeItem: (key) => { fallbackStorage.delete(key) }, setItem: (key, value) => { fallbackStorage.set(key, value) }
}

const schemaAudit = (at: string, id: string): AuditEvent => ({
  id, at, actor: 'EvolutionRepository', action: 'SCHEMA_RESET', entityType: 'EvolutionState',
  entityId: String(EVOLUTION_SCHEMA_VERSION), reason: '本地数据版本不兼容或损坏，已恢复为当前 Mock 演示数据。'
})

export function createLocalEvolutionRepository(options: RepositoryOptions = {}): EvolutionRepository {
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? memoryStorage : localStorage)
  const storageKey = options.storageKey ?? EVOLUTION_STORAGE_KEY
  const now = options.now ?? (() => new Date().toISOString())
  const idFactory = options.idFactory ?? (() => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const persist = (state: EvolutionState) => storage.setItem(storageKey, JSON.stringify({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: now(), state } satisfies PersistedEnvelope))
  const recover = () => {
    const state = createInitialEvolutionData()
    state.updatedAt = now()
    state.auditTrail.push(schemaAudit(state.updatedAt, idFactory()))
    persist(state)
    return clone(state)
  }
  return {
    load() {
      const raw = storage.getItem(storageKey)
      if (!raw) {
        const initial = createInitialEvolutionData()
        persist(initial)
        return initial
      }
      try {
        const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>
        if (envelope.schemaVersion !== EVOLUTION_SCHEMA_VERSION || envelope.state?.schemaVersion !== EVOLUTION_SCHEMA_VERSION || !Array.isArray(envelope.state?.cases) || validateEvolutionState(envelope.state).length > 0) return recover()
        return clone(envelope.state)
      } catch {
        return recover()
      }
    },
    save(state) { persist(clone(state)) },
    reset(actor = '当前用户', reason = '用户重置本地演示数据') {
      const state = createInitialEvolutionData()
      state.updatedAt = now()
      state.auditTrail.push({ id: idFactory(), at: state.updatedAt, actor, action: 'DATA_RESET', entityType: 'EvolutionState', entityId: state.seedVersion, reason })
      persist(state)
      return clone(state)
    }
  }
}

export class EvolutionDataService {
  constructor(private readonly repository: EvolutionRepository) {}
  load() { return this.repository.load() }
  save(state: EvolutionState) { this.repository.save(state) }
  reset(actor?: string, reason?: string) { return this.repository.reset(actor, reason) }
}

export type {
  EvaluationServicePort, EvolutionServiceAdapters as EvolutionServicePorts, ExperimentServicePort,
  GenerationPlanningServicePort, ReleaseServicePort, TraceServicePort
} from './services'
export { createLocalEvolutionServices } from './services'
