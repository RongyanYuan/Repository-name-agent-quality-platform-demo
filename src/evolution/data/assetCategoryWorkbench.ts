import type {
  AssetCatalogEntry, AssetCatalogKind, AssetEvolutionContribution, AssetPerformanceRecord,
  AssetVersion, EvolutionState
} from '../domain'
import { createIdentityResolver } from '../identity'
import { ASSET_CATALOG_KIND_LABELS } from './assetManagement'

export interface AssetCategoryWorkbenchFilters {
  kind?: AssetCatalogKind
  query?: string
  from?: string
  to?: string
}

export interface AssetCategoryMonthlyPoint {
  month: string
  score?: number
  evaluatedCount: number
}

export interface AssetCategoryRow {
  asset: AssetCatalogEntry
  currentVersion?: AssetVersion
  averageScore?: number
  evaluatedCount: number
  traceCount: number
  evolutionCount: number
  updatedAt: string
  monthly: AssetCategoryMonthlyPoint[]
}

export interface AssetCategoryWorkbenchResult {
  assets: AssetCatalogEntry[]
  rows: AssetCategoryRow[]
  /** Shared artifacts appear once here; each asset row retains its own association. */
  performance: AssetPerformanceRecord[]
  contributions: AssetEvolutionContribution[]
  averageScore?: number
  evaluatedCount: number
  /** Unique Traces that contributed to evolution, not every assessed Trace. */
  traceCount: number
  evolutionCount: number
  monthly: AssetCategoryMonthlyPoint[]
}

const timestamp = (value?: string) => value ? Date.parse(value) : Number.NaN
const queryTime = (record: AssetPerformanceRecord) => record.queryAt ?? record.scoredAt
const validScore = (score?: number): score is number => typeof score === 'number'
  && Number.isFinite(score) && score >= 0 && score <= 2

function windowPredicate(filters: AssetCategoryWorkbenchFilters): (value?: string) => boolean {
  const from = filters.from ? timestamp(filters.from) : undefined
  const to = filters.to ? timestamp(filters.to) : undefined
  if (from !== undefined && !Number.isFinite(from)
    || to !== undefined && !Number.isFinite(to)
    || from !== undefined && to !== undefined && from > to) return () => false
  return value => {
    const at = timestamp(value)
    return Number.isFinite(at) && (from === undefined || at >= from) && (to === undefined || at <= to)
  }
}

function scoreSummary(records: AssetPerformanceRecord[]) {
  const scores = records.map(record => record.score).filter(validScore)
  return {
    averageScore: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : undefined,
    evaluatedCount: scores.length
  }
}

function monthlyPerformance(records: AssetPerformanceRecord[]): AssetCategoryMonthlyPoint[] {
  const months = new Map<string, AssetPerformanceRecord[]>()
  for (const record of records) {
    // Use the same Query time as the window filter, rather than the later evaluation time.
    const month = queryTime(record).slice(0, 7)
    months.set(month, [...(months.get(month) ?? []), record])
  }
  return [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, entries]) => {
    const summary = scoreSummary(entries)
    return { month, score: summary.averageScore, evaluatedCount: summary.evaluatedCount }
  })
}

