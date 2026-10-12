import type { EvolutionState, EvolutionTarget, Skill } from '../domain'

const clone = <T,>(value: T): T => structuredClone(value)
const START = '2026-09-27T04:00:00.000Z'
const batchId = 'batch-skill-version-workspaces'
const jobId = 'job-skill-version-workspaces'
const stamp = <T,>(value: T, at: string) => ({ ...value, createdAt: at, updatedAt: at })
const canonicalVersion = (value?: string) => value?.match(/\d+\.\d+\.\d+(?:-[\w.-]+)?$/)?.[0] ?? value

/** Only these authored historical examples have a verifiable source version.
 * Never infer a missing execution version from the current Skill catalog. */
export const CORE_HISTORICAL_SKILL_VERSIONS: Readonly<Record<string, string>> = {
  'trace-ppt-context': '2.5.0',
  'trace-ppt-generate': '2.5.0',
  'trace-tool-export': '2.5.0'
}

type VersionInfo = NonNullable<Skill['versions']>[number]
interface WorkspaceFixture {
  key: string; skillId: string; version: string; attributionId: string; template: string
  query: string; description: string; scenario: 'PPT' | 'Excel' | 'Word' | 'General'
  waiting?: boolean
}

const workspaces: WorkspaceFixture[] = [
  { key: 'ppt-260-sop', skillId: 'skill-ppt-builder', version: '2.6.0', attributionId: 'skill-sop', template: 'production-sop', query: '读取销售 Excel 并检查公式后，制作管理层季度经营 PPT。', description: 'PPT 2.6.0 的 SOP 在数据校验前开始渲染；独立修复实验等待运行。', scenario: 'PPT' },
  { key: 'ppt-260-description', skillId: 'skill-ppt-builder', version: '2.6.0', attributionId: 'skill-description', template: 'production-metadata', query: '制作一份含风险与决策建议的董事会 PPT。', description: 'PPT 2.6.0 的 description 尚未覆盖董事会决策场景；归因已确认，修订待启动。', scenario: 'PPT', waiting: true },
  { key: 'ppt-260rc-sop', skillId: 'skill-ppt-builder', version: '2.6.0-rc.1', attributionId: 'skill-sop', template: 'production-sop', query: '在候选 PPT Skill 中验证销售表读取、计算、校验、渲染的执行顺序。', description: '2.6.0-rc.1 的独立 SOP 回归记录；不复用 2.5.0 的准出结论。', scenario: 'PPT' },
  { key: 'taste-090-quality', skillId: 'skill-taste-executive', version: '0.9.0', attributionId: 'taste-quality', template: 'taste-asset-quality', query: '使用管理层模板生成可在投影中阅读的经营 PPT。', description: '0.9.0 模板的字号和图表对比度需修补；与新版召回问题分开积累。', scenario: 'PPT', waiting: true },
  { key: 'taste-100rc-recall', skillId: 'skill-taste-executive', version: '1.0.0-rc.1', attributionId: 'taste-recall', template: 'taste-red', query: '按我明确选择的红色偏好生成简洁管理层 PPT。', description: '新版红色品味召回问题处于数据积累阶段；未达到 100 条相关数据触发条件，不能进入实验。', scenario: 'PPT', waiting: true },
  { key: 'taste-100rc-shortage', skillId: 'skill-taste-executive', version: '1.0.0-rc.1', attributionId: 'taste-shortage', template: 'taste-asset-shortage', query: '制作符合医疗行业品牌的深红色董事会 PPT。', description: '新版医疗行业资产仍不足；新增能力待启动，业务门槛待配置。', scenario: 'PPT', waiting: true },
  { key: 'excel-251-act', skillId: 'skill-spreadsheet', version: '2.5.1', attributionId: 'act-failed', template: 'act-execution', query: '导出仅包含已筛选区域的 Excel 预算明细。', description: '2.5.1 空字段导致工具执行异常；明确失败证据与独立回归集。', scenario: 'Excel', waiting: true },
  { key: 'excel-260rc-params', skillId: 'skill-spreadsheet', version: '2.6.0-rc.1', attributionId: 'reason-params', template: 'reason-parameter', query: '只导出预算表 A1:F120，不能包含其他工作表。', description: '候选版 Reason 构造范围参数超出约束；归入 Reason 而不是 Act。', scenario: 'Excel' },
  { key: 'word-140-choice', skillId: 'skill-word-builder', version: '1.4.0', attributionId: 'reason-choice', template: 'reason-choice', query: '一次读取合同条款并汇总三项风险，输出 Word 摘要。', description: 'Word 1.4.0 路径调用冗余，结果与过程分开评测；业务效率基线待配置。', scenario: 'Word', waiting: true },
  { key: 'word-150rc-sop', skillId: 'skill-word-builder', version: '1.5.0-rc.1', attributionId: 'skill-sop', template: 'production-sop', query: '先核对合同来源与引用，再生成 Word 风险报告。', description: 'Word 候选版 SOP 在核对引用前生成报告，需要独立验证。', scenario: 'Word' },
  { key: 'canvas-080-capability', skillId: 'skill-canvas-builder', version: '0.8.0', attributionId: 'skill-capability', template: 'production-capability', query: '生成可交互的预算 Canvas，并支持区域钻取。', description: '当前 Canvas Skill 缺乏区域钻取能力；新增能力待启动。', scenario: 'General', waiting: true }
]

