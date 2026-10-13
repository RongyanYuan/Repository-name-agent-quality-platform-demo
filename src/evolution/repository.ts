import { createInitialEvolutionData, EVOLUTION_SCHEMA_VERSION, EVOLUTION_SEED_VERSION } from './data'
import { validateEvolutionState } from './data/validation'
import { upgradeMockFixtures } from './data/upgradeMockFixtures'
import type { AlgorithmBadcaseItem, AuditEvent, BadcaseQueue, EvaluationBatch, EvaluationBatchStatus, EvaluationFinding, EvaluationJob, EvolutionState, RoutingDecision, RoutingDelivery, RoutingPolicy, TraceEvaluationPackage } from './domain'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'
import { canonicalizeIdentityState, resolveIdentity } from './identity'
import { migrateLegacyModuleReviews } from './reviews'
import { enrichAssetManagementFixtures } from './data/assetManagement'

export { EVOLUTION_SCHEMA_VERSION }
export const EVOLUTION_STORAGE_KEY = 'office-agent-evolution-governance:v1'

/** Loading never overwrites data that fails migration or graph validation. */
export class EvolutionLoadError extends Error {
  constructor(readonly diagnostic: string, readonly rawData: string) {
    super(`本地数据升级未完成，原数据已保留。${diagnostic}`)
    this.name = 'EvolutionLoadError'
  }
}

export interface EvolutionRepository {
  load(): EvolutionState
  save(state: EvolutionState): void
  reset(actor?: string, reason?: string): EvolutionState
}

interface PersistedEnvelope { schemaVersion: number; savedAt: string; state: EvolutionState }
interface RepositoryOptions { storage?: Storage; storageKey?: string; now?: () => string; idFactory?: () => string }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const SNAPSHOT_CODEC = 'office-agent-lz-utf16-v1'

/** Lossless snapshot deduplication keeps the JSON envelope and object ledgers
 * readable while repeated experiment evidence does not exhaust localStorage.
 * Distinct historical snapshots receive distinct IDs and are never dropped. */
function serializeEnvelope(envelope: PersistedEnvelope): string {
  const snapshots = new Map<string, string>()
  return JSON.stringify(envelope, (key, value: unknown) => {
    if (!['evaluationSnapshot', 'evalSnapshot', 'configSnapshot', 'resultSnapshot', 'reportSnapshot', 'assetPerformanceRecords', 'assetEvolutionContributions'].includes(key) || !value || typeof value !== 'object') return value
    const serialized = JSON.stringify(value)
    if (serialized.length < 1024) return value
    const existingId = snapshots.get(serialized)
    if (existingId) return { $officeAgentSnapshotRef: existingId }
    const id = `snapshot-${snapshots.size + 1}`
    snapshots.set(serialized, id)
    return { $officeAgentSnapshotCodec: SNAPSHOT_CODEC, id, data: compressToUTF16(serialized) }
  })
}

function parseEnvelope(raw: string): Partial<PersistedEnvelope> {
  const snapshots = new Map<string, unknown>()
  return JSON.parse(raw, (_key, value: unknown) => {
    if (!value || typeof value !== 'object') return value
    const encoded = value as Record<string, unknown>
    if (encoded.$officeAgentSnapshotCodec === SNAPSHOT_CODEC && typeof encoded.id === 'string' && typeof encoded.data === 'string') {
      const serialized = decompressFromUTF16(encoded.data)
      if (!serialized) throw new Error('Invalid persisted experiment snapshot')
      const snapshot: unknown = JSON.parse(serialized)
      snapshots.set(encoded.id, snapshot)
      return snapshot
    }
    if (typeof encoded.$officeAgentSnapshotRef === 'string') {
      if (!snapshots.has(encoded.$officeAgentSnapshotRef)) throw new Error('Missing persisted experiment snapshot reference')
      return snapshots.get(encoded.$officeAgentSnapshotRef)
    }
    return value
  }) as Partial<PersistedEnvelope>
}

