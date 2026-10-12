import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import type { Asset, Attribution, Dataset, EvaluationRevision, Experiment, ExperimentRun, GateDecision, Issue, IssueCluster, ReleaseVersion, Variant } from './domain'
import { evolutionReducer } from './store'
import { validateEvolutionState } from './data/validation'

const meta = { actor: '治理测试员', reason: '测试变更', at: '2026-09-28T12:00:00.000Z', auditId: 'audit-test' }

describe('evolution reducer', () => {
  it('materializes a batch-scoped Trace Evaluation Package and routing graph when a job completes', () => {
    const state = createInitialEvolutionData()
    const traceId = 'trace-ppt-generate'
    const at = '2026-09-30T12:30:00.000Z'
    const batch = {
      id: 'batch-test-materialize', name: '测试批次', status: 'DRAFT' as const, traceIds: [traceId], packageIds: [], jobIds: [],
      evalAgentVersion: 'eval-agent-test', rubricVersion: 'rubric-test', runEnvironment: 'local-mock-runner', createdBy: '测试员',
      stats: { inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 1 }, createdAt: at, updatedAt: at
    }
    const job = { id: 'job-test-materialize', batchId: batch.id, attempt: 1, status: 'QUEUED' as const, traceIds: [traceId], processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'test' }, createdAt: at, updatedAt: at }
    const completed = evolutionReducer(
      evolutionReducer(
        evolutionReducer(
          evolutionReducer(state, { type: 'CREATE_EVALUATION_BATCH', batch, meta: { ...meta, at } }),
          { type: 'QUEUE_EVALUATION_JOB', job, meta: { ...meta, at } }
        ),
        { type: 'START_EVALUATION_JOB', jobId: job.id, meta: { ...meta, at } }
      ),
      { type: 'COMPLETE_EVALUATION_JOB', jobId: job.id, meta: { ...meta, at } }
    )

    const materialized = completed.tracePackages.filter((item) => item.batchId === batch.id)
    expect(materialized).toHaveLength(1)
    expect(materialized[0].traceId).toBe(traceId)
    expect(materialized[0].id).not.toBe(`package-${traceId}`)
    expect(materialized[0].moduleScores.length).toBeGreaterThan(0)
    expect(completed.evaluationFindings.some((item) => item.packageId === materialized[0].id)).toBe(true)
    expect(completed.routingDeliveries.some((item) => item.packageId === materialized[0].id)).toBe(true)
    expect(completed.evaluationBatches.find((item) => item.id === batch.id)?.packageIds).toEqual([materialized[0].id])
    const stats = completed.evaluationBatches.find((item) => item.id === batch.id)!.stats
    expect(stats.inputTraceCount).toBe(stats.successCount + stats.partialCount + stats.failedCount + stats.pendingCount)
    expect(stats.pendingCount).toBe(0)
    expect(materialized[0].moduleScores.every((score) => score.evalAgentVersion === 'eval-agent-test' && score.rubricVersion === 'rubric-test')).toBe(true)
    const algorithmDelivery = completed.routingDeliveries.find((item) => item.packageId === materialized[0].id && item.destination === 'ALGORITHM_BADCASE')!
    const candidate = completed.algorithmBadcases.find((item) => item.id === algorithmDelivery.algorithmBadcaseId)!
    expect(candidate.status).toBe('CANDIDATE')
    expect(algorithmDelivery.status).toBe('PENDING')
    expect(completed.badcaseQueues.find((item) => item.id === candidate.queueId)?.itemIds).toContain(candidate.id)
    expect(completed.badcaseQueues.find((item) => item.id === algorithmDelivery.queueId)?.deliveryIds).toContain(algorithmDelivery.id)
    expect(validateEvolutionState(completed)).toEqual([])
  })

  it('lists newly created batch Traces as pending before a job starts', () => {
    const state = createInitialEvolutionData()
    const at = '2026-09-30T12:35:00.000Z'
    const batch = {
      id: 'batch-test-pending', name: '待运行批次', status: 'DRAFT' as const, traceIds: ['trace-ppt-generate'], packageIds: [], jobIds: [],
      evalAgentVersion: 'eval-agent-2.4.0', rubricVersion: 'rubric-office-v2.1', runEnvironment: 'local-mock-runner', createdBy: '测试员',
      stats: { inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 1 }, createdAt: at, updatedAt: at
    }
    const created = evolutionReducer(state, { type: 'CREATE_EVALUATION_BATCH', batch, meta: { ...meta, at } })
    const record = created.tracePackages.find((item) => item.batchId === batch.id)!
    expect(record.status).toBe('PENDING')
    expect(record.moduleScores.every((score) => score.automaticStatus === 'UNKNOWN')).toBe(true)
    expect(created.evaluationBatches.find((item) => item.id === batch.id)?.packageIds).toEqual([record.id])
    expect(validateEvolutionState(created)).toEqual([])
  })

  it('does not synthesize PASS when a completed batch has no same-Trace evaluation template', () => {
    const original = createInitialEvolutionData()
    const state = { ...original, tracePackages: original.tracePackages.filter((item) => item.traceId !== 'trace-ppt-generate') }
    const at = '2026-09-30T12:40:00.000Z'
    const batch = {
      id: 'batch-test-unknown', name: '无模板批次', status: 'DRAFT' as const, traceIds: ['trace-ppt-generate'], packageIds: [], jobIds: [],
      evalAgentVersion: 'eval-agent-test', rubricVersion: 'rubric-test', runEnvironment: 'local-mock-runner', createdBy: '测试员',
      stats: { inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 1 }, createdAt: at, updatedAt: at
    }
    const job = { id: 'job-test-unknown', batchId: batch.id, attempt: 1, status: 'RUNNING' as const, traceIds: batch.traceIds, processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'test' }, createdAt: at, updatedAt: at }
    const next = evolutionReducer(
      evolutionReducer(
        evolutionReducer(state, { type: 'CREATE_EVALUATION_BATCH', batch, meta: { ...meta, at } }),
        { type: 'QUEUE_EVALUATION_JOB', job: { ...job, status: 'QUEUED' }, meta: { ...meta, at } }
      ),
      { type: 'START_EVALUATION_JOB', jobId: job.id, meta: { ...meta, at } }
    )
    const completed = evolutionReducer(next, { type: 'COMPLETE_EVALUATION_JOB', jobId: job.id, meta: { ...meta, at } })
    const pkg = completed.tracePackages.find((item) => item.batchId === batch.id)!
    expect(pkg.status).toBe('PARTIAL')
    expect(pkg.moduleScores.every((score) => score.automaticStatus === 'UNKNOWN')).toBe(true)
    expect(pkg.moduleScores.every((score) => score.score === undefined)).toBe(true)
    expect(completed.evaluationFindings.filter((item) => item.packageId === pkg.id)).toHaveLength(0)
  })

  it('keeps failed job history while retrying and materializes only the retry result', () => {
    const state = createInitialEvolutionData()
    const at = '2026-09-30T12:50:00.000Z'
    const batch = {
      id: 'batch-test-retry', name: '重试批次', status: 'DRAFT' as const, traceIds: ['trace-ppt-generate'], packageIds: [], jobIds: [],
      evalAgentVersion: 'eval-agent-test', rubricVersion: 'rubric-test', runEnvironment: 'local-mock-runner', createdBy: '测试员',
      stats: { inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 1 }, createdAt: at, updatedAt: at
    }
    const queuedJob = { id: 'job-test-retry', batchId: batch.id, attempt: 1, status: 'QUEUED' as const, traceIds: batch.traceIds, processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'test' }, createdAt: at, updatedAt: at }
    const failed = evolutionReducer(
      evolutionReducer(
        evolutionReducer(
          evolutionReducer(state, { type: 'CREATE_EVALUATION_BATCH', batch, meta: { ...meta, at } }),
          { type: 'QUEUE_EVALUATION_JOB', job: queuedJob, meta: { ...meta, at } }
        ),
        { type: 'START_EVALUATION_JOB', jobId: queuedJob.id, meta: { ...meta, at } }
      ),
      { type: 'FAIL_EVALUATION_JOB', jobId: queuedJob.id, error: '测试失败', meta: { ...meta, at } }
    )
    const retried = evolutionReducer(failed, { type: 'RETRY_EVALUATION_JOB', jobId: queuedJob.id, meta: { ...meta, at } })
    const retryJob = retried.evaluationJobs.find((item) => item.id !== queuedJob.id && item.batchId === batch.id)!
    expect(retried.evaluationJobs.find((item) => item.id === queuedJob.id)?.status).toBe('FAILED')
    expect(retryJob.attempt).toBe(2)
    const completed = evolutionReducer(
      evolutionReducer(retried, { type: 'START_EVALUATION_JOB', jobId: retryJob.id, meta: { ...meta, at } }),
      { type: 'COMPLETE_EVALUATION_JOB', jobId: retryJob.id, meta: { ...meta, at } }
    )
    expect(completed.evaluationJobs.map((item) => item.id)).toEqual(expect.arrayContaining([queuedJob.id, retryJob.id]))
    expect(completed.tracePackages.filter((item) => item.batchId === batch.id)).toHaveLength(1)
    expect(completed.evaluationBatches.find((item) => item.id === batch.id)?.jobIds).toEqual([queuedJob.id, retryJob.id])
  })

  it('marks attempted Trace placeholders as failed and keeps batch counts conserved when the job fails', () => {
    const state = createInitialEvolutionData()
    const at = '2026-09-30T12:55:00.000Z'
    const batch = {
      id: 'batch-test-fail-stats', name: '失败统计批次', status: 'DRAFT' as const, traceIds: ['trace-ppt-generate'], packageIds: [], jobIds: [],
      evalAgentVersion: 'eval-agent-test', rubricVersion: 'rubric-test', runEnvironment: 'local-mock-runner', createdBy: '测试员',
      stats: { inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: 1 }, createdAt: at, updatedAt: at
    }
    const queuedJob = { id: 'job-test-fail-stats', batchId: batch.id, attempt: 1, status: 'QUEUED' as const, traceIds: batch.traceIds, processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'test' }, createdAt: at, updatedAt: at }
    const queued = evolutionReducer(evolutionReducer(state, { type: 'CREATE_EVALUATION_BATCH', batch, meta: { ...meta, at } }), { type: 'QUEUE_EVALUATION_JOB', job: queuedJob, meta: { ...meta, at } })
    const failed = evolutionReducer(queued, { type: 'FAIL_EVALUATION_JOB', jobId: queuedJob.id, error: '超时', meta: { ...meta, at } })
    expect(failed.tracePackages.find((item) => item.batchId === batch.id)?.status).toBe('FAILED')
    expect(failed.evaluationBatches.find((item) => item.id === batch.id)?.stats).toEqual({ inputTraceCount: 1, successCount: 0, partialCount: 0, failedCount: 1, pendingCount: 0 })
  })


  it('keeps automatic module evidence and source IDs immutable during human override', () => {
    const state = createInitialEvolutionData()
    const pkg = state.tracePackages.find((item) => item.traceId === 'trace-ppt-generate')!
    const before = pkg.moduleScores.find((item) => item.moduleCode === 'SKILL')!
    const meta = { actor: '测试员', reason: '人工复核', at: '2026-09-30T12:00:00.000Z' }
    const next = evolutionReducer(state, { type: 'UPDATE_MODULE_EVALUATION', packageId: pkg.id, scoreId: before.id, patch: { automaticStatus: 'PASS', judgeReason: '被篡改', evidence: { ...before.evidence, rootEvidenceIds: [] }, humanStatus: 'PASS', humanNote: '人工接受', humanUpdatedBy: '测试员' }, meta })
    const after = next.tracePackages.find((item) => item.id === pkg.id)!.moduleScores.find((item) => item.id === before.id)!
    expect(after.automaticStatus).toBe(before.automaticStatus)
    expect(after.judgeReason).toBe(before.judgeReason)
    expect(after.evidence).toEqual(before.evidence)
    expect(after.humanStatus).toBe('PASS')
    expect(after.humanNote).toBe('人工接受')
    expect(next.auditTrail.at(-1)).toMatchObject({ action: 'UPDATE_MODULE_EVALUATION', entityId: before.id })
  })

  it('does not claim a batch is fully evaluated when a Mock job has no module results', () => {
    const state = createInitialEvolutionData()
    const batch = state.evaluationBatches.find((item) => item.status === 'DRAFT')!
    const at = '2026-09-30T13:00:00.000Z'
    const job = { id: 'job-test-empty-results', batchId: batch.id, attempt: 1, status: 'QUEUED' as const, traceIds: [...batch.traceIds], processedTraceIds: [], failedTraceIds: [], evalAgentVersion: batch.evalAgentVersion, rubricVersion: batch.rubricVersion, runEnvironment: batch.runEnvironment, configurationSnapshot: { source: 'test' }, createdAt: at, updatedAt: at }
    const queued = evolutionReducer(state, { type: 'QUEUE_EVALUATION_JOB', job, meta: { actor: '测试员', reason: '排队', at } })
    const running = evolutionReducer(queued, { type: 'START_EVALUATION_JOB', jobId: job.id, meta: { actor: '测试员', reason: '开始', at } })
    const completed = evolutionReducer(running, { type: 'COMPLETE_EVALUATION_JOB', jobId: job.id, meta: { actor: '测试员', reason: 'Mock 作业结束', at } })
    const completedBatch = completed.evaluationBatches.find((item) => item.id === batch.id)!
    expect(completed.evaluationJobs.find((item) => item.id === job.id)?.status).toBe('COMPLETED')
    expect(completedBatch.status).toBe('PARTIAL')
    expect(completedBatch.stats.successCount).toBe(0)
    expect(completedBatch.stats.partialCount).toBe(batch.traceIds.length)
    expect(completedBatch.stats.pendingCount).toBe(0)
  })
  it('updates a case and writes an audit trail entry', () => {
    const state = createInitialEvolutionData()
    const next = evolutionReducer(state, { type: 'UPDATE_CASE', caseId: 'case-tool-export', patch: { status: 'RESOLVED', owner: 'Tool 团队' }, meta })

    expect(next.cases.find((item) => item.id === 'case-tool-export')).toMatchObject({ status: 'RESOLVED', owner: 'Tool 团队' })
    expect(next.auditTrail.at(-1)).toMatchObject({ id: 'audit-test', action: 'UPDATE_CASE', entityId: 'case-tool-export', actor: '治理测试员' })
  })

  it('appends a human evaluation revision without overwriting the automatic record', () => {
    const state = createInitialEvolutionData()
    const before = state.outcomeEvals.find((item) => item.id === 'outcome-eval-ppt-style')!
    const revision: EvaluationRevision = { id: 'revision-human-2', source: 'HUMAN', verdict: 'PASS', score: 0.86, reason: '人工复核证据后通过。', evidenceIds: ['evidence-ppt-style'], evaluator: '治理测试员', evaluatedAt: meta.at, supersedesRevisionId: before.revisions.at(-1)?.id }

    const next = evolutionReducer(state, { type: 'ADD_EVALUATION_REVISION', evaluationType: 'OUTCOME', evaluationId: before.id, revision, meta })
    const after = next.outcomeEvals.find((item) => item.id === before.id)!

    expect(after.revisions.map((item) => item.id)).toEqual([...before.revisions.map((item) => item.id), revision.id])
    expect(after).toMatchObject({ verdict: 'PASS', score: 0.86 })
    expect(after.revisions[0]).toEqual(before.revisions[0])
    expect(next.auditTrail.at(-1)).toMatchObject({ action: 'ADD_EVALUATION_REVISION', entityId: before.id })
  })

  it('upserts attribution and issue records without losing multi-route labels', () => {
    const state = createInitialEvolutionData()
    const attribution: Attribution = {
      id: 'attribution-new', caseId: 'case-tool-export', traceId: 'trace-tool-export', observationId: 'obs-tool-call', module: 'Act', dimension: '工具执行失败', evidenceIds: ['evidence-tool-error'], confidence: 1, source: 'HUMAN', confirmed: true, routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', revisions: [], createdAt: meta.at!, updatedAt: meta.at!
    }
    const issue: Issue = {
      id: 'issue-new', caseId: 'case-tool-export', attributionId: attribution.id, title: '导出工具参数校验', description: '参数未在执行前校验。', module: 'Act', dimension: '工具执行失败', evidenceIds: ['evidence-tool-error'], routingLabels: [...attribution.routingLabels], optimizationMode: 'DIRECT_FIX', responsibilityStatus: 'ASSIGNED', owner: 'Tool 团队', status: 'CONFIRMED', clusterIds: [], variantIds: [], createdAt: meta.at, updatedAt: meta.at
    }

    const attributed = evolutionReducer(state, { type: 'UPSERT_ATTRIBUTION', attribution, meta: { ...meta, auditId: 'audit-attribution' } })
    const next = evolutionReducer(attributed, { type: 'UPSERT_ISSUE', issue, meta: { ...meta, auditId: 'audit-issue' } })

    expect(next.attributions.find((item) => item.id === attribution.id)?.routingLabels).toEqual(['策略迭代', 'Agent 迭代'])
    expect(next.cases.find((item) => item.id === issue.caseId)?.issueIds).toContain(issue.id)
  })

  it('appends attribution revisions while preserving prior automatic and human history', () => {
    const state = createInitialEvolutionData()
    const before = state.attributions.find((item) => item.id === 'attribution-skill-recall')!
    const next = evolutionReducer(state, { type: 'ADD_ATTRIBUTION_REVISION', attributionId: before.id, revision: { id: 'attr-revision-test', source: 'HUMAN', module: 'Reason', dimension: '未响应用户诉求', evidenceIds: ['evidence-ppt-recall'], routingLabels: ['策略迭代', 'Agent 迭代'], optimizationMode: 'DIRECT_FIX', confirmed: true, status: 'CONFIRMED', confidence: 0.88, reason: '人工调整归因。', revisedBy: '治理测试员', revisedAt: meta.at!, supersedesRevisionId: before.revisions.at(-1)?.id }, meta })
    const after = next.attributions.find((item) => item.id === before.id)!

    expect(after.revisions.map((item) => item.id)).toEqual([...before.revisions.map((item) => item.id), 'attr-revision-test'])
    expect(after).toMatchObject({ module: 'Reason', dimension: '未响应用户诉求', optimizationMode: 'DIRECT_FIX' })
    expect(after.revisions[0]).toEqual(before.revisions[0])
  })

  it('links cluster membership and new variants in both directions', () => {
    const state = createInitialEvolutionData()
    const clustered = evolutionReducer(state, { type: 'ADD_CASE_TO_CLUSTER', clusterId: 'cluster-ppt-routing-ready', caseId: 'case-multi-route', issueId: 'issue-memory-context', meta: { ...meta, auditId: 'audit-cluster' } })
    const variant: Variant = {
      id: 'variant-new', name: '上下文召回候选', targetModule: 'Memory', changeType: 'PROMPT_OR_POLICY', changeSummary: '收紧跨轮上下文选择。', changeContent: '优先检索当前 Session 的已确认产物。', currentVersion: 'memory-1.0.0', candidateVersion: 'memory-1.1.0', sourceCaseIds: ['case-multi-route'], sourceIssueIds: ['issue-memory-context'], sourceClusterIds: ['cluster-ppt-routing-ready'], evidenceIds: ['evidence-memory-miss'], status: 'DRAFT', experimentIds: [], createdAt: meta.at!, updatedAt: meta.at!
    }
    const next = evolutionReducer(clustered, { type: 'CREATE_VARIANT', variant, meta: { ...meta, auditId: 'audit-variant' } })

    expect(next.issueClusters.find((item) => item.id === 'cluster-ppt-routing-ready')?.caseIds).toContain('case-multi-route')
    expect(next.issues.find((item) => item.id === 'issue-memory-context')?.clusterIds).toContain('cluster-ppt-routing-ready')
    expect(next.issues.find((item) => item.id === 'issue-memory-context')?.variantIds).toContain('variant-new')
  })

  it('stores an experiment decision separately from release status', () => {
    const state = createInitialEvolutionData()
    const decision: GateDecision = { id: 'gate-new', experimentId: 'exp-single-tool-retry', conclusion: 'REJECT', reason: '回归集存在失败项。', riskNotes: ['需补齐超时场景'], decidedBy: '实验负责人', decidedAt: meta.at, reportSnapshot: { variantIds: ['variant-tool-retry-v2'], datasetVersions: [{ datasetId: 'dataset-regression', version: 'v1.2' }], metricResults: [] } }

    const completed = { ...state, experiments: state.experiments.map((item) => item.id === decision.experimentId ? { ...item, status: 'COMPLETED' as const, gateDecisionId: undefined } : item), gateDecisions: state.gateDecisions.filter((item) => item.experimentId !== decision.experimentId) }
    const next = evolutionReducer(completed, { type: 'UPDATE_EXPERIMENT_DECISION', experimentId: 'exp-single-tool-retry', decision, meta })

    expect(next.experiments.find((item) => item.id === decision.experimentId)).toMatchObject({ gateDecisionId: 'gate-new', status: 'DECIDED' })
    expect(next.gateDecisions.find((item) => item.id === 'gate-new')?.conclusion).toBe('REJECT')
    expect(next.releases.find((item) => item.id === 'release-agent-3-0-0')?.status).toBe('OBSERVING')
  })

  it('allows a queued experiment with no runs and rejects a decision before completion', () => {
    const state = createInitialEvolutionData()
    const experiment = state.experiments.find((item) => item.id === 'exp-single-memory-latest')!
    const withoutRuns = { ...state, experimentRuns: state.experimentRuns.filter((run) => run.experimentId !== experiment.id), experiments: state.experiments.map((item) => item.id === experiment.id ? { ...item, runIds: [] } : item) }
    const decision: GateDecision = { id: 'gate-too-early', experimentId: experiment.id, conclusion: 'PASS', reason: '不应被接受。', riskNotes: [], decidedBy: '测试员', decidedAt: meta.at!, reportSnapshot: { variantIds: experiment.variantIds, datasetVersions: [], metricResults: [] } }

    const next = evolutionReducer(withoutRuns, { type: 'UPDATE_EXPERIMENT_DECISION', experimentId: experiment.id, decision, meta })

    expect(next).toBe(withoutRuns)
    expect(next.gateDecisions.some((item) => item.id === decision.id)).toBe(false)
  })

  it('runs a queued experiment through observable paired-arm lifecycle and leaves decision creation separate', () => {
    const state = createInitialEvolutionData()
    const experimentId = 'exp-single-memory-latest'
    const queued = { ...state, experimentRuns: state.experimentRuns.filter((run) => run.experimentId !== experimentId), experiments: state.experiments.map((item) => item.id === experimentId ? { ...item, status: 'QUEUED' as const, runIds: [], metrics: [], gateDecisionId: undefined } : item) }

    const running = evolutionReducer(queued, { type: 'START_EXPERIMENT_RUN', experimentId, caseIds: ['case-ppt-management', 'case-tool-export', 'case-multi-route'], meta: { ...meta, auditId: 'audit-run-start' } })
    expect(running.experiments.find((item) => item.id === experimentId)?.status).toBe('RUNNING')
    expect(running.experimentRuns.filter((item) => item.experimentId === experimentId).every((item) => item.status === 'RUNNING')).toBe(true)
    const next = evolutionReducer(running, { type: 'COMPLETE_EXPERIMENT_RUN', experimentId, meta: { ...meta, auditId: 'audit-run-complete' } })
    const experiment = next.experiments.find((item) => item.id === experimentId)!
    const runs = next.experimentRuns.filter((item) => item.experimentId === experimentId)

    expect(experiment.status).toBe('COMPLETED')
    expect(experiment.gateDecisionId).toBeUndefined()
    expect(runs).toHaveLength(18)
    expect(new Set(runs.map((item) => item.configHash))).toHaveLength(1)
    expect(runs.every((item) => item.status === 'COMPLETED' && item.processScore !== undefined && item.outcomeScore !== undefined)).toBe(true)
    expect(experiment.metrics.every((item) => item.gateStatus === 'PENDING')).toBe(true)
    expect(next.auditTrail.slice(-2).map((item) => item.action)).toEqual(['START_EXPERIMENT_RUN', 'COMPLETE_EXPERIMENT_RUN'])
  })

  it('uploads private assets and creates only planned personal Skills', () => {
    const state = createInitialEvolutionData()
    const asset: Asset = { id: 'asset-upload-test', name: '用户模板', kind: 'TEMPLATE', ownerId: 'user-test', visibility: 'PRIVATE', skillIds: [], sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED', createdAt: meta.at!, updatedAt: meta.at! }
    const uploaded = evolutionReducer(state, { type: 'UPLOAD_ASSET', asset, meta: { ...meta, auditId: 'audit-upload' } })
    const generated = evolutionReducer(uploaded, { type: 'CREATE_PLANNED_PERSONAL_SKILL', skill: { id: 'skill-upload-test', name: '个人模板 Skill（规划）', type: 'PERSONAL', version: '未生成', visibility: 'PRIVATE', evolutionRecordIds: [], assetIds: [asset.id], generationStatus: 'PLANNED', createdAt: meta.at!, updatedAt: meta.at! }, meta: { ...meta, auditId: 'audit-planned-skill' } })

    expect(uploaded.assets.find((item) => item.id === asset.id)).toMatchObject({ visibility: 'PRIVATE', publishStatus: 'NOT_PUBLISHED' })
    expect(generated.skills.find((item) => item.id === 'skill-upload-test')).toMatchObject({ type: 'PERSONAL', generationStatus: 'PLANNED', visibility: 'PRIVATE' })
    expect(generated.assets.find((item) => item.id === asset.id)?.skillIds).toContain('skill-upload-test')
  })

  it('ignores unsafe asset uploads and non-personal generated Skill requests', () => {
    const state = createInitialEvolutionData()
    const publicAsset: Asset = { id: 'asset-unsafe', name: '不安全公开资产', kind: 'DATA', ownerId: 'user-test', visibility: 'PUBLIC', skillIds: [], sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED', publishStatus: 'PUBLISHED', createdAt: meta.at!, updatedAt: meta.at! }
    const uploaded = evolutionReducer(state, { type: 'UPLOAD_ASSET', asset: publicAsset, meta })
    const officialSkill = evolutionReducer(uploaded, { type: 'CREATE_PLANNED_PERSONAL_SKILL', skill: { id: 'skill-official-invalid', name: '不应创建', type: 'OFFICIAL', version: '1', visibility: 'PUBLIC', evolutionRecordIds: [], assetIds: [], generationStatus: 'AVAILABLE', createdAt: meta.at!, updatedAt: meta.at! }, meta })

    expect(uploaded.assets.find((item) => item.id === publicAsset.id)).toMatchObject({ visibility: 'PRIVATE', sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED' })
    expect(officialSkill).toBe(uploaded)
  })

  it('creates a cluster and preserves multi-issue membership in both directions', () => {
    const state = createInitialEvolutionData()
    const cluster: IssueCluster = {
      id: 'cluster-multi-route', name: '跨 Office 多问题簇', description: '测试聚类写入。', module: 'Reason', dimension: '选择不正确或低效',
      caseIds: ['case-multi-route'], issueIds: ['issue-memory-context', 'issue-reason-tool'], evidenceIds: ['evidence-memory-miss', 'evidence-reason-plan'],
      variantIds: [], status: 'COLLECTING', currentCount: 1, countingRule: '按人工确认 Case 去重。', createdAt: meta.at, updatedAt: meta.at
    }

    const next = evolutionReducer(state, { type: 'CREATE_ISSUE_CLUSTER', cluster, meta })

    expect(next.issueClusters.find((item) => item.id === cluster.id)?.issueIds).toEqual(cluster.issueIds)
    expect(next.issues.find((item) => item.id === 'issue-memory-context')?.clusterIds).toContain(cluster.id)
    expect(next.issues.find((item) => item.id === 'issue-reason-tool')?.clusterIds).toContain(cluster.id)
    expect(next.auditTrail.at(-1)).toMatchObject({ action: 'CREATE_ISSUE_CLUSTER', entityId: cluster.id })
  })

  it('blocks a taste-library variant until the configured related-case threshold is reached', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
    const variant: Variant = { id: 'variant-taste-too-early', name: '过早品味变体', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '测试', changeContent: '测试', currentVersion: 'v1', candidateVersion: 'v2', sourceCaseIds: cluster.caseIds, sourceIssueIds: cluster.issueIds, sourceClusterIds: [cluster.id], evidenceIds: cluster.evidenceIds, status: 'DRAFT', experimentIds: [], createdAt: meta.at!, updatedAt: meta.at! }

    const next = evolutionReducer(state, { type: 'CREATE_VARIANT', variant, meta })

    expect(next).toBe(state)
    expect(next.variants.some((item) => item.id === variant.id)).toBe(false)
  })

  it('rejects cluster membership when the Case and issue do not match', () => {
    const state = createInitialEvolutionData()
    const next = evolutionReducer(state, { type: 'ADD_CASE_TO_CLUSTER', clusterId: 'cluster-ppt-routing-ready', caseId: 'case-tool-export', issueId: 'issue-memory-context', meta })

    expect(next).toBe(state)
    expect(next.issueClusters.find((item) => item.id === 'cluster-ppt-routing-ready')?.caseIds).not.toContain('case-tool-export')
  })

  it('creates an experiment with immutable configuration and links runs, variants, and its window', () => {
    const state = createInitialEvolutionData()
    const experiment: Experiment = {
      id: 'exp-reason-direct-fix', name: 'Reason 直接修复实验', level: 'SINGLE_VARIANT', variantIds: ['variant-reason-office-plan'], windowId: 'window-2026w36',
      datasetIds: ['dataset-attribution', 'dataset-regression'], configSnapshot: { datasetVersions: [{ datasetId: 'dataset-attribution', version: 'v1.4', versionId: 'dataset-attribution@v1.4', sampleCount: 3 }, { datasetId: 'dataset-regression', version: 'v1.2', versionId: 'dataset-regression@v1.2', sampleCount: 40 }], model: 'gpt-5.2-demo', toolPermissions: ['sheets.read'], timeoutMs: 120000, repeatCount: 3, runEnvironment: 'isolated-demo-runner', createdAt: meta.at },
      runIds: ['run-reason-baseline-1'], baselineVersion: 'reason-3.1.0', candidateVersion: 'reason-3.1.1-rc.1', metrics: [], failedCaseIds: [], rollbackItems: [], knownRisks: [], status: 'QUEUED',
      createdAt: meta.at, updatedAt: meta.at
    }
    const run: ExperimentRun = { id: 'run-reason-baseline-1', experimentId: experiment.id, caseId: 'case-multi-route', repetition: 1, arm: 'BASELINE', status: 'QUEUED', durationMs: 0, configHash: 'cfg-reason-v1', createdAt: meta.at, updatedAt: meta.at }

    const created = evolutionReducer(state, { type: 'CREATE_EXPERIMENT', experiment, runs: [run], meta })
    const next = evolutionReducer(created, { type: 'UPDATE_EXPERIMENT', experimentId: experiment.id, patch: { status: 'RUNNING', configSnapshot: { ...experiment.configSnapshot, repeatCount: 99 } } as never, meta: { ...meta, auditId: 'audit-experiment-update' } })

    expect(next.experiments.find((item) => item.id === experiment.id)?.configSnapshot.repeatCount).toBe(3)
    expect(next.experimentRuns.find((item) => item.id === run.id)).toMatchObject({ experimentId: experiment.id, arm: 'BASELINE' })
    expect(next.variants.find((item) => item.id === 'variant-reason-office-plan')?.experimentIds).toContain(experiment.id)
    expect(next.windows.find((item) => item.id === 'window-2026w36')?.singleExperimentIds).toContain(experiment.id)
  })

  it('updates release, rule, and asset workflows with audit history and publication safeguards', () => {
    const state = createInitialEvolutionData()
    const release: ReleaseVersion = {
      id: 'release-agent-3-1-0', version: 'agent-3.1.0', windowId: 'window-2026w35', variantIds: ['variant-ppt-routing-v3', 'variant-tool-retry-v2'],
      combinationExperimentId: 'exp-window-2026w35', gateDecisionId: 'gate-window-2026w35', approvedBy: '治理委员会', status: 'PENDING',
      rollbackVersionId: 'release-agent-3-0-0', createdAt: meta.at, updatedAt: meta.at
    }
    const created = evolutionReducer(state, { type: 'CREATE_RELEASE', release, meta: { ...meta, auditId: 'audit-release-create' } })
    const released = evolutionReducer(created, { type: 'UPDATE_RELEASE', releaseId: release.id, patch: { status: 'CANARY', releasedAt: meta.at }, meta: { ...meta, auditId: 'audit-release-update' } })
    const ruled = evolutionReducer(released, { type: 'UPDATE_RULE', ruleId: 'rule-gate-threshold', patch: { status: 'CONFIGURED', value: 0.8, unit: 'rate' }, meta: { ...meta, auditId: 'audit-rule' } })
    const privateAsset = ruled.assets.find((item) => item.id === 'asset-user-template') as Asset
    const rejectedPublish = evolutionReducer(ruled, { type: 'UPDATE_ASSET', assetId: privateAsset.id, patch: { visibility: 'PUBLIC', publishStatus: 'PUBLISHED' }, meta: { ...meta, auditId: 'audit-asset-invalid' } })
    const reviewed = evolutionReducer(rejectedPublish, { type: 'UPDATE_ASSET', assetId: privateAsset.id, patch: { sanitizationStatus: 'PASSED', reviewStatus: 'APPROVED' }, meta: { ...meta, auditId: 'audit-asset-review' } })
    const published = evolutionReducer(reviewed, { type: 'UPDATE_ASSET', assetId: privateAsset.id, patch: { visibility: 'PUBLIC', publishStatus: 'PUBLISHED' }, meta: { ...meta, auditId: 'audit-asset-publish' } })

    expect(released.releases.find((item) => item.id === release.id)?.status).toBe('CANARY')
    expect(ruled.rules.find((item) => item.id === 'rule-gate-threshold')).toMatchObject({ status: 'CONFIGURED', value: 0.8 })
    expect(rejectedPublish.assets.find((item) => item.id === privateAsset.id)).toMatchObject({ visibility: 'PRIVATE', publishStatus: 'NOT_PUBLISHED' })
    expect(published.assets.find((item) => item.id === privateAsset.id)).toMatchObject({ visibility: 'PUBLIC', publishStatus: 'PUBLISHED' })
    expect(published.auditTrail.map((item) => item.action)).toEqual(expect.arrayContaining(['CREATE_RELEASE', 'UPDATE_RELEASE', 'UPDATE_RULE', 'UPDATE_ASSET']))
  })

  it('creates, edits, and freezes a Dataset version while reconciling local membership', () => {
    const state = createInitialEvolutionData()
    const dataset: Dataset = {
      id: 'dataset-user-attribution-v1', name: '用户归因集', type: 'ATTRIBUTION', version: 'v1', caseIds: ['case-ppt-management'],
      sampleCount: 1, source: '本地 Mock Case', scope: '管理层 PPT 归因样本', frozen: false,
      population: { totalSampleCount: 1, localCaseCount: 1, externalSampleCount: 0, sourceSystem: '本地 Mock Case', countingRule: '本地 Case ID 去重计数。' },
      createdAt: meta.at!, updatedAt: meta.at!
    }

    const created = evolutionReducer(state, { type: 'CREATE_DATASET_VERSION', dataset, meta: { ...meta, auditId: 'audit-dataset-create' } })
    const edited = evolutionReducer(created, { type: 'UPDATE_DATASET_VERSION', datasetId: dataset.id, patch: { scope: 'PPT 与 Excel 归因样本', source: '人工筛选 Mock Case' }, meta: { ...meta, auditId: 'audit-dataset-edit' } })
    const withMember = evolutionReducer(edited, { type: 'SET_DATASET_MEMBERS', datasetId: dataset.id, caseIds: ['case-ppt-management', 'case-tool-export'], meta: { ...meta, auditId: 'audit-dataset-member' } })
    const frozen = evolutionReducer(withMember, { type: 'FREEZE_DATASET_VERSION', datasetId: dataset.id, meta: { ...meta, auditId: 'audit-dataset-freeze' } })

    expect(frozen.datasets.find((item) => item.id === dataset.id)).toMatchObject({
      scope: 'PPT 与 Excel 归因样本', source: '人工筛选 Mock Case', frozen: true, sampleCount: 2,
      caseIds: ['case-ppt-management', 'case-tool-export'], population: { totalSampleCount: 2, localCaseCount: 2, externalSampleCount: 0 }
    })
    expect(frozen.auditTrail.slice(-4).map((item) => item.action)).toEqual(['CREATE_DATASET_VERSION', 'UPDATE_DATASET_VERSION', 'SET_DATASET_MEMBERS', 'FREEZE_DATASET_VERSION'])
    expect(validateEvolutionState(frozen)).toEqual([])
  })

  it('rejects frozen Dataset mutation and requires a new version for later edits', () => {
    const state = createInitialEvolutionData()
    const frozen = state.datasets.find((item) => item.id === 'dataset-attribution')!
    const attempted = evolutionReducer(state, { type: 'SET_DATASET_MEMBERS', datasetId: frozen.id, caseIds: ['case-tool-export'], meta })
    const attemptedDetails = evolutionReducer(state, { type: 'UPDATE_DATASET_VERSION', datasetId: frozen.id, patch: { scope: '不应写入' }, meta })
    const nextVersion = evolutionReducer(attempted, { type: 'CREATE_DATASET_VERSION', dataset: { ...frozen, id: 'dataset-attribution-v1-5', version: 'v1.5', frozen: false, caseIds: ['case-ppt-management', 'case-tool-export'], sampleCount: 2, population: { ...frozen.population, totalSampleCount: 2, localCaseCount: 2, externalSampleCount: 0 }, createdAt: meta.at!, updatedAt: meta.at! }, sourceDatasetId: frozen.id, meta: { ...meta, auditId: 'audit-dataset-new-version' } })

    expect(attempted).toBe(state)
    expect(attemptedDetails).toBe(state)
    expect(nextVersion.datasets.find((item) => item.id === frozen.id)?.caseIds).toEqual(frozen.caseIds)
    expect(nextVersion.datasets.find((item) => item.id === 'dataset-attribution-v1-5')).toMatchObject({ version: 'v1.5', frozen: false, caseIds: ['case-ppt-management', 'case-tool-export'] })
  })

  it('keeps old Experiment Dataset snapshots immutable after creating and editing a later Dataset version', () => {
    const state = createInitialEvolutionData()
    const experiment = state.experiments.find((item) => item.id === 'exp-single-ppt-routing')!
    const snapshotBefore = structuredClone(experiment.configSnapshot.datasetVersions)
    const source = state.datasets.find((item) => item.id === 'dataset-attribution')!

    const versioned = evolutionReducer(state, { type: 'CREATE_DATASET_VERSION', dataset: { ...source, id: 'dataset-attribution-v2', version: 'v2.0', frozen: false, caseIds: source.caseIds, createdAt: meta.at!, updatedAt: meta.at! }, sourceDatasetId: source.id, meta })
    const edited = evolutionReducer(versioned, { type: 'SET_DATASET_MEMBERS', datasetId: 'dataset-attribution-v2', caseIds: ['case-tool-export'], meta: { ...meta, auditId: 'audit-v2-member' } })

    expect(edited.experiments.find((item) => item.id === experiment.id)?.configSnapshot.datasetVersions).toEqual(snapshotBefore)
    expect(edited.datasets.find((item) => item.id === source.id)).toEqual(source)
    expect(edited.datasets.find((item) => item.id === 'dataset-attribution-v2')?.caseIds).toEqual(['case-tool-export'])
  })
})
