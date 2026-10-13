import type {
  AssetCatalogEntry, AssetCatalogKind, AssetEvolutionContribution, AssetPerformanceRecord, AssetVersion,
  Dataset, EvolutionRecord, EvolutionState, OutcomeEval, Skill, Trace
} from '../domain'
import { normalizeSkillVersion, targetAttributionId } from './skillWorkspace'
import { createIdentityResolver } from '../identity'
import { evolutionRecordAttributionLabel } from './evolutionWorkbench'

export const ASSET_CATALOG_KIND_LABELS: Record<AssetCatalogKind, string> = {
  TASTE_SKILL: '品味库 Skill',
  PRODUCTION_SKILL: '生产 Skill',
  PERSONAL_SKILL: '个人 Skill',
  MEMORY: '记忆',
  TOOL: 'Tool',
  SYSTEM_PROMPT: 'System Prompt',
  OTHER_CAPABILITY: '其他能力'
}

export interface AssetManagementFilters {
  kind?: AssetCatalogKind | 'ALL'
  assetId?: string
  /** A literal ALL is accepted by the workbench when the user explicitly
   * selects every historical version. Omitting the field keeps the legacy
   * behaviour (all versions for aggregate views). */
  assetVersionId?: string | 'ALL'
  query?: string
  from?: string
  to?: string
}

export interface AssetMonthlyPerformance {
  month: string
  /** Present for version-series views; omitted by the aggregate selector. */
  assetVersionId?: string
  assetVersion?: string
  averageScore?: number
  evaluatedCount: number
  traceCount: number
}

export type AssetVersionMonthlyPerformance = AssetMonthlyPerformance & {
  assetVersionId: string
  assetVersion: string
}

export interface AssetPerformanceSummary {
  assetId: string
  assetVersionId: string
  averageScore?: number
  evaluatedCount: number
  traceCount: number
  contributionTraceCount: number
  contributions: AssetEvolutionContribution[]
}

const clone = <T,>(value: T): T => structuredClone(value)
const unique = <T,>(values: T[]) => [...new Set(values)]
const validDate = (value?: string) => Boolean(value && Number.isFinite(Date.parse(value)))
const normalize = (value?: string) => normalizeSkillVersion(value).trim().toLowerCase()
const compareVersionLabels = (left: string, right: string) => {
  const a = normalize(left).split('-')[0].split('.').map(Number)
  const b = normalize(right).split('-')[0].split('.').map(Number)
  if (a.every(Number.isFinite) && b.every(Number.isFinite)) {
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const delta = (a[index] ?? 0) - (b[index] ?? 0)
      if (delta) return delta
    }
    if (left.includes('-') !== right.includes('-')) return left.includes('-') ? -1 : 1
  }
  return left.localeCompare(right, undefined, { numeric: true })
}
const inDateRange = (value: string, from?: string, to?: string) => {
  const at = Date.parse(value)
  if (!Number.isFinite(at)) return false
  if (from && validDate(from) && at < Date.parse(from)) return false
  if (to && validDate(to) && at > Date.parse(to)) return false
  return true
}
// Legacy OutcomeEval rows omitted scoreScale and used the original 0–1
// contract; explicit 0–2 rows stay unchanged.
const clampScore = (score: number | undefined, scale: OutcomeEval['scoreScale'] = '0-1') => {
  if (score === undefined || !Number.isFinite(score)) return undefined
  const normalized = scale === '0-1' ? score * 2 : score
  return Number(Math.min(2, Math.max(0, normalized)).toFixed(2))
}
const evaluationAt = (evaluation?: OutcomeEval) => evaluation?.revisions?.[evaluation.revisions.length - 1]?.evaluatedAt ?? evaluation?.updatedAt ?? evaluation?.createdAt

const kindForSkill = (category: string | undefined): AssetCatalogKind => {
  if (category === 'TASTE_SKILL') return 'TASTE_SKILL'
  if (category === 'PRODUCTION_SKILL') return 'PRODUCTION_SKILL'
  if (category === 'PERSONAL_SKILL') return 'PERSONAL_SKILL'
  return 'OTHER_CAPABILITY'
}

