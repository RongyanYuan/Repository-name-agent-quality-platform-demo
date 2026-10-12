import { ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { SectionHeader, Sparkline, StatusBadge, cn } from '../../ui'
import type { EvolutionState, OutcomeEval, TraceEvaluationModuleCode } from '../domain'

type OpenDetail = (caseIds: string[], params?: Record<string, string>) => void

const MODULES: Array<{ code: TraceEvaluationModuleCode; label: string }> = [
  { code: 'REASON', label: 'Reason' }, { code: 'MEMORY', label: '记忆' },
  { code: 'SKILL', label: 'skill' }, { code: 'ACT', label: 'Act' },
  { code: 'TOOL', label: 'Tool' }, { code: 'OUTCOME', label: 'Outcome / 产物' }
]
const FIVE_STATES = ['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A'] as const
const OFFICE_KINDS = new Set(['PPT', 'Excel', 'Word'])

/** Dates come from the scoped Mock records; zero means no sample that day. */
function sevenDayCounts(rows: Array<{ createdAt: string }>, referenceDate: string): number[] {
  const end = Date.parse(referenceDate)
  if (!Number.isFinite(end)) return [0, 0, 0, 0, 0, 0, 0]
  const start = Math.floor(end / 86_400_000) - 6
  return Array.from({ length: 7 }, (_, offset) => rows.filter((row) => Math.floor(Date.parse(row.createdAt) / 86_400_000) === start + offset).length)
}

function Metric({ label, value, details, counts, tone = 'neutral', onClick }: {
  label: string; value: string; details: ReactNode; counts: number[];
  tone?: 'neutral' | 'info' | 'pass' | 'fail' | 'warn'; onClick?: () => void
}) {
  const content = <>
    <div className="flex min-w-0 items-start justify-between gap-2"><span className="min-w-0 break-words text-xs font-semibold leading-5 text-ink">{label}</span>{onClick && <span aria-hidden="true" className="shrink-0 text-[11px] text-accent">查看 →</span>}</div>
    <p className={cn('mt-2 break-words text-2xl font-semibold tracking-tight', tone === 'info' && 'text-accent', tone === 'pass' && 'text-pass', tone === 'fail' && 'text-fail', tone === 'warn' && 'text-warn', tone === 'neutral' && 'text-ink')}>{value}</p>
    <div className="mt-2 min-h-8 text-[11px] leading-4 text-muted">{details}</div>
    <p className="mt-3 text-[10px] text-slate-400">近 7 日样本量趋势（非指标率）</p>
    <Sparkline values={counts} color={tone === 'fail' ? '#c43d4b' : tone === 'warn' ? '#bd6b13' : '#1d5fd1'} label={`${label} 7 日趋势`} />
  </>
  return onClick ? <button type="button" aria-label={`${label} ${value}`} onClick={onClick} className="min-w-0 rounded-lg border border-line bg-white p-3 text-left shadow-panel transition hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{content}</button> : <div className="min-w-0 rounded-lg border border-line bg-white p-3 shadow-panel">{content}</div>
}

function Panel({ title, eyebrow, description, toggleLabel, expanded, onToggle, children, className = '' }: {
  title: string; eyebrow: string; description: string; toggleLabel: string;
  expanded: boolean; onToggle: () => void; children: ReactNode; className?: string
}) {
  return <section className={cn('min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel', className)}>
    <SectionHeader eyebrow={eyebrow} title={title} description={description} actions={<button type="button" aria-label={`${expanded ? '收起' : '展开'}${toggleLabel}子指标`} aria-expanded={expanded} onClick={onToggle} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} /></button>} />
    {children}
  </section>
}

function outcomeForArtifact(state: EvolutionState, artifactId: string): OutcomeEval[] {
  return state.outcomeEvals.filter((evaluation) => evaluation.artifactId === artifactId)
}

