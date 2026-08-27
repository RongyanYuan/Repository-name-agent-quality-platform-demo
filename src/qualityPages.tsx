import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Database,
  FileCheck2,
  FilterX,
  Gauge,
  GitCompareArrows,
  Layers3,
  ListFilter,
  MessageSquareText,
  Network,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Workflow,
  XCircle
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { BarChartView } from './charts'
import {
  BUSINESS_TYPES,
  COMPLEXITIES,
  PROCESS_DIMENSIONS,
  RESULT_DIMENSIONS,
  ROOT_CAUSES,
  type CaseRecord,
  type EvalConfig,
  type EvalResult,
  type FilterState,
  type Observation,
  type Evidence,
  type ObservationNode,
  type Task,
  type TaskStatus
} from './domain'
import {
  defaultFilters,
  effectiveEvalStatus,
  filterTasks,
  formatCurrency,
  formatDuration,
  formatPercent,
  getCasesForTasks,
  getFirstFailure,
  getInefficientExpectedRate,
  getModelMetrics,
  getModuleDiagnostics,
  getPerformanceMetrics,
  getProcessEfficiencyMetrics,
  getQualifiedProductLayers,
  getQualifiedProductMetrics,
  getRootCauseMetrics,
  getScopeLabel,
  getToolMetrics,
  getTraceByTask,
  getUserSatisfactionMetrics
} from './selectors'
import type { QualifiedProductLayerMetric } from './selectors'
import { useContextNavigation } from './layout'
import { useQuality } from './store'
import { TraceTimeline as SharedTraceTimeline } from './trace'
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  InlineNotice,
  MetricCard,
  Modal,
  ProgressBar,
  SectionHeader,
  SelectInput,
  Sparkline,
  StatusBadge,
  Tabs,
  TextArea,
  TextInput,
  Toggle,
  cn,
  type Column,
  type FilterControl
} from './ui'

const humanDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
const shortId = (value: string) => value.replace(/^task-|^trace-/, '').toUpperCase()
const statusTone = (status: string) => status === 'PASS' || status === 'Effective' ? 'pass' : status === 'FAIL' || status === 'Failed' ? 'fail' : status.includes('Inefficient') ? 'warn' : 'neutral'
const rootCauseTone = (rootCause: string) => rootCause === 'None' ? 'pass' : rootCause === 'Memory' || rootCause === 'Context' ? 'warn' : 'fail'

