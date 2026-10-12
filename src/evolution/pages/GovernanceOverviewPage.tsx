import { ArrowRight, Gauge, ShieldAlert, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Drawer, SectionHeader, StatusBadge } from '../../ui'
import { useScopedEvolution } from '../scope'
import { selectEvolutionFunnel, selectEvolutionMonitoring, selectMonitoringDrilldown, selectOverviewCaseMetrics, type MonitoringSignal } from '../data/selectors'
import { OverviewQualitySections } from '../components/OverviewQualitySections'
import { IdLink, MetricTile, MockBoundary, PageHeading, type ReferenceKind } from '../components/ViewPrimitives'
import { entities, Section, text, type AnyState } from './shared'
import { DETAIL_KEYS, useContextNavigation } from '../../layout'
import { AnomalyMonitoringPage } from '../../anomalyMonitoringPage'

const unitLabel: Record<string, string> = { Case: 'Case', '问题': '问题', '变体': '变体', '实验': '实验', '决策': '决策' }

export function GovernanceOverviewPage() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('view') === 'monitoring') return <div><div className="mb-3 rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent">线上监控视图 · 当前仍属于治理总览页面，可通过左侧“治理总览”返回总览。</div><AnomalyMonitoringPage /></div>
  return <GovernanceOverviewContent />
}

