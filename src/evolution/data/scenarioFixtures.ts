import { ATTRIBUTION_TAXONOMY_VERSION, TRACE_MODULE_LABELS } from '../domain'
import type { Case, EvolutionModule, EvolutionState, ModuleEvaluationStatus, OutcomeEval, RoutingDestination, SkillCategory, TraceEvaluationModuleCode } from '../domain'

interface Scenario {
  id: string; title: string; category: SkillCategory; module?: TraceEvaluationModuleCode; dimension?: string
  input: string; output: string; processOnly?: boolean; secondary?: { module: TraceEvaluationModuleCode; dimension: string; output: string }
}
const scenarios: Scenario[] = [
  { id: 'taste-red', title: '批量用户偏好聚合', category: 'TASTE_SKILL', module: 'SKILL', dimension: '品味库召回错误', input: '生成一份红色、简洁的管理层经营汇报 PPT。', output: '召回了银灰教学模板。1000 名去重用户反馈中，950 名明确偏好红色；聚合统计与单条 Trace 分开留证。' },
  { id: 'taste-asset-quality', title: '品味资产低质量', category: 'TASTE_SKILL', module: 'SKILL', dimension: '品味库资产质量', input: '用品牌模板生成适合董事会阅读的经营 PPT。', output: '模板中标题与深色背景对比不足，图表文字在放映尺寸不可读。' },
  { id: 'taste-asset-shortage', title: '品味资产场景不足', category: 'TASTE_SKILL', module: 'SKILL', dimension: '品味库资产不足', input: '生成医疗行业深红风格的高管经营报告。', output: '品味库没有医疗行业管理层风格资产，使用通用儿童教学模板。' },
  { id: 'production-capability', title: '生产 Skill 能力缺乏', category: 'PRODUCTION_SKILL', module: 'SKILL', dimension: '能力缺乏', input: '将销售数据生成可交互的三维预算分析演示。', output: '当前 PPT Skill 仅支持静态二维图表，无法完成请求中的三维交互能力。' },
  { id: 'production-file', title: '生产 Skill 文件不可加载', category: 'PRODUCTION_SKILL', module: 'SKILL', dimension: 'skill文件不可用', input: '按公司模板生成季度经营汇报。', output: '加载 executive-report/SKILL.md 返回 ENOENT，模板依赖文件路径无效。' },
  { id: 'production-sop', title: 'SOP规划不合理', category: 'PRODUCTION_SKILL', module: 'SKILL', dimension: 'skill sop错误', input: '先检查销售表公式与来源，再制作管理层汇报 PPT。', output: 'Skill SOP 执行顺序为 render → read → validate，未读取销售表就渲染；应为 read → calculate → validate → render。' },
  { id: 'production-metadata', title: '生产 Skill 描述召回偏差', category: 'PRODUCTION_SKILL', module: 'SKILL', dimension: 'skill name/description错误', input: '制作面向董事会的经营决策 PPT。', output: 'executive-report 支持此场景，但 description 仅写“教学演示”，导致未进入候选召回。' },
  { id: 'memory-production', title: '记忆生产错误', category: 'GENERAL', module: 'MEMORY', dimension: '生产错误', input: '沿用上一轮已确认的销售收入 1200 万。', output: '记忆写入阶段把收入单位由万元转成元，保存了错误金额。' },
  { id: 'memory-management', title: '记忆管理错误', category: 'GENERAL', module: 'MEMORY', dimension: '管理错误', input: '删除旧的员工版受众偏好，使用管理层汇报要求。', output: '用户要求删除旧偏好后，记忆管理未失效旧条目，再次选中员工版。' },
  { id: 'memory-recall', title: '最新资产未召回', category: 'GENERAL', module: 'MEMORY', dimension: '召回率低', input: '使用刚上传的 budget-v4.xlsx 生成预算分析。', output: 'Session 中 budget-v4 已存在，但召回为空，Agent 重新向用户索要文件。' },
  { id: 'memory-accuracy', title: '记忆召回准确率低', category: 'GENERAL', module: 'MEMORY', dimension: '准确率低', input: '根据中国区预算表分析风险。', output: '召回同 Session 的海外预算表，与用户要求区域不一致。' },
  { id: 'reason-intent', title: 'Reason 未响应客观诉求', category: 'GENERAL', module: 'REASON', dimension: '没有充分响应用户query的客观诉求', input: '仅给出三项可执行的降本措施。', output: '规划改为完整行业研究，最终输出长篇报告，没有三项行动措施。' },
  { id: 'reason-context', title: 'Reason 未结合多轮上文', category: 'GENERAL', module: 'REASON', dimension: '没有充分结合上文', input: '按照上一轮确定的管理层受众，继续完善结论。', output: '全量上文已包含“管理层受众”，Reason 决策仍按普通员工选择结构。问题归入 Reason，上文不独立评测。' },
  { id: 'reason-choice', title: 'Reason 执行路径低效', category: 'GENERAL', module: 'REASON', dimension: '没有做出最正确/高效的选择', input: '读取一次工作表并汇总五个区域的销售额。', output: '可批量读取，但规划逐单元格调用 120 次 Tool；结果正确，记录过程 FAIL，不预设业务效率门禁。', processOnly: true },
  { id: 'reason-parameter', title: 'Reason 工具参数错误', category: 'GENERAL', module: 'REASON', dimension: '调用工具所需参数是否正确', input: '只导出已筛选的 A1:F120。', output: 'Reason 构造 sheetRange=A1:Z500，超出用户指定区域。' },
  { id: 'act-execution', title: 'Tool 确定性代码错误', category: 'UNCLASSIFIED', module: 'ACT', dimension: '工具未执行成功', input: '导出预算 Excel。', output: 'sheets.export 的 JSON 解析对空字段调用 trim，返回 TypeError。' },
  { id: 'act-retry', title: 'Retry 与超时规则遗漏', category: 'UNCLASSIFIED', module: 'ACT', dimension: '未遵循重试，超时等工程稳定性规则', input: '生成合同文档，超时后给出明确错误。', output: '工具请求超时后发生 4 次无上限 Retry，未执行超时中断与恢复规则。' },
  { id: 'personal-planning', title: '个人能力转 Skill 二期规划', category: 'PERSONAL_SKILL', module: 'SKILL', dimension: '能力缺乏', input: '把我的个人预算整理习惯生成一个私人 Skill。', output: '个人 Skill 生成服务待建设，只记录 Query、资产与对话来源，不伪造生成成功。' },
  { id: 'multi-routing', title: 'Reason 与品味 Skill 多路分流', category: 'TASTE_SKILL', module: 'REASON', dimension: '没有充分响应用户query的客观诉求', input: '生成面向管理层的红色简洁 PPT。', output: 'Reason 将受众改为员工，未遵循明确的管理层约束。', secondary: { module: 'SKILL', dimension: '品味库召回错误', output: '品味 Skill 同时召回教学蓝色模板；两个问题分别进入策略迭代和 Agent迭代。' } },
  ...Array.from({ length: 10 }, (_, index): Scenario => ({ id: `pass-${index + 1}`, title: ['正常生产产物', '通用任务通过', '个人资产私库流程', '品味偏好已满足', '分类待确认但评测通过'][index % 5], category: (['PRODUCTION_SKILL', 'GENERAL', 'PERSONAL_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED'] as const)[index % 5], input: ['生成红色管理层经营 PPT。', '汇总销售 Excel 并验证公式。', '整理合同 Word 并标注风险。', '审查导出脚本并修正空值边界。', '给出三项可执行的项目建议。'][index % 5], output: '请求的约束与来源校验均通过；过程和结果独立评测，当前无失败 Finding。' }))
]
const order: TraceEvaluationModuleCode[] = ['REASON', 'MEMORY', 'CONTEXT', 'SKILL', 'ACT', 'TOOL', 'OUTCOME']
const moduleFor = (code: TraceEvaluationModuleCode): EvolutionModule => code === 'MEMORY' ? 'Memory' : code === 'SKILL' ? 'Skill' : code === 'REASON' ? 'Reason' : 'Act'
const sourceSkill: Record<SkillCategory, string> = { PRODUCTION_SKILL: 'skill-ppt-builder', GENERAL: 'skill-general-docs', PERSONAL_SKILL: 'skill-personal-planned', TASTE_SKILL: 'skill-taste-executive', UNCLASSIFIED: 'skill-unclassified' }
const direct = (code: TraceEvaluationModuleCode, dimension: string) => ['ACT', 'TOOL'].includes(code) || ['skill文件不可用', 'skill sop错误', 'skill name/description错误'].includes(dimension)
const stamp = <T,>(item: T, at: string): T & { createdAt: string; updatedAt: string } => ({ ...item, createdAt: at, updatedAt: at })

