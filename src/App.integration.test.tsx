import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App, { REFERENCE_ROUTES } from './App'
import { REFERENCE_KINDS } from './evolution/components/ViewPrimitives'
import { EvolutionProvider } from './evolution/store'
import { QualityProvider, useQuality } from './store'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderApp(initialEntry = '/overview') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QualityProvider>
        <EvolutionProvider>
          <App />
          <LocationProbe />
        </EvolutionProvider>
      </QualityProvider>
    </MemoryRouter>
  )
}

function clearEvolutionStorage() {
  localStorage.clear()
}

function QualityFilterProbe() {
  const filters = useQuality().state.filters
  return <output data-testid="quality-local-fields">{JSON.stringify({ skillVersion: filters.skillVersion, processEval: filters.processEval, outcomeEval: filters.outcomeEval, logId: filters.logId, multiScene: filters.multiScene, routingTags: filters.routingTags })}</output>
}

describe('Office Agent self-evolution app integration', () => {
  it('maps every typed reference kind and the compatibility alias to an owning route', () => {
    expect(Object.keys(REFERENCE_ROUTES).sort()).toEqual([...REFERENCE_KINDS, 'issue-cluster'].sort())
    expect(REFERENCE_ROUTES['issue-cluster']).toEqual(REFERENCE_ROUTES.cluster)
  })
  it('renders the ten primary governance destinations and the new brand', () => {
    clearEvolutionStorage()
    renderApp()

    expect(screen.getByText('Office Agent')).toBeVisible()
    expect(screen.getByText('自进化治理平台')).toBeVisible()
    expect(within(screen.getByRole('navigation', { name: '主导航' })).getAllByRole('link')).toHaveLength(10)
    const primaryNav = within(screen.getByRole('navigation', { name: '主导航' }))
    expect(primaryNav.getByRole('link', { name: '治理总览' })).toHaveAttribute('href', '/overview')
    expect(primaryNav.getByRole('link', { name: 'Case / Trace 分析' })).toHaveAttribute('href', '/cases')
    expect(primaryNav.getByRole('link', { name: '评测中心' })).toHaveAttribute('href', '/evaluations')
    expect(primaryNav.getByRole('link', { name: '归因与问题簇' })).toHaveAttribute('href', '/issues')
    expect(primaryNav.getByRole('link', { name: '能力变体' })).toHaveAttribute('href', '/variants')
    expect(primaryNav.getByRole('link', { name: '实验与准出' })).toHaveAttribute('href', '/experiments')
    expect(primaryNav.getByRole('link', { name: '发布版本' })).toHaveAttribute('href', '/releases')
    expect(primaryNav.getByRole('link', { name: '资产与 Skill' })).toHaveAttribute('href', '/assets-skills')
    expect(primaryNav.getByRole('link', { name: '数据集' })).toHaveAttribute('href', '/datasets')
    expect(primaryNav.getByRole('link', { name: '规则配置' })).toHaveAttribute('href', '/rules')
    expect(screen.getAllByRole('heading', { name: '治理总览', level: 1 })).toHaveLength(2)
    expect(screen.getAllByText('Mock 演示数据').length).toBeGreaterThan(0)
  })

  it('routes a linked object ID to its owning page while preserving filters', async () => {
    clearEvolutionStorage()
    renderApp('/evaluations?timeRange=14d&environment=Production')

    expect(screen.getAllByRole('heading', { name: '评测中心', level: 1 })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: /case-ppt-management/ })[0])

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/cases?')
      expect(screen.getByTestId('location')).toHaveTextContent('timeRange=14d')
      expect(screen.getByTestId('location')).toHaveTextContent('environment=Production')
      expect(screen.getByTestId('location')).toHaveTextContent('caseId=case-ppt-management')
    })
    expect(screen.getByRole('dialog', { name: /Case 详情 · case-ppt-management/ })).toBeVisible()
  })

  it('keeps legacy deep links compatible without exposing them in primary navigation', async () => {
    clearEvolutionStorage()
    renderApp('/tasks?timeRange=7d&environment=Production&taskId=task-001')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/cases?')
      expect(screen.getByTestId('location')).toHaveTextContent('timeRange=7d')
      expect(screen.getByTestId('location')).toHaveTextContent('environment=Production')
      expect(screen.getByTestId('location')).toHaveTextContent('caseId=task-001')
    })
    expect(screen.queryByRole('link', { name: 'Task / Trace' })).not.toBeInTheDocument()
  })

  it('maps legacy Benchmark comparison links to the experiment context', async () => {
    clearEvolutionStorage()
    renderApp('/benchmarks/benchmark-001/cases/case-ppt-management?timeRange=30d')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/experiments?')
      expect(screen.getByTestId('location')).toHaveTextContent('experimentId=benchmark-001')
      expect(screen.getByTestId('location')).toHaveTextContent('caseId=case-ppt-management')
      expect(screen.getByTestId('location')).toHaveTextContent('comparison=true')
      expect(screen.getByTestId('location')).toHaveTextContent('timeRange=30d')
    })
  })

  it('clears an old object ID when switching primary navigation and keeps global filters', async () => {
    clearEvolutionStorage()
    renderApp('/variants?timeRange=14d&variantId=variant-ppt-routing-v3')

    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', { name: '发布版本' }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/releases?timeRange=14d')
      expect(screen.getByTestId('location')).not.toHaveTextContent('variantId=')
    })
  })

  it('applies global version, business and environment filters to evolution Case data', async () => {
    clearEvolutionStorage()
    renderApp('/cases?timeRange=30d&agentVersion=agent-2.5.0&businessType=Excel&environment=Production')

    await waitFor(() => expect(screen.getByText(/1 个 Case/)).toBeVisible())
    expect(screen.getByRole('table', { name: 'Case / Trace 列表' })).toHaveTextContent('case-tool-export')
    expect(screen.getByRole('table', { name: 'Case / Trace 列表' })).not.toHaveTextContent('case-ppt-management')
  })

  it('opens owning-page details from every object ID query parameter', async () => {
    clearEvolutionStorage()
    const { unmount } = renderApp('/variants?variantId=variant-ppt-routing-v3')
    expect(await screen.findByRole('dialog', { name: '变体详情' })).toHaveTextContent('variant-ppt-routing-v3')
    unmount()

    renderApp('/experiments?experimentId=exp-single-ppt-routing')
    expect(await screen.findByRole('dialog', { name: '实验详情' })).toHaveTextContent('exp-single-ppt-routing')
  })

  it('routes the Rule typed ID to its owning detail', async () => {
    clearEvolutionStorage()
    renderApp('/rules?ruleId=rule-repeat-count&timeRange=30d')
    const dialog = await screen.findByRole('dialog', { name: '规则详情' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'rule-repeat-count' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/rules?ruleId=rule-repeat-count&timeRange=30d'))
  })

  it.each([
    ['case', '/cases?caseId=case-ppt-management', 'case-ppt-management'],
    ['session', '/cases?sessionId=session-ppt-management', 'session-ppt-management'],
    ['trace', '/cases?traceId=trace-ppt-generate', 'trace-ppt-generate'],
    ['observation', '/cases?observationId=obs-ppt-skill', 'obs-ppt-skill'],
    ['log', '/cases?logId=log-ppt-skill', 'log-ppt-skill'],
    ['evidence', '/cases?evidenceId=evidence-ppt-recall', 'evidence-ppt-recall'],
    ['artifact', '/evaluations?artifactId=artifact-ppt-management', 'artifact-ppt-management'],
    ['process-eval', '/evaluations?evaluationId=process-eval-ppt-recall', 'process-eval-ppt-recall'],
    ['outcome-eval', '/evaluations?evaluationId=outcome-eval-ppt-style', 'outcome-eval-ppt-style'],
    ['attribution', '/issues?attributionId=attribution-skill-recall', 'attribution-skill-recall'],
    ['issue', '/issues?issueId=issue-skill-recall', 'issue-skill-recall'],
    ['cluster', '/issues?clusterId=cluster-ppt-routing-ready', 'cluster-ppt-routing-ready'],
    ['variant', '/variants?variantId=variant-ppt-routing-v3', 'variant-ppt-routing-v3'],
    ['dataset', '/datasets?datasetId=dataset-attribution', 'dataset-attribution'],
    ['experiment', '/experiments?experimentId=exp-single-ppt-routing', 'exp-single-ppt-routing'],
    ['experiment-run', '/experiments?runId=run-exp-single-ppt-routing-case-ppt-management-baseline-1', 'run-exp-single-ppt-routing-case-ppt-management-baseline-1'],
    ['window', '/experiments?windowId=window-2026w35', 'window-2026w35'],
    ['decision', '/experiments?decisionId=gate-window-2026w35', 'gate-window-2026w35'],
    ['release', '/releases?releaseId=release-agent-3-0-0', 'release-agent-3-0-0'],
    ['skill', '/assets-skills?skillId=skill-ppt-builder', 'skill-ppt-builder'],
    ['asset', '/assets-skills?assetId=asset-executive-template', 'asset-executive-template'],
    ['rule', '/rules?ruleId=rule-repeat-count', 'rule-repeat-count']
  ])('opens the %s owning context from a stable typed deep link', async (_kind, path, id) => {
    clearEvolutionStorage()
    const view = renderApp(`${path}&timeRange=30d`)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(id))
    expect(document.querySelector('main')).toBeTruthy()
    view.unmount()
  })

  it('routes a Log typed ID to its exact owning Case and Log drawer', async () => {
    clearEvolutionStorage()
    renderApp('/cases?logId=log-ppt-skill&timeRange=30d')
    expect(await screen.findByRole('dialog', { name: /Case 详情 · case-ppt-management/ })).toBeVisible()
    expect(screen.getByRole('dialog', { name: /Log 详情/ })).toHaveTextContent('log-ppt-skill')
  })

  it('persists Case human confirmation through the evolution store', async () => {
    clearEvolutionStorage()
    renderApp('/cases?caseId=case-ppt-management&timeRange=30d')

    fireEvent.click(await screen.findByRole('button', { name: '人工确认' }))
    fireEvent.change(screen.getByLabelText('确认说明'), { target: { value: '集成人工复核记录' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工结论' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.click(screen.getByRole('row', { name: /case-ppt-management/ }))

    expect(await screen.findByText('集成人工复核记录')).toBeVisible()
    expect(JSON.parse(localStorage.getItem('office-agent-evolution-governance:v1') ?? '{}').state.auditTrail).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: 'case-ppt-management' })])
    )
  })

  it('rehydrates persisted Case confirmation after the provider is fully unmounted', async () => {
    clearEvolutionStorage()
    const first = renderApp('/cases?caseId=case-ppt-management&timeRange=30d')
    fireEvent.click(await screen.findByRole('button', { name: '人工确认' }))
    fireEvent.change(screen.getByLabelText('确认说明'), { target: { value: '跨重挂载人工复核记录' } })
    fireEvent.click(screen.getByRole('button', { name: '保存人工结论' }))
    await waitFor(() => expect(localStorage.getItem('office-agent-evolution-governance:v1')).toContain('跨重挂载人工复核记录'))
    first.unmount()

    renderApp('/cases?caseId=case-ppt-management&timeRange=30d')
    expect(await screen.findByText('跨重挂载人工复核记录')).toBeVisible()
  })

  it('rehydrates a created Issue and appended Eval revision after provider remount', async () => {
    clearEvolutionStorage()
    const first = renderApp('/evaluations?evaluationId=process-eval-ppt-recall&timeRange=30d')
    fireEvent.click(await screen.findByRole('button', { name: '新增人工修订' }))
    fireEvent.change(screen.getByLabelText('修订说明'), { target: { value: '跨重挂载 Eval 修订' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修订' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', { name: '归因与问题簇' }))
    fireEvent.click(await screen.findByRole('button', { name: '新建问题' }))
    fireEvent.change(screen.getByLabelText('问题标题'), { target: { value: '跨重挂载问题' } })
    fireEvent.change(screen.getByLabelText('问题描述'), { target: { value: '验证 Issue 持久化' } })
    fireEvent.click(screen.getByLabelText('evidence-ppt-recall'))
    fireEvent.click(screen.getByLabelText('Agent 迭代'))
    fireEvent.click(screen.getByRole('button', { name: '保存问题' }))
    await waitFor(() => expect(localStorage.getItem('office-agent-evolution-governance:v1')).toContain('跨重挂载问题'))
    first.unmount()

    renderApp('/evaluations?evaluationId=process-eval-ppt-recall&timeRange=30d')
    expect((await screen.findAllByText('跨重挂载 Eval 修订')).length).toBeGreaterThan(0)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', { name: '归因与问题簇' }))
    expect(await screen.findByText('跨重挂载问题')).toBeVisible()
  })

  it('selects the exact non-primary Trace and Observation requested by URL', async () => {
    clearEvolutionStorage()
    renderApp('/cases?caseId=case-ppt-management&traceId=trace-ppt-context&observationId=obs-ppt-memory&timeRange=30d')
    const dialog = await screen.findByRole('dialog', { name: /Case 详情 · case-ppt-management/ })
    expect(dialog).toHaveTextContent('trace-ppt-context')
    expect(dialog).toHaveTextContent('obs-ppt-memory')
    expect(within(dialog).getByRole('tab', { name: 'Trace 与 Evidence' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches a multi-Trace Case in detail while retaining Case and global scope', async () => {
    clearEvolutionStorage()
    renderApp('/cases?caseId=case-ppt-management&timeRange=30d&environment=Production')
    fireEvent.click(await screen.findByRole('button', { name: '切换 Trace trace-ppt-context' }))
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('caseId=case-ppt-management')
      expect(screen.getByTestId('location')).toHaveTextContent('traceId=trace-ppt-context')
      expect(screen.getByTestId('location')).toHaveTextContent('timeRange=30d')
      expect(screen.getByTestId('location')).toHaveTextContent('environment=Production')
    })
    expect(screen.getByRole('dialog', { name: /Case 详情 · case-ppt-management/ })).toHaveTextContent('obs-ppt-memory')
  })

  it('revises only the explicitly selected attribution and preserves both histories', async () => {
    clearEvolutionStorage()
    renderApp('/cases?caseId=case-ppt-management&timeRange=30d')
    const before = JSON.parse(localStorage.getItem('office-agent-evolution-governance:v1') ?? '{}').state
    const recallBefore = before.attributions.find((item: { id: string }) => item.id === 'attribution-skill-recall').revisions
    const styleBefore = before.attributions.find((item: { id: string }) => item.id === 'attribution-style-mismatch').revisions
    fireEvent.click(await screen.findByRole('button', { name: '调整归因' }))
    fireEvent.change(screen.getByLabelText('目标归因'), { target: { value: 'attribution-style-mismatch' } })
    fireEvent.change(within(screen.getByRole('dialog', { name: '调整归因' })).getByRole('textbox'), { target: { value: '只修订风格归因' } })
    fireEvent.click(screen.getByRole('button', { name: '保存归因调整' }))
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem('office-agent-evolution-governance:v1') ?? '{}').state
      expect(state.attributions.find((item: { id: string }) => item.id === 'attribution-skill-recall').revisions).toEqual(recallBefore)
      expect(state.attributions.find((item: { id: string }) => item.id === 'attribution-style-mismatch').revisions).toHaveLength(styleBefore.length + 1)
      expect(state.attributions.find((item: { id: string }) => item.id === 'attribution-style-mismatch').revisions.slice(0, styleBefore.length)).toEqual(styleBefore)
    })
  })

  it('renders the real four-turn Session data with exact Trace links', async () => {
    clearEvolutionStorage()
    renderApp('/cases?caseId=case-ppt-management&timeRange=30d')
    fireEvent.click(await screen.findByRole('tab', { name: 'Session 对话' }))
    expect(screen.getByText('使用刚才上传的销售 Excel。')).toBeVisible()
    expect(screen.getByText('改成面向管理层的季度经营 PPT。')).toBeVisible()
    expect(screen.getAllByText(/第 [1-4] 轮/)).toHaveLength(4)
    expect(screen.getAllByRole('button', { name: /打开 Trace/ })).toHaveLength(4)
  })

  it('syncs all Case local filters to URL and exposes a visible Skill filter', async () => {
    clearEvolutionStorage()
    renderApp('/cases?timeRange=30d')
    expect(screen.getByLabelText('全局 Skill')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Skill 版本'), { target: { value: '2.6.0' } })
    fireEvent.change(screen.getByLabelText('过程评测'), { target: { value: 'FAIL' } })
    fireEvent.change(screen.getByLabelText('Log ID'), { target: { value: 'log-ppt-skill' } })
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('skillVersion=2.6.0')
      expect(screen.getByTestId('location')).toHaveTextContent('processEval=FAIL')
      expect(screen.getByTestId('location')).toHaveTextContent('logId=log-ppt-skill')
    })
  })

  it('retains repeated routing tags and local filters through navigation and remount', async () => {
    clearEvolutionStorage()
    const entry = '/cases?timeRange=30d&skillVersion=2.6.0&processEval=FAIL&routingTag=%E7%AD%96%E7%95%A5%E8%BF%AD%E4%BB%A3&routingTag=Agent+%E8%BF%AD%E4%BB%A3'
    const first = renderApp(entry)
    await waitFor(() => expect(screen.getByLabelText('策略迭代')).toBeChecked())
    expect(screen.getByLabelText('Agent 迭代')).toBeChecked()
    expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.6.0')
    first.unmount()
    renderApp(entry)
    await waitFor(() => expect(screen.getByLabelText('策略迭代')).toBeChecked())
    expect(screen.getByTestId('location')).toHaveTextContent('routingTag=')
  })

  it('does not hydrate Case-local URL fields into the global Quality filter store', async () => {
    clearEvolutionStorage()
    render(<MemoryRouter initialEntries={['/cases?timeRange=30d&skillVersion=2.6.0&processEval=FAIL&logId=log-ppt-skill&routingTag=Agent+%E8%BF%AD%E4%BB%A3']}><QualityProvider><EvolutionProvider><App/><QualityFilterProbe/></EvolutionProvider></QualityProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.6.0'))
    expect(screen.getByTestId('quality-local-fields')).toHaveTextContent('{}')
  })

  it('restores global, Case-local, repeated, and detail URL layers through sequential changes, breadcrumb, and Back', async () => {
    clearEvolutionStorage()
    renderApp('/cases?timeRange=30d&agentVersion=agent-2.5.0&businessType=PPT&environment=Production&skill=skill-ppt-builder&skillVersion=2.6.0&processEval=FAIL&logId=log-ppt-skill&routingTag=%E7%AD%96%E7%95%A5%E8%BF%AD%E4%BB%A3&routingTag=Agent+%E8%BF%AD%E4%BB%A3&caseId=case-ppt-management')
    expect(await screen.findByRole('dialog', { name: /Case 详情 · case-ppt-management/ })).toBeVisible()
    fireEvent.change(screen.getByLabelText('结果评测'), { target: { value: 'FAIL' } })
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? ''
      for (const token of ['caseId=case-ppt-management', 'timeRange=30d', 'agentVersion=agent-2.5.0', 'environment=Production', 'skillVersion=2.6.0', 'processEval=FAIL', 'outcomeEval=FAIL', 'logId=log-ppt-skill']) expect(location).toContain(token)
      expect((location.match(/routingTag=/g) ?? [])).toHaveLength(2)
    })
    fireEvent.click(within(screen.getByRole('navigation', { name: '面包屑导航' })).getByRole('link', { name: '治理总览' }))
    expect(screen.getByTestId('location')).toHaveTextContent('skillVersion=2.6.0')
    fireEvent.click(screen.getByRole('link', { name: 'Case / Trace 分析' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('skillVersion=2.6.0'))
    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/overview'))
  })

})
