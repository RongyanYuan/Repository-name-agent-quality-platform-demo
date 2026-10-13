import { useEffect, useState } from 'react'
import { EmptyState, SectionHeader, Button } from '../../ui'
import type { EvalResult } from '../../domain'
import { ModuleEvaluationMatrix, type ModuleEvaluationRecord, type ModuleEvolutionSelection } from '../components/ModuleEvaluationMatrix'
import { EvidenceBundleContent, EvidenceBundleDrawer } from '../components/EvidenceBundleDrawer'
import { DetailDrawer, IdLink } from '../components/ViewPrimitives'
import { ModuleReviewEditor } from '../components/ModuleReviewEditor'
import { automaticModuleRevisionId, type ModuleReviewInput } from '../reviews'
import type { ModuleEvaluationScore } from '../domain'
import { governanceLabel } from '../labels'
import type { CaseAnalysisData, CaseAnalysisRecord, CaseReference } from './model'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'
import { selectModuleEvolution } from '../data/moduleEvolution'
import { ModuleEvolutionDetail } from '../components/ModuleEvolutionDetail'

export interface EvolutionDetailLocation { moduleScoreId: string; processEvaluationId?: string; scoreDimensionId?: string }
export interface CaseEvaluationsProps {
  record: CaseAnalysisRecord; data: CaseAnalysisData
  onNavigate?: (reference: CaseReference) => void; onBackToTrace: (id?: string) => void
  onModuleReview?: (input: ModuleReviewInput) => Promise<void>; onReviewHistory?: (moduleScoreId: string) => void
  view?: 'process' | 'all'; initialEvaluationId?: string
  initialModuleScoreId?: string; initialScoreDimensionId?: string; initialEvolutionRecordId?: string
  initialEvolutionDirectionId?: string
  sourceRoute?: string
  onOpenEvolutionWorkbench?: (href: string) => void
  onEvolutionDetailChange?: (selection?: EvolutionDetailLocation) => void
  onEvolutionDirectionChange?: (id?: string) => void
}

