import { TRACE_MODULE_LABELS } from '../domain'
import type {
  Artifact, Case, DatasetExecutionConfigSnapshot, DatasetExecutionInputSnapshot, DatasetExecutionItem,
  DatasetExecutionMode, DatasetExecutionRun, DatasetExecutionScope, DatasetMockScenario, DatasetQueryRecord,
  EvaluationBatch, EvaluationEvidenceBundle, Evidence, EvolutionState, ModuleEvaluationScore,
  ObservationLog, OutcomeEval, ProcessEval, Session, Trace,
  TraceEvaluationPackage, TraceRating, VerticalScenario
} from '../domain'
import { datasetTraceRows } from './traceDataset'

const clone = <T,>(value: T): T => structuredClone(value)
const unique = <T,>(items: T[]) => [...new Set(items)]
const modules = ['REASON', 'MEMORY', 'SKILL', 'ACT'] as const
const moduleDimensions: Record<typeof modules[number], string> = {
  REASON: '没有充分响应用户query的客观诉求', MEMORY: '准确率低', SKILL: 'skill sop错误', ACT: '工具未执行成功'
}
const outcomeDimensions: Record<VerticalScenario, string[]> = {
  PPT: ['管理层结论与业务行动', '管理层风格匹配', '文件可用性'],
  Word: ['结果约束满足', '依据可追溯性', '文件可用性'],
  Excel: ['结果约束满足', '依据可追溯性', '文件可用性'],
  生图: ['结果约束满足', '场景匹配', '文件可用性']
}
const scenarios: readonly VerticalScenario[] = ['PPT', 'Word', 'Excel', '生图']
const atStamp = (id: string, at: string) => ({ id, createdAt: at, updatedAt: at })
const hash = (value: string): number => {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0
  return result
}
/** IDs are opaque strings: arithmetic is never applied to a platform identity. */
const numericIdentity = (value: string) => `20${String(hash(value)).padStart(10, '0')}${String(hash(`${value}:identity`)).padStart(10, '0')}`
const score = (key: string): number => hash(key) % 3
const upsert = <T extends { id: string }>(existing: T[], additions: T[]): T[] => {
  const pending = new Map(additions.map(item => [item.id, item]))
  const result = existing.map(item => {
    const replacement = pending.get(item.id)
    pending.delete(item.id)
    return replacement ?? item
  })
  return [...result, ...pending.values()]
}
const htmlEscape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

export type DatasetQueryInput = Pick<DatasetQueryRecord, 'datasetId' | 'query' | 'verticalScenario'> & Pick<DatasetQueryRecord, 'assetId' | 'assetVersionId'>

export function validateDatasetQueryInput(state: EvolutionState, input: DatasetQueryInput): void {
  const dataset = state.datasets.find(item => item.id === input.datasetId)
  if (!dataset) throw new Error('数据集不存在。')
  if (dataset.datasetOrigin !== 'USER_CUSTOM' && dataset.ownerScope !== 'USER') throw new Error('只有用户自定义数据集支持人工添加 Query。')
  if (dataset.frozen) throw new Error('数据集已冻结，不能添加 Query；仍可运行已有成员。')
  if (!input.query.trim()) throw new Error('请输入任务内容。')
  if (!scenarios.includes(input.verticalScenario)) throw new Error('请选择 PPT / Word / Excel / 生图。')
  validateAsset(state, input.assetId, input.assetVersionId)
}

function validateAsset(state: EvolutionState, assetId?: string, versionId?: string): void {
  if (versionId && !assetId) throw new Error('选择固定版本前请先选择资产。')
  if (assetId && !(state.assetCatalog ?? []).some(item => item.id === assetId)) throw new Error('所选资产不存在。')
  if (versionId && !(state.assetVersions ?? []).some(item => item.id === versionId && item.assetId === assetId)) throw new Error('固定版本不属于所选资产。')
}