function targetFor(workspace: WorkspaceFixture): EvolutionTarget {
  return { skillId: workspace.skillId, skillVersion: workspace.version, skillVersionId: `${workspace.skillId}@${workspace.version}`, attributionId: workspace.attributionId, evolutionItemId: workspace.attributionId }
}

/** Keep canonical metadata outside frozen reports and execution snapshots. */
export function normalizeWorkspaceTargets(targets: EvolutionTarget[] | undefined): EvolutionTarget[] | undefined {
  return targets?.map(target => {
    const skillVersion = canonicalVersion(target.skillVersion)
    return { ...target, skillVersion, skillVersionId: skillVersion ? `${target.skillId}@${skillVersion}` : target.skillVersionId, attributionId: target.attributionId ?? target.evolutionItemId }
  })
}

function versionCatalog(skill: Skill): VersionInfo[] {
  const specific: Record<string, Array<[string, VersionInfo['status']]>> = {
    'skill-ppt-builder': [['2.5.0', 'DEPRECATED'], ['2.6.0-rc.1', 'CANDIDATE'], ['2.6.0', 'RELEASED']],
    'skill-taste-executive': [['0.9.0', 'RELEASED'], ['1.0.0-rc.1', 'CANDIDATE']],
    'skill-spreadsheet': [['2.5.0', 'DEPRECATED'], ['2.5.1', 'RELEASED'], ['2.6.0-rc.1', 'CANDIDATE']],
    'skill-word-builder': [['1.4.0', 'RELEASED'], ['1.5.0-rc.1', 'CANDIDATE']],
    'skill-canvas-builder': [['0.8.0', 'RELEASED'], ['0.9.0-rc.1', 'CANDIDATE']]
  }
  const currentVersion = canonicalVersion(skill.version)!
  const discovered = [...new Set([currentVersion, ...(skill.evolutionHistory ?? []).filter(entry => !entry.version.startsWith('agent-') && !['发布版本', '窗口组合实验'].includes(entry.stage)).map(entry => canonicalVersion(entry.version)!).filter(Boolean)])]
  const entries = skill.generationStatus === 'PLANNED' ? [['未生成', 'PLANNED'] as const] : specific[skill.id] ?? discovered.map(version => [version, version === currentVersion ? 'RELEASED' : version.includes('-') ? 'CANDIDATE' : 'DEPRECATED'] as [string, VersionInfo['status']])
  return entries.map(([version, status], index) => ({ id: `${skill.id}@${version}`, version, status, description: status === 'PLANNED' ? '个人 Skill 生成服务为二期规划，未生成可运行版本。' : status === 'CANDIDATE' ? '候选版本，实验与准出状态独立记录；不代表已发布。' : status === 'DEPRECATED' ? '历史固定版本，保留当时来源、实验和发布记录。' : '已存在的 Mock Skill 版本；仍可有待处理归因。', createdAt: new Date(Date.parse('2026-09-20T04:00:00.000Z') + index * 86400000).toISOString(), updatedAt: START }))
}

