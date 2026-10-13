export type Id = string
export type ISODateTime = string
export type EvolutionModule = 'Reason' | 'Memory' | 'Skill' | 'Act' | 'Context'

/**
 * The V2 attribution dictionary is intentionally kept as data rather than
 * inferred from display text.  Historical V1 records can still carry their
 * original `dimension` value through `legacyRawLabel`, while all new findings
 * use this exact wording.
 */
export const ATTRIBUTION_DIMENSIONS: Record<EvolutionModule, readonly string[]> = {
  Memory: ['生产错误', '管理错误', '召回率低', '准确率低'],
  Skill: ['能力缺乏', 'skill文件不可用', 'skill sop错误', 'skill name/description错误', '品味库召回错误', '品味库资产质量', '品味库资产不足'],
  Reason: ['没有充分响应用户query的客观诉求', '没有充分结合上文', '没有做出最正确/高效的选择', '调用工具所需参数是否正确'],
  Act: ['工具未执行成功', '未遵循重试，超时等工程稳定性规则'],
  Context: ['待上文的需求方案评审后补充']
}

/** V1 aliases are retained for migrations and existing screens only. */
export const LEGACY_ATTRIBUTION_DIMENSIONS: Record<EvolutionModule, readonly string[]> = {
  Memory: ['生产错误', '管理错误', '召回率低', '准确率低'],
  Skill: ['能力缺乏', '文件不可用', 'SOP 错误', 'name/description 错误', '品味库召回错误', '资产质量', '资产不足'],
  Reason: ['未响应用户诉求', '未充分结合上文', '选择不正确或低效', '工具参数错误'],
  Act: ['工具执行失败', '未遵循重试或超时等稳定性规则'],
  Context: ['需求待补充']
}
export const ATTRIBUTION_TAXONOMY_VERSION = 'v2.0.0'

export type SkillCategory = 'PRODUCTION_SKILL' | 'GENERAL' | 'PERSONAL_SKILL' | 'TASTE_SKILL' | 'UNCLASSIFIED'
export type TraceChannel = '小程序' | 'genflow pc 端' | 'genflow 垂类入口'
export type VerticalScenario = 'PPT' | 'Word' | 'Excel' | '生图'
export type UserAcceptanceStatus = 'ACCEPTED' | 'REJECTED' | 'UNKNOWN'
export type DatasetPurpose = '原始归因集' | '同类泛化集' | '相邻及无关回归集' | '窗口线上数据全集' | '泛化集合' | '黄金集' | '自定义数据集'
/** Top-level dataset ownership used by the Case / Trace dataset filter. */
export type DatasetCategory = 'GATE' | 'GOLDEN' | 'PERSONAL'
export interface EvolutionTarget {
  skillId: Id
  skillVersion?: string
  skillVersionId?: string
  /** PRD attribution dimension ID; not a pointer to an individual human label. */
  attributionId?: string
  /** Compatibility field for old persisted targets. */
  evolutionItemId: string
}
/** Explicit governance scope; module targets never borrow a Skill's version. */
export type EvolutionTargetIdentity =
  | { kind: 'SKILL'; governanceObject: 'Skill'; skillId: Id; skillVersion: string; attributionId: string }
  | { kind: 'MODULE'; governanceObject: 'Memory' | 'Reason' | 'Act' | 'Context' | 'OTHER_BADCASE'; targetId: Id; targetVersion?: string; attributionId: string }

export interface ModuleEvolutionBinding {
  id: Id; traceId: Id; packageId: Id; moduleScoreId: Id; automaticRevisionId: Id
  processEvaluationId?: Id; scoreDimensionId?: Id; findingId: Id; attributionRecordId?: Id
  evolutionRecordIds: Id[]; origin: 'MOCK' | 'LOCAL' | 'LEGACY'; createdAt: ISODateTime
}
export interface EvolutionRecord extends EntityBase {
  target: EvolutionTargetIdentity; name: string; origin: 'MOCK' | 'LOCAL' | 'LEGACY'
  sourceFindingIds: Id[]; sourceAttributionIds: Id[]; sourceIssueIds: Id[]; sourceClusterIds: Id[]
  optimizationMode?: OptimizationMode; triggerRuleId?: Id
  routingDeliveryIds: Id[]; datasetIds: Id[]; variantIds: Id[]
  singleExperimentIds: Id[]; windowExperimentIds: Id[]; decisionIds: Id[]; releaseIds: Id[]
  supersedesRecordId?: Id
}
export type EvaluationBatchStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED'
export type EvaluationJobStatus = 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type ModuleEvaluationStatus = 'PASS' | 'FAIL' | 'DERIVED_FAIL' | 'UNKNOWN' | 'N/A'
export type EvaluationCoverageStatus = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'N/A'
export type TraceEvaluationModuleCode = 'REASON' | 'MEMORY' | 'CONTEXT' | 'SKILL' | 'ACT' | 'TOOL' | 'OUTCOME'
export type V2RoutingLabel = '策略迭代' | 'Agent迭代'
export type RoutingDecisionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'DELIVERED'
export type RoutingDeliveryStatus = 'PENDING' | 'QUEUED' | 'DELIVERED' | 'ACKNOWLEDGED' | 'REJECTED' | 'RESOLVED'
export type RoutingDestination = 'ALGORITHM_BADCASE' | 'AGENT_ITERATION' | 'TASTE_LIBRARY' | 'PERSONAL_SKILL_PLANNING' | 'DIRECT_FIX' | 'ISSUE_CLUSTER'
export type AlgorithmBadcaseStatus = 'CANDIDATE' | 'CONFIRMED' | 'REJECTED' | 'RESOLVED'
export type BadcaseQueueKind = 'ALGORITHM' | 'AGENT' | 'TASTE' | 'PERSONAL_SKILL' | 'DIRECT_FIX'

