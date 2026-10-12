import type { EvolutionState, EvolutionTarget, Experiment, GateDecision } from '../domain'
import { GOVERNANCE_OBJECTS, governanceItemsFor, governanceItemLabel, governanceObjectForEvolutionItem, type GovernanceObjectId } from '../governanceTaxonomy'
import { evolutionItemId, type EvolutionItemDefinition } from '../taxonomy'

export interface SkillVersionOption {
  id: string
  version: string
  status: 'RELEASED' | 'CANDIDATE' | 'DEPRECATED' | 'PLANNED'
  description: string
  createdAt: string
  updatedAt: string
}

export interface GovernanceScope {
  skillId?: string
  skillVersion?: string
  governanceObject?: GovernanceObjectId | ''
  attribution?: string
  evolutionItem?: string
  optimizationMode?: string
  query?: string
}

export interface GovernanceTrack {
  key: string
  skillId: string
  skillVersion: string
  attributionId: string
  definition: EvolutionItemDefinition
  objectLabel: string
  title: string
  datasetIds: string[]
  experimentIds: string[]
  variantIds: string[]
  caseIds: string[]
  traceIds: string[]
  findingIds: string[]
  evidenceIds: string[]
  attributionIds: string[]
  issueIds: string[]
  clusterIds: string[]
  gateIds: string[]
  releaseIds: string[]
  stateLabel: string
  active: boolean
  updatedAt: string
}

/** Canonical version identity: legacy prefixes are labels, not part of a version. */
export function normalizeSkillVersion(raw?: string): string {
  if (!raw) return ''
  if (raw === '未生成') return raw
  return raw.match(/\d+(?:\.\d+)+(?:-[\w.-]+)?(?:\+[\w.-]+)?/)?.[0] ?? raw
}

export function targetAttributionId(target: Partial<EvolutionTarget>): string {
  const value = target.attributionId ?? target.evolutionItemId ?? ''
  return evolutionItemId(value) ?? value
}

export function targetMatchesScope(target: EvolutionTarget, scope: GovernanceScope): boolean {
  const attribution = scope.attribution ?? scope.evolutionItem
  return (!scope.skillId || target.skillId === scope.skillId)
    && (!scope.skillVersion || normalizeSkillVersion(target.skillVersion) === normalizeSkillVersion(scope.skillVersion))
    && (!attribution || targetAttributionId(target) === (evolutionItemId(attribution) ?? attribution))
    && (!scope.governanceObject || governanceObjectForEvolutionItem(targetAttributionId(target)) === scope.governanceObject)
}

function compareVersions(a: string, b: string): number {
  const left = a.split('-')[0].split('.').map(Number)
  const right = b.split('-')[0].split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const delta = (left[index] || 0) - (right[index] || 0)
    if (delta) return delta
  }
  if (a.includes('-') !== b.includes('-')) return a.includes('-') ? -1 : 1
  return a.localeCompare(b, undefined, { numeric: true })
}

export function skillVersions(state: EvolutionState, skillId: string): SkillVersionOption[] {
  const skill = state.skills.find(item => item.id === skillId)
  if (!skill) return []
  const explicit = skill.versions ?? []
  if (explicit.length) return [...explicit].map(item => ({ ...item, version: normalizeSkillVersion(item.version) })).sort((a, b) => compareVersions(b.version, a.version))
  const current = normalizeSkillVersion(skill.version)
  const candidates = [skill.version,
    ...state.datasets.flatMap(dataset => (dataset.targets ?? []).filter(target => target.skillId === skillId).map(target => target.skillVersion ?? '')),
    ...state.experiments.flatMap(experiment => (experiment.targets ?? []).filter(target => target.skillId === skillId).map(target => target.skillVersion ?? '')),
    ...(skill.evolutionHistory ?? []).filter(entry => !['发布版本', '窗口组合实验'].includes(entry.stage) && !entry.version.startsWith('agent-')).map(entry => entry.version)
  ].filter(Boolean).filter(value => !value.startsWith('agent-'))
  return [...new Set(candidates.map(normalizeSkillVersion))].map(version => ({
    id: `${skillId}@${version}`, version,
    status: version === '未生成' ? 'PLANNED' as const : version.includes('-') ? 'CANDIDATE' as const : version === current ? 'RELEASED' as const : 'DEPRECATED' as const,
    description: version === current ? '当前版本' : '历史版本', createdAt: skill.createdAt, updatedAt: skill.updatedAt
  })).sort((a, b) => compareVersions(b.version, a.version))
}

