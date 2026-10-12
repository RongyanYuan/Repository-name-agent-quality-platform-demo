import { useState } from 'react'
import type { EvolutionState, Variant } from '../domain'
import { selectTasteLibraryTrigger } from '../data/selectors'
import { governanceLabel } from '../labels'
import { Button, Field, Modal, SelectInput, TextArea, TextInput } from '../../ui'

interface Props {
  state: EvolutionState; sourceClusterId?: string; sourceIssueId?: string
  onClose: () => void; onCreate: (variant: Variant) => void
}
export function VariantCreateDialog({ state, sourceClusterId, sourceIssueId, onClose, onCreate }: Props) {
  const [sourceType, setSourceType] = useState<'CLUSTER' | 'ISSUE'>(sourceIssueId ? 'ISSUE' : 'CLUSTER')
  const [clusterId, setClusterId] = useState(sourceClusterId ?? state.issueClusters.find((cluster) => selectTasteLibraryTrigger(state, cluster.id).eligible !== false)?.id ?? '')
  const [issueId, setIssueId] = useState(sourceIssueId ?? state.issues.find((issue) => issue.optimizationMode === 'DIRECT_FIX')?.id ?? '')
  const cluster = sourceType === 'CLUSTER' ? state.issueClusters.find((item) => item.id === clusterId) : undefined
  const issue = sourceType === 'ISSUE' ? state.issues.find((item) => item.id === issueId) : undefined
  const source = cluster ?? issue
  const trigger = cluster ? selectTasteLibraryTrigger(state, cluster.id) : undefined
  const firstCaseId = cluster?.caseIds[0] ?? issue?.caseId
  const skillId = state.cases.find((item) => item.id === firstCaseId)?.skillIds[0]
  const [name, setName] = useState('')
  const [changeType, setChangeType] = useState<Variant['changeType']>('PROMPT_OR_POLICY')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [currentVersion, setCurrentVersion] = useState(state.skills.find((item) => item.id === skillId)?.version ?? '待配置')
  const [candidateVersion, setCandidateVersion] = useState('候选草稿（待验证）')
  const valid = Boolean(source && name.trim() && currentVersion.trim() && candidateVersion.trim() && trigger?.eligible !== false && (!issue || issue.optimizationMode === 'DIRECT_FIX'))
  const create = () => {
    if (!valid || !source) return
    const at = new Date().toISOString()
    onCreate({ id: `variant-${Date.now()}`, name: name.trim(), targetModule: source.module, changeType,
      changeSummary: summary.trim() || content.trim() || source.description,
      changeContent: content.trim() || summary.trim() || source.description,
      currentVersion: currentVersion.trim(), candidateVersion: candidateVersion.trim(),
      sourceCaseIds: cluster ? [...cluster.caseIds] : [issue!.caseId],
      sourceIssueIds: cluster ? [...cluster.issueIds] : [issue!.id],
      sourceClusterIds: cluster ? [cluster.id] : [], evidenceIds: [...source.evidenceIds],
      status: 'DRAFT', experimentIds: [], createdAt: at, updatedAt: at })
  }
  return <Modal open onClose={onClose} title="创建能力变体" description="来源证据与版本保存为快照；实验通过不等于发布。" footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!valid} onClick={create}>保存变体</Button></div>}>
    <div className="space-y-3">
      <Field label="来源类型"><SelectInput aria-label="来源类型" value={sourceType} onChange={(event) => setSourceType(event.target.value as 'CLUSTER' | 'ISSUE')}><option value="CLUSTER">问题簇（聚类优化）</option><option value="ISSUE">确定性问题（直接优化）</option></SelectInput></Field>
      {sourceType === 'CLUSTER' ? <Field label="来源问题簇"><SelectInput aria-label="来源问题簇" value={clusterId} onChange={(event) => setClusterId(event.target.value)}><option value="">请选择</option>{state.issueClusters.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</SelectInput></Field> : <Field label="来源问题"><SelectInput aria-label="来源问题" value={issueId} onChange={(event) => setIssueId(event.target.value)}><option value="">请选择</option>{state.issues.filter((item) => item.optimizationMode === 'DIRECT_FIX').map((item) => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}</SelectInput></Field>}
      {trigger?.isTasteRule && <p role={trigger.eligible ? 'status' : 'alert'} className="rounded border border-warn/30 bg-warn/5 p-3 text-xs">{trigger.totalCount} / 100 条相关数据 · {trigger.eligible ? '已达触发条件' : '未达触发条件，禁止创建'}<br/>{trigger.countingRule}</p>}
      {cluster && !trigger?.isTasteRule && <p className="text-xs text-muted">聚类触发门槛：待配置；候选由人工治理确认，仍须实验验证。</p>}
      {!source && <p role="alert" className="text-xs text-fail">来源不存在或尚未选择，请从问题/问题簇确认来源。</p>}
      <Field label="变体名称"><TextInput aria-label="变体名称" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="变更类型"><SelectInput aria-label="变更类型" value={changeType} onChange={(event) => setChangeType(event.target.value as Variant['changeType'])}>{(['SKILL_CONTENT', 'SKILL_METADATA', 'PROMPT_OR_POLICY', 'TOOL_STABILITY', 'ASSET'] as const).map((item) => <option key={item} value={item}>{governanceLabel(item)}</option>)}</SelectInput></Field>
      <Field label="修改摘要"><TextArea aria-label="修改摘要" value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
      <Field label="修改内容"><TextArea aria-label="修改内容" value={content} onChange={(event) => setContent(event.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="当前版本"><TextInput aria-label="当前版本" value={currentVersion} onChange={(event) => setCurrentVersion(event.target.value)} /></Field><Field label="候选版本"><TextInput aria-label="候选版本" value={candidateVersion} onChange={(event) => setCandidateVersion(event.target.value)} /></Field></div>
    </div>
  </Modal>
}
