import type { EvalResult, JudgeStatus, Observation, QualityData, Task, Trace } from '../../domain';
import type { EvolutionState } from '../domain';
import { resolveCaseSource } from '../labels';
import { evolutionItemId, evolutionItemLabel } from '../taxonomy';
import { normalizeSkillVersion } from '../data/skillWorkspace';
export type ReferenceKind = import('../components/ViewPrimitives').ReferenceKind | 'issue-cluster';
export interface CaseReference {
    kind: ReferenceKind;
    id: string;
    label: string;
    status?: string;
    module?: string;
    dimension?: string;
    routingTags?: string[];
}
export interface SessionTurn {
    id: string;
    sequence: number;
    role: 'user' | 'agent';
    content: string;
    taskId?: string;
    traceId?: string;
    createdAt: string;
}
export interface SessionView {
    id: string;
    turns: SessionTurn[];
}
export interface SkillView {
    id: string;
    name: string;
    version: string;
}
export interface ArtifactView {
    id: string;
    name: string;
    type: string;
    status: string;
    outcomeEvalIds: string[];
    sourceObservationIds: string[];
}
export interface LogView {
    id: string;
    observationId?: string;
    traceId: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: string;
    metadata: Record<string, string>;
}
export interface HumanRevisionView {
    id: string;
    kind: 'confirmation' | 'attribution';
    value: string;
    note: string;
    by: string;
    at: string;
}
export interface CaseAnalysisRecord {
    id: string;
    task: Task;
    trace?: Trace;
    traces?: Trace[];
    session: SessionView;
    skill: SkillView;
    /** Recorded execution identity; never replaced by today's Skill catalog version. */
    skillsByTrace?: Record<string, SkillView>;
    artifacts: ArtifactView[];
    logs: LogView[];
    processEvals: EvalResult[];
    outcomeEvals: EvalResult[];
    processSummary: JudgeStatus;
    outcomeSummary: JudgeStatus;
    userFeedback: string;
    failureObservation?: Observation;
    evidenceIds: string[];
    attributionModule: string;
    attributionDimension: string;
    routingTags: string[];
    multiScene: boolean;
    manualStatus: string;
    revisions: HumanRevisionView[];
    links: CaseReference[];
    attributions?: CaseReference[];
    moduleEvaluations?: Array<Record<string, unknown>>;
    processEvalsByTrace?: Record<string, EvalResult[]>;
    outcomeEvalsByTrace?: Record<string, EvalResult[]>;
    sourceRefId?: string;
    sourceRefKind?: 'dataset' | 'window';
    sourceRefVersion?: string;
    discoveryMethod?: string;
    sourceLabel?: '线上+时间窗口' | '黄金测试集' | 'mock集';
    evaluationScenarios?: Array<{
        label: string;
        dimension: string;
        path: string;
        findingId?: string;
    }>;
    tastePreference?: {
        populationTotal: number;
        preferenceCount: number;
        preferenceValue: string;
        preferenceRate: number;
        relatedDataCount: number;
        relatedDataThreshold: number;
        judgeReason: string;
        routingLabel: string;
        optimizationPath: string;
    };
    channel?: string;
    verticalScenario?: string;
    processFinalScore?: number;
    outcomeFinalScore?: number;
    tokens?: number;
    latencyMs?: number;
    provenanceLabels?: string[];
    deliveryUri?: string;
    moduleEvaluationsByTrace?: Record<string, Array<Record<string, unknown>>>;
    evaluationScenariosByTrace?: Record<string, Array<{
        label: string;
        dimension: string;
        path: string;
        findingId?: string;
    }>>;
}
export interface CaseAnalysisData {
    cases: CaseAnalysisRecord[];
    evidence: QualityData['evidence'];
    rootEvidence?: EvolutionState['evidence'];
    referenceTime: string;
}
export interface CaseAnalysisFilters {
    query?: string;
    sessionId?: string;
    traceId?: string;
    skillId?: string;
    skillVersion?: string;
    timeRange?: '24h' | '7d' | '14d' | '30d' | 'all';
    /** Numeric final-score band, e.g. 1-1.5; legacy PASS/FAIL values remain supported for deep links. */
    processEval?: string;
    outcomeEval?: string;
    logId?: string;
    routingTags?: string[];
    multiScene?: 'all' | 'yes' | 'no';
    batchId?: string;
    skillCategory?: string;
    evalCoverage?: string;
    routingStatus?: string;
    badcaseStatus?: string;
  owner?: string;
  channel?: string;
  verticalScenario?: string;
  processMin?: number;
  processMax?: number;
  outcomeMin?: number;
  outcomeMax?: number;
  tokenMin?: number;
  tokenMax?: number;
  latencyMin?: number;
  latencyMax?: number;
  evolutionItem?: string;
}
export const emptyCaseAnalysisFilters: CaseAnalysisFilters = { query: '', sessionId: '', traceId: '', skillId: '', skillVersion: '', timeRange: '30d', processEval: '', outcomeEval: '', logId: '', routingTags: [], multiScene: 'all' };
const effectiveStatus = (evaluation: EvalResult): JudgeStatus => evaluation.humanStatus ?? evaluation.status ?? evaluation.autoStatus;
const summarizeEvals = (evaluations: EvalResult[]): JudgeStatus => {
    const statuses = evaluations.map(effectiveStatus);
    if (!statuses.length)
        return 'UNKNOWN';
    if (statuses.includes('FAIL'))
        return 'FAIL';
    if (statuses.includes('DERIVED_FAIL'))
        return 'DERIVED_FAIL';
    if (statuses.includes('UNKNOWN'))
        return 'UNKNOWN';
    if (statuses.every((status) => status === 'N/A'))
        return 'N/A';
    return 'PASS';
};
const failureFor = (trace?: Trace) => trace?.observations.find((item) => (item.judgeStatus ?? item.status) === 'FAIL' && !item.derived) ?? trace?.observations.find((item) => (item.judgeStatus ?? item.status) === 'FAIL');
const routingFor = (task: Task, index: number) => task.id === 'task-001' ? ['策略迭代', 'Agent 迭代'] : task.rootCause === 'Tool' || task.rootCause === 'Skill Internal' ? ['Agent 迭代'] : task.rootCause === 'Memory' || task.rootCause === 'Planning / Decision' ? ['策略迭代'] : index % 7 === 0 ? ['策略迭代', 'Agent 迭代'] : ['观察队列'];
const moduleFor = (task: Task, failure?: Observation) => failure?.nodeType === 'Memory' ? 'Memory' : failure?.nodeType === 'Skill' || failure?.nodeType === 'Skill Routing' ? 'Skill' : failure?.nodeType === 'Tool' ? 'Act' : failure?.nodeType === 'Task Understanding' || failure?.nodeType === 'Planning / Decision' ? 'Reason' : task.rootCause === 'None' ? '未归因' : task.rootCause;
const dimensionFor = (module: string, task: Task) => module === 'Memory' ? (task.id === 'task-001' ? '准确率低' : '召回率低') : module === 'Skill' ? (task.rootCause === 'Skill Routing' ? 'skill name/description错误' : 'skill sop错误') : module === 'Act' ? '工具未执行成功' : module === 'Reason' ? (task.rootCause === 'Task Understanding' ? '没有充分响应用户query的客观诉求' : '没有做出最正确/高效的选择') : '需求待补充';
const artifactName = (task: Task) => task.businessType === 'PPT' ? '管理层经营复盘.pptx' : task.businessType === 'Excel' ? '业务分析.xlsx' : task.businessType === 'Word' ? '结构化文档.docx' : '任务结果';
function sessionTurnsFor(task: Task, sessionTasks: Task[]): SessionTurn[] {
    const turns: SessionTurn[] = [];
    if (task.id === 'task-001')
        turns.push({ id: task.sessionId + '-context-user', sequence: 1, role: 'user', content: '用公司模板做一份销售复盘，先面向普通员工。', taskId: 'task-context-001', traceId: 'trace-context-001', createdAt: new Date(Date.parse(task.timestamp) - 180000).toISOString() }, { id: task.sessionId + '-context-agent', sequence: 2, role: 'agent', content: '已生成员工版销售复盘，受众偏好已保留在 Session 上下文中。', taskId: 'task-context-001', traceId: 'trace-context-001', createdAt: new Date(Date.parse(task.timestamp) - 120000).toISOString() });
    [...sessionTasks].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).forEach((candidate) => {
        const base = turns.length;
        turns.push({ id: candidate.id + '-user', sequence: base + 1, role: 'user', content: candidate.query, taskId: candidate.id, traceId: candidate.traceId, createdAt: candidate.timestamp }, { id: candidate.id + '-agent', sequence: base + 2, role: 'agent', content: candidate.finalOutcome || 'Agent 未记录最终回复。', taskId: candidate.id, traceId: candidate.traceId, createdAt: new Date(Date.parse(candidate.timestamp) + Math.max(1, candidate.latency)).toISOString() });
    });
    return turns;
}
function linksFor(task: Task, index: number): CaseReference[] {
    const complete = task.id === 'task-001';
    const links: CaseReference[] = [{ kind: 'issue', id: complete ? 'issue-office-audience-001' : 'issue-' + task.id, label: complete ? '管理层受众召回偏差' : task.rootCause + ' 问题', status: task.status === 'Failed' ? '已确认' : '观察中' }];
    if (complete || index % 3 === 0)
        links.push({ kind: 'issue-cluster', id: complete ? 'cluster-office-executive-style' : 'cluster-' + String(index % 5 + 1).padStart(3, '0'), label: complete ? '管理层 Office 产物风格问题簇' : '相似线上问题簇', status: '聚类优化' });
    if (complete || index % 4 === 0)
        links.push({ kind: 'variant', id: complete ? 'variant-ppt-routing-v3' : 'variant-' + String(index + 1).padStart(3, '0'), label: complete ? 'PPT 管理层意图路由 v3' : '候选能力变体', status: complete ? '实验通过' : '草稿' });
    if (complete || index % 5 === 0)
        links.push({ kind: 'experiment', id: complete ? 'experiment-single-ppt-routing-v3' : 'experiment-' + String(index + 1).padStart(3, '0'), label: complete ? '单变体实验：管理层路由' : '单变体实验', status: complete ? '准出' : '待运行' });
    if (complete)
        links.push({ kind: 'release', id: 'release-office-2.6.0', label: 'Office Agent 2.6.0', status: '灰度观察' });
    return links;
}
export function buildCaseAnalysisData(data: QualityData): CaseAnalysisData {
    const referenceTime = data.updatedAt || data.tasks[0]?.timestamp || new Date(0).toISOString();
    const cases = data.tasks.map((task, index): CaseAnalysisRecord => {
        const trace = data.traces.find((item) => item.id === task.traceId);
        const failure = failureFor(trace);
        const module = moduleFor(task, failure);
        const caseRecord = data.cases.find((item) => item.taskId === task.id);
        const feedback = task.acceptanceEvents?.find((event) => event.type === 'dislike' || event.type === 'correction');
        const logs = (trace?.observations ?? []).map((observation, logIndex): LogView => ({ id: 'log-' + task.id + '-' + String(logIndex + 1).padStart(2, '0'), observationId: observation.id, traceId: task.traceId, level: (observation.judgeStatus ?? observation.status) === 'FAIL' ? 'ERROR' : observation.error ? 'WARN' : 'INFO', message: observation.error ?? observation.reason ?? observation.nodeType + ' 执行完成', timestamp: new Date(Date.parse(task.timestamp) + logIndex * 1000).toISOString(), metadata: { ...observation.metadata, node: observation.nodeType } }));
        return {
            id: caseRecord?.id ?? 'case-' + task.id, task, trace,
            session: { id: task.sessionId, turns: sessionTurnsFor(task, data.tasks.filter((item) => item.sessionId === task.sessionId)) },
            skill: { id: task.skill, name: task.skill, version: task.id === 'task-001' ? '2.5.0' : task.agentVersion.replace('agent-', '') },
            artifacts: [{ id: 'artifact-' + task.id, name: artifactName(task), type: task.outcomeType, status: task.status === 'Failed' ? '评测未通过' : '可用', outcomeEvalIds: task.evals.map((item) => item.id), sourceObservationIds: (trace?.observations ?? []).filter((item) => item.nodeType === 'Tool' || item.nodeType === 'Final Outcome').map((item) => item.id) }],
            logs, processEvals: task.processEvals, outcomeEvals: task.evals, processSummary: summarizeEvals(task.processEvals), outcomeSummary: summarizeEvals(task.evals),
            userFeedback: feedback?.note ?? (feedback ? '用户发起纠错或拒绝当前产物。' : '暂无明确用户反馈'), failureObservation: failure,
            evidenceIds: [...new Set([...(failure?.evidenceIds ?? []), ...task.evals.flatMap((item) => item.evidenceIds)])], attributionModule: module, attributionDimension: dimensionFor(module, task),
            routingTags: routingFor(task, index), multiScene: routingFor(task, index).length > 1 || (task.sessionId === 'session-001' && data.tasks.filter((item) => item.sessionId === task.sessionId).length > 1), manualStatus: caseRecord?.humanStatus ? '人工 ' + caseRecord.humanStatus : '待人工确认',
            revisions: caseRecord?.humanStatus ? [{ id: 'revision-' + caseRecord.id, kind: 'confirmation', value: caseRecord.humanStatus, note: caseRecord.humanReason ?? '人工复核', by: '质量运营', at: caseRecord.updatedAt }] : [], links: linksFor(task, index)
        };
    });
    return { cases, evidence: data.evidence, referenceTime };
}
const legacyStatus = (verdict: string): JudgeStatus => verdict === 'PASS' ? 'PASS' : verdict === 'FAIL' ? 'FAIL' : verdict === 'NOT_APPLICABLE' ? 'N/A' : 'UNKNOWN';
const summarizeModuleStatuses = (statuses: string[]): JudgeStatus => {
    if (!statuses.length)
        return 'UNKNOWN';
    if (statuses.includes('FAIL'))
        return 'FAIL';
    if (statuses.includes('DERIVED_FAIL'))
        return 'DERIVED_FAIL';
    if (statuses.includes('UNKNOWN'))
        return 'UNKNOWN';
    if (statuses.every((status) => status === 'N/A'))
        return 'N/A';
    return 'PASS';
};
/** Normalizes the upgraded governance store into the UI's stable case view. */
export function buildCaseAnalysisDataFromEvolution(state: EvolutionState): CaseAnalysisData {
    const cases = state.cases.map((record): CaseAnalysisRecord => {
        const traces = state.traces.filter((item) => item.caseId === record.id).sort((a, b) => a.sequence - b.sequence);
        const primaryTrace = traces[traces.length - 1];
        const observations = state.observations.filter((item) => item.caseId === record.id).sort((a, b) => a.sequence - b.sequence);
        const failureLog = observations.find((item) => item.status === 'FAILED');
        const failureObservation: Observation | undefined = failureLog && primaryTrace ? {
            id: failureLog.id, traceId: failureLog.traceId, sequence: failureLog.sequence,
            nodeType: failureLog.nodeType === 'Reason' ? 'Planning / Decision' : failureLog.nodeType === 'Act' ? 'Tool' : failureLog.nodeType === 'Artifact' ? 'Final Outcome' : failureLog.nodeType,
            status: 'FAIL', judgeStatus: 'FAIL', input: failureLog.input, output: failureLog.output, latency: failureLog.latencyMs,
            tool: failureLog.toolName, rootCause: failureLog.nodeType === 'Reason' ? 'Planning / Decision' : failureLog.nodeType === 'Skill' ? 'Skill Internal' : failureLog.nodeType === 'Tool' || failureLog.nodeType === 'Act' ? 'Tool' : failureLog.nodeType === 'Memory' ? 'Memory' : undefined,
            isRootCause: true, reason: failureLog.output, error: failureLog.output, metadata: { logId: failureLog.logId }, evidenceIds: [...failureLog.evidenceIds]
        } : undefined;
        const task: Task = {
            id: record.id, traceId: primaryTrace?.id ?? record.traceIds[0] ?? 'trace-missing', sessionId: record.sessionId, query: record.query,
            businessType: record.scenario.includes('PPT') ? 'PPT' : record.scenario.includes('Excel') ? 'Excel' : record.scenario.includes('Word') ? 'Word' : 'General',
            complexity: 'Complex', agentVersion: record.agentVersion, environment: record.environment, status: record.resultStatus === 'FAIL' ? 'Failed' : record.processStatus === 'FAIL' ? 'Effective but Inefficient' : 'Effective',
            outcomeType: record.artifactIds.length ? 'Content Artifact' : 'Operation', rootCause: failureLog?.nodeType === 'Memory' ? 'Memory' : failureLog?.nodeType === 'Reason' ? 'Planning / Decision' : failureLog?.nodeType === 'Skill' ? 'Skill Internal' : failureLog ? 'Tool' : 'None',
            latency: traces.reduce((sum, item) => sum + item.totalLatencyMs, 0), cost: 0, tokens: traces.reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0), modelCalls: 0,
            toolCalls: observations.filter((item) => item.toolName).length, loopCount: 0, retryCount: observations.reduce((sum, item) => sum + item.retryCount, 0), timestamp: record.createdAt,
            skill: record.skillIds[0] ?? 'Skill 未记录', finalOutcome: record.feedback ?? (record.resultStatus === 'FAIL' ? '结果评测未通过' : '结果评测通过'), evals: [], processEvals: [], isBadcase: record.resultStatus === 'FAIL', isGolden: false
        };
        const processEvals: EvalResult[] = state.processEvals.filter((item) => item.caseId === record.id).map((item) => ({ id: item.id, taskId: record.id, family: 'Process Eval', dimension: item.dimension, autoStatus: legacyStatus(item.revisions[0]?.verdict ?? item.verdict), autoReason: item.revisions[0]?.reason ?? '判定依据未记录', evidenceIds: [...item.evidenceIds], humanStatus: item.revisions.find((revision) => revision.source === 'HUMAN') ? legacyStatus(item.revisions.find((revision) => revision.source === 'HUMAN')!.verdict) : undefined, humanReason: item.revisions.find((revision) => revision.source === 'HUMAN')?.reason, judgeVersion: item.evalVersion, score: item.score, status: legacyStatus(item.verdict), reason: item.revisions[item.revisions.length - 1]?.reason }));
        const outcomeEvals: EvalResult[] = state.outcomeEvals.filter((item) => item.caseId === record.id).map((item) => ({ id: item.id, taskId: record.id, family: 'Result Eval', dimension: item.dimension, autoStatus: legacyStatus(item.revisions[0]?.verdict ?? item.verdict), autoReason: item.revisions[0]?.reason ?? '判定依据未记录', evidenceIds: [...item.evidenceIds], humanStatus: item.revisions.find((revision) => revision.source === 'HUMAN') ? legacyStatus(item.revisions.find((revision) => revision.source === 'HUMAN')!.verdict) : undefined, humanReason: item.revisions.find((revision) => revision.source === 'HUMAN')?.reason, judgeVersion: item.evalVersion, score: item.score, status: legacyStatus(item.verdict), reason: item.revisions[item.revisions.length - 1]?.reason }));
        task.evals = outcomeEvals;
        task.processEvals = processEvals;
        const skillForTrace = (trace?: EvolutionState['traces'][number]): SkillView => {
            const pkg = trace ? state.tracePackages.find(item => item.traceId === trace.id) : undefined;
            const id = pkg?.skillIds[0] ?? record.skillIds[0] ?? '未记录';
            const skill = state.skills.find(item => item.id === id);
            const recordedVersion = trace?.skillVersion ?? pkg?.skillVersion;
            return { id, name: skill?.name ?? id, version: recordedVersion ? normalizeSkillVersion(recordedVersion) : '版本未记录' };
        };
        const artifacts: ArtifactView[] = state.artifacts.filter((item) => item.caseId === record.id).map((item) => ({ id: item.id, name: item.name, type: item.kind, status: item.status, outcomeEvalIds: state.outcomeEvals.filter((evaluation) => evaluation.artifactId === item.id).map((evaluation) => evaluation.id), sourceObservationIds: observations.filter((observation) => observation.traceId === item.traceId && (observation.nodeType === 'Tool' || observation.nodeType === 'Artifact')).map((observation) => observation.id) }));
        const attributions = state.attributions.filter((item) => item.caseId === record.id);
        const issues = state.issues.filter((item) => item.caseId === record.id);
        const issueIds = issues.map((item) => item.id);
        const clusters = state.issueClusters.filter((item) => item.caseIds.includes(record.id) || item.issueIds.some((id) => issueIds.includes(id)));
        const variants = state.variants.filter((item) => item.sourceCaseIds.includes(record.id) || item.sourceIssueIds.some((id) => issueIds.includes(id)) || item.sourceClusterIds.some((id) => clusters.some((cluster) => cluster.id === id)));
        const experiments = state.experiments.filter((item) => item.variantIds.some((id) => variants.some((variant) => variant.id === id)));
        const releases = state.releases.filter((item) => item.variantIds.some((id) => variants.some((variant) => variant.id === id)));
        const packageRecord = state.tracePackages.find((item) => item.traceId === primaryTrace?.id);
        const packageRecords = Object.fromEntries(traces.map((trace) => {
            const pkg = state.tracePackages.find((item) => item.traceId === trace.id);
            const findings = pkg ? state.evaluationFindings.filter((finding) => pkg.findingIds.includes(finding.id)) : [];
            return [trace.id, { pkg, findings }];
        }));
        const packageStatuses = packageRecord?.moduleScores ?? [];
        const packageProcessSummary = packageRecord && packageRecord.status !== 'PENDING' && packageRecord.status !== 'FAILED'
            ? summarizeModuleStatuses(packageStatuses.filter((score) => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode)).map((score) => score.humanStatus ?? score.automaticStatus))
            : undefined;
        const packageOutcomeSummary = packageRecord && packageRecord.status !== 'PENDING' && packageRecord.status !== 'FAILED'
            ? summarizeModuleStatuses(packageStatuses.filter((score) => score.moduleCode === 'OUTCOME').map((score) => score.humanStatus ?? score.automaticStatus))
            : undefined;
        const packageFindings = packageRecord ? state.evaluationFindings.filter((finding) => packageRecord.findingIds.includes(finding.id)) : [];
        const tasteSignal = packageFindings.map((finding) => finding.preferenceSignalId).find(Boolean);
        const tastePreference = tasteSignal ? state.tastePreferenceSignals.find((signal) => signal.id === tasteSignal) : undefined;
        if (packageProcessSummary || packageOutcomeSummary) {
            task.status = packageOutcomeSummary === 'FAIL' ? 'Failed' : packageProcessSummary === 'FAIL' ? 'Effective but Inefficient' : 'Effective';
            task.isBadcase = packageOutcomeSummary === 'FAIL' || packageProcessSummary === 'FAIL';
            task.finalOutcome = packageOutcomeSummary === 'FAIL' ? '结果评测未通过' : packageProcessSummary === 'FAIL' ? '产物可用，但过程不符合业务预期' : '已完成演示任务并生成可追溯结果。';
        }
        const links: CaseReference[] = [
            ...issues.map((item) => ({ kind: 'issue' as const, id: item.id, label: item.title, status: item.status })),
            ...clusters.map((item) => ({ kind: 'issue-cluster' as const, id: item.id, label: item.name, status: item.status })),
            ...variants.map((item) => ({ kind: 'variant' as const, id: item.id, label: item.name, status: item.status })),
            ...experiments.map((item) => ({ kind: 'experiment' as const, id: item.id, label: item.name, status: item.status })),
            ...releases.map((item) => ({ kind: 'release' as const, id: item.id, label: item.version, status: item.status }))
        ];
        links.push(...state.gateDecisions.filter(gate => experiments.some(experiment => experiment.id === gate.experimentId)).map(gate => ({ kind: 'decision' as const, id: gate.id, label: '准出决策', status: gate.conclusion })));
        if (packageRecord) {
            packageRecord.findingIds.forEach(id => links.push({ kind: 'finding', id, label: '评测问题与分流', status: state.evaluationFindings.find(item => item.id === id)?.status }));
            packageRecord.routingDeliveryIds.forEach((id) => links.push({ kind: 'routing-delivery', id, label: `Routing Delivery ${id}`, status: '待处理' }));
            packageRecord.badcaseIds.forEach((id) => links.push({ kind: 'badcase', id, label: `算法 Badcase ${id}`, status: 'Candidate' }));
        }
        const session = state.sessions.find((item) => item.id === record.sessionId);
        const sourceInfo = resolveCaseSource(state, record);
        const evalByTrace = (evaluations: EvalResult[]) => Object.fromEntries(traces.map(trace => [trace.id, evaluations.filter(item => state.processEvals.some(original => original.id === item.id && original.traceId === trace.id) || state.outcomeEvals.some(original => original.id === item.id && original.traceId === trace.id))]));
        const sourceFields = { sourceRefId: sourceInfo.refId, sourceRefKind: sourceInfo.refId?.startsWith('window-') ? 'window' as const : 'dataset' as const, sourceRefVersion: sourceInfo.refVersion, discoveryMethod: observations.some(item => item.status === 'FAILED') ? '系统错误 / 自动评测' : record.feedback ? '用户反馈 / 自动评测' : '自动评测' };
        return {
            id: record.id, task, trace: primaryTrace ? { id: primaryTrace.id, taskId: record.id, sessionId: record.sessionId, startedAt: primaryTrace.startedAt, totalLatency: primaryTrace.totalLatencyMs, observations: observations.filter((item) => item.traceId === primaryTrace.id).map((item): Observation => ({ id: item.id, traceId: item.traceId, sequence: item.sequence, nodeType: item.nodeType === 'Reason' ? 'Planning / Decision' : item.nodeType === 'Act' ? 'Tool' : item.nodeType === 'Artifact' ? 'Final Outcome' : item.nodeType, status: item.status === 'FAILED' ? 'FAIL' : item.status === 'SKIPPED' ? 'N/A' : 'PASS', input: item.input, output: item.output, latency: item.latencyMs, tool: item.toolName, reason: item.output, error: item.status === 'FAILED' ? item.output : undefined, metadata: { logId: item.logId }, evidenceIds: [...item.evidenceIds] })) } : undefined, traces: traces.map((trace) => ({ id: trace.id, taskId: record.id, sessionId: record.sessionId, startedAt: trace.startedAt, totalLatency: trace.totalLatencyMs, observations: observations.filter((item) => item.traceId === trace.id).map((item): Observation => ({ id: item.id, traceId: item.traceId, sequence: item.sequence, nodeType: item.nodeType === 'Reason' ? 'Planning / Decision' : item.nodeType === 'Act' ? 'Tool' : item.nodeType === 'Artifact' ? 'Final Outcome' : item.nodeType, status: item.status === 'FAILED' ? 'FAIL' : item.status === 'SKIPPED' ? 'N/A' : 'PASS', input: item.input, output: item.output, latency: item.latencyMs, tool: item.toolName, reason: item.output, error: item.status === 'FAILED' ? item.output : undefined, metadata: { logId: item.logId }, evidenceIds: [...item.evidenceIds] })) })),
            session: { id: record.sessionId, turns: session?.turns.map((turn) => ({ id: turn.id, sequence: turn.sequence, role: turn.role === 'USER' ? 'user' : 'agent', content: turn.content, taskId: turn.caseId, traceId: turn.traceId, createdAt: turn.createdAt })) ?? [{ id: record.id + '-user', sequence: 1, role: 'user', content: record.query, taskId: record.id, traceId: primaryTrace?.id, createdAt: record.createdAt }, { id: record.id + '-agent', sequence: 2, role: 'agent', content: record.feedback ?? task.finalOutcome, taskId: record.id, traceId: primaryTrace?.id, createdAt: record.updatedAt }] },
            skill: skillForTrace(primaryTrace), skillsByTrace: Object.fromEntries(traces.map(trace => [trace.id, skillForTrace(trace)])), artifacts,
            logs: observations.map((item) => ({ id: item.logId, observationId: item.id, traceId: item.traceId, level: item.status === 'FAILED' ? 'ERROR' : 'INFO', message: item.output, timestamp: item.createdAt, metadata: { node: item.nodeType, ...(item.toolName ? { tool: item.toolName } : {}) } })),
            ...sourceFields, processEvalsByTrace: evalByTrace(processEvals), outcomeEvalsByTrace: evalByTrace(outcomeEvals), processEvals, outcomeEvals, processSummary: packageProcessSummary ?? legacyStatus(record.processStatus), outcomeSummary: packageOutcomeSummary ?? legacyStatus(record.resultStatus), userFeedback: record.feedback ?? '暂无明确用户反馈', failureObservation,
            evidenceIds: [...new Set([...attributions.flatMap((item) => item.evidenceIds), ...processEvals.flatMap((item) => item.evidenceIds), ...outcomeEvals.flatMap((item) => item.evidenceIds)])],
            attributionModule: attributions[0]?.module ?? '未归因', attributionDimension: evolutionItemLabel(attributions[0]?.dimension), routingTags: [...new Set(attributions.flatMap((item) => item.routingLabels))], multiScene: record.multiScenario,
            manualStatus: attributions.some((item) => item.confirmed) || record.status === 'CONFIRMED' ? '已人工确认' : '待人工确认',
            revisions: state.auditTrail.filter((event) => (event.entityType === 'Case' && event.entityId === record.id) || (event.entityType === 'Attribution' && attributions.some((item) => item.id === event.entityId))).map((event) => {
                const changes = event.changes ?? {};
                const attribution = event.entityType === 'Attribution' ? attributions.find((item) => item.id === event.entityId) : undefined;
                return {
                    id: event.id,
                    kind: event.entityType === 'Attribution' ? 'attribution' as const : 'confirmation' as const,
                    value: attribution ? `${attribution.module} / ${attribution.dimension}` : typeof changes.resultStatus === 'string' ? changes.resultStatus : record.resultStatus,
                    note: event.reason,
                    by: event.actor,
                    at: event.at
                };
            }), links, attributions: attributions.map((item) => ({ kind: 'issue' as const, id: item.id, label: `${item.module} · ${evolutionItemLabel(item.dimension)}`, status: item.status, module: item.module, dimension: evolutionItemLabel(item.dimension), routingTags: [...item.routingLabels] })), moduleEvaluations: packageRecord?.moduleScores as unknown as Array<Record<string, unknown>>, moduleEvaluationsByTrace: Object.fromEntries(Object.entries(packageRecords).map(([traceId, value]) => [traceId, value.pkg?.moduleScores as unknown as Array<Record<string, unknown>> ?? []])), sourceLabel: resolveCaseSource(state, record).label, channel: primaryTrace?.channel, verticalScenario: primaryTrace?.verticalScenario, processFinalScore: packageRecord?.rating?.processFinal, outcomeFinalScore: packageRecord?.rating?.outcomeFinal, tokens: primaryTrace ? primaryTrace.inputTokens + primaryTrace.outputTokens : 0, latencyMs: primaryTrace?.totalLatencyMs, provenanceLabels: [...new Set([resolveCaseSource(state, record).label, ...state.datasets.filter(dataset => dataset.caseIds.includes(record.id)).map(dataset => dataset.name)])], deliveryUri: artifacts[0]?.id ? `mock://artifacts/${artifacts[0].id}` : undefined, evaluationScenarios: packageFindings.map((finding) => ({ label: finding.scenarioLabel ?? '模块评测 Agent 返回场景', dimension: evolutionItemLabel(finding.dimensionLabel), path: finding.optimizationPath ?? '待配置', findingId: finding.id })), evaluationScenariosByTrace: Object.fromEntries(Object.entries(packageRecords).map(([traceId, value]) => [traceId, value.findings.map((finding) => ({ label: finding.scenarioLabel ?? '模块评测 Agent 返回场景', dimension: evolutionItemLabel(finding.dimensionLabel), path: finding.optimizationPath ?? '待配置', findingId: finding.id }))])), tastePreference: tastePreference ? { populationTotal: tastePreference.populationTotal, preferenceCount: tastePreference.preferenceCount, preferenceValue: tastePreference.preferenceValue, preferenceRate: tastePreference.preferenceRate, relatedDataCount: tastePreference.relatedDataCount, relatedDataThreshold: tastePreference.relatedDataThreshold, judgeReason: tastePreference.judgeReason, routingLabel: tastePreference.routingLabel, optimizationPath: tastePreference.optimizationPath } : undefined
        };
    });
    const queryTimes = state.cases.map(record => Date.parse(record.createdAt)).filter(Number.isFinite);
    const referenceTime = queryTimes.length ? new Date(Math.max(...queryTimes)).toISOString() : state.updatedAt;
    return { cases, rootEvidence: state.evidence, evidence: state.evidence.map((item) => ({ id: item.id, observationId: item.observationId, type: item.kind === 'ERROR' ? 'Error' : item.kind === 'ARTIFACT' ? 'Artifact' : item.kind === 'USER_FEEDBACK' ? 'User Feedback' : item.kind === 'INPUT' ? 'Input' : 'Output', summary: item.content, source: item.source })), referenceTime };
}
const includes = (value: string | undefined, query: string | undefined) => !query?.trim() || (value ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
function matchesFinalScore(score: number | undefined, filter: string, legacyStatus?: JudgeStatus): boolean {
    if (!filter)
        return true;
    if (['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A'].includes(filter))
        return legacyStatus === filter;
    if (score === undefined)
        return false;
    const [minText, maxText] = filter.split('-');
    const min = Number(minText);
    const max = Number(maxText);
    if (!Number.isFinite(min) || !Number.isFinite(max))
        return false;
    return score >= min && score <= max;
}
export function filterCaseAnalysisRecords(records: CaseAnalysisRecord[], filters: CaseAnalysisFilters, referenceTime: string): CaseAnalysisRecord[] {
    const days = filters.timeRange === '24h' ? 1 : filters.timeRange === '7d' ? 7 : filters.timeRange === '14d' ? 14 : filters.timeRange === '30d' ? 30 : undefined;
    const cutoff = days ? Date.parse(referenceTime) - days * 86400000 : Number.NEGATIVE_INFINITY;
    return records.filter((record) => {
        const queryMatches = !filters.query?.trim() || [record.id, record.task.query, record.session.id, record.task.id, record.skill.id, ...record.traces?.map((trace) => trace.id) ?? [], ...record.logs.map((log) => log.id)].some((value) => includes(value, filters.query));
        const traceMatches = !filters.traceId?.trim() || (record.traces ?? (record.trace ? [record.trace] : [])).some((trace) => includes(trace.id, filters.traceId));
        if (!queryMatches || !includes(record.session.id, filters.sessionId) || !traceMatches || !includes(record.skill.id, filters.skillId) || !includes(record.skill.version, filters.skillVersion))
            return false;
        if (Date.parse(record.task.timestamp) < cutoff)
            return false;
        if (filters.processEval && !matchesFinalScore(record.processFinalScore, filters.processEval, record.processSummary))
            return false;
        if (filters.outcomeEval && !matchesFinalScore(record.outcomeFinalScore, filters.outcomeEval, record.outcomeSummary))
            return false;
        if (filters.logId && !record.logs.some((log) => includes(log.id, filters.logId)))
            return false;
        if (filters.routingTags?.length && !filters.routingTags.every((tag) => record.routingTags.includes(tag)))
            return false;
        if (filters.multiScene === 'yes' && !record.multiScene)
            return false;
        if (filters.multiScene === 'no' && record.multiScene)
            return false;
        if (filters.channel && record.channel !== filters.channel) return false;
        if (filters.verticalScenario && record.verticalScenario !== filters.verticalScenario) return false;
        if (filters.evolutionItem && !record.evaluationScenarios?.some(item => item.dimension === filters.evolutionItem || item.dimension.includes(filters.evolutionItem!))) return false;
        if (filters.processMin !== undefined && (record.processFinalScore === undefined || record.processFinalScore < filters.processMin)) return false;
        if (filters.processMax !== undefined && (record.processFinalScore === undefined || record.processFinalScore > filters.processMax)) return false;
        if (filters.outcomeMin !== undefined && (record.outcomeFinalScore === undefined || record.outcomeFinalScore < filters.outcomeMin)) return false;
        if (filters.outcomeMax !== undefined && (record.outcomeFinalScore === undefined || record.outcomeFinalScore > filters.outcomeMax)) return false;
        if (filters.tokenMin !== undefined && (record.tokens ?? 0) < filters.tokenMin) return false;
        if (filters.tokenMax !== undefined && (record.tokens ?? 0) > filters.tokenMax) return false;
        if (filters.latencyMin !== undefined && (record.latencyMs ?? 0) < filters.latencyMin) return false;
        if (filters.latencyMax !== undefined && (record.latencyMs ?? 0) > filters.latencyMax) return false;
        return true;
    });
}
