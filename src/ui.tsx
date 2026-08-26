import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
  type LucideIcon
} from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'

/** Join Tailwind classes while allowing consumers to override local details. */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

type StatusTone = 'pass' | 'fail' | 'warn' | 'derived' | 'neutral' | 'info'

const statusTone = (status: string): StatusTone => {
  const normalized = status.trim().toLowerCase()
  if (['pass', 'passed', 'effective', 'success', 'improved', 'completed', 'enabled', 'yes'].includes(normalized)) return 'pass'
  if (['fail', 'failed', 'error', 'timeout', 'regressed', 'newly failed', 'disabled', 'no'].includes(normalized)) return 'fail'
  if (['warning', 'warn', 'candidate', 'running', 'queued', 'inefficient', 'effective but inefficient'].includes(normalized)) return 'warn'
  if (['derived', 'derived failure', 'unchanged failed'].includes(normalized)) return 'derived'
  if (['info', 'in progress'].includes(normalized)) return 'info'
  return 'neutral'
}

const toneClasses: Record<StatusTone, string> = {
  pass: 'border-pass/25 bg-pass/10 text-pass',
  fail: 'border-fail/25 bg-fail/10 text-fail',
  warn: 'border-warn/25 bg-warn/10 text-warn',
  derived: 'border-derived/25 bg-derived/10 text-derived',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-accent/25 bg-accent/10 text-accent'
}

const toneIcon: Record<StatusTone, LucideIcon> = {
  pass: Check,
  fail: XCircle,
  warn: AlertTriangle,
  derived: Info,
  neutral: CircleHelp,
  info: Info
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: string
  label?: string
  tone?: StatusTone
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export function StatusBadge({ status, label, tone, size = 'sm', showIcon = true, className, ...props }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusTone(status)
  const Icon = toneIcon[resolvedTone]
  return (
    <span
      {...props}
      role={props.role ?? 'status'}
      data-status={status}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none',
        size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
        toneClasses[resolvedTone],
        className
      )}
    >
      {showIcon && <Icon aria-hidden="true" className={size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} strokeWidth={2.2} />}
      <span className="truncate">{label ?? status}</span>
    </span>
  )
}

export interface SparklineProps {
  values: number[]
  color?: string
  className?: string
  label?: string
}

export function Sparkline({ values, color = '#1d5fd1', className, label = 'Trend' }: SparklineProps) {
  const safeValues = values.length ? values : [0]
  const min = Math.min(...safeValues)
  const max = Math.max(...safeValues)
  const range = max - min || 1
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? 50 : (index / (safeValues.length - 1)) * 100
    const y = 24 - ((value - min) / range) * 20
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  return (
    <svg aria-label={label} role="img" viewBox="0 0 100 28" preserveAspectRatio="none" className={cn('h-7 w-full overflow-visible', className)}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface MetricCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  id?: string
  label: string
  value: ReactNode
  delta?: number
  deltaLabel?: string
  trend?: number[]
  pass?: number
  fail?: number
  description?: string
  unit?: string
  onClick?: () => void
  active?: boolean
  loading?: boolean
}

export function MetricCard({ id, label, value, delta, deltaLabel = 'vs previous period', trend = [], pass, fail, description, unit, onClick, active = false, loading = false, className, ...props }: MetricCardProps) {
  const clickable = Boolean(onClick)
  const deltaUp = (delta ?? 0) >= 0
  const trendColor = deltaUp ? '#138a5b' : '#c43d4b'
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted">{label}</p>
          {description && <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{description}</p>}
        </div>
        {clickable && <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {loading ? <Loader2 aria-label="Loading" className="h-6 w-6 animate-spin text-slate-400" /> : <p className="truncate text-2xl font-semibold tracking-tight text-ink">{value}{unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}</p>}
          {delta !== undefined && !loading && (
            <span className={cn('mt-1 inline-flex items-center gap-1 text-[11px] font-medium', deltaUp ? 'text-pass' : 'text-fail')}>
              {deltaUp ? <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1)}% <span className="font-normal text-slate-400">{deltaLabel}</span>
            </span>
          )}
        </div>
        {trend.length > 0 && <div className="w-24 shrink-0"><Sparkline values={trend} color={trendColor} /></div>}
      </div>
      {(pass !== undefined || fail !== undefined) && (
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-muted">
          {pass !== undefined && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-pass" />{pass} pass</span>}
          {fail !== undefined && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-fail" />{fail} fail</span>}
        </div>
      )}
    </>
  )
  const sharedClassName = cn(
      'rounded-lg border bg-panel p-4 text-left shadow-panel transition',
      active ? 'border-accent ring-2 ring-accent/15' : 'border-line',
      clickable && 'cursor-pointer hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      className
    )
  if (clickable) return <div {...props} id={id} data-metric-id={id} role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.() } }} className={sharedClassName}>{content}</div>
  return <div {...props} id={id} data-metric-id={id} className={sharedClassName}>{content}</div>
}

