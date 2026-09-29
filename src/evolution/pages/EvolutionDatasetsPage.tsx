import { Database, LockKeyhole, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, DataTable, Field, FilterBar, Modal, SectionHeader, SelectInput, StatusBadge, TextArea, TextInput, type Column } from '../../ui'
import { EntityId, IdLink, KeyValueGrid, PageHeading, TagList, type ReferenceTarget } from '../components/ViewPrimitives'
import type { Dataset } from '../domain'
import { useEvolution } from '../store'
import { dateText, Section, useReferenceNavigation } from './shared'

const datasetLabel: Record<Dataset['type'], string> = { ATTRIBUTION: '归因集', GENERALIZATION: '泛化集', REGRESSION: '回归集', WINDOW_ONLINE: '窗口线上数据集' }
const now = () => new Date().toISOString()
const nextVersion = (version: string) => {
  const match = /^v(\d+)(?:\.(\d+))?$/.exec(version)
  if (!match) return `${version}-next`
  return match[2] === undefined ? `v${Number(match[1]) + 1}` : `v${match[1]}.${Number(match[2]) + 1}`
}
const idPart = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom'

interface DatasetDraft { name: string; type: Dataset['type']; version: string; source: string; scope: string; sourceSystem: string; countingRule: string }
const blankDraft: DatasetDraft = { name: '', type: 'ATTRIBUTION', version: 'v1', source: '本地 Mock Case', scope: '', sourceSystem: '本地 Mock Case', countingRule: '按本地 Case ID 去重计数。' }

