import { TRACE_MODULE_LABELS } from '../domain'
import type { Artifact, Case, EvolutionState, ModuleEvaluationScore, OutcomeEval, ProcessEval, Trace, TraceChannel, TraceEvaluationModuleCode, UserAcceptanceStatus, VerticalScenario } from '../domain'

type DiscreteScore = 0 | 1 | 2
type ProcessModule = Extract<TraceEvaluationModuleCode, 'REASON' | 'MEMORY' | 'SKILL' | 'ACT'>
interface OverviewFixture {
  key: string
  scenario: VerticalScenario
  skillId: string
  skillVersion: string
  queryAt: string
  query: string
  response: string
  finalScore: DiscreteScore
  finalReason: string
  moduleScores: Record<ProcessModule, DiscreteScore>
  moduleReasons: Record<ProcessModule, string>
  acceptance: UserAcceptanceStatus
  channel: TraceChannel
  onlineAfterRelease?: true
}

const BATCH_ID = 'batch-overview-discrete-scores'
const JOB_ID = 'job-overview-discrete-scores'
const EVAL_AGENT = 'Mock Eval Agent · authored 0–2'
const RUBRIC_VERSION = 'mock-office-score-0-2-v1'
const MODULES: ProcessModule[] = ['REASON', 'MEMORY', 'SKILL', 'ACT']
const MODULE_DIMENSIONS: Record<ProcessModule, string> = {
  REASON: '没有充分响应用户query的客观诉求',
  MEMORY: '准确率低',
  SKILL: 'skill sop错误',
  ACT: '工具未执行成功'
}

