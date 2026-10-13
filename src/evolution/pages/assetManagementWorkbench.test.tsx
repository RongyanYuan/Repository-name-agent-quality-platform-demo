import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { createInitialEvolutionData } from '../data'

function Location() {
  const location = useLocation()
  return <output data-testid="asset-workbench-location">{location.pathname + location.search}</output>
}

function open(url = '/assets-skills') {
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider><App /><Location /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

describe('资产管理工作台', () => {
  it('按资产类型、具体资产、版本和时间范围级联筛选', async () => {
    open()
    expect(screen.queryByRole('region', { name: '全局筛选' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: '资产管理' })).toHaveLength(1)
    const type = screen.getByLabelText('资产类型')
    const asset = screen.getByLabelText('具体资产')
    const version = screen.getByLabelText('资产版本')
    expect(asset).toHaveValue('')
    expect(version).toBeDisabled()
    expect(screen.getByRole('button', { name: '下载报告' })).toBeDisabled()
    fireEvent.change(type, { target: { value: 'PRODUCTION_SKILL' } })
    await waitFor(() => {
      expect(screen.getByLabelText('资产类型')).toHaveValue('PRODUCTION_SKILL')
      expect(within(screen.getByLabelText('具体资产')).getByRole('option', { name: /PPT Builder/ })).toBeInTheDocument()
    })
    const productionAsset = screen.getByLabelText('具体资产')
    expect(productionAsset).toBeEnabled()
    const assetId = (productionAsset as HTMLSelectElement).options[1]?.value
    expect(assetId).toBeTruthy()
    fireEvent.change(productionAsset, { target: { value: assetId } })
    await waitFor(() => expect(screen.getByLabelText('具体资产')).toHaveValue(assetId))
    await waitFor(() => expect(screen.getByLabelText('资产版本')).toBeEnabled())
    const refreshedVersion = screen.getByLabelText('资产版本')
    fireEvent.change(refreshedVersion, { target: { value: (refreshedVersion as HTMLSelectElement).options[1]?.value } })
    await waitFor(() => expect(screen.getByRole('button', { name: '下载报告' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('资产开始时间'), { target: { value: '2026-09-01T00:00' } })
    fireEvent.change(screen.getByLabelText('资产结束时间'), { target: { value: '2026-10-31T23:59' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '下载报告' })).toBeEnabled())
    const location = new URL(screen.getByTestId('asset-workbench-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('assetType')).toBe('PRODUCTION_SKILL')
    expect(location.searchParams.get('assetId')).toBe(assetId)
    expect(location.searchParams.get('assetTimeFrom')).toBe('2026-09-01T00:00')
  })

  it('具体资产展示版本表现、进化历史和数据集入口', async () => {
    open('/assets-skills?assetType=TASTE_SKILL')
    const asset = screen.getByLabelText('具体资产')
    fireEvent.change(asset, { target: { value: (asset as HTMLSelectElement).options[1]?.value } })
    await waitFor(() => expect(screen.getByRole('table', { name: '资产版本表现' })).toBeVisible())
    expect(screen.getByRole('heading', { name: '进化历史' })).toBeVisible()
    expect(screen.getByText(/资产版本表现/)).toBeVisible()
  })

  it('选择全部版本后保留版本范围、完整历史和筛选状态', async () => {
    open('/assets-skills?assetType=TASTE_SKILL')
    const asset = screen.getByLabelText('具体资产')
    fireEvent.change(asset, { target: { value: (asset as HTMLSelectElement).options[1]?.value } })
    const version = screen.getByLabelText('资产版本')
    await waitFor(() => expect(version).toBeEnabled())
    fireEvent.change(version, { target: { value: '__ALL_ASSET_VERSIONS__' } })
    await waitFor(() => expect(version).toHaveValue('__ALL_ASSET_VERSIONS__'))
    const chart = screen.getByRole('img', { name: '历史版本产物平均分' })
    expect(chart.querySelectorAll('.chart-line')).toHaveLength(1)
    expect(chart.querySelectorAll('.chart-version').length).toBeGreaterThan(1)
    expect(screen.getByText('全部版本（历史）')).toBeInTheDocument()
    const location = new URL(screen.getByTestId('asset-workbench-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('assetVersion')).toBe('__ALL_ASSET_VERSIONS__')
  })

  it('历史分数图下按固定版本展示部署状态，时间筛选不改变当前状态', async () => {
    open('/assets-skills?assetType=PRODUCTION_SKILL&assetId=asset-catalog-skill-ppt-builder&assetVersion=__ALL_ASSET_VERSIONS__&timeRange=30d&environment=Production')
    const table = await screen.findByRole('table', { name: '资产版本表现' })
    expect(within(table).getByRole('columnheader', { name: '当前状态' })).toBeVisible()
    const versionRow = (version: string) => within(table).getByRole('cell', { name: version }).closest('tr')!
    expect(versionRow('2.6.0')).toHaveTextContent('Production · 使用中')
    expect(versionRow('2.6.0-rc.1')).toHaveTextContent('Staging · 验证中')
    expect(versionRow('2.5.0')).toHaveTextContent('历史版本 · 已下线')
    expect(within(versionRow('2.6.0')).getByRole('status')).toHaveAttribute('title', expect.stringContaining('本地 Mock'))

    fireEvent.change(screen.getByLabelText('资产开始时间'), { target: { value: '2026-08-01T00:00' } })
    fireEvent.change(screen.getByLabelText('资产结束时间'), { target: { value: '2026-08-31T23:59' } })
    await waitFor(() => expect(screen.getByLabelText('资产结束时间')).toHaveValue('2026-08-31T23:59'))
    expect(versionRow('2.6.0')).toHaveTextContent('Production · 使用中')
    expect(versionRow('2.6.0-rc.1')).not.toHaveTextContent('Production')
  })

  it('类型全部资产展示完整生产资产、分类月度历史，并清除残留版本', async () => {
    open('/assets-skills?assetType=PRODUCTION_SKILL&assetVersion=__ALL_ASSET_VERSIONS__')
    expect(screen.getAllByRole('heading', { name: '资产管理' })).toHaveLength(1)
    expect(screen.getByLabelText('资产版本')).toBeDisabled()
    await waitFor(() => {
      const location = new URL(screen.getByTestId('asset-workbench-location').textContent ?? '', 'https://demo.test')
      expect(location.searchParams.has('assetVersion')).toBe(false)
    })
    const table = await screen.findByRole('table', { name: '分类资产表现' })
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    for (const header of ['资产名称', '当前版本', '当前状态', '窗口产物均分（0–2）', '评测产物', '进化项', '贡献 Trace', '最近更新']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    for (const name of ['PPT Builder', 'Spreadsheet Analyst', 'Word Builder', 'Canvas Builder']) {
      expect(within(table).getByRole('cell', { name: new RegExp(name) })).toBeVisible()
    }
    const metrics = screen.getByRole('region', { name: '类别总览指标' })
    for (const label of ['资产数', '产物平均分', '已评测产物', '进化项数', '贡献 Trace']) expect(within(metrics).getByText(label, { exact: true })).toBeVisible()
    const chart = screen.getByRole('img', { name: '类别产物平均分历史' })
    expect(chart).toHaveTextContent('评分（0–2）')
    expect(chart).toHaveTextContent('时间')
    // Historical execution months remain visible even when their asset
    // versions have already left Production.
    const seed = createInitialEvolutionData()
    const production = new Map(seed.assetCatalog!.filter(item => item.kind === 'PRODUCTION_SKILL').map(item => [item.id, item]))
    const historicalMonths = new Set(seed.assetPerformanceRecords!
      .filter(item => production.has(item.assetId) && item.assetVersionId !== production.get(item.assetId)!.currentVersionId && item.score !== undefined)
      .map(item => (item.queryAt ?? item.scoredAt).slice(0, 7)))
    expect(historicalMonths.size).toBeGreaterThan(0)
    for (const month of historicalMonths) expect(chart).toHaveTextContent(month)
    expect(screen.queryByRole('table', { name: '资产进化历史' })).not.toBeInTheDocument()
  })

  it('分类搜索与时间窗口联动，保留无评分资产及进入返回的筛选上下文', async () => {
    open('/assets-skills?assetType=PRODUCTION_SKILL&assetTimeFrom=2026-09-01T00:00&assetTimeTo=2026-10-31T23:59')
    const table = await screen.findByRole('table', { name: '分类资产表现' })
    fireEvent.change(screen.getByLabelText('资产搜索'), { target: { value: 'PPT Builder' } })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    expect(within(table).queryByText('Spreadsheet Analyst')).not.toBeInTheDocument()
    const assetCell = within(table).getByRole('cell', { name: /PPT Builder/ })
    const assetLink = within(assetCell).queryByRole('link') ?? within(assetCell).getByRole('button')
    fireEvent.click(assetLink)
    await screen.findByRole('table', { name: '资产版本表现' })
    expect(screen.getByLabelText('资产开始时间')).toHaveValue('2026-09-01T00:00')
    expect(screen.getByLabelText('资产结束时间')).toHaveValue('2026-10-31T23:59')
    fireEvent.click(screen.getByRole('button', { name: '返回该类型全部资产' }))
    const returned = await screen.findByRole('table', { name: '分类资产表现' })
    expect(within(returned).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByLabelText('资产版本')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('资产搜索'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('资产开始时间'), { target: { value: '2099-01-01T00:00' } })
    fireEvent.change(screen.getByLabelText('资产结束时间'), { target: { value: '2099-01-31T23:59' } })
    await waitFor(() => expect(within(returned).getAllByRole('row')).toHaveLength(5))
    expect(within(returned).getAllByRole('cell', { name: '暂无评测结果' })).toHaveLength(4)
    expect(screen.queryByRole('img', { name: '类别产物平均分历史' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载报告' })).toBeEnabled()
  })

  it('只有具体资产 ID 的深链接归一为所属分类并可返回完整类别列表', async () => {
    open('/assets-skills?assetId=asset-catalog-skill-ppt-builder&skillId=skill-ppt-builder&assetTimeFrom=2026-08-01T00:00&assetTimeTo=2026-10-31T23:59')
    await screen.findByRole('table', { name: '资产版本表现' })
    await waitFor(() => expect(screen.getByLabelText('资产类型')).toHaveValue('PRODUCTION_SKILL'))
    fireEvent.click(screen.getByRole('button', { name: '返回该类型全部资产' }))
    const table = await screen.findByRole('table', { name: '分类资产表现' })
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(screen.getByLabelText('具体资产')).toHaveValue('')
    expect(screen.getByLabelText('资产开始时间')).toHaveValue('2026-08-01T00:00')
    expect(screen.getByLabelText('资产结束时间')).toHaveValue('2026-10-31T23:59')
    const location = new URL(screen.getByTestId('asset-workbench-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('assetType')).toBe('PRODUCTION_SKILL')
    expect(location.searchParams.has('assetId')).toBe(false)
    expect(location.searchParams.has('skillId')).toBe(false)
  })

  it('具体资产被搜索排除时清理对象及版本并显示对应类别结果', async () => {
    open('/assets-skills?assetType=PRODUCTION_SKILL&assetId=asset-catalog-skill-ppt-builder&assetVersion=2.6.0&assetTimeFrom=2026-08-01T00:00&assetTimeTo=2026-10-31T23:59')
    await screen.findByRole('table', { name: '资产版本表现' })
    fireEvent.change(screen.getByLabelText('资产搜索'), { target: { value: 'Word Builder' } })
    const table = await screen.findByRole('table', { name: '分类资产表现' })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByRole('link', { name: 'Word Builder' })).toBeVisible()
    expect(within(table).queryByText('PPT Builder', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: '资产版本表现' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('具体资产')).toHaveValue('')
    expect(screen.getByLabelText('资产版本')).toBeDisabled()
    const metrics = screen.getByRole('region', { name: '类别总览指标' })
    expect(within(metrics).getByText('资产数', { exact: true }).nextElementSibling).toHaveTextContent('1')
    const rowScore = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[3].textContent!
    expect(within(metrics).getByText('产物平均分', { exact: true }).nextElementSibling).toHaveTextContent(rowScore)
    expect(screen.getByLabelText('资产开始时间')).toHaveValue('2026-08-01T00:00')
    expect(screen.getByLabelText('资产结束时间')).toHaveValue('2026-10-31T23:59')
    const location = new URL(screen.getByTestId('asset-workbench-location').textContent ?? '', 'https://demo.test')
    expect(location.searchParams.get('assetQuery')).toBe('Word Builder')
    expect(location.searchParams.has('assetId')).toBe(false)
    expect(location.searchParams.has('assetVersion')).toBe(false)
    expect(screen.getByRole('button', { name: '下载报告' })).toBeEnabled()
  })
})
