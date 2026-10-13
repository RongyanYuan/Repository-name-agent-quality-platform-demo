import type {
  Artifact, Asset, Attribution, AttributionRevision, Case, Dataset, EvaluationRevision, EvolutionState, Experiment, ExperimentMetric,
  ExperimentRun, GateDecision, Issue, IssueCluster, ObservationLog, OutcomeEval, ProcessEval, ReleaseVersion,
  RuleConfig, Session, Skill, Trace, Variant, Window, AlgorithmBadcaseItem, BadcaseQueue, EvaluationBatch,
  EvaluationFinding, EvaluationJob, EvaluationEvidenceBundle, ModuleEvaluationScore, RoutingDecision, RoutingDelivery,
  RoutingPolicy, SkillCategory, TraceEvaluationModuleCode, TraceEvaluationPackage, V2RoutingLabel, EvaluationBatchStatus,
  EvaluationJobStatus, ModuleEvaluationStatus, RoutingDestination, RoutingDeliveryStatus, EvaluationCoverageStatus, SkillEvolutionHistoryEntry, TraceRating
  ,TastePreferenceSignal
} from './domain'
import { ATTRIBUTION_TAXONOMY_VERSION, TRACE_MODULE_LABELS } from './domain'
import { addScenarioFixtures } from './data/scenarioFixtures'
import { addSkillWorkspaceFixtures } from './data/skillWorkspaceFixtures'
import { evolutionItemId } from './taxonomy'
import { canonicalizeSeedIdentityState } from './identity'
import { enrichArtifactOutcomeFixtures } from './data/artifactOutcomeFixtures'
import { enrichGovernanceGraphFixtures } from './data/governanceGraphFixtures'
import { enrichTraceGovernanceFixtures } from './data/traceGovernanceFixtures'
import { enrichModuleEvolutionFixtures } from './data/moduleEvolutionFixtures'
import { enrichDatasetFilterFixtures } from './data/datasetFilterFixtures'
import { enrichAssetManagementFixtures } from './data/assetManagement'
import { enrichOverviewDashboardFixtures } from './data/overviewDashboardFixtures'

export const EVOLUTION_SEED_VERSION = 'office-agent-governance-demo-2.7.4'
export const EVOLUTION_SCHEMA_VERSION = 2
const T0 = '2026-09-20T02:00:00.000Z'
const T1 = '2026-09-21T04:00:00.000Z'
const T2 = '2026-09-22T06:00:00.000Z'
const T3 = '2026-09-23T08:00:00.000Z'
const T4 = '2026-09-24T10:00:00.000Z'
const T5 = '2026-09-25T12:00:00.000Z'
const T6 = '2026-09-26T14:00:00.000Z'
const stamp = <T extends { id: string }>(value: T, createdAt = T0, updatedAt = createdAt): T & { createdAt: string; updatedAt: string } => ({ ...value, createdAt, updatedAt })
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const rev = (id: string, source: EvaluationRevision['source'], verdict: EvaluationRevision['verdict'], score: number, reason: string, evidenceIds: string[], evaluatedAt: string, evaluator: string, supersedesRevisionId?: string): EvaluationRevision => ({
  id, source, verdict, score, reason, evidenceIds, evaluatedAt, evaluator, supersedesRevisionId
})
const attrRev = (id: string, source: AttributionRevision['source'], module: AttributionRevision['module'], dimension: string, evidenceIds: string[], routingLabels: AttributionRevision['routingLabels'], optimizationMode: AttributionRevision['optimizationMode'], confidence: number, reason: string, revisedAt: string, revisedBy: string, supersedesRevisionId?: string): AttributionRevision => ({
  id, source, module, dimension, evidenceIds, routingLabels, optimizationMode, confidence, reason, revisedAt, revisedBy, supersedesRevisionId, confirmed: source === 'HUMAN', status: source === 'HUMAN' ? 'CONFIRMED' : 'PENDING'
})

