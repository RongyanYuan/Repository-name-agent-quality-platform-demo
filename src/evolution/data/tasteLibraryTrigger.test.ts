import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { Attribution, Case, Issue, Variant } from '../domain'
import { evolutionReducer } from '../store'
import { selectTasteLibraryTrigger } from './selectors'

const copyCase = (state: ReturnType<typeof createInitialEvolutionData>, id: string, status: Case['status'], skillIds = ['skill-ppt-builder']) => {
  const sourceCase = state.cases.find((item) => item.id === 'case-ppt-management')!
  const sourceAttribution = state.attributions.find((item) => item.id === 'attribution-style-mismatch')!
  const sourceIssue = state.issues.find((item) => item.id === 'issue-style-mismatch')!
  const caseRecord: Case = { ...sourceCase, id, status, skillIds, attributionIds: [`attribution-${id}`], issueIds: [`issue-${id}`] }
  const attribution: Attribution = { ...sourceAttribution, id: `attribution-${id}`, caseId: id, confirmed: true, status: 'CONFIRMED', revisions: sourceAttribution.revisions.map((revision) => ({ ...revision, id: `${revision.id}-${id}` })) }
  const issue: Issue = { ...sourceIssue, id: `issue-${id}`, caseId: id, attributionId: attribution.id, status: 'CONFIRMED', clusterIds: ['cluster-ppt-taste-pending'], variantIds: [], processingChains: [] }
  state.cases.push(caseRecord)
  state.attributions.push(attribution)
  state.issues.push(issue)
  const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
  cluster.caseIds.push(id)
  cluster.issueIds.push(issue.id)
  return { caseRecord, attribution, issue }
}

describe('taste-library trigger selector', () => {
  it('derives 37 from one qualifying local Case plus an explicit 36-record external Mock snapshot', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
    cluster.currentCount = 999

    expect(selectTasteLibraryTrigger(state, cluster.id)).toMatchObject({
      isTasteRule: true,
      skillId: 'skill-ppt-builder',
      qualifyingLocalCaseIds: ['case-ppt-management'],
      localCount: 1,
      externalMockCount: 36,
      totalCount: 37,
      threshold: 100,
      eligible: false,
      source: 'Mock 品味库相关 Case 快照',
      snapshotId: 'mock-taste-ppt-builder-2026w35'
    })
  })

  it('counts unique confirmed Cases only when Skill, cluster evidence, Issue, and Attribution qualify', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
    Object.assign(cluster, { tastePopulation: { skillId: 'skill-ppt-builder', externalMockConfirmedCaseCount: 0, snapshotId: 'test-snapshot', source: 'Test Mock snapshot', countedAt: '2026-09-29T00:00:00.000Z' } })
    const confirmed = copyCase(state, 'case-confirmed-taste', 'CONFIRMED')
    copyCase(state, 'case-unconfirmed-taste', 'EVALUATED')
    copyCase(state, 'case-wrong-skill-taste', 'CONFIRMED', ['skill-spreadsheet'])
    const unconfirmedAttribution = copyCase(state, 'case-unconfirmed-attribution', 'CONFIRMED')
    unconfirmedAttribution.attribution.confirmed = false
    unconfirmedAttribution.attribution.status = 'PENDING'
    cluster.caseIds.push(confirmed.caseRecord.id)
    cluster.issueIds.push(confirmed.issue.id)

    expect(selectTasteLibraryTrigger(state, cluster.id).qualifyingLocalCaseIds).toEqual(['case-ppt-management', 'case-confirmed-taste'])
    expect(selectTasteLibraryTrigger(state, cluster.id).localCount).toBe(2)
  })

  it('leaves non-taste cluster thresholds pending instead of assigning 100', () => {
    const result = selectTasteLibraryTrigger(createInitialEvolutionData(), 'cluster-memory-version')

    expect(result).toMatchObject({ isTasteRule: false, totalCount: null, threshold: null, eligible: null })
  })

  it('blocks a taste Variant using the derived count even when stored currentCount says 100', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
    cluster.currentCount = 100
    const at = '2026-09-29T00:00:00.000Z'
    const variant: Variant = { id: 'variant-taste-stale-count', name: '不应创建的品味变体', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '测试陈旧计数', changeContent: '测试陈旧计数', currentVersion: 'v1', candidateVersion: 'v2', sourceCaseIds: [...cluster.caseIds], sourceIssueIds: [...cluster.issueIds], sourceClusterIds: [cluster.id], evidenceIds: [...cluster.evidenceIds], status: 'DRAFT', experimentIds: [], createdAt: at, updatedAt: at }

    const next = evolutionReducer(state, { type: 'CREATE_VARIANT', variant, meta: { actor: '测试员', reason: '验证派生计数', at } })

    expect(next.variants.some((item) => item.id === variant.id)).toBe(false)
  })

  it('permits a taste Variant at exactly 100 derived qualifying records', () => {
    const state = createInitialEvolutionData()
    const cluster = state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!
    cluster.currentCount = 0
    cluster.tastePopulation = { ...cluster.tastePopulation!, externalMockConfirmedCaseCount: 99 }
    const at = '2026-09-29T00:00:00.000Z'
    const variant: Variant = { id: 'variant-taste-exactly-100', name: '恰好达标的品味变体', targetModule: 'Skill', changeType: 'ASSET', changeSummary: '达到品味库门槛', changeContent: '新增管理层决策摘要品味资产。', currentVersion: 'v1', candidateVersion: 'v2', sourceCaseIds: [...cluster.caseIds], sourceIssueIds: [...cluster.issueIds], sourceClusterIds: [cluster.id], evidenceIds: [...cluster.evidenceIds], status: 'DRAFT', experimentIds: [], createdAt: at, updatedAt: at }

    expect(selectTasteLibraryTrigger(state, cluster.id)).toMatchObject({ localCount: 1, externalMockCount: 99, totalCount: 100, eligible: true })
    const next = evolutionReducer(state, { type: 'CREATE_VARIANT', variant, meta: { actor: '测试员', reason: '验证恰好达到门槛', at } })

    expect(next.variants.some((item) => item.id === variant.id)).toBe(true)
    expect(next.issues.find((item) => item.id === 'issue-style-mismatch')?.variantIds).toContain(variant.id)
    expect(next.issueClusters.find((item) => item.id === cluster.id)?.variantIds).toContain(variant.id)
  })
})
