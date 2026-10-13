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
import { evolutionReducer } from '../store'
import { resolveIdentity } from '../identity'
const identityState = createInitialEvolutionData()
const traceId = (id:string) => resolveIdentity(identityState,'trace',id)

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

    expect(record?.session.id).toBe(resolveIdentity(identityState,'session','session-ppt-management'))
    expect(record?.processEvals.map((item) => item.id)).toContain('process-eval-ppt-recall')
    expect(record?.artifacts.map((item) => item.id)).toContain('artifact-ppt-management')
    expect(record?.links.map((item) => item.kind)).toEqual(expect.arrayContaining(['issue', 'issue-cluster', 'variant', 'experiment', 'release']))
  })
  it('keeps the primary Trace recorded Skill version instead of substituting the current catalog version', () => {
    const state = createInitialEvolutionData()
    state.skills.find(skill => skill.id === 'skill-ppt-builder')!.version = '9.0.0'
    state.traces.find(trace => trace.id === traceId('trace-ppt-generate'))!.skillVersion = 'ppt-builder-2.5.0'
    state.tracePackages.find(pkg => pkg.traceId === traceId('trace-ppt-generate'))!.skillVersion = '2.5.0'
    const normalized = buildCaseAnalysisDataFromEvolution(state)
    const record = normalized.cases.find(item => item.id === 'case-ppt-management')!
    expect(record.skill.version).toBe('2.5.0')
    expect(filterCaseAnalysisRecords(normalized.cases, { skillVersion: '2.5.0', timeRange: 'all' }, normalized.referenceTime)).toContainEqual(record)
    expect(filterCaseAnalysisRecords(normalized.cases, { skillVersion: '9.0.0', timeRange: 'all' }, normalized.referenceTime)).not.toContainEqual(record)
  })
  it('keeps each multi-Trace Skill identity and version available for active Trace details', () => {
    const state = createInitialEvolutionData()
    state.traces.find(trace => trace.id === traceId('trace-ppt-context'))!.skillVersion = 'ppt-builder-2.4.0'
    state.traces.find(trace => trace.id === traceId('trace-ppt-generate'))!.skillVersion = 'ppt-builder-2.5.0'
    state.tracePackages.find(pkg => pkg.traceId === traceId('trace-ppt-context'))!.skillIds = ['skill-spreadsheet']
    const record = buildCaseAnalysisDataFromEvolution(state).cases.find(item => item.id === 'case-ppt-management')!
    expect(record.skill.version).toBe('2.5.0')
    expect(record.skillsByTrace?.[traceId('trace-ppt-context')]).toMatchObject({ id: 'skill-spreadsheet', version: '2.4.0' })
    expect(record.skillsByTrace?.[traceId('trace-ppt-generate')]).toMatchObject({ id: 'skill-ppt-builder', version: '2.5.0' })
  })
  it('uses an evaluation package recorded version when available and otherwise preserves missing source version', () => {
    const state = createInitialEvolutionData()
    state.traces.find(trace => trace.id === traceId('trace-ppt-generate'))!.skillVersion = undefined
    const pkg = state.tracePackages.find(item => item.traceId === traceId('trace-ppt-generate'))!
    pkg.skillVersion = 'ppt-builder-2.5.0'
    expect(buildCaseAnalysisDataFromEvolution(state).cases.find(item => item.id === 'case-ppt-management')!.skill.version).toBe('2.5.0')
    pkg.skillVersion = undefined
    expect(buildCaseAnalysisDataFromEvolution(state).cases.find(item => item.id === 'case-ppt-management')!.skill.version).toBe('版本未记录')
  })
  it('keeps time filtering anchored to immutable Query time after a later human edit', () => {
    const state = createInitialEvolutionData()
    const before = buildCaseAnalysisDataFromEvolution(state)
    const ids = filterCaseAnalysisRecords(before.cases, { timeRange: '7d' }, before.referenceTime).map(record => record.id)
    expect(ids.length).toBeGreaterThan(0)
    const changed = evolutionReducer(state, { type: 'UPDATE_CASE', caseId: ids[0], patch: { status: 'CONFIRMED' }, meta: { actor: '人工复核员', reason: '查询时间不能随复核变化', at: '2027-01-01T12:00:00Z' } })
    const after = buildCaseAnalysisDataFromEvolution(changed)
    expect(after.referenceTime).toBe(before.referenceTime)
    expect(filterCaseAnalysisRecords(after.cases, { timeRange: '7d' }, after.referenceTime).map(record => record.id)).toEqual(ids)
  })

  it('filters exact dataset Trace membership without enrolling a sibling Trace', () => {
    const state = createInitialEvolutionData()
    const membership = state.datasetMemberships?.find(item => item.datasetId === 'dataset-golden-test-set-a' && item.scope === 'TRACE')
    expect(membership).toBeDefined()
    const normalized = buildCaseAnalysisDataFromEvolution(state)
    const selectedTrace = membership!.traceIds[0]
    const selected = normalized.traceRecords!.find(record => record.trace?.id === selectedTrace)
    expect(selected?.datasetRefs?.find(dataset => dataset.id === membership!.datasetId)).toMatchObject({ membershipScope: 'TRACE', category: 'GOLDEN' })
    const allMembershipTraceIds = state.datasetMemberships!.filter(item => item.datasetId === membership!.datasetId && item.datasetVersion === membership!.datasetVersion).flatMap(item => item.traceIds)
    expect(filterCaseAnalysisRecords(normalized.traceRecords!, { datasetId: membership!.datasetId, timeRange: 'all' }, normalized.referenceTime).map(record => record.trace?.id).sort()).toEqual([...new Set(allMembershipTraceIds)].sort())
    const selectedIds = new Set(allMembershipTraceIds)
    expect(normalized.traceRecords!.filter(record => record.id === selected?.id && record.trace && !selectedIds.has(record.trace.id)).every(record => !record.datasetRefs?.some(dataset => dataset.id === membership!.datasetId))).toBe(true)
  })

  it('applies inclusive Query-time boundaries and governance Window filters', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const target = normalized.traceRecords!.find(record => record.timeWindowRefs?.length)
    expect(target).toBeDefined()
    const timestamp = target!.task.timestamp
    expect(filterCaseAnalysisRecords(normalized.traceRecords!, { timeFrom: timestamp, timeTo: timestamp, timeRange: 'all' }, normalized.referenceTime)).toContainEqual(target)
    const window = target!.timeWindowRefs![0]
    expect(filterCaseAnalysisRecords(normalized.traceRecords!, { timeWindowId: window.id, timeRange: 'all' }, normalized.referenceTime).some(record => record.trace?.id === target!.trace?.id)).toBe(true)
    const oneMsLater = new Date(Date.parse(timestamp) + 1).toISOString()
    expect(filterCaseAnalysisRecords(normalized.traceRecords!, { timeFrom: oneMsLater, timeTo: oneMsLater, timeRange: 'all' }, normalized.referenceTime)).not.toContainEqual(target)
  })
})