const sourceTracesForRecord = (state: EvolutionState, record: EvolutionRecord): string[] => {
  const traceIds = new Set<string>()
  for (const findingId of record.sourceFindingIds ?? []) {
    const finding = state.evaluationFindings.find(item => item.id === findingId)
    if (finding?.traceId) traceIds.add(finding.traceId)
  }
  for (const attributionId of record.sourceAttributionIds ?? []) {
    const attribution = state.attributions.find(item => item.id === attributionId)
    if (attribution?.traceId) traceIds.add(attribution.traceId)
  }
  const issueIds = new Set([...(record.sourceIssueIds ?? []), ...(record.sourceClusterIds ?? []).flatMap(id => state.issueClusters.find(cluster => cluster.id === id)?.issueIds ?? [])])
  for (const issueId of issueIds) {
    const issue = state.issues.find(item => item.id === issueId)
    const attribution = state.attributions.find(item => item.id === issue?.attributionId)
    if (attribution?.traceId) traceIds.add(attribution.traceId)
  }
  // A task can contain unrelated sibling Traces. When findings/attributions
  // name the triggering Trace, their exact identity is the source scope.
  if (traceIds.size) return [...traceIds]
  for (const issueId of record.sourceIssueIds ?? []) {
    const issue = state.issues.find(item => item.id === issueId)
    state.cases.find(item => item.id === issue?.caseId)?.traceIds.forEach(id => traceIds.add(id))
  }
  for (const clusterId of record.sourceClusterIds ?? []) {
    const cluster = state.issueClusters.find(item => item.id === clusterId)
    cluster?.caseIds.forEach(caseId => state.cases.find(item => item.id === caseId)?.traceIds.forEach(id => traceIds.add(id)))
  }
  return [...traceIds]
}

const sourceAttribution = (state: EvolutionState, record: EvolutionRecord) => {
  const id = record.target.attributionId
  return state.attributions.find(item => item.id === id)
    ?? state.attributions.find(item => record.sourceAttributionIds.includes(item.id))
}

const traceDatasetIds = (state: EvolutionState, traceId: string) => {
  const resolve = createIdentityResolver(state)
  const canonicalId = resolve('trace', traceId)
  return unique((state.datasetMemberships ?? [])
    .filter(item => item.scope === 'TRACE' && item.traceIds.some(id => resolve('trace', id) === canonicalId))
    .map(item => item.datasetId))
}

/**
 * Return only datasets that explain why an evolution record exists.
 *
 * Experiment/gate datasets (generalisation, regression and window sets) are
 * validation assets and belong to the experiment report. They should not be
 * presented as evolution history for an asset. The history view instead
 * keeps (a) explicit TRACE memberships for the findings that triggered the
 * record and (b) the attribution dataset created by a cluster optimisation.
 */
export function selectAssetEvolutionSourceDatasets(state: EvolutionState, record: EvolutionRecord, sourceTraceIds = sourceTracesForRecord(state, record)): Dataset[] {
  const resolve = createIdentityResolver(state)
  const traceIds = new Set(sourceTraceIds.map(id => resolve('trace', id)))
  const caseIds = new Set(state.traces.filter(trace => traceIds.has(resolve('trace', trace.id))).map(trace => trace.caseId))
  const ownedIds = new Set(record.datasetIds)
  return state.datasets.filter(dataset => {
    if (dataset.type !== 'ATTRIBUTION' || dataset.datasetCategory === 'GOLDEN' || dataset.setRole === 'GATE' || dataset.setRole === 'GOLDEN') return false
    if (record.target.kind === 'SKILL') {
      const target = record.target
      const exactTarget = (dataset.targets ?? []).some(item => item.skillId === target.skillId
        && normalize(item.skillVersion ?? item.skillVersionId) === normalize(target.skillVersion)
        && targetAttributionId(item) === target.attributionId)
      if (!exactTarget) return false
      const memberships = (state.datasetMemberships ?? []).filter(item => item.datasetId === dataset.id && item.datasetVersion === dataset.version)
      if (memberships.length) return memberships.some(item => item.scope === 'TRACE'
        ? item.traceIds.some(id => traceIds.has(resolve('trace', id)))
        : caseIds.has(item.caseId))
      // Legacy fixed-version sets kept Case membership before explicit Trace
      // enrollment existed. An exact target plus source Case is sufficient;
      // explicit enrollment above always overrides this broader fallback.
      return ownedIds.has(dataset.id) || dataset.caseIds.some(id => caseIds.has(id))
    }
    // A legacy module dataset has no Skill targets. Its explicit owner is
    // the only reliable identity; a shared Trace cannot establish ownership.
    return ownedIds.has(dataset.id) && !(dataset.targets?.length)
  })
}

export function selectAssetEvolutionSourceDatasetIds(state: EvolutionState, record: EvolutionRecord, sourceTraceIds?: string[]): string[] {
  return selectAssetEvolutionSourceDatasets(state, record, sourceTraceIds).map(dataset => dataset.id)
}

const traceDate = (trace: Trace) => trace.queryAt ?? trace.startedAt ?? trace.createdAt

