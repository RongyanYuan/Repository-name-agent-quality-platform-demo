import { useEffect, useRef, useState } from 'react'
import { Button, EmptyState, Field, InlineNotice, SectionHeader, SelectInput, TextArea, TextInput } from '../../ui'
import type { EvolutionState, EvaluationVerdict } from '../domain'
import { DetailDrawer, IdLink, type ReferenceTarget } from '../components/ViewPrimitives'
import { formatNormalizedScoreOutOfTwo } from '../score'
import { outcomeScoreOutOfTwo, selectArtifactOutcomeEvaluations, type ArtifactOutcomeEvaluation } from '../data/artifactOutcomes'
import { validateOutcomeReviewInput, type OutcomeReviewInput } from '../outcomeReviews'

export interface CaseOutcomeEvaluationsProps {
  state: EvolutionState
  traceId: string
  initialArtifactId?: string
  initialEvaluationId?: string
  evaluationId?: string
  onNavigateReference?: (reference: ReferenceTarget) => void
  onReview?: (input: OutcomeReviewInput) => Promise<void>
  onOpenObservation?: (id: string) => void
}
const scoreText = (score?: number) => formatNormalizedScoreOutOfTwo(score, '未评测')
const timeText = (at?: string) => at && !Number.isNaN(Date.parse(at)) ? `${new Date(at).toLocaleString('zh-CN', { timeZone:'Asia/Shanghai',hour12:false })} GMT+8` : '时间未记录'

function OutcomeReviewHistory({ row }: { row: ArtifactOutcomeEvaluation }) {
  return <details className="rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-xs font-semibold">复核历史（{row.history.length} 条）</summary>
    <div className="mt-3 space-y-3">{row.history.map(revision => <div key={revision.id} className="rounded bg-slate-50 p-3 text-xs leading-5">
      <p className="font-semibold">{scoreText(outcomeScoreOutOfTwo(revision.score, revision.scoreScale ?? '0-1'))} · {revision.evaluator} · {timeText(revision.evaluatedAt)}</p>
      <p>{revision.reason}</p>
      <p className="mt-1 break-all text-[10px] text-muted">{revision.id} · {revision.applicable ? '当前自动版本的复核' : '历史自动版本的复核'}<br />绑定自动版本：{revision.automaticRevisionId ?? '历史记录按原自动结果关联'}<br />评测版本：{revision.evalVersion ?? '历史未记录'} · Eval Agent：{revision.evalAgentVersion ?? '历史未记录'}<br />Rubric：{revision.rubricRule ?? '历史未记录'}<br />根证据：{revision.evidenceIds.join('、') || '未记录'}</p>
      {revision.automaticSnapshot && <p className="mt-2 text-[11px] text-muted">当时自动分数：{scoreText(outcomeScoreOutOfTwo(revision.automaticSnapshot.score, revision.automaticSnapshot.scoreScale))} · {revision.automaticSnapshot.reason}</p>}
    </div>)}{!row.history.length && <p className="text-xs text-muted">尚无人工复核记录</p>}</div>
  </details>
}

