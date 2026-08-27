export const BUSINESS_TYPES = ['All', 'PPT', 'Excel', 'Word', 'Coding', 'General'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const ENVIRONMENTS = ['Production', 'Staging'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const COMPLEXITIES = ['Simple', 'Medium', 'Complex'] as const
export type Complexity = (typeof COMPLEXITIES)[number]

export const TASK_STATUSES = ['Effective', 'Effective but Inefficient', 'Failed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const OUTCOME_TYPES = ['Information Delivery', 'Content Artifact', 'Operation'] as const
export type OutcomeType = (typeof OUTCOME_TYPES)[number]

export const ROOT_CAUSES = [
  'Task Understanding',
  'Planning / Decision',
  'Context',
  'Memory',
  'Skill Routing',
  'Tool',
  'Loop / Retry',
  'Skill Internal',
  'External Engineering',
  'None'
] as const
export type RootCause = (typeof ROOT_CAUSES)[number]

export const OBSERVATION_NODES = [
  'Task Understanding',
  'Planning / Decision',
  'Memory',
  'Context Assembly',
  'Skill Routing',
  'Skill',
  'Tool',
  'Loop / Retry',
  'Recovery',
  'Final Outcome'
] as const
export type ObservationNode = (typeof OBSERVATION_NODES)[number]

export const RESULT_DIMENSIONS = [
  'Outcome Type Consistency',
  'Intent Consistency',
  'Constraint Satisfaction',
  'Accuracy',
  'Result Usability'
] as const
export type ResultDimension = (typeof RESULT_DIMENSIONS)[number]

export const PROCESS_DIMENSIONS = [
  'Task Understanding',
  'Execution Path',
  'Skill Selection',
  'Tool Selection',
  'Memory Use',
  'Unnecessary Tool Call',
  'Unnecessary Model Call',
  'Redundant Loop',
  'Retry Effectiveness',
  'Recovery Success'
] as const
export type ProcessDimension = (typeof PROCESS_DIMENSIONS)[number]

/**
 * Local judge states used by both result and process evaluations.
 *
 * `EvalStatus` is kept as an alias below because the first version of the
 * demo exposed that name to the page components.  Extending the union rather
 * than replacing it means old PASS/FAIL consumers continue to compile while
 * v2 can represent missing or propagated evidence explicitly.
 */
export const JUDGE_STATUSES = ['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A'] as const
export type JudgeStatus = (typeof JUDGE_STATUSES)[number]
export type EvalStatus = JudgeStatus
export type EvalType = 'Rule' | 'Script' | 'LLM-as-Judge'
export type EvalFamily = 'Result Eval' | 'Process Eval' | 'Performance Metric'
export type CaseStatus = 'Candidate' | 'Confirmed Badcase' | 'Resolved'
export type CaseSource = 'Auto Eval' | 'User Feedback' | 'System Error' | 'Manual Review'
export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type Owner = 'General Agent' | 'PPT' | 'Excel' | 'Word' | 'Tool' | 'Infra'
export type DatasetType = 'Golden Case' | 'Historical Badcase' | 'Challenge Case'
export type BenchmarkStatus = 'Queued' | 'Running' | 'Completed'
export type BenchmarkBucket = 'Improved Cases' | 'Regressed Cases' | 'Unchanged Failed Cases' | 'Newly Failed Cases'

export const PRODUCT_ACCEPTANCE_EVENT_TYPES = [
  'download',
  'copy',
  'like',
  'dislike',
  'accept',
  'correction',
  'regeneration',
  'new_requirement'
] as const
export type ProductAcceptanceEventType = (typeof PRODUCT_ACCEPTANCE_EVENT_TYPES)[number]

export type RiskCommercialEventType = 'risk_interception' | 'commercial_interception'

/** A typed pointer to the observation/rubric material used by a judge. */
export interface RubricEvidence {
  id: string
  evidenceId?: string
  observationId?: string
  kind?: 'Input' | 'Output' | 'Error' | 'User Feedback' | 'Artifact' | 'Rule' | string
  summary: string
  quote?: string
  source?: string
  requirement?: string
}

/** Common v2 judge payload.  EvalResult keeps the legacy auto/human fields. */
export interface JudgeResult {
  status: JudgeStatus
  /** Explicit v2 status; legacy `status` may remain FAIL for derived nodes. */
  judgeStatus?: JudgeStatus
  score: number
  reason: string
  rubricEvidence: RubricEvidence[]
  isRootCause?: boolean
  derivedFrom?: string
  derivedFromObservationId?: string
}

/** A user action observed after a product was delivered. */
export interface ProductAcceptanceEvent {
  id: string
  taskId: string
  type: ProductAcceptanceEventType
  /** `eventType` is an input-compatible alias used by some integrations. */
  eventType?: ProductAcceptanceEventType
  timestamp: string
  sequence?: number
  round?: number
  source?: 'User' | 'System' | 'Mock' | string
  note?: string
  /** True when a correction starts a materially new request. */
  isNewRequirement?: boolean
  metadata?: Record<string, string>
  humanLabel?: ProductAcceptanceEventType
  humanReason?: string
  reviewedBy?: string
  reviewedAt?: string
}

/** Result-level validity and the five hard gates for a qualified product. */
export interface ProductValidity {
  taskId: string
  outcomeType: JudgeStatus
  intentConsistency: JudgeStatus
  constraintSatisfaction: JudgeStatus
  accuracy: JudgeStatus
  fileValidity: JudgeStatus
  /** Legacy display/data name retained for deep links. */
  resultUsability?: JudgeStatus
  qualified: boolean
  score: number
  artifactAvailable?: boolean
  fileOpenable?: boolean
  linkValid?: boolean
  actionExecutable?: boolean
  accuracyBreakdown?: {
    factual?: JudgeStatus
    logical?: JudgeStatus
    evidenceTraceable?: JudgeStatus
    execution?: JudgeStatus
  }
  evidenceIds?: string[]
  reason?: string
  humanOverride?: JudgeStatus
  automaticQualified?: boolean
  automaticScore?: number
  humanQualified?: boolean
  humanScore?: number
  humanReason?: string
  humanBy?: string
  updatedAt?: string
}

export type LatencyEfficiencyBand = '<=1' | '1-1.5' | '1.5-2' | '>2' | 'UNKNOWN'

/** Independent process/efficiency evaluation; it never changes product validity. */
export interface ProcessEfficiency {
  taskId: string
  actualLatencyMs: number
  expectedLatencyMs?: number
  latencyRatio?: number
  latencyBand: LatencyEfficiencyBand
  totalLatencyEfficiency: JudgeStatus
  tokenEfficiency: JudgeStatus
  costEfficiency: JudgeStatus
  necessaryLoop: JudgeStatus
  skillToolSelection: JudgeStatus
  toolResult: JudgeStatus
  retryEffectiveness: JudgeStatus
  recoverySuccess: JudgeStatus
  targetMet: boolean | null
  outOfExpectation: boolean
  score: number
  inputTokens?: number
  outputTokens?: number
  cost?: number
  loopCount?: number
  retryCount?: number
  oneShotSuccess?: boolean | null
  reason?: string
  evidenceIds?: string[]
  humanTargetMet?: boolean | null
  humanStatus?: JudgeStatus
  automaticTargetMet?: boolean | null
  automaticScore?: number
  humanScore?: number
  humanReason?: string
  humanBy?: string
  humanAt?: string
}

/** First non-derived failure and the propagation chain for a trace. */
export interface RootCauseAttribution {
  taskId: string
  traceId: string
  firstFailureNode: ObservationNode | null
  firstFailureObservationId?: string
  rootCause: RootCause
  isRootCause: boolean
  derivedFailureObservationIds: string[]
  derivedFrom?: string
  derivedFromObservationId?: string
  evidenceIds: string[]
}

export interface RiskCommercialEvent {
  id: string
  taskId: string
  type: RiskCommercialEventType
  blocked: boolean
  reason: string
  category?: string
  timestamp: string
  source?: string
}

export interface Evidence {
  id: string
  observationId?: string
  type: 'Input' | 'Output' | 'Error' | 'User Feedback' | 'Artifact'
  summary: string
  source: string
}

export interface Observation {
  id: string
  traceId: string
  sequence: number
  nodeType: ObservationNode
  status: JudgeStatus
  /** Explicit v2 judge state; `status` remains the legacy display state. */
  judgeStatus?: JudgeStatus
  input: string
  output: string
  latency: number
  model?: string
  tool?: string
  tokenUsage?: number
  rootCause?: RootCause
  derived?: boolean
  /** v2 explicit attribution fields; `derived` remains the v1 alias. */
  isRootCause?: boolean
  derivedFrom?: string
  derivedFromObservationId?: string
  score?: number
  reason?: string
  rubricEvidence?: RubricEvidence[]
  judgeResult?: JudgeResult
  error?: string
  metadata: Record<string, string>
  evidenceIds: string[]
  evalResult?: JudgeStatus
}

export interface Trace {
  id: string
  taskId: string
  sessionId: string
  startedAt: string
  totalLatency: number
  observations: Observation[]
}

export interface EvalResult {
  id: string
  taskId: string
  family: EvalFamily
  dimension: string
  autoStatus: JudgeStatus
  autoReason: string
  evidenceIds: string[]
  humanStatus?: JudgeStatus
  humanReason?: string
  humanBy?: string
  humanAt?: string
  judgeVersion: string
  /** v2 normalized fields (the auto/human fields above are retained). */
  score?: number
  reason?: string
  rubricEvidence?: RubricEvidence[]
  isRootCause?: boolean
  derivedFrom?: string
  derivedFromObservationId?: string
  status?: JudgeStatus
  humanScore?: number
  humanRubricEvidence?: RubricEvidence[]
}

export interface Task {
  id: string
  traceId: string
  sessionId: string
  query: string
  businessType: Exclude<BusinessType, 'All'>
  complexity: Complexity
  agentVersion: string
  environment: Environment
  status: TaskStatus
  outcomeType: OutcomeType
  rootCause: RootCause
  latency: number
  cost: number
  tokens: number
  modelCalls: number
  toolCalls: number
  loopCount: number
  retryCount: number
  timestamp: string
  skill: string
  finalOutcome: string
  evals: EvalResult[]
  processEvals: EvalResult[]
  isBadcase: boolean
  isGolden: boolean
  caseId?: string
  /** v2 normalized product and process records. */
  acceptanceEvents?: ProductAcceptanceEvent[]
  productValidity?: ProductValidity
  processEfficiency?: ProcessEfficiency
  rootCauseAttribution?: RootCauseAttribution
  riskCommercialEvents?: RiskCommercialEvent[]
  /** Raw performance values are optional for older imported fixtures. */
  performance?: TaskPerformance
}

export interface TaskPerformance {
  actualLatencyMs: number
  expectedLatencyMs?: number
  ttftMs?: number
  inputTokens?: number
  outputTokens?: number
  cacheHit?: boolean
  cacheHitRate?: number
  toolCallFrequency?: number
  oneShotToolSuccess?: boolean | null
  throughputTokensPerSecond?: number
  costDeviation?: number
  modelVersion?: string
}

export interface CaseRecord {
  id: string
  taskId: string
  traceId: string
  query: string
  status: CaseStatus
  source: CaseSource
  failureDimension: string
  firstFailureNode: ObservationNode | null
  rootCause: RootCause
  derivedFailure: boolean
  severity: Severity
  owner: Owner
  note: string
  autoStatus: JudgeStatus
  humanStatus?: JudgeStatus
  autoReason: string
  humanReason?: string
  updatedAt: string
  score?: number
  rubricEvidence?: RubricEvidence[]
  firstFailureObservationId?: string
  derivedFrom?: string
  derivedFromObservationId?: string
  acceptanceEventIds?: string[]
}

export interface DatasetEntry {
  id: string
  datasetId: string
  taskId: string
  caseId?: string
  query: string
  type: DatasetType
  outcomeType: OutcomeType
  complexity: Complexity
  capabilityTags: string[]
  expectedResult: string
  constraints: string
  expectedProcess?: string
  goldenLabel: JudgeStatus
  rootCause: RootCause
  sourceTraceId: string
  version: string
  enabled: boolean
  history: Array<{ version: string; changedAt: string; summary: string }>
  fileValidity?: JudgeStatus
  expectedOutcome?: string
  expectedConstraint?: string
  acceptanceLabel?: JudgeStatus
}

export interface Dataset {
  id: string
  name: string
  description: string
  version: string
  type: DatasetType
  entries: DatasetEntry[]
  updatedAt: string
}

export interface BenchmarkMetric {
  id: string
  label: string
  family: EvalFamily
  unit: 'percent' | 'pp' | 'duration'
  versionA: number
  versionB: number
  delta: number
  sourceTaskIds: string[]
}

export interface BenchmarkCaseResult {
  id: string
  taskId: string
  bucket: BenchmarkBucket
  reason: string
  traceAId?: string
  traceBId?: string
}

export interface BenchmarkRun {
  id: string
  datasetId: string
  datasetVersion: string
  versionA: string
  versionB: string
  environment: Environment
  rubricVersion: string
  status: BenchmarkStatus
  createdAt: string
  completedAt?: string
  metrics: BenchmarkMetric[]
  caseResults: BenchmarkCaseResult[]
}

export interface EvalConfig {
  id: string
  family: EvalFamily
  dimension: string
  evalType: EvalType
  rubricVersion: string
  enabled: boolean
  threshold: number
  prompt?: string
  evidenceRequirement?: string
  judgeVersion?: string
  description: string
}

export interface FilterState {
  timeRange: '24h' | '7d' | '14d' | '30d'
  agentVersion: string
  businessType: BusinessType
  environment: Environment
  search: string
  status?: TaskStatus | 'PASS' | 'FAIL'
  outcomeType?: OutcomeType
  complexity?: Complexity
  rootCause?: RootCause
  skill?: string
  badcase?: 'yes' | 'no'
  golden?: 'yes' | 'no'
  metric?: string
  anomalyTool?: string
  anomalyWindow?: string
  acceptanceSignal?: ProductAcceptanceEventType | 'first_accept' | 'final_accept' | 'repeat_correction' | 'negative_feedback'
  validity?: JudgeStatus
  processStatus?: JudgeStatus | 'out_of_expectation'
  benchmarkId?: string
}

export interface QualityData {
  tasks: Task[]
  traces: Trace[]
  observations: Observation[]
  evidence: Evidence[]
  cases: CaseRecord[]
  datasets: Dataset[]
  benchmarks: BenchmarkRun[]
  evalConfigs: EvalConfig[]
  updatedAt: string
  /** Normalized v2 collections. They are optional for backwards-compatible imports. */
  acceptanceEvents?: ProductAcceptanceEvent[]
  productValidities?: ProductValidity[]
  processEfficiencies?: ProcessEfficiency[]
  rootCauseAttributions?: RootCauseAttribution[]
  riskCommercialEvents?: RiskCommercialEvent[]
}

export interface QualityState extends QualityData {
  filters: FilterState
}
