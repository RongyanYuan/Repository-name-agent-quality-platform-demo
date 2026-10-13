import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvaluationFinding, EvolutionRecord } from '../domain'
import { resolveIdentity } from '../identity'
import { automaticModuleRevisionId } from '../reviews'
import { buildEvolutionWorkbenchHref, groupModuleEvolutionDirections, selectEvolutionRecord, selectModuleEvolution } from './moduleEvolution'

const stamp = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z' }

// Complete entity templates preserve the real state shape; all relationship IDs
// and expected statuses below are independently chosen for isolation tests.
function fixture() {
  const state = createInitialEvolutionData()
  const traceId = resolveIdentity(state, 'trace', 'trace-ppt-generate')
  const pkg = structuredClone(state.tracePackages.find(item => item.traceId === traceId)!)
  pkg.id = 'module-package'; pkg.moduleScores = [structuredClone(pkg.moduleScores.find(item => item.moduleCode === 'SKILL')!)]
  const score = pkg.moduleScores[0]
  score.id = 'module-score'; score.packageId = pkg.id; score.automaticRevisionId = 'automatic-v1'; score.score = 1.6; score.scoreScale = '0-2'; score.automaticStatus = 'PASS'
  state.tracePackages = [pkg]
  const finding: EvaluationFinding = { ...structuredClone(state.evaluationFindings.find(item => item.moduleCode === 'SKILL')!), ...stamp, id: 'finding-sop', packageId: pkg.id, traceId, caseId: pkg.caseId, moduleCode: 'SKILL', dimensionCode: 'skill-sop', dimensionLabel: 'skill sop错误', status: 'CONFIRMED', routingDecisionIds: ['route-agent'], routingDeliveryIds: ['delivery-agent'] }
  state.evaluationFindings = [finding]
  state.attributions = [{ ...structuredClone(state.attributions.find(item => item.module === 'Skill')!), ...stamp, id: 'attr-sop', traceId, caseId: pkg.caseId, module: 'Skill', dimension: 'skill sop错误', optimizationMode: 'DIRECT_FIX', status: 'CONFIRMED', confirmed: true, revisions: [] }]
  state.issues = [{ ...structuredClone(state.issues[0]), ...stamp, id: 'issue-sop', caseId: pkg.caseId, attributionId: 'attr-sop', module: 'Skill', dimension: 'skill sop错误', status: 'CONFIRMED', optimizationMode: 'DIRECT_FIX', clusterIds: [], variantIds: ['variant-sop'] }]
  state.issueClusters = []
  const target = { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop', evolutionItemId: 'skill-sop' }
  state.variants = [{ ...structuredClone(state.variants[0]), ...stamp, id: 'variant-sop', targetModule: 'Skill', targets: [target], currentVersion: '2.5.0', candidateVersion: '2.5.1', sourceCaseIds: [pkg.caseId], sourceIssueIds: ['issue-sop'], sourceClusterIds: [], experimentIds: ['experiment-single', 'experiment-window'] }]
  state.datasets = [{ ...structuredClone(state.datasets[0]), ...stamp, id: 'dataset-sop', name: 'SOP原始归因集A', version: '1.0', caseIds: [pkg.caseId], targets: [target], purpose: '原始归因集', frozen: true }]
  const config = { ...structuredClone(state.experiments[0].configSnapshot), datasetVersions: [{ datasetId: 'dataset-sop', version: '1.0', versionId: 'dataset-sop@1.0', sampleCount: 1 }], windowSnapshot: undefined }
  state.experiments = [
    { ...structuredClone(state.experiments[0]), ...stamp, id: 'experiment-single', level: 'SINGLE_VARIANT', variantIds: ['variant-sop'], candidateVersion: '2.5.1', datasetIds: ['dataset-sop'], targets: [target], configSnapshot: config, gateDecisionId: 'decision-single', status: 'DECIDED' },
    { ...structuredClone(state.experiments[0]), ...stamp, id: 'experiment-window', createdAt: '2026-10-02T00:00:00Z', level: 'WINDOW_COMBINATION', windowId: 'window-sop', variantIds: ['variant-sop'], candidateVersion: 'agent-window-1', datasetIds: ['dataset-sop'], targets: [target], configSnapshot: { ...structuredClone(config), windowSnapshot: { windowId: 'window-sop', candidateVariantIds: ['variant-sop'] } }, gateDecisionId: 'decision-window', status: 'DECIDED' }
  ]
  state.windows = [{ ...structuredClone(state.windows[0]), ...stamp, id: 'window-sop', candidateVariantIds: ['variant-sop'], singleExperimentIds: ['experiment-single'], combinationExperimentId: 'experiment-window' }]
  state.gateDecisions = state.experiments.map((exp, index) => ({ id: exp.gateDecisionId!, experimentId: exp.id, conclusion: 'PASS', reason: '人工确认实验结果改善', riskNotes: [], decidedBy: '验收员', decidedAt: `2026-10-0${index + 3}T00:00:00Z`, reportSnapshot: { experimentId: exp.id, variantIds: [...exp.variantIds], datasetVersions: [{ datasetId: 'dataset-sop', version: '1.0' }], metricResults: structuredClone(exp.metrics), configSnapshot: structuredClone(exp.configSnapshot) }, decisionBasis: 'HUMAN_REVIEW' }))
  state.releases = []
  state.routingDecisions = [{ ...structuredClone(state.routingDecisions[0]), ...stamp, id: 'route-agent', findingId: finding.id, traceId, packageId: pkg.id, destination: 'DIRECT_FIX', label: 'Agent迭代', status: 'DELIVERED', deliveryIds: ['delivery-agent'] }]
  state.routingDeliveries = [{ ...structuredClone(state.routingDeliveries[0]), ...stamp, id: 'delivery-agent', findingId: finding.id, decisionId: 'route-agent', traceId, caseId: pkg.caseId, packageId: pkg.id, label: 'Agent迭代', destination: 'DIRECT_FIX', status: 'ACKNOWLEDGED', issueId: 'issue-sop', issueClusterId: undefined, variantId: 'variant-sop', deliveredAt: '2026-10-02T01:00:00Z', acknowledgedAt: '2026-10-02T02:00:00Z' }]
  state.governanceEvents = []; state.auditTrail = []
  const record: EvolutionRecord = { ...stamp, id: 'record-sop', name: 'SOP第1轮', target: { kind: 'SKILL', governanceObject: 'Skill', skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop' }, origin: 'MOCK', sourceFindingIds: [finding.id], sourceAttributionIds: ['attr-sop'], sourceIssueIds: ['issue-sop'], sourceClusterIds: [], optimizationMode: 'DIRECT_FIX', routingDeliveryIds: ['delivery-agent'], datasetIds: ['dataset-sop'], variantIds: ['variant-sop'], singleExperimentIds: ['experiment-single'], windowExperimentIds: ['experiment-window'], decisionIds: ['decision-single', 'decision-window'], releaseIds: [] }
  state.evolutionRecords = [record]
  state.moduleEvolutionBindings = [{ id: 'binding-sop', traceId, packageId: pkg.id, moduleScoreId: score.id, automaticRevisionId: 'automatic-v1', findingId: finding.id, attributionRecordId: 'attr-sop', evolutionRecordIds: ['record-sop'], createdAt: stamp.createdAt, origin: 'MOCK' }]
  return { state, query: { traceId, packageId: pkg.id, moduleScoreId: score.id }, score, finding, record, pkg }
}

function historicalPackageFixture() {
  const value = fixture()
  const { state, pkg, finding, record } = value
  const oldScore = { ...structuredClone(pkg.moduleScores[0]), id: 'old-module-score', packageId: 'old-module-package', automaticRevisionId: 'old-automatic-v1' }
  const oldPackage = { ...structuredClone(pkg), id: 'old-module-package', createdAt: '2026-09-01T00:00:00Z', moduleScores: [oldScore] }
  state.tracePackages.push(oldPackage)
  const oldFinding = { ...structuredClone(finding), id: 'old-finding-sop', packageId: oldPackage.id, routingDecisionIds: [], routingDeliveryIds: [] }
  state.evaluationFindings.push(oldFinding)
  const oldRecord = { ...structuredClone(record), id: 'old-record-sop', sourceFindingIds: [oldFinding.id], routingDeliveryIds: [], createdAt: oldPackage.createdAt }
  state.evolutionRecords!.push(oldRecord)
  const oldBinding = { ...structuredClone(state.moduleEvolutionBindings![0]), id: 'old-binding-sop', packageId: oldPackage.id, moduleScoreId: oldScore.id, automaticRevisionId: 'old-automatic-v1', findingId: oldFinding.id, evolutionRecordIds: [oldRecord.id] }
  state.moduleEvolutionBindings!.push(oldBinding)
  return { ...value, oldPackage, oldScore, oldFinding, oldRecord, oldBinding }
}

describe('exact module-attribution evolution provenance', () => {
  it('follows confirmed direct-fix sources even with PASS and a high score, separates gate from release, and never mutates frozen inputs', () => {
    const { state, query } = fixture(); const before = structuredClone(state)
    const selection = selectModuleEvolution(state, query)
    expect(selection.currentPaths).toHaveLength(1)
    expect(selection.currentPaths[0]).toMatchObject({ eligibility: { code: 'CONFIRMED', label: '可直接优化' }, singleGate: { code: 'PASS' }, windowGate: { code: 'PASS' }, gate: { code: 'PASS' }, release: { code: 'PENDING', label: '待发布' } })
    expect(selection.currentPaths[0].datasets.map(item => item.id)).toEqual(['dataset-sop'])
    expect(state).toEqual(before)
  })

  it('preserves exact issue, cluster and candidate creation times without inventing later status events from updatedAt', () => {
    const { state, query, record } = fixture()
    state.issues[0].createdAt = '2026-09-21T01:00:00Z'; state.issues[0].updatedAt = '2026-10-11T11:00:00Z'
    const cluster = { ...structuredClone(createInitialEvolutionData().issueClusters[0]), id: 'cluster-sop', dimension: 'skill sop错误', issueIds: ['issue-sop'], createdAt: '2026-09-22T01:00:00Z', updatedAt: '2026-10-11T11:00:00Z' }
    state.issueClusters = [cluster]; record.sourceClusterIds = [cluster.id]
    state.variants[0].createdAt = '2026-09-23T01:00:00Z'; state.variants[0].updatedAt = '2026-10-11T11:00:00Z'
    const before = structuredClone(state)
    const history = selectModuleEvolution(state, query).currentPaths[0].history
    expect(history.find(item => item.label === '问题建立')).toMatchObject({ at: '2026-09-21T01:00:00Z', refs: [{ kind: 'issue', id: 'issue-sop' }] })
    expect(history.find(item => item.label === '问题簇建立')).toMatchObject({ at: '2026-09-22T01:00:00Z', refs: [{ kind: 'cluster', id: 'cluster-sop' }] })
    expect(history.find(item => item.label === '候选变体建立')).toMatchObject({ at: '2026-09-23T01:00:00Z', refs: [{ kind: 'variant', id: 'variant-sop' }] })
    expect(history.some(item => item.at === '2026-10-11T11:00:00Z')).toBe(false)
    expect(state).toEqual(before)
  })

  it('does not guess missing bindings from Case, Skill, low scores or regression membership', () => {
    const { state, query, score } = fixture(); score.score = 0; state.moduleEvolutionBindings = []
    expect(selectModuleEvolution(state, query)).toMatchObject({ currentPaths: [], historicalPaths: [], summary: '未关联进化路径' })
  })

  it('rejects cross-Trace, cross-package, cross-module and wrong attribution bindings', () => {
    for (const property of ['traceId', 'packageId', 'moduleScoreId', 'findingId'] as const) {
      const { state, query } = fixture(); state.moduleEvolutionBindings![0][property] = 'unrelated'
      expect(selectModuleEvolution(state, query).currentPaths, property).toHaveLength(0)
    }
    const { state, query, finding } = fixture(); finding.moduleCode = 'MEMORY'; state.evolutionRecords![0].target.attributionId = 'taste-recall'
    expect(selectModuleEvolution(state, query).currentPaths).toHaveLength(0)
  })

  it('keeps old automatic revisions historical instead of claiming current progress', () => {
    const { state, query, score } = fixture(); score.automaticRevisionId = 'automatic-v2'
    const selection = selectModuleEvolution(state, query)
    expect(selection.currentPaths).toHaveLength(0); expect(selection.historicalPaths).toHaveLength(1)
    expect(selectModuleEvolution(state, { ...query, automaticRevisionId: 'automatic-v1' }).currentPaths).toHaveLength(1)
  })

  it('includes previous package versions of this exact scored Trace module as history without reviving their states', () => {
    const { state, query, oldBinding } = historicalPackageFixture()
    state.moduleEvolutionBindings!.push({ ...structuredClone(oldBinding), id: 'old-binding-fine', scoreDimensionId: 'previous-sop-check' })
    const before = structuredClone(state)
    const selection = selectModuleEvolution(state, query)
    expect(selection.currentPaths.map(item => item.record.id)).toEqual(['record-sop'])
    expect(selection.historicalPaths.map(item => item.record.id)).toEqual(['old-record-sop'])
    expect(selection.historicalPaths[0]).toMatchObject({ isHistorical: true, binding: { packageId: 'old-module-package', moduleScoreId: 'old-module-score', automaticRevisionId: 'old-automatic-v1' } })
    expect(selectModuleEvolution(state, { ...query, automaticRevisionId: 'old-automatic-v1' }).currentPaths).toHaveLength(0)
    expect(state).toEqual(before)
  })

  it('retains explicitly distinct historical scores even when package, record and automatic revision identities coincide', () => {
    const { state, query, oldPackage, oldScore, oldBinding } = historicalPackageFixture()
    const otherScore = { ...structuredClone(oldScore), id: 'old-fine-module-score' }
    oldPackage.moduleScores.push(otherScore)
    state.moduleEvolutionBindings!.push({ ...structuredClone(oldBinding), id: 'old-other-score-binding', moduleScoreId: otherScore.id })
    const selection = selectModuleEvolution(state, query)
    expect(selection.historicalPaths.map(item => item.binding?.moduleScoreId)).toEqual(['old-module-score', 'old-fine-module-score'])
    expect(groupModuleEvolutionDirections(selection)[0].historicalPaths).toHaveLength(2)
    oldPackage.createdAt = '2026-12-01T00:00:00Z'
    expect(selectModuleEvolution(state, query).historicalPaths).toHaveLength(0)
  })

  it('requires real same Trace, Case, package and module score provenance for old package history', () => {
    for (const invalid of ['trace', 'case', 'module', 'score', 'finding-package'] as const) {
      const { state, query, oldPackage, oldScore, oldFinding } = historicalPackageFixture()
      if (invalid === 'trace') { oldPackage.traceId = 'different-trace'; oldScore.traceId = 'different-trace'; oldFinding.traceId = 'different-trace' }
      if (invalid === 'case') { oldPackage.caseId = 'different-case'; oldScore.caseId = 'different-case'; oldFinding.caseId = 'different-case' }
      if (invalid === 'module') { oldScore.moduleCode = 'MEMORY'; oldFinding.moduleCode = 'MEMORY' }
      if (invalid === 'score') oldScore.packageId = 'different-package'
      if (invalid === 'finding-package') oldFinding.packageId = 'different-package'
      expect(selectModuleEvolution(state, query).historicalPaths, invalid).toHaveLength(0)
    }
  })

  it('keeps detailed history exact to its evaluation and dimension IDs rather than matching labels across packages', () => {
    const { state, query, oldBinding } = historicalPackageFixture()
    const currentEval = state.processEvals.find(item => item.traceId === query.traceId)!
    const oldEval = { ...structuredClone(currentEval), id: 'old-process-detail' }
    state.processEvals.push(oldEval)
    state.moduleEvolutionBindings![0].processEvaluationId = currentEval.id; state.moduleEvolutionBindings![0].scoreDimensionId = 'current-sop-check'
    oldBinding.processEvaluationId = oldEval.id; oldBinding.scoreDimensionId = 'old-sop-check'
    const detail = selectModuleEvolution(state, { ...query, processEvaluationId: currentEval.id, scoreDimensionId: 'current-sop-check' })
    expect(detail.currentPaths).toHaveLength(1); expect(detail.historicalPaths).toHaveLength(0)
    expect(selectModuleEvolution(state, query).historicalPaths).toHaveLength(1)
    oldBinding.processEvaluationId = currentEval.id; oldBinding.scoreDimensionId = 'current-sop-check'
    expect(selectModuleEvolution(state, { ...query, processEvaluationId: currentEval.id, scoreDimensionId: 'current-sop-check' }).historicalPaths).toHaveLength(1)
  })

  it('groups current and historical paths by precise target version and attribution while retaining parallel destinations in one direction', () => {
    const { state, query, record, finding } = historicalPackageFixture()
    const strategy = { ...structuredClone(state.routingDeliveries[0]), id: 'delivery-strategy', decisionId: 'route-strategy', label: '策略迭代' as const, destination: 'ALGORITHM_BADCASE' as const, variantId: undefined }
    state.routingDeliveries.push(strategy)
    state.routingDecisions.push({ ...structuredClone(state.routingDecisions[0]), id: 'route-strategy', label: strategy.label, destination: strategy.destination, deliveryIds: [strategy.id] })
    finding.routingDeliveryIds.push(strategy.id); finding.routingDecisionIds.push('route-strategy')
    const strategyRecord = { ...structuredClone(record), id: 'strategy-record', routingDeliveryIds: [strategy.id], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [] }
    const newVersion = { ...structuredClone(strategyRecord), id: 'next-version-record', target: { kind: 'SKILL' as const, governanceObject: 'Skill' as const, skillId: 'skill-ppt-builder', skillVersion: '2.6.0', attributionId: 'skill-sop' } }
    state.evolutionRecords!.push(strategyRecord, newVersion); state.moduleEvolutionBindings![0].evolutionRecordIds.push(strategyRecord.id, newVersion.id)
    const selection = selectModuleEvolution(state, query)
    const directions = groupModuleEvolutionDirections(selection)
    expect(directions).toHaveLength(2)
    const original = directions.find(item => item.target.kind === 'SKILL' && item.target.skillVersion === '2.5.0')!
    expect(original.attributionId).toBe('skill-sop')
    expect(original.currentPaths.map(item => item.record.id)).toEqual(['record-sop', 'strategy-record'])
    expect(original.historicalPaths.map(item => item.record.id)).toEqual(['old-record-sop'])
    expect(groupModuleEvolutionDirections({ ...selection, currentPaths: [...selection.currentPaths].reverse() }).find(item => item.target.kind === 'SKILL' && item.target.skillVersion === '2.5.0')!.id).toBe(original.id)
    const differentAttribution = { ...structuredClone(original.currentPaths[0]), id: 'different-attribution-path', record: { ...structuredClone(record), target: { kind: 'SKILL' as const, governanceObject: 'Skill' as const, skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'taste-recall' } } }
    const differentObject = { ...structuredClone(original.currentPaths[0]), id: 'memory-target-path', record: { ...structuredClone(record), target: { kind: 'MODULE' as const, governanceObject: 'Memory' as const, targetId: 'skill-ppt-builder', targetVersion: '2.5.0', attributionId: 'skill-sop' } } }
    expect(groupModuleEvolutionDirections({ ...selection, currentPaths: [...selection.currentPaths, differentAttribution, differentObject] })).toHaveLength(4)
  })

  it('filters exact score detail and process evaluation IDs without borrowing another dimension', () => {
    const { state, query } = fixture()
    const evaluation = state.processEvals.find(item => item.traceId === query.traceId)!
    state.moduleEvolutionBindings![0].processEvaluationId = evaluation.id; state.moduleEvolutionBindings![0].scoreDimensionId = 'sop-plan'
    expect(selectModuleEvolution(state, { ...query, processEvaluationId: evaluation.id, scoreDimensionId: 'sop-plan' }).currentPaths).toHaveLength(1)
    expect(selectModuleEvolution(state, { ...query, scoreDimensionId: 'taste-style' }).currentPaths).toHaveLength(0)
    state.processEvals = state.processEvals.filter(item => item.id !== evaluation.id)
    expect(selectModuleEvolution(state, query).currentPaths).toHaveLength(0)
  })

  it('keeps a newer pending cycle independent and preserves the superseded cycle in history', () => {
    const { state, query, record } = fixture()
    state.evolutionRecords!.push({ ...structuredClone(record), id: 'record-next', supersedesRecordId: record.id, createdAt: '2026-10-10T00:00:00Z', variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [] })
    state.moduleEvolutionBindings![0].evolutionRecordIds.push('record-next')
    const selection = selectModuleEvolution(state, query)
    expect(selection.currentPaths.map(item => item.record.id)).toEqual(['record-next'])
    expect(selection.currentPaths[0].gate.code).toBe('PENDING'); expect(selection.currentPaths[0].release.code).toBe('UNKNOWN')
    expect(selection.historicalPaths[0].record.id).toBe('record-sop'); expect(selection.historicalPaths[0].gate.code).toBe('PASS')
  })

  it('shows multiple delivery paths independently, leaving strategy ACK waiting for an actual return', () => {
    const { state, query, record, finding } = fixture()
    const strategy = { ...structuredClone(state.routingDeliveries[0]), id: 'delivery-strategy', decisionId: 'route-strategy', label: '策略迭代' as const, destination: 'ALGORITHM_BADCASE' as const, variantId: undefined }
    state.routingDeliveries.push(strategy)
    state.routingDecisions.push({ ...structuredClone(state.routingDecisions[0]), id: 'route-strategy', label: strategy.label, destination: strategy.destination, deliveryIds: [strategy.id] })
    finding.routingDeliveryIds.push(strategy.id); finding.routingDecisionIds.push('route-strategy')
    state.evolutionRecords!.push({ ...structuredClone(record), id: 'record-strategy', routingDeliveryIds: [strategy.id], datasetIds: [], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [] })
    state.moduleEvolutionBindings![0].evolutionRecordIds.push('record-strategy')
    const paths = selectModuleEvolution(state, query).currentPaths
    expect(paths).toHaveLength(2)
    expect(paths.find(item => item.record.id === 'record-strategy')).toMatchObject({ routing: { code: 'ACKNOWLEDGED', label: '已接收，等待回传' }, gate: { code: 'PENDING', label: '等待回传' }, release: { code: 'UNKNOWN' } })
    expect(paths.find(item => item.record.id === 'record-sop')?.gate.code).toBe('PASS')
  })

  it('deduplicates a shared path across its module and fine score bindings', () => {
    const { state, query } = fixture()
    state.moduleEvolutionBindings!.push({ ...structuredClone(state.moduleEvolutionBindings![0]), id: 'binding-fine', scoreDimensionId: 'sop-plan' })
    expect(selectModuleEvolution(state, query).currentPaths).toHaveLength(1)
    expect(selectModuleEvolution(state, { ...query, scoreDimensionId: 'sop-plan' }).currentPaths).toHaveLength(1)
  })

  it('honors explicit supersession when a new finding starts the same target cycle', () => {
    const { state, query, record, finding } = fixture()
    const nextFinding = { ...structuredClone(finding), id: 'finding-next' }
    state.evaluationFindings.push(nextFinding)
    state.evolutionRecords!.push({ ...structuredClone(record), id: 'record-next', supersedesRecordId: record.id, sourceFindingIds: [nextFinding.id], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [] })
    state.moduleEvolutionBindings!.push({ ...structuredClone(state.moduleEvolutionBindings![0]), id: 'binding-next', findingId: nextFinding.id, evolutionRecordIds: ['record-next'] })
    const selection = selectModuleEvolution(state, query)
    expect(selection.currentPaths.map(item => item.record.id)).toEqual(['record-next'])
    expect(selection.historicalPaths.map(item => item.record.id)).toEqual(['record-sop'])
  })

  it('does not lend an Agent branch report to a strategy delivery sharing the same source finding and record', () => {
    const { state, query, record, finding } = fixture()
    const strategy = { ...structuredClone(state.routingDeliveries[0]), id: 'delivery-strategy', decisionId: 'route-strategy', label: '策略迭代' as const, destination: 'ALGORITHM_BADCASE' as const, variantId: undefined }
    state.routingDeliveries.push(strategy)
    state.routingDecisions.push({ ...structuredClone(state.routingDecisions[0]), id: 'route-strategy', label: strategy.label, destination: strategy.destination, deliveryIds: [strategy.id] })
    finding.routingDeliveryIds.push(strategy.id); finding.routingDecisionIds.push('route-strategy'); record.routingDeliveryIds.push(strategy.id)
    const paths = selectModuleEvolution(state, query).currentPaths
    expect(paths).toHaveLength(2)
    const strategyPath = paths.find(item => item.delivery?.id === strategy.id)!
    expect({ gate: strategyPath.gate.label, release: strategyPath.release.code, experiments: strategyPath.experiments.map(item => item.id) }).toEqual({ gate: '等待回传', release: 'UNKNOWN', experiments: [] })
    expect(paths.find(item => item.delivery?.id === 'delivery-agent')?.gate.code).toBe('PASS')
  })
})

describe('configured eligibility and exact downstream states', () => {
  it('requires attribution confirmation rather than interpreting low numeric scores as a trigger', () => {
    const { state, query, finding } = fixture(); finding.status = 'OPEN'; state.attributions[0].confirmed = false; state.attributions[0].status = 'PENDING'
    expect(selectModuleEvolution(state, query).currentPaths[0].eligibility).toMatchObject({ code: 'PENDING', label: '待确认' })
  })
  it('keeps Context evidence-only even if it carries malformed candidate bindings', () => {
    const { state, query, score } = fixture(); score.moduleCode = 'CONTEXT'
    expect(selectModuleEvolution(state, query)).toMatchObject({ contextOnly: true, currentPaths: [], historicalPaths: [] })
  })
  it('does not allow PRD clustering dimensions to silently choose direct optimization', () => {
    const { state, query, record, finding } = fixture(); record.target.attributionId = 'taste-recall'; finding.dimensionCode = 'taste-recall'; finding.dimensionLabel = '品味库召回错误'; state.attributions[0].dimension = '品味库召回错误'; state.issues[0].dimension = '品味库召回错误'
    expect(selectModuleEvolution(state, query).currentPaths[0].eligibility).toMatchObject({ code: 'UNKNOWN', label: '优化方式待确认' })
  })
  it('shows unconfigured clustering rules even when stored cluster counts exceed 100', () => {
    const { state, query, record, finding } = fixture(); record.optimizationMode = 'CLUSTER_OPTIMIZATION'; record.target.attributionId = 'taste-recall'; finding.dimensionCode = 'taste-recall'; finding.dimensionLabel = '品味库召回错误'; state.attributions[0].dimension = '品味库召回错误'; state.attributions[0].optimizationMode = 'CLUSTER_OPTIMIZATION'; state.issues[0].dimension = '品味库召回错误'
    const template = createInitialEvolutionData().issueClusters[0]
    state.issueClusters = [{ ...structuredClone(template), id: 'cluster-taste', issueIds: ['issue-sop'], caseIds: [finding.caseId], module: 'Skill', dimension: '品味库召回错误', currentCount: 150, triggerRuleId: undefined, threshold: 100, countingRule: '按确认Case去重', tastePopulation: undefined }]; record.sourceClusterIds = ['cluster-taste']; record.triggerRuleId = undefined
    expect(selectModuleEvolution(state, query).currentPaths[0].eligibility).toMatchObject({ code: 'UNKNOWN', label: '规则待配置', count: 150 })
  })
  it('uses the configured taste rule confirmed related Case count, not 950 preference users or an arbitrary cluster counter', () => {
    const { state, query, record, finding } = fixture(); record.optimizationMode = 'CLUSTER_OPTIMIZATION'; record.target.attributionId = 'taste-recall'; finding.dimensionCode = 'taste-recall'; finding.dimensionLabel = '品味库召回错误'; state.attributions[0].dimension = '品味库召回错误'; state.attributions[0].optimizationMode = 'CLUSTER_OPTIMIZATION'; state.issues[0].dimension = '品味库召回错误'
    state.cases.find(item => item.id === finding.caseId)!.status = 'CONFIRMED'
    const template = createInitialEvolutionData().issueClusters[0]
    state.issueClusters = [{ ...structuredClone(template), id: 'cluster-taste', issueIds: ['issue-sop'], caseIds: [finding.caseId], module: 'Skill', dimension: '品味库召回错误', currentCount: 950, triggerRuleId: 'rule-taste-100', threshold: 100, countingRule: '按确认Case去重', evidenceIds: state.attributions[0].evidenceIds, tastePopulation: { skillId: 'skill-ppt-builder', externalMockConfirmedCaseCount: 98, snapshotId: 'related-case-98', source: 'Mock确认Case快照', countedAt: '2026-10-02T00:00:00Z' } }]; record.sourceClusterIds = ['cluster-taste']; record.triggerRuleId = 'rule-taste-100'
    expect(selectModuleEvolution(state, query).currentPaths[0].eligibility).toMatchObject({ code: 'PENDING', label: '积累中', count: 99, threshold: 100 })
    state.issueClusters[0].tastePopulation!.externalMockConfirmedCaseCount = 99
    expect(selectModuleEvolution(state, query).currentPaths[0].eligibility).toMatchObject({ code: 'CONFIRMED', label: '条件满足', count: 100, threshold: 100 })
  })
  it('rejects variant coverage without source issue/cluster edges and mismatched candidate experiment reports', () => {
    const { state, query } = fixture(); state.variants[0].sourceIssueIds = []; state.variants[0].sourceClusterIds = []
    expect(selectModuleEvolution(state, query).currentPaths[0].experiments).toHaveLength(0)
    expect(selectModuleEvolution(state, query).currentPaths[0].gate.code).toBe('PENDING')
    const valid = fixture(); valid.state.experiments[0].candidateVersion = 'unrelated-version'
    expect(selectModuleEvolution(valid.state, valid.query).currentPaths[0].singleGate.code).not.toBe('PASS')
    expect(selectModuleEvolution(valid.state, valid.query).currentPaths[0].windowGate.code).not.toBe('PASS')
  })
  it('requires exact gate snapshot variants and datasets rather than borrowing another passed report', () => {
    const { state, query } = fixture(); state.gateDecisions[1].reportSnapshot.variantIds = ['unrelated-variant']
    expect(selectModuleEvolution(state, query).currentPaths[0].windowGate.code).not.toBe('PASS')
    state.gateDecisions[0].reportSnapshot.datasetVersions[0].version = 'old-version'
    expect(selectModuleEvolution(state, query).currentPaths[0].singleGate.code).not.toBe('PASS')
  })
  it('rejects a single candidate report measured against another source baseline version', () => {
    const { state, query } = fixture()
    const experiment = state.experiments.find(item => item.id === 'experiment-single')!
    experiment.baselineVersion = '9.9.9'
    state.gateDecisions.find(item => item.id === 'decision-single')!.reportSnapshot.configSnapshot = structuredClone(experiment.configSnapshot)
    expect(selectModuleEvolution(state, query).currentPaths[0].singleGate.code).not.toBe('PASS')
    expect(selectModuleEvolution(state, query).currentPaths[0].windowGate.code).not.toBe('PASS')
  })
  it('does not use candidate B single approval to admit a window containing rejected candidate A', () => {
    const { state, query, record } = fixture()
    state.gateDecisions.find(item => item.id === 'decision-single')!.conclusion = 'REJECT'
    const otherVariant = { ...structuredClone(state.variants[0]), id: 'variant-other', candidateVersion: '2.5.2', experimentIds: ['experiment-other-single'] }
    state.variants.push(otherVariant); record.variantIds.push(otherVariant.id)
    const otherExperiment = { ...structuredClone(state.experiments[0]), id: 'experiment-other-single', variantIds: [otherVariant.id], candidateVersion: '2.5.2', createdAt: '2026-10-03T00:00:00Z', gateDecisionId: 'decision-other-single' }
    state.experiments.push(otherExperiment); record.singleExperimentIds.push(otherExperiment.id)
    state.gateDecisions.push({ ...structuredClone(state.gateDecisions[0]), id: 'decision-other-single', experimentId: otherExperiment.id, conclusion: 'PASS', decidedAt: '2026-10-03T12:00:00Z', reportSnapshot: { ...structuredClone(state.gateDecisions[0].reportSnapshot), experimentId: otherExperiment.id, variantIds: [otherVariant.id], configSnapshot: structuredClone(otherExperiment.configSnapshot) } }); record.decisionIds.push('decision-other-single')
    const path = selectModuleEvolution(state, query).currentPaths[0]
    expect(path.windowGate.code).toBe('PENDING'); expect(path.gate.code).not.toBe('PASS')
    expect(selectEvolutionRecord(state, record.id)!.decisions.map(item => item.id)).not.toContain('decision-window')
    // The window's A approval becomes valid only after A itself passes;
    // candidate B failing must not erase A's correctly matched approval.
    state.gateDecisions.find(item => item.id === 'decision-single')!.conclusion = 'PASS'
    state.gateDecisions.find(item => item.id === 'decision-other-single')!.conclusion = 'REJECT'
    expect(selectModuleEvolution(state, query).currentPaths[0].windowGate.code).toBe('PASS')
    expect(selectModuleEvolution(state, query).currentPaths[0].singleGate.code).toBe('PASS')
  })
  it('keeps gate rejection and human review distinct', () => {
    const { state, query } = fixture(); state.gateDecisions[1].conclusion = 'MANUAL_REVIEW'
    expect(selectModuleEvolution(state, query).currentPaths[0].windowGate.code).toBe('MANUAL_REVIEW')
    state.gateDecisions[1].conclusion = 'REJECT'
    expect(selectModuleEvolution(state, query).currentPaths[0].windowGate.code).toBe('REJECTED')
  })
  it('reads actual exact release status while never treating updatedAt as rollback action time', () => {
    const { state, query, record } = fixture(); const template = createInitialEvolutionData().releases[0]
    state.releases = [{ ...structuredClone(template), ...stamp, id: 'release-sop', version: 'agent-2.6.0', windowId: 'window-sop', variantIds: ['variant-sop'], combinationExperimentId: 'experiment-window', gateDecisionId: 'decision-window', status: 'ROLLED_BACK', releasedAt: '2026-10-05T00:00:00Z', rollbackReason: '观察期出现回归' }]; record.releaseIds = ['release-sop']
    const path = selectModuleEvolution(state, query).currentPaths[0]
    expect(path.release).toMatchObject({ code: 'ROLLED_BACK', label: '已回滚', at: undefined })
    expect(path.history.some(item => item.stage === 'RELEASE' && item.at === '2026-10-05T00:00:00Z')).toBe(true)
    state.releases[0].combinationExperimentId = 'unrelated-window-experiment'
    expect(selectModuleEvolution(state, query).currentPaths[0].release.code).toBe('PENDING')
  })
  it('retains an actual publication predating its recorded gate with an explicit chronology warning', () => {
    const { state, query, record } = fixture(); const template = createInitialEvolutionData().releases[0]
    state.releases = [{ ...structuredClone(template), ...stamp, id: 'release-earlier', windowId: 'window-sop', variantIds: ['variant-sop'], combinationExperimentId: 'experiment-window', gateDecisionId: 'decision-window', status: 'RELEASED', releasedAt: '2026-10-01T00:00:00Z' }]; record.releaseIds = ['release-earlier']
    const path = selectModuleEvolution(state, query).currentPaths[0]
    expect(path.release).toMatchObject({ code: 'RELEASED', at: '2026-10-01T00:00:00Z' })
    expect(path.warnings.some(item => item.includes('早于准出'))).toBe(true)
    expect(state.releases[0].releasedAt).toBe('2026-10-01T00:00:00Z')
  })
})

describe('fixed governance target navigation', () => {
  it('preserves exact Skill source version, attribution, cycle and the originating module return context', () => {
    const { record } = fixture()
    const href = buildEvolutionWorkbenchHref(record, 'datasets', '/cases?traceId=123&moduleScoreId=module-score&caseView=eval')
    const url = new URL(href, 'http://demo')
    expect(url.pathname).toBe('/datasets-evaluations')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ governanceObject: 'Skill', skill: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop', evolutionRecordId: 'record-sop', targetId: 'skill-ppt-builder', targetVersion: '2.5.0', view: 'datasets', returnTo: '/cases?traceId=123&moduleScoreId=module-score&caseView=eval' })
  })
  it('creates a nonSkill Memory target URL without any inherited Skill filters', () => {
    const { record } = fixture(); record.target = { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-recall-policy', targetVersion: '3.1', attributionId: 'memory-recall' }
    const url = new URL(buildEvolutionWorkbenchHref(record, 'history'), 'http://demo')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ governanceObject: 'Memory', targetId: 'memory-recall-policy', targetVersion: '3.1', attribution: 'memory-recall', evolutionRecordId: 'record-sop', view: 'history' })
    for (const key of ['skill', 'skillId', 'skillVersion', 'skillCategory']) expect(url.searchParams.has(key)).toBe(false)
  })
  it('limits a record workbench to explicit validated objects and never falls back to global Skill status', () => {
    const { state, record } = fixture(); const second = structuredClone(record); second.id = 'record-empty'; second.variantIds = []; second.datasetIds = []; second.singleExperimentIds = []; second.windowExperimentIds = []; second.decisionIds = []; second.releaseIds = []
    state.evolutionRecords!.push(second)
    expect(selectEvolutionRecord(state, second.id)).toMatchObject({ record: { id: 'record-empty' }, datasets: [], experiments: [], decisions: [], releases: [] })
    expect(selectEvolutionRecord(state, 'missing')).toBeUndefined()
    expect(automaticModuleRevisionId(state.tracePackages[0].moduleScores[0])).toBe('automatic-v1')
  })
})