const syntheticVersionLabels = (current: string, kind: AssetCatalogKind) => {
  const normalized = normalize(current) ?? (kind === 'TASTE_SKILL' ? '0.9.0' : '1.0.0')
  if (!/^\d+(?:\.\d+){1,2}(?:[-+].*)?$/.test(normalized)) {
    const prefix = kind === 'TASTE_SKILL' ? 'taste' : kind === 'PERSONAL_SKILL' ? 'personal' : kind === 'PRODUCTION_SKILL' ? 'production' : 'capability'
    return [`${prefix}-0.1.0`, `${prefix}-0.2.0`, normalized]
  }
  const parts = normalized.split('.').map(value => Number(value) || 0)
  const major = parts[0] ?? 1
  const minor = parts[1] ?? 0
  const patch = parts[2] ?? 0
  const prior = minor > 0 ? `${major}.${minor - 1}.${patch}` : `${Math.max(0, major - 1)}.9.${patch}`
  const older = minor > 1 ? `${major}.${minor - 2}.${patch}` : `${Math.max(0, major - 1)}.8.${patch}`
  return unique([older, prior, normalized]).map(value => value.replace(/^/, ''))
}

const entry = (id: string, name: string, kind: AssetCatalogKind, at: string, fields: Partial<AssetCatalogEntry> = {}): AssetCatalogEntry => ({
  id, name, kind, description: fields.description ?? `${ASSET_CATALOG_KIND_LABELS[kind]} · Mock 资产目录条目`, status: fields.status ?? 'ACTIVE', ownerScope: fields.ownerScope ?? (kind === 'PERSONAL_SKILL' ? 'USER' : 'SYSTEM'), skillId: fields.skillId, legacyAssetId: fields.legacyAssetId, currentVersionId: fields.currentVersionId, visibility: fields.visibility ?? 'PUBLIC', createdAt: at, updatedAt: at
})

const skillVersionStatus = (skill: Skill, label: string): AssetVersion['status'] => {
  const current = normalize(skill.version)
  const version = skill.versions?.find(item => normalize(item.version) === normalize(label))
  if (normalize(label) === current && skill.generationStatus !== 'PLANNED') return 'ACTIVE'
  if (version?.status === 'PLANNED') return 'PLANNED'
  if (version?.status === 'CANDIDATE' || (!version && label.includes('-rc.'))) return 'CANDIDATE'
  return 'DEPRECATED'
}

/** Deployment fixtures are explicit catalog metadata, never a projection of
 * a page's environment filter or the PRODUCTION_SKILL asset category. */
const mockModuleCatalogIds = new Set(['asset-catalog-memory', 'asset-catalog-tool-export', 'asset-catalog-system-prompt', 'asset-catalog-other-capability'])
const mockVersionDeployment = (catalog: AssetCatalogEntry, version: AssetVersion, skill?: Skill): AssetVersion['deployment'] => {
  const registeredSkillVersion = skill?.versions?.find(item => normalize(item.version) === normalize(version.version))
  const sourceOnly = version.description.includes('进化来源记录的固定版本') && !registeredSkillVersion
  const base = { source: 'MOCK' as const, updatedAt: version.updatedAt }
  if (skill?.generationStatus === 'PLANNED' || version.status === 'PLANNED') return { ...base, status: 'NOT_DEPLOYED' }
  if (sourceOnly) return { ...base, status: 'OFFLINE' }
  if (version.status === 'ACTIVE') return { ...base, environment: 'Production', status: 'ACTIVE' }
  if (version.status === 'CANDIDATE' && (!catalog.skillId || registeredSkillVersion?.status === 'CANDIDATE')) return { ...base, environment: 'Staging', status: 'ACTIVE' }
  return { ...base, status: 'OFFLINE' }
}

const catalogMatchesTarget = (catalog: AssetCatalogEntry, record: EvolutionRecord) => record.target.kind === 'SKILL'
  ? catalog.skillId === record.target.skillId
  : catalog.kind === ({ Memory: 'MEMORY', Reason: 'SYSTEM_PROMPT', Act: 'TOOL', Context: 'OTHER_CAPABILITY' } as Record<string, AssetCatalogKind>)[record.target.governanceObject]

function recordAssetVersion(state: EvolutionState, catalog: AssetCatalogEntry, record: EvolutionRecord): AssetVersion | undefined {
  if (!catalogMatchesTarget(catalog, record)) return undefined
  const label = record.target.kind === 'SKILL' ? normalize(record.target.skillVersion) : record.target.targetVersion
  if (!label) return undefined
  let version = (state.assetVersions ?? []).find(item => item.assetId === catalog.id && normalize(item.version) === normalize(label))
  if (!version) {
    version = { id: `${catalog.id}@${label}`, assetId: catalog.id, version: label, status: 'DEPRECATED', description: `${catalog.name} ${label} · 进化来源记录的固定版本（Mock）`, sourceEvolutionRecordIds: [record.id], createdAt: record.createdAt, updatedAt: record.createdAt }
    state.assetVersions ??= []
    state.assetVersions.push(version)
  } else if (!version.sourceEvolutionRecordIds.includes(record.id)) version.sourceEvolutionRecordIds.push(record.id)
  return version
}

