import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { QualityProvider, useQuality } from '../../store'
import { EvolutionProvider } from '../store'
import { ExperimentsGatesPage, ReleasesPage, RuleConfigurationPage } from './index'

function FullHistoryScope({ children }: { children: ReactNode }) {
  const { state, dispatch } = useQuality()
  useEffect(() => { dispatch({ type: 'SET_FILTERS', filters: { timeRange: '30d' } }) }, [dispatch])
  return state.filters.timeRange === '30d' ? children : null
}
const renderPage = (page: React.ReactNode) => render(<MemoryRouter><QualityProvider><FullHistoryScope><EvolutionProvider>{page}</EvolutionProvider></FullHistoryScope></QualityProvider></MemoryRouter>)

describe('experiment configuration, execution, reports, and release details', () => {
  beforeEach(() => localStorage.clear())
  it('shows only three asset-scoped configuration entries and keeps unspecified gates pending', () => {
    renderPage(<RuleConfigurationPage />)
    for (const title of ['配置指标准出门禁', '配置分流规则', '配置聚类规则']) expect(screen.getByRole('button', { name: title })).toBeVisible()
    expect(screen.queryByText('总耗时 Baseline')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '配置指标准出门禁' }))
    fireEvent.change(screen.getByLabelText('资产类型'), { target: { value: 'PRODUCTION_SKILL' } })
    fireEvent.change(screen.getByLabelText('具体资产'), { target: { value: 'asset-catalog-skill-ppt-builder' } })
    fireEvent.change(screen.getByLabelText('归因'), { target: { value: 'skill-sop' } })
    expect(screen.getByLabelText('过程最终得分下限')).toHaveValue(null)
    expect(screen.getByLabelText('产物最终得分下限')).toHaveValue(null)
  })

  it('uses a newly configured repeat rule as the next Experiment default', async () => {
    renderPage(<><RuleConfigurationPage initialRuleId="rule-repeat-count" /><ExperimentsGatesPage /></>)
    fireEvent.click(screen.getByRole('button', { name: '编辑规则' }))
    fireEvent.change(screen.getByLabelText('规则值'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑规则' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '创建实验' }))
    expect(screen.getByRole('dialog', { name: '创建实验' })).toHaveTextContent('规则默认 5 次 / Case')
    expect(screen.getByLabelText('重复次数')).toHaveValue(5)
  })

  it('creates a single experiment from every explicit selectable input and freezes the rule-derived default', () => {
    renderPage(<ExperimentsGatesPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建实验' }))
    const dialog = screen.getByRole('dialog', { name: '创建实验' })
    fireEvent.change(within(dialog).getByLabelText('实验名称'), { target: { value: '完整配置实验' } })
    fireEvent.change(within(dialog).getByLabelText('候选变体'), { target: { value: 'variant-reason-office-plan' } })
    fireEvent.change(within(dialog).getByLabelText('模型'), { target: { value: 'gpt-5.3-eval' } })
    fireEvent.change(within(dialog).getByLabelText('运行环境'), { target: { value: 'Staging' } })
    fireEvent.change(within(dialog).getByLabelText('超时毫秒'), { target: { value: '90000' } })
    fireEvent.change(within(dialog).getByLabelText('重复次数'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByLabelText('slides.render'))
    fireEvent.click(within(dialog).getByLabelText('dataset-regression'))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存实验' }))

    fireEvent.click(screen.getByRole('row', { name: /完整配置实验/ }))
    const detail = screen.getByRole('dialog', { name: '实验详情' })
    expect(detail).toHaveTextContent('gpt-5.3-eval')
    expect(detail).toHaveTextContent('Staging')
    expect(detail).toHaveTextContent('90000 ms')
    expect(detail).toHaveTextContent('5 次 / Case')
    expect(detail).toHaveTextContent('slides.render')
    expect(detail).toHaveTextContent('dataset-attribution')
  })

  it('selects a Window as the exact source of combination membership and explains failed prerequisites', () => {
    renderPage(<ExperimentsGatesPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建实验' }))
    const dialog = screen.getByRole('dialog', { name: '创建实验' })
    fireEvent.change(within(dialog).getByLabelText('实验名称'), { target: { value: '窗口组合验证' } })
    fireEvent.change(within(dialog).getByLabelText('实验层级'), { target: { value: 'WINDOW_COMBINATION' } })
    fireEvent.change(within(dialog).getByLabelText('候选窗口'), { target: { value: 'window-2026w36' } })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('variant-memory-latest')
    expect(within(dialog).getByRole('button', { name: '保存实验' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('候选窗口'), { target: { value: 'window-2026w35' } })
    expect(within(dialog).getAllByText(/variant-ppt-routing-v3/).length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText(/variant-tool-retry-v2/).length).toBeGreaterThan(0)
  })

  it('exposes QUEUED, RUNNING, and COMPLETED transitions instead of immediate completion', () => {
    renderPage(<ExperimentsGatesPage initialExperimentId="exp-single-memory-latest" />)
    const detail = screen.getByRole('dialog', { name: '实验详情' })
    expect(detail).toHaveTextContent('QUEUED')
    fireEvent.click(within(detail).getByRole('button', { name: '运行实验' }))
    expect(detail).toHaveTextContent('RUNNING')
    fireEvent.click(within(detail).getByRole('button', { name: '完成 Mock 运行' }))
    expect(detail).toHaveTextContent('COMPLETED')
  })

  it('shows complete structured Gate report evidence and links every report object', () => {
    renderPage(<ExperimentsGatesPage initialDecisionId="gate-window-2026w35" />)
    const report = screen.getByRole('dialog', { name: '准出报告详情' })
    expect(report).toHaveTextContent('配置快照')
    expect(report).toHaveTextContent('Dataset 版本')
    expect(report).toHaveTextContent('Baseline')
    expect(report).toHaveTextContent('Candidate')
    expect(report).toHaveTextContent('波动')
    expect(report).toHaveTextContent('失败 Case')
    expect(report).toHaveTextContent('回退项')
    expect(report).toHaveTextContent('已知风险')
    expect(report).toHaveTextContent('Evidence')
    expect(report).toHaveTextContent('HUMAN_REVIEW')
    expect(report).toHaveTextContent('治理委员会')
  })

  it('shows an exact release Window, combination report, source single reports, gate, rollback, and reverse lineage', () => {
    renderPage(<ReleasesPage initialReleaseId="release-agent-3-0-0" />)
    const detail = screen.getByRole('dialog', { name: '发布版本详情' })
    expect(detail).toHaveTextContent('window-2026w35')
    expect(detail).toHaveTextContent('variant-ppt-routing-v3')
    expect(detail).toHaveTextContent('variant-tool-retry-v2')
    expect(detail).toHaveTextContent('exp-window-2026w35')
    expect(detail).toHaveTextContent('exp-single-ppt-routing')
    expect(detail).toHaveTextContent('exp-single-tool-retry')
    expect(detail).toHaveTextContent('gate-window-2026w35')
    expect(detail).toHaveTextContent('治理委员会')
    expect(detail).toHaveTextContent('release-agent-2-5-0')
    expect(detail).toHaveTextContent('issue-skill-recall')
    expect(detail).toHaveTextContent('cluster-ppt-routing-ready')
    expect(detail).toHaveTextContent('case-ppt-management')
  })
})
