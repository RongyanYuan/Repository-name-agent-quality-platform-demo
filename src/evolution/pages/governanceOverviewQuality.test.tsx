import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, beforeEach } from 'vitest'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { GovernanceOverviewPage } from './GovernanceOverviewPage'

describe('治理总览三个业务大盘', () => {
  beforeEach(() => localStorage.clear())

  const renderOverview = () => render(<MemoryRouter><QualityProvider><EvolutionProvider><GovernanceOverviewPage /></EvolutionProvider></QualityProvider></MemoryRouter>)

  it('按产物、资产、过程顺序展示三个大盘，移除旧漏斗和重复质量层', () => {
    renderOverview()
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['产物结果大盘', '资产大盘', '过程大盘'])
    for (const oldTitle of ['用户满意度', '合格产物', '模块诊断与首错归因', '进化漏斗', '批量评测覆盖与数据分流', '性能与安全原始信号']) {
      expect(screen.queryByRole('heading', { name: oldTitle })).not.toBeInTheDocument()
    }
    expect(screen.getByText('Mock 演示数据')).toBeVisible()
  })

  it('结果使用 0 / 1 / 2 分计数，并提供真实 QA 平台和资产管理入口', () => {
    renderOverview()
    for (const label of ['总 Case 数', '有产物结果的 Case', '0 分', '1 分', '2 分', '采纳率']) expect(screen.getByText(label, { exact: true })).toBeVisible()
    expect(screen.queryByText(/GSB/)).not.toBeInTheDocument()
    const qa = screen.getByRole('link', { name: '前往 QA 平台' })
    expect(qa).toHaveAttribute('href', 'https://autoeval.baidu-int.com/tasks')
    expect(qa).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: '查看资产管理' })).toHaveAttribute('href', expect.stringContaining('/assets-skills'))
  })

  it('过程效率覆盖四类产物，质量使用 PRD 模块且上文不单独计分', () => {
    renderOverview()
    const efficiency = within(screen.getByRole('table', { name: '按产物类型的过程效率' }))
    const quality = within(screen.getByRole('table', { name: '按产物类型的过程质量' }))
    for (const type of ['PPT', 'Word', 'Excel', '生图']) {
      expect(efficiency.getByRole('rowheader', { name: new RegExp(type) })).toBeVisible()
      expect(quality.getByRole('columnheader', { name: type })).toBeVisible()
    }
    for (const module of ['记忆', 'skill', 'Reason', 'Act']) expect(quality.getByRole('row', { name: new RegExp(`^${module}\\s`) })).toBeVisible()
    expect(quality.queryByRole('row', { name: /^上文\s|^上下文\s/ })).not.toBeInTheDocument()
    expect(screen.getByText(/上文作为证据，不独立计分/)).toBeVisible()
  })
})
