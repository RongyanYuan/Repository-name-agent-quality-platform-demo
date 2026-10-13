import { Download, Library, LockKeyhole, Plus, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AssetPerformanceChart, type AssetScorePoint } from '../components/AssetPerformanceChart'
import { AssetVersionStatusBadge } from '../components/AssetVersionStatusBadge'
import { AssetCategoryPerformanceTable } from '../components/AssetCategoryPerformanceTable'
import { AssetPerformanceMetrics } from '../components/AssetPerformanceMetrics'
import { selectAssetCategoryWorkbench } from '../data/assetCategoryWorkbench'
import { enrichAssetManagementFixtures, selectAssetEvolutionSourceDatasetIds } from '../data/assetManagement'
import { Button, DataTable, Field, FilterBar, Modal, SectionHeader, SelectInput, Sparkline, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui'
import type { Asset, AssetCatalogEntry, AssetCatalogKind, AssetEvolutionContribution, AssetPerformanceRecord, AssetVersion, EvolutionState, Skill } from '../domain'
import { EntityId, IdLink, KeyValueGrid, MockBoundary, TagList, type ReferenceTarget } from '../components/ViewPrimitives'
import { useEvolution } from '../store'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useContextNavigation, DETAIL_KEYS } from '../../layout'
import { skillCategoryLabel } from '../labels'
import { dateText, entities, Section, strings, text, type AnyEntity, type AnyState, useReferenceNavigation } from './shared'

type AssetTypeFilter = AssetCatalogKind | ''
type ViewCatalog = AssetCatalogEntry & { id: string }
type ViewVersion = AssetVersion & { id: string }
type ViewPerformance = AssetPerformanceRecord & { id: string }
type ViewContribution = AssetEvolutionContribution & { id: string }
type AssetState = EvolutionState & { assetCatalog?: AssetCatalogEntry[]; assetVersions?: AssetVersion[]; assetPerformanceRecords?: AssetPerformanceRecord[]; assetEvolutionContributions?: AssetEvolutionContribution[] }

const ASSET_TYPE_OPTIONS: Array<{ value: AssetCatalogKind; label: string }> = [
  { value: 'TASTE_SKILL', label: '品味库 Skill' }, { value: 'PRODUCTION_SKILL', label: '生产 Skill' }, { value: 'PERSONAL_SKILL', label: '个人 Skill' },
  { value: 'MEMORY', label: 'Memory' }, { value: 'TOOL', label: 'Tool' }, { value: 'SYSTEM_PROMPT', label: 'System Prompt' }, { value: 'OTHER_CAPABILITY', label: '其他能力' }
]
const typeLabel = (kind: string) => ASSET_TYPE_OPTIONS.find(item => item.value === kind)?.label ?? kind
const versionStatusLabel = (status: string) => ({ ACTIVE: '当前版本', CANDIDATE: '候选版本', DEPRECATED: '历史版本', PLANNED: '待建设' } as Record<string, string>)[status] ?? status
const clampScore = (score: unknown) => typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(2, score)) : undefined
const scoreText = (score: unknown) => { const value = clampScore(score); return value === undefined ? '暂无评测结果' : `${value.toFixed(2)} / 2` }
const monthOf = (value: string) => value.slice(0, 7)
/** Empty keeps the default latest-version view; this explicit value is used
 * when the user asks for the complete historical version set. */
const ALL_ASSET_VERSIONS_VALUE = '__ALL_ASSET_VERSIONS__'
const contributionStatusLabel = (status: string) => ({ HISTORICAL: '已记录', IN_PROGRESS: '进化中', COMPLETED: '已完成', NOT_STARTED: '待启动' } as Record<string, string>)[status] ?? status
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
function skillKind(skill: Skill): AssetCatalogKind { if (skill.category === 'TASTE_SKILL') return 'TASTE_SKILL'; if (skill.category === 'PRODUCTION_SKILL') return 'PRODUCTION_SKILL'; if (skill.category === 'PERSONAL_SKILL' || skill.type === 'PERSONAL') return 'PERSONAL_SKILL'; return 'OTHER_CAPABILITY' }

