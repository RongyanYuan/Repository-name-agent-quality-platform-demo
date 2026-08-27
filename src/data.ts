import {
  BUSINESS_TYPES,
  COMPLEXITIES,
  JUDGE_STATUSES,
  PROCESS_DIMENSIONS,
  RESULT_DIMENSIONS,
  type BenchmarkCaseResult,
  type BenchmarkMetric,
  type BenchmarkRun,
  type CaseRecord,
  type Dataset,
  type DatasetEntry,
  type Environment,
  type EvalConfig,
  type EvalResult,
  type JudgeStatus,
  type LatencyEfficiencyBand,
  type EvalStatus,
  type Evidence,
  type Observation,
  type ObservationNode,
  type ProductAcceptanceEvent,
  type ProductAcceptanceEventType,
  type ProductValidity,
  type ProcessEfficiency,
  type RootCauseAttribution,
  type RiskCommercialEvent,
  type TaskPerformance,
  type QualityData,
  type RootCause,
  type Task,
  type TaskStatus,
  type Trace
} from './domain'

const VERSION_A = 'agent-2.4.0'
const VERSION_B = 'agent-2.5.0'
const NOW = '2026-08-24T12:00:00.000Z'

const skills = ['ppt-builder', 'spreadsheet-analyst', 'doc-writer', 'code-reviewer', 'researcher']
const models = ['gpt-5.2', 'gpt-5.3-mini', 'gpt-5.2-high']
const toolNames = ['slides.render', 'sheets.read', 'docs.export', 'browser.fetch', 'code.patch']

type TaskSeed = {
  businessType: Exclude<(typeof BUSINESS_TYPES)[number], 'All'>
  complexity: (typeof COMPLEXITIES)[number]
  status: TaskStatus
  rootCause: RootCause
  query: string
  skill: string
  environment: Environment
}

const seedOverrides: TaskSeed[] = [
  {
    businessType: 'Excel',
    complexity: 'Complex',
    status: 'Failed',
    rootCause: 'Memory',
    query: '根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。',
    skill: 'ppt-builder',
    environment: 'Production'
  },
  {
    businessType: 'PPT',
    complexity: 'Medium',
    status: 'Failed',
    rootCause: 'Context',
    query: '把上季度经营复盘压缩成 5 页高管摘要。',
    skill: 'ppt-builder',
    environment: 'Production'
  },
  {
    businessType: 'Coding',
    complexity: 'Complex',
    status: 'Failed',
    rootCause: 'Tool',
    query: '修复登录回调并补上覆盖异常分支的测试。',
    skill: 'code-reviewer',
    environment: 'Staging'
  },
  {
    businessType: 'Word',
    complexity: 'Simple',
    status: 'Effective but Inefficient',
    rootCause: 'Loop / Retry',
    query: '把会议纪要整理成一页行动项清单。',
    skill: 'doc-writer',
    environment: 'Production'
  },
  {
    businessType: 'General',
    complexity: 'Medium',
    status: 'Failed',
    rootCause: 'Skill Routing',
    query: '比较两个方案并给出可执行的下一步。',
    skill: 'researcher',
    environment: 'Staging'
  },
  {
    businessType: 'Excel',
    complexity: 'Medium',
    status: 'Effective',
    rootCause: 'None',
    query: '计算各区域销售增长率并标出异常值。',
    skill: 'spreadsheet-analyst',
    environment: 'Production'
  },
  {
    businessType: 'PPT',
    complexity: 'Simple',
    status: 'Effective',
    rootCause: 'None',
    query: '用品牌模板生成项目启动会封面。',
    skill: 'ppt-builder',
    environment: 'Production'
  },
  {
    businessType: 'Coding',
    complexity: 'Medium',
    status: 'Effective',
    rootCause: 'None',
    query: '解释这个函数的边界条件并给出重构建议。',
    skill: 'code-reviewer',
    environment: 'Staging'
  }
]

const boundarySeeds: TaskSeed[] = [
  { businessType: 'PPT', complexity: 'Simple', status: 'Effective', rootCause: 'None', query: '用公司模板制作一页项目封面。', skill: 'ppt-builder', environment: 'Production' },
  { businessType: 'General', complexity: 'Simple', status: 'Failed', rootCause: 'Task Understanding', query: '只提取合同中的付款节点，不要改写原文。', skill: 'researcher', environment: 'Production' },
  { businessType: 'PPT', complexity: 'Complex', status: 'Failed', rootCause: 'Planning / Decision', query: '把多份经营材料合并成董事会汇报并标注决策项。', skill: 'ppt-builder', environment: 'Production' },
  { businessType: 'Excel', complexity: 'Complex', status: 'Failed', rootCause: 'Memory', query: '根据年度预算表生成部门差异分析。', skill: 'spreadsheet-analyst', environment: 'Production' },
  { businessType: 'Excel', complexity: 'Simple', status: 'Effective but Inefficient', rootCause: 'Loop / Retry', query: '清理销售表中的重复行并导出结果。', skill: 'spreadsheet-analyst', environment: 'Staging' },
  { businessType: 'Word', complexity: 'Medium', status: 'Failed', rootCause: 'Skill Internal', query: '把访谈记录整理成带引用的研究纪要。', skill: 'doc-writer', environment: 'Production' },
  { businessType: 'Word', complexity: 'Complex', status: 'Effective', rootCause: 'None', query: '根据合同草稿生成风险条款摘要。', skill: 'doc-writer', environment: 'Production' },
  { businessType: 'Coding', complexity: 'Simple', status: 'Effective', rootCause: 'None', query: '为函数补充边界条件说明。', skill: 'code-reviewer', environment: 'Staging' },
  { businessType: 'Coding', complexity: 'Complex', status: 'Failed', rootCause: 'Tool', query: '修复部署脚本并验证回滚路径。', skill: 'code-reviewer', environment: 'Staging' },
  { businessType: 'General', complexity: 'Medium', status: 'Failed', rootCause: 'External Engineering', query: '分析接口错误并给出排查优先级。', skill: 'researcher', environment: 'Production' },
  { businessType: 'General', complexity: 'Simple', status: 'Effective', rootCause: 'None', query: '把零散想法整理成三条行动建议。', skill: 'researcher', environment: 'Production' },
  { businessType: 'PPT', complexity: 'Medium', status: 'Failed', rootCause: 'Context', query: '沿用上次素材但改成面向客户的产品介绍。', skill: 'ppt-builder', environment: 'Staging' },
  { businessType: 'Excel', complexity: 'Medium', status: 'Effective', rootCause: 'None', query: '按区域汇总本月订单并标出异常。', skill: 'spreadsheet-analyst', environment: 'Production' }
]

