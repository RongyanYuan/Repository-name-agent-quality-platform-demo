import { History, Link2, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, DataTable, Field, FilterBar, Modal, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui'
import type { EvaluationRevision, EvaluationVerdict } from '../domain'
import { EntityId, IdLink, KeyValueGrid, PageHeading, TagList, type ReferenceTarget } from '../components/ViewPrimitives'
import { useScopedEvolution } from '../scope'
import { dateText, entities, Section, strings, text, type AnyEntity, type AnyState, useReferenceNavigation } from './shared'

type EvalTab = 'process' | 'outcome'

export function EvaluationCenterPage({ onNavigateReference, initialEvaluationId, initialArtifactId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialEvaluationId?: string; initialArtifactId?: string }) {
  const { scopedState: state, dispatch } = useScopedEvolution()
  const process = entities(state as unknown as AnyState, 'processEvals')
  const outcome = entities(state as unknown as AnyState, 'outcomeEvals')
  const initial = (initialEvaluationId || initialArtifactId) ? [...process, ...outcome].find((item) => item.id === initialEvaluationId || item.artifactId === initialArtifactId) : undefined
  const [tab, setTab] = useState<EvalTab>(initial && outcome.some((item) => item.id === initial.id) ? 'outcome' : 'process')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initial?.id)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [verdict, setVerdict] = useState<EvaluationVerdict>('FAIL')
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const navigation = useReferenceNavigation(onNavigateReference)
  const selected = [...process, ...outcome].find((item) => item.id === selectedId)
  const rows = tab === 'process' ? process : outcome
  const filtered = useMemo(() => rows.filter((item) => !query.trim() || [item.id, item.caseId, item.traceId, item.artifactId, item.dimension, item.verdict].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, rows])
  const columns: Column<AnyEntity>[] = [
    { key: 'id', header: 'Eval ID', accessor: (row) => <IdLink id={row.id} kind={tab === 'process' ? 'process-eval' : 'outcome-eval'} onOpen={navigation.open} /> },
    { key: 'caseId', header: 'Case / Trace', accessor: (row) => <div className="space-y-1"><IdLink id={text(row.caseId)} kind="case" onOpen={navigation.open} /><br/><IdLink id={text(row.traceId)} kind="trace" onOpen={navigation.open} /></div> },
    { key: 'dimension', header: '评测维度', accessor: (row) => text(row.dimension, text(row.name)) },
    { key: 'verdict', header: '结论', accessor: (row) => <StatusBadge status={text(row.verdict, 'UNKNOWN')} /> },
    { key: 'version', header: '评测版本', accessor: (row) => text(row.evalVersion, text(row.rubricVersion, text(row.judgeVersion, '待记录'))) },
    { key: 'evaluatedAt', header: '评测时间', accessor: (row) => dateText(row.evaluatedAt ?? row.createdAt) }
  ]
  const revisions = selected && Array.isArray(selected.revisions) ? selected.revisions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []
  const latestRevision = revisions.at(-1)
  const selectedEvidence = selected ? state.evidence.filter((item) => strings(selected.evidenceIds).includes(item.id)) : []
  const selectedObservation = selected?.observationId ? state.observations.find((item) => item.id === selected.observationId) : undefined
  const selectedIdentity = selected ? <EntityId id={selected.id} kind={tab === 'process' ? 'process-eval' : 'outcome-eval'} onOpen={navigation.open} /> : null
  const saveRevision = () => {
    if (!selected) return
    const at = new Date().toISOString()
    const parsedScore = score.trim() === '' ? undefined : Number(score)
    const revision: EvaluationRevision = { id: `revision-${selected.id}-${Date.now()}`, source: 'HUMAN', verdict, score: Number.isFinite(parsedScore) ? parsedScore : undefined, reason: reason.trim() || '人工复核完成。', evidenceIds: strings(selected.evidenceIds), evaluator: '当前用户', evaluatedAt: at, supersedesRevisionId: text(latestRevision?.id, '') || undefined }
    dispatch({ type: 'ADD_EVALUATION_REVISION', evaluationType: tab === 'process' ? 'PROCESS' : 'OUTCOME', evaluationId: selected.id, revision, meta: { actor: '当前用户', reason: revision.reason, at } })
    setRevisionOpen(false); setReason(''); setScore('')
  }
  return <div>
    <PageHeading eyebrow="EVALUATION CENTER" title="评测中心" description="过程评测与产物 / 结果评测独立存储、独立浏览；在同一 Case、Trace 与 Artifact 下互相追溯，人工修订不会覆盖历史结论。" />
    <Tabs aria-label="评测类型" activeId={tab} onChange={(id) => { setTab(id as EvalTab); setSelectedId(undefined) }} items={[{ id: 'process', label: '过程评测', count: process.length }, { id: 'outcome', label: '产物 / 结果评测', count: outcome.length }]} />
    <FilterBar className="mt-4" searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索 Eval ID、Case、Trace、Artifact 或评测维度" resultCount={filtered.length} onReset={() => setQuery('')} />
    <Section className="mt-4"><SectionHeader title={tab === 'process' ? '过程评测列表' : '产物 / 结果评测列表'} description={tab === 'process' ? '关注 Reason、Memory、Skill、Act 等执行过程节点。' : '关注产物基本质量、结果有效性与用户约束是否满足。'} /><DataTable className="mt-3" caption={tab === 'process' ? '过程评测列表' : '产物结果评测列表'} rows={filtered} columns={columns} rowKey={(row) => row.id} onRowClick={(row) => setSelectedId(row.id)} /></Section>
    <div role={selected ? 'dialog' : undefined} aria-label={selected ? `${tab === 'process' ? '过程' : '产物'}评测详情` : undefined}>{selected && <div className="fixed inset-0 z-40"><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭评测详情遮罩" onClick={() => setSelectedId(undefined)} /><aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-panel shadow-2xl"><header className="flex items-start justify-between border-b border-line p-5"><div><h2 className="text-base font-semibold text-ink">{selectedIdentity}</h2><p className="mt-1 text-xs text-muted">自动结论、Evidence 与人工修订历史</p></div><div className="flex gap-2"><Button variant="primary" onClick={() => { setVerdict(text(selected.verdict, 'UNKNOWN') as EvaluationVerdict); setScore(selected.score === undefined ? '' : String(selected.score)); setRevisionOpen(true) }}>新增人工修订</Button><button type="button" onClick={() => setSelectedId(undefined)} className="rounded px-2 py-1 text-xs text-muted hover:bg-slate-100">关闭</button></div></header><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <Section><SectionHeader title="评测判定" actions={<StatusBadge status={text(selected.verdict, 'UNKNOWN')} />} /><KeyValueGrid className="mt-3" items={[{ label: '得分', value: selected.score === undefined ? 'Pass / Fail 判定' : String(selected.score) }, { label: '评测版本', value: text(selected.evalVersion, '待记录') }, { label: '判定依据', value: text(latestRevision?.reason, '未记录') }, { label: '评测时间', value: dateText(latestRevision?.evaluatedAt ?? selected.createdAt) }]} /></Section>
      <Section><SectionHeader title="Evidence" description="根证据、Rubric 条款与观察节点共同形成可审计判据。" actions={<Scale className="h-4 w-4 text-accent" />} /><div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2">{selectedEvidence.map((item) => <IdLink key={item.id} id={item.id} label={`${item.id} · ${item.title}`} kind="evidence" onOpen={navigation.open} />)}{!selectedEvidence.length && <TagList values={[]} empty="暂无 Evidence，需人工补充" />}</div><KeyValueGrid items={[{ label: 'Rubric 条款', value: state.evidence.find((item) => strings(selected.evidenceIds).includes(item.id) && item.kind === 'RULE') ? '已记录为 RULE Evidence' : 'Rubric 条款未由当前 Mock Eval Provider 返回' }, { label: 'Observation', value: selectedObservation ? <IdLink id={selectedObservation.id} kind="observation" onOpen={navigation.open} /> : '当前 Eval 未关联 Observation' }, { label: 'Log', value: selectedObservation ? <IdLink id={selectedObservation.logId} kind="log" onOpen={navigation.open} /> : '不适用' }]} /></div></Section>
      <Section><SectionHeader title="关联对象" actions={<Link2 className="h-4 w-4 text-accent" />} /><div className="mt-3 flex flex-wrap gap-3"><IdLink id={text(selected.caseId)} kind="case" onOpen={navigation.open} /><IdLink id={text(selected.traceId)} kind="trace" onOpen={navigation.open} />{Boolean(selected.artifactId) && <IdLink id={text(selected.artifactId)} kind="artifact" onOpen={navigation.open} />}</div></Section>
      <Section><SectionHeader title="人工修订记录" description="新结论以追加记录保存，不覆盖自动评测版本。" actions={<History className="h-4 w-4 text-accent" />} /><div className="mt-3 space-y-2">{revisions.map((revision, index) => <div key={text(revision.id, String(index))} className="rounded-md border border-line bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><StatusBadge status={text(revision.verdict, 'UNKNOWN')} /><span className="text-[10px] text-muted">{dateText(revision.evaluatedAt)}</span></div><p className="mt-2 text-xs text-ink">{text(revision.reason, '未填写说明')}</p><p className="mt-1 text-[10px] text-muted">来源：{text(revision.source, 'HUMAN')}</p></div>)}</div></Section>
    </div></aside></div>}</div>
    <Modal open={revisionOpen} onClose={() => setRevisionOpen(false)} title="新增人工修订" description="以新 Revision 追加保存，自动结论与历史版本不会被覆盖。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setRevisionOpen(false)}>取消</Button><Button variant="primary" onClick={saveRevision}>保存修订</Button></div>}><div className="space-y-3"><Field label="人工结论"><SelectInput aria-label="人工结论" value={verdict} onChange={(event) => setVerdict(event.target.value as EvaluationVerdict)}>{['PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="人工得分"><TextInput aria-label="人工得分" type="number" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} /></Field><Field label="修订说明"><TextArea aria-label="修订说明" value={reason} onChange={(event) => setReason(event.target.value)} /></Field></div></Modal>
    {navigation.drawer}
  </div>
}