const sessions: Session[] = [
  stamp({ id: 'session-ppt-management', title: '季度经营汇报', userId: 'user-demo-a', caseIds: ['case-ppt-management'], traceIds: ['trace-ppt-context', 'trace-ppt-generate'], turns: [
    { id: 'turn-ppt-1', sequence: 1, role: 'USER', content: '使用刚才上传的销售 Excel。', caseId: 'case-ppt-management', traceId: 'trace-ppt-context', createdAt: T0 },
    { id: 'turn-ppt-2', sequence: 2, role: 'AGENT', content: '已找到销售数据，将继续生成汇报。', caseId: 'case-ppt-management', traceId: 'trace-ppt-context', createdAt: '2026-09-20T02:00:05.000Z' },
    { id: 'turn-ppt-3', sequence: 3, role: 'USER', content: '改成面向管理层的季度经营 PPT。', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', createdAt: '2026-09-20T02:01:00.000Z' },
    { id: 'turn-ppt-4', sequence: 4, role: 'AGENT', content: '已生成 12 页管理层经营汇报。', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', createdAt: '2026-09-20T02:02:05.000Z' }
  ] }),
  stamp({ id: 'session-tool-export', title: 'Excel 导出修复', userId: 'user-demo-b', caseIds: ['case-tool-export'], traceIds: ['trace-tool-export'], turns: [
    { id: 'turn-tool-1', sequence: 1, role: 'USER', content: '导出筛选后的预算明细为 Excel。', caseId: 'case-tool-export', traceId: 'trace-tool-export', createdAt: T1 },
    { id: 'turn-tool-2', sequence: 2, role: 'AGENT', content: '导出失败：格式枚举不受支持。', caseId: 'case-tool-export', traceId: 'trace-tool-export', createdAt: '2026-09-21T04:00:08.000Z' }
  ] }, T1),
  stamp({ id: 'session-multi-route', title: '续写预算分析并生成汇报', userId: 'user-demo-c', caseIds: ['case-multi-route'], traceIds: ['trace-multi-route'], turns: [
    { id: 'turn-multi-1', sequence: 1, role: 'USER', content: '沿用上轮预算表，补充风险分析并做成管理层 PPT。', caseId: 'case-multi-route', traceId: 'trace-multi-route', createdAt: T2 },
    { id: 'turn-multi-2', sequence: 2, role: 'AGENT', content: '已生成风险分析汇报，但引用了旧版预算。', caseId: 'case-multi-route', traceId: 'trace-multi-route', createdAt: '2026-09-22T06:01:12.000Z' }
  ] }, T2)
]

const cases: Case[] = [
  stamp({ id: 'case-ppt-management', sessionId: 'session-ppt-management', title: '管理层经营 PPT 生成失败', query: '根据刚才的销售 Excel 生成一份面向管理层的季度经营 PPT。', scenario: 'PPT', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-ppt-builder'], traceIds: ['trace-ppt-context', 'trace-ppt-generate'], artifactIds: ['artifact-ppt-management'], processEvalIds: ['process-eval-ppt-recall'], outcomeEvalIds: ['outcome-eval-ppt-style'], attributionIds: ['attribution-skill-recall', 'attribution-style-mismatch'], issueIds: ['issue-skill-recall', 'issue-style-mismatch'], status: 'RESOLVED', resultStatus: 'FAIL', processStatus: 'FAIL', feedback: '用户拒绝当前产物，要求改为结论先行。', acceptanceStatus: 'REJECTED', owner: 'PPT 团队', labels: ['管理层汇报', '多轮任务'], multiScenario: true }),
  stamp({ id: 'case-tool-export', sessionId: 'session-tool-export', title: 'Excel 导出工具确定性失败', query: '导出筛选后的预算明细为 Excel。', scenario: 'Excel', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-spreadsheet'], traceIds: ['trace-tool-export'], artifactIds: [], processEvalIds: ['process-eval-tool-export'], outcomeEvalIds: ['outcome-eval-missing-file'], attributionIds: ['attribution-tool-export'], issueIds: ['issue-tool-export'], status: 'RESOLVED', resultStatus: 'FAIL', processStatus: 'FAIL', feedback: '导出失败，用户未接受结果。', acceptanceStatus: 'REJECTED', owner: 'Tool 团队', labels: ['确定性 Bug', '直接修复'], multiScenario: false }, T1, T5),
  stamp({ id: 'case-multi-route', sessionId: 'session-multi-route', title: '多归因、多路分发 Case', query: '沿用上轮预算表，补充风险分析并做成管理层 PPT。', scenario: '跨 Office', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-spreadsheet', 'skill-ppt-builder'], traceIds: ['trace-multi-route'], artifactIds: ['artifact-multi-ppt'], processEvalIds: ['process-eval-memory', 'process-eval-reason'], outcomeEvalIds: ['outcome-eval-multi'], attributionIds: ['attribution-memory-context', 'attribution-reason-tool'], issueIds: ['issue-memory-context', 'issue-reason-tool'], status: 'IN_PROGRESS', resultStatus: 'FAIL', processStatus: 'FAIL', feedback: '用户仍在补充需求，尚无标准化接受事件。', acceptanceStatus: 'UNKNOWN', owner: 'General Agent', labels: ['多归因', '多路分发'], multiScenario: true }, T2, T6)
]

const traces: Trace[] = [
  stamp({ id: 'trace-ppt-context', sessionId: 'session-ppt-management', caseId: 'case-ppt-management', sequence: 1, startedAt: T0, endedAt: '2026-09-20T02:00:05.000Z', observationIds: ['obs-ppt-memory'], artifactIds: [], status: 'PARTIAL', totalLatencyMs: 5000, inputTokens: 1840, outputTokens: 260, telemetry: { totalLatencyMs: 5000, ttftMs: 420, inputTokens: 1840, outputTokens: 260, cacheHitCount: 1, cacheRequestCount: 2, modelCallCount: 1, toolCallCount: 0, toolOneShotSuccessCount: 0, toolExecutionCount: 0, loopCount: 0, retryCount: 0, riskInterception: { blocked: false, reason: '未触发风控' }, commercialInterception: { blocked: false, reason: '未触发商业化拦截' } } }),
  stamp({ id: 'trace-ppt-generate', sessionId: 'session-ppt-management', caseId: 'case-ppt-management', sequence: 2, startedAt: '2026-09-20T02:01:00.000Z', endedAt: '2026-09-20T02:02:05.000Z', observationIds: ['obs-ppt-skill', 'obs-ppt-artifact'], artifactIds: ['artifact-ppt-management'], status: 'SUCCEEDED', totalLatencyMs: 65000, inputTokens: 4220, outputTokens: 1190, telemetry: { totalLatencyMs: 65000, ttftMs: 930, inputTokens: 4220, outputTokens: 1190, cacheHitCount: 2, cacheRequestCount: 4, modelCallCount: 3, toolCallCount: 1, toolOneShotSuccessCount: 1, toolExecutionCount: 1, loopCount: 0, retryCount: 0, riskInterception: { blocked: false, reason: '未触发风控' }, commercialInterception: { blocked: false, reason: '未触发商业化拦截' } } }),
  stamp({ id: 'trace-tool-export', sessionId: 'session-tool-export', caseId: 'case-tool-export', sequence: 1, startedAt: T1, endedAt: '2026-09-21T04:00:08.000Z', observationIds: ['obs-tool-call'], artifactIds: [], status: 'FAILED', totalLatencyMs: 8000, inputTokens: 1120, outputTokens: 80, telemetry: { totalLatencyMs: 8000, ttftMs: 310, inputTokens: 1120, outputTokens: 80, cacheHitCount: 0, cacheRequestCount: 1, modelCallCount: 1, toolCallCount: 1, toolOneShotSuccessCount: 0, toolExecutionCount: 1, loopCount: 0, retryCount: 0, riskInterception: { blocked: false, reason: '未触发风控' }, commercialInterception: { blocked: true, reason: '权益校验超时后拒绝导出', category: '权益不足' } } }, T1),
  stamp({ id: 'trace-multi-route', sessionId: 'session-multi-route', caseId: 'case-multi-route', sequence: 1, startedAt: T2, endedAt: '2026-09-22T06:01:12.000Z', observationIds: ['obs-memory-miss', 'obs-reason-tool', 'obs-multi-artifact'], artifactIds: ['artifact-multi-ppt'], status: 'PARTIAL', totalLatencyMs: 72000, inputTokens: 5980, outputTokens: 1340, telemetry: { totalLatencyMs: 72000, ttftMs: 1220, inputTokens: 5980, outputTokens: 1340, cacheHitCount: 1, cacheRequestCount: 5, modelCallCount: 4, toolCallCount: 1, toolOneShotSuccessCount: 0, toolExecutionCount: 1, loopCount: 1, retryCount: 1, riskInterception: { blocked: true, reason: '预算数据包含敏感字段，已脱敏后继续', category: '敏感数据' }, commercialInterception: { blocked: false, reason: '未触发商业化拦截' } } }, T2)
]

const observations: ObservationLog[] = [
  stamp({ id: 'obs-ppt-memory', traceId: 'trace-ppt-context', caseId: 'case-ppt-management', sequence: 1, nodeType: 'Memory', name: '上下文产物检索', input: '检索上一轮销售 Excel', output: '找到 artifact-sales.xlsx，但未传递到 Skill 路由特征', status: 'SUCCEEDED', latencyMs: 980, retryCount: 0, evidenceIds: ['evidence-ppt-recall'], logId: 'log-ppt-memory' }),
  stamp({ id: 'obs-ppt-skill', traceId: 'trace-ppt-generate', caseId: 'case-ppt-management', sequence: 1, nodeType: 'Skill', name: 'Skill 路由', input: '生成管理层经营 PPT', output: '选择通用 ppt-builder，未召回 executive-report SOP', status: 'FAILED', skillId: 'skill-ppt-builder', latencyMs: 1260, retryCount: 0, evidenceIds: ['evidence-ppt-recall'], logId: 'log-ppt-skill' }),
  stamp({ id: 'obs-ppt-artifact', traceId: 'trace-ppt-generate', caseId: 'case-ppt-management', sequence: 2, nodeType: 'Artifact', name: 'PPT 渲染', input: '通用汇报结构', output: '已生成 12 页 PPT', status: 'SUCCEEDED', skillId: 'skill-ppt-builder', toolName: 'slides.render', latencyMs: 58000, retryCount: 0, evidenceIds: ['evidence-ppt-style'], logId: 'log-ppt-render' }),
  stamp({ id: 'obs-tool-call', traceId: 'trace-tool-export', caseId: 'case-tool-export', sequence: 1, nodeType: 'Tool', name: 'Excel 导出', input: '{sheetRange:"A1:F120", format:"xlsx"}', output: 'Invalid enum value: xlsx', status: 'FAILED', skillId: 'skill-spreadsheet', toolName: 'sheets.export', latencyMs: 420, retryCount: 0, evidenceIds: ['evidence-tool-error'], logId: 'log-tool-export' }, T1),
  stamp({ id: 'obs-memory-miss', traceId: 'trace-multi-route', caseId: 'case-multi-route', sequence: 1, nodeType: 'Memory', name: '跨轮表格召回', input: '上轮预算表', output: '召回旧版本预算表', status: 'FAILED', latencyMs: 1040, retryCount: 0, evidenceIds: ['evidence-memory-miss'], logId: 'log-memory-miss' }, T2),
  stamp({ id: 'obs-reason-tool', traceId: 'trace-multi-route', caseId: 'case-multi-route', sequence: 2, nodeType: 'Reason', name: '分析路径规划', input: '补充风险并生成 PPT', output: '跳过预算差异分析，直接渲染', status: 'FAILED', latencyMs: 2200, retryCount: 0, evidenceIds: ['evidence-reason-plan'], logId: 'log-reason-plan' }, T2),
  stamp({ id: 'obs-multi-artifact', traceId: 'trace-multi-route', caseId: 'case-multi-route', sequence: 3, nodeType: 'Artifact', name: 'PPT 渲染', input: '过期预算数据', output: '已生成，但风险页缺少差异依据', status: 'SUCCEEDED', toolName: 'slides.render', latencyMs: 59000, retryCount: 1, evidenceIds: ['evidence-multi-result'], logId: 'log-multi-render' }, T2)
]

const evidence = [
  stamp({ id: 'evidence-ppt-recall', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-skill', kind: 'LOG' as const, title: 'Skill 路由日志', content: '候选 executive-report 得分 0.41，低于通用 ppt-builder 0.63。', source: 'Mock Trace / Langfuse 接口占位' }),
  stamp({ id: 'evidence-ppt-style', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-artifact', artifactId: 'artifact-ppt-management', kind: 'ARTIFACT' as const, title: '产物风格证据', content: '12 页中 8 页使用正文密排，未采用管理层决策摘要布局。', source: 'Mock Eval Agent 接口占位' }),
  stamp({ id: 'evidence-tool-error', caseId: 'case-tool-export', traceId: 'trace-tool-export', observationId: 'obs-tool-call', kind: 'ERROR' as const, title: '导出参数错误', content: '工具只接受 EXCEL_WORKBOOK，Skill 固定传入 xlsx。', source: 'Mock Tool Log 接口占位' }, T1),
  stamp({ id: 'evidence-memory-miss', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-memory-miss', kind: 'LOG' as const, title: '召回版本错误', content: '命中 budget-v2，Session 最新为 budget-v4。', source: 'Mock Memory Trace 接口占位' }, T2),
  stamp({ id: 'evidence-reason-plan', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-reason-tool', kind: 'OUTPUT' as const, title: '规划缺少步骤', content: '计划未包含 Excel 差异计算与来源校验。', source: 'Mock Reason Trace 接口占位' }, T2),
  stamp({ id: 'evidence-multi-result', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-multi-artifact', artifactId: 'artifact-multi-ppt', kind: 'ARTIFACT' as const, title: '风险页缺少依据', content: '三项风险均未引用预算差异数值。', source: 'Mock Outcome Eval 接口占位' }, T2)
]

const artifacts: Artifact[] = [
  stamp({ id: 'artifact-ppt-management', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', name: 'Q3-经营复盘-管理层.pptx', kind: 'PPT', uri: 'mock://artifacts/q3-management.pptx', version: 'v1', status: 'AVAILABLE', evidenceIds: ['evidence-ppt-style'] }),
  stamp({ id: 'artifact-missing-export', caseId: 'case-tool-export', traceId: 'trace-tool-export', name: '预算明细导出.xlsx', kind: 'Excel', uri: 'mock://artifacts/missing-budget-export.xlsx', version: 'v1', status: 'MISSING', evidenceIds: ['evidence-tool-error'] }, T1),
  stamp({ id: 'artifact-multi-ppt', caseId: 'case-multi-route', traceId: 'trace-multi-route', name: '预算风险分析.pptx', kind: 'PPT', uri: 'mock://artifacts/budget-risk.pptx', version: 'v1', status: 'AVAILABLE', evidenceIds: ['evidence-multi-result'] }, T2)
]

const processEvals: ProcessEval[] = [
  stamp({ id: 'process-eval-ppt-recall', type: 'PROCESS', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-skill', failedNodeId: 'obs-ppt-skill', dimension: 'Skill 召回准确率', evalVersion: 'process-eval-2.1', verdict: 'FAIL', score: 0.42, evidenceIds: ['evidence-ppt-recall'], revisions: [rev('rev-ppt-process-auto', 'AUTOMATIC', 'FAIL', 0.42, '未召回管理层汇报 SOP。', ['evidence-ppt-recall'], T1, 'Eval Agent')] }),
  stamp({ id: 'process-eval-tool-export', type: 'PROCESS', caseId: 'case-tool-export', traceId: 'trace-tool-export', observationId: 'obs-tool-call', failedNodeId: 'obs-tool-call', dimension: 'Tool 一次执行成功率', evalVersion: 'process-eval-2.1', verdict: 'FAIL', score: 0, evidenceIds: ['evidence-tool-error'], revisions: [rev('rev-tool-process-auto', 'AUTOMATIC', 'FAIL', 0, '确定性参数枚举错误。', ['evidence-tool-error'], T2, 'Rule Eval')] }, T1),
  stamp({ id: 'process-eval-memory', type: 'PROCESS', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-memory-miss', failedNodeId: 'obs-memory-miss', dimension: 'Memory 准确率', evalVersion: 'process-eval-2.1', verdict: 'FAIL', score: 0.31, evidenceIds: ['evidence-memory-miss'], revisions: [rev('rev-memory-auto', 'AUTOMATIC', 'FAIL', 0.31, '召回了旧版本资产。', ['evidence-memory-miss'], T3, 'Eval Agent')] }, T2),
  stamp({ id: 'process-eval-reason', type: 'PROCESS', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-reason-tool', failedNodeId: 'obs-reason-tool', dimension: 'Reason 路径完整性', evalVersion: 'process-eval-2.1', verdict: 'FAIL', score: 0.38, evidenceIds: ['evidence-reason-plan'], revisions: [rev('rev-reason-auto', 'AUTOMATIC', 'FAIL', 0.38, '规划跳过数据计算。', ['evidence-reason-plan'], T3, 'Eval Agent')] }, T2)
]

const outcomeEvals: OutcomeEval[] = [
  stamp({ id: 'outcome-eval-ppt-style', type: 'OUTCOME', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', artifactId: 'artifact-ppt-management', dimension: '管理层风格匹配', evalVersion: 'outcome-eval-3.0', verdict: 'FAIL', score: 0.48, evidenceIds: ['evidence-ppt-style'], revisions: [
    rev('rev-ppt-style-auto', 'AUTOMATIC', 'FAIL', 0.48, '页面密度与管理层模板差异显著。', ['evidence-ppt-style'], T1, 'Outcome Eval Agent'),
    rev('rev-ppt-style-human', 'HUMAN', 'FAIL', 0.44, '人工确认：缺少结论先行与决策项。', ['evidence-ppt-style'], T2, '李审核', 'rev-ppt-style-auto')
  ] }),
  stamp({ id: 'outcome-eval-missing-file', type: 'OUTCOME', caseId: 'case-tool-export', traceId: 'trace-tool-export', artifactId: 'artifact-missing-export', dimension: '文件可用性', evalVersion: 'outcome-eval-3.0', verdict: 'FAIL', score: 0, evidenceIds: ['evidence-tool-error'], revisions: [rev('rev-missing-auto', 'AUTOMATIC', 'FAIL', 0, '导出失败，无可用文件。', ['evidence-tool-error'], T2, 'Rule Eval')] }, T1),
  stamp({ id: 'outcome-eval-multi', type: 'OUTCOME', caseId: 'case-multi-route', traceId: 'trace-multi-route', artifactId: 'artifact-multi-ppt', dimension: '依据可追溯性', evalVersion: 'outcome-eval-3.0', verdict: 'FAIL', score: 0.36, evidenceIds: ['evidence-multi-result'], revisions: [rev('rev-multi-auto', 'AUTOMATIC', 'FAIL', 0.36, '风险结论缺少数值依据。', ['evidence-multi-result'], T3, 'Outcome Eval Agent')] }, T2)
]

const attributions: Attribution[] = [
  stamp({ id: 'attribution-skill-recall', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-skill', module: 'Skill', dimension: 'skill sop错误', evidenceIds: ['evidence-ppt-recall'], confidence: 0.94, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [
    attrRev('attr-rev-skill-auto', 'AUTOMATIC', 'Skill', 'skill sop错误', ['evidence-ppt-recall'], ['Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.78, '自动归因到 Skill SOP 召回。', T1, 'Attribution Agent'),
    attrRev('attr-rev-skill-human', 'HUMAN', 'Skill', 'skill sop错误', ['evidence-ppt-recall'], ['Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.94, '人工确认管理层 SOP 召回不足。', T2, '李审核', 'attr-rev-skill-auto')
  ] }, T2),
  stamp({ id: 'attribution-style-mismatch', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-artifact', module: 'Skill', dimension: '品味库召回错误', evidenceIds: ['evidence-ppt-style'], confidence: 0.89, source: 'HUMAN', confirmed: true, routingLabels: ['策略迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [attrRev('attr-rev-style-human', 'HUMAN', 'Skill', '品味库召回错误', ['evidence-ppt-style'], ['策略迭代'], 'CLUSTER_OPTIMIZATION', 0.89, '人工确认管理层风格资产召回错误。', T2, '李审核')] }, T2),
  stamp({ id: 'attribution-tool-export', caseId: 'case-tool-export', traceId: 'trace-tool-export', observationId: 'obs-tool-call', module: 'Act', dimension: '工具未执行成功', evidenceIds: ['evidence-tool-error'], confidence: 1, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代'], optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', revisions: [attrRev('attr-rev-tool-human', 'HUMAN', 'Act', '工具未执行成功', ['evidence-tool-error'], ['Agent 迭代'], 'DIRECT_FIX', 1, '确定性工具参数错误。', T2, 'Tool Owner')] }, T2),
  stamp({ id: 'attribution-memory-context', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-memory-miss', module: 'Memory', dimension: '准确率低', evidenceIds: ['evidence-memory-miss'], confidence: 0.91, source: 'HUMAN', confirmed: true, routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [attrRev('attr-rev-memory-human', 'HUMAN', 'Memory', '准确率低', ['evidence-memory-miss'], ['策略迭代', 'Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.91, '召回旧版本资产。', T3, '质量运营')] }, T3),
  stamp({ id: 'attribution-reason-tool', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-reason-tool', module: 'Reason', dimension: '没有做出最正确/高效的选择', evidenceIds: ['evidence-reason-plan'], confidence: 0.86, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代', '策略迭代'], optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', revisions: [attrRev('attr-rev-reason-human', 'HUMAN', 'Reason', '没有做出最正确/高效的选择', ['evidence-reason-plan'], ['Agent 迭代', '策略迭代'], 'DIRECT_FIX', 0.86, '规划跳过数据分析步骤。', T3, '质量运营')] }, T3)
]

attributions.forEach((attribution) => {
  attribution.moduleCode = attribution.module.toUpperCase()
  attribution.dimensionCode = attribution.dimension.replace(/[^\p{Letter}\p{Number}]+/gu, '_').toUpperCase()
  attribution.dimensionLabel = attribution.dimension
  attribution.labelSnapshot = attribution.dimension
  attribution.taxonomyVersion = ATTRIBUTION_TAXONOMY_VERSION
  attribution.description = `按 ${attribution.module} / ${attribution.dimension} 的 PRD 归因快照。`
})

const issues: Issue[] = [
  stamp({ id: 'issue-skill-recall', caseId: 'case-ppt-management', attributionId: 'attribution-skill-recall', title: '管理层 PPT SOP 召回不足', description: '管理层请求未稳定召回对应 SOP。', module: 'Skill', dimension: 'skill sop错误', evidenceIds: ['evidence-ppt-recall'], routingLabels: ['Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'VERIFIED', owner: 'PPT Skill 团队', status: 'VERIFIED', clusterIds: ['cluster-ppt-routing-ready'], variantIds: ['variant-ppt-routing-v3'], processingChains: [{ id: 'chain-skill-agent', routingLabel: 'Agent 迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-ppt-routing-ready', status: 'VERIFIED', note: '路由问题进入达标问题簇并完成验证。' }] }, T2, T6),
  stamp({ id: 'issue-style-mismatch', caseId: 'case-ppt-management', attributionId: 'attribution-style-mismatch', title: '管理层风格匹配不足', description: '内容正确但管理层风格不匹配。', module: 'Skill', dimension: '品味库召回错误', evidenceIds: ['evidence-ppt-style'], routingLabels: ['策略迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'ASSIGNED', owner: 'PPT 设计团队', status: 'CONFIRMED', clusterIds: ['cluster-ppt-taste-pending'], variantIds: [], processingChains: [{ id: 'chain-style-strategy', routingLabel: '策略迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-ppt-taste-pending', status: 'IN_PROGRESS', note: '品味库相关 Case 仍在积累，未达到 100 条。' }] }, T2, T6),
  stamp({ id: 'issue-tool-export', caseId: 'case-tool-export', attributionId: 'attribution-tool-export', title: 'Excel 导出枚举写死', description: 'Skill 传入工具不支持的格式枚举。', module: 'Act', dimension: '工具未执行成功', evidenceIds: ['evidence-tool-error'], routingLabels: ['Agent 迭代'], optimizationMode: 'DIRECT_FIX', responsibilityStatus: 'VERIFIED', owner: 'Tool 团队', status: 'VERIFIED', clusterIds: [], variantIds: ['variant-tool-retry-v2'], processingChains: [{ id: 'chain-tool-agent', routingLabel: 'Agent 迭代', destinationType: 'DIRECT_FIX', destinationId: 'variant-tool-retry-v2', status: 'VERIFIED', note: '确定性 Bug 直接修复并完成单变体验证。' }] }, T2, T5),
  stamp({ id: 'issue-memory-context', caseId: 'case-multi-route', attributionId: 'attribution-memory-context', title: '跨轮资产版本召回错误', description: '同一 Session 内未优先最新确认产物。', module: 'Memory', dimension: '准确率低', evidenceIds: ['evidence-memory-miss'], routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'ASSIGNED', owner: 'Memory 团队', status: 'FIXING', clusterIds: ['cluster-memory-version'], variantIds: ['variant-memory-latest'], processingChains: [{ id: 'chain-memory-strategy', routingLabel: '策略迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-memory-version', status: 'IN_PROGRESS', note: '进入跨轮召回问题簇。' }, { id: 'chain-memory-agent', routingLabel: 'Agent 迭代', destinationType: 'AGENT_BACKLOG', destinationId: 'variant-memory-latest', status: 'IN_PROGRESS', note: '形成 Memory 候选变体。' }] }, T3, T6),
  stamp({ id: 'issue-reason-tool', caseId: 'case-multi-route', attributionId: 'attribution-reason-tool', title: '跨 Office 任务跳过数据分析', description: '规划未强制先计算再生成汇报。', module: 'Reason', dimension: '没有做出最正确/高效的选择', evidenceIds: ['evidence-reason-plan'], routingLabels: ['Agent 迭代', '策略迭代'], optimizationMode: 'DIRECT_FIX', responsibilityStatus: 'ASSIGNED', owner: 'Reason 团队', status: 'FIXING', clusterIds: [], variantIds: ['variant-reason-office-plan'], processingChains: [{ id: 'chain-reason-agent', routingLabel: 'Agent 迭代', destinationType: 'DIRECT_FIX', destinationId: 'variant-reason-office-plan', status: 'IN_PROGRESS', note: '直接形成规划策略修复。' }, { id: 'chain-reason-strategy', routingLabel: '策略迭代', destinationType: 'STRATEGY_BACKLOG', status: 'PLANNED', note: '同步进入策略迭代队列。' }] }, T3, T6)
]

const issueClusters: IssueCluster[] = [
  stamp({ id: 'cluster-ppt-routing-ready', name: '管理层 PPT 路由召回簇', description: '管理层 PPT 的 SOP 与 metadata 路由问题；已完成人工确认并形成变体。', module: 'Skill', dimension: 'skill name/description错误', caseIds: ['case-ppt-management'], issueIds: ['issue-skill-recall'], evidenceIds: ['evidence-ppt-recall'], variantIds: ['variant-ppt-routing-v3'], status: 'VERIFIED', currentCount: 12, countingRule: '按人工确认的 Skill 路由问题 Case 去重；此类阈值待配置，由人工治理决策创建变体。' }, T3, T6),
  stamp({ id: 'cluster-ppt-taste-pending', name: '管理层 PPT 品味库召回簇', description: '只统计品味库召回错误，当前未达到 100 条触发条件。', module: 'Skill', dimension: '品味库召回错误', caseIds: ['case-ppt-management'], issueIds: ['issue-style-mismatch'], evidenceIds: ['evidence-ppt-style'], variantIds: [], status: 'COLLECTING', triggerRuleId: 'rule-taste-100', currentCount: 37, threshold: 100, countingRule: '按 Skill ID 去重：本地展开的已确认相关 Case + 同口径外部 Mock 快照；不足 100 条时禁止形成品味库变体。', tastePopulation: { skillId: 'skill-ppt-builder', externalMockConfirmedCaseCount: 36, snapshotId: 'mock-taste-ppt-builder-2026w35', source: 'Mock 品味库相关 Case 快照', countedAt: T6 } }, T3, T6),
  stamp({ id: 'cluster-memory-version', name: '跨轮资产版本错误簇', description: '同一 Session 内召回旧资产版本。', module: 'Memory', dimension: '准确率低', caseIds: ['case-multi-route'], issueIds: ['issue-memory-context'], evidenceIds: ['evidence-memory-miss'], variantIds: ['variant-memory-latest'], status: 'VARIANT_CREATED', currentCount: 4, countingRule: '按确认问题去重 Case；触发门槛待配置。' }, T4, T6)
]

const variants: Variant[] = [
  stamp({ id: 'variant-ppt-routing-v3', name: '管理层 PPT 路由增强', targetModule: 'Skill', changeType: 'SKILL_METADATA', changeSummary: '强化管理层、董事会等召回词。', changeContent: '更新 name/description，并加入 executive-report SOP 召回条件。', currentVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-2.6.0-rc.1', sourceCaseIds: ['case-ppt-management'], sourceIssueIds: ['issue-skill-recall'], sourceClusterIds: ['cluster-ppt-routing-ready'], evidenceIds: ['evidence-ppt-recall'], status: 'RELEASED', experimentIds: ['exp-single-ppt-routing', 'exp-window-2026w35'] }, T3, T6),
  stamp({ id: 'variant-tool-retry-v2', name: 'Excel 导出参数修复', targetModule: 'Act', changeType: 'TOOL_STABILITY', changeSummary: '修正枚举并增加调用前校验。', changeContent: 'xlsx 映射为 EXCEL_WORKBOOK；参数非法时禁止执行并返回可操作错误。', currentVersion: 'spreadsheet-2.5.0', candidateVersion: 'spreadsheet-2.5.1', sourceCaseIds: ['case-tool-export'], sourceIssueIds: ['issue-tool-export'], sourceClusterIds: [], evidenceIds: ['evidence-tool-error'], status: 'SINGLE_PASSED', experimentIds: ['exp-single-tool-retry'] }, T2, T5),
  stamp({ id: 'variant-memory-latest', name: 'Session 最新产物优先', targetModule: 'Memory', changeType: 'PROMPT_OR_POLICY', changeSummary: '同 Session 内已确认产物按版本与时间重排。', changeContent: '加入 confirmed、version、updatedAt 的排序特征。', currentVersion: 'memory-1.8.0', candidateVersion: 'memory-1.9.0-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: ['issue-memory-context'], sourceClusterIds: ['cluster-memory-version'], evidenceIds: ['evidence-memory-miss'], status: 'EXPERIMENTING', experimentIds: ['exp-single-memory-latest'] }, T4, T6),
  stamp({ id: 'variant-reason-office-plan', name: '跨 Office 前置分析策略', targetModule: 'Reason', changeType: 'PROMPT_OR_POLICY', changeSummary: '涉及数据与产物时强制先计算并校验来源。', changeContent: '新增 analyze -> validate -> compose 规划约束。', currentVersion: 'reason-3.1.0', candidateVersion: 'reason-3.1.1-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: ['issue-reason-tool'], sourceClusterIds: [], evidenceIds: ['evidence-reason-plan'], status: 'READY', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-excel-analysis-v1', name: 'Excel 公式与数据校验增强', targetModule: 'Skill', changeType: 'SKILL_CONTENT', changeSummary: '补充公式依赖识别与空值边界处理。', changeContent: '在生成前执行公式完整性检查，并保留异常单元格 Evidence。', currentVersion: 'spreadsheet-2.5.1', candidateVersion: 'spreadsheet-2.6.0-rc.1', sourceCaseIds: ['case-tool-export'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-tool-error'], status: 'READY', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-word-layout-v1', name: 'Word 文档版式稳定性增强', targetModule: 'Skill', changeType: 'SKILL_CONTENT', changeSummary: '统一标题层级、目录和长表格分页规则。', changeContent: '新增长文档分页检查与目录回填步骤。', currentVersion: 'word-1.4.0', candidateVersion: 'word-1.5.0-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-reason-plan'], status: 'EXPERIMENTING', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-canvas-structure-v1', name: 'Canvas 画布结构理解增强', targetModule: 'Skill', changeType: 'SKILL_CONTENT', changeSummary: '提升画布对象分组与空间关系理解。', changeContent: '增加对象层级、对齐关系和画布区域约束。', currentVersion: 'canvas-0.8.0', candidateVersion: 'canvas-0.9.0-rc.1', sourceCaseIds: ['case-ppt-management'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-ppt-recall'], status: 'DRAFT', experimentIds: [] }, T3, T6),
  stamp({ id: 'variant-taste-ppt-template-1-v1', name: 'PPT 品味模版 1：红色管理层', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '补充红色、简洁、管理层场景的模板召回特征。', changeContent: '将模板 1 的用户偏好标签与管理层场景绑定。', currentVersion: 'taste-ppt-template-1-0.9.0', candidateVersion: 'taste-ppt-template-1-1.0.0-rc.1', sourceCaseIds: ['case-ppt-management'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-ppt-style'], status: 'READY', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-taste-ppt-template-2-v1', name: 'PPT 品味模版 2：深色董事会', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '优化深色背景与高对比图表资产。', changeContent: '补充董事会演示的字号、对比度与图表密度约束。', currentVersion: 'taste-ppt-template-2-0.8.0', candidateVersion: 'taste-ppt-template-2-0.9.0-rc.1', sourceCaseIds: ['case-ppt-management'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-ppt-style'], status: 'DRAFT', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-taste-excel-template-1-v1', name: 'Excel 品味模版 1：经营分析', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '建立经营分析表格的颜色和信息层级偏好。', changeContent: '补充经营分析表的红色提醒、冻结窗格与摘要区域资产。', currentVersion: 'taste-excel-template-1-0.6.0', candidateVersion: 'taste-excel-template-1-0.7.0-rc.1', sourceCaseIds: ['case-tool-export'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-tool-error'], status: 'READY', experimentIds: [] }, T4, T6),
  stamp({ id: 'variant-taste-word-template-1-v1', name: 'Word 品味模版 1：正式公文', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '统一正式公文的版式与品牌色偏好。', changeContent: '补充公文模板的页眉、落款和段落间距资产。', currentVersion: 'taste-word-template-1-0.5.0', candidateVersion: 'taste-word-template-1-0.6.0-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: [], sourceClusterIds: [], evidenceIds: ['evidence-reason-plan'], status: 'DRAFT', experimentIds: [] }, T4, T6)
]

const defaultSkillVersion = (skillId: string, item: string) => skillId === 'skill-ppt-builder' ? (item.startsWith('memory-') ? 'ppt-builder-2.5.0' : 'ppt-builder-2.5.0') : skillId === 'skill-spreadsheet' ? 'spreadsheet-2.5.1' : skillId === 'skill-taste-executive' ? 'taste-0.9.0' : undefined
const targets = (skillId: string, item: string, skillVersion = defaultSkillVersion(skillId, item)) => [{ skillId, skillVersion, skillVersionId: skillVersion ? `${skillId}@${skillVersion}` : undefined, evolutionItemId: evolutionItemId(item) ?? item }]
const datasets: Dataset[] = [
  stamp({ id: 'dataset-attribution', name: '原始归因集', type: 'ATTRIBUTION', version: 'v1.4', caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], sampleCount: 3, source: 'Mock 治理确认 Case', scope: '来源问题的原始归因 Case', frozen: true, purpose: '原始归因集', setRole: 'EVALUATION', targets: [...targets('skill-ppt-builder', 'skill sop错误'), ...targets('skill-ppt-builder', 'skill sop错误', 'ppt-builder-2.6.0-rc.1')], population: { totalSampleCount: 3, localCaseCount: 3, externalSampleCount: 0, sourceSystem: '本地结构化 Mock', countingRule: '按 Case ID 去重，三条样本全部在 Demo 展开。' } }, T3),
  stamp({ id: 'dataset-generalization', name: '泛化数据集A', type: 'GENERALIZATION', version: 'v2.0', caseIds: ['case-ppt-management', 'case-multi-route'], sampleCount: 24, source: 'Mock 离线样本库', scope: '同类与相邻 Office 任务', frozen: true, purpose: '同类泛化集', setRole: 'EVALUATION', targets: [...targets('skill-ppt-builder', 'skill sop错误'), ...targets('skill-ppt-builder', 'skill sop错误', 'ppt-builder-2.6.0-rc.1')], population: { totalSampleCount: 24, localCaseCount: 2, externalSampleCount: 22, sourceSystem: 'Mock 离线样本库', countingRule: '2 条本地可追溯 Case + 22 条未在 Demo 展开的外部 Mock 样本。' } }, T3),
  stamp({ id: 'dataset-regression', name: '回归数据集A', type: 'REGRESSION', version: 'v1.2', caseIds: ['case-tool-export'], sampleCount: 40, source: 'Mock Golden / Challenge Case', scope: '相邻能力与无关能力回归', frozen: true, purpose: '相邻及无关回归集', setRole: 'EVALUATION', targets: targets('skill-ppt-builder', 'skill sop错误'), population: { totalSampleCount: 40, localCaseCount: 1, externalSampleCount: 39, sourceSystem: 'Mock Golden / Challenge 样本库', countingRule: '1 条本地确定性 Bug Case + 39 条未展开的回归 Mock 样本。' } }, T3),
  stamp({ id: 'dataset-window-online', name: 'W35 窗口线上数据全集', type: 'WINDOW_ONLINE', version: '2026w35-r1', caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], sampleCount: 128, source: 'Mock 线上 Case 快照', timeRange: { from: T0, to: T6 }, scope: '窗口内生产环境全量 Case（演示）', frozen: true, purpose: '窗口线上数据全集', setRole: 'GATE', targets: targets('skill-ppt-builder', 'skill sop错误'), windowIds: ['window-2026w35'], population: { totalSampleCount: 128, localCaseCount: 3, externalSampleCount: 125, sourceSystem: 'Mock 线上窗口快照', countingRule: '窗口时间内 128 条去重 Case；Demo 展开其中 3 条完整链路。' } }, T4),
  stamp({ id: 'dataset-spreadsheet-regression', name: 'Spreadsheet 回归数据集B', type: 'REGRESSION', version: 'v2.0', caseIds: ['case-tool-export'], sampleCount: 18, source: 'Mock Tool Bug 回归集', scope: 'Spreadsheet Analyst 2.5.1 工具执行失败回归', frozen: true, purpose: '相邻及无关回归集', setRole: 'EVALUATION', targets: targets('skill-spreadsheet', 'act-failed'), population: { totalSampleCount: 18, localCaseCount: 1, externalSampleCount: 17, sourceSystem: '本地结构化 Mock', countingRule: '按 Case ID 去重；1 条完整 Tool Bug + 17 条回归样本。' } }, T4),
  stamp({ id: 'dataset-taste-attribution', name: '品味库召回归因集A', type: 'ATTRIBUTION', version: 'v1.0', caseIds: ['case-v2-taste-red', 'case-v2-taste-asset-quality', 'case-v2-taste-asset-shortage'], sampleCount: 37, source: 'Mock 品味库相关 Case 快照', scope: '管理层品味库 Skill 0.9.0 召回与资产质量问题', frozen: true, purpose: '原始归因集', setRole: 'EVALUATION', targets: targets('skill-taste-executive', 'taste-recall', 'taste-0.9.0'), population: { totalSampleCount: 37, localCaseCount: 3, externalSampleCount: 34, sourceSystem: 'Mock 品味库快照', countingRule: '按 Skill ID 与归因维度去重。' } }, T5),
  stamp({ id: 'dataset-memory-generalization', name: 'Memory 策略泛化集A', type: 'GENERALIZATION', version: 'v1.0', caseIds: ['case-multi-route', 'case-v2-memory-recall'], sampleCount: 28, source: 'Mock Memory 策略样本库', scope: 'PPT Builder 2.5.0 记忆召回率低与准确率低', frozen: true, purpose: '同类泛化集', setRole: 'EVALUATION', targets: targets('skill-ppt-builder', 'memory-recall', 'ppt-builder-2.5.0'), population: { totalSampleCount: 28, localCaseCount: 2, externalSampleCount: 26, sourceSystem: 'Mock Memory 样本库', countingRule: '按 Session 与归因维度去重。' } }, T5),
  stamp({ id: 'dataset-word-reason', name: 'Word Reason 泛化集A', type: 'GENERALIZATION', version: 'v1.0', caseIds: ['case-v2-reason-choice'], sampleCount: 20, source: 'Mock Word Reason 样本库', scope: 'Word Builder 1.4.0 低效路径样本', frozen: true, purpose: '同类泛化集', setRole: 'EVALUATION', targets: targets('skill-word-builder', 'reason-choice', 'word-1.4.0'), population: { totalSampleCount: 20, localCaseCount: 1, externalSampleCount: 19, sourceSystem: 'Mock Word 样本库', countingRule: '按垂类场景与归因维度去重。' } }, T5)
]

const metrics: ExperimentMetric[] = [
  { key: 'target_module', label: '目标模块评分', category: 'LOCAL', baselineMean: 0.61, candidateMean: 0.84, baselineStdDev: 0.08, candidateStdDev: 0.04, unit: 'score', gateStatus: 'PENDING' },
  { key: 'end_to_end', label: 'Case 最终结果有效率', category: 'END_TO_END', baselineMean: 0.68, candidateMean: 0.79, baselineStdDev: 0.06, candidateStdDev: 0.05, unit: 'rate', gateStatus: 'PENDING' },
  { key: 'generalization', label: '泛化集通过率', category: 'GENERALIZATION', baselineMean: 0.72, candidateMean: 0.78, baselineStdDev: 0.07, candidateStdDev: 0.06, unit: 'rate', gateStatus: 'PENDING' }
]
const evaluationModuleCodes = ['reason', 'memory', 'context', 'skill', 'act', 'tool', 'outcome']
const config = (createdAt: string, datasetVersions: Array<Omit<Experiment['configSnapshot']['datasetVersions'][number], 'versionId'>>): Experiment['configSnapshot'] => {
  const frozenDatasetVersions = datasetVersions.map((entry) => ({
    ...entry,
    versionId: `${entry.datasetId}@${entry.version}`,
    caseIds: [...(datasets.find((dataset) => dataset.id === entry.datasetId)?.caseIds ?? [])]
  }))
  const caseIds = [...new Set(frozenDatasetVersions.flatMap((entry) => entry.caseIds ?? []))]
  const traceIds = traces.filter((trace) => caseIds.includes(trace.caseId)).map((trace) => trace.id)
  const artifactIds = [...new Set(artifacts.filter((artifact) => caseIds.includes(artifact.caseId)).map((artifact) => artifact.id))]
  const evidenceBundleIds = [...new Set(traceIds.flatMap((traceId) => evaluationModuleCodes.map((moduleCode) => `module-score-${traceId}-${moduleCode}`)))]
  return { datasetVersions: frozenDatasetVersions, model: 'gpt-5.2-demo', toolPermissions: ['slides.render', 'sheets.read', 'sheets.export'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'isolated-demo-runner', evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', artifactIds, evidenceBundleIds, tracePackageIds: traceIds.map((traceId) => `package-${traceId}`), createdAt }
}
const experiments: Experiment[] = [
  stamp({ id: 'exp-single-ppt-routing', name: '管理层 PPT 路由单变体实验', level: 'SINGLE_VARIANT', variantIds: ['variant-ppt-routing-v3'], windowId: 'window-2026w35', datasetIds: ['dataset-attribution', 'dataset-generalization', 'dataset-regression'], targets: [...targets('skill-ppt-builder', 'skill sop错误'), ...targets('skill-ppt-builder', 'skill sop错误', 'ppt-builder-2.6.0-rc.1')], configSnapshot: config(T4, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: ['run-ppt-routing-1', 'run-ppt-routing-2', 'run-ppt-routing-3'], baselineVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-2.6.0-rc.1', metrics, failedCaseIds: [], rollbackItems: [], knownRisks: ['极短 query 的受众意图仍可能不明确'], status: 'DECIDED', gateDecisionId: 'gate-single-ppt-routing' }, T4, T5),
  stamp({ id: 'exp-single-tool-retry', name: 'Excel 导出直接修复验证', level: 'SINGLE_VARIANT', variantIds: ['variant-tool-retry-v2'], windowId: 'window-2026w35', datasetIds: ['dataset-attribution', 'dataset-regression'], targets: targets('skill-spreadsheet', 'act-failed'), configSnapshot: config(T3, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: ['run-tool-1', 'run-tool-2', 'run-tool-3'], baselineVersion: 'spreadsheet-2.5.0', candidateVersion: 'spreadsheet-2.5.1', metrics, failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'DECIDED', gateDecisionId: 'gate-single-tool' }, T3, T5),
  stamp({ id: 'exp-single-memory-latest', name: 'Session 最新产物优先实验', level: 'SINGLE_VARIANT', variantIds: ['variant-memory-latest'], windowId: 'window-2026w36', datasetIds: ['dataset-attribution', 'dataset-generalization', 'dataset-regression'], targets: targets('skill-ppt-builder', 'memory-accuracy'), configSnapshot: config(T6, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: [], baselineVersion: 'memory-1.8.0', candidateVersion: 'memory-1.9.0-rc.1', metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['跨 Session 复用策略待验证'], status: 'QUEUED' }, T6),
  stamp({ id: 'exp-window-2026w35', name: 'W35 窗口组合实验', level: 'WINDOW_COMBINATION', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], windowId: 'window-2026w35', datasetIds: ['dataset-window-online', 'dataset-generalization'], targets: [{ skillId: 'skill-ppt-builder', skillVersion: 'ppt-builder-2.5.0', skillVersionId: 'skill-ppt-builder@ppt-builder-2.5.0', evolutionItemId: 'skill-sop' }, { skillId: 'skill-spreadsheet', skillVersion: 'spreadsheet-2.5.1', skillVersionId: 'skill-spreadsheet@spreadsheet-2.5.1', evolutionItemId: 'act-failed' }], configSnapshot: config(T5, [{ datasetId: 'dataset-window-online', version: '2026w35-r1', sampleCount: 128 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }]), runIds: [], baselineVersion: 'agent-2.5.0', candidateVersion: 'agent-3.0.0-rc.1', metrics, failedCaseIds: [], rollbackItems: ['若管理层 PPT 有效率下降则回退全部组合'], knownRisks: ['组合后路由权重变化需观察'], status: 'DECIDED', gateDecisionId: 'gate-window-2026w35' }, T5, T6),
  stamp({ id: 'exp-single-taste-recall', name: '品味库召回单能力实验', level: 'SINGLE_VARIANT', variantIds: ['variant-taste-red-v1'], windowId: 'window-2026w36', datasetIds: ['dataset-taste-attribution'], targets: targets('skill-taste-executive', 'taste-recall', 'taste-0.9.0'), configSnapshot: config(T6, [{ datasetId: 'dataset-taste-attribution', version: 'v1.0', sampleCount: 37 }]), runIds: [], baselineVersion: 'taste-0.9.0', candidateVersion: 'taste-1.0.0-rc.1', metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['红色偏好需继续观察跨行业泛化'], status: 'QUEUED' }, T6),
  stamp({ id: 'exp-single-word-reason', name: 'Word Reason 路径优化实验', level: 'SINGLE_VARIANT', variantIds: ['variant-word-layout-v1'], windowId: 'window-2026w36', datasetIds: ['dataset-word-reason'], targets: targets('skill-word-builder', 'reason-choice', 'word-1.4.0'), configSnapshot: config(T6, [{ datasetId: 'dataset-word-reason', version: 'v1.0', sampleCount: 20 }]), runIds: [], baselineVersion: 'word-1.4.0', candidateVersion: 'word-1.5.0-rc.1', metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['复杂长文档路径仍需人工复核'], status: 'DRAFT' }, T6)
]

const experimentRunSpec: Record<string, { caseIds: string[]; configHash: string; status: ExperimentRun['status']; createdAt: string; updatedAt: string; baseline: [number, number, number]; candidate: [number, number, number]; duration: number }> = {
  'exp-single-ppt-routing': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-ppt-route-a91', status: 'COMPLETED', createdAt: T4, updatedAt: T5, baseline: [0.58, 0.62, 0.63], candidate: [0.82, 0.83, 0.84], duration: 61000 },
  'exp-single-tool-retry': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-tool-fix-b22', status: 'COMPLETED', createdAt: T3, updatedAt: T5, baseline: [0, 0, 0], candidate: [1, 1, 1], duration: 6800 },
  'exp-window-2026w35': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-window-w35-e77', status: 'COMPLETED', createdAt: T5, updatedAt: T6, baseline: [0.66, 0.68, 0.70], candidate: [0.77, 0.79, 0.81], duration: 72000 }
}
const experimentRuns: ExperimentRun[] = Object.entries(experimentRunSpec).flatMap(([experimentId, spec]) => spec.caseIds.flatMap((caseId) => (['BASELINE', 'CANDIDATE'] as const).flatMap((arm) => [1, 2, 3].map((repetition): ExperimentRun => {
  const score = spec[arm === 'BASELINE' ? 'baseline' : 'candidate'][repetition - 1]
  const experiment = experiments.find((item) => item.id === experimentId)!
  return stamp({ id: `run-${experimentId}-${caseId}-${arm.toLowerCase()}-${repetition}`, experimentId, caseId, repetition, arm, status: spec.status, processScore: spec.status === 'COMPLETED' ? score : undefined, outcomeScore: spec.status === 'COMPLETED' ? Math.max(0, score - 0.03) : undefined, durationMs: spec.status === 'COMPLETED' ? spec.duration + repetition * 100 : 0, configHash: spec.configHash, configSnapshot: copy(experiment.configSnapshot) }, spec.createdAt, spec.updatedAt)
}))))

experiments.forEach((experiment) => {
  experiment.runIds = experimentRuns.filter((run) => run.experimentId === experiment.id).map((run) => run.id)
})
const gateSnapshot = (experimentId: string, evidenceIds: string[]): GateDecision['reportSnapshot'] => {
  const experiment = experiments.find((item) => item.id === experimentId)!
  return { experimentId, variantIds: [...experiment.variantIds], datasetVersions: experiment.configSnapshot.datasetVersions.map(({ datasetId, version }) => ({ datasetId, version })), metricResults: experiment.metrics.map((metric) => ({ ...metric })), configSnapshot: JSON.parse(JSON.stringify(experiment.configSnapshot)) as Experiment['configSnapshot'], runSnapshots: experimentRuns.filter((run) => run.experimentId === experimentId).map((run) => ({ ...run, evalSnapshot: run.evalSnapshot ? JSON.parse(JSON.stringify(run.evalSnapshot)) : undefined, windowSnapshot: run.windowSnapshot ? JSON.parse(JSON.stringify(run.windowSnapshot)) : undefined })), failedCaseIds: [...experiment.failedCaseIds], rollbackItems: [...experiment.rollbackItems], knownRisks: [...experiment.knownRisks], evidenceIds }
}

const windows: Window[] = [
  stamp({ id: 'window-2026w35', name: '2026 W35 能力窗口', timeRange: { from: T0, to: T6 }, candidateVariantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], singleExperimentIds: ['exp-single-ppt-routing', 'exp-single-tool-retry'], combinationExperimentId: 'exp-window-2026w35', status: 'RELEASED', cutoffAt: T6, frozenAt: T5, nextWindowRuleId: 'rule-monitor-latency-baseline' }, T3, T6),
  stamp({ id: 'window-2026w36', name: '2026 W36 能力窗口', timeRange: { from: T6, to: '2026-10-03T14:00:00.000Z' }, candidateVariantIds: ['variant-memory-latest', 'variant-reason-office-plan'], singleExperimentIds: ['exp-single-memory-latest'], status: 'EXPERIMENTING', cutoffAt: '2026-10-03T14:00:00.000Z', nextWindowRuleId: 'rule-gate-threshold' }, T6)
]

const gateDecisions: GateDecision[] = [
  { id: 'gate-single-ppt-routing', experimentId: 'exp-single-ppt-routing', conclusion: 'PASS', decisionBasis: 'HUMAN_REVIEW', reason: '业务门禁待配置；人工复核目标模块、端到端与泛化结果后准出。', riskNotes: ['短 query 需持续观察'], decidedBy: '王实验负责人', decidedAt: T5, reportSnapshot: gateSnapshot('exp-single-ppt-routing', ['evidence-ppt-recall']) },
  { id: 'gate-single-tool', experimentId: 'exp-single-tool-retry', conclusion: 'PASS', decisionBasis: 'HUMAN_REVIEW', reason: '业务门禁待配置；人工确认确定性错误三次运行均修复。', riskNotes: [], decidedBy: '赵 Tool Owner', decidedAt: T5, reportSnapshot: gateSnapshot('exp-single-tool-retry', ['evidence-tool-error']) },
  { id: 'gate-window-2026w35', experimentId: 'exp-window-2026w35', conclusion: 'PASS', decisionBasis: 'HUMAN_REVIEW', reason: '业务门禁待配置；治理委员会人工复核后批准灰度。', riskNotes: ['灰度期观察路由权重漂移'], decidedBy: '治理委员会', decidedAt: T6, reportSnapshot: gateSnapshot('exp-window-2026w35', ['evidence-ppt-recall']) },
  { id: 'gate-demo-reject', experimentId: 'exp-single-tool-retry', conclusion: 'REJECT', decisionBasis: 'HUMAN_REVIEW', reason: '历史候选在回归样本出现 Tool 倒退，保留为拒绝示例。', riskNotes: ['相邻 Excel 场景倒退'], decidedBy: '治理委员会', decidedAt: T4, reportSnapshot: gateSnapshot('exp-single-tool-retry', ['evidence-tool-error']) },
  { id: 'gate-demo-manual-review', experimentId: 'exp-single-ppt-routing', conclusion: 'MANUAL_REVIEW', decisionBasis: 'HUMAN_REVIEW', reason: '历史候选存在短 Query 风险，保留为人工复核示例。', riskNotes: ['短 Query 受众意图待复核'], decidedBy: '质量运营', decidedAt: T4, reportSnapshot: gateSnapshot('exp-single-ppt-routing', ['evidence-ppt-recall']) }
]

const releases: ReleaseVersion[] = [
  stamp({ id: 'release-agent-2-5-0', version: 'agent-2.5.0', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '治理委员会', status: 'RELEASED', releasedAt: T0 }, T0),
  stamp({ id: 'release-agent-2-5-rollback', version: 'agent-2.5.0-rollback-demo', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '治理委员会', status: 'ROLLED_BACK', releasedAt: T2, rollbackVersionId: 'release-agent-2-5-0', rollbackReason: '灰度期间发现 Tool 超时回退到稳定版本。' }, T2),
  stamp({ id: 'release-agent-2-6-canary', version: 'agent-2.6.0-canary', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '治理委员会', status: 'CANARY', releasedAt: T5, rollbackVersionId: 'release-agent-2-5-0' }, T5),
  stamp({ id: 'release-agent-3-0-pending', version: 'agent-3.0.1-pending', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '待审批', status: 'PENDING', rollbackVersionId: 'release-agent-2-5-0' }, T6),
  stamp({ id: 'release-agent-3-0-0', version: 'agent-3.0.0', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '治理委员会', status: 'OBSERVING', releasedAt: T6, rollbackVersionId: 'release-agent-2-5-0' }, T6),
]

const historyEntry = (id: string, stage: SkillEvolutionHistoryEntry['stage'], version: string, summary: string, createdAt: string, referenceId?: string, referenceKind?: string, status?: string): SkillEvolutionHistoryEntry => stamp({ id, stage, version, summary, referenceId, referenceKind, status }, createdAt, createdAt)
const catalogHistory = (prefix: string, currentVersion: string, candidateVersion: string, variantId: string): SkillEvolutionHistoryEntry[] => [
  historyEntry(`${prefix}-case`, '线上问题', currentVersion, '线上任务进入治理台账，保留原始 Query 与 Trace。', T1, undefined, undefined, '已记录'),
  historyEntry(`${prefix}-eval`, '评测完成', currentVersion, '过程评测与产物评测完成，保留 Judge Reason 与根证据。', T2, variantId, 'variant', '已完成'),
  historyEntry(`${prefix}-attribution`, '归因确认', currentVersion, '人工确认归因维度并确定后续优化路径。', T3, variantId, 'variant', '已确认'),
  historyEntry(`${prefix}-variant`, '能力变体', candidateVersion, '生成候选能力变体并冻结来源快照。', T4, variantId, 'variant', '候选'),
  historyEntry(`${prefix}-single`, '单变体实验', candidateVersion, '使用归因集、泛化集和回归集进行单变体验证。', T5, variantId, 'variant', '实验中'),
  historyEntry(`${prefix}-window`, '窗口组合实验', candidateVersion, '等待进入能力窗口组合验证；业务门禁按规则配置。', T6, variantId, 'variant', '待进入')
]
const pptHistory: SkillEvolutionHistoryEntry[] = [
  historyEntry('history-ppt-case', '线上问题', 'ppt-builder-2.5.0', '管理层 PPT 路由召回不足，来源为线上+时间窗口。', T1, 'case-ppt-management', 'case', '已确认'),
  historyEntry('history-ppt-eval', '评测完成', 'ppt-builder-2.5.0', 'Eval Agent 确认 Skill name/description 与 SOP 召回存在偏差。', T2, 'process-eval-ppt-recall', 'process-eval', 'FAIL'),
  historyEntry('history-ppt-attribution', '归因确认', 'ppt-builder-2.5.0', '人工确认问题进入 Agent 迭代问题簇。', T3, 'issue-skill-recall', 'issue', '已确认'),
  historyEntry('history-ppt-variant', '能力变体', 'ppt-builder-2.6.0-rc.1', '强化管理层、董事会等召回词，并加入 executive-report SOP 条件。', T4, 'variant-ppt-routing-v3', 'variant', '已发布'),
  historyEntry('history-ppt-single', '单变体实验', 'ppt-builder-2.6.0-rc.1', '目标模块、端到端与泛化指标均保留三次重复运行快照。', T5, 'exp-single-ppt-routing', 'experiment', '已准出'),
  historyEntry('history-ppt-window', '窗口组合实验', 'agent-3.0.0-rc.1', '与 Excel Tool 修复一起进入 2026 W35 能力窗口。', T5, 'exp-window-2026w35', 'experiment', '已准出'),
  historyEntry('history-ppt-release', '发布版本', 'agent-3.0.0', '治理委员会批准发布并进入观察期，可反查窗口与回滚版本。', T6, 'release-agent-3-0-0', 'release', '观察中')
]
const skills: Skill[] = [
  stamp({ id: 'skill-ppt-builder', name: 'PPT Builder', type: 'OFFICIAL', version: '2.6.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-ppt-routing-v3'], assetIds: ['asset-executive-template'], generationStatus: 'AVAILABLE', category: 'PRODUCTION_SKILL', evolutionHistory: pptHistory }),
  stamp({ id: 'skill-spreadsheet', name: 'Spreadsheet Analyst', type: 'OFFICIAL', version: '2.5.1', visibility: 'PUBLIC', evolutionRecordIds: ['variant-tool-retry-v2', 'variant-excel-analysis-v1'], assetIds: [], generationStatus: 'AVAILABLE', category: 'PRODUCTION_SKILL', evolutionHistory: catalogHistory('history-excel', 'spreadsheet-2.5.1', 'spreadsheet-2.6.0-rc.1', 'variant-excel-analysis-v1') }),
  stamp({ id: 'skill-word-builder', name: 'Word Builder', type: 'OFFICIAL', version: '1.4.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-word-layout-v1'], assetIds: [], generationStatus: 'AVAILABLE', category: 'PRODUCTION_SKILL', evolutionHistory: catalogHistory('history-word', 'word-1.4.0', 'word-1.5.0-rc.1', 'variant-word-layout-v1') }),
  stamp({ id: 'skill-canvas-builder', name: 'Canvas Builder', type: 'OFFICIAL', version: '0.8.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-canvas-structure-v1'], assetIds: [], generationStatus: 'AVAILABLE', category: 'PRODUCTION_SKILL', evolutionHistory: catalogHistory('history-canvas', 'canvas-0.8.0', 'canvas-0.9.0-rc.1', 'variant-canvas-structure-v1') }),
  stamp({ id: 'skill-personal-planned', name: '个人汇报 Skill（规划）', type: 'PERSONAL', version: '未生成', visibility: 'PRIVATE', evolutionRecordIds: [], assetIds: ['asset-user-template'], generationStatus: 'PLANNED', category: 'PERSONAL_SKILL', planningSources: [{ query: '把我的月度预算文件整理成个人复盘 PPT', assetIds: ['asset-user-template'], existingSkillIds: ['skill-ppt-builder'], conversationTraceIds: ['trace-multi-route'], artifactIds: ['artifact-multi-ppt'] }], evolutionHistory: [] }, T4),
  stamp({ id: 'skill-general-docs', name: '通用文档助手', type: 'SYSTEM', version: '1.3.0', visibility: 'PUBLIC', evolutionRecordIds: [], assetIds: [], generationStatus: 'AVAILABLE', category: 'GENERAL', evolutionHistory: [] }),
  stamp({ id: 'skill-taste-executive', name: '管理层品味库 Skill', type: 'OFFICIAL', version: '0.9.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-taste-red-v1'], assetIds: ['asset-executive-template'], generationStatus: 'AVAILABLE', category: 'TASTE_SKILL', evolutionHistory: catalogHistory('history-taste-executive', 'taste-0.9.0', 'taste-1.0.0-rc.1', 'variant-taste-red-v1') }, T2),
  stamp({ id: 'skill-taste-ppt-template-1', name: 'PPT 品味模版 1 · 红色管理层', type: 'OFFICIAL', version: '1.0.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-taste-ppt-template-1-v1'], assetIds: ['asset-taste-ppt-template-1'], generationStatus: 'AVAILABLE', category: 'TASTE_SKILL', evolutionHistory: catalogHistory('history-taste-ppt-1', 'taste-ppt-template-1-0.9.0', 'taste-ppt-template-1-1.0.0-rc.1', 'variant-taste-ppt-template-1-v1') }, T3),
  stamp({ id: 'skill-taste-ppt-template-2', name: 'PPT 品味模版 2 · 深色董事会', type: 'OFFICIAL', version: '0.8.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-taste-ppt-template-2-v1'], assetIds: ['asset-taste-ppt-template-2'], generationStatus: 'AVAILABLE', category: 'TASTE_SKILL', evolutionHistory: catalogHistory('history-taste-ppt-2', 'taste-ppt-template-2-0.8.0', 'taste-ppt-template-2-0.9.0-rc.1', 'variant-taste-ppt-template-2-v1') }, T3),
  stamp({ id: 'skill-taste-excel-template-1', name: 'Excel 品味模版 1 · 经营分析', type: 'OFFICIAL', version: '0.6.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-taste-excel-template-1-v1'], assetIds: ['asset-taste-excel-template-1'], generationStatus: 'AVAILABLE', category: 'TASTE_SKILL', evolutionHistory: catalogHistory('history-taste-excel-1', 'taste-excel-template-1-0.6.0', 'taste-excel-template-1-0.7.0-rc.1', 'variant-taste-excel-template-1-v1') }, T3),
  stamp({ id: 'skill-taste-word-template-1', name: 'Word 品味模版 1 · 正式公文', type: 'OFFICIAL', version: '0.5.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-taste-word-template-1-v1'], assetIds: ['asset-taste-word-template-1'], generationStatus: 'AVAILABLE', category: 'TASTE_SKILL', evolutionHistory: catalogHistory('history-taste-word-1', 'taste-word-template-1-0.5.0', 'taste-word-template-1-0.6.0-rc.1', 'variant-taste-word-template-1-v1') }, T3),
  stamp({ id: 'skill-unclassified', name: '待分类 Skill', type: 'SYSTEM', version: '0.1.0', visibility: 'PRIVATE', evolutionRecordIds: [], assetIds: [], generationStatus: 'NOT_APPLICABLE', category: 'UNCLASSIFIED', evolutionHistory: [] }, T3)
]
const assets: Asset[] = [
  stamp({ id: 'asset-executive-template', name: '管理层决策摘要模板库', kind: 'TASTE_LIBRARY', ownerId: 'PPT 团队', visibility: 'PUBLIC', skillIds: ['skill-ppt-builder'], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED' }),
  stamp({ id: 'asset-user-template', name: '用户个人汇报模板', kind: 'TEMPLATE', ownerId: 'user-demo-c', visibility: 'PRIVATE', skillIds: ['skill-personal-planned'], sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED' }, T4),
  stamp({ id: 'asset-taste-ppt-template-1', name: 'PPT 品味模版 1 · 红色管理层资产', kind: 'TASTE_LIBRARY', ownerId: '品味库团队', visibility: 'PUBLIC', skillIds: ['skill-taste-ppt-template-1'], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED' }, T3),
  stamp({ id: 'asset-taste-ppt-template-2', name: 'PPT 品味模版 2 · 深色董事会资产', kind: 'TASTE_LIBRARY', ownerId: '品味库团队', visibility: 'PUBLIC', skillIds: ['skill-taste-ppt-template-2'], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED' }, T3),
  stamp({ id: 'asset-taste-excel-template-1', name: 'Excel 品味模版 1 · 经营分析资产', kind: 'TASTE_LIBRARY', ownerId: '品味库团队', visibility: 'PUBLIC', skillIds: ['skill-taste-excel-template-1'], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED' }, T3),
  stamp({ id: 'asset-taste-word-template-1', name: 'Word 品味模版 1 · 正式公文资产', kind: 'TASTE_LIBRARY', ownerId: '品味库团队', visibility: 'PUBLIC', skillIds: ['skill-taste-word-template-1'], sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED' }, T4)
]
const rules: RuleConfig[] = [
  stamp({ id: 'rule-repeat-count', name: '单 Case 重复运行次数', category: 'EXPERIMENT', status: 'CONFIGURED', value: 3, unit: '次', description: '演示默认值，可在规则配置修改。' }),
  stamp({ id: 'rule-taste-100', name: '品味库按 Skill 积累触发', category: 'TRIGGER', status: 'CONFIGURED', value: 100, unit: '相关数据条', description: '按 Skill ID 去重的人工确认相关 Case 计数。' }),
  stamp({ id: 'rule-gate-threshold', name: '指标准出门禁', category: 'GATE', status: 'PENDING', description: 'PRD 未给出业务阈值，待配置。' }),
  stamp({ id: 'rule-other-cluster', name: '其他问题聚类门槛', category: 'TRIGGER', status: 'PENDING', description: '除品味库外的聚类触发阈值待配置。' })
  ,stamp({ id: 'rule-monitor-latency-baseline', name: '总耗时 Baseline', category: 'MONITORING', status: 'PENDING', description: '按任务复杂度建立总耗时基线；当前尚未配置。' })
  ,stamp({ id: 'rule-monitor-ttft-baseline', name: 'TTFT Baseline', category: 'MONITORING', status: 'PENDING', description: '流式首 Token 时间基线待配置。' })
  ,stamp({ id: 'rule-monitor-cost-baseline', name: '成本 Baseline', category: 'MONITORING', status: 'PENDING', description: 'Token 与调用成本分布基线待配置。' })
]

/**
 * V2 keeps the original three end-to-end examples and adds a deterministic
 * local ledger.  These fixtures are deliberately small enough to inspect in
 * the UI, but broad enough to cover every Skill category, batch state,
 * missing-evidence state, multi-module failure, and multi-route delivery.
 */
const V2_CATEGORY_CYCLE: SkillCategory[] = ['PRODUCTION_SKILL', 'GENERAL', 'PERSONAL_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED']
const V2_MODULE_ORDER: TraceEvaluationModuleCode[] = ['REASON', 'MEMORY', 'CONTEXT', 'SKILL', 'ACT', 'TOOL', 'OUTCOME']
const V2_CATEGORY_SKILL: Record<SkillCategory, string> = {
  PRODUCTION_SKILL: 'skill-ppt-builder', GENERAL: 'skill-general-docs', PERSONAL_SKILL: 'skill-personal-planned',
  TASTE_SKILL: 'skill-taste-executive', UNCLASSIFIED: 'skill-unclassified'
}
const V2_BATCH_DEFINITIONS: Array<{ id: string; name: string; status: EvaluationBatchStatus; size: number; at: string }> = [
  { id: 'batch-draft-001', name: '待配置的周一 Trace 集', status: 'DRAFT', size: 4, at: T0 },
  { id: 'batch-queued-002', name: '待运行的 Office 回归集', status: 'QUEUED', size: 6, at: T1 },
  { id: 'batch-running-003', name: '正在评测的多场景 Trace 集', status: 'RUNNING', size: 7, at: T2 },
  { id: 'batch-partial-004', name: '部分完成的生产 Trace 集', status: 'PARTIAL', size: 8, at: T3 },
  { id: 'batch-completed-005', name: '已完成的管理层 Office 集', status: 'COMPLETED', size: 8, at: T4 },
  { id: 'batch-failed-006', name: '失败待重试的边界 Trace 集', status: 'FAILED', size: 7, at: T5 }
]

const generatedSessions: Session[] = []
const generatedCases: Case[] = []
const generatedTraces: Trace[] = []
const generatedObservations: ObservationLog[] = []
const generatedEvidence: Array<(typeof evidence)[number]> = []
const generatedArtifacts: Artifact[] = []
for (let index = 1; index <= 36; index += 1) {
  const category = V2_CATEGORY_CYCLE[(index - 1) % V2_CATEGORY_CYCLE.length]
  const caseId = `case-v2-${String(index).padStart(2, '0')}`
  const traceId = `trace-v2-${String(index).padStart(2, '0')}`
  const sessionId = `session-v2-${String(index).padStart(2, '0')}`
  const observationId = `obs-v2-${String(index).padStart(2, '0')}`
  const evidenceId = `evidence-v2-${String(index).padStart(2, '0')}`
  const startedAt = new Date(Date.parse(T0) + index * 43 * 60 * 1000).toISOString()
  const endedAt = new Date(Date.parse(startedAt) + (4000 + index * 1370)).toISOString()
  const skillId = V2_CATEGORY_SKILL[category]
  const scenario = ['PPT', 'Excel', 'Word', 'Coding', 'General'][index % 5]
  const isTasteScenario = category === 'TASTE_SKILL'
  const query = isTasteScenario
    ? '批量偏好评测：1000 个用户中有 950 个表达了对红色管理层风格的偏好，判断是否进入品味 Skill 自进化。'
    : index % 5 === 0
    ? '把本季度销售数据做成管理层 PPT，并保留可追溯的来源。'
    : index % 4 === 0
      ? '修复这份 Office 产物中的格式与引用问题。'
      : `V2 演示任务 ${index}：完成 ${scenario} 场景的端到端处理。`
  const latency = 4000 + index * 1370
  const inputTokens = 620 + index * 73
  const outputTokens = 120 + index * 17
  const hasTool = index % 3 === 0
  const failedObservation = index % 6 === 0 || index % 7 === 0
  const observationNode: ObservationLog['nodeType'] = isTasteScenario ? 'Skill' : index % 6 === 0 ? 'Tool' : index % 5 === 0 ? 'Skill' : index % 4 === 0 ? 'Reason' : 'Act'
  const turnCreatedAt = startedAt
  generatedSessions.push(stamp({ id: sessionId, title: `${scenario} V2 演示 Session ${index}`, userId: `user-v2-${(index % 6) + 1}`, caseIds: [caseId], traceIds: [traceId], turns: [
    { id: `turn-v2-${index}-user`, sequence: 1, role: 'USER', content: query, caseId, traceId, createdAt: turnCreatedAt },
    { id: `turn-v2-${index}-agent`, sequence: 2, role: 'AGENT', content: failedObservation ? '已记录异常，等待治理分流。' : '已完成演示任务并生成可追溯结果。', caseId, traceId, createdAt: endedAt }
  ] }, startedAt, endedAt))
  const artifactId = !failedObservation || index % 3 === 0 ? `artifact-v2-${String(index).padStart(2, '0')}` : undefined
  generatedCases.push(stamp({ id: caseId, sessionId, title: `${scenario} V2 评测 Case ${index}`, query, scenario, environment: index % 9 === 0 ? 'Staging' : 'Production', agentVersion: index % 2 ? 'agent-3.0.0-rc.1' : 'agent-2.6.0', skillIds: [skillId], traceIds: [traceId], artifactIds: artifactId ? [artifactId] : [], processEvalIds: [], outcomeEvalIds: [], attributionIds: [], issueIds: [], status: 'NEW', resultStatus: 'UNKNOWN', processStatus: 'UNKNOWN', owner: index % 3 === 0 ? '待分配' : undefined, labels: [`V2-${category}`, scenario, ...(isTasteScenario ? ['批量偏好聚合', '自进化候选'] : [])], multiScenario: index % 4 === 0 }, startedAt, endedAt))
  generatedTraces.push(stamp({ id: traceId, sessionId, caseId, sequence: 1, startedAt, endedAt, observationIds: [observationId], artifactIds: artifactId ? [artifactId] : [], status: failedObservation ? 'FAILED' : index % 4 === 0 ? 'PARTIAL' : 'SUCCEEDED', totalLatencyMs: latency, inputTokens, outputTokens, agentVersion: index % 2 ? 'agent-3.0.0-rc.1' : 'agent-2.6.0', skillVersion: `skill-${category.toLowerCase()}-${index % 3 + 1}.0`, skillCategory: category, telemetry: { totalLatencyMs: latency, ttftMs: 260 + index * 31, inputTokens, outputTokens, modelLatencyMs: Math.round(latency * (0.42 + (index % 4) * 0.04)), modelThroughputTokensPerSecond: Number(((inputTokens + outputTokens) / Math.max(1, latency / 1000)).toFixed(2)), cacheHitCount: index % 4, cacheRequestCount: Math.max(index % 4, 1 + (index % 6)), modelCallCount: 1 + (index % 4), toolCallCount: hasTool ? 1 + (index % 2) : 0, toolOneShotSuccessCount: hasTool && !failedObservation ? 1 : 0, toolExecutionCount: hasTool ? 1 + (index % 2) : 0, loopCount: index % 8 === 0 ? 2 : index % 3 === 0 ? 1 : 0, retryCount: failedObservation ? index % 2 : 0, riskInterception: { blocked: index % 17 === 0, reason: index % 17 === 0 ? '敏感内容触发演示拦截' : '未触发风控', category: index % 17 === 0 ? '敏感数据' : undefined }, commercialInterception: { blocked: index % 19 === 0, reason: index % 19 === 0 ? '权益不足触发演示拦截' : '未触发商业化拦截', category: index % 19 === 0 ? '权益不足' : undefined } } }, startedAt, endedAt))
  generatedObservations.push(stamp({ id: observationId, traceId, caseId, sequence: 1, nodeType: observationNode, name: isTasteScenario ? '品味偏好聚合与自进化判定' : `${observationNode} 演示节点`, input: query, output: failedObservation ? '模块返回待治理异常。' : isTasteScenario ? 'Eval Agent 聚合到红色风格偏好，建议进入 Agent 迭代。' : '模块执行完成。', status: failedObservation ? 'FAILED' : 'SUCCEEDED', skillId, toolName: hasTool ? 'office.demo.tool' : undefined, latencyMs: Math.round(latency * 0.18), retryCount: failedObservation ? index % 2 : 0, evidenceIds: [evidenceId], logId: `log-v2-${String(index).padStart(2, '0')}` }, startedAt, endedAt))
  generatedEvidence.push(stamp({ id: evidenceId, caseId, traceId, observationId, kind: failedObservation ? 'ERROR' : 'LOG', title: `${TRACE_MODULE_LABELS[observationNode === 'Skill' ? 'SKILL' : observationNode === 'Tool' ? 'TOOL' : observationNode === 'Reason' ? 'REASON' : 'ACT']} 根证据 ${index}`, content: failedObservation ? `Mock Trace ${traceId} 记录了可供归因的失败输出。` : `Mock Trace ${traceId} 的执行日志与 Rubric 输入输出摘要。`, source: 'Mock Trace / Eval Agent 接口占位' }, startedAt, endedAt))
  if (artifactId) generatedArtifacts.push(stamp({ id: artifactId, caseId, traceId, name: `${scenario} V2 评测产物 ${index}`, kind: scenario === 'PPT' ? 'PPT' : scenario === 'Excel' ? 'Excel' : scenario === 'Word' ? 'Word' : 'Other', uri: `mock://artifacts/${artifactId}`, version: 'v2', status: failedObservation ? 'INVALID' : 'AVAILABLE', evidenceIds: [evidenceId] }, startedAt, endedAt))
}

const v2AllSessions = [...sessions, ...generatedSessions]
const v2AllCases = [...cases, ...generatedCases]
const v2AllTraces = [...traces, ...generatedTraces].map((trace, index) => ({
  ...trace,
  channel: (['小程序', 'genflow pc 端', 'genflow 垂类入口'] as const)[index % 3],
  verticalScenario: (['PPT', 'Word', 'Excel', '生图'] as const)[index % 4],
  queryAt: trace.startedAt
}))
const v2AllObservations = [...observations, ...generatedObservations]
const v2AllEvidence = [...evidence, ...generatedEvidence]
const v2AllArtifacts = [...artifacts, ...generatedArtifacts]

const moduleDimension = (moduleCode: TraceEvaluationModuleCode, category: SkillCategory, index: number): { code: string; label: string; description: string } => {
  if (moduleCode === 'MEMORY') {
    const memoryDimensions = [
      { code: 'MEMORY_PRODUCTION_ERROR', label: '生产错误', description: '记忆生产阶段写入了错误信息。' },
      { code: 'MEMORY_MANAGEMENT_ERROR', label: '管理错误', description: '记忆管理策略没有正确维护用户上下文。' },
      { code: 'MEMORY_RECALL_LOW', label: '召回率低', description: '记忆未命中同 Session 的最新产物。' },
      { code: 'MEMORY_ACCURACY_LOW', label: '准确率低', description: '记忆召回内容与当前任务不一致。' }
    ]
    return memoryDimensions[Math.floor(Math.max(0, index - 1) / 3) % memoryDimensions.length]
  }
  if (moduleCode === 'SKILL') {
    if (category === 'TASTE_SKILL') {
      const tasteDimensions = [
        { code: 'TASTE_RECALL_ERROR', label: '品味库召回错误', description: '品味库召回的 Skill 与目标场景不匹配。' },
        { code: 'TASTE_ASSET_QUALITY', label: '品味库资产质量', description: '品味库调用资产质量不佳，偏离用户表达的红色风格偏好。' },
        { code: 'TASTE_ASSET_INSUFFICIENT', label: '品味库资产不足', description: '品味库缺乏充分匹配管理层红色风格的相关资产。' }
      ]
      return tasteDimensions[index % tasteDimensions.length]
    }
    if (category === 'PRODUCTION_SKILL') {
      const productionDimensions = [
        { code: 'SKILL_CAPABILITY_MISSING', label: '能力缺乏', description: '当前可用 Skill 不具备完成任务所需能力。' },
        { code: 'SKILL_FILE_UNAVAILABLE', label: 'skill文件不可用', description: 'skill文件不可加载，生产 Skill 无法完成评测任务。' },
        { code: 'SKILL_SOP_ERROR', label: 'skill sop错误', description: 'Skill 内部脚本、参数规则或编排逻辑存在错误。' },
        { code: 'SKILL_NAME_DESCRIPTION_ERROR', label: 'skill name/description错误', description: 'skill名字或摘要未能充分反映可支持的场景。' }
      ]
      return productionDimensions[index % productionDimensions.length]
    }
    return { code: 'SKILL_CAPABILITY_MISSING', label: '能力缺乏', description: '当前可用 Skill 不具备完成任务所需能力。' }
  }
  if (moduleCode === 'REASON') return { code: 'REASON_CHOICE', label: '没有做出最正确/高效的选择', description: '规划没有选择最正确或高效的执行路径。' }
  if (moduleCode === 'CONTEXT') return { code: 'CONTEXT_PENDING', label: '待上文的需求方案评审后补充', description: '上文模块只保留待补充状态，具体问题通过根证据呈现。' }
  if (moduleCode === 'ACT') return { code: 'ACT_STABILITY', label: '未遵循重试，超时等工程稳定性规则', description: '执行未遵循重试或超时等工程稳定性规则。' }
  if (moduleCode === 'TOOL') return { code: 'TOOL_FAILED', label: '工具未执行成功', description: '工具执行返回错误，需要直接优化或回归验证。' }
  return { code: 'OUTCOME_INVALID', label: '结果可用性', description: '产物结果未达到当前 Rubric 的可用性要求。' }
}

const statusForModule = (index: number, moduleCode: TraceEvaluationModuleCode, batchStatus: EvaluationBatchStatus, category: SkillCategory): ModuleEvaluationStatus => {
  if (batchStatus === 'DRAFT' || batchStatus === 'QUEUED') return 'UNKNOWN'
  if (moduleCode === 'CONTEXT') return index % 2 === 0 ? 'DERIVED_FAIL' : 'N/A'
  const fail = category === 'TASTE_SKILL' && moduleCode === 'SKILL'
    ? index % 2 === 0
    : category === 'PRODUCTION_SKILL' && moduleCode === 'SKILL'
      ? index % 3 === 0
      : category === 'PRODUCTION_SKILL' && moduleCode === 'REASON'
        ? index % 4 === 0
        : moduleCode === 'MEMORY' ? index % 7 === 0 : moduleCode === 'SKILL' ? index % 5 === 0 : moduleCode === 'REASON' ? index % 11 === 0 : moduleCode === 'ACT' ? index % 13 === 0 : moduleCode === 'TOOL' ? index % 6 === 0 : moduleCode === 'OUTCOME' ? index % 4 === 0 : false
  if (fail) return 'FAIL'
  if (index % 17 === 0 && moduleCode === 'REASON') return 'UNKNOWN'
  return 'PASS'
}

const moduleEvidence = (traceId: string, caseId: string, index: number, moduleCode: TraceEvaluationModuleCode, status: ModuleEvaluationStatus, evidenceId?: string): EvaluationEvidenceBundle => ({
  rootEvidenceIds: index % 9 === 0 ? [] : evidenceId ? [evidenceId] : [],
  rubricRule: index % 9 === 0 ? 'Rubric evidence 待补充' : `rubric-v2-${moduleCode.toLowerCase()}-1.0`,
  observationIds: index % 9 === 0 ? [] : [`obs-v2-${String(index).padStart(2, '0')}`],
  logIds: index % 9 === 0 ? [] : [`log-v2-${String(index).padStart(2, '0')}`],
  artifactIds: [], inputSummary: `Trace ${traceId} / Case ${caseId} 输入摘要`, outputSummary: status === 'FAIL' || status === 'DERIVED_FAIL' ? '发现需要治理的输出。' : '未发现异常输出。',
  firstFailure: false, derivedFailure: status === 'DERIVED_FAIL', derivedFromModule: status === 'DERIVED_FAIL' ? 'MEMORY' : undefined,
  completeness: index % 9 === 0 ? 'MISSING' : index % 4 === 0 ? 'PARTIAL' : 'COMPLETE'
})

const evaluationBatches: EvaluationBatch[] = []
const evaluationJobs: EvaluationJob[] = []
const tracePackages: TraceEvaluationPackage[] = []
const evaluationFindings: EvaluationFinding[] = []
const routingPolicies: RoutingPolicy[] = [
  stamp({ id: 'routing-policy-production-skill', name: 'Production Skill 失败 → 算法 Badcase', version: 'v2.0', enabled: true, description: 'Production Skill 的模块失败默认进入策略迭代和算法 Badcase Candidate。', skillCategories: ['PRODUCTION_SKILL'], outputLabel: '策略迭代', destination: 'ALGORITHM_BADCASE', priority: 100 }),
  stamp({ id: 'routing-policy-taste-skill', name: '品味 Skill 失败 → 品味库', version: 'v2.0', enabled: true, description: '品味 Skill 的模块失败进入 Agent迭代品味库队列。', skillCategories: ['TASTE_SKILL'], outputLabel: 'Agent迭代', destination: 'TASTE_LIBRARY', priority: 90 }),
  stamp({ id: 'routing-policy-personal-skill', name: 'Personal Skill 失败 → 规划队列', version: 'v2.0', enabled: true, description: 'Personal Skill 只进入二期规划队列，不伪造生成服务。', skillCategories: ['PERSONAL_SKILL'], outputLabel: 'Agent迭代', destination: 'PERSONAL_SKILL_PLANNING', priority: 80 }),
  stamp({ id: 'routing-policy-general', name: '通用 Skill 失败 → Agent 迭代', version: 'v2.0', enabled: true, description: 'General / Unclassified 的失败进入 Agent 迭代问题池。', skillCategories: ['GENERAL', 'UNCLASSIFIED'], outputLabel: 'Agent迭代', destination: 'AGENT_ITERATION', priority: 70 }),
  stamp({ id: 'routing-policy-direct-fix', name: 'Tool / Runtime 确定性错误 → 直接修复', version: 'v2.0', enabled: true, description: 'Tool 与 Act 的确定性错误按策略迭代直接进入回归验证。', moduleCodes: ['TOOL', 'ACT'], outputLabel: '策略迭代', destination: 'DIRECT_FIX', priority: 110 })
]
const routingDecisions: RoutingDecision[] = []
const routingDeliveries: RoutingDelivery[] = []
const algorithmBadcases: AlgorithmBadcaseItem[] = []
const queueItems: Record<string, { itemIds: string[]; deliveryIds: string[] }> = {
  'queue-algorithm-badcase': { itemIds: [], deliveryIds: [] }, 'queue-agent-iteration': { itemIds: [], deliveryIds: [] },
  'queue-taste-library': { itemIds: [], deliveryIds: [] }, 'queue-personal-skill-planning': { itemIds: [], deliveryIds: [] }, 'queue-direct-fix': { itemIds: [], deliveryIds: [] }
}

const routeFor = (category: SkillCategory, moduleCode: TraceEvaluationModuleCode, dimensionLabel: string): { label: V2RoutingLabel; destination: RoutingDestination; policyId: string; queueId: string } => {
  if (moduleCode === 'TOOL' || moduleCode === 'ACT') return { label: '策略迭代', destination: 'DIRECT_FIX', policyId: 'routing-policy-direct-fix', queueId: 'queue-direct-fix' }
  if (category === 'PRODUCTION_SKILL' && moduleCode === 'SKILL') return { label: '策略迭代', destination: 'ALGORITHM_BADCASE', policyId: 'routing-policy-production-skill', queueId: 'queue-algorithm-badcase' }
  if (category === 'TASTE_SKILL' && moduleCode === 'SKILL' && ['品味库召回错误', '品味库资产质量', '品味库资产不足'].includes(dimensionLabel)) return { label: 'Agent迭代', destination: 'TASTE_LIBRARY', policyId: 'routing-policy-taste-skill', queueId: 'queue-taste-library' }
  if (category === 'PERSONAL_SKILL') return { label: 'Agent迭代', destination: 'PERSONAL_SKILL_PLANNING', policyId: 'routing-policy-personal-skill', queueId: 'queue-personal-skill-planning' }
  return { label: 'Agent迭代', destination: 'AGENT_ITERATION', policyId: 'routing-policy-general', queueId: 'queue-agent-iteration' }
}

const v2CoreTraceIds = new Set(['trace-ppt-context', 'trace-ppt-generate', 'trace-tool-export', 'trace-multi-route'])
const v2GeneratedOnlyTraces = v2AllTraces.filter((trace) => !v2CoreTraceIds.has(trace.id))
const v2BatchTracePools = [
  v2GeneratedOnlyTraces.slice(0, 4),
  v2GeneratedOnlyTraces.slice(4, 10),
  v2GeneratedOnlyTraces.slice(10, 17),
  v2GeneratedOnlyTraces.slice(17, 25),
  [...v2AllTraces.filter((trace) => v2CoreTraceIds.has(trace.id)), ...v2GeneratedOnlyTraces.slice(25, 29)],
  v2GeneratedOnlyTraces.slice(29)
]
for (const [definitionIndex, definition] of V2_BATCH_DEFINITIONS.entries()) {
  const selectedTraces = v2BatchTracePools[definitionIndex] ?? []
  const jobCount = definition.status === 'FAILED' ? 2 : 1
  const jobsForBatch: EvaluationJob[] = []
  for (let attempt = 1; attempt <= jobCount; attempt += 1) {
    const jobStatus: EvaluationJobStatus = definition.status === 'DRAFT' ? 'QUEUED' : definition.status === 'QUEUED' ? 'QUEUED' : definition.status === 'RUNNING' ? 'RUNNING' : definition.status === 'PARTIAL' ? 'PARTIAL' : definition.status === 'COMPLETED' ? 'COMPLETED' : attempt === 1 ? 'FAILED' : 'QUEUED'
    const job = stamp({ id: `job-${definition.id}-${attempt}`, batchId: definition.id, attempt, status: jobStatus, traceIds: selectedTraces.map((trace) => trace.id), processedTraceIds: jobStatus === 'COMPLETED' ? selectedTraces.map((trace) => trace.id) : selectedTraces.slice(0, Math.max(0, Math.floor(selectedTraces.length / 2))).map((trace) => trace.id), failedTraceIds: jobStatus === 'FAILED' ? selectedTraces.map((trace) => trace.id) : [], evalAgentVersion: attempt === 1 ? 'eval-agent-2.4.0' : 'eval-agent-2.4.1', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', configurationSnapshot: { repeatCount: 3, source: 'structured-mock', retryOf: attempt > 1 ? `job-${definition.id}-1` : undefined }, errorReason: jobStatus === 'FAILED' ? 'Mock Eval Agent 超时，等待人工重试。' : undefined, queuedAt: definition.at, startedAt: jobStatus === 'QUEUED' ? undefined : definition.at, completedAt: jobStatus === 'COMPLETED' ? T5 : undefined }, definition.at, definition.at)
    jobsForBatch.push(job); evaluationJobs.push(job)
  }
  const packageIds: string[] = []
  const packageStats = { successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 0 }
  selectedTraces.forEach((trace, localIndex) => {
    const globalIndex = v2AllTraces.indexOf(trace) + 1
    const category = trace.skillCategory ?? (trace.id === 'trace-ppt-context' || trace.id === 'trace-ppt-generate' ? 'PRODUCTION_SKILL' : trace.id === 'trace-multi-route' ? 'TASTE_SKILL' : 'GENERAL')
    const packageId = `package-${trace.id}`
    packageIds.push(packageId)
    const packageStatus: TraceEvaluationPackage['status'] = definition.status === 'DRAFT' || definition.status === 'QUEUED' ? 'PENDING' : definition.status === 'FAILED' ? localIndex % 4 === 0 ? 'FAILED' : localIndex % 2 === 0 ? 'PARTIAL' : 'EVALUATED' : definition.status === 'PARTIAL' ? localIndex % 3 === 0 ? 'FAILED' : localIndex % 2 === 0 ? 'PARTIAL' : 'EVALUATED' : definition.status === 'RUNNING' ? 'PARTIAL' : 'EVALUATED'
    packageStats[packageStatus === 'EVALUATED' ? 'successCount' : packageStatus === 'PARTIAL' ? 'partialCount' : packageStatus === 'FAILED' ? 'failedCount' : 'pendingCount'] += 1
    const findingIds: string[] = []
    const routingDecisionIds: string[] = []
    const routingDeliveryIds: string[] = []
    const badcaseIds: string[] = []
    const moduleScores: ModuleEvaluationScore[] = []
    const coreStatus = (moduleCode: TraceEvaluationModuleCode): ModuleEvaluationStatus | undefined => {
      if (trace.id === 'trace-ppt-generate') return moduleCode === 'SKILL' || moduleCode === 'OUTCOME' ? 'FAIL' : moduleCode === 'CONTEXT' ? 'N/A' : 'PASS'
      if (trace.id === 'trace-tool-export') return moduleCode === 'TOOL' || moduleCode === 'OUTCOME' ? 'FAIL' : moduleCode === 'CONTEXT' ? 'N/A' : 'PASS'
      if (trace.id === 'trace-multi-route') return moduleCode === 'MEMORY' || moduleCode === 'REASON' || moduleCode === 'TOOL' || moduleCode === 'OUTCOME' ? 'FAIL' : moduleCode === 'CONTEXT' ? 'DERIVED_FAIL' : 'PASS'
      if (trace.id === 'trace-ppt-context') return moduleCode === 'MEMORY' ? 'FAIL' : moduleCode === 'CONTEXT' ? 'DERIVED_FAIL' : 'PASS'
      return undefined
    }
    const resolvedStatus = (moduleCode: TraceEvaluationModuleCode) => coreStatus(moduleCode) ?? statusForModule(globalIndex, moduleCode, definition.status, category)
    const firstFailureModule = V2_MODULE_ORDER.filter((moduleCode) => moduleCode !== 'CONTEXT').map((moduleCode) => ({ moduleCode, status: resolvedStatus(moduleCode) })).find((item) => item.status === 'FAIL')?.moduleCode
    V2_MODULE_ORDER.forEach((moduleCode) => {
      const status = resolvedStatus(moduleCode)
      const dimension = moduleDimension(moduleCode, category, globalIndex + localIndex)
      const score = status === 'PASS' ? Math.min(0.99, 0.76 + ((globalIndex + moduleCode.length) % 20) / 100) : status === 'FAIL' ? Math.max(0.08, 0.2 + ((globalIndex + moduleCode.length) % 35) / 100) : undefined
      const sourceObservation = v2AllObservations.find((observation) => observation.traceId === trace.id && (
        moduleCode === 'MEMORY' ? observation.nodeType === 'Memory'
          : moduleCode === 'REASON' ? observation.nodeType === 'Reason'
            : moduleCode === 'SKILL' ? observation.nodeType === 'Skill'
              : moduleCode === 'TOOL' ? observation.nodeType === 'Tool'
                : moduleCode === 'OUTCOME' ? observation.nodeType === 'Artifact'
                  : false
      )) ?? v2AllObservations.find((observation) => observation.id === trace.observationIds[0])
      const evidenceBundle = moduleEvidence(trace.id, trace.caseId, globalIndex, moduleCode, status, sourceObservation?.evidenceIds[0])
      if (sourceObservation) { evidenceBundle.observationIds = [sourceObservation.id]; evidenceBundle.logIds = [sourceObservation.logId] }
      if (v2CoreTraceIds.has(trace.id)) {
        evidenceBundle.rootEvidenceIds = sourceObservation?.evidenceIds ?? []
        evidenceBundle.rubricRule = `rubric-office-v2.1#${moduleCode.toLowerCase()}`
        evidenceBundle.completeness = evidenceBundle.rootEvidenceIds.length ? 'COMPLETE' : 'PARTIAL'
      }
      evidenceBundle.firstFailure = status === 'FAIL' && moduleCode === firstFailureModule
      const scoreRecord = stamp({ id: `module-score-${trace.id}-${moduleCode.toLowerCase()}`, packageId, traceId: trace.id, caseId: trace.caseId, moduleCode, moduleLabel: TRACE_MODULE_LABELS[moduleCode], automaticStatus: status, humanStatus: (status === 'FAIL' && globalIndex % 4 === 0 ? 'PASS' : undefined) as ModuleEvaluationStatus | undefined, score, judgeReason: status === 'FAIL' ? `${TRACE_MODULE_LABELS[moduleCode]} 命中失败 Rubric，需要查看根证据。` : status === 'DERIVED_FAIL' ? '由 Memory 首错传播的派生失败，仅作为证据展示。' : status === 'UNKNOWN' ? '本批次尚未完成该模块评测。' : status === 'N/A' ? '当前 Rubric 不覆盖该模块。' : `${TRACE_MODULE_LABELS[moduleCode]} 通过自动评测。`, evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', evidence: evidenceBundle, humanNote: status === 'FAIL' && globalIndex % 4 === 0 ? '人工复核后认为可接受，保留 Eval Disagreement。' : undefined, humanUpdatedAt: status === 'FAIL' && globalIndex % 4 === 0 ? T6 : undefined, humanUpdatedBy: status === 'FAIL' && globalIndex % 4 === 0 ? '质量运营' : undefined } as ModuleEvaluationScore, definition.at, definition.at)
      moduleScores.push(scoreRecord)
      if (status !== 'FAIL' || packageStatus === 'PENDING' || packageStatus === 'FAILED') return
      const findingId = `finding-${trace.id}-${moduleCode.toLowerCase()}`
      findingIds.push(findingId)
      const label = dimension.label
      const scenarioLabel = category === 'TASTE_SKILL' && moduleCode === 'SKILL' ? '批量用户偏好聚合' : category === 'PRODUCTION_SKILL' && moduleCode === 'REASON' ? 'SOP规划不合理' : category === 'PRODUCTION_SKILL' && moduleCode === 'SKILL' ? '生产 Skill 评测 Agent 返回场景' : moduleCode === 'TOOL' || moduleCode === 'ACT' ? '工具执行稳定性' : '模块评测 Agent 返回场景'
      const finding = stamp({ id: findingId, packageId, batchId: definition.id, caseId: trace.caseId, sessionId: trace.sessionId, traceId: trace.id, moduleCode, moduleLabel: TRACE_MODULE_LABELS[moduleCode], dimensionCode: dimension.code, dimensionLabel: label, description: dimension.description, scenarioCode: scenarioLabel === '批量用户偏好聚合' ? 'TASTE_PREFERENCE_COHORT' : scenarioLabel === 'SOP规划不合理' ? 'SOP_PLAN_UNREASONABLE' : 'EVAL_AGENT_FINDING', scenarioLabel, optimizationPath: category === 'TASTE_SKILL' ? 'Agent迭代 → 品味库聚类 → 候选变体' : category === 'PRODUCTION_SKILL' ? '策略迭代 → 算法 Badcase → 生产 Skill 修复' : '按模块进入对应治理队列', preferenceSignalId: category === 'TASTE_SKILL' && moduleCode === 'SKILL' ? 'taste-signal-red-style-2026w35' : undefined, optimizationDimension: moduleCode === 'TOOL' || moduleCode === 'ACT' ? '稳定性与回归验证' : '策略/Agent 能力优化', selectedOptimizationCondition: category === 'PRODUCTION_SKILL' ? 'Production Skill 失败' : category === 'TASTE_SKILL' ? '品味 Skill 失败' : undefined, taxonomyVersion: ATTRIBUTION_TAXONOMY_VERSION, labelSnapshot: label, legacyRawLabel: undefined, skillCategory: category, score, status: (globalIndex % 5 === 0 ? 'CONFIRMED' : 'OPEN') as EvaluationFinding['status'], firstFailure: evidenceBundle.firstFailure, derivedFailure: false, evidenceBundle, routingDecisionIds: [], routingDeliveryIds: [] } as unknown as EvaluationFinding, definition.at, definition.at)
      evaluationFindings.push(finding)
      const route = routeFor(category, moduleCode, label)
      const routeCandidates = (globalIndex % 8 === 0 || trace.id === 'trace-multi-route') && moduleCode === 'SKILL' ? [route, { label: 'Agent迭代' as const, destination: 'ISSUE_CLUSTER' as const, policyId: 'routing-policy-general', queueId: 'queue-agent-iteration' }] : [route]
      routeCandidates.forEach((routeCandidate, routeIndex) => {
        const decisionId = `routing-decision-${findingId}-${routeIndex + 1}`
        const deliveryId = `routing-delivery-${findingId}-${routeIndex + 1}`
        const decision = stamp({ id: decisionId, findingId, packageId, traceId: trace.id, policyId: routeCandidate.policyId, label: routeCandidate.label, destination: routeCandidate.destination, status: (globalIndex % 6 === 0 ? 'PENDING' : 'CONFIRMED') as RoutingDecision['status'], reason: routeCandidate.destination === 'ALGORITHM_BADCASE' ? 'Production Skill 失败，按策略迭代投递算法 Badcase Candidate。' : routeCandidate.destination === 'DIRECT_FIX' ? 'Tool/Act 确定性错误，进入直接修复与回归验证。' : '按 Skill Category 进入对应 Agent 迭代队列。', deliveryIds: [deliveryId] } as RoutingDecision, definition.at, definition.at)
        const deliveryStatus: RoutingDeliveryStatus = globalIndex % 6 === 0 ? 'PENDING' : globalIndex % 5 === 0 ? 'ACKNOWLEDGED' : 'QUEUED'
        const delivery = stamp({ id: deliveryId, findingId, decisionId, packageId, caseId: trace.caseId, traceId: trace.id, label: routeCandidate.label, destination: routeCandidate.destination, status: deliveryStatus, queueId: routeCandidate.queueId, owner: routeCandidate.destination === 'ALGORITHM_BADCASE' ? '算法团队（待确认）' : undefined, note: routeCandidate.destination === 'PERSONAL_SKILL_PLANNING' ? '二期规划入口，不调用生成服务。' : undefined, regressionDatasetId: routeCandidate.destination === 'DIRECT_FIX' ? 'dataset-regression' : undefined, deliveredAt: deliveryStatus !== 'PENDING' ? definition.at : undefined } as RoutingDelivery, definition.at, definition.at)
        const queue = queueItems[routeCandidate.queueId]
        routingDecisions.push(decision); routingDeliveries.push(delivery); routingDecisionIds.push(decisionId); routingDeliveryIds.push(deliveryId); queue.deliveryIds.push(deliveryId)
        finding.routingDecisionIds.push(decisionId); finding.routingDeliveryIds.push(deliveryId)
        if (routeCandidate.destination === 'ALGORITHM_BADCASE') {
          const badcaseId = `badcase-${findingId}`
          const badcase = stamp({ id: badcaseId, findingId, packageId, traceId: trace.id, deliveryId, queueId: routeCandidate.queueId, status: (globalIndex % 5 === 0 ? 'CONFIRMED' : 'CANDIDATE') as AlgorithmBadcaseItem['status'], title: `${trace.id} · ${TRACE_MODULE_LABELS[moduleCode]} 算法 Badcase`, owner: globalIndex % 5 === 0 ? '算法团队' : undefined, note: '自动评测产生，等待算法团队确认。', sourceEvidenceIds: [...(evidenceBundle.rootEvidenceIds)], confirmedBy: globalIndex % 5 === 0 ? '质量运营' : undefined, confirmedAt: globalIndex % 5 === 0 ? definition.at : undefined }, definition.at, definition.at)
          algorithmBadcases.push(badcase); badcaseIds.push(badcaseId); queue.itemIds.push(badcaseId); delivery.algorithmBadcaseId = badcaseId
        }
      })
    })
    const processScores = moduleScores.filter(score => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode) && score.score !== undefined)
    const outcomeScores = moduleScores.filter(score => score.moduleCode === 'OUTCOME' && score.score !== undefined)
    const rating: TraceRating | undefined = processScores.length || outcomeScores.length ? { scale: '0-2', rubric: `${trace.verticalScenario ?? '通用'} · ${category === 'TASTE_SKILL' ? '品味评测标准' : '过程模块评测标准'}`, processFinal: processScores.length ? Number((processScores.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / processScores.length).toFixed(2)) : undefined, outcomeFinal: outcomeScores.length ? Number((outcomeScores.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / outcomeScores.length).toFixed(2)) : undefined, processDimensions: processScores.map(score => ({ module: score.moduleCode, dimension: score.moduleLabel, score: score.score === undefined ? undefined : Number((score.score * 2).toFixed(2)), scoreId: score.id })), outcomeDimensions: outcomeScores.map(score => ({ dimension: score.moduleLabel, score: score.score === undefined ? undefined : Number((score.score * 2).toFixed(2)), evaluationId: score.id })) } : undefined
    const packageRecord = stamp({ id: packageId, batchId: definition.id, caseId: trace.caseId, sessionId: trace.sessionId, traceId: trace.id, query: v2AllCases.find((item) => item.id === trace.caseId)?.query ?? '', agentVersion: trace.agentVersion ?? v2AllCases.find((item) => item.id === trace.caseId)?.agentVersion ?? 'unknown', skillVersion: trace.skillVersion, skillIds: v2AllCases.find((item) => item.id === trace.caseId)?.skillIds ?? [], skillCategory: category, processCoverage: (packageStatus === 'PENDING' ? 'MISSING' : packageStatus === 'PARTIAL' ? 'PARTIAL' : packageStatus === 'FAILED' ? 'MISSING' : 'COMPLETE') as EvaluationCoverageStatus, outcomeCoverage: (packageStatus === 'PENDING' ? 'MISSING' : packageStatus === 'FAILED' ? 'MISSING' : globalIndex % 4 === 0 ? 'PARTIAL' : 'COMPLETE') as EvaluationCoverageStatus, status: packageStatus, moduleScores, findingIds, routingDecisionIds, routingDeliveryIds, badcaseIds, owner: v2AllCases.find((item) => item.id === trace.caseId)?.owner, revaluationJobIds: jobsForBatch.map((job) => job.id), rating } as TraceEvaluationPackage, definition.at, definition.at)
    tracePackages.push(packageRecord)
  })
  evaluationBatches.push(stamp({ id: definition.id, name: definition.name, status: definition.status, traceIds: selectedTraces.map((trace) => trace.id), packageIds, jobIds: jobsForBatch.map((job) => job.id), evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', createdBy: '质量运营 Demo', stats: { inputTraceCount: selectedTraces.length, ...packageStats }, errorReason: definition.status === 'FAILED' ? '首轮作业超时，已保留失败历史并生成重试作业。' : undefined, startedAt: definition.status === 'DRAFT' || definition.status === 'QUEUED' ? undefined : definition.at, completedAt: definition.status === 'COMPLETED' ? T5 : undefined }, definition.at, definition.at))
}

const badcaseQueues: BadcaseQueue[] = [
  stamp({ id: 'queue-algorithm-badcase', name: '算法 Badcase 队列', kind: 'ALGORITHM', itemIds: queueItems['queue-algorithm-badcase'].itemIds, deliveryIds: queueItems['queue-algorithm-badcase'].deliveryIds, owner: '算法团队', description: 'Production Skill 失败按策略迭代投递；Candidate 需人工确认后进入算法团队。' }),
  stamp({ id: 'queue-agent-iteration', name: 'Agent 迭代问题队列', kind: 'AGENT', itemIds: [], deliveryIds: queueItems['queue-agent-iteration'].deliveryIds, owner: 'Agent 团队', description: 'General / Unclassified 及聚类问题的 Agent 迭代入口。' }),
  stamp({ id: 'queue-taste-library', name: '品味库队列', kind: 'TASTE', itemIds: [], deliveryIds: queueItems['queue-taste-library'].deliveryIds, owner: '品味库团队', description: 'Taste Skill 失败进入品味库治理，按 Skill 计数。' }),
  stamp({ id: 'queue-personal-skill-planning', name: 'Personal Skill 二期规划队列', kind: 'PERSONAL_SKILL', itemIds: [], deliveryIds: queueItems['queue-personal-skill-planning'].deliveryIds, owner: '平台产品', description: '展示规划来源，不伪造个人 Skill 自动生成。' }),
  stamp({ id: 'queue-direct-fix', name: '确定性直接修复队列', kind: 'DIRECT_FIX', itemIds: [], deliveryIds: queueItems['queue-direct-fix'].deliveryIds, owner: 'Tool / Runtime 团队', description: 'Tool / Runtime 确定性错误需要关联回归验证。' })
]

const tastePreferenceSignals: TastePreferenceSignal[] = [
  stamp({
    id: 'taste-signal-red-style-2026w35', skillId: 'skill-taste-executive', windowId: 'window-2026w35', source: 'MOCK_SET',
    populationTotal: 1000, preferenceCount: 950, preferenceValue: '红色', preferenceRate: 0.95, feedbackCount: 1000,
    caseIds: generatedCases.filter((item) => item.labels.includes('批量偏好聚合')).map((item) => item.id), evidenceIds: generatedEvidence.filter((item) => item.caseId && generatedCases.some((candidate) => candidate.id === item.caseId && candidate.labels.includes('批量偏好聚合'))).map((item) => item.id),
    judgeReason: 'Eval Agent 聚合 1000 名去重用户反馈：950 名用户明确表达对红色管理层风格的偏好。该信号用于同 Skill 同场景的品味自进化候选，不直接视为 Badcase 或准出门禁。',
    routingLabel: 'Agent迭代', optimizationPath: 'Agent迭代 → 品味库相关数据积累 → 单变体实验 → 窗口组合验证', relatedDataCount: 37, relatedDataThreshold: 100
  }, T5, T6)
]

// Keep the top-level Case snapshot useful to legacy consumers while package
// selectors remain the source of truth for V2 evaluation status.
for (const pkg of tracePackages) {
  const sourceCase = v2AllCases.find((item) => item.id === pkg.caseId)
  if (!sourceCase || !sourceCase.id.startsWith('case-v2-') || !['EVALUATED', 'PARTIAL'].includes(pkg.status)) continue
  const processStatuses = pkg.moduleScores.filter((score) => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode)).map((score) => score.humanStatus ?? score.automaticStatus)
  const outcomeStatuses = pkg.moduleScores.filter((score) => score.moduleCode === 'OUTCOME').map((score) => score.humanStatus ?? score.automaticStatus)
  sourceCase.processStatus = processStatuses.includes('FAIL') ? 'FAIL' : processStatuses.includes('UNKNOWN') ? 'UNKNOWN' : 'PASS'
  sourceCase.resultStatus = outcomeStatuses.includes('FAIL') ? 'FAIL' : outcomeStatuses.includes('UNKNOWN') ? 'UNKNOWN' : 'PASS'
  sourceCase.status = sourceCase.resultStatus === 'FAIL' || sourceCase.processStatus === 'FAIL' ? 'IN_PROGRESS' : 'EVALUATED'
}

const buildSeedEvaluationSnapshot = (experiment: Experiment, capturedAt: string) => {
  const caseIds = [...new Set(experiment.configSnapshot.datasetVersions.flatMap((entry) => entry.caseIds ?? []))]
  const packages = tracePackages.filter((item) => (experiment.configSnapshot.tracePackageIds ?? []).includes(item.id) || caseIds.includes(item.caseId))
  const moduleEvaluations = packages.flatMap((item) => item.moduleScores).map((item) => copy(item))
  const artifactsForExperiment = artifacts.filter((item) => (experiment.configSnapshot.artifactIds ?? []).includes(item.id) || caseIds.includes(item.caseId)).map((item) => copy(item))
  const rootEvidence = evidence.filter((item) => (experiment.configSnapshot.evidenceBundleIds ?? []).includes(item.id) || moduleEvaluations.some((score) => score.evidence.rootEvidenceIds.includes(item.id))).map((item) => copy(item))
  const observationsForExperiment = observations.filter((item) => caseIds.includes(item.caseId)).map((item) => copy(item))
  const processForExperiment = processEvals.filter((item) => caseIds.includes(item.caseId)).map((item) => copy(item))
  const outcomeForExperiment = outcomeEvals.filter((item) => caseIds.includes(item.caseId)).map((item) => copy(item))
  return copy({ capturedAt, evalAgentVersion: experiment.configSnapshot.evalAgentVersion, rubricVersion: experiment.configSnapshot.rubricVersion, artifactIds: artifactsForExperiment.map((item) => item.id), evidenceBundleIds: rootEvidence.map((item) => item.id), tracePackageIds: packages.map((item) => item.id), moduleEvaluations, tracePackages: packages.map(({ id, batchId, caseId, sessionId, traceId, query, agentVersion, skillVersion, skillCategory }) => ({ id, batchId, caseId, sessionId, traceId, query, agentVersion, skillVersion, skillCategory })), artifacts: artifactsForExperiment, rootEvidence, observations: observationsForExperiment, processEvals: processForExperiment, outcomeEvals: outcomeForExperiment })
}

experiments.forEach((experiment) => {
  experiment.configSnapshot.evaluationSnapshot = buildSeedEvaluationSnapshot(experiment, experiment.configSnapshot.createdAt)
  const window = windows.find((item) => item.id === experiment.windowId)
  experimentRuns.filter((run) => run.experimentId === experiment.id).forEach((run) => {
    run.configSnapshot = copy(experiment.configSnapshot)
    run.evalSnapshot = copy(experiment.configSnapshot.evaluationSnapshot!)
    run.windowSnapshot = window ? copy({ windowId: window.id, candidateVariantIds: window.candidateVariantIds, cutoffAt: window.cutoffAt, frozenAt: window.frozenAt, nextWindowRule: window.nextWindowRule, nextWindowRuleId: window.nextWindowRuleId, nextWindowId: window.nextWindowId }) : undefined
  })
})

gateDecisions.forEach((decision) => {
  const experiment = experiments.find((item) => item.id === decision.experimentId)
  if (experiment) decision.reportSnapshot.configSnapshot = copy(experiment.configSnapshot)
  decision.reportSnapshot.runSnapshots = experimentRuns
    .filter((run) => run.experimentId === decision.experimentId)
    .map((run) => copy(run))
})

const allSkills = skills

const makeState = (): EvolutionState => ({
  schemaVersion: EVOLUTION_SCHEMA_VERSION, seedVersion: EVOLUTION_SEED_VERSION, isMockData: true, updatedAt: T6,
  sessions: v2AllSessions, cases: v2AllCases, traces: v2AllTraces, observations: v2AllObservations, evidence: v2AllEvidence, artifacts: v2AllArtifacts, processEvals, outcomeEvals, attributions, issues, issueClusters,
  skills: allSkills, assets, variants, datasets, experiments, experimentRuns, windows, gateDecisions, releases, rules,
  datasetSamplingSnapshots: [],
  evaluationBatches, evaluationJobs, tracePackages, evaluationFindings, routingPolicies, routingDecisions, routingDeliveries, algorithmBadcases, badcaseQueues, tastePreferenceSignals,
  auditTrail: [{ id: 'audit-seed-created', at: T0, actor: 'Demo Seeder', action: 'SEED_CREATED', entityType: 'EvolutionState', entityId: EVOLUTION_SEED_VERSION, reason: '创建结构化 Mock 演示数据；不代表真实线上指标。' }]
})

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const initialEvolutionData: EvolutionState = canonicalizeSeedIdentityState(enrichAssetManagementFixtures(enrichOverviewDashboardFixtures(enrichDatasetFilterFixtures(enrichModuleEvolutionFixtures(enrichArtifactOutcomeFixtures(enrichGovernanceGraphFixtures(enrichTraceGovernanceFixtures(addSkillWorkspaceFixtures(addScenarioFixtures(makeState()))))))))))
export const createInitialEvolutionData = (): EvolutionState => clone(initialEvolutionData)
/** Returns a fresh seed snapshot; persistence reset is provided by EvolutionRepository.reset. */
export const resetEvolutionData = (): EvolutionState => createInitialEvolutionData()
export { ASSET_CATALOG_KIND_LABELS, enrichAssetManagementFixtures, selectAssetCatalog, selectAssetEvolutionHistory, selectAssetMonthlyPerformance, selectAssetVersionMonthlyPerformance, selectAssetPerformance, selectAssetPerformanceSummaries, selectAssetVersions, validateAssetManagementState } from './data/assetManagement'
export type { AssetManagementFilters, AssetMonthlyPerformance, AssetVersionMonthlyPerformance, AssetPerformanceSummary } from './data/assetManagement'
