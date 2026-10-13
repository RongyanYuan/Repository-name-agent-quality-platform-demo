import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TraceGovernanceEvent } from '../domain'
import type { TraceGovernanceHistory } from '../data/traceGovernance'
import { TraceGovernanceTimeline } from './TraceGovernanceTimeline'
import { Drawer } from '../../ui'

const event = (patch: Partial<TraceGovernanceEvent>): TraceGovernanceEvent => ({ id: 'evaluation', traceId: 'trace-1', caseId: 'case-1', branchId: 'trace:trace-1', occurredAt: '2026-10-06T02:03:04Z', recordedAt: '2026-10-06T02:03:04Z', stage: 'EVALUATION', statusCode: 'COMPLETED', actor: '演示系统', description: '评测完成', origin: 'MOCK', relationType: 'TRACE_SOURCE', targetRefs: [], ...patch })
const history = (): TraceGovernanceHistory => {
  const completed = event({}), failed = event({ id: 'failed', stage: 'DIRECT_FIX', statusCode: 'FAILED', branchId: 'agent', occurredAt: '2026-10-08T02:03:04Z', description: 'Agent 修复验证失败', parentEventIds: ['evaluation'], targetRefs: [{ kind: 'issue', id: 'issue-1' }] }), pending = event({ id: 'pending', stage: 'ROUTING', statusCode: 'PENDING', branchId: 'algorithm', occurredAt: '2026-10-07T01:02:03Z', description: '算法 Badcase 等待接收', parentEventIds: ['evaluation'], targetRefs: [{ kind: 'finding', id: 'finding-2' }] })
  return { events: [completed, failed, pending, event({ id: 'unknown', stage: 'DATASET', occurredAt: undefined, description: '加入时间未记录', relationType: 'CASE_SHARED', targetRefs: [{ kind: 'dataset', id: 'dataset-1' }] })], branches: [{ id: 'trace:trace-1', label: '任务与评测', currentEvent: completed }, { id: 'agent', label: 'Agent 迭代', currentEvent: failed }, { id: 'algorithm', label: '策略迭代', currentEvent: pending }], memberships: [{ id: 'member', datasetId: 'dataset-1', datasetVersion: 'v2', caseId: 'case-1', traceIds: [], scope: 'CASE_SHARED', actor: '旧系统', origin: 'LEGACY', name: '季度原始归因集', purpose: '原始归因集', frozen: true, source: '历史导入', experimentIds: ['experiment-1'], relationType: 'CASE_SHARED' }], currentLabel: '修复失败 / 策略待接收', lastOccurredAt: '2026-10-08T02:03:04Z' }
}

