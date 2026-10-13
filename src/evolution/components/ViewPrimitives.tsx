import { ArrowRight, Copy, ExternalLink, FlaskConical, Info, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Drawer, SectionHeader, StatusBadge, cn } from '../../ui'

export type ReferenceKind =
  | 'case' | 'session' | 'trace' | 'observation' | 'log' | 'evidence' | 'artifact' | 'process-eval' | 'outcome-eval'
  | 'attribution' | 'issue' | 'cluster' | 'skill' | 'asset' | 'variant' | 'dataset' | 'rule'
  | 'experiment' | 'experiment-run' | 'window' | 'decision' | 'release'
  | 'evaluation-batch' | 'evaluation-job' | 'trace-package' | 'finding' | 'routing-policy' | 'routing-decision' | 'routing-delivery' | 'badcase' | 'badcase-queue'

export interface ReferenceTarget { kind: ReferenceKind; id: string; caseView?: string; evaluationId?: string; artifactId?: string }
export const REFERENCE_KINDS: readonly ReferenceKind[] = [
  'case', 'session', 'trace', 'observation', 'log', 'evidence', 'artifact', 'process-eval', 'outcome-eval',
  'attribution', 'issue', 'cluster', 'skill', 'asset', 'variant', 'dataset', 'rule',
  'experiment', 'experiment-run', 'window', 'decision', 'release',
  'evaluation-batch', 'evaluation-job', 'trace-package', 'finding', 'routing-policy', 'routing-decision', 'routing-delivery', 'badcase', 'badcase-queue'
]

export const panelClass = 'min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel'

export function MockBoundary({ className }: { className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border border-warn/25 bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn', className)}>
      <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />Mock 演示数据
    </div>
  )
}

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-4xl text-xs leading-5 text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><MockBoundary />{actions}</div>
    </div>
  )
}

export function IdLink({ id, kind, onOpen, label }: { id: string; kind: ReferenceKind; onOpen?: (target: ReferenceTarget) => void; label?: ReactNode }) {
  const [copyMessage, setCopyMessage] = useState('')
  const copyable = kind === 'trace' || kind === 'session'
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setCopyMessage('已复制') }
    catch { setCopyMessage('复制失败，请选中文本复制') }
  }
  return (
    <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 align-middle" title={`${kind}: ${id}`}>
    {onOpen ? <button type="button" title={`${kind}: ${id}`} onClick={(event) => { event.stopPropagation(); onOpen({ kind, id }) }} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded font-mono text-[11px] font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <span className="truncate">{label ?? id}</span><ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
    </button> : <span role="note" aria-label={`${kind} ${id} 不可导航`} className="select-text break-all font-mono text-[11px] text-muted">{label ?? id} · 不可导航</span>}
    {copyable && <button type="button" aria-label={`复制 ${kind === 'trace' ? 'Trace' : 'Session'} ID`} onClick={event => { event.stopPropagation(); void copy() }} className="shrink-0 rounded p-1 text-muted hover:bg-slate-100"><Copy aria-hidden="true" className="h-3 w-3" /></button>}
    {copyMessage && <span role="status" className="select-text break-all text-[10px] text-muted">{copyMessage}{copyMessage.startsWith('复制失败') && ` · ${kind}: ${id}`}</span>}
    </span>
  )
}

export function EntityId({ id, kind, onOpen, label }: { id: string; kind: ReferenceKind; onOpen?: (target: ReferenceTarget) => void; label?: ReactNode }) {
  return <IdLink id={id} kind={kind} onOpen={onOpen} label={label} />
}

export function KeyValueGrid({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2', className)}>
      {items.map((item, index) => <div key={index} className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{item.label}</dt><dd className="mt-1 min-w-0 break-words text-ink">{item.value ?? '—'}</dd></div>)}
    </dl>
  )
}

export function TagList({ values, empty = '暂无标签' }: { values?: string[]; empty?: string }) {
  if (!values?.length) return <span className="text-[11px] text-muted">{empty}</span>
  return <div className="flex flex-wrap gap-1.5">{values.map((value) => <StatusBadge key={value} status={value} label={value} tone="neutral" showIcon={false} />)}</div>
}

export function MetricTile({ label, value, note, tone = 'neutral', onClick }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'neutral' | 'pass' | 'fail' | 'warn'; onClick?: () => void }) {
  const body = <><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-muted">{label}</p>{onClick && <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-400" />}</div><p className={cn('mt-2 text-2xl font-semibold tracking-tight', tone === 'pass' ? 'text-pass' : tone === 'fail' ? 'text-fail' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{value}</p>{note && <div className="mt-2 text-[11px] leading-4 text-muted">{note}</div>}</>
  return onClick ? <button type="button" onClick={onClick} className="min-w-0 rounded-lg border border-line bg-panel p-4 text-left shadow-panel transition hover:border-accent/40 hover:shadow-md">{body}</button> : <div className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">{body}</div>
}

export function DetailDrawer({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return <Drawer open={open} onClose={onClose} width="lg" title={title} description={description} footer={footer}>{children}</Drawer>
}

export function PendingBlock({ title, description, icon: Icon = Info }: { title: string; description: string; icon?: LucideIcon }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/70 p-4"><div className="flex gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{title}</h3><StatusBadge status="待配置" tone="neutral" showIcon={false} /></div><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div></div></div>
}

export function ReferenceDrawer({ target, onClose }: { target?: ReferenceTarget; onClose: () => void }) {
  return <DetailDrawer open={Boolean(target)} onClose={onClose} title={`${target?.kind ?? ''} 关联对象`} description="对象 ID 与来源链路保持可审计。"><SectionHeader title={target?.id ?? '—'} description="当前为跨页面关联预览；接入路由后将打开对应对象详情，并保留原筛选条件。" /><div className="mt-4"><Button onClick={onClose}>返回当前列表</Button></div></DetailDrawer>
}