const generatedSeeds: TaskSeed[] = Array.from({ length: 40 }, (_, index) => {
  const businessType = BUSINESS_TYPES[(index % 5) + 1] as Exclude<(typeof BUSINESS_TYPES)[number], 'All'>
  const complexity = COMPLEXITIES[index % COMPLEXITIES.length]
  // Keep the generated set useful for governance views: a healthy majority,
  // plus enough failures and inefficient successes to exercise every Case tab.
  const status: TaskStatus = index % 5 === 0 ? 'Failed' : index % 3 === 0 ? 'Effective but Inefficient' : 'Effective'
  const rootCause: RootCause = status === 'Failed'
    ? (['Planning / Decision', 'Memory', 'Tool', 'Skill Internal', 'External Engineering'][index % 5] as RootCause)
    : status === 'Effective but Inefficient'
      ? 'Loop / Retry'
      : 'None'
  return {
    businessType,
    complexity,
    status,
    rootCause,
    query: [
      '汇总本周业务数据并给出三条结论。',
      '将素材整理为可以直接分享的内容产物。',
      '检查实现方案并指出最可能的风险。',
      '把零散输入整理成结构化的执行清单。',
      '根据历史上下文继续完成当前任务。'
    ][index % 5] + `（样例 ${String(index + 1).padStart(2, '0')}）`,
    skill: skills[index % skills.length],
    environment: index % 3 === 0 ? 'Staging' : 'Production'
  }
})

const taskSeeds = [...seedOverrides, ...boundarySeeds, ...generatedSeeds]

const statusForDimension = (seed: TaskSeed, dimensionIndex: number): EvalStatus => {
  if (seed.status === 'Effective') return dimensionIndex === 3 && seed.complexity === 'Complex' ? 'FAIL' : 'PASS'
  if (seed.rootCause === 'None') return dimensionIndex === 4 ? 'FAIL' : 'PASS'
  const failIndex = seed.rootCause === 'Memory'
    ? 1
    : seed.rootCause === 'Context'
      ? 2
      : seed.rootCause === 'Tool'
        ? 3
        : seed.rootCause === 'Planning / Decision'
          ? 0
          : seed.rootCause === 'Skill Routing'
            ? 0
            : seed.rootCause === 'Loop / Retry'
              ? 4
              : seed.rootCause === 'Skill Internal'
                ? 3
                : seed.rootCause === 'External Engineering'
                  ? 3
                  : -1
  return dimensionIndex === failIndex ? 'FAIL' : dimensionIndex === 0 && seed.status === 'Failed' ? 'FAIL' : 'PASS'
}

const roundScore = (value: number) => Math.max(0, Math.min(1, Math.round(value * 100) / 100))

const latencyBandFor = (ratio?: number): LatencyEfficiencyBand => {
  if (ratio === undefined || !Number.isFinite(ratio)) return 'UNKNOWN'
  if (ratio <= 1) return '<=1'
  if (ratio <= 1.5) return '1-1.5'
  if (ratio <= 2) return '1.5-2'
  return '>2'
}

const acceptanceEventsFor = (taskId: string, seed: TaskSeed, index: number): ProductAcceptanceEvent[] => {
  const timestamp = `2026-08-24T${String(13 + (index % 8)).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}:00.000Z`
  // Keep the canonical v2 example auditable: an initial correction is followed
  // by a new audience requirement and a final acceptance.
  if (taskId === 'task-001') {
    return [
      { id: `${taskId}-event-1`, taskId, type: 'download', timestamp, sequence: 1, round: 1, source: 'User', note: '首轮产物已下载，等待复核。' },
      { id: `${taskId}-event-2`, taskId, type: 'correction', timestamp: new Date(Date.parse(timestamp) + 60_000).toISOString(), sequence: 2, round: 1, source: 'User', note: '用户要求修正受众。' },
      { id: `${taskId}-event-3`, taskId, type: 'new_requirement', timestamp: new Date(Date.parse(timestamp) + 120_000).toISOString(), sequence: 3, round: 2, source: 'User', isNewRequirement: true, note: '改成面向管理层。' },
      { id: `${taskId}-event-4`, taskId, type: 'regeneration', timestamp: new Date(Date.parse(timestamp) + 180_000).toISOString(), sequence: 4, round: 2, source: 'System' },
      { id: `${taskId}-event-5`, taskId, type: 'accept', timestamp: new Date(Date.parse(timestamp) + 240_000).toISOString(), sequence: 5, round: 2, source: 'User', note: '最终产物已接受。' }
    ]
  }
  const patterns: ProductAcceptanceEventType[][] = [
    ['download', 'copy', 'accept'],
    ['like', 'accept'],
    ['correction', 'regeneration', 'accept'],
    ['correction', 'correction', 'regeneration'],
    ['dislike'],
    ['download', 'new_requirement', 'regeneration', 'accept'],
    ['copy', 'accept'],
    ['download', 'correction', 'correction', 'regeneration', 'accept']
  ]
  const pattern = patterns[index % patterns.length]
  return pattern.map((type, eventIndex) => ({
    id: `${taskId}-event-${eventIndex + 1}`,
    taskId,
    type,
    timestamp: new Date(Date.parse(timestamp) + eventIndex * 60_000).toISOString(),
    sequence: eventIndex + 1,
    round: type === 'new_requirement' ? eventIndex + 2 : Math.floor(eventIndex / 2) + 1,
    source: type === 'regeneration' ? 'System' : 'User',
    isNewRequirement: type === 'new_requirement',
    note: seed.status === 'Failed' && type === 'dislike' ? 'User rejected the delivered result.' : undefined
  }))
}

const makeEvidence = (taskId: string, observationId: string, node: ObservationNode, status: JudgeStatus): Evidence => ({
  id: `evidence-${taskId}-${observationId}`,
  observationId,
  type: status === 'FAIL' ? 'Error' : node === 'Final Outcome' ? 'Artifact' : 'Output',
  summary: status === 'FAIL' ? `${node} returned a failing signal for ${taskId}` : `${node} output supports the evaluation`,
  source: status === 'FAIL' ? 'Eval Agent / trace observation' : 'Trace observation'
})

