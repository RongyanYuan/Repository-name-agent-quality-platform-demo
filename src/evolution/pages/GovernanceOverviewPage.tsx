import { ArrowRight, ExternalLink } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useScopedEvolution } from '../scope'
import { MockBoundary } from '../components/ViewPrimitives'
import { selectOverviewDashboard, OVERVIEW_METRIC_DEFINITIONS, OVERVIEW_PRODUCT_TYPES } from '../data/overviewDashboard'
import { Section } from './shared'
import { SectionHeader } from '../../ui'
import { useContextNavigation } from '../../layout'
import { GLOBAL_FILTER_KEYS } from '../../urlState'

const QA_URL = 'https://autoeval.baidu-int.com/tasks'
const numberText = (value: number) => value.toLocaleString('zh-CN')
const decimalText = (value?: number) => value === undefined ? '暂无数据' : value.toFixed(2)
const timeText = (value?: number, seconds = false) => value === undefined ? '暂无埋点' : (seconds ? (value / 1000).toFixed(2) : Math.round(value).toLocaleString('zh-CN'))

function SummaryMetric({ label, value, note, definition, onClick }: { label: string; value: ReactNode; note: ReactNode; definition?: string; onClick?: () => void }) {
  const body = <><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-muted" title={definition}>{label}</p>{onClick && <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400"/>}</div><p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p><div className="mt-2 text-[10px] leading-5 text-muted">{note}</div></>
  const className = 'min-w-0 rounded-lg border border-line bg-white p-4 text-left' + (onClick ? ' transition hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent' : '')
  return onClick ? <button type="button" onClick={onClick} className={className}>{body}</button> : <div className={className}>{body}</div>
}