describe('TraceGovernanceTimeline', () => {
  it('highlights only the explicitly selected path while retaining other branches',()=>{
    render(<TraceGovernanceTimeline history={history()} focusObjectIds={['finding-2']}/>)
    const graph=screen.getByRole('region',{name:'治理时间分支图'})
    expect(within(graph).getByRole('button',{name:/分流.*算法 Badcase 等待接收/})).toHaveAttribute('data-path-focused','true')
    expect(within(graph).getByRole('button',{name:/直接修复.*Agent 修复验证失败/})).toHaveAttribute('data-path-focused','false')
  })
  it('uses a horizontal time graph with accessible branch states and actual Shanghai timestamps, keeping undated events outside', async () => {
    const user = userEvent.setup()
    render(<TraceGovernanceTimeline history={history()} />)
    const graph = screen.getByRole('region', { name: '治理时间分支图' })
    expect(within(graph).getByRole('button', { name: /直接修复.*Agent 修复验证失败/ })).toHaveAttribute('data-current', 'true')
    expect(within(graph).getByRole('button', { name: /分流.*算法 Badcase 等待接收/ })).toHaveAttribute('data-current', 'true')
    expect(within(graph).queryByText('加入时间未记录')).not.toBeInTheDocument()
    expect(graph.querySelectorAll('[data-edge-from="evaluation"]')).toHaveLength(2)
    expect(screen.queryByRole('region', { name: '治理事件历史' })).not.toBeInTheDocument()
    await user.click(within(graph).getByRole('button', { name: /直接修复.*Agent 修复验证失败/ }))
    expect(screen.getByRole('dialog', { name: '直接修复 · 节点详情' })).toHaveTextContent('2026-10-08 10:03:04 GMT+8')
  })
  it('opens dataset metadata, unknown enrollment time, exact object links and validation context without implying resolution', async () => {
    const user = userEvent.setup(), onNavigateReference = vi.fn()
    const value = history()
    value.events.push(event({ id: 'validation', stage: 'GATE', occurredAt: '2026-10-10T00:00:00Z', relationType: 'VALIDATION', branchId: 'validation', description: '用于回归验证', targetRefs: [{ kind: 'decision', id: 'decision-1' }], parentEventIds: ['evaluation'] }))
    render(<TraceGovernanceTimeline history={value} onNavigateReference={onNavigateReference} />)
    const graph = screen.getByRole('region', { name: '治理时间分支图' })
    const validation = within(graph).getByRole('button', { name: /准出.*用于回归验证/ })
    expect(validation).toHaveAttribute('data-current', 'false')
    expect(graph.querySelector('[data-edge-to="validation"]')).toHaveAttribute('stroke-dasharray', '6 5')
    await user.click(within(screen.getByRole('region', { name: '时间未记录的关联' })).getByRole('button', { name: /加入数据集/ }))
    const drawer = screen.getByRole('dialog', { name: '加入数据集 · 节点详情' })
    expect(drawer).toHaveTextContent('季度原始归因集')
    expect(drawer).toHaveTextContent('v2')
    expect(drawer).toHaveTextContent('原始归因集')
    expect(drawer).toHaveTextContent('已冻结')
    expect(drawer).toHaveTextContent('Case 共享归属')
    expect(drawer).toHaveTextContent('加入时间未记录')
    await user.click(within(drawer).getByRole('button', { name: /experiment-1/ }))
    expect(onNavigateReference).toHaveBeenLastCalledWith({ kind: 'experiment', id: 'experiment-1' })
  })
  it('zooms actual time coordinates and fits the graph without changing the recorded events', async () => {
    const user = userEvent.setup(), value = history()
    render(<TraceGovernanceTimeline history={value} />)
    const graph = screen.getByRole('region', { name: '治理时间分支图' })
    const node = within(graph).getByRole('button', { name: /直接修复.*Agent 修复验证失败/ })
    const oldX = Number(node.getAttribute('data-time-x'))
    await user.click(screen.getByRole('button', { name: '放大时间轴' }))
    expect(Number(node.getAttribute('data-time-x'))).toBeGreaterThan(oldX)
    await user.click(screen.getByRole('button', { name: '适配全程' }))
    expect(Number(node.getAttribute('data-time-x'))).toBeLessThan(oldX)
    await user.click(screen.getByRole('button', { name: '定位最新节点' }))
    expect(node).toHaveFocus()
    expect(value.events[1].occurredAt).toBe('2026-10-08T02:03:04Z')
  })
  it('keeps selected module review nodes only and shows matching evolution context inside a finding drawer', async () => {
    const user = userEvent.setup(), value = history()
    value.events.push(event({ id: 'review-score-1', stage: 'REVIEW', description: '模块 score-1 · 1.25 / 2 · 首次复核' }), event({ id: 'review-score-2', stage: 'REVIEW', description: '模块 score-2 · 0.00 / 2 · 其他模块复核' }))
    value.reviewModuleIds = { 'review-score-1': 'score-1', 'review-score-2': 'score-2' }
    render(<TraceGovernanceTimeline history={value} moduleScoreId="score-1" evaluationScenarios={[{ label: '品味偏好', dimension: '品味库召回错误', path: '品味迭代 → 原始归因集', findingId: 'finding-2' }]} tastePreference={{ preferenceCount: 950, populationTotal: 1000, preferenceValue: '红色', preferenceRate: 0.95, relatedDataCount: 1000, relatedDataThreshold: 100, judgeReason: '偏好统计来自 Mock 用户样本', routingLabel: 'Agent 迭代', optimizationPath: '品味迭代' }} />)
    const graph = screen.getByRole('region', { name: '治理时间分支图' })
    expect(within(graph).getByRole('button', { name: /首次复核/ })).toBeInTheDocument()
    expect(within(graph).queryByRole('button', { name: /其他模块复核/ })).not.toBeInTheDocument()
    await user.click(within(graph).getByRole('button', { name: /算法 Badcase/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('950 人 / 1000 人')
    expect(screen.getByRole('dialog')).toHaveTextContent('品味库召回错误')
  })
  it('closes a nested node drawer with Escape while preserving the Case and graph context', async () => {
    const user = userEvent.setup(), onCloseCase = vi.fn()
    render(<Drawer open onClose={onCloseCase} title="Case 详情"><TraceGovernanceTimeline history={history()} /></Drawer>)
    await user.click(within(screen.getByRole('region', { name: '治理时间分支图' })).getByRole('button', { name: /直接修复.*Agent 修复验证失败/ }))
    expect(screen.getByRole('dialog', { name: '直接修复 · 节点详情' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '直接修复 · 节点详情' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Case 详情' })).toBeInTheDocument()
    expect(onCloseCase).not.toHaveBeenCalled()
  })
  it('starts with a compact branch overview and lets users inspect exact events inside a close-time group', async () => {
    const user = userEvent.setup(), value = history()
    value.events.push(event({ id: 'first-review', stage: 'REVIEW', occurredAt: '2026-10-06T02:04:04Z', description: '第一次复核', parentEventIds: ['evaluation'] }), event({ id: 'second-review', stage: 'REVIEW', occurredAt: '2026-10-06T02:05:04Z', description: '第二次复核', parentEventIds: ['first-review'] }))
    render(<TraceGovernanceTimeline history={value} />)
    const graph = screen.getByRole('region', { name: '治理时间分支图' })
    const group = within(graph).getByRole('button', { name: /治理记录组.*第一次复核/ })
    expect(group).toHaveAttribute('data-event-ids', '["evaluation","first-review","second-review"]')
    expect(Number(graph.getAttribute('data-layout-height'))).toBeLessThan(500)
    await user.click(group)
    const chooser = screen.getByRole('dialog', { name: '同一时间段 · 3 个治理节点' })
    expect(chooser).toHaveTextContent('2026-10-06 10:04:04 GMT+8')
    await user.click(within(chooser).getByRole('button', { name: /人工复核.*第二次复核/ }))
    expect(screen.getByRole('dialog', { name: '人工复核 · 节点详情' })).toHaveTextContent('2026-10-06 10:05:04 GMT+8')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '展开全部节点' }))
    expect(within(graph).getByRole('button', { name: /人工复核.*第二次复核/ })).toHaveAttribute('data-event-id', 'second-review')
  })
})
