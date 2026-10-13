import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { validateEvolutionState } from './validation'
import { enrichArtifactOutcomeFixtures } from './artifactOutcomeFixtures'
import { selectArtifactOutcomeEvaluations } from './artifactOutcomes'

describe('Artifact outcome dimension Mock enrichment', () => {
  it('adds PPT/Word/Excel/image examples with artifact-specific evidence and explicit 0–2 scales', () => {
    const state = enrichArtifactOutcomeFixtures(createInitialEvolutionData())
    expect(validateEvolutionState(state)).toEqual([])
    const seeded = state.outcomeEvals.filter(item => item.id.startsWith('outcome-dimension-demo-'))
    expect(seeded.length).toBeGreaterThanOrEqual(10)
    expect(new Set(seeded.map(item => state.artifacts.find(artifact => artifact.id === item.artifactId)?.verticalScenario ?? state.artifacts.find(artifact => artifact.id === item.artifactId)?.kind))).toEqual(new Set(['PPT', 'Word', 'Excel', '生图']))
    expect(seeded.every(item => item.scoreScale === '0-2' && item.revisions.every(revision => revision.scoreScale === '0-2'))).toBe(true)
    expect(seeded.every(item => item.evidenceIds.every(id => state.evidence.find(evidence => evidence.id === id)?.artifactId === item.artifactId))).toBe(true)
    const ppt = state.artifacts.find(item => item.id === 'artifact-governance-demo-ppt')!
    const groups = selectArtifactOutcomeEvaluations(state, ppt.traceId)
    expect(groups).toHaveLength(2)
    expect(groups.map(item => item.dimensions.map(dimension => dimension.automaticScore))).not.toEqual([groups[0].dimensions.map(item => item.automaticScore), groups[0].dimensions.map(item => item.automaticScore)])
  })

  it('is idempotent and preserves existing automatic ledgers and all frozen snapshots', () => {
    const seed = createInitialEvolutionData()
    const originalEvaluations = structuredClone(seed.outcomeEvals)
    const reports = structuredClone({ experiments: seed.experiments, runs: seed.experimentRuns, gates: seed.gateDecisions })
    const enriched = enrichArtifactOutcomeFixtures(seed)
    expect(enrichArtifactOutcomeFixtures(enriched)).toEqual(enriched)
    for (const item of originalEvaluations) expect(enriched.outcomeEvals.find(candidate => candidate.id === item.id)).toEqual(item)
    expect({ experiments: enriched.experiments, runs: enriched.experimentRuns, gates: enriched.gateDecisions }).toEqual(reports)
    expect(seed.outcomeEvals).toEqual(originalEvaluations)
  })
})
