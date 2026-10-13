import type { Case, EvolutionState, Experiment, ExperimentEvaluationSnapshot, ExperimentMetric, GateDecision, GovernanceReference, ModuleEvaluationScore, ModuleReviewRevision, Trace, TraceEvaluationModuleCode, TraceGovernanceEvent } from '../domain'

const at = (day: number, clock: string) => `2026-10-${String(day).padStart(2, '0')}T${clock}Z`
const stamp = (id: string, createdAt: string, updatedAt = createdAt) => ({ id, createdAt, updatedAt })
const reference = (kind: GovernanceReference['kind'], id: string): GovernanceReference => ({ kind, id })
const prefix = 'governance-demo'
const clone = <T,>(value: T): T => structuredClone(value)

/** Dedicated Mock history: all times and frozen reports are new; prior objects stay untouched. */
export function enrichTraceGovernanceFixtures(state: EvolutionState): EvolutionState {
  if (state.cases.some(item => item.id === `case-${prefix}-ppt`)) return state
  const next: EvolutionState = { ...state }
  const collections = ['sessions', 'cases', 'traces', 'observations', 'evidence', 'artifacts', 'outcomeEvals', 'attributions', 'issues', 'issueClusters', 'variants', 'datasets', 'experiments', 'experimentRuns', 'windows', 'gateDecisions', 'releases', 'evaluationBatches', 'tracePackages', 'evaluationFindings', 'routingPolicies', 'routingDecisions', 'routingDeliveries', 'algorithmBadcases', 'badcaseQueues'] as const
  for (const key of collections) (next[key] as unknown[]) = [...state[key]]
  next.governanceEvents = [...(state.governanceEvents ?? [])]; next.datasetMemberships = [...(state.datasetMemberships ?? [])]; next.moduleReviews = [...(state.moduleReviews ?? [])]
  const batchId = `batch-${prefix}`
  const policyId = `policy-${prefix}`, algorithmPolicyId = `policy-${prefix}-algorithm`
  next.routingPolicies.push({ ...stamp(policyId, at(6, '02:05:00')), name: '治理链 Mock Agent 迭代', version: 'mock-v1', enabled: true, description: '只用于显式构造演示链路', outputLabel: 'Agent迭代', destination: 'AGENT_ITERATION', priority: 1 }, { ...stamp(algorithmPolicyId, at(6, '02:05:00')), name: '治理链 Mock 策略迭代', version: 'mock-v1', enabled: true, description: '独立算法分支', outputLabel: '策略迭代', destination: 'ALGORITHM_BADCASE', priority: 1 })
  const traceIds: string[] = [], packageIds: string[] = []
  const evidenceFor = (key: string) => `evidence-${prefix}-${key}`
  const task = (key: 'ppt' | 'tool' | 'parallel', title: string, query: string, module: TraceEvaluationModuleCode, status: Trace['status'], clock: string) => {
    const caseId = `case-${prefix}-${key}`, sessionId = `session-${prefix}-${key}`, traceId = `trace-${prefix}-${key}`, packageId = `package-${prefix}-${key}`
    const startedAt = at(6, clock), endedAt = new Date(Date.parse(startedAt) + (key === 'tool' ? 8000 : 65000)).toISOString()
    const artifactId = `artifact-${prefix}-${key}`, observationId = `observation-${prefix}-${key}`, evidenceId = evidenceFor(key), logId = `log-${prefix}-${key}`
    const trace: Trace = { ...clone(state.traces[0]), ...stamp(traceId, startedAt, endedAt), sessionId, caseId, sequence: key === 'ppt' ? 2 : 1, startedAt, endedAt, queryAt: startedAt, observationIds: [observationId], artifactIds: key === 'tool' ? [] : [artifactId], status, skillVersion: key === 'tool' ? '2.5.1' : '2.5.0', skillCategory: 'PRODUCTION_SKILL', verticalScenario: key === 'tool' ? 'Excel' : 'PPT', channel: 'genflow pc 端', totalLatencyMs: key === 'tool' ? 8000 : 65000, inputTokens: 1800, outputTokens: 240, telemetry: { ...clone(state.traces[0].telemetry), totalLatencyMs: key === 'tool' ? 8000 : 65000, inputTokens: 1800, outputTokens: 240 } }
    const record: Case = { ...clone(state.cases[0]), ...stamp(caseId, startedAt, endedAt), sessionId, title, query, scenario: key === 'tool' ? 'Excel' : 'PPT', traceIds: [traceId], artifactIds: trace.artifactIds, processEvalIds: [], outcomeEvalIds: [], attributionIds: [], issueIds: [], skillIds: [key === 'tool' ? 'skill-spreadsheet' : 'skill-ppt-builder'], sourceType: 'MOCK_SET', status: 'IN_PROGRESS', resultStatus: 'FAIL', processStatus: 'FAIL', labels: ['治理时间线 Mock'], multiScenario: key === 'ppt', feedback: '独立构造的 Mock 用户反馈', acceptanceStatus: 'REJECTED' }
    next.cases.push(record); next.traces.push(trace); traceIds.push(traceId); packageIds.push(packageId)
    next.sessions.push({ ...stamp(sessionId, startedAt, endedAt), title, userId: `user-${prefix}`, caseIds: [caseId], traceIds: [traceId], turns: [{ id: `turn-${prefix}-${key}-1`, sequence: 1, role: 'USER', content: query, caseId, traceId, createdAt: startedAt }, { id: `turn-${prefix}-${key}-2`, sequence: 2, role: 'AGENT', content: key === 'tool' ? '工具导出失败。' : '已生成演示产物，待质量确认。', caseId, traceId, createdAt: endedAt }] })
    next.observations.push({ ...stamp(observationId, startedAt, endedAt), traceId, caseId, sequence: 1, nodeType: module === 'TOOL' ? 'Tool' : 'Skill', name: key === 'tool' ? '确定性导出错误' : '管理层模板选择', input: query, output: key === 'tool' ? '无效的导出枚举' : '模板缺少结论先行页', status: 'FAILED', latencyMs: 1200, retryCount: 0, evidenceIds: [evidenceId], logId })
    next.evidence.push({ ...stamp(evidenceId, endedAt), caseId, traceId, observationId, kind: 'ERROR', title: `${title} · 根证据`, content: key === 'tool' ? 'sheets.export format 参数必须为 EXCEL；Mock 错误日志。' : '管理层汇报 Rubric 要求首屏结论；Mock 实际产物为数据罗列。', source: '独立治理 Mock' })
    if (key !== 'tool') next.artifacts.push({ ...stamp(artifactId, endedAt), caseId, traceId, name: `${title}.pptx`, kind: 'PPT', uri: `mock://${artifactId}`, version: 'mock-v1', status: 'AVAILABLE', evidenceIds: [evidenceId] })
    const bundle = { rootEvidenceIds: [evidenceId], rubricRule: key === 'tool' ? '工具参数必须满足公开枚举' : '管理层 PPT 首屏应呈现结论与业务行动', observationIds: [observationId], logIds: [logId], artifactIds: trace.artifactIds, firstFailure: true, derivedFailure: false, completeness: 'COMPLETE' as const }
    const evaluatedAt = at(6, key === 'ppt' ? '02:05:00' : key === 'tool' ? '02:15:00' : '02:25:00')
    const score: ModuleEvaluationScore = { ...stamp(`module-score-${prefix}-${key}`, evaluatedAt), packageId, traceId, caseId, moduleCode: module, moduleLabel: module === 'TOOL' ? 'Tool' : 'Skill', score: 0.5, scoreScale: '0-1', automaticRevisionId: `automatic-${prefix}-${key}-1`, automaticStatus: 'FAIL', judgeReason: 'Mock 自动评测：不满足具体 Rubric 条款', evalAgentVersion: 'eval-agent-governance-demo-v1', rubricVersion: 'rubric-governance-demo-v1', evidence: bundle }
    const contextScore: ModuleEvaluationScore = { ...clone(score), id: `module-score-${prefix}-${key}-context`, moduleCode: 'CONTEXT', moduleLabel: '上文', score: undefined, automaticStatus: 'N/A', judgeReason: 'Context 仅呈现证据，不独立打分。', evidence: { ...clone(bundle), firstFailure: false } }
    const outcomeScore: ModuleEvaluationScore = { ...clone(score), id: `module-score-${prefix}-${key}-outcome`, moduleCode: 'OUTCOME', moduleLabel: 'Outcome/产物', score: 0.4, judgeReason: 'Mock 产物缺少管理层结论与清晰的业务行动。', evidence: { ...clone(bundle), firstFailure: false } }
    const outcomeEvalId = `outcome-eval-${prefix}-${key}`
    if (key !== 'tool') {
      record.outcomeEvalIds.push(outcomeEvalId)
      next.outcomeEvals.push({ ...stamp(outcomeEvalId, evaluatedAt), type: 'OUTCOME', caseId, traceId, artifactId, dimension: '管理层结论与业务行动', evalVersion: 'rubric-governance-demo-v1', verdict: 'FAIL', score: 0.4, evidenceIds: [evidenceId], revisions: [{ id: `automatic-outcome-${prefix}-${key}`, source: 'AUTOMATIC', verdict: 'FAIL', score: 0.4, reason: outcomeScore.judgeReason, evidenceIds: [evidenceId], evaluator: 'Mock Eval Agent', evaluatedAt }] })
    }
    next.tracePackages.push({ ...stamp(packageId, evaluatedAt), batchId, caseId, sessionId, traceId, query, agentVersion: trace.agentVersion ?? record.agentVersion, skillVersion: trace.skillVersion, skillIds: record.skillIds, skillCategory: 'PRODUCTION_SKILL', processCoverage: 'COMPLETE', outcomeCoverage: key === 'tool' ? 'MISSING' : 'COMPLETE', status: 'EVALUATED', moduleScores: [score, contextScore, ...(key === 'tool' ? [] : [outcomeScore])], findingIds: [], routingDecisionIds: [], routingDeliveryIds: [], badcaseIds: [], revaluationJobIds: [], rating: { scale: '0-2', rubric: '治理 Mock 明确评分量纲', processFinal: 1, outcomeFinal: key === 'tool' ? undefined : 0.8, processDimensions: [{ module, dimension: score.moduleLabel, score: 1, scoreId: score.id }], outcomeDimensions: key === 'tool' ? [] : [{ dimension: '管理层结论与业务行动', score: 0.8, evaluationId: outcomeEvalId }] } })
    return { record, trace, score, bundle, caseId, sessionId, traceId, packageId, evidenceId }
  }
  const ppt = task('ppt', '管理层 PPT · 完整治理链', '根据销售表生成管理层季度 PPT，结论先行并保留经营建议。', 'SKILL', 'SUCCEEDED', '02:00:00')
  const tool = task('tool', 'Tool · 确定性直接修复', '导出预算明细 Excel，使用工具支持的枚举。', 'TOOL', 'FAILED', '02:10:00')
  const parallel = task('parallel', '并行分流 · 算法与 Agent', '继续预算分析并生成 PPT；同时核对最新上下文和工具参数。', 'SKILL', 'PARTIAL', '02:20:00')
  const siblingId = `trace-${prefix}-ppt-context`
  const sibling = { ...clone(ppt.trace), ...stamp(siblingId, at(6, '01:59:00'), at(6, '01:59:05')), sequence: 1, startedAt: at(6, '01:59:00'), endedAt: at(6, '01:59:05'), queryAt: at(6, '01:59:00'), observationIds: [], artifactIds: [], totalLatencyMs: 5000, status: 'PARTIAL' as const, telemetry: { ...clone(ppt.trace.telemetry), totalLatencyMs: 5000 } }
  next.traces.push(sibling); ppt.record.traceIds.unshift(siblingId)
  const pptSession = next.sessions.find(item => item.id === ppt.sessionId)!
  pptSession.traceIds.unshift(siblingId); pptSession.turns = [{ id: `turn-${prefix}-ppt-context`, sequence: 1, role: 'USER', content: '读取上轮销售表。', caseId: ppt.caseId, traceId: siblingId, createdAt: sibling.startedAt }, ...pptSession.turns.map(turn => ({ ...turn, sequence: turn.sequence + 1 }))]
  const packageRecord = (id: string) => next.tracePackages.find(item => item.id === id)!
  const addFinding = (source: typeof ppt, suffix: string, description: string, moduleCode: TraceEvaluationModuleCode, status: 'OPEN' | 'CONFIRMED', clock = at(6, '04:00:00')) => {
    const id = `finding-${prefix}-${suffix}`
    next.evaluationFindings.push({ ...stamp(id, clock), packageId: source.packageId, batchId, caseId: source.caseId, sessionId: source.sessionId, traceId: source.traceId, moduleCode, moduleLabel: moduleCode === 'MEMORY' ? '记忆' : moduleCode === 'TOOL' ? 'Tool' : 'skill', dimensionCode: moduleCode === 'MEMORY' ? 'memory-accuracy' : moduleCode==='TOOL' ? 'act-failed' : 'skill-sop', dimensionLabel: moduleCode === 'MEMORY' ? '准确率低' : moduleCode==='TOOL' ? '工具未执行成功' : 'skill sop错误', description, taxonomyVersion: 'v2.0.0', labelSnapshot: description, skillCategory: 'PRODUCTION_SKILL', status, firstFailure: true, derivedFailure: false, evidenceBundle: clone(source.bundle), routingDecisionIds: [], routingDeliveryIds: [] })
    packageRecord(source.packageId).findingIds.push(id); return id
  }
  const pptFinding = addFinding(ppt, 'ppt', '管理层模板缺少结论先行的 SOP', 'SKILL', 'CONFIRMED')
  const pptPendingFinding = addFinding(ppt, 'ppt-new', '发布后发现新图表问题，等待人工复核', 'SKILL', 'OPEN', at(10, '02:00:00'))
  const toolFinding = addFinding(tool, 'tool', '导出枚举错误可直接确定性修复', 'TOOL', 'CONFIRMED')
  const algorithmFinding = addFinding(parallel, 'parallel-algorithm', '最新上下文选择需要算法复核', 'MEMORY', 'OPEN')
  const agentFinding = addFinding(parallel, 'parallel-agent', '工具稳定性改进验证失败', 'TOOL', 'CONFIRMED')
  const issue = (source: typeof ppt, suffix: string, findingId: string, direct: boolean, status: 'VERIFIED' | 'FIXING') => {
    const attributionId = `attribution-${prefix}-${suffix}`, issueId = `issue-${prefix}-${suffix}`
    source.record.attributionIds.push(attributionId); source.record.issueIds.push(issueId)
    next.attributions.push({ ...stamp(attributionId, at(6, '04:00:00')), caseId: source.caseId, traceId: source.traceId, module: direct ? 'Act' : 'Skill', dimension: direct ? '工具未执行成功' : 'skill sop错误', evidenceIds: [source.evidenceId], confidence: 1, source: 'HUMAN', confirmed: true, routingLabels: ['Agent 迭代'], optimizationMode: direct ? 'DIRECT_FIX' : 'CLUSTER_OPTIMIZATION', status: 'CONFIRMED', revisions: [] })
    next.issues.push({ ...stamp(issueId, at(6, '04:00:00'), direct ? at(7, '02:00:00') : at(7, '01:30:00')), caseId: source.caseId, attributionId, title: direct ? '修正工具导出参数' : '管理层 PPT SOP 召回', description: '独立 Mock 来源问题', module: direct ? 'Act' : 'Skill', dimension: direct ? '工具未执行成功' : 'skill sop错误', evidenceIds: [source.evidenceId], routingLabels: ['Agent 迭代'], optimizationMode: direct ? 'DIRECT_FIX' : 'CLUSTER_OPTIMIZATION', responsibilityStatus: 'VERIFIED', owner: 'Mock 责任人', status, clusterIds: [], variantIds: [] })
    const decisionId = `routing-decision-${prefix}-${suffix}`, deliveryId = `routing-delivery-${prefix}-${suffix}`
    next.routingDecisions.push({ ...stamp(decisionId, at(6, '05:00:00')), findingId, packageId: source.packageId, traceId: source.traceId, policyId, label: 'Agent迭代', destination: direct ? 'DIRECT_FIX' : 'AGENT_ITERATION', status: 'DELIVERED', reason: '人工确认改进去向', confirmedBy: 'Mock 运营', confirmedAt: at(6, '05:00:00'), deliveryIds: [deliveryId] })
    next.routingDeliveries.push({ ...stamp(deliveryId, at(6, '05:00:00')), findingId, decisionId, packageId: source.packageId, caseId: source.caseId, traceId: source.traceId, label: 'Agent迭代', destination: direct ? 'DIRECT_FIX' : 'AGENT_ITERATION', status: 'DELIVERED', issueId, deliveredAt: at(6, '05:00:00'), owner: 'Mock 责任人' })
    const finding = next.evaluationFindings.find(item => item.id === findingId)!
    finding.routingDecisionIds.push(decisionId); finding.routingDeliveryIds.push(deliveryId)
    packageRecord(source.packageId).routingDecisionIds.push(decisionId); packageRecord(source.packageId).routingDeliveryIds.push(deliveryId)
    return issueId
  }
  const pptIssue = issue(ppt, 'ppt', pptFinding, false, 'VERIFIED'), toolIssue = issue(tool, 'tool', toolFinding, true, 'VERIFIED'), agentIssue = issue(parallel, 'parallel-agent', agentFinding, true, 'FIXING')
  const algorithmDecisionId = `routing-decision-${prefix}-parallel-algorithm`, queueId = `queue-${prefix}-algorithm`
  next.routingDecisions.push({ ...stamp(algorithmDecisionId, at(6, '05:00:00')), findingId: algorithmFinding, packageId: parallel.packageId, traceId: parallel.traceId, policyId: algorithmPolicyId, label: '策略迭代', destination: 'ALGORITHM_BADCASE', status: 'PENDING', reason: '算法分支待复核', deliveryIds: [] })
  next.badcaseQueues.push({ ...stamp(queueId, at(6, '05:00:00')), name: '治理 Mock 算法候选队列', kind: 'ALGORITHM', itemIds: [], deliveryIds: [], description: '独立并行分支，尚未投递' })
  next.evaluationFindings.find(item => item.id === algorithmFinding)!.routingDecisionIds.push(algorithmDecisionId)
  packageRecord(parallel.packageId).routingDecisionIds.push(algorithmDecisionId)
  const clusterId = `cluster-${prefix}-ppt`, variantId = `variant-${prefix}-ppt`, datasetId = `dataset-${prefix}-ppt`, windowId = `window-${prefix}-ppt`, singleId = `experiment-${prefix}-single`, windowExperimentId = `experiment-${prefix}-window`
  next.issues.find(item => item.id === pptIssue)!.clusterIds.push(clusterId); next.issues.find(item => item.id === pptIssue)!.variantIds.push(variantId)
  next.issueClusters.push({ ...stamp(clusterId, at(7, '01:30:00')), name: '管理层 PPT 结论先行问题簇', description: 'Mock 完整来源链', module: 'Skill', dimension: 'skill sop错误', caseIds: [ppt.caseId], issueIds: [pptIssue], evidenceIds: [ppt.evidenceId], variantIds: [variantId], status: 'VERIFIED', currentCount: 1, countingRule: '独立演示 Case，不代表线上总体数量' })
  const targets = [{ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }]
  next.variants.push({ ...stamp(variantId, at(7, '02:00:00'), at(9, '02:00:00')), name: '管理层结论先行 SOP · 治理 Mock', targetModule: 'Skill', changeType: 'SKILL_CONTENT', changeSummary: '补充首屏结论与业务行动', changeContent: 'Mock 候选 SOP，不代表已修改线上能力。', currentVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-governance-demo-rc.1', sourceCaseIds: [ppt.caseId], sourceIssueIds: [pptIssue], sourceClusterIds: [clusterId], evidenceIds: [ppt.evidenceId], status: 'RELEASED', experimentIds: [singleId, windowExperimentId], targets })
  next.datasets.push({ ...stamp(datasetId, at(7, '01:00:00')), name: '管理层 PPT 治理演示原始归因集', type: 'ATTRIBUTION', version: 'mock-v1', caseIds: [ppt.caseId], sampleCount: 1, source: '显式 Mock Trace 加入', scope: '只明确加入生成 Trace；上下文 Trace 保留 Case 共享归属', frozen: true, purpose: '原始归因集', setRole: 'EVALUATION', targets, population: { totalSampleCount: 1, localCaseCount: 1, externalSampleCount: 0, sourceSystem: '独立 Mock', countingRule: '按 Case 去重，Trace 精度另存成员记录' } })
  next.datasetMemberships.push({ id: `membership-${prefix}-ppt`, datasetId, datasetVersion: 'mock-v1', caseId: ppt.caseId, traceIds: [ppt.traceId], scope: 'TRACE', joinedAt: at(7, '01:00:00'), actor: 'Mock 运营', origin: 'MOCK' })
  const frozenEvaluation: ExperimentEvaluationSnapshot = { capturedAt: at(7, '03:00:00'), evalAgentVersion: ppt.score.evalAgentVersion, rubricVersion: ppt.score.rubricVersion, artifactIds: ppt.trace.artifactIds, evidenceBundleIds: [ppt.score.id], tracePackageIds: [ppt.packageId], moduleEvaluations: packageRecord(ppt.packageId).moduleScores.map(clone), tracePackages: [clone(packageRecord(ppt.packageId))], artifacts: next.artifacts.filter(item => item.traceId === ppt.traceId).map(clone), rootEvidence: next.evidence.filter(item => item.traceId === ppt.traceId).map(clone), observations: next.observations.filter(item => item.traceId === ppt.traceId).map(clone), processEvals: [], outcomeEvals: next.outcomeEvals.filter(item => item.traceId === ppt.traceId).map(clone) }
  const metrics: ExperimentMetric[] = [{ key: 'sop', label: '管理层 SOP 评分', category: 'LOCAL', baselineMean: 0.5, candidateMean: 0.9, baselineStdDev: 0, candidateStdDev: 0, unit: 'score', gateStatus: 'PENDING' }]
  const makeExperiment = (id: string, level: Experiment['level'], createdAt: string, completedAt: string, gateId: string) => {
    const configSnapshot: Experiment['configSnapshot'] = { datasetVersions: [{ datasetId, version: 'mock-v1', versionId: `${datasetId}@mock-v1`, sampleCount: 1, caseIds: [ppt.caseId] }], model: 'mock-model', toolPermissions: ['slides.render'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'isolated-mock', createdAt, evalAgentVersion: ppt.score.evalAgentVersion, rubricVersion: ppt.score.rubricVersion, evaluationSnapshot: clone(frozenEvaluation) }
    const runIds = ['BASELINE', 'CANDIDATE'].flatMap(arm => [1, 2, 3].map(repetition => `run-${id}-${arm}-${repetition}`))
    const experiment: Experiment = { ...stamp(id, createdAt, completedAt), name: level === 'SINGLE_VARIANT' ? '治理 Mock · 单能力实验' : '治理 Mock · 窗口实验', level, variantIds: [variantId], windowId, datasetIds: [datasetId], configSnapshot, runIds, baselineVersion: 'ppt-builder-2.5.0', candidateVersion: 'ppt-builder-governance-demo-rc.1', metrics: clone(metrics), failedCaseIds: [], rollbackItems: ['若灰度回归则回退此 Mock 候选'], knownRisks: ['长表格仍需观察'], status: 'DECIDED', gateDecisionId: gateId, targets }
    next.experiments.push(experiment)
    for (const arm of ['BASELINE', 'CANDIDATE'] as const) for (const repetition of [1, 2, 3]) next.experimentRuns.push({ ...stamp(`run-${id}-${arm}-${repetition}`, createdAt, completedAt), experimentId: id, caseId: ppt.caseId, repetition, arm, status: 'COMPLETED', processScore: arm === 'BASELINE' ? 0.5 : 0.9, outcomeScore: arm === 'BASELINE' ? 0.4 : 0.85, durationMs: 65000, configHash: `config-${id}`, configSnapshot: clone(configSnapshot), evalSnapshot: clone(frozenEvaluation) })
    const reportSnapshot: GateDecision['reportSnapshot'] = { experimentId: id, variantIds: [variantId], datasetVersions: [{ datasetId, version: 'mock-v1' }], metricResults: clone(metrics), configSnapshot: clone(configSnapshot), runSnapshots: next.experimentRuns.filter(item => item.experimentId === id).map(clone), failedCaseIds: [], rollbackItems: [...experiment.rollbackItems], knownRisks: [...experiment.knownRisks], evidenceIds: [ppt.evidenceId] }
    next.gateDecisions.push({ id: gateId, experimentId: id, conclusion: 'PASS', decisionBasis: 'HUMAN_REVIEW', reason: 'Mock 人工核对目标模块、回归和风险后准出；规则阈值尚未配置。', riskNotes: [...experiment.knownRisks], decidedBy: 'Mock 治理委员会', decidedAt: completedAt, reportSnapshot })
    return experiment
  }
  const singleGate = `decision-${prefix}-single`, windowGate = `decision-${prefix}-window`
  makeExperiment(singleId, 'SINGLE_VARIANT', at(7, '03:00:00'), at(7, '06:00:00'), singleGate)
  makeExperiment(windowExperimentId, 'WINDOW_COMBINATION', at(8, '02:00:00'), at(8, '04:00:00'), windowGate)
  next.windows.push({ ...stamp(windowId, at(7, '07:00:00'), at(9, '02:00:00')), name: '独立治理 Mock 能力窗口', timeRange: { from: at(6, '00:00:00'), to: at(9, '02:00:00') }, candidateVariantIds: [variantId], singleExperimentIds: [singleId], combinationExperimentId: windowExperimentId, status: 'RELEASED', frozenAt: at(8, '02:00:00'), cutoffAt: at(8, '01:00:00') })
  const releaseId = `release-${prefix}-ppt`, rollbackReleaseId = `release-${prefix}-rollback`
  next.releases.push({ ...stamp(releaseId, at(9, '02:00:00')), version: 'agent-governance-demo-v1', windowId, variantIds: [variantId], combinationExperimentId: windowExperimentId, gateDecisionId: windowGate, approvedBy: 'Mock 治理委员会', status: 'RELEASED', releasedAt: at(9, '02:00:00') }, { ...stamp(rollbackReleaseId, at(9, '03:00:00'), at(10, '01:00:00')), version: 'agent-governance-demo-rollback', windowId, variantIds: [variantId], combinationExperimentId: windowExperimentId, gateDecisionId: windowGate, approvedBy: 'Mock 治理委员会', status: 'ROLLED_BACK', releasedAt: at(9, '03:00:00'), rollbackVersionId: releaseId, rollbackReason: '独立灰度分支回滚示例' })
  const rejectedGate = clone(next.gateDecisions.find(item => item.id === singleGate)!)
  next.gateDecisions.find(item => item.id === singleGate)!.decidedAt = at(7, '06:30:00')
  next.gateDecisions.push({ ...rejectedGate, id: `decision-${prefix}-rejected`, conclusion: 'REJECT', reason: '独立 Mock 人工拒绝候选；复核风险后形成新的准出决策。', decidedAt: at(7, '06:00:00') })
  const automaticSnapshot: ModuleReviewRevision['automaticSnapshot'] = { score: ppt.score.score, scoreScale: '0-1', status: ppt.score.automaticStatus, judgeReason: ppt.score.judgeReason, evidence: clone(ppt.score.evidence), evalAgentVersion: ppt.score.evalAgentVersion, rubricVersion: ppt.score.rubricVersion }
  for (const [index, humanScore] of [1.25, 1.5].entries()) next.moduleReviews.push({ id: `review-${prefix}-ppt-${index + 1}`, traceId: ppt.traceId, caseId: ppt.caseId, packageId: ppt.packageId, moduleScoreId: ppt.score.id, automaticRevisionId: ppt.score.automaticRevisionId!, humanScore, auxiliaryVerdict: 'FAIL', reason: index === 0 ? '首轮人工复核：结论页仍需优化。' : '再次复核：确认首屏表达与证据映射。', reviewer: `Mock 复核员 ${index + 1}`, reviewedAt: at(6, index === 0 ? '03:00:00' : '03:30:00'), evidenceIds: [ppt.evidenceId], rubricVersion: ppt.score.rubricVersion, rubricRule: ppt.score.evidence.rubricRule, evalAgentVersion: ppt.score.evalAgentVersion, automaticSnapshot: clone(automaticSnapshot), supersedesReviewId: index === 1 ? `review-${prefix}-ppt-1` : undefined, origin: 'MOCK' })
  const addEvent = (source: typeof ppt, key: string, stage: string, statusCode: string, occurredAt: string, sourceRef: GovernanceReference, description: string, branchId = `finding:${pptFinding}`, targetRefs: GovernanceReference[] = [sourceRef]) => {
    const event: TraceGovernanceEvent = { id: `event-${prefix}-${key}`, traceId: source.traceId, caseId: source.caseId, branchId, occurredAt, recordedAt: occurredAt, stage, statusCode, actor: 'Mock 治理系统', description, sourceRef, targetRefs, origin: 'MOCK', relationType: 'TRACE_SOURCE' }
    next.governanceEvents!.push(event)
  }
  for (const source of [ppt, tool, parallel]) { addEvent(source, `${source.trace.id}-task`, 'TASK', source.trace.status, source.trace.startedAt, reference('trace', source.traceId), 'Mock 任务产生；执行耗时与治理等待分别记录。', `trace:${source.traceId}`); addEvent(source, `${source.trace.id}-evaluation`, 'EVALUATION', 'COMPLETED', at(6, source === ppt ? '02:05:00' : source === tool ? '02:15:00' : '02:25:00'), reference('trace-package', source.packageId), '自动过程 / 产物评测完成；自动结论与执行状态分别呈现。', `trace:${source.traceId}`) }
  addEvent(ppt, 'ppt-review-1', 'REVIEW', 'REVIEWED', at(6, '03:00:00'), reference('trace-package', ppt.packageId), '1.25 / 2 · 首轮人工复核', `trace:${ppt.traceId}`, [reference('trace-package', ppt.packageId), reference('evidence', ppt.evidenceId)])
  next.governanceEvents.at(-1)!.id = `review:review-${prefix}-ppt-1`
  addEvent(ppt, 'ppt-review-2', 'REVIEW', 'REVIEWED', at(6, '03:30:00'), reference('trace-package', ppt.packageId), '1.50 / 2 · 再次人工复核', `trace:${ppt.traceId}`, [reference('trace-package', ppt.packageId), reference('evidence', ppt.evidenceId)])
  next.governanceEvents.at(-1)!.id = `review:review-${prefix}-ppt-2`
  for (const [key, stage, code, clock, target] of [
    ['ppt-attribution', 'ATTRIBUTION', 'CONFIRMED', at(6, '04:00:00'), reference('finding', pptFinding)],
    ['ppt-routing', 'ROUTING', 'DELIVERED', at(6, '05:00:00'), reference('routing-delivery', `routing-delivery-${prefix}-ppt`)],
    ['ppt-dataset', 'DATASET', 'CONFIRMED', at(7, '01:00:00'), reference('dataset', datasetId)],
    ['ppt-cluster', 'CLUSTER', 'VERIFIED', at(7, '01:30:00'), reference('cluster', clusterId)],
    ['ppt-variant', 'VARIANT', 'READY', at(7, '02:00:00'), reference('variant', variantId)],
    ['ppt-single', 'EXPERIMENT', 'COMPLETED', at(7, '04:00:00'), reference('experiment', singleId)],
    ['ppt-reject', 'GATE', 'REJECT', at(7, '06:00:00'), reference('decision', `decision-${prefix}-rejected`)],
    ['ppt-single-gate', 'GATE', 'PASS', at(7, '06:30:00'), reference('decision', singleGate)],
    ['ppt-window', 'WINDOW_EXPERIMENT', 'COMPLETED', at(8, '03:00:00'), reference('experiment', windowExperimentId)],
    ['ppt-window-gate', 'GATE', 'PASS', at(8, '04:00:00'), reference('decision', windowGate)],
    ['ppt-release', 'RELEASE', 'RELEASED', at(9, '02:00:00'), reference('release', releaseId)]
  ] as const) addEvent(ppt, key, stage, code, clock, target, `Mock ${stage} · ${code}`, `finding:${pptFinding}`, [target, reference('evidence', ppt.evidenceId), ...(stage === 'WINDOW_EXPERIMENT' ? [reference('window', windowId)] : [])])
  addEvent(ppt, 'ppt-rollback', 'RELEASE', 'ROLLED_BACK', at(10, '01:00:00'), reference('release', rollbackReleaseId), '独立灰度发布分支已回滚', `deployment:${rollbackReleaseId}`)
  addEvent(ppt, 'ppt-pending', 'ATTRIBUTION', 'PENDING', at(10, '02:00:00'), reference('finding', pptPendingFinding), '历史发布保留，新问题等待人工确认', `finding:${pptPendingFinding}`)
  addEvent(ppt, 'ppt-rerun', 'EVALUATION', 'COMPLETED', at(10, '03:00:00'), reference('trace-package', ppt.packageId), 'Mock 重跑完成；原人工复核与原始自动记录仍保留', `trace:${ppt.traceId}`)
  ppt.score.automaticRevisionId = `automatic-${prefix}-ppt-2`; ppt.score.updatedAt = at(10, '03:00:00')
  packageRecord(ppt.packageId).updatedAt = at(10, '03:00:00')
  addEvent(tool, 'tool-repair', 'DIRECT_FIX', 'VERIFIED', at(7, '02:00:00'), reference('issue', toolIssue), '确定性参数错误已修复并验证；无需问题簇', `finding:${toolFinding}`)
  addEvent(parallel, 'parallel-algorithm', 'ROUTING', 'PENDING', at(6, '05:00:00'), reference('routing-decision', algorithmDecisionId), '策略迭代 · 算法分支待复核', `finding:${algorithmFinding}`)
  addEvent(parallel, 'parallel-agent', 'DIRECT_FIX', 'FAILED', at(7, '02:00:00'), reference('issue', agentIssue), 'Agent 迭代 · 独立修复分支验证失败', `finding:${agentFinding}`)
  next.evaluationBatches.push({ ...stamp(batchId, at(6, '02:05:00'), at(6, '02:25:00')), name: '治理 Mock 评测批次', status: 'COMPLETED', traceIds, packageIds, jobIds: [], evalAgentVersion: ppt.score.evalAgentVersion, rubricVersion: ppt.score.rubricVersion, runEnvironment: 'isolated-mock', createdBy: 'Mock 系统', stats: { inputTraceCount: traceIds.length, successCount: traceIds.length, partialCount: 0, failedCount: 0, pendingCount: 0 }, startedAt: at(6, '02:05:00'), completedAt: at(6, '02:25:00') })
  return next
}
