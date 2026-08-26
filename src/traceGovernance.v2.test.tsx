import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { qualityData } from './data'
import type { Observation } from './domain'
import { CasesPage, DatasetsPage } from './governancePages'
import { QualityProvider } from './store'
import { TraceTimeline } from './trace'

const renderPage = (page: React.ReactNode, route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    <QualityProvider>{page}</QualityProvider>
  </MemoryRouter>
)

describe('v2 trace timeline', () => {
  it('shows the Memory root failure, derived Context chain and local rubric evidence', () => {
    const task = qualityData.tasks.find((candidate) => candidate.id === 'task-001')
    const trace = qualityData.traces.find((candidate) => candidate.id === task?.traceId)
    const { container } = render(<TraceTimeline trace={trace} evidence={qualityData.evidence} />)

    const memory = container.querySelector('[data-observation-id="obs-task-001-3"]')
    const context = container.querySelector('[data-observation-id="obs-task-001-4"]')
    expect(memory).not.toBeNull()
    expect(context).not.toBeNull()
    expect(memory).toHaveAttribute('data-judge-status', 'FAIL')
    expect(memory).toHaveAttribute('data-root-cause', 'true')
    expect(within(memory as HTMLElement).getByText('is_root_cause')).toBeVisible()
    expect(context).toHaveAttribute('data-judge-status', 'DERIVED_FAIL')
    expect(within(context as HTMLElement).getByText('DERIVED_FAIL')).toBeVisible()
    expect(within(context as HTMLElement).getByText(/derived_from: Memory/)).toBeVisible()
    expect(within(context as HTMLElement).getByText(/Context Assembly local evidence requires review/)).toBeVisible()
  })

  it('keeps UNKNOWN and N/A explicit instead of inferring failure from output text', () => {
    const base: Omit<Observation, 'id' | 'sequence' | 'nodeType' | 'status' | 'judgeStatus'> = {
      traceId: 'trace-five-state',
      input: 'local input',
      output: 'Final output contains the word failed, but local evidence is missing.',
      latency: 10,
      metadata: {},
      evidenceIds: []
    }
    const observations: Observation[] = [
      { ...base, id: 'unknown-node', sequence: 1, nodeType: 'Memory', status: 'UNKNOWN', judgeStatus: 'UNKNOWN' },
      { ...base, id: 'na-node', sequence: 2, nodeType: 'Recovery', status: 'N/A', judgeStatus: 'N/A' }
    ]
    const { container } = render(<TraceTimeline observations={observations} />)

    expect(container.querySelector('[data-observation-id="unknown-node"]')).toHaveAttribute('data-judge-status', 'UNKNOWN')
    expect(container.querySelector('[data-observation-id="na-node"]')).toHaveAttribute('data-judge-status', 'N/A')
    expect(screen.getByText('UNKNOWN')).toBeVisible()
    expect(screen.getByText('N/A')).toBeVisible()
    expect(screen.queryByText('First Failure')).not.toBeInTheDocument()
  })
})

describe('v2 governance provenance', () => {
  it('shows first-failure, user behavior and file-validity evidence in Case review', () => {
    renderPage(<CasesPage />, '/cases')
    fireEvent.click(screen.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。'))

    expect(screen.getByRole('dialog', { name: 'Case review' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Trace first-failure attribution' })).toBeVisible()
    expect(screen.getByText('is_root_cause')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'User behavior evidence' })).toBeVisible()
    expect(screen.getByText('File Validity')).toBeVisible()
    expect(screen.getByText('Golden Label candidate')).toBeVisible()
  })

  it('shows Golden Label, File Validity, source Trace and version history in Dataset entry review', () => {
    renderPage(<DatasetsPage />, '/datasets')
    fireEvent.click(screen.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。'))

    expect(screen.getByRole('dialog', { name: 'Dataset entry' })).toBeVisible()
    expect(screen.getByText('Golden Label')).toBeVisible()
    expect(screen.getByText('File Validity')).toBeVisible()
    expect(screen.getByText('Source Trace')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Source & version history' })).toBeVisible()
    expect(screen.getByRole('button', { name: '保存条目' })).toBeEnabled()
  })
})