/** Authored responses, not converted pass/fail values or inferred thresholds. */
const fixtures: readonly OverviewFixture[] = [
  {
    key: 'ppt-0', scenario: 'PPT', skillId: 'skill-ppt-builder', skillVersion: '2.5.0', queryAt: '2026-09-21T03:00:00.000Z',
    query: '根据销售表生成管理层经营 PPT，第一页必须给出三项决策建议。', response: 'Mock 生成了仅含数据表格的 PPT 草稿，第一页没有决策建议。',
    finalScore: 0, finalReason: 'Mock 产物遗漏用户明确要求的三项决策建议；这是独立记录的最终 0 分，非按细项均值计算。',
    moduleScores: { REASON: 0, MEMORY: 1, SKILL: 2, ACT: 0 },
    moduleReasons: { REASON: '规划只保留了销售数据展示，漏掉三项决策建议这一客观诉求。', MEMORY: '召回了正确销售表，但保留了一条未失效的员工版受众偏好。', SKILL: '已正确加载 PPT SOP，并按读取、校验、渲染顺序执行。', ACT: '图表写入节点首次执行失败且未恢复，返回不完整的草稿。' },
    acceptance: 'REJECTED', channel: 'genflow pc 端'
  },
  {
    key: 'ppt-1', scenario: 'PPT', skillId: 'skill-ppt-builder', skillVersion: '2.6.0', queryAt: '2026-09-24T02:00:00.000Z',
    query: '制作一份含经营风险和下一季度行动计划的董事会 PPT。', response: 'Mock 已生成风险摘要，行动计划仅列出目标，没有责任人与完成时间。',
    finalScore: 1, finalReason: 'Mock 已满足风险摘要，行动计划细节仍不完整；最终 1 分由 Mock Eval Agent 明确返回。',
    moduleScores: { REASON: 1, MEMORY: 2, SKILL: 0, ACT: 1 },
    moduleReasons: { REASON: '识别董事会受众和风险要求，但未把行动计划拆为责任人与时间。', MEMORY: '召回的经营数据与用户提供的季度和公司一致。', SKILL: 'SOP 将行动页渲染安排在行动字段生成前，后续字段未回填。', ACT: '渲染首次超时，按规则重试后成功；保留一次恢复过程。' },
    acceptance: 'UNKNOWN', channel: 'genflow 垂类入口'
  },
  {
    key: 'ppt-2', scenario: 'PPT', skillId: 'skill-ppt-builder', skillVersion: '2.6.0-rc.1', queryAt: '2026-09-27T03:00:00.000Z',
    query: '生成管理层季度经营 PPT，先呈现结论，再给出数据依据和三项行动。', response: 'Mock 已生成结论先行的经营 PPT，并附三项行动及对应销售依据。',
    finalScore: 2, finalReason: 'Mock 交付物包含结论、数据依据与三项行动，用户已明确接受；独立最终评分为 2。',
    moduleScores: { REASON: 2, MEMORY: 0, SKILL: 1, ACT: 2 },
    moduleReasons: { REASON: '规划完整保留结论先行、数据依据和三项行动要求。', MEMORY: '首次召回旧表版本，随后通过用户本轮附件重新取得正确数据；模块原始评分仍记录为 0。', SKILL: '管理层路由候选已加载，图表样式仍需一次格式回填。', ACT: '工具参数与超时规则均按计划执行，最终导出成功。' },
    acceptance: 'ACCEPTED', channel: '小程序', onlineAfterRelease: true
  },
  {
    key: 'word-0', scenario: 'Word', skillId: 'skill-word-builder', skillVersion: '1.4.0', queryAt: '2026-09-21T04:00:00.000Z',
    query: '将采购合同的付款风险整理为 Word，必须逐项引用原始条款。', response: 'Mock 文档只给出通用建议，引用的条款编号与原始合同不一致。',
    finalScore: 0, finalReason: 'Mock 文档没有提供可核验的原始条款引用，最终评分明确为 0。',
    moduleScores: { REASON: 1, MEMORY: 2, SKILL: 0, ACT: 1 },
    moduleReasons: { REASON: '理解付款风险主题，但仅在规划中保留了摘要，未逐项要求引用。', MEMORY: '正确召回本次采购合同与付款条款。', SKILL: '引用校验 SOP 在文档渲染后才执行，错误编号未修正。', ACT: '渲染节点重试成功，生成文件仍缺少一次引用回写。' },
    acceptance: 'REJECTED', channel: '小程序'
  },
  {
    key: 'word-1', scenario: 'Word', skillId: 'skill-word-builder', skillVersion: '1.4.0', queryAt: '2026-09-24T03:00:00.000Z',
    query: '把会议纪要整理为 Word，列出每个行动项的负责人和日期。', response: 'Mock 会议纪要已整理，两个行动项的日期仍为空。',
    finalScore: 1, finalReason: 'Mock 主要内容与负责人完整，两个日期字段缺失，独立最终评分为 1。',
    moduleScores: { REASON: 2, MEMORY: 0, SKILL: 1, ACT: 2 },
    moduleReasons: { REASON: '规划明确保留行动项、负责人和日期三个字段。', MEMORY: '未召回上一轮已确认的两个截止日期，模块记录原始 0 分。', SKILL: '会议纪要 SOP 已执行，但没有在渲染前检查空日期字段。', ACT: '读取与 Word 写入工具均执行成功，无重试。' },
    acceptance: 'UNKNOWN', channel: 'genflow pc 端'
  },
  {
    key: 'word-2', scenario: 'Word', skillId: 'skill-word-builder', skillVersion: '1.4.0', queryAt: '2026-09-27T02:00:00.000Z',
    query: '生成两页项目复盘 Word，保留事实、原因和三项可执行改进。', response: 'Mock 已生成两页复盘，事实和原因可追溯，三项改进均有负责人。',
    finalScore: 2, finalReason: 'Mock 文件满足两页、事实原因和三项改进要求，用户已接受；最终评分明确为 2。',
    moduleScores: { REASON: 0, MEMORY: 1, SKILL: 2, ACT: 0 },
    moduleReasons: { REASON: '初始规划误选为项目计划，后续用户确认纠正方向；保留首次规划 0 分。', MEMORY: '正确召回项目事实，但一条重复会议记录需要去重。', SKILL: '复盘 SOP 对事实、原因和改进项做了完整校验。', ACT: '首次导出失败，恢复任务最终生成文件；原始执行节点评分仍为 0。' },
    acceptance: 'ACCEPTED', channel: 'genflow 垂类入口'
  },
  {
    key: 'excel-0', scenario: 'Excel', skillId: 'skill-spreadsheet', skillVersion: '2.5.0', queryAt: '2026-09-22T02:00:00.000Z',
    query: '生成五个区域的预算 Excel，保留公式并核对合计。', response: 'Mock 工作簿遗漏华南区域，合计公式引用范围不完整。',
    finalScore: 0, finalReason: 'Mock 缺少一个区域且合计公式错误，独立最终评分为 0。',
    moduleScores: { REASON: 2, MEMORY: 0, SKILL: 1, ACT: 2 },
    moduleReasons: { REASON: '规划正确识别五个区域与保留公式要求。', MEMORY: '召回四区域旧版预算，而不是本轮五区域预算。', SKILL: '数据汇总 SOP 执行了公式校验，但未比较区域总数。', ACT: '读取、计算和导出均成功，文件错误来源于上游输入。' },
    acceptance: 'REJECTED', channel: 'genflow 垂类入口'
  },
  {
    key: 'excel-1', scenario: 'Excel', skillId: 'skill-spreadsheet', skillVersion: '2.5.1', queryAt: '2026-09-25T02:00:00.000Z',
    query: '整理销售 Excel 并标出异常值，不能改变原有公式。', response: 'Mock 已保留公式并整理销售数据，其中一行异常值未高亮。',
    finalScore: 1, finalReason: 'Mock 文件可用且公式保留，一项异常值标记缺失；明确返回最终 1 分。',
    moduleScores: { REASON: 0, MEMORY: 1, SKILL: 2, ACT: 0 },
    moduleReasons: { REASON: '首次规划只整理数据，没有安排异常值检查。', MEMORY: '召回正确销售表，包含一条需要核验的历史异常标记。', SKILL: '公式保护 SOP 完整执行，没有覆盖原公式。', ACT: '高亮写入节点执行失败，数据导出恢复完成但未修复该标记。' },
    acceptance: 'UNKNOWN', channel: '小程序'
  },
  {
    key: 'excel-2', scenario: 'Excel', skillId: 'skill-spreadsheet', skillVersion: '2.5.1', queryAt: '2026-09-27T01:00:00.000Z',
    query: '导出已筛选的预算明细 Excel，仅包含 A1:F120。', response: 'Mock 已导出 A1:F120，保留表头、金额格式与可追溯合计。',
    finalScore: 2, finalReason: 'Mock 导出范围与格式符合明确要求，用户已接受；产物最终评分为 2。',
    moduleScores: { REASON: 1, MEMORY: 2, SKILL: 0, ACT: 1 },
    moduleReasons: { REASON: '选择了正确导出范围，但增加一次不必要的全表预读。', MEMORY: '召回当前筛选状态和本轮预算文件，匹配准确。', SKILL: '旧 SOP 使用错误导出枚举，恢复分支改用受支持参数；保留原始 SOP 0 分。', ACT: '一次工具调用被拒绝，按规则恢复后成功导出。' },
    acceptance: 'ACCEPTED', channel: 'genflow pc 端'
  },
  {
    key: 'image-0', scenario: '生图', skillId: 'skill-canvas-builder', skillVersion: '0.8.0', queryAt: '2026-09-22T03:00:00.000Z',
    query: '生成红色背景的产品海报，标题必须在左上角。', response: 'Mock 图像使用蓝色背景，标题位于中部。',
    finalScore: 0, finalReason: 'Mock 背景色与标题位置都不符合用户明确要求，最终评分记录为 0。',
    moduleScores: { REASON: 0, MEMORY: 1, SKILL: 2, ACT: 0 },
    moduleReasons: { REASON: '图像规划遗漏红色背景与标题位置两个约束。', MEMORY: '召回产品素材正确，但混入旧版蓝色品牌偏好。', SKILL: '海报布局 SOP 文件可加载且结构校验执行完成。', ACT: '生成节点参数提交失败后降级为默认图像，未恢复指定约束。' },
    acceptance: 'REJECTED', channel: 'genflow pc 端'
  },
  {
    key: 'image-1', scenario: '生图', skillId: 'skill-canvas-builder', skillVersion: '0.8.0', queryAt: '2026-09-25T03:00:00.000Z',
    query: '生成医疗产品深红风格宣传图，正文应清晰可读。', response: 'Mock 已采用深红配色，正文中的两行文字对比度不足。',
    finalScore: 1, finalReason: 'Mock 配色与场景符合要求，正文可读性仍有缺失；最终评分明确为 1。',
    moduleScores: { REASON: 1, MEMORY: 2, SKILL: 0, ACT: 1 },
    moduleReasons: { REASON: '理解医疗与深红风格，未明确安排放映尺寸可读性检查。', MEMORY: '正确召回用户提供的医疗产品素材与品牌色。', SKILL: '布局 SOP 省略文字对比度检查，正文问题未发现。', ACT: '生成节点首次超时，按规则重试后得到图像。' },
    acceptance: 'UNKNOWN', channel: 'genflow 垂类入口'
  },
  {
    key: 'image-2', scenario: '生图', skillId: 'skill-canvas-builder', skillVersion: '0.8.0', queryAt: '2026-09-26T03:00:00.000Z',
    query: '生成一张白底红色点缀的经营报告封面，保留公司名称和日期。', response: 'Mock 已生成白底红色点缀封面，公司名称与日期均准确保留。',
    finalScore: 2, finalReason: 'Mock 封面颜色、公司名称和日期满足明确约束，用户已接受；最终评分独立记录为 2。',
    moduleScores: { REASON: 2, MEMORY: 0, SKILL: 1, ACT: 2 },
    moduleReasons: { REASON: '完整识别白底、红色点缀、公司名称和日期要求。', MEMORY: '首次召回旧日期，后续使用本轮 Query 的明确日期替换；模块仍保留原始 0 分。', SKILL: '封面 SOP 正常执行，但名称字段需要一次人工对齐回填。', ACT: '生成、尺寸检查与文件导出均执行成功。' },
    acceptance: 'ACCEPTED', channel: '小程序'
  }
]

