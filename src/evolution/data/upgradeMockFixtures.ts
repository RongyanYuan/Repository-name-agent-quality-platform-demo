import type { EvolutionState } from '../domain'
import { CORE_HISTORICAL_SKILL_VERSIONS, normalizeWorkspaceTargets } from './skillWorkspaceFixtures'
import { aliasesForIdentity, alignSeedIdentityState, canonicalizeIdentityState } from '../identity'

/** Update demonstration fixtures without clearing local user work or reports. */
export function upgradeMockFixtures(previous: EvolutionState, seed: EvolutionState, at: string, auditId: string): EvolutionState {
  previous = canonicalizeIdentityState(previous)
  seed = alignSeedIdentityState(seed, previous)
  const clone = <T,>(value: T): T => structuredClone(value)
  const merge = <T extends { id: string }>(current: T[] | undefined, additions: T[]): T[] => {
    const existing = new Set((current ?? []).map((item) => item.id))
    return [...(current ?? []), ...additions.filter((item) => !existing.has(item.id)).map(clone)]
  }
  const touched = (id: string) => previous.auditTrail.some((event) => event.entityId === id && event.actor !== 'Demo Seeder')
  const state = clone(previous)
  // Only the machine-generated V2 demo records are refreshed. Manual fields,
  // custom records and historical experiment/report snapshots are untouched.
  state.cases = merge(state.cases.map((item) => {
    const replacement = seed.cases.find((candidate) => candidate.id === item.id)
    if (!replacement || !item.id.startsWith('case-v2-')) return item
    const changes = previous.auditTrail.filter((event) => event.entityId === item.id).flatMap((event) => Object.keys(event.changes ?? {}))
    const humanFields = Object.fromEntries(changes.filter((key) => key in item).map((key) => [key, item[key as keyof typeof item]]))
    return { ...replacement, title: item.title, query: item.query, feedback: item.feedback ?? replacement.feedback, acceptanceStatus: item.acceptanceStatus ?? replacement.acceptanceStatus, owner: item.owner ?? replacement.owner, ...humanFields }
  }), seed.cases).map((item, index) => { const replacement = seed.cases.find(candidate => candidate.id === item.id); const trace = seed.traces.find(candidate => candidate.caseId === item.id); return replacement ? { ...item, channel: item.channel ?? replacement.channel ?? trace?.channel ?? (['小程序', 'genflow pc 端', 'genflow 垂类入口'] as const)[index % 3], verticalScenario: item.verticalScenario ?? replacement.verticalScenario ?? trace?.verticalScenario ?? (['PPT', 'Word', 'Excel', '生图'] as const)[index % 4] } : item })
  state.traces = merge(state.traces.map((item) => {
    const replacement = seed.traces.find((candidate) => candidate.id === item.id)
    if (!replacement || !aliasesForIdentity(previous, 'trace', item.id).some(id => id.startsWith('trace-v2-'))) return item
    return { ...item, channel: item.channel ?? replacement.channel, verticalScenario: item.verticalScenario ?? replacement.verticalScenario, queryAt: item.queryAt ?? replacement.queryAt ?? item.startedAt, artifactIds: [...new Set([...item.artifactIds, ...replacement.artifactIds])], telemetry: { ...replacement.telemetry, ...item.telemetry, modelLatencyMs: item.telemetry.modelLatencyMs ?? replacement.telemetry.modelLatencyMs, modelThroughputTokensPerSecond: item.telemetry.modelThroughputTokensPerSecond ?? replacement.telemetry.modelThroughputTokensPerSecond } }
  }), seed.traces).map((item, index) => {
    const recordedSeed = seed.traces.find(candidate => candidate.id === item.id && candidate.caseId === item.caseId && candidate.sessionId === item.sessionId)
    const skillVersion = item.skillVersion ?? (aliasesForIdentity(previous, 'trace', item.id).some(id => CORE_HISTORICAL_SKILL_VERSIONS[id]) ? recordedSeed?.skillVersion : undefined)
    return { ...item, skillVersion, channel: item.channel ?? (['小程序', 'genflow pc 端', 'genflow 垂类入口'] as const)[index % 3], verticalScenario: item.verticalScenario ?? (['PPT', 'Word', 'Excel', '生图'] as const)[index % 4], queryAt: item.queryAt ?? item.startedAt }
  })
  state.tracePackages = merge(state.tracePackages.map((item) => {
    const replacement = seed.tracePackages.find((candidate) => candidate.id === item.id)
    if (!replacement || !aliasesForIdentity(previous, 'trace', item.traceId).some(id => id.startsWith('trace-v2-')) || touched(item.id)) return item
    return { ...replacement, skillVersion: item.skillVersion, moduleScores: replacement.moduleScores.map((score) => {
      const human = item.moduleScores.find((candidate) => candidate.moduleCode === score.moduleCode)
      return human?.humanStatus ? { ...score, humanStatus: human.humanStatus, humanScore: human.humanScore, humanNote: human.humanNote, humanUpdatedAt: human.humanUpdatedAt, humanUpdatedBy: human.humanUpdatedBy } : score
    }) }
  }), seed.tracePackages).map(item => {
    const replacement = seed.tracePackages.find(candidate => candidate.id === item.id && candidate.traceId === item.traceId && candidate.caseId === item.caseId)
    const skillVersion = item.skillVersion ?? (aliasesForIdentity(previous, 'trace', item.traceId).some(id => CORE_HISTORICAL_SKILL_VERSIONS[id]) ? replacement?.skillVersion : undefined)
    return { ...item, skillVersion, ...(!item.rating && replacement ? { rating: replacement.rating } : {}) }
  })
  state.evaluationFindings = merge(state.evaluationFindings.map((item) => {
    const replacement = seed.evaluationFindings.find((candidate) => candidate.id === item.id)
    return replacement && !touched(item.id) ? { ...replacement, status: item.status } : item
  }), seed.evaluationFindings)
  state.routingPolicies = merge(state.routingPolicies, seed.routingPolicies)
  state.routingDecisions = merge(state.routingDecisions, seed.routingDecisions)
  state.routingDeliveries = merge(state.routingDeliveries.map((item) => {
    const replacement = seed.routingDeliveries.find((candidate) => candidate.id === item.id)
    if (!replacement || touched(item.id)) return item
    return { ...replacement, status: item.status, owner: item.owner ?? replacement.owner, note: item.note ?? replacement.note }
  }), seed.routingDeliveries)
  state.evaluationBatches = merge(state.evaluationBatches, seed.evaluationBatches)
  state.evaluationJobs = merge(state.evaluationJobs, seed.evaluationJobs)
  state.sessions = merge(state.sessions, seed.sessions)
  state.observations = merge(state.observations, seed.observations)
  state.evidence = merge(state.evidence, seed.evidence)
  state.artifacts = merge(state.artifacts, seed.artifacts)
  state.processEvals = merge(state.processEvals, seed.processEvals)
  state.outcomeEvals = merge(state.outcomeEvals, seed.outcomeEvals)
  state.cases = state.cases.map(item=>({...item,outcomeEvalIds:[...new Set([...item.outcomeEvalIds,...state.outcomeEvals.filter(evaluation=>evaluation.caseId===item.id).map(evaluation=>evaluation.id)])]}))
  state.attributions = merge(state.attributions, seed.attributions)
  state.issues = merge(state.issues, seed.issues)
  state.cases = state.cases.map(record=>({...record,issueIds:[...new Set([...record.issueIds,...state.issues.filter(issue=>issue.caseId===record.id).map(issue=>issue.id)])],attributionIds:[...new Set([...record.attributionIds,...state.attributions.filter(attribution=>attribution.caseId===record.id).map(attribution=>attribution.id)])]}))
  state.issueClusters = merge(state.issueClusters, seed.issueClusters)
  // New Mock clusters can refer to an existing issue. Add their reciprocal
  // links without replacing its manual fields or original cluster history.
  state.issues = state.issues.map(issue => ({ ...issue, clusterIds: [...new Set([...issue.clusterIds, ...state.issueClusters.filter(cluster => cluster.issueIds.includes(issue.id)).map(cluster => cluster.id)])] }))
  state.variants = merge(state.variants, seed.variants)
    .map(item => ({ ...item, targets: normalizeWorkspaceTargets(item.targets ?? seed.variants.find(candidate => candidate.id === item.id)?.targets) }))
  state.datasets = merge(state.datasets, seed.datasets).map((item) => {
    const replacement = seed.datasets.find((candidate) => candidate.id === item.id)
    return replacement && !touched(item.id) ? {
      ...item,
      purpose: item.purpose ?? replacement.purpose,
      targets: replacement.targets ? clone(replacement.targets) : normalizeWorkspaceTargets(item.targets),
      setRole: item.setRole ?? replacement.setRole,
      windowIds: item.windowIds ?? replacement.windowIds,
      datasetCategory: item.datasetCategory ?? replacement.datasetCategory,
      createdBy: item.createdBy ?? replacement.createdBy,
      ownerScope: item.ownerScope ?? replacement.ownerScope
    } : { ...item, targets: normalizeWorkspaceTargets(item.targets) }
  })
  state.experiments = merge(state.experiments, seed.experiments).map(item => {
    const replacement = seed.experiments.find(candidate => candidate.id === item.id)
    return { ...item, targets: !touched(item.id) && replacement?.targets ? clone(replacement.targets) : normalizeWorkspaceTargets(item.targets) }
  })
  state.experimentRuns = merge(state.experimentRuns, seed.experimentRuns)
  state.gateDecisions = merge(state.gateDecisions, seed.gateDecisions)
  state.releases = merge(state.releases, seed.releases)
  state.windows = merge(state.windows, seed.windows)
  state.skills = merge(state.skills, seed.skills).map((item) => {
    const replacement = seed.skills.find((candidate) => candidate.id === item.id)
    if (!replacement) return item
    return {
      ...item,
      ...(touched(item.id) ? {} : { name: replacement.name, version: replacement.version, category: replacement.category, evolutionHistory: replacement.evolutionHistory }),
      versions: merge(item.versions, replacement.versions ?? []),
      evolutionRecordIds: [...new Set([...item.evolutionRecordIds, ...(replacement.evolutionRecordIds ?? [])])]
    }
  })
  // Asset Management workbench projections are additive. Keep local custom
  // catalog/version edits and only add missing machine-generated fixtures.
  state.assetCatalog = merge(state.assetCatalog, seed.assetCatalog ?? [])
  state.assetVersions = merge(state.assetVersions, seed.assetVersions ?? [])
  state.assetPerformanceRecords = merge(state.assetPerformanceRecords, seed.assetPerformanceRecords ?? [])
  state.assetEvolutionContributions = merge(state.assetEvolutionContributions, seed.assetEvolutionContributions ?? [])
  state.algorithmBadcases = merge(state.algorithmBadcases, seed.algorithmBadcases)
  state.badcaseQueues = merge(state.badcaseQueues, seed.badcaseQueues).map((item) => ({ ...item, deliveryIds: state.routingDeliveries.filter((delivery) => delivery.queueId === item.id).map((delivery) => delivery.id), itemIds: state.algorithmBadcases.filter((badcase) => badcase.queueId === item.id).map((badcase) => badcase.id) }))
  state.tastePreferenceSignals = merge(state.tastePreferenceSignals, seed.tastePreferenceSignals)
  state.moduleReviews = merge(state.moduleReviews, seed.moduleReviews ?? [])
  state.moduleEvolutionBindings = merge(state.moduleEvolutionBindings, seed.moduleEvolutionBindings ?? [])
  state.evolutionRecords = merge(state.evolutionRecords, seed.evolutionRecords ?? [])
  // The in-progress 2.7.0 preview saved this generated taste path before its
  // independent Skill population was added. Repair that exact Mock relation;
  // manual changes and immutable experiment/report snapshots stay untouched.
  if (previous.seedVersion === 'office-agent-governance-demo-2.7.0') {
    state.evolutionRecords = state.evolutionRecords.map(record => {
      if (record.id !== 'evolution-finding-module-path-demo-taste-undistributed' || record.origin !== 'MOCK' || touched(record.id)) return record
      const corrected = seed.evolutionRecords?.find(item => item.id === record.id)
      return corrected ? { ...record, target: clone(corrected.target), sourceClusterIds: [...corrected.sourceClusterIds], triggerRuleId: corrected.triggerRuleId, datasetIds: [...corrected.datasetIds] } : record
    })
  }
  state.datasetMemberships = merge(state.datasetMemberships, seed.datasetMemberships ?? [])
  // Backfill the sample coverage window for older local datasets that were
  // created before Dataset.timeRange was populated. The range is derived from
  // explicit Trace membership; it never uses Dataset.createdAt/updatedAt.
  state.datasets = state.datasets.map(dataset => {
    if (dataset.timeRange) return dataset
    const memberships = (state.datasetMemberships ?? []).filter(member => member.datasetId === dataset.id && member.datasetVersion === dataset.version)
    const traceIds = memberships.flatMap(member => member.scope === 'CASE_SHARED'
      ? state.traces.filter(trace => trace.caseId === member.caseId).map(trace => trace.id)
      : member.traceIds)
    const traces = state.traces.filter(trace => traceIds.includes(trace.id))
    const starts = traces.map(trace => Date.parse(trace.queryAt ?? trace.startedAt)).filter(Number.isFinite)
    const ends = traces.map(trace => Date.parse(trace.queryAt ?? trace.endedAt)).filter(Number.isFinite)
    if (!starts.length || !ends.length) return dataset
    return { ...dataset, timeRange: { from: new Date(Math.min(...starts)).toISOString(), to: new Date(Math.max(...ends)).toISOString() } }
  })
  state.governanceEvents = merge(state.governanceEvents, seed.governanceEvents ?? []).map(item=>{
    const original=seed.governanceEvents?.find(event=>event.id===item.id)
    return item.parentEventIds || !original?.parentEventIds ? item : {...item,parentEventIds:[...original.parentEventIds]}
  })
  const aliases = [...(state.identityAliases ?? []), ...(seed.identityAliases ?? [])]
  const aliasTargets = new Map<string, string>()
  aliases.forEach(alias => {
    const key = `${alias.kind}:${alias.alias}`
    if (aliasTargets.has(key) && aliasTargets.get(key) !== alias.canonicalId) throw new Error(`身份 alias 冲突：${key} 在旧数据和新样例中指向不同对象`)
    aliasTargets.set(key, alias.canonicalId)
  })
  state.identityAliases = [...new Map(aliases.map(alias => [`${alias.kind}:${alias.alias}`, alias])).values()]
  state.seedVersion = seed.seedVersion
  state.updatedAt = at
  state.auditTrail.push({ id: auditId, at, actor: 'EvolutionRepository', action: 'MOCK_FIXTURE_UPGRADED', entityType: 'EvolutionState', entityId: seed.seedVersion, reason: '增量更新 Mock 评测与批量品味样例；保留人工标注、自建对象和历史实验快照。' })
  return canonicalizeIdentityState(state)
}
