import type { EvolutionState } from '../domain'
import type { GovernanceTrack } from '../data/skillWorkspace'
import { currentGateDecision } from '../data/skillWorkspace'
import { Button, DataTable, Drawer, SectionHeader, StatusBadge, type Column } from '../../ui'
import { IdLink, KeyValueGrid, type ReferenceTarget } from './ViewPrimitives'
import { Section, dateText } from '../pages/shared'
import { governanceLabel } from '../labels'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'

interface HistoryEvent {
  id: string; at: string; stage: string; description: string; refs: ReferenceTarget[]
}

/** Read-only, version-scoped provenance. No computed stage is written over history. */
export function AttributionHistoryDrawer({ state, track, decisionId, onClose, onNavigateReference, onOpenDataset }: {
  state: EvolutionState; track?: GovernanceTrack; onClose: () => void
  onNavigateReference: (target: ReferenceTarget) => void; onOpenDataset: (id: string) => void; decisionId?: string
}) {
  if (!track) return null
  const cases = state.cases.filter(item => track.caseIds.includes(item.id))
  const attributions = state.attributions.filter(item => track.attributionIds.includes(item.id))
  const findings = state.evaluationFindings.filter(item => track.findingIds.includes(item.id))
  const issues = state.issues.filter(item => track.issueIds.includes(item.id))
  const clusters = state.issueClusters.filter(item => track.clusterIds.includes(item.id))
  const variants = state.variants.filter(item => track.variantIds.includes(item.id))
  const datasets = state.datasets.filter(item => track.datasetIds.includes(item.id))
  const experiments = state.experiments.filter(item => track.experimentIds.includes(item.id))
  const decisions = state.gateDecisions.filter(item => track.gateIds.includes(item.id))
  const releases = state.releases.filter(item => track.releaseIds.includes(item.id))
  const evaluations = [...state.processEvals, ...state.outcomeEvals].filter(item => track.traceIds.includes(item.traceId))
  const moduleScores = state.tracePackages.filter(pkg => track.traceIds.includes(pkg.traceId)).flatMap(pkg => pkg.moduleScores)
  const auditEvents: HistoryEvent[] = state.auditTrail.flatMap((event): HistoryEvent[] => {
    if (event.action === 'UPDATE_CASE' && event.entityType === 'Case' && track.caseIds.includes(event.entityId)) {
      return [{ id: event.id, at: event.at, stage: '人工 Case 确认 / 调整', description: `${event.reason}${event.changes ? ` · ${JSON.stringify(event.changes)}` : ''} · ${event.actor}`, refs: [{ kind: 'case' as const, id: event.entityId }] }]
    }
    if (event.action === 'UPDATE_MODULE_EVALUATION' && event.entityType === 'ModuleEvaluationScore') {
      const score = moduleScores.find(item => item.id === event.entityId)
      if (!score) return []
      const recorded = event.changes ?? {}
      const parts = [score.moduleLabel, event.reason]
      if (typeof recorded.humanScore === 'number') parts.push(`人工评分 ${formatNormalizedScoreOutOfTwo(recorded.humanScore)}`)
      if (typeof recorded.humanStatus === 'string') parts.push(`辅助判定 ${recorded.humanStatus}`)
      if (typeof recorded.humanNote === 'string') parts.push(recorded.humanNote)
      parts.push(event.actor)
      return [{ id: event.id, at: event.at, stage: '人工模块评分修订', description: parts.join(' · '), refs: [{ kind: 'trace' as const, id: score.traceId }, ...score.evidence.rootEvidenceIds.map(id => ({ kind: 'evidence' as const, id }))] }]
    }
    return []
  })
  const events: HistoryEvent[] = [
    ...cases.map(item => ({ id: item.id, at: item.createdAt, stage: '来源任务', description: item.query, refs: [{ kind: 'case' as const, id: item.id }, ...item.traceIds.filter(id => track.traceIds.includes(id)).map(id => ({ kind: 'trace' as const, id }))] })),
    ...evaluations.flatMap(item => item.revisions.map(revision => ({ id: revision.id, at: revision.evaluatedAt, stage: revision.source === 'HUMAN' ? '人工评测修订' : item.type === 'PROCESS' ? '过程评测' : '产物评测', description: `${item.dimension} · ${formatLegacyScoreOutOfTwo(revision.score, '未评分')} · ${revision.reason}`, refs: [{ kind: item.type === 'PROCESS' ? 'process-eval' as const : 'outcome-eval' as const, id: item.id }, ...revision.evidenceIds.map(id => ({ kind: 'evidence' as const, id }))] }))),
    ...attributions.flatMap(item => item.revisions.map(revision => ({ id: revision.id, at: revision.revisedAt, stage: revision.source === 'HUMAN' ? '人工归因确认 / 修订' : '自动归因', description: `${revision.dimension} · ${revision.reason} · ${revision.revisedBy}`, refs: [{ kind: 'attribution' as const, id: item.id }] }))),
    ...issues.map(item => ({ id: item.id, at: item.updatedAt, stage: '问题分流与处理', description: `${governanceLabel(item.optimizationMode)} · ${item.routingLabels.join(' / ')} · ${item.description}`, refs: [{ kind: 'issue' as const, id: item.id }] })),
    ...clusters.map(item => ({ id: item.id, at: item.updatedAt, stage: '问题聚类', description: `${item.name} · ${item.currentCount} 条相关数据 · ${item.countingRule}`, refs: [{ kind: 'cluster' as const, id: item.id }] })),
    ...datasets.map(item => ({ id: item.id, at: item.updatedAt, stage: '数据集版本快照', description: `${item.name} ${item.version} · ${item.purpose} · ${item.frozen ? '已冻结' : '积累中'} · ${item.sampleCount} 个 Case`, refs: [{ kind: 'dataset' as const, id: item.id }] })),
    ...variants.map(item => ({ id: item.id, at: item.createdAt, stage: '候选修改', description: `${item.currentVersion} → ${item.candidateVersion} · ${item.changeSummary}`, refs: [{ kind: 'variant' as const, id: item.id }] })),
    ...experiments.map(item => ({ id: item.id, at: item.updatedAt, stage: item.level === 'SINGLE_VARIANT' ? '单能力实验' : '窗口组合实验', description: `${item.name} · ${governanceLabel(item.status)} · ${item.baselineVersion} → ${item.candidateVersion}`, refs: [{ kind: 'experiment' as const, id: item.id }] })),
    ...decisions.map(item => ({ id: item.id, at: item.decidedAt, stage: '准出决策', description: `${item.conclusion === 'PASS' ? '准出' : item.conclusion === 'REJECT' ? '拒绝' : '人工复核'} · ${item.reason} · ${item.decidedBy}`, refs: [{ kind: 'decision' as const, id: item.id }] })),
    ...releases.map(item => ({ id: item.id, at: item.releasedAt ?? item.updatedAt, stage: '发布 / 观察 / 回滚', description: `${item.version} · ${governanceLabel(item.status)} · ${item.rollbackReason ?? '未执行回滚'}`, refs: [{ kind: 'release' as const, id: item.id }, ...(item.rollbackVersionId ? [{ kind: 'release' as const, id: item.rollbackVersionId }] : [])] })),
    ...auditEvents
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
  const distinctEvents = [...new Map(events.map(event => [event.id, event])).values()]
  const metricColumns: Column<EvolutionState['experiments'][number]['metrics'][number]>[] = [
    { key: 'label', header: '指标', accessor: row => `${row.label} · ${row.category === 'LOCAL' ? '局部' : row.category === 'END_TO_END' ? '端到端' : '泛化'}` },
    { key: 'baseline', header: 'Baseline', accessor: row => row.unit === 'score' ? formatLegacyScoreOutOfTwo(row.baselineMean) : `${row.baselineMean} ${row.unit}` },
    { key: 'candidate', header: 'Candidate', accessor: row => row.unit === 'score' ? formatLegacyScoreOutOfTwo(row.candidateMean) : `${row.candidateMean} ${row.unit}` },
    { key: 'variance', header: '波动（标准差）', accessor: row => `${row.baselineStdDev} / ${row.candidateStdDev}` }
  ]
  return <Drawer open width="max-w-5xl" title={`归因历史详情 · ${track.title}`} closeLabel="关闭归因历史" onClose={onClose} description={track.key}>
    <div className="space-y-5">
      <Section><SectionHeader title="固定版本治理对象" actions={<StatusBadge status={track.stateLabel} label={track.stateLabel} showIcon={false} tone={track.active ? 'warn' : 'neutral'} />} /><KeyValueGrid className="mt-3" items={[{ label: 'Skill ID', value: track.skillId }, { label: '固定版本', value: track.skillVersion }, { label: '归因对象', value: track.objectLabel }, { label: '归因（PRD 原文）', value: track.definition.label }, { label: '优化维度', value: track.definition.optimization }, { label: '优化条件', value: track.definition.condition }]} /></Section>
      <Section><SectionHeader title="归因与证据" description="Judge Reason、根证据和 Rubric 保持关联；可在对应 Case / Trace 查看完整执行记录。" /><div className="mt-3 space-y-3">{findings.map(finding => <div key={finding.id} className="rounded-md border border-line p-3"><IdLink id={finding.id} kind="finding" onOpen={onNavigateReference} /><p className="mt-2 text-xs leading-5">{finding.description}</p><p className="mt-2 text-[11px] text-muted">Rubric：{finding.evidenceBundle.rubricRule}</p><div className="mt-2 flex flex-wrap gap-2">{finding.evidenceBundle.rootEvidenceIds.map(id => <IdLink key={id} id={id} kind="evidence" onOpen={onNavigateReference} />)}{finding.evidenceBundle.logIds.map(id => <IdLink key={id} id={id} kind="log" onOpen={onNavigateReference} />)}</div></div>)}{!findings.length && <p className="text-xs text-muted">当前目标未关联独立 Finding；历史评测与归因修订保留在下面时间线，不自动补造证据。</p>}</div></Section>
      <Section><SectionHeader title="完整历史时间线" description="按记录时间排序，保留旧评测、修订、决策和发布；未发生的阶段不显示为已完成。" /><ol className="mt-4 space-y-4 border-l border-line pl-4">{distinctEvents.map(event => <li key={event.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-slate-300 bg-white" /><p className="text-xs font-semibold">{event.stage} <span className="ml-2 text-[10px] font-normal text-muted">{dateText(event.at)}</span></p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted">{event.description}</p><div className="mt-2 flex flex-wrap gap-2">{event.refs.map(reference => <IdLink key={`${reference.kind}-${reference.id}`} {...reference} onOpen={onNavigateReference} />)}</div></li>)}</ol>{!distinctEvents.length && <p className="mt-3 text-xs text-muted">该归因暂无已记录事件。</p>}</Section>
      <Section><SectionHeader title="测试集版本" /><div className="mt-3 space-y-2">{datasets.map(dataset => <div key={dataset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-xs"><div><p>{dataset.name} · {dataset.version}</p><p className="mt-1 text-[10px] text-muted">{dataset.purpose} · {dataset.frozen ? '已冻结' : '积累中'} · {dataset.sampleCount} 个 Case</p></div><Button variant="ghost" onClick={() => onOpenDataset(dataset.id)}>查看样本 Trace</Button></div>)}{!datasets.length && <p className="text-xs text-muted">尚未建立对应固定版本的测试集。</p>}</div></Section>
      <Section><SectionHeader title="准出报告快照" description="每次决策的冻结报告独立保留；以下只读取当时快照，不借用当前实验台账补齐。" /><div className="mt-3 space-y-3">
        {decisions.map(decision => {
          const snapshot = decision.reportSnapshot
          const config = snapshot?.configSnapshot
          return <details key={decision.id} open={decision.id === decisionId} className="min-w-0 rounded-md border border-line p-3">
            <summary className="cursor-pointer text-xs font-semibold text-accent">准出报告快照 · {decision.id} · {dateText(decision.decidedAt)}</summary>
            <section aria-label={`冻结准出报告 ${decision.id}`} className="mt-4 min-w-0 space-y-4">
              <KeyValueGrid items={[{ label: '历史决策', value: `${decision.conclusion === 'PASS' ? '准出' : decision.conclusion === 'REJECT' ? '拒绝' : '人工复核'} · ${decision.reason}` }, { label: '决策人 / 时间', value: `${decision.decidedBy} · ${dateText(decision.decidedAt)}` }, { label: '冻结实验 ID', value: snapshot?.experimentId ?? '未记录' }]} />
              <div><p className="text-xs font-semibold">冻结配置</p>{config ? <KeyValueGrid className="mt-3" items={[{ label: '模型 / 运行环境', value: `${config.model ?? '未记录'} / ${config.runEnvironment ?? '未记录'}` }, { label: '重复次数 / 超时', value: `${config.repeatCount ?? '未记录'} 次 / ${config.timeoutMs ?? '未记录'} ms` }, { label: '工具权限', value: config.toolPermissions?.join('、') || '未记录' }, { label: 'Eval Agent / Rubric', value: `${config.evalAgentVersion ?? '未记录'} / ${config.rubricVersion ?? '未记录'}` }, { label: '配置冻结时间', value: config.createdAt ? dateText(config.createdAt) : '未记录' }]} /> : <p className="mt-2 text-xs text-muted">配置快照未记录</p>}</div>
              <div><p className="text-xs font-semibold">冻结数据集版本</p><div className="mt-2 space-y-1 text-xs">{snapshot?.datasetVersions?.length ? snapshot.datasetVersions.map((dataset, index) => <p key={`${dataset.datasetId}@${dataset.version}-${index}`}>{dataset.datasetId} @ {dataset.version}</p>) : <p className="text-muted">冻结数据集版本未记录</p>}</div></div>
              <div><p className="text-xs font-semibold">冻结评测指标</p>{snapshot?.metricResults?.length ? <DataTable className="mt-3" caption={`冻结准出指标 ${decision.id}`} rows={snapshot.metricResults} columns={metricColumns} rowKey={row => row.key} /> : <p className="mt-2 text-xs text-muted">冻结评测指标未记录</p>}</div>
              <div><p className="text-xs font-semibold">冻结运行记录</p><div className="mt-2 space-y-2">{snapshot?.runSnapshots ? snapshot.runSnapshots.length ? snapshot.runSnapshots.map(run => <div key={run.id} className="rounded border border-line p-2 text-[11px]"><p>{run.id} · {run.arm} · 第 {run.repetition} 次 · {governanceLabel(run.status)}</p><p className="mt-1">过程 {formatLegacyScoreOutOfTwo(run.processScore, '未记录')} · 产物 {formatLegacyScoreOutOfTwo(run.outcomeScore, '未记录')} · {run.durationMs} ms</p><div className="mt-2"><IdLink id={run.caseId} kind="case" onOpen={onNavigateReference} /></div></div>) : <p className="text-xs text-muted">冻结运行记录 0 条</p> : <p className="text-xs text-muted">运行快照未记录</p>}</div></div>
              <KeyValueGrid items={[{ label: '冻结风险记录', value: snapshot?.knownRisks ? snapshot.knownRisks.join('；') || '无已记录风险' : '未记录' }, { label: '冻结回退项', value: snapshot?.rollbackItems ? snapshot.rollbackItems.join('；') || '无已记录回退项' : '未记录' }]} />
              <div><p className="text-xs font-semibold">冻结失败 Case</p><div className="mt-2 flex flex-wrap gap-2">{snapshot?.failedCaseIds ? snapshot.failedCaseIds.length ? snapshot.failedCaseIds.map(id => <IdLink key={id} id={id} kind="case" onOpen={onNavigateReference} />) : <span className="text-xs text-muted">0 条失败 Case</span> : <span className="text-xs text-muted">未记录</span>}</div></div>
              <div><p className="text-xs font-semibold">冻结变体 / Evidence</p><div className="mt-2 flex flex-wrap gap-2">{snapshot?.variantIds?.map(id => <IdLink key={id} id={id} kind="variant" onOpen={onNavigateReference} />)}{snapshot?.evidenceIds?.map(id => <IdLink key={id} id={id} kind="evidence" onOpen={onNavigateReference} />)}{!snapshot?.variantIds?.length && <span className="text-xs text-muted">变体未记录</span>}{snapshot?.evidenceIds === undefined && <span className="text-xs text-muted">Evidence 未记录</span>}</div></div>
            </section>
          </details>
        })}
        {!decisions.length && <p className="text-xs text-muted">尚未记录准出决策，不制造报告快照。</p>}
      </div></Section>
      {experiments.length > 0 && <SectionHeader title="当前实验台账" description="当前运行配置与最新实验结果；与上面的冻结准出报告分开查看。" />}
      {experiments.map(experiment => { const decision = currentGateDecision(state, experiment); const runs = state.experimentRuns.filter(run => run.experimentId === experiment.id); return <Section key={experiment.id}><SectionHeader title={experiment.level === 'SINGLE_VARIANT' ? '单能力实验配置与结果' : '窗口组合实验配置与结果'} description={experiment.name} /><p className="mt-2 break-all font-mono text-[11px] text-accent">{experiment.id}</p><KeyValueGrid className="mt-3" items={[{ label: 'Baseline', value: experiment.baselineVersion }, { label: 'Candidate', value: experiment.candidateVersion }, { label: '状态', value: governanceLabel(experiment.status) }, { label: '每 Case 重复次数', value: experiment.configSnapshot.repeatCount }, { label: '模型 / 运行环境', value: `${experiment.configSnapshot.model} / ${experiment.configSnapshot.runEnvironment}` }, { label: 'Tool 权限 / 超时', value: `${experiment.configSnapshot.toolPermissions.join(', ')} / ${experiment.configSnapshot.timeoutMs} ms` }, { label: 'Eval Agent / Rubric', value: `${experiment.configSnapshot.evalAgentVersion ?? '未记录'} / ${experiment.configSnapshot.rubricVersion ?? '未记录'}` }, { label: '当前准出结论', value: decision ? `${decision.conclusion === 'PASS' ? '准出' : decision.conclusion === 'REJECT' ? '拒绝' : '人工复核'} · ${decision.reason}` : '待决策 · 门禁待配置' }]} /><div className="mt-3 space-y-1 text-[11px] text-muted">{experiment.configSnapshot.datasetVersions.map(dataset => <p key={dataset.versionId}>{dataset.datasetId} @ {dataset.version} · {dataset.sampleCount} 个样本</p>)}</div>{experiment.metrics.length > 0 ? <DataTable className="mt-3" caption={`实验指标 ${experiment.id}`} rows={experiment.metrics} columns={metricColumns} rowKey={row => row.key} /> : <p className="mt-3 rounded bg-slate-50 p-3 text-xs text-muted">实验未完成，暂无评测指标，不推断通过。</p>}<p className="mt-3 text-[11px] text-muted">实际运行记录 {runs.length} 条 · 失败 Case {experiment.failedCaseIds.length} 条</p><p className="mt-2 text-xs leading-5">已知风险：{experiment.knownRisks.join('；') || '无已记录风险'}<br />回退项：{experiment.rollbackItems.join('；') || '未记录'}</p><div className="mt-3 flex flex-wrap gap-2">{experiment.failedCaseIds.map(id => <IdLink key={id} id={id} kind="case" onOpen={onNavigateReference} />)}{experiment.variantIds.map(id => <IdLink key={id} id={id} kind="variant" onOpen={onNavigateReference} />)}</div>{runs.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs text-accent">查看重复运行记录</summary><div className="mt-2 space-y-2">{runs.map(run => <div key={run.id} className="rounded border border-line p-2 text-[11px]"><p>{run.arm} · 第 {run.repetition} 次 · {governanceLabel(run.status)}</p><p className="mt-1">过程 {formatLegacyScoreOutOfTwo(run.processScore)} · 产物 {formatLegacyScoreOutOfTwo(run.outcomeScore)} · {run.durationMs} ms</p><IdLink id={run.caseId} kind="case" onOpen={onNavigateReference} /></div>)}</div></details>}</Section> })}
      {!experiments.length && <Section><SectionHeader title="实验与准出" /><p className="mt-3 text-xs text-muted">尚无实验记录；数据积累或修复计划仍在进行，不代表已准出。</p></Section>}
    </div>
  </Drawer>
}
