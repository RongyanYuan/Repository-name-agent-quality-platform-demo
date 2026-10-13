import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { DETAIL_QUERY_KEYS, GLOBAL_FILTER_KEYS } from '../../urlState'
import { EvolutionProvider } from '../store'
import { createInitialEvolutionData } from '../data'
import { resolveIdentity } from '../identity'

beforeEach(() => localStorage.clear())
function RouteProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="direction-route">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>测试后退</button><button onClick={() => navigate(1)}>测试前进</button></>
}
function open(search: string) {
  const state = createInitialEvolutionData()
  const traceId = resolveIdentity(state, 'trace', 'trace-ppt-generate')
  return render(<MemoryRouter initialEntries={[`/cases?traceId=${traceId}&caseView=eval&timeRange=30d&environment=Production&${search}`]}><QualityProvider><EvolutionProvider initialState={state}><App /><RouteProbe /></EvolutionProvider></QualityProvider></MemoryRouter>)
}
function route() { return new URL(screen.getByTestId('direction-route').textContent!, 'http://local.demo') }
function moduleDetail() { return screen.getByRole('dialog', { name: 'skill · 进化详情' }) }
const scoreId = 'module-score-trace-ppt-generate-skill'
const sopDirection = JSON.stringify(['SKILL', 'Skill', 'skill-ppt-builder', '2.5.0', 'skill-sop'])

describe('URL-owned module evolution direction history', () => {
  it('keeps direction outside global filters and restores URL selection on refresh, Back and Forward', async () => {
    expect(DETAIL_QUERY_KEYS).toContain('moduleEvolutionDirectionId')
    expect(GLOBAL_FILTER_KEYS).not.toContain('moduleEvolutionDirectionId')
    const first = open(`moduleScoreId=${scoreId}&evolutionRecordId=evolution-module-path-demo-sop-agent&moduleEvolutionDirectionId=${encodeURIComponent(sopDirection)}`)
    const selector = within(moduleDetail()).getByRole('combobox', { name: '进化方向' })
    expect(selector).toHaveValue(sopDirection)
    const otherDirection = within(selector).getAllByRole('option').find(option => (option as HTMLOptionElement).value && (option as HTMLOptionElement).value !== sopDirection) as HTMLOptionElement
    expect(otherDirection).toBeDefined()
    fireEvent.change(selector, { target: { value: otherDirection.value } })
    await waitFor(() => expect(route().searchParams.get('moduleEvolutionDirectionId')).toBe(otherDirection.value))
    expect(route().searchParams.get('moduleScoreId')).toBe(scoreId)
    expect(route().searchParams.get('evolutionRecordId')).toBe('evolution-module-path-demo-sop-agent')
    fireEvent.click(screen.getByRole('button', { name: '测试后退' }))
    await waitFor(() => expect(within(moduleDetail()).getByRole('combobox', { name: '进化方向' })).toHaveValue(sopDirection))
    fireEvent.click(screen.getByRole('button', { name: '测试前进' }))
    await waitFor(() => expect(within(moduleDetail()).getByRole('combobox', { name: '进化方向' })).toHaveValue(otherDirection.value))
    const refreshedSearch = route().searchParams.toString()
    first.unmount()
    open(refreshedSearch)
    expect(within(moduleDetail()).getByRole('combobox', { name: '进化方向' })).toHaveValue(otherDirection.value)
  })

  it('carries the chosen direction through the exact dataset return link and clears it on module close or tab switch', async () => {
    open(`moduleScoreId=${scoreId}&moduleEvolutionDirectionId=${encodeURIComponent(sopDirection)}`)
    const layer = moduleDetail()
    fireEvent.click(within(layer).getByRole('button', { name: 'skill sop错误' }))
    const path = layer.querySelector('[data-evolution-record-id="evolution-module-path-demo-sop-agent"]')! as HTMLElement
    const href = within(path).getByRole('link', { name: '查看进化数据集' }).getAttribute('href')!
    const destination = new URL(href, 'http://local.demo')
    const back = new URL(destination.searchParams.get('returnTo')!, 'http://local.demo')
    expect(back.searchParams.get('moduleEvolutionDirectionId')).toBe(sopDirection)
    expect(back.searchParams.get('moduleScoreId')).toBe(scoreId)
    expect(back.searchParams.get('timeRange')).toBe('30d')
    fireEvent.click(within(layer).getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(route().searchParams.has('moduleEvolutionDirectionId')).toBe(false))
    expect(route().searchParams.has('moduleScoreId')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 进化详情' }))
    expect(within(moduleDetail()).getByRole('combobox', { name: '进化方向' })).toHaveValue('')
    fireEvent.change(within(moduleDetail()).getByRole('combobox', { name: '进化方向' }), { target: { value: sopDirection } })
    fireEvent.click(within(moduleDetail()).getByRole('button', { name: 'Close panel' }))
    fireEvent.click(screen.getByRole('tab', { name: '产物评测' }))
    expect(route().searchParams.get('caseView')).toBe('outcome')
    expect(route().searchParams.has('moduleEvolutionDirectionId')).toBe(false)
  })
})
