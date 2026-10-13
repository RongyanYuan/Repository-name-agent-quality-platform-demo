import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionRecord } from '../domain'
import { evolutionDatasetRows, evolutionRecordMatchesScope, evolutionTargetLabel, filterEvolutionRecords } from './evolutionWorkbench'

function record(id: string, patch: Partial<EvolutionRecord> = {}): EvolutionRecord {
  return { id, name: id, target: { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-recall-policy', targetVersion: 'v2', attributionId: 'memory-recall' }, sourceFindingIds: [], sourceAttributionIds: [], sourceIssueIds: [], sourceClusterIds: [], routingDeliveryIds: [], datasetIds: [], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [], origin: 'MOCK', createdAt: '2026-10-10T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z', ...patch }
}

describe('exact evolution record workbench scope', () => {
  it('keeps module targets independent of Skill fields and fixed target versions', () => {
    const state = createInitialEvolutionData()
    state.evolutionRecords = [record('memory-v2'), record('memory-v1', { target: { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-recall-policy', targetVersion: 'v1', attributionId: 'memory-recall' } }), record('skill-v2', { target: { kind: 'SKILL', governanceObject: 'Skill', skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop' } })]
    expect(filterEvolutionRecords(state, { governanceObject: 'Memory', targetId: 'memory-recall-policy', targetVersion: 'v2' }).map(item => item.id)).toEqual(['memory-v2'])
    expect(evolutionRecordMatchesScope(state.evolutionRecords[0], { skillId: 'skill-ppt-builder' })).toBe(false)
    expect(evolutionTargetLabel(state, state.evolutionRecords[0].target)).toContain('记忆')
    expect(evolutionTargetLabel(state, state.evolutionRecords[0].target)).not.toContain('PPT')
  })

  it('limits an exact cycle to its own datasets and does not borrow another experiment gate', () => {
    const state = createInitialEvolutionData()
    const ownDataset = state.datasets[0]
    const unrelatedExperiment = state.experiments[0]
    unrelatedExperiment.datasetIds = [ownDataset.id]
    unrelatedExperiment.status = 'DECIDED'
    const unrelatedDecision = state.gateDecisions.find(item => item.experimentId === unrelatedExperiment.id)
    if (unrelatedDecision) { unrelatedDecision.conclusion = 'PASS'; unrelatedExperiment.gateDecisionId = unrelatedDecision.id }
    const current = record('current-memory', { datasetIds: [ownDataset.id] })
    state.evolutionRecords = [current]
    const rows = evolutionDatasetRows(state, [current])
    expect(rows.map(row => row.dataset.id)).toEqual([ownDataset.id])
    expect(rows[0].experimentIds).toEqual([])
    expect(rows[0].decisionIds).toEqual([])
    expect(rows[0].gate).toBe('尚未进入准出')
    expect(rows[0].evolutionTargets).toEqual([current.target])
  })

  it('keeps an invalid or missing exact record empty rather than falling back to the whole Skill', () => {
    const state = createInitialEvolutionData()
    state.evolutionRecords = [record('known')]
    expect(filterEvolutionRecords(state, { evolutionRecordId: 'missing' })).toEqual([])
    expect(evolutionDatasetRows(state, [])).toEqual([])
    expect(filterEvolutionRecords(state, { evolutionRecordId: 'known', governanceObject: 'Skill' })).toEqual([])
  })

  it('shows a shared dataset once per cycle and does not lend the old PASS to the unrun cycle', () => {
    const state = createInitialEvolutionData()
    const old = structuredClone(state.evolutionRecords!.find(item => item.id === 'evolution-module-path-demo-sop-agent')!)
    const sharedDatasetId = old.datasetIds[0]
    const current: EvolutionRecord = { ...structuredClone(old), id: 'new-unrun-cycle', name: '第二轮尚未验证', datasetIds: [sharedDatasetId], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [], supersedesRecordId: old.id, createdAt: '2026-10-11T10:00:00Z' }
    state.evolutionRecords = [current, old]
    const snapshots = structuredClone(state.gateDecisions)
    const rows = evolutionDatasetRows(state, [current, old]).filter(row => row.dataset.id === sharedDatasetId)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(row => row.key)).size).toBe(2)
    expect(rows.find(row => row.evolutionRecords[0].id === current.id)).toMatchObject({ gate: '尚未进入准出', experimentIds: [], decisionIds: [] })
    expect(rows.find(row => row.evolutionRecords[0].id === old.id)).toMatchObject({ gate: '已准出', experimentIds: ['experiment-module-path-demo-single'], decisionIds: ['decision-experiment-module-path-demo-single'] })
    expect(evolutionDatasetRows(state, [old, current]).filter(row => row.dataset.id === sharedDatasetId).map(row => row.key).sort()).toEqual(rows.map(row => row.key).sort())
    expect(state.gateDecisions).toEqual(snapshots)
  })
})