export function EvolutionDatasetsPage({ onNavigateReference, initialDatasetId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialDatasetId?: string }) {
  const { state, dispatch } = useEvolution()
  const location = useLocation(); const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialDatasetId)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<DatasetDraft>(blankDraft)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [editScope, setEditScope] = useState('')
  const [editSource, setEditSource] = useState('')
  const [editSourceSystem, setEditSourceSystem] = useState('')
  const [editCountingRule, setEditCountingRule] = useState('')
  const navigation = useReferenceNavigation(onNavigateReference)
  const selected = state.datasets.find((item) => item.id === selectedId)
  const selectedIdentity = selected ? <EntityId id={selected.id} kind="dataset" onOpen={navigation.open} label={`${selected.id} · ${selected.version}`} /> : null
  const filtered = useMemo(() => state.datasets.filter((item) => !query.trim() || [item.id, item.name, item.type, item.version, item.source].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [state.datasets, query])

  useEffect(() => {
    if (!selected) return
    setMemberIds([...selected.caseIds]); setEditScope(selected.scope); setEditSource(selected.source)
    setEditSourceSystem(selected.population.sourceSystem); setEditCountingRule(selected.population.countingRule)
  }, [selected?.id, selected?.updatedAt])

  const meta = (reason: string) => ({ actor: '当前用户', reason, at: now() })
  const createDataset = () => {
    if (!draft.name.trim() || !draft.version.trim() || !draft.source.trim() || !draft.scope.trim() || !draft.sourceSystem.trim() || !draft.countingRule.trim()) return
    const at = now(); const id = `dataset-${idPart(draft.name)}-${idPart(draft.version)}-${Date.now()}`
    const dataset: Dataset = { id, name: draft.name.trim(), type: draft.type, version: draft.version.trim(), caseIds: [], sampleCount: 0, source: draft.source.trim(), scope: draft.scope.trim(), frozen: false, population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: draft.sourceSystem.trim(), countingRule: draft.countingRule.trim() }, createdAt: at, updatedAt: at }
    dispatch({ type: 'CREATE_DATASET_VERSION', dataset, meta: { actor: '当前用户', reason: '创建可编辑 Dataset 版本', at } })
    setCreateOpen(false); setDraft(blankDraft); setSelectedId(id); const params = new URLSearchParams(location.search); params.set('datasetId', id); navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true })
  }
  const saveDetails = () => selected && dispatch({ type: 'UPDATE_DATASET_VERSION', datasetId: selected.id, patch: { scope: editScope.trim(), source: editSource.trim(), population: { ...selected.population, sourceSystem: editSourceSystem.trim(), countingRule: editCountingRule.trim() } }, meta: meta('编辑 Dataset 样本范围和来源') })
  const saveMembers = () => selected && dispatch({ type: 'SET_DATASET_MEMBERS', datasetId: selected.id, caseIds: memberIds, meta: meta('更新 Dataset 本地 Case 成员') })
  const freeze = () => selected && dispatch({ type: 'FREEZE_DATASET_VERSION', datasetId: selected.id, meta: meta('冻结 Dataset 版本供实验引用') })
  const createLaterVersion = () => {
    if (!selected?.frozen) return
    const at = now(); const version = nextVersion(selected.version); const id = `${selected.id}-${idPart(version)}-${Date.now()}`
    dispatch({ type: 'CREATE_DATASET_VERSION', sourceDatasetId: selected.id, dataset: { ...selected, id, version, frozen: false, createdAt: at, updatedAt: at, caseIds: [...selected.caseIds], population: { ...selected.population } }, meta: { actor: '当前用户', reason: `从冻结版本 ${selected.id} 创建后续版本`, at } })
    setSelectedId(id)
  }

  const columns: Column<Dataset>[] = [
    { key: 'id', header: 'Dataset ID', accessor: (row) => <IdLink id={row.id} kind="dataset" onOpen={navigation.open} /> },
    { key: 'name', header: '数据集', accessor: (row) => <div><span className="font-semibold">{row.name}</span><p className="mt-1 text-[10px] text-muted">{datasetLabel[row.type]}</p></div> },
    { key: 'version', header: '版本', accessor: (row) => <span className="font-mono text-[11px]">{row.version}</span> },
    { key: 'sampleCount', header: '样本数', accessor: (row) => String(row.sampleCount) },
    { key: 'scope', header: '样本范围', accessor: (row) => <span className="line-clamp-2 max-w-sm">{row.scope}</span> },
    { key: 'source', header: '来源', accessor: (row) => row.source },
    { key: 'frozen', header: '快照', accessor: (row) => <StatusBadge status={row.frozen ? '已冻结' : '编辑中'} tone={row.frozen ? 'pass' : 'warn'} /> }
  ]

  return <div><PageHeading eyebrow="EVOLUTION DATASETS" title="数据集" description="管理归因集、泛化集、回归集和窗口线上数据集。编辑版本可调整成员；冻结后不可变，后续调整必须创建新版本。" actions={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>新建数据集版本</Button>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(datasetLabel) as Dataset['type'][]).map((type) => <div key={type} className="rounded-lg border border-line bg-panel p-4 shadow-panel"><Database className="h-4 w-4 text-accent"/><p className="mt-2 text-xs text-muted">{datasetLabel[type]}</p><p className="mt-1 text-2xl font-semibold">{state.datasets.filter((item) => item.type === type).length}</p></div>)}</div>
    <FilterBar searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索数据集、版本、来源或类型" resultCount={filtered.length} onReset={() => setQuery('')} />
    <Section className="mt-4"><SectionHeader title="数据集版本与来源" description="Experiment 创建时保存 Dataset ID、版本与样本数快照；后续版本不会改写历史实验。" actions={<LockKeyhole className="h-4 w-4 text-accent" />} /><DataTable className="mt-3" caption="自进化数据集列表" rows={filtered} columns={columns} rowKey={(row) => row.id} onRowClick={(row) => setSelectedId(row.id)} /></Section>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建数据集版本" description="新版本默认处于编辑中；补充样本成员后再显式冻结。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setCreateOpen(false)}>取消</Button><Button variant="primary" onClick={createDataset}>保存数据集</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="数据集名称" required><TextInput aria-label="数据集名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="数据集类型"><SelectInput aria-label="数据集类型" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Dataset['type'] })}>{(Object.keys(datasetLabel) as Dataset['type'][]).map((type) => <option key={type} value={type}>{datasetLabel[type]}</option>)}</SelectInput></Field><Field label="数据集版本" required><TextInput aria-label="数据集版本" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} /></Field><Field label="来源" required><TextInput aria-label="来源" value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></Field><Field className="sm:col-span-2" label="样本范围" required><TextArea aria-label="样本范围" value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} /></Field><Field label="来源系统" required><TextInput aria-label="来源系统" value={draft.sourceSystem} onChange={(event) => setDraft({ ...draft, sourceSystem: event.target.value })} /></Field><Field label="计数口径" required><TextInput aria-label="计数口径" value={draft.countingRule} onChange={(event) => setDraft({ ...draft, countingRule: event.target.value })} /></Field></div>
    </Modal>

    {selected && <div className="fixed inset-0 z-50" role="dialog" aria-label="数据集详情"><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭遮罩" onClick={() => setSelectedId(undefined)} /><aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"><div className="flex justify-between gap-3"><div><h2 className="text-base font-semibold">{selected.name}</h2><p className="mt-1 font-mono text-[10px] text-accent">{selectedIdentity}</p></div><button onClick={() => setSelectedId(undefined)} className="text-xs text-muted">关闭</button></div>
      <Section className="mt-5"><SectionHeader title="数据集快照" actions={<StatusBadge status={selected.frozen ? '已冻结' : '编辑中'} tone={selected.frozen ? 'pass' : 'warn'} />} /><KeyValueGrid className="mt-3" items={[{ label: '类型', value: datasetLabel[selected.type] }, { label: '样本数', value: String(selected.sampleCount) }, { label: '本地 / 外部', value: `${selected.population.localCaseCount} / ${selected.population.externalSampleCount}` }, { label: '时间范围', value: selected.timeRange ? `${dateText(selected.timeRange.from)} — ${dateText(selected.timeRange.to)}` : '不适用' }, { label: '更新时间', value: dateText(selected.updatedAt) }]} /><div className="mt-4 grid gap-3"><Field label="数据集版本"><TextInput aria-label="数据集版本" value={selected.version} disabled /></Field><Field label="样本范围"><TextArea aria-label="编辑样本范围" value={editScope} disabled={selected.frozen} onChange={(event) => setEditScope(event.target.value)} /></Field><Field label="来源"><TextInput aria-label="编辑来源" value={editSource} disabled={selected.frozen} onChange={(event) => setEditSource(event.target.value)} /></Field><Field label="来源系统"><TextInput aria-label="编辑来源系统" value={editSourceSystem} disabled={selected.frozen} onChange={(event) => setEditSourceSystem(event.target.value)} /></Field><Field label="计数口径"><TextInput aria-label="编辑计数口径" value={editCountingRule} disabled={selected.frozen} onChange={(event) => setEditCountingRule(event.target.value)} /></Field>{!selected.frozen && <Button icon={Save} onClick={saveDetails}>保存基本信息</Button>}</div></Section>
      <Section className="mt-4"><SectionHeader title="本地 Case 成员" description={selected.frozen ? '当前版本已冻结，成员不可修改。' : '选择或移除可追溯的本地 Mock Case。'} /><div className="mt-3 space-y-2">{state.cases.map((item) => <label key={item.id} className="flex items-start gap-2 rounded border border-line p-2 text-xs"><input type="checkbox" aria-label={`${item.id} ${item.title}`} checked={memberIds.includes(item.id)} disabled={selected.frozen} onChange={(event) => setMemberIds(event.target.checked ? [...new Set([...memberIds, item.id])] : memberIds.filter((id) => id !== item.id))} /><span><span className="font-mono text-accent">{item.id}</span><span className="ml-2 text-muted">{item.title}</span></span></label>)}</div>{!selected.frozen && <Button className="mt-3" onClick={saveMembers}>保存成员</Button>}<div className="mt-3 flex flex-wrap gap-2">{selected.caseIds.map((id) => <IdLink key={id} id={id} kind="case" onOpen={navigation.open} />)}{!selected.caseIds.length && <TagList values={[]} empty="当前没有本地 Case 成员" />}</div>{selected.population.externalSampleCount > 0 && <p className="mt-3 text-xs text-muted">另有 {selected.population.externalSampleCount} 条外部 Mock 样本未在 Demo 展开；{selected.population.countingRule}</p>}</Section>
      <div className="mt-4 flex flex-wrap justify-end gap-2">{selected.frozen ? <Button variant="primary" icon={Plus} onClick={createLaterVersion}>创建后续版本</Button> : <Button variant="primary" icon={LockKeyhole} onClick={freeze}>冻结当前版本</Button>}</div></aside></div>}
    {navigation.drawer}
  </div>
}
