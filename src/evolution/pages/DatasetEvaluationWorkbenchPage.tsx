import { useEffect, useMemo } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, History } from 'lucide-react'
import { Button, DataTable, Drawer, EmptyState, Field, SectionHeader, SelectInput, StatusBadge, Tabs, TextInput, type Column } from '../../ui'
import { buildContextHref, useContextNavigation } from '../../layout'
import { useEvolution } from '../store'
import { datasetRows, datasetTraceRows, type DatasetWorkbenchRow, type TraceWorkbenchRow } from '../data/traceDataset'
import { governanceTracks, latestSkillVersion, normalizeSkillVersion, skillVersions, targetAttributionId, type GovernanceTrack } from '../data/skillWorkspace'
import { GOVERNANCE_OBJECTS, governanceItemLabel, governanceObjectForEvolutionItem, type GovernanceObjectId } from '../governanceTaxonomy'
import { governanceLabel, resolveCaseSource, skillCategoryLabel } from '../labels'
import type { SkillCategory } from '../domain'
import { evolutionItemId } from '../taxonomy'
import { formatNormalizedScoreOutOfTwo } from '../score'
import { IdLink, KeyValueGrid, type ReferenceTarget } from '../components/ViewPrimitives'
import { dateText, Section, useReferenceNavigation } from './shared'
import { AttributionHistoryDrawer } from '../components/AttributionHistoryDrawer'

const DETAIL_FIELDS = ['datasetId', 'historyItem', 'experimentId', 'variantId', 'decisionId', 'releaseId', 'windowId', 'issueId', 'attributionId', 'clusterId', 'findingId', 'deliveryId', 'runId', 'assetId']
const VERSION_STATUS = { RELEASED: '已发布', CANDIDATE: '候选版本', DEPRECATED: '历史版本', PLANNED: '二期规划' } as const
const validObject = (value: string | null): GovernanceObjectId | '' => GOVERNANCE_OBJECTS.some(item => item.id === value) ? value as GovernanceObjectId : ''
const SKILL_CATEGORIES: SkillCategory[] = ['PRODUCTION_SKILL', 'TASTE_SKILL', 'PERSONAL_SKILL', 'GENERAL', 'UNCLASSIFIED']