function layerStats(state: EvolutionState, office: boolean) {
  const artifacts = state.artifacts.filter((artifact) => OFFICE_KINDS.has(artifact.kind) === office)
  const outcomes = artifacts.flatMap((artifact) => outcomeForArtifact(state, artifact.id))
  const passIds = artifacts.filter((artifact) => {
    const evaluations = outcomeForArtifact(state, artifact.id)
    return evaluations.length > 0 && evaluations.every((evaluation) => evaluation.verdict === 'PASS') && artifact.status === 'AVAILABLE'
  }).map((artifact) => artifact.id)
  const failIds = artifacts.filter((artifact) => artifact.status === 'INVALID' || artifact.status === 'MISSING' || outcomeForArtifact(state, artifact.id).some((evaluation) => evaluation.verdict === 'FAIL')).map((artifact) => artifact.id)
  const unknownCount = Math.max(0, artifacts.length - new Set([...passIds, ...failIds]).size)
  const scores = outcomes.map((evaluation) => evaluation.score).filter((value): value is number => typeof value === 'number')
  return { artifacts, outcomes, passIds, failIds, unknownCount, averageScore: scores.length ? scores.reduce((total, value) => total + value, 0) / scores.length : null }
}

export function OverviewQualitySections({ state, onOpenCases, onOpenEvaluations, onOpenModule }: {
  state: EvolutionState; onOpenCases: OpenDetail;
  onOpenEvaluations: (params: Record<string, string>) => void;
  onOpenModule: (moduleCode: string) => void
}) {
  const [satisfactionOpen, setSatisfactionOpen] = useState(true)
  const [qualifiedOpen, setQualifiedOpen] = useState(true)
  const [processOpen, setProcessOpen] = useState(true)
  const [moduleOpen, setModuleOpen] = useState(true)
  const maxCaseAt = state.cases.reduce((latest, item) => Date.parse(item.createdAt) > Date.parse(latest) ? item.createdAt : latest, '1970-01-01T00:00:00.000Z')
  const caseTrend = useMemo(() => sevenDayCounts(state.cases, maxCaseAt), [state.cases, maxCaseAt])
  const artifactTrend = useMemo(() => sevenDayCounts(state.artifacts, maxCaseAt), [state.artifacts, maxCaseAt])
  const packageTrend = useMemo(() => sevenDayCounts(state.tracePackages, maxCaseAt), [state.tracePackages, maxCaseAt])
  const office = layerStats(state, true)
  const other = layerStats(state, false)
  const allArtifacts = state.artifacts.length
  const acceptanceArtifacts = state.cases.flatMap((record) => record.artifactIds.map((artifactId) => ({ artifactId, status: record.acceptanceStatus ?? 'UNKNOWN' as const })))
  const acceptedArtifacts = acceptanceArtifacts.filter((item) => item.status === 'ACCEPTED').length
  const rejectedArtifacts = acceptanceArtifacts.filter((item) => item.status === 'REJECTED').length
  const unknownAcceptanceArtifacts = acceptanceArtifacts.filter((item) => item.status === 'UNKNOWN').length
  const qualifiedCount = office.passIds.length + other.passIds.length
  const unknownProducts = office.unknownCount + other.unknownCount
  const qualifiedRate = allArtifacts && !unknownProducts ? `${(qualifiedCount / allArtifacts * 100).toFixed(1)}%` : 'UNKNOWN'
  const processEvaluated = state.processEvals.length
  const processPassed = state.processEvals.filter((evaluation) => evaluation.verdict === 'PASS').length
  const processFailed = state.processEvals.filter((evaluation) => evaluation.verdict === 'FAIL').length
  const processedPackages = state.tracePackages.filter((item) => item.status === 'EVALUATED' || item.status === 'PARTIAL')
  const firstFailures = processedPackages.flatMap((pkg) => pkg.moduleScores.filter((score) => score.automaticStatus === 'FAIL' && score.evidence.firstFailure && !score.evidence.derivedFailure).slice(0, 1).map((score) => ({ packageId: pkg.id, caseId: pkg.caseId, moduleCode: score.moduleCode })))
  const allOutcomeEvals = [...office.outcomes, ...other.outcomes]
  const reasons = [...new Set(allOutcomeEvals.map((evaluation) => evaluation.dimension))]

  return <div className="mt-4 space-y-4">
    <Panel title="用户满意度" eyebrow="北极星指标" description="最终被用户接受的有效产物数 / 全部产物数；有效产物需同时满足合格产物与过程有效。" toggleLabel="用户满意度" expanded={satisfactionOpen} onToggle={() => setSatisfactionOpen((value) => !value)} className="border-accent/30">
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,2.15fr)]">
        <Metric label="用户满意度" value="UNKNOWN" counts={artifactTrend} tone="info" details={<>分子待记录 · 分母 {allArtifacts} 个产物 · 待配置</>} onClick={() => onOpenCases(state.cases.map((item) => item.id), { acceptanceStatus: 'UNKNOWN' })} />
        {satisfactionOpen && <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="最终用户接受" value={allArtifacts ? `${(acceptedArtifacts / allArtifacts * 100).toFixed(1)}%` : '暂无数据'} counts={caseTrend} details={`接受 ${acceptedArtifacts} · 拒绝 ${rejectedArtifacts} · 未记录 ${unknownAcceptanceArtifacts}`} onClick={() => onOpenCases(state.cases.filter((item) => item.acceptanceStatus !== 'UNKNOWN').map((item) => item.id), { acceptanceStatus: 'recorded' })} />
          <Metric label="有效产物" value="UNKNOWN" counts={artifactTrend} details="合格产物 + 过程有效；业务过程预期尚未配置。" onClick={() => onOpenCases(state.cases.map((item) => item.id), { processExpected: 'UNKNOWN' })} />
          <Metric label="全部产物" value={String(allArtifacts)} counts={artifactTrend} details="当前全局筛选下的 Artifact 数量。" onClick={() => onOpenEvaluations({ evaluationTab: 'outcome' })} />
        </div>}
      </div>
      <p className="mt-3 text-[11px] text-muted">用户接受信号未在 Case 中记录；不得把缺失信号计算为不满意。</p>
    </Panel>

    <Panel title="合格产物" eyebrow="RESULT EVAL" description="按 Office 与其他产物分层；仅用已记录的产物评测判断，不将过程耗时混入合格率。" toggleLabel="合格产物" expanded={qualifiedOpen} onToggle={() => setQualifiedOpen((value) => !value)}>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="合格产物率" value={qualifiedRate} counts={artifactTrend} tone="info" details={<>合格 {qualifiedCount} · UNKNOWN {unknownProducts} · 分母 {allArtifacts} 个产物</>} onClick={() => onOpenEvaluations({ evaluationTab: 'outcome' })} />
        {qualifiedOpen && reasons.map((reason) => {
          const rows = allOutcomeEvals.filter((evaluation) => evaluation.dimension === reason)
          const pass = rows.filter((evaluation) => evaluation.verdict === 'PASS').length
          const fail = rows.filter((evaluation) => evaluation.verdict === 'FAIL').length
          const unknown = rows.length - pass - fail
          return <Metric key={reason} label={reason} value={`${pass} / ${rows.length}`} counts={sevenDayCounts(rows, maxCaseAt)} details={`通过 ${pass} · 未通过 ${fail} · UNKNOWN ${unknown}`} onClick={() => onOpenEvaluations({ evaluationTab: 'outcome', query: reason })} />
        })}
      </div>
      {qualifiedOpen && <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">{([
        { id: 'office', label: 'Office 产物', evaluator: 'Office Eval Agent', stats: office },
        { id: 'other', label: '其他产物', evaluator: '通用规则评测 · 待接入', stats: other }
      ] as const).map(({ id, label, evaluator, stats }) => <section key={id} className="min-w-0 rounded-md border border-line bg-slate-50/60 p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="text-sm font-semibold text-ink">{label}</h3><p className="mt-1 text-[11px] text-muted">{evaluator}</p></div><button type="button" onClick={() => onOpenEvaluations({ evaluationTab: 'outcome', artifactLayer: id })} className="text-[11px] font-medium text-accent hover:underline">查看明细</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="合格率" value={stats.artifacts.length && !stats.unknownCount ? `${(stats.passIds.length / stats.artifacts.length * 100).toFixed(1)}%` : 'UNKNOWN'} counts={sevenDayCounts(stats.artifacts, maxCaseAt)} details={`${stats.passIds.length} / ${stats.artifacts.length}`} />
          <Metric label="平均评分" value={stats.averageScore === null ? 'UNKNOWN' : stats.averageScore.toFixed(2)} counts={sevenDayCounts(stats.outcomes, maxCaseAt)} details={evaluator} />
          <Metric label="通过" value={String(stats.passIds.length)} counts={sevenDayCounts(stats.outcomes.filter((item) => item.verdict === 'PASS'), maxCaseAt)} details="产物评测 PASS" />
          <Metric label="未通过" value={String(stats.failIds.length)} counts={sevenDayCounts(stats.outcomes.filter((item) => item.verdict === 'FAIL'), maxCaseAt)} details={`UNKNOWN ${stats.unknownCount}`} />
        </div>
        <div className="mt-3 border-t border-line pt-2"><p className="text-[10px] font-semibold text-muted">评测原因</p><div className="mt-2 flex min-w-0 flex-wrap gap-2">{stats.outcomes.filter((item) => item.verdict === 'FAIL').map((item) => <button type="button" key={item.id} onClick={() => onOpenEvaluations({ evaluationTab: 'outcome', evaluationId: item.id })} className="min-w-0 rounded border border-line bg-white px-2 py-1 text-left text-[11px] text-fail hover:border-accent/50">{item.dimension} · {item.revisions.at(-1)?.reason ?? '原因未记录'}</button>)}{!stats.outcomes.some((item) => item.verdict === 'FAIL') && <span className="text-[11px] text-muted">暂无未通过原因</span>}</div></div>
      </section>)}</div>}
    </Panel>

    <Panel title="过程效率" eyebrow="PROCESS EFFICIENCY" description="过程评测表现与业务预期效率分开；预期耗时、成本和路径阈值未定时只展示原始评测数量。" toggleLabel="过程效率" expanded={processOpen} onToggle={() => setProcessOpen((value) => !value)}>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <Metric label="过程效率达标率" value="UNKNOWN" counts={artifactTrend} tone="info" details={<>达标数待配置 · 全部产物 {allArtifacts}</>} onClick={() => onOpenEvaluations({ evaluationTab: 'process' })} />
        <Metric label="过程效率不符业务预期率" value="UNKNOWN" counts={artifactTrend} tone="warn" details={<>不符合数待配置 · 分母 {allArtifacts} 个全部产物</>} onClick={() => onOpenEvaluations({ evaluationTab: 'process' })} />
      </div>
      {processOpen && <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="过程评测记录" value={String(processEvaluated)} counts={sevenDayCounts(state.processEvals, maxCaseAt)} details="原始 Process Eval 记录数，不等于效率达标率。" onClick={() => onOpenEvaluations({ evaluationTab: 'process' })} />
        <Metric label="过程评测 PASS" value={String(processPassed)} counts={sevenDayCounts(state.processEvals.filter((item) => item.verdict === 'PASS'), maxCaseAt)} details="仅表示对应过程 Rubric 通过。" onClick={() => onOpenEvaluations({ evaluationTab: 'process', verdict: 'PASS' })} />
        <Metric label="过程评测 FAIL" value={String(processFailed)} counts={sevenDayCounts(state.processEvals.filter((item) => item.verdict === 'FAIL'), maxCaseAt)} details="仅表示对应过程 Rubric 未通过。" onClick={() => onOpenEvaluations({ evaluationTab: 'process', verdict: 'FAIL' })} />
        <Metric label="业务预期基线" value="待配置" counts={artifactTrend} details="总耗时、Token / 成本按任务复杂度积累基线后再判定。" onClick={() => onOpenEvaluations({ evaluationTab: 'process' })} />
      </div>}
      <p className="mt-3 rounded-md border border-warn/25 bg-warn/5 p-3 text-[11px] leading-5 text-muted">「过程效率不符业务预期率」分母始终是当前全局筛选下的全部产物，包含不合格产物。业务预期未配置时显示 UNKNOWN。</p>
    </Panel>

    <Panel title="模块诊断与首错归因" eyebrow="MODULE EVALUATION" description="五态来自 Trace Evaluation Package；每条 Trace 最多计一个首个非派生失败，Context Assembly 不作为独立评测。" toggleLabel="模块诊断" expanded={moduleOpen} onToggle={() => setModuleOpen((value) => !value)}>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2.2fr)]"><Metric label="有首错 Trace" value={String(firstFailures.length)} counts={packageTrend} tone="fail" details={`分母 ${processedPackages.length} 条已处理 Trace；每条仅计首个非派生失败。`} onClick={() => onOpenEvaluations({ evaluationTab: 'traces', minModuleFailures: '1' })} />{moduleOpen && <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{MODULES.map(({ code, label }) => {
        const scores = processedPackages.flatMap((pkg) => pkg.moduleScores.filter((score) => score.moduleCode === code))
        const counts = Object.fromEntries(FIVE_STATES.map((status) => [status, scores.filter((score) => score.automaticStatus === status).length])) as Record<typeof FIVE_STATES[number], number>
        const firstCount = firstFailures.filter((item) => item.moduleCode === code).length
        return <button type="button" key={code} onClick={() => onOpenModule(code)} aria-label={`${label} 模块诊断`} className="min-w-0 rounded-lg border border-line bg-white p-3 text-left transition hover:border-accent/50 hover:bg-accent/5"><div className="flex min-w-0 items-start justify-between gap-2"><strong className="break-words text-xs text-ink">{label}</strong><StatusBadge status={firstCount ? 'FAIL' : 'UNKNOWN'} label={`首错 ${firstCount}`} tone={firstCount ? 'fail' : 'neutral'} showIcon={false} /></div><div className="mt-3 flex flex-wrap gap-1 text-[10px] text-muted">{FIVE_STATES.map((status) => <span key={status} className="rounded bg-slate-50 px-1.5 py-0.5">{status} {counts[status]}</span>)}</div><p className="mt-2 text-[10px] text-slate-400">统计单位：模块评分；不推断业务成功率</p><Sparkline values={packageTrend} color={firstCount ? '#c43d4b' : '#64748b'} label={`${label} 模块 7 日趋势`} /></button>
      })}</div>}</div>
      {moduleOpen && <div className="mt-5 border-t border-line pt-4"><SectionHeader level={3} eyebrow="首错归因" title="首个关键失败分布" description="同一 Trace 的派生失败不重复进入根因分布。" /><div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-2">{MODULES.map(({ code, label }) => {
        const count = firstFailures.filter((item) => item.moduleCode === code).length
        const maxCount = Math.max(1, ...MODULES.map((item) => firstFailures.filter((failure) => failure.moduleCode === item.code).length))
        return <button type="button" key={code} onClick={() => onOpenModule(code)} className="flex min-w-0 items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition hover:border-line hover:bg-slate-50"><span className="w-28 min-w-0 break-words text-[11px] text-muted">{label}</span><span className="min-w-0 flex-1"><span className="block h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-fail" style={{ width: `${count / maxCount * 100}%` }} /></span></span><span className="w-12 shrink-0 text-right text-xs font-semibold text-ink">{count} 条</span></button>
      })}</div></div>}
    </Panel>
  </div>
}