export interface Column<T> {
  key: string
  header: ReactNode
  accessor?: (row: T) => ReactNode
  cell?: (value: ReactNode, row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
  sortable?: boolean
  width?: string
}

export interface DataTableProps<T> extends HTMLAttributes<HTMLDivElement> {
  columns: Column<T>[]
  rows: T[]
  rowKey?: (row: T, index: number) => string
  onRowClick?: (row: T, index: number) => void
  selectedRowId?: string
  empty?: ReactNode
  loading?: boolean
  caption?: string
  dense?: boolean
  stickyHeader?: boolean
  sort?: { key: string; direction: 'asc' | 'desc' }
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void
}

export function DataTable<T>({ columns, rows, rowKey = (_, index) => String(index), onRowClick, selectedRowId, empty = <EmptyState title="No records" description="Try adjusting the active filters." />, loading = false, caption, dense = false, stickyHeader = false, sort, onSortChange, className, ...props }: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return
    const direction = sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSortChange(column.key, direction)
  }
  return (
    <div {...props} className={cn('min-w-0 overflow-hidden rounded-lg border border-line bg-panel shadow-panel', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn('bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500', stickyHeader && 'sticky top-0 z-10')}>
            <tr>
              {columns.map((column) => {
                const activeSort = sort?.key === column.key
                return (
                  <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined} className={cn('whitespace-nowrap border-b border-line px-4 py-3 font-semibold', dense && 'px-3 py-2', column.headerClassName)}>
                    {column.sortable ? (
                      <button type="button" onClick={() => handleSort(column)} className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {column.header}
                        {activeSort ? <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5', sort?.direction === 'desc' && 'rotate-180')} /> : <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                      </button>
                    ) : column.header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-muted"><Loader2 aria-label="Loading" className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && rows.map((row, index) => {
              const key = rowKey(row, index)
              const valueCells = columns.map((column) => column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key])
              const interactive = Boolean(onRowClick)
              return (
                <tr key={key} data-row-key={key} aria-selected={selectedRowId === key || undefined} onClick={() => onRowClick?.(row, index)} onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick?.(row, index) } }} tabIndex={interactive ? 0 : undefined} className={cn('group bg-panel transition-colors', interactive && 'cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent', selectedRowId === key && 'bg-accent/5')}>
                  {columns.map((column, columnIndex) => {
                    const value = valueCells[columnIndex] as ReactNode
                    return <td key={column.key} className={cn('max-w-[360px] border-line px-4 py-3 align-middle text-ink', dense && 'px-3 py-2', column.className)}>{column.cell ? column.cell(value, row, index) : value}</td>
                  })}
                </tr>
              )
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-10">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export interface FilterOption { label: string; value: string }
export interface FilterControl {
  id: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  controls?: FilterControl[]
  children?: ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  resultCount?: number
  onReset?: () => void
  compact?: boolean
  title?: string
}

export function FilterBar({ controls = [], children, searchValue, onSearchChange, searchPlaceholder = 'Search task_id, trace_id or query', resultCount, onReset, compact = false, title, className, ...props }: FilterBarProps) {
  const searchId = useId()
  return (
    <div {...props} className={cn('flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel p-3 shadow-panel', compact ? 'gap-1.5 p-2' : 'gap-2.5', className)}>
      {title && <div className="mr-1 flex items-center gap-2 self-center text-xs font-semibold text-ink"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-accent" />{title}</div>}
      {onSearchChange && <label htmlFor={searchId} className="relative min-w-[220px] flex-1"><span className="sr-only">{searchPlaceholder}</span><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id={searchId} value={searchValue ?? ''} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className="h-9 w-full rounded-md border border-line bg-white pl-8 pr-3 text-xs text-ink outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15" /></label>}
      {controls.map((control) => <SelectControl key={control.id} {...control} compact={compact} />)}
      {children}
      {resultCount !== undefined && <span className="ml-auto self-center whitespace-nowrap text-xs text-muted">{resultCount.toLocaleString()} results</span>}
      {onReset && <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />Reset</button>}
    </div>
  )
}

interface SelectControlProps extends FilterControl { compact?: boolean }
function SelectControl({ id, label, value, options, onChange, placeholder, disabled, compact }: SelectControlProps) {
  return <label htmlFor={id} className="flex min-w-[130px] flex-col gap-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span><span className="relative"><select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={cn('h-9 w-full appearance-none rounded-md border border-line bg-white pl-2.5 pr-7 text-xs text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400', compact && 'h-8')}><option value="">{placeholder ?? `All ${label}`}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /></span></label>
}

export interface TabsItem { id: string; label: ReactNode; count?: number; disabled?: boolean }
export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabsItem[]
  activeId: string
  onChange: (id: string) => void
  variant?: 'line' | 'pill'
  size?: 'sm' | 'md'
}

export function Tabs({ items, activeId, onChange, variant = 'line', size = 'sm', className, ...props }: TabsProps) {
  return <div {...props} className={cn(variant === 'line' ? 'border-b border-line' : 'rounded-lg bg-slate-100 p-1', className)}><div role="tablist" aria-label={props['aria-label'] ?? 'Views'} className={cn('flex min-w-0 items-center gap-1 overflow-x-auto', variant === 'line' ? '-mb-px' : '')}>{items.map((item) => { const active = item.id === activeId; return <button key={item.id} id={`tab-${item.id}`} type="button" role="tab" aria-selected={active} aria-controls={`tabpanel-${item.id}`} disabled={item.disabled} onClick={() => onChange(item.id)} className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm', variant === 'line' ? (active ? 'border-b-2 border-accent text-accent' : 'border-b-2 border-transparent text-muted hover:border-slate-300 hover:text-ink') : (active ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'))}>{item.label}{item.count !== undefined && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active ? 'bg-accent/10 text-accent' : 'bg-slate-200 text-slate-600')}>{item.count}</span>}</button> })}</div></div>
}

