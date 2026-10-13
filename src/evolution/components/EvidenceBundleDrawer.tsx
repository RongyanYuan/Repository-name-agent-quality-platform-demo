import { FileSearch, Link2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DetailDrawer, EntityId, IdLink, KeyValueGrid, type ReferenceTarget } from './ViewPrimitives'
import { Button, SectionHeader, StatusBadge } from '../../ui'
import { formatNormalizedScoreOutOfTwo } from '../score'
import { ModuleReviewEditor } from './ModuleReviewEditor'
import type { ModuleEvaluationScore } from '../domain'
import { formatAutomaticModuleScore } from '../reviews'
import type { ModuleReviewInput } from '../reviews'

type LooseRecord = Record<string, unknown>

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof fallback === 'string' ? fallback : String(fallback ?? '—')
}

const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const first = (item: LooseRecord, keys: string[], fallback?: unknown) => {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

interface EvidenceBundleProps { module?: LooseRecord; evidence?: LooseRecord[]; onNavigateReference?: (target: ReferenceTarget) => void }
export function EvidenceBundleDrawer({ open, onClose, module, evidence = [], onNavigateReference, onSaveOverride, onSaveReview, onReview, reviewOpen = false }: EvidenceBundleProps & { open: boolean; onClose: () => void; onSaveOverride?: (patch: LooseRecord) => void; onSaveReview?: (input: ModuleReviewInput) => Promise<void>; onReview?: () => void; reviewOpen?: boolean }) {
  const [editing, setEditing] = useState(false)
  useEffect(() => { setEditing(reviewOpen) }, [module, reviewOpen])
  const contextOnly = /context|上文/i.test(String(module?.moduleCode ?? module?.module ?? module?.moduleLabel ?? ''))
  return <DetailDrawer open={open} onClose={onClose} title={`${text(first(module ?? {}, ['moduleLabel', 'module', 'moduleCode']), '模块')} Evidence`} description="自动评测、Rubric 与根证据保持不可变关联；Context Assembly 仅作为证据，不单独计入模块指标。">
    <EvidenceBundleContent module={module} evidence={evidence} onNavigateReference={onNavigateReference} />
    {!contextOnly && (onReview || onSaveReview || onSaveOverride) && <div className="mt-4"><Button onClick={() => onReview ? onReview() : setEditing(true)}>{module?.humanStatus ? '修改复核' : '人工复核'}</Button></div>}
    {!contextOnly && !onReview && !onSaveReview && !onSaveOverride && <p className="mt-4 text-xs text-muted">只读证据入口；人工评分请在当前 Trace 的评测区复核。</p>}
    {editing && (onSaveReview || onSaveOverride) && module && <div className="mt-4"><ModuleReviewEditor key={String(module.id)} module={module as unknown as ModuleEvaluationScore} onClose={() => setEditing(false)} onSubmit={async (input) => { if (onSaveReview) await onSaveReview(input); else await onSaveOverride?.({ humanStatus: input.auxiliaryVerdict, humanScore: input.humanScore, humanNote: input.reason, humanUpdatedBy: input.reviewer, humanUpdatedAt: input.reviewedAt }); setEditing(false) }} /></div>}
  </DetailDrawer>
}

export function EvidenceBundleContent({ module, evidence = [], onNavigateReference }: EvidenceBundleProps) {
  const stored = module ?? {}
  const bundle = stored.evidence && typeof stored.evidence === 'object' ? stored.evidence as LooseRecord : {}
  const item: LooseRecord = { ...stored, autoStatus: stored.autoStatus ?? stored.automaticStatus,
    rootEvidenceIds: stored.rootEvidenceIds ?? bundle.rootEvidenceIds,
    rubricRule: stored.rubricRule ?? bundle.rubricRule,
    observationId: stored.observationId ?? list(bundle.observationIds)[0], logId: stored.logId ?? list(bundle.logIds)[0],
    inputSummary: stored.inputSummary ?? bundle.inputSummary, outputSummary: stored.outputSummary ?? bundle.outputSummary,
    firstFailureNode: stored.firstFailureNode ?? (bundle.firstFailure ? list(bundle.observationIds)[0] : undefined),
    derivedFromModule: stored.derivedFromModule ?? bundle.derivedFromModule,
    artifactId: stored.artifactId ?? list(bundle.artifactIds)[0] }
  const status = text(first(item, ['humanStatus', 'humanVerdict', 'manualStatus', 'status', 'autoStatus', 'verdict']), 'UNKNOWN')
  const contextOnly = /context|上文/i.test(String(first(item, ['moduleCode', 'module', 'moduleLabel'], '')))
  const autoScore = first(item, ['autoScore', 'score'])
  const formattedAuto = formatAutomaticModuleScore({ score: typeof autoScore === 'number' ? autoScore : undefined, scoreScale: item.scoreScale === '0-2' ? '0-2' : '0-1' }, '未评分')
  const evidenceIds = [...new Set([...list(first(item, ['evidenceIds', 'rootEvidenceIds', 'evidenceBundleIds'], [])), ...list(first(item, ['rootEvidenceId', 'evidenceId'], []))])]
  const rootEvidence = evidence.filter((entry) => evidenceIds.includes(text(entry.id, '')))
  const rubric = first(item, ['rubricRule', 'rubric', 'rubricText', 'rule'])
  const observationId = text(first(item, ['observationId', 'observation', 'observationIdRef']), '')
  const logId = text(first(item, ['logId', 'log', 'logIdRef']), '')
  const firstFailure = text(first(item, ['firstFailureNode', 'firstFailureNodeId', 'firstFailure']), '')
  const derivedFrom = text(first(item, ['derivedFrom', 'derivedFailureFrom', 'derivedFromModule']), '')
  const openRef = (kind: ReferenceTarget['kind'], id: string) => { if (id) onNavigateReference?.({ kind, id }) }
  return (
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-slate-50/60 p-4">
          <SectionHeader title={contextOnly ? '上文证据说明' : '评测评分（0–2）'} actions={!contextOnly ? <span className="font-mono text-sm font-semibold text-accent">{item.humanScore !== undefined || item.human_score !== undefined ? formatNormalizedScoreOutOfTwo(first(item, ['humanScore', 'human_score']), '未评分') : formattedAuto}</span> : undefined} />
          <KeyValueGrid className="mt-3" items={[
            { label: '模块', value: text(first(item, ['moduleLabel', 'module', 'moduleCode'])) },
            { label: '自动评分（0–2）', value: contextOnly ? '仅作为证据，不单独评分' : formattedAuto },
            { label: '人工评分（0–2）', value: contextOnly ? '不开放独立评分' : item.humanScore !== undefined || item.human_score !== undefined ? formatNormalizedScoreOutOfTwo(first(item, ['humanScore', 'human_score']), '未评分') : '未复核' },
            { label: '辅助判定', value: `${text(first(item, ['autoStatus', 'autoVerdict', 'verdict', 'status']), 'UNKNOWN')} / ${item.humanStatus || item.humanVerdict || item.manualStatus ? status : '未复核'}` },
            { label: 'Eval Agent Version', value: text(first(item, ['evalAgentVersion', 'judgeVersion', 'evalVersion']), '待记录') },
            { label: 'Rubric Version', value: text(first(item, ['rubricVersion', 'rubricVer']), '待记录') }
          ]} />
          <div className="mt-4 rounded-md border border-line bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">LLM Judge Reason</p><p className="mt-1 text-xs leading-5 text-ink">{text(first(item, ['judgeReason', 'reason', 'autoReason']), '判定依据未记录')}</p></div>
          {Boolean(item.humanStatus ?? item.humanVerdict) && <div className="mt-3 rounded-md border border-accent/20 bg-white p-3"><p className="text-[10px] font-semibold text-accent">人工说明</p><p className="mt-1 text-xs leading-5">{text(item.humanNote, '未记录')}</p><p className="mt-2 text-[11px] text-muted">{text(item.humanUpdatedBy, '人员未记录')} · {text(item.humanUpdatedAt, '时间未记录')}</p></div>}
        </section>

        <section>
          <SectionHeader title="根证据 + Rubric" actions={<ShieldCheck className="h-4 w-4 text-accent" />} description="Evidence Bundle 以根证据、规则和观测节点组成，可回到原始 Log。" />
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-accent/20 bg-accent/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Rubric Rule</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">{text(rubric, 'Rubric 条款未由当前 Mock Eval Provider 返回')}</p></div>
            <div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Root Evidence</p>{rootEvidence.length ? rootEvidence.map((entry) => <div key={text(entry.id)} className="rounded-md border border-line bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><IdLink id={text(entry.id)} label={`${text(entry.id)} · ${text(entry.title, 'Evidence')}`} kind="evidence" onOpen={onNavigateReference} /><StatusBadge status={text(entry.kind, 'EVIDENCE')} label={text(entry.kind, 'EVIDENCE')} showIcon={false} tone="neutral" /></div><p className="mt-2 text-xs leading-5 text-ink">{text(entry.content, '暂无证据内容')}</p><p className="mt-1 text-[10px] text-muted">来源：{text(entry.source, 'Mock Trace / Eval Agent')}</p></div>) : <div className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-muted">暂无根证据，当前模块为 UNKNOWN 或 N/A。</div>}</div>
          </div>
        </section>

        <section>
          <SectionHeader title="Observation / Log" actions={<FileSearch className="h-4 w-4 text-accent" />} />
          <KeyValueGrid className="mt-3" items={[
            { label: 'Observation', value: observationId ? <EntityId id={observationId} kind="observation" onOpen={onNavigateReference} /> : '未关联 Observation' },
            { label: 'Log', value: logId ? <EntityId id={logId} kind="log" onOpen={onNavigateReference} /> : '未关联 Log' },
            { label: 'Input', value: text(first(item, ['input', 'inputSummary']), '未记录') },
            { label: 'Output', value: text(first(item, ['output', 'outputSummary']), '未记录') },
            { label: 'Error', value: text(first(item, ['error', 'errorMessage']), '无') },
            { label: '模型 / Token', value: text(first(item, ['model', 'modelVersion', 'tokenSummary']), '未记录') }
          ]} />
        </section>

        <section className="rounded-lg border border-line p-4">
          <SectionHeader title="首错与派生关系" />
          <div className="mt-3 flex flex-wrap gap-2">{firstFailure ? <Button variant="ghost" onClick={() => openRef('observation', firstFailure)}>首个失败：{firstFailure}</Button> : <StatusBadge status="First Failure 未记录" label="首个失败未记录" showIcon={false} tone="neutral" />}{derivedFrom ? <StatusBadge status="DERIVED_FAIL" label={`派生自 ${derivedFrom}`} tone="derived" showIcon={false} /> : <StatusBadge status="Root / 独立判定" label="Root / 独立判定" showIcon={false} tone="neutral" />}</div>
          <p className="mt-2 text-[11px] leading-5 text-muted">如果失败来自 Context Assembly，多轮上下文只会写入 Judge Reason 或 Evidence，不会创建独立 Context 评测指标。</p>
        </section>

        <section className="rounded-lg border border-line p-4">
          <SectionHeader title="关联对象" actions={<Link2 className="h-4 w-4 text-accent" />} />
          <div className="mt-3 flex flex-wrap gap-3">{text(first(item, ['traceId', 'trace'])) !== '—' && <IdLink id={text(first(item, ['traceId', 'trace']))} kind="trace" onOpen={onNavigateReference} />}{text(first(item, ['caseId', 'case'])) !== '—' && <IdLink id={text(first(item, ['caseId', 'case']))} kind="case" onOpen={onNavigateReference} />}{text(first(item, ['artifactId', 'artifact'])) !== '—' && <IdLink id={text(first(item, ['artifactId', 'artifact']))} kind="artifact" onOpen={onNavigateReference} />}</div>
        </section>
      </div>
  )
}
