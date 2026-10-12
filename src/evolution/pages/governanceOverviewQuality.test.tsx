import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, beforeEach } from 'vitest'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { GovernanceOverviewPage } from './GovernanceOverviewPage'

describe('治理总览四层质量指标', () => {
  beforeEach(() => localStorage.clear())

  const renderOverview = () => render(<MemoryRouter><QualityProvider><EvolutionProvider><GovernanceOverviewPage /></EvolutionProvider></QualityProvider></MemoryRouter>)

  it('独立展示北极星、合格产物、过程效率和模块诊断四个 section', () => {
    renderOverview()
    expect(screen.getByRole('heading', { name: '用户满意度' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '合格产物' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '过程效率' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '模块诊断与首错归因' })).toBeVisible()
    expect(screen.getByLabelText('用户满意度 7 日趋势')).toBeVisible()
  })

  it('没有用户接受和过程业务阈值时不推论满意率或低效率', () => {
    renderOverview()
    expect(screen.getByRole('button', { name: /用户满意度 UNKNOWN/ })).toHaveTextContent('待配置')
    expect(screen.getByRole('button', { name: /最终用户接受/ })).not.toHaveTextContent('当前 Case 无标准化用户接受事件')
    expect(screen.getByRole('button', { name: /过程效率不符业务预期率 UNKNOWN/ })).toHaveTextContent('分母')
    expect(screen.getByText(/用户接受信号未在 Case 中记录/)).toBeVisible()
    expect(screen.getByText(/业务预期未配置/)).toBeVisible()
  })

  it('每层子指标都可以收起并保留总指标', () => {
    renderOverview()
    const northStarToggle = screen.getByRole('button', { name: '收起用户满意度子指标' })
    const qualifiedToggle = screen.getByRole('button', { name: '收起合格产物子指标' })
    const processToggle = screen.getByRole('button', { name: '收起过程效率子指标' })
    const moduleToggle = screen.getByRole('button', { name: '收起模块诊断子指标' })
    expect(northStarToggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(northStarToggle)
    expect(northStarToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(qualifiedToggle)
    fireEvent.click(processToggle)
    fireEvent.click(moduleToggle)
    expect(screen.getByRole('heading', { name: '用户满意度' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '合格产物' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '过程效率' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '模块诊断与首错归因' })).toBeVisible()
  })
})
