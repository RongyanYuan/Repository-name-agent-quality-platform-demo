import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { buildCaseAnalysisDataFromEvolution } from './model'
import { CaseAnalysisWorkbench } from './CaseAnalysisWorkbench'

describe('Case tabs own their complete content once', () => {
  it('owns complete scores in their tabs without restoring the deleted execution or task tabs', () => {
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())} initialCaseId="case-ppt-management" />)
    expect(screen.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: '治理链路' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('trace-timeline')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Trace 模块评测矩阵' })).toHaveLength(1)
    expect(screen.queryByText('查看治理链路与处理进度')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '产物评测' }))
    expect(screen.queryByRole('heading', { name: 'Trace 模块评测矩阵' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '评测中心' }))
    expect(screen.getAllByRole('heading', { name: 'Trace 模块评测矩阵' })).toHaveLength(1)
    expect(screen.queryByTestId('trace-timeline')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '任务与关联' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Trace 与 Evidence' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Session 对话' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).queryByText('Session ID')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Trace ID')).not.toBeInTheDocument()
    expect(within(panel).queryByText('运行 Log')).not.toBeInTheDocument()
    expect(within(panel).queryByText('人工修订历史')).not.toBeInTheDocument()
  })
})
