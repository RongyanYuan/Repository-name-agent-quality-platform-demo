import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { EvaluationCenterPage } from './EvaluationCenterPage'

function renderPage() {
  localStorage.clear()
  return render(<MemoryRouter><QualityProvider><EvolutionProvider><EvaluationCenterPage /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

describe('V2 评测中心批次与 Trace 台账', () => {
  it('opens a real Trace package, module matrix and Evidence Bundle override form', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /全部已评测 Trace/ }))
    const table = screen.getByRole('table', { name: '全部已评测 Trace 台账' })
    fireEvent.click(within(table).getAllByRole('row')[1])
    const traceDrawer = screen.getByRole('dialog', { name: /Trace 评测包/ })
    expect(traceDrawer).toHaveTextContent('模块评测矩阵')
    expect(traceDrawer).toHaveTextContent('上文')
    fireEvent.click(within(traceDrawer).getAllByRole('button', { name: /查看 .* Evidence/ })[0])
    const evidenceDrawer = screen.getByRole('dialog', { name: /Evidence/ })
    expect(evidenceDrawer).toHaveTextContent('Root Evidence')
    expect(evidenceDrawer).toHaveTextContent('Rubric Rule')
    expect(evidenceDrawer).toHaveTextContent('人工 Override')
    fireEvent.change(within(evidenceDrawer).getByLabelText('人工状态'), { target: { value: 'PASS' } })
    fireEvent.change(within(evidenceDrawer).getByLabelText('人工备注'), { target: { value: '人工确认可接受' } })
    fireEvent.click(within(evidenceDrawer).getByRole('button', { name: '保存人工 Override' }))
    expect(evidenceDrawer).toHaveTextContent('人工确认可接受')
  })

  it('creates a batch with trace IDs and keeps the batch drawer deep-linkable', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '创建评测批次' }))
    fireEvent.change(screen.getByLabelText('批次名称'), { target: { value: 'V2 UI 批次' } })
    fireEvent.change(screen.getByLabelText('输入 Trace IDs'), { target: { value: 'trace-ppt-generate trace-tool-export' } })
    fireEvent.click(screen.getByRole('button', { name: '保存批次' }))
    fireEvent.click(screen.getByRole('tab', { name: /批次历史/ }))
    expect(screen.getByRole('table', { name: '评测批次历史' })).toHaveTextContent('V2 UI 批次')
    fireEvent.click(screen.getByRole('row', { name: /V2 UI 批次/ }))
    const batchDrawer = screen.getByRole('dialog', { name: /批次详情/ })
    expect(batchDrawer).toHaveTextContent('Eval Agent Version')
    fireEvent.click(within(batchDrawer).getByRole('button', { name: '运行批次' }))
    expect(batchDrawer).toHaveTextContent('QUEUED')
    fireEvent.click(within(batchDrawer).getByRole('button', { name: '开始执行' }))
    expect(batchDrawer).toHaveTextContent('RUNNING')
    fireEvent.click(within(batchDrawer).getByRole('button', { name: '完成 Mock 运行' }))
    expect(batchDrawer).toHaveTextContent('COMPLETED')
  })
})