export function latestSkillVersion(state: EvolutionState, skillId: string): string {
  return skillVersions(state, skillId)[0]?.version ?? ''
}

/** An explicit current decision wins; stale PASS decisions cannot override a later rejection. */
export function currentGateDecision(state: EvolutionState, experiment: Experiment): GateDecision | undefined {
  if (!['COMPLETED', 'DECIDED'].includes(experiment.status)) return undefined
  if (experiment.gateDecisionId) return state.gateDecisions.find(item => item.id === experiment.gateDecisionId && item.experimentId === experiment.id)
  return state.gateDecisions.filter(item => item.experimentId === experiment.id && Date.parse(item.decidedAt) >= Date.parse(experiment.updatedAt)).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0]
}

function optimizationMatches(definition: EvolutionItemDefinition, filter?: string) {
  if (!filter) return true
  const normalized = filter === 'DIRECT_FIX' ? '直接优化' : filter === 'CLUSTER_OPTIMIZATION' ? '聚类优化' : filter
  return definition.optimization === normalized || definition.condition.split('/').includes(normalized)
}

const unique = (values: string[]) => [...new Set(values)]
const ids = <T extends { id: string }>(items: T[]) => items.map(item => item.id)
const otherId = 'other-badcase-unclassified'

export function governanceTracks(state: EvolutionState, scope: GovernanceScope = {}): GovernanceTrack[] {
  const tracks = new Map<string, GovernanceTrack>()
  const definitions = governanceItemsFor('')
  const traceMatches = (traceId: string, skillId: string, version: string) => {
    const trace = state.traces.find(item => item.id === traceId)
    if (!trace) return false
    const pkg = state.tracePackages.find(item => item.traceId === traceId)
    const record = state.cases.find(item => item.id === trace.caseId)
    return (pkg?.skillIds ?? record?.skillIds ?? []).includes(skillId)
      && normalizeSkillVersion(trace.skillVersion ?? pkg?.skillVersion) === normalizeSkillVersion(version)
  }
  const memberSourceCases = (caseIds: string[], track: GovernanceTrack) => caseIds.filter(caseId => state.traces.some(trace => trace.caseId === caseId && traceMatches(trace.id, track.skillId, track.skillVersion)))
  const touch = (track: GovernanceTrack, at?: string) => { if (at && at > track.updatedAt) track.updatedAt = at }
  const ensure = (skillId: string, rawVersion: string | undefined, rawAttribution: string) => {
    if (!skillId || !rawVersion || rawVersion.startsWith('agent-')) return undefined
    const attributionId = evolutionItemId(rawAttribution) ?? (rawAttribution || otherId)
    const skillVersion = normalizeSkillVersion(rawVersion)
    const key = `${skillId}@${skillVersion}#${attributionId}`
    if (!tracks.has(key)) {
      const definition = definitions.find(item => item.id === attributionId) ?? { ...definitions.find(item => item.id === otherId)!, id: attributionId }
      const skill = state.skills.find(item => item.id === skillId)
      const objectLabel = GOVERNANCE_OBJECTS.find(item => item.id === governanceObjectForEvolutionItem(attributionId))?.label ?? '其他 Badcase'
      tracks.set(key, { key, skillId, skillVersion, attributionId, definition, objectLabel,
        title: `${skill?.name ?? skillId} · ${skillVersion} · ${governanceItemLabel(definition)}`,
        datasetIds: [], experimentIds: [], variantIds: [], caseIds: [], traceIds: [], findingIds: [], evidenceIds: [], attributionIds: [], issueIds: [], clusterIds: [], gateIds: [], releaseIds: [],
        stateLabel: '待启动', active: true, updatedAt: '' })
    }
    return tracks.get(key)!
  }
  // A dataset may be reused across versions, but each explicit target remains a distinct track.
  for (const dataset of state.datasets) for (const target of dataset.targets ?? []) {
    const track = ensure(target.skillId, target.skillVersion, targetAttributionId(target))
    if (!track) continue
    track.datasetIds.push(dataset.id); track.caseIds.push(...memberSourceCases(dataset.caseIds, track))
    touch(track, dataset.updatedAt)
  }
  for (const experiment of state.experiments) for (const target of experiment.targets ?? []) {
    const track = ensure(target.skillId, target.skillVersion, targetAttributionId(target))
    if (!track) continue
    track.experimentIds.push(experiment.id)
    touch(track, experiment.updatedAt)
  }
  for (const variant of state.variants) for (const target of variant.targets ?? []) {
    const track = ensure(target.skillId, target.skillVersion, targetAttributionId(target))
    if (!track) continue
    track.variantIds.push(variant.id); track.caseIds.push(...memberSourceCases(variant.sourceCaseIds, track))
    touch(track, variant.updatedAt)
  }
  const sourceTargets = (traceId: string, dimension: string) => {
    const trace = state.traces.find(item => item.id === traceId)
    if (!trace) return []
    const pkg = state.tracePackages.find(item => item.traceId === traceId)
    const record = state.cases.find(item => item.id === trace.caseId)
    const attributionId = evolutionItemId(dimension)
    if (!attributionId) return []
    return (pkg?.skillIds ?? record?.skillIds ?? []).map(skillId => ensure(skillId, trace.skillVersion ?? pkg?.skillVersion, attributionId)).filter((track): track is GovernanceTrack => Boolean(track))
  }
  for (const attribution of state.attributions) for (const track of sourceTargets(attribution.traceId, attribution.dimensionLabel ?? attribution.dimension)) {
    track.attributionIds.push(attribution.id); track.caseIds.push(attribution.caseId); track.traceIds.push(attribution.traceId); track.evidenceIds.push(...attribution.evidenceIds)
    touch(track, attribution.updatedAt)
  }
  for (const finding of state.evaluationFindings) for (const track of sourceTargets(finding.traceId, finding.dimensionLabel)) {
    track.findingIds.push(finding.id); track.caseIds.push(finding.caseId); track.traceIds.push(finding.traceId); track.evidenceIds.push(...(finding.evidenceBundle?.rootEvidenceIds ?? []))
    touch(track, finding.updatedAt)
  }
  for (const track of tracks.values()) {
    const issues = state.issues.filter(item => track.attributionIds.includes(item.attributionId))
    track.issueIds.push(...ids(issues)); track.evidenceIds.push(...issues.flatMap(item => item.evidenceIds))
    const clusters = state.issueClusters.filter(item => item.issueIds.some(id => track.issueIds.includes(id)))
    track.clusterIds.push(...ids(clusters)); track.evidenceIds.push(...clusters.flatMap(item => item.evidenceIds))
    const matchesTarget = (target: EvolutionTarget) => targetMatchesScope(target, { skillId: track.skillId, skillVersion: track.skillVersion, attribution: track.attributionId })
    const variants = state.variants.filter(item => item.targets?.length
      ? item.targets.some(matchesTarget)
      : item.sourceIssueIds.some(id => track.issueIds.includes(id)) || item.sourceClusterIds.some(id => track.clusterIds.includes(id)))
    track.variantIds.push(...ids(variants))
    // Legacy experiments without targets can only inherit an unambiguous source-variant relation.
    const experiments = state.experiments.filter(experiment => experiment.targets?.length
      ? experiment.targets.some(target => targetMatchesScope(target, { skillId: track.skillId, skillVersion: track.skillVersion, attribution: track.attributionId }))
      : experiment.variantIds.some(id => track.variantIds.includes(id)))
    track.experimentIds = ids(experiments)
    track.variantIds.push(...experiments.flatMap(item => item.variantIds).filter(id => variants.some(variant => variant.id === id)))
    const gates = state.gateDecisions.filter(item => track.experimentIds.includes(item.experimentId))
    track.gateIds.push(...ids(gates))
    const releases = state.releases.filter(item => track.experimentIds.includes(item.combinationExperimentId))
    track.releaseIds.push(...ids(releases))
    const latestRelease = [...releases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    const latestExperiment = [...experiments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    const latestGate = latestExperiment ? currentGateDecision(state, latestExperiment) : undefined
    const trackFindings = state.evaluationFindings.filter(finding => track.findingIds.includes(finding.id))
    const hasOpenFinding = trackFindings.some(finding => finding.status === 'OPEN' || finding.status === 'CONFIRMED')
    const latestResolvedFinding = [...trackFindings].filter(finding => finding.status === 'RESOLVED' || finding.status === 'REJECTED').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    const pendingWindow = latestExperiment?.level === 'WINDOW_COMBINATION' && latestExperiment.status === 'RUNNING' ? latestExperiment : undefined
    const pendingSingle = latestExperiment?.level === 'SINGLE_VARIANT' && latestExperiment.status === 'RUNNING' ? latestExperiment : undefined
    const waitingExperiment = latestExperiment && ['DRAFT', 'QUEUED'].includes(latestExperiment.status) ? latestExperiment : undefined
    const pendingFindings = trackFindings.filter(finding => finding.status === 'OPEN' || finding.status === 'CONFIRMED')
    const pendingIssues = issues.filter(issue => ['PENDING', 'CONFIRMED', 'FIXING'].includes(issue.status))
    const pendingTime = Math.max(...[...pendingFindings, ...pendingIssues].map(item => Date.parse(item.updatedAt)).filter(Number.isFinite))
    const terminalTime = Math.max(
      latestGate && latestGate.conclusion !== 'MANUAL_REVIEW' ? Date.parse(latestGate.decidedAt) : Number.NEGATIVE_INFINITY,
      latestRelease && ['RELEASED', 'OBSERVING', 'ROLLED_BACK'].includes(latestRelease.status) ? Date.parse(latestRelease.updatedAt) : Number.NEGATIVE_INFINITY
    )
    const reopenedWork = Number.isFinite(terminalTime) && pendingTime > terminalTime && !pendingWindow && !pendingSingle && !waitingExperiment && latestExperiment?.status !== 'FAILED'
    if (reopenedWork) {
      track.stateLabel = pendingIssues.some(issue => Date.parse(issue.updatedAt) > terminalTime) ? '问题处理中' : '待归因确认'
      track.active = true
    } else if (latestRelease && latestRelease.status !== 'PENDING' && (!latestExperiment || Date.parse(latestRelease.updatedAt) >= Date.parse(latestExperiment.updatedAt))) {
      track.stateLabel = { CANARY: '灰度中', RELEASED: '已发布', OBSERVING: '观察中', ROLLED_BACK: '已回滚' }[latestRelease.status]
      track.active = latestRelease.status === 'CANARY'
    } else if (latestExperiment?.status === 'FAILED') {
      track.stateLabel = '实验失败，待复核'
      track.active = true
    } else if (pendingWindow) track.stateLabel = '窗口组合实验中'
    else if (pendingSingle) track.stateLabel = '单能力实验中'
    else if (waitingExperiment) track.stateLabel = '实验待运行'
    else if (latestGate) {
      track.stateLabel = latestGate.conclusion === 'PASS' ? '已准出' : latestGate.conclusion === 'REJECT' ? '拒绝' : '人工复核'
      track.active = latestGate.conclusion === 'MANUAL_REVIEW'
    } else if (latestExperiment && ['COMPLETED', 'DECIDED'].includes(latestExperiment.status)) track.stateLabel = '待准出决策'
    else if (track.variantIds.length) track.stateLabel = '待实验'
    else if (latestResolvedFinding && !hasOpenFinding) {
      track.stateLabel = latestResolvedFinding.status === 'RESOLVED' ? '已解决' : '归因已拒绝'
      track.active = false
    }
    else if (track.datasetIds.length) {
      const datasets = state.datasets.filter(item => track.datasetIds.includes(item.id))
      track.stateLabel = datasets.every(item => item.frozen) ? '数据集已冻结' : '数据集积累中'
    } else if (track.attributionIds.length || track.findingIds.length) track.stateLabel = '待归因确认'
    track.caseIds = unique(track.caseIds)
    track.traceIds.push(...state.traces.filter(item => track.caseIds.includes(item.caseId) && traceMatches(item.id, track.skillId, track.skillVersion)).map(item => item.id))
    for (const field of ['datasetIds', 'experimentIds', 'variantIds', 'caseIds', 'traceIds', 'findingIds', 'evidenceIds', 'attributionIds', 'issueIds', 'clusterIds', 'gateIds', 'releaseIds'] as const) track[field] = unique(track[field])
    for (const entity of [...issues, ...clusters, ...variants, ...experiments, ...releases]) touch(track, entity.updatedAt)
    for (const gate of gates) touch(track, gate.decidedAt)
  }
  return [...tracks.values()].filter(track => targetMatchesScope({ skillId: track.skillId, skillVersion: track.skillVersion, attributionId: track.attributionId, evolutionItemId: track.attributionId }, scope)
    && optimizationMatches(track.definition, scope.optimizationMode)
    && (!scope.query?.trim() || [track.title, track.stateLabel, ...track.datasetIds, ...track.experimentIds, ...track.caseIds.flatMap(id => { const record = state.cases.find(item => item.id === id); return record ? [record.query, record.title] : [] })].join(' ').toLocaleLowerCase().includes(scope.query.trim().toLocaleLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
}