export const OVERVIEW_SCORE_FIXTURE_CASE_IDS = fixtures.map(item => `case-overview-${item.key}`)

/** Adds complete authored examples without changing prior ledgers, manual edits,
 * frozen reports, releases, or the immutable Query reference timestamp. */
export function enrichOverviewDashboardFixtures(input: EvolutionState): EvolutionState {
  const state: EvolutionState = { ...input, sessions: [...input.sessions], cases: [...input.cases], traces: [...input.traces], observations: [...input.observations], artifacts: [...input.artifacts], evidence: [...input.evidence], processEvals: [...input.processEvals], outcomeEvals: [...input.outcomeEvals], tracePackages: [...input.tracePackages], evaluationBatches: [...input.evaluationBatches], evaluationJobs: [...input.evaluationJobs] }
  for (const fixture of fixtures) {
    const caseId = `case-overview-${fixture.key}`
    if (state.cases.some(item => item.id === caseId)) continue
    const traceId = `trace-overview-${fixture.key}`, sessionId = `session-overview-${fixture.key}`, artifactId = `artifact-overview-${fixture.key}`
    const packageId = `package-overview-${fixture.key}`, outcomeId = `outcome-overview-${fixture.key}-final`, outcomeEvidenceId = `evidence-overview-${fixture.key}-final`
    const endedAt = new Date(Date.parse(fixture.queryAt) + 30000).toISOString()
    const evaluatedAt = new Date(Date.parse(fixture.queryAt) + 45000).toISOString()
    const base = { createdAt: fixture.queryAt, updatedAt: evaluatedAt }
    const moduleScores: ModuleEvaluationScore[] = []
    const processEvalIds: string[] = []
    const observationIds: string[] = []
    for (const [index, module] of MODULES.entries()) {
      const key = `${fixture.key}-${module.toLowerCase()}`, observationId = `obs-overview-${key}`, evidenceId = `evidence-overview-${key}`, processId = `process-overview-${key}`, revisionId = `automatic-overview-${key}`
      const score = fixture.moduleScores[module]
      const reason = `手写 Mock 返回：${fixture.moduleReasons[module]}`
      const rubricRule = `${RUBRIC_VERSION}#${module.toLowerCase()} · ${MODULE_DIMENSIONS[module]}；演示分数直接取 Eval Agent Mock 返回值，业务门禁待配置。`
      const nodeType = module === 'MEMORY' ? 'Memory' : module === 'SKILL' ? 'Skill' : module === 'REASON' ? 'Reason' : 'Act'
      state.observations.push({ id: observationId, traceId, caseId, sequence: index + 1, nodeType, name: `${TRACE_MODULE_LABELS[module]} 执行记录（Mock）`, input: fixture.query, output: fixture.moduleReasons[module], status: 'SUCCEEDED', skillId: module === 'SKILL' ? fixture.skillId : undefined, toolName: module === 'ACT' ? 'office.mock-render' : undefined, latencyMs: 5000, retryCount: module === 'ACT' && score < 2 ? 1 : 0, evidenceIds: [evidenceId], logId: `log-overview-${key}`, ...base })
      state.evidence.push({ id: evidenceId, caseId, traceId, observationId, kind: 'LOG', title: `${TRACE_MODULE_LABELS[module]} · 根证据（Mock）`, content: fixture.moduleReasons[module], source: '手写 Mock 执行日志，非真实线上数据', ...base })
      const evaluation: ProcessEval = { id: processId, caseId, traceId, observationId, type: 'PROCESS', dimension: MODULE_DIMENSIONS[module], evalVersion: RUBRIC_VERSION, verdict: 'UNKNOWN', score, evidenceIds: [evidenceId], revisions: [{ id: revisionId, source: 'AUTOMATIC', score, scoreScale: '0-2', verdict: 'UNKNOWN', reason, evidenceIds: [evidenceId], evaluator: EVAL_AGENT, evaluatedAt, evalVersion: RUBRIC_VERSION, evalAgentVersion: EVAL_AGENT, rubricRule }], ...base }
      state.processEvals.push(evaluation)
      moduleScores.push({ id: `module-score-overview-${key}`, automaticRevisionId: revisionId, packageId, traceId, caseId, moduleCode: module, moduleLabel: TRACE_MODULE_LABELS[module], automaticStatus: 'UNKNOWN', score, scoreScale: '0-2', judgeReason: reason, evalAgentVersion: EVAL_AGENT, rubricVersion: RUBRIC_VERSION, evidence: { rootEvidenceIds: [evidenceId], observationIds: [observationId], logIds: [`log-overview-${key}`], artifactIds: [artifactId], rubricRule, inputSummary: fixture.query, outputSummary: fixture.moduleReasons[module], firstFailure: false, derivedFailure: false, completeness: 'COMPLETE' }, ...base })
      processEvalIds.push(processId); observationIds.push(observationId)
    }
    const artifact: Artifact = { id: artifactId, caseId, traceId, name: `${fixture.scenario} 治理大盘样例 ${fixture.finalScore}${fixture.scenario === '生图' ? '.png' : fixture.scenario === 'PPT' ? '.pptx' : fixture.scenario === 'Word' ? '.docx' : '.xlsx'}`, kind: fixture.scenario === '生图' ? 'Other' : fixture.scenario, verticalScenario: fixture.scenario, uri: `mock://${artifactId}`, version: 'mock-v1', status: fixture.finalScore === 0 ? 'INVALID' : 'AVAILABLE', evidenceIds: [outcomeEvidenceId], ...base }
    state.artifacts.push(artifact)
    state.evidence.push({ id: outcomeEvidenceId, caseId, traceId, artifactId, kind: 'ARTIFACT', title: `${fixture.scenario} · 最终产物根证据（Mock）`, content: fixture.finalReason, source: '手写 Mock 产物评测，非真实线上数据', ...base })
    const outcome: OutcomeEval = { id: outcomeId, caseId, traceId, artifactId, type: 'OUTCOME', dimension: '产物最终评分', isFinal: true, score: fixture.finalScore, scoreScale: '0-2', verdict: 'UNKNOWN', evalVersion: RUBRIC_VERSION, evalAgentVersion: EVAL_AGENT, rubricRule: `${RUBRIC_VERSION}#${fixture.scenario} · ${fixture.finalReason}；垂类业务门禁待配置。`, evidenceIds: [outcomeEvidenceId], revisions: [{ id: `automatic-${outcomeId}`, source: 'AUTOMATIC', score: fixture.finalScore, scoreScale: '0-2', verdict: 'UNKNOWN', reason: fixture.finalReason, evaluator: EVAL_AGENT, evaluatedAt, evidenceIds: [outcomeEvidenceId], evalVersion: RUBRIC_VERSION, evalAgentVersion: EVAL_AGENT }], ...base }
    state.outcomeEvals.push(outcome)
    const record: Case = { id: caseId, sessionId, title: `${fixture.scenario} 最终 ${fixture.finalScore} 分（Mock）`, query: fixture.query, scenario: fixture.scenario, verticalScenario: fixture.scenario, channel: fixture.channel, environment: 'Production', agentVersion: fixture.onlineAfterRelease ? 'agent-3.0.0' : 'agent-2.5.0', skillIds: [fixture.skillId], traceIds: [traceId], artifactIds: [artifactId], processEvalIds, outcomeEvalIds: [outcomeId], attributionIds: [], issueIds: [], status: 'EVALUATED', resultStatus: 'UNKNOWN', processStatus: 'UNKNOWN', feedback: fixture.acceptance === 'ACCEPTED' ? 'Mock 用户已明确接受该产物。' : fixture.acceptance === 'REJECTED' ? 'Mock 用户已明确拒绝该产物。' : 'Mock 用户反馈尚未收到；不会推断接受。', acceptanceStatus: fixture.acceptance, owner: 'Mock 质量运营', labels: ['治理总览评分均衡 Mock', ...(fixture.onlineAfterRelease ? ['发布后线上观察 Mock'] : [])], multiScenario: false, sourceType: fixture.onlineAfterRelease ? 'ONLINE_WINDOW' : 'MOCK_SET', ...base }
    state.cases.push(record)
    const trace: Trace = { id: traceId, caseId, sessionId, sequence: 1, startedAt: fixture.queryAt, queryAt: fixture.queryAt, endedAt, observationIds, artifactIds: [artifactId], status: fixture.finalScore === 0 ? 'PARTIAL' : 'SUCCEEDED', totalLatencyMs: 30000, inputTokens: 1800, outputTokens: 1200, agentVersion: record.agentVersion, skillVersion: fixture.skillVersion, skillCategory: 'PRODUCTION_SKILL', channel: fixture.channel, verticalScenario: fixture.scenario, telemetry: { totalLatencyMs: 30000, ttftMs: 900, inputTokens: 1800, outputTokens: 1200, cacheHitCount: 1, cacheRequestCount: 2, modelCallCount: 3, toolCallCount: 4, toolExecutionCount: 4, toolOneShotSuccessCount: fixture.moduleScores.ACT === 2 ? 4 : 3, loopCount: 2, retryCount: fixture.moduleScores.ACT === 2 ? 0 : 1, modelLatencyMs: 15000, riskInterception: { blocked: false, reason: 'Mock 未触发风控' }, commercialInterception: { blocked: false, reason: 'Mock 未触发商业化拦截' } }, ...base }
    state.traces.push(trace)
    state.sessions.push({ id: sessionId, title: record.title, userId: `mock-overview-user-${fixture.key}`, caseIds: [caseId], traceIds: [traceId], turns: [{ id: `turn-overview-${fixture.key}-user`, sequence: 1, role: 'USER', content: fixture.query, caseId, traceId, createdAt: fixture.queryAt }, { id: `turn-overview-${fixture.key}-agent`, sequence: 2, role: 'AGENT', content: fixture.response, caseId, traceId, createdAt: endedAt }], ...base })
    state.tracePackages.push({ id: packageId, batchId: BATCH_ID, caseId, sessionId, traceId, query: fixture.query, agentVersion: record.agentVersion, skillVersion: fixture.skillVersion, skillIds: [fixture.skillId], skillCategory: 'PRODUCTION_SKILL', processCoverage: 'COMPLETE', outcomeCoverage: 'COMPLETE', status: 'EVALUATED', moduleScores, findingIds: [], routingDecisionIds: [], routingDeliveryIds: [], badcaseIds: [], owner: record.owner, revaluationJobIds: [JOB_ID], rating: { scale: '0-2', rubric: RUBRIC_VERSION, processDimensions: moduleScores.map(item => ({ module: item.moduleCode, dimension: MODULE_DIMENSIONS[item.moduleCode as ProcessModule], score: item.score, scoreId: item.id })), outcomeFinal: fixture.finalScore, outcomeDimensions: [{ dimension: '产物最终评分', score: fixture.finalScore, evaluationId: outcomeId }] }, ...base })
  }
  if (!state.evaluationBatches.some(item => item.id === BATCH_ID)) {
    const packages = state.tracePackages.filter(item => item.batchId === BATCH_ID)
    const traceIds = packages.map(item => item.traceId)
    const completedAt = '2026-09-27T03:01:00.000Z'
    state.evaluationBatches.push({ id: BATCH_ID, name: '治理总览 0/1/2 均衡评分（Mock）', status: 'COMPLETED', traceIds, packageIds: packages.map(item => item.id), jobIds: [JOB_ID], evalAgentVersion: EVAL_AGENT, rubricVersion: RUBRIC_VERSION, runEnvironment: 'local-authored-mock', createdBy: 'Mock Seeder', stats: { inputTraceCount: traceIds.length, successCount: traceIds.length, partialCount: 0, failedCount: 0, pendingCount: 0 }, startedAt: fixtures[0].queryAt, completedAt, createdAt: fixtures[0].queryAt, updatedAt: completedAt })
    state.evaluationJobs.push({ id: JOB_ID, batchId: BATCH_ID, attempt: 1, status: 'COMPLETED', traceIds, processedTraceIds: [...traceIds], failedTraceIds: [], evalAgentVersion: EVAL_AGENT, rubricVersion: RUBRIC_VERSION, runEnvironment: 'local-authored-mock', configurationSnapshot: { source: '手写 Mock Eval Agent 返回', scoreScale: '0-2', scoringModules: [...MODULES], finalScoreRule: '每份产物独立返回；不是模块评分或细项的均值', businessThreshold: '待配置' }, completedAt, createdAt: fixtures[0].queryAt, updatedAt: completedAt })
  }
  return state
}
