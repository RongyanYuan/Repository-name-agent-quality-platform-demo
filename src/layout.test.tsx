import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildContextHref, DashboardLayout } from './layout'
import { EvolutionProvider } from './evolution/store'
import { OverviewPage } from './qualityPages'
import { QualityProvider } from './store'
import { defaultFilters, parseFilters, serializeFilters } from './selectors'
import { mergeCaseLocalFilters, parseCaseLocalFilters, parseGlobalFilters, serializeGlobalFilters } from './urlState'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

describe('global filter synchronization', () => {
  it('keeps global, Case-local repeated, and detail URL codecs disjoint and lossless', () => {
    const source = '?timeRange=30d&agentVersion=agent-2.5.0&businessType=PPT&environment=Production&search=global&skill=skill-ppt-builder&skillVersion=2.6.0&processEval=FAIL&logId=log-ppt-skill&routingTag=%E7%AD%96%E7%95%A5%E8%BF%AD%E4%BB%A3&routingTag=Agent+%E8%BF%AD%E4%BB%A3&caseId=case-ppt-management'
    const global = parseGlobalFilters(source, defaultFilters)
    const local = parseCaseLocalFilters(source)
    expect(global).toEqual({ timeRange: '30d', agentVersion: 'agent-2.5.0', businessType: 'PPT', environment: 'Production', search: 'global', skill: 'skill-ppt-builder' })
    expect(global).not.toHaveProperty('processEval')
    expect(local).toMatchObject({ skillVersion: '2.6.0', processEval: 'FAIL', logId: 'log-ppt-skill', routingTags: ['策略迭代', 'Agent 迭代'] })
    const merged = mergeCaseLocalFilters(`?${serializeGlobalFilters(global)}&caseId=case-ppt-management`, { ...local, routingTags: ['策略迭代', 'Agent 迭代'] })
    expect(merged).toContain('caseId=case-ppt-management')
    expect(new URLSearchParams(merged).getAll('routingTag')).toEqual(['策略迭代', 'Agent 迭代'])
  })

  it('keeps legacy filter helpers scoped to global keys only', () => {
    const encoded = serializeFilters({ ...defaultFilters, timeRange: '30d', skillVersion: '2.6.0', processEval: 'FAIL', routingTags: ['Agent 迭代'] })
    expect(encoded).toContain('timeRange=30d')
    expect(encoded).not.toContain('skillVersion')
    expect(encoded).not.toContain('processEval')
    expect(encoded).not.toContain('routingTag')
    expect(parseFilters('?timeRange=30d&skillVersion=2.6.0&processEval=FAIL&routingTag=Agent+%E8%BF%AD%E4%BB%A3')).toEqual({ ...defaultFilters, timeRange: '30d' })
  })

  it.each([
    ['/cases', 'caseId', 'case-ppt-management'], ['/issues', 'issueId', 'issue-skill-recall'], ['/variants', 'variantId', 'variant-ppt-routing-v3'],
    ['/experiments', 'experimentId', 'exp-single-ppt-routing'], ['/experiments', 'decisionId', 'gate-window-2026w35'], ['/releases', 'releaseId', 'release-agent-3-0-0']
  ])('builds %s context links while preserving every global and Case-local filter', (path, key, value) => {
    const current = '?timeRange=30d&agentVersion=agent-2.5.0&businessType=PPT&environment=Production&skill=skill-ppt-builder&skillVersion=2.6.0&processEval=FAIL&routingTag=%E7%AD%96%E7%95%A5%E8%BF%AD%E4%BB%A3&routingTag=Agent+%E8%BF%AD%E4%BB%A3&caseId=old-case'
    const href = buildContextHref(current, path, { clear: ['caseId'], params: { [key]: value } })
    const params = new URL(href, 'https://demo.local').searchParams
    for (const [filterKey, expected] of [['timeRange', '30d'], ['agentVersion', 'agent-2.5.0'], ['businessType', 'PPT'], ['environment', 'Production'], ['skill', 'skill-ppt-builder'], ['skillVersion', '2.6.0'], ['processEval', 'FAIL']]) expect(params.get(filterKey)).toBe(expected)
    expect(params.getAll('routingTag')).toEqual(['策略迭代', 'Agent 迭代'])
    expect(params.get(key)).toBe(value)
  })

  it('keeps sequential time, version, business and environment changes in Store and URL', async () => {
    render(
      <MemoryRouter initialEntries={['/overview?timeRange=24h&environment=Production']}>
        <QualityProvider>
          <EvolutionProvider>
            <Routes>
              <Route element={<DashboardLayout />}>
                <Route path="/overview" element={<><OverviewPage /><LocationProbe /></>} />
              </Route>
            </Routes>
          </EvolutionProvider>
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