function resolveInputAsset(state: EvolutionState, input: DatasetExecutionInputSnapshot, assetId?: string, versionId?: string): DatasetExecutionInputSnapshot {
  const selectedAsset = assetId ?? input.assetId
  const asset = (state.assetCatalog ?? []).find(item => item.id === selectedAsset)
  const selectedVersion = versionId ?? (assetId ? asset?.currentVersionId : input.assetVersionId ?? asset?.currentVersionId)
  const version = (state.assetVersions ?? []).find(item => item.id === selectedVersion)
  return {
    ...clone(input), assetId: asset?.id, assetVersionId: version?.id,
    skillId: assetId ? asset?.skillId : asset?.skillId ?? input.skillId,
    skillVersion: asset?.skillId ? version?.version ?? input.skillVersion : assetId ? undefined : input.skillVersion
  }
}

/** Only concrete local inputs are runnable. External population totals never become tasks. */
export function selectDatasetExecutionInputs(
  state: EvolutionState, datasetId: string, mode: DatasetExecutionMode = 'GENERATE_AND_EVALUATE', scope: DatasetExecutionScope = 'PENDING'
): DatasetExecutionInputSnapshot[] {
  const dataset = state.datasets.find(item => item.id === datasetId)
  if (!dataset) return []
  const existing = datasetTraceRows(state, dataset).filter(row => Boolean(row.case.query.trim())).map(row => {
    const skillId = row.case.skillIds[0]
    const skillVersion = row.trace.skillVersion ?? row.package?.skillVersion ?? state.skills.find(item => item.id === skillId)?.version
    const asset = (state.assetCatalog ?? []).find(item => item.skillId === skillId)
    const assetVersion = (state.assetVersions ?? []).find(item => item.assetId === asset?.id && item.version === skillVersion)
    return {
      id: `trace:${row.trace.id}`, sourceTraceId: row.trace.id, sourceCaseId: row.case.id,
      query: row.case.query, verticalScenario: row.trace.verticalScenario ?? row.case.verticalScenario ?? 'PPT',
      skillId, skillVersion, assetId: asset?.id, assetVersionId: assetVersion?.id
    } satisfies DatasetExecutionInputSnapshot
  })
  const queries = (state.datasetQueries ?? []).filter(query => query.datasetId === datasetId && query.datasetVersion === dataset.version && Boolean(query.query.trim()))
  const drafts = mode === 'EVALUATE_ONLY' ? queries.flatMap(query => {
    // Generated outputs are deliberately outside dataset membership. Resolve
    // the latest successful output for this authored input without enrolling
    // it as another source or borrowing the asset's current version.
    const generated = (state.datasetExecutionRuns ?? [])
      .filter(run => run.datasetId === datasetId && run.datasetVersion === dataset.version && run.mode === 'GENERATE_AND_EVALUATE')
      .flatMap(run => run.items.filter(item => item.input.sourceQueryId === query.id && item.status === 'COMPLETED' && item.traceId && item.caseId)
        .map(item => ({ item, at: item.completedAt ?? run.completedAt ?? run.updatedAt, runId: run.id })))
      .sort((left, right) => right.at.localeCompare(left.at) || right.runId.localeCompare(left.runId))[0]?.item
    if (!generated) return []
    return [{ ...clone(generated.input), id: `query:${query.id}`, sourceQueryId: query.id, sourceTraceId: generated.traceId, sourceCaseId: generated.caseId }]
  }) : queries.map(query => resolveInputAsset(state, {
    id: `query:${query.id}`, sourceQueryId: query.id, query: query.query, verticalScenario: query.verticalScenario,
    assetId: query.assetId, assetVersionId: query.assetVersionId
  }))
  const completed = new Set((state.datasetExecutionRuns ?? [])
    .filter(run => run.datasetId === datasetId && run.datasetVersion === dataset.version && run.mode === mode)
    .flatMap(run => run.items.filter(item => item.status === 'COMPLETED').map(item => item.input.id)))
  return clone([...existing, ...drafts].filter(input => scope === 'ALL' || !completed.has(input.id)))
}

