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
    onHumanConfirm?: (input: HumanConfirmationInput) => void;
  onAttributionChange?: (input: AttributionChangeInput) => void;
  onBulkTraceImport?: (traceIds: string[], kind: 'evaluation' | 'golden') => void;
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
function UnifiedFilters({ filters, tags, resultCount, onChange, onReset }: {
    filters: CaseAnalysisFilters;
    tags: string[];
    resultCount: number;
    onChange: (patch: Partial<CaseAnalysisFilters>) => void;
    onReset: () => void;
}) {
    const toggleTag = (tag: string) => onChange({ routingTags: filters.routingTags?.includes(tag) ? filters.routingTags.filter((item) => item !== tag) : [...(filters.routingTags ?? []), tag] });
    return <section aria-label="统一筛选" className="rounded-lg border border-line bg-panel p-3 shadow-panel">
    <div className="flex flex-wrap items-end gap-2.5">
      <SelectFilter label="Channel" value={filters.channel} onChange={(channel) => onChange({ channel })}><option value="">全部</option>{['小程序', 'genflow pc 端', 'genflow 垂类入口'].map(item => <option key={item}>{item}</option>)}</SelectFilter>
      <SelectFilter label="垂类场景" value={filters.verticalScenario} onChange={(verticalScenario) => onChange({ verticalScenario })}><option value="">全部</option>{['PPT', 'Word', 'Excel', '生图'].map(item => <option key={item}>{item}</option>)}</SelectFilter>
      <FilterInput label="Session ID" value={filters.sessionId} placeholder="session-..." onChange={(sessionId) => onChange({ sessionId })}/>
      <FilterInput label="Trace ID" value={filters.traceId} placeholder="trace-..." onChange={(traceId) => onChange({ traceId })}/>
      <FilterInput label="Skill ID" value={filters.skillId} placeholder="Skill ID" onChange={(skillId) => onChange({ skillId })}/>
      <FilterInput label="Skill 版本" value={filters.skillVersion} placeholder="如 2.5.0" onChange={(skillVersion) => onChange({ skillVersion })}/>
      <SelectFilter label="时间范围" value={filters.timeRange} onChange={(timeRange) => onChange({ timeRange: timeRange as CaseAnalysisFilters['timeRange'] })}><option value="24h">近 24 小时</option><option value="7d">近 7 天</option><option value="14d">近 14 天</option><option value="30d">近 30 天</option><option value="all">全部</option></SelectFilter>
      <SelectFilter label="过程最终得分（0–2）" value={filters.processEval} onChange={(processEval) => onChange({ processEval })}><option value="">全部</option><option value="0-0.5">0–0.5</option><option value="0.5-1">0.5–1</option><option value="1-1.5">1–1.5</option><option value="1.5-2">1.5–2</option></SelectFilter>
      <SelectFilter label="结果最终得分（0–2）" value={filters.outcomeEval} onChange={(outcomeEval) => onChange({ outcomeEval })}><option value="">全部</option><option value="0-0.5">0–0.5</option><option value="0.5-1">0.5–1</option><option value="1-1.5">1–1.5</option><option value="1.5-2">1.5–2</option></SelectFilter>
      <SelectFilter label="归因" value={filters.evolutionItem} onChange={(evolutionItem) => onChange({ evolutionItem })}><option value="">全部</option>{EVOLUTION_ITEMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectFilter>
      <FilterInput label="Token 最小" value={filters.tokenMin === undefined ? '' : String(filters.tokenMin)} placeholder="0" onChange={(value) => onChange({ tokenMin: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="Token 最大" value={filters.tokenMax === undefined ? '' : String(filters.tokenMax)} placeholder="不限" onChange={(value) => onChange({ tokenMax: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="耗时最小 ms" value={filters.latencyMin === undefined ? '' : String(filters.latencyMin)} placeholder="0" onChange={(value) => onChange({ latencyMin: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="耗时最大 ms" value={filters.latencyMax === undefined ? '' : String(filters.latencyMax)} placeholder="不限" onChange={(value) => onChange({ latencyMax: value === '' ? undefined : Number(value) })}/>
      <FilterInput label="Log ID" value={filters.logId} placeholder="log-..." onChange={(logId) => onChange({ logId })}/>
      <SelectFilter label="多场景命中" value={filters.multiScene} onChange={(multiScene) => onChange({ multiScene: multiScene as CaseAnalysisFilters['multiScene'] })}><option value="all">全部</option><option value="yes">是</option><option value="no">否</option></SelectFilter>
      <Button icon={RotateCcw} onClick={onReset}>重置</Button><span className="ml-auto pb-2 text-xs text-muted">{resultCount} 个 Case</span>
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
function SummaryTile({ label, value, tone }: {
    label: string;
    value: ReactNode;
    tone?: 'pass' | 'fail' | 'warn';
}) {
    return <div className="min-w-0 rounded-md border border-line bg-slate-50 p-3"><p className="text-[10px] text-muted">{label}</p><div className={cn('mt-1 break-words text-xs font-semibold text-ink', tone === 'fail' && 'text-fail', tone === 'pass' && 'text-pass', tone === 'warn' && 'text-warn')}>{value}</div></div>;
}
function SessionPanel({ record, onNavigate }: {
    record: CaseAnalysisRecord;
    onNavigate?: (reference: CaseReference) => void;
}) {
    return <div className="space-y-3"><InlineNotice tone="info" title={<span className="inline-flex items-center gap-1"><span>Session</span><EntityId id={record.session.id} kind="session" onOpen={onNavigate ? () => onNavigate({ kind: 'session', id: record.session.id, label: record.session.id }) : undefined}/></span>}>按对话顺序展示上下文；每个 Query 保留对应 Trace 入口。</InlineNotice><ol className="space-y-3">{record.session.turns.map((turn) => <li key={turn.id} className={cn('rounded-lg border p-3', turn.role === 'user' ? 'ml-0 mr-8 border-accent/20 bg-accent/5' : 'ml-8 mr-0 border-line bg-slate-50')}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-semibold text-ink">{turn.role === 'user' ? '用户' : 'Agent'} · 第 {turn.sequence} 轮</span><span className="text-[10px] text-muted">{DATE_FORMAT.format(new Date(turn.createdAt))}</span></div><p className="mt-2 text-xs leading-5 text-ink">{turn.content}</p>{turn.traceId && <IdButton reference={{ kind: 'trace', id: turn.traceId, label: `打开 Trace ${turn.traceId}` }} onNavigate={onNavigate}/>}</li>)}</ol></div>;
}
function LinksPanel({ record, onNavigate }: {
    record: CaseAnalysisRecord;
    onNavigate?: (reference: CaseReference) => void;
}) {
    return <div className="space-y-3"><InlineNotice tone="info" title="正向治理进度">一个 Case 可以产生多个问题并进入多条处理链，以下 ID 均可用于双向反查。</InlineNotice>{record.links.length ? <div className="space-y-2">{record.links.map((link, index) => <div key={link.kind + '-' + link.id} className="relative rounded-lg border border-line bg-white p-3">{index < record.links.length - 1 && <span aria-hidden="true" className="absolute left-7 top-full h-2 w-px bg-slate-300"/>}<div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{referenceLabel[link.kind]}</p><p className="mt-1 truncate text-xs font-semibold text-ink">{link.label}</p><IdButton reference={link} onNavigate={onNavigate}/></div><StatusBadge status={link.status ?? '待处理'} tone={link.status?.includes('通过') ? 'pass' : link.status?.includes('待') ? 'warn' : 'info'} showIcon={false}/></div></div>)}</div> : <EmptyState title="尚未进入治理链" description="可先完成人工确认或归因，再创建问题与变体。"/>}</div>;
}
interface CaseDetailProps {
    record?: CaseAnalysisRecord;
    data: CaseAnalysisData;
    onClose: () => void;
    onNavigate?: (reference: CaseReference) => void;
    onHumanConfirm?: (input: HumanConfirmationInput) => void;
    onAttributionChange?: (input: AttributionChangeInput) => void;
}
function CaseDetail({ record, data, onClose, onNavigate, onHumanConfirm, onAttributionChange, initialTraceId, initialObservationId, initialLogId, initialEvidenceId, initialView, onViewChange }: CaseDetailProps & {
    initialTraceId?: string;
    initialObservationId?: string;
    initialLogId?: string;
    initialEvidenceId?: string;
    initialView?: string;
    onViewChange?: (view: string) => void;
}) {
    const [selectedTraceId, setSelectedTraceId] = useState(initialTraceId);
    const activeTrace = record?.traces?.find((item) => item.id === selectedTraceId) ?? record?.trace;
    const initialObservation = activeTrace?.observations.find((item) => item.id === initialObservationId || item.evidenceIds.includes(initialEvidenceId ?? '')) ?? activeTrace?.observations.find((item) => (item.judgeStatus ?? item.status) === 'FAIL') ?? activeTrace?.observations[0];
    const [tab, setTab] = useState(initialView && ['trace', 'session', 'eval', 'task', 'governance'].includes(initialView) ? initialView : record?.trace ? 'trace' : 'task');
    const [observation, setObservation] = useState<Observation | undefined>(initialObservation);
    const [log, setLog] = useState<LogView | undefined>(record?.logs.find((item) => item.id === initialLogId));
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmStatus, setConfirmStatus] = useState<JudgeStatus>(record?.outcomeSummary ?? 'UNKNOWN');
    const [confirmNote, setConfirmNote] = useState('');
    const [attributionOpen, setAttributionOpen] = useState(false);
    const attributionOptions = record?.attributions ?? [];
    const [attributionId, setAttributionId] = useState(attributionOptions[0]?.id ?? '');
    const [module, setModule] = useState(record?.attributionModule ?? '未归因');
    const [dimension, setDimension] = useState(record?.attributionDimension ?? '需求待补充');
    const [routingTags, setRoutingTags] = useState(record?.routingTags ?? []);
    const [attributionNote, setAttributionNote] = useState('');
    const [localRevisions, setLocalRevisions] = useState<HumanRevisionView[]>(record?.revisions ?? []);
    const taxonomyModule = (module === '上文模块' || module === '未归因' ? 'Context' : module) as EvolutionModule;
    if (!record)
        return null;
    const currentRecord = record;
    const openTrace = (id?: string) => {
        setTab('trace');
        setObservation(id ? activeTrace?.observations.find((item) => item.id === id) : currentRecord.failureObservation);
    };
    const submitConfirmation = () => {
        const input = { caseId: currentRecord.id, status: confirmStatus, note: confirmNote.trim() || '人工复核完成。', by: '当前用户', createdAt: new Date().toISOString() };
        onHumanConfirm?.(input);
        setLocalRevisions((items) => [...items, { id: 'local-confirm-' + items.length, kind: 'confirmation', value: input.status, note: input.note, by: input.by, at: input.createdAt }]);
        setConfirmOpen(false);
    };
    const submitAttribution = () => {
        const input = { caseId: currentRecord.id, attributionId: attributionId || undefined, module, dimension, routingTags, note: attributionNote.trim() || '人工调整归因。', by: '当前用户', createdAt: new Date().toISOString() };
        onAttributionChange?.(input);
        setLocalRevisions((items) => [...items, { id: 'local-attribution-' + items.length, kind: 'attribution', value: module + ' / ' + dimension, note: input.note, by: input.by, at: input.createdAt }]);
        setAttributionOpen(false);
    };
    const displayTraceId = activeTrace?.id ?? 'Trace 未记录';
    if (activeTrace && activeTrace.id !== record.trace?.id) {
        const modules = record.moduleEvaluationsByTrace?.[activeTrace.id] ?? [];
        const summary = (outcome: boolean): JudgeStatus => {
            const scores = modules.filter(score => outcome ? score.moduleCode === 'OUTCOME' : !['CONTEXT', 'OUTCOME'].includes(String(score.moduleCode)));
            const values = scores.map(score => score.humanStatus ?? score.automaticStatus);
            return values.includes('FAIL') ? 'FAIL' : !values.length || values.includes('UNKNOWN') ? 'UNKNOWN' : values.every(value => value === 'N/A') ? 'N/A' : 'PASS';
        };
        record = { ...record, trace: activeTrace, skill: record.skillsByTrace?.[activeTrace.id] ?? record.skill, moduleEvaluations: modules, evaluationScenarios: record.evaluationScenariosByTrace?.[activeTrace.id] ?? [], processEvals: record.processEvalsByTrace?.[activeTrace.id] ?? [], outcomeEvals: record.outcomeEvalsByTrace?.[activeTrace.id] ?? [], processSummary: summary(false), outcomeSummary: summary(true), tastePreference: undefined, failureObservation: activeTrace.observations.find(item => item.status === 'FAIL'), logs: record.logs.filter(item => item.traceId === activeTrace.id) };
    }
    return <>
    <Drawer open onClose={onClose} width="max-w-5xl" title={<span className="inline-flex items-center gap-1"><span>Case 详情 ·</span><EntityId id={record.id} kind="case" onOpen={onNavigate ? () => onNavigate({ kind: 'case', id: record.id, label: record.id }) : undefined}/></span>} description={<span className="inline-flex flex-wrap items-center gap-1"><StatusBadge status={record.sourceLabel ?? '来源待确认'} tone="info" showIcon={false}/><span>·</span><EntityId id={record.task.id} kind="case" onOpen={onNavigate ? () => onNavigate({ kind: 'case', id: record.task.id, label: record.task.id }) : undefined}/><span>·</span>{record.trace ? <EntityId id={record.trace.id} kind="trace" onOpen={onNavigate ? () => onNavigate({ kind: 'trace', id: record.trace!.id, label: record.trace!.id }) : undefined}/> : <span>Trace 未记录</span>}<span>·</span><EntityId id={record.session.id} kind="session" onOpen={onNavigate ? () => onNavigate({ kind: 'session', id: record.session.id, label: record.session.id }) : undefined}/></span>} footer={<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><StatusBadge status={record.task.status}/><StatusBadge status={record.manualStatus} tone="warn" showIcon={false}/></div><div className="flex gap-2"><Button icon={ClipboardCheck} onClick={() => setConfirmOpen(true)}>人工确认</Button><Button variant="primary" icon={Tags} onClick={() => setAttributionOpen(true)}>调整归因</Button></div></div>}>
      <div className="space-y-4">
        <section className="rounded-lg border border-line p-3"><p className="text-xs font-semibold leading-5">{record.task.query}</p><p className="mt-2 text-[11px] text-muted">来源：{record.sourceLabel ?? "mock集"} · 发现方式：{record.discoveryMethod ?? "自动评测"}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => { setTab("session"); onViewChange?.("session"); }}>查看 Session 对话</Button><Button size="sm" onClick={() => { setTab("trace"); onViewChange?.("trace"); }}>查看 Trace 执行</Button>{record.sourceRefId && <IdLink id={record.sourceRefId} kind={record.sourceRefKind ?? "dataset"} label={"查看来源 " + record.sourceRefId + (record.sourceRefVersion ? " @ " + record.sourceRefVersion : "")} onOpen={onNavigate ? ref => onNavigate({ ...ref, label: ref.id }) : undefined}/>}</div></section>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><SummaryTile label="业务场景" value={record.task.businessType}/><SummaryTile label="过程评测（0–2）" value={formatNormalizedScoreOutOfTwo(record.processFinalScore)}/><SummaryTile label="结果评测（0–2）" value={formatNormalizedScoreOutOfTwo(record.outcomeFinalScore)}/><SummaryTile label="首错模块" value={record.failureObservation?.nodeType ?? '未发现'} tone={record.failureObservation ? 'fail' : undefined}/><SummaryTile label="耗时" value={formatDuration(record.task.latency)}/></div>
        {(record.traces?.length ?? 0) > 1 && <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-slate-50 p-2"><span className="text-[10px] font-semibold text-muted">Trace</span>{record.traces!.map((trace) => <span key={trace.id} aria-current={trace.id === displayTraceId ? 'true' : undefined} className={cn('rounded border px-1', trace.id === displayTraceId ? 'border-accent bg-accent/10' : 'border-line bg-white')}><IdLink id={trace.id} kind="trace" label={`切换 Trace ${trace.id}`} onOpen={() => { setSelectedTraceId(trace.id); setTab('trace'); setObservation(trace.observations.find((item) => (item.judgeStatus ?? item.status) === 'FAIL') ?? trace.observations[0]); onNavigate?.({ kind: 'trace', id: trace.id, label: trace.id }); }}/></span>)}</div>}
        <Tabs aria-label="Case detail views" activeId={tab} onChange={(view) => { setTab(view); onViewChange?.(view); }} items={[{ id: 'task', label: '任务与关联' }, { id: 'session', label: 'Session 对话' }, { id: 'trace', label: 'Trace 与 Evidence' }, { id: 'eval', label: '评测中心' }, { id: 'governance', label: '治理链路' }]}/>
        <div role="tabpanel" id={'tabpanel-' + tab}>
          {tab === 'task' && <div className="space-y-3">
            <section className="rounded-lg border border-line p-4"><SectionHeader level={3} eyebrow="用户任务" title={record.task.query} description={'创建于 ' + DATE_FORMAT.format(new Date(record.task.timestamp))}/><div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-5"><SummaryTile label="Case 来源" value={record.sourceLabel ?? '来源待确认'}/><SummaryTile label="Session ID" value={<IdButton reference={{ kind: 'session', id: record.session.id, label: record.session.id }} onNavigate={onNavigate}/>}/><SummaryTile label="Trace ID" value={record.trace ? <IdButton reference={{ kind: 'trace', id: record.trace.id, label: record.trace.id }} onNavigate={onNavigate}/> : '未记录'}/><SummaryTile label="Skill" value={<IdButton reference={{ kind: 'skill', id: record.skill.id, label: `${record.skill.id} @ ${record.skill.version}` }} onNavigate={onNavigate}/>}/><SummaryTile label="用户反馈" value={record.userFeedback}/></div></section>
            <section className="rounded-lg border border-line p-4"><SectionHeader level={3} eyebrow="产物" title={record.artifacts[0]?.name ?? '产物未记录'} description="产物、结果评测与执行过程保留双向关联。" actions={<Button icon={FileText} onClick={() => setTab('eval')}>查看产物评测</Button>}/><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={record.artifacts[0]?.status ?? '缺失'} tone={record.artifacts[0] ? 'info' : 'warn'}/>{record.artifacts[0] && <IdButton reference={{ kind: 'artifact', id: record.artifacts[0].id, label: record.artifacts[0].id }} onNavigate={onNavigate}/>}{record.artifacts[0]?.sourceObservationIds.map((id) => <IdButton key={id} reference={{ kind: 'observation', id, label: id }} onNavigate={onNavigate}/>)}</div></section>
            <section className="rounded-lg border border-line p-4"><SectionHeader level={3} eyebrow="Skill / Tool" title={record.skill.name + ' @ ' + record.skill.version} description="实际使用的 Skill、Tool 与运行 Log 均关联到 Trace Observation。"/><div className="mt-3 grid gap-2 md:grid-cols-2"><SummaryTile label="Skill ID" value={<IdButton reference={{ kind: 'skill', id: record.skill.id, label: record.skill.id }} onNavigate={onNavigate}/>}/><SummaryTile label="Tool" value={(record.trace?.observations.filter((item) => item.tool).map((item) => item.tool).filter((item, index, values) => values.indexOf(item) === index).join('、')) || '本次未调用 Tool'}/></div><div className="mt-3 overflow-hidden rounded-md border border-line"><div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-[11px] font-semibold text-ink"><span className="inline-flex items-center gap-1"><Wrench className="h-3.5 w-3.5"/>运行 Log</span><span className="text-muted">{record.logs.length} 条</span></div>{record.logs.length ? <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto">{record.logs.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"><IdLink id={item.id} kind="log" label={`打开 Log ${item.id}`} onOpen={onNavigate ? () => onNavigate({ kind: 'log', id: item.id, label: item.id }) : undefined}/><span className={item.level === 'ERROR' ? 'text-fail' : item.level === 'WARN' ? 'text-warn' : 'text-muted'}>{item.level}</span><Button size="sm" onClick={() => setLog(item)}>当前查看</Button></div>)}</div> : <p className="p-3 text-[11px] text-muted">Log 未记录</p>}</div></section>
            <section className="rounded-lg border border-line p-4"><SectionHeader level={3} eyebrow="归因" title={record.attributionModule + ' · ' + record.attributionDimension} description="分流标签是多选关系，不互斥。"/><div className="mt-3 flex flex-wrap gap-2">{record.routingTags.map((tag) => <StatusBadge key={tag} status={tag} tone="info" showIcon={false}/>)}{record.multiScene && <StatusBadge status="多场景命中" tone="warn" showIcon={false}/>}</div></section>
            {localRevisions.length > 0 && <section className="rounded-lg border border-line p-4"><SectionHeader level={3} eyebrow="人工修订历史" title="审计记录" description="自动结论不被覆盖；每次人工确认和归因调整追加新记录。"/><div className="mt-3 space-y-2">{localRevisions.map((item) => <div key={item.id} className="rounded border border-line bg-slate-50 p-2.5 text-[11px]"><div className="flex justify-between gap-2"><strong>{item.value}</strong><span className="text-muted">{item.by} · {DATE_FORMAT.format(new Date(item.at))}</span></div><p className="mt-1 text-muted">{item.note}</p></div>)}</div></section>}
          </div>}
          {tab === 'session' && <SessionPanel record={record} onNavigate={onNavigate}/>}
          {tab === 'trace' && <div className="space-y-3"><div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]"><TraceTimeline trace={record.trace} evidence={data.evidence} selectedObservationId={observation?.id} onObservationClick={setObservation} onEvidenceClick={(_, source) => setObservation(source)} onNavigateReference={onNavigate ? (target) => onNavigate({ ...target, label: target.id }) : undefined}/><aside className="space-y-3 rounded-lg border border-line bg-slate-50 p-3"><SectionHeader level={3} title="失败 Evidence / Log" description={observation ? <EntityId id={observation.id} kind="observation" onOpen={onNavigate ? () => onNavigate({ kind: 'observation', id: observation.id, label: observation.id }) : undefined}/> : '请选择节点'}/>{observation ? <><div className="rounded-md border border-line bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={observation.judgeStatus ?? observation.status} tone={judgeTone(observation.judgeStatus ?? observation.status)}/><IdButton reference={{ kind: 'observation', id: observation.id, label: observation.id }} onNavigate={onNavigate}/></div><p className="mt-2 text-xs leading-5 text-ink">{observation.reason ?? '原因未记录'}</p>{observation.rubricEvidence?.map((item) => <div key={item.id} className="mt-2 rounded border border-accent/20 bg-accent/5 p-2"><p className="text-[11px] font-medium text-accent">{item.summary}</p><p className="mt-1 text-[10px] text-muted">{item.requirement ?? 'Rubric 要求未记录'}</p></div>)}</div><Button variant="primary" icon={Braces} onClick={() => setLog(record.logs.find((item) => item.observationId === observation.id))} disabled={!record.logs.some((item) => item.observationId === observation.id)}>查看失败节点 Log</Button></> : <EmptyState title="请选择 Trace 节点" description="选择后显示 Evidence、Rubric 和关联 Log。"/>}</aside></div>{localRevisions.length > 0 && <section className="rounded-lg border border-line bg-slate-50 p-3"><SectionHeader level={3} title="人工修订历史" description="自动结论不被覆盖；每次人工确认和归因调整追加新记录。"/><div className="mt-2 space-y-2">{localRevisions.map((item) => <div key={item.id} className="rounded border border-line bg-white p-2.5 text-[11px]"><strong>{item.value}</strong><p className="mt-1 text-muted">{item.note}</p></div>)}</div></section>}</div>}
          {tab === 'eval' && <CaseEvaluations record={record} data={data} onBackToTrace={openTrace} onNavigate={onNavigate}/>}
          {tab === 'trace' && <div className="mt-4 space-y-4"><CaseEvaluations key={displayTraceId} record={record} data={data} onBackToTrace={openTrace} onNavigate={onNavigate}/><details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-xs font-semibold">查看治理链路与处理进度</summary><div className="mt-3"><LinksPanel record={record} onNavigate={onNavigate}/></div></details></div>}
          {tab === 'governance' && <LinksPanel record={record} onNavigate={onNavigate}/>}
        </div>
      </div>
    </Drawer>
    <Drawer open={Boolean(log)} onClose={() => setLog(undefined)} title="Log 详情" description={log ? <EntityId id={log.id} kind="log" onOpen={onNavigate ? () => onNavigate({ kind: 'log', id: log.id, label: log.id }) : undefined}/> : undefined}><div className="space-y-3">{log && <><div className="flex items-center justify-between"><StatusBadge status={log.level} tone={log.level === 'ERROR' ? 'fail' : log.level === 'WARN' ? 'warn' : 'info'}/><IdButton reference={{ kind: 'trace', id: log.traceId, label: log.traceId }} onNavigate={onNavigate}/></div><pre className="whitespace-pre-wrap rounded-md border border-line bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{log.message}</pre><dl className="rounded-md border border-line bg-slate-50 p-3 text-[11px]">{Object.entries(log.metadata).map(([key, value]) => <div key={key} className="grid grid-cols-[120px_1fr] gap-2 py-1"><dt className="font-mono text-muted">{key}</dt><dd className="break-all text-ink">{value}</dd></div>)}</dl></>}</div></Drawer>
    <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="人工确认" description="保存为新修订记录，自动评测历史保持不变。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setConfirmOpen(false)}>取消</Button><Button variant="primary" onClick={submitConfirmation}>保存人工结论</Button></div>}><div className="space-y-3"><Field label="人工结论"><SelectInput value={confirmStatus} onChange={(event) => setConfirmStatus(event.target.value as JudgeStatus)}>{['PASS', 'FAIL', 'UNKNOWN'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="确认说明"><TextArea aria-label="确认说明" value={confirmNote} onChange={(event) => setConfirmNote(event.target.value)} placeholder="记录证据、判断依据和后续动作"/></Field></div></Modal>
    <Modal open={attributionOpen} onClose={() => setAttributionOpen(false)} title="调整归因" description="模块、维度与多路分发会形成新的人工修订记录。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setAttributionOpen(false)}>取消</Button><Button variant="primary" onClick={submitAttribution}>保存归因调整</Button></div>}><div className="space-y-3">{attributionOptions.length > 0 && <Field label="目标归因"><SelectInput aria-label="目标归因" value={attributionId} onChange={(event) => { const next = attributionOptions.find((item) => item.id === event.target.value); setAttributionId(event.target.value); if (next?.module)
        setModule(next.module); if (next?.dimension)
        setDimension(next.dimension); if (next?.routingTags)
        setRoutingTags(next.routingTags); }}>{attributionOptions.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.module} · {item.dimension}</option>)}</SelectInput></Field>}<Field label="归因模块"><SelectInput aria-label="归因模块" value={module} onChange={(event) => { const value = event.target.value; const key = (value === '上文模块' || value === '未归因' ? 'Context' : value) as EvolutionModule; setModule(value); setDimension(ATTRIBUTION_DIMENSIONS[key][0]); }}>{['Memory', 'Skill', 'Reason', 'Act', '上文模块', '未归因'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="归因维度"><SelectInput aria-label="归因维度" value={dimension} onChange={(event) => setDimension(event.target.value)}>{ATTRIBUTION_DIMENSIONS[taxonomyModule].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><fieldset><legend className="text-xs font-medium text-ink">分流标签（可多选）</legend><div className="mt-2 flex gap-3">{['策略迭代', 'Agent 迭代'].map((tag) => <label key={tag} className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={routingTags.includes(tag)} onChange={() => setRoutingTags((items) => items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag])}/>{tag}</label>)}</div></fieldset><Field label="调整说明"><TextArea value={attributionNote} onChange={(event) => setAttributionNote(event.target.value)}/></Field></div></Modal>
  </>;
}
export function CaseAnalysisWorkbench({ data, detailData, initialCaseId, initialFilters, initialTraceId, initialObservationId, initialLogId, initialEvidenceId, initialView, initialPage, onCloseCase, onViewChange, onPageChange, onFiltersChange, onNavigateReference, onHumanConfirm, onAttributionChange, onBulkTraceImport }: CaseAnalysisWorkbenchProps) {
    const [filters, setFilters] = useState<CaseAnalysisFilters>({ ...emptyCaseAnalysisFilters, ...initialFilters });
    const [selectedId, setSelectedId] = useState(initialCaseId);
    const [page, setPage] = useState(initialPage ?? 0);
    const [selectedTraceIds, setSelectedTraceIds] = useState<string[]>([]);
    const changePage = (value: number) => { setPage(value); onPageChange?.(value); };
    const openCase = (id: string) => { setSelectedId(id); onNavigateReference?.({ kind: "case", id, label: id }); };
    const initialFiltersKey = JSON.stringify(initialFilters ?? {});
    const previousInitialFiltersKey = useRef(initialFiltersKey);
    useEffect(() => { setSelectedId(initialCaseId); }, [initialCaseId]);
    useEffect(() => {
        if (previousInitialFiltersKey.current === initialFiltersKey)
            return;
        previousInitialFiltersKey.current = initialFiltersKey;
        setFilters((current) => ({ ...current, ...initialFilters }));
    }, [initialFilters, initialFiltersKey]);
    const tags = useMemo(() => [...new Set(data.cases.flatMap((record) => record.routingTags))], [data.cases]);
    const records = useMemo(() => filterCaseAnalysisRecords(data.cases, filters, data.referenceTime), [data, filters]);
    useEffect(() => { if (initialCaseId) {
        const index = records.findIndex((record) => record.id === initialCaseId);
        if (index >= 0)
            setPage(Math.floor(index / 3));
    } }, [initialCaseId, records]);
    const updateFilters = (patch: Partial<CaseAnalysisFilters>) => {
        const next = { ...filters, ...patch };
        setFilters(next);
        onFiltersChange?.(next);
    };
    const reset = () => {
      const next = { ...emptyCaseAnalysisFilters };
      setFilters(next);
      setSelectedTraceIds([]);
        onFiltersChange?.(next);
    };
    const displayRecords = useMemo(() => {
        const hasLocalQuery = Boolean(filters.query?.trim() || filters.sessionId?.trim() || filters.traceId?.trim() || filters.skillId?.trim() || filters.skillVersion?.trim() || filters.logId?.trim() || filters.routingTags?.length || filters.multiScene !== 'all' || filters.processEval || filters.outcomeEval);
        if (hasLocalQuery || records.length <= 3)
            return records;
        return records.slice(page * 3, page * 3 + 3);
    }, [filters, records, page]);
    const columns: Column<CaseAnalysisRecord>[] = [
        { key: 'select', header: '', accessor: record => <input aria-label={`选择 Trace ${record.trace?.id ?? record.task.traceId}`} type="checkbox" checked={record.trace ? selectedTraceIds.includes(record.trace.id) : false} onChange={event => { event.stopPropagation(); if (!record.trace) return; setSelectedTraceIds(current => event.target.checked ? [...new Set([...current, record.trace!.id])] : current.filter(id => id !== record.trace!.id)) }} onClick={event => event.stopPropagation()} /> },
        { key: 'case', header: 'Case / Query', accessor: record => <div className="min-w-[220px]">
          <p className="line-clamp-2 text-xs font-medium leading-5 text-ink">{record.task.query}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant="primary" aria-label={"查看完整 Case " + record.id} onClick={event => { event.stopPropagation(); openCase(record.id); }}>查看完整 Case</Button><span className="font-mono text-[10px] text-muted">{record.id}</span><StatusBadge status={record.sourceLabel ?? "mock集"} tone="info" showIcon={false}/></div>
        </div> },
        { key: 'scene', header: '场景 / Skill', accessor: (record) => <div><p>{record.task.businessType}</p><IdButton reference={{ kind: 'skill', id: record.skill.id, label: `${record.skill.id} @ ${record.skill.version}` }} onNavigate={onNavigateReference}/><p className="mt-1 text-[10px] text-muted">来源：{record.sourceLabel ?? '来源待确认'}</p></div> },
        { key: 'eval', header: '过程 / 产物评分（0–2）', accessor: (record) => <div className="space-y-1"><p className="font-mono text-xs text-ink">过程 {formatNormalizedScoreOutOfTwo(record.processFinalScore)} · 产物 {formatNormalizedScoreOutOfTwo(record.outcomeFinalScore)}</p><p className="text-[10px] text-muted">评分口径统一为 0–2；缺失显示待评测</p></div> },
        { key: 'attribution', header: '归因 / 分流', accessor: (record) => <div><p className="font-medium">{governanceLabel(record.attributionModule)} · {record.attributionDimension}</p><div className="mt-1 flex flex-wrap gap-1">{record.routingTags.map((tag) => <span key={tag} className="rounded bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent">{tag}</span>)}</div></div> },
        { key: 'status', header: '状态', accessor: (record) => <div className="space-y-1"><StatusBadge status={record.task.status}/><p className="text-[10px] text-muted">{record.manualStatus}</p></div> },
        { key: 'cost', header: '成本', accessor: (record) => <div className="text-[10px] text-muted"><p>{record.tokens ?? 0} tokens</p><p>{record.latencyMs ?? record.task.latency} ms</p></div> },
        { key: 'delivery', header: '交付物', accessor: (record) => record.deliveryUri ? <a href={record.deliveryUri} download className="text-xs text-accent hover:underline" onClick={event => event.stopPropagation()}>下载产物</a> : <span className="text-[10px] text-muted">不可用</span> },
        { key: 'time', header: '时间', accessor: (record) => <span className="whitespace-nowrap text-[11px] text-muted">{DATE_FORMAT.format(new Date(record.task.timestamp))}</span> }
    ];
    return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status="本地 Mock 数据" tone="warn" showIcon={false}/><InlineNotice tone="info"><strong>{data.cases.length}</strong> 个演示 Case · 数据不代表真实线上指标</InlineNotice></div>
    <UnifiedFilters filters={filters} tags={tags} resultCount={records.length} onChange={updateFilters} onReset={reset}/>
    {selectedTraceIds.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/20 bg-accent/5 p-3"><span className="text-xs text-accent">已选择 {selectedTraceIds.length} 条 Trace</span><Button size="sm" onClick={() => onBulkTraceImport?.(selectedTraceIds, 'evaluation')}>批量导入评测集</Button><Button size="sm" variant="primary" onClick={() => onBulkTraceImport?.(selectedTraceIds, 'golden')}>加入黄金集</Button><Button size="sm" variant="ghost" onClick={() => setSelectedTraceIds([])}>取消选择</Button></div>}
    <DataTable aria-label="Case / Trace 列表" caption="Case / Trace 列表" columns={columns} rows={displayRecords} rowKey={(record) => record.id} onRowClick={(record) => openCase(record.id)} selectedRowId={selectedId} empty={<EmptyState title="暂无匹配 Case" description="当前筛选没有命中；缺失数据不会被默认视为 PASS。" icon={AlertTriangle}/>}/>
    {records.length > 3 && !filters.query?.trim() && <div className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-2 text-xs"><span className="text-muted">第 {page + 1} / {Math.max(1, Math.ceil(records.length / 3))} 页 · 共 {records.length} 个匹配 Case</span><div className="flex gap-2"><Button size="sm" disabled={page <= 0} onClick={() => changePage(Math.max(0, page - 1))}>上一页 Case</Button><Button size="sm" disabled={page >= Math.ceil(records.length / 3) - 1} onClick={() => changePage(Math.min(Math.ceil(records.length / 3) - 1, page + 1))}>下一页 Case</Button></div></div>}
    <CaseDetail key={`${selectedId}:${initialTraceId ?? ''}:${initialObservationId ?? ''}:${initialLogId ?? ''}:${initialEvidenceId ?? ''}`} record={(detailData ?? data).cases.find((record) => record.id === selectedId)} data={detailData ?? data} initialTraceId={initialTraceId} initialObservationId={initialObservationId} initialLogId={initialLogId} initialEvidenceId={initialEvidenceId} initialView={initialView} onViewChange={onViewChange} onClose={() => { setSelectedId(undefined); onCloseCase?.(); }} onNavigate={onNavigateReference} onHumanConfirm={onHumanConfirm} onAttributionChange={onAttributionChange}/>
  </div>;
}