/** The Trace's primary Skill version is never transferred to a secondary
 * Skill just because the two occur in the same task. */
const recordedSkillVersion = (state: EvolutionState, catalog: AssetCatalogEntry, trace: Trace) => {
  if (!catalog.skillId) return undefined
  const pkg = state.tracePackages.find(item => item.traceId === trace.id)
  const task = state.cases.find(item => item.id === trace.caseId)
  const isPrimary = pkg?.skillIds.includes(catalog.skillId) && pkg.skillCategory === catalog.kind
    || task?.skillIds.length === 1 && task.skillIds[0] === catalog.skillId
  const explicit = isPrimary ? trace.skillVersion ?? pkg?.skillVersion : undefined
  return explicit ? normalize(explicit) : undefined
}

function repairAssetManagementProjection(state: EvolutionState): EvolutionState {
  const resolve = createIdentityResolver(state)
  const touched = (id: string) => state.auditTrail.some(event => event.entityId === id && event.actor !== 'Demo Seeder')
  for (const catalog of state.assetCatalog ?? []) {
    for (const record of state.evolutionRecords ?? []) recordAssetVersion(state, catalog, record)
  }
  for (const catalog of state.assetCatalog ?? []) {
    const skill = state.skills.find(item => item.id === catalog.skillId)
    if (!skill) continue
    const current = (state.assetVersions ?? []).find(version => version.assetId === catalog.id && normalize(version.version) === normalize(skill.version))
    if (current && !touched(catalog.id)) catalog.currentVersionId = current.id
    for (const version of state.assetVersions ?? []) {
      if (version.assetId !== catalog.id || touched(version.id)) continue
      version.status = skillVersionStatus(skill, version.version)
      const explicit = skill.versions?.find(item => normalize(item.version) === normalize(version.version))
      if (explicit) {
        version.createdAt = explicit.createdAt
        version.updatedAt = explicit.updatedAt
        version.effectiveFrom = explicit.createdAt
        if (version.status === 'ACTIVE') version.releasedAt = explicit.createdAt
        else version.releasedAt = undefined
      }
    }
  }
  // Upgrade old local snapshots only where the version still has an exact
  // generated Mock identity. Human edits and recorded deployment responses
  // remain authoritative, including SERVICE/LOCAL states and prior Mock runs.
  for (const catalog of state.assetCatalog ?? []) {
    const skill = state.skills.find(item => item.id === catalog.skillId)
    const generatedCatalog = skill ? catalog.id === `asset-catalog-${skill.id}` : mockModuleCatalogIds.has(catalog.id)
    if (!generatedCatalog) continue
    for (const version of state.assetVersions ?? []) {
      if (version.assetId !== catalog.id || version.id !== `${catalog.id}@${version.version}`
        || !version.description.includes('Mock') || version.deployment || touched(version.id)) continue
      version.deployment = mockVersionDeployment(catalog, version, skill)
    }
  }
  state.assetVersions = [...(state.assetVersions ?? [])].sort((a, b) => a.assetId.localeCompare(b.assetId) || compareVersionLabels(a.version, b.version))
  state.assetEvolutionContributions = (state.assetEvolutionContributions ?? []).map(contribution => {
    const record = (state.evolutionRecords ?? []).find(item => item.id === contribution.evolutionRecordId)
    if (!record) return { ...contribution, datasetIds: [] }
    const catalog = (state.assetCatalog ?? []).find(item => item.id === contribution.assetId)
    const version = catalog ? recordAssetVersion(state, catalog, record) : undefined
    // No source version means no defensible fixed-version history row.
    if (!version && !touched(contribution.id)) return undefined
    const exactTraceIds = sourceTracesForRecord(state, record)
    const traceIds = unique((exactTraceIds.length ? exactTraceIds : contribution.traceIds).map(id => resolve('trace', id)))
    return {
      ...contribution,
      assetVersionId: version && !touched(contribution.id) ? version.id : contribution.assetVersionId,
      attributionLabel: evolutionRecordAttributionLabel(record),
      traceIds,
      datasetIds: selectAssetEvolutionSourceDatasetIds(state, record, traceIds)
    }
  }).filter((item): item is AssetEvolutionContribution => Boolean(item))

  // Replace only the automatically projected Skill rows. Local performance
  // records and user edits retain their immutable version/score assignment.
  const skillCatalog = (state.assetCatalog ?? []).filter(item => item.skillId)
  const generatedIds = new Set((state.assetPerformanceRecords ?? []).filter(item => skillCatalog.some(catalog => item.id.startsWith(`asset-performance-${catalog.id}-`)) && !touched(item.id)).map(item => item.id))
  const performances = (state.assetPerformanceRecords ?? []).filter(item => !generatedIds.has(item.id))
  const retainedIds = new Set(performances.map(item => item.id))
  const retainedTraceVersions = new Set(performances.filter(item => touched(item.id)).map(item => `${item.assetId}:${resolve('trace', item.traceId)}:${item.assetVersionId}`))
  for (const catalog of skillCatalog) {
    const versionCounts = new Map<string, number>()
    for (const trace of state.traces) {
      const versionLabel = recordedSkillVersion(state, catalog, trace)
      const version = (state.assetVersions ?? []).find(item => item.assetId === catalog.id && normalize(item.version) === versionLabel)
      if (!version || (versionCounts.get(version.id) ?? 0) >= 6) continue
      versionCounts.set(version.id, (versionCounts.get(version.id) ?? 0) + 1)
      const id = `asset-performance-${catalog.id}-${trace.id}`
      if (retainedIds.has(id) || retainedTraceVersions.has(`${catalog.id}:${resolve('trace', trace.id)}:${version.id}`)) continue
      const outcome = state.outcomeEvals.filter(item => item.traceId === trace.id && item.isFinal !== false).sort((a, b) => Date.parse(evaluationAt(b) ?? '') - Date.parse(evaluationAt(a) ?? ''))[0]
      const scoredAt = evaluationAt(outcome) ?? traceDate(trace)
      const contributions = (state.assetEvolutionContributions ?? []).filter(item => item.assetId === catalog.id && item.assetVersionId === version.id && item.traceIds.includes(trace.id))
      performances.push({ id, assetId: catalog.id, assetVersionId: version.id, traceId: trace.id, caseId: trace.caseId, artifactId: outcome?.artifactId ?? trace.artifactIds[0], outcomeEvalId: outcome?.id, score: clampScore(outcome?.score, outcome?.scoreScale), scoreScale: '0-2', queryAt: traceDate(trace), scoredAt, datasetIds: unique(contributions.flatMap(item => item.datasetIds)), evolutionRecordIds: contributions.map(item => item.evolutionRecordId), createdAt: trace.createdAt, updatedAt: scoredAt })
    }
  }
  state.assetPerformanceRecords = performances
  return state
}