export interface CreateDatasetExecutionRunInput {
  id: string; datasetId: string; mode: DatasetExecutionMode; scope: DatasetExecutionScope
  assetId?: string; assetVersionId?: string; mockScenario?: DatasetMockScenario; actor: string; at: string
  evalAgentVersion?: string; rubricVersion?: string; model?: string
}

export function createDatasetExecutionRun(state: EvolutionState, input: CreateDatasetExecutionRunInput): DatasetExecutionRun {
  const dataset = state.datasets.find(item => item.id === input.datasetId)
  if (!dataset) throw new Error('数据集不存在。')
  if (!input.id.trim() || (state.datasetExecutionRuns ?? []).some(item => item.id === input.id)) throw new Error('运行批次 ID 已存在或为空。')
  if (!Number.isFinite(Date.parse(input.at))) throw new Error('运行时间无效。')
  if (!['GENERATE_AND_EVALUATE', 'EVALUATE_ONLY'].includes(input.mode) || !['ALL', 'PENDING'].includes(input.scope)) throw new Error('运行模式或范围无效。')
  if (input.mode === 'EVALUATE_ONLY' && (input.assetId || input.assetVersionId)) throw new Error('仅评测已有结果沿用来源资产版本，不能替换执行资产。')
  validateAsset(state, input.assetId, input.assetVersionId)
  const selectedAsset = (state.assetCatalog ?? []).find(item => item.id === input.assetId)
  const assetVersionId = input.assetVersionId ?? selectedAsset?.currentVersionId
  const inputs = selectDatasetExecutionInputs(state, dataset.id, input.mode, input.scope)
    .map(item => input.mode === 'EVALUATE_ONLY' ? clone(item) : resolveInputAsset(state, item, input.assetId, assetVersionId))
  if (!inputs.length) throw new Error(input.mode === 'EVALUATE_ONLY' ? '没有可重新评测的已有 Trace；人工 Query 需先生成结果。' : '没有可运行的本地 Query / Trace；外部统计样本不计入可运行数量。')
  const configSnapshot: DatasetExecutionConfigSnapshot = {
    datasetSnapshot: clone(dataset), inputs: clone(inputs), scope: input.scope,
    assetId: input.assetId, assetVersionId, evalAgentVersion: input.evalAgentVersion ?? 'Mock Eval Agent · dataset-v1',
    rubricVersion: input.rubricVersion ?? 'mock-office-score-0-2-v1', model: input.model ?? 'Mock Office Agent · local-v1',
    runEnvironment: 'local-mock', mockScenario: input.mockScenario ?? 'SUCCESS', createdAt: input.at
  }
  return {
    ...atStamp(input.id, input.at), datasetId: dataset.id, datasetVersion: dataset.version, mode: input.mode,
    status: 'PENDING', configSnapshot, evaluationBatchId: `evaluation-batch-${input.id}`, createdBy: input.actor,
    items: inputs.map((item, index) => ({ id: `${input.id}-item-${index + 1}`, input: clone(item), status: 'PENDING', artifactIds: [], evidenceIds: [] }))
  }
}

function batchGraph(state: EvolutionState, run: DatasetExecutionRun, item: DatasetExecutionItem, at: string): Pick<EvolutionState, 'evaluationBatches'> {
  const items = run.items.map(candidate => candidate.id === item.id ? item : candidate)
  const traceIds = unique(items.flatMap(candidate => candidate.traceId ?? (run.mode === 'EVALUATE_ONLY' ? candidate.input.sourceTraceId ?? [] : [])))
  const done = items.filter(candidate => candidate.status === 'COMPLETED').length
  const failed = items.filter(candidate => candidate.status === 'FAILED').length
  const unfinished = items.length - done - failed
  const batch: EvaluationBatch = {
    ...atStamp(run.evaluationBatchId, run.createdAt), updatedAt: at, name: `${run.configSnapshot.datasetSnapshot.name} · 本地 Mock 评测`,
    status: unfinished ? 'RUNNING' : failed ? done ? 'PARTIAL' : 'FAILED' : 'COMPLETED', traceIds,
    packageIds: items.flatMap(candidate => candidate.packageId ?? []), jobIds: [], evalAgentVersion: run.configSnapshot.evalAgentVersion,
    rubricVersion: run.configSnapshot.rubricVersion, runEnvironment: run.configSnapshot.runEnvironment, createdBy: run.createdBy,
    stats: { inputTraceCount: traceIds.length, successCount: done, partialCount: 0, failedCount: run.mode === 'EVALUATE_ONLY' ? failed : 0, pendingCount: run.mode === 'EVALUATE_ONLY' ? unfinished : 0 },
    startedAt: run.startedAt ?? run.createdAt, completedAt: unfinished ? undefined : at,
    errorReason: failed ? items.filter(candidate => candidate.errorReason).map(candidate => candidate.errorReason).join('；') : undefined
  }
  return { evaluationBatches: upsert(state.evaluationBatches, [batch]) }
}

