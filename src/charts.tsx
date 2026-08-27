import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps
} from 'recharts'
import { useId, type HTMLAttributes, type ReactNode } from 'react'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { cn, EmptyState, SectionHeader } from './ui'

export type ChartDatum = object

export interface ChartShellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  height?: number
  ariaLabel?: string
  children: ReactNode
}

export function ChartShell({ title, description, actions, height = 220, ariaLabel, children, className, ...props }: ChartShellProps) {
  return <section {...props} className={cn('min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel', className)} aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}><>{(title || description || actions) && <SectionHeader level={3} title={title ?? ''} description={description} actions={actions} />}</><div className="mt-3 min-w-0" style={{ height }}>{children}</div></section>
}

const readValue = (datum: object, key: string, fallback = 0) => {
  const value = (datum as Record<string, unknown>)[key]
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const readLabel = (datum: object, key: string, index: number) => {
  const value = (datum as Record<string, unknown>)[key]
  return value === undefined || value === null ? String(index + 1) : String(value)
}

const formatDefaultValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1)

function ChartTooltip({ active, payload, label, valueFormatter = formatDefaultValue }: TooltipProps<ValueType, NameType> & { valueFormatter?: (value: number) => string }) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value ?? 0)
  return <div className="rounded-md border border-line bg-white px-2.5 py-2 text-xs shadow-lg"><p className="font-medium text-ink">{label}</p><p className="mt-0.5 text-muted">{valueFormatter(value)}</p></div>
}

export interface TrendChartProps<T extends object> extends Omit<ChartShellProps, 'children'> {
  data: readonly T[]
  xKey?: keyof T & string
  valueKey?: keyof T & string
  color?: string
  valueFormatter?: (value: number) => string
  onPointClick?: (point: T, index: number) => void
  showArea?: boolean
  showPoints?: boolean
  empty?: ReactNode
}

