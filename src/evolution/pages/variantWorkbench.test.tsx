import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { createInitialEvolutionData } from '../data'
import { VariantsPage } from './VariantsPage'

function renderWorkbench(path = '/variants', props = {}) {
  return render(<MemoryRouter initialEntries={[path]}><QualityProvider><EvolutionProvider initialState={createInitialEvolutionData()}><VariantsPage {...props} /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

describe('unified Variant governance workspace', () => {
  it('collapses category Sections and leaves the heading and count visible', () => {
    renderWorkbench()
    const taste = screen.getByRole('region', { name: '品味 Skill' })
    fireEvent.click(within(taste).getByRole('button', { name: '收起品味 Skill' }))
    expect(within(taste).getByRole('heading', { name: '品味 Skill' })).toBeVisible()
    expect(within(taste).queryByText('skill-taste-executive')).not.toBeInTheDocument()
    fireEvent.click(within(taste).getByRole('button', { name: '展开品味 Skill' }))
    expect(within(taste).getByText('skill-taste-executive')).toBeVisible()
  })

  it('filters Skill rows and exposes preference users separately from the taste trigger', () => {
    renderWorkbench('/variants?variantSkill=skill-taste-executive')
    expect(screen.queryByText('skill-ppt-builder')).not.toBeInTheDocument()
    expect(screen.getByText(/950.*1000/)).toBeVisible()
    expect(screen.getByText(/120.*100.*相关数据/)).toBeVisible()
  })

  it('opens a versioned self-evolution history inside a Skill section row', () => {
    renderWorkbench('/variants?variantSkill=skill-ppt-builder')
    const production = screen.getByRole('region', { name: '生产 Skill' })
    fireEvent.click(within(production).getByRole('button', { name: /查看 PPT Builder 的自进化历史/ }))
    expect(within(production).getByText('自进化历史')).toBeVisible()
    expect(within(production).getAllByText('ppt-builder-2.6.0-rc.1').length).toBeGreaterThan(0)
    expect(within(production).getByText('release-agent-3-0-0')).toBeVisible()
  })

  it('blocks creation using the derived taste count even when cached count says 100', () => {
    const state = createInitialEvolutionData()
    state.issueClusters.find((cluster) => cluster.id === 'cluster-ppt-taste-pending')!.currentCount = 100
    render(<MemoryRouter initialEntries={['/variants?sourceClusterId=cluster-ppt-taste-pending']}><QualityProvider><EvolutionProvider initialState={state}><VariantsPage /></EvolutionProvider></QualityProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('变体名称'), { target: { value: '未达标候选' } })
    expect(screen.getByRole('button', { name: '保存变体' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('37 / 100')
  })
})
