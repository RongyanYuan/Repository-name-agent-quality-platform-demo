import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { createInitialEvolutionData } from '../data'
import { resolveIdentity } from '../identity'
const identityState = createInitialEvolutionData()
const canonicalTrace = (id:string) => resolveIdentity(identityState,'trace',id)

function Location() {
  const location = useLocation()
  return <output data-testid="workspace-location">{location.pathname + location.search}</output>
}
function open(url = '/datasets-evaluations?timeRange=30d&environment=Production') {
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider><App /><Location /></EvolutionProvider></QualityProvider></MemoryRouter>)
}
beforeEach(() => localStorage.clear())

describe('Skill version attribution dataset journey', () => {
  it('defaults the selected Skill to its latest fixed version and shows only active version attributions', async () => {
    open()
    expect(screen.getAllByRole('heading', { name: '数据集与评测', level: 1 })).toHaveLength(1)
    expect(screen.queryByRole('tab', { name: /Trace 评测/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('具体 Skill'), { target: { value: 'skill-ppt-builder' } })
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.6.0'))
    const info = screen.getByRole('region', { name: 'Skill 信息' })
    expect(info).toHaveTextContent('PPT Builder')
    expect(info).toHaveTextContent('skill-ppt-builder')
    expect(info).toHaveTextContent('生产 Skill')
    expect(info).toHaveTextContent('最近更新')
    const attribution = screen.getByLabelText('归因')
    expect(within(attribution).getByRole('option', { name: /skill sop错误/ })).toBeInTheDocument()
    expect(within(attribution).getByRole('option', { name: /skill name\/description错误/ })).toBeInTheDocument()
    expect(within(attribution).queryByRole('option', { name: /品味库召回错误/ })).not.toBeInTheDocument()
    fireEvent.change(attribution, { target: { value: 'skill-sop' } })
    const datasets = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(datasets).toHaveTextContent('dataset-workspace-ppt-260-sop-attribution')
    expect(datasets).not.toHaveTextContent('dataset-attribution ')
  })

  it('opens only dataset member Trace rows and returns from Case analysis with the selection retained', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=datasets&timeRange=30d')
    fireEvent.click(await screen.findByRole('row', { name: /dataset-workspace-ppt-260-sop-attribution/ }))
    const detail = screen.getByRole('dialog', { name: /数据集详情/ })
    const samples = within(detail).getByRole('table', { name: '数据集样本 Trace' })
    expect(samples).toHaveTextContent(canonicalTrace('trace-workspace-ppt-260-sop-1'))
    expect(samples).not.toHaveTextContent(canonicalTrace('trace-tool-export'))
    expect(within(samples).getByRole('columnheader', { name: 'Query 时间' })).toBeVisible()
    fireEvent.click(within(samples).getAllByRole('button', { name: '查看 Case / Trace' })[0])
    await waitFor(() => expect(screen.getByTestId('workspace-location')).toHaveTextContent('/cases?'))
    expect(screen.getByRole('dialog', { name: /Case 详情/ })).toHaveTextContent(canonicalTrace('trace-workspace-ppt-260-sop-1'))
    fireEvent.click(screen.getByRole('button', { name: '返回来源页面' }))
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.6.0'))
    expect(screen.getByLabelText('归因')).toHaveValue('skill-sop')
    expect(screen.getByRole('dialog', { name: /数据集详情/ })).toHaveTextContent('dataset-workspace-ppt-260-sop-attribution')
  })

  it('retains completed versions in history but clears incompatible selection when Skill changes', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.5.0&attribution=skill-sop&view=history')
    expect(await screen.findByRole('table', { name: '归因历史列表' })).toHaveTextContent('2.5.0')
    fireEvent.change(screen.getByLabelText('Skill 分类'), { target: { value: 'TASTE_SKILL' } })
    fireEvent.change(screen.getByLabelText('具体 Skill'), { target: { value: 'skill-taste-executive' } })
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('1.0.0-rc.1'))
    expect(screen.getByLabelText('归因')).not.toHaveValue('skill-sop')
    expect(screen.getByTestId('workspace-location')).not.toHaveTextContent('datasetId=')
    expect(screen.getByRole('region', { name: 'Skill 信息' })).toHaveTextContent('管理层品味库 Skill')
  })

  it('opens an explicitly linked dataset Case even when the retained online scope excludes it', async () => {
    open('/cases?caseId=case-ppt-management&traceId=trace-ppt-generate&skill=skill-word-writer&businessType=Word&environment=Staging&timeRange=24h')
    const detail = await screen.findByRole('dialog', { name: /Case 详情 · case-ppt-management/ })
    expect(detail).toHaveTextContent(canonicalTrace('trace-ppt-generate'))
    expect(within(detail).getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(within(detail).getByRole('button', { name: '查看 skill Evidence' }))
    expect(screen.getByRole('dialog', { name: 'skill Evidence' })).toHaveTextContent('obs-ppt-skill')
    expect(screen.getByRole('table', { name: 'Case / Trace 列表' })).not.toHaveTextContent('case-ppt-management')
  })

  it('opens a historical fixed-version deep link without silently showing the latest version context', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&historyItem=skill-ppt-builder%402.5.0%23skill-sop&view=history')
    expect(await screen.findByRole('dialog', { name: /归因历史详情/ })).toHaveTextContent('2.5.0')
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.5.0'))
    expect(screen.getByRole('region', { name: 'Skill 信息' })).toHaveTextContent('2.5.0')
  })

  it('opens a shared window experiment in the explicitly selected Skill context', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.5.0&view=history&experimentId=exp-window-2026w35')
    const detail = await screen.findByRole('dialog', { name: /归因历史详情/ })
    expect(detail).toHaveTextContent('skill-ppt-builder@2.5.0#skill-sop')
    expect(detail).toHaveTextContent('exp-window-2026w35')
  })

  it('resolves a Window reference into the full fixed-version history report', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&windowId=window-2026w35&view=history')
    const detail = await screen.findByRole('dialog', { name: /归因历史详情/ })
    expect(detail).toHaveTextContent('exp-window-2026w35')
    expect(detail).toHaveTextContent('每 Case 重复次数')
  })

  it('places the only concrete Skill selector beside its enabled version cascade for the reported URL', async () => {
    open('/datasets-evaluations?view=datasets&governanceObject=Skill&attribution=skill-sop')
    expect(screen.queryByLabelText('全局 Skill')).not.toBeInTheDocument()
    const filters = screen.getByRole('region', { name: '治理范围筛选' })
    fireEvent.change(within(filters).getByLabelText('Skill 分类'), { target: { value: 'PRODUCTION_SKILL' } })
    const skills = within(filters).getByLabelText('具体 Skill')
    expect(within(skills).getByRole('option', { name: /PPT Builder/ })).toBeInTheDocument()
    expect(within(skills).queryByRole('option', { name: /管理层品味库/ })).not.toBeInTheDocument()
    fireEvent.change(skills, { target: { value: 'skill-ppt-builder' } })
    await waitFor(() => expect(within(filters).getByLabelText('Skill 版本')).toHaveValue('2.6.0'))
    expect(within(filters).getByLabelText('Skill 版本')).toBeEnabled()
    fireEvent.change(within(filters).getByLabelText('Skill 版本'), { target: { value: '2.5.0' } })
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.5.0'))
    expect(screen.getByRole('table', { name: '数据集与评测列表' })).toHaveTextContent('dataset-attribution')
    expect(screen.getByRole('table', { name: '数据集与评测列表' })).not.toHaveTextContent('dataset-workspace-ppt-260-sop')
  })

  it('shows every version of one Skill without mixing another Skill when all versions is selected', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&view=datasets')
    fireEvent.change(screen.getByLabelText('Skill 版本'), { target: { value: 'all' } })
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('all'))
    const datasets = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(datasets).toHaveTextContent('dataset-attribution')
    expect(datasets).toHaveTextContent('dataset-workspace-ppt-260-sop-attribution')
    expect(datasets).toHaveTextContent('dataset-workspace-ppt-260rc-sop-attribution')
    expect(datasets).not.toHaveTextContent('dataset-workspace-excel')
    expect(screen.getByRole('region', { name: 'Skill 信息' })).toHaveTextContent('全部版本')
    fireEvent.click(screen.getByRole('tab', { name: /归因历史/ }))
    const history = screen.getByRole('table', { name: '归因历史列表' })
    expect(history).toHaveTextContent('skill-ppt-builder@2.5.0#skill-sop')
    expect(history).toHaveTextContent('skill-ppt-builder@2.6.0#skill-sop')
    expect(history).not.toHaveTextContent('skill-spreadsheet')
  })

  it.each([
    '/datasets-evaluations?skillId=skill-ppt-builder&skillVersion=2.5.0&view=datasets',
    '/datasets-evaluations?skill=skill-ppt-builder&historyItem=skill-ppt-builder%402.5.0%23skill-sop&view=history'
  ])('clears a concrete Skill without restoring it from aliases or linked history: %s', async url => {
    open(url)
    fireEvent.change(await screen.findByLabelText('具体 Skill'), { target: { value: '' } })
    await waitFor(() => expect(screen.getByLabelText('具体 Skill')).toHaveValue(''))
    const location = screen.getByTestId('workspace-location').textContent ?? ''
    const query = new URL(location, 'https://demo.test').searchParams
    expect(query.has('skill')).toBe(false)
    expect(query.has('skillId')).toBe(false)
    expect(query.has('skillVersion')).toBe(false)
    expect(query.has('historyItem')).toBe(false)
    expect(screen.getByLabelText('Skill 版本')).toBeDisabled()
    expect(screen.queryByRole('region', { name: 'Skill 信息' })).not.toBeInTheDocument()
  })

  it('filters datasets and history by Skill category and clears an incompatible specific selection', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop')
    fireEvent.change(screen.getByLabelText('Skill 分类'), { target: { value: 'TASTE_SKILL' } })
    await waitFor(() => expect(screen.getByLabelText('具体 Skill')).toHaveValue(''))
    expect(screen.getByRole('table', { name: '数据集与评测列表' })).toHaveTextContent('dataset-workspace-taste')
    expect(screen.getByRole('table', { name: '数据集与评测列表' })).not.toHaveTextContent('dataset-workspace-ppt')
    expect(screen.getByLabelText('归因')).toHaveValue('')
    fireEvent.click(screen.getByRole('tab', { name: /归因历史/ }))
    expect(screen.getByRole('table', { name: '归因历史列表' })).toHaveTextContent('skill-taste-executive')
    expect(screen.getByRole('table', { name: '归因历史列表' })).not.toHaveTextContent('skill-ppt-builder')
  })

  it('opens a historical row from the all-Skill history without clearing its ID or resetting to latest', async () => {
    open('/datasets-evaluations?view=history')
    fireEvent.click(screen.getByRole('row', { name: /skill-ppt-builder@2.5.0#skill-sop/ }))
    expect(await screen.findByRole('dialog', { name: /归因历史详情/ })).toHaveTextContent('skill-ppt-builder@2.5.0#skill-sop')
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.5.0'))
    expect(screen.getByLabelText('具体 Skill')).toHaveValue('skill-ppt-builder')
    expect(screen.getByTestId('workspace-location')).toHaveTextContent('historyItem=')
  })

  it('keeps the all-version Skill scope usable when moving to Case analysis', async () => {
    open('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=all&timeRange=30d')
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', { name: 'Case / Trace 分析' }))
    await waitFor(() => expect(screen.getByTestId('workspace-location')).toHaveTextContent('/cases?'))
    expect(screen.getByLabelText('Skill 版本')).toHaveValue('')
    const cases = screen.getByRole('table', { name: 'Case / Trace 列表' })
    expect(cases).toHaveTextContent('case-ppt-management')
    fireEvent.change(screen.getByLabelText('Trace ID'),{target:{value:'trace-workspace-ppt-260-sop-1'}})
    expect(screen.getByRole('table',{name:'Case / Trace 列表'})).toHaveTextContent('case-workspace-ppt-260-sop-1')
  })

  it('makes Skill category and governance object mutually exclusive', async () => {
    open('/datasets-evaluations?skillCategory=PRODUCTION_SKILL&skill=skill-ppt-builder&skillVersion=2.6.0&governanceObject=Memory&attribution=memory-recall&view=datasets')
    await waitFor(() => expect(screen.getByLabelText('具体 Skill')).toHaveValue('skill-ppt-builder'))
    expect(screen.queryByLabelText('归因对象')).not.toBeInTheDocument()
    expect(screen.getByText('当前治理对象：Skill')).toBeVisible()
    await waitFor(() => {
      const location = new URL(screen.getByTestId('workspace-location').textContent ?? '', 'https://demo.test')
      expect(location.searchParams.get('governanceObject')).toBe('Skill')
      expect(location.searchParams.has('attribution')).toBe(false)
    })
  })

  it('keeps the full governance object filter when no Skill category or concrete Skill is selected', async () => {
    open('/datasets-evaluations?view=datasets')
    const objectFilter = screen.getByLabelText('归因对象')
    expect(objectFilter).toBeVisible()
    fireEvent.change(objectFilter, { target: { value: 'Memory' } })
    await waitFor(() => expect(screen.getByLabelText('归因对象')).toHaveValue('Memory'))
  })
})
