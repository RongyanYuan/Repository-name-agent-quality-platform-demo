import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionState } from '../domain'
import { canonicalizeSeedIdentityState } from '../identity'
import { enrichOverviewDashboardFixtures, OVERVIEW_SCORE_FIXTURE_CASE_IDS } from './overviewDashboardFixtures'
import { validateEvolutionState } from './validation'

const isFixture = (id: string) => OVERVIEW_SCORE_FIXTURE_CASE_IDS.includes(id)
const removeOverviewFixtures = (source: EvolutionState): EvolutionState => {
  const fixtureTraceIds = new Set(source.traces.filter(item => isFixture(item.caseId)).map(item => item.id))
  const state = structuredClone(source)
  state.cases = state.cases.filter(item => !isFixture(item.id))
  state.sessions = state.sessions.filter(item => !item.caseIds.some(isFixture))
  state.traces = state.traces.filter(item => !isFixture(item.caseId))
  state.observations = state.observations.filter(item => !isFixture(item.caseId))
  state.artifacts = state.artifacts.filter(item => !isFixture(item.caseId))
  state.evidence = state.evidence.filter(item => !isFixture(item.caseId))
  state.processEvals = state.processEvals.filter(item => !isFixture(item.caseId))
  state.outcomeEvals = state.outcomeEvals.filter(item => !isFixture(item.caseId))
  state.tracePackages = state.tracePackages.filter(item => !isFixture(item.caseId))
  state.evaluationBatches = state.evaluationBatches.filter(item => item.id !== 'batch-overview-discrete-scores')
  state.evaluationJobs = state.evaluationJobs.filter(item => item.id !== 'job-overview-discrete-scores')
  state.identityAliases = state.identityAliases?.filter(item => !fixtureTraceIds.has(item.canonicalId) && !item.alias.includes('overview-'))
  state.assetPerformanceRecords = state.assetPerformanceRecords?.filter(item => !isFixture(item.caseId))
  return state
}