/** Add the analytical catalog and deterministic multi-month fixtures without
 * replacing any existing Asset or Skill records.  Calling the enricher twice
 * is idempotent, which is important for additive local-storage migrations. */
export function enrichAssetManagementFixtures(input: EvolutionState): EvolutionState {
  if (input.assetCatalog?.some(item => item.id === 'asset-catalog-memory') && (input.assetVersions?.length ?? 0) > 0 && (input.assetPerformanceRecords?.length ?? 0) > 0 && (input.assetEvolutionContributions?.length ?? 0) > 0) {
    // Existing local snapshots predate the trigger-only history rule. Keep
    // their records, but migrate dataset links on read so reports do not
    // continue to expose validation/gate datasets as evolution sources.
    const state = clone(input)
    return repairAssetManagementProjection(state)
  }
  const state = clone(input)
  state.assetCatalog = [...(state.assetCatalog ?? [])]
  state.assetVersions = [...(state.assetVersions ?? [])]
  state.assetPerformanceRecords = [...(state.assetPerformanceRecords ?? [])]
  state.assetEvolutionContributions = [...(state.assetEvolutionContributions ?? [])]
  const baseAt = state.updatedAt
  const addEntry = (catalog: AssetCatalogEntry, versions: string[]) => {
    if (!state.assetCatalog!.some(item => item.id === catalog.id)) state.assetCatalog!.push(catalog)
    versions.forEach((version, index) => {
      const versionId = `${catalog.id}@${version}`
      if (state.assetVersions!.some(item => item.id === versionId)) return
      const at = new Date(Date.parse(baseAt) - (versions.length - 1 - index) * 31 * 86400000).toISOString()
      const item: AssetVersion = { id: versionId, assetId: catalog.id, version, status: index === versions.length - 1 ? 'ACTIVE' : index === versions.length - 2 ? 'CANDIDATE' : 'DEPRECATED', description: `${catalog.name} ${version} · Mock 版本`, releasedAt: index === versions.length - 1 ? at : undefined, effectiveFrom: at, sourceEvolutionRecordIds: [], createdAt: at, updatedAt: at }
      state.assetVersions!.push(item)
      if (index === versions.length - 1) catalog.currentVersionId = versionId
    })
  }

  for (const skill of state.skills) {
    const kind = kindForSkill(skill.category)
    const catalogId = `asset-catalog-${skill.id}`
    const versions = unique([...(skill.versions ?? []).map(item => normalize(item.version)), ...syntheticVersionLabels(skill.version, kind)]).sort(compareVersionLabels)
    addEntry(entry(catalogId, skill.name, kind, skill.createdAt, { skillId: skill.id, legacyAssetId: skill.assetIds[0], description: skill.description ?? `${skill.name} 的版本化能力资产` }), versions)
  }
  const moduleAssets: Array<{ id: string; name: string; kind: AssetCatalogKind; versions: string[]; governanceObject?: string }> = [
    { id: 'asset-catalog-memory', name: '记忆召回策略', kind: 'MEMORY', versions: ['memory-policy-v1', 'memory-policy-v2', 'memory-policy-v3'], governanceObject: 'Memory' },
    { id: 'asset-catalog-tool-export', name: 'Excel 导出 Tool', kind: 'TOOL', versions: ['tool-export-v1', 'tool-export-v2'], governanceObject: 'Act' },
    { id: 'asset-catalog-system-prompt', name: 'Office Agent System Prompt', kind: 'SYSTEM_PROMPT', versions: ['prompt-2026.08', 'prompt-2026.09', 'prompt-2026.10'], governanceObject: 'Reason' },
    { id: 'asset-catalog-other-capability', name: 'Office 规划与编排能力', kind: 'OTHER_CAPABILITY', versions: ['capability-v1', 'capability-v2'], governanceObject: 'Reason' }
  ]
  moduleAssets.forEach(item => addEntry(entry(item.id, item.name, item.kind, baseAt, { description: `${item.name} · 版本化治理对象` }), item.versions))

  const catalogBySkill = new Map(state.assetCatalog!.filter(item => item.skillId).map(item => [item.skillId!, item]))
  const records = state.evolutionRecords ?? []
  const targetMatches = (catalog: AssetCatalogEntry, record: EvolutionRecord, version: AssetVersion) => {
    if (record.target.kind === 'SKILL') return catalog.skillId === record.target.skillId && normalize(record.target.skillVersion) === normalize(version.version)
    return catalog.kind === ({ Memory: 'MEMORY', Reason: 'SYSTEM_PROMPT', Act: 'TOOL', Context: 'OTHER_CAPABILITY' } as Record<string, AssetCatalogKind>)[record.target.governanceObject]
  }
  const versionForRecord = (catalog: AssetCatalogEntry, record: EvolutionRecord) => recordAssetVersion(state, catalog, record)
  for (const record of records) {
    const catalogs = record.target.kind === 'SKILL'
      ? [catalogBySkill.get(record.target.skillId)].filter(Boolean) as AssetCatalogEntry[]
      : state.assetCatalog!.filter(item => targetMatches(item, record, state.assetVersions!.find(version => version.assetId === item.id)!))
    for (const catalog of catalogs) {
      const version = versionForRecord(catalog, record)
      if (!version) continue
      const sourceTraceIds = sourceTracesForRecord(state, record)
      const attr = sourceAttribution(state, record)
      const contribution: AssetEvolutionContribution = { id: `asset-contribution-${catalog.id}-${version.version}-${record.id}`, assetId: catalog.id, assetVersionId: version.id, evolutionRecordId: record.id, attributionId: record.target.attributionId ?? attr?.id ?? record.id, attributionLabel: evolutionRecordAttributionLabel(record), traceIds: unique(sourceTraceIds), datasetIds: selectAssetEvolutionSourceDatasetIds(state, record, sourceTraceIds), status: sourceTraceIds.length ? 'HISTORICAL' : 'NOT_STARTED', createdAt: record.createdAt, updatedAt: record.updatedAt }
      state.assetEvolutionContributions!.push(contribution)
      version.sourceEvolutionRecordIds.push(record.id)
    }
  }

  const tracesByCatalog = (catalog: AssetCatalogEntry) => {
    const skill = catalog.skillId
    const matched = state.traces.filter(trace => {
      const pkg = state.tracePackages.find(item => item.traceId === trace.id)
      return skill ? (pkg?.skillIds.includes(skill) || pkg?.skillCategory === catalog.kind) : catalog.kind === 'MEMORY' ? trace.observationIds.some(id => state.observations.find(item => item.id === id)?.nodeType === 'Memory') : catalog.kind === 'TOOL' ? trace.telemetry.toolCallCount > 0 : catalog.kind === 'SYSTEM_PROMPT' || catalog.kind === 'OTHER_CAPABILITY'
    })
    return matched.length ? matched : state.traces
  }
  for (const catalog of state.assetCatalog!) {
    const versions = state.assetVersions!.filter(item => item.assetId === catalog.id)
    // Keep the seed inspectable and localStorage-friendly while retaining
    // enough records for multiple months and every version in the workbench.
    const matchedTraces = tracesByCatalog(catalog).slice(0, 6)
    matchedTraces.forEach((trace, traceIndex) => {
      const version = versions[traceIndex % versions.length]
      const outcome = state.outcomeEvals.filter(item => item.traceId === trace.id && item.isFinal !== false).sort((a, b) => Date.parse(evaluationAt(b) ?? '') - Date.parse(evaluationAt(a) ?? ''))[0]
      const score = clampScore(outcome?.score, outcome?.scoreScale)
      const contributionIds = state.assetEvolutionContributions!.filter(item => item.assetId === catalog.id && item.traceIds.includes(trace.id)).map(item => item.evolutionRecordId)
      const scoredAt = evaluationAt(outcome) ?? traceDate(trace)
      const record: AssetPerformanceRecord = { id: `asset-performance-${catalog.id}-${trace.id}`, assetId: catalog.id, assetVersionId: version.id, traceId: trace.id, caseId: trace.caseId, artifactId: outcome?.artifactId ?? trace.artifactIds[0], outcomeEvalId: outcome?.id, score, scoreScale: '0-2', queryAt: traceDate(trace), scoredAt, datasetIds: unique([...traceDatasetIds(state, trace.id), ...state.assetEvolutionContributions!.filter(item => contributionIds.includes(item.evolutionRecordId)).flatMap(item => item.datasetIds)]), evolutionRecordIds: contributionIds, createdAt: trace.createdAt, updatedAt: scoredAt }
      state.assetPerformanceRecords!.push(record)
    })
  }
  return repairAssetManagementProjection(state)
}