export const TRACE_MODULE_LABELS: Record<TraceEvaluationModuleCode, string> = {
  REASON: 'Reason', MEMORY: '记忆', CONTEXT: '上文', SKILL: 'skill', ACT: 'Act', TOOL: 'Tool', OUTCOME: 'Outcome/产物'
}
export type EvaluationVerdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE'
export type EvaluationSource = 'AUTOMATIC' | 'HUMAN'
export type RoutingLabel = '策略迭代' | 'Agent 迭代' | '个人能力转 Skill（二期）'
export type OptimizationMode = 'DIRECT_FIX' | 'CLUSTER_OPTIMIZATION'
export type RouteDestinationType = 'DIRECT_FIX' | 'ISSUE_CLUSTER' | 'STRATEGY_BACKLOG' | 'AGENT_BACKLOG' | 'PERSONAL_SKILL_PHASE_2'
export type EvidenceKind = 'INPUT' | 'OUTPUT' | 'ERROR' | 'LOG' | 'ARTIFACT' | 'USER_FEEDBACK' | 'RULE'

export interface EntityBase { id: Id; createdAt: ISODateTime; updatedAt: ISODateTime }

/** Opaque external identity. Values stay strings, including numeric IDs. */
export interface IdentityAlias { kind: 'trace' | 'session'; alias: string; canonicalId: Id }
export interface GovernanceReference { kind: import('./components/ViewPrimitives').ReferenceKind; id: Id }
export interface TraceGovernanceEvent {
  parentEventIds?: Id[]
  id: Id; traceId: Id; caseId: Id; branchId?: Id; occurredAt?: ISODateTime; recordedAt: ISODateTime
  stage: string; statusCode: string; actor: string; description: string
  sourceRef?: GovernanceReference; targetRefs: GovernanceReference[]
  origin: 'MOCK' | 'LOCAL' | 'LEGACY'; relationType: 'TRACE_SOURCE' | 'CASE_SHARED' | 'VALIDATION'; sourceEventId?: Id
}
export interface DatasetMembershipRecord {
  id: Id; datasetId: Id; datasetVersion: string; caseId: Id; traceIds: Id[]; scope: 'TRACE' | 'CASE_SHARED'
  joinedAt?: ISODateTime; actor: string; origin: 'MOCK' | 'LOCAL' | 'LEGACY'; sourceEventId?: Id
}

/** An immutable record of the sampling decision used to populate a local
 * custom dataset.  The allocation keeps the per-attribution share visible so
 * a later evaluation can explain why a Trace was selected. */
export interface DatasetSamplingAllocation {
  evolutionRecordId: Id
  attributionId: Id
  attributionLabel: string
  historicalTraceCount: number
  historicalShare: number
  requestedCount: number
  sampledTraceIds: Id[]
}