function PageIntro({ eyebrow, title, description, actions, meta }: { eyebrow: string; title: string; description: string; actions?: ReactNode; meta?: ReactNode }) {
  const eyebrowLabels: Record<string, string> = { 'QUALITY OVERVIEW': '质量总览', 'PERFORMANCE MONITORING': '性能监控', 'TASK / TRACE WORKBENCH': 'Task / Trace 工作台', 'EVALUATION CONFIG': '评测配置' }
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="eyebrow">{eyebrowLabels[eyebrow] ?? eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{title}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">{description}</p>{meta && <div className="mt-2 text-[11px] text-slate-400">{meta}</div>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</div>
}

function Panel({ children, className = '', labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return <section aria-labelledby={labelledBy} className={cn('rounded-lg border border-line bg-panel p-4 shadow-panel', className)}>{children}</section>
}

function MiniMetric({ label, value, note, tone = 'neutral', icon: Icon }: { label: string; value: ReactNode; note?: string; tone?: 'neutral' | 'pass' | 'fail' | 'warn'; icon?: typeof Gauge }) {
  return <div className="min-w-0 rounded-md border border-line bg-slate-50 p-3"><div className="flex items-center justify-between gap-2 text-[11px] text-muted"><span className="truncate">{label}</span>{Icon && <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}</div><div className={cn('mt-2 text-lg font-semibold text-ink', tone === 'pass' && 'text-pass', tone === 'fail' && 'text-fail', tone === 'warn' && 'text-warn')}>{value}</div>{note && <div className="mt-1 text-[10px] text-slate-400">{note}</div>}</div>
}

function OutcomeLegend() {
  return <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 text-[11px] text-muted"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full bg-pass" />PASS / Effective</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full bg-fail" />FAIL</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full bg-warn" />Warning / Inefficient</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full bg-derived" />Derived</span></div>
}

type OverviewMetricTone = 'info' | 'pass' | 'warn' | 'fail' | 'neutral'

function OverviewMetricCard({ id, label, value, trend, numerator, denominator, description, tone = 'neutral', featured = false, onClick }: {
  id: string
  label: string
  value: number
  trend: number[]
  numerator?: number
  denominator?: number
  description: string
  tone?: OverviewMetricTone
  featured?: boolean
  onClick: () => void
}) {
  const toneClasses: Record<OverviewMetricTone, string> = {
    info: 'border-accent/30 bg-accent/5',
    pass: 'border-pass/25 bg-pass/5',
    warn: 'border-warn/35 bg-warn/5',
    fail: 'border-fail/30 bg-fail/5',
    neutral: 'border-line bg-white'
  }
  const valueClasses: Record<OverviewMetricTone, string> = {
    info: 'text-accent',
    pass: 'text-pass',
    warn: 'text-warn',
    fail: 'text-fail',
    neutral: 'text-ink'
  }
  const trendColors: Record<OverviewMetricTone, string> = {
    info: '#1d5fd1',
    pass: '#138a5b',
    warn: '#bd6b13',
    fail: '#c43d4b',
    neutral: '#64748b'
  }
  return <button type="button" data-metric-id={id} aria-label={`${label} ${value.toFixed(1)}%`} onClick={onClick} className={cn('flex min-h-[170px] min-w-0 flex-col rounded-lg border p-4 text-left shadow-panel transition hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2', toneClasses[tone], featured && 'min-h-[192px] p-5')}>
    <span className="flex min-w-0 items-start justify-between gap-3">
      <span className={cn('min-w-0 break-words font-semibold leading-5 text-ink', featured ? 'text-sm' : 'text-xs')}>{label}</span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </span>
    <span className={cn('mt-3 block font-semibold leading-none', featured ? 'text-4xl' : 'text-2xl', valueClasses[tone])}>{value.toFixed(1)}%</span>
    <span className="mt-2 block min-h-8 text-[11px] leading-4 text-muted">{description}</span>
    <span className="mt-auto block pt-3">
      <span className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
        <span>7 日趋势</span>
        {numerator !== undefined && denominator !== undefined && <span className="shrink-0">分子 {numerator} · 分母 {denominator}</span>}
      </span>
      <span className="mt-1 block h-8"><Sparkline values={trend} color={trendColors[tone]} label={`${label} 7 日趋势`} /></span>
    </span>
  </button>
}

function ModuleDiagnosticCard({ nodeType, status, stateCounts, evidenceCoverage, firstFailureCount, derivedCount, onClick }: {
  nodeType: string
  status: string
  stateCounts: Record<string, number>
  evidenceCoverage: { observed: number; total: number; rate: number }
  firstFailureCount: number
  derivedCount: number
  onClick: () => void
}) {
  return <button type="button" onClick={onClick} aria-label={`${nodeType} ${status}`} className="flex min-h-[142px] min-w-0 flex-col rounded-lg border border-line bg-white p-3 text-left transition hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
    <span className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <strong className="min-w-0 break-words text-xs leading-5 text-ink">{nodeType}</strong>
      <StatusBadge status={status} />
    </span>
    <span className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-4 text-muted">
      {(['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A'] as const).map((state) => <span key={state} className="rounded bg-slate-50 px-1.5 py-0.5">{state} {stateCounts[state] ?? 0}</span>)}
    </span>
    <span className="mt-auto block pt-3">
      <span className="flex flex-wrap justify-between gap-2 text-[10px] text-slate-400"><span>首错 {firstFailureCount} · 派生 {derivedCount}</span><span>Evidence {evidenceCoverage.observed}/{evidenceCoverage.total} · {evidenceCoverage.rate}%</span></span>
    </span>
  </button>
}

function QualifiedProductLayer({ layer, expanded, onToggle, onOpen }: { layer: QualifiedProductLayerMetric; expanded: boolean; onToggle: () => void; onOpen: () => void }) {
  return <section className="min-w-0 rounded-md border border-line bg-slate-50/60 p-3" aria-labelledby={`${layer.id}-qualified-title`}>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h3 id={`${layer.id}-qualified-title`} className="break-words text-sm font-semibold text-ink">{layer.label}</h3><p className="mt-1 text-[11px] text-muted">{layer.productTypes.join(' / ')} · {layer.evaluator}</p></div>
      <Button size="sm" icon={ArrowRight} onClick={onOpen}>查看明细</Button>
    </div>
    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
      <MiniMetric label="合格率" value={layer.allProducts ? `${layer.qualifiedRate.toFixed(1)}%` : 'N/A'} tone={layer.allProducts ? (layer.qualifiedRate >= 80 ? 'pass' : 'warn') : 'neutral'} note={layer.allProducts ? `${layer.qualifiedProducts} / ${layer.allProducts}` : '暂无样本'} />
      <MiniMetric label="平均评分" value={layer.averageScore === null ? 'UNKNOWN' : layer.averageScore.toFixed(2)} note={layer.allProducts ? layer.evaluator : '基线未建立'} />
      <MiniMetric label="通过" value={layer.passCount} tone="pass" note="Eval Agent 通过" />
      <MiniMetric label="未通过" value={layer.failCount} tone={layer.failCount ? 'fail' : 'neutral'} note={layer.unknownCount ? `UNKNOWN ${layer.unknownCount}` : '已判定'} />
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2"><p className="text-[10px] text-muted">原因分布</p><button type="button" aria-label={`${expanded ? '收起' : '展开'}${layer.label}评测原因`} aria-expanded={expanded} onClick={onToggle} className="text-[11px] font-medium text-accent hover:underline">{expanded ? '收起原因' : '展开原因'}</button></div>
    {expanded && <div className="mt-2 space-y-1.5">{layer.reasons.length ? layer.reasons.map((reason) => <button key={reason.label} type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-2 rounded border border-line bg-white px-2.5 py-2 text-left text-[11px] hover:border-accent/40"><span className="min-w-0 break-words text-ink">{reason.label}</span><span className="shrink-0 font-semibold text-fail">{reason.count}</span></button>) : <p className="text-[11px] text-muted">暂无未通过原因</p>}</div>}
  </section>
}

export function OverviewPage() {
  const { state } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [qualifiedExpanded, setQualifiedExpanded] = useState(true)
  const [processExpanded, setProcessExpanded] = useState(true)
  const satisfaction = getUserSatisfactionMetrics(state, state.filters)
  const qualifiedProduct = getQualifiedProductMetrics(state, state.filters)
  const qualifiedLayers = getQualifiedProductLayers(state, state.filters)
  const processEfficiency = getProcessEfficiencyMetrics(state, state.filters)
  const outOfExpectation = getInefficientExpectedRate(state, state.filters)
  const moduleDiagnostics = getModuleDiagnostics(state, state.filters)
  const rootMetrics = getRootCauseMetrics(state, state.filters)
  const totalProducts = filterTasks(state, state.filters).length
  const qualifiedDescriptions: Record<string, string> = {
    'outcome-type': '交付类型与用户请求一致',
    'intent-consistency': '产物回应用户真实意图',
    'constraint-satisfaction': '显式约束被完整满足',
    accuracy: '事实、逻辑和执行结果正确',
    'file-validity': '文件可打开、链接可用或 Action 可执行'
  }
  const processDescriptions: Record<string, string> = {
    'latency-efficiency': '实际总时延符合当前业务预期',
    'token-cost-efficiency': 'Token 和成本处于可接受范围',
    'necessary-loop': '只保留完成任务所需的 Loop',
    'skill-tool-selection': 'Skill 与 Tool 选择有效',
    'tool-result': 'Tool 返回结果成功且可用',
    'retry-effectiveness': 'Retry 有效推进任务恢复',
    'recovery-success': '异常后能恢复并继续交付'
  }
  const diagnosticRootCause: Record<string, string> = {
    'Task Understanding': 'Task Understanding',
    'Planning / Decision': 'Planning / Decision',
    Memory: 'Memory',
    'Skill Routing': 'Skill Routing',
    Skill: 'Skill Internal',
    Tool: 'Tool',
    'Loop / Retry': 'Loop / Retry'
  }
  const openMetric = (metric: string) => navigateContext('/tasks', { params: { metric } })
  return <div className="space-y-5">
    <PageIntro eyebrow="质量总览" title="质量总览" description="从用户满意度出发，分别判断产物是否合格、执行过程是否符合业务预期，再下钻到首个关键失败。" meta={<><span className="font-medium text-ink">{getScopeLabel(state.filters)}</span> · {totalProducts} 个产物 · 所有聚合信号均可回到 Task / Trace</>} actions={<><Button icon={ListFilter} onClick={() => navigateContext('/tasks', { params: { status: 'FAIL' } })}>查看异常任务</Button><Button variant="primary" icon={ArrowRight} onClick={() => navigateContext('/benchmarks')}>版本回归</Button></>} />

    <Panel labelledBy="north-star-title" className="overflow-hidden border-accent/30">
      <SectionHeader id="north-star-title" eyebrow="北极星指标" title="用户满意度" description="最终被用户接受的有效产物 / 全部产物；有效产物 = 合格产物且过程有效。用户行为信号保留来源 Event，可直接回到对应 Task / Trace。" actions={<StatusBadge status="北极星指标" tone="info" showIcon={false} />} />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,2.15fr)]">
        <OverviewMetricCard id={satisfaction.id} label={satisfaction.label} value={satisfaction.value} trend={satisfaction.trend} numerator={satisfaction.numerator} denominator={satisfaction.denominator} description="合格且过程有效、最终被接受的产物占全部产物的比例" tone="info" featured onClick={() => openMetric(satisfaction.id)} />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{satisfaction.signals.map((signal) => <OverviewMetricCard key={signal.id} id={signal.id} label={`${signal.label}率`} value={signal.rate} trend={Array.from({ length: 7 }, (_, point) => Math.max(0, Math.min(100, signal.rate + Math.sin(point + signal.count) * 1.8)))} numerator={signal.count} denominator={satisfaction.denominator} description={signal.id === 'first_accept' ? '首轮交付后无纠错直接接受' : signal.id === 'final_accept' ? '经正常新需求后最终接受' : signal.id === 'repeat_correction' ? '原需求下重复纠错超过一轮' : '明确点踩或拒绝当前产物'} tone={signal.id === 'repeat_correction' ? 'warn' : signal.id === 'negative_feedback' ? 'fail' : 'pass'} onClick={() => navigateContext('/tasks', { params: { acceptanceSignal: signal.id } })} />)}</div>
      </div>
    </Panel>

    <Panel labelledBy="qualified-product-title">
      <SectionHeader id="qualified-product-title" eyebrow="合格产物" title="合格产物" description="合格产物率由五个结果门槛共同判定；时延与成本不会隐式混入该指标。" meta={`合格 ${qualifiedProduct.qualifiedProducts} · 全部产物 ${qualifiedProduct.allProducts}`} actions={<button type="button" aria-label={`${qualifiedExpanded ? '收起' : '展开'}合格产物子指标`} aria-expanded={qualifiedExpanded} aria-controls="qualified-product-children" title={`${qualifiedExpanded ? '收起' : '展开'}合格产物子指标`} onClick={() => setQualifiedExpanded((value) => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', qualifiedExpanded && 'rotate-180')} /></button>} />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetricCard id={qualifiedProduct.id} label={qualifiedProduct.label} value={qualifiedProduct.value} trend={qualifiedProduct.trend} numerator={qualifiedProduct.numerator} denominator={qualifiedProduct.denominator} description="五个结果门槛全部 PASS 的产物比例" tone="info" featured onClick={() => openMetric(qualifiedProduct.id)} />
        {qualifiedExpanded && <div id="qualified-product-children" className="contents">{qualifiedProduct.children.map((metric) => <OverviewMetricCard key={metric.id} id={metric.id} label={metric.label} value={metric.value} trend={metric.trend} numerator={metric.pass} denominator={qualifiedProduct.denominator} description={qualifiedDescriptions[metric.id] ?? '结果评测子维度'} tone={metric.fail > 0 ? 'neutral' : 'pass'} onClick={() => openMetric(metric.id)} />)}</div>}
      </div>
      <div className="mt-4"><SectionHeader level={3} title="评测原因" description="点击原因可下钻对应 Task / Trace；原因来自各层评测器返回的失败维度。" /></div>
      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">{qualifiedLayers.map((layer) => <QualifiedProductLayer key={layer.id} layer={layer} expanded={qualifiedExpanded} onToggle={() => setQualifiedExpanded((value) => !value)} onOpen={() => navigateContext('/tasks', { params: { metric: layer.id === 'office' ? 'qualified-product-office' : 'qualified-product-other' } })} />)}</div>
    </Panel>

    <Panel labelledBy="process-efficiency-title">
      <SectionHeader id="process-efficiency-title" eyebrow="过程效率" title="过程效率" description="判断产物是否以符合业务预期的路径、时延和成本完成，与合格产物率独立计算。" meta={`达标 ${processEfficiency.targetMetProducts} · UNKNOWN ${processEfficiency.unknownProducts} · 全部产物 ${processEfficiency.allProducts}`} actions={<button type="button" aria-label={`${processExpanded ? '收起' : '展开'}过程效率子指标`} aria-expanded={processExpanded} aria-controls="process-efficiency-children" title={`${processExpanded ? '收起' : '展开'}过程效率子指标`} onClick={() => setProcessExpanded((value) => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', processExpanded && 'rotate-180')} /></button>} />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <OverviewMetricCard id={processEfficiency.id} label={processEfficiency.label} value={processEfficiency.value} trend={processEfficiency.trend} numerator={processEfficiency.numerator} denominator={processEfficiency.denominator} description="已建立业务预期且全部过程标准达标的产物比例" tone="info" featured onClick={() => openMetric(processEfficiency.id)} />
        <OverviewMetricCard id={outOfExpectation.id} label={outOfExpectation.label} value={outOfExpectation.value} trend={outOfExpectation.trend} numerator={outOfExpectation.numerator} denominator={outOfExpectation.denominator} description="过程效率未达标的产物数 / 全部产物数" tone="warn" featured onClick={() => openMetric(outOfExpectation.id)} />
      </div>
      {processExpanded && <div id="process-efficiency-children" className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{processEfficiency.children.map((metric) => <OverviewMetricCard key={metric.id} id={metric.id} label={metric.label} value={metric.value} trend={metric.trend} numerator={metric.pass} denominator={processEfficiency.denominator} description={processDescriptions[metric.id] ?? '过程效率子维度'} tone={metric.fail > 0 ? 'neutral' : 'pass'} onClick={() => openMetric(metric.id)} />)}</div>}
      <InlineNotice className="mt-3" tone="warn" title="口径说明">「过程效率不符业务预期率」的分母始终是当前全局筛选下的全部产物，包含不合格产物。</InlineNotice>
    </Panel>

    <Panel labelledBy="module-diagnostics-title">
      <SectionHeader id="module-diagnostics-title" eyebrow="模块诊断" title="模块诊断与首错归因" description="模块状态用于解释总指标，不作为新的质量总分。Context 和 Memory 只展示节点状态与证据，不作为一期正式 KPI。" actions={<OutcomeLegend />} />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{moduleDiagnostics.map((diagnostic) => <ModuleDiagnosticCard key={diagnostic.nodeType} nodeType={diagnostic.nodeType} status={diagnostic.status} stateCounts={diagnostic.stateCounts} evidenceCoverage={diagnostic.evidenceCoverage} firstFailureCount={diagnostic.firstFailureCount} derivedCount={diagnostic.derivedCount} onClick={() => {
        const rootCause = diagnosticRootCause[diagnostic.nodeType]
        navigateContext('/tasks', { params: rootCause ? { rootCause } : { metric: 'recovery-success' } })
      }} />)}</div>
      <div className="mt-5 border-t border-line pt-4">
        <SectionHeader level={3} eyebrow="首错归因" title="首个关键失败分布" description="每条 Trace 只计入一个首个非派生失败；下游 DERIVED_FAIL 保留证据但不重复计数。" />
        <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-2">{rootMetrics.map((metric) => <button type="button" key={metric.rootCause} onClick={() => navigateContext('/cases', { params: { rootCause: metric.rootCause } })} className="flex min-w-0 items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition hover:border-line hover:bg-slate-50"><span className="w-32 min-w-0 break-words text-[11px] leading-4 text-muted">{metric.rootCause}</span><span className="min-w-0 flex-1"><ProgressBar value={metric.percent} tone={metric.rootCause === 'Memory' ? 'warn' : 'fail'} /></span><span className="w-16 shrink-0 text-right text-xs font-semibold text-ink">{metric.count} · {metric.percent}%</span></button>)}</div>
      </div>
    </Panel>
  </div>
}

export function PerformancePage() {
  const { state } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [toolDrawer, setToolDrawer] = useState<string>()
  const tasks = filterTasks(state, state.filters)
  const latencies = tasks.map((task) => task.latency)
  const toolMetrics = getToolMetrics(state, state.filters)
  const modelMetrics = getModelMetrics(state, state.filters)
  const performance = getPerformanceMetrics(state, state.filters)
  const complexityData = COMPLEXITIES.map((complexity) => ({ label: complexity, value: tasks.filter((task) => task.complexity === complexity).length, median: tasks.filter((task) => task.complexity === complexity).sort((a, b) => a.latency - b.latency)[Math.floor(tasks.filter((task) => task.complexity === complexity).length / 2)]?.latency ?? 0 }))
  const selectedTool = toolMetrics.find((metric) => metric.tool === toolDrawer)
  return <div className="space-y-5">
    <PageIntro eyebrow="性能监控" title="性能监控" description="观察 Agent 是否变慢、变贵、变得不稳定，并把异常直接带回 Trace。" meta={<><span className="font-medium text-ink">{getScopeLabel(state.filters)}</span> · 复杂度来自 Eval Agent 判断</>} actions={<Button icon={ArrowRight} onClick={() => navigateContext('/tasks', { params: { status: 'FAIL' } })}>查看异常 Trace</Button>} />
    <Panel className="border-accent/25">
      <SectionHeader eyebrow="新版原始信号" title="效率、成本与稳定性" description="新口径保留原始信号；缺少 TTFT 或基线时明确显示 UNKNOWN，不推断通过。" />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric icon={Gauge} label="总时延效率" value={performance.totalLatencyEfficiency.status === 'UNKNOWN' ? 'UNKNOWN' : `${performance.totalLatencyEfficiency.rate.toFixed(1)}%`} tone={performance.totalLatencyEfficiency.status === 'FAIL' ? 'warn' : performance.totalLatencyEfficiency.status === 'PASS' ? 'pass' : 'neutral'} note="按业务预期时延达标" />
        <MiniMetric icon={Timer} label="TTFT" value={performance.ttft.averageMs === null ? 'UNKNOWN' : formatDuration(performance.ttft.averageMs)} note={performance.ttft.averageMs === null ? '基线未建立' : '可观测样本均值'} />
        <MiniMetric label="模型吞吐量" value={`${performance.throughput.tokensPerSecond.toLocaleString()} tok/s`} note="总 Token / 模型总耗时" />
        <MiniMetric label="成本基线偏离" value={performance.cost.deviation === null ? 'UNKNOWN' : `${performance.cost.deviation > 0 ? '+' : ''}${performance.cost.deviation}%`} tone={performance.cost.deviation !== null && performance.cost.deviation > 0 ? 'warn' : 'neutral'} note={`仅合格产物 ${performance.cost.evaluatedProducts} 个进入分母`} />
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="输入 / 输出 Token" value={`${performance.tokens.input.toLocaleString()} / ${performance.tokens.output.toLocaleString()}`} note={`总计 ${performance.tokens.total.toLocaleString()}`} />
        <MiniMetric label="缓存命中率" value={`${performance.cache.hitRate.toFixed(1)}%`} tone={performance.cache.hitRate > 0 ? 'pass' : 'neutral'} note={`${performance.cache.hits} 次命中 · ${performance.cache.misses} 次未命中`} />
        <MiniMetric label="Tool 调用频率" value={`${performance.toolFrequency.perTask.toFixed(2)} / Task`} note={`${performance.toolFrequency.calls} 次调用 · ${performance.toolFrequency.perSecond.toFixed(2)} / 秒`} />
        <MiniMetric label="一次 Tool 执行成功率" value={performance.oneShotSuccess.eligible ? `${performance.oneShotSuccess.rate.toFixed(1)}%` : 'N/A'} tone={performance.oneShotSuccess.rate > 80 ? 'pass' : 'warn'} note={`${performance.oneShotSuccess.successes}/${performance.oneShotSuccess.eligible}，不含 Retry/Recovery`} />
      </div>
      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-slate-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-ink">时延效率分档</p><span className="text-[10px] text-muted">实际 / 预期</span></div><div className="mt-3 grid grid-cols-2 gap-2">{performance.latencyBands.map((band) => <button key={band.band} type="button" onClick={() => navigateContext('/tasks', { params: { metric: 'latency-efficiency', latencyBand: band.band } })} className="rounded border border-line bg-white p-2 text-left hover:border-accent/50"><p className="text-[11px] font-medium text-ink">{band.band}</p><p className="mt-1 text-lg font-semibold text-ink">{band.count}</p><p className="text-[10px] text-muted">{band.rate.toFixed(1)}%</p></button>)}</div></div>
        <div className="rounded-md border border-line bg-slate-50/60 p-3"><p className="text-xs font-semibold text-ink">风控 / 商业化拦截</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => navigateContext('/tasks', { params: { metric: 'risk-interception' } })} className="rounded border border-fail/20 bg-fail/5 p-2 text-left"><p className="text-[11px] text-muted">风控拦截</p><p className="mt-1 text-lg font-semibold text-fail">{performance.risk.blocked}</p><p className="text-[10px] text-muted">{performance.risk.rate.toFixed(1)}% · {Object.keys(performance.risk.reasons).length} 个原因</p></button><button type="button" onClick={() => navigateContext('/tasks', { params: { metric: 'commercial-interception' } })} className="rounded border border-warn/20 bg-warn/5 p-2 text-left"><p className="text-[11px] text-muted">商业化拦截</p><p className="mt-1 text-lg font-semibold text-warn">{performance.commercial.blocked}</p><p className="text-[10px] text-muted">{performance.commercial.rate.toFixed(1)}% · {Object.keys(performance.commercial.reasons).length} 个原因</p></button></div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted">{[...Object.entries(performance.risk.reasons), ...Object.entries(performance.commercial.reasons)].map(([reason, count]) => <span key={reason} className="rounded bg-white px-2 py-1">{reason} · {count}</span>)}</div></div>
      </div>
    </Panel>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><MiniMetric icon={Clock3} label="P50 时延" value={formatDuration(latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)] ?? 0)} note="兼容视图" /><MiniMetric icon={Clock3} label="P90 时延" value={formatDuration(latencies[Math.floor(latencies.length * 0.9)] ?? 0)} note="兼容视图" /><MiniMetric icon={Timer} label="P95 时延" value={formatDuration(latencies[Math.floor(latencies.length * 0.95)] ?? 0)} tone="warn" note="异常点可下钻" /><MiniMetric icon={Gauge} label="Task 成本" value={formatCurrency(tasks.reduce((sum, task) => sum + task.cost, 0))} note="Mock Session 总成本" /></div>
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"><Panel><SectionHeader eyebrow="Task 性能" title="复杂度 × 实际时延" description="不使用硬阈值，保留 Eval Agent 复杂度判断和真实观察时延。" /><div className="mt-4"><BarChartView data={complexityData} labelKey="label" valueKey="median" height={250} valueFormatter={formatDuration} /><div className="mt-3 grid grid-cols-3 gap-2">{complexityData.map((item) => <MiniMetric key={item.label} label={item.label === 'Simple' ? '简单' : item.label === 'Medium' ? '中等' : '复杂'} value={item.value} note={`中位数 ${formatDuration(item.median)}`} />)}</div></div></Panel><Panel><SectionHeader eyebrow="调用量" title="调用与成本" description="用量信号与质量信号分栏呈现。" /><div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Token 用量" value={tasks.reduce((sum, task) => sum + task.tokens, 0).toLocaleString()} note="累计 Token" /><MiniMetric label="Model 调用次数" value={tasks.reduce((sum, task) => sum + task.modelCalls, 0)} note="模型调用" /><MiniMetric label="Tool 调用次数" value={tasks.reduce((sum, task) => sum + task.toolCalls, 0)} note="能力调用" /><MiniMetric label="Loop / Retry" value={`${tasks.reduce((sum, task) => sum + task.loopCount, 0)} / ${tasks.reduce((sum, task) => sum + task.retryCount, 0)}`} tone="warn" note="冗余与恢复" /></div></Panel></div>
    <Panel><SectionHeader eyebrow="Tool 性能" title="Tool 基线偏离" description="当前 P95 超过 rolling baseline 的 Tool 标记 Warning；点击行查看异常 Trace。" /><div className="mt-4 overflow-x-auto"><table className="data-table"><thead><tr><th>Tool</th><th>调用次数</th><th>失败率</th><th>P50</th><th>P95</th><th>7 日基线</th><th>14 日基线</th><th>偏离</th><th /></tr></thead><tbody>{toolMetrics.map((metric) => <tr key={metric.tool} className="cursor-pointer" onClick={() => setToolDrawer(metric.tool)}><td className="font-medium text-ink">{metric.tool}</td><td>{metric.calls}</td><td><StatusBadge status={`${metric.failureRate.toFixed(1)}%`} tone={metric.failed ? 'fail' : 'pass'} /></td><td>{formatDuration(metric.p50)}</td><td>{formatDuration(metric.p95)}</td><td>{formatDuration(metric.baseline7)}</td><td>{formatDuration(metric.baseline14)}</td><td><StatusBadge status={`${metric.deviation > 0 ? '+' : ''}${metric.deviation}%`} tone={metric.warning ? 'warn' : 'pass'} /></td><td><ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" /></td></tr>)}</tbody></table></div></Panel>
    <Panel><SectionHeader eyebrow="Model 性能" title="Model 调用" description="模型版本、Token、平均时延和失败/超时独立展示。" /><div className="mt-4 overflow-x-auto"><table className="data-table"><thead><tr><th>Model</th><th>调用次数</th><th>Token</th><th>平均时延</th><th>失败</th><th>超时</th><th>非必要调用</th></tr></thead><tbody>{modelMetrics.map((metric) => <tr key={metric.model}><td className="font-medium">{metric.model}</td><td>{metric.calls}</td><td>{metric.tokens.toLocaleString()}</td><td>{formatDuration(metric.latency)}</td><td className={metric.failures ? 'text-fail' : 'text-pass'}>{metric.failures}</td><td>{metric.timeouts}</td><td>{metric.unnecessaryRate.toFixed(1)}%</td></tr>)}</tbody></table></div></Panel>
    <Drawer open={Boolean(selectedTool)} onClose={() => setToolDrawer(undefined)} title={selectedTool ? `${selectedTool.tool} anomaly` : ''} description="异常窗口详情与可追溯的 Trace 入口" footer={selectedTool && <Button variant="primary" icon={ArrowRight} onClick={() => { navigateContext('/tasks', { params: { anomalyTool: selectedTool.tool, anomalyWindow: 'current', status: 'FAIL' } }); setToolDrawer(undefined) }}>查看全部异常 Trace</Button>}><div className="space-y-4">{selectedTool && <><InlineNotice tone={selectedTool.warning ? 'warn' : 'pass'} title={selectedTool.warning ? 'P95 高于 rolling baseline' : 'Baseline stable'}>当前 {formatDuration(selectedTool.p95)} · 7d baseline {formatDuration(selectedTool.baseline7)} · deviation {selectedTool.deviation}%</InlineNotice><div className="grid grid-cols-2 gap-2"><MiniMetric label="异常 Trace" value={selectedTool.anomalyCount} tone="warn" /><MiniMetric label="Highest latency" value={selectedTool.highestLatencyTaskId ? shortId(selectedTool.highestLatencyTaskId) : '—'} /></div><div><h3 className="text-xs font-semibold text-ink">Top Tool Errors</h3><ul className="mt-2 space-y-2 text-xs text-muted">{selectedTool.topErrors.map((error) => <li key={error} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-fail" />{error}</li>)}</ul></div></>}</div></Drawer>
  </div>
}

function TraceTimeline({ taskId, onObservation }: { taskId: string; onObservation: (observation: Observation) => void }) {
  const { state } = useQuality()
  const task = state.tasks.find((candidate) => candidate.id === taskId)
  const trace = getTraceByTask(state, taskId)
  if (!task || !trace) return <EmptyState title="Trace 不可用" description="该 Task 没有关联 Trace。" />
  const firstFailure = getFirstFailure(state, task)
  return <div className="trace-timeline">{trace.observations.map((observation) => { const isFirst = observation.id === firstFailure?.id; return <button type="button" key={observation.id} onClick={() => onObservation(observation)} className={cn('trace-node', observation.status === 'FAIL' && 'trace-node--fail', observation.derived && 'trace-node--derived')}><span className="trace-node-rail"><span className={cn('trace-node-dot', observation.status === 'FAIL' ? observation.derived ? 'trace-node-dot--derived' : 'trace-node-dot--fail' : 'trace-node-dot--pass')} /></span><span className="trace-node-body"><span className="flex flex-wrap items-center gap-2"><strong>{observation.nodeType}</strong><StatusBadge status={observation.status} /><span className="text-[10px] text-muted">{formatDuration(observation.latency)}</span>{isFirst && <StatusBadge status="First Failure / Root Cause" tone="fail" showIcon={false} />}{observation.derived && <StatusBadge status="Derived Failure" tone="derived" showIcon={false} />}</span><span className="mt-1 block truncate text-[11px] text-muted">{observation.output}</span><span className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400"><span>{observation.model ?? observation.tool ?? 'runtime'}</span><span>{observation.evidenceIds.length} evidence</span></span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" /></button> })}</div>
}

function EvalRow({ evaluation, evidence, onEvidence, onOverride }: { evaluation: EvalResult; evidence: readonly Evidence[]; onEvidence: (id: string) => void; onOverride: (evaluation: EvalResult) => void }) {
  const effective = effectiveEvalStatus(evaluation)
  const disagreement = evaluation.humanStatus && evaluation.humanStatus !== evaluation.autoStatus
  const evidenceItems = evaluation.evidenceIds.map((id) => evidence.find((item) => item.id === id)).filter((item): item is Evidence => Boolean(item))
  const rubricItems = evaluation.rubricEvidence ?? []
  return <div className="rounded-md border border-line bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="truncate text-xs font-semibold text-ink">{evaluation.dimension}</span><StatusBadge status={effective} /></div><div className="flex items-center gap-2">{disagreement && <StatusBadge status="Eval Disagreement" tone="warn" showIcon={false} />}<Button size="sm" onClick={() => onOverride(evaluation)} icon={SlidersHorizontal}>人工标注</Button></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">LLM Judge reason</p><p className="mt-1 break-words text-xs leading-5 text-ink">{evaluation.reason ?? evaluation.humanReason ?? evaluation.autoReason}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Score</p><p className="mt-1 font-mono text-xs text-ink">{evaluation.score === undefined ? 'UNKNOWN' : `${(evaluation.score * 100).toFixed(0)}%`}</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Root evidence</p>{evidenceItems.length ? <div className="mt-1 space-y-1">{evidenceItems.map((item) => <button type="button" key={item.id} onClick={() => onEvidence(item.id)} className="block w-full break-words rounded border border-accent/15 bg-accent/5 px-2 py-1.5 text-left text-[11px] text-accent hover:border-accent/40"><span className="font-mono">{item.id}</span><span className="ml-1 text-slate-600">{item.summary}</span></button>)}</div> : <p className="mt-1 text-[11px] text-slate-400">No root evidence linked.</p>}</div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Rubric rule</p>{rubricItems.length ? <div className="mt-1 space-y-1">{rubricItems.map((item) => <div key={item.id} className="rounded border border-line bg-slate-50/70 px-2 py-1.5 text-[11px] text-ink"><p>{item.requirement ?? item.summary}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{item.id}{item.evidenceId ? ` · ${item.evidenceId}` : ''}</p></div>)}</div> : <p className="mt-1 text-[11px] text-slate-400">No rubric rule linked.</p>}</div></div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>Auto: {evaluation.autoStatus}</span>{evaluation.humanStatus && <span>Human: {evaluation.humanStatus} · {evaluation.humanBy}</span>}<span>Judge: {evaluation.judgeVersion}</span></div></div>
}

function ObservationDetails({ observation, evidence = [], onClose }: { observation?: Observation; evidence?: readonly Evidence[]; onClose: () => void }) {
  const rubricItems = observation?.rubricEvidence ?? observation?.judgeResult?.rubricEvidence ?? []
  const linkedEvidence = observation ? observation.evidenceIds.map((id) => evidence.find((item) => item.id === id)).filter((item): item is Evidence => Boolean(item)) : []
  return <Drawer open={Boolean(observation)} onClose={onClose} title={observation?.nodeType ?? ''} description={observation ? `${observation.id} · sequence ${observation.sequence}` : ''}><div className="space-y-4">{observation && <><div className="flex flex-wrap gap-2"><StatusBadge status={observation.judgeStatus ?? observation.status} />{observation.isRootCause && <StatusBadge status="is_root_cause" tone="fail" showIcon={false} />}{observation.derived && <StatusBadge status="Derived Failure" tone="derived" showIcon={false} />}</div><div className="grid grid-cols-2 gap-2"><MiniMetric label="Latency" value={formatDuration(observation.latency)} /><MiniMetric label="Model / Tool" value={observation.model ?? observation.tool ?? '—'} /><MiniMetric label="Token" value={observation.tokenUsage?.toLocaleString() ?? '—'} /><MiniMetric label="Score" value={observation.score === undefined ? 'UNKNOWN' : `${(observation.score * 100).toFixed(0)}%`} /></div><div><h3 className="text-xs font-semibold text-ink">LLM Judge reason</h3><p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink">{observation.reason ?? observation.judgeResult?.reason ?? 'UNKNOWN: no local reason recorded'}</p></div>{(['input', 'output', 'error'] as const).map((key) => <div key={key}><h3 className="text-xs font-semibold capitalize text-ink">{key}</h3><pre className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-[11px] leading-5 text-muted">{observation[key] ?? '未记录'}</pre></div>)}<div><h3 className="text-xs font-semibold text-ink">Root evidence</h3>{linkedEvidence.length ? <div className="mt-1 space-y-1">{linkedEvidence.map((item) => <div key={item.id} className="rounded border border-accent/15 bg-accent/5 p-2 text-[11px]"><span className="font-mono text-accent">{item.id}</span><span className="ml-1 text-ink">{item.summary}</span><p className="mt-0.5 text-[10px] text-muted">Source observation: {item.observationId ?? '—'}</p></div>)}</div> : <p className="mt-1 text-[11px] text-slate-400">No root evidence linked.</p>}</div><div><h3 className="text-xs font-semibold text-ink">Rubric rule</h3>{rubricItems.length ? <div className="mt-1 space-y-1">{rubricItems.map((item) => <div key={item.id} className="rounded border border-line bg-slate-50 p-2 text-[11px]"><p className="text-ink">{item.requirement ?? item.summary}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{item.id}{item.evidenceId ? ` · evidence ${item.evidenceId}` : ''}</p></div>)}</div> : <p className="mt-1 text-[11px] text-slate-400">No rubric rule linked.</p>}</div><div><h3 className="text-xs font-semibold text-ink">Metadata</h3><dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-slate-50 p-3 text-[11px]">{Object.entries(observation.metadata).map(([key, value]) => <div key={key}><dt className="text-slate-400">{key}</dt><dd className="mt-0.5 text-ink">{value}</dd></div>)}</dl></div></>}</div></Drawer>
}

function SessionConversationDrawer({ open, sessionId, tasks, onClose, onOpenTask }: { open: boolean; sessionId: string; tasks: Task[]; onClose: () => void; onOpenTask: (task: Task) => void }) {
  const orderedTasks = [...tasks].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
  return (
    <Drawer open={open} onClose={onClose} width="lg" title="Session 对话" description={`${sessionId} · ${orderedTasks.length} 个 Query / Trace`}>
      <div className="space-y-4">
        <InlineNotice tone="info" title="Session 上下文">按时间顺序查看用户与 Agent 的完整对话。每个 Query 都关联一条 Trace，便于从上下文回到具体执行链路。</InlineNotice>
        {orderedTasks.length ? <div className="space-y-3">{orderedTasks.map((item, index) => <div key={item.id} className="space-y-2">
          <div className="flex items-start gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" /><div className="min-w-0 flex-1 rounded-md border border-accent/20 bg-accent/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-accent">用户</span><Button size="sm" icon={ArrowRight} onClick={() => onOpenTask(item)}>Trace {item.traceId}</Button></div><p className="mt-1 break-words text-xs leading-5 text-ink">{item.query}</p><p className="mt-1 font-mono text-[10px] text-muted">{humanDate(item.timestamp)} · {item.id}</p></div></div>
          <div className="ml-5 flex items-start gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pass" /><div className="min-w-0 flex-1 rounded-md border border-line bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-pass">Agent</p><p className="mt-1 break-words text-xs leading-5 text-ink">{item.finalOutcome}</p><p className="mt-1 text-[10px] text-muted">{item.agentVersion} · {item.businessType} · {item.complexity === 'Simple' ? '简单' : item.complexity === 'Medium' ? '中等' : '复杂'}</p></div></div>
          {index < orderedTasks.length - 1 && <div className="ml-1 h-3 border-l border-dashed border-slate-300" />}
        </div>)}</div> : <EmptyState title="暂无 Session Query" description="该 Session 暂无可关联的 Task / Trace。" />}
      </div>
    </Drawer>
  )
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, dispatch } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [observation, setObservation] = useState<Observation>()
  const [sessionOpen, setSessionOpen] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<EvalResult>()
  const [overrideStatus, setOverrideStatus] = useState<'PASS' | 'FAIL'>('PASS')
  const [overrideReason, setOverrideReason] = useState('人工复核确认。')
  const trace = getTraceByTask(state, task.id)
  const caseRecord = state.cases.find((record) => record.taskId === task.id)
  const saveOverride = () => { if (!overrideTarget) return; dispatch({ type: 'OVERRIDE_EVAL', taskId: task.id, evalId: overrideTarget.id, status: overrideStatus, reason: overrideReason, by: 'Quality Reviewer' }); setOverrideTarget(undefined) }
  const confirmCase = () => { if (!caseRecord) return; dispatch({ type: 'UPDATE_CASE', caseId: caseRecord.id, patch: { status: 'Confirmed Badcase', rootCause: task.rootCause, firstFailureNode: getFirstFailure(state, task)?.nodeType ?? null, severity: caseRecord.severity, owner: caseRecord.owner, note: caseRecord.note } }) }
  return <><Drawer open={Boolean(task)} onClose={onClose} width="lg" title={`Task ${shortId(task.id)}`} description={`${task.traceId} · ${task.sessionId} · ${humanDate(task.timestamp)}`} footer={<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusBadge status={task.status} /><StatusBadge status={task.rootCause === 'None' ? '无 Root Cause' : task.rootCause} tone={rootCauseTone(task.rootCause)} showIcon={false} /></div>{caseRecord && <Button variant={caseRecord.status === 'Confirmed Badcase' ? 'secondary' : 'danger'} icon={ShieldCheck} onClick={confirmCase}>{caseRecord.status === 'Confirmed Badcase' ? '已确认 Badcase' : '确认 Badcase'}</Button>}</div>}><div className="space-y-5"><div className="grid grid-cols-2 gap-2 md:grid-cols-5"><MiniMetric label="业务类型" value={task.businessType} /><MiniMetric label="交付类型" value={task.outcomeType} /><MiniMetric label="复杂度" value={task.complexity === 'Simple' ? '简单' : task.complexity === 'Medium' ? '中等' : '复杂'} /><MiniMetric label="时延" value={formatDuration(task.latency)} tone={task.latency > 7000 ? 'warn' : 'neutral'} /><button type="button" onClick={() => setSessionOpen(true)} aria-label={`查看 Session ${task.sessionId}`} className="min-w-0 rounded-md border border-accent/20 bg-accent/5 p-3 text-left hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="block text-[10px] text-muted">Session</span><span className="mt-1 block truncate font-mono text-[11px] text-accent">{task.sessionId}</span><span className="mt-1 block text-[10px] text-accent">查看完整对话</span></button></div><Panel><SectionHeader level={3} eyebrow="Task 输入" title="原始 Query" /><p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink">{task.query}</p><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-muted md:grid-cols-4"><span><b className="text-slate-400">Agent</b><br />{task.agentVersion}</span><span><b className="text-slate-400">环境</b><br />{task.environment}</span><span><b className="text-slate-400">Skill</b><br />{task.skill}</span><span><b className="text-slate-400">最终结果</b><br />{task.finalOutcome}</span></div></Panel><Panel><SectionHeader level={3} eyebrow="结果 Eval" title="结果评测" description="自动评测与人工标签并排保留。" /><div className="mt-3 grid gap-2">{task.evals.map((evaluation) => <EvalRow key={evaluation.id} evaluation={evaluation} evidence={state.evidence} onEvidence={(evidenceId) => { const item = state.evidence.find((candidate) => candidate.id === evidenceId); const obs = state.observations.find((candidate) => candidate.id === item?.observationId); setObservation(obs) }} onOverride={(evaluation) => { setOverrideTarget(evaluation); setOverrideStatus(effectiveEvalStatus(evaluation) === 'FAIL' ? 'FAIL' : 'PASS'); setOverrideReason(evaluation.humanReason ?? '人工复核确认。') }} />)}</div></Panel><Panel><SectionHeader level={3} eyebrow="Trace 时间线" title="执行路径与首个失败" description="点击节点打开 Observation Details。" /><div className="mt-3"><SharedTraceTimeline trace={trace} evidence={state.evidence} onObservationClick={setObservation} onEvidenceClick={(evidenceItem, observationItem) => { setObservation(observationItem ?? state.observations.find((candidate) => candidate.id === evidenceItem.observationId)) }} /></div></Panel></div></Drawer><ObservationDetails observation={observation} evidence={state.evidence} onClose={() => setObservation(undefined)} /><SessionConversationDrawer open={sessionOpen} sessionId={task.sessionId} tasks={state.tasks.filter((item) => item.sessionId === task.sessionId)} onClose={() => setSessionOpen(false)} onOpenTask={(item) => { setSessionOpen(false); navigateContext('/tasks', { params: { taskId: item.id, traceId: item.traceId } }) }} /><Modal open={Boolean(overrideTarget)} onClose={() => setOverrideTarget(undefined)} title={`人工 Override · ${overrideTarget?.dimension ?? ''}`} description="自动结果不会被删除；人工结论会作为当前有效标签。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setOverrideTarget(undefined)}>取消</Button><Button variant="primary" onClick={saveOverride}>保存 Override</Button></div>}><div className="space-y-4"><Field label="人工结论" required><SelectInput value={overrideStatus} onChange={(event) => setOverrideStatus(event.target.value as 'PASS' | 'FAIL')}><option value="PASS">PASS</option><option value="FAIL">FAIL</option></SelectInput></Field><Field label="人工 Note" required><TextArea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /></Field><InlineNotice tone="info">Auto Eval: {overrideTarget?.autoStatus} · {overrideTarget?.autoReason}</InlineNotice></div></Modal></>
}

const taskColumns = (onOpen: (task: Task) => void): Column<Task>[] => [
  { key: 'id', header: 'Task / Trace', accessor: (task) => <div><div className="font-semibold text-ink">{shortId(task.id)}</div><div className="mt-1 truncate text-[10px] text-slate-400">{task.traceId}</div></div> },
  { key: 'query', header: 'Query', accessor: (task) => <span className="line-clamp-2 text-xs">{task.query}</span> },
  { key: 'outcomeType', header: 'Outcome', accessor: (task) => <span className="text-[11px]">{task.outcomeType}</span> },
  { key: 'status', header: 'Status', accessor: (task) => <StatusBadge status={task.status} /> },
  { key: 'complexity', header: 'Complexity', accessor: (task) => <span className="text-[11px]">{task.complexity}</span> },
  { key: 'rootCause', header: 'Root Cause', accessor: (task) => <StatusBadge status={task.rootCause === 'None' ? '—' : task.rootCause} tone={rootCauseTone(task.rootCause)} showIcon={false} /> },
  { key: 'latency', header: 'Latency', accessor: (task) => <span className={cn('font-medium', task.latency > 7000 && 'text-warn')}>{formatDuration(task.latency)}</span> },
  { key: 'timestamp', header: 'Time', accessor: (task) => <span className="text-[11px] text-muted">{humanDate(task.timestamp)}</span> },
  { key: 'actions', header: '', accessor: (task) => <Button variant="ghost" icon={ArrowRight} onClick={(event) => { event.stopPropagation(); onOpen(task) }}>Open</Button> }
]

export function TasksPage() {
  const { state, dispatch } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId') ?? undefined
  const task = state.tasks.find((candidate) => candidate.id === taskId)
  const tasks = filterTasks(state, state.filters)
  const controls: FilterControl[] = [
    { id: 'status', label: '状态', value: state.filters.status ?? '', options: [{ value: 'PASS', label: 'PASS' }, { value: 'FAIL', label: 'FAIL' }, ...(['Effective', 'Effective but Inefficient', 'Failed'] as const).map((value) => ({ value, label: value === 'Effective' ? '有效' : value === 'Effective but Inefficient' ? '有效但低效' : '失败' }))], onChange: (value) => dispatch({ type: 'SET_FILTERS', filters: { status: (value || undefined) as FilterState['status'] } }) },
    { id: 'business', label: '业务类型', value: state.filters.businessType === 'All' ? '' : state.filters.businessType, options: BUSINESS_TYPES.filter((value) => value !== 'All').map((value) => ({ value, label: value })), onChange: (value) => dispatch({ type: 'SET_FILTERS', filters: { businessType: (value || 'All') as FilterState['businessType'] } }) },
    { id: 'complexity', label: '复杂度', value: state.filters.complexity ?? '', options: COMPLEXITIES.map((value) => ({ value, label: value === 'Simple' ? '简单' : value === 'Medium' ? '中等' : '复杂' })), onChange: (value) => dispatch({ type: 'SET_FILTERS', filters: { complexity: (value || undefined) as FilterState['complexity'] } }) },
    { id: 'rootCause', label: 'Root Cause', value: state.filters.rootCause ?? '', options: ROOT_CAUSES.filter((value) => value !== 'None').map((value) => ({ value, label: value })), onChange: (value) => dispatch({ type: 'SET_FILTERS', filters: { rootCause: (value || undefined) as FilterState['rootCause'] } }) },
    { id: 'badcase', label: 'Badcase', value: state.filters.badcase ?? '', options: [{ value: 'yes', label: '是' }, { value: 'no', label: '否' }], onChange: (value) => dispatch({ type: 'SET_FILTERS', filters: { badcase: (value || undefined) as FilterState['badcase'] } }) }
  ]
  const reset = () => dispatch({ type: 'RESET_FILTERS' })
  const openTask = (selected: Task) => navigateContext('/tasks', { params: { taskId: selected.id } })
  return <div className="space-y-4"><PageIntro eyebrow="Task / Trace 工作台" title="Task / Trace" description="从任务结果、Eval Evidence 到逐节点 Trace 的治理工作台。" meta={<><span className="font-medium text-ink">{tasks.length}</span> 条记录 · 搜索和筛选状态会保留在 URL</>} actions={<Button variant="secondary" icon={FilterX} onClick={reset}>清除筛选</Button>} /><FilterBar title="Task 筛选" controls={controls} searchValue={state.filters.search} onSearchChange={(value) => dispatch({ type: 'SET_FILTERS', filters: { search: value } })} resultCount={tasks.length} onReset={reset} searchPlaceholder="搜索 task_id / trace_id / query" /><div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted"><OutcomeLegend /><span>{state.filters.metric ? `指标筛选：${state.filters.metric}` : '可从 KPI / 异常点直接下钻'}</span></div><DataTable columns={taskColumns(openTask)} rows={tasks} rowKey={(row) => row.id} onRowClick={openTask} selectedRowId={taskId} empty={<EmptyState icon={Search} title="没有匹配的 Task / Trace" description="尝试清除某个筛选，或搜索 task_id、trace_id 和 query。" />} />{task && <TaskDetail task={task} onClose={() => navigateContext('/tasks', { clear: ['taskId', 'traceId'] })} />}</div>
}

type ConfigView = EvalConfig & { autoReason: string; evalType?: string; threshold?: number }
function ConfigGroup({ title, family, configs, enabled, onToggle, onSelect }: { title: string; family: string; configs: ConfigView[]; enabled: Record<string, boolean>; onToggle: (id: string, value: boolean) => void; onSelect?: (config: ConfigView) => void }) {
  return <Panel><SectionHeader level={3} eyebrow={family} title={title} description="保留版本、规则来源和证据契约，不混合成一个总分。" /><div className="mt-3 divide-y divide-slate-100">{configs.map((config) => <div key={config.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-[210px] flex-1"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-ink">{config.dimension}</span><StatusBadge status={enabled[config.id] ? 'Enabled' : 'Disabled'} showIcon={false} /></div><p className="mt-1 text-[11px] text-muted">{config.autoReason}</p></div><span className="text-[11px] text-muted">{config.evalType ?? 'LLM-as-Judge'}</span><span className="text-[11px] text-muted">{config.rubricVersion}</span><span className="text-[11px] text-muted">threshold {((config.threshold ?? 0.86) * 100).toFixed(0)}%</span><Button variant="ghost" icon={FileCheck2} onClick={() => onSelect?.(config)}>Details</Button><Toggle checked={enabled[config.id] ?? true} onChange={(value) => onToggle(config.id, value)} label={enabled[config.id] ? 'Active' : 'Off'} /></div>)}</div></Panel>
}

export function EvaluationConfigPage() {
  const { state } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(state.evalConfigs.map((config) => [config.id, config.enabled])))
  const [selectedConfig, setSelectedConfig] = useState<ConfigView>()
  const [rubricVersion, setRubricVersion] = useState<'current' | 'previous'>('current')
  const resultConfigs = state.evalConfigs.filter((config) => config.family === 'Result Eval').map((config) => ({ ...config, autoReason: config.description, evalType: config.evalType, threshold: config.threshold }))
  const processConfigs = state.evalConfigs.filter((config) => config.family === 'Process Eval').map((config) => ({ ...config, autoReason: config.evidenceRequirement || 'Evidence requirement missing', evalType: config.evalType, threshold: config.threshold }))
  const performanceConfigs = state.evalConfigs.filter((config) => config.family === 'Performance Metric').map((config) => ({ ...config, autoReason: config.description, evalType: config.evalType, threshold: config.threshold }))
  const invalidProcess = processConfigs.filter((config) => enabled[config.id] && !config.evidenceRequirement)
  const duplicateDimensions = state.evalConfigs.filter((config, index, configs) => enabled[config.id] && configs.findIndex((candidate) => candidate.family === config.family && candidate.dimension === config.dimension) !== index)
  return <div className="space-y-5"><PageIntro eyebrow="EVALUATION CONFIG" title="评测配置" description="把结果评测、过程评测和性能指标分开配置，并保留 Evidence / Rubric 版本。" actions={<Button variant="primary" icon={FileCheck2} disabled={Boolean(invalidProcess.length || duplicateDimensions.length)}>设为 Active</Button>} />{(invalidProcess.length || duplicateDimensions.length) ? <InlineNotice tone="warn" title="配置需要修正">{invalidProcess.length ? `${invalidProcess.length} 个 Process Eval 缺少 Evidence Requirement。` : ''}{duplicateDimensions.length ? ' 存在重复启用的维度定义。' : ''}</InlineNotice> : <InlineNotice tone="pass" title="Active configuration healthy">当前配置可用于 Benchmark，Rubric Version: rubric-2026.08。</InlineNotice>}<div className="grid gap-4 xl:grid-cols-2"><ConfigGroup title="结果评测维度" family="RESULT EVAL" configs={resultConfigs} enabled={enabled} onToggle={(id, value) => setEnabled((current) => ({ ...current, [id]: value }))} onSelect={setSelectedConfig} /><ConfigGroup title="过程评测维度" family="PROCESS EVAL" configs={processConfigs} enabled={enabled} onToggle={(id, value) => setEnabled((current) => ({ ...current, [id]: value }))} onSelect={setSelectedConfig} /></div><ConfigGroup title="性能指标" family="PERFORMANCE METRIC" configs={performanceConfigs} enabled={enabled} onToggle={(id, value) => setEnabled((current) => ({ ...current, [id]: value }))} onSelect={setSelectedConfig} /><Panel><SectionHeader level={3} eyebrow="RUBRIC VERSION" title="版本与证据要求" description="Benchmark 会记录运行时使用的确切 Rubric Version。" actions={<><Tabs aria-label="Rubric versions" variant="pill" items={[{ id: 'current', label: 'Current' }, { id: 'previous', label: 'Previous' }]} activeId={rubricVersion} onChange={(id) => setRubricVersion(id as 'current' | 'previous')} /><Button icon={GitCompareArrows} onClick={() => navigateContext('/benchmarks')}>查看 Benchmark 引用</Button></>} /><div className="mt-3 grid gap-3 md:grid-cols-3"><MiniMetric label={rubricVersion === 'current' ? 'Current' : 'Previous'} value={rubricVersion === 'current' ? 'rubric-2026.08' : 'rubric-2026.07'} note={rubricVersion === 'current' ? '12 enabled rules' : '7 changed dimensions'} /><MiniMetric label="Compared with" value={rubricVersion === 'current' ? 'rubric-2026.07' : 'rubric-2026.08'} note="Immutable history" /><MiniMetric label="Evidence coverage" value={rubricVersion === 'current' ? '94%' : '88%'} tone="pass" note="Result + Process" /></div>{rubricVersion === 'previous' && <div className="mt-3 rounded-md border border-warn/25 bg-warn/5 p-3 text-xs text-warn">Previous rubric changed Planning / Decision threshold from 82% to 80%, and now uses Context evidence as supporting input rather than a standalone metric.</div>}<div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-slate-50 p-3"><div><p className="text-xs font-semibold text-ink">View Exceptions</p><p className="mt-1 text-[11px] text-muted">直接进入对应失败 Trace，并预选该评测维度。</p></div><Button variant="secondary" icon={ArrowRight} onClick={() => navigateContext('/tasks', { params: { status: 'FAIL', metric: 'Planning / Decision' } })}>查看异常</Button></div></Panel><Drawer open={Boolean(selectedConfig)} onClose={() => setSelectedConfig(undefined)} title={selectedConfig?.dimension ?? ''} description={`${selectedConfig?.family ?? ''} · ${selectedConfig?.rubricVersion ?? ''}`}><div className="space-y-4">{selectedConfig && <><div className="grid grid-cols-2 gap-2"><MiniMetric label="Eval Type" value={selectedConfig.evalType} /><MiniMetric label="Threshold" value={`${((selectedConfig.threshold ?? 0) * 100).toFixed(0)}%`} /><MiniMetric label="Judge Version" value={selectedConfig.judgeVersion ?? '—'} /><MiniMetric label="Enabled" value={enabled[selectedConfig.id] ? 'Yes' : 'No'} /></div><div><h3 className="text-xs font-semibold text-ink">Prompt</h3><pre className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-[11px] leading-5 text-muted">{selectedConfig.prompt ?? 'Not recorded'}</pre></div><div><h3 className="text-xs font-semibold text-ink">Evidence Requirement</h3><p className="mt-1 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted">{selectedConfig.evidenceRequirement || 'Missing evidence requirement'}</p></div></>}</div></Drawer></div>
}

export { ObservationDetails, TaskDetail, TraceTimeline }
