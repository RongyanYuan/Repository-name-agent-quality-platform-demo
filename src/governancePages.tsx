import {
  Check,
  Database,
  ExternalLink,
  FilePlus2,
  GitCompareArrows,
  History,
  Plus,
  Save,
  ShieldCheck,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type {
  BenchmarkBucket,
  BenchmarkCaseResult,
  BenchmarkMetric,
  BenchmarkRun,
  CaseRecord,
  CaseSource,
  CaseStatus,
  Dataset,
  DatasetEntry,
  DatasetType,
  Environment,
  EvalStatus,
  Evidence,
  Observation,
  ObservationNode,
  Owner,
  ProductAcceptanceEvent,
  ProductValidity,
  RootCauseAttribution,
  RootCause,
  Severity,
  Task,
  TaskStatus,
  Trace
} from './domain'
import { VERSION_OPTIONS } from './data'
import { useContextNavigation } from './layout'
import {
  formatDuration,
  getAcceptanceSignals,
  getBenchmarkBuckets,
  getFirstFailureAttribution,
  getTaskById,
  getTraceByTask
} from './selectors'
import { useQuality } from './store'
import { ABTraceComparison, ObservationDetails } from './trace'
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  InlineNotice,
  Modal,
  SectionHeader,
  SelectInput,
  StatusBadge,
  Tabs,
  TextArea,
  TextInput,
  Toggle,
  cn
} from './ui'

const CASE_TABS: Array<{ id: CaseStatus | 'All Cases'; label: string }> = [
  { id: 'All Cases', label: 'All Cases' },
  { id: 'Candidate', label: 'Badcase Candidate' },
  { id: 'Confirmed Badcase', label: 'Confirmed Badcase' },
  { id: 'Resolved', label: 'Resolved' }
]

const BUCKETS: BenchmarkBucket[] = ['Improved Cases', 'Regressed Cases', 'Unchanged Failed Cases', 'Newly Failed Cases']
const DATASET_TYPES: DatasetType[] = ['Golden Case', 'Historical Badcase', 'Challenge Case']
const ROOT_CAUSE_OPTIONS: RootCause[] = [
  'Task Understanding',
  'Planning / Decision',
  'Context',
  'Memory',
  'Skill Routing',
  'Tool',
  'Loop / Retry',
  'Skill Internal',
  'External Engineering',
  'None'
]
const OBSERVATION_OPTIONS: ObservationNode[] = [
  'Task Understanding',
  'Planning / Decision',
  'Memory',
  'Context Assembly',
  'Skill Routing',
  'Skill',
  'Tool',
  'Loop / Retry',
  'Recovery',
  'Final Outcome'
]
const SEVERITIES: Severity[] = ['P0', 'P1', 'P2', 'P3']
const OWNERS: Owner[] = ['General Agent', 'PPT', 'Excel', 'Word', 'Tool', 'Infra']
const CASE_SOURCES: CaseSource[] = ['Auto Eval', 'User Feedback', 'System Error', 'Manual Review']
const TASK_STATUS_OPTIONS: TaskStatus[] = ['Effective', 'Effective but Inefficient', 'Failed']

const optionItems = <T extends string>(values: readonly T[]) => values.map((value) => ({ label: value, value }))

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

const effectiveLabel = (record: CaseRecord): EvalStatus => record.humanStatus ?? record.autoStatus

const sectionClass = 'rounded-lg border border-line bg-panel p-4 shadow-panel'

