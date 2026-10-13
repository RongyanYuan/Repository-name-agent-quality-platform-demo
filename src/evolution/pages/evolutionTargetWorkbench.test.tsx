import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { QualityProvider } from '../../store'
import { EvolutionProvider } from '../store'
import { createInitialEvolutionData } from '../data'
import type { EvolutionRecord } from '../domain'
import { DatasetEvaluationWorkbenchPage } from './DatasetEvaluationWorkbenchPage'

beforeEach(() => localStorage.clear())
function Probe() { const location = useLocation(); return <output data-testid="record-location">{location.pathname + location.search}</output> }
function fixture() {
  const state = createInitialEvolutionData()
  const current: EvolutionRecord = { id: 'evolution-memory-current', name: '记忆召回策略第二轮', target: { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-policy', targetVersion: 'policy-2', attributionId: 'memory-recall' }, sourceFindingIds: [], sourceAttributionIds: [], sourceIssueIds: [], sourceClusterIds: [], routingDeliveryIds: [], datasetIds: [state.datasets[0].id], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [], origin: 'MOCK', createdAt: state.updatedAt, updatedAt: state.updatedAt }
  state.evolutionRecords = [current, { ...current, id: 'evolution-memory-old', name: '记忆召回策略第一轮', target: { kind: 'MODULE', governanceObject: 'Memory', targetId: 'memory-policy', targetVersion: 'policy-1', attributionId: 'memory-recall' }, datasetIds: [state.datasets[1].id] }, { ...current, id: 'evolution-skill-current', name: 'PPT SOP 固定版本修复', target: { kind: 'SKILL', governanceObject: 'Skill', skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attributionId: 'skill-sop' } }]
  return { state, current }
}
function show(url: string) {
  const { state, current } = fixture()
  render(<MemoryRouter initialEntries={[url]}><QualityProvider><EvolutionProvider initialState={state}><DatasetEvaluationWorkbenchPage /><Probe /></EvolutionProvider></QualityProvider></MemoryRouter>)
  return { state, current }
}
function reusedDatasetFixture() {
  const state = createInitialEvolutionData()
  const old = structuredClone(state.evolutionRecords!.find(item => item.id === 'evolution-module-path-demo-sop-agent')!)
  old.name = '第一轮 SOP 已准出'
  const current: EvolutionRecord = { ...structuredClone(old), id: 'current-unrun-cycle', name: '第二轮 SOP 待验证', datasetIds: [old.datasetIds[0]], variantIds: [], singleExperimentIds: [], windowExperimentIds: [], decisionIds: [], releaseIds: [], supersedesRecordId: old.id, createdAt: '2026-10-11T10:00:00Z' }
  state.evolutionRecords = [current, old]
  return { state, old, current, datasetId: old.datasetIds[0] }
}

describe('exact target Dataset / Evaluation workbench', () => {
  it('opens Memory at its own version, clears stale Skill fields and keeps only the current cycle assets', async () => {
    const { state } = show('/datasets-evaluations?evolutionRecordId=evolution-memory-current&skill=skill-ppt-builder&skillVersion=2.5.0&skillCategory=PRODUCTION_SKILL&view=datasets&returnTo=%2Fcases%3FcaseView%3Deval')
    await waitFor(() => expect(screen.getByLabelText('归因对象')).toHaveValue('Memory'))
    expect(screen.queryByLabelText('具体 Skill')).not.toBeInTheDocument()
    expect(screen.getByLabelText('目标源版本')).toHaveValue('policy-2')
    const rows = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(rows).toHaveTextContent(state.datasets[0].id)
    expect(rows).not.toHaveTextContent(state.datasets[1].id)
    expect(rows).toHaveTextContent('尚未进入准出')
    await waitFor(() => expect(screen.getByTestId('record-location')).not.toHaveTextContent('skill='))
    expect(screen.getByTestId('record-location')).toHaveTextContent('targetVersion=policy-2')
    expect(screen.getByTestId('record-location')).toHaveTextContent('returnTo=')
  })

  it('preserves the source Skill version instead of replacing it with the latest release', async () => {
    show('/datasets-evaluations?evolutionRecordId=evolution-skill-current&skillVersion=9.9.9&view=datasets')
    await waitFor(() => expect(screen.getByLabelText('具体 Skill')).toHaveValue('skill-ppt-builder'))
    expect(screen.getByLabelText('Skill 版本')).toHaveValue('2.5.0')
    expect(screen.queryByLabelText('归因对象')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('record-location')).toHaveTextContent('skillVersion=2.5.0'))
  })

  it('does not expose unrelated gate reports when current cycle opens history', () => {
    show('/datasets-evaluations?evolutionRecordId=evolution-memory-current&view=history')
    const drawer = screen.getByRole('dialog', { name: /归因历史详情.*记忆召回策略第二轮/ })
    expect(drawer).toHaveTextContent('固定目标与独立进化轮次')
    expect(drawer).toHaveTextContent('policy-2')
    expect(drawer).toHaveTextContent('尚未记录本轮准出决策')
    expect(drawer).toHaveTextContent('尚未记录本轮实际发布')
    expect(within(drawer).queryByText(/PPT Builder/)).not.toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭归因历史' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('record-location')).toHaveTextContent('evolutionRecordId=evolution-memory-current')
  })

  it('keeps missing exact cycles empty and never falls back to global data', () => {
    show('/datasets-evaluations?evolutionRecordId=missing&governanceObject=Memory&view=datasets')
    expect(screen.getByText('进化轮次不存在')).toBeVisible()
    const rows = screen.getByRole('table', { name: '数据集与评测列表' })
    expect(rows).not.toHaveTextContent('dataset-attribution')
    expect(rows).toHaveTextContent('暂无对应测试集')
  })

  it('uses generic module targets when browsing Memory without a Skill or exact cycle', async () => {
    show('/datasets-evaluations?governanceObject=Memory&view=history')
    await waitFor(() => expect(screen.getByLabelText('归因对象')).toHaveValue('Memory'))
    expect(screen.queryByLabelText('具体 Skill')).not.toBeInTheDocument()
    expect(screen.getByLabelText('具体治理目标')).toBeVisible()
    const table = screen.getByRole('table', { name: '归因历史列表' })
    expect(table).toHaveTextContent('记忆召回策略第二轮')
    expect(table).toHaveTextContent('记忆召回策略第一轮')
    expect(table).not.toHaveTextContent('PPT SOP')
    fireEvent.change(screen.getByLabelText('具体治理目标'), { target: { value: 'memory-policy' } })
    fireEvent.change(screen.getByLabelText('目标源版本'), { target: { value: 'policy-1' } })
    expect(screen.getByRole('table', { name: '归因历史列表' })).not.toHaveTextContent('记忆召回策略第二轮')
  })

  it('reads this cycle frozen report separately from mutable experiment metrics and actual release state', () => {
    const state = createInitialEvolutionData()
    const recordId = 'evolution-module-path-demo-sop-agent'
    const decisionId = 'decision-experiment-module-path-demo-single'
    const snapshot = structuredClone(state.gateDecisions)
    const experiment = state.experiments.find(item => item.id === 'experiment-module-path-demo-single')!
    experiment.metrics[0].candidateMean = 0.99
    render(<MemoryRouter initialEntries={[`/datasets-evaluations?evolutionRecordId=${recordId}&view=history&decisionId=${decisionId}`]}><QualityProvider><EvolutionProvider initialState={state}><DatasetEvaluationWorkbenchPage /></EvolutionProvider></QualityProvider></MemoryRouter>)
    const drawer = screen.getByRole('dialog', { name: /归因历史详情.*Agent 迭代/ })
    const report = within(drawer).getByRole('region', { name: `冻结准出报告 ${decisionId}` })
    expect(within(report).getByRole('table', { name: `冻结准出指标 ${decisionId}` })).toHaveTextContent('1.60 / 2')
    expect(within(report).getByRole('table', { name: `冻结准出指标 ${decisionId}` })).not.toHaveTextContent('1.98 / 2')
    expect(drawer).toHaveTextContent('发布时间未记录')
    expect(state.gateDecisions).toEqual(snapshot)
  })

  it('opens the selected cycle of a reused dataset and keeps its pending state independent of the passed cycle', () => {
    const { state, old, current, datasetId } = reusedDatasetFixture()
    render(<MemoryRouter initialEntries={['/datasets-evaluations?evolutionScope=records&governanceObject=Skill&skill=skill-ppt-builder&skillVersion=2.5.0&attribution=skill-sop&view=datasets']}><QualityProvider><EvolutionProvider initialState={state}><DatasetEvaluationWorkbenchPage /><Probe /></EvolutionProvider></QualityProvider></MemoryRouter>)
    const table = screen.getByRole('table', { name: '数据集与评测列表' })
    const currentRow = within(table).getByRole('row', { name: new RegExp(current.id) })
    const oldRow = within(table).getByRole('row', { name: new RegExp(`${datasetId}.*${old.id}`) })
    expect(currentRow).toHaveTextContent('尚未进入准出')
    expect(currentRow).not.toHaveTextContent('已准出')
    expect(oldRow).toHaveTextContent('已准出')
    expect(currentRow.getAttribute('data-row-key')).not.toBe(oldRow.getAttribute('data-row-key'))
    fireEvent.click(currentRow)
    const currentDrawer = screen.getByRole('dialog', { name: /数据集详情/ })
    expect(currentDrawer).toHaveTextContent(current.id)
    expect(currentDrawer).toHaveTextContent('尚未关联本轮实验')
    expect(within(currentDrawer).queryByRole('button', { name: 'experiment-module-path-demo-single' })).not.toBeInTheDocument()
    expect(screen.getByTestId('record-location')).toHaveTextContent(`datasetRecordId=${current.id}`)
    fireEvent.click(within(currentDrawer).getByRole('button', { name: '关闭数据集详情' }))
    fireEvent.click(oldRow)
    const oldDrawer = screen.getByRole('dialog', { name: /数据集详情/ })
    fireEvent.click(within(oldDrawer).getByRole('button', { name: 'experiment-module-path-demo-single' }))
    expect(screen.getByRole('dialog', { name: /归因历史详情.*第一轮 SOP 已准出/ })).toBeVisible()
    expect(screen.getByTestId('record-location')).toHaveTextContent(`historyRecordId=${old.id}`)
  })

  it('chooses the cycle that owns the clicked experiment when two reported cycles reuse the same dataset', () => {
    const { state, old, datasetId } = reusedDatasetFixture()
    const original = state.experiments.find(experiment => experiment.id === 'experiment-module-path-demo-single')!
    const experimentId = 'experiment-second-cycle-single'
    const decisionId = 'decision-second-cycle-single'
    const runs = state.experimentRuns.filter(run => run.experimentId === original.id).map(run => ({ ...structuredClone(run), id: `${run.id}-second-cycle`, experimentId }))
    state.experimentRuns.push(...runs)
    const experiment = { ...structuredClone(original), id: experimentId, name: '第二轮 SOP 单能力实验', gateDecisionId: decisionId, runIds: runs.map(run => run.id) }
    state.experiments.push(experiment)
    const decision = structuredClone(state.gateDecisions.find(item => item.id === 'decision-experiment-module-path-demo-single')!)
    decision.id = decisionId; decision.experimentId = experimentId; decision.reportSnapshot.experimentId = experimentId
    decision.reportSnapshot.runSnapshots = structuredClone(runs)
    state.gateDecisions.push(decision)
    state.variants.find(variant => variant.id === experiment.variantIds[0])!.experimentIds.push(experimentId)
    const second: EvolutionRecord = { ...structuredClone(old), id: 'second-reported-cycle', name: '第二轮独立报告', singleExperimentIds: [experimentId], windowExperimentIds: [], decisionIds: [decisionId], releaseIds: [], createdAt: '2026-10-11T10:00:00Z' }
    state.evolutionRecords = [old, second]
    render(<MemoryRouter initialEntries={['/datasets-evaluations?evolutionScope=records&governanceObject=Skill&skill=skill-ppt-builder&skillVersion=2.5.0&attribution=skill-sop&view=datasets']}><QualityProvider><EvolutionProvider initialState={state}><DatasetEvaluationWorkbenchPage /><Probe /></EvolutionProvider></QualityProvider></MemoryRouter>)
    const row = within(screen.getByRole('table', { name: '数据集与评测列表' })).getByRole('row', { name: new RegExp(`${datasetId}.*${second.id}`) })
    fireEvent.click(row)
    fireEvent.click(within(screen.getByRole('dialog', { name: /数据集详情/ })).getByRole('button', { name: experimentId }))
    const history = screen.getByRole('dialog', { name: /归因历史详情.*第二轮独立报告/ })
    expect(history).toHaveTextContent(experimentId)
    expect(history).toHaveTextContent(decisionId)
    expect(within(history).queryByText(/准出报告快照 · decision-experiment-module-path-demo-single/)).not.toBeInTheDocument()
    expect(screen.getByTestId('record-location')).toHaveTextContent(`historyRecordId=${second.id}`)
  })
})