export interface MaterializedDatasetExecutionItem { graph: Partial<EvolutionState>; item: DatasetExecutionItem }

/** Pure local provider: Graph collections contain all existing records plus the additive result. */
export function materializeDatasetExecutionItem(state: EvolutionState, run: DatasetExecutionRun, item: DatasetExecutionItem, at: string): MaterializedDatasetExecutionItem {
  if (item.status === 'COMPLETED' || item.status === 'FAILED') return { graph: {}, item: clone(item) }
  const index = run.items.findIndex(candidate => candidate.id === item.id)
  if (index < 0) throw new Error('运行记录不属于当前批次。')
  const base = `${run.id}:${item.id}`
  const packageId = `package-${base}`
  const replay = state.tracePackages.find(pkg => pkg.id === packageId)
  if (replay) {
    const stored = (state.datasetExecutionRuns ?? []).find(candidate => candidate.id === run.id)?.items.find(candidate => candidate.id === item.id)
    if (stored?.status === 'COMPLETED') return { graph: {}, item: clone(stored) }
    const processes = state.processEvals.filter(candidate => candidate.id.startsWith(`process-eval-${base}-`))
    const outcomes = state.outcomeEvals.filter(candidate => candidate.id.startsWith(`outcome-eval-${base}-`))
    const evidenceIds = unique([...processes, ...outcomes].flatMap(evaluation => evaluation.evidenceIds))
    const evidence = state.evidence.filter(candidate => evidenceIds.includes(candidate.id))
    const artifacts = state.artifacts.filter(candidate => candidate.traceId === replay.traceId && candidate.status === 'AVAILABLE')
    const rating = clone(replay.rating!)
    const completed: DatasetExecutionItem = { ...clone(item), status: 'COMPLETED', phase: undefined,
      caseId: replay.caseId, traceId: replay.traceId, sessionId: replay.sessionId, packageId: replay.id,
      artifactIds: artifacts.map(candidate => candidate.id), evidenceIds, processFinal: rating.processFinal, outcomeFinal: rating.outcomeFinal,
      startedAt: item.startedAt ?? replay.createdAt, completedAt: replay.updatedAt,
      resultSnapshot: { capturedAt: replay.updatedAt, processEvals: clone(processes), outcomeEvals: clone(outcomes), moduleScores: clone(replay.moduleScores), evidence: clone(evidence), artifacts: clone(artifacts), rating } }
    return { graph: {}, item: completed }
  }
  const fail = (reason: string): MaterializedDatasetExecutionItem => {
    const failed: DatasetExecutionItem = { ...clone(item), status: 'FAILED', phase: undefined, errorReason: reason, startedAt: item.startedAt ?? at, completedAt: at,
      caseId: run.mode === 'EVALUATE_ONLY' ? item.input.sourceCaseId : undefined, traceId: run.mode === 'EVALUATE_ONLY' ? item.input.sourceTraceId : undefined }
    return { graph: batchGraph(state, run, failed, at), item: failed }
  }
  if (run.configSnapshot.mockScenario === 'FAILURE' || (run.configSnapshot.mockScenario === 'PARTIAL_FAILURE' && index === run.items.length - 1)) return fail('本地 Mock 失败场景：模拟运行服务暂不可用。来源样本与此前成功结果已保留。')
  const generating = run.mode === 'GENERATE_AND_EVALUATE'
  const sourceTrace = state.traces.find(candidate => candidate.id === item.input.sourceTraceId)
  const sourceCase = state.cases.find(candidate => candidate.id === sourceTrace?.caseId)
  const sourceArtifacts = state.artifacts.filter(artifact => sourceTrace?.artifactIds.includes(artifact.id) && artifact.status === 'AVAILABLE')
  const sourceObservations = state.observations.filter(observation => sourceTrace?.observationIds.includes(observation.id))
  if (!generating && !sourceTrace) return fail('来源 Trace 已不存在，无法重新评测。')
  if (!generating && !sourceArtifacts.length) return fail('来源 Trace 没有可用交付物，不能仅评测已有结果；请使用“跑结果 & 评测”生成新的结果。')
  if (!generating && !sourceObservations.length) return fail('来源 Trace 缺少执行节点，无法给出有证据的过程模块评分。')
  const sessionId = generating ? numericIdentity(`session:${base}`) : sourceTrace!.sessionId
  const traceId = generating ? numericIdentity(`trace:${base}`) : sourceTrace!.id
  const caseId = generating ? `case-${base}` : sourceCase!.id
  const artifactId = `artifact-${base}`
  const stamp = (id: string) => atStamp(id, at)
  const artifact: Artifact = {
    ...stamp(artifactId), caseId, traceId, verticalScenario: item.input.verticalScenario, name: `${item.input.verticalScenario} 交付物预览（Mock）.html`,
    kind: item.input.verticalScenario === '生图' ? 'Other' : item.input.verticalScenario,
    uri: `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>本地 Mock 交付物</title><body style="font:16px/1.6 system-ui;max-width:900px;margin:48px auto;padding:24px"><h1>${htmlEscape(item.input.verticalScenario)} 交付物预览</h1><p><strong>本地 Mock 演示，非真实 Office 文件或线上 Agent 生成结果。</strong></p><h2>用户任务</h2><p>${htmlEscape(item.input.query)}</p><h2>模拟输出</h2><p>任务已按本地演示流程执行；评分和证据可在 Case / Trace 中查阅。真实生成服务、垂类评分标准及业务准出门禁待接入或配置。</p><p>数据集：${htmlEscape(run.configSnapshot.datasetSnapshot.name)} · ${htmlEscape(run.datasetVersion)}</p><p>批次：${htmlEscape(run.id)}</p></body></html>`)}`,
    version: 'mock-html-v1', status: 'AVAILABLE', evidenceIds: []
  }
  const artifacts = generating ? [artifact] : clone(sourceArtifacts)
  const observations: ObservationLog[] = generating ? modules.map((code, moduleIndex) => ({
    ...stamp(`observation-${base}-${code}`), traceId, caseId, sequence: moduleIndex + 1,
    nodeType: code === 'REASON' ? 'Reason' : code === 'MEMORY' ? 'Memory' : code === 'SKILL' ? 'Skill' : 'Act',
    name: `${TRACE_MODULE_LABELS[code]} · 本地 Mock 执行`, input: item.input.query,
    output: `本地 Mock ${TRACE_MODULE_LABELS[code]} 执行日志；不调用真实生成或评测服务。`, status: 'SUCCEEDED',
    skillId: code === 'SKILL' ? item.input.skillId : undefined, toolName: code === 'ACT' ? 'Mock artifact preview' : undefined,
    latencyMs: 250, retryCount: 0, evidenceIds: [], logId: `log-${base}-${code}`
  })) : sourceObservations
  const evidence: Evidence[] = []
  const processes: ProcessEval[] = []
  const outcomes: OutcomeEval[] = []
  const moduleScores: ModuleEvaluationScore[] = []
  const evalVersion = run.configSnapshot.rubricVersion
  const agentVersion = run.configSnapshot.evalAgentVersion
  const rating: TraceRating = { scale: '0-2', rubric: evalVersion, processFinal: score(`${base}:process-final`), outcomeFinal: score(`${base}:outcome-final`), processDimensions: [], outcomeDimensions: [] }
  for (const code of modules) {
    const observation = observations.find(candidate => candidate.nodeType.toUpperCase() === code) ?? observations[0]
    const evaluationId = `process-eval-${base}-${code}`
    const evidenceId = `evidence-${base}-${code}`
    const moduleScoreId = `module-score-${base}-${code}`
    const value = score(`${base}:${code}`)
    const reason = `本地 Mock Eval Agent 返回 ${TRACE_MODULE_LABELS[code]} ${value}/2；依据本次输入和执行节点日志，真实评分档位及进化门槛待配置。`
    const rubricRule = `${evalVersion}#${code} · 本地 Mock 模块评分 0–2，非业务门禁。`
    evidence.push({ ...stamp(evidenceId), caseId, traceId, observationId: observation.id, kind: 'LOG', title: `${TRACE_MODULE_LABELS[code]} 评分证据（Mock）`, content: `${reason}\n输入：${item.input.query}\n执行输出：${observation.output}`, source: '本地 Mock Eval Agent' })
    const bundle: EvaluationEvidenceBundle = { rootEvidenceIds: [evidenceId], observationIds: [observation.id], logIds: [observation.logId], artifactIds: artifacts.map(candidate => candidate.id), inputSummary: item.input.query, outputSummary: reason, rubricRule, firstFailure: false, derivedFailure: false, completeness: 'COMPLETE' }
    processes.push({ ...stamp(evaluationId), type: 'PROCESS', caseId, traceId, observationId: observation.id, dimension: moduleDimensions[code], evalVersion, score: value, verdict: 'UNKNOWN', evidenceIds: [evidenceId], revisions: [{ id: `automatic-${evaluationId}`, source: 'AUTOMATIC', score: value, scoreScale: '0-2', verdict: 'UNKNOWN', reason, evidenceIds: [evidenceId], evaluator: agentVersion, evaluatedAt: at, evalVersion, evalAgentVersion: agentVersion, rubricRule }] })
    moduleScores.push({ ...stamp(moduleScoreId), packageId, caseId, traceId, moduleCode: code, moduleLabel: TRACE_MODULE_LABELS[code], automaticRevisionId: `automatic-${evaluationId}`, automaticStatus: 'UNKNOWN', score: value, scoreScale: '0-2', judgeReason: reason, evalAgentVersion: agentVersion, rubricVersion: evalVersion, evidence: bundle })
    rating.processDimensions.push({ id: evaluationId, module: code, dimension: moduleDimensions[code], score: value, scoreId: moduleScoreId })
    if (generating) observation.evidenceIds.push(evidenceId)
  }
  // Context remains visible but is never included in numeric module scoring.
  moduleScores.push({ ...stamp(`module-score-${base}-CONTEXT`), packageId, caseId, traceId, moduleCode: 'CONTEXT', moduleLabel: '上文', automaticStatus: 'N/A', scoreScale: '0-2', judgeReason: '上文需求方案评审后补充；此模块不生成评分。', evalAgentVersion: agentVersion, rubricVersion: evalVersion, evidence: { rootEvidenceIds: [], observationIds: [], logIds: [], artifactIds: [], rubricRule: '待上文的需求方案评审后补充', firstFailure: false, derivedFailure: false, completeness: 'MISSING' } })
  for (const output of artifacts) {
    for (const [dimensionIndex, dimension] of [...outcomeDimensions[item.input.verticalScenario], '产物最终评分'].entries()) {
      const isFinal = dimension === '产物最终评分'
      const evaluationId = `outcome-eval-${base}-${output.id}-${dimensionIndex}`
      const evidenceId = `evidence-${evaluationId}`
      const value = isFinal ? rating.outcomeFinal! : score(`${base}:${output.id}:${dimension}`)
      const reason = `本地 Mock ${item.input.verticalScenario} 评测：${dimension} ${value}/2；独立模拟返回，未应用业务准出阈值。`
      const rubricRule = `${evalVersion}#${item.input.verticalScenario}:${dimension} · 模拟标准，真实垂类档位待配置。`
      evidence.push({ ...stamp(evidenceId), caseId, traceId, artifactId: output.id, kind: 'ARTIFACT', title: `${dimension} 证据（Mock）`, content: `${reason}\n产物：${output.name}\n任务：${item.input.query}`, source: '本地 Mock Outcome Eval Agent' })
      outcomes.push({ ...stamp(evaluationId), type: 'OUTCOME', caseId, traceId, artifactId: output.id, dimension, isFinal, evalVersion, evalAgentVersion: agentVersion, rubricRule, score: value, scoreScale: '0-2', verdict: 'UNKNOWN', evidenceIds: [evidenceId], revisions: [{ id: `automatic-${evaluationId}`, source: 'AUTOMATIC', score: value, scoreScale: '0-2', verdict: 'UNKNOWN', reason, evidenceIds: [evidenceId], evaluator: agentVersion, evaluatedAt: at, evalVersion, evalAgentVersion: agentVersion, rubricRule }] })
      if (!isFinal) rating.outcomeDimensions.push({ dimension, score: value, evaluationId })
      if (generating) output.evidenceIds.push(evidenceId)
    }
  }
  const processFinalId = `process-eval-${base}-final`
  const processFinalEvidenceId = `evidence-${processFinalId}`
  const processFinalReason = '本地 Mock Eval Agent 独立返回过程最终分；不是模块平均分，不用于自动准出。'
  evidence.push({ ...stamp(processFinalEvidenceId), caseId, traceId, observationId: observations[0].id, kind: 'LOG', title: '过程最终评分证据（Mock）', content: `${processFinalReason} ${rating.processFinal}/2`, source: '本地 Mock Eval Agent' })
  processes.push({ ...stamp(processFinalId), type: 'PROCESS', caseId, traceId, observationId: observations[0].id, dimension: '过程最终评分', evalVersion, verdict: 'UNKNOWN', score: rating.processFinal, evidenceIds: [processFinalEvidenceId], revisions: [{ id: `automatic-${processFinalId}`, source: 'AUTOMATIC', score: rating.processFinal, scoreScale: '0-2', verdict: 'UNKNOWN', reason: processFinalReason, evidenceIds: [processFinalEvidenceId], evaluator: agentVersion, evaluatedAt: at, evalVersion, evalAgentVersion: agentVersion, rubricRule: '过程最终分聚合规则待配置；当前为独立 Mock 返回。' }] })
  const skillIds = item.input.skillId ? [item.input.skillId] : []
  const skill = state.skills.find(candidate => candidate.id === item.input.skillId)
  const pkg: TraceEvaluationPackage = { ...stamp(packageId), batchId: run.evaluationBatchId, caseId, traceId, sessionId, query: item.input.query, agentVersion: generating ? 'mock-office-agent-v1' : sourceTrace!.agentVersion ?? sourceCase!.agentVersion, skillVersion: item.input.skillVersion ?? sourceTrace?.skillVersion, skillIds: generating ? skillIds : [...sourceCase!.skillIds], skillCategory: skill?.category ?? sourceTrace?.skillCategory ?? 'GENERAL', processCoverage: 'COMPLETE', outcomeCoverage: 'COMPLETE', status: 'EVALUATED', moduleScores, findingIds: [], routingDecisionIds: [], routingDeliveryIds: [], badcaseIds: [], revaluationJobIds: [], owner: run.createdBy, rating }
  const result: DatasetExecutionItem = { ...clone(item), status: 'COMPLETED', phase: undefined, caseId, traceId, sessionId, artifactIds: artifacts.map(candidate => candidate.id), evidenceIds: evidence.map(candidate => candidate.id), packageId, processFinal: rating.processFinal, outcomeFinal: rating.outcomeFinal, startedAt: item.startedAt ?? at, completedAt: at, errorReason: undefined, resultSnapshot: { capturedAt: at, processEvals: clone(processes), outcomeEvals: clone(outcomes), moduleScores: clone(moduleScores), evidence: clone(evidence), artifacts: clone(artifacts), rating: clone(rating) } }
  const graph: Partial<EvolutionState> = { processEvals: upsert(state.processEvals, processes), outcomeEvals: upsert(state.outcomeEvals, outcomes), evidence: upsert(state.evidence, evidence), tracePackages: upsert(state.tracePackages, [pkg]), ...batchGraph(state, run, result, at) }
  if (generating) {
    const record: Case = { ...stamp(caseId), sessionId, title: `${item.input.query.slice(0, 36)}（Mock）`, query: item.input.query, scenario: item.input.verticalScenario, verticalScenario: item.input.verticalScenario, environment: 'Staging', agentVersion: 'mock-office-agent-v1', skillIds, traceIds: [traceId], artifactIds: artifacts.map(candidate => candidate.id), processEvalIds: processes.map(candidate => candidate.id), outcomeEvalIds: outcomes.map(candidate => candidate.id), attributionIds: [], issueIds: [], status: 'EVALUATED', resultStatus: 'UNKNOWN', processStatus: 'UNKNOWN', acceptanceStatus: 'UNKNOWN', owner: run.createdBy, labels: ['本地 Mock 运行', `来源数据集：${run.configSnapshot.datasetSnapshot.name}`], sourceType: 'MOCK_SET', multiScenario: false, channel: 'genflow pc 端' }
    const trace: Trace = { ...stamp(traceId), sessionId, caseId, sequence: 1, startedAt: item.startedAt ?? at, endedAt: at, queryAt: item.startedAt ?? at, observationIds: observations.map(candidate => candidate.id), artifactIds: artifacts.map(candidate => candidate.id), status: 'SUCCEEDED', totalLatencyMs: 1000, inputTokens: 120, outputTokens: 80, agentVersion: record.agentVersion, skillVersion: item.input.skillVersion, skillCategory: skill?.category ?? 'GENERAL', channel: record.channel, verticalScenario: item.input.verticalScenario, telemetry: { totalLatencyMs: 1000, ttftMs: 100, inputTokens: 120, outputTokens: 80, cacheHitCount: 0, cacheRequestCount: 0, modelCallCount: 1, toolCallCount: 1, toolOneShotSuccessCount: 1, toolExecutionCount: 1, loopCount: 0, retryCount: 0, riskInterception: { blocked: false, reason: '本地 Mock 未运行真实风控服务' }, commercialInterception: { blocked: false, reason: '本地 Mock 未运行真实商业化服务' } } }
    const session: Session = { ...stamp(sessionId), title: record.title, userId: run.createdBy, caseIds: [caseId], traceIds: [traceId], turns: [{ id: `turn-${base}-user`, sequence: 1, role: 'USER', content: item.input.query, caseId, traceId, createdAt: trace.startedAt }, { id: `turn-${base}-agent`, sequence: 2, role: 'AGENT', content: `本地 Mock 执行完成，已生成 ${item.input.verticalScenario} HTML 预览并记录过程和产物评分。`, caseId, traceId, createdAt: at }] }
    graph.sessions = upsert(state.sessions, [session])
    graph.cases = upsert(state.cases, [record])
    graph.traces = upsert(state.traces, [trace])
    graph.observations = upsert(state.observations, observations)
    graph.artifacts = upsert(state.artifacts, artifacts)
  } else {
    graph.cases = state.cases.map(record => record.id === caseId ? { ...record, updatedAt: at, processEvalIds: unique([...record.processEvalIds, ...processes.map(candidate => candidate.id)]), outcomeEvalIds: unique([...record.outcomeEvalIds, ...outcomes.map(candidate => candidate.id)]) } : record)
  }
  return { graph, item: result }
}
