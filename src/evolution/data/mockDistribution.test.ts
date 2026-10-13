import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './index'
import { buildCaseAnalysisDataFromEvolution } from '../cases/model'
import { validateEvolutionState } from './validation'
import { ATTRIBUTION_DIMENSIONS } from '../domain'
import { selectTasteLibraryTrigger } from './selectors'
import { aliasesForIdentity } from '../identity'

describe('structured Mock evaluation distribution', () => {
  it('retains recorded numeric assessments when evaluated Cases have unconfigured auxiliary summaries', () => {
    const state = createInitialEvolutionData()
    const packagesByCase = new Map(state.tracePackages.map((pkg) => [pkg.caseId, pkg]))
    const caseData = buildCaseAnalysisDataFromEvolution(state)

    const evaluatedCases = caseData.cases.filter((record) => {
      const pkg = packagesByCase.get(record.id)
      return pkg && ['EVALUATED', 'PARTIAL'].includes(pkg.status)
    })

    expect(evaluatedCases.length).toBeGreaterThan(20)
    expect(evaluatedCases.some((record) => record.processSummary !== 'UNKNOWN' || record.outcomeSummary !== 'UNKNOWN')).toBe(true)
    // Numeric-only Eval Agent results do not imply a business Pass/Fail
    // threshold. UNKNOWN auxiliary summaries are valid only when backed by
    // actual scored modules, evidence and a recorded evaluation version.
    const unknownSummaries = evaluatedCases.filter(record => record.processSummary === 'UNKNOWN' && record.outcomeSummary === 'UNKNOWN')
    for (const record of unknownSummaries) {
      const packages = state.tracePackages.filter(pkg => pkg.caseId === record.id)
      const scoredModules = packages.flatMap(pkg => pkg.moduleScores).filter(score => score.moduleCode !== 'CONTEXT' && score.score !== undefined)
      expect(scoredModules.length).toBeGreaterThan(0)
      for (const score of scoredModules) {
        expect(Number.isFinite(score.score)).toBe(true)
        expect(score.score).toBeGreaterThanOrEqual(0)
        expect(score.score).toBeLessThanOrEqual(score.scoreScale === '0-2' ? 2 : 1)
        expect(score.evalAgentVersion.trim()).not.toBe('')
        expect(score.rubricVersion.trim()).not.toBe('')
        expect(score.evidence.rootEvidenceIds.length).toBeGreaterThan(0)
        expect(score.evidence.rootEvidenceIds.every(id => state.evidence.some(evidence => evidence.id === id && evidence.caseId === record.id && evidence.traceId === score.traceId))).toBe(true)
      }
      expect(state.outcomeEvals.some(evaluation => evaluation.caseId === record.id && evaluation.score !== undefined && evaluation.evidenceIds.length > 0)).toBe(true)
    }
  })

  it('contains the 1000-user taste preference cohort and distinct self-evolution scenarios', () => {
    const state = createInitialEvolutionData()
    const signals = state.tastePreferenceSignals
    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ populationTotal: 1000, preferenceCount: 950, preferenceValue: '红色', preferenceRate: 0.95, routingLabel: 'Agent迭代' })
    ]))

    const tasteFindings = state.evaluationFindings.filter((finding) => finding.skillCategory === 'TASTE_SKILL')
    expect(tasteFindings.some((finding) => ['品味库召回错误', '品味库资产质量', '品味库资产不足'].includes(finding.dimensionLabel))).toBe(true)
    expect(tasteFindings.some((finding) => finding.scenarioLabel === '批量用户偏好聚合')).toBe(true)

    const productionDimensions = new Set(state.evaluationFindings.filter((finding) => finding.skillCategory === 'PRODUCTION_SKILL').map((finding) => finding.dimensionLabel))
    expect([...productionDimensions].some((dimension) => ['能力缺乏', 'skill文件不可用', 'skill sop错误', 'skill name/description错误'].includes(dimension))).toBe(true)
    expect(state.evaluationFindings.some((finding) => finding.scenarioLabel === 'SOP规划不合理')).toBe(true)

    const tasteFindingIds = new Set(tasteFindings.filter((finding) => finding.moduleCode === 'SKILL').map((finding) => finding.id))
    const tasteDeliveries = state.routingDeliveries.filter((delivery) => tasteFindingIds.has(delivery.findingId))
    expect(tasteDeliveries.some((delivery) => delivery.destination === 'TASTE_LIBRARY')).toBe(true)
    expect(state.routingDeliveries.filter((delivery) => delivery.destination === 'TASTE_LIBRARY').every((delivery) => tasteFindingIds.has(delivery.findingId))).toBe(true)
  })

  it('keeps category and module states balanced enough to exercise every boundary state', () => {
    const state = createInitialEvolutionData()
    const categories = new Set(state.tracePackages.map((pkg) => pkg.skillCategory))
    expect(categories).toEqual(new Set(['PRODUCTION_SKILL', 'GENERAL', 'PERSONAL_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED']))
    const statuses = new Set(state.tracePackages.flatMap((pkg) => pkg.moduleScores.map((score) => score.automaticStatus)))
    expect(statuses).toEqual(new Set(['PASS', 'FAIL', 'DERIVED_FAIL', 'UNKNOWN', 'N/A']))
    expect(state.tracePackages.filter((pkg) => pkg.status === 'EVALUATED').length).toBeGreaterThan(state.tracePackages.filter((pkg) => pkg.status === 'PENDING').length)
  })

  it('models multiple Skills and fixed Skill versions as independent governance targets', () => {
    const state = createInitialEvolutionData()
    const targets = state.datasets.flatMap(dataset => dataset.targets ?? [])
    expect(new Set(targets.map(target => target.skillId))).toEqual(new Set(['skill-ppt-builder', 'skill-spreadsheet', 'skill-taste-executive', 'skill-word-builder', 'skill-canvas-builder']))
    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop', attributionId: 'skill-sop' }),
      expect.objectContaining({ skillId: 'skill-spreadsheet', skillVersion: '2.5.1', evolutionItemId: 'act-failed', attributionId: 'act-failed' }),
      expect.objectContaining({ skillId: 'skill-taste-executive', skillVersion: '0.9.0', evolutionItemId: 'taste-recall', attributionId: 'taste-recall' })
    ]))
    expect(state.skills.find(skill => skill.id === 'skill-ppt-builder')?.evolutionHistory?.map(entry => entry.version)).toEqual(expect.arrayContaining(['ppt-builder-2.5.0', 'ppt-builder-2.6.0-rc.1']))
  })

  it('keeps the three core governance cases as explicit failed result examples', () => {
    const state = createInitialEvolutionData()
    expect(state.cases.filter((item) => ['case-ppt-management', 'case-tool-export', 'case-multi-route'].includes(item.id)).map((item) => [item.id, item.resultStatus])).toEqual([
      ['case-ppt-management', 'FAIL'], ['case-tool-export', 'FAIL'], ['case-multi-route', 'FAIL']
    ])
  })

  it('provides raw model telemetry without inventing cost-baseline deviations', () => {
    const state = createInitialEvolutionData()
    const generated = state.traces.filter((trace) => aliasesForIdentity(state, 'trace', trace.id).some(id => id.startsWith('trace-v2-')))
    expect(generated.length).toBeGreaterThan(20)
    expect(generated.every((trace) => typeof trace.telemetry.modelLatencyMs === 'number' && trace.telemetry.modelLatencyMs > 0)).toBe(true)
    expect(generated.every((trace) => typeof trace.telemetry.modelThroughputTokensPerSecond === 'number' && trace.telemetry.modelThroughputTokensPerSecond > 0)).toBe(true)
    expect(generated.every((trace) => trace.telemetry.inputCostDeviationRate === undefined && trace.telemetry.outputCostDeviationRate === undefined)).toBe(true)
  })

  it('covers representative PRD attribution wording and links the red-preference cohort to Agent iteration', () => {
    const state = createInitialEvolutionData()
    const labels = state.evaluationFindings.map((finding) => finding.dimensionLabel)
    expect(labels).toEqual(expect.arrayContaining(['生产错误', '管理错误', '召回率低', '准确率低', '能力缺乏', 'skill文件不可用', 'skill sop错误', 'skill name/description错误', '品味库召回错误', '品味库资产质量', '品味库资产不足', '没有做出最正确/高效的选择', '工具未执行成功']))
    expect(state.tastePreferenceSignals[0]).toMatchObject({ populationTotal: 1000, preferenceCount: 950, routingLabel: 'Agent迭代' })
    const tasteCase = buildCaseAnalysisDataFromEvolution(state).cases.find((record) => record.tastePreference)
    expect(tasteCase?.evaluationScenarios?.some((scenario) => scenario.path.includes('Agent迭代'))).toBe(true)
    expect(validateEvolutionState(state)).toEqual([])
  })

  it('provides auditable evaluated examples for every PRD attribution and an eligible taste candidate', () => {
    const state = createInitialEvolutionData()
    for (const module of ['Memory', 'Skill', 'Reason', 'Act'] as const) {
      const labels = state.evaluationFindings.filter((finding) => finding.moduleCode === module.toUpperCase()).map((finding) => finding.dimensionLabel)
      expect(labels).toEqual(expect.arrayContaining([...ATTRIBUTION_DIMENSIONS[module]]))
    }
    const record = buildCaseAnalysisDataFromEvolution(state).cases.find((item) => item.id === 'case-v2-taste-red')!
    expect(record?.links.map((link) => link.kind)).toEqual(expect.arrayContaining(['issue', 'issue-cluster', 'variant', 'experiment']))
    expect(selectTasteLibraryTrigger(state, 'cluster-taste-red-ready')).toMatchObject({ totalCount: 120, eligible: true, threshold: 100 })
    expect(state.variants.find((variant) => variant.id === 'variant-taste-red-v1')?.status).toBe('READY')
    expect(state.experiments.find((experiment) => experiment.id === 'exp-taste-red-single')?.status).toBe('QUEUED')
    expect(validateEvolutionState(state)).toEqual([])
  })

  it('covers every Mock Artifact with an explicit Outcome Eval while preserving UNKNOWN boundary states', () => {
    const state = createInitialEvolutionData()
    const evaluatedArtifactIds = new Set(state.outcomeEvals.map((evaluation) => evaluation.artifactId))
    expect(state.artifacts.filter((artifact) => !evaluatedArtifactIds.has(artifact.id))).toEqual([])
    expect(state.outcomeEvals.some((evaluation) => evaluation.verdict === 'PASS')).toBe(true)
    expect(state.outcomeEvals.some((evaluation) => evaluation.verdict === 'FAIL')).toBe(true)
    const unconfigured = state.outcomeEvals.filter(evaluation => evaluation.verdict === 'UNKNOWN')
    expect(unconfigured.length).toBeGreaterThan(0)
    // Fixture prefixes are not a scoring contract. Every unconfigured
    // assessment must name a valid owned artifact and actual source evidence.
    for (const evaluation of unconfigured) {
      expect(state.artifacts.some(artifact => artifact.id === evaluation.artifactId && artifact.caseId === evaluation.caseId && artifact.traceId === evaluation.traceId)).toBe(true)
      expect(evaluation.evalVersion.trim()).not.toBe('')
      expect(evaluation.evidenceIds.length).toBeGreaterThan(0)
      expect(evaluation.evidenceIds.every(id => state.evidence.some(evidence => evidence.id === id && evidence.caseId === evaluation.caseId && evidence.artifactId === evaluation.artifactId))).toBe(true)
      if (evaluation.score !== undefined) {
        expect(Number.isFinite(evaluation.score)).toBe(true)
        expect(evaluation.score).toBeGreaterThanOrEqual(0)
        expect(evaluation.score).toBeLessThanOrEqual(evaluation.scoreScale === '0-2' ? 2 : 1)
      } else {
        expect(evaluation.rubricRule).toBe('待配置')
      }
    }
    expect(unconfigured.some(evaluation => evaluation.score === undefined && evaluation.rubricRule === '待配置')).toBe(true)
    // A numeric score has no implicit Pass/Fail threshold; unconfigured
    // auxiliary verdicts remain UNKNOWN rather than fabricating a gate.
    expect(unconfigured.some(evaluation => evaluation.score !== undefined && evaluation.scoreScale === '0-2')).toBe(true)
    expect(state.tracePackages.some((pkg) => pkg.moduleScores.some((score) => score.automaticStatus === 'UNKNOWN'))).toBe(true)
  })

  it('includes explicit user acceptance signals across Mock Cases without inferring them from feedback text', () => {
    const state = createInitialEvolutionData()
    const statuses = new Set(state.cases.map((item) => item.acceptanceStatus).filter(Boolean))
    expect(statuses).toEqual(new Set(['ACCEPTED', 'REJECTED', 'UNKNOWN']))
    expect(state.cases.some((item) => /用户(明确)?接受/.test(item.feedback ?? '') && item.acceptanceStatus !== 'ACCEPTED')).toBe(false)
  })
})
