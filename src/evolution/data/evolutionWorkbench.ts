import type { EvolutionRecord, EvolutionState, EvolutionTargetIdentity } from '../domain'
import { GOVERNANCE_OBJECTS, governanceItemLabel, governanceItemsFor, type GovernanceObjectId } from '../governanceTaxonomy'
import { evolutionItemId } from '../taxonomy'
import { currentGateDecision, normalizeSkillVersion } from './skillWorkspace'
import { datasetRows, type DatasetWorkbenchRow } from './traceDataset'
import { selectEvolutionRecord } from './moduleEvolution'

export interface EvolutionWorkbenchScope {
  evolutionRecordId?: string; governanceObject?: GovernanceObjectId | ''; targetId?: string; targetVersion?: string
  skillId?: string; skillVersion?: string; skillCategory?: string; attribution?: string; optimizationMode?: string; query?: string
}
export interface EvolutionDatasetRow extends DatasetWorkbenchRow {
  key: string; evolutionRecords: EvolutionRecord[]; evolutionTargets: EvolutionTargetIdentity[]
}
export const targetIdentityId = (target: EvolutionTargetIdentity) => target.kind === 'SKILL' ? target.skillId : target.targetId
export const targetIdentityVersion = (target: EvolutionTargetIdentity) => target.kind === 'SKILL' ? target.skillVersion : target.targetVersion
export function evolutionTargetLabel(state: EvolutionState, target: EvolutionTargetIdentity): string {
  return target.kind === 'SKILL'
    ? state.skills.find(skill => skill.id === target.skillId)?.name ?? target.skillId
    : `${GOVERNANCE_OBJECTS.find(object => object.id === target.governanceObject)?.label ?? target.governanceObject} · ${target.targetId}`
}
export function evolutionRecordAttributionLabel(record: EvolutionRecord): string {
  return governanceItemLabel(governanceItemsFor(record.target.governanceObject).find(item => item.id === record.target.attributionId))
}
export function evolutionRecordMatchesScope(record: EvolutionRecord, scope: EvolutionWorkbenchScope): boolean {
  const target = record.target
  const version = targetIdentityVersion(target)
  const attribution = scope.attribution ? evolutionItemId(scope.attribution) ?? scope.attribution : undefined
  const optimization = scope.optimizationMode === '直接优化' ? 'DIRECT_FIX' : scope.optimizationMode === '聚类优化' ? 'CLUSTER_OPTIMIZATION' : scope.optimizationMode
  return (!scope.evolutionRecordId || record.id === scope.evolutionRecordId)
    && (!scope.governanceObject || target.governanceObject === scope.governanceObject)
    && (!scope.targetId || targetIdentityId(target) === scope.targetId)
    && (!scope.targetVersion || (target.kind === 'SKILL' ? normalizeSkillVersion(version) === normalizeSkillVersion(scope.targetVersion) : version === scope.targetVersion))
    && (!scope.skillId || (target.kind === 'SKILL' && target.skillId === scope.skillId))
    && (!scope.skillVersion || (target.kind === 'SKILL' && normalizeSkillVersion(target.skillVersion) === normalizeSkillVersion(scope.skillVersion)))
    && (!attribution || target.attributionId === attribution)
    && (!optimization || (optimization === '待配置' ? !record.optimizationMode : record.optimizationMode === optimization))
}
export function filterEvolutionRecords(state: EvolutionState, scope: EvolutionWorkbenchScope = {}): EvolutionRecord[] {
  return (state.evolutionRecords ?? []).filter(record => evolutionRecordMatchesScope(record, scope)
    && (!scope.skillCategory || (record.target.kind === 'SKILL' && state.skills.find(skill => skill.id === targetIdentityId(record.target))?.category === scope.skillCategory))
    && (!scope.query?.trim() || [record.id, record.name, evolutionTargetLabel(state, record.target), targetIdentityVersion(record.target), evolutionRecordAttributionLabel(record)].join(' ').toLocaleLowerCase().includes(scope.query.trim().toLocaleLowerCase())))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

/** Explicit cycle assets never inherit global dataset status or unrelated gates. */
export function evolutionDatasetRows(state: EvolutionState, records: EvolutionRecord[]): EvolutionDatasetRow[] {
  const legacy = datasetRows(state)
  const selections = records.flatMap(record => selectEvolutionRecord(state, record.id) ?? [])
  // Reused datasets remain separate assets in each evolution cycle. A previous
  // cycle's PASS must never become the latest cycle's status in a broad view.
  return selections.flatMap(selection => selection.datasets.map(dataset => {
    const experiments = selection.experiments.filter(experiment => experiment.datasetIds.includes(dataset.id))
    const allowedDecisions = new Set(selection.decisions.map(decision => decision.id))
    const decisions = experiments.flatMap(experiment => { const decision = currentGateDecision(state, experiment); return decision && allowedDecisions.has(decision.id) ? [decision] : [] })
    const gateLabels = [...new Set(decisions.map(decision => decision.conclusion === 'PASS' ? '已准出' : decision.conclusion === 'REJECT' ? '不准出' : '人工复核'))]
    const base = legacy.find(row => row.dataset.id === dataset.id)!
    const hasResults = experiments.some(experiment => experiment.metrics.length > 0 || state.experimentRuns.some(run => run.experimentId === experiment.id && run.status === 'COMPLETED'))
    return {
      ...base, key: JSON.stringify([selection.record.id, dataset.id]), targets: [], evolutionRecords: [selection.record], evolutionTargets: [selection.record.target],
      experimentIds: experiments.map(experiment => experiment.id), decisionIds: decisions.map(decision => decision.id),
      experimentType: [...new Set(experiments.map(experiment => experiment.level === 'WINDOW_COMBINATION' ? '窗口版本实验' : '单能力变体实验'))].join(' / ') || '尚未关联实验',
      gate: gateLabels.join(' / ') || (experiments.length ? '待决策' : '尚未进入准出'),
      evaluationResult: experiments.some(experiment => experiment.status === 'RUNNING') ? '评测中' : experiments.some(experiment => experiment.status === 'FAILED') ? '评测失败' : hasResults ? '已有评测结果' : experiments.length ? '待运行' : '尚未关联实验'
    }
  }))
}