export function selectAssetCatalog(state: EvolutionState, filters: AssetManagementFilters = {}): AssetCatalogEntry[] {
  const query = filters.query?.trim().toLowerCase()
  return (state.assetCatalog ?? []).filter(item => {
    if (filters.kind && filters.kind !== 'ALL' && item.kind !== filters.kind) return false
    if (filters.assetId && item.id !== filters.assetId) return false
    if (query && ![item.id, item.name, item.description, ASSET_CATALOG_KIND_LABELS[item.kind]].some(value => value.toLowerCase().includes(query))) return false
    return true
  })
}

export function selectAssetVersions(state: EvolutionState, assetId?: string, filters: Pick<AssetManagementFilters, 'from' | 'to'> = {}): AssetVersion[] {
  return (state.assetVersions ?? []).filter(item => item.assetId === assetId && (!filters.from || !item.effectiveTo || Date.parse(item.effectiveTo) >= Date.parse(filters.from)) && (!filters.to || !item.effectiveFrom || Date.parse(item.effectiveFrom) <= Date.parse(filters.to))).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function selectAssetPerformance(state: EvolutionState, filters: AssetManagementFilters = {}): AssetPerformanceRecord[] {
  const selectedCatalog = filters.assetId ? new Set([filters.assetId]) : new Set(selectAssetCatalog(state, filters).map(item => item.id))
  const selectedVersions = filters.assetVersionId && filters.assetVersionId !== 'ALL' ? new Set([filters.assetVersionId]) : undefined
  return (state.assetPerformanceRecords ?? []).filter(item => selectedCatalog.has(item.assetId) && (!selectedVersions || selectedVersions.has(item.assetVersionId)) && inDateRange(item.queryAt ?? item.scoredAt, filters.from, filters.to))
}

export function selectAssetMonthlyPerformance(state: EvolutionState, filters: AssetManagementFilters = {}): AssetMonthlyPerformance[] {
  const records = selectAssetPerformance(state, filters)
  const months = new Map<string, AssetPerformanceRecord[]>()
  records.forEach(record => { const month = record.scoredAt.slice(0, 7); months.set(month, [...(months.get(month) ?? []), record]) })
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, entries]) => {
    const scored = entries.filter(item => item.score !== undefined)
    return { month, averageScore: scored.length ? Number((scored.reduce((sum, item) => sum + item.score!, 0) / scored.length).toFixed(2)) : undefined, evaluatedCount: scored.length, traceCount: new Set(entries.map(item => item.traceId)).size }
  })
}

