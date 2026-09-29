export type Id = string
export type ISODateTime = string
export type EvolutionModule = 'Reason' | 'Memory' | 'Skill' | 'Act' | 'Context'
export const ATTRIBUTION_DIMENSIONS: Record<EvolutionModule, readonly string[]> = {
  Memory: ['生产错误', '管理错误', '召回率低', '准确率低'],
  Skill: ['能力缺乏', '文件不可用', 'SOP 错误', 'name/description 错误', '品味库召回错误', '资产质量', '资产不足'],
  Reason: ['未响应用户诉求', '未充分结合上文', '选择不正确或低效', '工具参数错误'],
  Act: ['工具执行失败', '未遵循重试或超时等稳定性规则'],
  Context: ['需求待补充']
}
export type EvaluationVerdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE'
export type EvaluationSource = 'AUTOMATIC' | 'HUMAN'
export type RoutingLabel = '策略迭代' | 'Agent 迭代' | '个人能力转 Skill（二期）'
export type OptimizationMode = 'DIRECT_FIX' | 'CLUSTER_OPTIMIZATION'
export type RouteDestinationType = 'DIRECT_FIX' | 'ISSUE_CLUSTER' | 'STRATEGY_BACKLOG' | 'AGENT_BACKLOG' | 'PERSONAL_SKILL_PHASE_2'
export type EvidenceKind = 'INPUT' | 'OUTPUT' | 'ERROR' | 'LOG' | 'ARTIFACT' | 'USER_FEEDBACK' | 'RULE'

export interface EntityBase { id: Id; createdAt: ISODateTime; updatedAt: ISODateTime }

export interface Session extends EntityBase {
  title: string
  userId: string
  caseIds: Id[]
  traceIds: Id[]
  turns: SessionTurn[]
}

export interface SessionTurn {
  id: Id; sequence: number; role: 'USER' | 'AGENT'; content: string; caseId: Id; traceId: Id; createdAt: ISODateTime
}

export interface InterceptionSignal { blocked: boolean; reason: string; category?: string }
export interface TraceTelemetry {
  totalLatencyMs: number; ttftMs: number; inputTokens: number; outputTokens: number; cacheHitCount: number; cacheRequestCount: number
  modelCallCount: number; toolCallCount: number; toolOneShotSuccessCount: number; toolExecutionCount: number; loopCount: number; retryCount: number
  riskInterception: InterceptionSignal; commercialInterception: InterceptionSignal
}

export interface Case extends EntityBase {
  sessionId: Id
  title: string
  query: string
  scenario: string
  environment: 'Production' | 'Staging'
  agentVersion: string
  skillIds: Id[]
  traceIds: Id[]
  artifactIds: Id[]
  processEvalIds: Id[]
  outcomeEvalIds: Id[]
  attributionIds: Id[]
  issueIds: Id[]
  status: 'NEW' | 'EVALUATED' | 'CONFIRMED' | 'IN_PROGRESS' | 'RESOLVED'
  resultStatus: EvaluationVerdict
  processStatus: EvaluationVerdict
  feedback?: string
  owner?: string
  labels: string[]
  multiScenario: boolean
}

export interface Trace extends EntityBase {
  sessionId: Id
  caseId: Id
  sequence: number
  startedAt: ISODateTime
  endedAt: ISODateTime
  observationIds: Id[]
  artifactIds: Id[]
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL'
  totalLatencyMs: number
  inputTokens: number
  outputTokens: number
  telemetry: TraceTelemetry
}

export interface ObservationLog extends EntityBase {
  traceId: Id
  caseId: Id
  sequence: number
  nodeType: 'Reason' | 'Memory' | 'Skill' | 'Tool' | 'Act' | 'Artifact'
  name: string
  input: string
  output: string
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
  skillId?: Id
  toolName?: string
  latencyMs: number
  retryCount: number
  evidenceIds: Id[]
  logId: Id
}

export interface Evidence extends EntityBase {
  caseId: Id
  traceId?: Id
  observationId?: Id
  artifactId?: Id
  kind: EvidenceKind
  title: string
  content: string
  source: string
}

export interface Artifact extends EntityBase {
  caseId: Id
  traceId: Id
  name: string
  kind: 'PPT' | 'Excel' | 'Word' | 'JSON' | 'Log' | 'Other'
  uri: string
  version: string
  status: 'AVAILABLE' | 'INVALID' | 'MISSING'
  evidenceIds: Id[]
}

export interface EvaluationRevision {
  id: Id
  source: EvaluationSource
  verdict: EvaluationVerdict
  score?: number
  reason: string
  evidenceIds: Id[]
  evaluator: string
  evaluatedAt: ISODateTime
  supersedesRevisionId?: Id
}

