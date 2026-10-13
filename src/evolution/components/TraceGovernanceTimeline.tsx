import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { TraceGovernanceEvent } from '../domain'
import type { CaseAnalysisRecord } from '../cases/model'
import { buildGovernanceGraph, buildGovernanceOverview, selectLatestTraceState, type GovernanceGraphNode, type GovernanceGraphGroup } from '../data/governanceGraph'
import { formatGovernanceTime, governanceStageLabel, type TraceGovernanceHistory } from '../data/traceGovernance'
import { Button, cn } from '../../ui'
import { StatusIndicator, statusIndicatorColor } from './StatusIndicator'
import { DetailDrawer, IdLink, KeyValueGrid, type ReferenceTarget } from './ViewPrimitives'

interface Props {
  focusObjectIds?: string[]
  history: TraceGovernanceHistory
  onNavigateReference?: (target: ReferenceTarget) => void
  moduleScoreId?: string
  evaluationScenarios?: CaseAnalysisRecord['evaluationScenarios']
  tastePreference?: CaseAnalysisRecord['tastePreference']
}
const relationLabels = { TRACE_SOURCE: '由此 Trace 发起', CASE_SHARED: 'Case 共享关联', VALIDATION: '用于验证' }
const originLabels = { MOCK: 'Mock', LOCAL: '本地操作', LEGACY: '历史记录' }
const panel = 'min-w-0 rounded-lg border border-line bg-panel p-4'
const references = (item: TraceGovernanceEvent) => [...new Map([...(item.sourceRef ? [item.sourceRef] : []), ...item.targetRefs].map(target => [`${target.kind}:${target.id}`, target])).values()]
const shortTime = (value?: string) => formatGovernanceTime(value).replace('2026-', '').replace(' GMT+8', '')
const nodeName = (item: TraceGovernanceEvent) => `${governanceStageLabel(item.stage)} · ${formatGovernanceTime(item.occurredAt)} · ${item.description}`
const edgePath = (from: GovernanceGraphNode, to: GovernanceGraphNode) => {
  if (from.x === to.x) return `M ${from.x} ${from.y + from.height} L ${from.x} ${to.y}`
  const forward = to.x > from.x
  const x1 = from.x + (forward ? from.width / 2 : -from.width / 2), x2 = to.x + (forward ? -to.width / 2 : to.width / 2)
  const y1 = from.y + from.height / 2, y2 = to.y + to.height / 2, middle = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`
}

export function TraceGovernanceTimeline({ history, onNavigateReference, moduleScoreId, evaluationScenarios, tastePreference, focusObjectIds = [] }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const [timeWidth, setTimeWidth] = useState(500), [selectedId, setSelectedId] = useState<string>(), [focusedId, setFocusedId] = useState<string>()
  const [compact, setCompact] = useState(true), [groupId, setGroupId] = useState<string>()
  const marker = useId().replaceAll(':', '')
  const filtered = useMemo(() => ({ ...history, events: history.events.filter(item => !moduleScoreId || item.stage !== 'REVIEW' || history.reviewModuleIds?.[item.id] === moduleScoreId) }), [history, moduleScoreId])
  const graph = useMemo(() => buildGovernanceGraph(filtered, { timeWidth }), [filtered, timeWidth])
  const overview = useMemo(() => buildGovernanceOverview(graph), [graph])
  const visualNodes: Array<GovernanceGraphNode & { group?: GovernanceGraphGroup }> = compact ? overview.groups.map(group => ({ id: group.id, event: group.events.at(-1)!, laneId: group.laneId, x: group.x, y: group.y, width: group.width, height: group.height, current: group.current, group: group.events.length > 1 ? group : undefined })) : graph.nodes
  const visualEdges = compact ? overview.edges : graph.edges, visualLanes = compact ? overview.lanes : graph.lanes, visualHeight = compact ? overview.height : graph.height
  const selectedGroup = overview.groups.find(group => group.id === groupId)
  const selected = filtered.events.find(item => item.id === selectedId)
  const current = selectLatestTraceState(filtered)
  const traceId = history.events[0]?.traceId
  const matchingEvent=(event:TraceGovernanceEvent)=>references(event).some(ref=>focusObjectIds.includes(ref.id))
  useEffect(()=>{
    if(!focusObjectIds.length)return
    const matching=[...visualNodes].reverse().find(node=>node.group ? node.group.events.some(matchingEvent):matchingEvent(node.event))
    if(matching){setFocusedId(matching.id);const host=viewport.current;if(host){host.scrollLeft=Math.max(0,matching.x-host.clientWidth/2);host.scrollTop=Math.max(0,matching.y-host.clientHeight/2)}}
  },[focusObjectIds.join('|'),traceId])
  useEffect(() => { setSelectedId(undefined); setGroupId(undefined); setFocusedId(undefined) }, [traceId, moduleScoreId])
  useEffect(() => {
    if (!selectedId && !groupId) return
    const closeNode = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation(); event.stopPropagation(); setSelectedId(undefined); setGroupId(undefined)
    }
    document.addEventListener('keydown', closeNode, true)
    return () => document.removeEventListener('keydown', closeNode, true)
  }, [selectedId, groupId])
  const locate = (id?: string) => {
    const node = visualNodes.find(item => item.id === id || item.group?.events.some(event => event.id === id)), host = viewport.current
    if (!node || !host) return
    const left = Math.max(0, node.x - (host.clientWidth || 900) / 2), top = Math.max(0, node.y - (host.clientHeight || 480) / 2)
    if (typeof host.scrollTo === 'function') host.scrollTo({ left, top, behavior: 'smooth' })
    else { host.scrollLeft = left; host.scrollTop = top }
    setFocusedId(node.id)
    Array.from(host.querySelectorAll<HTMLButtonElement>('button[data-event-id]')).find(button => button.dataset.eventId === node.id)?.focus({ preventScroll: true })
  }
  const openReference = onNavigateReference ? (target: ReferenceTarget) => { setSelectedId(undefined); onNavigateReference(target) } : undefined
  const selectedRefs = selected ? references(selected) : []
  const memberIds = selectedRefs.filter(item => item.kind === 'dataset').map(item => item.id)
  const memberships = history.memberships.filter(member => memberIds.includes(member.datasetId))
  const findingIds = selectedRefs.filter(item => item.kind === 'finding').map(item => item.id)
  const scenarios = evaluationScenarios?.filter(item => item.findingId && findingIds.includes(item.findingId)) ?? []
  const tickCount = Math.max(2, Math.floor(graph.timeWidth / 140) + 1)
  const ticks = graph.startAt && graph.endAt ? Array.from({ length: tickCount }, (_, index) => ({ x: graph.xStart + index / (tickCount - 1) * graph.timeWidth, time: new Date(Date.parse(graph.startAt!) + index / (tickCount - 1) * (Date.parse(graph.endAt!) - Date.parse(graph.startAt!))).toISOString() })) : []
  return <div className="space-y-4">
    <section className={panel} aria-label="治理流转时间轴">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-ink">治理流转时间轴</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">横轴为实际发生时间，分行展示处理分支；外圈标记各分支最新已知节点。相近时间节点合并为记录组，点击查看每次流转。</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setCompact(value => !value)}>{compact ? '展开全部节点' : '返回分支纵览'}</Button><Button icon={ZoomOut} aria-label="缩小时间轴" disabled={timeWidth <= 320} onClick={() => setTimeWidth(value => Math.max(320, value / 1.5))}>缩小</Button><Button icon={ZoomIn} aria-label="放大时间轴" disabled={timeWidth >= 16_000} onClick={() => setTimeWidth(value => Math.min(16_000, value * 1.5))}>放大</Button><Button icon={Maximize2} onClick={() => { setCompact(true); setTimeWidth(Math.max(320, (viewport.current?.clientWidth || 900) - graph.xStart - 120)) }}>适配全程</Button><Button icon={Crosshair} aria-label="定位最新节点" disabled={!current.event?.occurredAt} onClick={() => locate(current.event?.id)}>定位最新节点</Button></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted"><span>时间：Asia/Shanghai（GMT+8）</span><span className="inline-flex items-center gap-2"><span className="w-5 border-t border-slate-400" />明确流转关系</span><span className="inline-flex items-center gap-2"><span className="w-5 border-t border-dashed border-slate-400" />Case 共享 / 用于验证</span><span>无连线：未记录可证实的前序关系</span></div>
      {moduleScoreId && <p className="mt-2 break-all text-xs text-accent">人工复核定位：{moduleScoreId}</p>}
      {focusObjectIds.length>0 && <p role="status" className="mt-2 text-xs text-accent">已定位所选归因与进化轮次；蓝色边框标记对应节点，其他分支历史保留。</p>}
      {graph.currentNodeIds.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]"><span className="text-muted">定位分支：</span>{graph.currentNodeIds.map(id => { const node = graph.nodes.find(item => item.id === id)!; const lane = graph.lanes.find(item => item.id === node.laneId)!; return <button key={id} type="button" aria-label={`定位 ${lane.label} · ${governanceStageLabel(node.event.stage)}`} title={`${lane.label} · ${nodeName(node.event)}`} onClick={() => locate(id)} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line px-2.5 py-1.5 text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"><span className="max-w-[180px] truncate">{lane.label}</span><StatusIndicator status={node.event.statusCode} /></button> })}</div>}
      <div ref={viewport} role="region" aria-label="治理时间分支图" tabIndex={0} className="mt-4 max-h-[560px] overflow-auto rounded-md border border-line bg-slate-50/50 outline-none focus-visible:ring-2 focus-visible:ring-accent" data-time-width={graph.timeWidth} data-layout-height={visualHeight} data-layout-mode={compact ? 'overview' : 'detail'}>
        {graph.nodes.length ? <div className="relative" style={{ width: graph.width, height: visualHeight }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={graph.width} height={visualHeight}>
            <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#94a3b8" /></marker></defs>
            {ticks.map(tick => <g key={tick.time}><line x1={tick.x} x2={tick.x} y1="54" y2={visualHeight} stroke="#e2e8f0" strokeDasharray="3 5" /><line x1={tick.x} x2={tick.x} y1="46" y2="54" stroke="#94a3b8" /></g>)}
            <line x1={graph.xStart} x2={graph.xStart + graph.timeWidth} y1="48" y2="48" stroke="#94a3b8" />
            {visualLanes.map(lane => <rect key={lane.id} x="0" y={lane.y - 8} width={graph.width} height={lane.height + 4} fill={lane.relationType === 'TRACE_SOURCE' ? '#ffffff' : '#f8fafc'} stroke="#e2e8f0" strokeDasharray={lane.relationType === 'TRACE_SOURCE' ? undefined : '6 5'} />)}
            {visualEdges.map(edge => <path key={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} data-provenance={edge.provenance} d={edgePath(visualNodes.find(node => node.id === edge.from)!, visualNodes.find(node => node.id === edge.to)!)} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray={edge.dashed ? '6 5' : undefined} markerEnd={`url(#${marker})`} />)}
          </svg>
          <div className="sticky top-0 z-20 h-14 border-b border-line bg-white/95">
            <p className="absolute left-4 top-3 text-[11px] font-semibold text-muted">发生时间 →</p>
            {ticks.map(tick => <time key={tick.time} data-time-tick dateTime={tick.time} title={formatGovernanceTime(tick.time)} className="absolute top-3 w-[112px] -translate-x-1/2 text-center font-mono text-[10px] leading-4 text-muted" style={{ left: tick.x }}>{shortTime(tick.time)}</time>)}
          </div>
          {visualLanes.map(lane => <div key={lane.id} className="pointer-events-none absolute left-0 z-10" style={{ top: lane.y + (compact ? 8 : 25), width: graph.width }}><div className="sticky left-3 w-[178px] rounded border border-line bg-white/95 px-3 py-2 text-xs shadow-sm"><p className="break-words font-semibold text-ink">{lane.label}</p><p className="mt-1 text-[10px] text-muted">{relationLabels[lane.relationType]}</p></div></div>)}
          {visualNodes.map(node => { const color = statusIndicatorColor(node.event.statusCode), group = node.group; const name = group ? `治理记录组 · ${group.events.length} 个节点 · ${group.events.map(item => nodeName(item)).join('；')}` : nodeName(node.event); return <button key={node.id} type="button" data-event-id={node.id} data-event-ids={JSON.stringify(group?.events.map(item => item.id) ?? [node.id])} data-time-x={node.x} data-current={String(node.current)} data-path-focused={String(focusObjectIds.length>0 && (node.group ? node.group.events.some(matchingEvent):matchingEvent(node.event)))} aria-label={name} title={name} onClick={() => group ? setGroupId(group.id) : setSelectedId(node.id)} className={cn('absolute flex flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', compact && 'gap-1 px-3 py-2', node.event.relationType !== 'TRACE_SOURCE' && 'border-dashed', color === 'red' ? 'border-fail/60' : color === 'yellow' ? 'border-warn/60' : 'border-line', node.current && 'ring-2 ring-slate-300 ring-offset-2', focusedId === node.id && 'ring-accent', focusObjectIds.length>0 && (node.group ? node.group.events.some(matchingEvent):matchingEvent(node.event)) && 'border-accent ring-1 ring-accent/30')} style={{ left: node.x - node.width / 2, top: node.y, width: node.width, height: node.height }}>
            <span className="text-xs font-semibold text-ink">{group ? `${group.events.length} 个治理节点` : governanceStageLabel(node.event.stage)}</span>{group ? <span className="flex items-center gap-2"><span className="truncate text-[10px] text-muted">{governanceStageLabel(node.event.stage)}</span><StatusIndicator status={node.event.statusCode} context="governance" /></span> : <StatusIndicator status={node.event.statusCode} context="governance" />}{group ? <span className="font-mono text-[9px] leading-3 text-muted">{shortTime(group.events[0].occurredAt).slice(0, 11)} ～ {shortTime(group.events.at(-1)!.occurredAt).slice(0, 11)}</span> : <time dateTime={node.event.occurredAt} className="font-mono text-[10px] text-muted">{shortTime(node.event.occurredAt)}</time>}{!compact && <span className="truncate text-[10px] text-muted">{node.current ? '当前停留 · ' : ''}{node.event.description}</span>}
          </button> })}
        </div> : <p className="p-5 text-xs text-muted">暂无已记录发生时间的治理事件。</p>}
      </div>
    </section>
    {graph.undatedEvents.length > 0 && <section aria-label="时间未记录的关联" className={panel}><h3 className="text-sm font-semibold text-ink">时间未记录的关联</h3><p className="mt-1 text-xs leading-5 text-muted">以下记录没有可证实的发生时间，单独展示，不推断流转顺序或等待时长。</p><div className="mt-3 flex flex-wrap gap-2">{graph.undatedEvents.map(item => <button key={item.id} type="button" data-event-id={item.id} aria-label={nodeName(item)} onClick={() => setSelectedId(item.id)} className="flex min-w-0 max-w-full flex-col gap-1 rounded-md border border-dashed border-line p-3 text-left hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"><span className="text-xs font-semibold text-ink">{governanceStageLabel(item.stage)}</span><span className="text-[11px] text-muted">{relationLabels[item.relationType]} · 时间未记录</span><StatusIndicator status={item.statusCode} /><span className="max-w-[320px] truncate text-[11px] text-muted">{item.description}</span></button>)}</div></section>}
    <DetailDrawer open={Boolean(selectedGroup)} onClose={() => setGroupId(undefined)} title={`同一时间段 · ${selectedGroup?.events.length ?? 0} 个治理节点`} description="记录组仅合并同一分支中显示位置接近的节点；时间、每次状态及明确的前序关系均完整保留。">
      {selectedGroup && <div className="space-y-4"><KeyValueGrid items={[{ label: '起始时间', value: formatGovernanceTime(selectedGroup.events[0].occurredAt) }, { label: '结束时间', value: formatGovernanceTime(selectedGroup.events.at(-1)!.occurredAt) }, { label: '分支', value: visualLanes.find(lane => lane.id === selectedGroup.laneId)?.label }, { label: '归属关系', value: relationLabels[selectedGroup.events[0].relationType] }]} /><div className="space-y-2">{selectedGroup.events.map(item => { const parents = selectedGroup.internalEdges.filter(edge => edge.to === item.id).map(edge => selectedGroup.events.find(event => event.id === edge.from)!).filter(Boolean); return <button key={item.id} type="button" data-event-id={item.id} aria-label={nodeName(item)} onClick={() => { setGroupId(undefined); setSelectedId(item.id) }} className="block w-full rounded-md border border-line p-3 text-left hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-ink">{governanceStageLabel(item.stage)}</span><StatusIndicator status={item.statusCode} current={graph.currentNodeIds.includes(item.id)} /></span><time dateTime={item.occurredAt} className="mt-2 block text-[11px] text-muted">{formatGovernanceTime(item.occurredAt)} · {item.actor}</time><span className="mt-2 block whitespace-pre-wrap break-words text-xs leading-5 text-ink">{item.description}</span>{parents.length > 0 && <span className="mt-2 block text-[10px] text-muted">明确前序：{parents.map(parent => `${governanceStageLabel(parent.stage)} · ${shortTime(parent.occurredAt)}`).join(' / ')}</span>}</button> })}</div></div>}
    </DetailDrawer>
    <DetailDrawer open={Boolean(selected)} onClose={() => setSelectedId(undefined)} title={`${selected ? governanceStageLabel(selected.stage) : '治理'} · 节点详情`} description={selected ? `${relationLabels[selected.relationType]} · ${originLabels[selected.origin]}` : undefined}>
      {selected && <div className="space-y-5">
        <StatusIndicator status={selected.statusCode} context="governance" current={graph.currentNodeIds.includes(selected.id)} />
        <KeyValueGrid items={[{ label: '发生时间', value: formatGovernanceTime(selected.occurredAt) }, { label: '操作人', value: selected.actor }, { label: '记录时间（不代表动作时间）', value: formatGovernanceTime(selected.recordedAt) }, { label: '事件 ID', value: <span className="break-all font-mono">{selected.id}</span> }]} />
        <section><h4 className="text-xs font-semibold text-ink">原因 / 判定依据</h4><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink">{selected.description}</p></section>
        {selected.relationType !== 'TRACE_SOURCE' && <p className="rounded-md border border-dashed border-line bg-slate-50 p-3 text-xs leading-5 text-muted">{selected.relationType === 'VALIDATION' ? '此 Trace 用于验证该实验，不表示它发起了变体，也不能据此判断原问题已解决。' : '此对象与 Case 共享关联，不代表由当前 Trace 的问题发起。'}</p>}
        {memberships.map(member => <section key={member.id} className="rounded-md border border-line p-3"><h4 className="text-xs font-semibold text-ink">{member.name}</h4><div className="mt-3"><KeyValueGrid items={[{ label: '数据集版本', value: member.datasetVersion }, { label: '数据集用途', value: member.purpose }, { label: '冻结状态', value: member.frozen ? '已冻结' : '未冻结' }, { label: '成员范围', value: member.scope === 'TRACE' ? 'Trace 专属成员' : 'Case 共享归属' }, { label: '加入时间', value: member.joinedAt ? formatGovernanceTime(member.joinedAt) : '加入时间未记录' }, { label: '加入操作人', value: member.actor }, { label: '来源', value: member.source }]} /></div><div className="mt-3 flex flex-wrap gap-3"><IdLink kind="dataset" id={member.datasetId} onOpen={openReference} />{member.traceIds.map(id => <IdLink key={id} kind="trace" id={id} onOpen={openReference} />)}</div>{member.experimentIds.length > 0 && <div className="mt-3"><p className="text-[11px] text-muted">关联实验</p><div className="mt-2 flex flex-wrap gap-3">{member.experimentIds.map(id => <IdLink key={id} kind="experiment" id={id} onOpen={openReference} />)}</div></div>}</section>)}
        {scenarios.map((scenario, index) => <section key={scenario.findingId ?? index} className="rounded-md border border-line p-3"><h4 className="text-xs font-semibold text-ink">{scenario.label} · {scenario.dimension}</h4><p className="mt-2 text-xs leading-5 text-muted">{scenario.path.replaceAll('Agent迭代', 'Agent 迭代')}</p></section>)}
        {scenarios.some(scenario => /品味|偏好/.test(`${scenario.label} ${scenario.dimension}`)) && tastePreference && <section className="rounded-md border border-accent/20 bg-accent/5 p-3 text-xs"><h4 className="font-semibold text-ink">品味 Skill 批量偏好聚合 · Mock</h4><p className="mt-2">{tastePreference.preferenceCount} 人 / {tastePreference.populationTotal} 人 · 偏好{tastePreference.preferenceValue} {Math.round(tastePreference.preferenceRate * 100)}%</p><p className="mt-1">相关数据 {tastePreference.relatedDataCount} / {tastePreference.relatedDataThreshold} 条 · {tastePreference.routingLabel.replaceAll('Agent迭代', 'Agent 迭代')}</p><p className="mt-2 leading-5 text-muted">{tastePreference.judgeReason}</p><p className="mt-1 leading-5 text-muted">{tastePreference.optimizationPath}</p></section>}
        <section><h4 className="text-xs font-semibold text-ink">关联对象 / Evidence</h4><div className="mt-3 flex flex-wrap gap-3">{selectedRefs.map(target => <IdLink key={`${target.kind}:${target.id}`} {...target} onOpen={openReference} />)}{!selectedRefs.length && <span className="text-xs text-muted">未记录关联对象。</span>}</div></section>
      </div>}
    </DetailDrawer>
  </div>
}