/** Three independent dashboards share the selected Case/Trace scope. */
export function GovernanceOverviewPage() {
  const { state, scopedState } = useScopedEvolution()
  const location = useLocation()
  const { navigateContext } = useContextNavigation()
  const dashboard = useMemo(() => selectOverviewDashboard(state, scopedState), [state, scopedState])
  const { outcome, assets, process } = dashboard
  const quality = process.quality.filter(row => row.independentScoring)
  const contextParams = new URLSearchParams()
  const currentParams = new URLSearchParams(location.search)
  GLOBAL_FILTER_KEYS.forEach(key => { const value = currentParams.get(key); if (value) contextParams.set(key, value) })
  const contextUrl = (path: string) => path + (contextParams.size ? '?' + contextParams.toString() : '')
  const assetUrl = contextUrl('/assets-skills')
  const openCases = (caseIds: string[], traceIds: string[] = [], extra: Record<string, string> = {}) => {
    if (!caseIds.length) return
    const kept = Object.fromEntries(contextParams)
    navigateContext('/cases', {
      clear: [...currentParams.keys()].filter(key => !GLOBAL_FILTER_KEYS.includes(key as typeof GLOBAL_FILTER_KEYS[number])),
      params: { ...kept, caseClosed: '1', caseSet: [...new Set(caseIds)].join(','), ...(traceIds.length ? { traceSet: [...new Set(traceIds)].join(',') } : {}), returnTo: location.pathname + location.search, ...extra }
    })
  }
  const openHistoricalSources = () => {
    const traceIds = new Set(assets.usedTraceIds)
    const caseIds = state.traces.filter(trace => traceIds.has(trace.id)).map(trace => trace.caseId)
    openCases(caseIds, assets.usedTraceIds, { timeRange: 'all' })
  }
  const knownFeedback = outcome.adoption.acceptedCaseIds.length + outcome.adoption.rejectedCaseIds.length
  const ratingCount = outcome.scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0)

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-6 text-muted">当前筛选范围内的产物、资产与过程表现；统计单位及口径分别保留。</p><MockBoundary/></div>

    <Section>
      <SectionHeader title="产物结果大盘" description="Case 去重统计。产物评分直接使用最终评测返回的 0 / 1 / 2 分。" actions={<a href={QA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">前往 QA 平台<ExternalLink className="h-3.5 w-3.5" aria-hidden="true"/></a>}/>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryMetric label="总 Case 数" value={numberText(outcome.totalCaseIds.length)} note="单位：Case" definition="当前筛选范围内的任务，按 Case ID 去重。" onClick={outcome.totalCaseIds.length ? () => openCases(outcome.totalCaseIds) : undefined}/>
        <SummaryMetric label="有产物结果的 Case" value={numberText(outcome.resultCaseIds.length)} note={'占总 Case ' + (outcome.totalCaseIds.length ? (outcome.resultCaseIds.length / outcome.totalCaseIds.length * 100).toFixed(1) + '%' : '暂无数据')} definition={OVERVIEW_METRIC_DEFINITIONS.resultCases} onClick={outcome.resultCaseIds.length ? () => openCases(outcome.resultCaseIds) : undefined}/>
        {outcome.scoreDistribution.map(bucket => <SummaryMetric key={bucket.score} label={bucket.score + ' 分'} value={numberText(bucket.count)} note={'占整数评分 Case ' + (ratingCount ? (bucket.count / ratingCount * 100).toFixed(1) + '%' : '暂无评测')} definition={OVERVIEW_METRIC_DEFINITIONS.scoreDistribution} onClick={bucket.caseIds.length ? () => openCases(bucket.caseIds) : undefined}/>)}
        <SummaryMetric label="采纳率" value={outcome.adoption.rate === undefined ? '暂无反馈' : (outcome.adoption.rate * 100).toFixed(1) + '%'} note={outcome.adoption.acceptedCaseIds.length + ' 已采纳 / ' + knownFeedback + ' 有明确反馈'} definition={OVERVIEW_METRIC_DEFINITIONS.adoption} onClick={knownFeedback ? () => openCases([...outcome.adoption.acceptedCaseIds, ...outcome.adoption.rejectedCaseIds]) : undefined}/>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">{outcome.missingScoreCaseIds.length} 个 Case 尚无最终评分；{outcome.adoption.missingCaseIds.length} 个 Case 无采纳事件，不计入采纳率分母。{outcome.nonDiscreteCaseIds.length > 0 && '历史小数评分 ' + outcome.nonDiscreteCaseIds.length + ' 个 Case 保留原值，不强行归入 0 / 1 / 2 分档。'}</p>
    </Section>

    <Section>
      <SectionHeader title="资产大盘" description="资产按资产 ID 去重，进化项按固定版本、归因与独立轮次计数，Trace 按来源 ID 去重。" actions={<Link to={assetUrl} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">查看资产管理<ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/></Link>}/>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryMetric label="已进化资产" value={numberText(assets.evolvedAssetIds.length)} note="已灰度、正式发布或观察中" definition={OVERVIEW_METRIC_DEFINITIONS.evolvedAssets}/>
        <SummaryMetric label="进化项" value={numberText(assets.evolutionRecordIds.length)} note="同一轮次多条分流不重复计数" definition={OVERVIEW_METRIC_DEFINITIONS.evolutionItems}/>
        <SummaryMetric label="贡献 Trace" value={numberText(assets.usedTraceIds.length)} note="曾用于进化的历史来源" definition={OVERVIEW_METRIC_DEFINITIONS.usedTraces} onClick={assets.usedTraceIds.length ? openHistoricalSources : undefined}/>
        <SummaryMetric label="待进化项" value={numberText(assets.pendingEvolutionRecordIds.length)} note="触发条件已确认、尚未发布" definition={OVERVIEW_METRIC_DEFINITIONS.pendingEvolution}/>
        <SummaryMetric label="进化后线上产物平均分" value={assets.postEvolutionAverage === undefined ? '暂无上线后评测' : assets.postEvolutionAverage.toFixed(2) + ' / 2'} note={assets.postEvolutionSampleCount + ' 条发布后线上 Trace'} definition={OVERVIEW_METRIC_DEFINITIONS.postEvolution} onClick={assets.postEvolutionTraceIds.length ? () => openCases(state.traces.filter(trace => assets.postEvolutionTraceIds.includes(trace.id)).map(trace => trace.caseId), assets.postEvolutionTraceIds) : undefined}/>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">待确认触发条件或规则未配置：{assets.pendingRuleRecordIds.length} 项，单列、不计为已满足进化条件。线上表现仅来自对应版本发布后的线上任务，来源 Trace 可能早于当前窗口。</p>
    </Section>

    <Section>
      <SectionHeader title="过程大盘" description="效率与质量按 PPT、Word、Excel、生图分别展示；平均分统一为 0–2。"/>
      <h3 className="mt-5 text-xs font-semibold text-ink">效率</h3>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table aria-label="按产物类型的过程效率" className="w-full min-w-[700px] text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[11px] text-muted"><tr><th className="px-4 py-3">产物类型</th><th className="px-4 py-3">Trace 数</th><th className="px-4 py-3">平均首 Token（ms）</th><th className="px-4 py-3">平均耗时（s）</th><th className="px-4 py-3">Token 消耗（累计）</th><th className="px-4 py-3">平均 Token / Trace</th></tr></thead>
          <tbody className="divide-y divide-line">{process.efficiency.map(row => <tr key={row.type} className="hover:bg-slate-50/50"><th scope="row" className="px-4 py-3 font-semibold">{row.caseIds.length ? <button type="button" aria-label={'查看 ' + row.type + ' 过程 Trace'} onClick={() => openCases(row.caseIds, row.traceIds, { verticalScenario: row.type })} className="text-accent hover:underline">{row.type}</button> : row.type}</th><td className="px-4 py-3 tabular-nums">{numberText(row.traceIds.length)}</td><td className="px-4 py-3 tabular-nums" title={row.ttftSampleCount + ' 条埋点样本'}>{timeText(row.ttftAverageMs)}</td><td className="px-4 py-3 tabular-nums" title={row.latencySampleCount + ' 条埋点样本'}>{timeText(row.latencyAverageMs, true)}</td><td className="px-4 py-3 tabular-nums">{row.tokenSampleCount ? numberText(row.tokenTotal) : '暂无埋点'}</td><td className="px-4 py-3 tabular-nums">{row.tokenAverage === undefined ? '暂无埋点' : numberText(Math.round(row.tokenAverage))}</td></tr>)}</tbody>
        </table>
      </div>
      <h3 className="mt-5 text-xs font-semibold text-ink">质量 · 归因模块平均分</h3>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table aria-label="按产物类型的过程质量" className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[11px] text-muted"><tr><th className="px-4 py-3">归因模块</th>{OVERVIEW_PRODUCT_TYPES.map(type => <th key={type} className="px-4 py-3">{type}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{quality.map(row => <tr key={row.moduleCode}><th scope="row" className="px-4 py-3 font-semibold">{row.label}</th>{row.byType.map(value => <td key={value.type} className="px-4 py-3">{value.average === undefined ? <span className="text-muted">暂无评分</span> : <button type="button" aria-label={'查看 ' + value.type + ' ' + row.label + ' 评分明细'} onClick={() => openCases(value.caseIds, value.traceIds, { verticalScenario: value.type, caseView: 'eval', moduleCode: row.moduleCode })} title={value.sampleCount + ' 条已计分 Trace'} className="w-full max-w-[150px] text-left hover:text-accent"><div className="flex items-center justify-between gap-2"><span className="font-semibold tabular-nums">{decimalText(value.average)} / 2</span><span className="text-[10px] text-muted">{value.sampleCount} 条</span></div><div className="mt-2 h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-accent/70" style={{ width: (value.average / 2 * 100) + '%' }}/></div></button>}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">每条 Trace 使用最新评测及其对应的人工复核，一次计分。上文作为证据，不独立计分；Act 缺失时读取 Tool 执行评分，不重复叠加。</p>
    </Section>
  </div>
}
