import { ChevronDown, History, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, DataTable, Drawer, EmptyState, Field, FilterBar, SectionHeader, SelectInput, StatusBadge, type Column } from '../../ui'
import type { Variant } from '../domain'
import { selectVariantWorkbench, selectVariantLineage, type VariantWorkbenchSkillRow } from '../data/selectors'
import { EntityId, IdLink, KeyValueGrid, PageHeading, type ReferenceTarget } from '../components/ViewPrimitives'
import { VariantCreateDialog } from '../components/VariantCreateDialog'
import { governanceLabel, skillCategoryLabel } from '../labels'
import { useScopedEvolution } from '../scope'
import { dateText, Section, useReferenceNavigation } from './shared'

interface Props { onNavigateReference?: (target: ReferenceTarget) => void; initialVariantId?: string; initialSkillId?: string; initialSourceClusterId?: string; initialSourceIssueId?: string }

export function VariantsPage({ onNavigateReference, initialVariantId, initialSkillId, initialSourceClusterId, initialSourceIssueId }: Props) {
  const { state: fullState, scopedState: state, dispatch } = useScopedEvolution()
  const [params, setParams] = useSearchParams()
  const navigation = useReferenceNavigation(onNavigateReference)
  const [selectedId, setSelectedId] = useState(initialVariantId ?? params.get('variantId') ?? undefined)
  const [creator, setCreator] = useState<{ clusterId?: string; issueId?: string } | undefined>(() => {
    const clusterId = initialSourceClusterId ?? params.get('sourceClusterId') ?? undefined
    const issueId = initialSourceIssueId ?? params.get('sourceIssueId') ?? undefined
    return clusterId || issueId ? { clusterId, issueId } : undefined
  })
  const workbench = selectVariantWorkbench(state)
  const query = params.get('variantQuery') ?? ''
  const skillFilter = params.get('variantSkill') ?? initialSkillId ?? ''
  const categoryFilter = params.get('variantCategory') ?? ''
  const windowFilter = params.get('variantWindow') ?? ''
  const collapsed = params.getAll('variantCollapsed')
  const expandedRows = params.getAll('variantExpanded')
  const historyRows = params.getAll('variantHistory')
  const changeParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace: true })
  }
  const toggleMany = (key: string, value: string) => {
    const values = params.getAll(key)
    const next = new URLSearchParams(params)
    next.delete(key)
    ;(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]).forEach((item) => next.append(key, item))
    setParams(next, { replace: true })
  }
  const matches = (row: VariantWorkbenchSkillRow) => {
    if (skillFilter && row.skillId !== skillFilter) return false
    if (categoryFilter && row.category !== categoryFilter && !(categoryFilter === 'OTHER' && !['TASTE_SKILL', 'PRODUCTION_SKILL'].includes(row.category))) return false
    if (windowFilter && !row.windowIds.includes(windowFilter)) return false
    const needle = query.trim().toLocaleLowerCase()
    return !needle || [row.skillName, row.skillId, row.status, ...row.variants.flatMap((item) => [item.id, item.name, item.status, governanceLabel(item.status)])].join(' ').toLocaleLowerCase().includes(needle)
  }
  const rows = workbench.sections.flatMap((section) => section.rows).filter(matches)
  const visibleVariants = rows.flatMap((row) => row.variants)
  const selectVariant = (id: string) => { setSelectedId(id); changeParams({ variantId: id }) }
  const closeDetail = () => { setSelectedId(undefined); changeParams({ variantId: undefined }) }
  const selectedLineage = selectedId ? selectVariantLineage(fullState, selectedId) : undefined
  const selected = selectedLineage?.variant
  const closeCreator = () => { setCreator(undefined); changeParams({ sourceClusterId: undefined, sourceIssueId: undefined }) }
  const createVariant = (variant: Variant) => {
    dispatch({ type: 'CREATE_VARIANT', variant, meta: { actor: '当前用户', reason: '从统一能力变体工作台创建候选并保留来源快照', at: variant.createdAt } })
    closeCreator()
  }
  const variantColumns: Column<Variant>[] = [
    { key: 'id', header: '变体 ID', accessor: (row) => <IdLink id={row.id} kind="variant" onOpen={() => selectVariant(row.id)} /> },
    { key: 'name', header: '变体 / 修改', accessor: (row) => <div><strong>{row.name}</strong><p className="mt-1 text-[11px] text-muted">{row.changeSummary}</p></div> },
    { key: 'versions', header: '当前 → 候选版本', accessor: (row) => `${row.currentVersion} → ${row.candidateVersion}` },
    { key: 'status', header: '状态', accessor: (row) => <StatusBadge status={row.status} label={governanceLabel(row.status)} /> },
    { key: 'time', header: '最近更新', accessor: (row) => dateText(row.updatedAt) }
  ]
  return <div className="space-y-4">
    <PageHeading eyebrow="统一能力治理" title="能力变体工作台" description="按 Skill 阅读来源、候选与验证进度。品味和生产分区独立展示；实验决策、发布状态不混为一个结论。" actions={<><Button icon={Plus} variant="primary" onClick={() => setCreator({})}>从问题簇创建变体</Button><Button onClick={() => setCreator({ issueId: fullState.issues.find((item) => item.optimizationMode === 'DIRECT_FIX')?.id })}>从问题创建变体</Button></>} />
    <FilterBar searchValue={query} onSearchChange={(value) => changeParams({ variantQuery: value })} searchPlaceholder="搜索 Skill、变体 ID、名称或状态" resultCount={rows.length} onReset={() => changeParams({ variantQuery: undefined, variantSkill: undefined, variantCategory: undefined, variantWindow: undefined })}>
      <Field label="Skill"><SelectInput aria-label="变体 Skill 筛选" value={skillFilter} onChange={(event) => changeParams({ variantSkill: event.target.value })}><option value="">全部</option>{workbench.sections.flatMap((section) => section.rows).map((row) => <option key={row.skillId} value={row.skillId}>{row.skillName}</option>)}</SelectInput></Field>
      <Field label="类型"><SelectInput aria-label="变体类型筛选" value={categoryFilter} onChange={(event) => changeParams({ variantCategory: event.target.value })}><option value="">全部</option>{workbench.sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</SelectInput></Field>
      <Field label="实验窗口"><SelectInput aria-label="变体窗口筛选" value={windowFilter} onChange={(event) => changeParams({ variantWindow: event.target.value })}><option value="">全部</option>{fullState.windows.map((window) => <option key={window.id} value={window.id}>{window.name}</option>)}</SelectInput></Field>
    </FilterBar>
    {workbench.sections.map((section) => {
      const sectionRows = section.rows.filter(matches)
      const open = !collapsed.includes(section.id)
      return <section key={section.id} aria-label={section.label} className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
        <SectionHeader title={section.label} description={`${sectionRows.length} 行 · ${section.id === 'TASTE_SKILL' ? '用户偏好与相关 Case 数分开统计' : section.id === 'PRODUCTION_SKILL' ? '策略迭代供算法筛选；确定性 Skill 错误直接优化并验证' : '记忆、Reason、Act/Tool 与个人 Skill 二期规划'}`} actions={<Button aria-label={`${open ? '收起' : '展开'}${section.label}`} aria-expanded={open} onClick={() => toggleMany('variantCollapsed', section.id)} icon={ChevronDown}>{open ? '收起' : '展开'}</Button>} />
        {open && <div className="mt-3 space-y-3">{sectionRows.map((row) => <div key={row.skillId} className="min-w-0 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-ink">{row.skillName}</p><p className="mt-1 font-mono text-[11px] text-muted">{row.skillId}</p><p className="mt-1 text-[11px] text-muted">{row.isSkill ? skillCategoryLabel(row.category) : governanceLabel(row.targetModule ?? '')} · 责任方：{row.owner}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={row.status} label={row.status} /><Button size="sm" aria-expanded={expandedRows.includes(row.skillId)} aria-label={`查看 ${row.skillName} 的变体`} onClick={() => toggleMany('variantExpanded', row.skillId)}>{row.variantCount} 个变体 / {row.candidateCount} 个候选</Button></div></div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-[10px] text-muted">当前 / 候选版本</p><p className="mt-1">{row.currentVersion} / {row.variants.map((item) => item.candidateVersion).join('、') || '暂无候选'}</p></div><div><p className="text-[10px] text-muted">最近更新</p><p className="mt-1">{dateText(row.updatedAt)}</p></div><div><p className="text-[10px] text-muted">来源问题 / 算法 Badcase</p><p className="mt-1">{row.sourceIssueIds.length} / {row.badcaseCount}</p></div><div><p className="text-[10px] text-muted">实验窗口</p><div className="mt-1 flex flex-wrap gap-1">{row.windowIds.length ? row.windowIds.map((id) => <IdLink key={id} id={id} kind="window" onOpen={navigation.open} />) : '未进入窗口'}</div></div></div>
          <p className="mt-2 text-[11px] text-muted">{row.routingPath}</p>
          {row.preference && <div className="mt-3 rounded border border-accent/20 bg-accent/5 p-3 text-xs"><p>红色偏好：{row.preference.preferenceCount} / {row.preference.populationTotal} 名去重用户（{Math.round(row.preference.preferenceRate * 100)}%）</p><p className="mt-1">{row.relatedDataCount} / {row.relatedDataThreshold} 条相关数据 · 与用户偏好分母独立</p><p className="mt-2 text-[11px] leading-5 text-muted">{row.preference.judgeReason}</p></div>}
          {row.history.length > 0 && <div className="mt-3"><Button icon={History} aria-expanded={historyRows.includes(row.skillId)} aria-label={`查看 ${row.skillName} 的自进化历史`} onClick={() => toggleMany('variantHistory', row.skillId)}>{historyRows.includes(row.skillId) ? '收起自进化历史' : '查看自进化历史'} · {row.history.length} 条</Button></div>}
          {historyRows.includes(row.skillId) && row.history.length > 0 && <div className="mt-3 rounded-lg border border-accent/20 bg-slate-50/70 p-3"><SectionHeader title="自进化历史" description="保留每个阶段的版本、来源与状态；Mock 数据不代表真实线上发布记录。" /><div className="mt-3 space-y-2">{row.history.map((entry) => <div key={entry.id} className="grid gap-2 rounded-md border border-line bg-white p-3 text-xs md:grid-cols-[120px_1fr_auto] md:items-start"><div><p className="font-semibold text-ink">{entry.stage}</p><p className="mt-1 text-[11px] text-muted">{dateText(entry.createdAt)}</p></div><div className="min-w-0"><p className="font-mono text-[11px] text-accent">{entry.version}</p><p className="mt-1 leading-5 text-muted">{entry.summary}</p></div><div className="flex flex-wrap items-center gap-2 md:justify-end">{entry.status && <StatusBadge status={entry.status} label={entry.status} showIcon={false} />}{entry.referenceId && entry.referenceKind ? <IdLink id={entry.referenceId} kind={entry.referenceKind as ReferenceTarget['kind']} onOpen={navigation.open} /> : <span className="text-[11px] text-muted">无关联对象</span>}</div></div>)}</div></div>}
          {expandedRows.includes(row.skillId) && <div className="mt-3"><DataTable caption={`${row.skillName} 变体`} rows={row.variants} columns={variantColumns} rowKey={(item) => item.id} onRowClick={(item) => selectVariant(item.id)} empty={<EmptyState title="暂无能力变体" description="先确认 Case 的问题，再从问题簇或确定性问题创建候选。" />} /></div>}
        </div>)}{!sectionRows.length && <EmptyState title="暂无匹配能力" description="当前筛选没有命中此分区；重置筛选或从 Case 确认来源问题。" />}</div>}
      </section>
    })}
    <Section><SectionHeader title="全部变体索引" description="同一工作台内的检索入口，不重复创建或维护生命周期。" /><DataTable className="mt-3" caption="能力变体列表" rows={visibleVariants} columns={variantColumns} rowKey={(row) => row.id} onRowClick={(row) => selectVariant(row.id)} empty={<EmptyState title="暂无匹配变体" description="调整筛选条件，或从已确认问题创建候选。" />} /></Section>
    {selected && selectedLineage && <Drawer open onClose={closeDetail} width="max-w-4xl" title="变体详情" description={selected.name}>
      <div className="space-y-4"><EntityId id={selected.id} kind="variant" onOpen={navigation.open} />
        <Section><SectionHeader title="版本与修改内容" actions={<StatusBadge status={selected.status} label={governanceLabel(selected.status)} />} /><KeyValueGrid className="mt-3" items={[{ label: '目标模块', value: governanceLabel(selected.targetModule) }, { label: '变更类型', value: governanceLabel(selected.changeType) }, { label: '当前 / 候选版本', value: `${selected.currentVersion} → ${selected.candidateVersion}` }, { label: '修改摘要', value: selected.changeSummary }, { label: '修改内容', value: selected.changeContent }, { label: '创建时间', value: dateText(selected.createdAt) }, { label: '最近更新', value: dateText(selected.updatedAt) }]} /></Section>
        <Section><SectionHeader title="来源 Case / 问题簇 / Evidence" description="固定来源快照；后续状态变化不删除原始证据。" /><div className="mt-3 flex flex-wrap gap-2">{selected.sourceCaseIds.map((id) => <IdLink key={id} id={id} kind="case" onOpen={navigation.open} />)}{selected.sourceIssueIds.map((id) => <IdLink key={id} id={id} kind="issue" onOpen={navigation.open} />)}{selected.sourceClusterIds.map((id) => <IdLink key={id} id={id} kind="cluster" onOpen={navigation.open} />)}{selected.evidenceIds.map((id) => <IdLink key={id} id={id} kind="evidence" onOpen={navigation.open} />)}</div>
          <div className="mt-3 space-y-2">{selectedLineage.findings.map((finding) => <div key={finding.id} className="rounded border border-line p-2 text-xs"><IdLink id={finding.id} kind="finding" onOpen={navigation.open} /><p className="mt-1">{finding.moduleLabel} · {finding.dimensionLabel}</p><p className="mt-1 text-muted">{finding.description}</p><p className="mt-1 text-muted">Rubric：{finding.evidenceBundle.rubricRule}</p></div>)}</div>
          <div className="mt-3 flex flex-wrap gap-2">{selectedLineage.traceIds.map((id) => <IdLink key={id} id={id} kind="trace" onOpen={navigation.open} />)}{selectedLineage.deliveries.map((delivery) => <IdLink key={delivery.id} id={delivery.id} kind="routing-delivery" onOpen={navigation.open} />)}</div>
        </Section>
        {([{ title: '单变体实验', experiments: selectedLineage.singleExperiments }, { title: '窗口组合验证', experiments: selectedLineage.combinationExperiments }]).map(({ title, experiments }) => <Section key={title}><SectionHeader title={title} description={title === '窗口组合验证' ? '仅单变体通过后才可进入组合验证。' : '归因集、泛化集、回归集在报告中保持版本快照。'} /><div className="mt-3 space-y-2">{experiments.map((experiment) => <div key={experiment.id} className="rounded border border-line p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><IdLink id={experiment.id} kind="experiment" onOpen={navigation.open} /><StatusBadge status={experiment.status} label={governanceLabel(experiment.status)} /></div><p className="mt-2">{experiment.baselineVersion} → {experiment.candidateVersion} · {experiment.configSnapshot.repeatCount} 次 / Case</p><p className="mt-1 text-muted">{experiment.knownRisks.join('；') || '暂无已知风险记录'}</p></div>)}{!experiments.length && <p className="text-xs text-muted">{title === '单变体实验' ? '尚未创建实验：在实验与准出页选择本候选与数据集。' : '未进入窗口组合验证：先完成单变体实验并确认准出。'}</p>}</div></Section>)}
        <Section><SectionHeader title="准出决策与实际发布" description="实验结论和发布状态独立，业务门禁仍待配置。" /><div className="mt-3 space-y-3">{selectedLineage.gates.map((gate) => <div key={gate.id} className="rounded border border-line p-3 text-xs"><IdLink id={gate.id} kind="decision" onOpen={navigation.open} /><p className="mt-1">{gate.conclusion === 'PASS' ? '准出' : governanceLabel(gate.conclusion)} · {gate.reason}</p></div>)}{!selectedLineage.gates.length && <p className="text-xs text-muted">尚未提交准出决策。</p>}{selectedLineage.releases.map((release) => <div key={release.id} className="rounded border border-line p-3 text-xs"><IdLink id={release.id} kind="release" onOpen={navigation.open} /><p className="mt-1">{release.version} · {governanceLabel(release.status)} · {release.approvedBy}</p>{release.rollbackVersionId && <div className="mt-2"><span>可回滚版本：</span><IdLink id={release.rollbackVersionId} kind="release" onOpen={navigation.open} /><p className="mt-1 text-muted">{release.rollbackReason ?? '尚未执行回滚'}</p></div>}</div>)}{!selectedLineage.releases.length && <p className="text-xs text-muted">尚未发布。单变体通过仍需窗口组合验证。</p>}</div></Section>
      </div>
    </Drawer>}
    {selectedId && !selected && <p role="alert" className="rounded border border-warn/30 p-3 text-xs">变体不存在或当前数据未加载，请返回列表选择已有变体。</p>}
    {creator && <VariantCreateDialog key={`${creator.clusterId ?? ''}:${creator.issueId ?? ''}`} state={fullState} sourceClusterId={creator.clusterId} sourceIssueId={creator.issueId} onClose={closeCreator} onCreate={createVariant} />}
    {navigation.drawer}
  </div>
}