function OutcomeReviewEditor({ row, onReview, onClose }: { row: ArtifactOutcomeEvaluation; onReview: (input: OutcomeReviewInput) => Promise<void>; onClose: () => void }) {
  const [score, setScore] = useState(row.humanScore === undefined ? '' : String(row.humanScore))
  const [verdict, setVerdict] = useState<EvaluationVerdict>(row.manual?.verdict ?? 'UNKNOWN')
  const [reason, setReason] = useState(row.manual?.reason ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const submit = async () => {
    if (pending.current) return
    setError('')
    const input: OutcomeReviewInput = { traceId: row.evaluation.traceId, artifactId: row.evaluation.artifactId, evaluationId: row.evaluation.id, automaticRevisionId: row.automaticRevisionId, humanScore: score.trim() === '' ? undefined : Number(score), verdict, reason, reviewer: '当前用户', reviewedAt: new Date().toISOString(), reviewId: `outcome-review-${row.evaluation.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
    try {
      validateOutcomeReviewInput(input, row.evaluation)
      pending.current = true; setSaving(true)
      await onReview(input)
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') }
    finally { pending.current = false; setSaving(false) }
  }
  return <section aria-label="产物细项人工复核" className="rounded-lg border border-accent/20 bg-accent/5 p-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="自动分数（0–2）"><TextInput aria-label="产物自动分数（0–2）" value={scoreText(row.automaticScore)} readOnly /></Field>
      <Field label="人工分数（0–2）" hint="0 和 2 均为有效边界；未评测或不适用可留空"><TextInput aria-label="产物人工分数（0–2）" type="number" min="0" max="2" step="0.01" value={score} onChange={event => setScore(event.target.value)} /></Field>
      <Field label="辅助结论"><SelectInput aria-label="产物辅助结论" value={verdict} onChange={event => setVerdict(event.target.value as EvaluationVerdict)}><option value="UNKNOWN">未确定</option><option value="PASS">通过</option><option value="FAIL">不通过</option><option value="NOT_APPLICABLE">不适用</option></SelectInput></Field>
      <Field label="自动 Judge Reason"><p className="rounded border border-line bg-white p-2 text-xs leading-5 text-muted">{row.automatic?.reason ?? '未记录'}</p></Field>
      <Field label="复核说明" required className="sm:col-span-2"><TextArea aria-label="产物复核说明" value={reason} onChange={event => setReason(event.target.value)} placeholder="说明根证据如何支持这项评分" /></Field>
    </div>
    <p className="mt-3 break-all text-[11px] text-muted">自动版本：{row.automaticRevisionId} · 评测版本：{row.evaluation.evalVersion}</p>
    {error && <InlineNotice title="保存失败" tone="fail" className="mt-3">{error}。当前输入已保留，可修正后重试。</InlineNotice>}
    <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button variant="primary" loading={saving} onClick={() => void submit()}>保存产物复核</Button></div>
  </section>
}

export function CaseOutcomeEvaluations({ state, traceId, initialArtifactId, initialEvaluationId, evaluationId, onNavigateReference, onReview, onOpenObservation }: CaseOutcomeEvaluationsProps) {
  const groups = selectArtifactOutcomeEvaluations(state, traceId)
  const targetEvaluationId = initialEvaluationId ?? evaluationId
  const targetArtifact = initialArtifactId ?? state.outcomeEvals.find(item => item.id === targetEvaluationId)?.artifactId
  const [artifactId, setArtifactId] = useState(targetArtifact ?? groups[0]?.artifact.id)
  const [selectedId, setSelectedId] = useState<string | undefined>(targetEvaluationId)
  const [reviewId, setReviewId] = useState<string>()
  useEffect(() => { setArtifactId(targetArtifact ?? selectArtifactOutcomeEvaluations(state, traceId)[0]?.artifact.id); setSelectedId(targetEvaluationId); setReviewId(undefined) }, [traceId, targetArtifact, targetEvaluationId])
  const group = groups.find(item => item.artifact.id === artifactId) ?? groups[0]
  const rows = group ? [...(group.finalEvaluation ? [group.finalEvaluation] : []), ...group.dimensions] : []
  const selected = rows.find(row => row.evaluation.id === selectedId)
  const reviewing = rows.find(row => row.evaluation.id === reviewId)
  if (!group) return <EmptyState title="当前 Trace 无产物" description="不会借用同 Case 其他 Trace 的产物或评分。" />
  const artifact = group.artifact
  return <div className="space-y-4" aria-label="当前 Trace 产物评测">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-line bg-slate-50 p-3">
      <Field label="产物" className="min-w-0 flex-1"><SelectInput aria-label="选择评测产物" value={artifact.id} onChange={event => { setArtifactId(event.target.value); setSelectedId(undefined); setReviewId(undefined) }}>{groups.map(item => <option key={item.artifact.id} value={item.artifact.id}>{item.artifact.name} · {item.artifact.version}</option>)}</SelectInput></Field>
      <div className="text-right"><p className="text-[10px] text-muted">产物最终评分（0–2）</p><p className="mt-1 font-mono text-lg font-semibold text-accent">{scoreText(group.finalEvaluation?.effectiveScore)}</p></div>
    </div>
    <div className="flex flex-wrap justify-between gap-3 text-xs">
      <div className="min-w-0"><p className="font-semibold">{artifact.name}</p><p className="mt-1 text-[11px] text-muted">{artifact.verticalScenario ?? artifact.kind} · 版本 {artifact.version} · {artifact.status === 'AVAILABLE' ? '可用' : artifact.status === 'MISSING' ? '未生成' : '不可用'}</p><div className="mt-2"><IdLink kind="artifact" id={artifact.id} onOpen={onNavigateReference} /></div></div>
      {/^(https?:)/.test(artifact.uri) ? <a href={artifact.uri} target="_blank" rel="noreferrer" className="self-start rounded border border-line px-3 py-2 text-accent">预览 / 下载产物</a> : <p className="max-w-xs text-[11px] leading-5 text-muted">Mock 产物引用，尚未接入真实文件存储；不提供虚构下载。</p>}
    </div>
    <section className="rounded-lg border border-line p-3"><SectionHeader title="产物细项评分" level={3} description="0–2；最终评分仅取已有记录，不从细项平均推导。自动结果与人工复核分别保留。" />
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-line bg-slate-50 text-[10px] text-muted"><tr><th className="p-2">维度</th><th className="p-2">自动评分</th><th className="p-2">人工评分</th><th className="p-2">评测版本 / 时间</th><th className="p-2">操作</th></tr></thead><tbody>{rows.map(row => <tr key={row.evaluation.id} className="border-b border-line last:border-0"><td className="max-w-[200px] p-2 font-medium">{row === group.finalEvaluation ? '最终评分' : row.evaluation.dimension}<p className="mt-1 text-[10px] font-normal text-muted">{row.rubricRule === '待配置' ? 'Rubric 待配置' : '已有评测记录'}</p></td><td className="whitespace-nowrap p-2 font-mono">{scoreText(row.automaticScore)}</td><td className="whitespace-nowrap p-2 font-mono">{row.manual ? scoreText(row.humanScore) : '未复核'}</td><td className="max-w-[210px] break-all p-2 text-[10px] leading-5 text-muted">{row.evaluation.evalVersion}<br />{timeText(row.evaluatedAt)}</td><td className="p-2"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setSelectedId(row.evaluation.id)}>评分依据</Button>{onReview && row !== group.finalEvaluation && <Button size="sm" onClick={() => setReviewId(row.evaluation.id)}>人工复核</Button>}</div></td></tr>)}</tbody></table></div>
      {!rows.length && <EmptyState title="未评测" description="此产物尚无最终或细项记录，不复制 Trace 总分。" />}
      {!group.dimensions.length && rows.length > 0 && <p className="mt-3 text-xs text-muted">细项未评测；仅展示已记录的最终结果。</p>}
    </section>
    <DetailDrawer open={Boolean(selected || reviewing)} onClose={() => { setSelectedId(undefined); setReviewId(undefined) }} title={`${(reviewing ?? selected)?.evaluation.dimension ?? '产物评分'} · ${reviewing ? '人工复核' : '评分依据'}`} description="按当前 Trace、产物、细项及自动版本保留完整依据。">
      {(reviewing ?? selected) && (() => { const row = (reviewing ?? selected)!; return <div className="space-y-4">
        <div className="flex flex-wrap gap-3 text-xs"><span>自动 {scoreText(row.automaticScore)}</span><span>人工 {row.manual ? scoreText(row.humanScore) : '未复核'}</span><IdLink kind="outcome-eval" id={row.evaluation.id} onOpen={onNavigateReference} /></div>
        <div className="rounded-lg border border-line p-3 text-xs leading-6"><p className="font-semibold">Judge Reason</p><p>{row.automatic?.reason ?? '未记录'}</p>{row.manual && <p className="mt-2">人工说明：{row.manual.reason}</p>}</div>
        <div className="rounded-lg border border-line p-3 text-xs leading-6"><p className="font-semibold">Rubric</p><p>{row.rubricRule}</p><p className="mt-1 text-[11px] text-muted">Eval Agent：{row.evalAgentVersion} · 评测版本：{row.evaluation.evalVersion}<br />评测时间：{timeText(row.evaluatedAt)}<br /><span className="break-all">自动版本：{row.automaticRevisionId}</span></p></div>
        <section className="rounded-lg border border-line p-3"><h4 className="text-xs font-semibold">根证据</h4><div className="mt-2 space-y-2">{row.evidence.map(evidence => <div key={evidence.id} className="rounded bg-slate-50 p-3 text-xs leading-5"><p className="font-semibold">{evidence.title}</p><p className="mt-1 whitespace-pre-wrap">{evidence.content}</p><p className="mt-1 text-[10px] text-muted">{evidence.source}</p><div className="mt-2 flex flex-wrap gap-3"><IdLink kind="evidence" id={evidence.id} onOpen={onNavigateReference ? target => onNavigateReference({ ...target, caseView: 'outcome', artifactId: row.evaluation.artifactId, evaluationId: row.evaluation.id }) : undefined} />{evidence.observationId && <Button size="sm" onClick={() => onOpenObservation?.(evidence.observationId!)}>查看执行节点</Button>}</div></div>)}</div>{!row.evidence.length && <p className="mt-2 text-xs text-muted">根证据未记录</p>}</section>
        {reviewing && onReview && <OutcomeReviewEditor key={`${row.evaluation.id}-${row.automaticRevisionId}`} row={row} onReview={onReview} onClose={() => setReviewId(undefined)} />}
        <OutcomeReviewHistory row={row} />
      </div> })()}
    </DetailDrawer>
  </div>
}
