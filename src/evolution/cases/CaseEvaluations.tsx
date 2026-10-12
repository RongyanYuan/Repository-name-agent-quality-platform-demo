import { useState } from 'react'
import { Button, EmptyState, SectionHeader, StatusBadge } from '../../ui'
import type { EvalResult } from '../../domain'
import { ModuleEvaluationMatrix, type ModuleEvaluationRecord } from '../components/ModuleEvaluationMatrix'
import { EvidenceBundleDrawer } from '../components/EvidenceBundleDrawer'
import { IdLink } from '../components/ViewPrimitives'
import { governanceLabel } from '../labels'
import type { CaseAnalysisData, CaseAnalysisRecord, CaseReference } from './model'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'

export function CaseEvaluations({ record, data, onNavigate, onBackToTrace }: { record: CaseAnalysisRecord; data: CaseAnalysisData; onNavigate?: (reference: CaseReference) => void; onBackToTrace: (id?: string) => void }) {
  const [module, setModule] = useState<ModuleEvaluationRecord>()
  const openReference = onNavigate ? (reference: { kind: CaseReference['kind']; id: string }) => onNavigate({ ...reference, label: reference.id }) : undefined
  const group = (title: string, items: EvalResult[], kind: 'process-eval' | 'outcome-eval') => <section className="rounded-lg border border-line p-3">
    <SectionHeader title={title} level={3} description="自动评测与人工结论分开保留，历史记录不覆盖。" />
    <div className="mt-3 space-y-2">{items.map((item) => <div key={item.id} className="rounded border border-line bg-slate-50 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{item.dimension}</span><span className="font-mono font-semibold text-accent">{item.humanScore !== undefined ? formatNormalizedScoreOutOfTwo(item.humanScore) : formatLegacyScoreOutOfTwo(item.score)}</span></div><p className="mt-1 text-[10px] text-muted">评分口径：0–2 · 自动评分 {formatLegacyScoreOutOfTwo(item.score)} · 人工评分 {item.humanScore !== undefined ? formatNormalizedScoreOutOfTwo(item.humanScore) : '未复核'}</p><p className="mt-2 text-[11px] leading-5">LLM Judge Reason：{item.humanReason ?? item.reason ?? item.autoReason}</p><div className="mt-2 flex flex-wrap gap-2"><IdLink id={item.id} kind={kind} onOpen={openReference} />{item.evidenceIds.map((id) => <IdLink key={id} id={id} kind="evidence" label={`查看 Evidence ${id}`} onOpen={openReference} />)}</div></div>)}</div>
    {!items.length && <EmptyState className="min-h-[100px]" title={record.moduleEvaluations?.length ? '独立评测记录未入库' : '未评测'} description={record.moduleEvaluations?.length ? '当前 Trace 的模块评测包与证据见上方矩阵；独立评测列表尚无对应记录，不重复推断结论。' : '当前无此类评测，缺失不会被当作 PASS。'} />}
  </section>
  return <div className="space-y-3">
    {record.moduleEvaluations?.length ? <section className="rounded-lg border border-line p-3"><SectionHeader level={3} title="Trace 模块评测矩阵" description="当前 Trace 的评分、LLM Judge Reason 与根证据；上文仅作为证据。" /><ModuleEvaluationMatrix className="mt-3" modules={record.moduleEvaluations} compact onSelect={setModule} /></section> : null}
    {record.evaluationScenarios?.length ? <section className="rounded-lg border border-line p-3"><SectionHeader level={3} title="评测 Agent 返回场景与自进化路径" /><div className="mt-3 space-y-2">{record.evaluationScenarios.map((scenario, index) => <div key={scenario.findingId ?? index} className="rounded border border-line p-3 text-xs"><p className="font-semibold">{scenario.label} · {scenario.dimension}</p><p className="mt-1 leading-5 text-muted">{scenario.path.replaceAll('Agent迭代', 'Agent 迭代')}</p>{scenario.findingId && <IdLink id={scenario.findingId} kind="finding" label={`查看 Finding ${scenario.findingId}`} onOpen={openReference} />}</div>)}</div></section> : null}
    {record.tastePreference && <section className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs"><SectionHeader level={3} title="品味 Skill 批量偏好聚合" /><p className="mt-3">{record.tastePreference.preferenceCount} 人 / {record.tastePreference.populationTotal} 人 · 偏好{record.tastePreference.preferenceValue} {Math.round(record.tastePreference.preferenceRate * 100)}%</p><p className="mt-1">相关数据 {record.tastePreference.relatedDataCount} / {record.tastePreference.relatedDataThreshold} 条 · {governanceLabel(record.tastePreference.routingLabel)}</p><p className="mt-2 text-[11px] leading-5 text-muted">{record.tastePreference.judgeReason}</p></section>}
    {group('过程评测', record.processEvals, 'process-eval')}{group('产物 / 结果评测', record.outcomeEvals, 'outcome-eval')}
    <Button onClick={() => onBackToTrace(record.artifacts[0]?.sourceObservationIds[0])}>回到相关执行过程</Button>
    <EvidenceBundleDrawer open={Boolean(module)} module={module} onClose={() => setModule(undefined)} evidence={(data.rootEvidence ?? data.evidence.map((item) => ({ ...item, content: item.summary }))) as unknown as Array<Record<string, unknown>>} onNavigateReference={openReference} />
  </div>
}