/** Monthly score points split by immutable asset version. This is the data
 * contract used by the historical score curve and keeps the version label
 * alongside every point rather than asking the report/UI to infer it. */
export function selectAssetVersionMonthlyPerformance(state: EvolutionState, filters: AssetManagementFilters = {}): AssetVersionMonthlyPerformance[] {
  const records = selectAssetPerformance(state, filters)
  const versions = new Map((state.assetVersions ?? []).map(item => [item.id, item]))
  const groups = new Map<string, AssetPerformanceRecord[]>()
  records.forEach(record => {
    const month = (record.scoredAt ?? record.queryAt ?? '').slice(0, 7)
    if (!month) return
    const key = `${record.assetVersionId}::${month}`
    groups.set(key, [...(groups.get(key) ?? []), record])
  })
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entries]) => {
    const [assetVersionId, month] = key.split('::')
    const scored = entries.filter(item => item.score !== undefined)
    const version = versions.get(assetVersionId)
    return {
      month,
      assetVersionId,
      assetVersion: version?.version ?? assetVersionId,
      averageScore: scored.length ? Number((scored.reduce((sum, item) => sum + item.score!, 0) / scored.length).toFixed(2)) : undefined,
      evaluatedCount: scored.length,
      traceCount: new Set(entries.map(item => item.traceId)).size
    }
  })
}