const makeTrace = (taskId: string, traceId: string, seed: TaskSeed, index: number) => {
  const sessionId = index < 2 ? 'session-001' : `session-${String(index + 1).padStart(3, '0')}`
  const failNode: ObservationNode | null = seed.rootCause === 'Memory'
    ? 'Memory'
    : seed.rootCause === 'Context'
      ? 'Planning / Decision'
      : seed.rootCause === 'Task Understanding'
        ? 'Task Understanding'
        : seed.rootCause === 'Tool'
          ? 'Tool'
          : seed.rootCause === 'Skill Routing'
            ? 'Skill Routing'
            : seed.rootCause === 'Loop / Retry'
              ? 'Loop / Retry'
              : seed.rootCause === 'Planning / Decision'
                ? 'Planning / Decision'
                : seed.rootCause === 'Skill Internal'
                  ? 'Skill'
                  : seed.rootCause === 'External Engineering'
                    ? 'Tool'
                    : null
  const omitMemory = seed.rootCause === 'None' && index % 11 === 0
  const omitSkill = seed.rootCause === 'None' && index % 13 === 0
  const omitTool = seed.rootCause === 'None' && index % 7 === 0
  const nodes: ObservationNode[] = ['Task Understanding', 'Planning / Decision', ...(omitMemory ? [] : ['Memory' as const]), 'Context Assembly', 'Skill Routing', ...(omitSkill ? [] : ['Skill' as const]), ...(omitTool ? [] : ['Tool' as const])]
  if (seed.status !== 'Effective') nodes.push('Loop / Retry')
  nodes.push('Final Outcome')
  const firstFailureSequence = failNode ? nodes.indexOf(failNode) + 1 : -1
  const firstFailureObservationId = firstFailureSequence > 0 ? `obs-${taskId}-${firstFailureSequence}` : undefined
  const observations: Observation[] = nodes.map((nodeType, sequence) => {
    const isContextEvidence = nodeType === 'Context Assembly'
    const insufficientEvidence = seed.rootCause === 'None' && index % 10 === 0 && nodeType === 'Memory'
    const isRootFailure = nodeType === failNode && !isContextEvidence
    const isDerived = !isContextEvidence && (seed.rootCause === 'Tool' && nodeType === 'Final Outcome'
      || seed.rootCause === 'Context' && nodeType === 'Final Outcome'
      // Any terminal failure after a known root is a propagation failure.
      || Boolean(failNode && nodeType === 'Final Outcome'))
    const failed = !isContextEvidence && !insufficientEvidence && (isRootFailure || isDerived || (nodeType === 'Final Outcome' && seed.status === 'Failed'))
    const judgeStatus: JudgeStatus = isContextEvidence ? 'N/A' : insufficientEvidence ? 'UNKNOWN' : isDerived ? 'DERIVED_FAIL' : failed ? 'FAIL' : 'PASS'
    const observationId = `obs-${taskId}-${sequence + 1}`
    return {
      id: observationId,
      traceId,
      sequence: sequence + 1,
      nodeType,
      // Context is assembled in full but is not independently evaluated.
      status: judgeStatus,
      judgeStatus,
      input: `${nodeType} input snapshot for ${taskId}`,
      output: isContextEvidence ? 'Full Context assembled for downstream module evaluation.' : insufficientEvidence ? `${nodeType} evidence is insufficient for a local judge.` : failed ? `${nodeType} produced an unexpected result` : `${nodeType} completed with expected evidence`,
      latency: 280 + ((index * 71 + sequence * 113) % 3400),
      model: nodeType === 'Tool' ? undefined : models[(index + sequence) % models.length],
      tool: nodeType === 'Tool' ? toolNames[index % toolNames.length] : undefined,
      tokenUsage: nodeType === 'Tool' ? undefined : 320 + ((index + sequence) * 97) % 2800,
      rootCause: isRootFailure ? seed.rootCause : undefined,
      derived: isDerived,
      isRootCause: isRootFailure,
    derivedFrom: isDerived ? seed.rootCause : undefined,
      derivedFromObservationId: isDerived ? firstFailureObservationId : undefined,
      score: isContextEvidence ? 0 : insufficientEvidence ? 0.5 : failed ? (isDerived ? 0.35 : 0.12) : 0.94,
      reason: isContextEvidence ? 'Context is assembled in full and is not evaluated as a standalone module; use this snapshot as downstream Evidence.' : insufficientEvidence ? `${nodeType} cannot be judged because local Evidence is insufficient.` : failed ? (isDerived ? `Derived from upstream ${seed.rootCause} failure${seed.rootCause === 'Context' ? '; Context evidence influenced this decision.' : '.'}` : `${nodeType} evidence indicates the first failure${seed.rootCause === 'Context' ? '; Context evidence indicates the assembled context was incomplete or conflicting.' : ''}`) : `${nodeType} evidence supports PASS`,
      error: failed ? `${nodeType} evidence requires review` : undefined,
      metadata: {
        agentVersion: index % 2 === 0 ? VERSION_A : VERSION_B,
        environment: seed.environment,
        complexity: seed.complexity
      },
      evidenceIds: [`evidence-${taskId}-${observationId}`],
      evalResult: judgeStatus,
      rubricEvidence: [{
        id: `rubric-${observationId}`,
        evidenceId: `evidence-${taskId}-${observationId}`,
        observationId,
        kind: isContextEvidence ? 'Input' : insufficientEvidence ? 'Rule' : failed ? 'Error' : 'Output',
        summary: isContextEvidence ? 'Full Context assembly snapshot is available as downstream Evidence.' : insufficientEvidence ? 'Local Evidence is insufficient for a confident judge.' : failed ? `${nodeType} local evidence requires review` : `${nodeType} local evidence supports the judge`,
        requirement: isContextEvidence ? 'Context is full assembly evidence, not a standalone KPI.' : undefined,
        source: 'Trace observation'
      }],
      judgeResult: {
        status: judgeStatus,
        score: isContextEvidence ? 0 : insufficientEvidence ? 0.5 : failed ? (isDerived ? 0.35 : 0.12) : 0.94,
        reason: isContextEvidence ? 'Context is assembled in full and is not evaluated as a standalone module; use this snapshot as downstream Evidence.' : insufficientEvidence ? `${nodeType} cannot be judged because local Evidence is insufficient.` : failed ? (isDerived ? `Derived from upstream ${seed.rootCause} failure${seed.rootCause === 'Context' ? '; Context evidence influenced this decision.' : '.'}` : `${nodeType} evidence indicates the first failure${seed.rootCause === 'Context' ? '; Context evidence indicates the assembled context was incomplete or conflicting.' : ''}`) : `${nodeType} evidence supports PASS`,
        rubricEvidence: [{
          id: `rubric-${observationId}`,
          evidenceId: `evidence-${taskId}-${observationId}`,
          observationId,
          kind: isContextEvidence ? 'Input' : insufficientEvidence ? 'Rule' : failed ? 'Error' : 'Output',
          summary: isContextEvidence ? 'Full Context assembly snapshot is available as downstream Evidence.' : insufficientEvidence ? 'Local Evidence is insufficient for a confident judge.' : failed ? `${nodeType} local evidence requires review` : `${nodeType} local evidence supports the judge`,
          requirement: isContextEvidence ? 'Context is full assembly evidence, not a standalone KPI.' : undefined,
          source: 'Trace observation'
        }],
        isRootCause: isRootFailure,
        derivedFrom: isDerived ? seed.rootCause : undefined,
        derivedFromObservationId: isDerived ? firstFailureObservationId : undefined
      }
    }
  })
  const trace: Trace = {
    id: traceId,
    taskId,
    sessionId,
    startedAt: `2026-08-24T${String(8 + (index % 9)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00.000Z`,
    totalLatency: observations.reduce((sum, observation) => sum + observation.latency, 0),
    observations
  }
  return { trace, observations, sessionId }
}