/** Rich, hand-authored Eval Agent returns supplement the lifecycle boundary fixtures. */
export function addScenarioFixtures(state: EvolutionState): EvolutionState {
  const at = '2026-09-24T12:00:00.000Z'
  const batchId = 'batch-scenarios-completed'
  const jobId = 'job-scenarios-completed'
  const caseIds: string[] = []
  const traceIds: string[] = []
  const packageIds: string[] = []
  const clusterId = 'cluster-taste-red-ready'

  scenarios.forEach((scenario, index) => {
    const time = new Date(Date.parse(at) + index * 17 * 60000).toISOString()
    const caseId = `case-v2-${scenario.id}`; const traceId = `trace-v2-${scenario.id}`; const sessionId = `session-v2-${scenario.id}`
    const packageId = `package-${traceId}`; const artifactId = `artifact-${scenario.id}`
    const skillId = sourceSkill[scenario.category]
    const business = scenario.category === 'TASTE_SKILL' || scenario.category === 'PRODUCTION_SKILL' ? 'PPT' : ['Excel', 'Word', 'Coding', 'General'][index % 4]
    const failed = Boolean(scenario.module); const outcomeFailed = failed && !scenario.processOnly
    const outcomeStatus: ModuleEvaluationStatus = outcomeFailed ? 'FAIL' : 'PASS'
    const acceptanceStatus = scenario.id.startsWith('pass-') ? (index % 3 === 0 ? 'UNKNOWN' as const : 'ACCEPTED' as const) : failed ? 'REJECTED' as const : 'UNKNOWN' as const
    const record: Case = stamp({ id: caseId, sessionId, title: scenario.title, query: scenario.input, scenario: business, sourceType: index % 3 === 0 ? 'ONLINE_WINDOW' : index % 3 === 1 ? 'GOLDEN_DATASET' : 'MOCK_SET', environment: index % 10 === 9 ? 'Staging' : 'Production', agentVersion: index % 2 ? 'agent-2.6.0' : 'agent-3.0.0-rc.1', skillIds: [skillId], traceIds: [traceId], artifactIds: [artifactId], processEvalIds: [], outcomeEvalIds: [], attributionIds: [], issueIds: [], status: failed ? 'CONFIRMED' : 'EVALUATED', resultStatus: outcomeStatus === 'FAIL' ? 'FAIL' : 'PASS', processStatus: failed ? 'FAIL' : 'PASS', feedback: acceptanceStatus === 'ACCEPTED' ? '用户明确接受当前产物。' : acceptanceStatus === 'REJECTED' ? '用户明确拒绝当前产物。' : '用户事件待记录。', acceptanceStatus, owner: scenario.category === 'PRODUCTION_SKILL' ? '算法团队 / 生产 Skill 团队' : scenario.category === 'TASTE_SKILL' ? '品味库团队' : `${moduleFor(scenario.module ?? 'REASON')} 团队`, labels: [scenario.title, ...(scenario.id === 'taste-red' ? ['批量偏好聚合'] : [])], multiScenario: Boolean(scenario.secondary) }, time)
    state.cases.push(record); caseIds.push(caseId); traceIds.push(traceId); packageIds.push(packageId)
    state.sessions.push(stamp({ id: sessionId, title: scenario.title, userId: `user-scenario-${index + 1}`, caseIds: [caseId], traceIds: [traceId], turns: [{ id: `${sessionId}-u`, sequence: 1, role: 'USER', content: scenario.input, caseId, traceId, createdAt: time }, { id: `${sessionId}-a`, sequence: 2, role: 'AGENT', content: scenario.output, caseId, traceId, createdAt: time }] }, time))
    const duration = 13000 + (index % 8) * 4800; const modelLatency = Math.round(duration * 0.52)
    const trace = stamp({ id: traceId, caseId, sessionId, sequence: 1, startedAt: time, endedAt: new Date(Date.parse(time) + duration).toISOString(), observationIds: [] as string[], artifactIds: [artifactId], status: 'SUCCEEDED' as const, totalLatencyMs: duration, inputTokens: 1200 + index * 40, outputTokens: 500 + index * 20, agentVersion: record.agentVersion, skillVersion: state.skills.find((skill) => skill.id === skillId)!.version, skillCategory: scenario.category, telemetry: { totalLatencyMs: duration, ttftMs: 330 + (index % 6) * 160, inputTokens: 1200 + index * 40, outputTokens: 500 + index * 20, modelCallCount: 2 + index % 3, modelLatencyMs: modelLatency, modelThroughputTokensPerSecond: (1700 + index * 60) / (modelLatency / 1000), toolCallCount: 2, toolExecutionCount: 2, toolOneShotSuccessCount: scenario.module === 'ACT' ? 1 : 2, retryCount: scenario.id === 'act-retry' ? 4 : 0, loopCount: scenario.id === 'reason-choice' ? 3 : 0, cacheHitCount: index % 3, cacheRequestCount: 4, riskInterception: { blocked: false, reason: '未触发风控' }, commercialInterception: { blocked: false, reason: '未触发商业化拦截' } } }, time)
    state.traces.push(trace)
    state.artifacts.push(stamp({ id: artifactId, caseId, traceId, name: `${scenario.title}.${business === 'PPT' ? 'pptx' : business === 'Excel' ? 'xlsx' : business === 'Word' ? 'docx' : 'json'}`, kind: business === 'PPT' ? 'PPT' : business === 'Excel' ? 'Excel' : business === 'Word' ? 'Word' : 'JSON', uri: `mock://artifacts/${artifactId}`, version: 'v1', status: outcomeFailed ? 'INVALID' : 'AVAILABLE', evidenceIds: [`evidence-${scenario.id}-outcome`] }, time))
    const pkg = stamp({ id: packageId, batchId, caseId, sessionId, traceId, query: scenario.input, agentVersion: record.agentVersion, skillVersion: trace.skillVersion, skillIds: [skillId], skillCategory: scenario.category, processCoverage: 'COMPLETE' as const, outcomeCoverage: 'COMPLETE' as const, status: 'EVALUATED' as const, moduleScores: [] as EvolutionState['tracePackages'][number]['moduleScores'], findingIds: [] as string[], routingDecisionIds: [] as string[], routingDeliveryIds: [] as string[], badcaseIds: [] as string[], owner: record.owner, revaluationJobIds: [jobId] }, time)
    order.forEach((code, sequence) => {
      const nodeId = `obs-${scenario.id}-${code.toLowerCase()}`; const evidenceId = `evidence-${scenario.id}-${code.toLowerCase()}`
      const specific = code === scenario.module ? { dimension: scenario.dimension!, output: scenario.output } : code === scenario.secondary?.module ? scenario.secondary : undefined
      const status: ModuleEvaluationStatus = code === 'CONTEXT' ? scenario.id === 'reason-context' ? 'DERIVED_FAIL' : 'N/A' : code === 'OUTCOME' ? outcomeStatus : specific ? 'FAIL' : 'PASS'
      const reason = specific?.output ?? (code === 'CONTEXT' ? '上文全量组装，仅保留关联证据，不单独判定 Context Assembly。' : code === 'OUTCOME' ? outcomeFailed ? `产物不满足任务要求：${scenario.output}` : '产物格式可用，用户约束、内容和来源均满足当前 Rubric。' : `${TRACE_MODULE_LABELS[code]} 执行符合当前任务的 Rubric，输入和输出日志可追溯。`)
      const bundle = { rootEvidenceIds: [evidenceId], rubricRule: `rubric-office-v2.1#${code.toLowerCase()}：${specific?.dimension ?? (code === 'OUTCOME' ? '结果约束满足与可用性' : '任务要求与输入输出一致')}`, observationIds: code === 'CONTEXT' ? [] : [nodeId], logIds: code === 'CONTEXT' ? [] : [`log-${scenario.id}-${code.toLowerCase()}`], artifactIds: code === 'OUTCOME' ? [artifactId] : [], inputSummary: scenario.input, outputSummary: reason, firstFailure: code === scenario.module, derivedFailure: status === 'DERIVED_FAIL', derivedFromModule: status === 'DERIVED_FAIL' ? 'REASON' as const : undefined, completeness: 'COMPLETE' as const }
      state.evidence.push(stamp({ id: evidenceId, caseId, traceId, observationId: code === 'CONTEXT' ? undefined : nodeId, artifactId: code === 'OUTCOME' ? artifactId : undefined, kind: code === 'OUTCOME' ? 'ARTIFACT' : 'LOG', title: `${TRACE_MODULE_LABELS[code]} 根证据 · ${scenario.title}`, content: reason, source: '结构化 Mock Trace / Eval Agent 返回样例' }, time))
      const score = stamp({ id: `module-score-${traceId}-${code.toLowerCase()}`, packageId, caseId, traceId, moduleCode: code, moduleLabel: TRACE_MODULE_LABELS[code], automaticStatus: status, score: status === 'FAIL' ? 0.35 + index % 5 / 100 : status === 'PASS' ? 0.83 + index % 13 / 100 : undefined, judgeReason: reason, evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', evidence: bundle }, time)
      pkg.moduleScores.push(score)
      if (code !== 'CONTEXT') {
        trace.observationIds.push(nodeId)
        state.observations.push(stamp({ id: nodeId, caseId, traceId, sequence: sequence + 1, nodeType: code === 'OUTCOME' ? 'Artifact' : code === 'REASON' ? 'Reason' : code === 'MEMORY' ? 'Memory' : code === 'SKILL' ? 'Skill' : code === 'ACT' ? 'Act' : 'Tool', name: `${TRACE_MODULE_LABELS[code]} · ${scenario.title}`, input: scenario.input, output: reason, status: specific ? 'FAILED' : 'SUCCEEDED', latencyMs: Math.round(duration / 6), retryCount: code === 'ACT' ? trace.telemetry.retryCount : 0, evidenceIds: [evidenceId], logId: `log-${scenario.id}-${code.toLowerCase()}`, skillId: code === 'SKILL' ? skillId : undefined, toolName: code === 'TOOL' ? business === 'PPT' ? 'slides.render' : 'office.export' : undefined }, time))
        const evaluationVerdict = status === 'FAIL' ? 'FAIL' as const : 'PASS' as const
        const evaluation = stamp({ id: `eval-${scenario.id}-${code.toLowerCase()}`, caseId, traceId, evalVersion: 'eval-agent-2.4.0', verdict: evaluationVerdict, score: score.score, evidenceIds: [evidenceId], revisions: [{ id: `revision-${scenario.id}-${code.toLowerCase()}`, source: 'AUTOMATIC' as const, verdict: evaluationVerdict, score: score.score, reason, evidenceIds: [evidenceId], evaluator: 'Mock Eval Agent', evaluatedAt: time }] }, time)
        if (code === 'OUTCOME') { state.outcomeEvals.push({ ...evaluation, type: 'OUTCOME', artifactId, dimension: '产物合格性' }); record.outcomeEvalIds.push(evaluation.id) }
        else { state.processEvals.push({ ...evaluation, type: 'PROCESS', observationId: nodeId, dimension: specific?.dimension ?? `${TRACE_MODULE_LABELS[code]} 执行表现`, failedNodeId: specific ? nodeId : undefined }); record.processEvalIds.push(evaluation.id) }
      }
      if (!specific) return
      const findingId = `finding-${scenario.id}-${code.toLowerCase()}`; const issueId = `issue-${scenario.id}-${code.toLowerCase()}`; const attributionId = `attribution-${scenario.id}-${code.toLowerCase()}`
      const mode = direct(code, specific.dimension) ? 'DIRECT_FIX' as const : 'CLUSTER_OPTIMIZATION' as const
      const isTaste = code === 'SKILL' && specific.dimension.startsWith('品味库')
      const routingLabels: EvolutionState['issues'][number]['routingLabels'] = scenario.category === 'PRODUCTION_SKILL' ? (mode === 'DIRECT_FIX' ? ['Agent 迭代'] : ['策略迭代']) : code === 'REASON' || code === 'ACT' ? ['策略迭代'] : ['Agent 迭代']
      const path = isTaste ? 'Agent迭代 → 品味库聚类 → 候选变体 → 单变体实验 → 窗口组合验证' : scenario.category === 'PRODUCTION_SKILL' && mode === 'DIRECT_FIX' ? 'Agent迭代 → 修复 Skill → Validation → 回归验证' : mode === 'DIRECT_FIX' ? '直接优化 → 候选修复 → 同类与回归验证' : scenario.category === 'PRODUCTION_SKILL' ? '策略迭代 → 算法 Badcase → 生产 Skill 修复' : scenario.category === 'PERSONAL_SKILL' ? 'Agent迭代 → 个人 Skill 二期规划' : '策略 / Agent迭代 → 问题簇（门槛待配置）'
      const finding = stamp({ id: findingId, batchId, packageId, caseId, sessionId, traceId, moduleCode: code, moduleLabel: TRACE_MODULE_LABELS[code], dimensionCode: `${code}_${scenario.id}`, dimensionLabel: specific.dimension, description: reason, taxonomyVersion: ATTRIBUTION_TAXONOMY_VERSION, labelSnapshot: specific.dimension, skillCategory: scenario.category, scenarioCode: scenario.id, scenarioLabel: scenario.title, optimizationPath: path, preferenceSignalId: scenario.id === 'taste-red' ? 'taste-signal-red-style-2026w35' : undefined, selectedOptimizationCondition: mode === 'DIRECT_FIX' ? '直接优化' : '聚类优化', optimizationDimension: specific.dimension === '能力缺乏' || specific.dimension === '品味库资产不足' ? '新增能力' : '能力修补', status: 'CONFIRMED' as const, firstFailure: code === scenario.module, derivedFailure: false, evidenceBundle: bundle, routingDecisionIds: [] as string[], routingDeliveryIds: [] as string[] }, time)
      state.evaluationFindings.push(finding); pkg.findingIds.push(findingId)
      state.attributions.push(stamp({ id: attributionId, caseId, traceId, observationId: nodeId, module: moduleFor(code), dimension: specific.dimension, evidenceIds: [evidenceId], confidence: 0.93, source: 'HUMAN', confirmed: true, routingLabels, optimizationMode: mode, status: 'CONFIRMED', revisions: [], taxonomyVersion: ATTRIBUTION_TAXONOMY_VERSION, labelSnapshot: specific.dimension, dimensionLabel: specific.dimension }, time)); record.attributionIds.push(attributionId)
      state.issues.push(stamp({ id: issueId, caseId, attributionId, title: scenario.title, description: reason, module: moduleFor(code), dimension: specific.dimension, evidenceIds: [evidenceId], routingLabels, optimizationMode: mode, responsibilityStatus: 'ASSIGNED', owner: record.owner, status: 'CONFIRMED', clusterIds: scenario.id === 'taste-red' ? [clusterId] : [], variantIds: [], processingChains: routingLabels.map((routingLabel, chainIndex) => ({ id: `chain-${issueId}-${chainIndex}`, routingLabel, destinationType: mode === 'DIRECT_FIX' ? 'DIRECT_FIX' as const : 'ISSUE_CLUSTER' as const, destinationId: scenario.id === 'taste-red' ? clusterId : undefined, status: 'PLANNED' as const, note: path })) }, time)); record.issueIds.push(issueId)
      const destinations: RoutingDestination[] = scenario.category === 'PRODUCTION_SKILL' && code === 'SKILL' ? (mode === 'DIRECT_FIX' ? ['AGENT_ITERATION'] : ['ALGORITHM_BADCASE']) : isTaste ? ['TASTE_LIBRARY'] : mode === 'DIRECT_FIX' ? ['DIRECT_FIX'] : scenario.category === 'PERSONAL_SKILL' ? ['PERSONAL_SKILL_PLANNING'] : ['AGENT_ITERATION']
      destinations.forEach((destination, routeIndex) => {
        const deliveryId = `delivery-${findingId}-${routeIndex}`; const decisionId = `decision-${findingId}-${routeIndex}`
        const queueId = destination === 'ALGORITHM_BADCASE' ? 'queue-algorithm-badcase' : destination === 'TASTE_LIBRARY' ? 'queue-taste-library' : destination === 'DIRECT_FIX' ? 'queue-direct-fix' : destination === 'PERSONAL_SKILL_PLANNING' ? 'queue-personal-skill-planning' : 'queue-agent-iteration'
        const policyId = destination === 'ALGORITHM_BADCASE' ? 'routing-policy-production-skill' : destination === 'TASTE_LIBRARY' ? 'routing-policy-taste-skill' : destination === 'DIRECT_FIX' ? 'routing-policy-direct-fix' : destination === 'PERSONAL_SKILL_PLANNING' ? 'routing-policy-personal-skill' : 'routing-policy-general'
        const label = isTaste || destination === 'PERSONAL_SKILL_PLANNING' || (destination === 'DIRECT_FIX' && code === 'SKILL') ? 'Agent迭代' as const : '策略迭代' as const
        state.routingDecisions.push(stamp({ id: decisionId, findingId, packageId, traceId, policyId, label, destination, status: 'CONFIRMED', reason: path, deliveryIds: [deliveryId] }, time))
        const badcaseId = destination === 'ALGORITHM_BADCASE' ? `badcase-${findingId}` : undefined
        state.routingDeliveries.push(stamp({ id: deliveryId, findingId, decisionId, packageId, caseId, traceId, label, destination, status: 'ACKNOWLEDGED', queueId, owner: record.owner, issueId, issueClusterId: scenario.id === 'taste-red' ? clusterId : undefined, algorithmBadcaseId: badcaseId, regressionDatasetId: mode === 'DIRECT_FIX' ? 'dataset-regression' : undefined, note: path, deliveredAt: time, acknowledgedAt: time }, time))
        if (badcaseId) { state.algorithmBadcases.push(stamp({ id: badcaseId, findingId, packageId, traceId, deliveryId, queueId, title: `${scenario.title} · 算法 Badcase`, status: 'CONFIRMED', owner: '算法团队', sourceEvidenceIds: [evidenceId], issueId, confirmedBy: 'Mock 质量运营', confirmedAt: time }, time)); pkg.badcaseIds.push(badcaseId) }
        finding.routingDecisionIds.push(decisionId); finding.routingDeliveryIds.push(deliveryId); pkg.routingDecisionIds.push(decisionId); pkg.routingDeliveryIds.push(deliveryId)
      })
    })
    state.tracePackages.push(pkg)
  })

  // Every Mock Artifact gets an explicit outcome ledger record. This keeps the
  // overview honest: UNKNOWN only represents a deliberate boundary sample,
  // not a missing fixture. Process efficiency remains UNKNOWN until its PRD
  // baseline is configured.
  const evaluatedArtifactIds = new Set(state.outcomeEvals.map((evaluation) => evaluation.artifactId))
  state.artifacts.filter((artifact) => !evaluatedArtifactIds.has(artifact.id)).forEach((artifact, index) => {
    const sourceCase = state.cases.find((record) => record.id === artifact.caseId)
    const verdict: OutcomeEval['verdict'] = artifact.status === 'INVALID' || artifact.status === 'MISSING' ? 'FAIL' : 'PASS'
    const evidenceIds = artifact.evidenceIds.length ? [...artifact.evidenceIds] : []
    const reason = verdict === 'PASS' ? 'Mock 产物满足当前垂类结果 Rubric，文件可用且结果可追溯。' : verdict === 'FAIL' ? 'Mock 产物文件不可用或未满足结果 Rubric。' : '该产物保留为待补充评测边界样本，等待真实 Eval Agent。'
    const evaluationId = `outcome-eval-${artifact.id}-coverage`
    const evaluation = stamp({ id: evaluationId, type: 'OUTCOME' as const, caseId: artifact.caseId, traceId: artifact.traceId, artifactId: artifact.id, dimension: '产物合格性', evalVersion: 'outcome-eval-3.0', verdict, score: verdict === 'PASS' ? 0.9 : verdict === 'FAIL' ? 0.2 : undefined, evidenceIds, revisions: [{ id: `revision-${evaluationId}`, source: 'AUTOMATIC' as const, verdict, score: verdict === 'PASS' ? 0.9 : verdict === 'FAIL' ? 0.2 : undefined, reason, evidenceIds, evaluator: 'Mock Outcome Eval Agent', evaluatedAt: artifact.updatedAt }] }, artifact.updatedAt)
    state.outcomeEvals.push(evaluation)
    if (sourceCase && !sourceCase.outcomeEvalIds.includes(evaluationId)) sourceCase.outcomeEvalIds.push(evaluationId)
  })
  state.evaluationBatches.push(stamp({ id: batchId, name: 'PRD 场景均衡评测集（Mock）', status: 'COMPLETED', traceIds, packageIds, jobIds: [jobId], evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', createdBy: 'Mock Seeder', stats: { inputTraceCount: traceIds.length, successCount: traceIds.length, partialCount: 0, failedCount: 0, pendingCount: 0 }, startedAt: at, completedAt: at }, at))
  state.evaluationJobs.push(stamp({ id: jobId, batchId, attempt: 1, status: 'COMPLETED', traceIds, processedTraceIds: traceIds, failedTraceIds: [], evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', configurationSnapshot: { source: 'Mock 场景样例' }, completedAt: at }, at))

  const sourceCase = state.cases.find((record) => record.id === 'case-v2-taste-red')!
  const sourceIssue = state.issues.find((issue) => sourceCase.issueIds.includes(issue.id))!
  state.issueClusters.push(stamp({ id: clusterId, name: '管理层红色风格品味问题簇', description: '1000 名用户偏好样本中 950 名偏好红色；另有 120 条按 Skill 去重、人工确认的相关 Case，达到 100 条触发条件。', module: 'Skill', dimension: '品味库召回错误', caseIds: [sourceCase.id], issueIds: [sourceIssue.id], evidenceIds: [...sourceIssue.evidenceIds], variantIds: ['variant-taste-red-v1'], status: 'VARIANT_CREATED', triggerRuleId: 'rule-taste-100', currentCount: 120, threshold: 100, countingRule: '1 条本地完整 Case + 119 条外部 Mock 已确认 Case；与 1000 名用户的偏好分母独立。', tastePopulation: { skillId: 'skill-taste-executive', externalMockConfirmedCaseCount: 119, snapshotId: 'snapshot-taste-red-120', source: 'mock集 · 同 Skill / 管理层 PPT 相关 Case', countedAt: at } }, at))
  const signal = state.tastePreferenceSignals[0]
  Object.assign(signal, { caseIds: [sourceCase.id], evidenceIds: [...sourceIssue.evidenceIds], clusterId, relatedDataCount: 120, relatedDataThreshold: 100, samples: Array.from({ length: 1000 }, (_, index) => ({ userId: `mock-preference-user-${String(index + 1).padStart(4, '0')}`, preference: index < 950 ? '红色' : index < 975 ? '白色' : '银灰色' })) })
  sourceIssue.variantIds.push('variant-taste-red-v1')
  state.variants.push(stamp({ id: 'variant-taste-red-v1', name: '管理层红色品味召回候选', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '对明确红色偏好的管理层场景增加召回特征，不改全用户默认风格。', changeContent: '新增红色简洁管理层资产的召回标签；保留白色与银灰偏好；需通过单变体实验后再进入窗口组合验证。', currentVersion: 'taste-0.9.0', candidateVersion: 'taste-1.0.0-rc.1', sourceCaseIds: [sourceCase.id], sourceIssueIds: [sourceIssue.id], sourceClusterIds: [clusterId], evidenceIds: [...sourceIssue.evidenceIds], status: 'READY', experimentIds: ['exp-taste-red-single'] }, at))
  state.skills.find((skill) => skill.id === 'skill-taste-executive')!.evolutionRecordIds.push('variant-taste-red-v1')
  state.datasets.push(stamp({ id: 'dataset-taste-red-attribution', name: '红色品味归因集', type: 'ATTRIBUTION', version: 'v1', caseIds: [sourceCase.id], sampleCount: 120, source: 'mock集 · 人工确认品味问题簇', scope: '同 Skill / 管理层红色风格归因；本地展开 1 条，外部 Mock 快照 119 条。', frozen: true, population: { totalSampleCount: 120, localCaseCount: 1, externalSampleCount: 119, sourceSystem: 'Mock 品味问题库', countingRule: '按 Skill ID + Case ID 去重，不使用偏好用户数作为实验 Case 数。' } }, at))
  const selectedDatasetIds = ['dataset-taste-red-attribution', 'dataset-generalization', 'dataset-regression']
  state.experiments.push(stamp({ id: 'exp-taste-red-single', name: '红色品味候选单变体实验', level: 'SINGLE_VARIANT', variantIds: ['variant-taste-red-v1'], datasetIds: selectedDatasetIds, baselineVersion: 'taste-0.9.0', candidateVersion: 'taste-1.0.0-rc.1', configSnapshot: { datasetVersions: selectedDatasetIds.map((id) => { const dataset = state.datasets.find((item) => item.id === id)!; return { datasetId: id, version: dataset.version, versionId: `${id}@${dataset.version}`, sampleCount: dataset.sampleCount, caseIds: [...dataset.caseIds] } }), model: 'gpt-5.2-demo', toolPermissions: ['slides.render'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'local-mock-runner', createdAt: at, evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', tracePackageIds: [`package-${sourceCase.traceIds[0]}`], artifactIds: [...sourceCase.artifactIds], evidenceBundleIds: [...sourceIssue.evidenceIds] }, runIds: [], metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['95% 是偏好分布，不是准出阈值；不得把其他偏好用户判为 Badcase。', '外部 Mock 样本只有快照；本地仅执行展开的 Case，真实评测服务未接入。'], status: 'QUEUED' }, at))
  state.routingDeliveries.filter((delivery) => delivery.caseId === sourceCase.id).forEach((delivery) => { delivery.variantId = 'variant-taste-red-v1' })
  state.badcaseQueues.forEach((queue) => { queue.deliveryIds = state.routingDeliveries.filter((item) => item.queueId === queue.id).map((item) => item.id); queue.itemIds = state.algorithmBadcases.filter((item) => item.queueId === queue.id).map((item) => item.id) })
  return state
}