export function TrendChart<T extends object>({ data, xKey = 'label' as keyof T & string, valueKey = 'value' as keyof T & string, color = '#1d5fd1', valueFormatter = formatDefaultValue, onPointClick, showArea = true, showPoints = true, empty = <EmptyState title="No trend data" description="There is no data in the current scope." />, title, description, actions, height = 220, ariaLabel, className, ...props }: TrendChartProps<T>) {
  const chartId = useId()
  if (!data.length) return <ChartShell {...props} title={title} description={description} actions={actions} height={height} ariaLabel={ariaLabel} className={className}>{empty}</ChartShell>
  return <ChartShell {...props} title={title} description={description} actions={actions} height={height} ariaLabel={ariaLabel} className={className} data-testid={`trend-chart-${chartId}`}>
    <div className="h-full min-w-0" data-chart-type="trend">
      <ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={data as T[]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} onClick={(state) => {
        const index = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1
        if (index >= 0 && data[index]) onPointClick?.(data[index], index)
      }}>
        <CartesianGrid stroke="#eef1f4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={String(xKey)} axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 10 }} tickMargin={8} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 10 }} tickFormatter={valueFormatter} width={40} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
        <Line type="monotone" dataKey={String(valueKey)} stroke={color} strokeWidth={2.2} dot={showPoints ? { r: 3, strokeWidth: 2, fill: '#fff' } : false} activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }} isAnimationActive={false} />
      </RechartsLineChart></ResponsiveContainer>
      <p className="sr-only">Trend values: {data.map((datum, index) => `${readLabel(datum, String(xKey), index)} ${valueFormatter(readValue(datum, String(valueKey)))}`).join(', ')}</p>
      {onPointClick && <div className="mt-1 flex gap-1 overflow-x-auto" aria-label="Trend data points">{data.map((datum, index) => <button key={`${readLabel(datum, String(xKey), index)}-${index}`} type="button" onClick={() => onPointClick(datum, index)} className="h-1.5 min-w-1.5 rounded-full bg-accent/50 transition hover:scale-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`View ${readLabel(datum, String(xKey), index)}: ${valueFormatter(readValue(datum, String(valueKey)))}`} />)}</div>}
    </div>
  </ChartShell>
}

export interface BarChartViewProps<T extends object> extends Omit<ChartShellProps, 'children'> {
  data: readonly T[]
  labelKey?: keyof T & string
  valueKey?: keyof T & string
  color?: string
  colors?: string[]
  valueFormatter?: (value: number) => string
  onBarClick?: (point: T, index: number) => void
  layout?: 'vertical' | 'horizontal'
  showGrid?: boolean
  empty?: ReactNode
}

export function BarChartView<T extends object>({ data, labelKey = 'label' as keyof T & string, valueKey = 'value' as keyof T & string, color = '#1d5fd1', colors, valueFormatter = formatDefaultValue, onBarClick, layout = 'vertical', showGrid = true, empty = <EmptyState title="No chart data" description="There is no data in the current scope." />, title, description, actions, height = 240, ariaLabel, className, ...props }: BarChartViewProps<T>) {
  const chartId = useId()
  if (!data.length) return <ChartShell {...props} title={title} description={description} actions={actions} height={height} ariaLabel={ariaLabel} className={className}>{empty}</ChartShell>
  const horizontal = layout === 'horizontal'
  return <ChartShell {...props} title={title} description={description} actions={actions} height={height} ariaLabel={ariaLabel} className={className} data-testid={`bar-chart-${chartId}`}>
    <div className="h-full min-w-0" data-chart-type={horizontal ? 'distribution' : 'bar'}>
      <ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={data as T[]} layout={horizontal ? 'vertical' : 'horizontal'} margin={horizontal ? { top: 5, right: 16, left: 12, bottom: 5 } : { top: 5, right: 10, left: -20, bottom: 0 }} onClick={(state) => {
        const index = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1
        if (index >= 0 && data[index]) onBarClick?.(data[index], index)
      }}>
        {showGrid && <CartesianGrid stroke="#eef1f4" strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} />}
        {horizontal ? <><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 10 }} tickFormatter={valueFormatter} /><YAxis type="category" dataKey={String(labelKey)} axisLine={false} tickLine={false} tick={{ fill: '#475467', fontSize: 10 }} width={112} /></> : <><XAxis dataKey={String(labelKey)} axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 10 }} tickMargin={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 10 }} tickFormatter={valueFormatter} width={40} /></>}
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={String(valueKey)} radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={horizontal ? 22 : 34} onClick={(_, index) => { if (typeof index === 'number' && data[index]) onBarClick?.(data[index], index) }}>
          {data.map((datum, index) => <Cell key={`cell-${index}`} fill={colors?.[index % colors.length] ?? color} />)}
        </Bar>
      </RechartsBarChart></ResponsiveContainer>
      <p className="sr-only">Chart values: {data.map((datum, index) => `${readLabel(datum, String(labelKey), index)} ${valueFormatter(readValue(datum, String(valueKey)))}`).join(', ')}</p>
      {onBarClick && <div className="mt-1 grid max-h-16 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto" aria-label="Chart data rows">{data.map((datum, index) => <button key={`${readLabel(datum, String(labelKey), index)}-${index}`} type="button" onClick={() => onBarClick(datum, index)} className="flex min-w-0 items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] text-muted hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="truncate">{readLabel(datum, String(labelKey), index)}</span><span className="shrink-0 font-medium text-ink">{valueFormatter(readValue(datum, String(valueKey)))}</span></button>)}</div>}
    </div>
  </ChartShell>
}

export interface DistributionChartProps<T extends object> extends Omit<BarChartViewProps<T>, 'layout'> {
  layout?: 'horizontal' | 'vertical'
}

export function DistributionChart<T extends object>(props: DistributionChartProps<T>) {
  return <BarChartView {...props} layout={props.layout ?? 'horizontal'} />
}

export interface HistogramBin { label: string; count: number; min?: number; max?: number }
export function HistogramChart({ data, title, description, onBinClick, valueFormatter = (value) => String(value), height = 210, className }: { data: readonly HistogramBin[]; title?: ReactNode; description?: ReactNode; onBinClick?: (bin: HistogramBin, index: number) => void; valueFormatter?: (value: number) => string; height?: number; className?: string }) {
  return <BarChartView data={data} labelKey="label" valueKey="count" title={title} description={description} height={height} className={className} valueFormatter={valueFormatter} onBarClick={onBinClick} />
}

export interface TimeSeriesPoint { label: string; value: number; id?: string; [key: string]: string | number | undefined }
export function MiniTrend({ data, color = '#1d5fd1', onPointClick, ariaLabel = 'Trend' }: { data: readonly TimeSeriesPoint[]; color?: string; onPointClick?: (point: TimeSeriesPoint, index: number) => void; ariaLabel?: string }) {
  if (!data.length) return <span className="text-[11px] text-slate-400">暂无数据</span>
  return <div className="h-8 min-w-[100px]"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={data as TimeSeriesPoint[]} margin={{ top: 3, right: 1, left: 1, bottom: 3 }} onClick={(state) => { const index = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1; if (index >= 0) onPointClick?.(data[index], index) }}><Line dataKey="value" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} /></RechartsLineChart></ResponsiveContainer><span className="sr-only" aria-label={ariaLabel}>{data.map((point) => `${point.label} ${point.value}`).join(', ')}</span></div>
}

// Common aliases used by dashboard pages.
export const ClickableTrendChart = TrendChart
export const ClickableBarChart = BarChartView
export const RootCauseChart = DistributionChart
export const Trend = TrendChart
export const BarChart = BarChartView