const makeProductValidity = (taskId: string, evals: EvalResult[], traceObservations: Observation[], seed: TaskSeed): ProductValidity => {
  const statusFor = (dimension: string): JudgeStatus => evals.find((item) => item.dimension === dimension)?.autoStatus ?? 'UNKNOWN'
  const outcomeType = statusFor('Outcome Type Consistency')
  const intentConsistency = statusFor('Intent Consistency')
  const constraintSatisfaction = statusFor('Constraint Satisfaction')
  const accuracy = statusFor('Accuracy')
  const legacyUsability = statusFor('Result Usability')
  const fileValidity = legacyUsability === 'UNKNOWN' ? 'UNKNOWN' : legacyUsability
  const statuses = [outcomeType, intentConsistency, constraintSatisfaction, accuracy, fileValidity]
  const qualified = statuses.every((status) => status === 'PASS')
  const score = roundScore(statuses.reduce((sum, status) => sum + (status === 'PASS' ? 1 : status === 'UNKNOWN' || status === 'N/A' ? 0.5 : 0), 0) / statuses.length)
  return {
    taskId,
    outcomeType,
    intentConsistency,
    constraintSatisfaction,
    accuracy,
    fileValidity,
    resultUsability: fileValidity,
    qualified,
    score,
    artifactAvailable: seed.businessType !== 'General',
    fileOpenable: fileValidity === 'PASS',
    linkValid: fileValidity === 'PASS' || seed.businessType === 'General',
    actionExecutable: seed.status !== 'Failed',
    accuracyBreakdown: {
      factual: accuracy,
      logical: accuracy,
      evidenceTraceable: traceObservations.some((observation) => observation.evidenceIds.length > 0) ? 'PASS' : 'UNKNOWN',
      execution: seed.status === 'Failed' ? 'FAIL' : 'PASS'
    },
    evidenceIds: evals.flatMap((item) => item.evidenceIds),
    reason: qualified ? 'All five qualified-product gates passed.' : 'At least one qualified-product gate requires review.'
  }
}

const makeProcessEfficiency = (taskId: string, taskIndex: number, seed: TaskSeed, latency: number, processEvals: EvalResult[], toolCalls: number, retryCount: number, loopCount: number, tokens: number, cost: number, traceObservations: Observation[]): ProcessEfficiency => {
  // Some fixtures intentionally omit expected latency/TTFT to exercise the
  // UNKNOWN path instead of silently treating missing telemetry as a pass.
  const expectedLatencyMs = taskIndex % 7 === 0 ? undefined : Math.round(latency / (1.05 + (taskIndex % 4) * 0.25))
  const latencyRatio = expectedLatencyMs ? Math.round((latency / expectedLatencyMs) * 100) / 100 : undefined
  const latencyBand = latencyBandFor(latencyRatio)
  const statusFor = (dimension: string): JudgeStatus => processEvals.find((item) => item.dimension === dimension)?.autoStatus ?? 'UNKNOWN'
  const totalLatencyEfficiency: JudgeStatus = latencyRatio === undefined ? 'UNKNOWN' : latencyRatio <= 1.5 ? 'PASS' : 'FAIL'
  const tokenEfficiency: JudgeStatus = tokens <= (seed.complexity === 'Complex' ? 18000 : 12000) ? 'PASS' : 'FAIL'
  const costEfficiency: JudgeStatus = seed.status === 'Failed' ? 'UNKNOWN' : cost <= (seed.complexity === 'Complex' ? 0.12 : 0.1) ? 'PASS' : 'FAIL'
  const necessaryLoop = statusFor('Redundant Loop') === 'FAIL' || loopCount > 2 ? 'FAIL' : statusFor('Redundant Loop')
  const skillToolSelection = [statusFor('Skill Selection'), statusFor('Tool Selection')].every((status) => status === 'PASS') ? 'PASS' : [statusFor('Skill Selection'), statusFor('Tool Selection')].some((status) => status === 'UNKNOWN') ? 'UNKNOWN' : 'FAIL'
  const toolResult = traceObservations.filter((item) => item.tool).some((item) => item.status === 'FAIL') ? 'FAIL' : toolCalls ? 'PASS' : 'N/A'
  const retryEffectiveness = retryCount === 0 ? 'N/A' : seed.status === 'Effective but Inefficient' ? 'PASS' : 'FAIL'
  const recoverySuccess = seed.status === 'Failed' ? 'FAIL' : retryCount > 0 ? 'PASS' : 'N/A'
  const targetStatuses = [totalLatencyEfficiency, tokenEfficiency, costEfficiency, necessaryLoop, skillToolSelection, toolResult, retryEffectiveness, recoverySuccess]
  const knownStatuses = targetStatuses.filter((status) => status !== 'UNKNOWN' && status !== 'N/A')
  const score = knownStatuses.length ? roundScore(knownStatuses.filter((status) => status === 'PASS').length / knownStatuses.length) : 0.5
  const targetMet = expectedLatencyMs === undefined ? null : totalLatencyEfficiency === 'PASS' && targetStatuses.every((status) => status === 'PASS' || status === 'N/A')
  const outOfExpectation = targetMet === false || seed.status === 'Effective but Inefficient'
  const oneShotSuccess = toolCalls === 0 ? null : retryCount === 0 && toolResult === 'PASS'
  return {
    taskId,
    actualLatencyMs: latency,
    expectedLatencyMs,
    latencyRatio,
    latencyBand,
    totalLatencyEfficiency,
    tokenEfficiency,
    costEfficiency,
    necessaryLoop,
    skillToolSelection,
    toolResult,
    retryEffectiveness,
    recoverySuccess,
    targetMet,
    outOfExpectation,
    score,
    inputTokens: Math.round(tokens * 0.62),
    outputTokens: Math.round(tokens * 0.38),
    cost,
    loopCount,
    retryCount,
    oneShotSuccess,
    reason: targetMet === null ? 'Expected latency baseline has not been established.' : targetMet ? 'Process signals meet the business expectation.' : 'One or more process signals are outside the business expectation.',
    evidenceIds: processEvals.flatMap((item) => item.evidenceIds)
  }
}

