import type { GovernanceReference, TraceGovernanceEvent } from '../domain'
import { governanceStageLabel, type TraceGovernanceHistory } from './traceGovernance'

export interface LatestTraceState { event?: TraceGovernanceEvent; status: string; label: string; timeKnown: boolean }
const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined
const chronological = (a: TraceGovernanceEvent, b: TraceGovernanceEvent) => timestamp(a.occurredAt)! - timestamp(b.occurredAt)! || a.id.localeCompare(b.id)

/** recordedAt is an ingestion time, never a substitute for an action time. */
export function selectLatestTraceState(history: TraceGovernanceHistory): LatestTraceState {
  const direct = history.events.filter(item => item.relationType === 'TRACE_SOURCE')
  const event = direct.filter(item => timestamp(item.occurredAt) !== undefined).sort(chronological).at(-1)
    ?? [...direct].sort((a, b) => a.id.localeCompare(b.id)).at(-1)
  return event ? { event, status: event.statusCode, label: governanceStageLabel(event.stage), timeKnown: timestamp(event.occurredAt) !== undefined }
    : { status: 'NOT_ENTERED', label: '尚未进入', timeKnown: false }
}

export interface GovernanceGraphNode { id: string; event: TraceGovernanceEvent; laneId: string; x: number; y: number; width: number; height: number; current: boolean }
export interface GovernanceGraphEdge { id: string; from: string; to: string; dashed: boolean; provenance: 'EXPLICIT_PARENT' | 'OBJECT_RELATION' }
export interface GovernanceGraphLane { id: string; label: string; relationType: TraceGovernanceEvent['relationType']; y: number; height: number }
export interface GovernanceGraph {
  nodes: GovernanceGraphNode[]; edges: GovernanceGraphEdge[]; lanes: GovernanceGraphLane[]; undatedEvents: TraceGovernanceEvent[]
  currentNodeIds: string[]; startAt?: string; endAt?: string; width: number; height: number; xStart: number; timeWidth: number
}
export interface GovernanceGraphOptions { timeWidth?: number; nodeWidth?: number; nodeHeight?: number }
export interface GovernanceGraphGroup {
  id: string; events: TraceGovernanceEvent[]; laneId: string; x: number; endX: number; y: number; width: number; height: number
  current: boolean; internalEdges: GovernanceGraphEdge[]
}
export interface GovernanceGraphOverview {
  groups: GovernanceGraphGroup[]; edges: GovernanceGraphEdge[]; lanes: GovernanceGraphLane[]; height: number
}
const key = (ref: GovernanceReference) => `${ref.kind}:${ref.id}`
const causalKinds = new Set(['dataset', 'finding', 'attribution', 'routing-decision', 'routing-delivery', 'issue', 'cluster', 'variant', 'experiment', 'decision', 'release'])
const laneKey = (event: TraceGovernanceEvent) => `${event.relationType}|${event.branchId ?? `trace:${event.traceId}`}`
const laneLabel = (history: TraceGovernanceHistory, event: TraceGovernanceEvent) => {
  if (event.relationType === 'CASE_SHARED') return 'Case 共享关联'
  if (event.relationType === 'VALIDATION') return '用于验证'
  return history.branches.find(branch => branch.id === (event.branchId ?? `trace:${event.traceId}`))?.label ?? '处理分支'
}

