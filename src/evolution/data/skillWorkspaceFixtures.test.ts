import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { validateEvolutionState } from './validation'
import { upgradeMockFixtures } from './upgradeMockFixtures'
import { governanceTracks } from './skillWorkspace'

describe('fixed-version Skill workspace Mock fixtures', () => {
  it('provides canonical version catalogs while personal Skill generation stays planned', () => {
    const state = createInitialEvolutionData()
    expect(state.skills.find(skill => skill.id === 'skill-ppt-builder')?.versions?.map(version => version.version)).toEqual(expect.arrayContaining(['2.5.0', '2.6.0-rc.1', '2.6.0']))
    expect(state.skills.find(skill => skill.id === 'skill-taste-executive')?.versions?.map(version => version.version)).toEqual(expect.arrayContaining(['0.9.0', '1.0.0-rc.1']))
    expect(state.skills.find(skill => skill.id === 'skill-spreadsheet')?.versions?.map(version => version.version)).toEqual(expect.arrayContaining(['2.5.1', '2.6.0-rc.1']))
    expect(state.skills.find(skill => skill.id === 'skill-word-builder')?.versions?.map(version => version.version)).toEqual(expect.arrayContaining(['1.4.0', '1.5.0-rc.1']))
    expect(state.skills.find(skill => skill.id === 'skill-canvas-builder')?.versions?.map(version => version.version)).toContain('0.8.0')
    expect(state.skills.find(skill => skill.id === 'skill-taste-ppt-template-1')?.versions?.map(version => version.version)).toEqual(expect.arrayContaining(['0.9.0', '1.0.0-rc.1', '1.0.0']))
    expect(state.skills.find(skill => skill.id === 'skill-personal-planned')).toMatchObject({ generationStatus: 'PLANNED', versions: [expect.objectContaining({ status: 'PLANNED' })] })
  })

  it('gives each active PPT version attribution its own three test sets and real Trace samples', () => {
    const state = createInitialEvolutionData()
    for (const attributionId of ['skill-sop', 'skill-description']) {
      const datasets = state.datasets.filter(dataset => dataset.targets?.some(target => target.skillId === 'skill-ppt-builder' && target.skillVersion === '2.6.0' && target.attributionId === attributionId))
      expect(datasets.map(dataset => dataset.purpose)).toEqual(expect.arrayContaining(['原始归因集', '同类泛化集', '相邻及无关回归集']))
      expect(datasets.length).toBeGreaterThanOrEqual(3)
      const caseIds = new Set(datasets.flatMap(dataset => dataset.caseIds))
      expect(caseIds.size).toBeGreaterThanOrEqual(3)
      for (const caseId of caseIds) {
        const trace = state.traces.find(item => item.caseId === caseId)!
        expect(trace.skillVersion).toBe('2.6.0')
        expect(state.tracePackages.find(pkg => pkg.traceId === trace.id)).toMatchObject({ status: 'EVALUATED', rating: { scale: '0-2' } })
        expect(state.processEvals.some(evaluation => evaluation.traceId === trace.id)).toBe(true)
        expect(state.outcomeEvals.some(evaluation => evaluation.traceId === trace.id)).toBe(true)
      }
    }
    expect(validateEvolutionState(state)).toEqual([])
  })

  it('does not relabel old datasets and decided experiments as both baseline and candidate workspaces', () => {
    const state = createInitialEvolutionData()
    expect(state.datasets.find(dataset => dataset.id === 'dataset-attribution')?.targets).toEqual([expect.objectContaining({ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop' })])
    expect(state.experiments.find(experiment => experiment.id === 'exp-single-ppt-routing')?.targets).toEqual([expect.objectContaining({ skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop' })])
    expect(state.experiments.find(experiment => experiment.id === 'exp-single-ppt-routing')?.configSnapshot.evaluationSnapshot?.tracePackages.find(pkg => pkg.traceId === 'trace-ppt-generate')?.skillVersion).not.toBe('2.6.0')
    expect(state.releases.find(release => release.id === 'release-agent-3-0-0')?.combinationExperimentId).toBe('exp-window-2026w35')
  })

  it('records the original PPT source version so its historical attribution retains the original evidence and evaluations', () => {
    const state = createInitialEvolutionData()
    for (const traceId of ['trace-ppt-context', 'trace-ppt-generate']) {
      expect(state.traces.find(trace => trace.id === traceId)?.skillVersion).toBe('2.5.0')
      expect(state.tracePackages.find(pkg => pkg.traceId === traceId)?.skillVersion).toBe('2.5.0')
    }
    const oldTrack = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })[0]
    expect(oldTrack.caseIds).toContain('case-ppt-management')
    expect(oldTrack.traceIds).toContain('trace-ppt-generate')
    expect(oldTrack.attributionIds).toContain('attribution-skill-recall')
    expect(oldTrack.evidenceIds).toContain('evidence-ppt-recall')
    expect(state.processEvals.filter(evaluation => oldTrack.traceIds.includes(evaluation.traceId)).map(evaluation => evaluation.id)).toContain('process-eval-ppt-recall')
    expect(state.outcomeEvals.filter(evaluation => oldTrack.traceIds.includes(evaluation.traceId)).map(evaluation => evaluation.id)).toContain('outcome-eval-ppt-style')
    expect(governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.6.0', attribution: 'skill-sop' })[0].attributionIds).not.toContain('attribution-skill-recall')
  })

  it('adds only missing whitelisted historical source versions while preserving human labels and frozen reports', () => {
    const seed = createInitialEvolutionData()
    const previous = structuredClone(seed)
    previous.seedVersion = 'office-agent-governance-demo-2.4.0'
    previous.traces.filter(trace => ['trace-ppt-context', 'trace-ppt-generate', 'trace-tool-export', 'trace-multi-route', 'trace-v2-05'].includes(trace.id)).forEach(trace => { delete trace.skillVersion })
    previous.tracePackages.filter(pkg => ['trace-ppt-context', 'trace-ppt-generate', 'trace-tool-export', 'trace-multi-route', 'trace-v2-05'].includes(pkg.traceId)).forEach(pkg => { delete pkg.skillVersion })
    const preserved = previous.tracePackages.find(pkg => pkg.traceId === 'trace-ppt-generate')!.moduleScores[0]
    preserved.humanScore = 1.25; preserved.humanNote = '保留人工证据确认'
    const frozenReports = structuredClone(previous.gateDecisions)
    const frozenConfigs = structuredClone(previous.experiments.map(experiment => experiment.configSnapshot))
    const migrated = upgradeMockFixtures(previous, seed, '2026-09-30T11:00:00.000Z', 'historical-source-versions')
    expect(migrated.traces.find(trace => trace.id === 'trace-ppt-generate')?.skillVersion).toBe('2.5.0')
    expect(migrated.tracePackages.find(pkg => pkg.traceId === 'trace-ppt-generate')).toMatchObject({ skillVersion: '2.5.0', moduleScores: expect.arrayContaining([expect.objectContaining({ humanScore: 1.25, humanNote: '保留人工证据确认' })]) })
    expect(migrated.traces.find(trace => trace.id === 'trace-tool-export')?.skillVersion).toBe('2.5.0')
    expect(migrated.traces.find(trace => trace.id === 'trace-multi-route')?.skillVersion).toBeUndefined()
    expect(migrated.tracePackages.find(pkg => pkg.traceId === 'trace-multi-route')?.skillVersion).toBeUndefined()
    expect(migrated.traces.find(trace => trace.id === 'trace-v2-05')?.skillVersion).toBeUndefined()
    expect(migrated.tracePackages.find(pkg => pkg.traceId === 'trace-v2-05')?.skillVersion).toBeUndefined()
    expect(migrated.gateDecisions).toEqual(frozenReports)
    expect(migrated.experiments.map(experiment => experiment.configSnapshot)).toEqual(frozenConfigs)
    previous.traces.find(trace => trace.id === 'trace-ppt-generate')!.skillVersion = '9.9.9-user-recorded'
    previous.tracePackages.find(pkg => pkg.traceId === 'trace-ppt-generate')!.skillVersion = '9.9.9-user-recorded'
    const edited = upgradeMockFixtures(previous, seed, '2026-09-30T12:00:00.000Z', 'preserve-version')
    expect(edited.traces.find(trace => trace.id === 'trace-ppt-generate')?.skillVersion).toBe('9.9.9-user-recorded')
    expect(edited.tracePackages.find(pkg => pkg.traceId === 'trace-ppt-generate')?.skillVersion).toBe('9.9.9-user-recorded')
  })

  it('keeps the Tool fix source at its baseline version while candidate history and current release stay intact', () => {
    const state = createInitialEvolutionData()
    expect(state.traces.find(trace => trace.id === 'trace-tool-export')?.skillVersion).toBe('2.5.0')
    expect(state.tracePackages.find(pkg => pkg.traceId === 'trace-tool-export')?.skillVersion).toBe('2.5.0')
    expect(state.datasets.find(dataset => dataset.id === 'dataset-spreadsheet-regression')?.targets).toEqual([expect.objectContaining({ skillId: 'skill-spreadsheet', skillVersion: '2.5.0', attributionId: 'act-failed' })])
    expect(state.experiments.find(experiment => experiment.id === 'exp-single-tool-retry')).toMatchObject({ baselineVersion: 'spreadsheet-2.5.0', candidateVersion: 'spreadsheet-2.5.1', targets: [expect.objectContaining({ skillVersion: '2.5.0' })] })
    expect(state.skills.find(skill => skill.id === 'skill-spreadsheet')?.version).toBe('2.5.1')
    expect(state.datasets.find(dataset => dataset.id === 'dataset-workspace-excel-251-act-attribution')?.targets).toEqual([expect.objectContaining({ skillVersion: '2.5.1' })])
    const track = governanceTracks(state, { skillId: 'skill-spreadsheet', skillVersion: '2.5.0', attribution: 'act-failed' })[0]
    expect(track.caseIds).toContain('case-tool-export')
    expect(track.issueIds).toContain('issue-tool-export')
    expect(track.evidenceIds).toContain('evidence-tool-error')
  })

  it('keeps new taste-version samples separate from the historical 1000-user aggregate and 100-case trigger', () => {
    const state = createInitialEvolutionData()
    const candidate = state.variants.find(variant => variant.id === 'variant-workspace-taste-100rc-recall')!
    expect(candidate).toMatchObject({ status: 'DRAFT', experimentIds: [] })
    const findings = state.evaluationFindings.filter(finding => finding.traceId.startsWith('trace-workspace-taste-100rc-recall-'))
    expect(findings.every(finding => finding.preferenceSignalId === undefined && !finding.description.includes('1000'))).toBe(true)
    expect(state.tastePreferenceSignals[0]).toMatchObject({ populationTotal: 1000, preferenceCount: 950 })
    expect(state.issueClusters.find(cluster => cluster.id === 'cluster-taste-red-ready')?.currentCount).toBe(120)
    expect(state.datasets.find(dataset => dataset.id === 'dataset-taste-red-attribution')).toMatchObject({ sampleCount: 120, targets: [expect.objectContaining({ skillId: 'skill-taste-executive', skillVersion: '0.9.0', attributionId: 'taste-recall' })] })
  })

  it('incrementally migrates catalogs and new objects without replacing human changes or snapshots', () => {
    const seed = createInitialEvolutionData()
    const previous = structuredClone(seed)
    previous.seedVersion = 'office-agent-governance-demo-2.3.4'
    previous.skills.forEach(skill => { delete skill.versions })
    previous.cases = previous.cases.filter(record => !record.id.startsWith('case-workspace-'))
    const oldSkill = previous.skills.find(skill => skill.id === 'skill-ppt-builder')!
    oldSkill.name = '人工维护的 PPT Skill'
    oldSkill.version = '2.5.0'
    const oldDataset = previous.datasets.find(dataset => dataset.id === 'dataset-attribution')!
    oldDataset.scope = '人工确认的样本范围'
    const oldExperiment = previous.experiments.find(experiment => experiment.id === 'exp-single-ppt-routing')!
    const immutableSnapshot = structuredClone(oldExperiment.configSnapshot)
    previous.auditTrail.push({ id: 'human-skill-change', at: '2026-09-29T10:00:00.000Z', actor: '当前用户', action: 'UPDATE', entityType: 'Skill', entityId: oldSkill.id, reason: '人工编辑', changes: { name: oldSkill.name, version: oldSkill.version } })
    previous.auditTrail.push({ id: 'human-dataset-change', at: '2026-09-29T10:00:00.000Z', actor: '当前用户', action: 'UPDATE', entityType: 'Dataset', entityId: oldDataset.id, reason: '人工编辑', changes: { scope: oldDataset.scope } })
    const migrated = upgradeMockFixtures(previous, seed, '2026-09-30T10:00:00.000Z', 'upgrade-workspace')
    expect(migrated.skills.find(skill => skill.id === oldSkill.id)).toMatchObject({ name: oldSkill.name, version: oldSkill.version, versions: expect.arrayContaining([expect.objectContaining({ version: '2.6.0' })]) })
    expect(migrated.datasets.find(dataset => dataset.id === oldDataset.id)?.scope).toBe('人工确认的样本范围')
    expect(migrated.experiments.find(experiment => experiment.id === oldExperiment.id)?.configSnapshot).toEqual(immutableSnapshot)
    expect(migrated.cases.some(record => record.id.startsWith('case-workspace-'))).toBe(true)
    expect(validateEvolutionState(migrated)).toEqual([])
  })

  it('does not duplicate fixtures or overwrite a manually edited version on repeated migration', () => {
    const seed = createInitialEvolutionData()
    const first = upgradeMockFixtures(structuredClone(seed), seed, '2026-09-30T10:00:00.000Z', 'upgrade-first')
    const version = first.skills.find(skill => skill.id === 'skill-ppt-builder')!.versions!.find(entry => entry.version === '2.6.0')!
    version.description = '人工补充的版本说明'
    const second = upgradeMockFixtures(first, seed, '2026-09-30T11:00:00.000Z', 'upgrade-second')
    expect(second.skills.find(skill => skill.id === 'skill-ppt-builder')?.versions?.find(entry => entry.version === '2.6.0')?.description).toBe('人工补充的版本说明')
    expect(second.cases).toHaveLength(first.cases.length)
    expect(second.datasets).toHaveLength(first.datasets.length)
  })
})