export interface BreadcrumbItem { id?: string; label: ReactNode; href?: string; onClick?: () => void }
export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> { items: BreadcrumbItem[]; onBack?: () => void; backLabel?: string }

export function Breadcrumb({ items, onBack, backLabel = 'Back', className, ...props }: BreadcrumbProps) {
  return <nav {...props} aria-label={props['aria-label'] ?? 'Breadcrumb'} className={cn('flex min-w-0 items-center gap-1.5 text-xs text-muted', className)}>{onBack && <button type="button" onClick={onBack} className="mr-1 inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rotate-180" />{backLabel}</button>}{items.map((item, index) => <span key={item.id ?? index} className="inline-flex min-w-0 items-center gap-1.5">{index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-300" />}{item.href ? <a href={item.href} onClick={item.onClick} className={cn('truncate rounded px-1.5 py-1 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', index === items.length - 1 && 'font-semibold text-ink')}>{item.label}</a> : item.onClick ? <button type="button" onClick={item.onClick} className={cn('truncate rounded px-1.5 py-1 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', index === items.length - 1 && 'font-semibold text-ink')}>{item.label}</button> : <span aria-current={index === items.length - 1 ? 'page' : undefined} className={cn('truncate px-1.5 py-1', index === items.length - 1 && 'font-semibold text-ink')}>{item.label}</span>}</span>)}</nav>
}

interface LayerProps { open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string; labelledBy?: string; describedBy?: string }
export interface DrawerProps extends LayerProps { side?: 'right' | 'left'; width?: 'sm' | 'md' | 'lg' | string; closeLabel?: string; initialFocusRef?: RefObject<HTMLElement> }

const layerWidth = (width: DrawerProps['width']) => width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-2xl' : width === 'md' || !width ? 'max-w-xl' : width

export function Drawer({ open, onClose, title, description, children, footer, side = 'right', width = 'md', closeLabel = 'Close panel', className, labelledBy, describedBy, initialFocusRef }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    const focusTarget = initialFocusRef?.current ?? closeRef.current
    focusTarget?.focus()
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.() }
  }, [open, onClose, initialFocusRef])
  if (!open) return null
  return <div className="fixed inset-0 z-50" role="presentation"><button type="button" aria-label="Close overlay" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/25 backdrop-blur-[1px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId} aria-describedby={description ? (describedBy ?? descriptionId) : undefined} className={cn('absolute inset-y-0 flex w-full flex-col bg-panel shadow-2xl outline-none', side === 'right' ? 'right-0 border-l border-line' : 'left-0 border-r border-line', layerWidth(width), className)} tabIndex={-1}><header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4"><div className="min-w-0"><h2 id={labelledBy ?? titleId} className="truncate text-base font-semibold text-ink">{title}</h2>{description && <p id={describedBy ?? descriptionId} className="mt-1 text-xs leading-5 text-muted">{description}</p>}</div><button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-4 w-4" /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>{footer && <footer className="shrink-0 border-t border-line bg-slate-50 px-5 py-3">{footer}</footer>}</div></div>
}

