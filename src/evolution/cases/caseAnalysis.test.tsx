import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { qualityData } from '../../data'
import { createInitialEvolutionData } from '../data'
import {
  buildCaseAnalysisData,
  filterCaseAnalysisRecords,
  buildCaseAnalysisDataFromEvolution,
  type CaseAnalysisFilters
} from './model'
import { CaseAnalysisWorkbench } from './CaseAnalysisWorkbench'

const data = buildCaseAnalysisData(qualityData)

describe('Case / Trace analysis model', () => {
  it('builds the canonical Office case with an auditable forward governance chain', () => {
    const record = data.cases.find((item) => item.task.id === 'task-001')

    expect(record).toBeDefined()
    expect(record?.session.turns.filter((turn) => turn.role === 'user').length).toBeGreaterThan(1)
    expect(record?.trace?.observations.some((item) => item.nodeType === 'Memory' && item.status === 'FAIL')).toBe(true)
    expect(record?.artifacts[0]?.outcomeEvalIds.length).toBeGreaterThan(0)
    expect(record?.logs.some((log) => log.observationId)).toBe(true)
    expect(record?.links.map((link) => link.kind)).toEqual(expect.arrayContaining(['issue-cluster', 'variant', 'experiment', 'release']))
  })

  it('applies every unified filter without treating multi-routing tags as exclusive', () => {
    const source = data.cases.find((item) => item.task.id === 'task-001')!
    const log = source.logs[0]
    const defaults: CaseAnalysisFilters = {
      query: source.task.query.slice(0, 8),
      sessionId: source.session.id,
      traceId: source.trace!.id,
      skillId: source.skill.id,
      skillVersion: source.skill.version,
      timeRange: '30d',
      processEval: source.processSummary,
      outcomeEval: source.outcomeSummary,
      logId: log.id,
      routingTags: source.routingTags.slice(0, 2),
      multiScene: source.multiScene ? 'yes' : 'no'
    }

    expect(filterCaseAnalysisRecords(data.cases, defaults, data.referenceTime)).toEqual([source])
    expect(filterCaseAnalysisRecords(data.cases, { ...defaults, routingTags: ['不存在的标签'] }, data.referenceTime)).toHaveLength(0)
  })

  it('searches Case, Session and every Trace ID rather than only the query and primary Trace', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const target = normalized.cases.find((item) => item.id === 'case-ppt-management')!

    expect(filterCaseAnalysisRecords(normalized.cases, { query: target.id, timeRange: 'all' }, normalized.referenceTime)).toEqual([target])
    expect(filterCaseAnalysisRecords(normalized.cases, { query: target.session.id, timeRange: 'all' }, normalized.referenceTime)).toEqual([target])
    expect(filterCaseAnalysisRecords(normalized.cases, { traceId: 'trace-ppt-context', timeRange: 'all' }, normalized.referenceTime)).toEqual([target])
    expect(filterCaseAnalysisRecords(normalized.cases, { query: 'log-ppt-skill', timeRange: 'all' }, normalized.referenceTime)).toEqual([target])
  })

  it('normalizes upgraded evolution entities into one bidirectional lineage view', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const record = normalized.cases.find((item) => item.id === 'case-ppt-management')

    expect(record?.session.id).toBe('session-ppt-management')
    expect(record?.processEvals.map((item) => item.id)).toContain('process-eval-ppt-recall')
    expect(record?.artifacts.map((item) => item.id)).toContain('artifact-ppt-management')
    expect(record?.links.map((item) => item.kind)).toEqual(expect.arrayContaining(['issue', 'issue-cluster', 'variant', 'experiment', 'release']))
  })
})

