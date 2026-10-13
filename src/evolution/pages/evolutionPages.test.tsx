import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useRef, type PropsWithChildren } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EvolutionProvider } from '../store'
import { QualityProvider as BaseQualityProvider, useQuality } from '../../store'
import { IdLink, REFERENCE_KINDS } from '../components/ViewPrimitives'
import {
  AssetsSkillsPage,
  AttributionClustersPage,
  EvaluationCenterPage,
  EvolutionDatasetsPage,
  ExperimentsGatesPage,
  GovernanceOverviewPage,
  ReleasesPage,
  RuleConfigurationPage,
  VariantsPage
} from './index'
import { DatasetEvaluationWorkbenchPage } from './DatasetEvaluationWorkbenchPage'
import { createInitialEvolutionData } from '../data'
import { resolveIdentity } from '../identity'
const identityState = createInitialEvolutionData()
const canonicalTrace = (id:string) => resolveIdentity(identityState,'trace',id)

function FullFixtureScope({ children }: PropsWithChildren) {
  const { state, dispatch } = useQuality()
  const initialized = useRef(false)
  useEffect(() => { dispatch({ type: 'SET_FILTERS', filters: { timeRange: '30d' } }) }, [dispatch])
  if (state.filters.timeRange === '30d') initialized.current = true
  return initialized.current ? children : null
}

function QualityProvider({ children }: PropsWithChildren) {
  return <BaseQualityProvider><FullFixtureScope>{children}</FullFixtureScope></BaseQualityProvider>
}

beforeEach(() => localStorage.clear())

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter><QualityProvider><EvolutionProvider>{page}</EvolutionProvider></QualityProvider></MemoryRouter>)
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="overview-location">{`${location.pathname}${location.search}`}</output>
}

function renderWorkbench(url = '/datasets-evaluations') {
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider><DatasetEvaluationWorkbenchPage /><LocationProbe /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

function renderControlledOverview(url = '/overview') {
  const state = createInitialEvolutionData()
  // These three independently known tasks are the test population,
  // not a selector-computed expectation from the growing demonstration seed.
  state.cases = state.cases.filter(record => ['case-ppt-management', 'case-tool-export', 'case-multi-route'].includes(record.id))
  const outcomeTemplate = state.outcomeEvals[0]
  state.outcomeEvals = state.outcomeEvals.filter(evaluation => !state.cases.some(record => record.id === evaluation.caseId))
  state.cases.forEach((record, index) => {
    record.verticalScenario = record.id === 'case-tool-export' ? 'Excel' : 'PPT'
    record.acceptanceStatus = index === 0 ? 'ACCEPTED' : index === 1 ? 'REJECTED' : 'UNKNOWN'
    const trace = state.traces.find(item => item.caseId === record.id)!
    let artifact = state.artifacts.find(item => item.caseId === record.id)
    if (!artifact) {
      artifact = { ...state.artifacts[0], id: 'artifact-overview-tool-output', caseId: record.id, traceId: trace.id, kind: 'Excel', status: 'AVAILABLE' }
      state.artifacts.push(artifact)
    }
    state.outcomeEvals.push({ ...outcomeTemplate, id: `outcome-overview-${record.id}`, caseId: record.id, traceId: artifact.traceId, artifactId: artifact.id, dimension: '最终评分', isFinal: true, score: index, scoreScale: '0-2', revisions: [], createdAt: '2026-10-10T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z' })
    state.traces.filter(item => item.caseId === record.id).forEach(item => { item.verticalScenario = record.verticalScenario })
  })
  state.moduleReviews = []
  state.tracePackages.filter(pkg => state.cases.some(record => record.id === pkg.caseId)).forEach(pkg => {
    pkg.moduleScores.filter(score => score.moduleCode === 'SKILL').forEach(score => { score.automaticStatus = 'PASS'; score.score = 1; score.scoreScale = '0-2'; score.humanStatus = undefined; score.humanScore = undefined })
  })
  return render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider initialState={state}><GovernanceOverviewPage /><LocationProbe /></EvolutionProvider></QualityProvider></MemoryRouter>)
}