export interface ModalProps extends LayerProps { size?: 'sm' | 'md' | 'lg'; closeLabel?: string; initialFocusRef?: RefObject<HTMLElement> }
export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeLabel = 'Close dialog', className, labelledBy, describedBy, initialFocusRef }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    ;(initialFocusRef?.current ?? closeRef.current)?.focus()
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.() }
  }, [open, onClose, initialFocusRef])
  if (!open) return null
  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation"><button type="button" aria-label="Close overlay" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/30" /><div role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId} aria-describedby={description ? (describedBy ?? descriptionId) : undefined} className={cn('relative flex max-h-[min(720px,calc(100vh-2rem))] w-full flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl outline-none', sizeClass, className)}><header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4"><div className="min-w-0"><h2 id={labelledBy ?? titleId} className="text-base font-semibold text-ink">{title}</h2>{description && <p id={describedBy ?? descriptionId} className="mt-1 text-xs leading-5 text-muted">{description}</p>}</div><button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-4 w-4" /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>{footer && <footer className="shrink-0 border-t border-line bg-slate-50 px-5 py-3">{footer}</footer>}</div></div>
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: LucideIcon }
export function EmptyState({ title, description, action, icon: Icon = Filter, className, ...props }: EmptyStateProps) {
  return <div {...props} className={cn('flex min-h-[160px] flex-col items-center justify-center px-5 py-8 text-center', className)}><span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon aria-hidden="true" className="h-4 w-4" /></span><h3 className="text-sm font-semibold text-ink">{title}</h3>{description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>
}

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; level?: 2 | 3 }
export function SectionHeader({ eyebrow, title, description, actions, meta, level = 2, className, ...props }: SectionHeaderProps) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return <div {...props} className={cn('flex flex-wrap items-start justify-between gap-3', className)}><div className="min-w-0">{eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{eyebrow}</p>}<Heading className={cn('text-ink', level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold')}>{title}</Heading>{description && <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">{description}</p>}{meta && <div className="mt-2 text-[11px] text-slate-400">{meta}</div>}</div>{actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}</div>
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: LucideIcon; loading?: boolean }
export function Button({ variant = 'secondary', size = 'sm', icon: Icon, loading = false, disabled, className, children, ...props }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'border-accent bg-accent text-white hover:bg-accent/90' : variant === 'danger' ? 'border-fail bg-fail text-white hover:bg-fail/90' : variant === 'ghost' ? 'border-transparent bg-transparent text-muted hover:bg-slate-100 hover:text-ink' : 'border-line bg-white text-ink hover:border-accent/50 hover:bg-accent/5'
  return <button {...props} disabled={disabled || loading} className={cn('inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm', variantClass, className)}>{loading ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}{children}</button>
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { icon: LucideIcon; label: string; size?: 'sm' | 'md' }
export function IconButton({ icon: Icon, label, size = 'sm', className, ...props }: IconButtonProps) {
  return <button {...props} type={props.type ?? 'button'} aria-label={label} title={props.title ?? label} className={cn('inline-flex items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'h-8 w-8' : 'h-9 w-9', className)}><Icon aria-hidden="true" className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} /></button>
}

export interface FieldProps extends HTMLAttributes<HTMLDivElement> { label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode }
export function Field({ label, hint, error, required = false, children, className, ...props }: FieldProps) {
  return <div {...props} className={cn('flex min-w-0 flex-col gap-1.5', className)}><label className="text-xs font-medium text-ink">{label}{required && <span className="ml-1 text-fail" aria-hidden="true">*</span>}</label>{children}{error ? <p role="alert" className="text-[11px] text-fail">{error}</p> : hint ? <p className="text-[11px] leading-4 text-muted">{hint}</p> : null}</div>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('h-9 w-full rounded-md border border-line bg-white px-2.5 text-xs text-ink outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-slate-50', props.className)} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="relative block"><select {...props} className={cn('h-9 w-full appearance-none rounded-md border border-line bg-white px-2.5 pr-8 text-xs text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-slate-50', props.className)} /> <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /></span>
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('min-h-[84px] w-full resize-y rounded-md border border-line bg-white px-2.5 py-2 text-xs leading-5 text-ink outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-slate-50', props.className)} />
}

export function Toggle({ checked, onChange, label, disabled = false, className }: { checked: boolean; onChange: (checked: boolean) => void; label?: ReactNode; disabled?: boolean; className?: string }) {
  const id = useId()
  return <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-xs text-ink', disabled && 'cursor-not-allowed opacity-50', className)}><button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn('relative h-5 w-9 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1', checked ? 'border-accent bg-accent' : 'border-slate-300 bg-slate-200')}><span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[17px]' : 'translate-x-0.5')} /></button>{label}</label>
}

