import type { EvolutionState } from '../domain'

export interface EvolutionValidationError { path: string; message: string }
const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id))

export function validateEvolutionState(state: EvolutionState): EvolutionValidationError[] {
  const errors: EvolutionValidationError[] = []
  const requireId = (known: Set<string>, id: string, path: string) => { if (!known.has(id)) errors.push({ path, message: `Missing reference: ${id}` }) }
  const caseIds = ids(state.cases); const sessionIds = ids(state.sessions); const traceIds = ids(state.traces)
  const observationIds = ids(state.observations); const artifactIds = ids(state.artifacts); const evidenceIds = ids(state.evidence)
  const processEvalIds = ids(state.processEvals); const outcomeEvalIds = ids(state.outcomeEvals); const attributionIds = ids(state.attributions)
  const issueIds = ids(state.issues); const clusterIds = ids(state.issueClusters); const variantIds = ids(state.variants)
  const datasetIds = ids(state.datasets); const experimentIds = ids(state.experiments); const runIds = ids(state.experimentRuns)
  const windowIds = ids(state.windows); const decisionIds = ids(state.gateDecisions); const releaseIds = ids(state.releases)
  const skillIds = ids(state.skills); const assetIds = ids(state.assets); const ruleIds = ids(state.rules)

  state.cases.forEach((item) => {
    requireId(sessionIds, item.sessionId, `cases.${item.id}.sessionId`)
    item.traceIds.forEach((id, index) => requireId(traceIds, id, `cases.${item.id}.traceIds.${index}`))
    item.artifactIds.forEach((id, index) => requireId(artifactIds, id, `cases.${item.id}.artifactIds.${index}`))
    item.skillIds.forEach((id, index) => requireId(skillIds, id, `cases.${item.id}.skillIds.${index}`))
    item.processEvalIds.forEach((id, index) => requireId(processEvalIds, id, `cases.${item.id}.processEvalIds.${index}`))
    item.outcomeEvalIds.forEach((id, index) => requireId(outcomeEvalIds, id, `cases.${item.id}.outcomeEvalIds.${index}`))
    item.attributionIds.forEach((id, index) => requireId(attributionIds, id, `cases.${item.id}.attributionIds.${index}`))
    item.issueIds.forEach((id, index) => requireId(issueIds, id, `cases.${item.id}.issueIds.${index}`))
  })
  state.traces.forEach((item) => {
    requireId(caseIds, item.caseId, `traces.${item.id}.caseId`); requireId(sessionIds, item.sessionId, `traces.${item.id}.sessionId`)
    item.observationIds.forEach((id, index) => requireId(observationIds, id, `traces.${item.id}.observationIds.${index}`))
    item.artifactIds.forEach((id, index) => requireId(artifactIds, id, `traces.${item.id}.artifactIds.${index}`))
    if (!item.telemetry || item.telemetry.totalLatencyMs !== item.totalLatencyMs || item.telemetry.inputTokens !== item.inputTokens || item.telemetry.outputTokens !== item.outputTokens) errors.push({ path: `traces.${item.id}.telemetry`, message: 'Telemetry totals must match the canonical Trace totals' })
    else {
      if (item.telemetry.cacheHitCount < 0 || item.telemetry.cacheRequestCount < item.telemetry.cacheHitCount) errors.push({ path: `traces.${item.id}.telemetry.cacheHitCount`, message: 'Cache hits must be between zero and cache requests' })
      if (item.telemetry.toolOneShotSuccessCount < 0 || item.telemetry.toolExecutionCount < item.telemetry.toolOneShotSuccessCount) errors.push({ path: `traces.${item.id}.telemetry.toolOneShotSuccessCount`, message: 'One-shot successes cannot exceed tool executions' })
      for (const [key, value] of Object.entries(item.telemetry)) if (typeof value === 'number' && value < 0 && !key.endsWith('CostDeviationRate')) errors.push({ path: `traces.${item.id}.telemetry.${key}`, message: 'Telemetry counters cannot be negative' })
    }
  })
  state.observations.forEach((item) => {
    requireId(traceIds, item.traceId, `observations.${item.id}.traceId`); requireId(caseIds, item.caseId, `observations.${item.id}.caseId`)
    if (item.skillId) requireId(skillIds, item.skillId, `observations.${item.id}.skillId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `observations.${item.id}.evidenceIds.${index}`))
  })
  state.evidence.forEach((item) => {
    requireId(caseIds, item.caseId, `evidence.${item.id}.caseId`)
    if (item.traceId) requireId(traceIds, item.traceId, `evidence.${item.id}.traceId`)
    if (item.observationId) requireId(observationIds, item.observationId, `evidence.${item.id}.observationId`)
    if (item.artifactId) requireId(artifactIds, item.artifactId, `evidence.${item.id}.artifactId`)
  })
  state.artifacts.forEach((item) => {
    requireId(caseIds, item.caseId, `artifacts.${item.id}.caseId`); requireId(traceIds, item.traceId, `artifacts.${item.id}.traceId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `artifacts.${item.id}.evidenceIds.${index}`))
  })
  state.processEvals.forEach((item) => {
    requireId(caseIds, item.caseId, `processEvals.${item.id}.caseId`); requireId(traceIds, item.traceId, `processEvals.${item.id}.traceId`)
    requireId(observationIds, item.observationId, `processEvals.${item.id}.observationId`)
    if (item.failedNodeId) requireId(observationIds, item.failedNodeId, `processEvals.${item.id}.failedNodeId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `processEvals.${item.id}.evidenceIds.${index}`))
    item.revisions.forEach((revision) => revision.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `processEvals.${item.id}.revisions.${revision.id}.evidenceIds.${index}`)))
  })
  state.outcomeEvals.forEach((item) => {
    requireId(caseIds, item.caseId, `outcomeEvals.${item.id}.caseId`); requireId(traceIds, item.traceId, `outcomeEvals.${item.id}.traceId`)
    requireId(artifactIds, item.artifactId, `outcomeEvals.${item.id}.artifactId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `outcomeEvals.${item.id}.evidenceIds.${index}`))
    item.revisions.forEach((revision) => revision.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `outcomeEvals.${item.id}.revisions.${revision.id}.evidenceIds.${index}`)))
  })
  state.attributions.forEach((item) => {
    requireId(caseIds, item.caseId, `attributions.${item.id}.caseId`); requireId(traceIds, item.traceId, `attributions.${item.id}.traceId`)
    if (item.observationId) requireId(observationIds, item.observationId, `attributions.${item.id}.observationId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `attributions.${item.id}.evidenceIds.${index}`))
    item.revisions.forEach((revision) => revision.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `attributions.${item.id}.revisions.${revision.id}.evidenceIds.${index}`)))
  })
  state.issues.forEach((item) => {
    requireId(caseIds, item.caseId, `issues.${item.id}.caseId`)
    requireId(attributionIds, item.attributionId, `issues.${item.id}.attributionId`)
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `issues.${item.id}.evidenceIds.${index}`))
    item.clusterIds.forEach((id, index) => requireId(clusterIds, id, `issues.${item.id}.clusterIds.${index}`))
    item.variantIds.forEach((id, index) => requireId(variantIds, id, `issues.${item.id}.variantIds.${index}`))
    const attribution = state.attributions.find((candidate) => candidate.id === item.attributionId)
    if (attribution && attribution.caseId !== item.caseId) errors.push({ path: `issues.${item.id}.attributionId`, message: `Attribution ${item.attributionId} belongs to a different Case` })
    const sourceCase = state.cases.find((candidate) => candidate.id === item.caseId)
    if (sourceCase && !sourceCase.issueIds.includes(item.id)) errors.push({ path: `cases.${sourceCase.id}.issueIds`, message: `Case must reciprocally reference Issue ${item.id}` })
    item.clusterIds.forEach((clusterId) => { const cluster = state.issueClusters.find((candidate) => candidate.id === clusterId); if (cluster && !cluster.issueIds.includes(item.id)) errors.push({ path: `issues.${item.id}.clusterIds`, message: `Issue cluster link ${clusterId} is not reciprocal` }) })
    item.variantIds.forEach((variantId) => { const variant = state.variants.find((candidate) => candidate.id === variantId); if (variant && !variant.sourceIssueIds.includes(item.id)) errors.push({ path: `issues.${item.id}.variantIds`, message: `Issue Variant link ${variantId} is not reciprocal` }) })
    item.processingChains?.forEach((chain, index) => {
      if (!item.routingLabels.includes(chain.routingLabel)) errors.push({ path: `issues.${item.id}.processingChains.${index}.routingLabel`, message: 'Processing chain must correspond to an issue routing label' })
      if (chain.destinationType === 'ISSUE_CLUSTER' && chain.destinationId) requireId(clusterIds, chain.destinationId, `issues.${item.id}.processingChains.${index}.destinationId`)
      if ((chain.destinationType === 'DIRECT_FIX' || chain.destinationType === 'AGENT_BACKLOG') && chain.destinationId) requireId(variantIds, chain.destinationId, `issues.${item.id}.processingChains.${index}.destinationId`)
    })
  })
  state.issueClusters.forEach((item) => {
    item.caseIds.forEach((id, index) => requireId(caseIds, id, `issueClusters.${item.id}.caseIds.${index}`))
    item.issueIds.forEach((id, index) => requireId(issueIds, id, `issueClusters.${item.id}.issueIds.${index}`))
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `issueClusters.${item.id}.evidenceIds.${index}`))
    item.variantIds.forEach((id, index) => requireId(variantIds, id, `issueClusters.${item.id}.variantIds.${index}`))
    if (item.triggerRuleId) requireId(ruleIds, item.triggerRuleId, `issueClusters.${item.id}.triggerRuleId`)
    item.issueIds.forEach((id) => {
      const issue = state.issues.find((candidate) => candidate.id === id)
      if (issue && !item.caseIds.includes(issue.caseId)) errors.push({ path: `issueClusters.${item.id}.issueIds`, message: `Issue ${id} belongs to Case ${issue.caseId}, which is absent from the cluster` })
      if (issue && !issue.clusterIds.includes(item.id)) errors.push({ path: `issues.${issue.id}.clusterIds`, message: `Issue must reciprocally reference Cluster ${item.id}` })
    })
    item.variantIds.forEach((id) => { const variant = state.variants.find((candidate) => candidate.id === id); if (variant && !variant.sourceClusterIds.includes(item.id)) errors.push({ path: `issueClusters.${item.id}.variantIds`, message: `Cluster Variant link ${id} is not reciprocal` }) })
  })
  state.variants.forEach((item) => {
    item.sourceCaseIds.forEach((id, index) => requireId(caseIds, id, `variants.${item.id}.sourceCaseIds.${index}`))
    item.sourceIssueIds.forEach((id, index) => requireId(issueIds, id, `variants.${item.id}.sourceIssueIds.${index}`))
    item.sourceClusterIds.forEach((id, index) => requireId(clusterIds, id, `variants.${item.id}.sourceClusterIds.${index}`))
    item.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `variants.${item.id}.evidenceIds.${index}`))
    item.experimentIds.forEach((id, index) => requireId(experimentIds, id, `variants.${item.id}.experimentIds.${index}`))
    item.sourceIssueIds.forEach((id) => { const issue = state.issues.find((candidate) => candidate.id === id); if (issue && !issue.variantIds.includes(item.id)) errors.push({ path: `issues.${issue.id}.variantIds`, message: `Issue must reciprocally reference Variant ${item.id}` }) })
    item.sourceClusterIds.forEach((id) => { const cluster = state.issueClusters.find((candidate) => candidate.id === id); if (cluster && !cluster.variantIds.includes(item.id)) errors.push({ path: `issueClusters.${cluster.id}.variantIds`, message: `Cluster must reciprocally reference Variant ${item.id}` }) })
  })
  state.sessions.forEach((item) => {
    item.caseIds.forEach((id, index) => requireId(caseIds, id, `sessions.${item.id}.caseIds.${index}`)); item.traceIds.forEach((id, index) => requireId(traceIds, id, `sessions.${item.id}.traceIds.${index}`))
    item.turns.forEach((turn, index) => {
      requireId(caseIds, turn.caseId, `sessions.${item.id}.turns.${index}.caseId`); requireId(traceIds, turn.traceId, `sessions.${item.id}.turns.${index}.traceId`)
      const trace = state.traces.find((candidate) => candidate.id === turn.traceId)
      if (trace && (trace.sessionId !== item.id || trace.caseId !== turn.caseId)) errors.push({ path: `sessions.${item.id}.turns.${index}.traceId`, message: 'Session turn Trace must belong to its Session and Case' })
      if (turn.sequence !== index + 1) errors.push({ path: `sessions.${item.id}.turns.${index}.sequence`, message: 'Session turns must have contiguous ordered sequence numbers' })
    })
  })
  state.skills.forEach((item) => { item.evolutionRecordIds.forEach((id, index) => requireId(variantIds, id, `skills.${item.id}.evolutionRecordIds.${index}`)); item.assetIds.forEach((id, index) => requireId(assetIds, id, `skills.${item.id}.assetIds.${index}`)) })
  state.assets.forEach((item) => item.skillIds.forEach((id, index) => requireId(skillIds, id, `assets.${item.id}.skillIds.${index}`)))
  state.datasets.forEach((item) => {
    item.caseIds.forEach((id, index) => requireId(caseIds, id, `datasets.${item.id}.caseIds.${index}`))
    if (!item.population || item.population.totalSampleCount !== item.sampleCount || item.population.localCaseCount !== item.caseIds.length || item.population.externalSampleCount + item.population.localCaseCount !== item.population.totalSampleCount || !item.population.sourceSystem.trim() || !item.population.countingRule.trim()) errors.push({ path: `datasets.${item.id}.population`, message: 'Dataset population must explicitly reconcile local and external samples' })
  })
  state.experiments.forEach((item) => {
    item.variantIds.forEach((id, index) => requireId(variantIds, id, `experiments.${item.id}.variantIds.${index}`))
    item.datasetIds.forEach((id, index) => requireId(datasetIds, id, `experiments.${item.id}.datasetIds.${index}`))
    if (item.windowId) requireId(windowIds, item.windowId, `experiments.${item.id}.windowId`)
    item.runIds.forEach((id, index) => requireId(runIds, id, `experiments.${item.id}.runIds.${index}`))
    if (item.gateDecisionId) requireId(decisionIds, item.gateDecisionId, `experiments.${item.id}.gateDecisionId`)
    item.configSnapshot.datasetVersions.forEach((entry, index) => {
      requireId(datasetIds, entry.datasetId, `experiments.${item.id}.configSnapshot.datasetVersions.${index}.datasetId`)
      if (entry.versionId !== `${entry.datasetId}@${entry.version}` || !entry.version.trim() || entry.sampleCount < 0) errors.push({ path: `experiments.${item.id}.configSnapshot.datasetVersions.${index}`, message: 'Experiment Dataset version identity and snapshot values must be internally consistent' })
    })
    item.failedCaseIds.forEach((id, index) => requireId(caseIds, id, `experiments.${item.id}.failedCaseIds.${index}`))
    const linkedRuns = state.experimentRuns.filter((run) => run.experimentId === item.id)
    const unrunAllowed = ['DRAFT', 'QUEUED'].includes(item.status) && linkedRuns.length === 0 && item.runIds.length === 0 && !item.gateDecisionId
    const runnableMatrix = linkedRuns.length > 0 && [...new Set(linkedRuns.map((run) => run.caseId))].every((caseId) =>
      (['BASELINE', 'CANDIDATE'] as const).every((arm) => {
        const armRuns = linkedRuns.filter((run) => run.caseId === caseId && run.arm === arm)
        return armRuns.length === item.configSnapshot.repeatCount && new Set(armRuns.map((run) => run.repetition)).size === item.configSnapshot.repeatCount
      })
    ) && new Set(linkedRuns.map((run) => run.configHash)).size === 1 && new Set(item.runIds).size === linkedRuns.length && item.runIds.every((id) => linkedRuns.some((run) => run.id === id))
    if (!unrunAllowed && !runnableMatrix) errors.push({ path: `experiments.${item.id}.runMatrix`, message: 'Unrun DRAFT/QUEUED experiments need zero runs; started experiments need paired arms with the configured repetition count' })
    if (['DRAFT', 'QUEUED'].includes(item.status) && (linkedRuns.length > 0 || item.runIds.length > 0)) errors.push({ path: `experiments.${item.id}.runMatrix`, message: 'DRAFT/QUEUED experiments cannot contain generated runs' })
    if (item.status === 'COMPLETED' && linkedRuns.some((run) => run.status !== 'COMPLETED')) errors.push({ path: `experiments.${item.id}.runMatrix`, message: 'A completed experiment cannot contain unfinished runs' })
    if (item.status === 'RUNNING' && linkedRuns.some((run) => run.status !== 'RUNNING')) errors.push({ path: `experiments.${item.id}.runMatrix`, message: 'A running experiment must contain running runs' })
    if (item.status === 'FAILED' && linkedRuns.some((run) => run.status !== 'FAILED')) errors.push({ path: `experiments.${item.id}.runMatrix`, message: 'A failed experiment must contain failed runs' })
    if (item.gateDecisionId && !['COMPLETED', 'DECIDED'].includes(item.status)) errors.push({ path: `experiments.${item.id}.gateDecisionId`, message: 'Only a completed experiment can have a gate decision' })
    const selectedDatasets = item.datasetIds.map((id) => state.datasets.find((dataset) => dataset.id === id))
    if (selectedDatasets.some((dataset) => !dataset?.frozen)) errors.push({ path: `experiments.${item.id}.datasetIds`, message: 'Experiments may use only frozen Dataset versions' })
    const snapshotCoversSelections = new Set(item.configSnapshot.datasetVersions.map((entry) => entry.datasetId)).size === item.datasetIds.length && item.datasetIds.every((id) => item.configSnapshot.datasetVersions.some((entry) => entry.datasetId === id))
    if (!snapshotCoversSelections) errors.push({ path: `experiments.${item.id}.configSnapshot.datasetVersions`, message: 'Experiment Dataset snapshot must identify every selected Dataset exactly once' })
    if (item.level === 'WINDOW_COMBINATION') {
      const window = state.windows.find((candidate) => candidate.id === item.windowId)
      if (window && JSON.stringify([...window.candidateVariantIds].sort()) !== JSON.stringify([...item.variantIds].sort())) errors.push({ path: `experiments.${item.id}.variantIds`, message: 'Combination membership must exactly match the selected Window' })
      item.variantIds.forEach((id) => {
      const singlePassed = state.experiments.some((candidate) => candidate.level === 'SINGLE_VARIANT' && candidate.variantIds.includes(id) && candidate.gateDecisionId && state.gateDecisions.find((decision) => decision.id === candidate.gateDecisionId)?.conclusion === 'PASS')
      if (!singlePassed) errors.push({ path: `experiments.${item.id}.variantIds`, message: `Variant ${id} entered a window without a passing single experiment` })
      })
    }
  })
  state.experimentRuns.forEach((item) => { requireId(experimentIds, item.experimentId, `experimentRuns.${item.id}.experimentId`); requireId(caseIds, item.caseId, `experimentRuns.${item.id}.caseId`) })
  state.windows.forEach((item) => {
    item.candidateVariantIds.forEach((id, index) => requireId(variantIds, id, `windows.${item.id}.candidateVariantIds.${index}`))
    item.singleExperimentIds.forEach((id, index) => requireId(experimentIds, id, `windows.${item.id}.singleExperimentIds.${index}`))
    if (item.combinationExperimentId) {
      requireId(experimentIds, item.combinationExperimentId, `windows.${item.id}.combinationExperimentId`)
      const combination = state.experiments.find((experiment) => experiment.id === item.combinationExperimentId)
      if (combination && (combination.windowId !== item.id || JSON.stringify([...combination.variantIds].sort()) !== JSON.stringify([...item.candidateVariantIds].sort()))) errors.push({ path: `windows.${item.id}.candidateVariantIds`, message: 'Window membership must exactly match its combination experiment variants' })
    }
  })
  state.gateDecisions.forEach((item) => {
    requireId(experimentIds, item.experimentId, `gateDecisions.${item.id}.experimentId`)
    item.reportSnapshot.variantIds.forEach((id, index) => requireId(variantIds, id, `gateDecisions.${item.id}.reportSnapshot.variantIds.${index}`))
    item.reportSnapshot.datasetVersions.forEach((entry, index) => requireId(datasetIds, entry.datasetId, `gateDecisions.${item.id}.reportSnapshot.datasetVersions.${index}.datasetId`))
    const experiment = state.experiments.find((candidate) => candidate.id === item.experimentId)
    const snapshot = item.reportSnapshot
    if (experiment) {
      if (!['COMPLETED', 'DECIDED'].includes(experiment.status)) errors.push({ path: `gateDecisions.${item.id}.experimentId`, message: 'Gate decisions require completed experiments' })
      if (snapshot.experimentId !== experiment.id) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.experimentId`, message: 'Report snapshot must identify its experiment' })
      if (JSON.stringify(snapshot.configSnapshot) !== JSON.stringify(experiment.configSnapshot)) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.configSnapshot`, message: 'Report must freeze the experiment configuration' })
      if (!snapshot.runSnapshots || new Set(snapshot.runSnapshots.map((run) => run.id)).size !== experiment.runIds.length || !experiment.runIds.every((id) => snapshot.runSnapshots?.some((run) => run.id === id))) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.runSnapshots`, message: 'Report must freeze every experiment run' })
      ;(snapshot.runSnapshots ?? []).forEach((run, index) => { requireId(runIds, run.id, `gateDecisions.${item.id}.reportSnapshot.runSnapshots.${index}.id`); requireId(caseIds, run.caseId, `gateDecisions.${item.id}.reportSnapshot.runSnapshots.${index}.caseId`) })
      if (JSON.stringify(snapshot.failedCaseIds) !== JSON.stringify(experiment.failedCaseIds)) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.failedCaseIds`, message: 'Report must freeze failed Cases' })
      if (JSON.stringify(snapshot.rollbackItems) !== JSON.stringify(experiment.rollbackItems)) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.rollbackItems`, message: 'Report must freeze rollback items' })
      if (JSON.stringify(snapshot.knownRisks) !== JSON.stringify(experiment.knownRisks)) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.knownRisks`, message: 'Report must freeze known risks' })
      if (!snapshot.evidenceIds?.length) errors.push({ path: `gateDecisions.${item.id}.reportSnapshot.evidenceIds`, message: 'Gate report needs auditable Evidence' })
      snapshot.evidenceIds?.forEach((id, index) => requireId(evidenceIds, id, `gateDecisions.${item.id}.reportSnapshot.evidenceIds.${index}`))
    }
  })
  state.releases.forEach((item) => {
    requireId(windowIds, item.windowId, `releases.${item.id}.windowId`)
    requireId(experimentIds, item.combinationExperimentId, `releases.${item.id}.combinationExperimentId`)
    requireId(decisionIds, item.gateDecisionId, `releases.${item.id}.gateDecisionId`)
    item.variantIds.forEach((id, index) => requireId(variantIds, id, `releases.${item.id}.variantIds.${index}`))
    if (item.rollbackVersionId) requireId(releaseIds, item.rollbackVersionId, `releases.${item.id}.rollbackVersionId`)
    const experiment = state.experiments.find((candidate) => candidate.id === item.combinationExperimentId)
    const window = state.windows.find((candidate) => candidate.id === item.windowId)
    const decision = state.gateDecisions.find((candidate) => candidate.id === item.gateDecisionId)
    if (experiment && experiment.level !== 'WINDOW_COMBINATION') errors.push({ path: `releases.${item.id}.combinationExperimentId`, message: 'A release must reference a window combination experiment' })
    if (experiment && JSON.stringify([...experiment.variantIds].sort()) !== JSON.stringify([...item.variantIds].sort())) errors.push({ path: `releases.${item.id}.variantIds`, message: 'Release variants must exactly match the frozen combination experiment membership' })
    if (window && JSON.stringify([...window.candidateVariantIds].sort()) !== JSON.stringify([...item.variantIds].sort())) errors.push({ path: `releases.${item.id}.variantIds`, message: 'Release variants must exactly match the source window membership' })
    if (decision && decision.experimentId !== item.combinationExperimentId) errors.push({ path: `releases.${item.id}.gateDecisionId`, message: `Gate decision ${decision.id} does not belong to the release experiment` })
    if (window && window.combinationExperimentId !== item.combinationExperimentId) errors.push({ path: `releases.${item.id}.combinationExperimentId`, message: 'Release experiment must be the exact combination report declared by its Window' })
    if (experiment && experiment.windowId !== item.windowId) errors.push({ path: `releases.${item.id}.windowId`, message: 'Release Window must match its combination experiment Window' })
    const passedSingleVariantIds = window?.singleExperimentIds.flatMap((id) => { const single = state.experiments.find((candidate) => candidate.id === id && candidate.level === 'SINGLE_VARIANT'); const passed = single?.gateDecisionId && state.gateDecisions.some((gate) => gate.id === single.gateDecisionId && gate.conclusion === 'PASS'); return passed ? single!.variantIds : [] }) ?? []
    if (window && item.variantIds.some((id) => !passedSingleVariantIds.includes(id))) errors.push({ path: `releases.${item.id}.variantIds`, message: 'Every released Variant needs a passing single report declared by the Window' })
  })
  state.issueClusters.forEach((cluster) => {
    if (cluster.triggerRuleId === 'rule-taste-100' && cluster.threshold !== undefined && cluster.currentCount < cluster.threshold && (cluster.variantIds.length > 0 || cluster.status !== 'COLLECTING')) errors.push({ path: `issueClusters.${cluster.id}.threshold`, message: 'Taste-library clusters cannot advance before 100 related Cases' })
  })
  const batchIds = ids(state.evaluationBatches); const jobIdsV2 = ids(state.evaluationJobs); const packageIds = ids(state.tracePackages)
  const findingIdsV2 = ids(state.evaluationFindings); const policyIds = ids(state.routingPolicies); const decisionIdsV2 = ids(state.routingDecisions)
  const deliveryIdsV2 = ids(state.routingDeliveries); const badcaseIdsV2 = ids(state.algorithmBadcases); const queueIds = ids(state.badcaseQueues)
  const logIds = new Set(state.observations.map((item) => item.logId))
  const validateBundle = (bundle: { rootEvidenceIds?: string[]; observationIds?: string[]; logIds?: string[] }, path: string) => {
    bundle.rootEvidenceIds?.forEach((id, index) => requireId(evidenceIds, id, `${path}.rootEvidenceIds.${index}`))
    bundle.observationIds?.forEach((id, index) => requireId(observationIds, id, `${path}.observationIds.${index}`))
    bundle.logIds?.forEach((id, index) => { if (!logIds.has(id)) errors.push({ path: `${path}.logIds.${index}`, message: `Missing Log reference: ${id}` }) })
  }
  state.evaluationBatches.forEach((batch) => { batch.traceIds.forEach((id, index) => requireId(traceIds, id, `evaluationBatches.${batch.id}.traceIds.${index}`)); batch.packageIds.forEach((id, index) => requireId(packageIds, id, `evaluationBatches.${batch.id}.packageIds.${index}`)); batch.jobIds.forEach((id, index) => requireId(jobIdsV2, id, `evaluationBatches.${batch.id}.jobIds.${index}`)); if (batch.stats.inputTraceCount !== batch.traceIds.length) errors.push({ path: `evaluationBatches.${batch.id}.stats.inputTraceCount`, message: 'Batch input count must equal Trace IDs' }) })
  state.evaluationJobs.forEach((job) => { requireId(batchIds, job.batchId, `evaluationJobs.${job.id}.batchId`); job.traceIds.forEach((id, index) => requireId(traceIds, id, `evaluationJobs.${job.id}.traceIds.${index}`)); job.processedTraceIds.forEach((id, index) => requireId(traceIds, id, `evaluationJobs.${job.id}.processedTraceIds.${index}`)); job.failedTraceIds.forEach((id, index) => requireId(traceIds, id, `evaluationJobs.${job.id}.failedTraceIds.${index}`)) })
  state.tracePackages.forEach((pkg) => { requireId(batchIds, pkg.batchId, `tracePackages.${pkg.id}.batchId`); requireId(caseIds, pkg.caseId, `tracePackages.${pkg.id}.caseId`); requireId(sessionIds, pkg.sessionId, `tracePackages.${pkg.id}.sessionId`); requireId(traceIds, pkg.traceId, `tracePackages.${pkg.id}.traceId`); pkg.findingIds.forEach((id, index) => requireId(findingIdsV2, id, `tracePackages.${pkg.id}.findingIds.${index}`)); pkg.routingDecisionIds.forEach((id, index) => requireId(decisionIdsV2, id, `tracePackages.${pkg.id}.routingDecisionIds.${index}`)); pkg.routingDeliveryIds.forEach((id, index) => requireId(deliveryIdsV2, id, `tracePackages.${pkg.id}.routingDeliveryIds.${index}`)); pkg.badcaseIds.forEach((id, index) => requireId(badcaseIdsV2, id, `tracePackages.${pkg.id}.badcaseIds.${index}`)); pkg.moduleScores.forEach((score) => { requireId(packageIds, score.packageId, `tracePackages.${pkg.id}.moduleScores.${score.id}.packageId`); validateBundle(score.evidence, `tracePackages.${pkg.id}.moduleScores.${score.id}.evidence`) }) })
  state.evaluationFindings.forEach((finding) => { requireId(packageIds, finding.packageId, `evaluationFindings.${finding.id}.packageId`); requireId(batchIds, finding.batchId, `evaluationFindings.${finding.id}.batchId`); requireId(caseIds, finding.caseId, `evaluationFindings.${finding.id}.caseId`); requireId(traceIds, finding.traceId, `evaluationFindings.${finding.id}.traceId`); finding.routingDecisionIds.forEach((id, index) => requireId(decisionIdsV2, id, `evaluationFindings.${finding.id}.routingDecisionIds.${index}`)); finding.routingDeliveryIds.forEach((id, index) => requireId(deliveryIdsV2, id, `evaluationFindings.${finding.id}.routingDeliveryIds.${index}`)); validateBundle(finding.evidenceBundle, `evaluationFindings.${finding.id}.evidenceBundle`) })
  state.routingPolicies.forEach((policy) => { if (!policy.outputLabel || !policy.destination) errors.push({ path: `routingPolicies.${policy.id}`, message: 'Routing policy must declare label and destination' }) })
  state.routingDecisions.forEach((decision) => { requireId(findingIdsV2, decision.findingId, `routingDecisions.${decision.id}.findingId`); requireId(packageIds, decision.packageId, `routingDecisions.${decision.id}.packageId`); requireId(policyIds, decision.policyId, `routingDecisions.${decision.id}.policyId`); decision.deliveryIds.forEach((id, index) => requireId(deliveryIdsV2, id, `routingDecisions.${decision.id}.deliveryIds.${index}`)) })
  state.routingDeliveries.forEach((delivery) => { requireId(findingIdsV2, delivery.findingId, `routingDeliveries.${delivery.id}.findingId`); requireId(decisionIdsV2, delivery.decisionId, `routingDeliveries.${delivery.id}.decisionId`); requireId(packageIds, delivery.packageId, `routingDeliveries.${delivery.id}.packageId`); requireId(caseIds, delivery.caseId, `routingDeliveries.${delivery.id}.caseId`); if (delivery.queueId) requireId(queueIds, delivery.queueId, `routingDeliveries.${delivery.id}.queueId`) })
  state.algorithmBadcases.forEach((badcase) => { requireId(findingIdsV2, badcase.findingId, `algorithmBadcases.${badcase.id}.findingId`); requireId(packageIds, badcase.packageId, `algorithmBadcases.${badcase.id}.packageId`); requireId(deliveryIdsV2, badcase.deliveryId, `algorithmBadcases.${badcase.id}.deliveryId`); requireId(queueIds, badcase.queueId, `algorithmBadcases.${badcase.id}.queueId`); badcase.sourceEvidenceIds.forEach((id, index) => requireId(evidenceIds, id, `algorithmBadcases.${badcase.id}.sourceEvidenceIds.${index}`)) })
  state.badcaseQueues.forEach((queue) => { queue.itemIds.forEach((id, index) => requireId(badcaseIdsV2, id, `badcaseQueues.${queue.id}.itemIds.${index}`)); queue.deliveryIds.forEach((id, index) => requireId(deliveryIdsV2, id, `badcaseQueues.${queue.id}.deliveryIds.${index}`)) })
  state.tastePreferenceSignals.forEach((signal) => {
    requireId(skillIds, signal.skillId, `tastePreferenceSignals.${signal.id}.skillId`)
    signal.caseIds.forEach((id, index) => requireId(caseIds, id, `tastePreferenceSignals.${signal.id}.caseIds.${index}`))
    signal.evidenceIds.forEach((id, index) => requireId(evidenceIds, id, `tastePreferenceSignals.${signal.id}.evidenceIds.${index}`))
    if (signal.populationTotal <= 0 || signal.preferenceCount < 0 || signal.preferenceCount > signal.populationTotal || signal.preferenceRate !== signal.preferenceCount / signal.populationTotal) errors.push({ path: `tastePreferenceSignals.${signal.id}`, message: 'Taste preference population and rate must reconcile' })
  })
  const gateRulePending = state.rules.some((rule) => rule.id === 'rule-gate-threshold' && rule.status === 'PENDING')
  if (gateRulePending) {
    state.experiments.forEach((experiment) => experiment.metrics.forEach((metric, index) => { if (metric.gateStatus !== 'PENDING') errors.push({ path: `experiments.${experiment.id}.metrics.${index}.gateStatus`, message: 'Metric gate must remain pending while the business threshold is pending' }) }))
    state.gateDecisions.filter((decision) => decision.conclusion === 'PASS').forEach((decision) => { if (decision.decisionBasis !== 'HUMAN_REVIEW') errors.push({ path: `gateDecisions.${decision.id}.decisionBasis`, message: 'A PASS without configured thresholds must be an explicit human review decision' }) })
  }
  return errors
}