const makePerformance = (latency: number, taskIndex: number, tokens: number, toolCalls: number, retryCount: number, traceObservations: Observation[]): TaskPerformance => {
  const inputTokens = Math.round(tokens * 0.62)
  const outputTokens = tokens - inputTokens
  const ttftMs = taskIndex % 5 === 0 ? undefined : 280 + (taskIndex * 73) % 1400
  const cacheHit = taskIndex % 4 !== 1
  const toolFailures = traceObservations.filter((item) => item.tool && item.status === 'FAIL').length
  return {
    actualLatencyMs: latency,
    expectedLatencyMs: taskIndex % 7 === 0 ? undefined : Math.round(latency / (1.05 + (taskIndex % 4) * 0.25)),
    ttftMs,
    inputTokens,
    outputTokens,
    cacheHit,
    cacheHitRate: cacheHit ? 0.72 + (taskIndex % 4) * 0.04 : 0.18,
    toolCallFrequency: toolCalls / Math.max(1, latency / 1000),
    oneShotToolSuccess: toolCalls === 0 ? null : retryCount === 0 && toolFailures === 0,
    throughputTokensPerSecond: latency > 0 ? Math.round((tokens / (latency / 1000)) * 10) / 10 : undefined,
    costDeviation: taskIndex % 6 === 0 ? undefined : Math.round(((taskIndex % 5) - 2) * 8.5 * 10) / 10,
    modelVersion: models[taskIndex % models.length]
  }
}

const makeRootCauseAttribution = (taskId: string, traceId: string, traceObservations: Observation[], rootCause: RootCause): RootCauseAttribution => {
  const ordered = [...traceObservations].sort((a, b) => a.sequence - b.sequence)
  const first = ordered.find((observation) => {
    const status = observation.judgeStatus ?? observation.status
    return status === 'FAIL' && !observation.derived
  })
  const derivedFailureObservationIds = first
    ? ordered.filter((observation) => observation.sequence > first.sequence && (observation.judgeStatus === 'DERIVED_FAIL' || observation.derived || observation.status === 'FAIL')).map((observation) => observation.id)
    : []
  return {
    taskId,
    traceId,
    firstFailureNode: first?.nodeType ?? null,
    firstFailureObservationId: first?.id,
    rootCause: first ? rootCause : 'None',
    isRootCause: Boolean(first),
    derivedFailureObservationIds,
    derivedFrom: first ? rootCause : undefined,
    derivedFromObservationId: first?.id,
    evidenceIds: first?.evidenceIds ?? []
  }
}

const tasks: Task[] = []
const traces: Trace[] = []
const observations: Observation[] = []
const evidence: Evidence[] = []
const acceptanceEvents: ProductAcceptanceEvent[] = []
const productValidities: ProductValidity[] = []
const processEfficiencies: ProcessEfficiency[] = []
const rootCauseAttributions: RootCauseAttribution[] = []
const riskCommercialEvents: RiskCommercialEvent[] = []

