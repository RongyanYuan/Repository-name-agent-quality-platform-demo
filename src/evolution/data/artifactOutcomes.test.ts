import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { OutcomeEval } from '../domain'
import { selectArtifactOutcomeEvaluations } from './artifactOutcomes'

const at = '2026-10-12T02:00:00Z'
const row = (id: string, artifactId: string, traceId: string, score: number | undefined, isFinal = false): OutcomeEval => ({ id, artifactId, traceId, caseId: 'case-ppt-management', type: 'OUTCOME', dimension: isFinal ? '最终评分' : id, isFinal, scoreScale: '0-2', evalVersion: 'mock-v1', verdict: 'UNKNOWN', score, evidenceIds: [], revisions: [{ id: `auto-${id}`, source: 'AUTOMATIC', score, scoreScale: '0-2', verdict: 'UNKNOWN', reason: `reason-${id}`, evaluator: 'Mock Agent', evaluatedAt: at, evidenceIds: [] }], createdAt: at, updatedAt: at })

describe('Artifact outcome projection', () => {
  it('isolates each artifact and Trace, never averages dimensions into a missing total', () => {
    const state = createInitialEvolutionData()
    const artifact = state.artifacts.find(item => item.id === 'artifact-ppt-management')!
    state.artifacts.push({ ...artifact, id: 'artifact-second', name: 'second.pptx' }, { ...artifact, id: 'artifact-other-trace', traceId: 'other-trace' })
    state.outcomeEvals = [row('one', artifact.id, artifact.traceId, 0.8), row('two', 'artifact-second', artifact.traceId, 1.5), row('final-two', 'artifact-second', artifact.traceId, 1.7, true), row('foreign', 'artifact-other-trace', 'other-trace', 2)]
    const groups = selectArtifactOutcomeEvaluations(state, artifact.traceId)
    expect(groups).toHaveLength(2)
    expect(groups[0].finalEvaluation).toBeUndefined()
    expect(groups[0].dimensions.map(item => item.effectiveScore)).toEqual([0.8])
    expect(groups[1].finalEvaluation?.effectiveScore).toBe(1.7)
    expect(groups[1].dimensions.map(item => item.evaluation.id)).toEqual(['two'])
  })

  it('converts explicit legacy scores once, preserving low numeric 0–2 values', () => {
    const state = createInitialEvolutionData()
    const artifact = state.artifacts[0]
    const legacy = row('legacy', artifact.id, artifact.traceId, 0.8)
    delete legacy.scoreScale; delete legacy.revisions[0].scoreScale
    state.outcomeEvals = [legacy, row('new', artifact.id, artifact.traceId, 0.8)]
    expect(selectArtifactOutcomeEvaluations(state, artifact.traceId)[0].dimensions.map(item => item.automaticScore)).toEqual([1.6, 0.8])
  })

  it('binds manual revisions to the automatic run and preserves all historical reviews', () => {
    const state = createInitialEvolutionData()
    const artifact = state.artifacts[0]
    const evaluation = row('dimension', artifact.id, artifact.traceId, 0.8)
    evaluation.revisions.push({ ...evaluation.revisions[0], id: 'review-1', source: 'HUMAN', score: 0, scoreScale: '0-2', automaticRevisionId: 'auto-dimension' })
    state.outcomeEvals = [evaluation]
    let projected = selectArtifactOutcomeEvaluations(state, artifact.traceId)[0].dimensions[0]
    expect(projected.effectiveScore).toBe(0)
    expect(projected.automaticScore).toBe(0.8)
    evaluation.revisions.push({ ...evaluation.revisions[0], id: 'rerun-auto', score: 1.1 })
    projected = selectArtifactOutcomeEvaluations(state, artifact.traceId)[0].dimensions[0]
    expect(projected.effectiveScore).toBe(1.1)
    expect(projected.manual).toBeUndefined()
    expect(projected.history).toHaveLength(1)
  })

  it('keeps unscored artifacts and unknown rubric explicit', () => {
    const state = createInitialEvolutionData()
    const artifact = state.artifacts[0]
    state.outcomeEvals = [row('missing', artifact.id, artifact.traceId, undefined)]
    const projected = selectArtifactOutcomeEvaluations(state, artifact.traceId)[0]
    expect(projected.finalEvaluation).toBeUndefined()
    expect(projected.dimensions[0].effectiveScore).toBeUndefined()
    expect(projected.dimensions[0].rubricRule).toBe('待配置')
  })
})