function hydrateExperimentSnapshots(state: EvolutionState): EvolutionState {
  const hydrated = clone(state)
  hydrated.datasetQueries ??= []
  hydrated.datasetExecutionRuns ??= []
  const experimentById = new Map(hydrated.experiments.map((experiment) => [experiment.id, experiment]))
  hydrated.experimentRuns = hydrated.experimentRuns.map((run) => {
    const experiment = experimentById.get(run.experimentId)
    const configSnapshot = run.configSnapshot ?? experiment?.configSnapshot
    const evalSnapshot = run.evalSnapshot ?? experiment?.configSnapshot.evaluationSnapshot
    return { ...run, configSnapshot, evalSnapshot }
  })
  const runById = new Map(hydrated.experimentRuns.map((run) => [run.id, run]))
  hydrated.gateDecisions = hydrated.gateDecisions.map((decision) => ({
    ...decision,
    reportSnapshot: {
      ...decision.reportSnapshot,
      configSnapshot: decision.reportSnapshot.configSnapshot ?? experimentById.get(decision.experimentId)?.configSnapshot,
      runSnapshots: decision.reportSnapshot.runSnapshots?.map((run) => {
        const currentRun = runById.get(run.id)
        // Fill only fields stripped by old persistence versions. Existing
        // report values remain the decision-time source of truth.
        return { ...run, configSnapshot: run.configSnapshot ?? currentRun?.configSnapshot, evalSnapshot: run.evalSnapshot ?? decision.reportSnapshot.configSnapshot?.evaluationSnapshot ?? currentRun?.evalSnapshot }
      })
    }
  }))
  return hydrated
}
const fallbackStorage = new Map<string, string>()
const memoryStorage: Storage = {
  get length() { return fallbackStorage.size }, clear: () => fallbackStorage.clear(),
  getItem: (key) => fallbackStorage.get(key) ?? null, key: (index) => [...fallbackStorage.keys()][index] ?? null,
  removeItem: (key) => { fallbackStorage.delete(key) }, setItem: (key, value) => { fallbackStorage.set(key, value) }
}

const migrationAudit = (at: string, id: string): AuditEvent => ({
  id, at, actor: 'EvolutionRepository', action: 'SCHEMA_MIGRATED', entityType: 'EvolutionState',
  entityId: '2', reason: '保留 V1 本地数据并补齐 V2 评测台账字段；未覆盖原有 Case、Trace、评测与审计记录。'
})

/** Additive V1 → V2 migration. It deliberately keeps every historical array and
 * creates a lightweight package/batch view so the new ledger can render old data. */
