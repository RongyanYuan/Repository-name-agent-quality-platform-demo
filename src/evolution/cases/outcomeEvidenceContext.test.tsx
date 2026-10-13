import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from './model'
import { CaseAnalysisWorkbench } from './CaseAnalysisWorkbench'

describe('Outcome Evidence context',()=>{
  it('keeps the exact Artifact dimension score, Rubric and observation Log when opening its root Evidence',()=>{
    const state=createInitialEvolutionData()
    const outcome=state.outcomeEvals.find(item=>item.artifactId==='artifact-governance-demo-ppt' && item.dimension==='管理层风格匹配')!
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(state)} initialCaseId={outcome.caseId} initialTraceId={outcome.traceId} initialView="outcome" initialArtifactId={outcome.artifactId} initialEvaluationId={outcome.id} initialEvidenceId={outcome.evidenceIds[0]}/>)
    const evidence=screen.getByRole('dialog',{name:/Evidence/})
    expect(evidence).toHaveTextContent('1.10 / 2')
    expect(evidence).toHaveTextContent(outcome.rubricRule!)
    expect(evidence).toHaveTextContent(outcome.evalVersion)
    expect(evidence).toHaveTextContent('log-governance-demo-ppt')
  })
})