taskSeeds.forEach((seed, index) => {
  const taskId = `task-${String(index + 1).padStart(3, '0')}`
  const traceId = `trace-${String(index + 1).padStart(3, '0')}`
  const { trace, observations: traceObservations, sessionId } = makeTrace(taskId, traceId, seed, index)
  traces.push(trace)
  observations.push(...traceObservations)
  traceObservations.forEach((observation) => evidence.push(makeEvidence(taskId, observation.id, observation.nodeType, observation.status)))
  const evals: EvalResult[] = RESULT_DIMENSIONS.map((dimension, dimensionIndex) => {
    const status = statusForDimension(seed, dimensionIndex)
    const evidenceId = traceObservations[Math.min(dimensionIndex, traceObservations.length - 1)].evidenceIds[0]
    const contextNote = seed.rootCause === 'Context' ? ' Context evidence: the full assembled context contains conflicting or incomplete material.' : ''
    return {
      id: `eval-${taskId}-result-${dimensionIndex}`,
      taskId,
      family: 'Result Eval',
      dimension,
      autoStatus: status,
      autoReason: status === 'PASS' ? `${dimension} meets the seeded rubric${contextNote}` : `${dimension} is contradicted by trace evidence.${contextNote}`,
      evidenceIds: [evidenceId],
      score: status === 'PASS' ? 0.94 : 0.18,
      reason: status === 'PASS' ? `${dimension} local evidence supports PASS.${contextNote}` : `${dimension} local evidence supports FAIL.${contextNote}`,
      rubricEvidence: [{ id: `rubric-eval-${taskId}-result-${dimensionIndex}`, evidenceId, observationId: traceObservations[Math.min(dimensionIndex, traceObservations.length - 1)].id, kind: status === 'PASS' ? 'Output' : 'Error', summary: status === 'PASS' ? `${dimension} evidence passed.` : `${dimension} evidence failed.`, source: 'Eval Agent', requirement: seed.rootCause === 'Context' ? 'Use full Context assembly as Evidence; do not score Context as a standalone KPI.' : `${dimension} rubric requirement.` }],
      status,
      judgeVersion: dimensionIndex % 2 === 0 ? 'rubric-2026.08' : 'judge-5.3'
    }
  })
  const processEvals: EvalResult[] = PROCESS_DIMENSIONS.map((dimension, dimensionIndex) => {
    const fail = seed.status === 'Failed' && (dimensionIndex + index) % 7 === 0
    const status: EvalStatus = fail ? 'FAIL' : 'PASS'
    const evidenceId = traceObservations[Math.min(dimensionIndex, traceObservations.length - 1)].evidenceIds[0]
    const contextNote = seed.rootCause === 'Context' ? ' Context evidence was reviewed as part of this module decision.' : ''
    return {
      id: `eval-${taskId}-process-${dimensionIndex}`,
      taskId,
      family: 'Process Eval',
      dimension,
      autoStatus: status,
      autoReason: status === 'PASS' ? `Process signal is within the seeded rubric.${contextNote}` : `Process signal needs review.${contextNote}`,
      evidenceIds: [evidenceId],
      score: status === 'PASS' ? 0.92 : 0.2,
      reason: status === 'PASS' ? `Local process evidence supports the judge.${contextNote}` : `Local process evidence indicates a process exception.${contextNote}`,
      rubricEvidence: [{ id: `rubric-eval-${taskId}-process-${dimensionIndex}`, evidenceId, observationId: traceObservations[Math.min(dimensionIndex, traceObservations.length - 1)].id, kind: status === 'PASS' ? 'Output' : 'Error', summary: status === 'PASS' ? 'Process observation meets the rubric.' : 'Process observation needs review.', source: 'Trace observation', requirement: seed.rootCause === 'Context' ? 'Context is supporting Evidence for this module evaluation.' : 'Process observation requirement.' }],
      status,
      judgeVersion: 'process-judge-2.1'
    }
  })
  const latency = trace.totalLatency
  const cost = Number((0.018 + (index % 7) * 0.011 + (seed.complexity === 'Complex' ? 0.034 : 0)).toFixed(3))
  const modelCalls = traceObservations.filter((observation) => observation.model).length
  const toolCalls = traceObservations.filter((observation) => observation.tool).length
  const loopCount = seed.status === 'Effective but Inefficient' ? 2 + (index % 3) : seed.status === 'Failed' ? 1 + (index % 2) : index % 2
  const retryCount = seed.status === 'Effective but Inefficient' ? 1 + (index % 2) : seed.status === 'Failed' ? 1 : 0
  const acceptance = acceptanceEventsFor(taskId, seed, index)
  const validity = makeProductValidity(taskId, evals, traceObservations, seed)
  const efficiency = makeProcessEfficiency(taskId, index, seed, latency, processEvals, toolCalls, retryCount, loopCount, traceObservations.reduce((sum, observation) => sum + (observation.tokenUsage ?? 0), 0), cost, traceObservations)
  const performance = makePerformance(latency, index, traceObservations.reduce((sum, observation) => sum + (observation.tokenUsage ?? 0), 0), toolCalls, retryCount, traceObservations)
  const attribution = makeRootCauseAttribution(taskId, traceId, traceObservations, seed.rootCause)
  const riskEvents: RiskCommercialEvent[] = []
  if (index % 9 === 2) riskEvents.push({ id: `${taskId}-risk-1`, taskId, type: 'risk_interception', blocked: true, reason: 'Potentially sensitive content detected', category: 'content_safety', timestamp: trace.startedAt, source: 'Policy guard' })
  if (index % 11 === 4) riskEvents.push({ id: `${taskId}-commercial-1`, taskId, type: 'commercial_interception', blocked: true, reason: 'Capability is outside current plan', category: 'entitlement', timestamp: trace.startedAt, source: 'Commercial gate' })
  acceptanceEvents.push(...acceptance)
  productValidities.push(validity)
  processEfficiencies.push(efficiency)
  rootCauseAttributions.push(attribution)
  riskCommercialEvents.push(...riskEvents)
  tasks.push({
    id: taskId,
    traceId,
    sessionId,
    query: seed.query,
    businessType: seed.businessType,
    complexity: seed.complexity,
    agentVersion: index % 2 === 0 ? VERSION_A : VERSION_B,
    environment: seed.environment,
    status: seed.status,
    outcomeType: index % 3 === 0 ? 'Content Artifact' : index % 3 === 1 ? 'Information Delivery' : 'Operation',
    rootCause: seed.rootCause,
    latency,
    cost,
    tokens: traceObservations.reduce((sum, observation) => sum + (observation.tokenUsage ?? 0), 0),
    modelCalls,
    toolCalls,
    loopCount,
    retryCount,
    timestamp: trace.startedAt,
    skill: seed.skill,
    finalOutcome: seed.status === 'Failed' ? 'Delivered result requires human review' : seed.status === 'Effective but Inefficient' ? 'Delivered result after redundant calls' : 'Delivered result accepted',
    evals,
    processEvals,
    isBadcase: seed.status === 'Failed',
    isGolden: index % 5 === 0 || index === 0,
    acceptanceEvents: acceptance,
    productValidity: validity,
    processEfficiency: efficiency,
    rootCauseAttribution: attribution,
    riskCommercialEvents: riskEvents,
    performance
  })
})

// Required PRD evidence for the canonical Memory -> Context propagation case.
const task001Memory = observations.find((item) => item.traceId === 'trace-001' && item.nodeType === 'Memory')
const task001Context = observations.find((item) => item.traceId === 'trace-001' && item.nodeType === 'Context Assembly')
const task001Outcome = observations.find((item) => item.traceId === 'trace-001' && item.nodeType === 'Final Outcome')
if (task001Memory) {
  task001Memory.input = 'query_requirement: 面向管理层; historical preference candidate available'
  task001Memory.output = 'memory_value: 面向普通员工'
  task001Memory.reason = 'Memory selected the stale audience preference despite an explicit current requirement.'
  task001Memory.metadata = { ...task001Memory.metadata, query_requirement: '面向管理层', memory_value: '面向普通员工' }
  task001Memory.rubricEvidence = [{ id: 'rubric-task-001-memory', evidenceId: task001Memory.evidenceIds[0], observationId: task001Memory.id, kind: 'Rule', summary: 'Explicit current requirements must override stale preferences.', quote: 'query_requirement=面向管理层; memory_value=面向普通员工', source: 'Memory attribution rubric', requirement: 'Current explicit instruction has precedence.' }]
  task001Memory.judgeResult = { status: 'FAIL', score: 0.05, reason: task001Memory.reason, rubricEvidence: task001Memory.rubricEvidence, isRootCause: true }
  task001Memory.score = 0.05
}
if (task001Context) {
  task001Context.input = 'query_requirement: 面向管理层; memory_value: 面向普通员工'
  task001Context.output = 'Full Context assembled with audience=普通员工; downstream judges use this as Evidence.'
  task001Context.status = 'N/A'
  task001Context.judgeStatus = 'N/A'
  task001Context.evalResult = 'N/A'
  task001Context.derived = false
  task001Context.derivedFrom = undefined
  task001Context.derivedFromObservationId = undefined
  task001Context.isRootCause = false
  task001Context.reason = 'Context is assembled in full and is not evaluated independently; this snapshot is used as downstream Evidence.'
  task001Context.metadata = { ...task001Context.metadata, query_requirement: '面向管理层', memory_value: '面向普通员工' }
  task001Context.rubricEvidence = [{ id: 'rubric-task-001-context', evidenceId: task001Context.evidenceIds[0], observationId: task001Context.id, kind: 'Input', summary: 'Full Context assembly is available as downstream Evidence.', quote: 'memory_value=面向普通员工', source: 'Context evidence contract', requirement: 'Context is full assembly evidence, not a standalone KPI.' }]
  task001Context.judgeResult = { status: 'N/A', score: 0, reason: task001Context.reason, rubricEvidence: task001Context.rubricEvidence, isRootCause: false }
  task001Context.score = 0
}
const task001IntentEval = tasks.find((item) => item.id === 'task-001')?.evals.find((item) => item.dimension === 'Intent Consistency')
if (task001IntentEval) {
  const intentEvidenceId = task001IntentEval.evidenceIds[0]
  task001IntentEval.autoReason = '最终PPT面向普通员工，与用户当前要求的“面向管理层”不一致。'
  task001IntentEval.reason = '最终PPT面向普通员工，与用户当前要求的“面向管理层”不一致。Context evidence was reviewed as full assembly input, not as a standalone KPI.'
  task001IntentEval.rubricEvidence = [{ id: 'rubric-task-001-intent', evidenceId: intentEvidenceId, observationId: task001Context?.id, kind: 'Rule', summary: 'The final artifact audience must match the latest explicit user requirement.', quote: 'query_requirement=面向管理层; final_output_audience=普通员工', source: 'Office Eval Agent', requirement: 'Intent Consistency: the delivered audience must match the current explicit request.' }]
}
if (task001Outcome) {
  task001Outcome.metadata = { ...task001Outcome.metadata, final_output_audience: '普通员工' }
  task001Outcome.output = 'final_output_audience: 普通员工; final artifact does not match 面向管理层'
}