describe('Office Agent 自进化治理页面', () => {
  it('治理总览按产物、资产、过程三个大盘展示，删除旧进化漏斗', () => {
    renderPage(<GovernanceOverviewPage />)
    expect(screen.getByText('Mock 演示数据')).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['产物结果大盘', '资产大盘', '过程大盘'])
    expect(screen.queryByRole('heading', { name: '进化漏斗' })).not.toBeInTheDocument()
  })

  it('将过程评测与产物评测分开浏览，详情保留判据和人工历史', () => {
    renderPage(<EvaluationCenterPage />)
    expect(screen.getByRole('tab', { name: /过程评测/ })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /产物.*结果评测/ }))
    expect(screen.getByText('产物 / 结果评测列表')).toBeVisible()
    fireEvent.click(screen.getAllByRole('row')[1])
    expect(screen.getByRole('dialog')).toHaveTextContent('Evidence')
    expect(screen.getByRole('dialog')).toHaveTextContent('人工修订记录')
  })

  it('opens Evidence and Observation IDs from evaluation detail as real references', () => {
    const onNavigate = vi.fn()
    renderPage(<EvaluationCenterPage initialEvaluationId="process-eval-ppt-recall" onNavigateReference={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /evidence-ppt-recall/ }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'evidence', id: 'evidence-ppt-recall' }))
    fireEvent.click(screen.getByRole('button', { name: 'obs-ppt-skill' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'observation', id: 'obs-ppt-skill' }))
  })

  it('opens Outcome Eval Evidence and its Artifact while Process Eval exposes Log navigation', () => {
    const onNavigate = vi.fn()
    const first = renderPage(<EvaluationCenterPage initialEvaluationId="process-eval-ppt-recall" onNavigateReference={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'log-ppt-skill' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'log', id: 'log-ppt-skill' }))
    first.unmount(); localStorage.clear()
    renderPage(<EvaluationCenterPage initialArtifactId="artifact-ppt-management" onNavigateReference={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /evidence-ppt-style/ }))
    fireEvent.click(screen.getByRole('button', { name: 'artifact-ppt-management' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'evidence', id: 'evidence-ppt-style' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'artifact', id: 'artifact-ppt-management' }))
  })

  it('显示一个 Case 的多个问题和非互斥分流去向', () => {
    renderPage(<AttributionClustersPage />)
    expect(screen.getByText('多归因、多路分发')).toBeVisible()
    expect(screen.getAllByText('策略迭代').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Agent 迭代').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: /问题簇/ }))
    expect(screen.getByRole('heading', { name: '品味库触发进度' })).toBeVisible()
  })

  it('支持从问题簇创建变体并查看不可变来源证据', () => {
    renderPage(<VariantsPage />)
    expect(screen.getByRole('table', { name: '能力变体列表' })).toBeVisible()
    fireEvent.click(screen.getAllByRole('row')[1])
    expect(screen.getByRole('dialog')).toHaveTextContent(/来源 Case|来源问题簇/)
    expect(screen.getByRole('dialog')).toHaveTextContent('Evidence')
  })

  it('同时展示单变体与窗口组合实验，结论与发布状态分离', () => {
    renderPage(<ExperimentsGatesPage />)
    expect(screen.getByRole('tab', { name: /单能力变体实验/ })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /窗口组合实验/ }))
    expect(screen.getByText(/配置快照/)).toBeVisible()
    expect(screen.getByRole('heading', { name: '组合结果可反查' })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /准出报告/ }))
    expect(screen.getByRole('heading', { name: '实验结论' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '实际发布状态' })).toBeVisible()
  })

  it('发布、资产、数据集和规则页面保留反查与待建设状态', () => {
    const { unmount } = renderPage(<ReleasesPage />)
    expect(screen.getByRole('heading', { name: '可回滚版本' })).toBeVisible()
    unmount()
    renderPage(<AssetsSkillsPage />)
    expect(screen.getByText(/脱敏/)).toBeVisible()
    expect(screen.getAllByText(/待建设/).length).toBeGreaterThan(0)
    unmount()
    renderPage(<EvolutionDatasetsPage />)
    expect(screen.getAllByText(/归因集/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/窗口线上数据集/).length).toBeGreaterThan(0)
    unmount()
    renderPage(<RuleConfigurationPage />)
    expect(screen.getAllByText('待配置').length).toBeGreaterThan(0)
  })

  it('shows independent test sets for a fixed Skill version and attribution without inheriting old gate results', () => {
    renderWorkbench('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&governanceObject=Memory')
    expect(screen.getByText('当前治理对象：Skill')).toBeVisible()
    fireEvent.change(screen.getByLabelText('归因'), { target: { value: 'skill-sop' } })
    const datasets = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(datasets).toHaveTextContent('原始归因集')
    expect(datasets).toHaveTextContent('dataset-workspace-ppt-260-sop-attribution')
    expect(datasets).not.toHaveTextContent('已准出')
    expect(screen.getByTestId('overview-location')).toHaveTextContent('attribution=skill-sop')
  })

  it('filters existing version attributions by module and opens their complete history', () => {
    renderWorkbench('/datasets-evaluations?skillVersion=2.5.0')
    fireEvent.change(screen.getByLabelText('归因对象'), { target: { value: 'Memory' } })
    const itemFilter = screen.getByLabelText('归因')
    expect(within(itemFilter).getByRole('option', { name: /召回率低（详情见记忆模块PRD）/ })).toBeVisible()
    expect(within(itemFilter).queryByRole('option', { name: /工具未执行成功/ })).not.toBeInTheDocument()
    fireEvent.change(itemFilter, { target: { value: 'memory-recall' } })
    fireEvent.click(screen.getByRole('tab', { name: /归因历史/ }))
    fireEvent.click(within(screen.getByRole('table', { name: '归因历史列表' })).getAllByRole('row', { name: /memory-policy.*召回率低/ })[0])
    expect(screen.getByRole('dialog', { name: /归因历史详情/ })).toHaveTextContent('memory-policy')
    expect(screen.getByRole('dialog', { name: /归因历史详情/ })).not.toHaveTextContent('固定源版本2.5.0')
  })

  it('keeps canonical Skill version as part of the attribution history key', () => {
    renderWorkbench('/datasets-evaluations?skill=skill-ppt-builder&governanceObject=Skill&view=history')
    fireEvent.change(screen.getByLabelText('Skill 版本'), { target: { value: '2.5.0' } })
    expect(screen.getByRole('table', { name: '归因历史列表' })).toHaveTextContent('PPT Builder · 2.5.0 · skill sop错误')
    expect(screen.getByTestId('overview-location')).toHaveTextContent('skillVersion=2.5.0')
  })

  it('removes the duplicate workbench heading and keeps the current view section', () => {
    renderPage(<DatasetEvaluationWorkbenchPage />)
    expect(screen.queryByRole('heading', { name: '数据集与评测' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '评测集与准出集' })).toBeVisible()
  })

  it('keeps two collection views connected and preserves explicitly selected historical objects', () => {
    renderWorkbench('/datasets-evaluations?view=history&skillId=skill-ppt-builder&skillVersion=2.5.0&evolutionItem=skill-sop&experimentId=exp-single-ppt-routing')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('dialog', { name: /归因历史详情/ })).toHaveTextContent('exp-single-ppt-routing')
    fireEvent.click(screen.getByRole('button', { name: '关闭归因历史' }))
    fireEvent.click(screen.getByRole('tab', { name: /数据集/ }))
    expect(screen.getByRole('table', { name: '数据集与评测列表' })).toHaveTextContent('原始归因集')
    fireEvent.click(screen.getByRole('row', { name: /dataset-attribution/ }))
    expect(screen.getByRole('dialog', { name: /数据集详情/ })).toHaveTextContent('dataset-attribution')
  })

  it('routes legacy Trace evaluation links to their owning Case analysis instead of a duplicate Trace drawer', () => {
    renderWorkbench('/datasets-evaluations?view=traces&traceId=trace-ppt-generate&timeRange=30d')
    expect(screen.getByTestId('overview-location')).toHaveTextContent('/cases?')
    expect(screen.getByTestId('overview-location')).toHaveTextContent('caseId=case-ppt-management')
    expect(screen.getByTestId('overview-location')).toHaveTextContent(`traceId=${canonicalTrace('trace-ppt-generate')}`)
    expect(screen.getByTestId('overview-location')).toHaveTextContent('timeRange=30d')
    expect(screen.queryByRole('dialog', { name: 'Trace 评测详情' })).not.toBeInTheDocument()
  })

  it('opens dataset member Trace rows and links their exact Case and execution', () => {
    renderWorkbench('/datasets-evaluations?datasetId=dataset-workspace-ppt-260-sop-attribution&skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&timeRange=30d')
    const samples = within(screen.getByRole('dialog', { name: /数据集详情/ })).getByRole('table', { name: '数据集样本 Trace' })
    expect(samples).toHaveTextContent(canonicalTrace('trace-workspace-ppt-260-sop-1'))
    expect(samples).not.toHaveTextContent(canonicalTrace('trace-tool-export'))
    fireEvent.click(within(samples).getAllByRole('button', { name: '查看 Case / Trace' })[0])
    expect(screen.getByTestId('overview-location')).toHaveTextContent('/cases?')
    expect(screen.getByTestId('overview-location')).toHaveTextContent('caseId=case-workspace-ppt-260-sop-1')
    expect(screen.getByTestId('overview-location')).toHaveTextContent(`traceId=${canonicalTrace('trace-workspace-ppt-260-sop-1')}`)
    const returned = new URLSearchParams(screen.getByTestId('overview-location').textContent!.split('?')[1]).get('returnTo')!
    expect(returned).toContain('datasetId=dataset-workspace-ppt-260-sop-attribution')
    expect(returned).toContain('skillVersion=2.6.0')
  })

  it('creates an editable Dataset, changes members, freezes it, and versions frozen data before editing', () => {
    renderPage(<EvolutionDatasetsPage />)
    fireEvent.click(screen.getByRole('button', { name: '新建数据集版本' }))
    fireEvent.change(screen.getByLabelText('数据集名称'), { target: { value: '管理层专项归因集' } })
    fireEvent.change(screen.getByLabelText('样本范围'), { target: { value: '管理层 PPT 专项归因样本' } })
    fireEvent.click(screen.getByRole('button', { name: '保存数据集' }))

    expect(screen.getByRole('dialog', { name: '数据集详情' })).toHaveTextContent('编辑中')
    fireEvent.change(screen.getByLabelText('编辑样本范围'), { target: { value: '管理层 PPT 与 Excel 联合归因样本' } })
    fireEvent.click(screen.getByRole('button', { name: '保存基本信息' }))
    expect(screen.getByLabelText('编辑样本范围')).toHaveValue('管理层 PPT 与 Excel 联合归因样本')
    fireEvent.click(screen.getByRole('checkbox', { name: /case-tool-export/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存成员' }))
    expect(screen.getByRole('dialog', { name: '数据集详情' })).toHaveTextContent('case-tool-export')
    fireEvent.click(screen.getByRole('button', { name: '冻结当前版本' }))
    expect(screen.getByRole('dialog', { name: '数据集详情' })).toHaveTextContent('已冻结')
    expect(screen.queryByRole('button', { name: '保存成员' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '创建后续版本' }))
    expect(screen.getByRole('dialog', { name: '数据集详情' })).toHaveTextContent('编辑中')
    expect(screen.getByLabelText('数据集版本')).toHaveValue('v2')
  })

  it('creates a variant from an issue cluster and records a gate decision', () => {
    renderPage(<AttributionClustersPage initialClusterId="cluster-memory-version" />)
    fireEvent.click(screen.getByRole('button', { name: '创建能力变体' }))
    fireEvent.change(screen.getByLabelText('变体名称'), { target: { value: '测试召回变体' } })
    fireEvent.click(screen.getByRole('button', { name: '保存变体' }))
    expect(screen.getByRole('dialog', { name: '问题簇详情' })).toHaveTextContent(/variant-/)
  })

  it('records a new gate decision without conflating it with release state', () => {
    renderPage(<ExperimentsGatesPage initialExperimentId="exp-single-memory-latest" />)
    expect(screen.getByRole('button', { name: '提交准出决策' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '运行实验' }))
    fireEvent.click(screen.getByRole('button', { name: '完成 Mock 运行' }))
    fireEvent.click(screen.getByRole('button', { name: '提交准出决策' }))
    fireEvent.click(screen.getByRole('button', { name: '保存决策' }))
    expect(screen.getAllByText('人工复核').length).toBeGreaterThan(0)
  })

  it('appends and persists an evaluation revision after closing and reopening', () => {
    renderPage(<EvaluationCenterPage initialEvaluationId="process-eval-ppt-recall" />)
    fireEvent.click(screen.getByRole('button', { name: '新增人工修订' }))
    fireEvent.change(screen.getByLabelText('修订说明'), { target: { value: '人工确认召回失败' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修订' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('row', { name: /process-eval-ppt-recall/ }))
    expect(screen.getByRole('dialog', { name: '过程评测详情' })).toHaveTextContent('人工确认召回失败')
    expect(screen.getByRole('dialog', { name: '过程评测详情' })).toHaveTextContent('自动')
  })

  it('creates and runs a single-variant experiment with a frozen three-repeat snapshot', () => {
    renderPage(<ExperimentsGatesPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建实验' }))
    fireEvent.change(screen.getByLabelText('实验名称'), { target: { value: '新单变体实验' } })
    fireEvent.change(screen.getByLabelText('候选变体'), { target: { value: 'variant-reason-office-plan' } })
    fireEvent.click(screen.getByRole('button', { name: '保存实验' }))
    fireEvent.click(screen.getByRole('row', { name: /新单变体实验/ }))
    expect(screen.getByRole('dialog', { name: '实验详情' })).toHaveTextContent('3 次 / Case')
    fireEvent.click(screen.getByRole('button', { name: '运行实验' }))
    fireEvent.click(screen.getByRole('button', { name: '完成 Mock 运行' }))
    expect(screen.getByRole('dialog', { name: '实验详情' })).toHaveTextContent('COMPLETED')
  })

  it('blocks a window experiment until every candidate passes a single experiment', () => {
    renderPage(<ExperimentsGatesPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建实验' }))
    fireEvent.change(screen.getByRole('combobox', { name: '实验层级' }), { target: { value: 'WINDOW_COMBINATION' } })
    expect(screen.getByText(/单变体实验通过|至少两个已通过/)).toBeVisible()
    expect(screen.getByRole('button', { name: '保存实验' })).toBeDisabled()
  })

  it('guards asset publication, then persists the approved public workflow', () => {
    renderPage(<AssetsSkillsPage initialAssetId="asset-user-template" />)
    fireEvent.click(within(screen.getByRole('dialog', { name: '资产详情' })).getByRole('button', { name: 'asset-user-template' }))
    fireEvent.click(screen.getByRole('button', { name: '发布到公库' }))
    expect(screen.getByRole('alert')).toHaveTextContent('必须先完成脱敏与审核')
    fireEvent.click(screen.getByRole('button', { name: '标记脱敏通过' }))
    fireEvent.click(screen.getByRole('button', { name: '审核通过' }))
    fireEvent.click(screen.getByRole('button', { name: '发布到公库' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('row', { name: /asset-user-template/ }))
    expect(screen.getByRole('dialog', { name: '资产详情' })).toHaveTextContent('PUBLIC')
    expect(screen.getByRole('dialog', { name: '资产详情' })).toHaveTextContent('PUBLISHED')
  })

  it('keeps a legacy pending rule editable through its direct link and persists across reload', async () => {
    const view = renderPage(<RuleConfigurationPage initialRuleId="rule-gate-threshold" />)
    fireEvent.click(screen.getByRole('button', { name: '编辑规则' }))
    fireEvent.change(screen.getByLabelText('规则值'), { target: { value: '0.8' } })
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑规则' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    view.unmount()
    renderPage(<RuleConfigurationPage initialRuleId="rule-gate-threshold" />)
    expect(screen.getByRole('dialog', { name: '规则详情' })).toHaveTextContent('已配置')
    expect(screen.getByRole('dialog', { name: '规则详情' })).toHaveTextContent('0.8')
  })

  it('creates a release and persists rollback status with version and reason', () => {
    renderPage(<ReleasesPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建发布版本' }))
    fireEvent.change(screen.getByLabelText('版本号'), { target: { value: 'agent-3.1.0' } })
    fireEvent.click(screen.getByRole('button', { name: '保存发布版本' }))
    fireEvent.click(screen.getByRole('row', { name: /agent-3.1.0/ }))
    fireEvent.click(screen.getByRole('button', { name: '更新发布状态' }))
    fireEvent.change(screen.getByLabelText('发布状态'), { target: { value: 'ROLLED_BACK' } })
    fireEvent.change(screen.getByLabelText('回滚原因'), { target: { value: '灰度异常回退' } })
    fireEvent.click(screen.getByRole('button', { name: '保存状态' }))
    expect(screen.getByRole('dialog', { name: '发布版本详情' })).toHaveTextContent('灰度异常回退')
  })

  it('shows full experiment datasets, runs, categorized metrics and gate report snapshots', () => {
    renderPage(<ExperimentsGatesPage initialExperimentId="exp-single-ppt-routing" />)
    const detail = screen.getByRole('dialog', { name: '实验详情' })
    expect(detail).toHaveTextContent('dataset-attribution')
    expect(detail).toHaveTextContent('v1.4')
    expect(detail).toHaveTextContent('run-exp-single-ppt-routing-case-ppt-management-baseline-1')
    expect(detail).toHaveTextContent('BASELINE')
    expect(detail).toHaveTextContent('CANDIDATE')
    expect(detail).toHaveTextContent('局部指标')
    expect(detail).toHaveTextContent('端到端指标')
    expect(detail).toHaveTextContent('泛化指标')
    expect(detail).toHaveTextContent('波动')
    expect(detail).toHaveTextContent('已知风险')
    expect(screen.getByRole('button', { name: '提交准出决策' })).toBeDisabled()
    fireEvent.click(screen.getByRole('tab', { name: /准出报告/ }))
    fireEvent.click(screen.getByRole('row', { name: /gate-single-ppt-routing/ }))
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('配置快照')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('运行快照')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('Evidence')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('Baseline')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('Candidate')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('波动')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('回退项')
    expect(screen.getByRole('dialog', { name: '准出报告详情' })).toHaveTextContent('已知风险')
  })

  it('shows exact window membership and source single reports', () => {
    renderPage(<ExperimentsGatesPage initialExperimentId="exp-window-2026w35" />)
    const detail = screen.getByRole('dialog', { name: '实验详情' })
    expect(detail).toHaveTextContent('variant-ppt-routing-v3')
    expect(detail).toHaveTextContent('variant-ppt-routing-v3')
    expect(detail).toHaveTextContent('exp-single-ppt-routing')
    expect(detail).toHaveTextContent('exp-single-tool-retry')
  })

  it('renders release lineage issues cases and rollback as clickable references', () => {
    const onNavigate = vi.fn()
    renderPage(<ReleasesPage initialReleaseId="release-agent-3-0-0" onNavigateReference={onNavigate} />)
    expect(screen.getByRole('button', { name: 'issue-skill-recall' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'case-ppt-management' })).toBeVisible()
    fireEvent.click(screen.getAllByRole('button', { name: 'release-agent-2-5-0' })[0])
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'release', id: 'release-agent-2-5-0' }))
  })

  it('makes the Variants top action create a persisted variant', () => {
    renderPage(<VariantsPage />)
    fireEvent.click(screen.getByRole('button', { name: '从问题簇创建变体' }))
    fireEvent.change(screen.getByLabelText('来源问题簇'), { target: { value: 'cluster-memory-version' } })
    fireEvent.change(screen.getByLabelText('变体名称'), { target: { value: '顶部入口变体' } })
    fireEvent.click(screen.getByRole('button', { name: '保存变体' }))
    expect(screen.getByRole('table', { name: '能力变体列表' })).toHaveTextContent('顶部入口变体')
  })

  it('shows a variant status, immutable source time, linked experiments and clickable Evidence IDs', () => {
    const onNavigate = vi.fn()
    renderPage(<VariantsPage initialVariantId="variant-ppt-routing-v3" onNavigateReference={onNavigate} />)
    const detail = screen.getByRole('dialog', { name: '变体详情' })
    expect(detail).toHaveTextContent('已发布')
    expect(detail).toHaveTextContent('创建时间')
    expect(detail).toHaveTextContent('exp-single-ppt-routing')
    fireEvent.click(screen.getByRole('button', { name: 'evidence-ppt-recall' }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'evidence', id: 'evidence-ppt-recall' }))
  })

  it('shows taste threshold gating and pending gate states', () => {
    renderPage(<AttributionClustersPage initialClusterId="cluster-ppt-taste-pending" />)
    expect(screen.getByRole('dialog', { name: '问题簇详情' })).toHaveTextContent('37 / 100')
    expect(screen.getByRole('button', { name: '创建能力变体' })).toBeDisabled()
    expect(screen.getByText(/未达到品味库触发门槛/)).toBeVisible()
  })

  it('keeps removed personal asset and Skill planning actions out of the unified page', () => {
    renderPage(<AssetsSkillsPage />)
    expect(screen.queryByRole('button', { name: '上传个人资产' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '规划个人 Skill' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Skill 列表' })).toBeVisible()
  })

  it('supports asset catalog cascade, query-time filtering and version performance report gating', () => {
    renderPage(<AssetsSkillsPage />)
    const report = screen.getByRole('button', { name: '下载报告' })
    expect(report).toBeDisabled()
    fireEvent.change(screen.getByLabelText('资产类型'), { target: { value: 'PRODUCTION_SKILL' } })
    const assetSelect = screen.getByLabelText('具体资产') as HTMLSelectElement
    expect(assetSelect.options.length).toBeGreaterThan(1)
    fireEvent.change(assetSelect, { target: { value: assetSelect.options[1].value } })
    expect(screen.getByLabelText('资产版本')).not.toBeDisabled()
    fireEvent.change(screen.getByLabelText('资产开始时间'), { target: { value: '2026-09-01T00:00' } })
    fireEvent.change(screen.getByLabelText('资产结束时间'), { target: { value: '2026-10-31T23:59' } })
    expect(report).not.toBeDisabled()
    expect(screen.getByRole('table', { name: '资产版本表现' })).toBeVisible()
  })

  it('creates an issue with full attribution, routing, optimization and responsibility fields', () => {
    renderPage(<AttributionClustersPage />)
    fireEvent.click(screen.getByRole('button', { name: '新建问题' }))
    fireEvent.change(screen.getByLabelText('来源 Case'), { target: { value: 'case-multi-route' } })
    fireEvent.change(screen.getByLabelText('来源归因'), { target: { value: 'attribution-reason-tool' } })
    fireEvent.change(screen.getByLabelText('问题标题'), { target: { value: '完整字段问题' } })
    fireEvent.change(screen.getByLabelText('问题描述'), { target: { value: '描述具体失败影响与期望修复。' } })
    fireEvent.click(screen.getByLabelText('evidence-reason-plan'))
    fireEvent.click(screen.getByLabelText('策略迭代'))
    fireEvent.click(screen.getByLabelText('个人能力转 Skill（二期）'))
    fireEvent.change(screen.getByLabelText('优化方式'), { target: { value: 'DIRECT_FIX' } })
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'Reason 团队' } })
    fireEvent.change(screen.getByLabelText('责任状态'), { target: { value: 'ASSIGNED' } })
    fireEvent.click(screen.getByRole('button', { name: '保存问题' }))
    expect(screen.getByRole('table', { name: '问题列表' })).toHaveTextContent('完整字段问题')
    expect(screen.getByRole('table', { name: '问题列表' })).toHaveTextContent('策略迭代')
    expect(screen.getByRole('table', { name: '问题列表' })).toHaveTextContent('个人能力转 Skill（二期）')
    fireEvent.click(screen.getByRole('row', { name: /完整字段问题/ }))
    expect(screen.getByRole('dialog', { name: '问题详情' })).toHaveTextContent('描述具体失败影响与期望修复。')
    expect(screen.getByRole('dialog', { name: '问题详情' })).toHaveTextContent('evidence-reason-plan')
  })

  it('selects and edits an explicit attribution without overwriting its history', () => {
    renderPage(<AttributionClustersPage initialIssueId="attribution-reason-tool" />)
    expect(screen.getByText('attribution-reason-tool')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '编辑归因' }))
    fireEvent.change(screen.getByLabelText('归因维度编辑'), { target: { value: '工具参数错误' } })
    fireEvent.click(screen.getByRole('button', { name: '保存归因 Revision' }))
    expect(screen.getByRole('dialog', { name: '问题详情' })).toHaveTextContent('工具参数错误')
    expect(screen.getByRole('dialog', { name: '问题详情' })).toHaveTextContent('归因历史')
  })

  it('opens the total Case metric as its exact list and preserves active filters', () => {
    renderControlledOverview('/overview?timeRange=30d&environment=Production&businessType=PPT&agentVersion=agent-2.5.0')
    const total = screen.getByRole('button', { name: /^总 Case 数/ })
    expect(total).toHaveTextContent('3')
    fireEvent.click(total)
    const destination = new URL(screen.getByTestId('overview-location').textContent!, 'https://demo.test')
    expect(destination.pathname).toBe('/cases')
    expect(destination.searchParams.get('caseSet')?.split(',').sort()).toEqual(['case-multi-route', 'case-ppt-management', 'case-tool-export'])
    expect(destination.searchParams.get('caseClosed')).toBe('1')
    expect(destination.searchParams.get('timeRange')).toBe('30d')
    expect(destination.searchParams.get('environment')).toBe('Production')
    expect(destination.searchParams.get('businessType')).toBe('PPT')
    expect(destination.searchParams.get('agentVersion')).toBe('agent-2.5.0')
  })

  it('opens asset management with global scope and clears stale rule and asset selections', () => {
    renderControlledOverview('/overview?timeRange=30d&environment=Production&businessType=PPT&ruleType=CLUSTER&ruleAssetType=TASTE_SKILL&ruleAssetId=asset-catalog-skill-taste-executive&ruleAttribution=skill-capability')
    fireEvent.click(screen.getByRole('link', { name: '查看资产管理' }))
    const destination = new URL(screen.getByTestId('overview-location').textContent!, 'https://demo.test')
    expect(destination.pathname).toBe('/assets-skills')
    expect(destination.searchParams.get('timeRange')).toBe('30d')
    expect(destination.searchParams.get('environment')).toBe('Production')
    expect(destination.searchParams.get('businessType')).toBe('PPT')
    for (const key of ['ruleType', 'ruleAssetType', 'ruleAssetId', 'ruleAttribution']) expect(destination.searchParams.has(key)).toBe(false)
  })

  it.each([
    ['0 分', 'case-ppt-management'],
    ['1 分', 'case-tool-export'],
    ['2 分', 'case-multi-route']
  ])('numeric score bucket %s opens only the matching Case without Pass / Fail filters', (label, caseId) => {
    renderControlledOverview('/overview?timeRange=30d&environment=Production')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    const destination = new URL(screen.getByTestId('overview-location').textContent!, 'https://demo.test')
    expect(destination.pathname).toBe('/cases')
    expect(destination.searchParams.get('caseSet')).toBe(caseId)
    expect(destination.searchParams.get('caseClosed')).toBe('1')
    expect(destination.searchParams.has('outcomeEval')).toBe(false)
    expect(destination.searchParams.has('processEval')).toBe(false)
    expect(destination.searchParams.get('timeRange')).toBe('30d')
  })

  it('product-type efficiency opens only the contributing PPT Trace set', () => {
    renderControlledOverview('/overview?timeRange=30d&environment=Production')
    fireEvent.click(screen.getByRole('button', { name: '查看 PPT 过程 Trace' }))
    const destination = new URL(screen.getByTestId('overview-location').textContent!, 'https://demo.test')
    expect(destination.pathname).toBe('/cases')
    expect(destination.searchParams.get('caseSet')?.split(',').sort()).toEqual(['case-multi-route', 'case-ppt-management'])
    expect(destination.searchParams.get('traceSet')?.split(',').sort()).toEqual([canonicalTrace('trace-ppt-context'), canonicalTrace('trace-ppt-generate'), canonicalTrace('trace-multi-route')].sort())
    expect(destination.searchParams.get('verticalScenario')).toBe('PPT')
  })

  it.each(REFERENCE_KINDS)('keeps the %s typed ID keyboard-operable', async (kind) => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<IdLink id={`${kind}-keyboard-id`} kind={kind} onOpen={onNavigate} />)
    const link = screen.getByRole('button', { name: `${kind}-keyboard-id` })
    link.focus()
    await user.keyboard('{Enter}')
    expect(link).toHaveFocus()
    expect(onNavigate).toHaveBeenCalledWith({ kind, id: `${kind}-keyboard-id` })
  })

  it('labels a typed ID unavailable instead of rendering a false link', () => {
    render(<IdLink id="external-mock-snapshot-1" kind="evidence" />)
    expect(screen.queryByRole('button', { name: 'external-mock-snapshot-1' })).not.toBeInTheDocument()
    expect(screen.getByRole('note', { name: /external-mock-snapshot-1 不可导航/ })).toBeVisible()
  })

  it('PRD module quality opens score evidence only for the selected product type and module', () => {
    renderControlledOverview('/overview?timeRange=30d&environment=Production')
    fireEvent.click(screen.getByRole('button', { name: '查看 PPT skill 评分明细' }))
    const destination = new URL(screen.getByTestId('overview-location').textContent!, 'https://demo.test')
    expect(destination.pathname).toBe('/cases')
    expect(destination.searchParams.get('caseSet')?.split(',').sort()).toEqual(['case-multi-route', 'case-ppt-management'])
    expect(destination.searchParams.get('moduleCode')).toBe('SKILL')
    expect(destination.searchParams.get('verticalScenario')).toBe('PPT')
    expect(destination.searchParams.get('timeRange')).toBe('30d')
    expect(destination.searchParams.get('traceSet')).not.toContain(canonicalTrace('trace-tool-export'))
  })
})
