import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { governanceTracks, latestSkillVersion, normalizeSkillVersion, skillVersions, targetAttributionId } from './skillWorkspace'

describe('fixed-version Skill workspace', () => {
  it('normalizes legacy version identities and preserves a planned Skill without inventing a version', () => {
    expect(normalizeSkillVersion('ppt-builder-2.6.0-rc.1')).toBe('2.6.0-rc.1')
    expect(normalizeSkillVersion('taste-ppt-template-1-0.9.0')).toBe('0.9.0')
    expect(normalizeSkillVersion('未生成')).toBe('未生成')
    expect(targetAttributionId({ skillId: 's', evolutionItemId: 'skill-sop', attributionId: 'act-failed' })).toBe('act-failed')
  })
  it('defaults to the latest directory version without importing Agent release history', () => {
    const state = createInitialEvolutionData()
    const skill = state.skills.find(item => item.id === 'skill-ppt-builder')!
    skill.version = '2.5.0'
    skill.versions = [
      { id: `${skill.id}@2.5.0`, version: '2.5.0', status: 'RELEASED', description: '当前生产版本', createdAt: skill.createdAt, updatedAt: skill.updatedAt },
      { id: `${skill.id}@2.6.0-rc.1`, version: '2.6.0-rc.1', status: 'CANDIDATE', description: '候选版本', createdAt: skill.createdAt, updatedAt: skill.updatedAt }
    ]
    expect(skillVersions(state, skill.id).map(item => item.version)).toEqual(['2.6.0-rc.1', '2.5.0'])
    expect(latestSkillVersion(state, skill.id)).toBe('2.6.0-rc.1')
    expect(skillVersions(state, 'missing')).toEqual([])
  })
  it('keeps source Case and experiments isolated by one Skill-version-attribution tuple', () => {
    const state = createInitialEvolutionData()
    state.datasets = [{ ...state.datasets[0], caseIds: ['case-ppt-management'], targets: [{ skillId: 'skill-ppt-builder', skillVersion: 'ppt-builder-2.5.0', evolutionItemId: 'skill-sop' }] }]
    state.experiments = [
      { ...state.experiments[0], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }], datasetIds: [state.datasets[0].id], gateDecisionId: undefined, status: 'QUEUED' },
      { ...state.experiments[1], targets: [{ skillId: 'skill-spreadsheet', skillVersion: '2.5.1', evolutionItemId: 'act-failed' }], datasetIds: [state.datasets[0].id] }
    ]
    state.attributions = []; state.evaluationFindings = []; state.issues = []; state.issueClusters = []; state.variants = []; state.gateDecisions = []; state.releases = []
    state.traces.filter(trace => trace.caseId === 'case-ppt-management').forEach(trace => { trace.skillVersion = '2.5.0' })
    state.tracePackages.filter(pkg => pkg.caseId === 'case-ppt-management').forEach(pkg => { pkg.skillVersion = '2.5.0'; pkg.skillIds = ['skill-ppt-builder'] })
    const tracks = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({ key: 'skill-ppt-builder@2.5.0#skill-sop', active: true, stateLabel: '实验待运行', caseIds: ['case-ppt-management'], experimentIds: [state.experiments[0].id] })
    expect(governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.1', attribution: 'act-failed' })).toEqual([])
  })
  it('never rewrites unrecorded source versions to the current Skill version', () => {
    const state = createInitialEvolutionData()
    const caseId = 'case-ppt-management'
    state.skills.find(skill => skill.id === 'skill-ppt-builder')!.version = '9.0.0'
    state.datasets = [{ ...state.datasets[0], caseIds: [caseId], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '9.0.0', evolutionItemId: 'skill-sop' }] }]
    state.traces.filter(trace => trace.caseId === caseId).forEach(trace => { trace.skillVersion = undefined })
    state.tracePackages.filter(pkg => pkg.caseId === caseId).forEach(pkg => { pkg.skillVersion = undefined })
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '9.0.0', attribution: 'skill-sop' })[0]
    expect(track.caseIds).toEqual([])
    expect(track.traceIds).toEqual([])
    expect(track.findingIds).toEqual([])
    expect(track.attributionIds).toEqual([])
  })
  it('distinguishes queued setup from actual running experiments', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '1.0.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.experiments = [{ ...state.experiments[0], targets: [target], status: 'DRAFT', gateDecisionId: undefined }]
    state.gateDecisions = []; state.releases = []
    expect(governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0].stateLabel).toBe('实验待运行')
    state.experiments[0].status = 'RUNNING'
    expect(governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0].stateLabel).toBe('单能力实验中')
  })
  it('does not populate source history from unrelated regression versions or explicitly different variant targets', () => {
    const state = createInitialEvolutionData()
    const caseId = 'case-ppt-management'
    state.datasets = [{ ...state.datasets[0], caseIds: [caseId], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '1.0.0', evolutionItemId: 'skill-sop' }] }]
    state.experiments = []; state.attributions = []; state.evaluationFindings = []; state.issues = []; state.issueClusters = []; state.gateDecisions = []; state.releases = []
    state.variants = [{ ...state.variants[0], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '2.0.0', evolutionItemId: 'skill-sop' }], sourceCaseIds: [caseId] }]
    state.traces.filter(trace => trace.caseId === caseId).forEach(trace => { trace.skillVersion = '2.0.0' })
    state.tracePackages.filter(pkg => pkg.caseId === caseId).forEach(pkg => { pkg.skillVersion = '2.0.0'; pkg.skillIds = ['skill-ppt-builder'] })
    const old = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '1.0.0', attribution: 'skill-sop' })[0]
    expect(old.caseIds).toEqual([])
    expect(old.traceIds).toEqual([])
    expect(old.variantIds).toEqual([])
    const current = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.0.0', attribution: 'skill-sop' })[0]
    expect(current.variantIds).toEqual([state.variants[0].id])
    expect(current.caseIds).toEqual([caseId])
  })
  it('keeps completed governance history but excludes its attribution from active work', () => {
    const state = createInitialEvolutionData()
    state.datasets = [{ ...state.datasets[0], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }] }]
    state.experiments = [{ ...state.experiments[0], targets: state.datasets[0].targets, datasetIds: [state.datasets[0].id], gateDecisionId: 'latest-reject' }]
    state.gateDecisions = [{ ...state.gateDecisions[0], id: 'latest-reject', experimentId: state.experiments[0].id, conclusion: 'REJECT' }]
    state.releases = []
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })[0]
    expect(track.active).toBe(false)
    expect(track.stateLabel).toBe('拒绝')
    expect(track.gateIds).toEqual(['latest-reject'])
  })
  it('supports attribution labels, optimization conditions and Case query searches', () => {
    const state = createInitialEvolutionData()
    state.datasets = [{ ...state.datasets[0], targets: [{ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }], caseIds: ['case-ppt-management'] }]
    state.traces.filter(trace => trace.caseId === 'case-ppt-management').forEach(trace => { trace.skillVersion = '2.5.0' })
    state.tracePackages.filter(pkg => pkg.caseId === 'case-ppt-management').forEach(pkg => { pkg.skillVersion = '2.5.0'; pkg.skillIds = ['skill-ppt-builder'] })
    expect(governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill sop错误', optimizationMode: '直接优化', query: '季度经营' })).toHaveLength(1)
    expect(governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop', optimizationMode: '聚类优化' })).toEqual([])
  })
  it('shows the latest failed experiment as actionable failure instead of frozen dataset progress', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '1.0.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.experiments = [{ ...state.experiments[0], targets: [target], status: 'FAILED', gateDecisionId: undefined }]
    state.gateDecisions = []; state.releases = []
    const track = governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0]
    expect(track).toMatchObject({ stateLabel: '实验失败，待复核', active: true })
  })
  it('does not let an older failed attempt override the newer passed or queued experiment state', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '1.0.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.experiments = [
      { ...state.experiments[0], id: 'old-failed', targets: [target], status: 'FAILED', gateDecisionId: undefined, updatedAt: '2026-10-10T12:00:00Z' },
      { ...state.experiments[0], id: 'new-passed', targets: [target], status: 'DECIDED', gateDecisionId: 'new-pass', updatedAt: '2026-10-11T12:00:00Z' }
    ]
    state.gateDecisions = [{ ...state.gateDecisions[0], id: 'new-pass', experimentId: 'new-passed', conclusion: 'PASS', decidedAt: '2026-10-11T12:00:00Z' }]
    state.releases = []
    expect(governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0]).toMatchObject({ stateLabel: '已准出', active: false })
    state.experiments[1].status = 'QUEUED'; state.experiments[1].gateDecisionId = undefined; state.gateDecisions = []
    expect(governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0]).toMatchObject({ stateLabel: '实验待运行', active: true })
  })
  it.each([
    ['RESOLVED', '已解决'], ['REJECTED', '归因已拒绝']
  ] as const)('keeps %s findings in history but excludes them from pending attribution choices', (status, stateLabel) => {
    const state = createInitialEvolutionData()
    const finding = state.evaluationFindings.find(item => item.dimensionLabel === 'skill sop错误')!
    state.datasets = []; state.experiments = []; state.variants = []; state.attributions = []; state.issues = []; state.issueClusters = []; state.gateDecisions = []; state.releases = []
    state.evaluationFindings = [{ ...finding, status }]
    const tracks = governanceTracks(state)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({ stateLabel, active: false, findingIds: [finding.id] })
  })
  it('keeps reopened experiments actionable without a stale resolved finding hiding the pending work', () => {
    const state = createInitialEvolutionData()
    const finding = state.evaluationFindings.find(item => item.dimensionLabel === 'skill sop错误')!
    const trace = state.traces.find(item => item.id === finding.traceId)!
    const pkg = state.tracePackages.find(item => item.traceId === trace.id)!
    const target = { skillId: pkg.skillIds[0], skillVersion: trace.skillVersion, evolutionItemId: 'skill-sop' }
    state.datasets = []; state.variants = []; state.attributions = []; state.issues = []; state.issueClusters = []; state.gateDecisions = []; state.releases = []
    state.evaluationFindings = [{ ...finding, status: 'RESOLVED' }]
    state.experiments = [{ ...state.experiments[0], targets: [target], status: 'QUEUED', gateDecisionId: undefined }]
    expect(governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion })[0]).toMatchObject({ stateLabel: '实验待运行', active: true })
  })
  it('keeps a newer running governance attempt active without erasing older releases or gate history', () => {
    const state = createInitialEvolutionData()
    const target = { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', evolutionItemId: 'skill-sop' }
    state.datasets = [{ ...state.datasets[0], targets: [target] }]
    state.experiments = [
      { ...state.experiments[0], id: 'old-window', level: 'WINDOW_COMBINATION', targets: [target], status: 'DECIDED', gateDecisionId: 'old-gate', updatedAt: '2026-10-10T10:00:00Z' },
      { ...state.experiments[0], id: 'new-single', level: 'SINGLE_VARIANT', targets: [target], status: 'RUNNING', gateDecisionId: undefined, updatedAt: '2026-10-11T10:00:00Z' }
    ]
    state.gateDecisions = [{ ...state.gateDecisions[0], id: 'old-gate', experimentId: 'old-window', conclusion: 'PASS', decidedAt: '2026-10-10T10:00:00Z' }]
    state.releases = [{ ...state.releases[0], id: 'old-release', combinationExperimentId: 'old-window', status: 'RELEASED', updatedAt: '2026-10-10T11:00:00Z' }]
    const track = governanceTracks(state, { skillId: target.skillId, skillVersion: target.skillVersion, attribution: target.evolutionItemId })[0]
    expect(track).toMatchObject({ stateLabel: '单能力实验中', active: true, releaseIds: ['old-release'], gateIds: ['old-gate'] })
    expect(state.releases[0].status).toBe('RELEASED')
    expect(state.gateDecisions[0].conclusion).toBe('PASS')
  })
  it('reopens a genuinely newer pending finding after prior release while unchanged old findings stay historical', () => {
    const state = createInitialEvolutionData()
    const finding = state.evaluationFindings.find(item => item.dimensionLabel === 'skill sop错误')!
    const trace = state.traces.find(item => item.id === finding.traceId)!
    const pkg = state.tracePackages.find(item => item.traceId === trace.id)!
    const target = { skillId: pkg.skillIds[0], skillVersion: trace.skillVersion, evolutionItemId: 'skill-sop' }
    state.datasets = []; state.variants = []; state.attributions = []; state.issues = []; state.issueClusters = []
    state.evaluationFindings = [{ ...finding, status: 'OPEN', createdAt: '2026-10-12T10:00:00Z', updatedAt: '2026-10-12T10:00:00Z' }]
    state.experiments = [{ ...state.experiments[0], id: 'past-pass', targets: [target], status: 'DECIDED', gateDecisionId: 'past-gate', updatedAt: '2026-10-10T10:00:00Z' }]
    state.gateDecisions = [{ ...state.gateDecisions[0], id: 'past-gate', experimentId: 'past-pass', conclusion: 'PASS', decidedAt: '2026-10-10T10:00:00Z' }]
    state.releases = []
    const scope = { skillId: target.skillId, skillVersion: target.skillVersion, attribution: target.evolutionItemId }
    expect(governanceTracks(state, scope)[0]).toMatchObject({ active: true, stateLabel: '待归因确认', gateIds: ['past-gate'] })
    state.releases = [{ ...createInitialEvolutionData().releases[0], id: 'past-release', combinationExperimentId: 'past-pass', status: 'RELEASED', updatedAt: '2026-10-11T10:00:00Z' }]
    expect(governanceTracks(state, scope)[0]).toMatchObject({ active: true, stateLabel: '待归因确认', releaseIds: ['past-release'] })
    state.evaluationFindings[0].createdAt = '2026-10-09T10:00:00Z'; state.evaluationFindings[0].updatedAt = '2026-10-09T10:00:00Z'
    expect(governanceTracks(state, scope)[0]).toMatchObject({ active: false, stateLabel: '已发布', gateIds: ['past-gate'], releaseIds: ['past-release'] })
  })
})