export interface DatasetSamplingSnapshot extends EntityBase {
  datasetId: Id
  assetKind: 'SKILL' | 'MEMORY' | 'REASON' | 'ACT' | 'CONTEXT' | 'OTHER_BADCASE'
  assetId: Id
  assetVersion?: string
  requestedCount: number
  candidateTraceIds: Id[]
  allocations: DatasetSamplingAllocation[]
  deduplicatedTraceCount: number
  samplingRule: string
  status: 'PREVIEW' | 'APPLIED'
  createdBy: string
  appliedAt?: ISODateTime
}
export interface ModuleReviewRevision {
  id: Id; traceId: Id; caseId: Id; packageId: Id; moduleScoreId: Id; automaticRevisionId: Id
  humanScore?: number; auxiliaryVerdict: ModuleEvaluationStatus; reason: string; reviewer: string; reviewedAt: ISODateTime
  evidenceIds: Id[]; rubricVersion: string; rubricRule: string; evalAgentVersion: string
  automaticSnapshot: { score?: number; scoreScale: '0-1' | '0-2'; status: ModuleEvaluationStatus; judgeReason: string; evidence: EvaluationEvidenceBundle; evalAgentVersion: string; rubricVersion: string }
  supersedesReviewId?: Id; origin: 'LOCAL' | 'LEGACY' | 'MOCK'
}

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
  modelLatencyMs?: number; modelThroughputTokensPerSecond?: number; inputCostDeviationRate?: number; outputCostDeviationRate?: number
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
  /** Explicit Mock/user event label; never inferred from free-text feedback. */
  acceptanceStatus?: UserAcceptanceStatus
  owner?: string
  labels: string[]
  multiScenario: boolean
  sourceType?: 'ONLINE_WINDOW' | 'GOLDEN_DATASET' | 'MOCK_SET'
  channel?: TraceChannel
  verticalScenario?: VerticalScenario
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
  /** V2 ledger fields; omitted on legacy V1 traces and filled by migration. */
  agentVersion?: string
  skillVersion?: string
  skillCategory?: SkillCategory
  channel?: TraceChannel
  verticalScenario?: VerticalScenario
  queryAt?: ISODateTime
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
  verticalScenario?: VerticalScenario
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
  evalVersion?: string
  evalAgentVersion?: string
  rubricRule?: string
  automaticSnapshot?: { score?: number; scoreScale: '0-1' | '0-2'; verdict: EvaluationVerdict; reason: string; evidenceIds: Id[]; evaluatedAt?: ISODateTime; evalVersion: string; evalAgentVersion?: string; rubricRule?: string }
  scoreScale?: '0-1' | '0-2'
  automaticRevisionId?: Id
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
export interface OutcomeEval extends EvaluationBase { type: 'OUTCOME'; artifactId: Id; dimension: string; scoreScale?: '0-1' | '0-2'; rubricRule?: string; evalAgentVersion?: string; isFinal?: boolean }

export interface Attribution extends EntityBase {
  caseId: Id; traceId: Id; observationId?: Id; module: EvolutionModule; dimension: string; evidenceIds: Id[]
  confidence: number; source: EvaluationSource; confirmed: boolean; routingLabels: RoutingLabel[]
  optimizationMode: OptimizationMode; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; revisions: AttributionRevision[]
  moduleCode?: string; dimensionCode?: string; dimensionLabel?: string; description?: string; optimizationDimension?: string; selectedOptimizationCondition?: string; taxonomyVersion?: string; labelSnapshot?: string; legacyRawLabel?: string
}

export type EvidenceCompleteness = 'COMPLETE' | 'PARTIAL' | 'MISSING'
export type TraceEvaluationPackageStatus = 'PENDING' | 'EVALUATED' | 'PARTIAL' | 'FAILED'

export interface EvaluationEvidenceBundle {
  rootEvidenceIds: Id[]
  rubricRule: string
  observationIds: Id[]
  logIds: Id[]
  artifactIds: Id[]
  inputSummary?: string
  outputSummary?: string
  firstFailure: boolean
  derivedFailure: boolean
  derivedFromModule?: TraceEvaluationModuleCode
  completeness: EvidenceCompleteness
}

export interface ModuleEvaluationScore extends EntityBase {
  automaticRevisionId?: Id
  scoreScale?: '0-1' | '0-2'
  packageId: Id
  traceId: Id
  caseId: Id
  moduleCode: TraceEvaluationModuleCode
  moduleLabel: string
  automaticStatus: ModuleEvaluationStatus
  humanStatus?: ModuleEvaluationStatus
  humanScore?: number
  score?: number
  judgeReason: string
  evalAgentVersion: string
  rubricVersion: string
  evidence: EvaluationEvidenceBundle
  humanNote?: string
  humanUpdatedAt?: ISODateTime
  humanUpdatedBy?: string
}

export interface EvaluationBatchStats {
  inputTraceCount: number
  successCount: number
  partialCount: number
  failedCount: number
  pendingCount: number
}

export interface EvaluationBatch extends EntityBase {
  name: string
  status: EvaluationBatchStatus
  traceIds: Id[]
  packageIds: Id[]
  jobIds: Id[]
  evalAgentVersion: string
  rubricVersion: string
  runEnvironment: string
  createdBy: string
  stats: EvaluationBatchStats
  errorReason?: string
  startedAt?: ISODateTime
  completedAt?: ISODateTime
}

