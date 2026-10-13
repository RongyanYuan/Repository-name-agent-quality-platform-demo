import type { EvolutionState, TraceGovernanceEvent } from '../domain'

/** Only documented demo transitions gain parents. Reports, evaluation values and action times remain untouched. */
export function enrichGovernanceGraphFixtures(state: EvolutionState): EvolutionState {
  const events = [...(state.governanceEvents ?? [])]
  const demo = (key: string) => events.find(item => item.id === `event-governance-demo-${key}`)
  const task = (caseKey: string) => events.find(item => item.caseId === `case-governance-demo-${caseKey}` && item.stage === 'TASK' && item.origin === 'MOCK')
  const evaluation = (caseKey: string) => events.find(item => item.caseId === `case-governance-demo-${caseKey}` && item.stage === 'EVALUATION' && item.id.endsWith('-evaluation') && item.origin === 'MOCK')
  const parents = new Map<string, string[]>()
  const link = (child: TraceGovernanceEvent | undefined, ...sources: Array<TraceGovernanceEvent | undefined>) => {
    if (!child || child.parentEventIds?.length) return
    const parentIds = sources.filter((item): item is TraceGovernanceEvent => Boolean(item && item.traceId === child.traceId)).map(item => item.id)
    if (parentIds.length) parents.set(child.id, parentIds)
  }
  for (const key of ['ppt', 'tool', 'parallel']) link(evaluation(key), task(key))
  const firstReview = events.find(item => item.id === 'review:review-governance-demo-ppt-1')
  const secondReview = events.find(item => item.id === 'review:review-governance-demo-ppt-2')
  link(firstReview, evaluation('ppt')); link(secondReview, firstReview)
  link(demo('ppt-attribution'), secondReview)
  const chain = ['ppt-attribution', 'ppt-routing', 'ppt-dataset', 'ppt-cluster', 'ppt-variant', 'ppt-single', 'ppt-reject', 'ppt-single-gate', 'ppt-window', 'ppt-window-gate', 'ppt-release', 'ppt-pending', 'ppt-rerun']
  for (let index = 1; index < chain.length; index++) link(demo(chain[index]), demo(chain[index - 1]))
  link(demo('tool-repair'), evaluation('tool'))
  link(demo('parallel-algorithm'), evaluation('parallel'))
  link(demo('parallel-agent'), evaluation('parallel'))

  const rollback = demo('ppt-rollback')
  const release = state.releases.find(item => item.id === rollback?.sourceRef?.id)
  const grayId = 'event-governance-demo-ppt-gray-release'
  if (rollback && release?.releasedAt && !events.some(item => item.id === grayId)) {
    events.push({ ...rollback, id: grayId, statusCode: 'RELEASED', occurredAt: release.releasedAt, recordedAt: release.releasedAt, actor: release.approvedBy, description: `${release.version} · 独立灰度分支明确的发布时间。`, targetRefs: [{ kind: 'release', id: release.id }, { kind: 'decision', id: release.gateDecisionId }], parentEventIds: demo('ppt-window-gate') ? [demo('ppt-window-gate')!.id] : undefined })
  }
  link(rollback, events.find(item => item.id === grayId))
  const next = events.map(item => parents.has(item.id) ? { ...item, parentEventIds: parents.get(item.id) } : item)
  return { ...state, governanceEvents: next }
}