export function selectAssetPerformanceSummaries(state: EvolutionState, filters: AssetManagementFilters = {}): AssetPerformanceSummary[] {
  const records = selectAssetPerformance(state, filters)
  const grouped = new Map<string, AssetPerformanceRecord[]>()
  records.forEach(record => grouped.set(record.assetVersionId, [...(grouped.get(record.assetVersionId) ?? []), record]))
  return [...grouped.entries()].map(([assetVersionId, entries]) => {
    const scored = entries.filter(item => item.score !== undefined)
    const assetId = entries[0].assetId
    const contributions = (state.assetEvolutionContributions ?? []).filter(item => item.assetVersionId === assetVersionId)
    return { assetId, assetVersionId, averageScore: scored.length ? Number((scored.reduce((sum, item) => sum + item.score!, 0) / scored.length).toFixed(2)) : undefined, evaluatedCount: scored.length, traceCount: new Set(entries.map(item => item.traceId)).size, contributionTraceCount: new Set(contributions.flatMap(item => item.traceIds)).size, contributions }
  })
}

export function selectAssetEvolutionHistory(state: EvolutionState, assetId: string, assetVersionId?: string, filters: Pick<AssetManagementFilters, 'from' | 'to'> = {}): AssetEvolutionContribution[] {
  return (state.assetEvolutionContributions ?? []).filter(item => item.assetId === assetId && (!assetVersionId || assetVersionId === 'ALL' || item.assetVersionId === assetVersionId) && inDateRange(item.createdAt, filters.from, filters.to)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function validateAssetManagementState(state: EvolutionState): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = []
  const catalogIds = new Set((state.assetCatalog ?? []).map(item => item.id))
  const versionIds = new Set((state.assetVersions ?? []).map(item => item.id))
  for (const item of state.assetVersions ?? []) {
    if (!catalogIds.has(item.assetId)) errors.push({ path: `assetVersions.${item.id}.assetId`, message: '资产版本必须关联资产目录条目' })
  }
  for (const item of state.assetPerformanceRecords ?? []) {
    if (!catalogIds.has(item.assetId) || !versionIds.has(item.assetVersionId)) errors.push({ path: `assetPerformanceRecords.${item.id}`, message: '性能记录必须关联有效资产和版本' })
    if (item.score !== undefined && (item.score < 0 || item.score > 2)) errors.push({ path: `assetPerformanceRecords.${item.id}.score`, message: '资产产物评分必须在 0–2 范围' })
    if (item.queryAt !== undefined && !validDate(item.queryAt)) errors.push({ path: `assetPerformanceRecords.${item.id}.queryAt`, message: '性能记录的 Trace Query 时间必须有效' })
  }
  for (const item of state.assetEvolutionContributions ?? []) {
    if (!catalogIds.has(item.assetId) || !versionIds.has(item.assetVersionId)) errors.push({ path: `assetEvolutionContributions.${item.id}`, message: '进化贡献必须关联有效资产和版本' })
    const traceIds = new Set(item.traceIds)
    if (traceIds.size !== item.traceIds.length) errors.push({ path: `assetEvolutionContributions.${item.id}.traceIds`, message: '同一进化贡献中的 Trace 必须去重' })
    for (const id of item.datasetIds) if (!state.datasets.some(dataset => dataset.id === id)) errors.push({ path: `assetEvolutionContributions.${item.id}.datasetIds`, message: `数据集 ${id} 不存在` })
  }
  return errors
}
