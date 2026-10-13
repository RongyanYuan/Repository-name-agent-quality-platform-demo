import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'

function open(url = '/datasets-evaluations?view=datasets&datasetCategory=PERSONAL') {
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider><App /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

async function createDataset(name: string) {
  fireEvent.click(screen.getByRole('button', { name: '创建自定义数据集' }))
  const dialog = screen.getByRole('dialog', { name: '创建自定义数据集' })
  fireEvent.change(within(dialog).getByLabelText('数据集名称'), { target: { value: name } })
  fireEvent.change(within(dialog).getByLabelText('描述 / 用途'), { target: { value: '人工 Query 执行链路验收' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '确认创建' }))
  return screen.findByRole('dialog', { name: `数据集详情 · ${name}` })
}

beforeEach(() => localStorage.clear())

describe('数据集人工 Query 与运行配置', () => {
  it('人工录入和已有 Trace 是两个入口；空 Query 不可保存', async () => {
    open()
    const detail = await createDataset('人工录入校验集')
    expect(within(detail).getByRole('button', { name: '添加已有 Trace' })).toBeEnabled()
    expect(within(detail).queryByRole('button', { name: '添加 Query / Trace' })).not.toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button', { name: '添加 Query' }))
    const query = screen.getByRole('dialog', { name: '添加 Query' })
    fireEvent.change(within(query).getByLabelText('产物类型'), { target: { value: 'PPT' } })
    fireEvent.click(within(query).getByRole('button', { name: '保存 Query' }))
    expect(query).toBeVisible()
    expect(within(query).getByRole('alert')).toHaveTextContent(/Query|任务内容/)
    expect(within(query).getByLabelText('产物类型')).toHaveTextContent('PPT')
    expect(within(query).getByLabelText('产物类型')).toHaveTextContent('Word')
    expect(within(query).getByLabelText('产物类型')).toHaveTextContent('Excel')
    expect(within(query).getByLabelText('产物类型')).toHaveTextContent('生图')
  })

  it('人工 Query 保存为待运行，重新挂载页面仍保留内容', async () => {
    open()
    const detail = await createDataset('人工 Query 持久化集')
    fireEvent.click(within(detail).getByRole('button', { name: '添加 Query' }))
    const query = screen.getByRole('dialog', { name: '添加 Query' })
    fireEvent.change(within(query).getByLabelText(/^Query\s*内容$/), { target: { value: '生成季度经营 PPT，并突出行动计划' } })
    fireEvent.change(within(query).getByLabelText('产物类型'), { target: { value: 'PPT' } })
    fireEvent.click(within(query).getByRole('button', { name: '保存 Query' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '添加 Query' })).not.toBeInTheDocument())
    const drafts = within(detail).getByRole('table', { name: '人工 Query' })
    expect(drafts).toHaveTextContent('生成季度经营 PPT')
    expect(drafts).toHaveTextContent('待运行')
    const envelope = JSON.parse(localStorage.getItem('office-agent-evolution-governance:v1')!)
    const draft = envelope.state.datasetQueries.find((item: { query: string }) => item.query.includes('季度经营 PPT'))
    expect(draft.status).toBe('PENDING')
    cleanup()
    open(`/datasets-evaluations?view=datasets&datasetCategory=PERSONAL&datasetId=${draft.datasetId}`)
    await expect(screen.findByRole('dialog', { name: '数据集详情 · 人工 Query 持久化集' })).resolves.toHaveTextContent('生成季度经营 PPT')
  })

  it('冻结数据集禁止新增成员但保留两种运行入口，并明确 Mock', async () => {
    open('/datasets-evaluations?view=datasets&datasetCategory=GATE&datasetId=dataset-generalization')
    const detail = await screen.findByRole('dialog', { name: /数据集详情 · 泛化数据集A/ })
    expect(detail).toHaveTextContent('已冻结')
    expect(within(detail).queryByRole('button', { name: '添加 Query' })).not.toBeInTheDocument()
    expect(within(detail).queryByRole('button', { name: '添加已有 Trace' })).not.toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: '仅评测已有结果' })).toBeEnabled()
    fireEvent.click(within(detail).getByRole('button', { name: '跑结果 & 评测' }))
    const config = await screen.findByRole('dialog', { name: '运行配置' })
    expect(config).toHaveTextContent('Mock')
    expect(within(config).getByLabelText('运行范围')).toBeVisible()
    fireEvent.change(within(config).getByLabelText('运行范围'), { target: { value: 'ALL' } })
    expect(within(config).getByRole('button', { name: '确认运行' })).toBeEnabled()
  })
})
