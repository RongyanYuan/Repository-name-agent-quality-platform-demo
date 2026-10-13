import type { DatasetSamplingAllocation, DatasetSamplingSnapshot, EvolutionRecord, EvolutionState } from '../domain'

export interface DatasetSamplingInput {
  datasetId: string
  assetKind: DatasetSamplingSnapshot['assetKind']
  assetId: string
  assetVersion?: string
  requestedCount: number
  createdBy?: string
  at?: string
  snapshotId?: string
}

const asTraceSet = (state: EvolutionState, record: EvolutionRecord): string[] => {
  const traceIds = new Set<string>()
  for (const findingId of record.sourceFindingIds ?? []) {
    const finding = state.evaluationFindings.find(item => item.id === findingId)
    if (finding?.traceId) traceIds.add(finding.traceId)
  }
  for (const attributionId of record.sourceAttributionIds ?? []) {
    const attribution = state.attributions.find(item => item.id === attributionId)
    if (attribution?.traceId) traceIds.add(attribution.traceId)
  }
  for (const issueId of record.sourceIssueIds ?? []) {
    const issue = state.issues.find(item => item.id === issueId)
    if (!issue) continue
    const sourceCase = state.cases.find(item => item.id === issue.caseId)
    sourceCase?.traceIds.forEach(id => traceIds.add(id))
  }
  for (const clusterId of record.sourceClusterIds ?? []) {
    const cluster = state.issueClusters.find(item => item.id === clusterId)
    cluster?.caseIds.forEach(caseId => state.cases.find(item => item.id === caseId)?.traceIds.forEach(id => traceIds.add(id)))
  }
  return [...traceIds].sort()
}

const targetMatches = (record: EvolutionRecord, input: DatasetSamplingInput): boolean => {
  const target = record.target
  if (input.assetKind === 'SKILL') {
    return target.kind === 'SKILL' && target.skillId === input.assetId && (!input.assetVersion || target.skillVersion === input.assetVersion)
  }
  if (target.kind !== 'MODULE' || target.governanceObject !== input.assetKind) return false
  return (!input.assetId || target.targetId === input.assetId) && (!input.assetVersion || target.targetVersion === input.assetVersion)
}

const attributionLabel = (state: EvolutionState, record: EvolutionRecord): { id: string; label: string } => {
  const attribution = (record.sourceAttributionIds ?? []).map(id => state.attributions.find(item => item.id === id)).find(Boolean)
  return { id: record.target.attributionId || attribution?.id || record.id, label: attribution?.dimension ?? record.name }
}

/**
 * Build a deterministic proportional sampling plan.  Every evolution record
 * contributes one de-duplicated Trace set; quotas use the record's historical
 * share.  A Trace that belongs to several records is selected at most once and
 * the unused quota is filled from the remaining candidates in stable order.
 */
export function buildDatasetSamplingSnapshot(state: EvolutionState, input: DatasetSamplingInput): DatasetSamplingSnapshot {
  const at = input.at ?? new Date().toISOString()
  const requestedCount = Math.max(0, Math.floor(input.requestedCount))
  const records = (state.evolutionRecords ?? [])
    .filter(record => targetMatches(record, input))
    .map(record => ({ record, traceIds: asTraceSet(state, record), attribution: attributionLabel(state, record) }))
    .filter(item => item.traceIds.length > 0)
    .sort((a, b) => `${a.record.createdAt}:${a.record.id}`.localeCompare(`${b.record.createdAt}:${b.record.id}`))
  const totalHistorical = records.reduce((sum, item) => sum + item.traceIds.length, 0)
  const quotas = records.map(item => {
    const exact = totalHistorical ? requestedCount * item.traceIds.length / totalHistorical : 0
    return { ...item, exact, floor: Math.floor(exact), fraction: exact - Math.floor(exact) }
  })
  let remaining = Math.max(0, requestedCount - quotas.reduce((sum, item) => sum + item.floor, 0))
  quotas.sort((a, b) => b.fraction - a.fraction || a.record.id.localeCompare(b.record.id))
  for (let index = 0; index < quotas.length && remaining > 0; index += 1, remaining -= 1) quotas[index].floor += 1
  quotas.sort((a, b) => `${a.record.createdAt}:${a.record.id}`.localeCompare(`${b.record.createdAt}:${b.record.id}`))

  const used = new Set<string>()
  const allocations = quotas.map(item => {
    const selected = item.traceIds.filter(traceId => !used.has(traceId)).slice(0, item.floor)
    selected.forEach(traceId => used.add(traceId))
    return {
      evolutionRecordId: item.record.id,
      attributionId: item.attribution.id,
      attributionLabel: item.attribution.label,
      historicalTraceCount: item.traceIds.length,
      historicalShare: totalHistorical ? item.traceIds.length / totalHistorical : 0,
      requestedCount: item.floor,
      sampledTraceIds: selected
    } satisfies DatasetSamplingAllocation
  })
  // Overlap can leave a quota unfilled. Reassign available traces to the first
  // allocation that still has capacity, preserving the same proportional plan.
  const allCandidates = [...new Set(quotas.flatMap(item => item.traceIds))].sort()
  for (const traceId of allCandidates) {
    if (used.has(traceId)) continue
    const allocation = allocations.find(item => item.sampledTraceIds.length < item.requestedCount && quotas.some(candidate => candidate.record.id === item.evolutionRecordId && candidate.traceIds.includes(traceId)))
    if (!allocation) continue
    allocation.sampledTraceIds.push(traceId)
    used.add(traceId)
  }
  return {
    id: input.snapshotId ?? `sampling-${input.datasetId}-${at.replace(/[^0-9]/g, '')}`,
    datasetId: input.datasetId,
    assetKind: input.assetKind,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    requestedCount,
    candidateTraceIds: allCandidates,
    allocations,
    deduplicatedTraceCount: used.size,
    samplingRule: '按每个历史进化项经历过的去重 Trace 数计算占比；同一 Trace 命中多个进化项时只纳入一次。',
    status: 'PREVIEW',
    createdBy: input.createdBy ?? '当前用户',
    createdAt: at,
    updatedAt: at
  }
}

