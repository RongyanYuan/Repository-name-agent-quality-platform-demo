import { useMemo } from 'react'
import { qualityData } from '../../data'
import type { EvolutionState } from '../domain'
import { CaseAnalysisWorkbench, type CaseAnalysisWorkbenchProps } from './CaseAnalysisWorkbench'
import { buildCaseAnalysisData, buildCaseAnalysisDataFromEvolution } from './model'

export type EvolutionCasesPageProps = Omit<CaseAnalysisWorkbenchProps, 'data'> & {
  data?: CaseAnalysisWorkbenchProps['data']
  evolutionState?: EvolutionState
}

/**
 * Integration-safe page entry. Root routing can provide normalized evolution
 * data later; until then the legacy quality fixture is adapted without
 * coupling this feature folder to App or layout code.
 */
export function EvolutionCasesPage({ data, evolutionState, ...props }: EvolutionCasesPageProps) {
  const fallback = useMemo(() => buildCaseAnalysisData(qualityData), [])
  const normalized = useMemo(() => evolutionState ? buildCaseAnalysisDataFromEvolution(evolutionState) : undefined, [evolutionState])
  return <CaseAnalysisWorkbench data={data ?? normalized ?? fallback} {...props} />
}

export default EvolutionCasesPage