export interface EvaluationJob extends EntityBase {
  batchId: Id
  attempt: number
  status: EvaluationJobStatus
  traceIds: Id[]
  processedTraceIds: Id[]
  failedTraceIds: Id[]
  evalAgentVersion: string
  rubricVersion: string
  runEnvironment: string
  configurationSnapshot: Record<string, unknown>
  errorReason?: string
  queuedAt?: ISODateTime
  startedAt?: ISODateTime
  completedAt?: ISODateTime
}

export interface TraceEvaluationPackage extends EntityBase {
  batchId: Id
  caseId: Id
  sessionId: Id
  traceId: Id
  query: string
  agentVersion: string
  skillVersion?: string
  skillIds: Id[]
  skillCategory: SkillCategory
  processCoverage: EvaluationCoverageStatus
  outcomeCoverage: EvaluationCoverageStatus
  status: TraceEvaluationPackageStatus
  moduleScores: ModuleEvaluationScore[]
  findingIds: Id[]
  routingDecisionIds: Id[]
  routingDeliveryIds: Id[]
  badcaseIds: Id[]
  owner?: string
  revaluationJobIds: Id[]
  rating?: TraceRating
}

/** Versioned 0–2 display contract; legacy 0–1 evaluations remain immutable. */
export interface TraceRating {
  scale: '0-2'
  rubric: string
  processFinal?: number
  outcomeFinal?: number
  processDimensions: Array<{ id?: Id; module: TraceEvaluationModuleCode; dimension: string; score?: number; scoreId?: Id }>
  outcomeDimensions: Array<{ dimension: string; score?: number; evaluationId?: Id }>
}

export interface EvaluationFinding extends EntityBase {
  packageId: Id
  batchId: Id
  caseId: Id
  sessionId: Id
  traceId: Id
  moduleCode: TraceEvaluationModuleCode
  moduleLabel: string
  dimensionCode: string
  dimensionLabel: string
  description: string
  optimizationDimension?: string
  selectedOptimizationCondition?: string
  taxonomyVersion: string
  labelSnapshot: string
  legacyRawLabel?: string
  skillCategory: SkillCategory
  /** Structured Eval Agent scenario returned with the finding. */
  scenarioCode?: string
  scenarioLabel?: string
  optimizationPath?: string
  preferenceSignalId?: Id
  score?: number
  status: 'OPEN' | 'CONFIRMED' | 'REJECTED' | 'RESOLVED'
  firstFailure: boolean
  derivedFailure: boolean
  evidenceBundle: EvaluationEvidenceBundle
  routingDecisionIds: Id[]
  routingDeliveryIds: Id[]
}

export interface RoutingPolicy extends EntityBase {
  name: string
  version: string
  enabled: boolean
  description: string
  skillCategories?: SkillCategory[]
  moduleCodes?: TraceEvaluationModuleCode[]
  outputLabel: V2RoutingLabel
  destination: RoutingDestination
  priority: number
}

export interface RoutingDecision extends EntityBase {
  findingId: Id
  packageId: Id
  traceId: Id
  policyId: Id
  label: V2RoutingLabel
  destination: RoutingDestination
  status: RoutingDecisionStatus
  reason: string
  confirmedBy?: string
  confirmedAt?: ISODateTime
  deliveryIds: Id[]
}

export interface RoutingDelivery extends EntityBase {
  findingId: Id
  decisionId: Id
  packageId: Id
  caseId: Id
  traceId: Id
  label: V2RoutingLabel
  destination: RoutingDestination
  status: RoutingDeliveryStatus
  queueId?: Id
  owner?: string
  note?: string
  algorithmBadcaseId?: Id
  issueId?: Id
  issueClusterId?: Id
  variantId?: Id
  regressionDatasetId?: Id
  deliveredAt?: ISODateTime
  acknowledgedAt?: ISODateTime
}

export interface AlgorithmBadcaseItem extends EntityBase {
  findingId: Id
  packageId: Id
  traceId: Id
  deliveryId: Id
  queueId: Id
  status: AlgorithmBadcaseStatus
  title: string
  owner?: string
  note?: string
  regressionDatasetId?: Id
  confirmedBy?: string
  confirmedAt?: ISODateTime
  sourceEvidenceIds: Id[]
  issueId?: Id
  issueClusterId?: Id
  variantId?: Id
}

export interface BadcaseQueue extends EntityBase {
  name: string
  kind: BadcaseQueueKind
  itemIds: Id[]
  deliveryIds: Id[]
  owner?: string
  description: string
}