function PageIntro({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function CaseCompare({ record }: { record: CaseRecord }) {
  const disagreement = record.humanStatus !== undefined && record.humanStatus !== record.autoStatus
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Auto Eval</div>
        <div className="mt-2 flex items-center gap-2"><StatusBadge status={record.autoStatus} /><span className="text-[11px] text-muted">{record.autoReason}</span></div>
      </div>
      <div className={cn('rounded-md border p-3', disagreement ? 'border-warn/40 bg-warn/5' : 'border-slate-200 bg-slate-50/70')}>
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Human Label</span>{disagreement && <StatusBadge status="Eval Disagreement" tone="warn" showIcon={false} />}</div>
        <div className="mt-2 flex items-center gap-2"><StatusBadge status={record.humanStatus ?? 'Not reviewed'} />{record.humanReason && <span className="text-[11px] text-muted">{record.humanReason}</span>}</div>
      </div>
    </div>
  )
}

interface CaseDraft {
  status: CaseStatus
  humanStatus: EvalStatus
  failureDimension: string
  firstFailureNode: ObservationNode | ''
  rootCause: RootCause | ''
  derivedFailure: boolean
  severity: Severity
  owner: Owner
  note: string
}

const draftFromCase = (record: CaseRecord): CaseDraft => ({
  status: record.status,
  humanStatus: record.humanStatus ?? record.autoStatus,
  failureDimension: record.failureDimension,
  firstFailureNode: record.firstFailureNode ?? '',
  rootCause: record.rootCause === 'None' ? '' : record.rootCause,
  derivedFailure: record.derivedFailure,
  severity: record.severity,
  owner: record.owner,
  note: record.note
})

function CaseReviewDrawer({
  record,
  task,
  onClose,
  onSave,
  onAddDataset,
  onOpenTask
}: {
  record?: CaseRecord
  task?: Task
  onClose: () => void
  onSave: (draft: CaseDraft) => void
  onAddDataset: (record: CaseRecord) => void
  onOpenTask: (task?: Task) => void
}) {
  const [draft, setDraft] = useState<CaseDraft | null>(() => record ? draftFromCase(record) : null)
  const [error, setError] = useState('')
  if (!record || !draft) return null
  const set = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current)
  const save = () => {
    if (!draft.firstFailureNode || !draft.rootCause) {
      setError('请先选择 First Failure Node 和 Root Cause，才能保存人工归因。')
      return
    }
    setError('')
    onSave(draft)
  }
  const jumpToTask = () => onOpenTask(task)
  const attribution = task?.rootCauseAttribution
  const taskValidity = task?.productValidity
  const acceptanceEvents = task?.acceptanceEvents ?? []
  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title="Case review"
      description={`${record.id} · ${record.source} · updated ${formatDate(record.updatedAt)}`}
      footer={<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Button icon={Save} variant="primary" onClick={save}>保存标注</Button><Button icon={ShieldCheck} onClick={() => { if (!draft.firstFailureNode || !draft.rootCause) { setError('请先选择 First Failure Node 和 Root Cause，才能确认 Badcase。'); return } setError(''); onSave({ ...draft, status: 'Confirmed Badcase' }) }}>确认 Badcase</Button><Button icon={Check} onClick={() => { if (!draft.firstFailureNode || !draft.rootCause) { setError('请先选择 First Failure Node 和 Root Cause，才能标记已解决。'); return } setError(''); onSave({ ...draft, status: 'Resolved' }) }}>标记已解决</Button></div><Button icon={Database} onClick={() => onAddDataset(record)}>加入 Dataset</Button></div>}
    >
      <div className="space-y-5">
        <div className={sectionClass}>
          <SectionHeader title="Case identity" description="原始任务、Trace 和当前治理状态保持可追溯。" />
          <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Query</dt><dd className="mt-1 text-ink">{record.query}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Task / Trace</dt><dd className="mt-1 font-mono text-[11px] text-ink">{record.taskId} · {record.traceId}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Task status</dt><dd className="mt-1"><StatusBadge status={task?.status ?? 'Unknown'} /></dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Current state</dt><dd className="mt-1"><StatusBadge status={record.status} /></dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" icon={ExternalLink} onClick={jumpToTask}>打开 Task / Trace</Button><span className="self-center text-[11px] text-muted">source: {record.source}</span></div>
        </div>
        <div>
          <SectionHeader title="Auto Eval vs Human Label" description="保留自动判断，并让人工结果成为可审计的 effective label。" />
          <div className="mt-3"><CaseCompare record={{ ...record, humanStatus: draft.humanStatus }} /></div>
        </div>
        <div className={sectionClass}>
          <SectionHeader title="Trace first-failure attribution" description="根因只取首个非派生失败节点；下游传播失败保留为证据，不重复计入。" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
            <div><p className="text-[10px] uppercase tracking-wide text-muted">First failure node</p><p className="mt-1 font-medium text-ink">{record.firstFailureNode ?? attribution?.firstFailureNode ?? 'Unknown'}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-muted">Root cause module</p><p className="mt-1 font-medium text-fail">{record.rootCause}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-muted">is_root_cause</p><p className="mt-1 font-mono text-fail">{record.derivedFailure ? 'false' : 'true'}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-muted">Source observation / evidence</p><p className="mt-1 break-words font-mono text-[10px] text-accent">{record.firstFailureObservationId ?? attribution?.firstFailureObservationId ?? '—'} · {(record.rubricEvidence ?? []).map((item) => item.evidenceId ?? item.id).join(', ') || '—'}</p></div>
          </div>
          {attribution?.derivedFailureObservationIds.length ? <p className="mt-3 text-[11px] text-derived">Derived failures: {attribution.derivedFailureObservationIds.join(', ')}</p> : <p className="mt-3 text-[11px] text-muted">No derived failures recorded.</p>}
        </div>
        <div className={sectionClass}>
          <SectionHeader title="User behavior evidence" description="接受、纠错、新需求和负反馈事件用于解释最终满意度，不覆盖自动评测。" />
          <div className="mt-3 space-y-2">{acceptanceEvents.length ? acceptanceEvents.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-slate-50/60 p-2.5 text-[11px]"><span className="font-medium text-ink">{event.type}</span><span className="text-muted">{event.note ?? event.source ?? 'Mock event'} · {formatDate(event.timestamp)}</span></div>) : <p className="text-xs text-muted">No user behavior events recorded.</p>}</div>
        </div>
        <div className={sectionClass}>
          <SectionHeader title="Product validity" description="合格产物的五个硬门槛和用户最终标签并排展示。" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs"><div><p className="text-[10px] uppercase tracking-wide text-muted">File Validity</p><div className="mt-1"><StatusBadge status={taskValidity?.fileValidity ?? 'UNKNOWN'} /></div></div><div><p className="text-[10px] uppercase tracking-wide text-muted">Golden Label candidate</p><div className="mt-1"><StatusBadge status={taskValidity?.qualified ? 'PASS' : 'FAIL'} /></div></div></div>
        </div>
        {error && <InlineNotice tone="fail" title="无法保存">{error}</InlineNotice>}
        <div className={sectionClass}>
          <SectionHeader title="Review fields" description="修改归因、严重度、责任人和人工备注。" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Human result" required><SelectInput value={draft.humanStatus} onChange={(event) => set('humanStatus', event.target.value as EvalStatus)}><option value="PASS">PASS</option><option value="FAIL">FAIL</option></SelectInput></Field>
            <Field label="Governance state" required><SelectInput value={draft.status} onChange={(event) => set('status', event.target.value as CaseStatus)}>{CASE_TABS.slice(1).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></Field>
            <Field label="Failure dimension" required><TextInput value={draft.failureDimension} onChange={(event) => set('failureDimension', event.target.value)} /></Field>
            <Field label="First Failure Node" required><SelectInput value={draft.firstFailureNode} onChange={(event) => set('firstFailureNode', event.target.value as ObservationNode | '')}><option value="">请选择节点</option>{OBSERVATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field>
            <Field label="Root Cause" required><SelectInput value={draft.rootCause} onChange={(event) => set('rootCause', event.target.value as RootCause | '')}><option value="">请选择根因</option>{ROOT_CAUSE_OPTIONS.filter((item) => item !== 'None').map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field>
            <Field label="Severity"><SelectInput value={draft.severity} onChange={(event) => set('severity', event.target.value as Severity)}>{SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field>
            <Field label="Owner"><SelectInput value={draft.owner} onChange={(event) => set('owner', event.target.value as Owner)}>{OWNERS.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field>
            <Field label="Derived failure"><Toggle checked={draft.derivedFailure} onChange={(checked) => set('derivedFailure', checked)} label={draft.derivedFailure ? 'Derived / 派生错误' : 'Root failure / 首个失败'} /></Field>
          </div>
          <Field className="mt-4" label="Human note"><TextArea value={draft.note} onChange={(event) => set('note', event.target.value)} placeholder="记录证据、修复方向或解决说明" /></Field>
        </div>
        {task && <div className="rounded-md border border-line bg-slate-50/60 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Final outcome</p><p className="mt-1 text-xs leading-5 text-ink">{task.finalOutcome}</p><p className="mt-2 font-mono text-[10px] text-muted">{task.agentVersion} · {task.businessType} · {task.complexity} · {formatDuration(task.latency)}</p></div>}
      </div>
    </Drawer>
  )
}

function AddCaseToDatasetModal({
  record,
  datasets,
  task,
  onClose,
  onAdd
}: {
  record?: CaseRecord
  datasets: Dataset[]
  task?: Task
  onClose: () => void
  onAdd: (datasetId: string) => void
}) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '')
  const selected = datasets.find((dataset) => dataset.id === datasetId)
  if (!record) return null
  const duplicate = Boolean(selected?.entries.some((entry) => entry.taskId === record.taskId))
  return (
    <Modal open onClose={onClose} title="加入 Golden Dataset" description="创建一条带 Source Trace 和当前人工标签的 Dataset Entry。" size="sm" footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button icon={Database} variant="primary" disabled={!datasetId || duplicate} onClick={() => onAdd(datasetId)}>加入</Button></div>}>
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-slate-50/60 p-3"><p className="text-xs font-medium text-ink">{record.query}</p><p className="mt-1 font-mono text-[10px] text-muted">{record.taskId} · {task?.outcomeType ?? 'Unknown outcome'} · {task?.complexity ?? 'Unknown complexity'}</p></div>
        <Field label="Target Dataset" required><SelectInput value={datasetId} onChange={(event) => setDatasetId(event.target.value)}><option value="">请选择 Dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.version}</option>)}</SelectInput></Field>
        {duplicate && <InlineNotice tone="warn" title="已存在">该 Task 已在目标 Dataset 中，避免重复加入。</InlineNotice>}
        {!datasets.length && <EmptyState title="暂无 Dataset" description="先创建一个 Dataset，再从 Case 加入条目。" />}
      </div>
    </Modal>
  )
}

