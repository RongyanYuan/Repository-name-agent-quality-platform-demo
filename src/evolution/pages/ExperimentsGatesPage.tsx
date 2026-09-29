import { AlertTriangle, CheckCircle2, Plus, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, DataTable, Field, FilterBar, Modal, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui'
import type { Dataset, Experiment, ExperimentRun, GateDecision } from '../domain'
import { EntityId, IdLink, KeyValueGrid, PageHeading, TagList, type ReferenceTarget } from '../components/ViewPrimitives'
import { useScopedEvolution } from '../scope'
import { dateText, entities, record, Section, strings, text, type AnyEntity, type AnyState, useReferenceNavigation } from './shared'

type View = 'single' | 'window' | 'reports'
const conclusionLabel = (value: string) => value === 'PASS' ? '准出' : value === 'REJECT' ? '拒绝' : value === 'MANUAL_REVIEW' ? '人工复核' : value

function ExperimentDetail({
  selected, view, config, reportSnapshot, reportRuns, reportMetrics, selectedExperiment, selectedDatasets, selectedRuns, sourceSingleReports, navigation, runExperiment, completeExperiment, failExperiment, setDecisionOpen, onClose
}: {
  selected: AnyEntity; view: View; config: Record<string, unknown>; reportSnapshot: Record<string, unknown>; reportRuns: Record<string, unknown>[]; reportMetrics: Record<string, unknown>[]
  selectedExperiment?: Experiment; selectedDatasets: Dataset[]; selectedRuns: ExperimentRun[]; sourceSingleReports: Experiment[]; navigation: ReturnType<typeof useReferenceNavigation>
  runExperiment: () => void; completeExperiment: () => void; failExperiment: () => void; setDecisionOpen: (open: boolean) => void; onClose: () => void
}) {
  const snapshotConfig = record(reportSnapshot.configSnapshot)
  const snapshotDatasets = Array.isArray(reportSnapshot.datasetVersions) ? reportSnapshot.datasetVersions.map(record) : []
  const selectedIdentity = <EntityId id={selected.id} kind={view === 'reports' ? 'decision' : 'experiment'} onOpen={navigation.open} />
  return <div className="fixed inset-0 z-40" role="dialog" aria-label={view === 'reports' ? '准出报告详情' : '实验详情'}>
    <button className="absolute inset-0 bg-slate-950/25" aria-label="关闭遮罩" onClick={onClose} />
    <aside className="absolute inset-y-0 right-0 w-full max-w-3xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl">
      <div className="flex justify-between gap-3"><div><h2 className="text-base font-semibold">{text(selected.name, '准出报告')}</h2><p className="mt-1 font-mono text-[10px] text-accent">{selectedIdentity}</p></div><div className="flex flex-wrap gap-2">{view !== 'reports' && <Button onClick={runExperiment} disabled={!['DRAFT', 'QUEUED', 'FAILED'].includes(text(selected.status))}>{text(selected.status) === 'FAILED' ? '重试实验' : '运行实验'}</Button>}{view !== 'reports' && text(selected.status) === 'RUNNING' && <><Button variant="primary" onClick={completeExperiment}>完成 Mock 运行</Button><Button variant="danger" onClick={failExperiment}>模拟运行失败</Button></>}{view !== 'reports' && <Button variant="primary" disabled={text(selected.status) !== 'COMPLETED'} onClick={() => setDecisionOpen(true)}>提交准出决策</Button>}<button onClick={onClose} className="text-xs text-muted">关闭</button></div></div>
      {view === 'reports' ? <>
        <Section className="mt-5"><SectionHeader title="决策结论" actions={<StatusBadge status={text(selected.conclusion)} label={conclusionLabel(text(selected.conclusion))} />} /><p className="mt-3 text-xs">{text(selected.reason)}</p><KeyValueGrid className="mt-3" items={[{ label: '决策人', value: text(selected.decidedBy) }, { label: '决策时间', value: dateText(selected.decidedAt) }, { label: '决策依据', value: text(selected.decisionBasis, '待配置门禁下人工复核') }, { label: '实验', value: <IdLink id={text(selected.experimentId)} kind="experiment" onOpen={navigation.open} /> }]} /></Section>
        <Section className="mt-4"><SectionHeader title="配置快照" /><KeyValueGrid className="mt-3" items={[{ label: '模型', value: text(snapshotConfig.model) }, { label: '运行环境', value: text(snapshotConfig.runEnvironment) }, { label: '超时', value: `${text(snapshotConfig.timeoutMs)} ms` }, { label: '重复运行', value: `${text(snapshotConfig.repeatCount)} 次 / Case` }, { label: 'Tool 权限', value: strings(snapshotConfig.toolPermissions).join('、') || '无' }]} /><p className="mt-3 text-[10px] font-semibold text-muted">Dataset 版本</p><div className="mt-2 flex flex-wrap gap-2">{snapshotDatasets.map((dataset) => <IdLink key={text(dataset.datasetId)} id={text(dataset.datasetId)} label={`${text(dataset.datasetId)} @ ${text(dataset.version)}`} kind="dataset" onOpen={navigation.open} />)}</div></Section>
        <Section className="mt-4"><SectionHeader title="运行快照" /><div className="mt-2 max-h-40 overflow-y-auto">{reportRuns.map((run) => <div key={text(run.id)} className="flex items-center gap-2 text-[10px]"><IdLink id={text(run.id)} kind="experiment-run" onOpen={navigation.open} /><IdLink id={text(run.caseId)} kind="case" onOpen={navigation.open} /><span>{text(run.arm)} · 第 {text(run.repetition)} 次</span></div>)}</div></Section>
        <Section className="mt-4"><SectionHeader title="局部 / 端到端 / 泛化结果" /><div className="mt-2 space-y-2">{reportMetrics.map((metric) => <div key={text(metric.key)} className="rounded border border-line p-2 text-xs"><strong>{text(metric.label)} · {text(metric.gateStatus)}</strong><p className="text-muted">Baseline {text(metric.baselineMean)}（波动 ±{text(metric.baselineStdDev)}）→ Candidate {text(metric.candidateMean)}（波动 ±{text(metric.candidateStdDev)}）</p></div>)}</div></Section>
        <Section className="mt-4"><SectionHeader title="失败 Case、回退项、已知风险与 Evidence" /><div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2">{strings(reportSnapshot.failedCaseIds).map((id) => <IdLink key={id} id={id} kind="case" onOpen={navigation.open} />)}{!strings(reportSnapshot.failedCaseIds).length && <span className="text-xs text-muted">暂无失败 Case</span>}</div><TagList values={strings(reportSnapshot.rollbackItems)} empty="暂无回退项" /><TagList values={strings(reportSnapshot.knownRisks)} empty="暂无已知风险" /><div className="flex flex-wrap gap-2">{strings(reportSnapshot.evidenceIds).map((id) => <IdLink key={id} id={id} kind="evidence" onOpen={navigation.open} />)}</div></div></Section>
      </> : <>
        <Section className="mt-5"><SectionHeader title="配置快照" actions={<StatusBadge status={text(selected.status)} />} /><KeyValueGrid className="mt-3" items={[{ label: 'Baseline', value: text(selected.baselineVersion) }, { label: 'Candidate', value: text(selected.candidateVersion) }, { label: '模型', value: text(config.model) }, { label: '运行环境', value: text(config.runEnvironment) }, { label: '超时', value: `${String(config.timeoutMs ?? '—')} ms` }, { label: '重复运行', value: `${String(config.repeatCount ?? 3)} 次 / Case` }, { label: 'Tool 权限', value: strings(config.toolPermissions).join('、') }]} /></Section>
        <Section className="mt-4"><SectionHeader title="实验数据集 / 版本 / 样本" /><div className="mt-2 space-y-1">{selectedDatasets.map((dataset) => <p key={dataset.id} className="text-xs"><IdLink id={dataset.id} kind="dataset" onOpen={navigation.open} /> · {dataset.version} · {dataset.sampleCount} 样本 · {dataset.timeRange ? `${dateText(dataset.timeRange.from)}—${dateText(dataset.timeRange.to)}` : dataset.scope}</p>)}</div></Section>
        <Section className="mt-4"><SectionHeader title="精确窗口成员 / 来源单变体报告" /><div className="mt-2 flex flex-wrap gap-2">{selectedExperiment?.windowId && <IdLink id={selectedExperiment.windowId} kind="window" onOpen={navigation.open} />}{strings(selected.variantIds).map((id) => <IdLink key={id} id={id} kind="variant" onOpen={navigation.open} />)}{sourceSingleReports.map((item) => <IdLink key={item.id} id={item.id} kind="experiment" onOpen={navigation.open} />)}</div></Section>
        <Section className="mt-4"><SectionHeader title="运行明细" description="Baseline / Candidate 同配置，每个 Case 按快照重复运行。" /><div className="mt-2 max-h-44 overflow-y-auto">{selectedRuns.map((run) => <div key={run.id} className="flex items-center gap-2 text-[10px]"><IdLink id={run.id} kind="experiment-run" onOpen={navigation.open} /><IdLink id={run.caseId} kind="case" onOpen={navigation.open} /><span>{run.arm} · 第 {run.repetition} 次 · {run.status}</span></div>)}</div></Section>
        <Section className="mt-4"><SectionHeader title="局部 / 端到端 / 泛化指标" /><div className="mt-2 space-y-2">{selectedExperiment?.metrics.map((metric) => <div key={metric.key} className="rounded border border-line p-2 text-xs"><strong>{metric.category === 'LOCAL' ? '局部指标' : metric.category === 'END_TO_END' ? '端到端指标' : '泛化指标'} · {metric.label}</strong><p className="text-muted">Baseline {metric.baselineMean}（波动 ±{metric.baselineStdDev}）→ Candidate {metric.candidateMean}（波动 ±{metric.candidateStdDev}）</p></div>)}</div></Section>
        <Section className="mt-4"><SectionHeader title="失败 Case、回退项与已知风险" /><div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2">{strings(selected.failedCaseIds).map((id) => <IdLink key={id} id={id} kind="case" onOpen={navigation.open} />)}{!strings(selected.failedCaseIds).length && <span className="text-xs text-muted">暂无失败 Case</span>}</div><TagList values={strings(selected.rollbackItems)} empty="暂无回退项"/><TagList values={strings(selected.knownRisks)} empty="暂无已知风险"/></div></Section>
      </>}
    </aside>
  </div>
}

export function ExperimentsGatesPage({ onNavigateReference, initialExperimentId, initialDecisionId, initialWindowId, initialRunId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialExperimentId?: string; initialDecisionId?: string; initialWindowId?: string; initialRunId?: string }) {
  const { scopedState: state, dispatch } = useScopedEvolution()
  const experiments = entities(state as unknown as AnyState, 'experiments')
  const decisions = entities(state as unknown as AnyState, 'gateDecisions')
  const releases = entities(state as unknown as AnyState, 'releases')
  const initialRun = state.experimentRuns.find((item) => item.id === initialRunId)
  const initialExperiment = experiments.find((item) => item.id === initialExperimentId || item.id === initialRun?.experimentId) ?? experiments.find((item) => item.windowId === initialWindowId)
  const initialDecision = decisions.find((item) => item.id === initialDecisionId)
  const [view, setView] = useState<View>(initialDecision ? 'reports' : text(initialExperiment?.level) === 'WINDOW_COMBINATION' ? 'window' : 'single')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialDecision?.id ?? initialExperiment?.id)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [conclusion, setConclusion] = useState<GateDecision['conclusion']>('MANUAL_REVIEW')
  const [decisionReason, setDecisionReason] = useState('需要人工复核风险与回归结果。')
  const [createOpen, setCreateOpen] = useState(false)
  const [experimentName, setExperimentName] = useState('')
  const [experimentLevel, setExperimentLevel] = useState<Experiment['level']>('SINGLE_VARIANT')
  const [variantId, setVariantId] = useState(state.variants.find((item) => !item.experimentIds.length)?.id ?? state.variants[0]?.id ?? '')
  const [windowId, setWindowId] = useState(state.windows[0]?.id ?? '')
  const [datasetIds, setDatasetIds] = useState<string[]>([])
  const [model, setModel] = useState('gpt-5.2-demo')
  const [toolPermissions, setToolPermissions] = useState<string[]>([])
  const [timeoutMs, setTimeoutMs] = useState(120000)
  const configuredRepeat = Number(state.rules.find((item) => item.id === 'rule-repeat-count' && item.status === 'CONFIGURED')?.value) || 3
  const [repeatCount, setRepeatCount] = useState(configuredRepeat)
  const [runEnvironment, setRunEnvironment] = useState('isolated-demo-runner')
  const navigation = useReferenceNavigation(onNavigateReference)
  const selected = view === 'reports' ? decisions.find((item) => item.id === selectedId) : experiments.find((item) => item.id === selectedId)
  const rows = view === 'reports' ? decisions : experiments.filter((item) => text(item.level) === (view === 'single' ? 'SINGLE_VARIANT' : 'WINDOW_COMBINATION'))
  const filtered = useMemo(() => rows.filter((item) => !query.trim() || [item.id, item.name, item.status, item.conclusion, item.baselineVersion, item.candidateVersion].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, rows])
  const selectedWindowForCreate = state.windows.find((item) => item.id === windowId)
  const passingSingleFor = (candidateId: string) => state.experiments.find((experiment) => experiment.level === 'SINGLE_VARIANT' && experiment.variantIds.length === 1 && experiment.variantIds[0] === candidateId && experiment.gateDecisionId && state.gateDecisions.some((decision) => decision.id === experiment.gateDecisionId && decision.conclusion === 'PASS'))
  const missingWindowPass = selectedWindowForCreate?.candidateVariantIds.filter((id) => !passingSingleFor(id)) ?? []
  const allowedDatasetTypes = experimentLevel === 'WINDOW_COMBINATION' ? ['WINDOW_ONLINE', 'GENERALIZATION'] : ['ATTRIBUTION', 'GENERALIZATION', 'REGRESSION']
  const availableDatasets = state.datasets.filter((item) => item.frozen && allowedDatasetTypes.includes(item.type))
  const effectiveDatasetIds = datasetIds.filter((id) => availableDatasets.some((item) => item.id === id))
  const windowBlocked = experimentLevel === 'WINDOW_COMBINATION' && (!selectedWindowForCreate || !selectedWindowForCreate.candidateVariantIds.length || missingWindowPass.length > 0)
  const experimentColumns: Column<AnyEntity>[] = [
    { key: 'id', header: '实验 ID', accessor: (row) => <IdLink id={row.id} kind="experiment" onOpen={navigation.open} /> },
    { key: 'name', header: '实验', accessor: (row) => <div><span className="font-semibold">{text(row.name)}</span><p className="mt-1 text-[11px] text-muted">{text(row.level) === 'SINGLE_VARIANT' ? '单能力变体' : '窗口组合'}</p></div> },
    { key: 'versions', header: 'Baseline / Candidate', accessor: (row) => `${text(row.baselineVersion)} → ${text(row.candidateVersion)}` },
    { key: 'datasets', header: '数据集 / 重复', accessor: (row) => `${strings(row.datasetIds).length} 个 · ${record(row.configSnapshot).repeatCount ?? 3} 次 / Case` },
    { key: 'status', header: '状态', accessor: (row) => <StatusBadge status={text(row.status)} /> },
    { key: 'decision', header: '准出结论', accessor: (row) => { const decision = decisions.find((item) => item.id === row.gateDecisionId); return decision ? <StatusBadge status={text(decision.conclusion)} label={conclusionLabel(text(decision.conclusion))} /> : <StatusBadge status="待决策" tone="warn" /> } }
  ]
  const reportColumns: Column<AnyEntity>[] = [
    { key: 'id', header: '报告 / 决策 ID', accessor: (row) => <IdLink id={row.id} kind="decision" onOpen={navigation.open} /> },
    { key: 'experimentId', header: '实验', accessor: (row) => <IdLink id={text(row.experimentId)} kind="experiment" onOpen={navigation.open} /> },
    { key: 'conclusion', header: '实验结论', accessor: (row) => <StatusBadge status={text(row.conclusion)} label={conclusionLabel(text(row.conclusion))} /> },
    { key: 'reason', header: '决策原因', accessor: (row) => text(row.reason) },
    { key: 'release', header: '实际发布状态', accessor: (row) => { const release = releases.find((item) => item.gateDecisionId === row.id); return release ? <StatusBadge status={text(release.status)} /> : <StatusBadge status="未发布" /> } }
  ]
  const createExperiment = () => {
    if (!experimentName.trim() || windowBlocked || !effectiveDatasetIds.length || (experimentLevel === 'SINGLE_VARIANT' && !variantId)) return
    const at = new Date().toISOString()
    const selectedVariant = state.variants.find((item) => item.id === variantId)!
    const variantIds = experimentLevel === 'WINDOW_COMBINATION' ? [...selectedWindowForCreate!.candidateVariantIds] : [variantId]
    const selectedDatasetIds = effectiveDatasetIds
    const experimentId = `exp-${Date.now()}`
    const configSnapshot = { datasetVersions: state.datasets.filter((item) => selectedDatasetIds.includes(item.id)).map((item) => ({ datasetId: item.id, version: item.version, versionId: `${item.id}@${item.version}`, sampleCount: item.sampleCount })), model: model.trim(), toolPermissions: [...toolPermissions], timeoutMs, repeatCount, runEnvironment: runEnvironment.trim(), createdAt: at }
    const experiment: Experiment = { id: experimentId, name: experimentName.trim(), level: experimentLevel, variantIds, windowId: experimentLevel === 'WINDOW_COMBINATION' ? selectedWindowForCreate!.id : undefined, datasetIds: selectedDatasetIds, configSnapshot, runIds: [], baselineVersion: experimentLevel === 'WINDOW_COMBINATION' ? 'agent-current' : selectedVariant.currentVersion, candidateVersion: experimentLevel === 'WINDOW_COMBINATION' ? 'agent-window-candidate' : selectedVariant.candidateVersion, metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'DRAFT', createdAt: at, updatedAt: at }
    dispatch({ type: 'CREATE_EXPERIMENT', experiment, meta: { actor: '当前用户', reason: '创建实验配置快照', at } })
    setCreateOpen(false); setExperimentName(''); setView(experimentLevel === 'WINDOW_COMBINATION' ? 'window' : 'single')
  }
  const runExperiment = () => {
    if (!selected || view === 'reports' || ['DECIDED', 'RUNNING', 'COMPLETED'].includes(text(selected.status))) return
    dispatch({ type: 'START_EXPERIMENT_RUN', experimentId: selected.id, retry: text(selected.status) === 'FAILED', meta: { actor: '当前用户', reason: text(selected.status) === 'FAILED' ? '重试本地 Mock 实验' : '启动本地 Mock 实验' } })
  }
  const completeExperiment = () => selected && view !== 'reports' && dispatch({ type: 'COMPLETE_EXPERIMENT_RUN', experimentId: selected.id, meta: { actor: '当前用户', reason: '完成本地确定性 Mock 实验运行' } })
  const failExperiment = () => selected && view !== 'reports' && dispatch({ type: 'FAIL_EXPERIMENT_RUN', experimentId: selected.id, error: 'Mock runner timeout', meta: { actor: '当前用户', reason: '模拟本地实验运行失败' } })
  const saveDecision = () => {
    if (!selected || view === 'reports') return
    const at = new Date().toISOString(); const snapshot = record(selected.configSnapshot)
    const decision: GateDecision = { id: `gate-${selected.id}-${Date.now()}`, experimentId: selected.id, conclusion, decisionBasis: 'HUMAN_REVIEW', reason: decisionReason.trim() || '未填写决策原因', riskNotes: strings(selected.knownRisks), decidedBy: '当前用户', decidedAt: at, reportSnapshot: { experimentId: selected.id, variantIds: strings(selected.variantIds), datasetVersions: Array.isArray(snapshot.datasetVersions) ? snapshot.datasetVersions.map((item) => ({ datasetId: text(record(item).datasetId, ''), version: text(record(item).version, '') })) : [], metricResults: Array.isArray(selected.metrics) ? selected.metrics as GateDecision['reportSnapshot']['metricResults'] : [], configSnapshot: selected.configSnapshot as GateDecision['reportSnapshot']['configSnapshot'], runSnapshots: state.experimentRuns.filter((run) => run.experimentId === selected.id), failedCaseIds: strings(selected.failedCaseIds), rollbackItems: strings(selected.rollbackItems), knownRisks: strings(selected.knownRisks), evidenceIds: [...new Set(state.variants.filter((item) => strings(selected.variantIds).includes(item.id)).flatMap((item) => item.evidenceIds))] } }
    dispatch({ type: 'UPDATE_EXPERIMENT_DECISION', experimentId: selected.id, decision, meta: { actor: '当前用户', reason: decision.reason, at } }); setDecisionOpen(false); setSelectedId(undefined); setView('reports')
  }
  const config = record(selected?.configSnapshot); const reportSnapshot = record(selected?.reportSnapshot)
  const selectedExperiment = view === 'reports' ? undefined : state.experiments.find((item) => item.id === selected?.id)
  const selectedDatasets = selectedExperiment ? state.datasets.filter((item) => selectedExperiment.datasetIds.includes(item.id)) : []
  const selectedRuns = selectedExperiment ? state.experimentRuns.filter((item) => item.experimentId === selectedExperiment.id) : []
  const selectedWindow = selectedExperiment?.windowId ? state.windows.find((item) => item.id === selectedExperiment.windowId) : undefined
  const sourceSingleReports = selectedWindow && selectedExperiment?.level === 'WINDOW_COMBINATION' ? state.experiments.filter((item) => selectedWindow.singleExperimentIds.includes(item.id) && item.level === 'SINGLE_VARIANT' && item.variantIds.length === 1 && selectedExperiment.variantIds.includes(item.variantIds[0]) && Boolean(item.gateDecisionId && state.gateDecisions.some((decision) => decision.id === item.gateDecisionId && decision.conclusion === 'PASS'))) : []
  const reportRuns = Array.isArray(reportSnapshot.runSnapshots) ? reportSnapshot.runSnapshots.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []
  const reportMetrics = Array.isArray(reportSnapshot.metricResults) ? reportSnapshot.metricResults.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []
  const openCreate = () => {
    setRepeatCount(configuredRepeat); setDatasetIds(state.datasets.filter((item) => item.frozen && ['ATTRIBUTION', 'GENERALIZATION', 'REGRESSION'].includes(item.type)).map((item) => item.id)); setCreateOpen(true)
  }
  return <div>
    <PageHeading eyebrow="EXPERIMENTS & GATES" title="实验与准出" description="单能力变体先完成局部和泛化验证，通过后才进入窗口组合实验。配置创建时冻结，实验结论与发布状态分开。" actions={<Button icon={Plus} variant="primary" onClick={openCreate}>创建实验</Button>} />
    <Tabs aria-label="实验层级" activeId={view} onChange={(id) => { setView(id as View); setSelectedId(undefined) }} items={[{ id: 'single', label: '单能力变体实验', count: experiments.filter((item) => item.level === 'SINGLE_VARIANT').length }, { id: 'window', label: '窗口组合实验', count: experiments.filter((item) => item.level === 'WINDOW_COMBINATION').length }, { id: 'reports', label: '准出报告', count: decisions.length }]} />
    <FilterBar className="mt-4" searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索实验、版本、状态或结论" resultCount={filtered.length} onReset={() => setQuery('')} />
    <Section className="mt-4"><SectionHeader title={view === 'single' ? '单变体实验' : view === 'window' ? '窗口组合实验' : '准出报告'} description={view === 'reports' ? '决策与发布状态分别存储。' : 'Baseline 与 Candidate 使用相同冻结配置。'} /><DataTable className="mt-3" caption={view === 'reports' ? '准出报告列表' : '实验列表'} rows={filtered} columns={view === 'reports' ? reportColumns : experimentColumns} rowKey={(row) => row.id} onRowClick={(row) => setSelectedId(row.id)} /></Section>
    {view === 'window' && <Section className="mt-4"><SectionHeader title="组合结果可反查" description="只展示进入窗口成员且通过 Gate 的单变体报告。" /><div className="mt-3 flex flex-wrap gap-2">{state.windows.flatMap((window) => window.candidateVariantIds.map((variantId) => passingSingleFor(variantId))).filter((item, index, values): item is Experiment => Boolean(item) && values.findIndex((candidate) => candidate?.id === item?.id) === index).map((item) => <IdLink key={item.id} id={item.id} kind="experiment" onOpen={navigation.open} />)}</div></Section>}
    {view !== 'reports' && <Section className="mt-4"><SectionHeader title="配置快照" description="数据集版本、模型、Tool 权限、超时与重复次数在实验创建时冻结。默认 3 次 / Case。" actions={<Settings2 className="h-4 w-4 text-accent" />} /></Section>}
    {view === 'reports' && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Section><SectionHeader title="实验结论" description="支持准出、拒绝、人工复核。" /><CheckCircle2 className="mt-3 h-4 w-4 text-pass" /></Section><Section><SectionHeader title="实际发布状态" description="实验通过不等于已经发布。" /><AlertTriangle className="mt-3 h-4 w-4 text-warn" /></Section></div>}
    {selected && <ExperimentDetail selected={selected} view={view} config={config} reportSnapshot={reportSnapshot} reportRuns={reportRuns} reportMetrics={reportMetrics} selectedExperiment={selectedExperiment} selectedDatasets={selectedDatasets} selectedRuns={selectedRuns} sourceSingleReports={sourceSingleReports} navigation={navigation} runExperiment={runExperiment} completeExperiment={completeExperiment} failExperiment={failExperiment} setDecisionOpen={setDecisionOpen} onClose={() => setSelectedId(undefined)} />}
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="创建实验" description="所有选择会冻结为 Baseline / Candidate 共用的配置快照。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setCreateOpen(false)}>取消</Button><Button variant="primary" onClick={createExperiment} disabled={windowBlocked || !effectiveDatasetIds.length || !experimentName.trim() || !model.trim() || !runEnvironment.trim() || repeatCount < 1 || timeoutMs < 1}>保存实验</Button></div>}>
      <div className="space-y-3"><Field label="实验名称"><TextArea aria-label="实验名称" value={experimentName} onChange={(event) => setExperimentName(event.target.value)} /></Field><Field label="实验层级"><SelectInput aria-label="实验层级" value={experimentLevel} onChange={(event) => { const level = event.target.value as Experiment['level']; setExperimentLevel(level); const types = level === 'WINDOW_COMBINATION' ? ['WINDOW_ONLINE', 'GENERALIZATION'] : ['ATTRIBUTION', 'GENERALIZATION', 'REGRESSION']; setDatasetIds(state.datasets.filter((item) => item.frozen && types.includes(item.type)).map((item) => item.id)) }}><option value="SINGLE_VARIANT">单能力变体实验</option><option value="WINDOW_COMBINATION">窗口组合实验</option></SelectInput></Field>{experimentLevel === 'SINGLE_VARIANT' ? <Field label="候选变体"><SelectInput aria-label="候选变体" value={variantId} onChange={(event) => setVariantId(event.target.value)}>{state.variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field> : <><Field label="候选窗口"><SelectInput aria-label="候选窗口" value={windowId} onChange={(event) => setWindowId(event.target.value)}>{state.windows.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</SelectInput></Field><div className="rounded border border-line bg-slate-50 p-2 text-xs">窗口精确成员：{selectedWindowForCreate?.candidateVariantIds.map((id) => <IdLink key={id} id={id} kind="variant" onOpen={navigation.open} />)}</div>{windowBlocked && <div role="alert" className="rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">缺少通过的单变体报告：{missingWindowPass.length ? <span className="inline-flex flex-wrap gap-1">{missingWindowPass.map((id) => <IdLink key={id} id={id} kind="variant" onOpen={navigation.open} />)}</span> : '窗口未配置成员'}</div>}</>}
        <fieldset><legend className="text-xs font-medium">Dataset 版本（不勾选时使用全部适用冻结版本）</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{availableDatasets.map((item) => <label key={item.id} className="text-xs"><input type="checkbox" aria-label={item.id} checked={effectiveDatasetIds.includes(item.id)} onChange={() => setDatasetIds((values) => values.includes(item.id) ? values.filter((id) => id !== item.id) : [...values, item.id])} /> <span className="font-mono">{item.id}</span> @ {item.version}</label>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="模型"><TextInput aria-label="模型" value={model} onChange={(event) => setModel(event.target.value)} /></Field><Field label="运行环境"><TextInput aria-label="运行环境" value={runEnvironment} onChange={(event) => setRunEnvironment(event.target.value)} /></Field><Field label="超时（ms）"><TextInput aria-label="超时毫秒" type="number" min={1} value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))} /></Field><Field label="重复次数" hint={`规则默认 ${configuredRepeat} 次 / Case`}><TextInput aria-label="重复次数" type="number" min={1} value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))} /></Field></div>
        <fieldset><legend className="text-xs font-medium">Tool 权限</legend>{['slides.render', 'sheets.read', 'sheets.export'].map((permission) => <label key={permission} className="mr-3 text-xs"><input aria-label={permission} type="checkbox" checked={toolPermissions.includes(permission)} onChange={() => setToolPermissions((values) => values.includes(permission) ? values.filter((item) => item !== permission) : [...values, permission])} /> {permission}</label>)}</fieldset>
      </div>
    </Modal>
    <Modal open={decisionOpen} onClose={() => setDecisionOpen(false)} title="提交准出决策" description="实验结论会追加保存，与实际发布状态分离。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setDecisionOpen(false)}>取消</Button><Button variant="primary" onClick={saveDecision}>保存决策</Button></div>}><div className="space-y-3"><Field label="结论"><SelectInput aria-label="准出结论" value={conclusion} onChange={(event) => setConclusion(event.target.value as GateDecision['conclusion'])}><option value="PASS">准出</option><option value="REJECT">拒绝</option><option value="MANUAL_REVIEW">人工复核</option></SelectInput></Field><Field label="决策原因"><TextArea aria-label="决策原因" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></Field></div></Modal>
    {experimentLevel === 'WINDOW_COMBINATION' && <div role="status" className="sr-only">窗口组合实验要求候选变体先完成单变体实验通过；当前缺少 {missingWindowPass.length} 个通过报告。</div>}
    {navigation.drawer}
  </div>
}