export interface AttributionRevision {
  id: Id; source: EvaluationSource; module: EvolutionModule; dimension: string; evidenceIds: Id[]; routingLabels: RoutingLabel[]
  optimizationMode: OptimizationMode; confirmed: boolean; status: Attribution['status']; confidence: number; reason: string
  revisedBy: string; revisedAt: ISODateTime; supersedesRevisionId?: Id
}

interface EvaluationBase extends EntityBase {
  caseId: Id
  traceId: Id
  evalVersion: string
  verdict: EvaluationVerdict
  score?: number
  evidenceIds: Id[]
  revisions: EvaluationRevision[]
}

export interface ProcessEval extends EvaluationBase { type: 'PROCESS'; observationId: Id; dimension: string; failedNodeId?: Id }
export interface OutcomeEval extends EvaluationBase { type: 'OUTCOME'; artifactId: Id; dimension: string }

export interface Attribution extends EntityBase {
  caseId: Id; traceId: Id; observationId?: Id; module: EvolutionModule; dimension: string; evidenceIds: Id[]
  confidence: number; source: EvaluationSource; confirmed: boolean; routingLabels: RoutingLabel[]
  optimizationMode: OptimizationMode; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; revisions: AttributionRevision[]
}

export interface Issue extends EntityBase {
  caseId: Id; attributionId: Id; title: string; description: string; module: EvolutionModule; dimension: string
  evidenceIds: Id[]; routingLabels: RoutingLabel[]; optimizationMode: OptimizationMode
  responsibilityStatus: 'UNASSIGNED' | 'ASSIGNED' | 'VERIFIED'; owner?: string
  status: 'PENDING' | 'CONFIRMED' | 'FIXING' | 'VERIFIED' | 'CLOSED'; clusterIds: Id[]; variantIds: Id[]; processingChains?: ProcessingChain[]
}
export interface ProcessingChain {
  id: Id; routingLabel: RoutingLabel; destinationType: RouteDestinationType; destinationId?: Id; status: 'PLANNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED' | 'PHASE_2'; note: string
}

export interface IssueCluster extends EntityBase {
  name: string; description: string; module: EvolutionModule; dimension: string; caseIds: Id[]; issueIds: Id[]
  evidenceIds: Id[]; variantIds: Id[]; status: 'COLLECTING' | 'READY' | 'VARIANT_CREATED' | 'VERIFIED'
  triggerRuleId?: Id; currentCount: number; threshold?: number; countingRule: string; tastePopulation?: TasteLibraryPopulationSnapshot
}

export interface TasteLibraryPopulationSnapshot {
  skillId: Id
  externalMockConfirmedCaseCount: number
  snapshotId: Id
  source: string
  countedAt: ISODateTime
}

export interface Skill extends EntityBase {
  name: string; type: 'OFFICIAL' | 'PERSONAL' | 'SYSTEM'; version: string; visibility: 'PRIVATE' | 'PUBLIC'
  evolutionRecordIds: Id[]; assetIds: Id[]; generationStatus: 'AVAILABLE' | 'PLANNED' | 'NOT_APPLICABLE'
}

export interface Asset extends EntityBase {
  name: string; kind: 'TEMPLATE' | 'TASTE_LIBRARY' | 'DOCUMENT' | 'DATA'; ownerId: string
  visibility: 'PRIVATE' | 'PUBLIC'; skillIds: Id[]; sanitizationStatus: 'PENDING' | 'PASSED' | 'REJECTED' | 'NOT_REQUIRED'
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'; publishStatus: 'NOT_PUBLISHED' | 'PUBLISHED'
}

export interface Variant extends EntityBase {
  name: string; targetModule: EvolutionModule
  changeType: 'SKILL_CONTENT' | 'SKILL_METADATA' | 'PROMPT_OR_POLICY' | 'TOOL_STABILITY' | 'ASSET'
  changeSummary: string; changeContent: string; currentVersion: string; candidateVersion: string
  sourceCaseIds: Id[]; sourceIssueIds: Id[]; sourceClusterIds: Id[]; evidenceIds: Id[]
  status: 'DRAFT' | 'READY' | 'EXPERIMENTING' | 'SINGLE_PASSED' | 'WINDOW_VALIDATED' | 'RELEASED' | 'REJECTED'
  experimentIds: Id[]
}

export interface Dataset extends EntityBase {
  name: string; type: 'ATTRIBUTION' | 'GENERALIZATION' | 'REGRESSION' | 'WINDOW_ONLINE'; version: string
  caseIds: Id[]; sampleCount: number; source: string; timeRange?: { from: ISODateTime; to: ISODateTime }
  scope: string; frozen: boolean; population: DatasetPopulation
}

export interface DatasetPopulation {
  totalSampleCount: number; localCaseCount: number; externalSampleCount: number; sourceSystem: string; countingRule: string
}