export interface PersonalSkillPlanningSource {
  query?: string
  assetIds: Id[]
  existingSkillIds: Id[]
  conversationTraceIds: Id[]
  artifactIds: Id[]
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

/**
 * Aggregate preference evidence used by Taste Skill self-evolution.
 * This is intentionally separate from the 100 related-case taste-library
 * trigger so the user cohort denominator is never mixed with Case counts.
 */
export interface TastePreferenceSignal extends EntityBase {
  skillId: Id
  windowId?: Id
  source: 'ONLINE_WINDOW' | 'MOCK_SET' | 'GOLDEN_DATASET'
  populationTotal: number
  preferenceCount: number
  preferenceValue: string
  preferenceRate: number
  feedbackCount?: number
  caseIds: Id[]
  evidenceIds: Id[]
  judgeReason: string
  routingLabel: 'Agent迭代'
  optimizationPath: string
  relatedDataCount: number
  relatedDataThreshold: number
  /** Generated feedback records, not 1000 fully expanded execution traces. */
  samples?: Array<{ userId: Id; preference: string }>
  clusterId?: Id
}

export interface SkillEvolutionHistoryEntry extends EntityBase {
  stage: '线上问题' | '评测完成' | '归因确认' | '问题簇' | '能力变体' | '单变体实验' | '窗口组合实验' | '准出决策' | '发布版本'
  version: string
  summary: string
  referenceId?: Id
  referenceKind?: string
  status?: string
}

export interface SkillVersionInfo extends EntityBase {
  version: string
  status: 'RELEASED' | 'CANDIDATE' | 'DEPRECATED' | 'PLANNED'
  description: string
}

export interface Skill extends EntityBase {
  name: string; type: 'OFFICIAL' | 'PERSONAL' | 'SYSTEM'; version: string; visibility: 'PRIVATE' | 'PUBLIC'
  evolutionRecordIds: Id[]; assetIds: Id[]; generationStatus: 'AVAILABLE' | 'PLANNED' | 'NOT_APPLICABLE'
  category?: SkillCategory
  /** Skill versions only; Agent release versions never belong to this catalog. */
  versions?: SkillVersionInfo[]
  description?: string
  planningSources?: PersonalSkillPlanningSource[]
  evolutionHistory?: SkillEvolutionHistoryEntry[]
}

export interface Asset extends EntityBase {
  name: string; kind: 'TEMPLATE' | 'TASTE_LIBRARY' | 'DOCUMENT' | 'DATA'; ownerId: string
  visibility: 'PRIVATE' | 'PUBLIC'; skillIds: Id[]; sanitizationStatus: 'PENDING' | 'PASSED' | 'REJECTED' | 'NOT_REQUIRED'
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'; publishStatus: 'NOT_PUBLISHED' | 'PUBLISHED'
}

/** Unified asset catalog used by the Asset Management workbench.  The
 * existing Asset entity remains the source of truth for sanitization,
 * review and publication; these records provide a stable analytical view for
 * Skills and non-Skill assets such as Memory, Tool and System Prompt. */
export type AssetCatalogKind = 'TASTE_SKILL' | 'PRODUCTION_SKILL' | 'PERSONAL_SKILL' | 'MEMORY' | 'TOOL' | 'SYSTEM_PROMPT' | 'OTHER_CAPABILITY'
export type AssetCatalogStatus = 'ACTIVE' | 'CANDIDATE' | 'DEPRECATED' | 'PLANNED'
export interface AssetCatalogEntry extends EntityBase {
  name: string
  kind: AssetCatalogKind
  description: string
  status: AssetCatalogStatus
  ownerScope: 'SYSTEM' | 'TEAM' | 'USER'
  skillId?: Id
  legacyAssetId?: Id
  currentVersionId?: Id
  visibility: 'PRIVATE' | 'PUBLIC'
}
export interface AssetVersion extends EntityBase {
  assetId: Id
  version: string
  status: AssetCatalogStatus
  /** Explicit deployment state, independent of asset category and filters. */
  deployment?: {
    environment?: 'Production' | 'Staging'
    status: 'ACTIVE' | 'CANARY' | 'OFFLINE' | 'NOT_DEPLOYED'
    source: 'MOCK' | 'SERVICE' | 'LOCAL'
    updatedAt: ISODateTime
  }
  description: string
  releasedAt?: ISODateTime
  effectiveFrom?: ISODateTime
  effectiveTo?: ISODateTime
  sourceEvolutionRecordIds: Id[]
}
/** One assessed artifact produced while a particular asset version was active.
 * Scores are always exposed on the workbench's 0–2 scale. */
export interface AssetPerformanceRecord extends EntityBase {
  assetId: Id
  assetVersionId: Id
  traceId: Id
  caseId: Id
  artifactId?: Id
  outcomeEvalId?: Id
  score?: number
  scoreScale: '0-2'
  /** Query occurrence time used by the workbench time-window filter. */
  queryAt?: ISODateTime
  scoredAt: ISODateTime
  datasetIds: Id[]
  evolutionRecordIds: Id[]
}
/** Contribution index between an asset version, an attribution/evolution item,
 * and the de-duplicated Trace set that produced that evolution. */
export interface AssetEvolutionContribution extends EntityBase {
  assetId: Id
  assetVersionId: Id
  evolutionRecordId: Id
  attributionId: Id
  attributionLabel: string
  traceIds: Id[]
  datasetIds: Id[]
  status: 'HISTORICAL' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED'
}

export interface Variant extends EntityBase {
  name: string; targetModule: EvolutionModule
  changeType: 'SKILL_CONTENT' | 'SKILL_METADATA' | 'PROMPT_OR_POLICY' | 'TOOL_STABILITY' | 'ASSET'
  changeSummary: string; changeContent: string; currentVersion: string; candidateVersion: string
  sourceCaseIds: Id[]; sourceIssueIds: Id[]; sourceClusterIds: Id[]; evidenceIds: Id[]
  status: 'DRAFT' | 'READY' | 'EXPERIMENTING' | 'SINGLE_PASSED' | 'WINDOW_VALIDATED' | 'RELEASED' | 'REJECTED'
  experimentIds: Id[]
  targets?: EvolutionTarget[]
}

export interface Dataset extends EntityBase {
  name: string; type: 'ATTRIBUTION' | 'GENERALIZATION' | 'REGRESSION' | 'WINDOW_ONLINE'; version: string
  caseIds: Id[]; sampleCount: number; source: string; timeRange?: { from: ISODateTime; to: ISODateTime }
  scope: string; frozen: boolean; population: DatasetPopulation
  /** Explicit category; legacy records may omit this and are treated as GATE. */
  datasetCategory?: DatasetCategory
  /** SYSTEM datasets are seeded by the platform; USER_CUSTOM datasets are
   * created in the local workbench and remain editable until frozen. */
  datasetOrigin?: 'SYSTEM' | 'USER_CUSTOM'
  description?: string
  /** User-owned datasets retain their owner rather than inferring it from display text. */
  createdBy?: string
  ownerScope?: 'SYSTEM' | 'USER' | 'TEAM'
  purpose?: DatasetPurpose
  targets?: EvolutionTarget[]
  setRole?: 'EVALUATION' | 'GATE' | 'GOLDEN'
  targetClassification?: 'EVOLUTION' | 'NON_EVOLUTION'
  windowIds?: Id[]
  gateStatus?: '已准出' | '待决策' | '不准出' | '人工复核' | '待配置'
}

export interface DatasetPopulation {
  totalSampleCount: number; localCaseCount: number; externalSampleCount: number; sourceSystem: string; countingRule: string
}

/** User-authored inputs stay separate from existing Case / Trace membership. */
export type DatasetExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'
export type DatasetExecutionMode = 'GENERATE_AND_EVALUATE' | 'EVALUATE_ONLY'
export type DatasetExecutionScope = 'ALL' | 'PENDING'
export type DatasetMockScenario = 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILURE'
export interface DatasetQueryRecord extends EntityBase {
  datasetId: Id
  datasetVersion: string
  query: string
  verticalScenario: VerticalScenario
  assetId?: Id
  assetVersionId?: Id
  createdBy: string
  status: DatasetExecutionStatus
  latestRunId?: Id
}
export interface DatasetExecutionInputSnapshot {
  id: Id
  sourceQueryId?: Id
  sourceTraceId?: Id
  sourceCaseId?: Id
  query: string
  verticalScenario: VerticalScenario
  assetId?: Id
  assetVersionId?: Id
  skillId?: Id
  skillVersion?: string
}
export interface DatasetExecutionConfigSnapshot {
  datasetSnapshot: Dataset
  inputs: DatasetExecutionInputSnapshot[]
  scope: DatasetExecutionScope
  assetId?: Id
  assetVersionId?: Id
  evalAgentVersion: string
  rubricVersion: string
  model: string
  runEnvironment: string
  mockScenario: DatasetMockScenario
  createdAt: ISODateTime
}
/** Every completed item keeps the evidence and scoring response as recorded. */
export interface DatasetExecutionResultSnapshot {
  capturedAt: ISODateTime
  processEvals: ProcessEval[]
  outcomeEvals: OutcomeEval[]
  moduleScores: ModuleEvaluationScore[]
  evidence: Evidence[]
  artifacts: Artifact[]
  rating: TraceRating
}
export interface DatasetExecutionItem {
  id: Id
  input: DatasetExecutionInputSnapshot
  status: DatasetExecutionStatus
  phase?: 'GENERATING' | 'EVALUATING'
  caseId?: Id
  traceId?: Id
  sessionId?: Id
  artifactIds: Id[]
  evidenceIds: Id[]
  packageId?: Id
  processFinal?: number
  outcomeFinal?: number
  errorReason?: string
  startedAt?: ISODateTime
  completedAt?: ISODateTime
  resultSnapshot?: DatasetExecutionResultSnapshot
}
export interface DatasetExecutionRun extends EntityBase {
  datasetId: Id
  datasetVersion: string
  mode: DatasetExecutionMode
  status: DatasetExecutionStatus
  configSnapshot: DatasetExecutionConfigSnapshot
  items: DatasetExecutionItem[]
  evaluationBatchId: Id
  createdBy: string
  startedAt?: ISODateTime
  completedAt?: ISODateTime
  errorReason?: string
}

export interface ExperimentMetric {
  key: string; label: string; category: 'LOCAL' | 'END_TO_END' | 'GENERALIZATION'
  baselineMean: number; candidateMean: number; baselineStdDev: number; candidateStdDev: number
  unit: 'score' | 'rate' | 'ms' | 'count'; gateStatus: 'PASS' | 'FAIL' | 'PENDING'
}
export type GateDecisionBasis = 'CONFIGURED_THRESHOLD' | 'HUMAN_REVIEW'

export interface ExperimentEvaluationSnapshot {
  capturedAt: ISODateTime
  evalAgentVersion?: string; rubricVersion?: string
  artifactIds: Id[]; evidenceBundleIds: Id[]; tracePackageIds: Id[]
  moduleEvaluations: ModuleEvaluationScore[]
  tracePackages: Array<Pick<TraceEvaluationPackage, 'id' | 'batchId' | 'caseId' | 'sessionId' | 'traceId' | 'query' | 'agentVersion' | 'skillVersion' | 'skillCategory'>>
  artifacts: Artifact[]; rootEvidence: Evidence[]; observations: ObservationLog[]
  processEvals: ProcessEval[]; outcomeEvals: OutcomeEval[]
}

export interface ExperimentWindowSnapshot {
  windowId: Id; candidateVariantIds: Id[]; cutoffAt?: ISODateTime; frozenAt?: ISODateTime
  nextWindowRule?: string; nextWindowRuleId?: Id; nextWindowId?: Id
}

export interface ExperimentConfigSnapshot {
  datasetVersions: Array<{ datasetId: Id; version: string; versionId: Id; sampleCount: number; caseIds?: Id[] }>; model: string
  toolPermissions: string[]; timeoutMs: number; repeatCount: number; runEnvironment: string; createdAt: ISODateTime
  evalAgentVersion?: string; rubricVersion?: string; artifactIds?: Id[]; evidenceBundleIds?: Id[]; tracePackageIds?: Id[]
  evaluationSnapshot?: ExperimentEvaluationSnapshot
  windowSnapshot?: ExperimentWindowSnapshot
}

export interface Experiment extends EntityBase {
  name: string; level: 'SINGLE_VARIANT' | 'WINDOW_COMBINATION'; variantIds: Id[]; windowId?: Id; datasetIds: Id[]
  configSnapshot: ExperimentConfigSnapshot; runIds: Id[]; baselineVersion: string; candidateVersion: string
  metrics: ExperimentMetric[]; failedCaseIds: Id[]; rollbackItems: string[]; knownRisks: string[]
  status: 'DRAFT' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DECIDED'; gateDecisionId?: Id
  targets?: EvolutionTarget[]
}

export interface ExperimentRun extends EntityBase {
  experimentId: Id; caseId: Id; repetition: number; arm: 'BASELINE' | 'CANDIDATE'
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'; processScore?: number; outcomeScore?: number
  durationMs: number; error?: string; configHash: string
  /** Immutable experiment setup captured when this run is created. */
  configSnapshot?: Omit<ExperimentConfigSnapshot, 'evaluationSnapshot'>
  /** Narrow lookup-friendly copy retained on every run for report/lineage views. */
  evalSnapshot?: ExperimentEvaluationSnapshot
  windowSnapshot?: ExperimentWindowSnapshot
}

export interface Window extends EntityBase {
  name: string; timeRange: { from: ISODateTime; to: ISODateTime }; candidateVariantIds: Id[]
  singleExperimentIds: Id[]; combinationExperimentId?: Id
  status: 'COLLECTING' | 'READY' | 'EXPERIMENTING' | 'DECIDED' | 'RELEASED'
  cutoffAt?: ISODateTime
  frozenAt?: ISODateTime
  nextWindowRuleId?: Id
  nextWindowRule?: string
  nextWindowId?: Id
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

export type ScopedRuleType = 'GATE' | 'ROUTING' | 'CLUSTER'
/** A missing version applies to this asset's versions; never to other assets. */
export interface RuleScope { assetId: Id; attributionId: Id; assetVersion?: string }
export type ScopedRuleConfiguration =
  | { type: 'GATE'; scope: RuleScope; settings: { processMin?: number; outcomeMin?: number; generalizationMin?: number; requireHumanReview: boolean } }
  | { type: 'ROUTING'; scope: RuleScope; settings: { destinations: Array<'STRATEGY' | 'AGENT'>; owner?: string } }
  | { type: 'CLUSTER'; scope: RuleScope; settings: { minCases?: number; countingUnit: 'CONFIRMED_CASE'; windowDays?: number; minimumSimilarity?: number; requireHumanConfirmation: boolean } }

export interface RuleConfig extends EntityBase {
  name: string; category: 'TRIGGER' | 'EXPERIMENT' | 'GATE' | 'MONITORING' | 'ROUTING'; status: 'CONFIGURED' | 'PENDING'
  value?: number | string | boolean; unit?: string; description: string
  /** Optional to preserve existing global rules and old persisted snapshots. */
  configuration?: ScopedRuleConfiguration
}

export interface AuditEvent {
  id: Id; at: ISODateTime; actor: string; action: string; entityType: string; entityId: Id; reason: string
  changes?: Record<string, unknown>
}

export interface EvolutionState {
  moduleEvolutionBindings?: ModuleEvolutionBinding[]
  evolutionRecords?: EvolutionRecord[]
  identityAliases?: IdentityAlias[]
  moduleReviews?: ModuleReviewRevision[]
  datasetMemberships?: DatasetMembershipRecord[]
  /** Immutable local sampling decisions; absent in pre-v2.7 persisted data. */
  datasetSamplingSnapshots?: DatasetSamplingSnapshot[]
  /** Additive local generation / evaluation history; older snapshots omit these. */
  datasetQueries?: DatasetQueryRecord[]
  datasetExecutionRuns?: DatasetExecutionRun[]
  /** Analytical asset catalog; absent in pre-asset-workbench snapshots. */
  assetCatalog?: AssetCatalogEntry[]
  assetVersions?: AssetVersion[]
  assetPerformanceRecords?: AssetPerformanceRecord[]
  assetEvolutionContributions?: AssetEvolutionContribution[]
  governanceEvents?: TraceGovernanceEvent[]
  schemaVersion: number; seedVersion: string; isMockData: true; updatedAt: ISODateTime
  sessions: Session[]; cases: Case[]; traces: Trace[]; observations: ObservationLog[]; evidence: Evidence[]
  artifacts: Artifact[]; processEvals: ProcessEval[]; outcomeEvals: OutcomeEval[]; attributions: Attribution[]
  issues: Issue[]; issueClusters: IssueCluster[]; skills: Skill[]; assets: Asset[]; variants: Variant[]
  datasets: Dataset[]; experiments: Experiment[]; experimentRuns: ExperimentRun[]; windows: Window[]
  gateDecisions: GateDecision[]; releases: ReleaseVersion[]; rules: RuleConfig[]; auditTrail: AuditEvent[]
  /** V2 evaluation ledger and routing entities. */
  evaluationBatches: EvaluationBatch[]
  evaluationJobs: EvaluationJob[]
  tracePackages: TraceEvaluationPackage[]
  evaluationFindings: EvaluationFinding[]
  routingPolicies: RoutingPolicy[]
  routingDecisions: RoutingDecision[]
  routingDeliveries: RoutingDelivery[]
  algorithmBadcases: AlgorithmBadcaseItem[]
  badcaseQueues: BadcaseQueue[]
  tastePreferenceSignals: TastePreferenceSignal[]
}

export type EvolutionEntity = Session | Case | Trace | ObservationLog | Evidence | Artifact | ProcessEval | OutcomeEval
  | Attribution | Issue | IssueCluster | Skill | Asset | Variant | Dataset | Experiment | ExperimentRun
  | Window | GateDecision | ReleaseVersion | RuleConfig | EvaluationBatch | EvaluationJob | TraceEvaluationPackage
  | EvaluationFinding | RoutingPolicy | RoutingDecision | RoutingDelivery | AlgorithmBadcaseItem | BadcaseQueue
  | TastePreferenceSignal | DatasetSamplingSnapshot | DatasetQueryRecord | DatasetExecutionRun | AssetCatalogEntry | AssetVersion | AssetPerformanceRecord | AssetEvolutionContribution
