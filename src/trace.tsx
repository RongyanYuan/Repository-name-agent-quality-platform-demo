import { ArrowDown, ArrowRight, Check, CircleDot, Clock3, ExternalLink, GitCompareArrows, Minus, Server, Wrench, X } from 'lucide-react'
import { useMemo, type HTMLAttributes, type ReactNode } from 'react'
import type { Evidence, JudgeStatus, Observation, RubricEvidence, Trace as TraceModel } from './domain'
import { formatDuration } from './selectors'
import { cn, EmptyState, InlineNotice, SectionHeader, StatusBadge } from './ui'

/**
 * Normalize observations from both v1 and v2 fixtures.  `status` is retained
 * for compatibility, while v2 judgeStatus/judgeResult carries explicit
 * UNKNOWN, N/A and propagated failure states.
 */
export const getObservationStatus = (observation: Observation): JudgeStatus => observation.judgeStatus ?? observation.judgeResult?.judgeStatus ?? observation.judgeResult?.status ?? (observation.derived ? 'DERIVED_FAIL' : observation.status)

const statusTone = (status: JudgeStatus) => {
  if (status === 'PASS') return 'pass' as const
  if (status === 'FAIL') return 'fail' as const
  if (status === 'DERIVED_FAIL') return 'derived' as const
  if (status === 'UNKNOWN') return 'warn' as const
  return 'neutral' as const
}

const statusIcon = (status: JudgeStatus) => status === 'PASS' ? Check : status === 'FAIL' ? X : status === 'DERIVED_FAIL' ? ArrowDown : status === 'UNKNOWN' ? CircleDot : Minus

const nodeLabel = (observation: Observation) => observation.nodeType

const isRootObservation = (observation: Observation) => observation.isRootCause === true || observation.judgeResult?.isRootCause === true

/** Find the local first failure; derived/unknown/final outcome text is never used as a proxy. */
const firstFailure = (observations: Observation[]) => {
  const explicitRoot = observations.find((observation) => isRootObservation(observation) && getObservationStatus(observation) === 'FAIL')
  if (explicitRoot) return explicitRoot
  return observations.find((observation) => getObservationStatus(observation) === 'FAIL' && !observation.derived && !isRootObservation(observation))
    ?? observations.find((observation) => getObservationStatus(observation) === 'FAIL' && !observation.derived)
}

const rubricEvidenceFor = (observation: Observation): RubricEvidence[] => observation.rubricEvidence ?? observation.judgeResult?.rubricEvidence ?? []

const derivedFromLabel = (observation: Observation, observations: readonly Observation[]) => {
  if (!observation.derivedFrom) return undefined
  const source = observations.find((candidate) => candidate.id === observation.derivedFrom)
  return source ? `${source.nodeType} (${observation.derivedFrom})` : observation.derivedFrom
}

export interface TraceTimelineProps extends HTMLAttributes<HTMLDivElement> {
  trace?: TraceModel
  observations?: readonly Observation[]
  evidence?: readonly Evidence[]
  selectedObservationId?: string
  onObservationClick?: (observation: Observation) => void
  onEvidenceClick?: (evidence: Evidence, observation?: Observation) => void
  compact?: boolean
  showSummary?: boolean
  empty?: ReactNode
}

