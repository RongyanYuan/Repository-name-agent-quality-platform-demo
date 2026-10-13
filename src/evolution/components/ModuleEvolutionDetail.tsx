import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, EmptyState, Field, SectionHeader, SelectInput, cn } from '../../ui'
import type { EvolutionTargetIdentity, GovernanceReference, TastePreferenceSignal } from '../domain'
import { buildEvolutionWorkbenchHref, groupModuleEvolutionDirections, type EvolutionStage, type ModuleEvolutionPath, type selectModuleEvolution } from '../data/moduleEvolution'
import { governanceStageLabel } from '../data/traceGovernance'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'
import { governanceItemLabel, governanceItemsFor } from '../governanceTaxonomy'
import { StatusIndicator } from './StatusIndicator'
import { IdLink, type ReferenceTarget } from './ViewPrimitives'
import type { ModuleEvolutionSelection, ProcessDimension, ProcessEvaluationDetail } from './ModuleEvaluationMatrix'

const timeText = (at?: string) => at && !Number.isNaN(Date.parse(at)) ? `${new Date(at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} GMT+8` : '时间未记录'
const valueText = (value: unknown) => typeof value === 'string' && value.trim() ? value : '未记录'
const moduleLabel = (module: ModuleEvolutionSelection['module']) => valueText(module.moduleLabel ?? module.moduleCode)
const historyStage = (value: string) => ({ ELIGIBILITY: '可进化', ISSUE: '问题', CLUSTER: '问题簇', VARIANT: '候选变体', ROUTING: '分流', DATASET: '数据集', GATE: '准出', RELEASE: '上线' }[value] ?? governanceStageLabel(value))
const historyLabel = (value: string) => ({ CONFIRMED: '已确认', PENDING: '待处理', ACKNOWLEDGED: '已接收', DELIVERED: '已分流', PASS: '已准出', RELEASED: '正式上线', ROLLED_BACK: '已回滚', RUNNING: '评测中', FAILED: '失败', REJECTED: '已拒绝', MANUAL_REVIEW: '人工复核' }[value] ?? value)
const attributionShortLabel = (target: EvolutionTargetIdentity) => governanceItemLabel(governanceItemsFor(target.governanceObject).find(item => item.id === target.attributionId)).replace(/（详情见记忆模块PRD）$/, '')
const directionLabel = (target: EvolutionTargetIdentity) => {
  const attribution = attributionShortLabel(target)
  return `${attribution} · ${target.kind === 'SKILL' ? target.skillId : target.targetId} @ ${target.kind === 'SKILL' ? target.skillVersion : target.targetVersion ?? '版本未记录'}`
}

function References({ references, onNavigate }: { references: GovernanceReference[]; onNavigate?: (reference: ReferenceTarget) => void }) {
  return references.length ? <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1">{references.map((reference, index) => <IdLink key={`${reference.kind}-${reference.id}-${index}`} {...reference} onOpen={onNavigate} />)}</div> : null
}

function StageContent({ stage, onNavigate }: { stage: EvolutionStage; onNavigate?: (reference: ReferenceTarget) => void }) {
  return <>
    <StatusIndicator context="governance" status={stage.code} label={stage.label} />
    <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-muted">{stage.reason}</p>
    {stage.count !== undefined && <p className="mt-2 text-xs">相关数据：<strong>{stage.count}</strong>{stage.threshold !== undefined && ` / ${stage.threshold}`} {stage.unit ?? '条'}</p>}
    {stage.countingRule && <p className="mt-1 text-[10px] leading-5 text-muted">{stage.countingRule}</p>}
    <p className="mt-2 text-[10px] leading-5 text-muted">{timeText(stage.at)}</p>
    <References references={stage.refs} onNavigate={onNavigate} />
  </>
}

function exactReturnTo(returnTo: string | undefined, recordId: string) {
  if (!returnTo) return undefined
  const url = new URL(returnTo, 'http://local.demo')
  url.searchParams.set('evolutionRecordId', recordId)
  return `${url.pathname}${url.search}`
}