function cloneSample(state: EvolutionState, workspace: WorkspaceFixture, sample: number, serial: number) {
  const sourceCase = state.cases.find(record => record.id === `case-v2-${sample === 3 ? 'pass-1' : workspace.template}`)!
  const sourceSession = state.sessions.find(session => session.id === sourceCase.sessionId)!
  const sourceTraces = state.traces.filter(trace => sourceCase.traceIds.includes(trace.id))
  const sourcePackages = state.tracePackages.filter(pkg => sourceCase.traceIds.includes(pkg.traceId))
  const owned = {
    cases: [sourceCase], sessions: [sourceSession], traces: sourceTraces,
    observations: state.observations.filter(item => item.caseId === sourceCase.id),
    artifacts: state.artifacts.filter(item => item.caseId === sourceCase.id),
    evidence: state.evidence.filter(item => item.caseId === sourceCase.id),
    processEvals: state.processEvals.filter(item => item.caseId === sourceCase.id),
    outcomeEvals: state.outcomeEvals.filter(item => item.caseId === sourceCase.id),
    attributions: state.attributions.filter(item => item.caseId === sourceCase.id),
    issues: state.issues.filter(item => item.caseId === sourceCase.id), tracePackages: sourcePackages,
    evaluationFindings: state.evaluationFindings.filter(item => item.caseId === sourceCase.id),
    routingDecisions: state.routingDecisions.filter(item => sourcePackages.some(pkg => pkg.id === item.packageId)),
    routingDeliveries: state.routingDeliveries.filter(item => item.caseId === sourceCase.id),
    algorithmBadcases: state.algorithmBadcases.filter(item => sourcePackages.some(pkg => pkg.id === item.packageId))
  }
  const suffix = `${workspace.key}-${sample}`
  const at = new Date(Date.parse(START) + serial * 17 * 60000).toISOString()
  const idMap = new Map<string, string>()
  const registerIds = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(registerIds)
    else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (typeof record.id === 'string') idMap.set(record.id, `${record.id}-workspace-${suffix}`)
      Object.values(record).forEach(registerIds)
    }
  }
  Object.values(owned).forEach(registerIds)
  idMap.set(sourceCase.id, `case-workspace-${suffix}`)
  idMap.set(sourceSession.id, `session-workspace-${suffix}`)
  sourceTraces.forEach(trace => idMap.set(trace.id, `trace-workspace-${suffix}`))
  owned.observations.forEach(observation => idMap.set(observation.logId, `log-workspace-${suffix}-${observation.nodeType.toLowerCase()}`))
  sourcePackages.forEach(pkg => { idMap.set(pkg.batchId, batchId); pkg.revaluationJobIds.forEach(id => idMap.set(id, jobId)) })
  const rewrite = <T,>(value: T): T => {
    const visit = (node: unknown): unknown => typeof node === 'string' ? idMap.get(node) ?? (workspace.template === 'taste-red' && node.includes('1000') ? '本条样本的用户明确要求红色，实际召回银灰教学模板；该 Trace 不代表历史偏好人群聚合。' : node) : Array.isArray(node) ? node.map(visit) : node && typeof node === 'object' ? Object.fromEntries(Object.entries(node).map(([key, entry]) => [key, visit(entry)])) : node
    return visit(clone(value)) as T
  }
  const copied = rewrite(owned)
  const skill = state.skills.find(item => item.id === workspace.skillId)!
  const record = copied.cases[0]
  record.title = `${skill.name} ${workspace.version} · ${sample === 3 ? '相邻回归样本' : workspace.description}`
  record.query = `${workspace.query}${sample === 1 ? '' : sample === 2 ? ' 附加约束：保留原始数据与用户指定格式。' : ' 相邻回归：沿用已验证的静态输出能力。'}`
  record.skillIds = [workspace.skillId]; record.scenario = workspace.scenario
  record.sourceType = sample === 1 ? 'ONLINE_WINDOW' : sample === 2 ? 'MOCK_SET' : 'GOLDEN_DATASET'
  record.environment = 'Production'; record.createdAt = at; record.updatedAt = at
  record.owner = skill.category === 'TASTE_SKILL' ? '品味库团队' : '生产 Skill 团队'
  record.labels = ['固定 Skill 版本样例', workspace.version, workspace.attributionId]
  record.channel = (['小程序', 'genflow pc 端', 'genflow 垂类入口'] as const)[sample - 1]
  record.verticalScenario = workspace.scenario === 'General' ? '生图' : workspace.scenario
  copied.sessions.forEach(session => { session.title = record.title; session.createdAt = at; session.updatedAt = at; session.turns.forEach((turn, index) => { turn.createdAt = new Date(Date.parse(at) + index * 1000).toISOString(); if (turn.role === 'USER') turn.content = record.query }) })
  copied.traces.forEach(trace => { trace.skillVersion = workspace.version; trace.skillCategory = skill.category; trace.createdAt = at; trace.updatedAt = at; trace.startedAt = at; trace.queryAt = at; trace.endedAt = new Date(Date.parse(at) + trace.totalLatencyMs).toISOString(); trace.channel = record.channel; trace.verticalScenario = record.verticalScenario })
  copied.observations.forEach(observation => { observation.createdAt = at; observation.updatedAt = at; observation.input = record.query; observation.name = `${observation.nodeType} · ${skill.name} ${workspace.version}`; if (observation.skillId) observation.skillId = workspace.skillId; if (observation.toolName) observation.toolName = workspace.scenario === 'Excel' ? 'sheets.export' : workspace.scenario === 'Word' ? 'docs.export' : workspace.scenario === 'General' ? 'canvas.render' : 'slides.render' })
  copied.evidence.forEach(evidence => { evidence.createdAt = at; evidence.updatedAt = at; evidence.title = `${skill.name} ${workspace.version} · 根证据 ${sample}` })
  copied.artifacts.forEach(artifact => { artifact.createdAt = at; artifact.updatedAt = at; artifact.kind = workspace.scenario === 'General' ? 'Other' : workspace.scenario; artifact.name = `${skill.name}-${workspace.version}-${sample}.${workspace.scenario === 'PPT' ? 'pptx' : workspace.scenario === 'Word' ? 'docx' : workspace.scenario === 'Excel' ? 'xlsx' : 'json'}`; artifact.uri = `mock://artifacts/${artifact.id}` })
  copied.tracePackages.forEach(pkg => {
    pkg.query = record.query; pkg.skillIds = [workspace.skillId]; pkg.skillVersion = workspace.version; pkg.skillCategory = skill.category!; pkg.createdAt = at; pkg.updatedAt = at; pkg.owner = record.owner
    pkg.moduleScores.forEach(score => { score.createdAt = at; score.updatedAt = at; score.evidence.inputSummary = record.query })
    const process = pkg.moduleScores.filter(score => !['CONTEXT', 'OUTCOME'].includes(score.moduleCode) && score.score !== undefined)
    const outcome = pkg.moduleScores.filter(score => score.moduleCode === 'OUTCOME' && score.score !== undefined)
    pkg.rating = { scale: '0-2', rubric: '固定版本 Mock 模块与垂类 Rubric', processFinal: Number((process.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / process.length).toFixed(2)), outcomeFinal: Number((outcome.reduce((sum, score) => sum + (score.score ?? 0) * 2, 0) / outcome.length).toFixed(2)), processDimensions: process.map(score => ({ module: score.moduleCode, dimension: score.moduleLabel, score: (score.score ?? 0) * 2, scoreId: score.id })), outcomeDimensions: outcome.map(score => ({ dimension: score.moduleLabel, score: (score.score ?? 0) * 2, evaluationId: score.id })) }
  })
  copied.evaluationFindings.forEach(finding => { finding.skillCategory = skill.category!; finding.preferenceSignalId = undefined; finding.createdAt = at; finding.updatedAt = at })
  copied.issues.forEach(issue => { issue.title = workspace.description; issue.clusterIds = []; issue.variantIds = []; issue.createdAt = at; issue.updatedAt = at; issue.processingChains?.forEach(chain => { chain.destinationId = undefined }); issue.owner = record.owner })
  copied.routingDeliveries.forEach(delivery => { delivery.variantId = undefined; delivery.issueClusterId = undefined; delivery.regressionDatasetId = `dataset-workspace-${workspace.key}-regression`; delivery.owner = record.owner })
  copied.processEvals.forEach(evaluation => { evaluation.createdAt = at; evaluation.updatedAt = at; evaluation.revisions.forEach(revision => { revision.evaluatedAt = at }) })
  copied.outcomeEvals.forEach(evaluation => { evaluation.createdAt = at; evaluation.updatedAt = at; evaluation.revisions.forEach(revision => { revision.evaluatedAt = at }) })
  for (const key of Object.keys(copied) as Array<keyof typeof copied>) (state[key] as unknown[]).push(...copied[key])
  return record
}

