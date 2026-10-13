import type { Artifact, EvolutionState, OutcomeEval, VerticalScenario } from '../domain'

const prefix = 'outcome-dimension-demo'
const at = '2026-10-06T02:07:00Z'
const clone = <T,>(value: T): T => structuredClone(value)

interface DimensionFixture { label: string; score?: number; reason: string; rubric: string }
const dimensions: Record<VerticalScenario, DimensionFixture[]> = {
  PPT: [
    { label: '管理层结论与业务行动', score: 0.8, reason: 'Mock 第 1 页仍为销售数据罗列，缺少结论与行动。', rubric: 'rubric-governance-demo-v1：管理层 PPT 首屏应呈现结论与业务行动' },
    { label: '管理层风格匹配', score: 1.1, reason: 'Mock 12 页中 8 页为密排正文，未使用管理层决策摘要布局。', rubric: 'outcome-eval-3.0：沿用现有管理层风格匹配检查，具体评分档位待配置' },
    { label: '文件可用性', score: 2, reason: 'Mock 文件结构可读取；不代表实际托管文件已生成。', rubric: 'rubric-office-v2.1#outcome：结果约束满足与可用性' }
  ],
  Word: [
    { label: '文件可用性', score: 2, reason: 'Mock Word 文档可读取，现有结果可用性检查已记录。', rubric: 'rubric-office-v2.1#outcome：结果约束满足与可用性' },
    { label: '结果约束满足', score: 1.4, reason: 'Mock 用户要求标注合同风险，产物遗漏一项已给定风险。', rubric: 'rubric-office-v2.1#outcome：结果约束满足与可用性；Word 专项档位待配置' },
    { label: '垂类专项评分', reason: 'PRD 未提供 Word 专项评分标准，不生成细项分数。', rubric: '待配置' }
  ],
  Excel: [
    { label: '文件可用性', score: 0, reason: 'Mock 导出错误导致工作簿不可用。', rubric: 'outcome-eval-3.0：导出失败，无可用文件' },
    { label: '依据可追溯性', score: 0.7, reason: 'Mock 风险结论缺少对应数值依据。', rubric: 'outcome-eval-3.0：沿用现有依据可追溯性检查，评分档位待配置' },
    { label: '垂类专项评分', reason: 'PRD 未提供 Excel 专项评分标准，不生成细项分数。', rubric: '待配置' }
  ],
  生图: [
    { label: '结果约束满足', score: 1.6, reason: 'Mock 图像满足红色背景要求，标题位置未满足用户指定约束。', rubric: 'rubric-office-v2.1#outcome：结果约束满足与可用性；生图专项档位待配置' },
    { label: '文件可用性', score: 2, reason: 'Mock 图像可用性检查记录，不连接真实文件存储。', rubric: 'rubric-office-v2.1#outcome：结果约束满足与可用性' },
    { label: '垂类专项评分', reason: 'PRD 未提供生图专项评分标准，不生成细项分数。', rubric: '待配置' }
  ]
}

