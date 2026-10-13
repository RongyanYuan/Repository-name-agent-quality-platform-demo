import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { initialEvolutionData } from '../data'

function Location() {
  const location = useLocation()
  return <output data-testid="custom-dataset-location">{location.pathname + location.search}</output>
}

function open(url = '/datasets-evaluations?view=datasets') {
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider><App /><Location /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

/** datetime-local inputs use the browser's local wall-clock representation. */
const localDateTime = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

beforeEach(() => localStorage.clear())

describe('数据集与评测中的自定义数据集', () => {
  it('选择归因对象后保留统一工作台的上方筛选项', async () => {
    open()
    fireEvent.change(screen.getByLabelText('归因对象'), { target: { value: 'Memory' } })
    await waitFor(() => expect(screen.getByLabelText('归因对象')).toHaveValue('Memory'))
    expect(screen.getByLabelText('Skill 分类')).toBeVisible()
    expect(screen.getByLabelText('具体 Skill')).toBeVisible()
    expect(screen.getByLabelText('Skill 版本')).toBeVisible()
    expect(screen.getByLabelText('数据集类型')).toBeVisible()
  })

  it('从模块归因历史返回数据集时恢复统一筛选区', async () => {
    open('/datasets-evaluations?governanceObject=Memory&view=history&datasetTimeFrom=2026-09-24T00:00&datasetTimeTo=2026-09-24T23:59')
    fireEvent.click(await screen.findByRole('tab', { name: /数据集/ }))
    await waitFor(() => expect(screen.getByLabelText('自定义开始时间')).toHaveValue('2026-09-24T00:00'))
    expect(screen.getByLabelText('自定义结束时间')).toHaveValue('2026-09-24T23:59')
    expect(screen.getByLabelText('数据集时间窗口')).toBeVisible()
    const location = new URL(screen.getByTestId('custom-dataset-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('evolutionScope')).toBeNull()
    expect(location.searchParams.get('governanceObject')).toBe('Memory')
  })

  it('按类别和时间窗口筛选，并将选择保留在 URL', async () => {
    open()
    const category = screen.getByLabelText('数据集类型')
    fireEvent.change(category, { target: { value: 'PERSONAL' } })
    await waitFor(() => expect(category).toHaveValue('PERSONAL'))
    const table = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(table).toHaveTextContent('dataset-personal-ppt-regression')
    expect(table).not.toHaveTextContent('dataset-golden-test-set-a')

    const windowFilter = screen.getByLabelText('数据集时间窗口')
    fireEvent.change(windowFilter, { target: { value: 'window-2026w35' } })
    await waitFor(() => expect(windowFilter).toHaveValue('window-2026w35'))
    const location = new URL(screen.getByTestId('custom-dataset-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('datasetCategory')).toBe('PERSONAL')
    expect(location.searchParams.get('datasetTimeWindow')).toBe('window-2026w35')

    const start = screen.getByLabelText('自定义开始时间')
    const end = screen.getByLabelText('自定义结束时间')
    fireEvent.change(start, { target: { value: '2026-09-20T00:00' } })
    fireEvent.change(end, { target: { value: '2026-09-30T23:59' } })
    await waitFor(() => expect(start).toHaveValue('2026-09-20T00:00'))
    expect(end).toHaveValue('2026-09-30T23:59')
    const customLocation = new URL(screen.getByTestId('custom-dataset-location').textContent ?? '', 'https://demo.test')
    expect(customLocation.searchParams.get('datasetTimeWindow')).toBeNull()
    expect(customLocation.searchParams.get('datasetTimeFrom')).toBe('2026-09-20T00:00')
    expect(customLocation.searchParams.get('datasetTimeTo')).toBe('2026-09-30T23:59')

    fireEvent.change(start, { target: { value: '2026-10-01T00:00' } })
    expect(screen.getByRole('alert')).toHaveTextContent('不能早于')
  })

  it('按数据集样本覆盖范围做闭区间交集筛选，而不是按创建时间筛选', async () => {
    open()
    fireEvent.change(screen.getByLabelText('数据集类型'), { target: { value: 'GOLDEN' } })
    const sample = initialEvolutionData.datasets.find(item => item.id === 'dataset-golden-test-set-c')
    expect(sample?.timeRange).toBeDefined()
    const start = screen.getByLabelText('自定义开始时间')
    const end = screen.getByLabelText('自定义结束时间')
    // A one-minute interval at the sample's first Trace timestamp must match
    // because dataset coverage uses an inclusive overlap relation.
    const firstMinute = localDateTime(sample!.timeRange!.from)
    fireEvent.change(start, { target: { value: firstMinute } })
    fireEvent.change(end, { target: { value: firstMinute } })

    const table = screen.getByRole('table', { name: '数据集与评测列表' })
    await waitFor(() => expect(table).toHaveTextContent('黄金测试集C · 品味偏好历史'))
    expect(table).not.toHaveTextContent('黄金测试集A · 全链路基线')
    expect(table).not.toHaveTextContent('黄金测试集B · 多轮上下文')
    const location = new URL(screen.getByTestId('custom-dataset-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('datasetTimeFrom')).toBe(firstMinute)
    expect(location.searchParams.get('datasetTimeTo')).toBe(firstMinute)
    expect(location.searchParams.get('datasetTimeWindow')).toBeNull()
  })

  it('仅设置开始时间时按样本范围的结束时间匹配，并排除更早的个人数据集', async () => {
    open()
    fireEvent.change(screen.getByLabelText('数据集类型'), { target: { value: 'PERSONAL' } })
    const memoryHistory = initialEvolutionData.datasets.find(item => item.id === 'dataset-personal-memory-history')
    expect(memoryHistory?.timeRange).toBeDefined()
    fireEvent.change(screen.getByLabelText('自定义开始时间'), { target: { value: localDateTime(memoryHistory!.timeRange!.from) } })
    const table = screen.getByRole('table', { name: '数据集与评测列表' })
    await waitFor(() => expect(table).toHaveTextContent('我的 Memory 历史复核集'))
    expect(table).not.toHaveTextContent('我的 PPT 回归集 · 管理层样式')
    expect(screen.getByLabelText('自定义结束时间')).toHaveValue('')
  })

  it('创建自定义数据集后可添加精确 Trace，并在详情中显示成员', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: '创建自定义数据集' }))
    const createDialog = screen.getByRole('dialog', { name: '创建自定义数据集' })
    fireEvent.change(within(createDialog).getByLabelText('数据集名称'), { target: { value: '我的红色品味复核集' } })
    fireEvent.change(within(createDialog).getByLabelText('描述 / 用途'), { target: { value: '验证用户偏好驱动的 Skill 迭代' } })
    fireEvent.click(within(createDialog).getByRole('button', { name: '确认创建' }))

    const detail = await screen.findByRole('dialog', { name: /数据集详情 · 我的红色品味复核集/ })
    expect(detail).toHaveTextContent('自定义数据集')
    expect(detail).toHaveTextContent('验证用户偏好驱动的 Skill 迭代')

    fireEvent.click(within(detail).getByRole('button', { name: '添加已有 Trace' }))
    const addDialog = screen.getByRole('dialog', { name: '添加已有 Trace' })
    const traceCheckbox = within(addDialog).getAllByRole('checkbox', { name: /^选择 Trace / })[0]
    const traceId = traceCheckbox.getAttribute('aria-label')?.replace('选择 Trace ', '')
    fireEvent.click(traceCheckbox)
    fireEvent.click(within(addDialog).getByRole('button', { name: '确认添加' }))

    const updatedDetail = screen.getByRole('dialog', { name: /数据集详情 · 我的红色品味复核集/ })
    await waitFor(() => expect(updatedDetail).toHaveTextContent(traceId ?? 'trace-'))
    expect(updatedDetail).toHaveTextContent('样本时间范围')
    expect(updatedDetail).not.toHaveTextContent('未配置（加入 Trace 后自动计算）')
    const samples = within(updatedDetail).getByRole('table', { name: '数据集样本 Trace' })
    expect(samples).toHaveTextContent(traceId ?? 'trace-')
    expect(screen.getByTestId('custom-dataset-location')).toHaveTextContent('datasetCategory=PERSONAL')
  })

  it('在自定义数据集详情中预览按资产均匀抽样，并保留历史归因配额', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: '创建自定义数据集' }))
    const createDialog = screen.getByRole('dialog', { name: '创建自定义数据集' })
    fireEvent.change(within(createDialog).getByLabelText('数据集名称'), { target: { value: '抽样验证集' } })
    fireEvent.change(within(createDialog).getByLabelText('描述 / 用途'), { target: { value: '验证历史进化项的比例抽样' } })
    fireEvent.click(within(createDialog).getByRole('button', { name: '确认创建' }))
    const detail = await screen.findByRole('dialog', { name: /数据集详情 · 抽样验证集/ })
    fireEvent.click(within(detail).getByRole('button', { name: '按资产均匀抽样' }))
    const samplingDialog = screen.getByRole('dialog', { name: '按资产均匀抽样 Trace' })
    expect(samplingDialog).toHaveTextContent('按所选资产的每个历史归因项经历过的 Trace 占比计算配额')
    fireEvent.change(within(samplingDialog).getByLabelText('目标 Trace 数'), { target: { value: '5' } })
    await waitFor(() => expect(samplingDialog).toHaveTextContent('历史 Trace'))
    expect(samplingDialog).toHaveTextContent('目标配额')
    expect(samplingDialog).toHaveTextContent('按历史归因项 Trace 占比')
  })
})