function GovernanceOverviewContent() {
  const { scopedState: state } = useScopedEvolution()
  const data = state as unknown as AnyState
  const cases = entities(data, 'cases')
  const processEvals = entities(data, 'processEvals')
  const outcomeEvals = entities(data, 'outcomeEvals')
  const issues = entities(data, 'issues')
  const batches = entities(data, 'evaluationBatches')
  const packages = entities(data, 'tracePackages')
  const deliveries = entities(data, 'routingDeliveries')
  const badcaseItems = entities(data, 'algorithmBadcases')
  const [selectedFunnel, setSelectedFunnel] = useState<ReturnType<typeof selectEvolutionFunnel>[number]>()
  const [distribution, setDistribution] = useState<{ title: string; ids: string[] }>()
  const { navigateContext } = useContextNavigation()
  const funnel = selectEvolutionFunnel(state)
  const evaluatedCases = new Set([...processEvals, ...outcomeEvals].map((item) => text(item.caseId, ''))).size
  const caseMetrics = selectOverviewCaseMetrics(state)
  const badcaseIds = caseMetrics.badcaseIds
  const badcases = badcaseIds.length
  const performance = useMemo(() => selectEvolutionMonitoring(state), [state])
  const v2Performance = useMemo(() => selectEvolutionMonitoring(state, true), [state])
  const moduleCounts = ['Reason', 'Memory', 'Skill', 'Act'].map((module) => ({ module, count: issues.filter((item) => text(item.module) === module).length }))
  const maxModule = Math.max(1, ...moduleCounts.map((item) => item.count))
  const skillCategories = ['PRODUCTION_SKILL', 'GENERAL', 'PERSONAL_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED']
  const skillCategoryLabels: Record<string, string> = { PRODUCTION_SKILL: '生产 Skill', GENERAL: '通用 Skill', PERSONAL_SKILL: 'Personal Skill', TASTE_SKILL: '品味 Skill', UNCLASSIFIED: '未分类' }
  const skillCategoryCounts = skillCategories.map((category) => ({ category, count: packages.filter((item) => text(item.skillCategory) === category).length }))
  const maxSkillCategory = Math.max(1, ...skillCategoryCounts.map((item) => item.count))
  const evaluationCoverage = packages.length ? { complete: packages.filter((item) => text(item.processCoverage) === 'COMPLETE' && text(item.outcomeCoverage) === 'COMPLETE').length, partial: packages.filter((item) => text(item.status) === 'PARTIAL' || text(item.processCoverage) === 'PARTIAL' || text(item.outcomeCoverage) === 'PARTIAL').length, failed: packages.filter((item) => text(item.status) === 'FAILED').length } : { complete: 0, partial: 0, failed: 0 }
  const routingSummary = { pending: deliveries.filter((item) => ['PENDING', 'QUEUED'].includes(text(item.status))).length, delivered: deliveries.filter((item) => ['DELIVERED', 'ACKNOWLEDGED', 'RESOLVED'].includes(text(item.status))).length, badcase: badcaseItems.filter((item) => text(item.status) !== 'REJECTED').length }
  const openFunnelObject = (id: string) => {
    const target = selectedFunnel?.unit === 'Case' ? ['/cases', 'caseId'] : selectedFunnel?.unit === '问题' ? ['/issues', 'issueId'] : selectedFunnel?.unit === '变体' ? ['/variants', 'variantId'] : selectedFunnel?.unit === '实验' ? ['/experiments', 'experimentId'] : ['/experiments', 'decisionId']
    navigateContext(target[0], { clear: DETAIL_KEYS, params: { [target[1]]: id } })
  }
  const funnelKind = (): ReferenceKind => selectedFunnel?.unit === 'Case' ? 'case' : selectedFunnel?.unit === '问题' ? 'issue' : selectedFunnel?.unit === '变体' ? 'variant' : selectedFunnel?.unit === '实验' ? 'experiment' : 'decision'
  const openDistributionObject = (id: string) => {
    const badcase = distribution?.title.includes('Badcase')
    navigateContext(badcase ? '/cases' : '/issues', { clear: DETAIL_KEYS, params: { [badcase ? 'caseId' : 'issueId']: id } })
  }
  const openCases = (ids: string[], paramsPatch: Record<string, string> = {}) => {
    navigateContext('/cases', { clear: DETAIL_KEYS, params: { ...paramsPatch, caseId: ids.length === 1 ? ids[0] : undefined, caseSet: ids.length === 1 ? undefined : ids.join(',') } })
  }
  const openSignal = (signal: MonitoringSignal) => {
    const source = selectMonitoringDrilldown(state, signal)
    openCases(source.caseIds, { signal, traceId: source.traceIds.length === 1 ? source.traceIds[0] : '', traceSet: source.traceIds.length > 1 ? source.traceIds.join(',') : '' })
  }
  const openBatch = (batchId?: string) => navigateContext('/evaluations', { clear: DETAIL_KEYS, params: batchId ? { batchId } : {} })
  const openRouting = (status = 'PENDING') => navigateContext('/issues', { clear: DETAIL_KEYS, params: { routingStatus: status } })

  return (
    <div>
      <PageHeading eyebrow="SELF-EVOLUTION GOVERNANCE" title="治理总览" description="从线上质量与性能异常进入 Case，并沿问题、变体、实验与发布链路完成闭环治理。所有数字均来自本地结构化 Mock 数据。" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="线上任务量" value={cases.length} note="统计单位：Case" />
        <MetricTile label="结果有效率" value={caseMetrics.result.denominator ? `${Math.round(caseMetrics.result.rate * 100)}%` : '暂无数据'} note={`${caseMetrics.result.numerator}/${caseMetrics.result.denominator} 个已评测 Case 通过 · ${caseMetrics.result.missingCaseIds.length} 个缺失评测`} tone="pass" onClick={() => openCases(caseMetrics.result.failedCaseIds, { outcomeEval: 'FAIL' })} />
        <MetricTile label="过程评测表现" value={caseMetrics.process.denominator ? `${Math.round(caseMetrics.process.rate * 100)}%` : '暂无数据'} note={`${caseMetrics.process.numerator}/${caseMetrics.process.denominator} 个已评测 Case 通过 · ${caseMetrics.process.missingCaseIds.length} 个缺失评测`} onClick={() => openCases(caseMetrics.process.failedCaseIds, { processEval: 'FAIL' })} />
        <MetricTile label="Badcase" value={badcases} onClick={() => setDistribution({ title: 'Badcase 分布', ids: badcaseIds })} note={`${issues.length} 个独立问题，Case 可对应多个问题`} tone="fail" />
      </div>

      <OverviewQualitySections state={state} onOpenCases={openCases} onOpenEvaluations={(params) => navigateContext('/evaluations', { clear: DETAIL_KEYS, params })} onOpenModule={(moduleCode) => {
        const source = state.tracePackages.filter((pkg) => pkg.moduleScores.some((score) => score.moduleCode === moduleCode && score.automaticStatus === 'FAIL' && score.evidence.firstFailure && !score.evidence.derivedFailure))
        if (!source.length) { navigateContext('/evaluations', { clear: DETAIL_KEYS, params: { evaluationTab: 'traces', moduleCode } }); return }
        openCases([...new Set(source.map((pkg) => pkg.caseId))], { traceSet: source.map((pkg) => pkg.traceId).join(',') })
      }} />

      <Section className="mt-4">
        <SectionHeader eyebrow="EVALUATION & ROUTING" title="批量评测覆盖与数据分流" description="按 Trace Package 与 Delivery 统计，批次和分流阶段保持独立分母；点击卡片进入评测批次或分流台账。" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="评测批次" value={batches.length} note={`${batches.filter((item) => ['RUNNING', 'QUEUED'].includes(text(item.status))).length} 个运行中 / 排队`} onClick={() => openBatch()} />
          <MetricTile label="Trace 评测覆盖" value={packages.length ? `${Math.round(packages.filter((item) => text(item.status) === 'EVALUATED').length / packages.length * 100)}%` : '暂无数据'} note={`${packages.length} 条 Trace Package；${evaluationCoverage.complete} 条过程 + 产物完整`} onClick={() => openBatch()} tone="pass" />
          <MetricTile label="部分完成 / 失败" value={`${evaluationCoverage.partial} / ${evaluationCoverage.failed}`} note="缺失 Evidence 或批次失败不虚构结论" onClick={() => openBatch()} tone="warn" />
          <MetricTile label="Routing Delivery" value={deliveries.length} note={`${routingSummary.pending} 待处理 · ${routingSummary.delivered} 已交付 · ${routingSummary.badcase} 算法候选`} onClick={() => openRouting()} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-ink">评测与分流漏斗</h3><span className="text-[10px] text-muted">单位：Trace / Delivery / Badcase</span></div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[{ label: '输入 Trace', value: batches.reduce((sum, item) => sum + (typeof item.stats === 'object' && item.stats ? Number((item.stats as Record<string, unknown>).inputTraceCount ?? 0) : 0), 0) || packages.length, kind: 'evaluation' }, { label: '已完成评测', value: packages.filter((item) => text(item.status) === 'EVALUATED').length, kind: 'evaluation' }, { label: '确认 Finding', value: packages.reduce((sum, item) => sum + (Array.isArray(item.findingIds) ? item.findingIds.length : 0), 0), kind: 'finding' }, { label: '已分流', value: routingSummary.delivered, kind: 'routing' }, { label: '算法 Badcase', value: routingSummary.badcase, kind: 'badcase' }].map((item) => <button key={item.label} type="button" aria-label={`查看${item.kind === 'badcase' ? '算法候选队列' : item.label}明细`} onClick={() => item.kind === 'routing' ? openRouting() : item.kind === 'badcase' ? navigateContext('/issues', { clear: DETAIL_KEYS, params: { badcaseStatus: 'CANDIDATE' } }) : openBatch()} className="rounded-md border border-line bg-slate-50/70 p-3 text-left transition hover:border-accent/40 hover:bg-accent/5"><p className="text-[11px] font-medium text-muted">{item.label}</p><p className="mt-2 text-xl font-semibold text-ink">{item.value}</p><p className="mt-1 text-[10px] text-accent">查看明细 →</p></button>)}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-ink">Skill Category 分布</h3><span className="text-[10px] text-muted">单位：Trace Package</span></div>
            <div className="space-y-2">{skillCategoryCounts.map((item) => <button type="button" key={item.category} onClick={() => openBatch()} className="block w-full text-left"><div className="mb-1 flex justify-between text-[11px]"><span className="text-ink">{skillCategoryLabels[item.category]}</span><span className="text-muted">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-accent" style={{ width: `${item.count / maxSkillCategory * 100}%` }} /></div></button>)}</div>
          </div>
        </div>
        {batches.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-line text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-2 py-2">Batch</th><th className="px-2 py-2">状态</th><th className="px-2 py-2 text-right">输入 Trace</th><th className="px-2 py-2 text-right">完成 / 部分 / 失败</th><th className="px-2 py-2">Eval Agent / Rubric</th></tr></thead><tbody className="divide-y divide-slate-100">{batches.slice(0, 5).map((batch) => { const stats = typeof batch.stats === 'object' && batch.stats ? batch.stats as Record<string, unknown> : {}; const inputCount = typeof stats.inputTraceCount === 'number' ? stats.inputTraceCount : Array.isArray(batch.traceIds) ? batch.traceIds.length : 0; return <tr key={batch.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openBatch(batch.id)}><td className="px-2 py-2"><IdLink id={batch.id} kind="evaluation-batch" onOpen={() => openBatch(batch.id)} label={text(batch.name, batch.id)} /></td><td className="px-2 py-2"><StatusBadge status={text(batch.status)} /></td><td className="px-2 py-2 text-right tabular-nums">{inputCount}</td><td className="px-2 py-2 text-right tabular-nums">{Number(stats.successCount ?? 0)} / {Number(stats.partialCount ?? 0)} / {Number(stats.failedCount ?? 0)}</td><td className="px-2 py-2 text-muted">{text(batch.evalAgentVersion)} · {text(batch.rubricVersion)}</td></tr>})}</tbody></table></div>}
      </Section>

      <Section className="mt-4">
        <SectionHeader eyebrow="EVOLUTION FUNNEL" title="进化漏斗" description="各阶段按对象类型独立计数。跨单位阶段仅展示存量，不直接计算转化率，避免将 Case、问题、变体和实验混用分母。" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {funnel.map((step, index) => (
            <button key={step.id} type="button" onClick={() => setSelectedFunnel(step)} aria-label={`${step.label}，${step.count}，单位：${unitLabel[step.unit] ?? step.unit}`} className="group relative min-w-0 rounded-md border border-line bg-slate-50/70 p-3 text-left transition hover:border-accent/40 hover:bg-accent/5">
              <div className="flex items-start justify-between gap-1"><span className="text-[11px] font-semibold leading-4 text-ink">{step.label}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-accent" /></div>
              <p className="mt-3 text-2xl font-semibold text-ink">{step.count}</p>
              <p className="mt-1 text-[10px] text-muted">单位：{unitLabel[step.unit] ?? step.unit}</p>
              {index < funnel.length - 1 && <span aria-hidden="true" className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-slate-300 xl:block">›</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">说明：一个 Case 可产生多个问题；一个问题可进入直接修复或问题簇，并可命中多条分流路径。</p>
      </Section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Section>
          <SectionHeader eyebrow="MODULE ATTRIBUTION" title="模块问题分布" description="按已确认问题计数；点击后由主路由进入归因明细。" />
          <div className="mt-4 space-y-3">{moduleCounts.map((item) => <button type="button" aria-label={item.module + ' 模块问题'} onClick={() => setDistribution({ title: item.module + ' 模块问题', ids: issues.filter((issue) => text(issue.module) === item.module).map((issue) => issue.id) })} className="block w-full text-left" key={item.module}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-ink">{item.module}</span><span className="text-muted">{item.count} 个问题</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-fail" style={{ width: `${item.count / maxModule * 100}%` }} /></div></button>)}</div>
        </Section>
        <Section>
          <SectionHeader eyebrow="ONLINE MONITORING" title="性能与安全原始信号" description="预期耗时与成本基线尚未建立时，只展示原始观测值，不生成效率结论。" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile label="平均总耗时" value={performance.traceCount ? `${Math.round(performance.latencyMs.average)} ms` : '暂无数据'} note={<StatusBadge status="基线待配置" tone="neutral" showIcon={false} />} onClick={() => openSignal('latency')} />
            <MetricTile label="首 Token 时间" value={performance.traceCount ? `${Math.round(performance.ttftMs.average)} ms` : '暂无数据'} note={<StatusBadge status="基线待配置" tone="neutral" showIcon={false} />} onClick={() => openSignal('ttft')} />
            <MetricTile label="输入 / 输出 Token" value={`${performance.tokens.input} / ${performance.tokens.output}`} note="一期记录原始成本信号" />
            <MetricTile label="Tool 调用" value={performance.toolCallCount} note="同时保留一次执行、Retry 与 Loop 记录" />
            <MetricTile label="Model Call" value={v2Performance.modelCallCount} note="全量 Trace 原始调用次数" />
            <MetricTile label="模型耗时" value={v2Performance.model.latencyMs.average ? `${Math.round(v2Performance.model.latencyMs.average)} ms` : 'UNKNOWN'} note={v2Performance.model.latencyMs.average ? '原始观测；基线待配置' : '模型耗时埋点未覆盖'} />
            <MetricTile label="模型吞吐量" value={v2Performance.model.throughputTokensPerSecond ? `${v2Performance.model.throughputTokensPerSecond.toFixed(1)} token/s` : 'UNKNOWN'} note={v2Performance.model.throughputTokensPerSecond ? '原始观测；基线待配置' : '模型吞吐埋点未覆盖'} />
            <MetricTile label="缓存命中" value={`${performance.cache.hitCount} / ${performance.cache.requestCount}`} note={`${Math.round(performance.cache.hitRate * 100)}% · 基线待配置`} />
            <MetricTile label="Tool 调用频率" value={performance.toolFrequency[0] ? `${performance.toolFrequency[0].toolName} ${Math.round(performance.toolFrequency[0].frequency * 100)}%` : '本窗口无调用'} note="按单 Tool / Tool 总调用量展示" onClick={() => openSignal('tool-frequency')} />
            <MetricTile label="Tool 一次执行成功率" value={performance.toolOneShot.executionCount ? `${Math.round(performance.toolOneShot.successRate * 100)}%` : '暂无数据'} note="Retry / Recovery 成功不纳入分子" onClick={() => openSignal('tool-one-shot')} />
            <MetricTile label="Loop / Retry" value={`${performance.loopCount} / ${performance.retryCount}`} note="一期记录原始次数" />
          </div>
          <p className="mt-3 text-[11px] font-semibold text-muted">TTFT P50 / P90 / P95</p><p className="text-xs text-ink">{performance.ttftMs.p50} / {performance.ttftMs.p90} / {performance.ttftMs.p95} ms</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => openSignal('risk')} className="rounded-md bg-slate-50 p-3 text-left text-xs"><ShieldAlert className="mb-2 h-4 w-4 text-fail" />风控拦截率 {Math.round(performance.risk.rate * 100)}%<br/><span className="text-[11px] text-muted">{performance.risk.reasonDistribution.map((item) => `${item.reason} ${item.count}`).join('、') || '暂无拦截'}</span></button><button type="button" onClick={() => openSignal('commercial')} className="rounded-md bg-slate-50 p-3 text-left text-xs"><Gauge className="mb-2 h-4 w-4 text-accent" />商业化拦截率 {Math.round(performance.commercial.rate * 100)}%<br/><span className="text-[11px] text-muted">{performance.commercial.reasonDistribution.map((item) => `${item.reason} ${item.count}`).join('、') || '暂无拦截'}</span></button><button type="button" onClick={() => openSignal('latency-percentiles')} className="rounded-md bg-slate-50 p-3 text-left text-xs"><Timer className="mb-2 h-4 w-4 text-warn" />P50 / P90 / P95<br/><span className="text-[11px] text-muted">{performance.latencyMs.p50} / {performance.latencyMs.p90} / {performance.latencyMs.p95} ms</span></button></div>
        </Section>
      </div>

      <Drawer open={Boolean(selectedFunnel)} onClose={() => setSelectedFunnel(undefined)} title={`${selectedFunnel?.label ?? ''} 明细`} description={`统计单位：${selectedFunnel?.unit ?? ''}；共 ${selectedFunnel?.count ?? 0} 条。`}>
        <div className="space-y-2">{selectedFunnel?.detailIds.length ? selectedFunnel.detailIds.map((id) => <div key={id} className="rounded-md border border-line p-3"><IdLink id={id} kind={funnelKind()} onOpen={() => openFunnelObject(id)} /></div>) : <p className="text-xs text-muted">当前阶段暂无对象。</p>}</div>
      </Drawer>
      <p className="sr-only">TTFT P50 / P90 / P95：{performance.ttftMs.p50} / {performance.ttftMs.p90} / {performance.ttftMs.p95} ms</p>
      <Drawer open={Boolean(distribution)} onClose={() => setDistribution(undefined)} title={distribution?.title ?? '分布明细'} description={`${distribution?.ids.length ?? 0} 条关联对象`}>
        <div className="space-y-2">{distribution?.ids.map((id) => <div key={id} className="rounded border p-2"><IdLink id={id} kind={distribution.title.includes('Badcase') ? 'case' : 'issue'} onOpen={() => openDistributionObject(id)} /></div>)}</div>
      </Drawer>
    </div>
  )
}