const task001Attribution = rootCauseAttributions.find((item) => item.taskId === 'task-001')
if (task001Attribution) {
  task001Attribution.firstFailureNode = 'Memory'
  task001Attribution.firstFailureObservationId = task001Memory?.id
  task001Attribution.rootCause = 'Memory'
  task001Attribution.derivedFailureObservationIds = [task001Outcome?.id].filter((item): item is string => Boolean(item))
  task001Attribution.derivedFrom = 'Memory'
  task001Attribution.derivedFromObservationId = task001Memory?.id
  task001Attribution.evidenceIds = task001Memory?.evidenceIds ?? []
}

const cases: CaseRecord[] = tasks.filter((task) => task.isBadcase || task.status === 'Effective but Inefficient').map((task, index) => {
  const failedEval = task.evals.find((evaluation) => evaluation.autoStatus === 'FAIL') ?? task.evals[0]
  const firstFailure = traces.find((trace) => trace.id === task.traceId)?.observations.find((observation) => observation.status === 'FAIL')
  const status: CaseRecord['status'] = task.id === 'task-001' || index % 4 === 0 ? 'Confirmed Badcase' : index % 5 === 0 ? 'Resolved' : 'Candidate'
  return {
    id: `case-${task.id}`,
    taskId: task.id,
    traceId: task.traceId,
    query: task.query,
    status,
    source: index % 4 === 0 ? 'Auto Eval' : index % 4 === 1 ? 'User Feedback' : index % 4 === 2 ? 'System Error' : 'Manual Review',
    failureDimension: failedEval.dimension,
    firstFailureNode: firstFailure?.nodeType ?? null,
    rootCause: task.rootCause,
    derivedFailure: Boolean(firstFailure?.derived),
    severity: index % 5 === 0 ? 'P0' : index % 3 === 0 ? 'P1' : index % 2 === 0 ? 'P2' : 'P3',
    owner: ['General Agent', 'PPT', 'Excel', 'Word', 'Tool', 'Infra'][index % 6] as CaseRecord['owner'],
    note: task.id === 'task-001' ? '错误召回普通员工受众，导致管理层 PPT 方向偏离。' : 'Seeded governance case for the demo workflow.',
    autoStatus: failedEval.autoStatus,
    humanStatus: status === 'Confirmed Badcase' && index % 2 === 0 ? 'FAIL' : undefined,
    autoReason: failedEval.autoReason,
    humanReason: status === 'Confirmed Badcase' ? '人工复核确认与用户预期不一致。' : undefined,
    updatedAt: NOW,
    score: failedEval.score,
    rubricEvidence: failedEval.rubricEvidence,
    firstFailureObservationId: firstFailure?.id,
    derivedFrom: firstFailure?.derivedFrom,
    acceptanceEventIds: tasks.find((candidate) => candidate.id === task.id)?.acceptanceEvents?.map((event) => event.id)
  }
})

const makeDatasetEntry = (datasetId: string, task: Task, version: string, type: DatasetEntry['type'], index: number): DatasetEntry => ({
  id: `entry-${datasetId}-${task.id}`,
  datasetId,
  taskId: task.id,
  caseId: task.caseId,
  query: task.query,
  type,
  outcomeType: task.outcomeType,
  complexity: task.complexity,
  capabilityTags: [task.businessType, task.skill, task.rootCause === 'None' ? 'happy-path' : 'failure-analysis'],
  expectedResult: task.status === 'Failed' ? 'Agent 应明确暴露失败并请求用户修正。' : 'Agent 应交付可复核且带有 Evidence 的结果。',
  constraints: task.businessType === 'PPT' ? '受众和页数必须符合用户请求。' : '遵循源数据和用户明确约束。',
  expectedProcess: task.rootCause === 'None' ? '任务理解 → 规划 → 组装 Context → 执行 → 验证' : '定位首错 → 解释 Evidence → 恢复或请求复核',
  goldenLabel: task.status === 'Failed' ? 'FAIL' : 'PASS',
  rootCause: task.rootCause,
  sourceTraceId: task.traceId,
  version,
  enabled: index % 5 !== 4,
  history: [{ version, changedAt: NOW, summary: 'Initial seeded dataset entry' }]
})