describe('CaseAnalysisWorkbench', () => {
  it('renders all unified filters and a clear Mock boundary', () => {
    render(<CaseAnalysisWorkbench data={data} />)

    expect(screen.getByText('本地 Mock 数据')).toBeVisible()
    for (const label of ['Query', 'Session ID', 'Trace ID', 'Skill ID', 'Skill 版本', '时间范围', '过程评测', '结果评测', 'Log ID', '分流标签', '多场景命中']) {
      expect(screen.getByLabelText(label)).toBeVisible()
    }
  })

  it('keeps Session, Trace, Evidence, artifact evaluations and governance links connected', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<CaseAnalysisWorkbench data={data} initialCaseId="case-task-001" onNavigateReference={onNavigate} />)

    expect(screen.getByRole('dialog', { name: /Case 详情/ })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Session 对话' }))
    expect(screen.getByText(/用公司模板做一份销售复盘/)).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: /打开 Trace trace-001/ })[0])
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'trace', id: 'trace-001' }))

    await user.click(screen.getByRole('tab', { name: 'Trace 与 Evidence' }))
    const memoryNode = screen.getByRole('button', { name: /Memory.*FAIL/ })
    await user.click(memoryNode)
    expect(screen.getAllByText(/Explicit current requirements must override stale preferences/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /查看失败节点 Log/ }))
    expect(screen.getByRole('dialog', { name: /Log 详情/ })).toBeVisible()
    const logDialog = screen.getByRole('dialog', { name: /Log 详情/ })
    await user.click(within(logDialog).getByRole('button', { name: 'Close panel' }))

    await user.click(screen.getByRole('tab', { name: '任务与关联' }))
    await user.click(screen.getByRole('button', { name: /查看产物评测/ }))
    expect(screen.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: /回到相关执行过程/ }))
    expect(screen.getByRole('tab', { name: 'Trace 与 Evidence' })).toHaveAttribute('aria-selected', 'true')
  }, 15000)

  it('emits non-destructive human confirmation and attribution adjustment actions', async () => {
    const user = userEvent.setup()
    const onHumanConfirm = vi.fn()
    const onAttributionChange = vi.fn()
    render(<CaseAnalysisWorkbench data={data} initialCaseId="case-task-001" onHumanConfirm={onHumanConfirm} onAttributionChange={onAttributionChange} />)

    await user.click(screen.getByRole('button', { name: '人工确认' }))
    fireEvent.change(screen.getByLabelText('确认说明'), { target: { value: '复核证据后确认。' } })
    await user.click(screen.getByRole('button', { name: '保存人工结论' }))
    expect(onHumanConfirm).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'case-task-001', status: 'FAIL', note: expect.stringContaining('复核证据') }))
    expect(screen.getByText('复核证据后确认。')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '调整归因' }))
    await user.selectOptions(screen.getByLabelText('归因模块'), 'Skill')
    const attributionDialog = screen.getByRole('dialog', { name: '调整归因' })
    const agentRouting = within(attributionDialog).getByRole('checkbox', { name: 'Agent 迭代' })
    if ((agentRouting as HTMLInputElement).checked) await user.click(agentRouting)
    if (!(agentRouting as HTMLInputElement).checked) await user.click(agentRouting)
    await user.click(screen.getByRole('button', { name: '保存归因调整' }))
    expect(onAttributionChange).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'case-task-001', module: 'Skill', routingTags: expect.arrayContaining(['策略迭代', 'Agent 迭代']) }))
  })

  it('selects an exact Trace in a multi-Trace Case and targets an exact attribution revision', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onAttributionChange = vi.fn()
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    render(<CaseAnalysisWorkbench data={normalized} initialCaseId="case-ppt-management" onNavigateReference={onNavigate} onAttributionChange={onAttributionChange} />)

    await user.click(screen.getByRole('button', { name: '切换 Trace trace-ppt-context' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'trace', id: 'trace-ppt-context' }))

    await user.click(screen.getByRole('button', { name: '调整归因' }))
    await user.selectOptions(screen.getByLabelText('目标归因'), 'attribution-style-mismatch')
    await user.click(screen.getByRole('button', { name: '保存归因调整' }))
    expect(onAttributionChange).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'case-ppt-management', attributionId: 'attribution-style-mismatch' }))
  })

  it('shows an explicit empty state for a missing case instead of inventing data', () => {
    const emptyData = { ...data, cases: [] }
    render(<CaseAnalysisWorkbench data={emptyData} />)
    const table = screen.getByRole('table', { name: 'Case / Trace 列表' })
    expect(within(table).getByText('暂无匹配 Case')).toBeVisible()
  })
})
