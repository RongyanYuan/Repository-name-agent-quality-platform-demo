import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QualityProvider, useQuality } from '../../store'
import { createInitialEvolutionData } from '../data'
import { createLocalEvolutionRepository } from '../repository'
import { EvolutionProvider } from '../store'
import { AssetsSkillsPage } from './AssetsSkillsPage'
import { AttributionClustersPage } from './AttributionClustersPage'
import { VariantsPage } from './VariantsPage'

function FullHistoryScope({ children }: { children?: ReactNode }) {
  const { state, dispatch } = useQuality()
  useEffect(() => { dispatch({ type: 'SET_FILTERS', filters: { timeRange: '30d' } }) }, [dispatch])
  return state.filters.timeRange === '30d' ? children : null
}

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter><QualityProvider><FullHistoryScope><EvolutionProvider initialState={createInitialEvolutionData()}>{page}</EvolutionProvider></FullHistoryScope></QualityProvider></MemoryRouter>)
}

describe('Issue, Variant and Skill/Asset governance mutations', () => {
  beforeEach(() => localStorage.clear())
  it('persists a full Issue edit and phase-two processing chain across provider remounts', async () => {
    const repository = createLocalEvolutionRepository({ storage: window.localStorage, storageKey: `issue-edit-${Date.now()}` })
    repository.save(createInitialEvolutionData())
    const first = render(<MemoryRouter><QualityProvider><EvolutionProvider repository={repository}><AttributionClustersPage initialIssueId="issue-reason-tool" /></EvolutionProvider></QualityProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '编辑问题' }))
    fireEvent.change(screen.getByLabelText('问题描述'), { target: { value: '人工补充后的完整影响说明。' } })
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '联合治理团队' } })
    fireEvent.change(screen.getByLabelText('生命周期状态'), { target: { value: 'CLOSED' } })
    fireEvent.click(screen.getByLabelText('个人能力转 Skill（二期）'))
    fireEvent.change(screen.getByLabelText('个人能力转 Skill（二期）处理说明'), { target: { value: '二期转个人 Skill 规划。' } })
    fireEvent.click(screen.getByRole('button', { name: '保存问题' }))
    await waitFor(() => expect(repository.load().issues.find((item) => item.id === 'issue-reason-tool')).toMatchObject({ description: '人工补充后的完整影响说明。', owner: '联合治理团队', status: 'CLOSED' }))
    first.unmount()
    render(<MemoryRouter><QualityProvider><EvolutionProvider repository={repository}><AttributionClustersPage initialIssueId="issue-reason-tool" /></EvolutionProvider></QualityProvider></MemoryRouter>)
    const detail = screen.getByRole('dialog', { name: '问题详情' })
    expect(detail).toHaveTextContent('人工补充后的完整影响说明。')
    expect(detail).toHaveTextContent('联合治理团队')
    expect(detail).toHaveTextContent('CLOSED')
    expect(detail).toHaveTextContent('PERSONAL_SKILL_PHASE_2')
    expect(detail).toHaveTextContent('PHASE_2')
    expect(detail).toHaveTextContent('二期转个人 Skill 规划。')
  })

  it('creates two independent issues for one Case with full fields and separate processing chains', () => {
    renderPage(<AttributionClustersPage />)
    const createIssue = (input: { title: string; attribution: string; module: string; dimension: string; evidence: string; mode: string; owner: string; route: string }) => {
      fireEvent.click(screen.getByRole('button', { name: '新建问题' }))
      fireEvent.change(screen.getByLabelText('来源 Case'), { target: { value: 'case-multi-route' } })
      fireEvent.change(screen.getByLabelText('来源归因'), { target: { value: input.attribution } })
      fireEvent.change(screen.getByLabelText('问题标题'), { target: { value: input.title } })
      fireEvent.change(screen.getByLabelText('问题描述'), { target: { value: `${input.title} 的独立影响与处理说明` } })
      fireEvent.change(screen.getByLabelText('问题模块'), { target: { value: input.module } })
      fireEvent.change(screen.getByLabelText('问题维度'), { target: { value: input.dimension } })
      fireEvent.click(screen.getByLabelText(input.evidence))
      fireEvent.click(screen.getByLabelText(input.route))
      fireEvent.change(screen.getByLabelText('优化方式'), { target: { value: input.mode } })
      fireEvent.change(screen.getByLabelText('Owner'), { target: { value: input.owner } })
      fireEvent.change(screen.getByLabelText('责任状态'), { target: { value: 'ASSIGNED' } })
      fireEvent.change(screen.getByLabelText('生命周期状态'), { target: { value: 'FIXING' } })
      fireEvent.click(screen.getByRole('button', { name: '保存问题' }))
    }
    createIssue({ title: 'Memory 独立问题', attribution: 'attribution-memory-context', module: 'Memory', dimension: '准确率低', evidence: 'evidence-memory-miss', mode: 'CLUSTER_OPTIMIZATION', owner: 'Memory 团队', route: '策略迭代' })
    createIssue({ title: 'Reason 独立问题', attribution: 'attribution-reason-tool', module: 'Reason', dimension: '工具参数错误', evidence: 'evidence-reason-plan', mode: 'DIRECT_FIX', owner: 'Reason 团队', route: 'Agent 迭代' })
    const table = screen.getByRole('table', { name: '问题列表' })
    expect(table).toHaveTextContent('Memory 独立问题')
    expect(table).toHaveTextContent('Reason 独立问题')
    fireEvent.click(screen.getByRole('row', { name: /Memory 独立问题/ }))
    const memoryDetail = screen.getByRole('dialog', { name: '问题详情' })
    expect(memoryDetail).toHaveTextContent('Memory 独立问题 的独立影响与处理说明')
    expect(memoryDetail).toHaveTextContent('策略迭代')
    expect(memoryDetail).toHaveTextContent('ISSUE_CLUSTER')
    fireEvent.click(within(memoryDetail).getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('row', { name: /Reason 独立问题/ }))
    expect(screen.getByRole('dialog', { name: '问题详情' })).toHaveTextContent('DIRECT_FIX')
  })

  it('shows 37/100 for taste only and keeps the unrelated cluster threshold pending', () => {
    const state = createInitialEvolutionData()
    state.issueClusters.find((item) => item.id === 'cluster-ppt-taste-pending')!.currentCount = 999
    render(<MemoryRouter><QualityProvider><FullHistoryScope><EvolutionProvider initialState={state}><AttributionClustersPage initialClusterId="cluster-ppt-taste-pending" /></EvolutionProvider></FullHistoryScope></QualityProvider></MemoryRouter>)
    const taste = screen.getByRole('dialog', { name: '问题簇详情' })
    expect(taste).toHaveTextContent('37 / 100')
    expect(taste).toHaveTextContent('Skill ID')
    expect(screen.getByText('本地已确认 Case 1 条 + 外部 Mock 快照 36 条')).toBeVisible()
    expect(screen.getByRole('button', { name: '创建能力变体' })).toBeDisabled()
    fireEvent.click(within(taste).getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('row', { name: /跨轮资产版本错误簇/ }))
    expect(screen.getByRole('dialog', { name: '问题簇详情' })).toHaveTextContent('待配置')
    expect(screen.getByRole('dialog', { name: '问题簇详情' })).not.toHaveTextContent('/ 100')
  })

  it('creates a fully specified Variant from an eligible cluster with copied provenance', () => {
    renderPage(<VariantsPage />)
    fireEvent.click(screen.getByRole('button', { name: '从问题创建变体' }))
    fireEvent.change(screen.getByLabelText('来源类型'), { target: { value: 'CLUSTER' } })
    fireEvent.change(screen.getByLabelText('来源问题簇'), { target: { value: 'cluster-memory-version' } })
    fireEvent.change(screen.getByLabelText('变体名称'), { target: { value: 'Session 最新产物重排 v2' } })
    fireEvent.change(screen.getByLabelText('变更类型'), { target: { value: 'PROMPT_OR_POLICY' } })
    fireEvent.change(screen.getByLabelText('修改摘要'), { target: { value: '优先已确认的新版本资产' } })
    fireEvent.change(screen.getByLabelText('修改内容'), { target: { value: '按 confirmed、version、updatedAt 重排 Session 资产。' } })
    fireEvent.change(screen.getByLabelText('当前版本'), { target: { value: 'memory-1.8.0' } })
    fireEvent.change(screen.getByLabelText('候选版本'), { target: { value: 'memory-1.9.1-rc.1' } })
    fireEvent.click(screen.getByRole('button', { name: '保存变体' }))
    const row = screen.getByRole('row', { name: /Session 最新产物重排 v2/ })
    expect(row).toHaveTextContent('memory-1.8.0')
    expect(row).toHaveTextContent('memory-1.9.1-rc.1')
    fireEvent.click(row)
    const detail = screen.getByRole('dialog', { name: '变体详情' })
    expect(detail).toHaveTextContent('issue-memory-context')
    expect(detail).toHaveTextContent('case-multi-route')
    expect(detail).toHaveTextContent('evidence-memory-miss')
  })

  it('creates a direct-fix Variant from one Issue without inventing cluster provenance', () => {
    renderPage(<VariantsPage />)
    fireEvent.click(screen.getByRole('button', { name: '从问题创建变体' }))
    fireEvent.change(screen.getByLabelText('来源类型'), { target: { value: 'ISSUE' } })
    fireEvent.change(screen.getByLabelText('来源问题'), { target: { value: 'issue-reason-tool' } })
    fireEvent.change(screen.getByLabelText('变体名称'), { target: { value: '跨 Office 规划直接修复' } })
    fireEvent.change(screen.getByLabelText('修改内容'), { target: { value: '强制 analyze → validate → compose。' } })
    fireEvent.change(screen.getByLabelText('当前版本'), { target: { value: 'reason-3.1.0' } })
    fireEvent.change(screen.getByLabelText('候选版本'), { target: { value: 'reason-3.1.2' } })
    fireEvent.click(screen.getByRole('button', { name: '保存变体' }))
    fireEvent.click(screen.getByRole('row', { name: /跨 Office 规划直接修复/ }))
    const detail = screen.getByRole('dialog', { name: '变体详情' })
    expect(detail).toHaveTextContent('issue-reason-tool')
    expect(detail).toHaveTextContent('evidence-reason-plan')
    expect(detail).not.toHaveTextContent('cluster-memory-version')
  })

  it('makes Skill evolution and Asset relationships operable in both directions', () => {
    const onNavigate = vi.fn()
    const { unmount } = renderPage(<AssetsSkillsPage initialSkillId="skill-ppt-builder" onNavigateReference={onNavigate} />)
    const skillDetail = screen.getByRole('dialog', { name: 'Skill 详情' })
    expect(skillDetail).toHaveTextContent('OFFICIAL')
    expect(skillDetail).toHaveTextContent('2.6.0')
    expect(skillDetail).not.toHaveTextContent('variant-ppt-routing-v3')
    expect(skillDetail).not.toHaveTextContent('asset-executive-template')
    fireEvent.click(within(skillDetail).getByRole('button', { name: '打开数据集与评测' }))
    unmount()
    renderPage(<AssetsSkillsPage initialAssetId="asset-executive-template" onNavigateReference={onNavigate} />)
    const assetDetail = screen.getByRole('dialog', { name: '资产详情' })
    fireEvent.click(within(assetDetail).getByRole('button', { name: 'skill-ppt-builder' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'skill', id: 'skill-ppt-builder' }))
  })
})
