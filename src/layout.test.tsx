import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DashboardLayout } from './layout'
import { OverviewPage } from './qualityPages'
import { QualityProvider } from './store'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

describe('global filter synchronization', () => {
  it('keeps sequential time, version, business and environment changes in Store and URL', async () => {
    render(
      <MemoryRouter initialEntries={['/overview?timeRange=24h&environment=Production']}>
        <QualityProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/overview" element={<><OverviewPage /><LocationProbe /></>} />
            </Route>
          </Routes>
        </QualityProvider>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByRole('combobox', { name: '时间范围' }), { target: { value: '7d' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Agent 版本' }), { target: { value: 'agent-2.5.0' } })
    fireEvent.change(screen.getByRole('combobox', { name: '业务类型' }), { target: { value: 'PPT' } })
    fireEvent.change(screen.getByRole('combobox', { name: '环境' }), { target: { value: 'Staging' } })

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '时间范围' })).toHaveValue('7d')
      expect(screen.getByRole('combobox', { name: 'Agent 版本' })).toHaveValue('agent-2.5.0')
      expect(screen.getByRole('combobox', { name: '业务类型' })).toHaveValue('PPT')
      expect(screen.getByRole('combobox', { name: '环境' })).toHaveValue('Staging')
      expect(screen.getByTestId('location')).toHaveTextContent('timeRange=7d')
      expect(screen.getByTestId('location')).toHaveTextContent('agentVersion=agent-2.5.0')
      expect(screen.getByTestId('location')).toHaveTextContent('businessType=PPT')
      expect(screen.getByTestId('location')).toHaveTextContent('environment=Staging')
    })
  })
})
