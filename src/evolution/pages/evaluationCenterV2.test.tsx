import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { QualityProvider, useQuality } from '../../store'
import { EvolutionProvider } from '../store'
import { EvaluationCenterPage } from './EvaluationCenterPage'
import { createInitialEvolutionData } from '../data'
import type { EvolutionRepository } from '../repository'

function renderPage(repository?: EvolutionRepository) {
  localStorage.clear()
  function TestScope() {
    const { dispatch } = useQuality()
    useEffect(() => { dispatch({ type: 'SET_FILTERS', filters: { timeRange: '30d' } }) }, [dispatch])
    return null
  }
  return render(<MemoryRouter><QualityProvider><TestScope /><EvolutionProvider repository={repository}><EvaluationCenterPage /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

describe('V2 评测中心批次与 Trace 台账', () => {
  it('opens a real Trace package, read-only Evidence and its explicit shared review editor', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /全部已评测 Trace/ }))
    const table = screen.getByRole('table', { name: '全部已评测 Trace 台账' })
    fireEvent.click(within(table).getAllByRole('row')[1])
    const traceDrawer = screen.getByRole('dialog', { name: /Trace 评测包/ })
    expect(traceDrawer).toHaveTextContent('模块评测矩阵')
    expect(traceDrawer).toHaveTextContent('上文')
    fireEvent.click(within(traceDrawer).getByRole('button', { name: '查看 skill Evidence' }))
    const evidenceDrawer = screen.getByRole('dialog', { name: /Evidence/ })
    expect(evidenceDrawer).toHaveTextContent('Root Evidence')
    expect(evidenceDrawer).toHaveTextContent('Rubric Rule')
    expect(within(evidenceDrawer).queryByLabelText('人工分数（0–2）')).not.toBeInTheDocument()
    fireEvent.click(within(evidenceDrawer).getByRole('button', { name: /人工复核|修改复核/ }))
    fireEvent.change(within(evidenceDrawer).getByLabelText('辅助结论'), { target: { value: 'PASS' } })
    fireEvent.change(within(evidenceDrawer).getByLabelText('人工分数（0–2）'), { target: { value: '1.2' } })
    fireEvent.change(within(evidenceDrawer).getByLabelText('复核说明'), { target: { value: '人工确认可接受' } })
    fireEvent.click(within(evidenceDrawer).getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(evidenceDrawer).toHaveTextContent('人工确认可接受'))
    fireEvent.click(within(evidenceDrawer).getByRole('button', { name: 'Close panel' }))
    fireEvent.click(within(traceDrawer).getByRole('button', { name: '修改复核 skill' }))
    expect(within(screen.getByRole('dialog', { name: /Evidence/ })).getByLabelText('人工分数（0–2）')).toHaveValue(1.2)
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

  it('retains the legacy package review inputs when actual persistence fails', async () => {
    const state = createInitialEvolutionData()
    const repository: EvolutionRepository = { load: () => state, reset: () => state, save: () => { throw new Error('磁盘保存失败') } }
    renderPage(repository)
    fireEvent.click(screen.getByRole('tab', { name: /全部已评测 Trace/ }))
    const table = screen.getByRole('table', { name: '全部已评测 Trace 台账' })
    fireEvent.click(within(table).getAllByRole('row')[1])
    fireEvent.click(within(screen.getByRole('dialog', { name: /Trace 评测包/ })).getByRole('button', { name: '查看 skill Evidence' }))
    const drawer = screen.getByRole('dialog', { name: /Evidence/ })
    fireEvent.click(within(drawer).getByRole('button', { name: /人工复核|修改复核/ }))
    fireEvent.change(within(drawer).getByLabelText('辅助结论'), { target: { value: 'FAIL' } })
    fireEvent.change(within(drawer).getByLabelText('人工分数（0–2）'), { target: { value: '0' } })
    fireEvent.change(within(drawer).getByLabelText('复核说明'), { target: { value: '磁盘错误仍保留' } })
    fireEvent.click(within(drawer).getByRole('button', { name: '保存人工复核' }))
    await waitFor(() => expect(within(drawer).getByText(/磁盘保存失败/)).toBeInTheDocument())
    expect(within(drawer).getByLabelText('人工分数（0–2）')).toHaveValue(0)
    expect(within(drawer).getByLabelText('复核说明')).toHaveValue('磁盘错误仍保留')
  })
})