function migrateV1State(raw: Partial<EvolutionState>, at: string, idFactory: () => string): EvolutionState | undefined {
  if (!Array.isArray(raw.cases) || !Array.isArray(raw.traces) || !Array.isArray(raw.sessions)) return undefined
  const state = canonicalizeIdentityState(raw as EvolutionState)
  const traceIds = state.traces.map((trace) => trace.id)
  const batchId = 'batch-migrated-v1'
  const seed = createInitialEvolutionData()
  const packages: TraceEvaluationPackage[] = state.traces.map((trace) => {
    const seeded = seed.tracePackages.find((item) => item.traceId === resolveIdentity(seed, 'trace', trace.id))
    if (seeded) return { ...clone(seeded), batchId, createdAt: trace.createdAt, updatedAt: at }
    return {
    id: `package-${trace.id}`, createdAt: trace.createdAt, updatedAt: at, batchId, caseId: trace.caseId, sessionId: trace.sessionId,
    traceId: trace.id, query: state.cases.find((item) => item.id === trace.caseId)?.query ?? 'V1 Trace（未记录 Query）',
    agentVersion: state.cases.find((item) => item.id === trace.caseId)?.agentVersion ?? 'unknown', skillVersion: undefined, skillIds: state.cases.find((item) => item.id === trace.caseId)?.skillIds ?? [],
    skillCategory: 'UNCLASSIFIED', processCoverage: 'MISSING', outcomeCoverage: 'MISSING', status: 'PENDING', moduleScores: [], findingIds: [], routingDecisionIds: [], routingDeliveryIds: [], badcaseIds: [], revaluationJobIds: []
    }
  })
  const batch: EvaluationBatch = { id: batchId, name: 'V1 兼容评测台账', status: traceIds.length ? 'PARTIAL' as EvaluationBatchStatus : 'DRAFT', traceIds, packageIds: packages.map((item) => item.id), jobIds: [], evalAgentVersion: 'V1 记录', rubricVersion: 'V1 记录', runEnvironment: 'local-migration', createdBy: 'EvolutionRepository', stats: { inputTraceCount: traceIds.length, successCount: 0, partialCount: traceIds.length, failedCount: 0, pendingCount: 0 }, createdAt: at, updatedAt: at }
  const jobs: EvaluationJob[] = []
  const packageIds = new Set(packages.map((item) => item.id))
  const migratedFindings: EvaluationFinding[] = seed.evaluationFindings.filter((item) => packageIds.has(item.packageId)).map((item) => ({ ...clone(item), batchId, updatedAt: at }))
  const findingIds = new Set(migratedFindings.map((item) => item.id))
  const migratedPolicies: RoutingPolicy[] = seed.routingPolicies.map((item) => clone(item))
  const migratedDecisions: RoutingDecision[] = seed.routingDecisions.filter((item) => findingIds.has(item.findingId)).map((item) => ({ ...clone(item), updatedAt: at }))
  const decisionIds = new Set(migratedDecisions.map((item) => item.id))
  const migratedDeliveries: RoutingDelivery[] = seed.routingDeliveries.filter((item) => decisionIds.has(item.decisionId)).map((item) => ({ ...clone(item), updatedAt: at }))
  const deliveryIds = new Set(migratedDeliveries.map((item) => item.id))
  const migratedBadcases: AlgorithmBadcaseItem[] = seed.algorithmBadcases.filter((item) => deliveryIds.has(item.deliveryId)).map((item) => ({ ...clone(item), updatedAt: at }))
  const migratedQueues: BadcaseQueue[] = seed.badcaseQueues.map((queue) => ({ ...clone(queue), itemIds: queue.itemIds.filter((id) => migratedBadcases.some((item) => item.id === id)), deliveryIds: queue.deliveryIds.filter((id) => deliveryIds.has(id)), updatedAt: at })).filter((queue) => queue.itemIds.length || queue.deliveryIds.length)
  const migratedAttributions = (Array.isArray(state.attributions) ? state.attributions : []).map((item) => ({ ...item, moduleCode: item.moduleCode ?? item.module.toUpperCase(), dimensionCode: item.dimensionCode ?? item.dimension.replace(/[^\p{Letter}\p{Number}]+/gu, '_').toUpperCase(), dimensionLabel: item.dimensionLabel ?? item.dimension, labelSnapshot: item.labelSnapshot ?? item.dimension, legacyRawLabel: item.legacyRawLabel ?? item.dimension, taxonomyVersion: item.taxonomyVersion ?? 'v1-legacy', updatedAt: at }))
  const auditTrail = [...(Array.isArray(state.auditTrail) ? state.auditTrail : []), migrationAudit(at, idFactory())]
  return enrichAssetManagementFixtures({
    ...state, schemaVersion: EVOLUTION_SCHEMA_VERSION, seedVersion: EVOLUTION_SEED_VERSION, updatedAt: at, auditTrail, attributions: migratedAttributions,
    evaluationBatches: Array.isArray(state.evaluationBatches) ? state.evaluationBatches : [batch],
    evaluationJobs: Array.isArray(state.evaluationJobs) ? state.evaluationJobs : jobs,
    tracePackages: Array.isArray(state.tracePackages) ? state.tracePackages : packages,
    evaluationFindings: Array.isArray(state.evaluationFindings) ? state.evaluationFindings : migratedFindings,
    routingPolicies: Array.isArray(state.routingPolicies) && state.routingPolicies.length ? state.routingPolicies : migratedPolicies,
    routingDecisions: Array.isArray(state.routingDecisions) ? state.routingDecisions : migratedDecisions,
    routingDeliveries: Array.isArray(state.routingDeliveries) ? state.routingDeliveries : migratedDeliveries,
    algorithmBadcases: Array.isArray(state.algorithmBadcases) ? state.algorithmBadcases : migratedBadcases,
    badcaseQueues: Array.isArray(state.badcaseQueues) ? state.badcaseQueues : migratedQueues,
    tastePreferenceSignals: Array.isArray(state.tastePreferenceSignals) ? state.tastePreferenceSignals : seed.tastePreferenceSignals,
    datasetSamplingSnapshots: Array.isArray(state.datasetSamplingSnapshots) ? state.datasetSamplingSnapshots : []
  })
}