/** Collection governance uses frozen version assets; execution inspection lives in Case / Trace. */
export function DatasetEvaluationWorkbenchPage({ onNavigateReference, initialDatasetId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialDatasetId?: string }) {
  const { state } = useEvolution()
  const location = useLocation()
  const { navigateContext } = useContextNavigation()
  const navigation = useReferenceNavigation(onNavigateReference)
  const [params, setParams] = useSearchParams()
  const allTracks = useMemo(() => governanceTracks(state), [state])
  const selectedHistoryKey = params.get('historyItem') ?? ''
  const referencedRun = state.experimentRuns.find(run => run.id === params.get('runId'))
  const referencedWindow = state.windows.find(window => window.id === params.get('windowId'))
  const referenceIds = [...DETAIL_FIELDS.slice(2).flatMap(key => params.get(key) ? [params.get(key)!] : []), ...(referencedRun ? [referencedRun.experimentId] : []), ...(referencedWindow?.combinationExperimentId ? [referencedWindow.combinationExperimentId] : referencedWindow?.singleExperimentIds ?? [])]
  const referencedTracks = allTracks.filter(track => referenceIds.some(id => [...track.experimentIds, ...track.variantIds, ...track.gateIds, ...track.releaseIds, ...track.issueIds, ...track.attributionIds, ...track.clusterIds, ...track.findingIds].includes(id)))
  const requestedSkill = params.get('skill') ?? params.get('skillId')
  const requestedVersion = normalizeSkillVersion(params.get('skillVersion') ?? '')
  const linkedTrack = selectedHistoryKey ? allTracks.find(track => track.key === selectedHistoryKey) : referencedTracks.find(track => (!requestedSkill || track.skillId === requestedSkill) && (!requestedVersion || track.skillVersion === requestedVersion)) ?? referencedTracks.find(track => track.skillId === requestedSkill) ?? referencedTracks[0]
  const skillId = params.get('skill') ?? params.get('skillId') ?? linkedTrack?.skillId ?? ''
  const selectedSkill = state.skills.find(item => item.id === skillId)
  const category = (params.get('skillCategory') ?? selectedSkill?.category ?? '') as SkillCategory | ''
  const availableSkills = state.skills.filter(item => !category || item.category === category)
  const versions = useMemo(() => skillVersions(state, skillId), [state, skillId])
  const rawVersion = params.get('skillVersion') ?? ''
  const version = selectedSkill ? (rawVersion === 'all' ? 'all' : (linkedTrack?.skillId === skillId ? linkedTrack.skillVersion : '') || normalizeSkillVersion(rawVersion) || latestSkillVersion(state, skillId)) : ''
  const scopedVersion = version && version !== 'all' ? version : undefined
  const selectedVersion = versions.find(item => item.version === version)
  const requestedObject = validObject(params.get('governanceObject'))
  const skillMode = Boolean(skillId || category)
  const object = skillMode ? 'Skill' as GovernanceObjectId : requestedObject
  const attribution = params.get('attribution') ?? params.get('evolutionItem') ?? ''
  const attributionObject = governanceObjectForEvolutionItem(evolutionItemId(attribution) ?? attribution)
  const optimization = params.get('optimizationMode') ?? ''
  const query = params.get('query') ?? ''
  const hasHistoryReference = DETAIL_FIELDS.slice(1).some(key => params.has(key))
  const view = params.get('view') === 'history' || (!params.get('view') && hasHistoryReference) ? 'history' : 'datasets'
  // Keep one URL-owned selection. Cascading changes are atomic, not separate setters.
  useEffect(() => {
    if (params.get('view') === 'traces') return
    const updated = new URLSearchParams(params)
    if (selectedSkill && version && version !== rawVersion) updated.set('skillVersion', version)
    if (selectedSkill && !params.get('skill') && !params.get('skillId')) updated.set('skill', skillId)
    if (selectedSkill?.category && !params.has('skillCategory')) updated.set('skillCategory', selectedSkill.category)
    if (skillMode) {
      if (params.get('governanceObject') !== 'Skill') updated.set('governanceObject', 'Skill')
      if (attribution && governanceObjectForEvolutionItem(attribution) !== 'Skill') updated.delete('attribution')
      updated.delete('evolutionItem')
    }
    if (attribution && (!skillMode || attributionObject === 'Skill')) { updated.set('attribution', attribution); updated.delete('evolutionItem') }
    if (updated.toString() !== params.toString()) setParams(updated, { replace: true })
  }, [params, selectedSkill, skillId, category, skillMode, rawVersion, version, attribution, attributionObject, state, setParams])

  const matchesCategory = (id: string) => !category || state.skills.find(item => item.id === id)?.category === category
  const versionTracks = useMemo(() => governanceTracks(state, { skillId: skillId || undefined, skillVersion: scopedVersion }).filter(track => matchesCategory(track.skillId)), [state, skillId, scopedVersion, category])
  const activeTracks = versionTracks.filter(track => track.active && (!object || governanceObjectForEvolutionItem(track.attributionId) === object))
  const attributionOptions = [...new Map(activeTracks.map(track => [track.attributionId, track])).values()]
  const historicalSelection = Boolean(attribution && !attributionOptions.some(track => track.attributionId === attribution))
  const hasAttributionForVersion = versionTracks.some(track => track.attributionId === attribution && (!object || governanceObjectForEvolutionItem(track.attributionId) === object))
  const scope = { skillId: skillId || undefined, skillVersion: scopedVersion, governanceObject: object, attribution: attribution || undefined, optimizationMode: optimization || undefined, query }
  const tracks = useMemo(() => governanceTracks(state, scope).filter(track => matchesCategory(track.skillId)), [state, skillId, scopedVersion, category, object, attribution, optimization, query])
  const rows = datasetRows(state, scope).map(row => ({ ...row, targets: row.targets.filter(target => matchesCategory(target.skillId)) })).filter(row => !category || row.targets.length > 0).filter(row => !query.trim() || [row.dataset.name, row.dataset.id, row.dataset.purpose, ...row.targets.map(targetAttributionId)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selectedDatasetId = params.get('datasetId') ?? initialDatasetId
  const selectedDataset = state.datasets.find(item => item.id === selectedDatasetId)
  const selectedDatasetRow = selectedDataset ? datasetRows(state, scope).find(row => row.dataset.id === selectedDataset.id) ?? datasetRows(state).find(row => row.dataset.id === selectedDataset.id) : undefined
  const sampleRows = useMemo(() => selectedDataset ? datasetTraceRows(state, selectedDataset) : [], [state, selectedDataset])

  const update = (patch: Record<string, string | undefined>, clear: string[] = [], replace = true) => {
    const next = new URLSearchParams(params)
    clear.forEach(key => next.delete(key))
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace })
  }
  const clearSkillScope = ['skill', 'skillId', 'skillVersion', 'skillCategory', 'governanceObject', 'attribution', 'evolutionItem', ...DETAIL_FIELDS]
  const selectCategory = (value: string) => update({ skillCategory: value || undefined }, clearSkillScope)
  const selectSkill = (value: string) => update({ skill: value || undefined, skillCategory: value ? state.skills.find(item => item.id === value)?.category : category || undefined }, clearSkillScope)
  const openDataset = (id: string) => update({ view: 'datasets', datasetId: id }, DETAIL_FIELDS.filter(key => key !== 'datasetId'), false)
  const openTrack = (track: GovernanceTrack) => update({ view: 'history', historyItem: track.key }, DETAIL_FIELDS.filter(key => key !== 'historyItem'), false)
  const openSample = (row: TraceWorkbenchRow) => navigateContext('/cases', {
    clear: ['caseClosed', 'caseSet', 'traceSet', 'query', 'evolutionItem', 'logId', 'sessionId', 'observationId', 'evidenceId', 'skillId', 'processEval', 'outcomeEval', 'packageId'],
    params: { caseId: row.case.id, traceId: row.trace.id, caseView: 'trace', returnTo: location.pathname + location.search }
  })
  const selectedTrack = linkedTrack ?? (selectedHistoryKey ? tracks.find(track => track.attributionId === selectedHistoryKey) : undefined)
  const legacyExperimentId = params.get('experimentId') ?? referencedRun?.experimentId ?? referencedWindow?.combinationExperimentId
  const legacyExperiment = state.experiments.find(item => item.id === legacyExperimentId) ?? state.experiments.find(item => item.variantIds.includes(params.get('variantId') ?? ''))

  if (params.get('view') === 'traces') {
    const pkg = state.tracePackages.find(item => item.id === params.get('packageId'))
    const evaluation = [...state.processEvals, ...state.outcomeEvals].find(item => item.id === params.get('evaluationId'))
    const artifact = state.artifacts.find(item => item.id === params.get('artifactId'))
    const traceId = params.get('traceId') ?? pkg?.traceId ?? evaluation?.traceId ?? artifact?.traceId
    const trace = state.traces.find(item => item.id === traceId)
    return <Navigate replace to={buildContextHref(location.search, '/cases', { clear: ['view', 'datasetId', 'historyItem', 'caseClosed'], params: { traceId, caseId: trace?.caseId, caseView: evaluation ? 'eval' : 'trace', returnTo: params.get('returnTo') ?? '/datasets-evaluations' } })} />
  }

  const datasetColumns: Column<DatasetWorkbenchRow>[] = [
    { key: 'dataset', header: '测试集', accessor: row => <div className="max-w-[260px]"><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openDataset(row.dataset.id) }}>{row.dataset.name}</button><p className="mt-1 break-all font-mono text-[10px] text-muted">{row.dataset.id}</p><p className="mt-1 text-[11px] text-muted">数据集版本 {row.dataset.version}</p></div> },
    { key: 'target', header: 'Skill / 固定版本 / 归因', accessor: row => <div className="max-w-[250px] space-y-2">{row.targets.map(target => <div key={`${target.skillId}@${target.skillVersion}#${targetAttributionId(target)}`}><p>{state.skills.find(skill => skill.id === target.skillId)?.name ?? target.skillId} <span className="font-mono text-muted">{normalizeSkillVersion(target.skillVersion) || '版本未记录'}</span></p><p className="mt-1 text-[11px] text-muted">{governanceItemLabel(versionTracks.find(track => track.attributionId === targetAttributionId(target))?.definition)}</p></div>)}</div> },
    { key: 'purpose', header: '用途 / 冻结状态', accessor: row => <div className="space-y-2"><p>{row.dataset.purpose ?? '待配置'}</p><StatusBadge status={row.dataset.frozen ? '已冻结' : '积累中'} tone={row.dataset.frozen ? 'neutral' : 'warn'} showIcon={false} /></div> },
    { key: 'samples', header: '样本', accessor: row => <div><p>{row.dataset.sampleCount} 个 Case</p><p className="mt-1 text-[10px] text-muted">{row.traceIds.length} 条可查看 Trace</p></div> },
    { key: 'evaluation', header: '评测 / 准出', accessor: row => <div className="space-y-1"><p>{row.evaluationResult}</p><StatusBadge status={row.gate} label={row.gate} showIcon={false} tone={row.gate === '已准出' ? 'pass' : 'neutral'} /></div> },
    { key: 'time', header: '时间窗口', accessor: row => <span className="text-[11px] text-muted">{row.dataset.timeRange ? <>{dateText(row.dataset.timeRange.from)}<br />{dateText(row.dataset.timeRange.to)}</> : '未配置'}</span> }
  ]
  const historyColumns: Column<GovernanceTrack>[] = [
    { key: 'target', header: 'Skill / 版本 / 归因', accessor: track => <div><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openTrack(track) }}>{track.title}</button><p className="mt-1 text-[10px] text-muted">{track.objectLabel} · {track.key}</p></div> },
    { key: 'method', header: '优化规则', accessor: track => <div>{track.definition.optimization}<p className="mt-1 text-[10px] text-muted">{track.definition.condition}</p></div> },
    { key: 'progress', header: '进化状态', accessor: track => <StatusBadge status={track.stateLabel} label={track.stateLabel} tone={track.active ? 'warn' : 'neutral'} showIcon={false} /> },
    { key: 'sets', header: '测试集 / 实验', accessor: track => `${track.datasetIds.length} / ${track.experimentIds.length}` },
    { key: 'updated', header: '最近更新', accessor: track => dateText(track.updatedAt) }
  ]
  const sampleColumns: Column<TraceWorkbenchRow>[] = [
    { key: 'query', header: 'Query', accessor: row => <div className="max-w-[310px]"><p className="line-clamp-3 leading-5">{row.case.query}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">{row.trace.id}</p></div> },
    { key: 'time', header: 'Query 时间', accessor: row => dateText(row.trace.queryAt ?? row.trace.startedAt) },
    { key: 'source', header: '来源', accessor: row => resolveCaseSource(state, row.case).label },
    { key: 'score', header: '过程 / 产物（0–2）', accessor: row => <div className="space-y-1 font-mono text-[11px]"><p>过程 {formatNormalizedScoreOutOfTwo(row.rating?.processFinal)}</p><p>产物 {formatNormalizedScoreOutOfTwo(row.rating?.outcomeFinal)}</p></div> },
    { key: 'action', header: '分析', accessor: row => <Button variant="ghost" size="sm" onClick={() => openSample(row)} icon={ArrowRight}>查看 Case / Trace</Button> }
  ]

  const skillInfo = selectedSkill ? <section aria-label="Skill 信息" className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{selectedSkill.name}</h2><StatusBadge status={governanceLabel(selectedSkill.category ?? 'UNCLASSIFIED')} label={governanceLabel(selectedSkill.category ?? 'UNCLASSIFIED')} tone="neutral" showIcon={false} /><StatusBadge status={version === 'all' ? '全部版本' : selectedVersion?.status ?? '待配置'} label={version === 'all' ? '全部版本' : selectedVersion ? VERSION_STATUS[selectedVersion.status] : '版本未登记'} tone="neutral" showIcon={false} /></div><p className="mt-2 break-all font-mono text-[11px] text-muted">{selectedSkill.id} · {selectedSkill.visibility === 'PUBLIC' ? '公库' : '私库'}</p><p className="mt-2 text-xs leading-5 text-muted">{selectedSkill.description ?? selectedVersion?.description ?? '固定版本的归因、测试集与实验报告按快照管理。'}</p></div><Button variant="ghost" icon={History} onClick={() => update({ view: 'history', attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}>{version === 'all' ? '查看完整历史' : '查看该版本历史'}</Button></div>
      <KeyValueGrid className="mt-4 border-t border-line pt-3" items={[{ label: '当前发布版本', value: normalizeSkillVersion(selectedSkill.version) }, { label: '选中版本范围', value: version === 'all' ? '全部版本' : version }, { label: '版本目录', value: `${versions.length} 个版本 · ${activeTracks.length} 条进行中归因` }, { label: '最近更新', value: dateText(selectedVersion?.updatedAt ?? selectedSkill.updatedAt) }]} />
    </section> : null

  return <div className="space-y-4">
    <section aria-label="治理范围筛选" className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <p className="mb-3 text-xs leading-5 text-muted">按 Skill 分类 → 具体 Skill → 版本 → 归因选择范围。具体 Skill 默认最新版本；选择全部版本，可查看该 Skill 的完整测试集与历史。</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Skill 分类"><SelectInput aria-label="Skill 分类" value={category} onChange={event => selectCategory(event.target.value)}><option value="">全部分类</option>{SKILL_CATEGORIES.map(item => <option key={item} value={item}>{skillCategoryLabel(item)}</option>)}</SelectInput></Field>
        <Field label="具体 Skill"><SelectInput aria-label="具体 Skill" value={skillId} onChange={event => selectSkill(event.target.value)}><option value="">全部 Skill</option>{availableSkills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Skill 版本" hint={!selectedSkill ? '先选择左侧具体 Skill，即可切换版本。' : version === 'all' ? '按 Skill 汇总浏览，记录仍保留各自固定版本。' : '当前仅查看这个固定版本。'}><SelectInput aria-label="Skill 版本" value={version} disabled={!selectedSkill} onChange={event => update({ skillVersion: event.target.value, attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}>{!selectedSkill && <option value="">请先选择 Skill</option>}{selectedSkill && <option value="all">全部版本</option>}{rawVersion && rawVersion !== 'all' && !selectedVersion && <option value={version}>{version} · 版本未登记</option>}{versions.map(item => <option key={item.id} value={item.version}>{item.version} · {VERSION_STATUS[item.status]}</option>)}</SelectInput></Field>
        <Field label="归因"><SelectInput aria-label="归因" value={historicalSelection ? '' : attribution} onChange={event => update({ attribution: event.target.value, evolutionItem: undefined }, DETAIL_FIELDS)}><option value="">{attributionOptions.length ? '全部进行中归因' : '当前版本暂无进行中归因'}</option>{attributionOptions.map(track => <option key={track.attributionId} value={track.attributionId}>{governanceItemLabel(track.definition)} · {track.stateLabel}</option>)}</SelectInput></Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {skillMode ? <div className="flex min-h-9 items-center rounded-md border border-accent/20 bg-accent/5 px-2.5 text-xs text-accent" role="status">当前治理对象：Skill</div> : <Field label="归因对象"><SelectInput aria-label="归因对象" value={object} onChange={event => update({ governanceObject: event.target.value, attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}><option value="">全部模块</option>{GOVERNANCE_OBJECTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></Field>}
        <Field label="优化条件"><SelectInput aria-label="优化条件" value={optimization} onChange={event => update({ optimizationMode: event.target.value }, DETAIL_FIELDS)}><option value="">全部条件</option><option value="直接优化">直接优化</option><option value="聚类优化">聚类优化</option><option value="待配置">待配置</option></SelectInput></Field>
      </div>
      {historicalSelection && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/20 bg-warn/5 p-2 text-[11px] text-muted"><span>{hasAttributionForVersion ? '已完成归因（保留历史筛选）' : '当前 Skill 版本不存在的归因'}：{attribution}。进行中下拉只显示当前版本活动项。</span><Button size="sm" variant="ghost" onClick={() => update({ attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}>清除此归因筛选</Button></div>}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"><TextInput className="min-w-[200px] flex-1" aria-label="搜索数据集或归因历史" value={query} onChange={event => update({ query: event.target.value })} placeholder="搜索数据集名称、ID、归因历史" /><span className="text-xs text-muted">{view === 'history' ? tracks.length : rows.length} 条结果</span><Button onClick={() => update({ governanceObject: undefined, attribution: undefined, evolutionItem: undefined, optimizationMode: undefined, query: undefined, skillVersion: selectedSkill ? latestSkillVersion(state, skillId) : undefined }, DETAIL_FIELDS)}>重置归因筛选</Button></div>
      <p className="mt-2 text-[10px] leading-4 text-muted">版本资产按固定快照展示，保留完整历史和全部数据集成员；顶部时间、环境与 Agent 版本用于线上 Case 范围。所有数据为 Mock，业务门禁未配置时不推断准出。</p>
    </section>
    {skillInfo}
    <Tabs aria-label="数据集与评测视图" activeId={view} onChange={id => update({ view: id }, DETAIL_FIELDS)} items={[{ id: 'datasets', label: '数据集', count: rows.length }, { id: 'history', label: '归因历史', count: tracks.length }]} />
    {view === 'datasets' ? <Section><SectionHeader title="评测集与准出集" description={selectedSkill ? `${selectedSkill.name} · ${version === 'all' ? '全部版本' : version} · ${attribution ? '所选归因的测试集' : '所有归因的测试集'}` : '可按 Skill 分类筛选；选中具体 Skill 后，继续按版本与归因缩小范围。'} /><DataTable className="mt-3" caption="数据集与评测列表" rows={rows} columns={datasetColumns} rowKey={row => row.dataset.id} onRowClick={row => openDataset(row.dataset.id)} empty={<EmptyState title="暂无对应测试集" description="当前范围暂无匹配测试集；可切换 Skill、版本、归因或查看历史。" />} /></Section> : <Section><SectionHeader title="归因与进化历史" description="各 Skill 固定版本独立留存；包括待进行、进行中与已完成的归因，不跨版本合并。" /><DataTable className="mt-3" caption="归因历史列表" rows={tracks} columns={historyColumns} rowKey={track => track.key} onRowClick={openTrack} empty={<EmptyState title="暂无归因历史" description="当前对象尚无归因记录，或筛选条件无匹配。" />} /></Section>}
    <Drawer open={Boolean(selectedDataset)} width="max-w-5xl" title={`数据集详情 · ${selectedDataset?.name ?? ''}`} description={selectedDataset ? `${selectedDataset.id} · ${selectedDataset.version}` : ''} closeLabel="关闭数据集详情" onClose={() => update({ datasetId: undefined })}>
      {selectedDataset && <div className="space-y-5"><Section><SectionHeader title="数据集信息" /><KeyValueGrid className="mt-3" items={[{ label: '用途', value: selectedDataset.purpose }, { label: '数据集版本 / 冻结状态', value: `${selectedDataset.version} · ${selectedDataset.frozen ? '已冻结' : '积累中'}` }, { label: '总样本量', value: `${selectedDataset.sampleCount} 个 Case` }, { label: '本地可查看', value: `${selectedDataset.population.localCaseCount} 个 Case / ${sampleRows.length} 条 Trace` }, { label: '外部 Mock 样本', value: `${selectedDataset.population.externalSampleCount} 个 Case（未展开，不伪造 Trace）` }, { label: '样本范围', value: selectedDataset.scope }]} /><p className="mt-3 text-[11px] leading-5 text-muted">{selectedDataset.population.countingRule}</p><div className="mt-3 space-y-1 text-xs">{selectedDataset.targets?.map(target => <p key={`${target.skillId}@${target.skillVersion}#${targetAttributionId(target)}`}>{state.skills.find(skill => skill.id === target.skillId)?.name ?? target.skillId} · {normalizeSkillVersion(target.skillVersion) || '版本未记录'} · {targetAttributionId(target)}</p>)}</div></Section>
      <Section><SectionHeader title="样本 Trace" description="一行对应一次任务执行；完整过程、评测 Reason 与 Evidence 在 Case / Trace 分析查看。" /><DataTable className="mt-3" caption="数据集样本 Trace" rows={sampleRows} columns={sampleColumns} rowKey={row => row.trace.id} onRowClick={openSample} /></Section>
      <Section><SectionHeader title="实验与准出" /><div className="mt-3 space-y-3">{selectedDatasetRow?.experimentIds.length ? selectedDatasetRow.experimentIds.map(id => <div key={id} className="rounded border border-line p-3"><IdLink id={id} kind="experiment" onOpen={navigation.open} /><p className="mt-2 text-xs text-muted">{selectedDatasetRow.gate} · {state.experiments.find(item => item.id === id)?.name}</p></div>) : <p className="text-xs text-muted">尚未关联实验；不会从样本评测完成状态推断准出。</p>}</div></Section></div>}
    </Drawer>
    <AttributionHistoryDrawer state={state} track={selectedTrack} decisionId={params.get('decisionId') ?? undefined} onClose={() => update({}, DETAIL_FIELDS.filter(key => key !== 'datasetId'))} onNavigateReference={navigation.open} onOpenDataset={openDataset} />
    {!selectedTrack && legacyExperiment && view === 'history' && <Drawer open width="lg" title="准出与进化历史详情" closeLabel="关闭实验详情" onClose={() => update({}, DETAIL_FIELDS)}><SectionHeader title={legacyExperiment.name} description="历史实验保留原配置与版本；没有固定归因目标时不自动归属新版本。" /><p className="mt-3 font-mono text-xs">{legacyExperiment.id}</p><KeyValueGrid className="mt-4" items={[{ label: 'Baseline', value: legacyExperiment.baselineVersion }, { label: 'Candidate', value: legacyExperiment.candidateVersion }, { label: '状态', value: governanceLabel(legacyExperiment.status) }, { label: '重复次数', value: `${legacyExperiment.configSnapshot.repeatCount} 次 / Case` }]} /></Drawer>}
    {navigation.drawer}
  </div>
}
