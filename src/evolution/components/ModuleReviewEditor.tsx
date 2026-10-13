import { useRef, useState } from 'react'
import { Button, Field, SelectInput, TextArea, TextInput, InlineNotice } from '../../ui'
import type { ModuleEvaluationScore, ModuleEvaluationStatus } from '../domain'
import type { ModuleReviewInput } from '../reviews'
import { automaticModuleRevisionId, validateModuleReviewInput, formatAutomaticModuleScore } from '../reviews'

export interface ModuleReviewEditorProps {
  module: ModuleEvaluationScore
  traceId?: string
  packageId?: string
  open?: boolean
  onClose?: () => void
  onSubmit: (input: ModuleReviewInput) => Promise<void>
}

export function ModuleReviewEditor({ module, traceId = module.traceId, packageId = module.packageId, open = true, onClose, onSubmit }: ModuleReviewEditorProps) {
  const [score, setScore] = useState(module.humanScore === undefined ? '' : String(module.humanScore))
  const [verdict, setVerdict] = useState<ModuleEvaluationStatus>(module.humanStatus ?? 'UNKNOWN')
  const [reason, setReason] = useState(module.humanNote ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const submit = async () => {
    if (pending.current) return
    setError('')
    const humanScore = score.trim() === '' ? undefined : Number(score)
    const input: ModuleReviewInput = { traceId, packageId, moduleScoreId: module.id, automaticRevisionId: automaticModuleRevisionId(module), humanScore, auxiliaryVerdict: verdict, reason, reviewer: '当前用户', reviewedAt: new Date().toISOString(), reviewId: `review-${module.id}-${Date.now()}` }
    try {
      validateModuleReviewInput(input, module)
      pending.current = true
      setSaving(true)
      await onSubmit(input)
      onClose?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } finally { pending.current = false; setSaving(false) }
  }
  if (!open) return null
  return <section aria-label="人工复核编辑器" className="rounded-lg border border-accent/20 bg-accent/5 p-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="自动分数（0–2）" hint="只读，自动结果保持原始记录"><TextInput value={formatAutomaticModuleScore(module)} readOnly aria-label="自动分数（0–2）" /></Field>
      <Field label="人工分数（0–2）" hint="0 和 2 均为有效边界；UNKNOWN / N/A 可留空"><TextInput aria-label="人工分数（0–2）" type="number" min="0" max="2" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} /></Field>
      <Field label="辅助结论"><SelectInput aria-label="辅助结论" value={verdict} onChange={(event) => setVerdict(event.target.value as ModuleEvaluationStatus)}><option>PASS</option><option>FAIL</option><option>DERIVED_FAIL</option><option>UNKNOWN</option><option>N/A</option></SelectInput></Field>
      <Field label="自动 Judge Reason" hint="只读，人工说明单独保存"><p className="min-h-9 rounded-md border border-line bg-white px-2.5 py-2 text-xs text-muted">{module.judgeReason || '未记录'}</p></Field>
      <Field label="复核说明" required className="sm:col-span-2"><TextArea aria-label="复核说明" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明证据如何支持人工结论" /></Field>
    </div>
    <div className="mt-3 space-y-1 break-all text-[11px] leading-5 text-muted"><p>Trace：{traceId} · 评测包：{packageId}</p><p>自动版本：{automaticModuleRevisionId(module)}</p><p>评测版本：{module.evalAgentVersion} · Rubric：{module.rubricVersion}</p><p>Rubric Rule：{module.evidence.rubricRule || '未记录'}</p><p>根证据：{module.evidence.rootEvidenceIds.length ? module.evidence.rootEvidenceIds.map((id) => <span key={id} className="mr-2">{id}</span>) : '未记录'}</p><p>最近复核：{module.humanUpdatedBy ?? '未复核'} {module.humanUpdatedAt ?? ''}</p></div>
    {error && <InlineNotice tone="fail" title="保存失败" className="mt-3">{error}。已保留当前输入，请修正后重试。</InlineNotice>}
    <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button variant="primary" loading={saving} onClick={submit}>保存人工复核</Button></div>
  </section>
}