export function createLocalEvolutionRepository(options: RepositoryOptions = {}): EvolutionRepository {
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? memoryStorage : localStorage)
  const storageKey = options.storageKey ?? EVOLUTION_STORAGE_KEY
  const now = options.now ?? (() => new Date().toISOString())
  const idFactory = options.idFactory ?? (() => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const persist = (state: EvolutionState) => storage.setItem(storageKey, serializeEnvelope({ schemaVersion: EVOLUTION_SCHEMA_VERSION, savedAt: now(), state } satisfies PersistedEnvelope))
  return {
    load() {
      const raw = storage.getItem(storageKey)
      if (!raw) {
        const initial = createInitialEvolutionData()
        persist(initial)
        return initial
      }
      try {
        const envelope = parseEnvelope(raw)
        const envelopeState = envelope.state as Partial<EvolutionState> | undefined
        if (!envelopeState || !Array.isArray(envelopeState.cases)) throw new Error('本地快照缺少有效 Case 数据')
        const missingV2Arrays = !Array.isArray(envelopeState.evaluationBatches) || !Array.isArray(envelopeState.evaluationJobs) || !Array.isArray(envelopeState.tracePackages) || !Array.isArray(envelopeState.evaluationFindings) || !Array.isArray(envelopeState.routingPolicies) || !Array.isArray(envelopeState.routingDecisions) || !Array.isArray(envelopeState.routingDeliveries) || !Array.isArray(envelopeState.algorithmBadcases) || !Array.isArray(envelopeState.badcaseQueues) || !Array.isArray(envelopeState.tastePreferenceSignals) || !Array.isArray(envelopeState.datasetSamplingSnapshots) || !Array.isArray(envelopeState.assetCatalog) || !Array.isArray(envelopeState.assetVersions) || !Array.isArray(envelopeState.assetPerformanceRecords) || !Array.isArray(envelopeState.assetEvolutionContributions)
        if (envelope.schemaVersion !== EVOLUTION_SCHEMA_VERSION || envelopeState.schemaVersion !== EVOLUTION_SCHEMA_VERSION || missingV2Arrays) {
          const migrated = migrateV1State(envelopeState, now(), idFactory)
          if (!migrated) throw new Error('旧版本快照缺少 Session 或 Trace 数据，无法安全迁移')
          const hydrated = migrateLegacyModuleReviews(hydrateExperimentSnapshots(migrated))
          const errors = validateEvolutionState(hydrated)
          if (errors.length) throw new Error(errors.slice(0, 5).map(error => `${error.path}: ${error.message}`).join('；'))
          persist(hydrated)
          return hydrated
        }
        const hydrated = hydrateExperimentSnapshots(envelopeState as EvolutionState)
        const canonical = migrateLegacyModuleReviews(canonicalizeIdentityState(hydrated))
        const base = canonical.seedVersion === EVOLUTION_SEED_VERSION ? canonical : upgradeMockFixtures(canonical, createInitialEvolutionData(), now(), idFactory())
        // Asset projections predate fixed-version provenance in some saved
        // demos. Repair only their generated fields, even at the same seed
        // version; human reviews and frozen experiment reports are preserved.
        const upgraded = enrichAssetManagementFixtures(base)
        const errors = validateEvolutionState(upgraded)
        if (errors.length) throw new Error(errors.slice(0, 5).map(error => `${error.path}: ${error.message}`).join('；'))
        if (upgraded !== canonical || JSON.stringify(canonical) !== JSON.stringify(hydrated)) persist(upgraded)
        return upgraded
      } catch (error) {
        throw new EvolutionLoadError(error instanceof Error ? error.message : String(error), raw)
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