/** Time determines x. Explicit parents or unique typed object references determine edges. */
export function buildGovernanceGraph(history: TraceGovernanceHistory, options: GovernanceGraphOptions = {}): GovernanceGraph {
  const dated = history.events.filter(item => timestamp(item.occurredAt) !== undefined).sort(chronological)
  const undatedEvents = history.events.filter(item => timestamp(item.occurredAt) === undefined)
  const nodeWidth = options.nodeWidth ?? 178, nodeHeight = options.nodeHeight ?? 108
  const timeWidth = Math.max(300, options.timeWidth ?? 1100), xStart = 206 + nodeWidth / 2
  if (!dated.length) return { nodes: [], edges: [], lanes: [], undatedEvents, currentNodeIds: [], width: xStart + timeWidth + nodeWidth / 2 + 24, height: 120, xStart, timeWidth }
  const start = timestamp(dated[0].occurredAt)!, observedEnd = timestamp(dated.at(-1)!.occurredAt)!
  const end = observedEnd === start ? start + 60_000 : observedEnd
  const currentByBranch = new Map<string, TraceGovernanceEvent>()
  for (const item of dated.filter(item => item.relationType === 'TRACE_SOURCE')) currentByBranch.set(laneKey(item), item)
  const currentNodeIds = [...currentByBranch.values()].map(item => item.id)
  const groups = new Map<string, TraceGovernanceEvent[]>()
  for (const item of dated) groups.set(laneKey(item), [...(groups.get(laneKey(item)) ?? []), item])
  const entries = [...groups.entries()].sort((a, b) => {
    const rank = (event: TraceGovernanceEvent) => event.relationType === 'TRACE_SOURCE' ? event.branchId?.startsWith('trace:') ? 0 : 1 : event.relationType === 'CASE_SHARED' ? 2 : 3
    return rank(a[1][0]) - rank(b[1][0]) || timestamp(a[1][0].occurredAt)! - timestamp(b[1][0].occurredAt)! || a[0].localeCompare(b[0])
  })
  const nodes: GovernanceGraphNode[] = [], lanes: GovernanceGraphLane[] = []
  let y = 88
  for (const [id, events] of entries) {
    const trackEnds: number[] = []
    for (const item of events) {
      const x = xStart + (timestamp(item.occurredAt)! - start) / (end - start) * timeWidth
      let track = trackEnds.findIndex(right => right + 16 <= x - nodeWidth / 2)
      if (track === -1) { track = trackEnds.length; trackEnds.push(0) }
      trackEnds[track] = x + nodeWidth / 2
      nodes.push({ id: item.id, event: item, laneId: id, x, y: y + track * (nodeHeight + 20), width: nodeWidth, height: nodeHeight, current: currentNodeIds.includes(item.id) })
    }
    const height = trackEnds.length * (nodeHeight + 20) + 18
    lanes.push({ id, label: laneLabel(history, events[0]), relationType: events[0].relationType, y, height })
    y += height + 18
  }
  const byId = new Map(nodes.map(node => [node.id, node]))
  const sourceEvents = new Map<string, TraceGovernanceEvent[]>()
  for (const item of dated) if (item.sourceRef && causalKinds.has(item.sourceRef.kind)) sourceEvents.set(key(item.sourceRef), [...(sourceEvents.get(key(item.sourceRef)) ?? []), item])
  const edges: GovernanceGraphEdge[] = [], edgeKeys = new Set<string>()
  const pathExists = (from: string, to: string, seen = new Set<string>()): boolean => {
    if (from === to) return true
    if (seen.has(from)) return false
    seen.add(from)
    return edges.filter(edge => edge.from === from).some(edge => pathExists(edge.to, to, seen))
  }
  const connect = (parent: TraceGovernanceEvent, child: TraceGovernanceEvent, provenance: GovernanceGraphEdge['provenance']) => {
    const id = `${parent.id}->${child.id}`
    if (parent.id === child.id || parent.traceId !== child.traceId || edgeKeys.has(id) || !byId.has(parent.id) || !byId.has(child.id) || pathExists(child.id, parent.id)) return
    edgeKeys.add(id)
    edges.push({ id, from: parent.id, to: child.id, dashed: parent.relationType !== 'TRACE_SOURCE' || child.relationType !== 'TRACE_SOURCE', provenance })
  }
  for (const child of dated) {
    for (const parentId of child.parentEventIds ?? []) {
      const parent = byId.get(parentId)?.event
      if (parent) connect(parent, child, 'EXPLICIT_PARENT')
    }
    for (const ref of child.targetRefs) {
      if (!causalKinds.has(ref.kind) || child.sourceRef && key(child.sourceRef) === key(ref)) continue
      const candidates = sourceEvents.get(key(ref)) ?? []
      // Multiple revisions of a referenced object need an explicit parent revision.
      const reciprocal = child.sourceRef && candidates.length === 1 && candidates[0].targetRefs.some(target => key(target) === key(child.sourceRef!))
      if (candidates.length === 1 && !reciprocal && timestamp(candidates[0].occurredAt)! <= timestamp(child.occurredAt)!) connect(candidates[0], child, 'OBJECT_RELATION')
    }
  }
  return { nodes, edges, lanes, undatedEvents, currentNodeIds, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), width: xStart + timeWidth + nodeWidth / 2 + 24, height: y + 16, xStart, timeWidth }
}

/** Compact view aggregates only nodes whose real-time footprints overlap within the same lane. */
export function buildGovernanceOverview(graph: GovernanceGraph): GovernanceGraphOverview {
  const groups: GovernanceGraphGroup[] = [], lanes: GovernanceGraphLane[] = []
  const groupForEvent = new Map<string, string>()
  let y = 76
  for (const lane of graph.lanes) {
    const nodes = graph.nodes.filter(node => node.laneId === lane.id).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
    let current: GovernanceGraphGroup | undefined
    for (const node of nodes) {
      if (!current || node.x - current.x >= node.width + 18) {
        current = { id: node.id, events: [], laneId: lane.id, x: node.x, endX: node.x, y, width: node.width, height: 76, current: false, internalEdges: [] }
        groups.push(current)
      }
      current.events.push(node.event); current.endX = node.x; current.current ||= node.current
      groupForEvent.set(node.id, current.id)
    }
    lanes.push({ ...lane, y, height: 86 })
    y += 100
  }
  const edges: GovernanceGraphEdge[] = [], seen = new Set<string>()
  for (const edge of graph.edges) {
    const from = groupForEvent.get(edge.from), to = groupForEvent.get(edge.to)
    if (!from || !to) continue
    if (from === to) { groups.find(group => group.id === from)!.internalEdges.push(edge); continue }
    const id = `${from}->${to}:${edge.dashed ? 'shared' : 'source'}`
    if (seen.has(id)) continue
    seen.add(id); edges.push({ ...edge, id, from, to })
  }
  return { groups, edges, lanes, height: y + 12 }
}