export interface ExperimentMetric {
  key: string; label: string; category: 'LOCAL' | 'END_TO_END' | 'GENERALIZATION'
  baselineMean: number; candidateMean: number; baselineStdDev: number; candidateStdDev: number
  unit: 'score' | 'rate' | 'ms' | 'count'; gateStatus: 'PASS' | 'FAIL' | 'PENDING'
}
export type GateDecisionBasis = 'CONFIGURED_THRESHOLD' | 'HUMAN_REVIEW'

export interface ExperimentConfigSnapshot {
  datasetVersions: Array<{ datasetId: Id; version: string; versionId: Id; sampleCount: number }>; model: string
  toolPermissions: string[]; timeoutMs: number; repeatCount: number; runEnvironment: string; createdAt: ISODateTime
}

export interface Experiment extends EntityBase {
  name: string; level: 'SINGLE_VARIANT' | 'WINDOW_COMBINATION'; variantIds: Id[]; windowId?: Id; datasetIds: Id[]
  configSnapshot: ExperimentConfigSnapshot; runIds: Id[]; baselineVersion: string; candidateVersion: string
  metrics: ExperimentMetric[]; failedCaseIds: Id[]; rollbackItems: string[]; knownRisks: string[]
  status: 'DRAFT' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DECIDED'; gateDecisionId?: Id
}

export interface ExperimentRun extends EntityBase {
  experimentId: Id; caseId: Id; repetition: number; arm: 'BASELINE' | 'CANDIDATE'
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'; processScore?: number; outcomeScore?: number
  durationMs: number; error?: string; configHash: string
}

export interface Window extends EntityBase {
  name: string; timeRange: { from: ISODateTime; to: ISODateTime }; candidateVariantIds: Id[]
  singleExperimentIds: Id[]; combinationExperimentId?: Id
  status: 'COLLECTING' | 'READY' | 'EXPERIMENTING' | 'DECIDED' | 'RELEASED'
}

export interface GateReportSnapshot {
  experimentId?: Id; variantIds: Id[]; datasetVersions: Array<{ datasetId: Id; version: string }>; metricResults: ExperimentMetric[]
  configSnapshot?: ExperimentConfigSnapshot; runSnapshots?: ExperimentRun[]; failedCaseIds?: Id[]; rollbackItems?: string[]; knownRisks?: string[]; evidenceIds?: Id[]
}

export interface GateDecision {
  id: Id; experimentId: Id; conclusion: 'PASS' | 'REJECT' | 'MANUAL_REVIEW'; reason: string; riskNotes: string[]
  decidedBy: string; decidedAt: ISODateTime; reportSnapshot: GateReportSnapshot; decisionBasis?: GateDecisionBasis
}

export interface ReleaseVersion extends EntityBase {
  version: string; windowId: Id; variantIds: Id[]; combinationExperimentId: Id; gateDecisionId: Id
  approvedBy: string; status: 'PENDING' | 'CANARY' | 'RELEASED' | 'OBSERVING' | 'ROLLED_BACK'
  releasedAt?: ISODateTime; rollbackVersionId?: Id; rollbackReason?: string
}

export interface RuleConfig extends EntityBase {
  name: string; category: 'TRIGGER' | 'EXPERIMENT' | 'GATE' | 'MONITORING'; status: 'CONFIGURED' | 'PENDING'
  value?: number | string | boolean; unit?: string; description: string
}

export interface AuditEvent {
  id: Id; at: ISODateTime; actor: string; action: string; entityType: string; entityId: Id; reason: string
  changes?: Record<string, unknown>
}

export interface EvolutionState {
  schemaVersion: number; seedVersion: string; isMockData: true; updatedAt: ISODateTime
  sessions: Session[]; cases: Case[]; traces: Trace[]; observations: ObservationLog[]; evidence: Evidence[]
  artifacts: Artifact[]; processEvals: ProcessEval[]; outcomeEvals: OutcomeEval[]; attributions: Attribution[]
  issues: Issue[]; issueClusters: IssueCluster[]; skills: Skill[]; assets: Asset[]; variants: Variant[]
  datasets: Dataset[]; experiments: Experiment[]; experimentRuns: ExperimentRun[]; windows: Window[]
  gateDecisions: GateDecision[]; releases: ReleaseVersion[]; rules: RuleConfig[]; auditTrail: AuditEvent[]
}

export type EvolutionEntity = Session | Case | Trace | ObservationLog | Evidence | Artifact | ProcessEval | OutcomeEval
  | Attribution | Issue | IssueCluster | Skill | Asset | Variant | Dataset | Experiment | ExperimentRun
  | Window | GateDecision | ReleaseVersion | RuleConfig