export function CaseEvaluations({ record, data, onNavigate, onBackToTrace, onModuleReview, onReviewHistory, view = 'process', initialEvaluationId, initialModuleScoreId, initialScoreDimensionId, initialEvolutionRecordId, initialEvolutionDirectionId, sourceRoute, onOpenEvolutionWorkbench, onEvolutionDetailChange, onEvolutionDirectionChange }: CaseEvaluationsProps) {
  const [module, setModule] = useState<ModuleEvaluationRecord>()
  const [reviewModule, setReviewModule] = useState<ModuleEvaluationRecord>()
  const [localEvolutionSelection, setEvolutionSelection] = useState<ModuleEvolutionSelection>()
  const routedModule = initialModuleScoreId ? record.moduleEvaluations?.find(item => item.id === initialModuleScoreId) : undefined
  // Browser navigation owns the open layer. Local state is only a fallback for
  // standalone consumers; it cannot override a popped or cleared route.
  const evolutionSelection: ModuleEvolutionSelection | undefined = onEvolutionDetailChange
    ? routedModule ? { module: routedModule, processEvaluationId: initialEvaluationId, scoreDimensionId: initialScoreDimensionId } : undefined
    : localEvolutionSelection
  useEffect(() => { setModule(undefined); setReviewModule(undefined); setEvolutionSelection(undefined) }, [record.trace?.id])
  useEffect(() => {
    if (onEvolutionDetailChange) return
    if (!initialModuleScoreId) return
    const selected = record.moduleEvaluations?.find(item => item.id === initialModuleScoreId)
    setEvolutionSelection(selected ? { module: selected, processEvaluationId: initialEvaluationId, scoreDimensionId: initialScoreDimensionId } : undefined)
  }, [record.trace?.id, initialModuleScoreId, initialEvaluationId, initialScoreDimensionId])
  const openReference = onNavigate ? (reference: { kind: CaseReference['kind']; id: string }) => onNavigate({ ...reference, label: reference.id }) : undefined
  const sourceScore = (selection: ModuleEvolutionSelection) => data.evolutionState?.tracePackages.find(pkg => pkg.id === record.packageId && pkg.traceId === record.trace?.id)?.moduleScores.find(item => item.id === selection.module.id)
  const detailSelection = evolutionSelection ? { ...evolutionSelection, module: { ...evolutionSelection.module, automaticRevisionId: sourceScore(evolutionSelection) ? automaticModuleRevisionId(sourceScore(evolutionSelection)!) : evolutionSelection.module.automaticRevisionId } } : undefined
  const evolution = (selection: ModuleEvolutionSelection): ReturnType<typeof selectModuleEvolution> => {
    const state = data.evolutionState
    const score = sourceScore(selection)
    if (!state || !record.trace || !record.packageId || !score) return { currentPaths: [], historicalPaths: [], summary: '未关联进化路径', missingReason: '当前评分缺少可核验的 Trace / 评测包来源，不借用同 Case 其他路径。', contextOnly: selection.module.moduleCode === 'CONTEXT' }
    return selectModuleEvolution(state, { traceId: record.trace.id, packageId: record.packageId, moduleScoreId: score.id, automaticRevisionId: automaticModuleRevisionId(score), processEvaluationId: selection.processEvaluationId, scoreDimensionId: selection.scoreDimensionId })
  }
  const openEvolution = (selection: ModuleEvolutionSelection) => {
    setModule(undefined); setReviewModule(undefined)
    if (onEvolutionDetailChange) onEvolutionDetailChange({ moduleScoreId: String(selection.module.id), processEvaluationId: selection.processEvaluationId, scoreDimensionId: selection.scoreDimensionId })
    else setEvolutionSelection(selection)
  }
  const closeEvolution = () => { setEvolutionSelection(undefined); onEvolutionDetailChange?.() }
  const returnTo = (selection: ModuleEvolutionSelection) => {
    const url = new URL(sourceRoute ?? (typeof window === 'undefined' ? '/cases' : window.location.href), 'http://local.demo')
    url.pathname = '/cases'
    url.searchParams.set('caseView', 'eval'); url.searchParams.set('caseId', record.id)
    if (record.trace) url.searchParams.set('traceId', record.trace.id)
    url.searchParams.set('moduleScoreId', String(selection.module.id))
    for (const key of ['processEvaluationId', 'evaluationId', 'scoreDimensionId', 'evolutionRecordId']) url.searchParams.delete(key)
    if (selection.processEvaluationId) { url.searchParams.set('processEvaluationId', selection.processEvaluationId); url.searchParams.set('evaluationId', selection.processEvaluationId) }
    if (selection.scoreDimensionId) url.searchParams.set('scoreDimensionId', selection.scoreDimensionId)
    if (initialEvolutionDirectionId) url.searchParams.set('moduleEvolutionDirectionId', initialEvolutionDirectionId)
    return `${url.pathname}${url.search}`
  }
  const group = (title: string, items: EvalResult[], kind: 'process-eval' | 'outcome-eval') => <section className="rounded-lg border border-line p-3">
    <SectionHeader title={title} level={3} description="自动评测与人工结论分开保留，历史记录不覆盖。" />
    <div className="mt-3 space-y-2">{items.map((item) => <div key={item.id} className="rounded border border-line bg-slate-50 p-3 text-xs">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{item.dimension}</span><span className="font-mono font-semibold text-accent">{item.humanScore !== undefined ? formatNormalizedScoreOutOfTwo(item.humanScore) : formatLegacyScoreOutOfTwo(item.score)}</span></div>
      <p className="mt-1 text-[10px] text-muted">评分口径：0–2 · 自动评分 {formatLegacyScoreOutOfTwo(item.score)} · 人工评分 {item.humanScore !== undefined ? formatNormalizedScoreOutOfTwo(item.humanScore) : '未复核'}</p>
      <p className="mt-2 text-[11px] leading-5">LLM Judge Reason：{item.autoReason ?? item.reason ?? '未记录'}</p>
      {item.humanReason && <p className="mt-1 text-[11px] leading-5">人工说明：{item.humanReason}</p>}
      <div className="mt-2 flex flex-wrap gap-2"><IdLink id={item.id} kind={kind} onOpen={openReference} />{item.evidenceIds.map((id) => <IdLink key={id} id={id} kind="evidence" label={`查看 Evidence ${id}`} onOpen={openReference} />)}</div>
    </div>)}</div>
    {!items.length && <EmptyState className="min-h-[100px]" title={record.moduleEvaluations?.length ? '独立评测记录未入库' : '未评测'} description={record.moduleEvaluations?.length ? '当前 Trace 的模块评测包与证据见上方矩阵；独立评测列表尚无对应记录，不重复推断结论。' : '当前无此类评测，缺失不会被当作 PASS。'} />}
  </section>
  return <div className="space-y-3">
    {initialModuleScoreId && !record.moduleEvaluations?.some(item => item.id === initialModuleScoreId) && <p role="status" className="rounded border border-line bg-slate-50 p-3 text-xs leading-5 text-muted">当前 Trace 未找到模块评分 {initialModuleScoreId}；未打开其他模块或 Trace 的进化路径。</p>}
    {record.moduleEvaluations?.length || record.processEvals.length ? <section className="rounded-lg border border-line p-3"><SectionHeader level={3} title="Trace 模块评测矩阵" description="模块内展开细项评分；进化状态按具体归因与处理路径展示。上文仅作为证据。人工最终聚合规则待配置。" actions={<span className="text-xs text-muted">过程最终评分（0–2） <strong className="ml-1 font-mono text-ink">{formatNormalizedScoreOutOfTwo(record.processFinalScore, '未评测')}</strong></span>} /><ModuleEvaluationMatrix key={record.trace?.id} className="mt-3" modules={record.moduleEvaluations ?? []} mode={view === 'process' ? 'process' : 'all'} dimensions={record.processDimensions ?? []} evaluations={record.processEvals} initialEvaluationId={initialEvaluationId} onNavigateReference={openReference} onOpenObservation={onBackToTrace} compact onSelect={setModule} onReview={onModuleReview ? setReviewModule : undefined} onReviewHistory={onReviewHistory ? (item) => onReviewHistory(String(item.id)) : undefined} getEvolutionSummary={selection => evolution(selection).summary} onOpenEvolution={openEvolution} /></section> : <EmptyState title="未评测" description="当前 Trace 尚无过程模块或细项评测记录。" />}
    {view === 'all' && record.evaluationScenarios?.length ? <section className="rounded-lg border border-line p-3"><SectionHeader level={3} title="评测 Agent 返回场景与自进化路径" /><div className="mt-3 space-y-2">{record.evaluationScenarios.map((scenario, index) => <div key={scenario.findingId ?? index} className="rounded border border-line p-3 text-xs"><p className="font-semibold">{scenario.label} · {scenario.dimension}</p><p className="mt-1 leading-5 text-muted">{scenario.path.replaceAll('Agent迭代', 'Agent 迭代')}</p>{scenario.findingId && <IdLink id={scenario.findingId} kind="finding" label={`查看 Finding ${scenario.findingId}`} onOpen={openReference} />}</div>)}</div></section> : null}
    {view === 'all' && record.tastePreference && <section className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs"><SectionHeader level={3} title="品味 Skill 批量偏好聚合" /><p className="mt-3">{record.tastePreference.preferenceCount} 人 / {record.tastePreference.populationTotal} 人 · 偏好{record.tastePreference.preferenceValue} {Math.round(record.tastePreference.preferenceRate * 100)}%</p><p className="mt-1">相关数据 {record.tastePreference.relatedDataCount} / {record.tastePreference.relatedDataThreshold} 条 · {governanceLabel(record.tastePreference.routingLabel)}</p><p className="mt-2 text-[11px] leading-5 text-muted">{record.tastePreference.judgeReason}</p></section>}
    {view === 'all' && group('产物 / 结果评测', record.outcomeEvals, 'outcome-eval')}
    <EvidenceBundleDrawer open={Boolean(module)} module={module} onClose={() => setModule(undefined)} evidence={(data.rootEvidence ?? data.evidence.map((item) => ({ ...item, content: item.summary }))) as unknown as Array<Record<string, unknown>>} onNavigateReference={openReference} onReview={onModuleReview ? () => { setReviewModule(module); setModule(undefined) } : undefined} />
    {evolutionSelection && detailSelection && <DetailDrawer open onClose={closeEvolution} title={`${String(evolutionSelection.module.moduleLabel ?? evolutionSelection.module.moduleCode ?? '模块')} · 进化详情`} description="按模块进化方向查看完整历史，保留各轮次的可进化、分流、准出、上线及流转时间。"><ModuleEvolutionDetail selection={detailSelection} evolution={evolution(evolutionSelection)} evaluation={record.processEvals.find(item => item.id === evolutionSelection.processEvaluationId)} dimension={record.processDimensions?.find(item => (item.id ?? item.dimension) === evolutionSelection.scoreDimensionId && item.scoreId === evolutionSelection.module.id)} preferenceSignals={data.evolutionState?.tastePreferenceSignals} initialEvolutionRecordId={initialEvolutionRecordId} initialEvolutionDirectionId={initialEvolutionDirectionId} onEvolutionDirectionChange={onEvolutionDirectionChange} returnTo={returnTo(evolutionSelection)} onOpenEvidence={() => { setModule(evolutionSelection.module); closeEvolution() }} onReview={onModuleReview ? () => { setReviewModule(evolutionSelection.module); closeEvolution() } : undefined} onReviewHistory={onReviewHistory ? () => { onReviewHistory(String(evolutionSelection.module.id)); closeEvolution() } : undefined} onNavigateReference={openReference} onOpenWorkbench={onOpenEvolutionWorkbench} /></DetailDrawer>}
    {reviewModule && onModuleReview && <DetailDrawer open onClose={() => setReviewModule(undefined)} title={`${String(reviewModule.moduleLabel ?? reviewModule.moduleCode ?? '模块')} 人工复核`} description="当前 Trace 的独立人工评分；保存后追加记录，自动结果与冻结报告保留。"><ModuleReviewEditor key={String(reviewModule.id)} module={reviewModule as unknown as ModuleEvaluationScore} traceId={record.trace?.id} onSubmit={onModuleReview} onClose={() => setReviewModule(undefined)} /><details className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-xs font-semibold">查看 Evidence / Rubric</summary><div className="mt-3"><EvidenceBundleContent module={reviewModule} evidence={(data.rootEvidence ?? data.evidence.map((item) => ({ ...item, content: item.summary }))) as unknown as Array<Record<string, unknown>>} onNavigateReference={openReference} /></div></details>{onReviewHistory && <div className="mt-3"><Button onClick={() => { onReviewHistory(String(reviewModule.id)); setReviewModule(undefined) }}>查看复核历史</Button></div>}</DetailDrawer>}
  </div>
}
