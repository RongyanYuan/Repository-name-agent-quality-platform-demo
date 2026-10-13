import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, History, Plus, Shuffle, Upload } from 'lucide-react'
import { Button, DataTable, Drawer, EmptyState, Field, Modal, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui'
import { buildContextHref, useContextNavigation } from '../../layout'
import { useEvolution } from '../store'
import { datasetRows, datasetTraceRows, traceRows as allTraceRows, type DatasetWorkbenchRow, type TraceWorkbenchRow } from '../data/traceDataset'
import { governanceTracks, latestSkillVersion, normalizeSkillVersion, skillVersions, targetAttributionId, type GovernanceTrack } from '../data/skillWorkspace'
import { GOVERNANCE_OBJECTS, governanceItemLabel, governanceObjectForEvolutionItem, type GovernanceObjectId } from '../governanceTaxonomy'
import { governanceLabel, resolveCaseSource, skillCategoryLabel } from '../labels'
import type { EvolutionRecord, EvolutionState, SkillCategory } from '../domain'
import { evolutionItemId } from '../taxonomy'
import { formatNormalizedScoreOutOfTwo } from '../score'
import { IdLink, KeyValueGrid, type ReferenceTarget } from '../components/ViewPrimitives'
import { dateText, Section, useReferenceNavigation } from './shared'
import { AttributionHistoryDrawer } from '../components/AttributionHistoryDrawer'
import { StatusIndicator } from '../components/StatusIndicator'
import { formatGovernanceTime, governanceStageLabel } from '../data/traceGovernance'
import { resolveIdentity } from '../identity'
import { EvolutionRecordHistoryDrawer } from '../components/EvolutionRecordHistoryDrawer'
import { evolutionDatasetRows, evolutionRecordAttributionLabel, evolutionTargetLabel, filterEvolutionRecords, targetIdentityId, targetIdentityVersion, type EvolutionDatasetRow } from '../data/evolutionWorkbench'
import { buildEvolutionWorkbenchHref, selectEvolutionRecord } from '../data/moduleEvolution'
import { buildDatasetSamplingSnapshot } from '../data/datasetSampling'
import { DatasetExecutionWorkbench } from '../components/DatasetExecutionWorkbench'
import { selectDatasetExecutionInputs } from '../data/datasetExecution'
import type { DatasetExecutionItem, DatasetExecutionMode, DatasetExecutionRun } from '../domain'

const DETAIL_FIELDS = ['datasetId', 'datasetRunId', 'historyItem', 'experimentId', 'variantId', 'decisionId', 'releaseId', 'windowId', 'issueId', 'attributionId', 'clusterId', 'findingId', 'deliveryId', 'runId', 'assetId']
const VERSION_STATUS = { RELEASED: '已发布', CANDIDATE: '候选版本', DEPRECATED: '历史版本', PLANNED: '二期规划' } as const
const validObject = (value: string | null): GovernanceObjectId | '' => GOVERNANCE_OBJECTS.some(item => item.id === value) ? value as GovernanceObjectId : ''
const SKILL_CATEGORIES: SkillCategory[] = ['PRODUCTION_SKILL', 'TASTE_SKILL', 'PERSONAL_SKILL', 'GENERAL', 'UNCLASSIFIED']

/** Collection governance uses frozen version assets; execution inspection lives in Case / Trace. */
export function DatasetEvaluationWorkbenchPage({ onNavigateReference, initialDatasetId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialDatasetId?: string }) {
  const { state, commit } = useEvolution()
  const location = useLocation()
  const { navigateContext } = useContextNavigation()
  const navigation = useReferenceNavigation(onNavigateReference)
  const [params, setParams] = useSearchParams()
  const [customDatasetOpen, setCustomDatasetOpen] = useState(false)
  const [customDatasetName, setCustomDatasetName] = useState('')
  const [customDatasetDescription, setCustomDatasetDescription] = useState('')
  const [customDatasetError, setCustomDatasetError] = useState('')
  const [addTraceOpen, setAddTraceOpen] = useState(false)
  const [selectedTraceIds, setSelectedTraceIds] = useState<string[]>([])
  const [samplingOpen, setSamplingOpen] = useState(false)
  const [samplingAssetId, setSamplingAssetId] = useState('')
  const [samplingCount, setSamplingCount] = useState('20')
  const [runRequest, setRunRequest] = useState<{ datasetId: string; mode: DatasetExecutionMode; key: number }>()
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
  const datasetTimeWindow = params.get('datasetTimeWindow') ?? ''
  const datasetTimeFrom = params.get('datasetTimeFrom') ?? ''
  const datasetTimeTo = params.get('datasetTimeTo') ?? ''
  const datasetCategoryFilter = params.get('datasetCategory') ?? ''
  const customTimeInvalid = Boolean(datasetTimeFrom && datasetTimeTo && Date.parse(datasetTimeFrom) > Date.parse(datasetTimeTo))
  const hasHistoryReference = DETAIL_FIELDS.slice(1).some(key => params.has(key))
  const view = params.get('view') === 'history' || (!params.get('view') && hasHistoryReference) ? 'history' : 'datasets'
  // A plain module filter stays in the unified workbench so the primary Skill
  // selectors remain available. The dedicated module target workbench is only
  // entered for an explicit history view or an exact record/deep link.
  const genericModuleScope = Boolean(!skillMode && params.get('view') === 'history' && requestedObject && requestedObject !== 'Skill' && !selectedHistoryKey && !referenceIds.length && state.evolutionRecords?.some(record => record.target.kind === 'MODULE' && record.target.governanceObject === requestedObject))
  // Keep one URL-owned selection. Cascading changes are atomic, not separate setters.
  useEffect(() => {
    if (params.has('evolutionRecordId') || params.has('targetId') || params.get('evolutionScope') === 'records' || genericModuleScope) return
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
  }, [params, selectedSkill, skillId, category, skillMode, rawVersion, version, attribution, attributionObject, state, setParams, genericModuleScope])

  const matchesCategory = (id: string) => !category || state.skills.find(item => item.id === id)?.category === category
  const versionTracks = useMemo(() => governanceTracks(state, { skillId: skillId || undefined, skillVersion: scopedVersion }).filter(track => matchesCategory(track.skillId)), [state, skillId, scopedVersion, category])
  const activeTracks = versionTracks.filter(track => track.active && (!object || governanceObjectForEvolutionItem(track.attributionId) === object))
  const attributionOptions = [...new Map(activeTracks.map(track => [track.attributionId, track])).values()]
  const historicalSelection = Boolean(attribution && !attributionOptions.some(track => track.attributionId === attribution))
  const hasAttributionForVersion = versionTracks.some(track => track.attributionId === attribution && (!object || governanceObjectForEvolutionItem(track.attributionId) === object))
  const scope = { skillId: skillId || undefined, skillVersion: scopedVersion, governanceObject: object, attribution: attribution || undefined, optimizationMode: optimization || undefined, query }
  const tracks = useMemo(() => governanceTracks(state, scope).filter(track => matchesCategory(track.skillId)), [state, skillId, scopedVersion, category, object, attribution, optimization, query])
  const scopedDatasetRows = datasetRows(state, scope)
  const customDatasetRows = (!skillMode || datasetCategoryFilter === 'PERSONAL') ? datasetRows(state).filter(row => row.dataset.datasetOrigin === 'USER_CUSTOM') : []
  const rows = [...scopedDatasetRows, ...customDatasetRows.filter(row => !scopedDatasetRows.some(existing => existing.dataset.id === row.dataset.id))].map(row => ({ ...row, targets: row.targets.filter(target => matchesCategory(target.skillId)) }))
    .filter(row => !category || row.targets.length > 0 || (row.dataset.datasetOrigin === 'USER_CUSTOM' && datasetCategoryFilter === 'PERSONAL'))
    .filter(row => !datasetCategoryFilter || (row.dataset.datasetCategory ?? 'GATE') === datasetCategoryFilter)
    .filter(row => !datasetTimeWindow || row.dataset.windowIds?.includes(datasetTimeWindow) || (() => {
      const selectedWindow = state.windows.find(item => item.id === datasetTimeWindow)
      if (!selectedWindow || !row.dataset.timeRange) return false
      return row.dataset.timeRange.from === selectedWindow.timeRange.from && row.dataset.timeRange.to === selectedWindow.timeRange.to
    })())
    .filter(row => {
      if ((!datasetTimeFrom && !datasetTimeTo) || customTimeInvalid) return !customTimeInvalid
      if (!row.dataset.timeRange) return false
      const from = Date.parse(row.dataset.timeRange.from)
      const to = Date.parse(row.dataset.timeRange.to)
      const lower = datasetTimeFrom ? Date.parse(datasetTimeFrom) : undefined
      const upper = datasetTimeTo ? Date.parse(datasetTimeTo) : undefined
      return (lower === undefined || to >= lower) && (upper === undefined || from <= upper)
    })
    .filter(row => !query.trim() || [row.dataset.name, row.dataset.id, row.dataset.purpose, ...row.targets.map(targetAttributionId)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selectedDatasetId = params.get('datasetId') ?? initialDatasetId
  const selectedDataset = state.datasets.find(item => item.id === selectedDatasetId)
  const selectedDatasetRow = selectedDataset ? datasetRows(state, scope).find(row => row.dataset.id === selectedDataset.id) ?? datasetRows(state).find(row => row.dataset.id === selectedDataset.id) : undefined
  const sampleRows = useMemo(() => selectedDataset ? datasetTraceRows(state, selectedDataset) : [], [state, selectedDataset])
  const availableTraceRows = useMemo(() => {
    if (!selectedDataset) return []
    const memberIds = new Set(sampleRows.map(row => row.trace.id))
    return allTraceRows(state).filter(row => !memberIds.has(row.trace.id))
  }, [state, selectedDataset, sampleRows])

  const update = (patch: Record<string, string | undefined>, clear: string[] = [], replace = true) => {
    const next = new URLSearchParams(params)
    clear.forEach(key => next.delete(key))
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace })
  }
  const datasetTimeWindows = state.windows
    .slice()
    .sort((a, b) => b.timeRange.from.localeCompare(a.timeRange.from))
  const datasetCategoryLabel = (value: string) => value === 'GATE' ? '准出数据集' : value === 'GOLDEN' ? '黄金测试集' : value === 'PERSONAL' ? '个人创建集' : value
  const selectDatasetCategory = (value: string) => update({ datasetCategory: value || undefined, datasetId: undefined }, ['datasetId'], false)
  const selectDatasetTimeWindow = (value: string) => update({ datasetTimeWindow: value || undefined, datasetTimeFrom: undefined, datasetTimeTo: undefined, datasetId: undefined }, ['datasetId'], false)
  const selectCustomDatasetTime = (key: 'datasetTimeFrom' | 'datasetTimeTo', value: string) => update({ [key]: value || undefined, datasetTimeWindow: undefined, datasetId: undefined }, ['datasetId'], false)
  const resetCustomDatasetForm = () => { setCustomDatasetName(''); setCustomDatasetDescription(''); setCustomDatasetError('') }
  const createCustomDataset = async () => {
    const name = customDatasetName.trim()
    const description = customDatasetDescription.trim()
    if (!name) { setCustomDatasetError('请输入数据集名称'); return }
    if (!description) { setCustomDatasetError('请输入描述 / 用途'); return }
    const at = new Date().toISOString()
    const id = `dataset-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await commit({ type: 'CREATE_CUSTOM_DATASET', dataset: {
      id, name, description, datasetOrigin: 'USER_CUSTOM', datasetCategory: 'PERSONAL', createdBy: '当前用户', ownerScope: 'USER',
      type: 'REGRESSION', version: 'v1', caseIds: [], sampleCount: 0, source: '用户创建', scope: description || '自定义数据集', frozen: false,
      population: { totalSampleCount: 0, localCaseCount: 0, externalSampleCount: 0, sourceSystem: '本地 Mock', countingRule: '按 Trace ID 去重' },
      purpose: '自定义数据集', setRole: 'EVALUATION', targets: [], createdAt: at, updatedAt: at
    }, meta: { actor: '当前用户', reason: '创建自定义数据集', at } } as never)
    setCustomDatasetOpen(false)
    resetCustomDatasetForm()
    update({ view: 'datasets', datasetId: id, datasetCategory: 'PERSONAL' }, DETAIL_FIELDS.filter(key => key !== 'datasetId'), false)
  }
  const addTracesToDataset = async () => {
    if (!selectedDataset || selectedDataset.frozen || !selectedTraceIds.length) return
    const at = new Date().toISOString()
    await commit({ type: 'ADD_DATASET_TRACES', datasetId: selectedDataset.id, traceIds: selectedTraceIds, meta: { actor: '当前用户', reason: '向自定义数据集添加 Trace', at } } as never)
    setSelectedTraceIds([])
    setAddTraceOpen(false)
  }
  const samplingAssets = [
    ...state.skills.flatMap(skill => (skill.versions?.length ? skill.versions : [{ version: normalizeSkillVersion(skill.version) }]).filter(item => item.version).map(item => ({ id: `${skill.id}@${item.version}`, assetId: skill.id, label: `${skill.name} · Skill`, kind: 'SKILL' as const, version: normalizeSkillVersion(item.version) }))),
    ...(['Memory', 'Reason', 'Act', 'Context', 'OTHER_BADCASE'] as const).flatMap(module => {
      const kind = module === 'OTHER_BADCASE' ? 'OTHER_BADCASE' as const : module.toUpperCase() as 'MEMORY' | 'REASON' | 'ACT' | 'CONTEXT'
      const versions = [...new Set((state.evolutionRecords ?? []).filter(record => record.target.kind === 'MODULE' && record.target.governanceObject === module).map(record => record.target.kind === 'MODULE' ? record.target.targetVersion : undefined).filter((value): value is string => Boolean(value)))]
      return (versions.length ? versions : [undefined]).map(version => ({ id: `${module}:${version ?? 'all'}`, assetId: `${module.toLowerCase()}-policy`, label: `${module} · 治理对象`, kind, version }))
    })
  ]
  const buildSamplingSnapshot = () => {
    if (!selectedDataset) return undefined
    const asset = samplingAssets.find(item => item.id === samplingAssetId) ?? samplingAssets[0]
    if (!asset) return undefined
    return buildDatasetSamplingSnapshot(state, { datasetId: selectedDataset.id, assetKind: asset.kind, assetId: asset.assetId, assetVersion: asset.version, requestedCount: Math.max(1, Number(samplingCount) || 1), createdBy: '当前用户', at: new Date().toISOString(), snapshotId: `sampling-${selectedDataset.id}-${Date.now()}` })
  }
  const samplingSnapshot = samplingOpen ? buildSamplingSnapshot() : undefined
  const confirmSampling = async () => {
    if (!selectedDataset || !samplingSnapshot || selectedDataset.frozen) return
    const at = new Date().toISOString()
    await commit({ type: 'APPLY_DATASET_SAMPLING', datasetId: selectedDataset.id, snapshot: { ...samplingSnapshot, status: 'APPLIED', updatedAt: at }, meta: { actor: '当前用户', reason: '按历史进化项占比抽样 Trace', at } } as never)
    setSamplingOpen(false)
  }
  const clearSkillScope = ['skill', 'skillId', 'skillVersion', 'skillCategory', 'governanceObject', 'attribution', 'evolutionItem', ...DETAIL_FIELDS]
  const selectCategory = (value: string) => update({ skillCategory: value || undefined }, clearSkillScope)
  const selectSkill = (value: string) => update({ skill: value || undefined, skillCategory: value ? state.skills.find(item => item.id === value)?.category : category || undefined }, clearSkillScope)
  const openDataset = (id: string) => { setRunRequest(undefined); update({ view: 'datasets', datasetId: id }, DETAIL_FIELDS.filter(key => key !== 'datasetId'), false) }
  const requestExecution = (id: string, mode: DatasetExecutionMode) => { openDataset(id); setRunRequest({ datasetId: id, mode, key: Date.now() }) }
  const openExecutionResult = (item: DatasetExecutionItem, run: DatasetExecutionRun) => {
    if (!item.caseId || !item.traceId) return
    const origin = new URLSearchParams(location.search)
    origin.set('datasetId', run.datasetId); origin.set('datasetRunId', run.id)
    navigateContext('/cases', { clear: [...params.keys()], params: { caseId: item.caseId, traceId: item.traceId, packageId: item.packageId, caseView: 'eval', environment: state.cases.find(record => record.id === item.caseId)?.environment ?? 'Staging', timeRange: '30d', businessType: 'All', agentVersion: 'All Versions', returnTo: location.pathname + '?' + origin.toString() } })
  }
  const openTrack = (track: GovernanceTrack) => update({ view: 'history', historyItem: track.key }, DETAIL_FIELDS.filter(key => key !== 'historyItem'), false)
  const openSample = (row: TraceWorkbenchRow, caseView = 'eval') => navigateContext('/cases', {
    clear: ['caseClosed', 'caseSet', 'traceSet', 'query', 'evolutionItem', 'logId', 'sessionId', 'observationId', 'evidenceId', 'skillId', 'processEval', 'outcomeEval', 'packageId'],
    params: { caseId: row.case.id, traceId: row.trace.id, caseView, returnTo: location.pathname + location.search }
  })
  const selectedTrack = linkedTrack ?? (selectedHistoryKey ? tracks.find(track => track.attributionId === selectedHistoryKey) : undefined)
  const legacyExperimentId = params.get('experimentId') ?? referencedRun?.experimentId ?? referencedWindow?.combinationExperimentId
  const legacyExperiment = state.experiments.find(item => item.id === legacyExperimentId) ?? state.experiments.find(item => item.variantIds.includes(params.get('variantId') ?? ''))

  if (params.has('evolutionRecordId') || params.has('targetId') || params.get('evolutionScope') === 'records' || genericModuleScope) return <EvolutionTargetWorkbench state={state} onNavigateReference={onNavigateReference} />

  if (params.get('view') === 'traces') {
    const pkg = state.tracePackages.find(item => item.id === params.get('packageId'))
    const evaluation = [...state.processEvals, ...state.outcomeEvals].find(item => item.id === params.get('evaluationId'))
    const artifact = state.artifacts.find(item => item.id === params.get('artifactId'))
    const rawTraceId = params.get('traceId') ?? pkg?.traceId ?? evaluation?.traceId ?? artifact?.traceId
    const traceId = rawTraceId ? resolveIdentity(state, 'trace', rawTraceId) : undefined
    const trace = state.traces.find(item => item.id === traceId)
    return <Navigate replace to={buildContextHref(location.search, '/cases', { clear: ['view', 'datasetId', 'historyItem', 'caseClosed'], params: { traceId, caseId: trace?.caseId, caseView: evaluation?.type==='OUTCOME' || artifact ? 'outcome' : 'eval', returnTo: params.get('returnTo') ?? '/datasets-evaluations' } })} />
  }

  const datasetColumns: Column<DatasetWorkbenchRow>[] = [
    { key: 'dataset', header: '测试集', accessor: row => <div className="max-w-[260px]"><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openDataset(row.dataset.id) }}>{row.dataset.name}</button><p className="mt-1 break-all font-mono text-[10px] text-muted">{row.dataset.id}</p><p className="mt-1 text-[11px] text-muted">数据集版本 {row.dataset.version}</p></div> },
    { key: 'target', header: 'Skill / 固定版本 / 归因', accessor: row => <div className="max-w-[250px] space-y-2">{row.targets.map(target => <div key={`${target.skillId}@${target.skillVersion}#${targetAttributionId(target)}`}><p>{state.skills.find(skill => skill.id === target.skillId)?.name ?? target.skillId} <span className="font-mono text-muted">{normalizeSkillVersion(target.skillVersion) || '版本未记录'}</span></p><p className="mt-1 text-[11px] text-muted">{governanceItemLabel(versionTracks.find(track => track.attributionId === targetAttributionId(target))?.definition)}</p></div>)}</div> },
    { key: 'purpose', header: '类型 / 用途 / 冻结状态', accessor: row => <div className="space-y-2"><p>{row.dataset.datasetOrigin === 'USER_CUSTOM' ? '个人创建集 · 自定义数据集' : datasetCategoryLabel(row.dataset.datasetCategory ?? 'GATE')}</p><p className="text-[11px] text-muted">{row.dataset.purpose ?? '待配置'}</p><StatusBadge status={row.dataset.frozen ? '已冻结' : '积累中'} tone={row.dataset.frozen ? 'neutral' : 'warn'} showIcon={false} /></div> },
    { key: 'samples', header: '样本', accessor: row => <div><p>{row.dataset.sampleCount} 个 Case</p><p className="mt-1 text-[10px] text-muted">{row.traceIds.length} 条可查看 Trace</p><p className="mt-1 text-[10px] text-accent">人工 Query {(state.datasetQueries ?? []).filter(query => query.datasetId === row.dataset.id && query.datasetVersion === row.dataset.version).length} 条 · 可运行 {selectDatasetExecutionInputs(state, row.dataset.id, 'GENERATE_AND_EVALUATE', 'ALL').length} 条</p></div> },
    { key: 'evaluation', header: '评测 / 准出', accessor: row => <div className="space-y-1"><p>{row.evaluationResult}</p><StatusBadge status={row.gate} label={row.gate} showIcon={false} tone={row.gate === '已准出' ? 'pass' : 'neutral'} /></div> },
    { key: 'time', header: '时间窗口', accessor: row => <span className="text-[11px] text-muted">{row.dataset.timeRange ? <>{dateText(row.dataset.timeRange.from)}<br />{dateText(row.dataset.timeRange.to)}</> : '未配置'}</span> },
    { key: 'execution', header: '执行', accessor: row => <div className="space-y-2"><Button size="sm" variant="primary" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'GENERATE_AND_EVALUATE', 'ALL').length} onClick={event => { event.stopPropagation(); requestExecution(row.dataset.id, 'GENERATE_AND_EVALUATE') }}>跑结果 &amp; 评测</Button><Button size="sm" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'EVALUATE_ONLY', 'ALL').length} onClick={event => { event.stopPropagation(); requestExecution(row.dataset.id, 'EVALUATE_ONLY') }}>仅评测已有结果</Button></div> }
    , { key: 'execution', header: '执行', accessor: row => <div className="space-y-2"><Button size="sm" variant="primary" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'GENERATE_AND_EVALUATE', 'ALL').length} onClick={event => { event.stopPropagation(); requestExecution(row.dataset.id, 'GENERATE_AND_EVALUATE') }}>跑结果 &amp; 评测</Button><Button size="sm" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'EVALUATE_ONLY', 'ALL').length} onClick={event => { event.stopPropagation(); requestExecution(row.dataset.id, 'EVALUATE_ONLY') }}>仅评测已有结果</Button><p className="text-[10px] text-muted">人工 Query {(state.datasetQueries ?? []).filter(query => query.datasetId === row.dataset.id && query.datasetVersion === row.dataset.version).length} 条 · 可运行 {selectDatasetExecutionInputs(state, row.dataset.id, 'GENERATE_AND_EVALUATE', 'ALL').length} 条</p></div> }
  ]
  const historyColumns: Column<GovernanceTrack>[] = [
    { key: 'target', header: 'Skill / 版本 / 归因', accessor: track => <div><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openTrack(track) }}>{track.title}</button><p className="mt-1 text-[10px] text-muted">{track.objectLabel} · {track.key}</p></div> },
    { key: 'method', header: '优化规则', accessor: track => <div>{track.definition.optimization}<p className="mt-1 text-[10px] text-muted">{track.definition.condition}</p></div> },
    { key: 'progress', header: '进化状态', accessor: track => <StatusBadge status={track.stateLabel} label={track.stateLabel} tone={track.active ? 'warn' : 'neutral'} showIcon={false} /> },
    { key: 'sets', header: '测试集 / 实验', accessor: track => `${track.datasetIds.length} / ${track.experimentIds.length}` },
    { key: 'updated', header: '最近更新', accessor: track => dateText(track.updatedAt) }
  ]
  const sampleColumns: Column<TraceWorkbenchRow>[] = [
    { key: 'query', header: 'Query / Trace', accessor: row => <div className="max-w-[310px]"><p className="line-clamp-3 leading-5">{row.case.query}</p><div className="mt-1"><IdLink kind="trace" id={row.trace.id} onOpen={()=>openSample(row)}/></div></div> },
    { key: 'time', header: 'Query 时间', accessor: row => dateText(row.trace.queryAt ?? row.trace.startedAt) },
    { key: 'source', header: '来源', accessor: row => resolveCaseSource(state, row.case).label },
    { key: 'score', header: '过程 / 产物（0–2）', accessor: row => <div className="space-y-1 font-mono text-[11px]"><p>过程 {formatNormalizedScoreOutOfTwo(row.rating?.processFinal)}</p><p>产物 {formatNormalizedScoreOutOfTwo(row.rating?.outcomeFinal)}</p></div> },
    { key:'governance',header:'当前治理 / 最近流转',accessor:row=><div className="min-w-[170px] space-y-2"><StatusIndicator context="execution" status={row.trace.status}/>{row.governance.branches.map(branch=>branch.currentEvent && <StatusIndicator key={branch.id} context="governance" status={branch.currentEvent.statusCode} label={`${branch.label} · ${governanceStageLabel(branch.currentEvent.stage)}`}/>)}<p className="text-[10px] text-muted">{formatGovernanceTime(row.governance.lastOccurredAt)}</p><p className="text-[10px] text-muted">{row.governance.memberships.map(member=>`${member.name} ${member.datasetVersion}`).join('、') || '尚未加入数据集'}</p></div> },
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
        <Field label="数据集时间窗口" hint="可选择已配置窗口，或使用下方两个 datetime 自定义范围。"><SelectInput aria-label="数据集时间窗口" value={datasetTimeWindow} onChange={event => selectDatasetTimeWindow(event.target.value)}><option value="">全部时间窗口</option>{datasetTimeWindows.map(window => <option key={window.id} value={window.id}>{window.name} · {dateText(window.timeRange.from)}—{dateText(window.timeRange.to)}</option>)}</SelectInput></Field>
        <Field label="自定义开始时间"><TextInput aria-label="自定义开始时间" type="datetime-local" value={datasetTimeFrom} onChange={event => selectCustomDatasetTime('datasetTimeFrom', event.target.value)} /></Field>
        <Field label="自定义结束时间"><TextInput aria-label="自定义结束时间" type="datetime-local" value={datasetTimeTo} onChange={event => selectCustomDatasetTime('datasetTimeTo', event.target.value)} /></Field>
        <Field label="数据集类型" hint="只筛选类别；准出数据集的用途在列表中查看。"><SelectInput aria-label="数据集类型" value={datasetCategoryFilter} onChange={event => selectDatasetCategory(event.target.value)}><option value="">全部类型</option><option value="GATE">准出数据集</option><option value="GOLDEN">黄金测试集</option><option value="PERSONAL">个人创建集</option></SelectInput></Field>
        {skillMode ? <div className="flex min-h-9 items-center rounded-md border border-accent/20 bg-accent/5 px-2.5 text-xs text-accent" role="status">当前治理对象：Skill</div> : <Field label="归因对象"><SelectInput aria-label="归因对象" value={object} onChange={event => update({ governanceObject: event.target.value, attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}><option value="">全部模块</option>{GOVERNANCE_OBJECTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></Field>}
        <Field label="优化条件"><SelectInput aria-label="优化条件" value={optimization} onChange={event => update({ optimizationMode: event.target.value }, DETAIL_FIELDS)}><option value="">全部条件</option><option value="直接优化">直接优化</option><option value="聚类优化">聚类优化</option><option value="待配置">待配置</option></SelectInput></Field>
        <div className="flex items-end"><Button variant="primary" icon={Plus} onClick={() => setCustomDatasetOpen(true)}>创建自定义数据集</Button></div>
      </div>
      {customTimeInvalid && <p className="mt-2 text-xs text-fail" role="alert">自定义结束时间不能早于开始时间</p>}
      {historicalSelection && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/20 bg-warn/5 p-2 text-[11px] text-muted"><span>{hasAttributionForVersion ? '已完成归因（保留历史筛选）' : '当前 Skill 版本不存在的归因'}：{attribution}。进行中下拉只显示当前版本活动项。</span><Button size="sm" variant="ghost" onClick={() => update({ attribution: undefined, evolutionItem: undefined }, DETAIL_FIELDS)}>清除此归因筛选</Button></div>}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"><TextInput className="min-w-[200px] flex-1" aria-label="搜索数据集或归因历史" value={query} onChange={event => update({ query: event.target.value })} placeholder="搜索数据集名称、ID、归因历史" /><span className="text-xs text-muted">{view === 'history' ? tracks.length : rows.length} 条结果</span><Button onClick={() => update({ governanceObject: undefined, attribution: undefined, evolutionItem: undefined, optimizationMode: undefined, query: undefined, skillVersion: selectedSkill ? latestSkillVersion(state, skillId) : undefined }, DETAIL_FIELDS)}>重置归因筛选</Button></div>
      <p className="mt-2 text-[10px] leading-4 text-muted">版本资产按固定快照展示，保留完整历史和全部数据集成员；顶部时间、环境与 Agent 版本用于线上 Case 范围。所有数据为 Mock，业务门禁未配置时不推断准出。</p>
    </section>
    {skillInfo}
    <Tabs aria-label="数据集与评测视图" activeId={view} onChange={id => update({ view: id }, DETAIL_FIELDS)} items={[{ id: 'datasets', label: '数据集', count: rows.length }, { id: 'history', label: '归因历史', count: tracks.length }]} />
    {view === 'datasets' ? <Section><SectionHeader title="评测集与准出集" description={selectedSkill ? `${selectedSkill.name} · ${version === 'all' ? '全部版本' : version} · ${attribution ? '所选归因的测试集' : '所有归因的测试集'}` : '可按 Skill 分类筛选；选中具体 Skill 后，继续按版本与归因缩小范围。'} /><DataTable className="mt-3" caption="数据集与评测列表" rows={rows} columns={datasetColumns} rowKey={row => row.dataset.id} onRowClick={row => openDataset(row.dataset.id)} empty={<EmptyState title="暂无对应测试集" description="当前范围暂无匹配测试集；可切换 Skill、版本、归因或查看历史。" />} /></Section> : <Section><SectionHeader title="归因与进化历史" description="各 Skill 固定版本独立留存；包括待进行、进行中与已完成的归因，不跨版本合并。" /><DataTable className="mt-3" caption="归因历史列表" rows={tracks} columns={historyColumns} rowKey={track => track.key} onRowClick={openTrack} empty={<EmptyState title="暂无归因历史" description="当前对象尚无归因记录，或筛选条件无匹配。" />} /></Section>}
    <Drawer open={Boolean(selectedDataset)} width="max-w-5xl" title={`数据集详情 · ${selectedDataset?.name ?? ''}`} description={selectedDataset ? `${selectedDataset.id} · ${selectedDataset.version}` : ''} closeLabel="关闭数据集详情" onClose={() => { setRunRequest(undefined); update({ datasetId: undefined }) }}>
      {selectedDataset && <div className="space-y-5"><Section><SectionHeader title="数据集信息" actions={<div className="flex flex-wrap gap-2">{(selectedDataset.datasetOrigin === 'USER_CUSTOM' || selectedDataset.ownerScope === 'USER') && !selectedDataset.frozen && <><Button size="sm" icon={Upload} onClick={() => setAddTraceOpen(true)}>添加已有 Trace</Button><Button size="sm" icon={Shuffle} onClick={() => { const preferred = selectedSkill ? `${selectedSkill.id}@${version !== 'all' ? version : latestSkillVersion(state, selectedSkill.id)}` : samplingAssets.find(asset => asset.id === 'skill-ppt-builder@2.6.0')?.id ?? samplingAssets[0]?.id ?? ''; setSamplingAssetId(preferred); setSamplingOpen(true) }}>按资产均匀抽样</Button></>}</div>} /><KeyValueGrid className="mt-3" items={[{ label: '分类', value: selectedDataset.datasetOrigin === 'USER_CUSTOM' ? '个人创建集 · 自定义数据集' : datasetCategoryLabel(selectedDataset.datasetCategory ?? 'GATE') }, { label: '用途', value: selectedDataset.purpose }, { label: '数据集版本 / 冻结状态', value: `${selectedDataset.version} · ${selectedDataset.frozen ? '已冻结' : '积累中'}` }, { label: '样本时间范围', value: selectedDataset.timeRange ? `${dateText(selectedDataset.timeRange.from)} — ${dateText(selectedDataset.timeRange.to)}` : '未配置（加入 Trace 后自动计算）' }, { label: '总样本量', value: `${selectedDataset.sampleCount} 个 Case` }, { label: '本地可查看', value: `${selectedDataset.population.localCaseCount} 个 Case / ${sampleRows.length} 条 Trace` }, { label: '外部 Mock 样本', value: `${selectedDataset.population.externalSampleCount} 个 Case（未展开，不伪造 Trace）` }, { label: '样本范围', value: selectedDataset.scope }]} />{selectedDataset.description && <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted">{selectedDataset.description}</p>}<p className="mt-3 text-[11px] leading-5 text-muted">{selectedDataset.population.countingRule}</p><div className="mt-3 space-y-1 text-xs">{selectedDataset.targets?.map(target => <p key={`${target.skillId}@${target.skillVersion}#${targetAttributionId(target)}`}>{state.skills.find(skill => skill.id === target.skillId)?.name ?? target.skillId} · {normalizeSkillVersion(target.skillVersion) || '版本未记录'} · {targetAttributionId(target)}</p>)}</div></Section>
      <Section><SectionHeader title="样本 Trace" description="一行对应一次任务执行；完整过程、评测 Reason 与 Evidence 在 Case / Trace 分析查看。" /><DataTable className="mt-3" caption="数据集样本 Trace" rows={sampleRows} columns={sampleColumns} rowKey={row => row.trace.id} onRowClick={row=>openSample(row)} /></Section>
      <Section><SectionHeader title="实验与准出" /><div className="mt-3 space-y-3">{selectedDatasetRow?.experimentIds.length ? selectedDatasetRow.experimentIds.map(id => <div key={id} className="rounded border border-line p-3"><IdLink id={id} kind="experiment" onOpen={navigation.open} /><p className="mt-2 text-xs text-muted">{selectedDatasetRow.gate} · {state.experiments.find(item => item.id === id)?.name}</p></div>) : <p className="text-xs text-muted">尚未关联实验；不会从样本评测完成状态推断准出。</p>}</div></Section><DatasetExecutionWorkbench dataset={selectedDataset} requestMode={runRequest?.datasetId === selectedDataset.id ? runRequest.mode : undefined} requestKey={runRequest?.datasetId === selectedDataset.id ? runRequest.key : undefined} onNavigateResult={openExecutionResult} /></div>}
    </Drawer>
    <Modal open={customDatasetOpen} title="创建自定义数据集" description="填写基本信息后创建一个可继续添加 Query / Trace 的本地数据集。分类固定为个人创建集。" closeLabel="关闭创建自定义数据集" onClose={() => { setCustomDatasetOpen(false); resetCustomDatasetForm() }} footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setCustomDatasetOpen(false); resetCustomDatasetForm() }}>取消</Button><Button variant="primary" onClick={createCustomDataset}>确认创建</Button></div>}>
      <div className="space-y-4"><Field label="数据集名称" required error={customDatasetError}><TextInput aria-label="数据集名称" value={customDatasetName} onChange={event => { setCustomDatasetName(event.target.value); setCustomDatasetError('') }} placeholder="例如：PPT 红色品味回归集" /></Field><Field label="描述 / 用途" required hint="用于记录这组 Trace 的业务目的和抽样范围。"><TextArea aria-label="描述 / 用途" value={customDatasetDescription} onChange={event => { setCustomDatasetDescription(event.target.value); setCustomDatasetError('') }} placeholder="描述这个测试集要验证的场景、来源或迭代目的" /></Field><KeyValueGrid items={[{ label: '数据集分类', value: '个人创建集 · 自定义数据集' }, { label: '数据来源', value: '本地 Mock / 手动添加' }, { label: '初始样本', value: '0 条 Trace' }]} /></div>
    </Modal>
    <Modal open={addTraceOpen} size="lg" title="添加已有 Trace" description={selectedDataset ? `向「${selectedDataset.name}」添加尚未加入的 Trace；冻结数据集不可继续添加。` : ''} closeLabel="关闭添加已有 Trace" onClose={() => { setAddTraceOpen(false); setSelectedTraceIds([]) }} footer={<div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">已选择 {selectedTraceIds.length} 条 Trace</span><div className="flex gap-2"><Button variant="ghost" onClick={() => { setAddTraceOpen(false); setSelectedTraceIds([]) }}>取消</Button><Button variant="primary" disabled={!selectedTraceIds.length} onClick={addTracesToDataset}>确认添加</Button></div></div>}>
      <div className="max-h-[420px] space-y-2 overflow-y-auto">{availableTraceRows.length ? availableTraceRows.map(row => <label key={row.trace.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-slate-50"><input type="checkbox" aria-label={`选择 Trace ${row.trace.id}`} checked={selectedTraceIds.includes(row.trace.id)} onChange={event => setSelectedTraceIds(current => event.target.checked ? [...current, row.trace.id] : current.filter(id => id !== row.trace.id))} className="mt-1" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 text-xs font-medium">{row.case.query}</span><span className="mt-1 block font-mono text-[10px] text-muted">{row.trace.id} · {dateText(row.trace.queryAt ?? row.trace.startedAt)}</span></span></label>) : <EmptyState title="暂无可添加 Trace" description="所有本地 Trace 已在该数据集，或当前没有可用的 Mock Trace。" />}</div>
    </Modal>
    <Modal open={samplingOpen} size="lg" title="按资产均匀抽样 Trace" description="按所选资产的每个历史归因项经历过的 Trace 占比计算配额；同一 Trace 命中多个归因项时只保留一份。" closeLabel="关闭均匀抽样" onClose={() => setSamplingOpen(false)} footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSamplingOpen(false)}>取消</Button><Button variant="primary" disabled={!samplingSnapshot?.candidateTraceIds.length} onClick={confirmSampling}>确认抽样并加入</Button></div>}>
      <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="自进化资产"><SelectInput aria-label="自进化资产" value={samplingAssetId} onChange={event => setSamplingAssetId(event.target.value)}>{samplingAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.label}{asset.version ? ` · ${asset.version}` : ''}</option>)}</SelectInput></Field><Field label="目标 Trace 数" hint="抽样配额按历史进化项占比计算。"><TextInput aria-label="目标 Trace 数" type="number" min={1} value={samplingCount} onChange={event => setSamplingCount(event.target.value)} /></Field></div>{samplingSnapshot ? <><KeyValueGrid items={[{ label: '候选历史 Trace', value: `${samplingSnapshot.candidateTraceIds.length} 条（去重后）` }, { label: '抽样规则', value: '按历史归因项 Trace 占比' }, { label: '数据集', value: selectedDataset?.name ?? '未选择' }]} /><div className="overflow-hidden rounded-md border border-line"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-muted"><tr><th className="px-3 py-2">归因</th><th className="px-3 py-2">历史 Trace</th><th className="px-3 py-2">占比</th><th className="px-3 py-2">目标配额</th><th className="px-3 py-2">实际抽样</th></tr></thead><tbody>{samplingSnapshot.allocations.map(item => <tr key={item.evolutionRecordId} className="border-t border-line"><td className="px-3 py-2"><span className="line-clamp-2">{item.attributionLabel}</span><span className="font-mono text-[10px] text-muted">{item.evolutionRecordId}</span></td><td className="px-3 py-2 font-mono">{item.historicalTraceCount}</td><td className="px-3 py-2 font-mono">{(item.historicalShare * 100).toFixed(1)}%</td><td className="px-3 py-2 font-mono">{item.requestedCount}</td><td className="px-3 py-2 font-mono">{item.sampledTraceIds.length}</td></tr>)}</tbody></table>{!samplingSnapshot.allocations.length && <p className="p-4 text-xs text-muted">该资产暂无可用于抽样的历史归因 Trace。</p>}</div></> : <EmptyState title="请选择资产" description="选择一个 Skill 或治理对象后预览历史进化项配额。" />}</div>
    </Modal>
    <AttributionHistoryDrawer state={state} track={selectedTrack} decisionId={params.get('decisionId') ?? undefined} onClose={() => update({}, DETAIL_FIELDS.filter(key => key !== 'datasetId'))} onNavigateReference={navigation.open} onOpenDataset={openDataset} />
    {!selectedTrack && legacyExperiment && view === 'history' && <Drawer open width="lg" title="准出与进化历史详情" closeLabel="关闭实验详情" onClose={() => update({}, DETAIL_FIELDS)}><SectionHeader title={legacyExperiment.name} description="历史实验保留原配置与版本；没有固定归因目标时不自动归属新版本。" /><p className="mt-3 font-mono text-xs">{legacyExperiment.id}</p><KeyValueGrid className="mt-4" items={[{ label: 'Baseline', value: legacyExperiment.baselineVersion }, { label: 'Candidate', value: legacyExperiment.candidateVersion }, { label: '状态', value: governanceLabel(legacyExperiment.status) }, { label: '重复次数', value: `${legacyExperiment.configSnapshot.repeatCount} 次 / Case` }]} /></Drawer>}
    {navigation.drawer}
  </div>
}

/** A precise module path owns its target, datasets and reports; legacy Skill browsing stays independent. */
function EvolutionTargetWorkbench({ state, onNavigateReference }: { state: EvolutionState; onNavigateReference?: (target: ReferenceTarget) => void }) {
  const [runRequest, setRunRequest] = useState<{ datasetId: string; mode: DatasetExecutionMode; key: number }>()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const { navigateContext } = useContextNavigation()
  const navigation = useReferenceNavigation(onNavigateReference)
  const recordId = params.get('evolutionRecordId') ?? ''
  const exactRecord = (state.evolutionRecords ?? []).find(record => record.id === recordId)
  const object = exactRecord?.target.governanceObject ?? validObject(params.get('governanceObject'))
  const targetId = exactRecord ? targetIdentityId(exactRecord.target) : object === 'Skill' ? params.get('skill') ?? params.get('skillId') ?? params.get('targetId') ?? '' : params.get('targetId') ?? ''
  const attribution = exactRecord?.target.attributionId ?? params.get('attribution') ?? ''
  const skillId = exactRecord?.target.kind === 'SKILL' ? exactRecord.target.skillId : object === 'Skill' ? params.get('skill') ?? params.get('skillId') ?? targetId : ''
  const selectedSkill = state.skills.find(skill => skill.id === skillId)
  const targetVersion = exactRecord ? targetIdentityVersion(exactRecord.target) ?? '' : object === 'Skill' ? params.get('skillVersion') ?? params.get('targetVersion') ?? (selectedSkill ? latestSkillVersion(state, skillId) : '') : params.get('targetVersion') ?? ''
  const category = object === 'Skill' ? selectedSkill?.category ?? params.get('skillCategory') ?? '' : ''
  const view = params.get('view') === 'history' ? 'history' : 'datasets'
  const query = params.get('query') ?? ''
  const records = filterEvolutionRecords(state, { evolutionRecordId: recordId || undefined, governanceObject: object, targetId: targetId || undefined, targetVersion: targetVersion && targetVersion !== 'all' ? targetVersion : undefined, skillId: object === 'Skill' ? skillId || undefined : undefined, skillCategory: category || undefined, attribution: attribution || undefined })
  const rows = evolutionDatasetRows(state, records).filter(row => !query.trim() || [row.dataset.id, row.dataset.name, row.dataset.purpose].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const historyRows = records.filter(record => !query.trim() || [record.name, record.id, evolutionRecordAttributionLabel(record)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const requestedDatasetId = params.get('datasetId') ?? ''
  const requestedDatasetRecordId = params.get('datasetRecordId') ?? ''
  const matchingDatasetRows = rows.filter(row => row.dataset.id === requestedDatasetId)
  const selectedRow = requestedDatasetRecordId ? matchingDatasetRows.find(row => row.evolutionRecords.some(record => record.id === requestedDatasetRecordId)) : matchingDatasetRows.length === 1 ? matchingDatasetRows[0] : undefined
  const samples = selectedRow ? datasetTraceRows(state, selectedRow.dataset) : []
  const selectedHistory = records.find(record => record.id === params.get('historyRecordId')) ?? (view === 'history' && params.get('recordHistoryClosed') !== '1' ? exactRecord : undefined)
  const targetRecords = filterEvolutionRecords(state, { governanceObject: object, targetId: targetId || undefined })
  const targetOptions = [...new Map(filterEvolutionRecords(state, { governanceObject: object }).map(record => [targetIdentityId(record.target), record])).values()]
  const versionOptions = [...new Set(targetRecords.map(record => targetIdentityVersion(record.target)).filter((value): value is string => Boolean(value)))]
  const attributionOptions = [...new Map(targetRecords.filter(record => !targetVersion || targetIdentityVersion(record.target) === targetVersion).map(record => [record.target.attributionId, record])).values()]
  const detailFields = [...DETAIL_FIELDS, 'datasetRecordId', 'historyRecordId', 'recordHistoryClosed']
  const targetFields = ['evolutionRecordId', 'targetId', 'targetVersion', 'skill', 'skillId', 'skillVersion', 'skillCategory', 'attribution', 'evolutionItem', ...detailFields]
  const update = (patch: Record<string, string | undefined>, clear: string[] = [], replace = true) => {
    const next = new URLSearchParams(params)
    clear.forEach(key => next.delete(key))
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace })
  }
  // Old copied URLs may still contain Skill fields. Canonical module scope clears them atomically.
  useEffect(() => {
    const next = new URLSearchParams(params)
    next.set('evolutionScope', 'records')
    if (!exactRecord) {
      if (object && object !== 'Skill') ['skill', 'skillId', 'skillVersion', 'skillCategory'].forEach(key => next.delete(key))
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
      return
    }
    next.set('governanceObject', exactRecord.target.governanceObject)
    next.set('targetId', targetIdentityId(exactRecord.target))
    const version = targetIdentityVersion(exactRecord.target)
    if (version) next.set('targetVersion', version); else next.delete('targetVersion')
    next.set('attribution', exactRecord.target.attributionId)
    next.delete('evolutionItem')
    if (exactRecord.target.kind === 'MODULE') ['skill', 'skillId', 'skillVersion', 'skillCategory'].forEach(key => next.delete(key))
    else {
      next.set('skill', exactRecord.target.skillId); next.delete('skillId')
      next.set('skillVersion', exactRecord.target.skillVersion)
      if (selectedSkill?.category) next.set('skillCategory', selectedSkill.category)
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [params, exactRecord, selectedSkill, object, setParams])
  const returnToUnifiedDatasetView = params.get('evolutionScope') === 'records' && view === 'datasets' && !recordId && !targetId
  if (returnToUnifiedDatasetView) {
    const next = new URLSearchParams(params)
    ;['evolutionScope', 'targetId', 'targetVersion', 'historyRecordId', 'recordHistoryClosed'].forEach(key => next.delete(key))
    next.set('view', 'datasets')
    return <Navigate replace to={`${location.pathname}?${next.toString()}`} />
  }
  const openDataset = (id: string, ownerId?: string) => update({ view: 'datasets', datasetId: id, datasetRecordId: ownerId ?? selectedHistory?.id ?? exactRecord?.id }, detailFields.filter(key => key !== 'datasetId'), false)
  const openExecutionResult = (item: DatasetExecutionItem, run: DatasetExecutionRun) => {
    if (!item.caseId || !item.traceId) return
    const origin = new URLSearchParams(location.search)
    origin.set('datasetId', run.datasetId); origin.set('datasetRunId', run.id)
    navigateContext('/cases', { clear: [...params.keys()], params: { caseId: item.caseId, traceId: item.traceId, packageId: item.packageId, caseView: 'eval', environment: state.cases.find(record => record.id === item.caseId)?.environment ?? 'Staging', timeRange: '30d', businessType: 'All', agentVersion: 'All Versions', returnTo: location.pathname + '?' + origin.toString() } })
  }
  const openRecord = (record: EvolutionRecord) => {
    const scoped = new URLSearchParams(buildEvolutionWorkbenchHref(record, 'history', params.get('returnTo') ?? undefined).split('?')[1] ?? '')
    const next = new URLSearchParams(params)
    targetFields.forEach(key => next.delete(key))
    scoped.forEach((value, key) => next.set(key, value))
    next.set('historyRecordId', record.id)
    setParams(next, { replace: false })
  }
  const openScopedReference = (target: ReferenceTarget) => {
    if (target.kind === 'dataset' && rows.some(row => row.dataset.id === target.id)) { openDataset(target.id); return }
    const keys: Partial<Record<ReferenceTarget['kind'], { query: string; ids: (record: EvolutionRecord) => string[] }>> = {
      experiment: { query: 'experimentId', ids: record => [...record.singleExperimentIds, ...record.windowExperimentIds] },
      decision: { query: 'decisionId', ids: record => record.decisionIds }, release: { query: 'releaseId', ids: record => record.releaseIds },
      variant: { query: 'variantId', ids: record => record.variantIds }, finding: { query: 'findingId', ids: record => record.sourceFindingIds },
      attribution: { query: 'attributionId', ids: record => record.sourceAttributionIds }, issue: { query: 'issueId', ids: record => record.sourceIssueIds },
      cluster: { query: 'clusterId', ids: record => record.sourceClusterIds }
    }
    const entry = keys[target.kind]
    const owner = entry ? records.find(record => entry.ids(record).includes(target.id)) : undefined
    if (entry && owner) { update({ view: 'history', historyRecordId: owner.id, [entry.query]: target.id }, ['datasetId', 'datasetRecordId', 'recordHistoryClosed'], false); return }
    navigation.open(target)
  }
  const openSample = (row: TraceWorkbenchRow) => navigateContext('/cases', {
    clear: ['caseClosed', 'caseSet', 'traceSet', 'query', 'evolutionItem', 'logId', 'sessionId', 'observationId', 'evidenceId', 'skillId', 'processEval', 'outcomeEval', 'packageId', 'targetId', 'targetVersion', 'evolutionRecordId', 'evolutionScope', 'historyRecordId', 'recordHistoryClosed', 'datasetId', 'datasetRecordId', 'historyItem', 'experimentId', 'decisionId', 'releaseId'],
    params: { caseId: row.case.id, traceId: row.trace.id, caseView: 'eval', returnTo: location.pathname + location.search }
  })
  const columns: Column<EvolutionDatasetRow>[] = [
    { key: 'dataset', header: '测试集', accessor: row => <div className="max-w-[250px]"><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openDataset(row.dataset.id, row.evolutionRecords[0]?.id) }}>{row.dataset.name}</button><p className="mt-1 break-all font-mono text-[10px] text-muted">{row.dataset.id}</p><p className="mt-1 text-[11px] text-muted">数据集版本 {row.dataset.version}</p></div> },
    { key: 'target', header: '治理对象 / 固定源版本 / 归因', accessor: row => <div className="max-w-[250px] space-y-2">{row.evolutionRecords.map(record => <div key={record.id}><p>{evolutionTargetLabel(state, record.target)} · {targetIdentityVersion(record.target) || '版本未记录'}</p><p className="mt-1 text-[11px] text-muted">{evolutionRecordAttributionLabel(record)}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">{record.id}</p></div>)}</div> },
    { key: 'purpose', header: '用途 / 冻结状态', accessor: row => <div className="space-y-2"><p>{row.dataset.purpose ?? '待配置'}</p><StatusBadge status={row.dataset.frozen ? '已冻结' : '积累中'} tone={row.dataset.frozen ? 'neutral' : 'warn'} showIcon={false} /><p className="text-[10px] text-muted">{row.experimentType}</p></div> },
    { key: 'samples', header: '样本', accessor: row => `${row.dataset.sampleCount} 个 Case / ${row.traceIds.length} 条 Trace` },
    { key: 'gate', header: '评测 / 准出', accessor: row => <div className="space-y-1"><p>{row.evaluationResult}</p><StatusBadge status={row.gate} label={row.gate} showIcon={false} tone={row.gate === '已准出' ? 'pass' : 'neutral'} /></div> },
    { key: 'time', header: '时间窗口', accessor: row => row.dataset.timeRange ? <span className="text-[11px] text-muted">{dateText(row.dataset.timeRange.from)}<br />{dateText(row.dataset.timeRange.to)}</span> : '未配置' },
    { key: 'execution', header: '执行', accessor: row => <div className="space-y-2"><Button size="sm" variant="primary" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'GENERATE_AND_EVALUATE', 'ALL').length} onClick={event => { event.stopPropagation(); openDataset(row.dataset.id, row.evolutionRecords[0]?.id); setRunRequest({ datasetId: row.dataset.id, mode: 'GENERATE_AND_EVALUATE', key: Date.now() }) }}>跑结果 &amp; 评测</Button><Button size="sm" disabled={!selectDatasetExecutionInputs(state, row.dataset.id, 'EVALUATE_ONLY', 'ALL').length} onClick={event => { event.stopPropagation(); openDataset(row.dataset.id, row.evolutionRecords[0]?.id); setRunRequest({ datasetId: row.dataset.id, mode: 'EVALUATE_ONLY', key: Date.now() }) }}>仅评测已有结果</Button></div> }
  ]
  const historyColumns: Column<EvolutionRecord>[] = [
    { key: 'target', header: '治理对象 / 版本 / 归因', accessor: record => <div className="max-w-[330px]"><button type="button" className="text-left font-semibold text-accent hover:underline" onClick={event => { event.stopPropagation(); openRecord(record) }}>{record.name}</button><p className="mt-1 text-[11px] text-muted">{evolutionTargetLabel(state, record.target)} · {targetIdentityVersion(record.target) || '版本未记录'}</p><p className="mt-1 text-[11px]">{evolutionRecordAttributionLabel(record)}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">{record.id}</p></div> },
    { key: 'method', header: '优化方式', accessor: record => record.optimizationMode ? governanceLabel(record.optimizationMode) : '待配置' },
    { key: 'progress', header: '本轮状态', accessor: record => { const selection = selectEvolutionRecord(state, record.id); return <div className="space-y-2 text-[11px]">{selection?.paths.map(path => <p key={path.id}>{path.label} · {path.routing.label} · {path.gate.label} · {path.release.label}</p>)}{!selection?.paths.length && <p>来源路径未关联</p>}</div> } },
    { key: 'sets', header: '测试集 / 实验', accessor: record => { const selection = selectEvolutionRecord(state, record.id); return `${selection?.datasets.length ?? 0} / ${selection?.experiments.length ?? 0}` } },
    { key: 'time', header: '创建 / 更新', accessor: record => <span className="text-[11px] text-muted">{dateText(record.createdAt)}<br />{dateText(record.updatedAt)}</span> }
  ]
  const sampleColumns: Column<TraceWorkbenchRow>[] = [
    { key: 'query', header: 'Query / Trace', accessor: row => <div className="max-w-[340px]"><p className="line-clamp-3 leading-5">{row.case.query}</p><div className="mt-1"><IdLink id={row.trace.id} kind="trace" onOpen={() => openSample(row)} /></div></div> },
    { key: 'time', header: 'Query 时间', accessor: row => dateText(row.trace.queryAt ?? row.trace.startedAt) },
    { key: 'source', header: '来源', accessor: row => resolveCaseSource(state, row.case).label },
    { key: 'score', header: '过程 / 产物（0–2）', accessor: row => <span className="font-mono text-[11px]">{formatNormalizedScoreOutOfTwo(row.rating?.processFinal)} / {formatNormalizedScoreOutOfTwo(row.rating?.outcomeFinal)}</span> },
    { key: 'action', header: '分析', accessor: row => <Button variant="ghost" size="sm" icon={ArrowRight} onClick={() => openSample(row)}>查看 Case / Trace</Button> }
  ]
  return <div className="space-y-4">
    <section aria-label="治理范围筛选" className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel"><p className="mb-3 text-xs leading-5 text-muted">{exactRecord ? '当前范围来自模块归因的独立进化轮次，只展示明确关联的评测集、准出集和历史报告。' : '按治理对象、具体目标和固定源版本查看独立进化轮次。'}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {object === 'Skill' ? <><Field label="Skill 分类"><SelectInput aria-label="Skill 分类" value={category} onChange={event => update({ skillCategory: event.target.value || undefined, governanceObject: 'Skill' }, targetFields)}><option value="">全部分类</option>{SKILL_CATEGORIES.map(item => <option key={item} value={item}>{skillCategoryLabel(item)}</option>)}</SelectInput></Field><Field label="具体 Skill"><SelectInput aria-label="具体 Skill" value={skillId} onChange={event => update({ skill: event.target.value || undefined, governanceObject: 'Skill', skillCategory: state.skills.find(skill => skill.id === event.target.value)?.category }, targetFields)}><option value="">全部 Skill</option>{state.skills.filter(skill => !category || skill.category === category).map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</SelectInput></Field><Field label="Skill 版本"><SelectInput aria-label="Skill 版本" value={targetVersion} onChange={event => update({ skill: skillId, skillVersion: event.target.value, governanceObject: 'Skill', skillCategory: category || undefined }, ['targetVersion', 'targetId', 'evolutionRecordId', 'attribution', ...detailFields])}>{!skillVersions(state, skillId).some(version => version.version === normalizeSkillVersion(targetVersion)) && <option value={targetVersion}>{targetVersion || '版本未记录'}</option>}{skillVersions(state, skillId).map(version => <option key={version.id} value={version.version}>{version.version} · {VERSION_STATUS[version.status]}</option>)}</SelectInput></Field></> : <><Field label="归因对象"><SelectInput aria-label="归因对象" value={object} onChange={event => update({ governanceObject: event.target.value || undefined }, targetFields)}><option value="">全部模块</option>{GOVERNANCE_OBJECTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></Field><Field label="具体治理目标"><SelectInput aria-label="具体治理目标" value={targetId} onChange={event => update({ targetId: event.target.value || undefined }, ['evolutionRecordId', 'targetVersion', 'attribution', ...detailFields])}><option value="">全部目标</option>{targetOptions.map(record => <option key={targetIdentityId(record.target)} value={targetIdentityId(record.target)}>{evolutionTargetLabel(state, record.target)}</option>)}</SelectInput></Field><Field label="目标源版本"><SelectInput aria-label="目标源版本" value={targetVersion} onChange={event => update({ targetVersion: event.target.value || undefined }, ['evolutionRecordId', 'attribution', ...detailFields])}><option value="">全部已记录版本</option>{versionOptions.map(version => <option key={version} value={version}>{version}</option>)}</SelectInput></Field></>}
      <Field label="归因"><SelectInput aria-label="归因" value={attribution} onChange={event => update({ attribution: event.target.value || undefined }, ['evolutionRecordId', ...detailFields])}><option value="">全部归因</option>{attributionOptions.map(record => <option key={record.target.attributionId} value={record.target.attributionId}>{evolutionRecordAttributionLabel(record)}</option>)}</SelectInput></Field>
    </div><div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"><TextInput aria-label="搜索数据集或归因历史" className="min-w-[200px] flex-1" value={query} onChange={event => update({ query: event.target.value })} placeholder="搜索数据集名称、ID、归因历史" /><span className="text-xs text-muted">{view === 'history' ? historyRows.length : rows.length} 条结果</span><Button variant="ghost" onClick={() => update({ query: undefined }, ['evolutionRecordId', ...detailFields])}>查看该目标全部轮次</Button></div></section>
    {exactRecord && <section aria-label="独立进化轮次信息" className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">{exactRecord.name}</h2><p className="mt-1 break-all font-mono text-[11px] text-muted">{exactRecord.id}</p></div><Button variant="ghost" icon={History} onClick={() => update({ view: 'history', recordHistoryClosed: undefined }, detailFields)}>查看本轮历史与准出报告</Button></div><KeyValueGrid className="mt-4 border-t border-line pt-3" items={[{ label: '治理对象', value: evolutionTargetLabel(state, exactRecord.target) }, { label: '固定源版本', value: targetVersion || '版本未记录' }, { label: '归因', value: evolutionRecordAttributionLabel(exactRecord) }, { label: '优化方式', value: exactRecord.optimizationMode ? governanceLabel(exactRecord.optimizationMode) : '待配置' }]} /></section>}
    {recordId && !exactRecord && <EmptyState title="进化轮次不存在" description="当前轮次没有明确台账；不会回退到整个 Skill 或模块的其他结果。" />}
    <Tabs aria-label="数据集与评测视图" activeId={view} onChange={id => update({ view: id }, detailFields)} items={[{ id: 'datasets', label: '数据集', count: rows.length }, { id: 'history', label: '归因历史', count: historyRows.length }]} />
    {view === 'datasets' ? <Section><SectionHeader title="评测集与准出集" description="数据集名称、用途和版本分别展示；复用数据集按进化轮次分行，准出结论只来自该行轮次的实验。" /><DataTable className="mt-3" caption="数据集与评测列表" rows={rows} columns={columns} rowKey={row => row.key} onRowClick={row => openDataset(row.dataset.id, row.evolutionRecords[0]?.id)} empty={<EmptyState title="暂无对应测试集" description="本轮尚未关联评测集或准出集，不展示其他轮次的测试集。" />} /></Section> : <Section><SectionHeader title="归因与进化历史" description="目标、固定源版本和独立轮次分开留存。" /><DataTable className="mt-3" caption="归因历史列表" rows={historyRows} columns={historyColumns} rowKey={record => record.id} onRowClick={openRecord} empty={<EmptyState title="暂无归因历史" description="当前范围没有独立进化轮次。" />} /></Section>}
    {requestedDatasetId && !selectedRow && <p className="rounded border border-warn/20 bg-warn/5 p-3 text-xs text-muted" role="status">{!requestedDatasetRecordId && matchingDatasetRows.length > 1 ? '该数据集属于多个进化轮次，请在列表中选择对应轮次。' : '该数据集未关联当前进化轮次，或被当前搜索条件过滤；不会显示其他目标报告。'}</p>}
    <Drawer open={Boolean(selectedRow)} width="max-w-5xl" title={`数据集详情 · ${selectedRow?.dataset.name ?? ''}`} description={selectedRow ? `${selectedRow.dataset.id} · ${selectedRow.dataset.version}` : ''} closeLabel="关闭数据集详情" onClose={() => update({ datasetId: undefined, datasetRecordId: undefined })}>{selectedRow && <div className="space-y-5"><Section><SectionHeader title="数据集信息" /><KeyValueGrid className="mt-3" items={[{ label: '用途', value: selectedRow.dataset.purpose ?? '待配置' }, { label: '版本 / 冻结', value: `${selectedRow.dataset.version} · ${selectedRow.dataset.frozen ? '已冻结' : '积累中'}` }, { label: '样本量', value: `${selectedRow.dataset.sampleCount} 个 Case / ${samples.length} 条本地 Trace` }, { label: '统计口径', value: selectedRow.dataset.population.countingRule }]} /><div className="mt-3 space-y-2 text-xs">{selectedRow.evolutionRecords.map(record => <p key={record.id}>{evolutionTargetLabel(state, record.target)} · {targetIdentityVersion(record.target) || '版本未记录'} · {evolutionRecordAttributionLabel(record)} · {record.id}</p>)}</div></Section><DatasetExecutionWorkbench dataset={selectedRow.dataset} requestMode={runRequest?.datasetId === selectedRow.dataset.id ? runRequest.mode : undefined} requestKey={runRequest?.datasetId === selectedRow.dataset.id ? runRequest.key : undefined} onNavigateResult={openExecutionResult} /><Section><SectionHeader title="样本 Trace" description="查看对应样本的评分、Reason 和 Evidence，请进入 Case / Trace 分析。" /><DataTable className="mt-3" caption="数据集样本 Trace" rows={samples} columns={sampleColumns} rowKey={row => row.trace.id} onRowClick={openSample} /></Section><Section><SectionHeader title="本轮实验与准出" /><div className="mt-3 space-y-3">{selectedRow.experimentIds.map(id => <div key={id} className="rounded border border-line p-3 text-xs"><IdLink id={id} kind="experiment" onOpen={() => { const owner = selectedRow.evolutionRecords.find(record => selectEvolutionRecord(state, record.id)?.experiments.some(experiment => experiment.id === id)); if (owner) update({ view: 'history', experimentId: id, historyRecordId: owner.id }, ['datasetId', 'datasetRecordId', 'recordHistoryClosed'], false) }} /><p className="mt-2 text-muted">{selectedRow.gate} · {state.experiments.find(experiment => experiment.id === id)?.name}</p></div>)}{!selectedRow.experimentIds.length && <p className="text-xs text-muted">尚未关联本轮实验；不会借用同一数据集的其他准出结论。</p>}</div></Section></div>}</Drawer>
    <EvolutionRecordHistoryDrawer state={state} record={selectedHistory} decisionId={params.get('decisionId') ?? undefined} onClose={() => update({ historyRecordId: undefined, recordHistoryClosed: '1' }, detailFields.filter(key => key !== 'datasetId'))} onOpenDataset={openDataset} onNavigateReference={openScopedReference} />
    {navigation.drawer}
  </div>
}