const primaryDatasetId = 'dataset-golden-v3'
const historicalDatasetId = 'dataset-historical-v2'
const challengeDatasetId = 'dataset-challenge-v1'
const datasets: Dataset[] = [
  {
    id: primaryDatasetId,
    name: 'Core Golden Cases',
    description: '用于版本发布对比的稳定结果与过程案例。',
    version: 'v3.2',
    type: 'Golden Case',
    entries: tasks.slice(0, 10).map((task, index) => makeDatasetEntry(primaryDatasetId, task, 'v3.2', 'Golden Case', index)),
    updatedAt: NOW
  },
  {
    id: historicalDatasetId,
    name: 'Historical Badcase Replay',
    description: '保留已确认失败案例，用于回归和 Root Cause 复盘。',
    version: 'v2.8',
    type: 'Historical Badcase',
    entries: tasks.filter((task) => task.status === 'Failed').slice(0, 8).map((task, index) => makeDatasetEntry(historicalDatasetId, task, 'v2.8', 'Historical Badcase', index)),
    updatedAt: '2026-08-22T09:30:00.000Z'
  },
  {
    id: challengeDatasetId,
    name: 'Challenge Boundary Cases',
    description: '覆盖复杂度、缺失遥测、首错归因和异常恢复的挑战样例。',
    version: 'v1.0',
    type: 'Challenge Case',
    entries: tasks.filter((task) => task.complexity === 'Complex' || task.rootCause === 'Task Understanding').slice(0, 10).map((task, index) => makeDatasetEntry(challengeDatasetId, task, 'v1.0', 'Challenge Case', index)),
    updatedAt: NOW
  }
]

const benchmarkMetrics = (versionA: string, versionB: string, seed: number): BenchmarkMetric[] => [
  { id: 'completion', label: '有效任务完成率', family: 'Result Eval', unit: 'percent', versionA: 82 + seed, versionB: 88 + seed, delta: 6, sourceTaskIds: tasks.slice(0, 12).map((task) => task.id) },
  { id: 'intent', label: '意图一致率', family: 'Result Eval', unit: 'percent', versionA: 91 + seed, versionB: 95 + seed, delta: 4, sourceTaskIds: tasks.slice(0, 14).map((task) => task.id) },
  { id: 'context', label: 'Context 有效率', family: 'Process Eval', unit: 'percent', versionA: 84 + seed, versionB: 90 + seed, delta: 6, sourceTaskIds: tasks.slice(0, 10).map((task) => task.id) },
  { id: 'memory', label: 'Memory 有效率', family: 'Process Eval', unit: 'percent', versionA: 78 + seed, versionB: 85 + seed, delta: 7, sourceTaskIds: tasks.slice(0, 9).map((task) => task.id) },
  { id: 'latency', label: 'P95 Latency', family: 'Performance Metric', unit: 'duration', versionA: 51000 - seed * 900, versionB: 46000 - seed * 600, delta: -9.8, sourceTaskIds: tasks.slice(0, 16).map((task) => task.id) }
]

const benchmarkCases = (seed: number): BenchmarkCaseResult[] => tasks.slice(0, 12).map((task, index) => {
  const buckets: BenchmarkCaseResult['bucket'][] = ['Improved Cases', 'Regressed Cases', 'Unchanged Failed Cases', 'Newly Failed Cases']
  const bucket = buckets[(index + seed) % buckets.length]
  return {
    id: `benchmark-case-${seed}-${task.id}`,
    taskId: task.id,
    bucket,
    reason: bucket === 'Regressed Cases' ? 'Version B changed a passing outcome to a failing one.' : bucket === 'Improved Cases' ? 'Version B resolved the prior failure.' : bucket === 'Newly Failed Cases' ? 'Version B introduced a new failure signal.' : 'Both versions retained the same failure signal.',
    traceAId: task.traceId,
    traceBId: task.traceId
  }
})

const benchmarks: BenchmarkRun[] = [
  {
    id: 'benchmark-2026-08-23',
    datasetId: primaryDatasetId,
    datasetVersion: 'v3.1',
    versionA: VERSION_A,
    versionB: 'agent-2.4.1',
    environment: 'Production',
    rubricVersion: 'rubric-2026.08',
    status: 'Completed',
    createdAt: '2026-08-23T08:15:00.000Z',
    completedAt: '2026-08-23T08:24:00.000Z',
    metrics: benchmarkMetrics(VERSION_A, 'agent-2.4.1', 0),
    caseResults: benchmarkCases(0)
  },
  {
    id: 'benchmark-2026-08-24',
    datasetId: primaryDatasetId,
    datasetVersion: 'v3.2',
    versionA: VERSION_A,
    versionB: VERSION_B,
    environment: 'Staging',
    rubricVersion: 'rubric-2026.08',
    status: 'Completed',
    createdAt: '2026-08-24T09:10:00.000Z',
    completedAt: '2026-08-24T09:19:00.000Z',
    metrics: benchmarkMetrics(VERSION_A, VERSION_B, 1),
    caseResults: benchmarkCases(1)
  }
]

const evalConfigs: EvalConfig[] = [
  ...RESULT_DIMENSIONS.map((dimension, index) => ({
    id: `config-result-${index}`,
    family: 'Result Eval' as const,
    dimension,
    evalType: index % 2 === 0 ? 'LLM-as-Judge' as const : 'Rule' as const,
    rubricVersion: 'rubric-2026.08',
    enabled: true,
    threshold: 0.86 + index * 0.02,
    prompt: `Judge ${dimension} against the expected outcome and constraints.`,
    evidenceRequirement: 'At least one output or artifact observation.',
    judgeVersion: 'judge-5.3',
    description: 'Outcome-level quality signal.'
  })),
  ...PROCESS_DIMENSIONS.map((dimension, index) => ({
    id: `config-process-${index}`,
    family: 'Process Eval' as const,
    dimension,
    evalType: index % 3 === 0 ? 'Script' as const : 'LLM-as-Judge' as const,
    rubricVersion: 'rubric-2026.08',
    enabled: index !== 7,
    threshold: 0.8 + (index % 4) * 0.03,
    prompt: `Inspect the ${dimension} observation and classify the process quality.`,
    evidenceRequirement: index === 7 ? '' : 'Observation input, output and status are required.',
    judgeVersion: 'process-judge-2.1',
    description: 'Process-level quality signal.'
  })),
  {
    id: 'config-performance-p95',
    family: 'Performance Metric',
    dimension: 'P95 Latency',
    evalType: 'Script',
    rubricVersion: 'rubric-2026.08',
    enabled: true,
    threshold: 1,
    description: 'Runtime performance signal; compared to rolling baseline.'
  }
]

export const qualityData: QualityData = {
  tasks,
  traces,
  observations,
  evidence,
  cases,
  datasets,
  benchmarks,
  evalConfigs,
  updatedAt: NOW,
  acceptanceEvents,
  productValidities,
  processEfficiencies,
  rootCauseAttributions,
  riskCommercialEvents
}

export const VERSION_OPTIONS = [VERSION_A, VERSION_B, 'agent-2.4.1']
export const MODEL_OPTIONS = models
export const TOOL_OPTIONS = toolNames
