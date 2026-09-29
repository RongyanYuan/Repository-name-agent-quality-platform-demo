import type {
  Artifact, Asset, Attribution, AttributionRevision, Case, Dataset, EvaluationRevision, EvolutionState, Experiment, ExperimentMetric,
  ExperimentRun, GateDecision, Issue, IssueCluster, ObservationLog, OutcomeEval, ProcessEval, ReleaseVersion,
  RuleConfig, Session, Skill, Trace, Variant, Window
} from './domain'

export const EVOLUTION_SEED_VERSION = 'office-agent-governance-demo-1.0.0'
export const EVOLUTION_SCHEMA_VERSION = 1
const T0 = '2026-09-20T02:00:00.000Z'
const T1 = '2026-09-21T04:00:00.000Z'
const T2 = '2026-09-22T06:00:00.000Z'
const T3 = '2026-09-23T08:00:00.000Z'
const T4 = '2026-09-24T10:00:00.000Z'
const T5 = '2026-09-25T12:00:00.000Z'
const T6 = '2026-09-26T14:00:00.000Z'
const stamp = <T extends { id: string }>(value: T, createdAt = T0, updatedAt = createdAt): T & { createdAt: string; updatedAt: string } => ({ ...value, createdAt, updatedAt })

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
  stamp({ id: 'case-ppt-management', sessionId: 'session-ppt-management', title: '管理层经营 PPT 生成失败', query: '根据刚才的销售 Excel 生成一份面向管理层的季度经营 PPT。', scenario: 'PPT', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-ppt-builder'], traceIds: ['trace-ppt-context', 'trace-ppt-generate'], artifactIds: ['artifact-ppt-management'], processEvalIds: ['process-eval-ppt-recall'], outcomeEvalIds: ['outcome-eval-ppt-style'], attributionIds: ['attribution-skill-recall', 'attribution-style-mismatch'], issueIds: ['issue-skill-recall', 'issue-style-mismatch'], status: 'RESOLVED', resultStatus: 'FAIL', processStatus: 'FAIL', feedback: '信息可用，但不像管理层汇报。', owner: 'PPT 团队', labels: ['管理层汇报', '多轮任务'], multiScenario: true }),
  stamp({ id: 'case-tool-export', sessionId: 'session-tool-export', title: 'Excel 导出工具确定性失败', query: '导出筛选后的预算明细为 Excel。', scenario: 'Excel', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-spreadsheet'], traceIds: ['trace-tool-export'], artifactIds: [], processEvalIds: ['process-eval-tool-export'], outcomeEvalIds: ['outcome-eval-missing-file'], attributionIds: ['attribution-tool-export'], issueIds: ['issue-tool-export'], status: 'RESOLVED', resultStatus: 'FAIL', processStatus: 'FAIL', owner: 'Tool 团队', labels: ['确定性 Bug', '直接修复'], multiScenario: false }, T1, T5),
  stamp({ id: 'case-multi-route', sessionId: 'session-multi-route', title: '多归因、多路分发 Case', query: '沿用上轮预算表，补充风险分析并做成管理层 PPT。', scenario: '跨 Office', environment: 'Production', agentVersion: 'agent-2.5.0', skillIds: ['skill-spreadsheet', 'skill-ppt-builder'], traceIds: ['trace-multi-route'], artifactIds: ['artifact-multi-ppt'], processEvalIds: ['process-eval-memory', 'process-eval-reason'], outcomeEvalIds: ['outcome-eval-multi'], attributionIds: ['attribution-memory-context', 'attribution-reason-tool'], issueIds: ['issue-memory-context', 'issue-reason-tool'], status: 'IN_PROGRESS', resultStatus: 'FAIL', processStatus: 'FAIL', owner: 'General Agent', labels: ['多归因', '多路分发'], multiScenario: true }, T2, T6)
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
  stamp({ id: 'attribution-skill-recall', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-skill', module: 'Skill', dimension: '能力缺乏 / SOP 召回错误', evidenceIds: ['evidence-ppt-recall'], confidence: 0.94, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [
    attrRev('attr-rev-skill-auto', 'AUTOMATIC', 'Skill', 'SOP 错误', ['evidence-ppt-recall'], ['Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.78, '自动归因到 Skill SOP 召回。', T1, 'Attribution Agent'),
    attrRev('attr-rev-skill-human', 'HUMAN', 'Skill', '能力缺乏 / SOP 召回错误', ['evidence-ppt-recall'], ['Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.94, '人工确认管理层 SOP 召回不足。', T2, '李审核', 'attr-rev-skill-auto')
  ] }, T2),
  stamp({ id: 'attribution-style-mismatch', caseId: 'case-ppt-management', traceId: 'trace-ppt-generate', observationId: 'obs-ppt-artifact', module: 'Skill', dimension: '品味库召回错误', evidenceIds: ['evidence-ppt-style'], confidence: 0.89, source: 'HUMAN', confirmed: true, routingLabels: ['策略迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [attrRev('attr-rev-style-human', 'HUMAN', 'Skill', '品味库召回错误', ['evidence-ppt-style'], ['策略迭代'], 'CLUSTER_OPTIMIZATION', 0.89, '人工确认管理层风格资产召回错误。', T2, '李审核')] }, T2),
  stamp({ id: 'attribution-tool-export', caseId: 'case-tool-export', traceId: 'trace-tool-export', observationId: 'obs-tool-call', module: 'Act', dimension: '工具执行失败', evidenceIds: ['evidence-tool-error'], confidence: 1, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代'], optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', revisions: [attrRev('attr-rev-tool-human', 'HUMAN', 'Act', '工具执行失败', ['evidence-tool-error'], ['Agent 迭代'], 'DIRECT_FIX', 1, '确定性工具参数错误。', T2, 'Tool Owner')] }, T2),
  stamp({ id: 'attribution-memory-context', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-memory-miss', module: 'Memory', dimension: '准确率低', evidenceIds: ['evidence-memory-miss'], confidence: 0.91, source: 'HUMAN', confirmed: true, routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [attrRev('attr-rev-memory-human', 'HUMAN', 'Memory', '准确率低', ['evidence-memory-miss'], ['策略迭代', 'Agent 迭代'], 'CLUSTER_OPTIMIZATION', 0.91, '召回旧版本资产。', T3, '质量运营')] }, T3),
  stamp({ id: 'attribution-reason-tool', caseId: 'case-multi-route', traceId: 'trace-multi-route', observationId: 'obs-reason-tool', module: 'Reason', dimension: '选择不正确或低效', evidenceIds: ['evidence-reason-plan'], confidence: 0.86, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代', '策略迭代'], optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', revisions: [attrRev('attr-rev-reason-human', 'HUMAN', 'Reason', '选择不正确或低效', ['evidence-reason-plan'], ['Agent 迭代', '策略迭代'], 'DIRECT_FIX', 0.86, '规划跳过数据分析步骤。', T3, '质量运营')] }, T3)
]

const issues: Issue[] = [
  stamp({ id: 'issue-skill-recall', caseId: 'case-ppt-management', attributionId: 'attribution-skill-recall', title: '管理层 PPT SOP 召回不足', description: '管理层请求未稳定召回对应 SOP。', module: 'Skill', dimension: '能力缺乏 / SOP 召回错误', evidenceIds: ['evidence-ppt-recall'], routingLabels: ['Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'VERIFIED', owner: 'PPT Skill 团队', status: 'VERIFIED', clusterIds: ['cluster-ppt-routing-ready'], variantIds: ['variant-ppt-routing-v3'], processingChains: [{ id: 'chain-skill-agent', routingLabel: 'Agent 迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-ppt-routing-ready', status: 'VERIFIED', note: '路由问题进入达标问题簇并完成验证。' }] }, T2, T6),
  stamp({ id: 'issue-style-mismatch', caseId: 'case-ppt-management', attributionId: 'attribution-style-mismatch', title: '管理层风格匹配不足', description: '内容正确但管理层风格不匹配。', module: 'Skill', dimension: '品味库召回错误', evidenceIds: ['evidence-ppt-style'], routingLabels: ['策略迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'ASSIGNED', owner: 'PPT 设计团队', status: 'CONFIRMED', clusterIds: ['cluster-ppt-taste-pending'], variantIds: [], processingChains: [{ id: 'chain-style-strategy', routingLabel: '策略迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-ppt-taste-pending', status: 'IN_PROGRESS', note: '品味库相关 Case 仍在积累，未达到 100 条。' }] }, T2, T6),
  stamp({ id: 'issue-tool-export', caseId: 'case-tool-export', attributionId: 'attribution-tool-export', title: 'Excel 导出枚举写死', description: 'Skill 传入工具不支持的格式枚举。', module: 'Act', dimension: '工具执行失败', evidenceIds: ['evidence-tool-error'], routingLabels: ['Agent 迭代'], optimizationMode: 'DIRECT_FIX', responsibilityStatus: 'VERIFIED', owner: 'Tool 团队', status: 'VERIFIED', clusterIds: [], variantIds: ['variant-tool-retry-v2'], processingChains: [{ id: 'chain-tool-agent', routingLabel: 'Agent 迭代', destinationType: 'DIRECT_FIX', destinationId: 'variant-tool-retry-v2', status: 'VERIFIED', note: '确定性 Bug 直接修复并完成单变体验证。' }] }, T2, T5),
  stamp({ id: 'issue-memory-context', caseId: 'case-multi-route', attributionId: 'attribution-memory-context', title: '跨轮资产版本召回错误', description: '同一 Session 内未优先最新确认产物。', module: 'Memory', dimension: '准确率低', evidenceIds: ['evidence-memory-miss'], routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'ASSIGNED', owner: 'Memory 团队', status: 'FIXING', clusterIds: ['cluster-memory-version'], variantIds: ['variant-memory-latest'], processingChains: [{ id: 'chain-memory-strategy', routingLabel: '策略迭代', destinationType: 'ISSUE_CLUSTER', destinationId: 'cluster-memory-version', status: 'IN_PROGRESS', note: '进入跨轮召回问题簇。' }, { id: 'chain-memory-agent', routingLabel: 'Agent 迭代', destinationType: 'AGENT_BACKLOG', destinationId: 'variant-memory-latest', status: 'IN_PROGRESS', note: '形成 Memory 候选变体。' }] }, T3, T6),
  stamp({ id: 'issue-reason-tool', caseId: 'case-multi-route', attributionId: 'attribution-reason-tool', title: '跨 Office 任务跳过数据分析', description: '规划未强制先计算再生成汇报。', module: 'Reason', dimension: '选择不正确或低效', evidenceIds: ['evidence-reason-plan'], routingLabels: ['Agent 迭代', '策略迭代'], optimizationMode: 'DIRECT_FIX', responsibilityStatus: 'ASSIGNED', owner: 'Reason 团队', status: 'FIXING', clusterIds: [], variantIds: ['variant-reason-office-plan'], processingChains: [{ id: 'chain-reason-agent', routingLabel: 'Agent 迭代', destinationType: 'DIRECT_FIX', destinationId: 'variant-reason-office-plan', status: 'IN_PROGRESS', note: '直接形成规划策略修复。' }, { id: 'chain-reason-strategy', routingLabel: '策略迭代', destinationType: 'STRATEGY_BACKLOG', status: 'PLANNED', note: '同步进入策略迭代队列。' }] }, T3, T6)
]

const issueClusters: IssueCluster[] = [
  stamp({ id: 'cluster-ppt-routing-ready', name: '管理层 PPT 路由召回簇', description: '管理层 PPT 的 SOP 与 metadata 路由问题；已完成人工确认并形成变体。', module: 'Skill', dimension: 'name/description 错误', caseIds: ['case-ppt-management'], issueIds: ['issue-skill-recall'], evidenceIds: ['evidence-ppt-recall'], variantIds: ['variant-ppt-routing-v3'], status: 'VERIFIED', currentCount: 12, countingRule: '按人工确认的 Skill 路由问题 Case 去重；此类阈值待配置，由人工治理决策创建变体。' }, T3, T6),
  stamp({ id: 'cluster-ppt-taste-pending', name: '管理层 PPT 品味库召回簇', description: '只统计品味库召回错误，当前未达到 100 条触发条件。', module: 'Skill', dimension: '品味库召回错误', caseIds: ['case-ppt-management'], issueIds: ['issue-style-mismatch'], evidenceIds: ['evidence-ppt-style'], variantIds: [], status: 'COLLECTING', triggerRuleId: 'rule-taste-100', currentCount: 37, threshold: 100, countingRule: '按 Skill ID 去重：本地展开的已确认相关 Case + 同口径外部 Mock 快照；不足 100 条时禁止形成品味库变体。', tastePopulation: { skillId: 'skill-ppt-builder', externalMockConfirmedCaseCount: 36, snapshotId: 'mock-taste-ppt-builder-2026w35', source: 'Mock 品味库相关 Case 快照', countedAt: T6 } }, T3, T6),
  stamp({ id: 'cluster-memory-version', name: '跨轮资产版本错误簇', description: '同一 Session 内召回旧资产版本。', module: 'Memory', dimension: '准确率低', caseIds: ['case-multi-route'], issueIds: ['issue-memory-context'], evidenceIds: ['evidence-memory-miss'], variantIds: ['variant-memory-latest'], status: 'VARIANT_CREATED', currentCount: 4, countingRule: '按确认问题去重 Case；触发门槛待配置。' }, T4, T6)
]

const variants: Variant[] = [
  stamp({ id: 'variant-ppt-routing-v3', name: '管理层 PPT 路由增强', targetModule: 'Skill', changeType: 'SKILL_METADATA', changeSummary: '强化管理层、董事会等召回词。', changeContent: '更新 name/description，并加入 executive-report SOP 召回条件。', currentVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-2.6.0-rc.1', sourceCaseIds: ['case-ppt-management'], sourceIssueIds: ['issue-skill-recall'], sourceClusterIds: ['cluster-ppt-routing-ready'], evidenceIds: ['evidence-ppt-recall'], status: 'RELEASED', experimentIds: ['exp-single-ppt-routing', 'exp-window-2026w35'] }, T3, T6),
  stamp({ id: 'variant-tool-retry-v2', name: 'Excel 导出参数修复', targetModule: 'Act', changeType: 'TOOL_STABILITY', changeSummary: '修正枚举并增加调用前校验。', changeContent: 'xlsx 映射为 EXCEL_WORKBOOK；参数非法时禁止执行并返回可操作错误。', currentVersion: 'spreadsheet-2.5.0', candidateVersion: 'spreadsheet-2.5.1', sourceCaseIds: ['case-tool-export'], sourceIssueIds: ['issue-tool-export'], sourceClusterIds: [], evidenceIds: ['evidence-tool-error'], status: 'SINGLE_PASSED', experimentIds: ['exp-single-tool-retry'] }, T2, T5),
  stamp({ id: 'variant-memory-latest', name: 'Session 最新产物优先', targetModule: 'Memory', changeType: 'PROMPT_OR_POLICY', changeSummary: '同 Session 内已确认产物按版本与时间重排。', changeContent: '加入 confirmed、version、updatedAt 的排序特征。', currentVersion: 'memory-1.8.0', candidateVersion: 'memory-1.9.0-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: ['issue-memory-context'], sourceClusterIds: ['cluster-memory-version'], evidenceIds: ['evidence-memory-miss'], status: 'EXPERIMENTING', experimentIds: ['exp-single-memory-latest'] }, T4, T6),
  stamp({ id: 'variant-reason-office-plan', name: '跨 Office 前置分析策略', targetModule: 'Reason', changeType: 'PROMPT_OR_POLICY', changeSummary: '涉及数据与产物时强制先计算并校验来源。', changeContent: '新增 analyze -> validate -> compose 规划约束。', currentVersion: 'reason-3.1.0', candidateVersion: 'reason-3.1.1-rc.1', sourceCaseIds: ['case-multi-route'], sourceIssueIds: ['issue-reason-tool'], sourceClusterIds: [], evidenceIds: ['evidence-reason-plan'], status: 'READY', experimentIds: [] }, T4, T6)
]

const datasets: Dataset[] = [
  stamp({ id: 'dataset-attribution', name: '原始归因集', type: 'ATTRIBUTION', version: 'v1.4', caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], sampleCount: 3, source: 'Mock 治理确认 Case', scope: '来源问题的原始归因 Case', frozen: true, population: { totalSampleCount: 3, localCaseCount: 3, externalSampleCount: 0, sourceSystem: '本地结构化 Mock', countingRule: '按 Case ID 去重，三条样本全部在 Demo 展开。' } }, T3),
  stamp({ id: 'dataset-generalization', name: '同类泛化集', type: 'GENERALIZATION', version: 'v2.0', caseIds: ['case-ppt-management', 'case-multi-route'], sampleCount: 24, source: 'Mock 离线样本库', scope: '同类与相邻 Office 任务', frozen: true, population: { totalSampleCount: 24, localCaseCount: 2, externalSampleCount: 22, sourceSystem: 'Mock 离线样本库', countingRule: '2 条本地可追溯 Case + 22 条未在 Demo 展开的外部 Mock 样本。' } }, T3),
  stamp({ id: 'dataset-regression', name: '相邻及无关回归集', type: 'REGRESSION', version: 'v1.2', caseIds: ['case-tool-export'], sampleCount: 40, source: 'Mock Golden / Challenge Case', scope: '相邻能力与无关能力回归', frozen: true, population: { totalSampleCount: 40, localCaseCount: 1, externalSampleCount: 39, sourceSystem: 'Mock Golden / Challenge 样本库', countingRule: '1 条本地确定性 Bug Case + 39 条未展开的回归 Mock 样本。' } }, T3),
  stamp({ id: 'dataset-window-online', name: 'W35 窗口线上数据全集', type: 'WINDOW_ONLINE', version: '2026w35-r1', caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], sampleCount: 128, source: 'Mock 线上 Case 快照', timeRange: { from: T0, to: T6 }, scope: '窗口内生产环境全量 Case（演示）', frozen: true, population: { totalSampleCount: 128, localCaseCount: 3, externalSampleCount: 125, sourceSystem: 'Mock 线上窗口快照', countingRule: '窗口时间内 128 条去重 Case；Demo 展开其中 3 条完整链路。' } }, T4)
]

const metrics: ExperimentMetric[] = [
  { key: 'target_module', label: '目标模块评分', category: 'LOCAL', baselineMean: 0.61, candidateMean: 0.84, baselineStdDev: 0.08, candidateStdDev: 0.04, unit: 'score', gateStatus: 'PENDING' },
  { key: 'end_to_end', label: 'Case 最终结果有效率', category: 'END_TO_END', baselineMean: 0.68, candidateMean: 0.79, baselineStdDev: 0.06, candidateStdDev: 0.05, unit: 'rate', gateStatus: 'PENDING' },
  { key: 'generalization', label: '泛化集通过率', category: 'GENERALIZATION', baselineMean: 0.72, candidateMean: 0.78, baselineStdDev: 0.07, candidateStdDev: 0.06, unit: 'rate', gateStatus: 'PENDING' }
]
const config = (createdAt: string, datasetVersions: Array<Omit<Experiment['configSnapshot']['datasetVersions'][number], 'versionId'>>): Experiment['configSnapshot'] => ({ datasetVersions: datasetVersions.map((entry) => ({ ...entry, versionId: `${entry.datasetId}@${entry.version}` })), model: 'gpt-5.2-demo', toolPermissions: ['slides.render', 'sheets.read', 'sheets.export'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'isolated-demo-runner', createdAt })
const experiments: Experiment[] = [
  stamp({ id: 'exp-single-ppt-routing', name: '管理层 PPT 路由单变体实验', level: 'SINGLE_VARIANT', variantIds: ['variant-ppt-routing-v3'], windowId: 'window-2026w35', datasetIds: ['dataset-attribution', 'dataset-generalization', 'dataset-regression'], configSnapshot: config(T4, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: ['run-ppt-routing-1', 'run-ppt-routing-2', 'run-ppt-routing-3'], baselineVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-2.6.0-rc.1', metrics, failedCaseIds: [], rollbackItems: [], knownRisks: ['极短 query 的受众意图仍可能不明确'], status: 'DECIDED', gateDecisionId: 'gate-single-ppt-routing' }, T4, T5),
  stamp({ id: 'exp-single-tool-retry', name: 'Excel 导出直接修复验证', level: 'SINGLE_VARIANT', variantIds: ['variant-tool-retry-v2'], windowId: 'window-2026w35', datasetIds: ['dataset-attribution', 'dataset-regression'], configSnapshot: config(T3, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: ['run-tool-1', 'run-tool-2', 'run-tool-3'], baselineVersion: 'spreadsheet-2.5.0', candidateVersion: 'spreadsheet-2.5.1', metrics, failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'DECIDED', gateDecisionId: 'gate-single-tool' }, T3, T5),
  stamp({ id: 'exp-single-memory-latest', name: 'Session 最新产物优先实验', level: 'SINGLE_VARIANT', variantIds: ['variant-memory-latest'], windowId: 'window-2026w36', datasetIds: ['dataset-attribution', 'dataset-generalization', 'dataset-regression'], configSnapshot: config(T6, [{ datasetId: 'dataset-attribution', version: 'v1.4', sampleCount: 3 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }, { datasetId: 'dataset-regression', version: 'v1.2', sampleCount: 40 }]), runIds: [], baselineVersion: 'memory-1.8.0', candidateVersion: 'memory-1.9.0-rc.1', metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['跨 Session 复用策略待验证'], status: 'QUEUED' }, T6),
  stamp({ id: 'exp-window-2026w35', name: 'W35 窗口组合实验', level: 'WINDOW_COMBINATION', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], windowId: 'window-2026w35', datasetIds: ['dataset-window-online', 'dataset-generalization'], configSnapshot: config(T5, [{ datasetId: 'dataset-window-online', version: '2026w35-r1', sampleCount: 128 }, { datasetId: 'dataset-generalization', version: 'v2.0', sampleCount: 24 }]), runIds: [], baselineVersion: 'agent-2.5.0', candidateVersion: 'agent-3.0.0-rc.1', metrics, failedCaseIds: [], rollbackItems: ['若管理层 PPT 有效率下降则回退全部组合'], knownRisks: ['组合后路由权重变化需观察'], status: 'DECIDED', gateDecisionId: 'gate-window-2026w35' }, T5, T6)
]

const experimentRunSpec: Record<string, { caseIds: string[]; configHash: string; status: ExperimentRun['status']; createdAt: string; updatedAt: string; baseline: [number, number, number]; candidate: [number, number, number]; duration: number }> = {
  'exp-single-ppt-routing': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-ppt-route-a91', status: 'COMPLETED', createdAt: T4, updatedAt: T5, baseline: [0.58, 0.62, 0.63], candidate: [0.82, 0.83, 0.84], duration: 61000 },
  'exp-single-tool-retry': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-tool-fix-b22', status: 'COMPLETED', createdAt: T3, updatedAt: T5, baseline: [0, 0, 0], candidate: [1, 1, 1], duration: 6800 },
  'exp-window-2026w35': { caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], configHash: 'cfg-window-w35-e77', status: 'COMPLETED', createdAt: T5, updatedAt: T6, baseline: [0.66, 0.68, 0.70], candidate: [0.77, 0.79, 0.81], duration: 72000 }
}
const experimentRuns: ExperimentRun[] = Object.entries(experimentRunSpec).flatMap(([experimentId, spec]) => spec.caseIds.flatMap((caseId) => (['BASELINE', 'CANDIDATE'] as const).flatMap((arm) => [1, 2, 3].map((repetition): ExperimentRun => {
  const score = spec[arm === 'BASELINE' ? 'baseline' : 'candidate'][repetition - 1]
  return stamp({ id: `run-${experimentId}-${caseId}-${arm.toLowerCase()}-${repetition}`, experimentId, caseId, repetition, arm, status: spec.status, processScore: spec.status === 'COMPLETED' ? score : undefined, outcomeScore: spec.status === 'COMPLETED' ? Math.max(0, score - 0.03) : undefined, durationMs: spec.status === 'COMPLETED' ? spec.duration + repetition * 100 : 0, configHash: spec.configHash }, spec.createdAt, spec.updatedAt)
}))))

experiments.forEach((experiment) => {
  experiment.runIds = experimentRuns.filter((run) => run.experimentId === experiment.id).map((run) => run.id)
})
const gateSnapshot = (experimentId: string, evidenceIds: string[]): GateDecision['reportSnapshot'] => {
  const experiment = experiments.find((item) => item.id === experimentId)!
  return { experimentId, variantIds: [...experiment.variantIds], datasetVersions: experiment.configSnapshot.datasetVersions.map(({ datasetId, version }) => ({ datasetId, version })), metricResults: experiment.metrics.map((metric) => ({ ...metric })), configSnapshot: JSON.parse(JSON.stringify(experiment.configSnapshot)) as Experiment['configSnapshot'], runSnapshots: experimentRuns.filter((run) => run.experimentId === experimentId).map((run) => ({ ...run })), failedCaseIds: [...experiment.failedCaseIds], rollbackItems: [...experiment.rollbackItems], knownRisks: [...experiment.knownRisks], evidenceIds }
}

const windows: Window[] = [
  stamp({ id: 'window-2026w35', name: '2026 W35 能力窗口', timeRange: { from: T0, to: T6 }, candidateVariantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'], singleExperimentIds: ['exp-single-ppt-routing', 'exp-single-tool-retry'], combinationExperimentId: 'exp-window-2026w35', status: 'RELEASED' }, T3, T6),
  stamp({ id: 'window-2026w36', name: '2026 W36 能力窗口', timeRange: { from: T6, to: '2026-10-03T14:00:00.000Z' }, candidateVariantIds: ['variant-memory-latest', 'variant-reason-office-plan'], singleExperimentIds: ['exp-single-memory-latest'], status: 'EXPERIMENTING' }, T6)
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

const skills: Skill[] = [
  stamp({ id: 'skill-ppt-builder', name: 'PPT Builder', type: 'OFFICIAL', version: '2.6.0', visibility: 'PUBLIC', evolutionRecordIds: ['variant-ppt-routing-v3'], assetIds: ['asset-executive-template'], generationStatus: 'AVAILABLE' }),
  stamp({ id: 'skill-spreadsheet', name: 'Spreadsheet Analyst', type: 'OFFICIAL', version: '2.5.1', visibility: 'PUBLIC', evolutionRecordIds: ['variant-tool-retry-v2'], assetIds: [], generationStatus: 'AVAILABLE' }),
  stamp({ id: 'skill-personal-planned', name: '个人汇报 Skill（规划）', type: 'PERSONAL', version: '未生成', visibility: 'PRIVATE', evolutionRecordIds: [], assetIds: ['asset-user-template'], generationStatus: 'PLANNED' }, T4)
]
const assets: Asset[] = [
  stamp({ id: 'asset-executive-template', name: '管理层决策摘要模板库', kind: 'TASTE_LIBRARY', ownerId: 'PPT 团队', visibility: 'PUBLIC', skillIds: ['skill-ppt-builder'], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED' }),
  stamp({ id: 'asset-user-template', name: '用户个人汇报模板', kind: 'TEMPLATE', ownerId: 'user-demo-c', visibility: 'PRIVATE', skillIds: ['skill-personal-planned'], sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED' }, T4)
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

const makeState = (): EvolutionState => ({
  schemaVersion: EVOLUTION_SCHEMA_VERSION, seedVersion: EVOLUTION_SEED_VERSION, isMockData: true, updatedAt: T6,
  sessions, cases, traces, observations, evidence, artifacts, processEvals, outcomeEvals, attributions, issues, issueClusters,
  skills, assets, variants, datasets, experiments, experimentRuns, windows, gateDecisions, releases, rules,
  auditTrail: [{ id: 'audit-seed-created', at: T0, actor: 'Demo Seeder', action: 'SEED_CREATED', entityType: 'EvolutionState', entityId: EVOLUTION_SEED_VERSION, reason: '创建结构化 Mock 演示数据；不代表真实线上指标。' }]
})

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const initialEvolutionData: EvolutionState = makeState()
export const createInitialEvolutionData = (): EvolutionState => clone(initialEvolutionData)
/** Returns a fresh seed snapshot; persistence reset is provided by EvolutionRepository.reset. */
export const resetEvolutionData = (): EvolutionState => createInitialEvolutionData()
