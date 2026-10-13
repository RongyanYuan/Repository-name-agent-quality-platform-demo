import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData, initialEvolutionData } from './data'
import { selectCaseLineage, selectEvolutionFunnel, selectEvolutionMonitoring, selectMonitoringCaseIds, selectMonitoringDrilldown, selectOverviewCaseMetrics, selectReleaseLineage } from './data/selectors'
import { validateEvolutionState } from './data/validation'
import { resolveIdentity } from './identity'

describe('evolution demo data', () => {
  it('returns the exact contributing Case IDs for every monitoring signal', () => {
    const state = createInitialEvolutionData()
    expect(selectMonitoringCaseIds(state, 'risk')).toEqual(['case-multi-route'])
    expect(selectMonitoringCaseIds(state, 'commercial')).toEqual(['case-tool-export'])
    expect(selectMonitoringDrilldown(state, 'commercial')).toEqual({ caseIds: ['case-tool-export'], traceIds: [resolveIdentity(state, 'trace', 'trace-tool-export')] })
    expect(new Set(selectMonitoringCaseIds(state, 'tool-frequency'))).toEqual(new Set(['case-ppt-management', 'case-tool-export', 'case-multi-route']))
    expect(new Set(selectMonitoringCaseIds(state, 'latency'))).toEqual(new Set(state.traces.map((trace) => trace.caseId)))
  })
  it('uses unique evaluated Case denominators and explicitly separates missing evaluations and Badcases', () => {
    const state = createInitialEvolutionData()
    state.cases = state.cases.filter(record => ['case-ppt-management', 'case-tool-export', 'case-multi-route'].includes(record.id))
    state.tracePackages = []
    const successful = { ...state.cases[0], id: 'case-success', sessionId: state.sessions[0].id, traceIds: [], artifactIds: [], processEvalIds: ['process-success'], outcomeEvalIds: ['outcome-success'], attributionIds: [], issueIds: [], resultStatus: 'PASS' as const, processStatus: 'PASS' as const }
    const missing = { ...state.cases[0], id: 'case-missing', sessionId: state.sessions[0].id, traceIds: [], artifactIds: [], processEvalIds: [], outcomeEvalIds: [], attributionIds: [], issueIds: [], resultStatus: 'UNKNOWN' as const, processStatus: 'UNKNOWN' as const }
    const unconfirmedFailure = { ...state.cases[0], id: 'case-unconfirmed-failure', sessionId: state.sessions[0].id, traceIds: [], artifactIds: [], processEvalIds: ['process-pending'], outcomeEvalIds: ['outcome-pending'], attributionIds: [], issueIds: [], status: 'EVALUATED' as const, resultStatus: 'FAIL' as const, processStatus: 'FAIL' as const }
    state.cases.push(successful, missing, unconfirmedFailure)
    const metrics = selectOverviewCaseMetrics(state)
    expect(metrics.result).toMatchObject({ numerator: 1, denominator: 5, missingCaseIds: ['case-missing'] })
    expect(metrics.process).toMatchObject({ numerator: 1, denominator: 5, missingCaseIds: ['case-missing'] })
    expect(new Set(metrics.badcaseIds)).toEqual(new Set(['case-ppt-management', 'case-tool-export', 'case-multi-route']))
  })

  it('includes scoped evaluated Cases regardless of canonical, V2 or workspace ID prefix', () => {
    const state = createInitialEvolutionData()
    const cohort = ['case-ppt-management', 'case-v2-production-sop', 'case-workspace-ppt-260-sop-1', 'case-workspace-ppt-260-sop-3']
    state.cases = state.cases.filter(record => cohort.includes(record.id))
    const metrics = selectOverviewCaseMetrics(state)
    expect(metrics.process).toMatchObject({ numerator: 1, denominator: 4, missingCaseIds: [] })
    expect(metrics.result).toMatchObject({ numerator: 1, denominator: 4, missingCaseIds: [] })
    expect(metrics.result.passedCaseIds).toEqual(['case-workspace-ppt-260-sop-3'])
    expect(new Set(metrics.badcaseIds)).toEqual(new Set(['case-ppt-management', 'case-v2-production-sop', 'case-workspace-ppt-260-sop-1']))
  })

  it('uses evaluated package human conclusions rather than stale Case status without inventing a score threshold', () => {
    const state = createInitialEvolutionData()
    state.cases = state.cases.filter(record => record.id === 'case-workspace-ppt-260-sop-3')
    const record = state.cases[0]
    record.resultStatus = 'FAIL'
    record.processStatus = 'FAIL'
    const pkg = state.tracePackages.find(item => item.caseId === record.id)!
    pkg.moduleScores.find(score => score.moduleCode === 'REASON')!.humanStatus = 'FAIL'
    const metrics = selectOverviewCaseMetrics(state)
    expect(metrics.process).toMatchObject({ numerator: 0, denominator: 1, failedCaseIds: [record.id] })
    expect(metrics.result).toMatchObject({ numerator: 1, denominator: 1, passedCaseIds: [record.id] })
  })

  it('does not count a result-only partial package as an evaluated process', () => {
    const state = createInitialEvolutionData()
    state.cases = state.cases.filter(record => record.id === 'case-workspace-ppt-260-sop-3')
    const record = state.cases[0]
    record.processEvalIds = []
    const pkg = state.tracePackages.find(item => item.caseId === record.id)!
    pkg.status = 'PARTIAL'
    pkg.processCoverage = 'MISSING'
    pkg.moduleScores = pkg.moduleScores.filter(score => score.moduleCode === 'OUTCOME')
    const metrics = selectOverviewCaseMetrics(state)
    expect(metrics.process).toMatchObject({ numerator: 0, denominator: 0, missingCaseIds: [record.id] })
    expect(metrics.result).toMatchObject({ numerator: 1, denominator: 1 })
  })
  it('keeps the management-PPT case traceable through release', () => {
    const state = createInitialEvolutionData()
    const lineage = selectReleaseLineage(state, 'release-agent-3-0-0')

    expect(lineage?.release.combinationExperimentId).toBe('exp-window-2026w35')
    expect(lineage?.gateDecision?.id).toBe('gate-window-2026w35')
    expect(lineage?.variants.map((item) => item.id)).toContain('variant-ppt-routing-v3')
    expect(lineage?.issues.map((item) => item.id)).toContain('issue-skill-recall')
    expect(lineage?.cases.map((item) => item.id)).toContain('case-ppt-management')

    const forward = selectCaseLineage(state, 'case-ppt-management')
    expect(forward?.traces).toHaveLength(2)
    expect(forward?.processEvals.some((item) => item.verdict === 'FAIL')).toBe(true)
    expect(forward?.outcomeEvals.some((item) => item.verdict === 'FAIL')).toBe(true)
    expect(forward?.releases.map((item) => item.id)).toContain('release-agent-3-0-0')
  })

  it('keeps every release version reverse-traceable to its experiment variants, issues and Cases', () => {
    const state = createInitialEvolutionData()

    state.releases.forEach((release) => {
      const experiment = state.experiments.find((item) => item.id === release.combinationExperimentId)!
      const lineage = selectReleaseLineage(state, release.id)!
      expect(release.variantIds).toEqual(expect.arrayContaining(experiment.variantIds))
      expect(lineage.issues.length, release.id).toBeGreaterThan(0)
      expect(lineage.cases.length, release.id).toBeGreaterThan(0)
    })
  })

  it('keeps each window combination experiment aligned with the exact candidate membership', () => {
    const state = createInitialEvolutionData()

    state.windows.filter((window) => window.combinationExperimentId).forEach((window) => {
      const combination = state.experiments.find((item) => item.id === window.combinationExperimentId)!
      expect(new Set(combination.variantIds)).toEqual(new Set(window.candidateVariantIds))
      state.releases.filter((release) => release.windowId === window.id).forEach((release) => {
        expect(new Set(release.variantIds)).toEqual(new Set(window.candidateVariantIds))
      })
    })
  })

  it('rejects a window, combination experiment or release with divergent variant membership', () => {
    const state = createInitialEvolutionData()
    state.experiments.find((item) => item.id === 'exp-window-2026w35')!.variantIds = ['variant-ppt-routing-v3']
    state.releases.find((item) => item.id === 'release-agent-3-0-0')!.variantIds = ['variant-ppt-routing-v3']

    const paths = validateEvolutionState(state).map((error) => error.path)
    expect(paths).toContain('windows.window-2026w35.candidateVariantIds')
    expect(paths).toContain('releases.release-agent-3-0-0.variantIds')
  })

  it('rejects broken reciprocal Case, Issue, Cluster, Variant and processing-chain references', () => {
    const state = createInitialEvolutionData()
    state.cases.find((item) => item.id === 'case-ppt-management')!.issueIds = []
    state.issues.find((item) => item.id === 'issue-skill-recall')!.clusterIds = []
    state.issueClusters.find((item) => item.id === 'cluster-ppt-routing-ready')!.variantIds = []
    state.issues.find((item) => item.id === 'issue-skill-recall')!.processingChains![0].destinationType = 'ISSUE_CLUSTER'
    state.issues.find((item) => item.id === 'issue-skill-recall')!.processingChains![0].destinationId = 'missing-cluster'
    const paths = validateEvolutionState(state).map((error) => error.path)
    expect(paths).toEqual(expect.arrayContaining([
      'cases.case-ppt-management.issueIds',
      'issues.issue-skill-recall.clusterIds',
      'issueClusters.cluster-ppt-routing-ready.variantIds',
      'issues.issue-skill-recall.processingChains.0.destinationId'
    ]))
  })

  it('contains a direct-fix chain and a multi-attribution multi-route chain', () => {
    const state = createInitialEvolutionData()
    const direct = selectCaseLineage(state, 'case-tool-export')
    const multi = selectCaseLineage(state, 'case-multi-route')

    expect(direct?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'issue-tool-export', optimizationMode: 'DIRECT_FIX' })]))
    expect(direct?.variants.map((item) => item.id)).toContain('variant-tool-retry-v2')
    expect(direct?.experiments.map((item) => item.id)).toContain('exp-single-tool-retry')

    expect(multi?.attributions).toHaveLength(2)
    expect(new Set(multi?.attributions.flatMap((item) => item.routingLabels))).toEqual(new Set(['策略迭代', 'Agent 迭代']))
    expect(new Set(multi?.issues.map((item) => item.optimizationMode)).size).toBe(2)
  })

  it('preserves automatic and human evaluation revisions without overwriting history', () => {
    const state = createInitialEvolutionData()
    const evaluation = state.outcomeEvals.find((item) => item.id === 'outcome-eval-ppt-style')

    expect(evaluation?.revisions.map((revision) => revision.source)).toEqual(['AUTOMATIC', 'HUMAN'])
    expect(evaluation?.revisions.every((revision) => revision.evidenceIds.length > 0)).toBe(true)
    expect(evaluation?.verdict).toBe('FAIL')
  })

  it('has valid forward references for every required entity relationship', () => {
    const state = initialEvolutionData
    const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id))
    const caseIds = ids(state.cases)
    const traceIds = ids(state.traces)
    const observationIds = ids(state.observations)
    const issueIds = ids(state.issues)
    const variantIds = ids(state.variants)
    const datasetIds = ids(state.datasets)
    const experimentIds = ids(state.experiments)

    state.cases.forEach((item) => item.traceIds.forEach((id) => expect(traceIds.has(id)).toBe(true)))
    state.traces.forEach((item) => {
      expect(caseIds.has(item.caseId)).toBe(true)
      item.observationIds.forEach((id) => expect(observationIds.has(id)).toBe(true))
    })
    state.issueClusters.forEach((item) => {
      item.issueIds.forEach((id) => expect(issueIds.has(id)).toBe(true))
      item.caseIds.forEach((id) => expect(caseIds.has(id)).toBe(true))
    })
    state.variants.forEach((item) => item.sourceIssueIds.forEach((id) => expect(issueIds.has(id)).toBe(true)))
    state.experiments.forEach((item) => {
      item.variantIds.forEach((id) => expect(variantIds.has(id)).toBe(true))
      item.datasetIds.forEach((id) => expect(datasetIds.has(id)).toBe(true))
    })
    state.releases.forEach((item) => {
      expect(experimentIds.has(item.combinationExperimentId)).toBe(true)
      item.variantIds.forEach((id) => expect(variantIds.has(id)).toBe(true))
    })
  })

  it('passes the reusable relationship and experiment invariant validator', () => {
    expect(validateEvolutionState(createInitialEvolutionData())).toEqual([])
  })

  it('keeps every artifact and rollback target as a real linked entity', () => {
    const state = createInitialEvolutionData()
    const artifactIds = new Set(state.artifacts.map((item) => item.id))
    const releaseIds = new Set(state.releases.map((item) => item.id))

    state.outcomeEvals.forEach((evaluation) => expect(artifactIds.has(evaluation.artifactId)).toBe(true))
    state.releases.forEach((release) => {
      if (release.rollbackVersionId) expect(releaseIds.has(release.rollbackVersionId)).toBe(true)
    })
  })

  it('models paired run matrices for completed experiments while queued experiments remain unrun', () => {
    const state = createInitialEvolutionData()
    const expectedCases = ['case-multi-route', 'case-ppt-management', 'case-tool-export']

    state.experiments.forEach((experiment) => {
      const runs = state.experimentRuns.filter((run) => run.experimentId === experiment.id)
      if (experiment.status === 'DRAFT' || experiment.status === 'QUEUED') {
        expect(experiment.runIds).toEqual([])
        expect(runs).toEqual([])
        return
      }
      const caseIds = [...new Set(runs.map((run) => run.caseId))].sort()
      expect(caseIds).toEqual(experiment.id.includes('governance-demo') ? ['case-governance-demo-ppt'] : experiment.id.includes('module-path-demo') ? ['case-ppt-management'] : expectedCases)
      expect(new Set(runs.map((run) => run.configHash))).toHaveLength(1)
      expect(new Set(experiment.runIds)).toEqual(new Set(runs.map((run) => run.id)))

      caseIds.forEach((caseId) => {
        const baseline = runs.filter((run) => run.caseId === caseId && run.arm === 'BASELINE')
        const candidate = runs.filter((run) => run.caseId === caseId && run.arm === 'CANDIDATE')
        const repetitions = Array.from({ length: experiment.configSnapshot.repeatCount }, (_, index) => index + 1)
        expect(baseline.map((run) => run.repetition).sort((left, right) => left - right)).toEqual(repetitions)
        expect(candidate.map((run) => run.repetition).sort((left, right) => left - right)).toEqual(repetitions)
      })
    })
  })

  it('does not advance the 37-of-100 taste cluster into a variant, experiment, window, gate or release', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!

    expect(cluster).toMatchObject({ currentCount: 37, threshold: 100, status: 'COLLECTING', variantIds: [] })
    expect(state.variants.some((item) => item.sourceClusterIds.includes(cluster.id))).toBe(false)
    expect(state.experiments.some((item) => item.variantIds.some((id) => cluster.variantIds.includes(id)))).toBe(false)
    expect(state.gateDecisions.some((item) => item.reportSnapshot.evidenceIds?.includes('evidence-ppt-style'))).toBe(false)
    expect(state.releases.some((item) => item.variantIds.includes('variant-ppt-taste-v2'))).toBe(false)
  })

  it('keeps metric gates pending while the business threshold rule is pending', () => {
    const state = createInitialEvolutionData()
    expect(state.rules.find((item) => item.id === 'rule-gate-threshold')?.status).toBe('PENDING')
    expect(state.experiments.flatMap((item) => item.metrics).every((metric) => metric.gateStatus === 'PENDING')).toBe(true)
    expect(state.gateDecisions.filter((item) => item.conclusion === 'PASS').every((item) => item.decisionBasis === 'HUMAN_REVIEW')).toBe(true)
  })

  it('reports broken references and unpaired experiment arms instead of accepting partial state', () => {
    const state = createInitialEvolutionData()
    state.outcomeEvals[0].artifactId = 'artifact-does-not-exist'
    const releaseWithRollback = state.releases.find((release) => release.id === 'release-agent-3-0-0')!
    releaseWithRollback.rollbackVersionId = 'release-does-not-exist'
    state.experimentRuns = state.experimentRuns.filter((run) => !(run.experimentId === 'exp-single-ppt-routing' && run.arm === 'BASELINE' && run.repetition === 3))

    const paths = validateEvolutionState(state).map((error) => error.path)
    expect(paths).toContain('outcomeEvals.outcome-eval-ppt-style.artifactId')
    expect(paths).toContain('releases.release-agent-3-0-0.rollbackVersionId')
    expect(paths).toContain('experiments.exp-single-ppt-routing.runMatrix')
  })

  it('records ordered Session turns and the complete online telemetry contract', () => {
    const state = createInitialEvolutionData()
    const management = state.sessions.find((item) => item.id === resolveIdentity(state, 'session', 'session-ppt-management'))!

    expect(management.turns.map((turn) => [turn.sequence, turn.role, turn.caseId, turn.traceId])).toEqual([
      [1, 'USER', 'case-ppt-management', resolveIdentity(state, 'trace', 'trace-ppt-context')],
      [2, 'AGENT', 'case-ppt-management', resolveIdentity(state, 'trace', 'trace-ppt-context')],
      [3, 'USER', 'case-ppt-management', resolveIdentity(state, 'trace', 'trace-ppt-generate')],
      [4, 'AGENT', 'case-ppt-management', resolveIdentity(state, 'trace', 'trace-ppt-generate')]
    ])
    state.traces.forEach((trace) => expect(trace.telemetry).toMatchObject({
      totalLatencyMs: expect.any(Number), ttftMs: expect.any(Number), inputTokens: expect.any(Number), outputTokens: expect.any(Number),
      cacheHitCount: expect.any(Number), cacheRequestCount: expect.any(Number), modelCallCount: expect.any(Number), toolCallCount: expect.any(Number),
      toolOneShotSuccessCount: expect.any(Number), toolExecutionCount: expect.any(Number), loopCount: expect.any(Number), retryCount: expect.any(Number),
      riskInterception: { blocked: expect.any(Boolean), reason: expect.any(String) },
      commercialInterception: { blocked: expect.any(Boolean), reason: expect.any(String) }
    }))
  })

  it('derives latency percentiles, tool frequency and normalized interception reason distributions', () => {
    const monitoring = selectEvolutionMonitoring(createInitialEvolutionData())

    expect(monitoring).toMatchObject({
      traceCount: 4, latencyMs: { average: 37500, p50: 65000, p90: 72000, p95: 72000 }, ttftMs: { average: 720, p50: 930, p90: 1220, p95: 1220 },
      tokens: { input: 13160, output: 2870 }, cache: { hitCount: 4, requestCount: 12, hitRate: 1 / 3 }, modelCallCount: 9, toolCallCount: 3,
      toolOneShot: { successCount: 1, executionCount: 3, successRate: 1 / 3 }, loopCount: 1, retryCount: 1,
      risk: { blockedCount: 1, rate: 0.25, reasonDistribution: [{ reason: '敏感数据', count: 1 }] },
      commercial: { blockedCount: 1, rate: 0.25, reasonDistribution: [{ reason: '权益不足', count: 1 }] }
    })
    expect(monitoring.toolFrequency).toEqual([
      { toolName: 'slides.render', callCount: 2, frequency: 2 / 3, oneShotSuccessCount: 1, oneShotSuccessRate: 0.5 },
      { toolName: 'sheets.export', callCount: 1, frequency: 1 / 3, oneShotSuccessCount: 0, oneShotSuccessRate: 0 }
    ])
  })

  it('keeps attribution revision history and explicit dataset population semantics', () => {
    const state = createInitialEvolutionData()
    const attribution = state.attributions.find((item) => item.id === 'attribution-skill-recall')!
    expect(attribution.revisions.map((item) => item.source)).toEqual(['AUTOMATIC', 'HUMAN'])
    expect(attribution.revisions.every((item) => item.evidenceIds.length > 0)).toBe(true)

    state.datasets.forEach((dataset) => {
      expect(dataset.population.totalSampleCount).toBe(dataset.sampleCount)
      expect(dataset.population.localCaseCount).toBe(dataset.caseIds.length)
      expect(dataset.population.externalSampleCount + dataset.caseIds.length).toBe(dataset.sampleCount)
      expect(dataset.population.countingRule).not.toBe('')
      expect(dataset.population.sourceSystem).not.toBe('')
    })
  })

  it('freezes enough evidence to reproduce every gate report', () => {
    const state = createInitialEvolutionData()
    state.gateDecisions.forEach((decision) => {
      const experiment = state.experiments.find((item) => item.id === decision.experimentId)!
      expect(decision.reportSnapshot.experimentId).toBe(experiment.id)
      expect(decision.reportSnapshot.configSnapshot).toEqual(experiment.configSnapshot)
      expect(decision.reportSnapshot.runSnapshots).toHaveLength(experiment.runIds.length)
      expect(decision.reportSnapshot.failedCaseIds).toEqual(experiment.failedCaseIds)
      expect(decision.reportSnapshot.rollbackItems).toEqual(experiment.rollbackItems)
      expect(decision.reportSnapshot.knownRisks).toEqual(experiment.knownRisks)
      expect(decision.reportSnapshot.evidenceIds?.length).toBeGreaterThan(0)
    })
  })

  it('provides pass, reject and manual-review gates plus every release lifecycle state', () => {
    const state = createInitialEvolutionData()
    expect(new Set(state.gateDecisions.map((item) => item.conclusion))).toEqual(new Set(['PASS', 'REJECT', 'MANUAL_REVIEW']))
    expect(new Set(state.releases.map((item) => item.status))).toEqual(new Set(['PENDING', 'CANARY', 'RELEASED', 'OBSERVING', 'ROLLED_BACK']))
    state.releases.filter((item) => item.status === 'ROLLED_BACK').forEach((item) => {
      expect(item.rollbackVersionId).toBeTruthy()
      expect(item.rollbackReason).toBeTruthy()
    })
  })

  it('validates Session turns, telemetry, report snapshots and dataset population invariants', () => {
    const state = createInitialEvolutionData()
    state.sessions[0].turns[0].traceId = 'trace-other-case'
    state.traces[0].telemetry.cacheHitCount = state.traces[0].telemetry.cacheRequestCount + 1
    state.datasets[0].population.totalSampleCount += 1
    state.gateDecisions[0].reportSnapshot.runSnapshots = []

    const paths = validateEvolutionState(state).map((item) => item.path)
    expect(paths).toContain(`sessions.${resolveIdentity(state, 'session', 'session-ppt-management')}.turns.0.traceId`)
    expect(paths).toContain(`traces.${resolveIdentity(state, 'trace', 'trace-ppt-context')}.telemetry.cacheHitCount`)
    expect(paths).toContain('datasets.dataset-attribution.population')
    expect(paths).toContain('gateDecisions.gate-single-ppt-routing.reportSnapshot.runSnapshots')
  })

  it('accepts an unrun queued experiment but rejects runs before RUN_EXPERIMENT and early gates', () => {
    const queued = createInitialEvolutionData()
    expect(validateEvolutionState(queued)).toEqual([])
    const experiment = queued.experiments.find((item) => item.id === 'exp-single-memory-latest')!
    experiment.runIds = ['run-fake-queued']
    queued.experimentRuns.push({ id: 'run-fake-queued', experimentId: experiment.id, caseId: 'case-multi-route', repetition: 1, arm: 'BASELINE', status: 'QUEUED', durationMs: 0, configHash: 'fake', createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z' })
    queued.gateDecisions.push({ id: 'gate-fake-queued', experimentId: experiment.id, conclusion: 'MANUAL_REVIEW', decisionBasis: 'HUMAN_REVIEW', reason: '过早', riskNotes: [], decidedBy: '测试', decidedAt: '2026-09-28T00:00:00.000Z', reportSnapshot: { variantIds: experiment.variantIds, datasetVersions: [], metricResults: [] } })

    const paths = validateEvolutionState(queued).map((item) => item.path)
    expect(paths).toContain('experiments.exp-single-memory-latest.runMatrix')
    expect(paths).toContain('gateDecisions.gate-fake-queued.experimentId')
  })
})

describe('evolution funnel selectors', () => {
  it('does not mix Case, issue, variant, experiment and decision denominators', () => {
    const funnel = selectEvolutionFunnel(createInitialEvolutionData())

    expect(funnel.map((item) => [item.id, item.unit])).toEqual([
      ['online-cases', 'Case'],
      ['evaluated-cases', 'Case'],
      ['confirmed-issues', '问题'],
      ['routed-issues', '问题'],
      ['variants', '变体'],
      ['single-experiments', '实验'],
      ['window-experiments', '实验'],
      ['gate-decisions', '决策']
    ])
    funnel.forEach((item) => expect(item.count).toBe(item.detailIds.length))
  })
})