describe('治理总览手写 0/1/2 Mock 数据', () => {
  it('adds exactly 12 complete Cases with one 0/1/2 final score per product type and balanced feedback', () => {
    const before = removeOverviewFixtures(createInitialEvolutionData())
    const state = canonicalizeSeedIdentityState(enrichOverviewDashboardFixtures(before))
    const cases = state.cases.filter(item => isFixture(item.id))
    expect(cases).toHaveLength(12)
    expect(state.cases).toHaveLength(before.cases.length + 12)
    for (const scenario of ['PPT', 'Word', 'Excel', '生图']) {
      const records = cases.filter(item => item.scenario === scenario)
      expect(records).toHaveLength(3)
      expect(records.map(item => state.outcomeEvals.find(evaluation => evaluation.caseId === item.id)?.score).sort()).toEqual([0, 1, 2])
      expect(new Set(records.map(item => item.acceptanceStatus))).toEqual(new Set(['ACCEPTED', 'REJECTED', 'UNKNOWN']))
    }
    for (const record of cases) {
      const trace = state.traces.find(item => item.caseId === record.id)!
      expect(trace.id).toMatch(/^\d{18,24}$/)
      expect(trace.sessionId).toMatch(/^\d{18,24}$/)
      expect(Date.parse(trace.queryAt!)).toBeGreaterThanOrEqual(Date.parse('2026-09-21T00:00:00.000Z'))
      expect(Date.parse(trace.queryAt!)).toBeLessThanOrEqual(Date.parse('2026-09-27T04:00:00.000Z'))
      expect(record.environment).toBe('Production')
      expect(trace.telemetry.inputTokens).toBe(trace.inputTokens)
      const artifact = state.artifacts.find(item => item.caseId === record.id)!
      expect(artifact.verticalScenario).toBe(record.scenario)
      expect(artifact.kind).toBe(record.scenario === '生图' ? 'Other' : record.scenario)
      const outcome = state.outcomeEvals.find(item => item.artifactId === artifact.id)!
      expect(outcome.isFinal).toBe(true)
      expect(outcome.scoreScale).toBe('0-2')
      expect(outcome.revisions).toHaveLength(1)
      expect(outcome.revisions[0].score).toBe(outcome.score)
      expect(outcome.revisions[0].scoreScale).toBe('0-2')
      expect(outcome.evidenceIds.every(id => state.evidence.find(item => item.id === id)?.artifactId === artifact.id)).toBe(true)
      const session = state.sessions.find(item => item.id === record.sessionId)!
      expect(session.turns.map(item => item.role)).toEqual(['USER', 'AGENT'])
      expect(session.turns[0].content).toBe(record.query)
    }
    expect(validateEvolutionState(state)).toEqual([])
  })

  it('records balanced raw scores for the four PRD modules without scoring Context or deriving a final average', () => {
    const state = createInitialEvolutionData()
    const packages = state.tracePackages.filter(item => isFixture(item.caseId))
    expect(packages).toHaveLength(12)
    for (const module of ['REASON', 'MEMORY', 'SKILL', 'ACT']) {
      const scores = packages.map(item => item.moduleScores.find(score => score.moduleCode === module)!)
      expect(scores.filter(item => item.score === 0)).toHaveLength(4)
      expect(scores.filter(item => item.score === 1)).toHaveLength(4)
      expect(scores.filter(item => item.score === 2)).toHaveLength(4)
      for (const score of scores) {
        expect(score.scoreScale).toBe('0-2')
        expect(score.evidence.completeness).toBe('COMPLETE')
        expect(score.evidence.rootEvidenceIds).toHaveLength(1)
        expect(score.evidence.rubricRule).toContain('业务门禁待配置')
        const process = state.processEvals.find(item => item.revisions.some(revision => revision.id === score.automaticRevisionId))!
        expect(process.score).toBe(score.score)
        expect(process.revisions[0].scoreScale).toBe('0-2')
      }
    }
    expect(packages.every(item => item.moduleScores.length === 4 && !item.moduleScores.some(score => score.moduleCode === 'CONTEXT'))).toBe(true)
    expect(packages.every(item => item.rating?.processFinal === undefined)).toBe(true)
  })

  it('is additive and idempotent while preserving human edits, legacy decimals and frozen reports', () => {
    const before = removeOverviewFixtures(createInitialEvolutionData())
    before.cases[0].feedback = '人工确认后的反馈不可覆盖'
    const original = structuredClone(before)
    const state = enrichOverviewDashboardFixtures(before)
    expect(enrichOverviewDashboardFixtures(state)).toEqual(state)
    for (const item of original.cases) expect(state.cases.find(record => record.id === item.id)).toEqual(item)
    for (const item of original.outcomeEvals) expect(state.outcomeEvals.find(record => record.id === item.id)).toEqual(item)
    for (const item of original.tracePackages) expect(state.tracePackages.find(record => record.id === item.id)).toEqual(item)
    expect(state.experiments).toEqual(original.experiments)
    expect(state.experimentRuns).toEqual(original.experimentRuns)
    expect(state.gateDecisions).toEqual(original.gateDecisions)
    expect(state.releases).toEqual(original.releases)
    expect(state.updatedAt).toBe(original.updatedAt)
    expect(before).toEqual(original)
  })

  it('includes an explicit post-release online example of an actually published candidate version', () => {
    const state = createInitialEvolutionData()
    const record = state.cases.find(item => item.id === 'case-overview-ppt-2')!
    const trace = state.traces.find(item => item.caseId === record.id)!
    const variant = state.variants.find(item => item.id === 'variant-ppt-routing-v3')!
    const release = state.releases.find(item => item.id === 'release-agent-3-0-0')!
    expect(record.sourceType).toBe('ONLINE_WINDOW')
    expect(record.agentVersion).toBe(release.version)
    expect(release.variantIds).toContain(variant.id)
    expect(trace.skillVersion).toBe(variant.candidateVersion.replace('ppt-builder-', ''))
    expect(Date.parse(trace.queryAt!)).toBeGreaterThan(Date.parse(release.releasedAt!))
    expect(record.labels).toContain('发布后线上观察 Mock')
  })
})