describe('CaseAnalysisWorkbench', () => {
  it('renders all unified filters and a clear Mock boundary', () => {
    render(<CaseAnalysisWorkbench data={data} />)

    expect(screen.getByText('本地 Mock 数据')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Case / Trace 分析', level: 1 })).not.toBeInTheDocument()
    for (const label of ['Channel', '垂类场景', 'Session ID', 'Trace ID', 'Skill ID', 'Skill 版本', '时间窗口', '数据集类型', '具体数据集', '过程最终得分（0–2）', '结果最终得分（0–2）', '归因', 'Log ID', '分流标签', '多场景命中']) {
      expect(screen.getByLabelText(label)).toBeVisible()
    }
    expect(screen.queryByLabelText('Query')).not.toBeInTheDocument()
    expect(screen.getByLabelText('过程最终得分（0–2）')).toBeVisible()
    expect(screen.getByLabelText('结果最终得分（0–2）')).toBeVisible()
    expect(screen.queryByRole('option', { name: 'PASS' })).not.toBeInTheDocument()
  })

  it('filters by numeric final score bands instead of PASS / FAIL labels', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const target = normalized.cases.find((item) => item.id === 'case-ppt-management')!
    expect(target.processFinalScore).toBeGreaterThanOrEqual(1)
    expect(target.processFinalScore).toBeLessThan(1.5)
    expect(target.outcomeFinalScore).toBeGreaterThanOrEqual(0.5)
    expect(target.outcomeFinalScore).toBeLessThan(1)
    expect(filterCaseAnalysisRecords(normalized.cases, { processEval: '1-1.5', outcomeEval: '0.5-1', timeRange: 'all' }, normalized.referenceTime)).toContainEqual(target)
  })

  it('selects Trace rows and emits bulk dataset actions', async () => {
    const onBulk = vi.fn()
    render(<CaseAnalysisWorkbench data={buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())} onBulkTraceImport={onBulk} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /选择 Trace/ })
    await userEvent.click(checkboxes[0])
    expect(screen.getByRole('button', { name: '加入黄金集' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '加入黄金集' }))
    expect(onBulk).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]), 'golden')
  })

  it('uses semantic Case actions instead of stacking unexplained IDs under Query', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    render(<CaseAnalysisWorkbench data={normalized} />)
    expect(screen.getAllByRole('button', { name: /查看完整 Case/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /打开 Session session-ppt-management/ })).not.toBeInTheDocument()
  })

  it('opens process evaluation first and separates the process matrix from artifact scores', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    render(<CaseAnalysisWorkbench data={normalized} initialCaseId="case-ppt-management" />)
    expect(screen.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: '治理链路' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Trace 与 Evidence' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '任务与关联' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trace 模块评测矩阵' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '过程评测' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '产物 / 结果评测' })).not.toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /^Outcome/ })).not.toBeInTheDocument()
    expect(screen.getByText(/过程最终评分（0–2）/)).toHaveTextContent('1.43 / 2')
    expect(screen.getByRole('region',{name:'当前 Trace 概要'})).not.toHaveTextContent('0.58 / 2')
    fireEvent.click(screen.getByRole('button', { name: '查看 skill Evidence' }))
    const evidence = screen.getByRole('dialog', { name: /skill Evidence/ })
    expect(evidence).toHaveTextContent('候选 executive-report 得分 0.41')
    expect(evidence).toHaveTextContent('rubric-office-v2.1#skill')
    expect(evidence).toHaveTextContent('LLM Judge Reason')
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

    await user.click(screen.getByRole('tab', { name: '评测中心' }))
    await user.click(screen.getByRole('button', { name: '查看执行节点' }))
    await user.click(screen.getByRole('button', { name: '查看该 Trace 全部节点' }))
    const memoryNode = screen.getByRole('button', { name: /Memory.*FAIL/ })
    await user.click(memoryNode)
    await user.click(screen.getByRole('button', { name: /查看根证据 \+ Rubric/ }))
    expect(screen.getByRole('dialog',{name:/Evidence/})).toHaveTextContent('Current explicit instruction has precedence.')
    await user.click(within(screen.getByRole('dialog',{name:/Evidence/})).getByRole('button',{name:'Close panel'}))
    await user.click(screen.getByRole('button', { name: /查看节点 Log/ }))
    expect(screen.getByRole('dialog', { name: /Log 详情/ })).toBeVisible()
    const logDialog = screen.getByRole('dialog', { name: /Log 详情/ })
    await user.click(within(logDialog).getByRole('button', { name: 'Close panel' }))

    await user.click(within(screen.getByRole('dialog', { name: '执行节点详情' })).getByRole('button', { name: 'Close panel' }))
    await user.click(screen.getByRole('tab', { name: '产物评测' }))
    const artifact = data.cases.find(item => item.id === 'case-task-001')!.artifacts[0]
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { name: artifact.name })).toBeVisible()
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: artifact.id }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'artifact', id: artifact.id }))
    expect(screen.getByRole('tab', { name: '产物评测' })).toHaveAttribute('aria-selected', 'true')
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
    expect(onAttributionChange).not.toHaveBeenCalled()
  })

  it('selects an exact Trace in a multi-Trace Case and targets an exact attribution revision', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onAttributionChange = vi.fn()
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    render(<CaseAnalysisWorkbench data={normalized} initialCaseId="case-ppt-management" onNavigateReference={onNavigate} onAttributionChange={onAttributionChange} />)

    await user.click(screen.getByRole('button', { name: `切换 Trace ${traceId('trace-ppt-context')}` }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'trace', id: traceId('trace-ppt-context') }))
    await user.click(screen.getByRole('button', { name: `切换 Trace ${traceId('trace-ppt-generate')}` }))

    await user.click(screen.getByRole('button', { name: '调整归因' }))
    await user.selectOptions(screen.getByLabelText('目标归因'), 'attribution-style-mismatch')
    await user.click(screen.getByRole('button', { name: '保存归因调整' }))
    expect(onAttributionChange).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'case-ppt-management', attributionId: 'attribution-style-mismatch' }))
  })

  it('shows batch taste preference evidence and its self-evolution path in Case details', () => {
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    const tasteCase = normalized.cases.find((item) => item.id === 'case-v2-taste-red')
    expect(tasteCase).toBeDefined()
    expect(tasteCase!.tastePreference).toMatchObject({ populationTotal: 1000, preferenceCount: 950 })
    render(<CaseAnalysisWorkbench data={normalized} initialCaseId={tasteCase!.id} />)
    expect(screen.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: '查看 skill 进化详情' }))
    const detail=screen.getByRole('dialog',{name:'skill · 进化详情'})
    const direction=within(detail).getByRole('button',{name:'品味库召回错误'})
    expect(direction).toHaveAttribute('aria-expanded','false')
    fireEvent.click(direction)
    expect(direction).toHaveAttribute('aria-expanded','true')
    expect(detail).toHaveTextContent('Agent 迭代')
    expect(detail).toHaveTextContent('120 / 100')
    fireEvent.click(within(detail).getByRole('button',{name:'查看 Evidence'}))
    const evidence=screen.getByRole('dialog',{name:/skill Evidence/})
    expect(evidence).toHaveTextContent(/950 名明确偏好红色/)
    expect(evidence).toHaveTextContent(/1000 名去重用户反馈/)
  })

  it('switches the active Trace and follows its own module evaluation package', async () => {
    const user = userEvent.setup()
    const normalized = buildCaseAnalysisDataFromEvolution(createInitialEvolutionData())
    render(<CaseAnalysisWorkbench data={normalized} initialCaseId="case-ppt-management" />)
    await user.click(screen.getByRole('button', { name: `切换 Trace ${traceId('trace-ppt-context')}` }))
    await user.click(screen.getByRole('tab', { name: '评测中心' }))
    const memoryRow = within(screen.getByRole('dialog', { name: /Case 详情/ })).getByRole('row', { name: /记忆.*\/ 2/ })
    expect(memoryRow).toBeVisible()
    const source = identityState.tracePackages.find(pkg=>pkg.traceId===traceId('trace-ppt-context'))!.moduleScores.find(score=>score.moduleCode==='MEMORY')!
    expect(memoryRow).toHaveTextContent(source.automaticStatus)
    expect(memoryRow).toHaveTextContent(`${(source.score!*2).toFixed(2)} / 2`)
  })

  it('shows an explicit empty state for a missing case instead of inventing data', () => {
    const emptyData = { ...data, cases: [] }
    render(<CaseAnalysisWorkbench data={emptyData} />)
    const table = screen.getByRole('table', { name: 'Case / Trace 列表' })
    expect(within(table).getByText('暂无匹配 Trace')).toBeVisible()
  })
})
