import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialEvolutionData } from '../data'
import { governanceTracks } from '../data/skillWorkspace'
import { evolutionReducer } from '../store'
import { AttributionHistoryDrawer } from './AttributionHistoryDrawer'

describe('immutable attribution history audit trail', () => {
  it('shows each real Case confirmation and module override audit while keeping earlier evidence and experiment snapshots', () => {
    let state = createInitialEvolutionData()
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.6.0', attribution: 'skill-sop' })[0]
    const caseId = track.caseIds[0]
    const pkg = state.tracePackages.find(item => track.traceIds.includes(item.traceId))!
    const score = pkg.moduleScores.find(item => item.moduleCode === 'SKILL')!
    const before = JSON.stringify(state.experiments.filter(experiment => track.experimentIds.includes(experiment.id)).map(experiment => experiment.configSnapshot))
    state = evolutionReducer(state, { type: 'UPDATE_CASE', caseId, patch: { status: 'CONFIRMED', resultStatus: 'PASS' }, meta: { actor: '复核员甲', reason: '首轮 Case 确认', at: '2026-10-11T12:00:00Z', auditId: 'audit-history-case' } })
    state = evolutionReducer(state, { type: 'UPDATE_MODULE_EVALUATION', packageId: pkg.id, scoreId: score.id, patch: { humanScore: 0.5, humanStatus: 'FAIL', humanNote: '首轮人工评分理由' }, meta: { actor: '复核员甲', reason: '第一次人工模块复核', at: '2026-10-11T12:01:00Z', auditId: 'audit-history-module-1' } })
    state = evolutionReducer(state, { type: 'UPDATE_MODULE_EVALUATION', packageId: pkg.id, scoreId: score.id, patch: { humanScore: 1.5, humanStatus: 'PASS', humanNote: '第二轮人工评分理由' }, meta: { actor: '复核员乙', reason: '第二次人工模块复核', at: '2026-10-11T12:02:00Z', auditId: 'audit-history-module-2' } })
    const unrelatedCaseId = state.cases.find(item => !track.caseIds.includes(item.id))!.id
    state = evolutionReducer(state, { type: 'UPDATE_CASE', caseId: unrelatedCaseId, patch: { status: 'CONFIRMED' }, meta: { actor: '其他复核员', reason: '不属于当前固定版本的确认', at: '2026-10-11T12:03:00Z', auditId: 'audit-history-unrelated' } })
    render(<AttributionHistoryDrawer state={state} track={track} onClose={vi.fn()} onNavigateReference={vi.fn()} onOpenDataset={vi.fn()} />)
    const drawer = screen.getByRole('dialog', { name: `归因历史详情 · ${track.title}` })
    expect(within(drawer).getByText(/首轮 Case 确认/)).toBeVisible()
    const first = within(drawer).getByText(/第一次人工模块复核/).closest('li')!
    const second = within(drawer).getByText(/第二次人工模块复核/).closest('li')!
    expect(first).toHaveTextContent('0.50 / 2')
    expect(first).toHaveTextContent('首轮人工评分理由')
    expect(second).toHaveTextContent('1.50 / 2')
    expect(second).toHaveTextContent('第二轮人工评分理由')
    expect(within(drawer).queryByText(/不属于当前固定版本的确认/)).not.toBeInTheDocument()
    expect(within(first).getByRole('button', { name: score.evidence.rootEvidenceIds[0] })).toBeVisible()
    expect(JSON.stringify(state.experiments.filter(experiment => track.experimentIds.includes(experiment.id)).map(experiment => experiment.configSnapshot))).toBe(before)
  })
  it('does not invent manual audit events when no Case or module audit exists', () => {
    const state = createInitialEvolutionData()
    state.auditTrail = []
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.6.0', attribution: 'skill-sop' })[0]
    render(<AttributionHistoryDrawer state={state} track={track} onClose={vi.fn()} onNavigateReference={vi.fn()} onOpenDataset={vi.fn()} />)
    expect(screen.queryByText('人工 Case 确认 / 调整')).not.toBeInTheDocument()
    expect(screen.queryByText('人工模块评分修订')).not.toBeInTheDocument()
  })
  it('opens the exact historical gate report using frozen values even when the current experiment has diverged', () => {
    const state = createInitialEvolutionData()
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })[0]
    const experiment = state.experiments.find(item => item.id === track.experimentIds[0])!
    const existing = state.gateDecisions.find(item => track.gateIds.includes(item.id))!
    const originalRun = state.experimentRuns[0]
    const gate = { ...existing, id: 'gate-frozen-target', experimentId: experiment.id, reason: 'FROZEN_DECISION_REASON', reportSnapshot: {
      experimentId: experiment.id, variantIds: ['variant-frozen'], datasetVersions: [{ datasetId: 'dataset-frozen', version: 'v-frozen' }],
      metricResults: [{ ...experiment.metrics[0], label: 'FROZEN_METRIC', baselineMean: 0.55, candidateMean: 0.85 }],
      configSnapshot: { ...experiment.configSnapshot, model: 'FROZEN_MODEL', toolPermissions: ['FROZEN_PERMISSION'], repeatCount: 7, timeoutMs: 70000, runEnvironment: 'FROZEN_ENV', evalAgentVersion: 'FROZEN_JUDGE', rubricVersion: 'FROZEN_RUBRIC' },
      runSnapshots: [{ ...originalRun, id: 'run-frozen', caseId: 'case-frozen', processScore: 0.4, outcomeScore: 0.6 }], failedCaseIds: ['case-frozen-failed'], knownRisks: ['FROZEN_RISK'], rollbackItems: ['FROZEN_ROLLBACK'], evidenceIds: ['evidence-frozen']
    } }
    const otherGate = { ...gate, id: 'gate-other-snapshot', reason: 'OTHER_FROZEN_REASON' }
    state.gateDecisions = [otherGate, gate]
    track.gateIds = [otherGate.id, gate.id]
    experiment.configSnapshot = { ...experiment.configSnapshot, model: 'CURRENT_MODEL', repeatCount: 3 }
    experiment.metrics = [{ ...experiment.metrics[0], label: 'CURRENT_METRIC', candidateMean: 0.1 }]
    experiment.knownRisks = ['CURRENT_RISK']; experiment.rollbackItems = ['CURRENT_ROLLBACK']; experiment.gateDecisionId = otherGate.id
    render(<AttributionHistoryDrawer state={state} track={track} decisionId={gate.id} onClose={vi.fn()} onNavigateReference={vi.fn()} onOpenDataset={vi.fn()} />)
    const report = screen.getByLabelText(`冻结准出报告 ${gate.id}`)
    expect(report.closest('details')).toHaveAttribute('open')
    expect(screen.getByLabelText(`冻结准出报告 ${otherGate.id}`).closest('details')).not.toHaveAttribute('open')
    expect(report).toHaveTextContent('FROZEN_MODEL')
    expect(report).toHaveTextContent('FROZEN_PERMISSION')
    expect(report).toHaveTextContent('FROZEN_ENV')
    expect(report).toHaveTextContent('FROZEN_JUDGE')
    expect(report).toHaveTextContent('FROZEN_RUBRIC')
    expect(report).toHaveTextContent('FROZEN_METRIC')
    expect(report).toHaveTextContent('1.70 / 2')
    expect(report).toHaveTextContent('dataset-frozen @ v-frozen')
    expect(report).toHaveTextContent('case-frozen')
    expect(report).toHaveTextContent('case-frozen-failed')
    expect(report).toHaveTextContent('FROZEN_RISK')
    expect(report).toHaveTextContent('FROZEN_ROLLBACK')
    expect(report).toHaveTextContent('variant-frozen')
    expect(report).toHaveTextContent('evidence-frozen')
    expect(report).not.toHaveTextContent('CURRENT_MODEL')
    expect(report).not.toHaveTextContent('CURRENT_RISK')
    expect(screen.getByText(/CURRENT_MODEL/)).toBeVisible()
    expect(screen.getByText(/CURRENT_RISK/)).toBeVisible()
  })
  it('marks missing frozen configuration as unrecorded instead of borrowing current conditions', () => {
    const state = createInitialEvolutionData()
    const track = governanceTracks(state, { skillId: 'skill-ppt-builder', skillVersion: '2.5.0', attribution: 'skill-sop' })[0]
    const gate = state.gateDecisions.find(item => track.gateIds.includes(item.id))!
    gate.reportSnapshot = { experimentId: gate.experimentId, variantIds: [], datasetVersions: [], metricResults: [] }
    state.experiments.find(item => item.id === gate.experimentId)!.configSnapshot.model = 'CURRENT_NOT_FROZEN'
    render(<AttributionHistoryDrawer state={state} track={track} decisionId={gate.id} onClose={vi.fn()} onNavigateReference={vi.fn()} onOpenDataset={vi.fn()} />)
    const report = screen.getByLabelText(`冻结准出报告 ${gate.id}`)
    expect(report).toHaveTextContent('配置快照未记录')
    expect(report).not.toHaveTextContent('CURRENT_NOT_FROZEN')
    expect(report).toHaveTextContent('运行快照未记录')
  })
})
