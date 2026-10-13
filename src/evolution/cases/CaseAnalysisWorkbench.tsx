import { AlertTriangle, ArrowRight, Braces, ClipboardCheck, FileText, RotateCcw, Search, Tags, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EvalResult, JudgeStatus, Observation } from '../../domain';
import { formatDuration } from '../../selectors';
import { TraceTimeline } from '../../trace';
import { Button, DataTable, Drawer, EmptyState, Field, InlineNotice, Modal, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, cn, type Column } from '../../ui';
import { emptyCaseAnalysisFilters, filterCaseAnalysisRecords, type CaseAnalysisData, type CaseAnalysisFilters, type CaseAnalysisRecord, type CaseReference, type HumanRevisionView, type LogView } from './model';
import { ATTRIBUTION_DIMENSIONS, type EvolutionModule } from '../domain';
import { EntityId, IdLink } from '../components/ViewPrimitives';

import { CaseEvaluations } from './CaseEvaluations';
import { governanceLabel } from '../labels';
import { EVOLUTION_ITEMS } from '../taxonomy';
import { formatNormalizedScoreOutOfTwo } from '../score';
import { CaseDetailPanel } from './CaseDetailPanel';
import type { EvolutionDetailLocation } from './CaseEvaluations';
import type { ModuleReviewInput } from '../reviews';
import { StatusIndicator, statusIndicatorText } from '../components/StatusIndicator';
import { formatGovernanceTime, governanceStageLabel } from '../data/traceGovernance';
import { selectLatestTraceState } from '../data/governanceGraph';
import type { OutcomeReviewInput } from '../outcomeReviews';
export interface HumanConfirmationInput {
    caseId: string;
    status: JudgeStatus;
    note: string;
    by: string;
    createdAt: string;
}
export interface AttributionChangeInput {
    caseId: string;
    attributionId?: string;
    module: string;
    dimension: string;
    routingTags: string[];
    note: string;
    by: string;
    createdAt: string;
}
export interface CaseAnalysisWorkbenchProps {
    initialModuleScoreId?: string;
    initialScoreDimensionId?: string;
    initialEvolutionRecordId?: string;
    initialEvolutionDirectionId?: string;
    initialFindingId?: string;
    sourceRoute?: string;
    onOpenEvolutionWorkbench?: (href: string) => void;
    onEvolutionDetailChange?: (selection?: EvolutionDetailLocation) => void;
    onEvolutionDirectionChange?: (id?: string) => void;
    onOutcomeReview?: (input: OutcomeReviewInput) => Promise<void>;
    initialArtifactId?: string;
    initialEvaluationId?: string;
    onModuleReview?: (input: ModuleReviewInput) => Promise<void>;
    data: CaseAnalysisData;
    detailData?: CaseAnalysisData;
    initialCaseId?: string;
    initialFilters?: CaseAnalysisFilters;
    initialTraceId?: string;
    initialObservationId?: string;
    initialLogId?: string;
    initialEvidenceId?: string;
    initialView?: string;
    initialPage?: number;
    onCloseCase?: () => void;
    onViewChange?: (view: string) => void;
    onPageChange?: (page: number) => void;
    onFiltersChange?: (filters: CaseAnalysisFilters) => void;
    onNavigateReference?: (reference: CaseReference) => void;
    onHumanConfirm?: (input: HumanConfirmationInput) => void | Promise<void>;
  onAttributionChange?: (input: AttributionChangeInput) => void | Promise<void>;
  onBulkTraceImport?: (traceIds: string[], kind: 'evaluation' | 'golden') => void | Promise<void | string>;
}
const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const judgeTone = (status: string) => status === 'PASS' ? 'pass' as const : status === 'FAIL' ? 'fail' as const : status === 'DERIVED_FAIL' ? 'derived' as const : status === 'UNKNOWN' ? 'warn' as const : 'neutral' as const;
const effectiveEval = (evaluation: EvalResult) => evaluation.humanStatus ?? evaluation.status ?? evaluation.autoStatus;
const referenceLabel: Partial<Record<CaseReference['kind'], string>> = { case: 'Case', session: 'Session', trace: 'Trace', observation: 'Observation', log: 'Log', evidence: 'Evidence', artifact: '产物', 'process-eval': '过程评测', 'outcome-eval': '结果评测', attribution: '归因', issue: '问题', cluster: '问题簇', 'issue-cluster': '问题簇', skill: 'Skill', asset: '资产', variant: '能力变体', dataset: 'Dataset', rule: '规则', experiment: '实验', 'experiment-run': '运行', window: '窗口', decision: '决策', release: '发布版本' };
function FilterInput({ label, value, placeholder, onChange }: {
    label: string;
    value?: string;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return <label className="min-w-[150px] flex-1"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span><span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/><TextInput aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-8"/></span></label>;
}
function SelectFilter({ label, value, onChange, children }: {
    label: string;
    value?: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return <label className="min-w-[136px]"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span><SelectInput aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>{children}</SelectInput></label>;
}
function UnifiedFilters({ filters, tags, resultCount, data, onChange, onReset }: {
    filters: CaseAnalysisFilters;
    tags: string[];
    resultCount: number;
    data: CaseAnalysisData;
    onChange: (patch: Partial<CaseAnalysisFilters>) => void;
    onReset: () => void;
}) {
    const toggleTag = (tag: string) => onChange({ routingTags: filters.routingTags?.includes(tag) ? filters.routingTags.filter((item) => item !== tag) : [...(filters.routingTags ?? []), tag] });
    const windows = data.evolutionState?.windows ?? [];
    const datasets = data.evolutionState?.datasets ?? [];
    const datasetCategoryLabel: Record<string, string> = { GATE: '准出数据集', GOLDEN: '黄金测试集', PERSONAL: '个人创建集' };
    const datasetTypeLabel: Record<string, string> = { ATTRIBUTION: '原始归因集', GENERALIZATION: '泛化集', REGRESSION: '回归集', WINDOW_ONLINE: '时间窗口集' };
    const selectedWindow = filters.timeWindowId ? windows.find(item => item.id === filters.timeWindowId) : undefined;
    const customWindow = filters.timeWindowId === 'CUSTOM' || filters.timeFrom !== undefined || filters.timeTo !== undefined;
    const timeWindowValue = selectedWindow?.id ?? (customWindow ? 'CUSTOM' : filters.timeRange && filters.timeRange !== 'all' ? `RELATIVE:${filters.timeRange}` : '');
    const datasetCategory = (dataset: typeof datasets[number]) => dataset.datasetCategory ?? (dataset.ownerScope === 'USER' ? 'PERSONAL' : dataset.setRole === 'GOLDEN' || dataset.purpose === '黄金集' ? 'GOLDEN' : 'GATE');
    const datasetOptions = datasets.filter(dataset => !filters.datasetCategory || datasetCategory(dataset) === filters.datasetCategory);
    const setWindow = (value: string) => {
      if (value === 'CUSTOM') return onChange({ timeWindowId: 'CUSTOM', timeRange: 'all', timeFrom: filters.timeFrom, timeTo: filters.timeTo });
      if (value.startsWith('RELATIVE:')) return onChange({ timeWindowId: undefined, timeFrom: undefined, timeTo: undefined, timeRange: value.slice('RELATIVE:'.length) as CaseAnalysisFilters['timeRange'] });
      onChange({ timeWindowId: value || undefined, timeFrom: undefined, timeTo: undefined, timeRange: 'all' });
    };
    const setDatasetCategory = (value: string) => onChange({ datasetCategory: value as CaseAnalysisFilters['datasetCategory'] || undefined, datasetPurpose: undefined, datasetId: undefined });
    return <section aria-label="统一筛选" className="rounded-lg border border-line bg-panel p-3 shadow-panel">
    <div className="flex flex-wrap items-end gap-2.5">
      <SelectFilter label="Channel" value={filters.channel} onChange={(channel) => onChange({ channel })}><option value="">全部</option>{['小程序', 'genflow pc 端', 'genflow 垂类入口'].map(item => <option key={item}>{item}</option>)}</SelectFilter>
      <SelectFilter label="垂类场景" value={filters.verticalScenario} onChange={(verticalScenario) => onChange({ verticalScenario })}><option value="">全部</option>{['PPT', 'Word', 'Excel', '生图'].map(item => <option key={item}>{item}</option>)}</SelectFilter>
      <FilterInput label="Session ID" value={filters.sessionId} placeholder="session-..." onChange={(sessionId) => onChange({ sessionId })}/>
      <FilterInput label="Trace ID" value={filters.traceId} placeholder="trace-..." onChange={(traceId) => onChange({ traceId })}/>
      <FilterInput label="Skill ID" value={filters.skillId} placeholder="Skill ID" onChange={(skillId) => onChange({ skillId })}/>
      <FilterInput label="Skill 版本" value={filters.skillVersion} placeholder="如 2.5.0" onChange={(skillVersion) => onChange({ skillVersion })}/>
      <SelectFilter label="时间窗口" value={timeWindowValue} onChange={setWindow}><option value="">全部时间窗口</option>{windows.map(window => <option key={window.id} value={window.id}>{window.name} · {window.timeRange.from.slice(0, 10)} 至 {window.timeRange.to.slice(0, 10)}</option>)}<option value="CUSTOM">自定义时间窗口</option><optgroup label="相对时间范围"><option value="RELATIVE:24h">近 24 小时</option><option value="RELATIVE:7d">近 7 天</option><option value="RELATIVE:14d">近 14 天</option><option value="RELATIVE:30d">近 30 天</option></optgroup></SelectFilter>
      {customWindow && <><label className="min-w-[165px]"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">自定义开始时间</span><TextInput aria-label="自定义开始时间" type="datetime-local" value={filters.timeFrom ?? ''} onChange={event => onChange({ timeWindowId: undefined, timeRange: 'all', timeFrom: event.target.value || undefined })}/></label><label className="min-w-[165px]"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">自定义结束时间</span><TextInput aria-label="自定义结束时间" type="datetime-local" value={filters.timeTo ?? ''} onChange={event => onChange({ timeWindowId: undefined, timeRange: 'all', timeTo: event.target.value || undefined })}/></label>{filters.timeFrom && filters.timeTo && Date.parse(filters.timeFrom) > Date.parse(filters.timeTo) && <p role="alert" className="pb-2 text-xs text-fail">结束时间不能早于开始时间</p>}</>}
      <SelectFilter label="数据集类型" value={filters.datasetCategory} onChange={setDatasetCategory}><option value="">全部数据集类型</option><option value="GATE">准出数据集</option><option value="GOLDEN">黄金测试集</option><option value="PERSONAL">个人创建集</option></SelectFilter>
      <SelectFilter label="具体数据集" value={filters.datasetId} onChange={(datasetId) => onChange({ datasetId: datasetId || undefined })}><option value="">全部数据集</option>{datasetOptions.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.version}{dataset.datasetCategory === 'GATE' && dataset.type ? ` · ${datasetTypeLabel[dataset.type] ?? dataset.type}` : ''}</option>)}</SelectFilter>
      <SelectFilter label="过程最终得分（0–2）" value={filters.processEval} onChange={(processEval) => onChange({ processEval })}><option value="">全部</option><option value="0-0.5">0–0.5</option><option value="0.5-1">0.5–1</option><option value="1-1.5">1–1.5</option><option value="1.5-2">1.5–2</option></SelectFilter>
      <SelectFilter label="结果最终得分（0–2）" value={filters.outcomeEval} onChange={(outcomeEval) => onChange({ outcomeEval })}><option value="">全部</option><option value="0-0.5">0–0.5</option><option value="0.5-1">0.5–1</option><option value="1-1.5">1–1.5</option><option value="1.5-2">1.5–2</option></SelectFilter>
      <SelectFilter label="归因" value={filters.evolutionItem} onChange={(evolutionItem) => onChange({ evolutionItem })}><option value="">全部</option>{EVOLUTION_ITEMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectFilter>
      <FilterInput label="Token 最小" value={filters.tokenMin === undefined ? '' : String(filters.tokenMin)} placeholder="0" onChange={(value) => onChange({ tokenMin: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="Token 最大" value={filters.tokenMax === undefined ? '' : String(filters.tokenMax)} placeholder="不限" onChange={(value) => onChange({ tokenMax: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="耗时最小 ms" value={filters.latencyMin === undefined ? '' : String(filters.latencyMin)} placeholder="0" onChange={(value) => onChange({ latencyMin: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="耗时最大 ms" value={filters.latencyMax === undefined ? '' : String(filters.latencyMax)} placeholder="不限" onChange={(value) => onChange({ latencyMax: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="Log ID" value={filters.logId} placeholder="log-..." onChange={(logId) => onChange({ logId })}/>
      <SelectFilter label="多场景命中" value={filters.multiScene} onChange={(multiScene) => onChange({ multiScene: multiScene as CaseAnalysisFilters['multiScene'] })}><option value="all">全部</option><option value="yes">是</option><option value="no">否</option></SelectFilter>
      <Button icon={RotateCcw} onClick={onReset}>重置</Button><span className="ml-auto pb-2 text-xs text-muted">{resultCount} 条 Trace</span>
    </div>
    <fieldset aria-label="分流标签" className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"><legend className="sr-only">分流标签</legend><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Tags className="h-3.5 w-3.5"/>分流标签</span>{tags.map((tag) => <label key={tag} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]', filters.routingTags?.includes(tag) ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:border-accent/40')}><input aria-label={tag} type="checkbox" checked={filters.routingTags?.includes(tag) ?? false} onChange={() => toggleTag(tag)} className="sr-only"/>{tag}</label>)}</fieldset>
  </section>;
}
function IdButton({ reference, onNavigate }: {
    reference: CaseReference;
    onNavigate?: (reference: CaseReference) => void;
}) {
    const accessibleLabel = reference.label === reference.id ? reference.id : `${reference.id} · ${reference.label}`;
    return <IdLink id={reference.id} label={accessibleLabel} kind={reference.kind === 'issue-cluster' ? 'cluster' : reference.kind} onOpen={onNavigate ? () => onNavigate(reference) : undefined}/>;
}
export function CaseAnalysisWorkbench({ data, detailData, initialModuleScoreId, initialScoreDimensionId, initialEvolutionRecordId, initialEvolutionDirectionId, initialFindingId, sourceRoute, onOpenEvolutionWorkbench, onEvolutionDetailChange, onEvolutionDirectionChange, initialCaseId, initialFilters, initialTraceId, initialObservationId, initialLogId, initialEvidenceId, initialArtifactId, initialEvaluationId, initialView, initialPage, onCloseCase, onViewChange, onPageChange, onFiltersChange, onNavigateReference, onHumanConfirm, onAttributionChange, onBulkTraceImport, onModuleReview, onOutcomeReview }: CaseAnalysisWorkbenchProps) {
    const [filters, setFilters] = useState<CaseAnalysisFilters>({ ...emptyCaseAnalysisFilters, ...initialFilters });
    const [selectedId, setSelectedId] = useState(initialCaseId);
    const [selectedTraceId, setSelectedTraceId] = useState(initialTraceId);
    const [selectedView, setSelectedView] = useState(initialView);
    const [page, setPage] = useState(initialPage ?? 0);
    const [selectedTraceIds, setSelectedTraceIds] = useState<string[]>([]);
    const [importMessage,setImportMessage]=useState('');
    const [importing,setImporting]=useState(false);
    const bulkImport=async(kind:'evaluation'|'golden')=>{if(importing)return;setImporting(true);setImportMessage('');try{const message=await onBulkTraceImport?.(selectedTraceIds,kind);setImportMessage(message ?? '操作已完成');}catch(error){setImportMessage(`保存失败：${error instanceof Error ? error.message : '请重试'}，所选 Trace 已保留。`)}finally{setImporting(false)}};
    const changePage = (value: number) => { setPage(value); onPageChange?.(value); };
    const openCase = (id: string, traceId?: string, caseView = 'eval') => { setSelectedId(id); setSelectedTraceId(traceId); setSelectedView(caseView); onNavigateReference?.({ kind: traceId ? 'trace' : 'case', id: traceId ?? id, label: traceId ?? id, caseView }); };
    const initialFiltersKey = JSON.stringify(initialFilters ?? {});
    const previousInitialFiltersKey = useRef(initialFiltersKey);
    useEffect(() => { setSelectedId(initialCaseId); }, [initialCaseId]);
    useEffect(() => { setSelectedTraceId(initialTraceId); }, [initialTraceId]);
    useEffect(() => { setSelectedView(initialView); }, [initialView]);
    useEffect(() => {
        if (previousInitialFiltersKey.current === initialFiltersKey)
            return;
        previousInitialFiltersKey.current = initialFiltersKey;
        setFilters((current) => ({ ...current, ...initialFilters }));
    }, [initialFilters, initialFiltersKey]);
    const tags = useMemo(() => [...new Set(data.cases.flatMap((record) => record.routingTags))], [data.cases]);
    const records = useMemo(() => filterCaseAnalysisRecords(data.traceRecords ?? data.cases, filters, data.referenceTime), [data, filters]);
    const pageSize = 10;
    useEffect(() => { setPage(Math.min(initialPage ?? page, Math.max(0, Math.ceil(records.length / pageSize)-1))); }, [initialPage, records.length]);
    const updateFilters = (patch: Partial<CaseAnalysisFilters>) => {
        const next = { ...filters, ...patch };
        setFilters(next);
        changePage(0);
        onFiltersChange?.(next);
    };
    const reset = () => {
      const next = { ...emptyCaseAnalysisFilters };
      setFilters(next);
      setSelectedTraceIds([]);
      changePage(0);
        onFiltersChange?.(next);
    };
    const displayRecords = useMemo(() => {
        return records.slice(page * pageSize, page * pageSize + pageSize);
    }, [filters, records, page]);
    const columns: Column<CaseAnalysisRecord>[] = [
        { key: 'select', header: '', accessor: record => <input aria-label={`选择 Trace ${record.trace?.id ?? record.task.traceId}`} type="checkbox" checked={record.trace ? selectedTraceIds.includes(record.trace.id) : false} onChange={event => { event.stopPropagation(); if (!record.trace) return; setSelectedTraceIds(current => event.target.checked ? [...new Set([...current, record.trace!.id])] : current.filter(id => id !== record.trace!.id)) }} onClick={event => event.stopPropagation()} /> },
        { key: 'case', header: 'Trace / Case / Query', accessor: record => <div className="min-w-[220px]">
          <p className="line-clamp-2 text-xs font-medium leading-5 text-ink">{record.task.query}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant="primary" aria-label={"查看完整 Case " + record.id} onClick={event => { event.stopPropagation(); openCase(record.id, record.trace?.id); }}>查看完整 Case</Button><span className="font-mono text-[10px] text-muted">{record.id}</span><StatusBadge status={record.sourceLabel ?? "mock集"} tone="info" showIcon={false}/></div><div className="mt-2"><EntityId kind="trace" id={record.trace?.id ?? record.task.traceId} onOpen={onNavigateReference ? ref => onNavigateReference({...ref,label:ref.id}) : undefined}/></div>
        </div> },
        { key: 'scene', header: '场景 / Skill', accessor: (record) => <div><p>{record.task.businessType}</p><IdButton reference={{ kind: 'skill', id: record.skill.id, label: `${record.skill.id} @ ${record.skill.version}` }} onNavigate={onNavigateReference}/><p className="mt-1 text-[10px] text-muted">来源：{record.sourceLabel ?? '来源待确认'}</p>{record.datasetRefs?.length ? <div className="mt-1 space-y-0.5 text-[10px] text-muted">{record.datasetRefs.map(dataset => <p key={`${dataset.id}:${dataset.version}`} title={`${dataset.id} · ${dataset.version}`}>数据集：{dataset.name} · {dataset.version}</p>)}</div> : null}</div> },
        { key: 'eval', header: '过程 / 产物评分（0–2）', accessor: (record) => <div className="space-y-1"><p className="font-mono text-xs text-ink">过程 {formatNormalizedScoreOutOfTwo(record.processFinalScore)} · 产物 {formatNormalizedScoreOutOfTwo(record.outcomeFinalScore)}</p><p className="text-[10px] text-muted">评分口径统一为 0–2；缺失显示待评测</p></div> },
        { key: 'attribution', header: '归因 / 分流', accessor: (record) => <div><p className="font-medium">{governanceLabel(record.attributionModule)} · {record.attributionDimension}</p><div className="mt-1 flex flex-wrap gap-1">{record.routingTags.map((tag) => <span key={tag} className="rounded bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent">{tag}</span>)}</div></div> },
        { key: 'status', header: '状态', accessor: record => { const latest=record.governance ? selectLatestTraceState(record.governance) : {status:'UNKNOWN',label:'暂无流转记录',timeKnown:false}; return <button type="button" className="max-w-[180px] rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-accent" aria-label={`查看 Trace ${record.trace?.id ?? record.id} 最新状态`} onClick={event=>{event.stopPropagation();openCase(record.id,record.trace?.id,'eval')}}><StatusIndicator status={latest.status} label={`${latest.label} · ${statusIndicatorText(latest.status)}`} context="governance"/>{!latest.timeKnown && <span className="mt-1 block text-[10px] text-muted">状态时间未记录</span>}</button> } },
        { key: 'cost', header: '成本', accessor: (record) => <div className="text-[10px] text-muted"><p>{record.tokens ?? 0} tokens</p><p>{record.latencyMs ?? record.task.latency} ms</p></div> },
        { key: 'delivery', header: '交付物', accessor: record => record.deliveryUri ? /^https?:/.test(record.deliveryUri) ? <a href={record.deliveryUri} download className="text-xs text-accent hover:underline" onClick={event=>event.stopPropagation()}>下载产物</a> : <Button size="sm" variant="ghost" onClick={event=>{event.stopPropagation();openCase(record.id,record.trace?.id,'outcome')}}>查看产物 · Mock</Button> : <span className="text-[10px] text-muted">未生成</span> },
        { key: 'time', header: '时间', accessor: (record) => <span className="whitespace-nowrap text-[11px] text-muted">{DATE_FORMAT.format(new Date(record.task.timestamp))}</span> }
    ];
    return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status="本地 Mock 数据" tone="warn" showIcon={false}/><InlineNotice tone="info"><strong>{data.cases.length}</strong> 个演示 Case · 数据不代表真实线上指标</InlineNotice></div>
    <UnifiedFilters filters={filters} tags={tags} resultCount={records.length} data={data} onChange={updateFilters} onReset={reset}/>
    {selectedTraceIds.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/20 bg-accent/5 p-3"><span className="text-xs text-accent">已选择 {selectedTraceIds.length} 条 Trace</span><Button size="sm" disabled={!onBulkTraceImport || importing} onClick={() => void bulkImport('evaluation')}>批量导入评测集</Button><Button size="sm" disabled={!onBulkTraceImport || importing} variant="primary" onClick={() => void bulkImport('golden')}>加入黄金集</Button><Button size="sm" variant="ghost" onClick={() => setSelectedTraceIds([])}>取消选择</Button></div>}
    {importMessage && <InlineNotice>{importMessage}</InlineNotice>}
    <DataTable aria-label="Case / Trace 列表" caption="Case / Trace 列表" columns={columns} rows={displayRecords} rowKey={(record) => record.trace?.id ?? record.id} onRowClick={(record) => openCase(record.id, record.trace?.id)} selectedRowId={selectedTraceId} empty={<EmptyState title="暂无匹配 Trace" description="当前筛选没有命中；缺失数据不会被默认视为 PASS。" icon={AlertTriangle}/>}/>
    {records.length > pageSize && <div className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-2 text-xs"><span className="text-muted">第 {page + 1} / {Math.max(1, Math.ceil(records.length / pageSize))} 页 · 共 {records.length} 条匹配 Trace</span><div className="flex gap-2"><Button size="sm" disabled={page <= 0} onClick={() => changePage(Math.max(0, page - 1))}>上一页 Trace</Button><Button size="sm" disabled={page >= Math.ceil(records.length / pageSize) - 1} onClick={() => changePage(Math.min(Math.ceil(records.length / pageSize) - 1, page + 1))}>下一页 Trace</Button></div></div>}
    <CaseDetailPanel key={`${selectedId}:${selectedTraceId ?? ''}:${initialObservationId ?? ''}:${initialLogId ?? ''}:${initialEvidenceId ?? ''}`} record={(detailData ?? data).cases.find((record) => record.id === selectedId)} data={detailData ?? data} initialTraceId={selectedTraceId} initialObservationId={initialObservationId} initialLogId={initialLogId} initialEvidenceId={initialEvidenceId} initialArtifactId={initialArtifactId} initialEvaluationId={initialEvaluationId} initialView={onEvolutionDetailChange ? initialView : selectedView} initialModuleScoreId={initialModuleScoreId} initialScoreDimensionId={initialScoreDimensionId} initialEvolutionRecordId={initialEvolutionRecordId} initialEvolutionDirectionId={initialEvolutionDirectionId} onEvolutionDirectionChange={onEvolutionDirectionChange} initialFindingId={initialFindingId} sourceRoute={sourceRoute} onOpenEvolutionWorkbench={onOpenEvolutionWorkbench} onEvolutionDetailChange={onEvolutionDetailChange} onViewChange={onViewChange} onClose={() => { setSelectedId(undefined); onCloseCase?.(); }} onNavigate={onNavigateReference} onHumanConfirm={onHumanConfirm} onAttributionChange={onAttributionChange} onModuleReview={onModuleReview} onOutcomeReview={onOutcomeReview}/>
  </div>;
}