export function TraceTimeline({ trace, observations: providedObservations, evidence = [], selectedObservationId, onObservationClick, onEvidenceClick, compact = false, showSummary = true, empty = <EmptyState title="No trace recorded" description="This task does not have an observable execution trace." />, className, ...props }: TraceTimelineProps) {
  const observations = useMemo(() => [...(providedObservations ?? trace?.observations ?? [])].sort((a, b) => a.sequence - b.sequence), [providedObservations, trace?.observations])
  const rootFailure = firstFailure(observations)
  if (!observations.length) return <div {...props} className={cn('rounded-lg border border-line bg-panel', className)}>{empty}</div>
  return <div {...props} className={cn('min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel', className)} data-testid="trace-timeline">
    {showSummary && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">Trace timeline</p><p className="mt-1 text-[11px] text-muted">{observations.length} observations{trace?.totalLatency !== undefined && <span> · {formatDuration(trace.totalLatency)} total</span>}</p></div>{rootFailure ? <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={getObservationStatus(rootFailure)} tone={statusTone(getObservationStatus(rootFailure))} /><StatusBadge status="First Failure" tone="fail" showIcon={false} /><span className="text-[11px] text-muted">{rootFailure.nodeType}</span></div> : <StatusBadge status="PASS" />}</div>}
    <ol className={cn('relative', compact ? 'space-y-2' : 'space-y-3')} aria-label="Trace observations">
      {observations.map((observation, index) => {
        const status = getObservationStatus(observation)
        const isRoot = rootFailure?.id === observation.id || isRootObservation(observation)
        const derivedFrom = derivedFromLabel(observation, observations)
        const evidenceItems = evidence.filter((item) => observation.evidenceIds.includes(item.id))
        const localEvidence = rubricEvidenceFor(observation)
        const Icon = statusIcon(status)
        return <li key={observation.id} className="relative flex gap-3" data-observation-id={observation.id} data-judge-status={status} data-root-cause={String(isRoot)} data-derived-from={observation.derivedFrom ?? undefined}>
          {index < observations.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%+0.75rem)] w-px bg-slate-200" />}
          <span aria-hidden="true" className={cn('relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-panel', status === 'PASS' ? 'border-pass/50 text-pass' : status === 'FAIL' ? 'border-fail/60 text-fail' : status === 'DERIVED_FAIL' ? 'border-derived/50 text-derived' : status === 'UNKNOWN' ? 'border-warn/50 text-warn' : 'border-slate-300 text-slate-400')}><Icon className="h-3.5 w-3.5" /></span>
          <div role={onObservationClick ? 'button' : undefined} tabIndex={onObservationClick ? 0 : undefined} onClick={() => onObservationClick?.(observation)} onKeyDown={(event) => { if (onObservationClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onObservationClick(observation) } }} aria-current={selectedObservationId === observation.id ? 'true' : undefined} className={cn('min-w-0 flex-1 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', selectedObservationId === observation.id ? 'border-accent bg-accent/5' : 'border-slate-100 bg-slate-50/60', onObservationClick && 'cursor-pointer hover:border-accent/40 hover:bg-white', !onObservationClick && 'cursor-default')}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2"><div className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="text-xs font-semibold text-ink">{nodeLabel(observation)}</span><StatusBadge status={status} tone={statusTone(status)} /><span className="text-[11px] text-muted">#{observation.sequence}</span>{isRoot && <StatusBadge status="is_root_cause" tone="fail" showIcon={false} />}{isRoot && <StatusBadge status="First Failure" tone="fail" showIcon={false} />}{status === 'DERIVED_FAIL' && <StatusBadge status="Derived Failure" tone="derived" showIcon={false} />}</div><span className="inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted"><Clock3 aria-hidden="true" className="h-3 w-3" />{formatDuration(observation.latency)}</span></div>
            {!compact && <div className="mt-2 grid gap-2 text-[11px] leading-4 text-muted md:grid-cols-2"><p className="line-clamp-2"><span className="font-medium text-slate-500">Input:</span> {observation.input || 'Not recorded'}</p><p className="line-clamp-2"><span className="font-medium text-slate-500">Output:</span> {observation.output || 'Not recorded'}</p></div>}
            {(observation.reason || observation.score !== undefined || derivedFrom) && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">{observation.score !== undefined && <span className="font-mono">score {(observation.score * 100).toFixed(0)}%</span>}{observation.reason && <span className="line-clamp-2 min-w-0">{observation.reason}</span>}{derivedFrom && <span className="font-mono text-derived">derived_from: {derivedFrom}</span>}</div>}
            {localEvidence.length > 0 && !compact && <div className="mt-2 rounded border border-accent/15 bg-accent/5 px-2.5 py-1.5 text-[10px] leading-4 text-accent"><span className="font-semibold">Local Evidence:</span> <span className="text-slate-600">{nodeLabel(observation)} local evidence {status === 'DERIVED_FAIL' ? 'requires review' : localEvidence[0].summary}</span>{localEvidence.length > 1 && <span className="ml-1 text-accent">+{localEvidence.length - 1}</span>}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1">{observation.tool ? <Wrench aria-hidden="true" className="h-3 w-3" /> : <Server aria-hidden="true" className="h-3 w-3" />}{observation.tool ?? observation.model ?? 'No model/tool recorded'}</span>{observation.tokenUsage !== undefined && <span>{observation.tokenUsage.toLocaleString()} tokens</span>}{observation.error && <span className="font-medium text-fail">{observation.error}</span>}{evidenceItems.length > 0 && <span className="inline-flex items-center gap-1 text-accent"><ExternalLink aria-hidden="true" className="h-3 w-3" />{evidenceItems.length} evidence</span>}</div>
          </div>
          {onEvidenceClick && evidenceItems.length > 0 && <div className="absolute bottom-2 right-3 hidden gap-1 md:flex">{evidenceItems.slice(0, 2).map((item) => <button key={item.id} type="button" onClick={(event) => { event.stopPropagation(); onEvidenceClick(item, observation) }} className="rounded px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" title={`Open ${item.id}`}>Evidence</button>)}</div>}
        </li>
      })}
    </ol>
  </div>
}

const ValueRow = ({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) => <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 last:border-0"><dt className="text-[11px] font-medium text-muted">{label}</dt><dd className={cn('min-w-0 break-words text-xs text-ink', mono && 'font-mono text-[11px]')}>{value ?? <span className="text-slate-400">Not recorded</span>}</dd></div>

export interface ObservationDetailsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  observation?: Observation | null
  evidence?: readonly Evidence[]
  onEvidenceClick?: (evidence: Evidence) => void
  onClose?: () => void
  title?: ReactNode
  embedded?: boolean
}

export function ObservationDetails({ observation, evidence = [], onEvidenceClick, onClose, title = 'Observation details', embedded = false, className, ...props }: ObservationDetailsProps) {
  if (!observation) return <div {...props} className={cn(embedded ? '' : 'rounded-lg border border-line bg-panel', className)}><EmptyState title="Observation unavailable" description="Select a trace node to inspect its evidence." /></div>
  const status = getObservationStatus(observation)
  const derivedFrom = observation.derivedFrom
  const localEvidence = rubricEvidenceFor(observation)
  const isRoot = isRootObservation(observation)
  const linkedEvidence = evidence.filter((item) => observation.evidenceIds.includes(item.id))
  const missingEvidence = observation.evidenceIds.filter((id) => !evidence.some((item) => item.id === id))
  return <section {...props} className={cn(embedded ? '' : 'rounded-lg border border-line bg-panel shadow-panel', className)} data-testid="observation-details" data-judge-status={status}><header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-ink">{title}</h3><StatusBadge status={status} tone={statusTone(status)} /><span className="font-mono text-[10px] text-muted">{observation.id}</span></div><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span>{observation.nodeType} · sequence {observation.sequence} · {formatDuration(observation.latency)}</span>{isRoot && <span className="font-mono text-fail">is_root_cause: true</span>}{derivedFrom && <span className="font-mono text-derived">derived_from: {derivedFrom}</span>}</div></div>{onClose && <button type="button" onClick={onClose} aria-label="Close observation details" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-4 w-4" /></button>}</header><div className="space-y-4 p-4"><dl className="rounded-md border border-slate-100 bg-slate-50/60 px-3"><ValueRow label="Input" value={observation.input} /><ValueRow label="Output" value={observation.output} /><ValueRow label="Error" value={observation.error ? <span className="text-fail">{observation.error}</span> : undefined} /><ValueRow label="Model" value={observation.model} /><ValueRow label="Token usage" value={observation.tokenUsage?.toLocaleString()} /><ValueRow label="Tool result" value={observation.tool} /><ValueRow label="Eval result" value={<StatusBadge status={status} tone={statusTone(status)} />} /><ValueRow label="Score" value={observation.score !== undefined ? `${(observation.score * 100).toFixed(0)}%` : undefined} /><ValueRow label="Reason" value={observation.reason} /></dl><div><h4 className="mb-2 text-xs font-semibold text-ink">Metadata</h4>{Object.keys(observation.metadata).length ? <dl className="rounded-md border border-line px-3">{Object.entries(observation.metadata).map(([key, value]) => <ValueRow key={key} label={key} value={value} mono />)}</dl> : <p className="text-xs text-slate-400">Not recorded</p>}</div><div><h4 className="mb-2 text-xs font-semibold text-ink">Rubric Evidence (local)</h4>{localEvidence.length ? <div className="space-y-2">{localEvidence.map((item) => <div key={item.id} className="rounded-md border border-accent/20 bg-accent/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] text-accent">{item.id}</span>{item.kind && <span className="text-[10px] text-muted">{item.kind}</span>}</div><p className="mt-1 text-xs leading-4 text-ink">{item.summary}</p>{item.quote && <p className="mt-1 text-[11px] italic text-muted">“{item.quote}”</p>}<p className="mt-1 text-[10px] text-muted">{item.evidenceId ? `Evidence: ${item.evidenceId}` : 'Observation-local evidence'}</p></div>)}</div> : <InlineNotice tone="warn" title="Local evidence unavailable">No rubric evidence is linked to this local judge.</InlineNotice>}</div><div><h4 className="mb-2 text-xs font-semibold text-ink">Evidence</h4>{linkedEvidence.length ? <div className="space-y-2">{linkedEvidence.map((item) => <button key={item.id} type="button" onClick={() => onEvidenceClick?.(item)} disabled={!onEvidenceClick} className={cn('block w-full rounded-md border border-line p-3 text-left transition', onEvidenceClick ? 'hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent' : 'cursor-default')}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-accent">{item.id}</span><span className="text-[10px] text-muted">{item.type}</span></div><p className="mt-1 text-xs text-ink">{item.summary}</p><p className="mt-1 text-[10px] text-muted">Source: {item.source}</p></button>)}</div> : <InlineNotice tone="warn" title="Evidence unavailable">No readable evidence is linked to this observation.</InlineNotice>}{missingEvidence.length > 0 && <p className="mt-2 text-[11px] text-warn">Missing evidence IDs: {missingEvidence.join(', ')}</p>}</div></div></section>
}

type TraceSide = 'A' | 'B'
export interface ABTraceComparisonProps extends HTMLAttributes<HTMLDivElement> {
  traceA?: TraceModel
  traceB?: TraceModel
  labelA?: ReactNode
  labelB?: ReactNode
  versionA?: string
  versionB?: string
  evidence?: readonly Evidence[]
  onObservationClick?: (observation: Observation, side: TraceSide) => void
  highlightNodeType?: Observation['nodeType']
  empty?: ReactNode
}

interface AlignedObservation { key: string; nodeType: Observation['nodeType']; occurrence: number; a?: Observation; b?: Observation }

const alignObservations = (traceA?: TraceModel, traceB?: TraceModel): AlignedObservation[] => {
  const rows = new Map<string, AlignedObservation>()
  const add = (observation: Observation, side: TraceSide) => {
    const prior = [...rows.values()].filter((row) => row.nodeType === observation.nodeType)
    const occurrence = prior.length + 1
    const key = `${observation.nodeType}-${occurrence}`
    const row = rows.get(key) ?? { key, nodeType: observation.nodeType, occurrence }
    row[side.toLowerCase() as 'a' | 'b'] = observation
    rows.set(key, row)
  }
  ;[...(traceA?.observations ?? [])].sort((a, b) => a.sequence - b.sequence).forEach((observation) => add(observation, 'A'))
  ;[...(traceB?.observations ?? [])].sort((a, b) => a.sequence - b.sequence).forEach((observation) => {
    const candidates = [...rows.values()].filter((row) => row.nodeType === observation.nodeType && !row.b)
    if (candidates.length) candidates[0].b = observation
    else add(observation, 'B')
  })
  return [...rows.values()].sort((a, b) => {
    const sequenceA = a.a?.sequence ?? Number.MAX_SAFE_INTEGER
    const sequenceB = b.b?.sequence ?? Number.MAX_SAFE_INTEGER
    return Math.min(sequenceA, sequenceB) - Math.min(sequenceA, sequenceB)
  })
}

function ComparisonObservation({ observation, side, evidence, onClick }: { observation?: Observation; side: TraceSide; evidence: readonly Evidence[]; onClick?: (observation: Observation, side: TraceSide) => void }) {
  if (!observation) return <div className="flex min-h-[70px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 text-[11px] text-slate-400"><Minus aria-hidden="true" className="mr-1 h-3 w-3" />Stage {side === 'A' ? 'removed' : 'added'}</div>
  const status = getObservationStatus(observation)
  const localEvidence = rubricEvidenceFor(observation)
  const linked = evidence.filter((item) => observation.evidenceIds.includes(item.id))
  return <button type="button" disabled={!onClick} onClick={() => onClick?.(observation, side)} data-judge-status={status} className={cn('w-full rounded-md border p-3 text-left transition', status === 'FAIL' ? 'border-fail/25 bg-fail/5' : status === 'DERIVED_FAIL' ? 'border-derived/25 bg-derived/5' : 'border-slate-100 bg-slate-50/60', onClick && 'hover:border-accent/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', !onClick && 'cursor-default')}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={status} tone={statusTone(status)} />{observation.isRootCause && <span className="font-mono text-[10px] text-fail">is_root_cause</span>}</div><span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted"><Clock3 aria-hidden="true" className="h-3 w-3" />{formatDuration(observation.latency)}</span></div><p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">{observation.output || 'Not recorded'}</p>{(observation.derivedFrom || localEvidence.length > 0) && <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted">{observation.derivedFrom && <span className="font-mono text-derived">derived_from: {observation.derivedFrom}</span>}{localEvidence.length > 0 && <span className="text-accent">local evidence: {localEvidence.length}</span>}</div>}<div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-400"><span>{observation.tool ?? observation.model ?? 'No model/tool'}</span>{observation.tokenUsage !== undefined && <span>{observation.tokenUsage.toLocaleString()} tokens</span>}{linked.length > 0 && <span className="text-accent">{linked.length} evidence</span>}</div></button>
}

export function ABTraceComparison({ traceA, traceB, labelA, labelB, versionA = 'Version A', versionB = 'Version B', evidence = [], onObservationClick, highlightNodeType, empty = <EmptyState title="Trace comparison unavailable" description="Both traces are required for an A/B comparison." />, className, ...props }: ABTraceComparisonProps) {
  const rows = useMemo(() => alignObservations(traceA, traceB), [traceA, traceB])
  if (!traceA && !traceB) return <div {...props} className={cn('rounded-lg border border-line bg-panel', className)}>{empty}</div>
  return <section {...props} className={cn('min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel', className)} data-testid="ab-trace-comparison"><SectionHeader title={<span className="inline-flex items-center gap-2"><GitCompareArrows aria-hidden="true" className="h-4 w-4 text-accent" />A/B Trace comparison</span>} description="Aligned stages make status, latency and call changes explicit." meta={<span>{rows.length} aligned stages</span>} /><div className="mt-4 grid grid-cols-[minmax(110px,0.55fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><div>Stage</div><div className="text-accent">{labelA ?? versionA}</div><div className="text-accent">{labelB ?? versionB}</div></div><div className="divide-y divide-slate-100">{rows.map((row) => { const changedStatus = row.a && row.b && getObservationStatus(row.a) !== getObservationStatus(row.b); const latencyDelta = row.a && row.b ? row.b.latency - row.a.latency : undefined; const changedCall = row.a && row.b && (row.a.model ?? row.a.tool) !== (row.b.model ?? row.b.tool); const highlighted = highlightNodeType === row.nodeType; return <div key={row.key} className={cn('grid grid-cols-[minmax(110px,0.55fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 py-3', highlighted && 'bg-warn/5')}><div className="min-w-0 pt-2"><p className="truncate text-xs font-semibold text-ink">{row.nodeType}</p><p className="mt-1 text-[10px] text-muted">#{row.occurrence}</p>{changedStatus && <StatusBadge status="Status changed" tone="warn" showIcon={false} />}{latencyDelta !== undefined && <p className={cn('mt-1 inline-flex items-center gap-0.5 text-[10px]', latencyDelta > 0 ? 'text-warn' : 'text-pass')}>{latencyDelta > 0 ? <ArrowRight aria-hidden="true" className="h-3 w-3" /> : <ArrowRight aria-hidden="true" className="h-3 w-3 rotate-180" />}{latencyDelta > 0 ? '+' : ''}{formatDuration(latencyDelta)}</p>}{changedCall && <p className="mt-1 text-[10px] text-warn">Model/tool changed</p>}</div><ComparisonObservation observation={row.a} side="A" evidence={evidence} onClick={onObservationClick} /><ComparisonObservation observation={row.b} side="B" evidence={evidence} onClick={onObservationClick} /></div>})}</div></section>
}

export const ObservationDetailsPanel = ObservationDetails
export const TraceView = TraceTimeline
export const ABTrace = ABTraceComparison