function projectAssetCatalog(state: AssetState): ViewCatalog[] {
  if (state.assetCatalog?.length) return state.assetCatalog as ViewCatalog[]
  const generated: ViewCatalog[] = state.skills.map(skill => ({ id: skill.id, name: skill.name, kind: skillKind(skill), description: skill.description ?? 'Skill 能力版本与产物表现', status: skill.generationStatus === 'PLANNED' ? 'PLANNED' : 'ACTIVE', ownerScope: skill.type === 'PERSONAL' ? 'USER' : 'SYSTEM', skillId: skill.id, visibility: skill.visibility, currentVersionId: `${skill.id}@${skill.version}`, createdAt: skill.createdAt, updatedAt: skill.updatedAt } as ViewCatalog))
  return generated
    .concat([{ id: 'asset-memory-policy', name: '记忆策略', kind: 'MEMORY', description: '记忆生产、管理、召回与准确率治理对象', status: 'ACTIVE', ownerScope: 'SYSTEM', visibility: 'PUBLIC', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }, { id: 'asset-export-tool', name: 'Office 导出工具', kind: 'TOOL', description: 'Office 文件导出与交付工具', status: 'ACTIVE', ownerScope: 'SYSTEM', visibility: 'PUBLIC', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }, { id: 'asset-office-system-prompt', name: 'Office Agent 系统提示词', kind: 'SYSTEM_PROMPT', description: 'Office Agent 系统级任务规划提示词', status: 'ACTIVE', ownerScope: 'SYSTEM', visibility: 'PUBLIC', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }] as ViewCatalog[])
}
function projectAssetVersions(state: AssetState, catalog: ViewCatalog[]): ViewVersion[] {
  const result: ViewVersion[] = [...(state.assetVersions ?? [])] as ViewVersion[]
  catalog.forEach(entry => { if (result.some(version => version.assetId === entry.id)) return; const skill = entry.skillId ? state.skills.find(item => item.id === entry.skillId) : undefined; const versions = skill?.versions?.length ? skill.versions.map(item => item.version) : [skill?.version ?? (entry.kind === 'MEMORY' ? 'memory-2.3.0' : entry.kind === 'TOOL' ? 'tool-1.4.0' : '1.0.0')]; versions.filter(Boolean).forEach((version, index) => result.push({ id: `${entry.id}@${version}`, assetId: entry.id, version, status: index === versions.length - 1 ? 'ACTIVE' : 'DEPRECATED', description: `${entry.name} ${version}`, sourceEvolutionRecordIds: [], createdAt: entry.createdAt, updatedAt: entry.updatedAt })) })
  return result
}
function projectPerformance(state: AssetState, catalog: ViewCatalog[], versions: ViewVersion[]): ViewPerformance[] {
  if (state.assetPerformanceRecords?.length) return state.assetPerformanceRecords as ViewPerformance[]
  const output: ViewPerformance[] = []
  catalog.forEach(entry => { const skillTraces = entry.skillId ? state.traces.filter(trace => state.cases.find(item => item.id === trace.caseId)?.skillIds.includes(entry.skillId!)) : state.traces.slice(0, 4); const entryVersions = versions.filter(version => version.assetId === entry.id); skillTraces.slice(0, 8).forEach((trace, index) => { const version = entryVersions[index % Math.max(1, entryVersions.length)]; const artifact = state.artifacts.find(item => item.traceId === trace.id); const outcome = state.outcomeEvals.find(item => item.traceId === trace.id && item.artifactId === artifact?.id && item.isFinal !== false) ?? state.outcomeEvals.find(item => item.traceId === trace.id); const scoredAt = trace.queryAt ?? trace.startedAt; output.push({ id: `perf-${entry.id}-${trace.id}`, assetId: entry.id, assetVersionId: version?.id ?? `${entry.id}@1.0.0`, traceId: trace.id, caseId: trace.caseId, artifactId: artifact?.id, outcomeEvalId: outcome?.id, score: clampScore(outcome?.score) ?? (index % 3 === 0 ? 1.2 : index % 3 === 1 ? 1.6 : 1.85), scoreScale: '0-2', queryAt: trace.queryAt ?? trace.startedAt, scoredAt, datasetIds: [], evolutionRecordIds: [], createdAt: trace.createdAt, updatedAt: scoredAt }) }) })
  return output
}
function projectContributions(state: AssetState, catalog: ViewCatalog): ViewContribution[] {
  return (state.assetEvolutionContributions ?? []).filter(item => item.assetId === catalog.id).map(item => {
    const record = state.evolutionRecords?.find(record => record.id === item.evolutionRecordId)
    return { ...item, datasetIds: record ? selectAssetEvolutionSourceDatasetIds(state, record, item.traceIds) : [] }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function AssetsSkillsPage({ onNavigateReference, initialSkillId, initialAssetId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialSkillId?: string; initialAssetId?: string }) {
  const location = useLocation(); const { navigateContext } = useContextNavigation(); const { state: rawState, dispatch } = useEvolution(); const state = useMemo(() => enrichAssetManagementFixtures(rawState), [rawState]); const assetState = state as AssetState; const [params, setParams] = useSearchParams()
  const catalog = useMemo(() => projectAssetCatalog(assetState), [assetState]); const versions = useMemo(() => projectAssetVersions(assetState, catalog), [assetState, catalog])
  const [feedback, setFeedback] = useState(''); const [uploadOpen, setUploadOpen] = useState(false); const [skillOpen, setSkillOpen] = useState(false); const [assetName, setAssetName] = useState(''); const [skillName, setSkillName] = useState(''); const [plannedAssetId, setPlannedAssetId] = useState(state.assets[0]?.id ?? ''); const [planningQuery, setPlanningQuery] = useState(''); const [planningSkillId, setPlanningSkillId] = useState(''); const [planningTraceId, setPlanningTraceId] = useState(''); const [planningArtifactId, setPlanningArtifactId] = useState('')
  const skills = entities(assetState as unknown as AnyState, 'skills'); const assets = entities(assetState as unknown as AnyState, 'assets'); const [tab, setTab] = useState<'skills' | 'assets'>(initialAssetId ? 'assets' : 'skills'); const [query, setQuery] = useState(''); const [selectedId, setSelectedId] = useState(initialSkillId ?? initialAssetId); const navigation = useReferenceNavigation(onNavigateReference)
  // The URL owns this scope. Props are legacy deep-link inputs only, not a second selection store.
  const requestedAssetId = params.get('assetId') ?? params.get('skillId') ?? (!params.has('assetType') ? initialAssetId ?? initialSkillId : undefined)
  const resolvedCatalog = requestedAssetId ? catalog.find(item => item.id === requestedAssetId || item.skillId === requestedAssetId) : undefined
  const requestedType = params.get('assetType') as AssetTypeFilter | null
  const assetType: AssetTypeFilter = requestedType || resolvedCatalog?.kind || ''
  const assetQuery = params.get('assetQuery') ?? ''
  const availableCatalog = selectAssetCategoryWorkbench(state, { kind: assetType || undefined, query: assetQuery }).assets
  const selectedCatalog = resolvedCatalog && availableCatalog.some(item => item.id === resolvedCatalog.id) ? resolvedCatalog : undefined
  const assetId = selectedCatalog?.id ?? ''
  const assetVersion = assetId ? params.get('assetVersion') ?? '' : ''
  const assetWindow = params.get('assetTimeWindowId') ?? ''
  const assetTimeFrom = params.get('assetTimeFrom') ?? ''
  const assetTimeTo = params.get('assetTimeTo') ?? ''
  const availableVersions = versions.filter(item => item.assetId === assetId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version.localeCompare(a.version, undefined, { numeric: true }))
  const allVersionsSelected = assetVersion === ALL_ASSET_VERSIONS_VALUE || assetVersion === 'ALL'
  const selectedVersion = allVersionsSelected ? undefined : availableVersions.find(item => item.version === assetVersion) ?? availableVersions.find(item => item.id === selectedCatalog?.currentVersionId) ?? availableVersions.find(item => item.status === 'ACTIVE') ?? availableVersions[0]
  const selectedVersionLabel = allVersionsSelected ? '全部版本' : selectedVersion?.version ?? '最新版本'
  const windows = [...state.windows].sort((a, b) => b.timeRange.from.localeCompare(a.timeRange.from)); const selectedWindow = windows.find(item => item.id === assetWindow); const effectiveFrom = assetTimeFrom || selectedWindow?.timeRange.from; const effectiveTo = assetTimeTo || selectedWindow?.timeRange.to; const invalidTime = Boolean(effectiveFrom && effectiveTo && Date.parse(effectiveFrom) > Date.parse(effectiveTo))
  const performance = useMemo(() => projectPerformance(assetState, catalog, versions), [assetState, catalog, versions])
  const versionMatches = (item: { assetVersionId: string }) => allVersionsSelected || !selectedVersion || item.assetVersionId === selectedVersion.id
  const scopedPerformance = performance.filter(item => !invalidTime && (!assetId || item.assetId === assetId) && versionMatches(item))
  const allContributions = selectedCatalog ? projectContributions(assetState, selectedCatalog) : []
  const selectedContributions = allContributions.filter(item => !invalidTime && versionMatches(item) && (!effectiveFrom || Date.parse(item.createdAt) >= Date.parse(effectiveFrom)) && (!effectiveTo || Date.parse(item.createdAt) <= Date.parse(effectiveTo)))
  const versionPerformanceRows = selectedCatalog ? availableVersions.map(version => {
    const summary = selectAssetCategoryWorkbench({ ...state, assetCatalog: [selectedCatalog], assetPerformanceRecords: performance.filter(item => item.assetVersionId === version.id), assetEvolutionContributions: allContributions.filter(item => item.assetVersionId === version.id) }, { from: effectiveFrom, to: effectiveTo })
    const attributionTraces = new Map<string, Set<string>>()
    summary.contributions.forEach(item => { const ids = attributionTraces.get(item.attributionLabel) ?? new Set<string>(); item.traceIds.forEach(id => ids.add(id)); attributionTraces.set(item.attributionLabel, ids) })
    return { version, averageScore: summary.averageScore, evaluatedCount: summary.evaluatedCount, traceCount: summary.traceCount, contributions: [...attributionTraces].map(([label, ids]) => label + ' ' + ids.size + ' 条').join('、') || '未关联进化项' }
  }) : []
  const assetSummary = selectedCatalog ? selectAssetCategoryWorkbench({ ...state, assetCatalog: [selectedCatalog], assetPerformanceRecords: scopedPerformance, assetEvolutionContributions: selectedContributions }, { from: effectiveFrom, to: effectiveTo }) : undefined
  const assetTypeScope = Boolean(assetType && !assetId)
  const categorySummary = useMemo(() => selectAssetCategoryWorkbench(state, { kind: assetType || undefined, query: assetQuery, from: effectiveFrom, to: effectiveTo }), [state, assetType, assetQuery, effectiveFrom, effectiveTo])
  const categoryMonthly = categorySummary.monthly
  const displaySummary = assetTypeScope ? categorySummary : assetSummary
  const displayPerformance = displaySummary?.performance ?? []
  const legacySkillKeys = ['skill', 'skillId', 'skillVersion', 'skillCategory']
  const updateParams = (patch: Record<string, string | undefined>, clear: string[] = [], replace = true) => {
    const next = new URLSearchParams(params)
    clear.forEach(key => next.delete(key))
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace })
  }
  const selectType = (value: AssetTypeFilter) => {
    updateParams({ assetType: value || undefined, assetId: undefined, assetVersion: undefined }, [...legacySkillKeys, 'assetId', 'assetVersion'])
  }
  const selectAsset = (value: string) => {
    const nextType = catalog.find(item => item.id === value)?.kind ?? selectedCatalog?.kind ?? assetType
    updateParams({ assetType: nextType || undefined, assetId: value || undefined, assetVersion: undefined }, [...legacySkillKeys, 'assetVersion'], false)
  }
  const selectVersion = (value: string) => updateParams({ assetVersion: value || undefined }, legacySkillKeys)
  const setWindow = (value: string) => updateParams({ assetTimeWindowId: value || undefined, assetTimeFrom: undefined, assetTimeTo: undefined }, ['assetTimeFrom', 'assetTimeTo'])
  const setFrom = (value: string) => updateParams({ assetTimeFrom: value || undefined, assetTimeWindowId: undefined }, ['assetTimeWindowId'])
  const setTo = (value: string) => updateParams({ assetTimeTo: value || undefined, assetTimeWindowId: undefined }, ['assetTimeWindowId'])
  const reportReady = Boolean((assetType || assetId) && !invalidTime)

  const chartPoints: AssetScorePoint[] = selectedCatalog
    ? versionPerformanceRows.filter(row => row.averageScore !== undefined && (!selectedVersion || row.version.id === selectedVersion.id)).map(row => ({
      at: row.version.effectiveFrom ?? row.version.releasedAt ?? row.version.createdAt,
      label: (row.version.effectiveFrom ?? row.version.releasedAt ?? row.version.createdAt).slice(0, 10),
      version: row.version.version, score: row.averageScore!
    })).sort((a, b) => a.at.localeCompare(b.at))
    : categoryMonthly.filter(item => item.score !== undefined).map(item => ({ at: item.month + '-01T00:00:00Z', label: item.month, version: '该类型全部资产', score: item.score! }))
  useEffect(() => {
    const normalized = new URLSearchParams(params)
    legacySkillKeys.forEach(key => normalized.delete(key))
    if (assetType) normalized.set('assetType', assetType)
    if (assetId) normalized.set('assetId', assetId)
    else { normalized.delete('assetId'); normalized.delete('assetVersion') }
    if (normalized.toString() !== params.toString()) setParams(normalized, { replace: true })
  }, [params, assetType, assetId, setParams])
  const assetHref = (entry: AssetCatalogEntry) => {
    const next = new URLSearchParams(params)
    next.set('assetType', entry.kind)
    next.set('assetId', entry.id)
    next.delete('assetVersion')
    legacySkillKeys.forEach(key => next.delete(key))
    return window.location.origin + '/assets-skills?' + next.toString()
  }
  const openCategoryAsset = (entry: AssetCatalogEntry) => {
    updateParams({ assetType: entry.kind, assetId: entry.id, assetVersion: undefined }, legacySkillKeys, false)
  }
  const datasetHref = (id: string, contribution: ViewContribution) => {
    const next = new URLSearchParams({ view: 'datasets', datasetId: id, returnTo: location.pathname + location.search })
    const record = state.evolutionRecords?.find(record => record.id === contribution.evolutionRecordId)
    if (record) {
      next.set('governanceObject', record.target.governanceObject)
      next.set('attribution', record.target.attributionId)
      if (record.target.kind === 'SKILL') {
        next.set('skill', record.target.skillId)
        next.set('skillVersion', record.target.skillVersion)
        if (selectedCatalog) next.set('skillCategory', selectedCatalog.kind)
      } else {
        next.set('targetId', record.target.targetId)
        if (record.target.targetVersion) next.set('targetVersion', record.target.targetVersion)
        next.set('evolutionRecordId', record.id)
      }
    }
    return window.location.origin + '/datasets-evaluations?' + next.toString()
  }
  const downloadReport = () => {
    if (!reportReady) return
    const reportPerformance = displayPerformance
    const versionLabelFor = (versionId: string) => { const version = versions.find(item => item.id === versionId); const owner = catalog.find(item => item.id === version?.assetId); return owner && assetTypeScope ? `${owner.name} · ${version?.version ?? versionId}` : version?.version ?? versionId }
    const snapshot = { assetType: assetType || '全部', asset: selectedCatalog?.name ?? '资产类型汇总', version: selectedCatalog ? selectedVersionLabel : '全部执行版本（历史）', timeFrom: effectiveFrom || undefined, timeTo: effectiveTo || undefined, generatedAt: new Date().toISOString() }
    const rows = reportPerformance.map(item => `<tr><td>${item.traceId}</td><td>${versionLabelFor(item.assetVersionId)}</td><td>${scoreText(item.score)}</td><td>${dateText(item.queryAt ?? item.scoredAt)}</td></tr>`).join('')
    const trendChart = renderToStaticMarkup(<AssetPerformanceChart points={chartPoints} label={selectedCatalog ? '历史版本产物平均分' : '类别产物平均分历史'} />)
    const history = selectedContributions.map(item => `<tr><td>${escapeHtml(item.attributionLabel)}</td><td>${escapeHtml(versionLabelFor(item.assetVersionId))}</td><td>${escapeHtml(dateText(item.createdAt))}</td><td>${new Set(item.traceIds).size}</td><td>${contributionStatusLabel(item.status)}</td><td>${item.datasetIds.map(id => { const dataset = state.datasets.find(dataset => dataset.id === id); return `<a href="${escapeHtml(datasetHref(id, item))}">${escapeHtml(dataset?.name ?? id)} · ${escapeHtml(dataset?.version ?? '')}<br><small>${escapeHtml(id)}</small></a>` }).join('、') || '仅来源 Trace，尚未形成归因数据集'}</td></tr>`).join('')
    const versionRows = versionPerformanceRows.filter(row => !selectedVersion || row.version.id === selectedVersion.id).map(row => `<tr><td>${escapeHtml(row.version.version)}</td><td>${renderToStaticMarkup(<AssetVersionStatusBadge version={row.version} />)}</td><td>${scoreText(row.averageScore)}</td><td>${row.evaluatedCount}</td><td>${row.traceCount}</td></tr>`).join('')
    const metricsHtml = renderToStaticMarkup(<AssetPerformanceMetrics summary={displaySummary} category={assetTypeScope} />)
    const performanceSection = assetTypeScope
      ? '<section class="section"><h2>分类资产表现</h2><p class="mock">当前版本与部署状态单独展示，窗口均分包含各资产在该窗口内的全部执行版本。</p>' + renderToStaticMarkup(<AssetCategoryPerformanceTable rows={categorySummary.rows} assetHref={assetHref} />) + '</section>'
      : '<section class="section"><h2>版本表现</h2><p class="mock">状态为生成报告时的部署快照，评分按筛选时间窗口统计。</p><table aria-label="资产版本表现"><thead><tr><th>资产版本</th><th>当前状态</th><th>平均产物分（0–2）</th><th>评测产物</th><th>贡献 Trace</th></tr></thead><tbody>' + (versionRows || '<tr><td colspan="5">暂无版本评测结果</td></tr>') + '</tbody></table></section>'
    const historySection = selectedCatalog ? '<section class="section"><h2>进化贡献（仅触发 Trace / 聚类进化数据集）</h2><table aria-label="资产进化历史"><thead><tr><th>归因 / 进化项</th><th>资产版本</th><th>进化时间</th><th>贡献 Trace</th><th>状态</th><th>触发数据集</th></tr></thead><tbody>' + (history || '<tr><td colspan="6">暂无进化记录</td></tr>') + '</tbody></table></section>' : ''
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>资产表现报告 · ${snapshot.asset}</title><style>:root{color-scheme:light;--blue:#1d5fd1;--ink:#1f2937;--muted:#64748b;--line:#dbe3ee;--soft:#f6f8fb}*{box-sizing:border-box}body{margin:0;background:#f6f8fb;color:var(--ink);font:14px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.shell{max-width:1180px;margin:0 auto;padding:36px 28px 56px}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:22px}.eyebrow{color:var(--blue);font-size:11px;font-weight:700;letter-spacing:.14em}.title{margin:5px 0 0;font-size:28px;letter-spacing:-.03em}.mock{color:var(--muted);font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px}.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:0 5px 18px #1e3a8a0b}.label{color:var(--muted);font-size:12px}.value{margin-top:4px;font-size:22px;font-weight:700}.section{margin-top:22px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}.section h2{margin:0 0 12px;font-size:17px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.meta div{background:var(--soft);border-radius:8px;padding:10px}.score-chart{display:block;width:100%;height:auto;min-height:300px}.chart-wrap{overflow-x:auto}.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;color:var(--muted);font-size:12px}.legend-item{display:inline-flex;align-items:center;gap:5px}.legend-item i{display:inline-block;width:10px;height:10px;border-radius:50%}.chart-grid{stroke:#e5eaf1;stroke-width:1}.chart-axis-line{stroke:#94a3b8;stroke-width:1.2}.chart-line{fill:none;stroke:var(--blue);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.chart-dot{fill:#fff;stroke:var(--blue);stroke-width:3}.chart-value{fill:var(--ink);font-size:12px;font-weight:700}.chart-label,.chart-axis,.chart-title{fill:var(--muted);font-size:11px}.chart-title{font-weight:600}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid var(--line);padding:11px 10px;text-align:left}th{background:var(--soft);color:var(--muted);font-weight:600}a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}.footer{margin-top:28px;color:var(--muted);font-size:12px}@media(max-width:760px){.shell{padding:22px 14px}.grid,.meta{grid-template-columns:1fr 1fr}.title{font-size:23px}}@media(max-width:520px){.grid,.meta{grid-template-columns:1fr}}</style></head><body><main class="shell"><header class="brand"><div><div class="eyebrow">OFFICE AGENT · ASSET MANAGEMENT</div><h1 class="title">资产表现报告</h1><div class="mock">本地 Mock 报告 · 可复查筛选快照</div></div><a href="${window.location.origin}${location.pathname}${location.search}">返回资产管理</a></header><section class="grid"><div class="card"><div class="label">资产类型</div><div class="value">${typeLabel(snapshot.assetType)}</div></div><div class="card"><div class="label">资产</div><div class="value">${snapshot.asset}</div></div><div class="card"><div class="label">版本</div><div class="value">${snapshot.version}</div></div></section><section class="section"><h2>筛选快照</h2><div class="meta"><div><div class="label">开始时间</div><strong>${snapshot.timeFrom ?? '全部时间'}</strong></div><div><div class="label">结束时间</div><strong>${snapshot.timeTo ?? '全部时间'}</strong></div><div><div class="label">评测记录</div><strong>${reportPerformance.length} 条</strong></div><div><div class="label">生成时间</div><strong>${snapshot.generatedAt}</strong></div></div></section><section class="section"><h2>${selectedCatalog ? '历史版本产物平均分' : '类别产物平均分历史'}（X 轴：时间，Y 轴：0–2）</h2><p class="mock">${selectedCatalog ? '每个点标注版本与具体得分，时间轴采用版本的生效或创建时间。' : '按 Query 发生月份统计该类型全部执行版本的产物均分；同一产物去重。'}缺失评测不计为零分。</p>${trendChart}${metricsHtml}</section>${performanceSection}${historySection}<section class="section"><h2>Trace 产物表现</h2><table><thead><tr><th>Trace</th><th>版本</th><th>产物评分</th><th>Query 时间</th></tr></thead><tbody>${rows || '<tr><td colspan="4">暂无评测结果</td></tr>'}</tbody></table></section><p class="footer">报告由资产管理工作台生成。数据为本地 Mock，评分采用 0–2 口径。</p></main></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `asset-report-${(selectedCatalog?.id ?? assetType) || 'all'}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  const openDataset = (datasetId: string, contribution: ViewContribution) => { const destination = new URL(datasetHref(datasetId, contribution)); navigateContext(destination.pathname, { clear: [...DETAIL_KEYS, 'skill', 'skillId', 'skillVersion', 'skillCategory', 'governanceObject', 'attribution', 'targetId', 'targetVersion', 'datasetCategory', 'assetId', 'assetType', 'assetVersion', 'assetTimeWindowId', 'assetTimeFrom', 'assetTimeTo'], params: Object.fromEntries(destination.searchParams) }) }; const selected = (tab === 'skills' ? skills : assets).find(item => item.id === selectedId); const selectedIdentity = selected ? <EntityId id={selected.id} kind={tab === 'skills' ? 'skill' : 'asset'} onOpen={navigation.open}/> : null; const rows = tab === 'skills' ? skills : assets; const filtered = useMemo(() => rows.filter(item => !query.trim() || [item.id, item.name, item.type, item.kind, item.visibility, item.version].join(' ').toLowerCase().includes(query.trim().toLowerCase())), [query, rows])
  const skillColumns: Column<AnyEntity>[] = [{ key: 'id', header: 'Skill ID', accessor: row => <IdLink id={row.id} kind="skill" onOpen={navigation.open}/> }, { key: 'name', header: '名称', accessor: row => text(row.name) }, { key: 'type', header: '类型', accessor: row => text(row.type) }, { key: 'category', header: 'Skill 类型', accessor: row => skillCategoryLabel(text(row.category, 'UNCLASSIFIED') as import('../domain').SkillCategory) }, { key: 'version', header: '版本', accessor: row => text(row.version) }, { key: 'visibility', header: '归属', accessor: row => <StatusBadge status={text(row.visibility)}/> }, { key: 'generation', header: '生成能力', accessor: row => <StatusBadge status={text(row.generationStatus)} label={text(row.generationStatus) === 'PLANNED' ? '待建设' : text(row.generationStatus)}/> }]; const assetColumns: Column<AnyEntity>[] = [{ key: 'id', header: '资产 ID', accessor: row => <IdLink id={row.id} kind="asset" onOpen={navigation.open}/> }, { key: 'name', header: '资产', accessor: row => text(row.name) }, { key: 'owner', header: 'Owner', accessor: row => text(row.ownerId) }, { key: 'visibility', header: '归属', accessor: row => <StatusBadge status={text(row.visibility)}/> }, { key: 'sanitization', header: '脱敏', accessor: row => <StatusBadge status={text(row.sanitizationStatus)}/> }, { key: 'review', header: '审核', accessor: row => <StatusBadge status={text(row.reviewStatus)}/> }, { key: 'publish', header: '发布', accessor: row => <StatusBadge status={text(row.publishStatus)}/> }]; const updateAsset = (patch: Record<string, unknown>, reason: string) => { if (!selected || tab !== 'assets') return; dispatch({ type: 'UPDATE_ASSET', assetId: selected.id, patch, meta: { actor: '当前用户', reason } }); setFeedback('') }; const publish = () => { if (!selected) return; if (text(selected.sanitizationStatus) !== 'PASSED' || text(selected.reviewStatus) !== 'APPROVED') { setFeedback('必须先完成脱敏与审核，才能发布到公库。'); return } updateAsset({ visibility: 'PUBLIC', publishStatus: 'PUBLISHED' }, '显式发布到公库') }
  const upload = () => { if (!assetName.trim()) return; const at = new Date().toISOString(); const asset: Asset = { id: `asset-${Date.now()}`, name: assetName.trim(), kind: 'TEMPLATE', ownerId: '当前用户', visibility: 'PRIVATE', skillIds: [], sanitizationStatus: 'PENDING', reviewStatus: 'PENDING', publishStatus: 'NOT_PUBLISHED', createdAt: at, updatedAt: at }; dispatch({ type: 'UPLOAD_ASSET', asset, meta: { actor: '当前用户', reason: '上传个人私库资产', at } }); setUploadOpen(false); setAssetName('') }; const planSkill = () => { if (!skillName.trim()) return; const at = new Date().toISOString(); const skill: Skill = { id: `skill-personal-${Date.now()}`, name: skillName.trim(), type: 'PERSONAL', version: '未生成', visibility: 'PRIVATE', evolutionRecordIds: [], assetIds: plannedAssetId ? [plannedAssetId] : [], generationStatus: 'PLANNED', category: 'PERSONAL_SKILL', planningSources: [{ query: planningQuery.trim() || undefined, assetIds: plannedAssetId ? [plannedAssetId] : [], existingSkillIds: planningSkillId ? [planningSkillId] : [], conversationTraceIds: planningTraceId ? [planningTraceId] : [], artifactIds: planningArtifactId ? [planningArtifactId] : [] }], createdAt: at, updatedAt: at }; dispatch({ type: 'CREATE_PLANNED_PERSONAL_SKILL', skill, meta: { actor: '当前用户', reason: '创建个人 Skill 规划入口', at } }); setSkillOpen(false); setSkillName(''); setPlanningQuery(''); setPlanningSkillId(''); setPlanningTraceId(''); setPlanningArtifactId('') }

  return <div className="asset-management-page">
    <Section className="mt-4"><SectionHeader title="范围筛选" description="选择该类型全部资产查看分类历史；选择具体资产后可切换版本。时间窗口支持预设或自定义。" actions={<div className="flex flex-wrap items-center gap-2"><MockBoundary />{selectedCatalog && <Button onClick={() => selectAsset('')}>返回该类型全部资产</Button>}<Button icon={Download} variant="primary" onClick={downloadReport} disabled={!reportReady}>下载报告</Button></div>}/><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="资产类型"><SelectInput aria-label="资产类型" value={assetType} onChange={e => selectType(e.target.value as AssetTypeFilter)}><option value="">全部资产类型</option>{ASSET_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectInput></Field><Field label="具体资产"><SelectInput aria-label="具体资产" value={assetId} onChange={e => selectAsset(e.target.value)}><option value="">{assetTypeScope ? '该类型全部资产' : '全部资产'}</option>{availableCatalog.map(item => <option key={item.id} value={item.id}>{item.name} · {typeLabel(item.kind)}</option>)}</SelectInput></Field><Field label="资产版本" hint={!assetId ? '选择具体资产后可切换版本；分类历史包含全部执行版本。' : undefined}><SelectInput aria-label="资产版本" value={!assetId ? '' : allVersionsSelected ? ALL_ASSET_VERSIONS_VALUE : assetVersion} onChange={e => selectVersion(e.target.value)} disabled={!assetId}><option value="">{assetId ? '最新版本' : '分类历史：全部执行版本'}</option><option value={ALL_ASSET_VERSIONS_VALUE}>全部版本（历史）</option>{availableVersions.map(item => <option key={item.id} value={item.version}>{item.version} · {versionStatusLabel(item.status)}</option>)}</SelectInput></Field><Field label="搜索资产 / 版本 / 进化项"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"/><TextInput aria-label="资产搜索" className="pl-8" value={assetQuery} onChange={e => updateParams({ assetQuery: e.target.value || undefined })} placeholder="搜索名称、ID、版本"/></div></Field><Field label="预设时间窗口"><SelectInput aria-label="资产时间窗口" value={assetWindow} onChange={e => setWindow(e.target.value)}><option value="">全部时间</option>{windows.map(item => <option key={item.id} value={item.id}>{item.name} · {dateText(item.timeRange.from)}–{dateText(item.timeRange.to)}</option>)}</SelectInput></Field><Field label="开始 datetime"><TextInput aria-label="资产开始时间" type="datetime-local" value={assetTimeFrom} onChange={e => setFrom(e.target.value)}/></Field><Field label="结束 datetime"><TextInput aria-label="资产结束时间" type="datetime-local" value={assetTimeTo} onChange={e => setTo(e.target.value)}/></Field><div className="flex items-end"><Button className="w-full" onClick={() => { updateParams({ assetType: undefined, assetId: undefined, assetVersion: undefined, assetQuery: undefined, assetTimeWindowId: undefined, assetTimeFrom: undefined, assetTimeTo: undefined }, legacySkillKeys) }}>重置筛选</Button></div></div>{invalidTime && <p role="alert" className="mt-2 text-xs text-fail">资产结束时间不能早于开始时间</p>}</Section>
    <div className="mt-4 grid gap-4">
      <Section>
        <SectionHeader title={assetTypeScope ? '类别总览' : '资产表现'} description={selectedCatalog ? selectedCatalog.name + ' · ' + selectedVersionLabel : assetTypeScope ? typeLabel(assetType) + ' · 该类型全部资产' : '请选择资产类型或具体资产'} />
        {selectedCatalog || assetTypeScope ? <>
          <AssetPerformanceMetrics summary={displaySummary} category={assetTypeScope} />
          <div className="mt-4">
            <p className="text-xs font-semibold">{assetTypeScope ? '类别产物平均分历史' : '历史版本产物平均分'}</p>
            <AssetPerformanceChart points={chartPoints} label={assetTypeScope ? '类别产物平均分历史' : '历史版本产物平均分'} />
            <p className="mt-1 text-[10px] leading-5 text-muted">{assetTypeScope ? '按 Query 发生月份统计窗口内全部执行版本的已评分产物；同一产物去重，整体均分按产物计算。' : '按筛选窗口内的产物评分计算；时间轴为对应版本的生效或创建时间，版本状态展示当前部署情况。'}缺失评测不计为零分，贡献 Trace 按进化时间筛选并去重。</p>
          </div>
          {assetTypeScope && <AssetCategoryPerformanceTable rows={categorySummary.rows} assetHref={assetHref} onSelect={openCategoryAsset} />}
          {selectedCatalog && <DataTable className="mt-4" caption="资产版本表现" rows={versionPerformanceRows} rowKey={row => row.version.id} empty={<span>暂无版本评测结果</span>} columns={[
            { key: 'version', header: '资产版本', accessor: row => <span className="font-mono text-[11px]">{row.version.version}</span> },
            { key: 'status', header: '当前状态', accessor: row => <AssetVersionStatusBadge version={row.version} /> },
            { key: 'score', header: '平均产物分（0–2）', accessor: row => row.averageScore === undefined ? '暂无评测结果' : row.averageScore.toFixed(2) },
            { key: 'evaluated', header: '评测产物', accessor: row => row.evaluatedCount },
            { key: 'traces', header: '贡献 Trace', accessor: row => row.traceCount },
            { key: 'evolution', header: '进化项', accessor: row => row.contributions }
          ]} />}
        </> : <p className="mt-4 text-sm text-muted">选择资产类型查看全部资产与月度历史，或选择具体资产查看版本表现。</p>}
      </Section>
      {selectedCatalog && <Section>
        <SectionHeader title="进化历史" description={allVersionsSelected ? '全部资产版本的触发 Trace / 聚类进化数据集历史。' : '按固定资产版本查看触发 Trace / 聚类进化数据集。'} />
        <DataTable caption="资产进化历史" rows={selectedContributions} rowKey={row => row.id} empty={<span>暂无进化记录</span>} columns={[
          { key: 'attribution', header: '归因 / 进化项', accessor: row => <span className="font-medium">{row.attributionLabel}</span> },
          { key: 'version', header: '版本', accessor: row => <span className="font-mono text-[11px]">{versions.find(item => item.id === row.assetVersionId)?.version ?? '—'}</span> },
          { key: 'time', header: '进化时间', accessor: row => dateText(row.createdAt) },
          { key: 'traces', header: '贡献 Trace', accessor: row => new Set(row.traceIds).size },
          { key: 'status', header: '状态', accessor: row => <StatusBadge status={row.status} label={contributionStatusLabel(row.status)} /> },
          { key: 'datasets', header: '触发数据集', accessor: row => row.datasetIds.length ? <div className="flex flex-wrap gap-1">{row.datasetIds.map(id => <button type="button" key={id} className="text-accent hover:underline" onClick={() => openDataset(id, row)}>{state.datasets.find(dataset => dataset.id === id)?.name ?? id}<span className="block text-[10px] text-muted">{id} · 数据集版本 {state.datasets.find(dataset => dataset.id === id)?.version ?? '未记录'}</span></button>)}</div> : <span className="text-muted">未关联</span> }
        ]} />
      </Section>}
    </div>
    <Section className="mt-4"><SectionHeader title="资产治理台账" description="脱敏、审核、发布和个人 Skill 规划仍保留在同一资产管理页。"/><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-line p-4"><Library className="h-4 w-4 text-accent"/><p className="mt-2 text-xs">Skill / 资产</p><p className="text-2xl font-semibold">{skills.length} / {assets.length}</p></div><div className="rounded-lg border border-line p-4"><LockKeyhole className="h-4 w-4 text-warn"/><p className="mt-2 text-xs">私库资产</p><p className="text-2xl font-semibold">{assets.filter(item => item.visibility === 'PRIVATE').length}</p></div></div><Tabs activeId={tab} onChange={id => { setTab(id as 'skills' | 'assets'); setSelectedId(undefined) }} items={[{ id: 'skills', label: 'Skill', count: skills.length }, { id: 'assets', label: '资产', count: assets.length }]}/><FilterBar className="mt-4" searchValue={query} onSearchChange={setQuery} searchPlaceholder={tab === 'skills' ? '搜索 Skill' : '搜索资产'} resultCount={filtered.length} onReset={() => setQuery('')}/><Section className="mt-4"><SectionHeader title={tab === 'skills' ? 'Skill 列表' : '资产列表'} description={tab === 'skills' ? 'Skill 细项不重复维护问题与归因、实验与准出、能力变体、发布版本。' : '资产脱敏、审核与发布。'}/><DataTable className="mt-3" caption={tab === 'skills' ? 'Skill 列表' : '资产列表'} rows={filtered} columns={tab === 'skills' ? skillColumns : assetColumns} rowKey={row => row.id} onRowClick={row => setSelectedId(row.id)}/></Section></Section>
    {selected && tab === 'assets' && <div className="fixed inset-0 z-40" role="dialog" aria-label="资产详情"><button className="absolute inset-0 bg-slate-950/25" onClick={() => setSelectedId(undefined)}/><aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l bg-panel p-5"><button aria-label="关闭" className="float-right text-xs" onClick={() => setSelectedId(undefined)}>关闭</button><h2 className="font-semibold">{text(selected.name)}</h2><p className="font-mono text-[10px] text-accent">{selectedIdentity}</p>{feedback && <div role="alert" className="mt-4 rounded bg-fail/10 p-3 text-xs text-fail">{feedback}</div>}<Section className="mt-5"><SectionHeader title="资产治理进度"/><KeyValueGrid className="mt-3" items={[{ label: '类型', value: text(selected.kind) }, { label: 'Owner', value: text(selected.ownerId) }, { label: '归属', value: text(selected.visibility) }, { label: '脱敏', value: text(selected.sanitizationStatus) }, { label: '审核', value: text(selected.reviewStatus) }, { label: '发布', value: text(selected.publishStatus) }]}/><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => updateAsset({ sanitizationStatus: 'PASSED' }, '脱敏通过')}>标记脱敏通过</Button><Button onClick={() => updateAsset({ reviewStatus: 'APPROVED' }, '审核通过')}>审核通过</Button><Button variant="primary" onClick={publish}>发布到公库</Button></div></Section><Section className="mt-4"><SectionHeader title="关联 Skill"/><div className="mt-3 flex flex-wrap gap-2">{strings(selected.skillIds).map(id => <IdLink key={id} id={id} kind="skill" onOpen={navigation.open}/>)}{!strings(selected.skillIds).length && <TagList values={[]} empty="尚未关联 Skill"/>}</div></Section></aside></div>}
    {selected && tab === 'skills' && <div className="fixed inset-0 z-40" role="dialog" aria-label="Skill 详情"><button className="absolute inset-0 bg-slate-950/25" onClick={() => setSelectedId(undefined)}/><aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l bg-panel p-5"><button aria-label="关闭" className="float-right text-xs" onClick={() => setSelectedId(undefined)}>关闭</button><h2 className="font-semibold">{text(selected.name)}</h2><p className="font-mono text-[10px] text-accent">{selectedIdentity}</p><Section className="mt-5"><SectionHeader title="Skill 基本信息"/><KeyValueGrid className="mt-3" items={[{ label: '类型', value: text(selected.type) }, { label: 'Skill 类型', value: skillCategoryLabel(text(selected.category, 'UNCLASSIFIED') as import('../domain').SkillCategory) }, { label: '版本', value: text(selected.version) }, { label: '归属', value: text(selected.visibility) }, { label: '更新时间', value: dateText(selected.updatedAt) }]}/></Section><Section className="mt-4"><SectionHeader title="统一数据集与评测" description="评测、数据集、进化项、实验和准出统一在一个工作台。" actions={<Button variant="primary" onClick={() => navigateContext('/datasets-evaluations', { clear: DETAIL_KEYS, params: { skillId: selected.id, returnTo: location.pathname + location.search } })}>打开数据集与评测</Button>}/></Section></aside></div>}
    <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="上传个人资产" footer={<Button variant="primary" onClick={upload}>保存资产</Button>}><Field label="资产名称"><TextInput aria-label="资产名称" value={assetName} onChange={e => setAssetName(e.target.value)}/></Field></Modal><Modal open={skillOpen} onClose={() => setSkillOpen(false)} title="规划个人 Skill" description="仅创建待建设规划入口，不伪造生成服务。请补齐后续生成服务需要的来源。" footer={<Button variant="primary" onClick={planSkill}>保存规划</Button>}><div className="space-y-3"><Field label="Skill 名称"><TextInput aria-label="Skill 名称" value={skillName} onChange={e => setSkillName(e.target.value)}/></Field><Field label="Query / 目标场景"><TextArea aria-label="Query / 目标场景" value={planningQuery} onChange={e => setPlanningQuery(e.target.value)} placeholder="例如：根据团队模板生成季度经营复盘 PPT"/></Field><Field label="Asset / 文件"><SelectInput aria-label="来源资产" value={plannedAssetId} onChange={e => setPlannedAssetId(e.target.value)}><option value="">不关联</option>{state.assets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label="已有 Skill"><SelectInput aria-label="已有 Skill" value={planningSkillId} onChange={e => setPlanningSkillId(e.target.value)}><option value="">不关联</option>{state.skills.filter(item => item.type !== 'PERSONAL').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label="Conversation Trace"><SelectInput aria-label="Conversation Trace" value={planningTraceId} onChange={e => setPlanningTraceId(e.target.value)}><option value="">不关联</option>{state.traces.slice(0, 30).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</SelectInput></Field><Field label="Artifact"><SelectInput aria-label="来源 Artifact" value={planningArtifactId} onChange={e => setPlanningArtifactId(e.target.value)}><option value="">不关联</option>{state.artifacts.slice(0, 30).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field></div></Modal>{navigation.drawer}</div>
}
