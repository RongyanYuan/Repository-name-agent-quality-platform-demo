import type { EvolutionState } from '../domain'
import { CORE_HISTORICAL_SKILL_VERSIONS, normalizeWorkspaceTargets } from './skillWorkspaceFixtures'

/** Update demonstration fixtures without clearing local user work or reports. */
export function upgradeMockFixtures(previous: EvolutionState, seed: EvolutionState, at: string, auditId: string): EvolutionState {
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
    if (!replacement || !item.id.startsWith('trace-v2-')) return item
    return { ...item, channel: item.channel ?? replacement.channel, verticalScenario: item.verticalScenario ?? replacement.verticalScenario, queryAt: item.queryAt ?? replacement.queryAt ?? item.startedAt, artifactIds: [...new Set([...item.artifactIds, ...replacement.artifactIds])], telemetry: { ...replacement.telemetry, ...item.telemetry, modelLatencyMs: item.telemetry.modelLatencyMs ?? replacement.telemetry.modelLatencyMs, modelThroughputTokensPerSecond: item.telemetry.modelThroughputTokensPerSecond ?? replacement.telemetry.modelThroughputTokensPerSecond } }
  }), seed.traces).map((item, index) => {
    const recordedSeed = seed.traces.find(candidate => candidate.id === item.id && candidate.caseId === item.caseId && candidate.sessionId === item.sessionId)
    const skillVersion = item.skillVersion ?? (CORE_HISTORICAL_SKILL_VERSIONS[item.id] ? recordedSeed?.skillVersion : undefined)
    return { ...item, skillVersion, channel: item.channel ?? (['小程序', 'genflow pc 端', 'genflow 垂类入口'] as const)[index % 3], verticalScenario: item.verticalScenario ?? (['PPT', 'Word', 'Excel', '生图'] as const)[index % 4], queryAt: item.queryAt ?? item.startedAt }
  })
  state.tracePackages = merge(state.tracePackages.map((item) => {
    const replacement = seed.tracePackages.find((candidate) => candidate.id === item.id)
    if (!replacement || !item.traceId.startsWith('trace-v2-') || touched(item.id)) return item
    return { ...replacement, skillVersion: item.skillVersion, moduleScores: replacement.moduleScores.map((score) => {
      const human = item.moduleScores.find((candidate) => candidate.moduleCode === score.moduleCode)
      return human?.humanStatus ? { ...score, humanStatus: human.humanStatus, humanScore: human.humanScore, humanNote: human.humanNote, humanUpdatedAt: human.humanUpdatedAt, humanUpdatedBy: human.humanUpdatedBy } : score
    }) }
  }), seed.tracePackages).map(item => {
    const replacement = seed.tracePackages.find(candidate => candidate.id === item.id && candidate.traceId === item.traceId && candidate.caseId === item.caseId)
    const skillVersion = item.skillVersion ?? (CORE_HISTORICAL_SKILL_VERSIONS[item.traceId] ? replacement?.skillVersion : undefined)
    return { ...item, skillVersion, ...(!item.rating && replacement ? { rating: replacement.rating } : {}) }
  })
  state.evaluationFindings = merge(state.evaluationFindings.map((item) => {
    const replacement = seed.evaluationFindings.find((candidate) => candidate.id === item.id)
    return replacement && !touched(item.id) ? { ...replacement, status: item.status } : item
  }), seed.evaluationFindings)
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
  state.outcomeEvals = merge(state.outcomeEvals.map((item) => {
    const replacement = seed.outcomeEvals.find((candidate) => candidate.id === item.id)
    const isGeneratedOutcomeCoverage = item.id.startsWith('eval-') || item.id.startsWith('outcome-eval-')
    return replacement && isGeneratedOutcomeCoverage && !touched(item.id) ? clone(replacement) : item
  }), seed.outcomeEvals)
  state.attributions = merge(state.attributions, seed.attributions)
  state.issues = merge(state.issues, seed.issues)
  state.issueClusters = merge(state.issueClusters, seed.issueClusters)
  state.variants = merge(state.variants, seed.variants)
    .map(item => ({ ...item, targets: normalizeWorkspaceTargets(item.targets ?? seed.variants.find(candidate => candidate.id === item.id)?.targets) }))
  state.datasets = merge(state.datasets, seed.datasets).map((item) => {
    const replacement = seed.datasets.find((candidate) => candidate.id === item.id)
    return replacement && !touched(item.id) ? { ...item, purpose: item.purpose ?? replacement.purpose, targets: replacement.targets ? clone(replacement.targets) : normalizeWorkspaceTargets(item.targets), setRole: item.setRole ?? replacement.setRole, windowIds: item.windowIds ?? replacement.windowIds } : { ...item, targets: normalizeWorkspaceTargets(item.targets) }
  })
  state.experiments = merge(state.experiments, seed.experiments).map(item => {
    const replacement = seed.experiments.find(candidate => candidate.id === item.id)
    return { ...item, targets: !touched(item.id) && replacement?.targets ? clone(replacement.targets) : normalizeWorkspaceTargets(item.targets) }
  })
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
  state.algorithmBadcases = merge(state.algorithmBadcases, seed.algorithmBadcases)
  state.badcaseQueues = merge(state.badcaseQueues, seed.badcaseQueues).map((item) => ({ ...item, deliveryIds: state.routingDeliveries.filter((delivery) => delivery.queueId === item.id).map((delivery) => delivery.id), itemIds: state.algorithmBadcases.filter((badcase) => badcase.queueId === item.id).map((badcase) => badcase.id) }))
  state.tastePreferenceSignals = merge(state.tastePreferenceSignals, seed.tastePreferenceSignals)
  state.seedVersion = seed.seedVersion
  state.updatedAt = at
  state.auditTrail.push({ id: auditId, at, actor: 'EvolutionRepository', action: 'MOCK_FIXTURE_UPGRADED', entityType: 'EvolutionState', entityId: seed.seedVersion, reason: '增量更新 Mock 评测与批量品味样例；保留人工标注、自建对象和历史实验快照。' })
  return state
}