function EvolutionPath({ path, returnTo, onOpenWorkbench, onNavigateReference, preferenceSignals, focused }: {
  path: ModuleEvolutionPath; returnTo?: string; focused?: boolean
  onOpenWorkbench?: (href: string) => void; onNavigateReference?: (reference: ReferenceTarget) => void
  preferenceSignals?: TastePreferenceSignal[]
}) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { if (focused) { panel.current?.scrollIntoView?.({ block: 'nearest' }); panel.current?.focus({ preventScroll: true }) } }, [focused])
  const target = path.record.target
  const preference = target.kind === 'SKILL' && path.finding.preferenceSignalId ? preferenceSignals?.find(signal => signal.id === path.finding.preferenceSignalId && signal.skillId === target.skillId && signal.caseIds.includes(path.finding.caseId)) : undefined
  const mode = path.record.optimizationMode === 'DIRECT_FIX' ? '直接优化' : path.record.optimizationMode === 'CLUSTER_OPTIMIZATION' ? '聚类优化' : '优化方式待确认'
  const stages = [{ title: '1 是否可进化', stage: path.eligibility }, { title: '2 流转去向', stage: path.routing }, { title: '3 准出状态', stage: path.gate }, { title: '4 是否上线', stage: path.release }]
  const link = (label: string, view: 'datasets' | 'history') => {
    const href = buildEvolutionWorkbenchHref(path.record, view, exactReturnTo(returnTo, path.record.id))
    return <a href={href} className="inline-flex rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-accent hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={event => { if (onOpenWorkbench) { event.preventDefault(); onOpenWorkbench(href) } }}>{label}</a>
  }
  const openReference = onOpenWorkbench || onNavigateReference ? (reference: ReferenceTarget) => {
    const fields: Partial<Record<ReferenceTarget['kind'], string>> = { dataset: 'datasetId', experiment: 'experimentId', variant: 'variantId', decision: 'decisionId', release: 'releaseId', window: 'windowId', issue: 'issueId', attribution: 'attributionId', cluster: 'clusterId', finding: 'findingId', 'routing-delivery': 'deliveryId', 'experiment-run': 'runId' }
    const field = fields[reference.kind]
    if (field && onOpenWorkbench) {
      const url = new URL(buildEvolutionWorkbenchHref(path.record, reference.kind === 'dataset' ? 'datasets' : 'history', exactReturnTo(returnTo, path.record.id)), 'http://local.demo')
      url.searchParams.set(field, reference.id)
      onOpenWorkbench(`${url.pathname}${url.search}`)
    } else onNavigateReference?.(reference)
  } : undefined
  const history = [...path.history].sort((left, right) => {
    const leftAt = left.at ? Date.parse(left.at) : NaN
    const rightAt = right.at ? Date.parse(right.at) : NaN
    if (Number.isNaN(leftAt)) return Number.isNaN(rightAt) ? 0 : 1
    return Number.isNaN(rightAt) ? -1 : leftAt - rightAt
  })
  return <article ref={panel} tabIndex={-1} aria-label={`归因路径 · ${path.label}`} data-evolution-record-id={path.record.id} data-evolution-path-id={path.id} className={cn('min-w-0 rounded-lg border p-4 outline-none', focused ? 'border-accent ring-1 ring-accent/20' : 'border-line', path.isHistorical && 'bg-slate-50/60')}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h3 className="text-sm font-semibold">{governanceItemLabel(governanceItemsFor(target.governanceObject).find(item=>item.id===target.attributionId))}</h3><p className="mt-1 text-xs text-muted">{path.delivery?.label.replaceAll('Agent迭代', 'Agent 迭代') ?? '待分流'} · {mode}</p></div>
      <span className={cn('rounded border px-2 py-1 text-[10px]', path.isHistorical ? 'border-slate-200 text-muted' : 'border-accent/20 text-accent')}>{path.isHistorical ? '历史记录，不代表当前结论' : '当前轮次'}</span>
    </div>
    <div className="mt-3 rounded-md bg-slate-50 p-3 text-[11px] leading-5">
      <p className="font-semibold">{path.record.name}</p>
      <p className="mt-1 break-all">进化记录：{path.record.id} · 创建时间 {timeText(path.record.createdAt)}</p>
      <p className="mt-1">{target.kind === 'SKILL' ? 'skill' : target.governanceObject === 'Memory' ? '记忆' : target.governanceObject} · 固定源版本 {target.kind === 'SKILL' ? target.skillVersion : target.targetVersion ?? '未记录'}</p>
      {path.binding && <p className="mt-1 break-all text-[10px] text-muted">来源评测包：{path.binding.packageId} · 自动版本：{path.binding.automaticRevisionId}</p>}
      <div className="mt-2 flex min-w-0 flex-wrap gap-3"><IdLink kind="finding" id={path.finding.id} onOpen={openReference} />{path.attribution && <IdLink kind="attribution" id={path.attribution.id} onOpen={openReference} />}{target.kind === 'SKILL' ? <IdLink kind="skill" id={target.skillId} onOpen={onNavigateReference} /> : <span className="break-all text-[10px] text-muted">目标 ID：{target.targetId}</span>}</div>
      {path.record.variantIds.length > 0 && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3"><span className="text-[10px] text-muted">本轮候选变体</span>{path.record.variantIds.map(id => <IdLink key={id} kind="variant" id={id} onOpen={openReference} />)}</div>}
    </div>
    {preference && <section aria-label="品味 Skill 批量偏好聚合" className="mt-3 rounded-md border border-accent/20 bg-accent/5 p-3 text-xs"><h4 className="font-semibold">品味 Skill 批量偏好聚合 · Mock</h4><p className="mt-2">{preference.preferenceCount} 人 / {preference.populationTotal} 人 · 偏好{preference.preferenceValue} {Math.round(preference.preferenceRate * 100)}%</p><p className="mt-1">相关数据 {preference.relatedDataCount} / {preference.relatedDataThreshold} 条 · {preference.routingLabel.replaceAll('Agent迭代', 'Agent 迭代')}</p><p className="mt-2 leading-5 text-muted">{preference.judgeReason}</p><p className="mt-1 leading-5 text-muted">{preference.optimizationPath.replaceAll('Agent迭代', 'Agent 迭代')}</p><p className="mt-2 text-[10px] leading-5 text-muted">偏好比例描述用户反馈分布；是否可进化仍按归因确认和相关数据规则判断，不以用户比例推定。</p></section>}
    <details open className="mt-3 rounded-md border border-line p-3"><summary className="cursor-pointer text-xs font-semibold">流转历史（{history.length} 条）</summary><ol aria-label="完整流转历史" className="mt-4 ml-1 max-h-[360px] space-y-4 overflow-y-auto border-l border-line pl-4 pr-2">{history.map(event => <li key={event.id} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border border-line bg-white" aria-hidden="true" /><p className="text-[10px] text-muted">{timeText(event.at)}</p><p className="mt-1 font-semibold">{historyStage(event.stage)} · {historyLabel(event.label)}</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-muted">{event.description}</p><References references={event.refs} onNavigate={openReference} /></li>)}</ol>{!history.length && <p className="mt-3 text-xs text-muted">尚无已记录的流转历史；未补造发生时间。</p>}</details>
    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
      {stages.map(({ title, stage }) => <section key={title} aria-label={title} className="min-w-0 rounded-md border border-line bg-white p-3"><h4 className="mb-2 text-xs font-semibold">{title}</h4><StageContent stage={stage} onNavigate={openReference} />{title === '3 准出状态' && <div className="mt-3 space-y-2 border-t border-line pt-3"><div><p className="mb-1 text-[10px] font-semibold text-muted">单能力变体实验</p><StageContent stage={path.singleGate} onNavigate={openReference} /></div><div><p className="mb-1 text-[10px] font-semibold text-muted">窗口版本实验</p><StageContent stage={path.windowGate} onNavigate={openReference} /></div></div>}</section>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">{link('查看进化数据集', 'datasets')}{link('查看准出评测', 'history')}</div>
    <details className="mt-3 rounded-md border border-line p-3"><summary className="cursor-pointer text-xs font-semibold">关联数据集（{path.datasets.length} 个）</summary><div className="mt-3 space-y-2">{path.datasets.map(dataset => {
      const url = new URL(buildEvolutionWorkbenchHref(path.record, 'datasets', exactReturnTo(returnTo, path.record.id)), 'http://local.demo')
      url.searchParams.set('datasetId', dataset.id)
      const href = `${url.pathname}${url.search}`
      return <div key={dataset.id} className="min-w-0 rounded border border-line bg-slate-50 p-3 text-xs"><p className="font-semibold">{dataset.name}</p><p className="mt-1 text-[11px] text-muted">版本 {dataset.version} · 用途 {dataset.purpose ?? '用途未记录'} · {dataset.frozen ? '已冻结' : '未冻结'}</p><div className="mt-2"><a href={href} className="break-all font-mono text-[11px] font-semibold text-accent hover:underline" onClick={event => { if (onOpenWorkbench) { event.preventDefault(); onOpenWorkbench(href) } }}>{dataset.id}</a></div></div>
    })}{!path.datasets.length && <p className="text-xs leading-5 text-muted">本轮尚未关联数据集；没有借用同 Skill 或其他轮次的数据集。</p>}</div></details>
    {path.warnings.length > 0 && <div role="status" className="mt-3 rounded-md border border-warn/30 bg-warn/5 p-3 text-[11px] leading-5">{path.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
  </article>
}

export interface ModuleEvolutionDetailProps {
  selection: ModuleEvolutionSelection
  evolution: ReturnType<typeof selectModuleEvolution>
  evaluation?: ProcessEvaluationDetail
  dimension?: ProcessDimension
  initialEvolutionRecordId?: string
  initialEvolutionDirectionId?: string
  onEvolutionDirectionChange?: (id?: string) => void
  preferenceSignals?: TastePreferenceSignal[]
  returnTo?: string
  onOpenEvidence?: () => void
  onReview?: () => void
  onReviewHistory?: () => void
  onOpenWorkbench?: (href: string) => void
  onNavigateReference?: (reference: ReferenceTarget) => void
}

export function ModuleEvolutionDetail({ selection, evolution, evaluation, dimension, initialEvolutionRecordId, initialEvolutionDirectionId, onEvolutionDirectionChange, preferenceSignals, returnTo, onOpenEvidence, onReview, onReviewHistory, onOpenWorkbench, onNavigateReference }: ModuleEvolutionDetailProps) {
  const [localDirection, setLocalDirection] = useState(initialEvolutionDirectionId ?? '')
  const selectedDirection = onEvolutionDirectionChange ? initialEvolutionDirectionId ?? '' : localDirection
  const directions = groupModuleEvolutionDirections(evolution)
  const referencedDirection = initialEvolutionRecordId ? directions.find(direction => [...direction.currentPaths, ...direction.historicalPaths].some(path => path.record.id === initialEvolutionRecordId))?.id : undefined
  const [expandedDirections, setExpandedDirections] = useState<string[]>(referencedDirection ? [referencedDirection] : [])
  const panelPrefix = useId()
  useEffect(() => { setLocalDirection(initialEvolutionDirectionId ?? '') }, [selection.module.id, selection.processEvaluationId, selection.scoreDimensionId, initialEvolutionDirectionId])
  useEffect(() => { setExpandedDirections(referencedDirection ? [referencedDirection] : []) }, [selection.module.id, selection.processEvaluationId, selection.scoreDimensionId, initialEvolutionRecordId, referencedDirection])
  if (evolution.contextOnly) return <EmptyState title="上文仅作为证据" description="上文没有独立评分或进化阶段；从对应模块 Evidence 查阅上下文。" />
  const visibleDirections = directions.filter(direction => !selectedDirection || direction.id === selectedDirection)
  const directionReturnTo = (id: string) => {
    if (!returnTo) return undefined
    const url = new URL(returnTo, 'http://local.demo')
    url.searchParams.set('moduleEvolutionDirectionId', selectedDirection || id)
    return `${url.pathname}${url.search}`
  }
  const renderPaths = (paths: ModuleEvolutionPath[], directionId: string) => {
    const rounds = [...new Set(paths.map(path => path.record.id))].map(id => ({ record: paths.find(path => path.record.id === id)!.record, paths: paths.filter(path => path.record.id === id) })).sort((left, right) => Date.parse(left.record.createdAt) - Date.parse(right.record.createdAt))
    return <div className="space-y-4">{rounds.map(round => <div key={round.record.id} className="min-w-0 space-y-3 border-l-2 border-line pl-3"><p className="text-[11px] leading-5 text-muted">记录建立于 {timeText(round.record.createdAt)}<br /><span className="font-mono">{round.record.id}</span></p>{round.paths.map(path => <EvolutionPath key={JSON.stringify([path.binding?.packageId,path.binding?.moduleScoreId,path.binding?.automaticRevisionId,path.id])} path={path} returnTo={directionReturnTo(directionId)} focused={path.record.id === initialEvolutionRecordId} onOpenWorkbench={onOpenWorkbench} onNavigateReference={onNavigateReference} preferenceSignals={preferenceSignals} />)}</div>)}</div>
  }
  const module = selection.module
  const missingDetail = Boolean(selection.processEvaluationId && !evaluation || selection.scoreDimensionId && !dimension)
  const automatic = missingDetail ? '未评测' : dimension ? formatNormalizedScoreOutOfTwo(dimension.score, '未评测') : evaluation ? evaluation.scoreScale === '0-2' ? formatNormalizedScoreOutOfTwo(evaluation.score, '未评测') : formatLegacyScoreOutOfTwo(evaluation.score, '未评测') : module.scoreScale === '0-2' ? formatNormalizedScoreOutOfTwo(module.score, '未评测') : formatLegacyScoreOutOfTwo(module.score, '未评测')
  const manual = missingDetail ? '未记录' : dimension ? '细项人工分数未记录' : formatNormalizedScoreOutOfTwo(evaluation ? evaluation.humanScore : module.humanScore, '未复核')
  const reason = missingDetail ? '当前 Trace 未找到对应评分细项，未用模块总分或其他 Trace 替代。' : evaluation ? evaluation.autoReason ?? '未记录' : dimension ? `此细项未单独记录 Judge Reason。模块依据：${valueText(module.judgeReason)}` : valueText(module.judgeReason)
  const humanReason = missingDetail || dimension ? undefined : evaluation ? evaluation.humanReason : module.humanNote
  const evidence = module.evidence && typeof module.evidence === 'object' ? module.evidence as Record<string, unknown> : {}
  return <div aria-label="模块进化详情" className="min-w-0 space-y-4">
    <section aria-label="模块评分摘要" className="rounded-lg border border-line p-3">
      <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] text-muted">自动评分（0–2）</p><p className="mt-1 font-mono text-lg font-semibold">{automatic}</p></div><div><p className="text-[10px] text-muted">人工评分（0–2）</p><p className="mt-1 font-mono text-lg font-semibold">{manual}</p></div></div>
      <p className="mt-2 text-[11px] leading-5 text-muted">{evolution.summary} · 低分与进化条件分别判断</p>
      <div className="mt-3 flex flex-wrap gap-2">{onOpenEvidence && <Button onClick={onOpenEvidence}>查看 Evidence</Button>}{onReview && <Button onClick={onReview}>{evaluation || dimension ? '复核模块评分' : '人工复核'}</Button>}{onReviewHistory && <Button variant="ghost" onClick={onReviewHistory}>查看复核历史</Button>}{evaluation && <IdLink kind="process-eval" id={evaluation.id} onOpen={onNavigateReference} />}</div>
    </section>
    <Field label="进化方向" hint="按固定目标、源版本与归因区分方向；同一方向包含本轮和历史轮次。"><SelectInput aria-label="进化方向" value={selectedDirection} onChange={event => { const id = event.target.value; if (onEvolutionDirectionChange) onEvolutionDirectionChange(id || undefined); else setLocalDirection(id) }}><option value="">全部进化方向（{directions.length}）</option>{selectedDirection && !directions.some(direction => direction.id === selectedDirection) && <option value={selectedDirection}>未找到指定进化方向</option>}{directions.map(direction => <option key={direction.id} value={direction.id}>{directionLabel(direction.target)}</option>)}</SelectInput></Field>
    <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-xs font-semibold"><h3 className="inline text-xs font-semibold">{`${moduleLabel(module)}${evaluation || dimension ? ` · ${evaluation?.dimension ?? dimension?.dimension}` : ''}评分依据`}</h3></summary><div className="mt-3 text-xs leading-6"><p className="font-semibold">自动 Judge Reason</p><p className="whitespace-pre-wrap">{reason}</p>{Boolean(humanReason) && <><p className="mt-2 font-semibold">人工说明</p><p className="whitespace-pre-wrap">{valueText(humanReason)}</p></>}<p className="mt-3"><span className="font-semibold">Rubric：</span>{valueText(evidence.rubricRule ?? module.rubricRule)}</p><p className="mt-1 break-all text-[10px] leading-5 text-muted">模块评分：{String(module.id ?? '未记录')} · 自动版本：{valueText(module.automaticRevisionId)}<br />Eval Agent：{valueText(module.evalAgentVersion)} · Rubric 版本：{valueText(module.rubricVersion)}</p></div></details>
    <section className="min-w-0 space-y-3">
      <SectionHeader title="当前归因与进化路径" level={3} description="点击归因查看对应目标、版本和完整历史；历史已准出不会作为本轮状态。" />
      {evolution.missingReason && <p role="status" className="rounded border border-line bg-slate-50 p-3 text-xs leading-5 text-muted">{evolution.missingReason}</p>}
      {visibleDirections.map(direction => {
        const expanded = expandedDirections.includes(direction.id)
        const panelId = `${panelPrefix}-${directions.findIndex(item => item.id === direction.id)}`
        const label = attributionShortLabel(direction.target)
        return <section key={direction.id} aria-label={`进化方向 · ${label}`} data-evolution-direction-id={direction.id} className="min-w-0 rounded-lg border border-line">
          <h3><button type="button" aria-expanded={expanded} aria-controls={panelId} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => setExpandedDirections(current => current.includes(direction.id) ? current.filter(id => id !== direction.id) : [...current, direction.id])}><span>{label}</span><ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} /></button></h3>
          {expanded && <div id={panelId} className="min-w-0 space-y-4 border-t border-line p-3">
            <div className="rounded bg-slate-50 p-3"><p className="break-all text-[11px] leading-5 text-muted">{direction.target.kind === 'SKILL' ? 'skill' : direction.target.governanceObject === 'Memory' ? '记忆' : direction.target.governanceObject} · {direction.target.kind === 'SKILL' ? direction.target.skillId : direction.target.targetId} · 固定源版本 {direction.target.kind === 'SKILL' ? direction.target.skillVersion : direction.target.targetVersion ?? '未记录'}<br />当前 {direction.currentPaths.length} 条路径 / 历史 {direction.historicalPaths.length} 条路径 · 多路分流分别记录</p></div>
            {direction.currentPaths.length > 0 && <section className="space-y-3"><h4 className="text-xs font-semibold">当前轮次</h4>{renderPaths(direction.currentPaths, direction.id)}</section>}
            {direction.historicalPaths.length > 0 && <section className="space-y-3"><SectionHeader title="历史自动版本 / 历史轮次" level={3} description="保留原来源评测包、自动版本和每次决策；仅用于回查。" />{renderPaths(direction.historicalPaths, direction.id)}</section>}
          </div>}
        </section>
      })}
      {!visibleDirections.length && <p role="status" className="rounded border border-line bg-slate-50 p-3 text-xs text-muted">{selectedDirection ? '当前模块未找到所选进化方向；没有显示其他方向替代。' : '当前评分未关联进化方向。'}</p>}
    </section>
  </div>
}
