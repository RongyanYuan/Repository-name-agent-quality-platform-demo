import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { Dataset, EvolutionState } from '../domain'
import type { EvolutionRepository } from '../repository'
import { EvolutionProvider } from '../store'
import { DatasetExecutionWorkbench, artifactSnapshotDownload } from './DatasetExecutionWorkbench'
import { createDatasetExecutionRun } from '../data/datasetExecution'

function fixture(): { state: EvolutionState; dataset: Dataset } {
  const state = createInitialEvolutionData()
  const dataset: Dataset = {
    id: 'dataset-manual-input-ui', name: '人工输入验收集', version: 'v1', type: 'REGRESSION',
    caseIds: [], sampleCount: 0, source: '当前用户', scope: '人工输入 Query 测试', frozen: false,
    datasetCategory: 'PERSONAL', datasetOrigin: 'USER_CUSTOM', ownerScope: 'USER',
    population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock', countingRule: '按输入记录去重' },
    createdAt: '2026-10-13T02:00:00Z', updatedAt: '2026-10-13T02:00:00Z'
  }
  state.datasets.push(dataset)
  return { state, dataset }
}

describe('Dataset execution input controls', () => {
  it('keeps an explicitly requested run configuration open on the initial drawer mount', () => {
    const { state, dataset } = fixture()
    render(<MemoryRouter><EvolutionProvider initialState={state}><DatasetExecutionWorkbench dataset={dataset} requestKey={1} requestMode="GENERATE_AND_EVALUATE" onNavigateResult={vi.fn()} /></EvolutionProvider></MemoryRouter>)
    const dialog = screen.getByRole('dialog', { name: '运行配置' })
    expect(within(dialog).getByLabelText('执行方式')).toHaveValue('GENERATE_AND_EVALUATE')
    expect(within(dialog).getByRole('button', { name: '确认运行' })).toBeDisabled()
    expect(dialog).toHaveTextContent('本次可运行 0 条 Query')
  })

  it('requires both task content and output type and keeps the form when durable save fails', async () => {
    const { state, dataset } = fixture()
    let shouldFail = true, persisted = state
    const repository: EvolutionRepository = { load: () => state, reset: () => state, save(next) { if (shouldFail) throw new Error('测试存储空间不足'); persisted = structuredClone(next) } }
    render(<MemoryRouter><EvolutionProvider repository={repository}><DatasetExecutionWorkbench dataset={dataset} onNavigateResult={vi.fn()} /></EvolutionProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '添加 Query' }))
    const dialog = screen.getByRole('dialog', { name: '添加 Query' })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存 Query' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('请选择产物类型')
    fireEvent.change(within(dialog).getByLabelText('产物类型'), { target: { value: 'Word' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存 Query' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('请输入任务内容')
    fireEvent.change(within(dialog).getByLabelText('Query 内容'), { target: { value: '请生成人工添加的项目复盘 Word 文档。' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存 Query' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('测试存储空间不足'))
    expect(within(dialog).getByLabelText('Query 内容')).toHaveValue('请生成人工添加的项目复盘 Word 文档。')
    expect(persisted.datasetQueries ?? []).toHaveLength(0)
    shouldFail = false
    fireEvent.click(within(dialog).getByRole('button', { name: '保存 Query' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '添加 Query' })).not.toBeInTheDocument())
    expect(persisted.datasetQueries).toHaveLength(1)
    expect(persisted.datasetQueries?.[0]).toEqual(expect.objectContaining({ query: '请生成人工添加的项目复盘 Word 文档。', verticalScenario: 'Word', status: 'PENDING' }))
    expect(screen.getByRole('table', { name: '人工 Query' })).toHaveTextContent('待运行')
  })

  it('does not treat external population statistics as runnable queries and keeps frozen inputs immutable', () => {
    const { state, dataset } = fixture()
    dataset.frozen = true
    dataset.sampleCount = 950
    dataset.population = { ...dataset.population, totalSampleCount: 950, externalSampleCount: 950 }
    render(<MemoryRouter><EvolutionProvider initialState={state}><DatasetExecutionWorkbench dataset={dataset} onNavigateResult={vi.fn()} /></EvolutionProvider></MemoryRouter>)
    expect(screen.getByRole('button', { name: '添加 Query' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '跑结果 & 评测' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '仅评测已有结果' })).toBeDisabled()
    expect(screen.getByText(/另有 950 条外部统计样本/)).toBeInTheDocument()
    expect(screen.getByText(/数据集已冻结，不能新增成员，仍可执行已有样本/)).toBeInTheDocument()
  })

  it('downloads an escaped metadata snapshot for Mock source files without altering their URI', () => {
    const { state, dataset } = fixture()
    state.datasetQueries = [{ id: 'query-snapshot', datasetId: dataset.id, datasetVersion: dataset.version, query: '<script>alert("query")</script>', verticalScenario: 'PPT', status: 'PENDING', createdBy: '当前用户', createdAt: dataset.createdAt, updatedAt: dataset.updatedAt }]
    const run = createDatasetExecutionRun(state, { id: 'run-snapshot', datasetId: dataset.id, mode: 'GENERATE_AND_EVALUATE', scope: 'ALL', actor: '当前用户', at: dataset.createdAt })
    const artifact = { ...state.artifacts[0], name: '<img src=x onerror=alert(1)>.pptx', uri: 'mock://source-original.pptx' }
    const item = { ...run.items[0], processFinal: 0, outcomeFinal: 1.5 }
    const href = artifactSnapshotDownload(artifact, item, run)
    const html = decodeURIComponent(href.replace('data:text/html;charset=utf-8,', ''))
    expect(html).toContain('不是原始 Office 文件')
    expect(html).toContain('&lt;script&gt;alert(&quot;query&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('0.00 / 2')
    expect(html).toContain('1.50 / 2')
    expect(artifact.uri).toBe('mock://source-original.pptx')
  })
})