/** Additive Mock data only: earlier evaluations and every report snapshot stay intact. */
export function enrichArtifactOutcomeFixtures(state: EvolutionState): EvolutionState {
  const next: EvolutionState = { ...state, artifacts: [...state.artifacts], outcomeEvals: [...state.outcomeEvals], evidence: [...state.evidence], cases: [...state.cases], traces: [...state.traces], sessions: [...state.sessions] }
  const ppt = state.artifacts.find(item => item.id === 'artifact-governance-demo-ppt') ?? state.artifacts.find(item => item.kind === 'PPT')
  if (ppt && !next.artifacts.some(item => item.id === 'artifact-outcome-dimension-demo-summary')) {
    const second: Artifact = { ...clone(ppt), id: 'artifact-outcome-dimension-demo-summary', name: '管理层决策摘要.pptx', uri: 'mock://artifact-outcome-dimension-demo-summary', version: 'mock-summary-v1', evidenceIds: [] }
    next.artifacts.push(second)
    next.cases = next.cases.map(item => item.id === second.caseId ? { ...item, artifactIds: [...item.artifactIds, second.id] } : item)
    next.traces = next.traces.map(item => item.id === second.traceId ? { ...item, artifactIds: [...item.artifactIds, second.id] } : item)
  }
  if (!next.cases.some(item => item.id === `case-${prefix}-image`)) {
    const sourceCase = state.cases[0], sourceTrace = state.traces[0]
    const caseId = `case-${prefix}-image`, traceId = `trace-${prefix}-image`, sessionId = `session-${prefix}-image`, artifactId = `artifact-${prefix}-image`
    const query = '生成一张红色背景的经营报告封面，标题放在左上角。'
    next.cases.push({ ...clone(sourceCase), id: caseId, sessionId, title: '生图产物细项评分（Mock）', query, scenario: '生图', verticalScenario: '生图', multiScenario: false, skillIds: [], traceIds: [traceId], artifactIds: [artifactId], processEvalIds: [], outcomeEvalIds: [], attributionIds: [], issueIds: [], sourceType: 'MOCK_SET', status: 'EVALUATED', resultStatus: 'UNKNOWN', processStatus: 'UNKNOWN', feedback: 'Mock 用户要求标题移到左上角。', acceptanceStatus: 'UNKNOWN', labels: ['产物细项 Mock'], createdAt: at, updatedAt: at })
    next.traces.push({ ...clone(sourceTrace), id: traceId, caseId, sessionId, sequence: 1, skillCategory: 'GENERAL', skillVersion: undefined, observationIds: [], artifactIds: [artifactId], startedAt: at, endedAt: new Date(Date.parse(at) + sourceTrace.totalLatencyMs).toISOString(), queryAt: at, verticalScenario: '生图', status: 'SUCCEEDED', telemetry: { ...clone(sourceTrace.telemetry), toolCallCount: 0, toolExecutionCount: 0, toolOneShotSuccessCount: 0, retryCount: 0, loopCount: 0, riskInterception: { blocked: false, reason: '未触发风控' }, commercialInterception: { blocked: false, reason: '未触发商业化拦截' } }, createdAt: at, updatedAt: at })
    next.sessions.push({ id: sessionId, title: '生图产物细项评分（Mock）', userId: 'mock-outcome-review-user', caseIds: [caseId], traceIds: [traceId], turns: [{ id: `turn-${prefix}-image-user`, sequence: 1, role: 'USER', content: query, caseId, traceId, createdAt: at }, { id: `turn-${prefix}-image-agent`, sequence: 2, role: 'AGENT', content: 'Mock 图像使用红色背景，标题在中部；专项标准待配置。', caseId, traceId, createdAt: at }], createdAt: at, updatedAt: at })
    next.artifacts.push({ id: artifactId, caseId, traceId, name: '红色经营报告封面.png', kind: 'Other', verticalScenario: '生图', version: 'mock-v1', uri: `mock://${artifactId}`, status: 'AVAILABLE', evidenceIds: [], createdAt: at, updatedAt: at })
  }
  const targets = [ppt, next.artifacts.find(item => item.id === 'artifact-outcome-dimension-demo-summary'), state.artifacts.find(item => item.kind === 'Word'), state.artifacts.find(item => item.id === 'artifact-missing-export') ?? state.artifacts.find(item => item.kind === 'Excel'), next.artifacts.find(item => item.id === `artifact-${prefix}-image`)].filter((item): item is Artifact => Boolean(item))
  for (const artifact of targets) {
    const vertical = artifact.verticalScenario ?? (artifact.kind === 'PPT' || artifact.kind === 'Word' || artifact.kind === 'Excel' ? artifact.kind : undefined)
    if (!vertical) continue
    dimensions[vertical].forEach((dimension, index) => {
      const id = `${prefix}-${artifact.id}-${index + 1}`
      if (next.outcomeEvals.some(item => item.id === id || (item.artifactId === artifact.id && item.dimension === dimension.label && item.isFinal !== true))) return
      const evidenceId = `evidence-${id}`
      const summary = artifact.id === 'artifact-outcome-dimension-demo-summary'
      const score = summary && dimension.score !== undefined ? Math.min(2, dimension.score + 0.6) : dimension.score
      const reason = summary ? `独立 Mock 决策摘要产物：${dimension.label} 检查结果已单独记录，不复用主 PPT 分数。` : dimension.reason
      const observed = state.observations.find(item => item.traceId === artifact.traceId)
      next.evidence.push({ id: evidenceId, caseId: artifact.caseId, traceId: artifact.traceId, artifactId: artifact.id, observationId: observed?.id, kind: 'ARTIFACT', title: `${artifact.name} · ${dimension.label}`, content: reason, source: '产物细项 Mock，非线上 Eval Agent', createdAt: at, updatedAt: at })
      const evaluation: OutcomeEval = { id, type: 'OUTCOME', caseId: artifact.caseId, traceId: artifact.traceId, artifactId: artifact.id, dimension: dimension.label, isFinal: false, score, scoreScale: '0-2', verdict: 'UNKNOWN', evalVersion: 'outcome-dimensions-mock-v1', evalAgentVersion: 'Mock Outcome Eval Agent v1', rubricRule: dimension.rubric, evidenceIds: [evidenceId], revisions: [{ id: `automatic-${id}`, source: 'AUTOMATIC', score, scoreScale: '0-2', verdict: 'UNKNOWN', reason, evaluator: 'Mock Outcome Eval Agent v1', evaluatedAt: at, evidenceIds: [evidenceId] }], createdAt: at, updatedAt: at }
      next.outcomeEvals.push(evaluation)
      next.cases = next.cases.map(item => item.id === artifact.caseId ? { ...item, outcomeEvalIds: [...item.outcomeEvalIds, id] } : item)
    })
    // Explicit per-artifact Mock responses. These values are not calculated
    // from dimensions or copied from a Trace aggregate.
    if (!next.outcomeEvals.some(item => item.artifactId === artifact.id && (item.isFinal === true || (item.isFinal !== false && ['产物合格性', '最终评分', '产物最终评分'].includes(item.dimension))))) {
      const id = `${prefix}-${artifact.id}-final`, evidenceId = `evidence-${id}`
      const recordedFinal = artifact.id === 'artifact-outcome-dimension-demo-summary' ? 1.8 : artifact.status === 'MISSING' ? 0 : vertical === '生图' ? 1.6 : vertical === 'Word' ? 1.4 : 0.8
      const reason = '独立手写 Mock Eval Agent 返回的产物最终分；不是细项均值，不表示线上聚合规则已配置。'
      next.evidence.push({ id: evidenceId, caseId: artifact.caseId, traceId: artifact.traceId, artifactId: artifact.id, kind: 'ARTIFACT', title: `${artifact.name} · 最终评测返回`, content: reason, source: '产物最终评分 Mock', createdAt: at, updatedAt: at })
      next.outcomeEvals.push({ id, type: 'OUTCOME', caseId: artifact.caseId, traceId: artifact.traceId, artifactId: artifact.id, dimension: '产物最终评分', isFinal: true, score: recordedFinal, scoreScale: '0-2', verdict: 'UNKNOWN', evalVersion: 'outcome-dimensions-mock-v1', evalAgentVersion: 'Mock Outcome Eval Agent v1', rubricRule: '最终评分聚合规则待配置；此处仅展示独立 Mock 返回值', evidenceIds: [evidenceId], revisions: [{ id: `automatic-${id}`, source: 'AUTOMATIC', score: recordedFinal, scoreScale: '0-2', verdict: 'UNKNOWN', reason, evaluator: 'Mock Outcome Eval Agent v1', evaluatedAt: at, evidenceIds: [evidenceId] }], createdAt: at, updatedAt: at })
      next.cases = next.cases.map(item => item.id === artifact.caseId ? { ...item, outcomeEvalIds: [...item.outcomeEvalIds, id] } : item)
    }
  }
  return next
}