export function CasesPage() {
  const { state, dispatch } = useQuality()
  const { navigateContext } = useContextNavigation()
  const [tab, setTab] = useState<CaseStatus | 'All Cases'>('All Cases')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ taskStatus: '', failureDimension: '', firstFailureNode: '', rootCause: '', severity: '', owner: '', source: '', version: '' })
  const [selectedId, setSelectedId] = useState<string>()
  const [addDatasetId, setAddDatasetId] = useState<string>()
  const selectedRecord = state.cases.find((record) => record.id === selectedId)
  const selectedTask = selectedRecord ? getTaskById(state, selectedRecord.taskId) : undefined
  useEffect(() => {
    const scopedStatus = state.filters.status && TASK_STATUS_OPTIONS.includes(state.filters.status as TaskStatus) ? state.filters.status : ''
    const scopedRoot = state.filters.rootCause ?? ''
    setFilters((current) => current.taskStatus === scopedStatus && current.rootCause === scopedRoot ? current : { ...current, taskStatus: scopedStatus, rootCause: scopedRoot })
  }, [state.filters.rootCause, state.filters.status])
  const filteredCases = useMemo(() => state.cases.filter((record) => {
    const task = state.tasks.find((candidate) => candidate.id === record.taskId)
    if (tab !== 'All Cases' && record.status !== tab) return false
    if (query.trim() && !`${record.query} ${record.taskId} ${record.traceId}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (filters.taskStatus && task?.status !== filters.taskStatus) return false
    if (filters.failureDimension && record.failureDimension !== filters.failureDimension) return false
    if (filters.firstFailureNode && record.firstFailureNode !== filters.firstFailureNode) return false
    if (filters.rootCause && record.rootCause !== filters.rootCause) return false
    if (filters.severity && record.severity !== filters.severity) return false
    if (filters.owner && record.owner !== filters.owner) return false
    if (filters.source && record.source !== filters.source) return false
    if (filters.version && task?.agentVersion !== filters.version) return false
    return true
  }), [filters, query, state.cases, state.tasks, tab])
  const tabCount = (id: CaseStatus | 'All Cases') => id === 'All Cases' ? state.cases.length : state.cases.filter((record) => record.status === id).length
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }))
  const reset = () => { setQuery(''); setFilters({ taskStatus: '', failureDimension: '', firstFailureNode: '', rootCause: '', severity: '', owner: '', source: '', version: '' }) }
  const saveCase = (draft: CaseDraft) => {
    if (!selectedRecord) return
    dispatch({ type: 'UPDATE_CASE', caseId: selectedRecord.id, patch: { status: draft.status, failureDimension: draft.failureDimension, firstFailureNode: draft.firstFailureNode || null, rootCause: draft.rootCause as RootCause, derivedFailure: draft.derivedFailure, severity: draft.severity, owner: draft.owner, note: draft.note, humanStatus: draft.humanStatus, humanReason: draft.note || '人工复核已更新' } })
    setSelectedId(undefined)
  }
  const addToDataset = (datasetId: string) => {
    if (!addDatasetId) return
    const record = state.cases.find((item) => item.id === addDatasetId)
    const task = record ? getTaskById(state, record.taskId) : undefined
    const dataset = state.datasets.find((item) => item.id === datasetId)
    if (!record || !task || !dataset || dataset.entries.some((entry) => entry.taskId === task.id)) return
    const entry: DatasetEntry = {
      id: `entry-${dataset.id}-${task.id}-${Date.now()}`,
      datasetId: dataset.id,
      taskId: task.id,
      caseId: record.id,
      query: task.query,
      type: record.status === 'Confirmed Badcase' ? 'Historical Badcase' : 'Challenge Case',
      outcomeType: task.outcomeType,
      complexity: task.complexity,
      capabilityTags: [task.businessType, task.skill, record.rootCause],
      expectedResult: task.status === 'Failed' ? 'Agent should surface the failure and request a correction.' : task.finalOutcome,
      constraints: 'Respect the source data, audience and explicit user constraints.',
      expectedProcess: 'Understand → plan → assemble context → execute → verify',
      goldenLabel: effectiveLabel(record),
      rootCause: record.rootCause,
      sourceTraceId: record.traceId,
      version: dataset.version,
      enabled: true,
      history: [{ version: dataset.version, changedAt: new Date().toISOString(), summary: 'Added from Case review' }]
    }
    dispatch({ type: 'ADD_DATASET_ENTRY', datasetId: dataset.id, entry })
    setAddDatasetId(undefined)
  }
  return (
    <section className="space-y-5" aria-labelledby="cases-title">
      <PageIntro eyebrow="CASE GOVERNANCE" title="Case & Badcase" description="把自动评测、用户反馈和系统错误转化为可复核、可归因、可复用的治理资产。" actions={<Button icon={Database} onClick={() => navigateContext('/datasets')}>打开 Golden Dataset</Button>} />
      <Tabs aria-label="Case governance states" activeId={tab} onChange={(id) => setTab(id as CaseStatus | 'All Cases')} items={CASE_TABS.map((item) => ({ ...item, count: tabCount(item.id) }))} size="md" />
      <FilterBar title="Case filters" searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索 query / task_id / trace_id" resultCount={filteredCases.length} onReset={reset} controls={[
        { id: 'case-task-status', label: 'Task status', value: filters.taskStatus, options: optionItems(TASK_STATUS_OPTIONS), onChange: (value) => setFilter('taskStatus', value) },
        { id: 'case-dimension', label: 'Failure dimension', value: filters.failureDimension, options: optionItems(Array.from(new Set(state.cases.map((record) => record.failureDimension)))), onChange: (value) => setFilter('failureDimension', value) },
        { id: 'case-node', label: 'First failure', value: filters.firstFailureNode, options: optionItems(OBSERVATION_OPTIONS), onChange: (value) => setFilter('firstFailureNode', value) },
        { id: 'case-root', label: 'Root cause', value: filters.rootCause, options: optionItems(ROOT_CAUSE_OPTIONS), onChange: (value) => setFilter('rootCause', value) },
        { id: 'case-severity', label: 'Severity', value: filters.severity, options: optionItems(SEVERITIES), onChange: (value) => setFilter('severity', value) },
        { id: 'case-owner', label: 'Owner', value: filters.owner, options: optionItems(OWNERS), onChange: (value) => setFilter('owner', value) },
        { id: 'case-source', label: 'Case source', value: filters.source, options: optionItems(CASE_SOURCES), onChange: (value) => setFilter('source', value) },
        { id: 'case-version', label: 'Agent version', value: filters.version, options: optionItems(VERSION_OPTIONS), onChange: (value) => setFilter('version', value) }
      ]} />
      <DataTable<CaseRecord>
        caption="Case governance records"
        rows={filteredCases}
        rowKey={(record) => record.id}
        onRowClick={(record) => setSelectedId(record.id)}
        selectedRowId={selectedId}
        columns={[
          { key: 'query', header: 'Case', accessor: (record) => <div className="min-w-[250px]"><p className="line-clamp-2 font-medium text-ink">{record.query}</p><p className="mt-1 font-mono text-[10px] text-muted">{record.id} · {record.taskId}</p></div> },
          { key: 'status', header: 'State', accessor: (record) => <div className="space-y-1"><StatusBadge status={record.status} /><div className="text-[10px] text-muted">{effectiveLabel(record)} effective</div></div> },
          { key: 'failure', header: 'Failure / root cause', accessor: (record) => <div><p className="text-xs text-ink">{record.failureDimension}</p><p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted"><span>{record.firstFailureNode ?? 'Unassigned'}</span><span>·</span><span className="font-medium text-fail">{record.rootCause}</span>{record.derivedFailure && <StatusBadge status="Derived" tone="derived" showIcon={false} />}</p></div> },
          { key: 'version', header: 'Agent version', accessor: (record) => <span className="font-mono text-[10px] text-muted">{state.tasks.find((task) => task.id === record.taskId)?.agentVersion ?? '—'}</span> },
          { key: 'severity', header: 'Severity', accessor: (record) => <StatusBadge status={record.severity} tone={record.severity === 'P0' ? 'fail' : record.severity === 'P1' ? 'warn' : 'neutral'} showIcon={false} /> },
          { key: 'owner', header: 'Owner', accessor: (record) => <span className="text-xs text-ink">{record.owner}</span> },
          { key: 'source', header: 'Source', accessor: (record) => <span className="text-[11px] text-muted">{record.source}</span> },
          { key: 'updated', header: 'Updated', accessor: (record) => <span className="whitespace-nowrap text-[11px] text-muted">{formatDate(record.updatedAt)}</span> }
        ]}
      />
      {selectedRecord && <CaseReviewDrawer record={selectedRecord} task={selectedTask} onClose={() => setSelectedId(undefined)} onSave={saveCase} onAddDataset={(record) => setAddDatasetId(record.id)} onOpenTask={(task) => { if (task) navigateContext('/tasks', { params: { taskId: task.id, traceId: task.traceId } }) }} />}
      {addDatasetId && <AddCaseToDatasetModal record={state.cases.find((record) => record.id === addDatasetId)} task={getTaskById(state, state.cases.find((record) => record.id === addDatasetId)?.taskId)} datasets={state.datasets} onClose={() => setAddDatasetId(undefined)} onAdd={addToDataset} />}
    </section>
  )
}

export const CaseGovernancePage = CasesPage

interface DatasetEntryDraft {
  expectedResult: string
  constraints: string
  expectedProcess: string
  capabilityTags: string
  version: string
}

const entryDraftFrom = (entry: DatasetEntry): DatasetEntryDraft => ({
  expectedResult: entry.expectedResult,
  constraints: entry.constraints,
  expectedProcess: entry.expectedProcess ?? '',
  capabilityTags: entry.capabilityTags.join(', '),
  version: entry.version
})

function DatasetEntryDrawer({
  entry,
  dataset,
  task,
  localEntry,
  onClose,
  onSave,
  onToggle
}: {
  entry?: DatasetEntry
  dataset?: Dataset
  task?: Task
  localEntry?: DatasetEntry
  onClose: () => void
  onSave: (entry: DatasetEntry, draft: DatasetEntryDraft) => void
  onToggle: (entry: DatasetEntry, enabled: boolean) => void
}) {
  const effectiveEntry = localEntry ?? entry
  const [draft, setDraft] = useState<DatasetEntryDraft | null>(() => effectiveEntry ? entryDraftFrom(effectiveEntry) : null)
  const [error, setError] = useState('')
  if (!entry || !dataset || !effectiveEntry || !draft) return null
  const set = <K extends keyof DatasetEntryDraft>(key: K, value: DatasetEntryDraft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current)
  const incomplete = !draft.expectedResult.trim() || !draft.constraints.trim() || !effectiveEntry.goldenLabel
  const save = () => {
    if (effectiveEntry.enabled && incomplete) {
      setError('启用条目必须填写 Expected Result、Constraints 和 Golden Label。')
      return
    }
    setError('')
    onSave(effectiveEntry, draft)
  }
  return (
    <Drawer open onClose={onClose} width="lg" title="Dataset entry" description={`${dataset.name} · ${effectiveEntry.id}`} footer={<div className="flex flex-wrap items-center justify-between gap-2"><Button icon={Save} variant="primary" onClick={save}>保存条目</Button><Toggle checked={effectiveEntry.enabled} onChange={(checked) => onToggle(effectiveEntry, checked)} label={effectiveEntry.enabled ? 'Enabled' : 'Disabled'} /></div>}>
      <div className="space-y-5">
        <div className={sectionClass}>
          <SectionHeader title="Case definition" description="Golden Case 必须明确预期结果、约束和标签；禁用条目仍保留审计历史。" />
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-[10px] uppercase tracking-wide text-muted">Query</dt><dd className="mt-1 text-xs leading-5 text-ink">{effectiveEntry.query}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Outcome Type</dt><dd className="mt-1"><StatusBadge status={effectiveEntry.outcomeType} tone="info" showIcon={false} /></dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Complexity</dt><dd className="mt-1 text-xs text-ink">{effectiveEntry.complexity}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Golden Label</dt><dd className="mt-1"><StatusBadge status={effectiveEntry.goldenLabel} /></dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">File Validity</dt><dd className="mt-1"><StatusBadge status={effectiveEntry.fileValidity ?? task?.productValidity?.fileValidity ?? 'UNKNOWN'} /></dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-muted">Source Trace</dt><dd className="mt-1 font-mono text-[10px] text-accent">{effectiveEntry.sourceTraceId}</dd></div>
          </dl>
        </div>
        {error && <InlineNotice tone="fail" title="无法保存">{error}</InlineNotice>}
        <div className={sectionClass}>
          <SectionHeader title="Expected behavior" />
          <div className="mt-4 space-y-4">
            <Field label="Expected Result" required><TextArea value={draft.expectedResult} onChange={(event) => set('expectedResult', event.target.value)} /></Field>
            <Field label="Constraints" required><TextArea value={draft.constraints} onChange={(event) => set('constraints', event.target.value)} /></Field>
            <Field label="Expected Process"><TextArea value={draft.expectedProcess} onChange={(event) => set('expectedProcess', event.target.value)} placeholder="可选：任务理解 → 规划 → 执行 → 验证" /></Field>
            <Field label="Capability Tags" hint="用逗号分隔"><TextInput value={draft.capabilityTags} onChange={(event) => set('capabilityTags', event.target.value)} /></Field>
            <Field label="Dataset Version" required><TextInput value={draft.version} onChange={(event) => set('version', event.target.value)} /></Field>
          </div>
        </div>
        {task && <div className="rounded-md border border-line bg-slate-50/60 p-3"><p className="text-[10px] uppercase tracking-wide text-muted">Source Task</p><p className="mt-1 font-mono text-[10px] text-ink">{task.id} · {task.agentVersion} · {formatDuration(task.latency)}</p></div>}
        <div className={sectionClass}>
          <SectionHeader title="Source & version history" actions={<History className="h-4 w-4 text-muted" aria-hidden="true" />} />
          <div className="mt-3 space-y-2">{effectiveEntry.history.map((item, index) => <div key={`${item.version}-${index}`} className="border-l-2 border-accent/30 pl-3"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-accent">{item.version}</span><span className="text-[10px] text-muted">{formatDate(item.changedAt)}</span></div><p className="mt-1 text-xs text-ink">{item.summary}</p></div>)}</div>
        </div>
      </div>
    </Drawer>
  )
}

function CreateDatasetModal({ onClose, onCreate }: { onClose: () => void; onCreate: (draft: { name: string; description: string; version: string; type: DatasetType }) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [type, setType] = useState<DatasetType>('Golden Case')
  const [error, setError] = useState('')
  const submit = () => {
    if (!name.trim() || !version.trim()) { setError('Dataset name 和 version 为必填项。'); return }
    onCreate({ name: name.trim(), description: description.trim(), version: version.trim(), type })
  }
  return <Modal open onClose={onClose} title="新建 Dataset" description="创建后可从 Case 工作台加入条目，或添加显式 Golden Case。" size="sm" footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button icon={Plus} variant="primary" onClick={submit}>创建 Dataset</Button></div>}><div className="space-y-4">{error && <InlineNotice tone="fail">{error}</InlineNotice>}<Field label="Dataset name" required><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 Release Golden Set" /></Field><Field label="Type" required><SelectInput value={type} onChange={(event) => setType(event.target.value as DatasetType)}>{DATASET_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field><Field label="Version" required><TextInput value={version} onChange={(event) => setVersion(event.target.value)} /></Field><Field label="Description"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field></div></Modal>
}

function AddExplicitEntryModal({ dataset, tasks, onClose, onAdd }: { dataset?: Dataset; tasks: Task[]; onClose: () => void; onAdd: (entry: DatasetEntry) => void }) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [expectedResult, setExpectedResult] = useState('')
  const [constraints, setConstraints] = useState('')
  const [goldenLabel, setGoldenLabel] = useState<EvalStatus>('PASS')
  const [type, setType] = useState<DatasetType>(dataset?.type ?? 'Golden Case')
  const [error, setError] = useState('')
  const task = tasks.find((item) => item.id === taskId)
  const submit = () => {
    if (!dataset || !task || !expectedResult.trim() || !constraints.trim() || !goldenLabel) { setError('请填写 Task、Expected Result、Constraints 和 Golden Label。'); return }
    onAdd({ id: `entry-${dataset.id}-${task.id}-${Date.now()}`, datasetId: dataset.id, taskId: task.id, query: task.query, type, outcomeType: task.outcomeType, complexity: task.complexity, capabilityTags: [task.businessType, task.skill], expectedResult: expectedResult.trim(), constraints: constraints.trim(), expectedProcess: 'Understand → plan → execute → verify', goldenLabel, rootCause: task.rootCause, sourceTraceId: task.traceId, version: dataset.version, enabled: true, history: [{ version: dataset.version, changedAt: new Date().toISOString(), summary: 'Created explicitly in Dataset' }] })
  }
  return <Modal open onClose={onClose} title="添加显式 Golden Case" description="启用前必须填写完整 Expected Outcome、Constraint 与 Golden Label。" size="md" footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button icon={FilePlus2} variant="primary" onClick={submit}>添加 Case</Button></div>}><div className="space-y-4">{error && <InlineNotice tone="fail">{error}</InlineNotice>}<Field label="Source Task" required><SelectInput value={taskId} onChange={(event) => setTaskId(event.target.value)}>{tasks.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.query.slice(0, 55)}</option>)}</SelectInput></Field><Field label="Dataset entry type"><SelectInput value={type} onChange={(event) => setType(event.target.value as DatasetType)}>{DATASET_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field><Field label="Golden Label" required><SelectInput value={goldenLabel} onChange={(event) => setGoldenLabel(event.target.value as EvalStatus)}><option value="PASS">PASS</option><option value="FAIL">FAIL</option></SelectInput></Field><Field label="Expected Result" required><TextArea value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} /></Field><Field label="Constraints" required><TextArea value={constraints} onChange={(event) => setConstraints(event.target.value)} /></Field></div></Modal>
}

export function DatasetsPage() {
  const { state, dispatch } = useQuality()
  const { navigateContext } = useContextNavigation()
  const location = useLocation()
  const urlDatasetId = new URLSearchParams(location.search).get('datasetId') ?? ''
  const [selectedDatasetId, setSelectedDatasetId] = useState(urlDatasetId || (state.datasets[0]?.id ?? ''))
  const [selectedEntryId, setSelectedEntryId] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [entryEdits, setEntryEdits] = useState<Record<string, DatasetEntryDraft>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const dataset = state.datasets.find((item) => item.id === selectedDatasetId) ?? state.datasets[0]
  useEffect(() => {
    if (urlDatasetId && state.datasets.some((item) => item.id === urlDatasetId)) setSelectedDatasetId(urlDatasetId)
  }, [state.datasets, urlDatasetId])
  const entries = useMemo(() => (dataset?.entries ?? []).map((entry) => {
    const edit = entryEdits[entry.id]
    if (!edit) return entry
    return { ...entry, expectedResult: edit.expectedResult, constraints: edit.constraints, expectedProcess: edit.expectedProcess || undefined, capabilityTags: edit.capabilityTags.split(',').map((tag) => tag.trim()).filter(Boolean), version: edit.version }
  }), [dataset, entryEdits])
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)
  const enabledCount = entries.filter((entry) => entry.enabled).length
  const setEdit = (entry: DatasetEntry, draft: DatasetEntryDraft) => {
    setEntryEdits((current) => ({ ...current, [entry.id]: draft }))
    setSelectedEntryId(undefined)
    setNotice(`已保存 ${entry.id} 的治理草稿；条目版本和标签会在当前工作区保持。`)
  }
  const toggleEntry = (entry: DatasetEntry, enabled: boolean) => {
    const edit = entryEdits[entry.id]
    const merged = edit ? { ...entry, expectedResult: edit.expectedResult, constraints: edit.constraints, goldenLabel: entry.goldenLabel } : entry
    if (enabled && (!merged.expectedResult.trim() || !merged.constraints.trim() || !merged.goldenLabel)) {
      setNotice('该条目缺少 Expected Result、Constraints 或 Golden Label，无法启用。')
      return
    }
    dispatch({ type: 'TOGGLE_DATASET_ENTRY', datasetId: entry.datasetId, entryId: entry.id, enabled })
    setNotice(`${entry.id} 已${enabled ? '启用' : '禁用'}；禁用条目仍保留在历史中。`)
  }
  const bulkToggle = (enabled: boolean) => {
    if (!dataset) return
    selectedIds.forEach((id) => {
      const entry = entries.find((item) => item.id === id)
      if (entry) toggleEntry(entry, enabled)
    })
    setSelectedIds(new Set())
  }
  const createDataset = (draft: { name: string; description: string; version: string; type: DatasetType }) => {
    const id = `dataset-${Date.now()}`
    const created: Dataset = { id, ...draft, entries: [], updatedAt: new Date().toISOString() }
    dispatch({ type: 'CREATE_DATASET', dataset: created })
    setSelectedDatasetId(id)
    setCreateOpen(false)
    setNotice(`${draft.name} 已创建。`)
  }
  const addExplicitEntry = (entry: DatasetEntry) => {
    if (!dataset) return
    if (dataset.entries.some((item) => item.taskId === entry.taskId)) { setNotice('该 Task 已存在于 Dataset，未重复添加。'); return }
    dispatch({ type: 'ADD_DATASET_ENTRY', datasetId: dataset.id, entry })
    setAddEntryOpen(false)
    setNotice(`已添加 ${entry.id}，可继续编辑标签和 Expected Process。`)
  }
  return (
    <section className="space-y-5" aria-labelledby="datasets-title">
      <PageIntro eyebrow="GOLDEN DATASET" title="Golden Dataset" description="维护 Golden、Historical Badcase 与 Challenge Case，明确 Expected Outcome、Constraint 和 Golden Label。" actions={<div className="flex flex-wrap gap-2"><Button icon={Plus} variant="primary" onClick={() => setCreateOpen(true)}>新建 Dataset</Button><Button icon={FilePlus2} disabled={!dataset} onClick={() => setAddEntryOpen(true)}>添加 Golden Case</Button></div>} />
      {notice && <InlineNotice tone="info" title="Dataset 更新"><div className="flex items-center justify-between gap-3"><span>{notice}</span><button type="button" className="text-accent" onClick={() => setNotice('')} aria-label="关闭提示"><X className="h-3.5 w-3.5" /></button></div></InlineNotice>}
      {!state.datasets.length ? <EmptyState title="暂无 Dataset" description="创建第一个 Dataset，开始沉淀可复用案例。" action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>新建 Dataset</Button>} /> : <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.datasets.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedDatasetId(item.id); setSelectedIds(new Set()) }} className={cn('rounded-lg border bg-panel p-4 text-left shadow-panel transition hover:border-accent/50', dataset?.id === item.id ? 'border-accent ring-2 ring-accent/10' : 'border-line')}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{item.name}</p><p className="mt-1 text-[11px] text-muted">{item.type} · {item.version}</p></div><Database className="h-4 w-4 text-accent" aria-hidden="true" /></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{item.description || 'No description'}</p><div className="mt-3 flex items-center justify-between text-[11px] text-muted"><span>{item.entries.length} entries</span><span className="text-pass">{item.entries.filter((entry) => entry.enabled).length} enabled</span></div></button>)}</div>
        {dataset && <div className={sectionClass}>
          <SectionHeader title={<span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-accent" />{dataset.name}</span>} description={dataset.description} meta={<span>{dataset.type} · version {dataset.version} · {enabledCount}/{entries.length} enabled</span>} actions={<div className="flex flex-wrap gap-2"><Button size="sm" disabled={!selectedIds.size} onClick={() => bulkToggle(true)}>批量启用</Button><Button size="sm" disabled={!selectedIds.size} onClick={() => bulkToggle(false)}>批量禁用</Button><Button size="sm" icon={GitCompareArrows} onClick={() => navigateContext('/benchmarks', { params: { datasetId: dataset.id } })}>发起 Benchmark</Button></div>} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-line py-2 text-[11px] text-muted"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={entries.length > 0 && selectedIds.size === entries.length} onChange={(event) => setSelectedIds(event.target.checked ? new Set(entries.map((entry) => entry.id)) : new Set())} />选择全部</label><span>禁用条目不会进入新 Benchmark，但可查看历史。</span></div>
          <DataTable<DatasetEntry> rows={entries} rowKey={(entry) => entry.id} onRowClick={(entry) => setSelectedEntryId(entry.id)} selectedRowId={selectedEntryId} dense columns={[
            { key: 'select', header: '', width: '42px', accessor: (entry) => <input type="checkbox" aria-label={`选择 ${entry.id}`} checked={selectedIds.has(entry.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(entry.id); else next.delete(entry.id); return next })} /> },
            { key: 'query', header: 'Case', accessor: (entry) => <div className="min-w-[240px]"><p className="line-clamp-2 font-medium text-ink">{entry.query}</p><p className="mt-1 font-mono text-[10px] text-muted">{entry.id} · {entry.sourceTraceId}</p></div> },
            { key: 'type', header: 'Type', accessor: (entry) => <StatusBadge status={entry.type} tone="info" showIcon={false} /> },
            { key: 'expected', header: 'Expected behavior', accessor: (entry) => <div className="max-w-[280px]"><p className="line-clamp-2 text-[11px] text-ink">{entry.expectedResult || 'Missing expected result'}</p><p className="mt-1 line-clamp-1 text-[10px] text-muted">{entry.constraints || 'Missing constraints'}</p></div> },
            { key: 'tags', header: 'Tags', accessor: (entry) => <div className="flex max-w-[180px] flex-wrap gap-1">{entry.capabilityTags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted">{tag}</span>)}</div> },
            { key: 'label', header: 'Golden', accessor: (entry) => <StatusBadge status={entry.goldenLabel} /> },
            { key: 'enabled', header: 'Status', accessor: (entry) => <Toggle checked={entry.enabled} onChange={(checked) => toggleEntry(entry, checked)} label={entry.enabled ? 'Enabled' : 'Disabled'} /> }
          ]} />
        </div>}
      </>}
      {selectedEntry && dataset && <DatasetEntryDrawer entry={state.datasets.find((item) => item.id === dataset.id)?.entries.find((item) => item.id === selectedEntry.id)} localEntry={selectedEntry} dataset={dataset} task={getTaskById(state, selectedEntry.taskId)} onClose={() => setSelectedEntryId(undefined)} onSave={setEdit} onToggle={toggleEntry} />}
      {createOpen && <CreateDatasetModal onClose={() => setCreateOpen(false)} onCreate={createDataset} />}
      {addEntryOpen && <AddExplicitEntryModal dataset={dataset} tasks={state.tasks} onClose={() => setAddEntryOpen(false)} onAdd={addExplicitEntry} />}
    </section>
  )
}

export const GoldenDatasetPage = DatasetsPage

const metricUnit = (metric: BenchmarkMetric) => metric.unit === 'duration' ? 'ms' : '%'

const metricValue = (value: number, metric: BenchmarkMetric) => metric.unit === 'duration' ? formatDuration(value) : `${value}${metricUnit(metric)}`

const metricDelta = (metric: BenchmarkMetric) => metric.id === 'latency'
  ? `${metric.delta > 0 ? '+' : ''}${metric.delta.toFixed(1)}%`
  : metric.unit === 'duration'
    ? `${metric.delta > 0 ? '+' : ''}${formatDuration(metric.delta)}`
    : `${metric.delta > 0 ? '+' : ''}${metric.delta}pp`

function syntheticTrace(base: Trace | undefined, side: 'A' | 'B', bucket: BenchmarkBucket): Trace | undefined {
  if (!base) return undefined
  const observations = base.observations.map((observation) => ({ ...observation, metadata: { ...observation.metadata }, evidenceIds: [...observation.evidenceIds] }))
  if (observations.length) {
    const candidate = observations.find((observation) => observation.nodeType === 'Memory') ?? observations.find((observation) => observation.nodeType === 'Context Assembly') ?? observations[0]
    if (bucket === 'Regressed Cases') {
      candidate.status = side === 'A' ? 'PASS' : 'FAIL'
      candidate.evalResult = candidate.status
      candidate.error = side === 'B' ? 'Version B introduced a changed signal for comparison.' : undefined
      candidate.derived = false
    } else if (bucket === 'Newly Failed Cases') {
      candidate.status = side === 'A' ? 'PASS' : 'FAIL'
      candidate.evalResult = candidate.status
      candidate.error = side === 'B' ? 'Version B introduced a new failure signal.' : undefined
      candidate.derived = false
    } else if (bucket === 'Improved Cases') {
      candidate.status = side === 'A' ? 'FAIL' : 'PASS'
      candidate.evalResult = candidate.status
      candidate.error = side === 'A' ? 'Version A carried the prior failure.' : undefined
      candidate.derived = false
    } else {
      candidate.status = 'FAIL'
      candidate.evalResult = 'FAIL'
    }
    candidate.latency += side === 'B' ? (bucket === 'Regressed Cases' ? 640 : bucket === 'Improved Cases' ? -280 : 120) : 0
    if (side === 'B') candidate.model = `${candidate.model ?? 'model'}-b`
  }
  return { ...base, id: `${base.id}-${side.toLowerCase()}-${bucket.replace(/ /g, '-').toLowerCase()}`, observations, totalLatency: Math.max(0, observations.reduce((sum, observation) => sum + observation.latency, 0)) }
}

function BenchmarkTraceDrawer({ result, run, task, traceA, traceB, evidence, onClose }: { result?: BenchmarkCaseResult; run?: BenchmarkRun; task?: Task; traceA?: Trace; traceB?: Trace; evidence: QualityDataEvidence; onClose: () => void }) {
  const [selectedObservation, setSelectedObservation] = useState<Observation>()
  if (!result || !run) return null
  const a = syntheticTrace(traceA, 'A', result.bucket)
  const b = syntheticTrace(traceB, 'B', result.bucket)
  const changedNode = result.bucket === 'Regressed Cases' || result.bucket === 'Newly Failed Cases' ? 'Memory' : undefined
  return <Drawer open onClose={onClose} width="lg" title="A/B Trace comparison" description={`${result.bucket} · ${result.taskId} · ${result.reason}`}><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-slate-50/60 p-3"><div><p className="text-xs font-semibold text-ink">{task?.query ?? result.taskId}</p><p className="mt-1 font-mono text-[10px] text-muted">{run.versionA} ↔ {run.versionB} · {run.datasetVersion}</p></div><StatusBadge status={result.bucket} /></div><ABTraceComparison traceA={a} traceB={b} labelA={`${run.versionA} · A`} labelB={`${run.versionB} · B`} evidence={evidence} highlightNodeType={changedNode as Observation['nodeType'] | undefined} onObservationClick={(observation) => setSelectedObservation(observation)} /><ObservationDetails observation={selectedObservation} evidence={evidence} onClose={() => setSelectedObservation(undefined)} /></div></Drawer>
}

type QualityDataEvidence = ReadonlyArray<{ id: string; observationId?: string; type: 'Input' | 'Output' | 'Error' | 'User Feedback' | 'Artifact'; summary: string; source: string }>

export function BenchmarksPage() {
  const { state, dispatch } = useQuality()
  const { navigateContext } = useContextNavigation()
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const urlDatasetId = urlParams.get('datasetId') ?? ''
  const urlBenchmarkId = urlParams.get('benchmarkId') ?? ''
  const urlCaseId = urlParams.get('caseId') ?? ''
  const [selectedRunId, setSelectedRunId] = useState(urlBenchmarkId || (state.benchmarks[0]?.id ?? ''))
  const [bucket, setBucket] = useState<BenchmarkBucket>('Regressed Cases')
  const [selectedResultId, setSelectedResultId] = useState<string | undefined>(urlCaseId || undefined)
  const [metricId, setMetricId] = useState<string>()
  const [datasetId, setDatasetId] = useState(urlDatasetId || (state.datasets[0]?.id ?? ''))
  const [versionA, setVersionA] = useState('')
  const [versionB, setVersionB] = useState('')
  const [environment, setEnvironment] = useState<Environment>('Staging')
  const [rubricVersion, setRubricVersion] = useState('rubric-2026.08')
  const [runError, setRunError] = useState('')
  const selectedRun = state.benchmarks.find((run) => run.id === selectedRunId) ?? state.benchmarks[0]
  const buckets = getBenchmarkBuckets(selectedRun)
  const bucketRows = selectedRun ? buckets[bucket] : []
  const selectedResult = selectedRun?.caseResults.find((result) => result.id === selectedResultId)
  const selectedTask = selectedResult ? getTaskById(state, selectedResult.taskId) : undefined
  const metric = selectedRun?.metrics.find((item) => item.id === metricId)
  const sourceTasks = metric ? state.tasks.filter((task) => metric.sourceTaskIds.includes(task.id)) : []
  useEffect(() => {
    if (urlDatasetId && state.datasets.some((dataset) => dataset.id === urlDatasetId)) setDatasetId(urlDatasetId)
    if (urlBenchmarkId && state.benchmarks.some((benchmark) => benchmark.id === urlBenchmarkId)) setSelectedRunId(urlBenchmarkId)
    if (urlCaseId) setSelectedResultId(urlCaseId)
  }, [state.benchmarks, state.datasets, urlBenchmarkId, urlCaseId, urlDatasetId])
  const launch = () => {
    if (!datasetId || !versionA || !versionB || !environment || !rubricVersion) { setRunError('Dataset、Version A/B、Environment 和 Eval Rubric Version 都是必选项。'); return }
    if (versionA === versionB) { setRunError('Version A 和 Version B 必须不同。'); return }
    const id = `benchmark-${Date.now()}`
    dispatch({ type: 'CREATE_BENCHMARK', input: { id, datasetId, versionA, versionB, environment, rubricVersion } })
    setSelectedRunId(id)
    setRunError('')
  }
  const runItems = state.benchmarks.map((run) => ({ id: run.id, label: `${run.createdAt.slice(0, 10)} · ${run.versionA} → ${run.versionB}`, count: run.caseResults.length }))
  return (
    <section className="space-y-5" aria-labelledby="benchmarks-title">
      <PageIntro eyebrow="BENCHMARK / REGRESSION" title="Benchmark" description="用 Golden Dataset 比较两个 Agent 版本，把结果、过程和性能变化落到具体 Case 与 Trace。" actions={<Button icon={Database} onClick={() => navigateContext('/datasets')}>管理 Dataset</Button>} />
      <div className={sectionClass}>
        <SectionHeader title="Create Benchmark" description="选择完整输入后运行确定性的 Mock Benchmark；历史 Run 不会被重新计算。" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Dataset" required><SelectInput value={datasetId} onChange={(event) => setDatasetId(event.target.value)}><option value="">请选择 Dataset</option>{state.datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.version}</option>)}</SelectInput></Field>
          <Field label="Version A" required><SelectInput value={versionA} onChange={(event) => setVersionA(event.target.value)}><option value="">请选择</option>{VERSION_OPTIONS.map((version) => <option key={version} value={version}>{version}</option>)}</SelectInput></Field>
          <Field label="Version B" required><SelectInput value={versionB} onChange={(event) => setVersionB(event.target.value)}><option value="">请选择</option>{VERSION_OPTIONS.map((version) => <option key={version} value={version}>{version}</option>)}</SelectInput></Field>
          <Field label="Environment" required><SelectInput value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)}><option value="Production">Production</option><option value="Staging">Staging</option></SelectInput></Field>
          <Field label="Eval Rubric" required><TextInput value={rubricVersion} onChange={(event) => setRubricVersion(event.target.value)} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button icon={GitCompareArrows} variant="primary" disabled={!datasetId || !versionA || !versionB || !environment || !rubricVersion || versionA === versionB} onClick={launch}>Run Benchmark</Button>{runError && <span role="alert" className="text-xs text-fail">{runError}</span>}<span className="text-[11px] text-muted">Run 只纳入启用的 Dataset entries。</span></div>
      </div>
      {state.benchmarks.length > 0 && <div className={sectionClass}>
        <SectionHeader title="Benchmark history" description="打开历史 Run 可恢复当时的版本、Dataset、Rubric 和 Case 分类。" />
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{runItems.map((item) => { const run = state.benchmarks.find((candidate) => candidate.id === item.id); return <button key={item.id} type="button" onClick={() => { setSelectedRunId(item.id); setBucket('Regressed Cases'); setSelectedResultId(undefined) }} className={cn('rounded-md border p-3 text-left transition hover:border-accent/50', selectedRun?.id === item.id ? 'border-accent bg-accent/5' : 'border-line bg-slate-50/50')}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-accent">{item.id}</span><StatusBadge status={run?.status ?? 'Unknown'} /></div><p className="mt-2 text-xs font-semibold text-ink">{item.label}</p><p className="mt-1 text-[10px] text-muted">{run?.datasetVersion} · {run?.environment} · {run?.rubricVersion}</p><p className="mt-2 text-[11px] text-muted">{item.count} comparable cases</p></button> })}</div>
      </div>}
      {selectedRun ? <>
        <div className={sectionClass}>
          <SectionHeader title="Version result" description="Result Eval、Process Eval 和 Performance Metric 分组展示，不合并为单一总分。" meta={<span>{selectedRun.datasetVersion} · {selectedRun.versionA} vs {selectedRun.versionB} · completed {formatDate(selectedRun.completedAt)}</span>} />
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-line text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Metric</th><th className="px-3 py-2">Family</th><th className="px-3 py-2 text-right">Version A</th><th className="px-3 py-2 text-right">Version B</th><th className="px-3 py-2 text-right">Delta</th><th className="px-3 py-2 text-right">Sources</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedRun.metrics.map((item) => <tr key={item.id} className={cn('cursor-pointer transition hover:bg-slate-50', metricId === item.id && 'bg-accent/5')} onClick={() => setMetricId(item.id)}><td className="px-3 py-3 font-medium text-ink">{item.label}</td><td className="px-3 py-3"><StatusBadge status={item.family} tone={item.family === 'Result Eval' ? 'info' : item.family === 'Process Eval' ? 'derived' : 'warn'} showIcon={false} /></td><td className="px-3 py-3 text-right tabular-nums text-muted">{metricValue(item.versionA, item)}</td><td className="px-3 py-3 text-right tabular-nums text-ink">{metricValue(item.versionB, item)}</td><td className={cn('px-3 py-3 text-right font-semibold tabular-nums', item.delta >= 0 && item.unit !== 'duration' ? 'text-pass' : item.delta < 0 && item.unit === 'duration' ? 'text-pass' : 'text-fail')}>{metricDelta(item)}</td><td className="px-3 py-3 text-right text-accent">{item.sourceTaskIds.length}</td></tr>)}</tbody></table></div>
          {metric && <div className="mt-3 rounded-md border border-accent/20 bg-accent/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-ink">{metric.label} breakdown</p><span className="text-[11px] text-muted">{sourceTasks.length} contributing tasks</span></div><div className="mt-2 flex flex-wrap gap-2">{sourceTasks.slice(0, 12).map((task) => <button key={task.id} type="button" onClick={() => navigateContext('/tasks', { params: { taskId: task.id, traceId: task.traceId } })} className="rounded border border-accent/20 bg-white px-2 py-1 font-mono text-[10px] text-accent hover:bg-accent/10">{task.id}</button>)}</div></div>}
        </div>
        <div className={sectionClass}>
          <SectionHeader title="Case classification" description="点击分类查看具体 Case，并继续打开 A/B Trace。" meta={<span>{selectedRun.caseResults.length} total comparison results</span>} />
          <div className="mt-3"><Tabs aria-label="Benchmark case buckets" activeId={bucket} onChange={(id) => { setBucket(id as BenchmarkBucket); setSelectedResultId(undefined) }} items={BUCKETS.map((item) => ({ id: item, label: item, count: buckets[item].length }))} variant="pill" size="sm" /></div>
          <div className="mt-3"><DataTable<BenchmarkCaseResult> rows={bucketRows} rowKey={(result) => result.id} onRowClick={(result) => setSelectedResultId(result.id)} selectedRowId={selectedResultId} columns={[{ key: 'task', header: 'Case / Task', accessor: (result) => { const task = getTaskById(state, result.taskId); return <div className="min-w-[260px]"><p className="line-clamp-2 font-medium text-ink">{task?.query ?? result.taskId}</p><p className="mt-1 font-mono text-[10px] text-muted">{result.taskId} · {result.traceAId ?? 'trace A'} ↔ {result.traceBId ?? 'trace B'}</p></div> } }, { key: 'bucket', header: 'Bucket', accessor: (result) => <StatusBadge status={result.bucket} /> }, { key: 'reason', header: 'Classification rationale', accessor: (result) => <span className="line-clamp-2 max-w-[420px] text-[11px] leading-5 text-muted">{result.reason}</span> }, { key: 'action', header: '', accessor: (result) => <Button size="sm" icon={GitCompareArrows} onClick={(event) => { event.stopPropagation(); setSelectedResultId(result.id) }}>Compare</Button> }]} /></div>
        </div>
        {selectedResult && <BenchmarkTraceDrawer result={selectedResult} run={selectedRun} task={selectedTask} traceA={state.traces.find((trace) => trace.id === selectedResult.traceAId) ?? (selectedTask ? getTraceByTask(state, selectedTask.id) : undefined)} traceB={state.traces.find((trace) => trace.id === selectedResult.traceBId) ?? (selectedTask ? getTraceByTask(state, selectedTask.id) : undefined)} evidence={state.evidence} onClose={() => setSelectedResultId(undefined)} />}
      </> : <EmptyState title="Select or create a Benchmark" description="先选择完整输入并运行 Benchmark，再查看版本结果与 Regression Case。" />}
    </section>
  )
}

export const BenchmarkRegressionPage = BenchmarksPage
