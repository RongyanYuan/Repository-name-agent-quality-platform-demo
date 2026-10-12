import { CheckCircle2, GitBranch, Plus, Send, Split, Users, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, DataTable, Field, FilterBar, Modal, ProgressBar, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useContextNavigation, DETAIL_KEYS } from '../../layout';
import { VariantCreateDialog } from '../components/VariantCreateDialog';
import { ATTRIBUTION_DIMENSIONS, type Attribution, type AttributionRevision, type EvolutionModule, type Issue, type Variant } from '../domain';
import { selectTasteLibraryTrigger } from '../data/selectors';
import { EntityId, IdLink, KeyValueGrid, MetricTile, PageHeading, TagList, type ReferenceKind, type ReferenceTarget } from '../components/ViewPrimitives';
import { useScopedEvolution } from '../scope';
import { entities, record, Section, strings, text, type AnyEntity, type AnyState, useReferenceNavigation } from './shared';
type Tab = 'issues' | 'clusters' | 'deliveries' | 'badcases';
const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const destinationLabels: Record<string, string> = {
    ALGORITHM_BADCASE: '算法 Badcase',
    AGENT_ITERATION: 'Agent 迭代',
    TASTE_LIBRARY: '品味库队列',
    PERSONAL_SKILL_PLANNING: 'Personal Skill 规划',
    DIRECT_FIX: '直接修复验证',
    ISSUE_CLUSTER: '问题簇'
};
const dynamicDispatch = (dispatch: unknown, type: string, payload: Record<string, unknown>) => {
    const sendAction = dispatch as (action: Record<string, unknown>) => void;
    sendAction({ type, ...payload, meta: { actor: '当前用户', reason: '治理工作台人工操作', at: new Date().toISOString() } });
};
function IssueEvidenceFields({ description, onDescriptionChange, evidenceIds, onToggleEvidence, evidence }: {
    description: string;
    onDescriptionChange: (value: string) => void;
    evidenceIds: string[];
    onToggleEvidence: (id: string) => void;
    evidence: Array<{
        id: string;
    }>;
}) {
    return <><Field label="问题描述"><TextArea aria-label="问题描述" value={description} onChange={(event) => onDescriptionChange(event.target.value)}/></Field><fieldset><legend className="text-xs font-medium">关联 Evidence</legend>{evidence.map((item) => <label key={item.id} className="mr-3 text-xs"><input aria-label={item.id} type="checkbox" checked={evidenceIds.includes(item.id)} onChange={() => onToggleEvidence(item.id)}/> {item.id}</label>)}</fieldset></>;
}
export function AttributionClustersPage({ onNavigateReference, initialIssueId, initialClusterId }: {
    onNavigateReference?: (target: ReferenceTarget) => void;
    initialIssueId?: string;
    initialClusterId?: string;
}) {
    const { state: fullState, scopedState: state, dispatch } = useScopedEvolution();
    const location = useLocation();
    const { navigateContext } = useContextNavigation();
    const [searchParams] = useSearchParams();
    const data = state as unknown as AnyState;
    const issues = entities(data, 'issues');
    const clusters = entities(data, 'issueClusters');
    const deliveries = entities(data, 'routingDeliveries');
    const badcaseItems = entities(data, 'algorithmBadcases');
    const badcaseQueues = entities(data, 'badcaseQueues');
    const findings = entities(data, 'evaluationFindings');
    const linkedDeliveryId = searchParams.get('deliveryId') ?? searchParams.get('routingDeliveryId');
    const linkedBadcaseId = searchParams.get('badcaseId');
    const linkedFindingId = searchParams.get('findingId');
    const linkedDecisionId = searchParams.get('routingDecisionId');
    const initial = issues.find((item) => item.id === initialIssueId || item.attributionId === initialIssueId) ?? clusters.find((item) => item.id === initialClusterId) ?? deliveries.find((item) => item.id === linkedDeliveryId || item.findingId === linkedFindingId || item.decisionId === linkedDecisionId) ?? badcaseItems.find((item) => item.id === linkedBadcaseId);
    const queryTab: Tab = initialIssueId ? 'issues' : initialClusterId ? 'clusters' : linkedBadcaseId || searchParams.get('badcaseStatus') ? 'badcases' : linkedDeliveryId || searchParams.get('routingStatus') || searchParams.get('findingId') || searchParams.get('routingDecisionId') ? 'deliveries' : 'issues';
    const [tab, setTab] = useState<Tab>(queryTab);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<AnyEntity | undefined>(initial);
    const [issueModal, setIssueModal] = useState(false);
    const [variantModal, setVariantModal] = useState(false);
    const [clusterModal, setClusterModal] = useState(false);
    const [issueTitle, setIssueTitle] = useState('');
    const [issueDescription, setIssueDescription] = useState('');
    const [issueCaseId, setIssueCaseId] = useState(state.cases[0]?.id ?? '');
    const [issueModule, setIssueModule] = useState<EvolutionModule>('Reason');
    const [issueDimension, setIssueDimension] = useState(ATTRIBUTION_DIMENSIONS.Reason[0]);
    const [issueAttributionId, setIssueAttributionId] = useState(state.attributions[0]?.id ?? '');
    const [issueRoutes, setIssueRoutes] = useState<string[]>([]);
    const [issueEvidenceIds, setIssueEvidenceIds] = useState<string[]>([]);
    const [issueMode, setIssueMode] = useState<Issue['optimizationMode']>('CLUSTER_OPTIMIZATION');
    const [issueOwner, setIssueOwner] = useState('');
    const [issueResponsibility, setIssueResponsibility] = useState<Issue['responsibilityStatus']>('UNASSIGNED');
    const [issueStatus, setIssueStatus] = useState<Issue['status']>('CONFIRMED');
    const [editIssueOpen, setEditIssueOpen] = useState(false);
    const [editIssueDescription, setEditIssueDescription] = useState('');
    const [editIssueOwner, setEditIssueOwner] = useState('');
    const [editIssueResponsibility, setEditIssueResponsibility] = useState<Issue['responsibilityStatus']>('UNASSIGNED');
    const [editIssueStatus, setEditIssueStatus] = useState<Issue['status']>('PENDING');
    const [editIssueRoutes, setEditIssueRoutes] = useState<string[]>([]);
    const [editIssueEvidenceIds, setEditIssueEvidenceIds] = useState<string[]>([]);
    const [editIssueChainNotes, setEditIssueChainNotes] = useState<Record<string, string>>({});
    const [attributionEditOpen, setAttributionEditOpen] = useState(false);
    const [attributionDimensionEdit, setAttributionDimensionEdit] = useState('');
    const [targetClusterId, setTargetClusterId] = useState(clusters[0]?.id ?? '');
    const [deliveryOwner, setDeliveryOwner] = useState('');
    const [deliveryNote, setDeliveryNote] = useState('');
    const navigation = useReferenceNavigation(onNavigateReference);
    const rows = tab === 'issues' ? issues : tab === 'clusters' ? clusters : tab === 'deliveries' ? deliveries : badcaseItems;
    const selectedKind: ReferenceKind = tab === 'issues' ? 'issue' : tab === 'clusters' ? 'cluster' : tab === 'deliveries' ? 'routing-delivery' : 'badcase';
    const selectedIdentity = selected ? <EntityId id={selected.id} kind={selectedKind} onOpen={navigation.open}/> : null;
    const triggerFor = (clusterId: string) => selectTasteLibraryTrigger(state, clusterId);
    const selectedAttribution = selected && tab === 'issues' ? state.attributions.find((item) => item.id === selected.attributionId) : undefined;
    const selectedTrigger = selected && tab === 'clusters' ? triggerFor(selected.id) : undefined;
    const selectedIsTasteCluster = selectedTrigger?.isTasteRule === true;
    const selectedIsTastePending = selectedTrigger?.isTasteRule === true && selectedTrigger.eligible !== true;
    const openVariantModal = () => {
        if (!selected || selectedIsTastePending) return;
        if (onNavigateReference) navigateContext('/variants', { clear: DETAIL_KEYS, params: { [tab === 'clusters' ? 'sourceClusterId' : 'sourceIssueId']: selected.id, returnTo: location.pathname + location.search } });
        else setVariantModal(true);
    };
    const routingStatusFilter = searchParams.get('routingStatus');
    const badcaseStatusFilter = searchParams.get('badcaseStatus');
    const filtered = useMemo(() => rows.filter((item) => {
        if (tab === 'deliveries' && routingStatusFilter && text(item.status) !== routingStatusFilter)
            return false;
        if (tab === 'badcases' && badcaseStatusFilter && text(item.status) !== badcaseStatusFilter)
            return false;
        return !query.trim() || [item.id, item.title, item.name, item.module, item.dimension, item.status, item.destination, item.label, item.traceId, item.caseId, item.queueId].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    }), [badcaseStatusFilter, query, rows, routingStatusFilter, tab]);
    const multiAttributionCaseIds = [...new Set(issues.map((item) => text(item.caseId)).filter((caseId) => issues.filter((other) => text(other.caseId) === caseId).length > 1))];
    const multiRouteCount = issues.filter((item) => strings(item.routingLabels).length > 1).length;
    const tasteQueue = badcaseQueues.find((item) => text(item.kind) === 'TASTE');
    const tasteCount = Array.isArray(tasteQueue?.itemIds) ? tasteQueue.itemIds.length : clusters.reduce((sum, cluster) => sum + (cluster.triggerRuleId === 'rule-taste-100' ? Number(cluster.currentCount ?? 0) : 0), 0);
    const issueColumns: Column<AnyEntity>[] = [
        { key: 'id', header: '问题 ID', accessor: (row) => <div><IdLink id={row.id} kind="issue" onOpen={navigation.open}/><p className="mt-1 text-[11px] text-ink">{text(row.title)}</p></div> },
        { key: 'caseId', header: '来源 Case', accessor: (row) => <IdLink id={text(row.caseId)} kind="case" onOpen={navigation.open}/> },
        { key: 'module', header: '模块 / 维度', accessor: (row) => <div><span className="font-semibold">{text(row.module)}</span><p className="mt-1 text-[11px] text-muted">{text(row.dimension, '需求待补充')}</p></div> },
        { key: 'optimizationMode', header: '优化方式', accessor: (row) => <StatusBadge status={text(row.optimizationMode)} label={text(row.optimizationMode) === 'DIRECT_FIX' ? '直接优化' : '聚类优化'} tone={text(row.optimizationMode) === 'DIRECT_FIX' ? 'info' : 'warn'}/> },
        { key: 'routingLabels', header: '多路分发', accessor: (row) => <TagList values={strings(row.routingLabels)}/> },
        { key: 'status', header: '责任状态', accessor: (row) => <div><StatusBadge status={text(row.status)}/><p className="mt-1 text-[10px] text-muted">{text(row.owner, text(row.responsibilityStatus))}</p></div> }
    ];
    const clusterColumns: Column<AnyEntity>[] = [
        { key: 'id', header: '问题簇 ID', accessor: (row) => <IdLink id={row.id} kind="cluster" onOpen={navigation.open}/> },
        { key: 'name', header: '问题簇', accessor: (row) => <div><span className="font-semibold">{text(row.name)}</span><p className="mt-1 max-w-xs text-[11px] text-muted">{text(row.description)}</p></div> },
        { key: 'module', header: '模块 / 维度', accessor: (row) => `${text(row.module)} · ${text(row.dimension)}` },
        { key: 'caseIds', header: 'Case / 问题', accessor: (row) => `${strings(row.caseIds).length} Case · ${strings(row.issueIds).length} 问题` },
        { key: 'progress', header: '触发进度', accessor: (row) => { const trigger = triggerFor(row.id); return <div className="min-w-[160px]"><ProgressBar value={trigger.totalCount === null ? 0 : Math.min(100, trigger.totalCount)} label={trigger.totalCount === null ? '待配置' : `${trigger.totalCount} / 100`}/></div>; } },
        { key: 'status', header: '状态', accessor: (row) => <StatusBadge status={text(row.status)}/> }
    ];
    const deliveryColumns: Column<AnyEntity>[] = [
        { key: 'id', header: 'Delivery ID', accessor: (row) => <IdLink id={row.id} kind="routing-delivery" onOpen={navigation.open}/> },
        { key: 'source', header: '来源 Trace / Case', accessor: (row) => <div><IdLink id={text(row.traceId)} kind="trace" onOpen={navigation.open}/><p className="mt-1"><IdLink id={text(row.caseId)} kind="case" onOpen={navigation.open}/></p></div> },
        { key: 'route', header: '分流去向', accessor: (row) => <div><StatusBadge status={text(row.label)} label={text(row.label)} tone="info" showIcon={false}/><p className="mt-1 text-[11px] text-muted">{destinationLabels[text(row.destination)] ?? text(row.destination)}</p></div> },
        { key: 'status', header: '状态', accessor: (row) => <StatusBadge status={text(row.status)} tone={text(row.status) === 'REJECTED' ? 'fail' : text(row.status) === 'ACKNOWLEDGED' || text(row.status) === 'RESOLVED' ? 'pass' : 'warn'}/> },
        { key: 'owner', header: 'Owner / 备注', accessor: (row) => <div><span className="text-xs">{text(row.owner, '未分配')}</span><p className="mt-1 line-clamp-2 text-[11px] text-muted">{text(row.note, '待算法或 Agent 团队确认')}</p></div> }
    ];
    const badcaseColumns: Column<AnyEntity>[] = [
        { key: 'id', header: 'Badcase ID', accessor: (row) => <IdLink id={row.id} kind="badcase" onOpen={navigation.open}/> },
        { key: 'title', header: '候选问题', accessor: (row) => <div><p className="font-medium text-ink">{text(row.title, '算法 Badcase Candidate')}</p><p className="mt-1 text-[11px] text-muted"><IdLink id={text(row.traceId)} kind="trace" onOpen={navigation.open}/></p></div> },
        { key: 'status', header: '确认状态', accessor: (row) => <StatusBadge status={text(row.status)} label={text(row.status) === 'CANDIDATE' ? '待确认' : text(row.status)} tone={text(row.status) === 'CONFIRMED' ? 'pass' : text(row.status) === 'REJECTED' ? 'fail' : 'warn'}/> },
        { key: 'queueId', header: 'Badcase Queue', accessor: (row) => <IdLink id={text(row.queueId)} kind="badcase-queue" onOpen={navigation.open}/> },
        { key: 'owner', header: 'Owner / 回归集', accessor: (row) => <div><span className="text-xs">{text(row.owner, '算法团队待认领')}</span><p className="mt-1 text-[11px] text-muted">{text(row.regressionDatasetId, '未关联回归集')}</p></div> }
    ];
    const createIssue = () => {
        const source = state.cases.find((item) => item.id === issueCaseId);
        const attribution = state.attributions.find((item) => item.id === issueAttributionId && item.caseId === issueCaseId) ?? state.attributions.find((item) => item.caseId === issueCaseId);
        if (!source || !attribution || !issueTitle.trim())
            return;
        const at = new Date().toISOString();
        const routingLabels = issueRoutes.filter((item): item is Issue['routingLabels'][number] => ['策略迭代', 'Agent 迭代', '个人能力转 Skill（二期）'].includes(item));
        const issue: Issue = { id: uniqueId('issue'), caseId: source.id, attributionId: attribution.id, title: issueTitle.trim(), description: issueDescription.trim() || '由人工治理工作台创建。', module: issueModule, dimension: issueDimension, evidenceIds: [...issueEvidenceIds], routingLabels, optimizationMode: issueMode, responsibilityStatus: issueResponsibility, owner: issueOwner || undefined, status: issueStatus, clusterIds: [], variantIds: [], processingChains: routingLabels.map((routingLabel, index) => ({ id: `chain-${Date.now()}-${index}`, routingLabel, destinationType: routingLabel === '个人能力转 Skill（二期）' ? 'PERSONAL_SKILL_PHASE_2' : issueMode === 'DIRECT_FIX' ? 'DIRECT_FIX' : 'ISSUE_CLUSTER', status: routingLabel === '个人能力转 Skill（二期）' ? 'PHASE_2' : 'PLANNED', note: '由创建问题表单生成的独立处理链。' })), createdAt: at, updatedAt: at };
        dispatch({ type: 'UPSERT_ISSUE', issue, meta: { actor: '当前用户', reason: '从 Case 创建独立问题', at } });
        setIssueModal(false);
        setIssueTitle('');
        setIssueDescription('');
        setIssueEvidenceIds([]);
        setIssueRoutes([]);
        setIssueOwner('');
        setIssueResponsibility('UNASSIGNED');
        setIssueStatus('CONFIRMED');
    };
    const addToCluster = () => {
        if (!selected || tab !== 'issues' || !targetClusterId)
            return;
        dispatch({ type: 'ADD_CASE_TO_CLUSTER', clusterId: targetClusterId, caseId: text(selected.caseId), issueId: selected.id, meta: { actor: '当前用户', reason: '人工加入问题簇' } });
        setClusterModal(false);
    };
    const saveAttributionRevision = () => {
        if (!selectedAttribution || !attributionDimensionEdit.trim())
            return;
        const at = new Date().toISOString();
        const revision: AttributionRevision = { id: `attr-revision-${Date.now()}`, source: 'HUMAN', module: selectedAttribution.module, dimension: attributionDimensionEdit.trim(), evidenceIds: [...selectedAttribution.evidenceIds], routingLabels: [...selectedAttribution.routingLabels], optimizationMode: selectedAttribution.optimizationMode, confirmed: true, status: 'CONFIRMED', confidence: selectedAttribution.confidence, reason: '人工编辑归因', revisedBy: '当前用户', revisedAt: at, supersedesRevisionId: selectedAttribution.revisions.at(-1)?.id };
        dispatch({ type: 'ADD_ATTRIBUTION_REVISION', attributionId: selectedAttribution.id, revision, meta: { actor: '当前用户', reason: revision.reason, at } });
        setAttributionEditOpen(false);
        setSelected({ ...selected!, dimension: revision.dimension });
    };
    const openIssueEditor = () => {
        if (!selected || tab !== 'issues')
            return;
        setEditIssueDescription(text(selected.description));
        setEditIssueOwner(text(selected.owner));
        setEditIssueResponsibility(text(selected.responsibilityStatus, 'UNASSIGNED') as Issue['responsibilityStatus']);
        setEditIssueStatus(text(selected.status, 'PENDING') as Issue['status']);
        setEditIssueRoutes(strings(selected.routingLabels));
        setEditIssueEvidenceIds(strings(selected.evidenceIds));
        const notes: Record<string, string> = {};
        if (Array.isArray(selected.processingChains))
            selected.processingChains.forEach((chain) => { const item = record(chain); notes[text(item.routingLabel)] = text(item.note); });
        setEditIssueChainNotes(notes);
        setEditIssueOpen(true);
    };
    const saveIssueEdit = () => {
        if (!selected || tab !== 'issues' || !editIssueDescription.trim() || !editIssueRoutes.length || !editIssueEvidenceIds.length)
            return;
        const at = new Date().toISOString();
        const routingLabels = editIssueRoutes.filter((item): item is Issue['routingLabels'][number] => ['策略迭代', 'Agent 迭代', '个人能力转 Skill（二期）'].includes(item));
        const previousChains = Array.isArray(selected.processingChains) ? selected.processingChains.map(record) : [];
        const issue: Issue = { ...(selected as unknown as Issue), description: editIssueDescription.trim(), owner: editIssueOwner.trim() || undefined, responsibilityStatus: editIssueResponsibility, status: editIssueStatus, evidenceIds: editIssueEvidenceIds, routingLabels, processingChains: routingLabels.map((routingLabel, index) => { const previous = previousChains.find((chain) => text(chain.routingLabel) === routingLabel); return { id: text(previous?.id, `chain-${Date.now()}-${index}`), routingLabel, destinationType: routingLabel === '个人能力转 Skill（二期）' ? 'PERSONAL_SKILL_PHASE_2' : text(previous?.destinationType, text(selected.optimizationMode) === 'DIRECT_FIX' ? 'DIRECT_FIX' : 'ISSUE_CLUSTER') as NonNullable<Issue['processingChains']>[number]['destinationType'], destinationId: text(previous?.destinationId) || undefined, status: routingLabel === '个人能力转 Skill（二期）' ? 'PHASE_2' : text(previous?.status, 'PLANNED') as 'PLANNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED', note: editIssueChainNotes[routingLabel]?.trim() || '独立处理链待推进。' }; }), updatedAt: at };
        dispatch({ type: 'UPSERT_ISSUE', issue, meta: { actor: '当前用户', reason: '编辑问题完整治理字段', at } });
        setSelected(issue as unknown as AnyEntity);
        setEditIssueOpen(false);
    };
    const openRoutingRecord = (row: AnyEntity) => {
        setSelected(row);
        setDeliveryOwner(text(row.owner, ''));
        setDeliveryNote(text(row.note, ''));
    };
    const saveDeliveryDetails = () => {
        if (!selected || tab !== 'deliveries')
            return;
        const patch = { owner: deliveryOwner.trim() || undefined, note: deliveryNote.trim() || undefined };
        dynamicDispatch(dispatch, 'UPDATE_ROUTING_DELIVERY', { deliveryId: selected.id, patch });
        setSelected({ ...selected, ...patch });
    };
    const updateDeliveryStatus = (status: string) => {
        if (!selected || tab !== 'deliveries')
            return;
        dynamicDispatch(dispatch, 'UPDATE_ROUTING_DELIVERY', { deliveryId: selected.id, patch: { status } });
        setSelected({ ...selected, status });
    };
    const createIssueFromDelivery = () => {
        if (!selected || tab !== 'deliveries')
            return;
        const deliveryId = text(selected.id);
        const delivery = state.routingDeliveries.find((item) => item.id === deliveryId);
        const finding = delivery ? state.evaluationFindings.find((item) => item.id === delivery.findingId) : undefined;
        const sourceCase = delivery ? state.cases.find((item) => item.id === delivery.caseId) : undefined;
        if (!delivery || !finding || !sourceCase)
            return;
        const existing = state.attributions.find((item) => item.traceId === delivery.traceId && item.module === (finding.moduleCode === 'MEMORY' ? 'Memory' : finding.moduleCode === 'SKILL' ? 'Skill' : finding.moduleCode === 'REASON' ? 'Reason' : finding.moduleCode === 'ACT' || finding.moduleCode === 'TOOL' ? 'Act' : 'Context'));
        const module = (finding.moduleCode === 'MEMORY' ? 'Memory' : finding.moduleCode === 'SKILL' ? 'Skill' : finding.moduleCode === 'REASON' ? 'Reason' : finding.moduleCode === 'ACT' || finding.moduleCode === 'TOOL' ? 'Act' : 'Context') as EvolutionModule;
        const at = new Date().toISOString();
        const attribution: Attribution = existing ?? { id: `attribution-${deliveryId}`, caseId: sourceCase.id, traceId: delivery.traceId, module, dimension: finding.dimensionLabel, evidenceIds: finding.evidenceBundle.rootEvidenceIds, confidence: finding.score ?? 0.7, source: 'AUTOMATIC', confirmed: false, routingLabels: [delivery.label === '策略迭代' ? '策略迭代' : 'Agent 迭代'], optimizationMode: finding.moduleCode === 'TOOL' || finding.moduleCode === 'ACT' ? 'DIRECT_FIX' : 'CLUSTER_OPTIMIZATION', status: 'PENDING', revisions: [], createdAt: at, updatedAt: at };
        if (!existing)
            dispatch({ type: 'UPSERT_ATTRIBUTION', attribution, meta: { actor: '当前用户', reason: '从 Routing Delivery 创建归因', at } });
        const issueId = `issue-from-${deliveryId}`;
        const issue: Issue = { id: issueId, caseId: sourceCase.id, attributionId: attribution.id, title: `${finding.moduleLabel} · ${finding.dimensionLabel}`, description: finding.description, module, dimension: finding.dimensionLabel, evidenceIds: finding.evidenceBundle.rootEvidenceIds, routingLabels: attribution.routingLabels, optimizationMode: attribution.optimizationMode, responsibilityStatus: 'UNASSIGNED', owner: delivery.owner, status: 'CONFIRMED', clusterIds: [], variantIds: [], processingChains: [{ id: `chain-${issueId}`, routingLabel: attribution.routingLabels[0], destinationType: attribution.optimizationMode === 'DIRECT_FIX' ? 'DIRECT_FIX' : 'ISSUE_CLUSTER', status: 'PLANNED', note: '由 Routing Delivery 转入治理问题。' }], createdAt: at, updatedAt: at };
        dispatch({ type: 'UPSERT_ISSUE', issue, meta: { actor: '当前用户', reason: '从 Routing Delivery 创建治理问题', at } });
        dynamicDispatch(dispatch, 'UPDATE_ROUTING_DELIVERY', { deliveryId, patch: { issueId } });
        setSelected({ ...selected, issueId });
    };
    const updateBadcaseStatus = (status: string) => {
        if (!selected || tab !== 'badcases')
            return;
        dynamicDispatch(dispatch, 'UPDATE_ALGORITHM_BADCASE', { badcaseId: selected.id, patch: { status, confirmedBy: status === 'CONFIRMED' ? '当前用户' : undefined, confirmedAt: status === 'CONFIRMED' ? new Date().toISOString() : undefined } });
        setSelected({ ...selected, status, confirmedBy: status === 'CONFIRMED' ? '当前用户' : undefined });
    };
    return <div>
    <PageHeading eyebrow="ATTRIBUTION & CLUSTERING" title="归因与问题簇" description="一个 Case 可以创建多个独立问题；策略迭代、Agent 迭代等分流标签为多选，一个问题可同时进入多条处理链。" actions={<Button icon={Plus} variant="primary" onClick={() => setIssueModal(true)}>新建问题</Button>}/>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-line bg-panel p-4 shadow-panel"><Split className="h-4 w-4 text-accent"/><p className="mt-2 text-xs text-muted">多归因、多路分发</p><p className="mt-1 text-2xl font-semibold">{multiAttributionCaseIds.length} Case</p></div><div className="rounded-lg border border-line bg-panel p-4 shadow-panel"><GitBranch className="h-4 w-4 text-warn"/><p className="mt-2 text-xs text-muted">命中多条分流路径</p><p className="mt-1 text-2xl font-semibold">{multiRouteCount} 问题</p></div><div className="rounded-lg border border-line bg-panel p-4 shadow-panel"><Users className="h-4 w-4 text-pass"/><p className="mt-2 text-xs text-muted">问题簇</p><p className="mt-1 text-2xl font-semibold">{clusters.length}</p></div><div className="rounded-lg border border-line bg-panel p-4 shadow-panel"><p className="text-xs text-muted">品味库计数</p><p className="mt-1 text-2xl font-semibold">{tasteCount} / 100</p><p className="mt-2 text-[11px] text-muted">仅品味库规则使用 100 条触发口径</p></div></div>
    <Tabs aria-label="归因与分流视图" activeId={tab} onChange={(id) => { setTab(id as Tab); setSelected(undefined); }} items={[{ id: 'issues', label: '独立问题', count: issues.length }, { id: 'clusters', label: '问题簇', count: clusters.length }, { id: 'deliveries', label: 'Routing Delivery', count: deliveries.length }, { id: 'badcases', label: '算法 Badcase Queue', count: badcaseItems.length }]}/>
    <FilterBar className="mt-4" searchValue={query} onSearchChange={setQuery} searchPlaceholder={tab === 'deliveries' ? '搜索 Delivery、Trace、分流去向或 Owner' : tab === 'badcases' ? '搜索 Badcase、Trace、Queue 或状态' : '搜索问题、Case、模块或维度'} resultCount={filtered.length} onReset={() => setQuery('')}/>
    {tab === 'deliveries' && <Section className="mt-4"><SectionHeader eyebrow="ROUTING DELIVERY" title="多路分流投递" description="同一 Trace 可产生多条独立 Delivery；Production Skill 失败默认进入策略迭代与算法 Badcase，品味 Skill / Personal Skill 进入 Agent 迭代队列。"/><div className="mt-3 grid gap-3 sm:grid-cols-3"><MetricTile label="Delivery 总数" value={deliveries.length}/><MetricTile label="待确认 / 排队" value={deliveries.filter((item) => ['PENDING', 'QUEUED'].includes(text(item.status))).length}/><MetricTile label="已交付 / 已解决" value={deliveries.filter((item) => ['DELIVERED', 'ACKNOWLEDGED', 'RESOLVED'].includes(text(item.status))).length} tone="pass"/></div></Section>}
    {tab === 'badcases' && <Section className="mt-4"><SectionHeader eyebrow="ALGORITHM BADCASE QUEUE" title="算法 Badcase 待确认队列" description="候选由自动分流生成，确认后再投递算法团队；自动判定和人工操作会保留在审计记录中。"/><div className="mt-3 grid gap-3 sm:grid-cols-3"><MetricTile label="候选" value={badcaseItems.filter((item) => text(item.status) === 'CANDIDATE').length} tone="warn"/><MetricTile label="已确认" value={badcaseItems.filter((item) => text(item.status) === 'CONFIRMED').length} tone="pass"/><MetricTile label="已驳回 / 已解决" value={badcaseItems.filter((item) => ['REJECTED', 'RESOLVED'].includes(text(item.status))).length}/></div></Section>}
    <Section className="mt-4"><SectionHeader title={tab === 'issues' ? '问题与处理链' : tab === 'clusters' ? '问题簇与聚类进度' : tab === 'deliveries' ? 'Routing Delivery 台账' : '算法 Badcase Queue 台账'} description={tab === 'issues' ? '确定性 Bug 可直接优化，但仍需关联变体和后续验证。' : tab === 'clusters' ? '品味库按 Skill 累积 100 条相关数据；其他未明确门槛保持待配置。' : tab === 'deliveries' ? '来源 Trace、Finding、Evidence 和后续 Issue / Variant 均可反查。' : '确认、驳回、补充 Owner 和备注均为本地 Mock 状态变更。'}/><DataTable className="mt-3" caption={tab === 'issues' ? '问题列表' : tab === 'clusters' ? '问题簇列表' : tab === 'deliveries' ? 'Routing Delivery 列表' : '算法 Badcase 列表'} rows={filtered} columns={tab === 'issues' ? issueColumns : tab === 'clusters' ? clusterColumns : tab === 'deliveries' ? deliveryColumns : badcaseColumns} rowKey={(row) => row.id} onRowClick={tab === 'deliveries' ? openRoutingRecord : setSelected}/></Section>
    {tab === 'clusters' && <Section className="mt-4"><SectionHeader title="品味库触发进度" description="按 Skill ID 去重的人工确认相关 Case 计数；仅品味库规则使用 100 条。其他问题簇未明确门槛时显示待配置。"/><div className="mt-3 grid gap-3 sm:grid-cols-2">{clusters.map((cluster) => { const trigger = triggerFor(cluster.id); return <div key={cluster.id} className="rounded-md border border-line bg-slate-50/70 p-3"><div className="mb-2 flex justify-between gap-2 text-xs"><span className="font-semibold">{text(cluster.name)}</span><span className="text-muted">{trigger.totalCount === null ? '待配置' : `${trigger.totalCount}/100`}</span></div><ProgressBar value={trigger.totalCount === null ? 0 : Math.min(100, trigger.totalCount)}/></div>; })}</div></Section>}
    {selected && (tab === 'issues' || tab === 'clusters') && <div className="fixed inset-0 z-50" role="dialog" aria-label={`${tab === 'issues' ? '问题' : '问题簇'}详情`}><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭遮罩" onClick={() => setSelected(undefined)}/><aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-base font-semibold">{text(selected.title, text(selected.name, selected.id))}</h2><p className="mt-1 font-mono text-[10px] text-accent">{selectedIdentity}</p></div><button aria-label="关闭" onClick={() => setSelected(undefined)} className="text-xs text-muted">关闭</button></div><Section className="mt-5"><SectionHeader title="归因与去向"/><KeyValueGrid className="mt-3" items={[{ label: '模块', value: text(selected.module) }, { label: '归因维度', value: text(selected.dimension, '需求待补充') }, { label: '处理方式', value: text(selected.optimizationMode) === 'DIRECT_FIX' ? '直接优化' : text(selected.optimizationMode, '聚类优化') }, { label: '状态 / Owner', value: `${text(selected.status)} · ${text(selected.owner, '未分配')}` }, ...(tab === 'issues' ? [{ label: '问题描述', value: text(selected.description, '未填写') }, { label: '责任状态', value: text(selected.responsibilityStatus) }] : [])]}/><div className="mt-4"><p className="mb-2 text-[10px] font-semibold uppercase text-muted">分流标签（非互斥）</p><TagList values={strings(selected.routingLabels)} empty="问题簇由关联问题继承分流"/></div>{tab === 'issues' && Array.isArray(selected.processingChains) && <div className="mt-4 space-y-2"><p className="text-[10px] font-semibold uppercase text-muted">独立处理链</p>{selected.processingChains.map((chain) => { const item = record(chain); return <div key={text(item.id)} className="rounded-md border border-line bg-slate-50 p-2 text-xs"><span className="font-semibold">{text(item.routingLabel)}</span> → {text(item.destinationType)} · {text(item.status)}<p className="mt-1 text-muted">{text(item.note)}</p></div>; })}</div>}</Section>{tab === 'issues' && selectedAttribution && <Section className="mt-4"><SectionHeader title="归因历史" description="自动结论与人工 Revision 按时间追加，不覆盖历史。"/><div className="mt-3 space-y-2">{selectedAttribution.revisions.map((revision) => <div key={revision.id} className="rounded-md border border-line bg-slate-50/70 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{revision.module} · {revision.dimension}</span><span className="text-[10px] text-muted">{revision.source} · {revision.revisedBy}</span></div><p className="mt-1 text-muted">{revision.reason}</p></div>)}</div></Section>}<Section className="mt-4"><SectionHeader title={tab === 'issues' ? '关联问题簇' : '关联 Case 与问题'}/><div className="mt-3 flex flex-wrap gap-2">{tab === 'issues' ? strings(selected.clusterIds).map((id) => <IdLink key={id} id={id} kind="cluster" onOpen={navigation.open}/>) : <>{strings(selected.caseIds).map((id) => <IdLink key={id} id={id} kind="case" onOpen={navigation.open}/>)}{strings(selected.issueIds).map((id) => <IdLink key={id} id={id} kind="issue" onOpen={navigation.open}/>)}</>}{tab === 'issues' && !strings(selected.clusterIds).length && <span className="text-xs text-muted">尚未加入问题簇</span>}</div></Section>{tab === 'clusters' && <Section className="mt-4"><SectionHeader title={selectedIsTasteCluster ? '品味库触发进度' : '问题簇触发进度'} description={text(selected.countingRule, '按 Skill 统计相关 Case；触发口径待配置。')}/><div className="mt-4"><ProgressBar value={selectedTrigger?.totalCount == null ? 0 : Math.min(100, selectedTrigger.totalCount)} label={selectedTrigger?.totalCount == null ? '待配置' : String(selectedTrigger.totalCount) + ' / 100'}/></div></Section>}<Section className="mt-4"><SectionHeader title="关联 Evidence 与变体"/><div className="mt-3 flex flex-wrap gap-2">{strings(selected.evidenceIds).map((id) => <IdLink key={id} id={id} kind="evidence" onOpen={navigation.open}/>)}{!strings(selected.evidenceIds).length && <span className="text-xs text-muted">暂无 Evidence</span>}</div><div className="mt-4 flex flex-wrap gap-2">{strings(selected.variantIds).map((id) => <IdLink key={id} id={id} kind="variant" onOpen={navigation.open}/>)}{(tab === 'clusters' || (tab === 'issues' && selected.optimizationMode === 'DIRECT_FIX')) && <Button icon={Plus} disabled={selectedIsTastePending} onClick={openVariantModal}>创建能力变体</Button>}{tab === 'issues' && <Button icon={Plus} onClick={() => setClusterModal(true)}>加入问题簇</Button>}</div></Section></aside></div>}
    <Modal open={issueModal} onClose={() => setIssueModal(false)} title="新建问题" footer={<div className="flex justify-end gap-2"><Button onClick={() => setIssueModal(false)}>取消</Button><Button variant="primary" onClick={createIssue} disabled={!issueTitle.trim() || !issueDescription.trim() || !issueAttributionId || issueEvidenceIds.length === 0 || issueRoutes.length === 0}>保存问题</Button></div>}><div className="space-y-3"><Field label="来源 Case"><SelectInput aria-label="来源 Case" value={issueCaseId} onChange={(event) => { const caseId = event.target.value; const firstAttribution = state.attributions.find((item) => item.caseId === caseId); setIssueCaseId(caseId); setIssueAttributionId(firstAttribution?.id ?? ''); setIssueEvidenceIds([]); }}>{state.cases.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</SelectInput></Field><Field label="来源归因"><SelectInput aria-label="来源归因" value={issueAttributionId} onChange={(event) => { const attribution = state.attributions.find((item) => item.id === event.target.value); setIssueAttributionId(event.target.value); if (attribution) {
        setIssueModule(attribution.module);
        setIssueDimension(attribution.dimension);
    } setIssueEvidenceIds([]); }}>{state.attributions.filter((item) => item.caseId === issueCaseId).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.module}</option>)}</SelectInput></Field><Field label="问题标题"><TextInput aria-label="问题标题" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)}/></Field><IssueEvidenceFields description={issueDescription} onDescriptionChange={setIssueDescription} evidenceIds={issueEvidenceIds} onToggleEvidence={(id) => setIssueEvidenceIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} evidence={state.evidence.filter((item) => item.caseId === issueCaseId)}/><Field label="模块"><SelectInput aria-label="问题模块" value={issueModule} onChange={(event) => { const value = event.target.value as EvolutionModule; setIssueModule(value); setIssueDimension(ATTRIBUTION_DIMENSIONS[value][0]); }}>{Object.keys(ATTRIBUTION_DIMENSIONS).map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="归因维度"><SelectInput aria-label="问题维度" value={issueDimension} onChange={(event) => setIssueDimension(event.target.value)}>{ATTRIBUTION_DIMENSIONS[issueModule].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><fieldset><legend className="text-xs font-medium">独立处理去向（可多选）</legend>{["策略迭代", "Agent 迭代", "个人能力转 Skill（二期）"].map((route) => <label key={route} className="mr-3 inline-flex items-center gap-1.5 text-xs"><input aria-label={route} type="checkbox" checked={issueRoutes.includes(route)} onChange={() => setIssueRoutes((items) => items.includes(route) ? items.filter((item) => item !== route) : [...items, route])}/> {route}</label>)}</fieldset><Field label="优化方式"><SelectInput aria-label="优化方式" value={issueMode} onChange={(event) => setIssueMode(event.target.value as Issue["optimizationMode"])}><option value="DIRECT_FIX">直接优化</option><option value="CLUSTER_OPTIMIZATION">聚类优化</option></SelectInput></Field><Field label="Owner"><TextInput aria-label="Owner" value={issueOwner} onChange={(event) => setIssueOwner(event.target.value)}/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="责任状态"><SelectInput aria-label="责任状态" value={issueResponsibility} onChange={(event) => setIssueResponsibility(event.target.value as Issue["responsibilityStatus"])}>{["UNASSIGNED", "ASSIGNED", "VERIFIED"].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="生命周期状态"><SelectInput aria-label="生命周期状态" value={issueStatus} onChange={(event) => setIssueStatus(event.target.value as Issue['status'])}>{["PENDING", "CONFIRMED", "FIXING", "VERIFIED", "CLOSED"].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field></div><p className="rounded-md border border-warn/20 bg-warn/5 p-2 text-[11px] text-muted">个人能力转 Skill 为二期规划去向，保存后标记为 PHASE_2，不会调用或伪造生成服务。</p></div></Modal>
    <Modal open={clusterModal} onClose={() => setClusterModal(false)} title="加入问题簇" footer={<div className="flex justify-end gap-2"><Button onClick={() => setClusterModal(false)}>取消</Button><Button variant="primary" onClick={addToCluster}>确认加入</Button></div>}><Field label="目标问题簇"><SelectInput aria-label="目标问题簇" value={targetClusterId} onChange={(event) => setTargetClusterId(event.target.value)}>{clusters.map((item) => <option key={item.id} value={item.id}>{text(item.name)}</option>)}</SelectInput></Field></Modal>
    {variantModal && selected && <VariantCreateDialog state={fullState} sourceClusterId={tab === 'clusters' ? selected.id : undefined} sourceIssueId={tab === 'issues' ? selected.id : undefined} onClose={() => setVariantModal(false)} onCreate={variant => { dispatch({ type: 'CREATE_VARIANT', variant, meta: { actor: '当前用户', reason: '统一变体创建入口', at: variant.createdAt } }); setSelected({ ...selected, variantIds: [...strings(selected.variantIds), variant.id] }); setVariantModal(false); }} />}
    {selected && tab === 'issues' && <div className="fixed bottom-4 right-4 z-50 rounded border border-line bg-panel p-3 text-xs shadow-lg"><p className="font-semibold">显式归因</p>{selectedAttribution && <><IdLink id={selectedAttribution.id} kind="attribution" onOpen={navigation.open}/><p>{selectedAttribution.module} · {selectedAttribution.dimension}</p></>}<div className="mt-2 space-y-1">{Array.isArray(selected.processingChains) && selected.processingChains.map((chain) => { const item = record(chain); return <p key={text(item.id)}>{text(item.routingLabel)} → {text(item.destinationType)} · {text(item.status)}</p>; })}</div></div>}
    {selectedIsTastePending && <div role="status" className="fixed bottom-4 left-4 z-50 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">未达到品味库触发门槛：{selectedTrigger?.totalCount} / 100，暂不能创建变体。</div>}
    {selectedIsTasteCluster && selectedTrigger && <div className="fixed bottom-20 left-4 z-50 max-w-md rounded border border-line bg-panel p-3 text-xs text-muted shadow-lg"><p>限定 Skill ID：{selectedTrigger.skillId ? <IdLink id={selectedTrigger.skillId} kind="skill" onOpen={navigation.open}/> : <span>未配置</span>}</p><p>本地已确认 Case {selectedTrigger.localCount} 条 + 外部 Mock 快照 {selectedTrigger.externalMockCount} 条</p><p>{selectedTrigger.source} · <span role="note" aria-label="外部 Mock 快照不可导航">{selectedTrigger.snapshotId} · 不可导航</span></p></div>}
    {selectedAttribution && <div className="fixed bottom-28 right-4 z-[60] flex items-center gap-2"><span className="text-xs">归因历史：{selectedAttribution.revisions.length} 条</span><Button onClick={openIssueEditor}>编辑问题</Button><Button onClick={() => { setAttributionDimensionEdit(selectedAttribution.dimension); setAttributionEditOpen(true); }}>编辑归因</Button></div>}
    <Modal open={attributionEditOpen} onClose={() => setAttributionEditOpen(false)} title="编辑归因" description={`归因历史：${selectedAttribution?.revisions.length ?? 0} 条`} footer={<Button variant="primary" onClick={saveAttributionRevision}>保存归因 Revision</Button>}><Field label="归因维度"><TextInput aria-label="归因维度编辑" value={attributionDimensionEdit} onChange={(event) => setAttributionDimensionEdit(event.target.value)}/></Field></Modal>
    <Modal open={editIssueOpen} onClose={() => setEditIssueOpen(false)} title="编辑问题" footer={<Button variant="primary" onClick={saveIssueEdit} disabled={!editIssueDescription.trim() || !editIssueRoutes.length || !editIssueEvidenceIds.length}>保存问题</Button>}><div className="space-y-3"><IssueEvidenceFields description={editIssueDescription} onDescriptionChange={setEditIssueDescription} evidenceIds={editIssueEvidenceIds} onToggleEvidence={(id) => setEditIssueEvidenceIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} evidence={state.evidence.filter((item) => item.caseId === text(selected?.caseId))}/><Field label="Owner"><TextInput aria-label="Owner" value={editIssueOwner} onChange={(event) => setEditIssueOwner(event.target.value)}/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="责任状态"><SelectInput aria-label="责任状态" value={editIssueResponsibility} onChange={(event) => setEditIssueResponsibility(event.target.value as Issue['responsibilityStatus'])}>{['UNASSIGNED', 'ASSIGNED', 'VERIFIED'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="生命周期状态"><SelectInput aria-label="生命周期状态" value={editIssueStatus} onChange={(event) => setEditIssueStatus(event.target.value as Issue['status'])}>{['PENDING', 'CONFIRMED', 'FIXING', 'VERIFIED', 'CLOSED'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field></div><fieldset><legend className="text-xs font-medium">独立处理去向（可多选）</legend>{['策略迭代', 'Agent 迭代', '个人能力转 Skill（二期）'].map((route) => <div key={route} className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr]"><label className="inline-flex items-center gap-1.5 text-xs"><input aria-label={route} type="checkbox" checked={editIssueRoutes.includes(route)} onChange={() => setEditIssueRoutes((items) => items.includes(route) ? items.filter((item) => item !== route) : [...items, route])}/>{route}</label>{editIssueRoutes.includes(route) && <TextInput aria-label={`${route}处理说明`} value={editIssueChainNotes[route] ?? ''} onChange={(event) => setEditIssueChainNotes((items) => ({ ...items, [route]: event.target.value }))}/>}</div>)}</fieldset><p className="text-[11px] text-muted">个人能力转 Skill 保存为 PHASE_2 规划链，不调用生成服务。</p></div></Modal>
    {selected && tab === 'deliveries' && <div className="fixed inset-0 z-50" role="dialog" aria-label="Routing Delivery 详情"><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭遮罩" onClick={() => setSelected(undefined)}/><aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Routing Delivery</h2><p className="mt-1 font-mono text-[10px] text-accent">{selectedIdentity}</p></div><button aria-label="关闭" onClick={() => setSelected(undefined)} className="text-xs text-muted">关闭</button></div><Section className="mt-5"><SectionHeader title="分流上下文"/><KeyValueGrid className="mt-3" items={[{ label: '分流标签', value: <StatusBadge status={text(selected.label)} label={text(selected.label)} tone="info" showIcon={false}/> }, { label: '目的地', value: destinationLabels[text(selected.destination)] ?? text(selected.destination) }, { label: '状态', value: <StatusBadge status={text(selected.status)}/> }, { label: 'Finding', value: <IdLink id={text(selected.findingId)} kind="finding" onOpen={navigation.open}/> }, { label: '源 Trace', value: <IdLink id={text(selected.traceId)} kind="trace" onOpen={navigation.open}/> }, { label: '源 Case', value: <IdLink id={text(selected.caseId)} kind="case" onOpen={navigation.open}/> }, { label: 'Evaluation Package', value: <IdLink id={text(selected.packageId)} kind="trace-package" onOpen={navigation.open}/> }, { label: '证据', value: strings(record(findings.find((item) => item.id === selected.findingId)?.evidenceBundle).rootEvidenceIds).join('、') || '随 Finding 查看' }]}/></Section><Section className="mt-4"><SectionHeader title="人工交接" description="保存 Owner 与备注后会写入本地审计；确认/驳回不删除自动分流结果。"/><div className="mt-3 space-y-3"><Field label="Owner"><TextInput aria-label="Delivery Owner" value={deliveryOwner} onChange={(event) => setDeliveryOwner(event.target.value)} placeholder="算法团队 / Agent 团队"/></Field><Field label="备注"><TextArea aria-label="Delivery 备注" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="补充处理上下文、回归数据集或风险"/></Field><div className="flex flex-wrap gap-2"><Button icon={Send} onClick={saveDeliveryDetails}>保存交接信息</Button>{!text(selected.issueId) && <Button variant="primary" onClick={createIssueFromDelivery}>创建治理问题</Button>}{text(selected.status) !== 'ACKNOWLEDGED' && <Button icon={CheckCircle2} variant="primary" onClick={() => updateDeliveryStatus('ACKNOWLEDGED')}>确认已接收</Button>}{text(selected.status) !== 'REJECTED' && <Button icon={XCircle} variant="danger" onClick={() => updateDeliveryStatus('REJECTED')}>驳回</Button>}</div></div></Section><Section className="mt-4"><SectionHeader title="后续治理对象"/><div className="mt-3 flex flex-wrap gap-2">{text(selected.algorithmBadcaseId) && <IdLink id={text(selected.algorithmBadcaseId)} kind="badcase" onOpen={navigation.open}/>}{text(selected.issueId) && <IdLink id={text(selected.issueId)} kind="issue" onOpen={navigation.open}/>}{text(selected.issueClusterId) && <IdLink id={text(selected.issueClusterId)} kind="cluster" onOpen={navigation.open}/>}{text(selected.variantId) && <IdLink id={text(selected.variantId)} kind="variant" onOpen={navigation.open}/>}{!text(selected.algorithmBadcaseId) && !text(selected.issueId) && !text(selected.issueClusterId) && !text(selected.variantId) && <span className="text-xs text-muted">尚未关联 Issue / Cluster / Variant</span>}</div></Section></aside></div>}
    {selected && tab === 'badcases' && <div className="fixed inset-0 z-50" role="dialog" aria-label="算法 Badcase 详情"><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭遮罩" onClick={() => setSelected(undefined)}/><aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{text(selected.title, '算法 Badcase Candidate')}</h2><p className="mt-1 font-mono text-[10px] text-accent">{selectedIdentity}</p></div><button aria-label="关闭" onClick={() => setSelected(undefined)} className="text-xs text-muted">关闭</button></div><Section className="mt-5"><SectionHeader title="来源与证据"/><KeyValueGrid className="mt-3" items={[{ label: '确认状态', value: <StatusBadge status={text(selected.status)} label={text(selected.status) === 'CANDIDATE' ? '待确认' : text(selected.status)}/> }, { label: '来源 Trace', value: <IdLink id={text(selected.traceId)} kind="trace" onOpen={navigation.open}/> }, { label: '来源 Finding', value: <IdLink id={text(selected.findingId)} kind="finding" onOpen={navigation.open}/> }, { label: '队列', value: <IdLink id={text(selected.queueId)} kind="badcase-queue" onOpen={navigation.open}/> }, { label: '回归数据集', value: text(selected.regressionDatasetId, '待关联') }]}/><div className="mt-3 flex flex-wrap gap-2">{strings(selected.sourceEvidenceIds).map((id) => <IdLink key={id} id={id} kind="evidence" onOpen={navigation.open}/>)}{!strings(selected.sourceEvidenceIds).length && <span className="text-xs text-muted">暂无根证据</span>}</div></Section><Section className="mt-4"><SectionHeader title="算法交接" description="候选确认后保留自动路由结果、人工确认人和后续问题关联。"/><div className="mt-3 space-y-3"><Field label="Owner"><TextInput aria-label="Badcase Owner" value={deliveryOwner} onChange={(event) => setDeliveryOwner(event.target.value)} placeholder="算法团队"/></Field><Field label="备注"><TextArea aria-label="Badcase 备注" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="补充 Badcase 复现步骤、影响范围或回归集"/></Field><div className="flex flex-wrap gap-2"><Button icon={Send} onClick={() => { const patch = { owner: deliveryOwner.trim() || undefined, note: deliveryNote.trim() || undefined }; dynamicDispatch(dispatch, 'UPDATE_ALGORITHM_BADCASE', { badcaseId: selected.id, patch }); setSelected({ ...selected, ...patch }); }}>保存交接信息</Button>{text(selected.status) === 'CANDIDATE' && <><Button icon={CheckCircle2} variant="primary" onClick={() => updateBadcaseStatus('CONFIRMED')}>确认 Badcase</Button><Button icon={XCircle} variant="danger" onClick={() => updateBadcaseStatus('REJECTED')}>驳回候选</Button></>}</div></div></Section><Section className="mt-4"><SectionHeader title="问题治理链"/><div className="mt-3 flex flex-wrap gap-2">{text(selected.issueId) && <IdLink id={text(selected.issueId)} kind="issue" onOpen={navigation.open}/>}{text(selected.issueClusterId) && <IdLink id={text(selected.issueClusterId)} kind="cluster" onOpen={navigation.open}/>}{text(selected.variantId) && <IdLink id={text(selected.variantId)} kind="variant" onOpen={navigation.open}/>}{!text(selected.issueId) && !text(selected.issueClusterId) && !text(selected.variantId) && <span className="text-xs text-muted">确认后可进入 Issue / 问题簇 / 变体治理</span>}</div></Section></aside></div>}
    {navigation.drawer}
  </div>;
}
