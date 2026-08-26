import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AnomalyMonitoringPage } from './anomalyMonitoringPage'
import { QualityProvider } from './store'

function Probe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

describe('anomaly monitoring page', () => {
  it('renders the four monitoring sections and explicit unknown baseline copy', () => {
    render(<MemoryRouter initialEntries={['/anomaly-monitoring']}><QualityProvider><Routes><Route path="/anomaly-monitoring" element={<><AnomalyMonitoringPage /><Probe /></>} /><Route path="/tasks" element={<Probe />} /></Routes></QualityProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '异常监控' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '响应与流式' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Token、缓存与成本' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '调用与一次执行' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '商业化与风控' })).toBeVisible()
    expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThan(0)
    expect(screen.getByText(/基线未建立时/)).toBeVisible()
  })

  it('drills risk monitoring into Task / Trace with the metric payload', () => {
    render(<MemoryRouter initialEntries={['/anomaly-monitoring?businessType=PPT']}><QualityProvider><Routes><Route path="/anomaly-monitoring" element={<AnomalyMonitoringPage />} /><Route path="/tasks" element={<Probe />} /></Routes></QualityProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /风控拦截率/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks?businessType=PPT&metric=risk-interception')
  })
})