export function Divider({ className }: { className?: string }) { return <div aria-hidden="true" className={cn('h-px bg-line', className)} /> }

export function InlineNotice({ tone = 'info', title, children, className }: { tone?: StatusTone; title?: ReactNode; children: ReactNode; className?: string }) {
  const Icon = toneIcon[tone]
  return <div role={tone === 'fail' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border p-3 text-xs', toneClasses[tone], className)}><Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0">{title && <p className="font-semibold">{title}</p>}<div className={title ? 'mt-0.5' : ''}>{children}</div></div></div>
}

export function ProgressBar({ value, max = 100, tone = 'accent', label, className }: { value: number; max?: number; tone?: 'accent' | 'pass' | 'fail' | 'warn'; label?: string; className?: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100))
  const color = tone === 'pass' ? 'bg-pass' : tone === 'fail' ? 'bg-fail' : tone === 'warn' ? 'bg-warn' : 'bg-accent'
  return <div className={cn('min-w-0', className)}>{label && <div className="mb-1 flex justify-between gap-2 text-[11px] text-muted"><span className="truncate">{label}</span><span>{Math.round(value)}%</span></div>}<div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn('h-full rounded-full transition-[width]', color)} style={{ width: `${width}%` }} /></div></div>
}

export function useControllableState<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void) {
  const [internal, setInternal] = useState(defaultValue)
  const current = value === undefined ? internal : value
  const set = (next: T) => { if (value === undefined) setInternal(next); onChange?.(next) }
  return [current, set] as const
}

// Keep these aliases for pages that prefer the longer semantic names.
export const Metric = MetricCard
export const Table = DataTable
export const PanelHeader = SectionHeader
