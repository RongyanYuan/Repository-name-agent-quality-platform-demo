import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { qualityData } from './data'
import type { Observation } from './domain'
import { CasesPage, DatasetsPage } from './governancePages'
import { TasksPage } from './qualityPages'
import { QualityProvider } from './store'
import { TraceTimeline } from './trace'

const renderPage = (page: React.ReactNode, route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    <QualityProvider>{page}</QualityProvider>
  </MemoryRouter>
)

describe('v2 trace timeline', () => {
  it('shows the Memory root failure while keeping full Context assembly as non-evaluated evidence', () => {
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
    expect(context).toHaveAttribute('data-judge-status', 'N/A')
    expect(within(context as HTMLElement).getByText('N/A')).toBeVisible()
    expect(within(context as HTMLElement).getByText(/Context is assembled in full/)).toBeVisible()
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

describe('v2 judge provenance in Task detail', () => {
  it('shows LLM Judge reason, root evidence and the matched rubric rule', () => {
    renderPage(<TasksPage />, '/tasks?taskId=task-001')
    expect(screen.getByRole('dialog', { name: 'Task 001' })).toBeVisible()
    expect(screen.getAllByText('LLM Judge reason').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Root evidence').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rubric rule').length).toBeGreaterThan(0)
    expect(screen.getByText(/最终PPT面向普通员工/)).toBeVisible()
    expect(screen.getAllByText(/evidence-task-001/)[0]).toBeVisible()
    expect(screen.getAllByText(/Intent Consistency/)[0]).toBeVisible()
  })

  it('opens the full session conversation and links each query to its trace', () => {
    renderPage(<TasksPage />, '/tasks?taskId=task-002')
    expect(screen.getByRole('dialog', { name: 'Task 002' })).toBeVisible()
    expect(screen.queryByText(/1 evidence/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /查看 Session session-001/ }))
    expect(screen.getByRole('heading', { name: 'Session 对话' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Trace trace-/ }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('用户')[0]).toBeVisible()
    expect(screen.getAllByText('Agent')[0]).toBeVisible()
  })
})

describe('v2 governance provenance', () => {
  it('shows first-failure, user behavior and file-validity evidence in Case review', () => {
    renderPage(<CasesPage />, '/cases')
    fireEvent.click(screen.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。'))

    expect(screen.getByRole('dialog', { name: 'Case 评审' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Trace 首错归因' })).toBeVisible()
    expect(screen.getByText('is_root_cause')).toBeVisible()
    expect(screen.getByRole('heading', { name: '用户行为 Evidence' })).toBeVisible()
    expect(screen.getByText('文件有效性')).toBeVisible()
    expect(screen.getByText('Golden Label 候选')).toBeVisible()
  })

  it('shows Golden Label, File Validity, source Trace and version history in Dataset entry review', () => {
    renderPage(<DatasetsPage />, '/datasets')
    fireEvent.click(screen.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。'))

    expect(screen.getByRole('dialog', { name: 'Dataset 条目' })).toBeVisible()
    expect(screen.getAllByText('Golden Label')[0]).toBeVisible()
    expect(screen.getByText('文件有效性')).toBeVisible()
    expect(screen.getByText('来源 Trace')).toBeVisible()
    expect(screen.getByRole('heading', { name: '来源与版本历史' })).toBeVisible()
    expect(screen.getByRole('button', { name: '保存条目' })).toBeEnabled()
  })
})