/** Class overview includes every execution version, independent of the current deployment. */
export function selectAssetCategoryWorkbench(state: EvolutionState, filters: AssetCategoryWorkbenchFilters = {}): AssetCategoryWorkbenchResult {
  const resolve = createIdentityResolver(state)
  const query = filters.query?.trim().toLowerCase()
  const versionsByAsset = new Map<string, AssetVersion[]>()
  const contributionsByAsset = new Map<string, AssetEvolutionContribution[]>()
  for (const version of state.assetVersions ?? []) versionsByAsset.set(version.assetId, [...(versionsByAsset.get(version.assetId) ?? []), version])
  for (const contribution of state.assetEvolutionContributions ?? []) contributionsByAsset.set(contribution.assetId, [...(contributionsByAsset.get(contribution.assetId) ?? []), contribution])
  const assets = (state.assetCatalog ?? []).filter(asset => {
    if (filters.kind && asset.kind !== filters.kind) return false
    if (!query) return true
    const searchable = [asset.id, asset.name, asset.description, ASSET_CATALOG_KIND_LABELS[asset.kind],
      ...(versionsByAsset.get(asset.id) ?? []).flatMap(version => [version.id, version.version, version.description]),
      ...(contributionsByAsset.get(asset.id) ?? []).flatMap(contribution => [contribution.attributionId, contribution.attributionLabel])]
    return searchable.some(value => value.toLowerCase().includes(query))
  })
  const assetIds = new Set(assets.map(asset => asset.id))
  const inWindow = windowPredicate(filters)
  const evaluations = new Map(state.outcomeEvals.map(evaluation => [evaluation.id, evaluation]))
  const traces = new Map(state.traces.map(trace => [resolve('trace', trace.id), trace]))
  const isFinalAssessment = (record: AssetPerformanceRecord) => {
    const evaluation = evaluations.get(record.outcomeEvalId ?? '')
    // Match artifactOutcomes' final-assessment contract; unlinked analytical rows remain compatible.
    return !evaluation || evaluation.isFinal === true
      || evaluation.isFinal !== false && ['产物合格性', '最终评分', '产物最终评分'].includes(evaluation.dimension)
  }
  const candidates = (state.assetPerformanceRecords ?? [])
    // A dimension assessment is not a final artifact rating, even if it is the only available assessment.
    .filter(record => assetIds.has(record.assetId) && isFinalAssessment(record))
    .map(record => {
      if (record.queryAt !== undefined) return record
      const trace = traces.get(resolve('trace', record.traceId))
      // Return a projection only: legacy records and their immutable source state stay untouched.
      return { ...record, queryAt: trace?.queryAt ?? trace?.startedAt ?? record.scoredAt }
    })
    .filter(record => inWindow(queryTime(record)))
  const contributions = (state.assetEvolutionContributions ?? []).filter(record => assetIds.has(record.assetId) && inWindow(record.createdAt))
  const recordKey = (record: AssetPerformanceRecord) => {
    const artifactId = record.artifactId ?? evaluations.get(record.outcomeEvalId ?? '')?.artifactId
    return artifactId ? `artifact:${artifactId}`
      : record.outcomeEvalId ? `evaluation:${record.outcomeEvalId}` : `trace:${resolve('trace', record.traceId)}`
  }
  const newest = (left: AssetPerformanceRecord, right: AssetPerformanceRecord) => {
    for (const field of ['scoredAt', 'updatedAt', 'createdAt'] as const) {
      const leftAt = timestamp(left[field])
      const rightAt = timestamp(right[field])
      const difference = (Number.isFinite(leftAt) ? leftAt : -Infinity) - (Number.isFinite(rightAt) ? rightAt : -Infinity)
      if (difference && !Number.isNaN(difference)) return difference
    }
    return left.id.localeCompare(right.id)
  }
  const deduplicate = (records: AssetPerformanceRecord[]) => {
    const byArtifact = new Map<string, AssetPerformanceRecord>()
    for (const record of records) {
      const key = recordKey(record)
      const prior = byArtifact.get(key)
      if (!prior || newest(record, prior) > 0) byArtifact.set(key, record)
    }
    // A newer missing/invalid score remains missing; an old valid score is never substituted.
    return [...byArtifact.values()].sort((left, right) => timestamp(queryTime(left)) - timestamp(queryTime(right)) || left.id.localeCompare(right.id))
  }
  const countContributions = (records: AssetEvolutionContribution[]) => ({
    traceCount: new Set(records.flatMap(record => record.traceIds.map(id => resolve('trace', id)))).size,
    evolutionCount: new Set(records.map(record => record.evolutionRecordId)).size
  })
  const performance = deduplicate(candidates)
  const rows = assets.map(asset => {
    const records = deduplicate(candidates.filter(record => record.assetId === asset.id))
    const assetContributions = contributions.filter(record => record.assetId === asset.id)
    const versions = versionsByAsset.get(asset.id) ?? []
    const updated = [asset.updatedAt, ...versions.map(version => version.updatedAt),
      ...records.map(record => record.updatedAt), ...assetContributions.map(record => record.updatedAt)]
      .filter(value => Number.isFinite(timestamp(value))).sort((left, right) => timestamp(right) - timestamp(left))[0]
    return {
      asset,
      currentVersion: versions.find(version => version.id === asset.currentVersionId),
      ...scoreSummary(records),
      ...countContributions(assetContributions),
      updatedAt: updated ?? asset.updatedAt,
      monthly: monthlyPerformance(records)
    }
  })
  return { assets, rows, performance, contributions, ...scoreSummary(performance), ...countContributions(contributions), monthly: monthlyPerformance(performance) }
}
