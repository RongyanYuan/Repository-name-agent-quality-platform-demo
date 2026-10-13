import { Fragment, useEffect, useRef, useState } from 'react'
import { Button, StatusBadge, cn } from '../../ui'
import type { EvalResult } from '../../domain'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo, legacyScoreOutOfTwo, normalizedScoreOutOfTwo } from '../score'
import { StatusIndicator } from './StatusIndicator'
import { IdLink, type ReferenceTarget } from './ViewPrimitives'

export type ModuleEvaluationRecord = Record<string, unknown> & { id?: string }
export interface ProcessDimension { id?: string; module: string; dimension: string; score?: number; scoreId?: string }
export type ProcessEvaluationDetail = EvalResult & { moduleCode?: string; observationId?: string; scoreScale?: '0-1' | '0-2' }
export interface ModuleEvolutionSelection { module: ModuleEvaluationRecord; processEvaluationId?: string; scoreDimensionId?: string }

const MODULE_ORDER = ['Reason', '记忆', '上文', 'skill', 'Act', 'Tool', 'Outcome / 产物'] as const

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof fallback === 'string' ? fallback : String(fallback ?? '—')
}

const first = (item: ModuleEvaluationRecord, keys: string[], fallback?: unknown) => {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

const normalizeModule = (item: ModuleEvaluationRecord) => {
  const value = text(first(item, ['moduleLabel', 'module', 'moduleCode', 'name']), '未知模块')
  const lower = value.toLocaleLowerCase()
  if (lower.includes('outcome') || lower.includes('产物') || lower.includes('结果')) return 'Outcome / 产物'
  if (lower.includes('memory') || value === '记忆') return '记忆'
  if (lower.includes('context') || value === '上文') return '上文'
  if (lower.includes('skill')) return 'skill'
  if (lower.includes('reason')) return 'Reason'
  if (lower.includes('tool')) return 'Tool'
  if (lower.includes('act')) return 'Act'
  return value
}

const statusLabel = (status: unknown) => {
  const normalized = text(status, 'UNKNOWN').toUpperCase()
  if (normalized === 'DERIVED_FAIL' || normalized === 'DERIVED FAILURE' || normalized === 'DERIVED') return '派生失败'
  if (normalized === 'NOT_APPLICABLE' || normalized === 'N/A') return 'N/A'
  if (normalized === 'PASS') return 'PASS'
  if (normalized === 'FAIL') return 'FAIL'
  return 'UNKNOWN'
}

export function moduleEvaluationStatus(item: ModuleEvaluationRecord) {
  return first(item, ['humanStatus', 'humanVerdict', 'manualStatus', 'status', 'autoStatus', 'verdict'], 'UNKNOWN')
}

export function ModuleEvaluationMatrix({ modules, onSelect, onReview, onReviewHistory, selectedId, compact = false, className, mode = 'all', dimensions = [], evaluations = [], onNavigateReference, onOpenObservation, initialEvaluationId, onOpenEvolution, getEvolutionSummary }: { modules: ModuleEvaluationRecord[]; onSelect?: (module: ModuleEvaluationRecord) => void; onReview?: (module: ModuleEvaluationRecord) => void; onReviewHistory?: (module: ModuleEvaluationRecord) => void; selectedId?: string; compact?: boolean; className?: string; mode?: 'all' | 'process'; dimensions?: ProcessDimension[]; evaluations?: ProcessEvaluationDetail[]; onNavigateReference?: (target: ReferenceTarget) => void; onOpenObservation?: (id?: string) => void; initialEvaluationId?: string; onOpenEvolution?: (selection: ModuleEvolutionSelection) => void; getEvolutionSummary?: (selection: ModuleEvolutionSelection) => string }) {
  const [expandedModules, setExpandedModules] = useState<string[]>([])
  const linkedArticle = useRef<HTMLElement>(null)
  const byModule = new Map<string, ModuleEvaluationRecord>()
  modules.forEach((item) => {
    const module = normalizeModule(item)
    if ((mode !== 'process' || module !== 'Outcome / 产物') && !byModule.has(module)) byModule.set(module, item)
  })
  const moduleOrder = MODULE_ORDER.filter(module => mode !== 'process' || module !== 'Outcome / 产物')
  const evaluationModule = (evaluation: ProcessEvaluationDetail): string | undefined => {
    if (evaluation.moduleCode) return normalizeModule({ moduleCode: evaluation.moduleCode })
    if (evaluation.observationId) {
      const matched = [...byModule.entries()].filter(([, item]) => {
        const bundle = item.evidence && typeof item.evidence === 'object' ? item.evidence as Record<string, unknown> : {}
        return item.observationId === evaluation.observationId || (Array.isArray(bundle.observationIds) && bundle.observationIds.includes(evaluation.observationId))
      })
      if (matched.length === 1) return matched[0][0]
    }
    return undefined
  }
  const unlinkedEvaluations = evaluations.filter(evaluation => !evaluationModule(evaluation))
  const linkedEvaluation = evaluations.find(evaluation => evaluation.id === initialEvaluationId)
  const linkedModule = linkedEvaluation ? evaluationModule(linkedEvaluation) ?? '未关联模块' : undefined
  useEffect(() => {
    if (!linkedModule || linkedModule === '上文' || linkedModule === 'Outcome / 产物') return
    setExpandedModules(current => current.includes(linkedModule) ? current : [...current, linkedModule])
  }, [initialEvaluationId, linkedModule])
  useEffect(() => {
    if (!linkedModule || !expandedModules.includes(linkedModule)) return
    linkedArticle.current?.scrollIntoView?.({ block: 'center' })
    linkedArticle.current?.focus({ preventScroll: true })
  }, [initialEvaluationId, linkedModule, expandedModules])
  const additionalModules = [...new Set(evaluations.map(evaluationModule).filter((module): module is string => Boolean(module) && module !== 'Outcome / 产物' && module !== '上文'))].filter(module => !byModule.has(module) && !moduleOrder.includes(module as (typeof MODULE_ORDER)[number]))
  const ordered: ModuleEvaluationRecord[] = [...moduleOrder.map((module) => byModule.get(module) ?? ({ id: `missing-${module}`, moduleLabel: module, module, status: 'UNKNOWN', isMissing: true } as ModuleEvaluationRecord)), ...[...byModule.entries()].filter(([module]) => !moduleOrder.includes(module as (typeof MODULE_ORDER)[number])).map(([, item]) => item), ...additionalModules.map(module => ({ id: `missing-${module}`, moduleLabel: module, status: 'UNKNOWN', isMissing: true })), ...(unlinkedEvaluations.length ? [{ id: 'unlinked-process', moduleLabel: '未关联模块', status: 'UNKNOWN', isMissing: true }] : [])]
  const toggleDetails = (module: string) => setExpandedModules(current => current.includes(module) ? current.filter(value => value !== module) : [...current, module])
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-line', className)}>
      {initialEvaluationId && !linkedEvaluation && <p role="status" aria-label="关联过程评测未找到" className="border-b border-line bg-slate-50 px-3 py-2 text-xs leading-5 text-muted">当前 Trace 未找到过程评测 {initialEvaluationId}；未用其他 Trace 的评分替代。</p>}
      {linkedModule === '上文' && <p role="status" className="border-b border-line bg-slate-50 px-3 py-2 text-xs text-muted">关联记录仅用于上文证据，不显示独立评分；请从上文行查看 Evidence。</p>}
      <table className={cn('w-full min-w-[720px] border-collapse text-left text-xs', compact && 'min-w-[620px]')}>
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">模块</th>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">自动分数（0–2）</th>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">人工分数（0–2）</th>
            <th className="border-b border-line px-3 py-2 font-semibold">判定依据 / 首错关系</th>
            {onOpenEvolution && <th className="border-b border-line px-3 py-2 font-semibold">进化状态</th>}
            <th className="border-b border-line px-2 py-2 font-semibold">Evidence / 人工复核</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordered.map((item) => {
            const module = normalizeModule(item)
            const auto = first(item, ['autoStatus', 'autoVerdict', 'automaticStatus', 'verdict', 'status'], 'UNKNOWN')
            const human = first(item, ['humanStatus', 'humanVerdict', 'manualStatus'], undefined)
            const humanScore = first(item, ['humanScore', 'human_score'], undefined)
            const reason = text(first(item, ['judgeReason', 'reason', 'autoReason', 'description']), item.isMissing ? '本次 Rubric 未覆盖或缺少观测，未根据最终产物补判。' : '判定依据未记录')
            const bundle = item.evidence && typeof item.evidence === 'object' ? item.evidence as Record<string, unknown> : {}
            const derived = Boolean(first(item, ['derivedFrom', 'derivedFailureFrom', 'isDerived'], bundle.derivedFailure ?? false)) || String(auto).toUpperCase() === 'DERIVED_FAIL'
            const firstFailure = Boolean(first(item, ['firstFailure', 'isFirstFailure', 'rootCause'], bundle.firstFailure ?? false))
            const isMissing = Boolean(item.isMissing)
            const contextOnly = module === '上文'
            const autoScore = first(item, ['autoScore', 'score'], undefined)
            const formattedAutoScore = item.scoreScale === '0-2' ? formatNormalizedScoreOutOfTwo(autoScore) : formatLegacyScoreOutOfTwo(autoScore)
            const comparableAuto = item.scoreScale === '0-2' ? normalizedScoreOutOfTwo(autoScore) : legacyScoreOutOfTwo(autoScore)
            const comparableHuman = normalizedScoreOutOfTwo(humanScore)
            const disagreement = Boolean(human) && (String(human).toUpperCase() !== String(auto).toUpperCase() || (comparableAuto !== undefined && comparableHuman !== undefined && Math.abs(comparableAuto - comparableHuman) > 0.00001))
            const moduleDimensions = contextOnly ? [] : dimensions.filter(dimension => dimension.scoreId ? dimension.scoreId === item.id : normalizeModule({ moduleCode: dimension.module }) === module)
            const moduleEvaluations = contextOnly ? [] : module === '未关联模块' ? unlinkedEvaluations : evaluations.filter(evaluation => evaluationModule(evaluation) === module)
            const hasDetails = moduleDimensions.length > 0 || moduleEvaluations.length > 0
            const expanded = expandedModules.includes(module)
            const evolutionEntry = Boolean(onOpenEvolution && !isMissing && !contextOnly && module !== 'Outcome / 产物')
            const openDefault = () => { if (isMissing) return; if (evolutionEntry) onOpenEvolution?.({ module: item }); else onSelect?.(item) }
            return (
              <Fragment key={String(item.id ?? module)}><tr className={cn((onSelect || evolutionEntry) && !isMissing && 'cursor-pointer transition hover:bg-slate-50', selectedId === item.id && 'bg-accent/5')} onClick={openDefault}>
                <td className="px-3 py-2.5 align-top">{evolutionEntry ? <button type="button" aria-label={`查看 ${module} 进化历史`} className="rounded font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={event => { event.stopPropagation(); onOpenEvolution?.({ module: item }) }}>{module}</button> : <div className="font-semibold text-ink">{module}</div>}{module === '上文' && <div className="mt-1 text-[10px] text-muted">仅作为证据，不单独统计 Context 指标</div>}{hasDetails && <Button variant="ghost" size="sm" className="mt-1" aria-label={`查看 ${module} 细项评分`} aria-expanded={expanded} onClick={event => { event.stopPropagation(); toggleDetails(module) }}>{expanded ? '收起细项' : `细项评分（${moduleDimensions.length + moduleEvaluations.length}）`}</Button>}</td>
                <td className="px-3 py-2.5 align-top text-[11px] text-ink">{contextOnly ? '—' : <><p className="font-mono">{formattedAutoScore}</p><StatusIndicator className="mt-1" context="verdict" status={String(auto)} label={`自动：${statusLabel(auto)}`} /></>}</td>
                <td className="px-3 py-2.5 align-top text-[11px] text-ink">{contextOnly ? '证据说明' : <><p className="font-mono">{human ? formatNormalizedScoreOutOfTwo(humanScore, '未评分') : '未复核'}</p><StatusIndicator className="mt-1" context="review" status={human ? 'REVIEWED' : item.reviewState === 'STALE' ? 'STALE' : 'UNREVIEWED'} />{human && <StatusIndicator className="mt-1" context="verdict" status={String(human)} label={`人工：${statusLabel(human)}`} />}</>}</td>
                <td className="max-w-[420px] px-3 py-2.5 align-top"><p className="line-clamp-2 text-[11px] leading-5 text-muted">自动 Judge Reason：{String(reason)}</p>{Boolean(human) && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink">人工说明：{text(first(item, ['humanNote', 'humanReason']), '未记录')}</p>}<div className="mt-1 flex flex-wrap gap-1.5">{Boolean(firstFailure) && <StatusBadge status="First Failure" label="首个失败" tone="fail" showIcon={false} />}{Boolean(derived) && <StatusBadge status="DERIVED_FAIL" label="派生失败" tone="derived" showIcon={false} />}{disagreement && <StatusBadge status="Eval Disagreement" label="自动 / 人工不一致" tone="warn" showIcon={false} />}</div></td>
                {onOpenEvolution && <td className="max-w-[180px] px-3 py-2.5 align-top"><p className="text-[11px] leading-5 text-muted">{contextOnly ? '仅证据' : isMissing ? '未关联评分' : getEvolutionSummary?.({ module: item }) ?? '未关联进化路径'}</p>{!contextOnly && !isMissing && module !== 'Outcome / 产物' && <Button variant="ghost" size="sm" className="mt-1" aria-label={`查看 ${module} 进化详情`} onClick={event => { event.stopPropagation(); onOpenEvolution({ module: item }) }}>查看进化详情</Button>}</td>}
                <td className="px-2 py-2.5 align-top"><div className="flex flex-wrap gap-1">{onSelect && !isMissing && <Button variant="ghost" size="sm" aria-label={`查看 ${module} Evidence`} onClick={(event) => { event.stopPropagation(); onSelect(item) }}>查看 Evidence</Button>}{!contextOnly && !isMissing && onReview && <Button size="sm" aria-label={`${human ? '修改复核' : '人工复核'} ${module}`} onClick={(event) => { event.stopPropagation(); onReview(item) }}>{human ? '修改复核' : '人工复核'}</Button>}{!contextOnly && !isMissing && onReviewHistory && <Button variant="ghost" aria-label={`查看 ${module} 复核历史`} onClick={(event) => { event.stopPropagation(); onReviewHistory(item) }}>复核历史</Button>}</div>{!contextOnly && !isMissing && !onReview && <p className="mt-1 text-[10px] text-muted">只读：当前入口未开放复核</p>}{isMissing && <p className="text-[10px] text-muted">未评测，无模块记录</p>}</td>
              </tr>{expanded && hasDetails && <tr className="bg-slate-50/70"><td colSpan={onOpenEvolution ? 6 : 5} className="p-3"><section aria-label={`${module} 细项评分`} className="space-y-2">
                {moduleDimensions.length > 0 && <div className="overflow-hidden rounded-md border border-line bg-white"><div className="flex justify-between gap-3 border-b border-line px-3 py-2 text-[10px] font-semibold text-muted"><span>模块 Rubric 细项</span><span>自动评分（0–2）</span></div>{moduleDimensions.map((dimension, index) => {
                  const selection = { module: item, scoreDimensionId: dimension.id ?? dimension.dimension }
                  return <div key={dimension.id ?? `${dimension.dimension}-${index}`} className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"><div className="min-w-0"><p>{dimension.dimension}</p>{onOpenEvolution && <p className="mt-1 text-[10px] text-muted">{getEvolutionSummary?.(selection) ?? '未关联进化路径'}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-3"><span className="font-mono">{formatNormalizedScoreOutOfTwo(dimension.score)}</span>{onOpenEvolution && !isMissing && <Button size="sm" variant="ghost" aria-label={`查看 ${dimension.dimension} 进化详情`} onClick={() => onOpenEvolution(selection)}>查看进化详情</Button>}</div></div>
                })}</div>}
                {moduleEvaluations.map(evaluation => <article key={evaluation.id} ref={evaluation.id === initialEvaluationId ? linkedArticle : undefined} tabIndex={evaluation.id === initialEvaluationId ? -1 : undefined} aria-label={`过程细项 · ${evaluation.dimension}`} className={cn('rounded-md border bg-white p-3 outline-none', evaluation.id === initialEvaluationId ? 'border-accent ring-1 ring-accent/20' : 'border-line')}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{evaluation.dimension}</p><span className="font-mono">{evaluation.scoreScale === '0-2' ? formatNormalizedScoreOutOfTwo(evaluation.score) : formatLegacyScoreOutOfTwo(evaluation.score)}</span></div>
                  <p className="mt-1 text-[10px] text-muted">自动评分（0–2） · 人工评分 {evaluation.humanScore === undefined ? '未复核' : formatNormalizedScoreOutOfTwo(evaluation.humanScore)} · 评测版本 {evaluation.judgeVersion || '未记录'}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5">LLM Judge Reason：{evaluation.autoReason || '未记录'}</p>
                  {evaluation.humanReason && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5">人工说明：{evaluation.humanReason}</p>}
                  {onOpenEvolution && !isMissing && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-slate-50 px-3 py-2"><p className="text-[11px] text-muted">{getEvolutionSummary?.({ module: item, processEvaluationId: evaluation.id }) ?? '未关联进化路径'}</p><Button size="sm" variant="ghost" aria-label={`查看 ${evaluation.dimension} 进化详情`} onClick={() => onOpenEvolution({ module: item, processEvaluationId: evaluation.id })}>查看进化详情</Button></div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2"><IdLink id={evaluation.id} kind="process-eval" onOpen={onNavigateReference} />{evaluation.evidenceIds.map(id => <IdLink key={id} id={id} kind="evidence" label={`查看 Evidence ${id}`} onOpen={onNavigateReference} />)}{evaluation.observationId && onOpenObservation && <Button size="sm" aria-label={`查看相关执行节点 ${evaluation.observationId}`} onClick={() => onOpenObservation(evaluation.observationId)}>查看相关执行节点</Button>}</div>
                </article>)}
                {first(item, ['rubricRule'], bundle.rubricRule) ? <p className="rounded-md border border-line bg-white p-3 text-[11px] leading-5"><span className="font-semibold">Rubric：</span>{text(first(item, ['rubricRule'], bundle.rubricRule))}</p> : <p className="text-[10px] text-muted">Rubric 条款待配置；保留实际细项评分，不生成最终分数。</p>}
              </section></td></tr>}</Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { MODULE_ORDER }