/** Independent workspace fixtures, not extra bindings on old experiment reports. */
export function addSkillWorkspaceFixtures(input: EvolutionState): EvolutionState {
  const state = clone(input)
  state.skills.forEach(skill => { skill.versions = versionCatalog(skill) })
  state.traces.forEach(trace => { if (CORE_HISTORICAL_SKILL_VERSIONS[trace.id]) trace.skillVersion ??= CORE_HISTORICAL_SKILL_VERSIONS[trace.id] })
  state.tracePackages.forEach(pkg => { if (CORE_HISTORICAL_SKILL_VERSIONS[pkg.traceId]) pkg.skillVersion ??= CORE_HISTORICAL_SKILL_VERSIONS[pkg.traceId] })
  const legacyTasteTarget: EvolutionTarget = { skillId: 'skill-taste-executive', skillVersion: '0.9.0', skillVersionId: 'skill-taste-executive@0.9.0', attributionId: 'taste-recall', evolutionItemId: 'taste-recall' }
  const legacyTasteDataset = state.datasets.find(dataset => dataset.id === 'dataset-taste-red-attribution')
  if (legacyTasteDataset) { legacyTasteDataset.targets ??= [legacyTasteTarget]; legacyTasteDataset.purpose ??= '原始归因集'; legacyTasteDataset.setRole ??= 'EVALUATION' }
  const legacyTasteExperiment = state.experiments.find(experiment => experiment.id === 'exp-taste-red-single')
  if (legacyTasteExperiment) legacyTasteExperiment.targets ??= [legacyTasteTarget]
  const legacyDuplicateIds = new Set(['dataset-attribution', 'dataset-generalization', 'exp-single-ppt-routing'])
  state.datasets.forEach(dataset => { dataset.targets = normalizeWorkspaceTargets(dataset.targets)?.filter(target => !legacyDuplicateIds.has(dataset.id) || target.skillVersion !== '2.6.0-rc.1') })
  state.experiments.forEach(experiment => { experiment.targets = normalizeWorkspaceTargets(experiment.targets)?.filter(target => !legacyDuplicateIds.has(experiment.id) || target.skillVersion !== '2.6.0-rc.1') })
  const toolSourceTargets = (targets: EvolutionTarget[] | undefined) => targets?.map(target => target.skillId === 'skill-spreadsheet' ? { ...target, skillVersion: '2.5.0', skillVersionId: 'skill-spreadsheet@2.5.0' } : target)
  state.datasets.filter(dataset => dataset.id === 'dataset-spreadsheet-regression').forEach(dataset => { dataset.targets = toolSourceTargets(dataset.targets) })
  state.experiments.filter(experiment => ['exp-single-tool-retry', 'exp-window-2026w35'].includes(experiment.id)).forEach(experiment => { experiment.targets = toolSourceTargets(experiment.targets) })
  state.variants.forEach(variant => {
    const skill = state.skills.find(item => item.evolutionRecordIds.includes(variant.id))
    if (!skill) return
    const source = state.issues.find(issue => variant.sourceIssueIds.includes(issue.id))
    const attributionId = source ? state.datasets.flatMap(dataset => dataset.targets ?? []).find(target => target.skillId === skill.id)?.attributionId : undefined
    if (attributionId && !variant.targets?.length) variant.targets = [{ skillId: skill.id, skillVersion: canonicalVersion(variant.currentVersion), skillVersionId: `${skill.id}@${canonicalVersion(variant.currentVersion)}`, attributionId, evolutionItemId: attributionId }]
  })
  const generatedTraceIds: string[] = []; const generatedPackageIds: string[] = []
  workspaces.forEach((workspace, index) => {
    const samples = [1, 2, 3].map(sample => cloneSample(state, workspace, sample, index * 3 + sample - 1))
    generatedTraceIds.push(...samples.flatMap(record => record.traceIds))
    generatedPackageIds.push(...state.tracePackages.filter(pkg => samples.some(record => record.id === pkg.caseId)).map(pkg => pkg.id))
    const at = samples[0].createdAt
    const skill = state.skills.find(item => item.id === workspace.skillId)!
    const target = targetFor(workspace)
    const datasets = (['attribution', 'generalization', 'regression'] as const).map((role, roleIndex) => {
      const purpose = (['原始归因集', '同类泛化集', '相邻及无关回归集'] as const)[roleIndex]
      const caseIds = role === 'attribution' ? samples.slice(0, 2).map(record => record.id) : role === 'generalization' ? samples.slice(1).map(record => record.id) : [samples[2].id]
      const dataset = stamp({ id: `dataset-workspace-${workspace.key}-${role}`, name: `${skill.name} ${workspace.version} ${purpose}${String.fromCharCode(65 + index)}`, type: (['ATTRIBUTION', 'GENERALIZATION', 'REGRESSION'] as const)[roleIndex], version: 'v1.0', caseIds, sampleCount: caseIds.length, source: '结构化 Mock 固定版本测试样本', scope: workspace.description, frozen: !workspace.waiting, purpose, targets: [target], setRole: 'EVALUATION' as const, targetClassification: 'EVOLUTION' as const, timeRange: { from: samples[0].createdAt, to: samples[2].updatedAt }, population: { totalSampleCount: caseIds.length, localCaseCount: caseIds.length, externalSampleCount: 0, sourceSystem: '本地结构化 Mock', countingRule: '按固定 Skill 版本 + 归因 + Case ID 去重；所有样本均可展开 Trace。' } }, at)
      state.datasets.push(dataset)
      return dataset
    })
    const issueIds = samples.flatMap(record => record.issueIds)
    const evidenceIds = [...new Set(state.issues.filter(issue => issueIds.includes(issue.id)).flatMap(issue => issue.evidenceIds))]
    const variantId = `variant-workspace-${workspace.key}`
    const experimentId = `experiment-workspace-${workspace.key}`
    const module = state.issues.find(issue => issueIds.includes(issue.id))?.module ?? 'Skill'
    state.variants.push(stamp({ id: variantId, name: `${skill.name} ${workspace.version} · ${workspace.description}`, targetModule: module, targets: [target], changeType: workspace.attributionId === 'skill-description' ? 'SKILL_METADATA' : module === 'Reason' ? 'PROMPT_OR_POLICY' : module === 'Act' ? 'TOOL_STABILITY' : 'SKILL_CONTENT', changeSummary: workspace.description, changeContent: '仅记录 Mock 候选修改与证据，未接入真实生成或发布服务。', currentVersion: workspace.version, candidateVersion: `${workspace.version}-fix.1`, sourceCaseIds: samples.slice(0, 2).map(record => record.id), sourceIssueIds: issueIds, sourceClusterIds: [], evidenceIds, status: workspace.waiting ? 'DRAFT' : 'READY', experimentIds: workspace.waiting ? [] : [experimentId] }, at))
    state.issues.filter(issue => issueIds.includes(issue.id)).forEach(issue => { issue.variantIds = [variantId]; issue.status = workspace.waiting ? 'CONFIRMED' : 'FIXING'; issue.processingChains?.forEach(chain => { if (chain.destinationType === 'DIRECT_FIX') chain.destinationId = variantId }) })
    skill.evolutionRecordIds.push(variantId)
    skill.evolutionHistory = [...(skill.evolutionHistory ?? []), stamp({ id: `history-workspace-${workspace.key}`, version: workspace.version, stage: '归因确认' as const, summary: workspace.description, referenceId: samples[0].id, referenceKind: 'case', status: workspace.waiting ? '待启动' : '实验待运行' }, at)]
    if (!workspace.waiting) state.experiments.push(stamp({ id: experimentId, name: `${skill.name} ${workspace.version} 固定归因验证`, level: 'SINGLE_VARIANT', variantIds: [variantId], datasetIds: datasets.map(dataset => dataset.id), targets: [target], baselineVersion: workspace.version, candidateVersion: `${workspace.version}-fix.1`, configSnapshot: { datasetVersions: datasets.map(dataset => ({ datasetId: dataset.id, version: dataset.version, versionId: `${dataset.id}@${dataset.version}`, sampleCount: dataset.sampleCount, caseIds: [...dataset.caseIds] })), model: 'mock-office-model', toolPermissions: ['office.read', 'office.render'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'local-mock-runner', createdAt: at, evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1' }, runIds: [], metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: ['实验尚未运行，不能推断准出或发布结论；业务门禁待配置。'], status: 'QUEUED' }, at))
  })
  state.evaluationBatches.push(stamp({ id: batchId, name: '多 Skill 固定版本 Trace 样本（Mock）', status: 'COMPLETED', traceIds: generatedTraceIds, packageIds: generatedPackageIds, jobIds: [jobId], evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', createdBy: 'Mock Seeder', stats: { inputTraceCount: generatedTraceIds.length, successCount: generatedTraceIds.length, partialCount: 0, failedCount: 0, pendingCount: 0 }, startedAt: START, completedAt: START }, START))
  state.evaluationJobs.push(stamp({ id: jobId, batchId, attempt: 1, status: 'COMPLETED', traceIds: generatedTraceIds, processedTraceIds: generatedTraceIds, failedTraceIds: [], evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', configurationSnapshot: { source: '固定 Skill 版本样本' }, completedAt: START }, START))
  state.badcaseQueues.forEach(queue => { queue.deliveryIds = state.routingDeliveries.filter(delivery => delivery.queueId === queue.id).map(delivery => delivery.id); queue.itemIds = state.algorithmBadcases.filter(badcase => badcase.queueId === queue.id).map(badcase => badcase.id) })
  state.updatedAt = state.cases.map(record => record.updatedAt).sort().at(-1) ?? state.updatedAt
  return state
}
