import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { OverviewPage } from './qualityPages'
import { QualityProvider } from './store'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderOverview(initialEntry = '/overview?businessType=PPT&agentVersion=agent-2.5.0') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QualityProvider>
        <Routes>
          <Route path="/overview" element={<><OverviewPage /><LocationProbe /></>} />
          <Route path="/tasks" element={<LocationProbe />} />
          <Route path="/cases" element={<LocationProbe />} />
        </Routes>
      </QualityProvider>
    </MemoryRouter>
  )
}

describe('quality overview v2 dashboard', () => {
  it('renders the four independent sections in the requested order', () => {
    renderOverview()
    const headings = screen.getAllByRole('heading')
    const sectionTitles = headings.map((heading) => heading.textContent).filter((text) => ['用户满意度', '合格产物', '过程效率', '模块诊断与首错归因'].includes(text ?? ''))
    expect(sectionTitles).toEqual(['用户满意度', '合格产物', '过程效率', '模块诊断与首错归因'])
  })

  it('keeps the out-of-expectation denominator on all products and shows the exact label', () => {
    renderOverview()
    const card = screen.getByRole('button', { name: /过程效率不符业务预期率/ })
    expect(card).toHaveTextContent('过程效率不符业务预期率')
    expect(card).toHaveTextContent(/分母\s+\d+/)
    expect(screen.getByText(/分母始终是当前全局筛选下的全部产物/)).toBeVisible()
  })

  it('drills down while retaining global URL filters', () => {
    renderOverview()
    fireEvent.click(screen.getByRole('button', { name: /意图一致性/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks?businessType=PPT&agentVersion=agent-2.5.0&metric=intent-consistency')
  })

  it('uses acceptance signal filters for north-star sub-metrics', () => {
    renderOverview()
    fireEvent.click(screen.getByRole('button', { name: /明确负反馈率/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('acceptanceSignal=negative_feedback')
  })

  it('collapses child metrics while preserving each composite total', () => {
    renderOverview()
    const qualifiedToggle = screen.getByRole('button', { name: '收起合格产物子指标' })
    const processToggle = screen.getByRole('button', { name: '收起过程效率子指标' })
    expect(qualifiedToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /结果类型一致性/ })).toBeVisible()
    fireEvent.click(qualifiedToggle)
    expect(qualifiedToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /结果类型一致性/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /合格产物率/ })).toBeVisible()
    fireEvent.click(processToggle)
    expect(screen.queryByRole('button', { name: /总时延效率/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /过程效率达标率/ })).toBeVisible()
  })
})
