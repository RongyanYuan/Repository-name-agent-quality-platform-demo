import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Play, Plus, RefreshCw } from 'lucide-react'
import { Button, DataTable, EmptyState, Field, Modal, SelectInput, StatusBadge, TextArea, type Column } from '../../ui'
import type { Artifact, Dataset, DatasetExecutionItem, DatasetExecutionMode, DatasetExecutionRun, DatasetExecutionScope, DatasetExecutionStatus, DatasetMockScenario, DatasetQueryRecord, VerticalScenario } from '../domain'
import { useEvolution } from '../store'
import { createDatasetExecutionRun, selectDatasetExecutionInputs, validateDatasetQueryInput } from '../data/datasetExecution'
import { executeDatasetRun } from '../services'
import { ASSET_CATALOG_KIND_LABELS } from '../data/assetManagement'
import { dateText } from '../pages/shared'

interface DatasetExecutionWorkbenchProps {
  dataset: Dataset
  requestMode?: DatasetExecutionMode
  requestKey?: number
  onNavigateResult: (item: DatasetExecutionItem, run: DatasetExecutionRun) => void
}

const STATUS_LABEL: Record<DatasetExecutionStatus, string> = {
  PENDING: '待运行', RUNNING: '运行中', COMPLETED: '已完成', PARTIAL: '部分失败', FAILED: '失败'
}
const SCENARIOS: VerticalScenario[] = ['PPT', 'Word', 'Excel', '生图']
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const scoreText = (value?: number) => value === undefined ? '—' : `${value.toFixed(2)} / 2`
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试'
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export function artifactSnapshotDownload(artifact: Artifact, item: DatasetExecutionItem, run: DatasetExecutionRun): string {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>产物快照 · Mock</title></head><body style="font:16px/1.6 system-ui;max-width:900px;margin:48px auto;padding:24px;color:#263238"><h1>产物快照 · Mock</h1><p><strong>此文件仅包含原产物元信息、任务和本次评测分数，不是原始 Office 文件，也不是线上执行结果。原文件下载服务尚未接入。</strong></p><h2>任务</h2><p>${escapeHtml(item.input.query)}</p><dl><dt>原产物</dt><dd>${escapeHtml(artifact.name)}</dd><dt>产物 ID</dt><dd>${escapeHtml(artifact.id)}</dd><dt>原产物地址</dt><dd>${escapeHtml(artifact.uri)}</dd><dt>数据集 / 版本</dt><dd>${escapeHtml(run.configSnapshot.datasetSnapshot.name)} / ${escapeHtml(run.datasetVersion)}</dd><dt>运行批次</dt><dd>${escapeHtml(run.id)}</dd><dt>过程最终分（0–2）</dt><dd>${escapeHtml(scoreText(item.processFinal))}</dd><dt>产物最终分（0–2）</dt><dd>${escapeHtml(scoreText(item.outcomeFinal))}</dd><dt>Trace</dt><dd>${escapeHtml(item.traceId ?? '尚未生成')}</dd><dt>记录时间</dt><dd>${escapeHtml(item.completedAt ?? run.createdAt)}</dd></dl></body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function ExecutionStatus({ status, phase }: { status: DatasetExecutionStatus; phase?: DatasetExecutionItem['phase'] }) {
  const label = status === 'RUNNING' && phase ? (phase === 'GENERATING' ? '生成中' : '评测中') : STATUS_LABEL[status]
  return <StatusBadge status={status} label={label} tone={status === 'COMPLETED' ? 'pass' : status === 'FAILED' ? 'fail' : status === 'RUNNING' || status === 'PARTIAL' ? 'warn' : 'neutral'} />
}

/** Dataset inputs, generation and evaluations share one persistent batch ledger.
 * Full evidence remains in Case / Trace; the ledger keeps its original response. */
export function DatasetExecutionWorkbench({ dataset, requestMode, requestKey, onNavigateResult }: DatasetExecutionWorkbenchProps) {
  const { state, commit, getState } = useEvolution()
  const [params, setParams] = useSearchParams()
  const [queryOpen, setQueryOpen] = useState(false)
  const [queryContent, setQueryContent] = useState('')
  const [queryScenario, setQueryScenario] = useState<VerticalScenario | ''>('')
  const [queryAssetId, setQueryAssetId] = useState('')
  const [queryAssetVersionId, setQueryAssetVersionId] = useState('')
  const [queryError, setQueryError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [mode, setMode] = useState<DatasetExecutionMode>('GENERATE_AND_EVALUATE')
  const [scope, setScope] = useState<DatasetExecutionScope>('PENDING')
  const [runAssetId, setRunAssetId] = useState('')
  const [runAssetVersionId, setRunAssetVersionId] = useState('')
  const [mockScenario, setMockScenario] = useState<DatasetMockScenario>('SUCCESS')
  const [runError, setRunError] = useState('')
  const [executing, setExecuting] = useState(false)
  const [notice, setNotice] = useState('')
  const observedRequest = useRef<number>()
  const custom = dataset.datasetOrigin === 'USER_CUSTOM' || dataset.ownerScope === 'USER'
  const editable = custom && !dataset.frozen
  const assets = state.assetCatalog ?? []
  const versionsFor = (assetId: string) => (state.assetVersions ?? []).filter(version => version.assetId === assetId)
  const defaultVersionFor = (assetId: string) => assets.find(asset => asset.id === assetId)?.currentVersionId ?? versionsFor(assetId)[0]?.id ?? ''
  const queries = (state.datasetQueries ?? []).filter(query => query.datasetId === dataset.id && query.datasetVersion === dataset.version)
  const runs = useMemo(() => (state.datasetExecutionRuns ?? []).filter(run => run.datasetId === dataset.id).slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [state.datasetExecutionRuns, dataset.id])
  const requestedRunId = params.get('datasetRunId')
  const selectedRun = runs.find(run => run.id === requestedRunId) ?? runs[0]
  const allGenerationInputs = selectDatasetExecutionInputs(state, dataset.id, 'GENERATE_AND_EVALUATE', 'ALL')
  const allEvaluationInputs = selectDatasetExecutionInputs(state, dataset.id, 'EVALUATE_ONLY', 'ALL')
  const runInputs = selectDatasetExecutionInputs(state, dataset.id, mode, scope)
  const unresolvedExternal = dataset.population.externalSampleCount
  const running = executing || runs.some(run => run.status === 'RUNNING')

  const selectRun = (runId: string) => {
    const next = new URLSearchParams(params)
    next.set('datasetRunId', runId)
    setParams(next, { replace: true })
  }
  const openRun = (nextMode: DatasetExecutionMode) => {
    setMode(nextMode); setScope('PENDING'); setRunAssetId(''); setRunAssetVersionId('')
    setMockScenario('SUCCESS'); setRunError(''); setRunOpen(true)
  }
  const changeMode = (nextMode: DatasetExecutionMode) => {
    setMode(nextMode); setRunError('')
    if (nextMode === 'EVALUATE_ONLY') { setRunAssetId(''); setRunAssetVersionId('') }
  }
  useEffect(() => {
    setQueryOpen(false); setRunOpen(false); setNotice(''); setRunError('')
  }, [dataset.id])
  useEffect(() => {
    if (!requestKey || observedRequest.current === requestKey || !requestMode) return
    observedRequest.current = requestKey
    openRun(requestMode)
  }, [requestKey, requestMode])

  const saveQuery = async () => {
    if (!editable || saving) return
    setQueryError('')
    if (!queryScenario) { setQueryError('请选择产物类型'); return }
    const input = { datasetId: dataset.id, query: queryContent.trim(), verticalScenario: queryScenario, assetId: queryAssetId || undefined, assetVersionId: queryAssetVersionId || undefined }
    try {
      validateDatasetQueryInput(getState(), input)
      setSaving(true)
      const at = new Date().toISOString()
      const query: DatasetQueryRecord = { ...input, id: id('dataset-query'), datasetVersion: dataset.version, createdBy: '当前用户', status: 'PENDING', createdAt: at, updatedAt: at }
      await commit({ type: 'ADD_DATASET_QUERY', query, meta: { actor: '当前用户', reason: '人工录入数据集 Query', at } })
      setQueryOpen(false); setQueryContent(''); setQueryScenario(''); setQueryAssetId(''); setQueryAssetVersionId('')
      setNotice('Query 已保存，待运行；数据已持久化到本地。')
    } catch (error) { setQueryError(errorText(error)) } finally { setSaving(false) }
  }
  const startRun = async () => {
    if (running || !runInputs.length) return
    setRunError('')
    setExecuting(true)
    try {
      const at = new Date().toISOString()
      const run = createDatasetExecutionRun(getState(), { id: id('dataset-run'), datasetId: dataset.id, mode, scope, assetId: mode === 'GENERATE_AND_EVALUATE' ? runAssetId || undefined : undefined, assetVersionId: mode === 'GENERATE_AND_EVALUATE' ? runAssetVersionId || undefined : undefined, mockScenario, actor: '当前用户', at })
      await commit({ type: 'CREATE_DATASET_RUN', run, meta: { actor: '当前用户', reason: mode === 'GENERATE_AND_EVALUATE' ? '创建生成与评测批次' : '创建重新评测批次', at } })
      selectRun(run.id); setRunOpen(false); setNotice('本地 Mock 批次正在运行，逐条结果会保留在当前批次。')
      await executeDatasetRun({ run, commit, getState })
      setNotice('本地 Mock 批次已结束，请查看每条记录的完成状态与结果。')
    } catch (error) { setRunError(errorText(error)) } finally { setExecuting(false) }
  }
  const resumeRun = async () => {
    if (!selectedRun || executing) return
    setExecuting(true); setRunError('')
    try { await executeDatasetRun({ run: selectedRun, commit, getState }); setNotice('已继续当前批次，已完成记录保持不变。') }
    catch (error) { setRunError(errorText(error)) } finally { setExecuting(false) }
  }

  const queryColumns: Column<DatasetQueryRecord>[] = [
    { key: 'query', header: 'Query', accessor: query => <p className="max-w-[300px] whitespace-pre-wrap leading-5">{query.query}</p> },
    { key: 'type', header: '产物类型', accessor: query => query.verticalScenario },
    { key: 'asset', header: '关联资产 / 固定版本', accessor: query => <div><p>{assets.find(asset => asset.id === query.assetId)?.name ?? '使用运行配置'}</p><p className="mt-1 font-mono text-[11px] text-muted">{state.assetVersions?.find(version => version.id === query.assetVersionId)?.version ?? '未指定版本'}</p></div> },
    { key: 'time', header: '创建时间', accessor: query => dateText(query.createdAt) },
    { key: 'status', header: '状态', accessor: query => <ExecutionStatus status={query.status} /> }
  ]
  const resultColumns: Column<DatasetExecutionItem>[] = [
    { key: 'query', header: 'Query / 产物类型', accessor: item => <div className="max-w-[300px]"><p className="whitespace-pre-wrap leading-5">{item.input.query}</p><p className="mt-1 text-[11px] text-muted">{item.input.verticalScenario}</p></div> },
    { key: 'time', header: '运行时间', accessor: item => <div><p>{dateText(item.startedAt)}</p>{item.completedAt && <p className="mt-1 text-[10px] text-muted">完成 {dateText(item.completedAt)}</p>}</div> },
    { key: 'status', header: '状态', accessor: item => <div className="space-y-2"><ExecutionStatus status={item.status} phase={item.phase} />{item.errorReason && <p className="max-w-[220px] text-[11px] leading-4 text-fail">{item.errorReason}</p>}</div> },
    { key: 'scores', header: '过程 / 产物最终分（0–2）', accessor: item => <div className="space-y-1 whitespace-nowrap font-mono text-[11px]"><p>过程 {scoreText(item.processFinal)}</p><p>产物 {scoreText(item.outcomeFinal)}</p></div> },
    { key: 'artifact', header: '交付物', accessor: item => {
      const artifacts = item.resultSnapshot?.artifacts ?? state.artifacts.filter(artifact => item.artifactIds.includes(artifact.id))
      return <div className="space-y-1">{artifacts.length ? artifacts.map(artifact => /^(https?:|data:|blob:)/.test(artifact.uri) ? <a key={artifact.id} href={artifact.uri} download={artifact.name} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Download className="h-3 w-3" aria-hidden="true" />下载产物 · Mock</a> : selectedRun && <a key={artifact.id} href={artifactSnapshotDownload(artifact, item, selectedRun)} download={`${artifact.name.replace(/\.[^.]+$/, '')}-产物快照-Mock.html`} className="inline-flex items-center gap-1 text-accent hover:underline" title="下载原产物元信息、Query 和分数的 HTML 快照，原始 Office 文件服务尚未接入"><Download className="h-3 w-3" aria-hidden="true" />下载产物快照 · Mock</a>) : <span className="text-muted">未生成</span>}</div>
    } },
    { key: 'reference', header: 'Trace / 来源 / Evidence', accessor: item => <div className="max-w-[225px] space-y-1 break-all"><p className="font-mono text-[10px]">{item.traceId ?? '尚未生成 Trace'}</p>{item.input.sourceTraceId && selectedRun && <button type="button" className="text-left text-[10px] text-accent hover:underline" onClick={() => onNavigateResult({ ...item, traceId: item.input.sourceTraceId, caseId: item.input.sourceCaseId, packageId: undefined }, selectedRun)}>来源 Trace {item.input.sourceTraceId}</button>}<p className="text-[10px] text-muted">{item.evidenceIds.length} 条 Evidence{item.caseId ? ` · ${item.caseId}` : ''}</p>{item.traceId && item.caseId && selectedRun && <Button size="sm" variant="ghost" onClick={() => onNavigateResult(item, selectedRun)}>查看 Case / Trace</Button>}</div> }
  ]

  const assetFields = (selectedId: string, selectedVersionId: string, onAsset: (value: string) => void, onVersion: (value: string) => void, prefix: 'Query' | '运行') => <>
    <Field label="关联资产（可选）" hint={prefix === '运行' ? '留空沿用每条样本的资产；再次运行会保存独立批次。' : '未指定时使用运行配置。'}>
      <SelectInput aria-label={`${prefix} 关联资产`} value={selectedId} onChange={event => onAsset(event.target.value)}><option value="">未指定资产</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {ASSET_CATALOG_KIND_LABELS[asset.kind]}</option>)}</SelectInput>
    </Field>
    <Field label="固定版本（可选）">
      <SelectInput aria-label={`${prefix} 固定版本`} value={selectedVersionId} disabled={!selectedId} onChange={event => onVersion(event.target.value)}><option value="">未指定版本</option>{versionsFor(selectedId).map(version => <option key={version.id} value={version.id}>{version.version}</option>)}</SelectInput>
    </Field>
  </>

  return <div className="space-y-5" data-testid="dataset-execution-workbench">
    <section className="space-y-3 rounded-lg border border-line bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">执行与评测</h3><p className="mt-1 text-[11px] leading-5 text-muted">生成新的执行记录，或仅评测已有结果；每次运行保存独立批次，准出结论单独保留。</p></div><StatusBadge status="MOCK" label="本地 Mock 执行" tone="neutral" showIcon={false} /></div>
      <div className="flex flex-wrap gap-2">
        {custom && <Button size="sm" icon={Plus} disabled={!editable} onClick={() => { setQueryError(''); setQueryOpen(true) }}>添加 Query</Button>}
        <Button size="sm" variant="primary" icon={Play} disabled={!allGenerationInputs.length || running} onClick={() => openRun('GENERATE_AND_EVALUATE')}>跑结果 &amp; 评测</Button>
        <Button size="sm" icon={RefreshCw} disabled={!allEvaluationInputs.length || running} onClick={() => openRun('EVALUATE_ONLY')}>仅评测已有结果</Button>
      </div>
      <p className="text-[11px] leading-5 text-muted">{allGenerationInputs.length} 条含实际 Query 的可运行样本；{allEvaluationInputs.length} 条已有结果可评测。{unresolvedExternal > 0 && <span>另有 {unresolvedExternal} 条外部统计样本，未提供实际 Query，不计入可运行数量。</span>}{dataset.frozen && <span>数据集已冻结，不能新增成员，仍可执行已有样本。</span>}</p>
      {notice && <p role="status" className="text-xs leading-5 text-muted">{notice}</p>}
      {runError && !runOpen && <p role="alert" className="text-xs text-fail">{runError}</p>}
    </section>

    {custom && <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">人工 Query</h3><span className="text-xs text-muted">{queries.length} 条</span></div><DataTable caption="人工 Query" columns={queryColumns} rows={queries} rowKey={query => query.id} dense empty={<EmptyState title="尚未人工添加 Query" description={editable ? '点击“添加 Query”，录入新任务后执行生成与评测。' : '冻结数据集不能新增 Query。'} />} /></section>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">运行批次</h3>{selectedRun && <ExecutionStatus status={selectedRun.status} />}</div>
      {runs.length ? <>
        <Field label="运行批次"><SelectInput aria-label="运行批次" value={selectedRun?.id ?? ''} onChange={event => selectRun(event.target.value)}>{runs.map((run, index) => <option key={run.id} value={run.id}>{dateText(run.createdAt)} · {run.mode === 'GENERATE_AND_EVALUATE' ? '生成与评测' : '仅评测'} · {STATUS_LABEL[run.status]}{index === 0 ? ' · 最新' : ''}</option>)}</SelectInput></Field>
        {selectedRun && <>
          <details className="rounded-lg border border-line bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-semibold">配置快照 · 数据集 {selectedRun.datasetVersion} · {selectedRun.configSnapshot.inputs.length} 条</summary><dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2"><div><dt className="text-muted">数据集</dt><dd className="mt-1">{selectedRun.configSnapshot.datasetSnapshot.name} · {selectedRun.datasetVersion}</dd></div><div><dt className="text-muted">运行范围</dt><dd className="mt-1">{selectedRun.configSnapshot.scope === 'ALL' ? '全部样本' : '待运行 / 未评测样本'}</dd></div><div><dt className="text-muted">资产 / 固定版本</dt><dd className="mt-1">{assets.find(asset => asset.id === selectedRun.configSnapshot.assetId)?.name ?? '按各样本配置'} / {state.assetVersions?.find(version => version.id === selectedRun.configSnapshot.assetVersionId)?.version ?? '按各样本版本'}</dd></div><div><dt className="text-muted">评测标准</dt><dd className="mt-1">{selectedRun.configSnapshot.evalAgentVersion} / {selectedRun.configSnapshot.rubricVersion}</dd></div><div><dt className="text-muted">运行环境 / 模型</dt><dd className="mt-1">{selectedRun.configSnapshot.runEnvironment} / {selectedRun.configSnapshot.model}</dd></div><div><dt className="text-muted">批次 ID / 评测批次</dt><dd className="mt-1 break-all font-mono text-[10px]">{selectedRun.id}<br />{selectedRun.evaluationBatchId}</dd></div></dl></details>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-muted">{selectedRun.items.filter(item => item.status === 'COMPLETED').length} 已完成 / {selectedRun.items.filter(item => item.status === 'FAILED').length} 失败 / {selectedRun.items.length} 总记录 · 所有评分为 0–2</p>{selectedRun.items.some(item => item.status === 'PENDING' || item.status === 'RUNNING') && <Button size="sm" loading={executing} onClick={resumeRun}>继续未完成批次</Button>}</div>
          {selectedRun.errorReason && <p role="alert" className="rounded-md bg-fail/5 px-3 py-2 text-xs text-fail">{selectedRun.errorReason}</p>}
          <DataTable caption="运行结果" columns={resultColumns} rows={selectedRun.items} rowKey={item => item.id} dense />
        </>}
      </> : <EmptyState title="尚未运行" description="选择“跑结果 & 评测”或“仅评测已有结果”创建首个批次。运行结束后可在此回查每条记录和历史结果。" />}
    </section>

    <Modal open={queryOpen} onClose={() => !saving && setQueryOpen(false)} title="添加 Query" description="人工输入新的任务，不必先有 Trace。保存后为待运行状态，本地持久化。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setQueryOpen(false)} disabled={saving}>取消</Button><Button variant="primary" loading={saving} disabled={!editable} onClick={saveQuery}>保存 Query</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Query 内容" required className="sm:col-span-2"><TextArea aria-label="Query 内容" value={queryContent} onChange={event => setQueryContent(event.target.value)} placeholder="例如：根据季度经营数据生成管理层汇报 PPT，采用红色简洁风格。" /></Field><Field label="产物类型" required className="sm:col-span-2"><SelectInput aria-label="产物类型" value={queryScenario} onChange={event => setQueryScenario(event.target.value as VerticalScenario)}><option value="">请选择产物类型</option>{SCENARIOS.map(scenario => <option key={scenario} value={scenario}>{scenario}</option>)}</SelectInput></Field>{assetFields(queryAssetId, queryAssetVersionId, value => { setQueryAssetId(value); setQueryAssetVersionId(defaultVersionFor(value)) }, setQueryAssetVersionId, 'Query')}{queryError && <p role="alert" className="text-xs text-fail sm:col-span-2">{queryError}</p>}</div>
    </Modal>
    <Modal open={runOpen} onClose={() => setRunOpen(false)} title="运行配置" description="当前使用本地 Mock 生成与评测。运行配置、样本、Evidence 和评分响应将保留快照，后续可接入真实服务。" size="lg" footer={<div className="flex justify-end gap-2"><Button onClick={() => setRunOpen(false)}>取消</Button><Button variant="primary" disabled={!runInputs.length || running} onClick={startRun}>确认运行</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="执行方式"><SelectInput aria-label="执行方式" value={mode} onChange={event => changeMode(event.target.value as DatasetExecutionMode)}><option value="GENERATE_AND_EVALUATE">跑结果 &amp; 评测（生成新记录）</option><option value="EVALUATE_ONLY">仅评测已有结果</option></SelectInput></Field>
        <Field label="运行范围"><SelectInput aria-label="运行范围" value={scope} onChange={event => setScope(event.target.value as DatasetExecutionScope)}><option value="PENDING">待运行 / 未评测样本</option><option value="ALL">全部样本（新建批次）</option></SelectInput></Field>
        {mode === 'GENERATE_AND_EVALUATE'
          ? assetFields(runAssetId, runAssetVersionId, value => { setRunAssetId(value); setRunAssetVersionId(defaultVersionFor(value)) }, setRunAssetVersionId, '运行')
          : <p className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted sm:col-span-2">仅评测已有结果会沿用来源 Trace 的资产与版本，保留原产物和评分历史。</p>}
        <Field label="Mock 运行情景" className="sm:col-span-2" hint="用于验收成功与失败流程；该配置不代表真实服务结果。"><SelectInput aria-label="Mock 运行情景" value={mockScenario} onChange={event => setMockScenario(event.target.value as DatasetMockScenario)}><option value="SUCCESS">全部成功</option><option value="PARTIAL_FAILURE">部分失败</option><option value="FAILURE">全部失败</option></SelectInput></Field>
        <div className="rounded-lg border border-line bg-slate-50 p-3 text-xs leading-5 sm:col-span-2">
          <p>本次可运行 <strong>{runInputs.length}</strong> 条 Query{mode === 'EVALUATE_ONLY' ? '（已有结果）' : ''}。</p>
          {unresolvedExternal > 0 && <p className="text-muted">{unresolvedExternal} 条外部统计样本未提供实际 Query，不计入可运行数量。</p>}
          {mockScenario === 'PARTIAL_FAILURE' && runInputs.length === 1 && <p className="text-warn">当前只有 1 条记录，失败后批次状态为“失败”；至少 2 条记录才能演示成功与失败并存的“部分失败”。</p>}
          {!runInputs.length && <p className="text-muted">{scope === 'PENDING' ? '没有待运行或未评测样本；如需重复运行，请选择“全部样本”，新批次不会覆盖历史。' : '该数据集没有可运行记录，请先添加 Query 或已有 Trace。'}</p>}
        </div>
        {runError && <p role="alert" className="text-xs text-fail sm:col-span-2">{runError}</p>}
      </div>
    </Modal>
  </div>
}
