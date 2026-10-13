import { Database, History, Link2, Play, RefreshCw, SearchCheck, Scale, ShieldCheck, Workflow } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, DataTable, Field, FilterBar, Modal, SectionHeader, SelectInput, StatusBadge, Tabs, TextArea, TextInput, type Column } from '../../ui'
import type { EvaluationRevision, EvaluationVerdict, EvolutionState, ModuleEvaluationScore } from '../domain'
import { selectTraceEvaluationLedger } from '../data/selectors'
import { DetailDrawer, EntityId, IdLink, KeyValueGrid, PageHeading, TagList, type ReferenceTarget } from '../components/ViewPrimitives'
import { EvidenceBundleDrawer } from '../components/EvidenceBundleDrawer'
import { ModuleEvaluationMatrix, type ModuleEvaluationRecord } from '../components/ModuleEvaluationMatrix'
import { useScopedEvolution } from '../scope'
import { dateText, entities, Section, strings, text, type AnyEntity, type AnyState, useReferenceNavigation } from './shared'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'
import { projectModuleReview, type ModuleReviewInput } from '../reviews'

type EvalTab = 'process' | 'outcome'
type ViewTab = 'batches' | 'traces' | EvalTab
type Loose = Record<string, unknown>

const asList = (value: unknown): Loose[] => Array.isArray(value) ? value.filter((item): item is Loose => Boolean(item && typeof item === 'object')) : []
const firstValue = (item: Loose, keys: string[], fallback?: unknown) => {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}
const ids = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' && value ? [value] : []
const status = (item: Loose, fallback = 'UNKNOWN') => text(firstValue(item, ['status', 'state', 'verdict']), fallback)
const batchStat = (row: Loose, key: string, fallback = 0) => {
  const stats = firstValue(row, ['stats'], {})
  return firstValue(row, [key], firstValue((stats && typeof stats === 'object' ? stats : {}) as Loose, [key], fallback))
}
const moduleName = (dimension: unknown, fallback = 'Reason') => {
  const value = text(dimension, fallback)
  const lower = value.toLocaleLowerCase()
  if (lower.includes('memory') || value === '记忆') return '记忆'
  if (lower.includes('skill')) return 'skill'
  if (lower.includes('tool')) return 'Tool'
  if (lower.includes('act')) return 'Act'
  if (lower.includes('context') || value === '上文') return '上文'
  if (lower.includes('outcome') || lower.includes('artifact') || value.includes('产物') || value.includes('结果')) return 'Outcome / 产物'
  if (lower.includes('reason')) return 'Reason'
  return fallback
}

const evaluationScoreLabel = (item: Loose, fallback = '待评测') => {
  const latest = Array.isArray(item.revisions) ? item.revisions.at(-1) as Loose | undefined : undefined
  return latest?.source === 'HUMAN' ? formatNormalizedScoreOutOfTwo(item.score, fallback) : formatLegacyScoreOutOfTwo(item.score, fallback)
}

function moduleRecordsForPackage(pkg: Loose, process: AnyEntity[], outcome: AnyEntity[], traces: AnyEntity[]): ModuleEvaluationRecord[] {
  for (const key of ['moduleEvaluations', 'moduleScores', 'moduleResults', 'modules', 'evaluations']) {
    const value = asList(pkg[key])
    if (value.length) return value.map((item) => {
      const evidence = (firstValue(item, ['evidence'], {}) as Loose) ?? {}
      const automaticStatus = firstValue(item, ['automaticStatus', 'autoStatus', 'autoVerdict', 'verdict', 'status'], 'UNKNOWN')
      return {
        ...item,
        id: text(item.id, ''),
        module: firstValue(item, ['moduleLabel', 'module', 'moduleCode'], 'Reason'),
        moduleLabel: firstValue(item, ['moduleLabel', 'module', 'moduleCode'], 'Reason'),
        autoStatus: automaticStatus,
        humanStatus: firstValue(item, ['humanStatus', 'humanVerdict', 'manualStatus']),
        judgeReason: firstValue(item, ['judgeReason', 'reason'], '判定依据未记录'),
        evidenceIds: ids(firstValue(item, ['evidenceIds'], firstValue(evidence, ['rootEvidenceIds'], []))),
        rootEvidenceIds: ids(firstValue(evidence, ['rootEvidenceIds'], [])),
        rubricRule: firstValue(evidence, ['rubricRule', 'rubric'], firstValue(item, ['rubricRule'])),
        observationIds: ids(firstValue(evidence, ['observationIds'], [])),
        logIds: ids(firstValue(evidence, ['logIds'], [])),
        observationId: ids(firstValue(evidence, ['observationIds'], []))[0] ?? item.observationId,
        logId: ids(firstValue(evidence, ['logIds'], []))[0] ?? item.logId,
        inputSummary: evidence.inputSummary,
        outputSummary: evidence.outputSummary,
        firstFailure: evidence.firstFailure,
        derivedFailure: evidence.derivedFailure,
        derivedFrom: evidence.derivedFromModule,
        traceId: text(firstValue(item, ['traceId'], firstValue(pkg, ['traceId'])))
      }
    })
  }
  const traceId = text(firstValue(pkg, ['traceId', 'trace']))
  const processRows = process.filter((item) => text(item.traceId) === traceId)
  const outcomeRows = outcome.filter((item) => text(item.traceId) === traceId)
  const records: ModuleEvaluationRecord[] = processRows.map((item) => {
    const latest = Array.isArray(item.revisions) ? item.revisions.at(-1) as Loose | undefined : undefined
    return { id: item.id, module: moduleName(item.dimension), moduleLabel: moduleName(item.dimension), autoStatus: item.verdict, score: item.score, judgeReason: text(firstValue(latest ?? {}, ['reason'], firstValue(item, ['reason']))), evidenceIds: ids(item.evidenceIds), observationId: item.observationId, logId: text(firstValue(item, ['logId'])) }
  })
  records.push(...outcomeRows.map((item) => {
    const latest = Array.isArray(item.revisions) ? item.revisions.at(-1) as Loose | undefined : undefined
    return { id: item.id, module: 'Outcome / 产物', moduleLabel: 'Outcome / 产物', autoStatus: item.verdict, score: item.score, judgeReason: text(firstValue(latest ?? {}, ['reason'], firstValue(item, ['reason']))), evidenceIds: ids(item.evidenceIds), artifactId: item.artifactId }
  }))
  if (records.length) return records
  const trace = traces.find((item) => text(item.id) === traceId)
  return [{ id: `module-${traceId}`, module: 'Outcome / 产物', autoStatus: status(trace ?? {}, 'UNKNOWN'), judgeReason: '尚未生成模块评测包。', evidenceIds: [] }]
}

function buildFallbackPackages(state: AnyState, process: AnyEntity[], outcome: AnyEntity[]): Loose[] {
  const traces = entities(state, 'traces')
  const cases = entities(state, 'cases')
  const skills = entities(state, 'skills')
  return traces.map((trace) => {
    const caseRow = cases.find((item) => text(item.id) === text(trace.caseId))
    const processRows = process.filter((item) => text(item.traceId) === trace.id)
    const outcomeRows = outcome.filter((item) => text(item.traceId) === trace.id)
    const moduleRecords = moduleRecordsForPackage({ traceId: trace.id }, process, outcome, traces)
    const evidenceIds = [...new Set(moduleRecords.flatMap((item) => ids(item.evidenceIds)))]
    const failureCount = moduleRecords.filter((item) => ['FAIL', 'DERIVED_FAIL'].includes(text(firstValue(item, ['autoStatus', 'verdict', 'status']), 'UNKNOWN').toUpperCase())).length
    const skillIds = ids(firstValue(caseRow ?? {}, ['skillIds']))
    return {
      id: `package-${trace.id}`, batchId: 'batch-v1-legacy', caseId: trace.caseId, sessionId: trace.sessionId, traceId: trace.id,
      query: text(firstValue(caseRow ?? {}, ['query', 'title']), '未记录 Query'), agentVersion: text(firstValue(caseRow ?? {}, ['agentVersion']), '待记录'),
      skillVersion: skills.filter((item) => skillIds.includes(item.id)).map((item) => `${text(item.name)} ${text(item.version)}`).join('、') || '待记录',
      skillCategory: text(firstValue(trace, ['skillCategory'], firstValue(caseRow ?? {}, ['skillCategory'])), 'UNCLASSIFIED'),
      processEvalCoverage: processRows.length ? '已覆盖' : 'UNKNOWN', outcomeEvalCoverage: outcomeRows.length ? '已覆盖' : 'UNKNOWN',
      moduleFailureCount: failureCount, evidenceCompleteness: moduleRecords.length && evidenceIds.length ? `${Math.round((evidenceIds.length / Math.max(1, moduleRecords.length)) * 100)}%` : 'UNKNOWN',
      routingStatus: '待分流', badcaseStatus: '待确认', owner: text(firstValue(caseRow ?? {}, ['owner']), '未分配'), moduleEvaluations: moduleRecords, evidenceIds
    }
  })
}

function deriveBatches(state: AnyState, packages: Loose[]): Loose[] {
  const traces = entities(state, 'traces')
  const inputTraceIds = packages.map((item) => text(firstValue(item, ['traceId'])))
  return [{ id: 'batch-v1-legacy', name: 'V1 兼容评测批次', status: 'Completed', inputTraceIds, inputTraceCount: inputTraceIds.length || traces.length, successCount: packages.filter((item) => text(item.evidenceCompleteness) !== 'UNKNOWN').length, partialCount: packages.filter((item) => text(item.processEvalCoverage) === 'UNKNOWN' || text(item.outcomeEvalCoverage) === 'UNKNOWN').length, failedCount: packages.filter((item) => Number(firstValue(item, ['moduleFailureCount'], 0)) > 0).length, pendingCount: 0, evalAgentVersion: 'process-eval-2.1 / outcome-eval-3.0', rubricVersion: 'legacy-rubric-v1', createdAt: '2026-09-20T02:00:00.000Z', updatedAt: '2026-09-26T14:00:00.000Z', runHistory: [{ id: 'job-v1-legacy-1', status: 'Completed', createdAt: '2026-09-26T14:00:00.000Z', completedAt: '2026-09-26T14:00:00.000Z', error: '' }], frozenConfigSnapshot: { source: 'V1 兼容视图', mock: true } }]
}

function LegacyEvaluationDrawer({ selected, tab, state, navigation, latestRevision, revisions, selectedEvidence, selectedObservation, onClose, onOpenRevision }: { selected: AnyEntity; tab: EvalTab; state: EvolutionState; navigation: ReturnType<typeof useReferenceNavigation>; latestRevision?: Loose; revisions: Loose[]; selectedEvidence: EvolutionState['evidence']; selectedObservation?: EvolutionState['observations'][number]; onClose: () => void; onOpenRevision: () => void }) {
  const scoreLabel = latestRevision?.source === 'HUMAN' ? formatNormalizedScoreOutOfTwo(selected.score) : formatLegacyScoreOutOfTwo(selected.score)
  return <div role="dialog" aria-label={`${tab === 'process' ? '过程' : '产物'}评测详情`} className="fixed inset-0 z-40"><button className="absolute inset-0 bg-slate-950/25" aria-label="关闭评测详情遮罩" onClick={onClose} /><aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-panel shadow-2xl"><header className="flex items-start justify-between border-b border-line p-5"><div><h2 className="text-base font-semibold text-ink"><EntityId id={selected.id} kind={tab === 'process' ? 'process-eval' : 'outcome-eval'} onOpen={navigation.open} /></h2><p className="mt-1 text-xs text-muted">自动结论、Evidence 与人工修订历史</p></div><div className="flex gap-2"><Button variant="primary" onClick={onOpenRevision}>新增人工修订</Button><button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs text-muted hover:bg-slate-100">关闭</button></div></header><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"><Section><SectionHeader title="评测判定" actions={<span className="font-mono text-sm font-semibold text-accent">{scoreLabel}</span>} /><KeyValueGrid className="mt-3" items={[{ label: '评分（0–2）', value: scoreLabel }, { label: '辅助判定（不参与主评分）', value: `${text(selected.verdict, 'UNKNOWN')} / ${text(latestRevision?.verdict, '未复核')}` }, { label: '评测版本', value: text(selected.evalVersion, '待记录') }, { label: '判定依据', value: text(latestRevision?.reason, '未记录') }, { label: '评测时间', value: dateText(latestRevision?.evaluatedAt ?? selected.createdAt) }]} /></Section><Section><SectionHeader title="Evidence" description="根证据、Rubric 条款与观察节点共同形成可审计判据。" actions={<Scale className="h-4 w-4 text-accent" />} /><div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2">{selectedEvidence.map((item) => <IdLink key={item.id} id={item.id} label={`${item.id} · ${item.title}`} kind="evidence" onOpen={navigation.open} />)}{!selectedEvidence.length && <TagList values={[]} empty="暂无 Evidence，需人工补充" />}</div><KeyValueGrid items={[{ label: 'Rubric 条款', value: state.evidence.find((item) => strings(selected.evidenceIds).includes(item.id) && item.kind === 'RULE') ? '已记录为 RULE Evidence' : 'Rubric 条款未由当前 Mock Eval Provider 返回' }, { label: 'Observation', value: selectedObservation ? <IdLink id={selectedObservation.id} kind="observation" onOpen={navigation.open} /> : '当前 Eval 未关联 Observation' }, { label: 'Log', value: selectedObservation ? <IdLink id={selectedObservation.logId} kind="log" onOpen={navigation.open} /> : '不适用' }]} /></div></Section><Section><SectionHeader title="关联对象" actions={<Link2 className="h-4 w-4 text-accent" />} /><div className="mt-3 flex flex-wrap gap-3"><IdLink id={text(selected.caseId)} kind="case" onOpen={navigation.open} /><IdLink id={text(selected.traceId)} kind="trace" onOpen={navigation.open} />{Boolean(selected.artifactId) && <IdLink id={text(selected.artifactId)} kind="artifact" onOpen={navigation.open} />}</div></Section><Section><SectionHeader title="人工修订记录" description="新结论以追加记录保存，不覆盖自动评测版本。" actions={<History className="h-4 w-4 text-accent" />} /><div className="mt-3 space-y-2">{revisions.map((revision, index) => <div key={text(revision.id, String(index))} className="rounded-md border border-line bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-accent">{revision.source === 'HUMAN' ? formatNormalizedScoreOutOfTwo(revision.score, '未评分') : formatLegacyScoreOutOfTwo(revision.score, '未评分')}<span className="ml-1 text-[10px] text-muted">· {revision.source === 'HUMAN' ? '人工' : '自动'}</span></span><span className="text-[10px] text-muted">{dateText(revision.evaluatedAt)}</span></div><p className="mt-2 text-xs text-ink">{text(revision.reason, '未填写说明')}</p><p className="mt-1 text-[10px] text-muted">辅助判定：{text(revision.verdict, 'UNKNOWN')}</p></div>)}</div></Section></div></aside></div>
}

export function EvaluationCenterPage({ onNavigateReference, initialEvaluationId, initialArtifactId }: { onNavigateReference?: (target: ReferenceTarget) => void; initialEvaluationId?: string; initialArtifactId?: string }) {
  const { scopedState: state, dispatch, commit } = useScopedEvolution()
  const looseState = state as unknown as AnyState
  const process = entities(looseState, 'processEvals')
  const outcome = entities(looseState, 'outcomeEvals')
  const traces = entities(looseState, 'traces')
  const batchesFromState = [...entities(looseState, 'evaluationBatches'), ...entities(looseState, 'batches')]
  const rawPackages = [...entities(looseState, 'traceEvaluationPackages'), ...entities(looseState, 'tracePackages')]
  const initial = (initialEvaluationId || initialArtifactId) ? [...process, ...outcome].find((item) => item.id === initialEvaluationId || item.artifactId === initialArtifactId) : undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('evaluationTab') as ViewTab | null
  const defaultTab = searchParams.get('batchId') ? 'batches' : searchParams.get('packageId') ? 'traces' : 'process'
  const initialJob = searchParams.get('jobId') ? state.evaluationJobs.find((job) => job.id === searchParams.get('jobId')) : undefined
  const [tab, setTab] = useState<ViewTab>(initial ? (outcome.some((item) => item.id === initial.id) ? 'outcome' : 'process') : (initialTab || defaultTab as ViewTab))
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initial?.id)
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(searchParams.get('packageId') ?? undefined)
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(searchParams.get('batchId') ?? initialJob?.batchId ?? undefined)
  const [selectedModule, setSelectedModule] = useState<ModuleEvaluationRecord>()
  const [moduleReviewOpen, setModuleReviewOpen] = useState(false)
  const [batchDraftOpen, setBatchDraftOpen] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [batchTraceIds, setBatchTraceIds] = useState('')
  const [batchEvalAgent, setBatchEvalAgent] = useState('eval-agent-v2.4')
  const [batchRubric, setBatchRubric] = useState('rubric-v2.1')
  const [localBatches, setLocalBatches] = useState<Loose[]>([])
  const [ledgerBatch, setLedgerBatch] = useState(searchParams.get('batchId') ?? '')
  const [ledgerCategory, setLedgerCategory] = useState(searchParams.get('skillCategory') ?? '')
  const [coverage, setCoverage] = useState(searchParams.get('coverage') ?? '')
  const [routingStatus, setRoutingStatus] = useState(searchParams.get('routingStatus') ?? '')
  const [badcaseStatus, setBadcaseStatus] = useState(searchParams.get('badcaseStatus') ?? '')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [verdict, setVerdict] = useState<EvaluationVerdict>('FAIL')
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const navigation = useReferenceNavigation(onNavigateReference)
  const packages = useMemo(() => {
    const fallback = rawPackages.length ? rawPackages : buildFallbackPackages(looseState, process, outcome)
    if (!rawPackages.length) return fallback
    const ledger = selectTraceEvaluationLedger(looseState as unknown as EvolutionState)
    const ledgerByPackage = new Map(ledger.map((row) => [row.package.id, row]))
    return fallback.map((item) => {
      const row = ledgerByPackage.get(text(item.id))
      return row ? { ...item, processEvalCoverage: row.processCoverage, outcomeEvalCoverage: row.outcomeCoverage, evidenceCompleteness: row.evidenceCompleteness, moduleFailureCount: row.moduleFailureCount, routingStatus: row.routingStatus, badcaseStatus: row.badcaseStatus, owner: row.owner ?? item.owner } : item
    })
  }, [rawPackages, looseState, process, outcome])
  const batches = useMemo(() => [...(batchesFromState.length ? batchesFromState : deriveBatches(looseState, packages)), ...localBatches.filter((item) => !(batchesFromState.length ? batchesFromState : deriveBatches(looseState, packages)).some((row) => row.id === item.id))], [batchesFromState, looseState, packages, localBatches])
  const selected = [...process, ...outcome].find((item) => item.id === selectedId)
  const selectedPackage = packages.find((item) => item.id === selectedPackageId)
  const selectedBatch = batches.find((item) => item.id === selectedBatchId)
  const latestJob = selectedBatch ? state.evaluationJobs.filter((job) => job.batchId === selectedBatch.id).at(-1) : undefined
  const rows = tab === 'process' ? process : outcome
  const filtered = useMemo(() => rows.filter((item) => !query.trim() || [item.id, item.caseId, item.traceId, item.artifactId, item.dimension, item.verdict].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, rows])
  const filteredPackages = useMemo(() => packages.filter((item) => {
    const needle = query.trim().toLocaleLowerCase()
    const haystack = [item.id, item.batchId, item.caseId, item.sessionId, item.traceId, item.query, item.agentVersion, item.skillVersion, item.skillCategory, item.owner].map((value) => String(value ?? '')).join(' ').toLocaleLowerCase()
    if (needle && !haystack.includes(needle)) return false
    if (ledgerBatch && text(item.batchId) !== ledgerBatch) return false
    if (ledgerCategory && text(item.skillCategory) !== ledgerCategory) return false
    if (coverage === 'missing' && text(item.evidenceCompleteness) !== 'UNKNOWN' && text(item.evidenceCompleteness) !== '待补充') return false
    if (coverage === 'complete' && (text(item.evidenceCompleteness) === 'UNKNOWN' || text(item.evidenceCompleteness) === '待补充')) return false
    if (routingStatus && text(item.routingStatus) !== routingStatus) return false
    if (badcaseStatus && text(item.badcaseStatus) !== badcaseStatus) return false
    return true
  }), [packages, query, ledgerBatch, ledgerCategory, coverage, routingStatus, badcaseStatus])
  const setFilter = (key: string, value: string, setter: (value: string) => void) => { setter(value); const next = new URLSearchParams(searchParams); if (value) next.set(key, value); else next.delete(key); setSearchParams(next, { replace: true }) }
  const goTab = (next: string) => { setTab(next as ViewTab); const params = new URLSearchParams(searchParams); params.set('evaluationTab', next); setSearchParams(params, { replace: true }); setSelectedId(undefined); setSelectedPackageId(undefined) }
  const openBatch = (id: string) => { setSelectedBatchId(id); const params = new URLSearchParams(searchParams); params.set('batchId', id); params.delete('packageId'); setSearchParams(params, { replace: true }) }
  const closeBatch = () => { setSelectedBatchId(undefined); const params = new URLSearchParams(searchParams); params.delete('batchId'); params.delete('jobId'); setSearchParams(params, { replace: true }) }
  const openPackage = (id: string) => { setSelectedPackageId(id); const params = new URLSearchParams(searchParams); params.set('packageId', id); params.delete('batchId'); setSearchParams(params, { replace: true }) }
  const closePackage = () => { setSelectedPackageId(undefined); const params = new URLSearchParams(searchParams); params.delete('packageId'); setSearchParams(params, { replace: true }) }
  const createBatch = () => {
    const at = new Date().toISOString()
    const traceIds = batchTraceIds.split(/[\s,，]+/).map((value) => value.trim()).filter(Boolean)
    const selectedTraceIds = traceIds.length ? traceIds : traces.map((trace) => trace.id)
    const batch: Loose = { id: `batch-${Date.now()}`, name: batchName.trim() || '新建 Trace 评测批次', status: 'DRAFT', traceIds: selectedTraceIds, packageIds: [], jobIds: [], evalAgentVersion: batchEvalAgent, rubricVersion: batchRubric, runEnvironment: 'local-mock-runner', createdBy: '当前用户', stats: { inputTraceCount: selectedTraceIds.length, successCount: 0, partialCount: 0, failedCount: 0, pendingCount: selectedTraceIds.length }, createdAt: at, updatedAt: at }
    setLocalBatches((current) => [...current, batch])
    dispatch({ type: 'CREATE_EVALUATION_BATCH', batch, meta: { actor: '当前用户', reason: '评测中心创建批次', at } } as never)
    setBatchDraftOpen(false); setBatchName(''); setBatchTraceIds('')
  }
  const runBatch = (batch: Loose, retry = false) => {
    const at = new Date().toISOString()
    const batchId = text(batch.id)
    const traceIds = ids(firstValue(batch, ['traceIds', 'inputTraceIds']))
    if (retry) {
      const previous = state.evaluationJobs.find((job) => job.batchId === batchId && ['FAILED', 'PARTIAL', 'CANCELLED'].includes(job.status))
      if (previous) dispatch({ type: 'RETRY_EVALUATION_JOB', jobId: previous.id, meta: { actor: '当前用户', reason: '重试失败评测批次', at } })
      return
    }
    const job: Loose = { id: `job-${batchId}-${Date.now()}`, batchId, attempt: 1, status: 'QUEUED', traceIds, processedTraceIds: [], failedTraceIds: [], evalAgentVersion: text(firstValue(batch, ['evalAgentVersion']), batchEvalAgent), rubricVersion: text(firstValue(batch, ['rubricVersion']), batchRubric), runEnvironment: text(firstValue(batch, ['runEnvironment']), 'local-mock-runner'), configurationSnapshot: { repeatCount: 3, source: 'structured-mock', createdAt: at }, queuedAt: at, createdAt: at, updatedAt: at }
    setLocalBatches((current) => current.map((item) => item.id === batchId ? { ...item, status: 'QUEUED', updatedAt: at, stats: { ...(firstValue(item, ['stats'], {}) as Loose), pendingCount: traceIds.length } } : item))
    dispatch({ type: 'QUEUE_EVALUATION_JOB', job, meta: { actor: '当前用户', reason: '启动评测批次', at } } as never)
  }
  const startEvaluationJob = () => { if (!latestJob) return; dispatch({ type: 'START_EVALUATION_JOB', jobId: latestJob.id, meta: { actor: '当前用户', reason: '开始执行评测作业', at: new Date().toISOString() } } as never) }
  const completeEvaluationJob = () => { if (!latestJob) return; dispatch({ type: 'COMPLETE_EVALUATION_JOB', jobId: latestJob.id, meta: { actor: '当前用户', reason: '完成 Mock 评测作业', at: new Date().toISOString() } } as never) }
  const failEvaluationJob = () => { if (!latestJob) return; dispatch({ type: 'FAIL_EVALUATION_JOB', jobId: latestJob.id, error: 'Mock Eval Agent 运行失败，保留失败历史。', meta: { actor: '当前用户', reason: '标记评测作业失败', at: new Date().toISOString() } } as never) }
  const revisions = selected && Array.isArray(selected.revisions) ? selected.revisions.filter((item): item is Loose => Boolean(item && typeof item === 'object')) : []
  const latestRevision = revisions.at(-1)
  const selectedEvidence = selected ? state.evidence.filter((item) => strings(selected.evidenceIds).includes(item.id)) : []
  const selectedObservation = selected?.observationId ? state.observations.find((item) => item.id === selected.observationId) : undefined
  const saveRevision = () => { if (!selected) return; const at = new Date().toISOString(); const parsedScore = score.trim() === '' ? undefined : Number(score); const revision: EvaluationRevision = { id: `revision-${selected.id}-${Date.now()}`, source: 'HUMAN', verdict, score: Number.isFinite(parsedScore) ? parsedScore : undefined, reason: reason.trim() || '人工复核完成。', evidenceIds: strings(selected.evidenceIds), evaluator: '当前用户', evaluatedAt: at, supersedesRevisionId: text(latestRevision?.id, '') || undefined }; dispatch({ type: 'ADD_EVALUATION_REVISION', evaluationType: tab === 'process' ? 'PROCESS' : 'OUTCOME', evaluationId: selected.id, revision, meta: { actor: '当前用户', reason: revision.reason, at } }); setRevisionOpen(false); setReason(''); setScore('') }
  const evaluationColumns: Column<AnyEntity>[] = [
    { key: 'id', header: 'Eval ID', accessor: (row) => <IdLink id={row.id} kind={tab === 'process' ? 'process-eval' : 'outcome-eval'} onOpen={navigation.open} /> },
    { key: 'caseId', header: 'Case / Trace', accessor: (row) => <div className="space-y-1"><IdLink id={text(row.caseId)} kind="case" onOpen={navigation.open} /><br /><IdLink id={text(row.traceId)} kind="trace" onOpen={navigation.open} /></div> },
    { key: 'dimension', header: '评测维度', accessor: (row) => text(row.dimension, text(row.name)) },
    { key: 'score', header: '评分（0–2）', accessor: (row) => <div className="space-y-1"><span className="font-mono font-semibold text-accent">{evaluationScoreLabel(row)}</span><span className="block text-[10px] text-muted">自动结论：{text(row.verdict, 'UNKNOWN')}</span></div> },
    { key: 'version', header: '评测版本', accessor: (row) => text(row.evalVersion, text(row.rubricVersion, text(row.judgeVersion, '待记录'))) },
    { key: 'evaluatedAt', header: '评测时间', accessor: (row) => dateText(row.evaluatedAt ?? row.createdAt) }
  ]
  const batchColumns: Column<Loose>[] = [
    { key: 'id', header: '批次 ID', accessor: (row) => <div className="space-y-1"><span className="block text-xs font-semibold text-ink">{text(row.name, '未命名批次')}</span><IdLink id={text(row.id)} kind="evaluation-batch" onOpen={navigation.open} /></div> },
    { key: 'status', header: '状态', accessor: (row) => <StatusBadge status={status(row, 'Draft')} label={status(row, 'Draft')} /> },
    { key: 'count', header: 'Trace 统计', accessor: (row) => <div className="space-y-1 text-[11px]"><div>输入 {text(batchStat(row, 'inputTraceCount', ids(firstValue(row, ['traceIds', 'inputTraceIds'])).length), '0')}</div><div className="text-muted">成功 {text(batchStat(row, 'successCount'))} · 失败 {text(batchStat(row, 'failedCount'))} · 待处理 {text(batchStat(row, 'pendingCount'))}</div></div> },
    { key: 'versions', header: 'Eval / Rubric', accessor: (row) => <div className="space-y-1 text-[11px]"><div>{text(firstValue(row, ['evalAgentVersion', 'evalVersion']), '待记录')}</div><div className="text-muted">{text(firstValue(row, ['rubricVersion']), '待记录')}</div></div> },
    { key: 'createdAt', header: '创建时间', accessor: (row) => dateText(row.createdAt) },
    { key: 'actions', header: '操作', accessor: (row) => <div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" icon={Play} onClick={() => runBatch(row)}>运行</Button>{['FAILED', 'PARTIAL', 'CANCELLED', 'Failed', 'Partial'].includes(status(row)) && <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => runBatch(row, true)}>重试</Button>}</div> }
  ]
  const ledgerColumns: Column<Loose>[] = [
    { key: 'batch', header: 'Batch / Case / Session', accessor: (row) => <div className="space-y-1"><IdLink id={text(row.batchId)} kind="evaluation-batch" onOpen={navigation.open} /><br /><IdLink id={text(row.caseId)} kind="case" onOpen={navigation.open} /><br /><IdLink id={text(row.sessionId)} kind="session" onOpen={navigation.open} /></div> },
    { key: 'trace', header: 'Trace', accessor: (row) => <IdLink id={text(row.traceId)} kind="trace" onOpen={navigation.open} /> },
    { key: 'query', header: 'Query', accessor: (row) => <span className="block max-w-[280px] truncate" title={text(row.query)}>{text(row.query, '未记录 Query')}</span> },
    { key: 'version', header: 'Agent / Skill', accessor: (row) => <div className="space-y-1 text-[11px]"><div>{text(row.agentVersion, '待记录')}</div><div className="text-muted">{text(row.skillVersion, '待记录')}</div><StatusBadge status={text(row.skillCategory, 'UNCLASSIFIED')} label={text(row.skillCategory, 'UNCLASSIFIED')} tone="neutral" showIcon={false} /></div> },
    { key: 'coverage', header: '评测覆盖', accessor: (row) => <div className="space-y-1 text-[11px]"><div>过程：{text(row.processEvalCoverage, 'UNKNOWN')}</div><div>产物：{text(row.outcomeEvalCoverage, 'UNKNOWN')}</div></div> },
    { key: 'failure', header: '模块失败 / Evidence', accessor: (row) => <div className="space-y-1 text-[11px]"><div className="font-semibold text-fail">{text(row.moduleFailureCount, '0')} 个失败模块</div><div className="text-muted">证据 {text(row.evidenceCompleteness, 'UNKNOWN')}</div></div> },
    { key: 'routing', header: '分流 / Badcase', accessor: (row) => <div className="space-y-1"><StatusBadge status={text(row.routingStatus, '待分流')} label={text(row.routingStatus, '待分流')} showIcon={false} tone="neutral" /><StatusBadge status={text(row.badcaseStatus, '待确认')} label={text(row.badcaseStatus, '待确认')} showIcon={false} tone="neutral" /></div> },
    { key: 'owner', header: 'Owner', accessor: (row) => text(row.owner, '未分配') }
  ]
  const selectedPackageModules = selectedPackage ? moduleRecordsForPackage(selectedPackage, process, outcome, traces).map((module) => module.moduleCode && module.evidence ? projectModuleReview(module as unknown as ModuleEvaluationScore, state.moduleReviews) as unknown as ModuleEvaluationRecord : module) : []
  const reviewPackageModule = (module: ModuleEvaluationRecord) => { setSelectedModule(module); setModuleReviewOpen(true) }
  const showPackageModuleEvidence = (module: ModuleEvaluationRecord) => { setSelectedModule(module); setModuleReviewOpen(false) }
  const selectedModuleEvidence = selectedModule ? state.evidence.filter((item) => ids(firstValue(selectedModule, ['evidenceIds', 'rootEvidenceIds'])).includes(item.id)) as unknown as Loose[] : []
  const saveModuleReview = async (input: ModuleReviewInput) => {
    if (!selectedModule || !selectedPackage) throw new Error('当前 Trace 评测包已关闭，请重新打开后复核')
    await commit({ type: 'REVIEW_TRACE_MODULE', input, meta: { actor: input.reviewer, reason: input.reason, at: input.reviewedAt, auditId: `audit-${input.reviewId}` } })
    setModuleReviewOpen(false)
    setSelectedModule((current) => current ? { ...current, automaticRevisionId: input.automaticRevisionId, humanStatus: input.auxiliaryVerdict, humanScore: input.humanScore, humanNote: input.reason, humanUpdatedBy: input.reviewer, humanUpdatedAt: input.reviewedAt } : current)
  }
  return <div>
    <PageHeading eyebrow="EVALUATION CENTER" title="评测中心" description="批次、全量 Trace 台账、过程评测与产物 / 结果评测独立浏览；每个模块都可以展开根证据 + Rubric，并保留自动与人工结论。" actions={<Button variant="primary" icon={Database} onClick={() => setBatchDraftOpen(true)}>创建评测批次</Button>} />
    <Tabs aria-label="评测视图" activeId={tab} onChange={goTab} items={[{ id: 'batches', label: '批次历史', count: batches.length }, { id: 'traces', label: '全部已评测 Trace', count: packages.length }, { id: 'process', label: '过程评测', count: process.length }, { id: 'outcome', label: '产物 / 结果评测', count: outcome.length }]} />
    {tab === 'batches' && <div role="tabpanel" id="tabpanel-batches"><Section className="mt-4"><SectionHeader title="评测批次历史" description="每次运行保留输入 Trace 集、Eval Agent / Rubric 版本、运行条件与失败重试历史。" actions={<StatusBadge status="Mock 数据" label="Mock 数据" tone="warn" showIcon={false} />} /><DataTable className="mt-3" caption="评测批次历史" rows={batches} columns={batchColumns} rowKey={(row) => text(row.id)} onRowClick={(row) => openBatch(text(row.id))} /></Section></div>}
    {tab === 'traces' && <div role="tabpanel" id="tabpanel-traces"><FilterBar className="mt-4" title="Trace 评测台账筛选" searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索 Batch、Case、Session、Trace、Query、Owner" resultCount={filteredPackages.length} onReset={() => { setQuery(''); setFilter('batchId', '', setLedgerBatch); setFilter('skillCategory', '', setLedgerCategory); setFilter('coverage', '', setCoverage); setFilter('routingStatus', '', setRoutingStatus); setFilter('badcaseStatus', '', setBadcaseStatus) }} controls={[{ id: 'batchId', label: '批次', value: ledgerBatch, options: batches.map((item) => ({ label: text(item.name, text(item.id)), value: text(item.id) })), onChange: (value) => setFilter('batchId', value, setLedgerBatch) }, { id: 'skillCategory', label: 'Skill Category', value: ledgerCategory, options: ['PRODUCTION_SKILL', 'GENERAL', 'PERSONAL_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED'].map((value) => ({ label: value, value })), onChange: (value) => setFilter('skillCategory', value, setLedgerCategory) }, { id: 'coverage', label: 'Evidence', value: coverage, options: [{ label: '证据完整', value: 'complete' }, { label: '证据缺失 / UNKNOWN', value: 'missing' }], onChange: (value) => setFilter('coverage', value, setCoverage) }, { id: 'routingStatus', label: '分流状态', value: routingStatus, options: ['PENDING', 'QUEUED', 'DELIVERED', 'ACKNOWLEDGED', 'REJECTED', 'RESOLVED', 'NONE'].map((value) => ({ label: value, value })), onChange: (value) => setFilter('routingStatus', value, setRoutingStatus) }, { id: 'badcaseStatus', label: 'Badcase', value: badcaseStatus, options: ['CANDIDATE', 'CONFIRMED', 'REJECTED', 'RESOLVED', 'NONE'].map((value) => ({ label: value, value })), onChange: (value) => setFilter('badcaseStatus', value, setBadcaseStatus) }]} /></div>}
    {tab === 'traces' && <Section className="mt-4"><SectionHeader title="全部已评测 Trace" description="包含成功、部分完成、失败、缺少模块评测或 Evidence 的完整台账，不以缺失数据伪造 PASS。" /><DataTable className="mt-3" caption="全部已评测 Trace 台账" rows={filteredPackages} columns={ledgerColumns} rowKey={(row) => text(row.id)} onRowClick={(row) => openPackage(text(row.id))} /></Section>}
    {(tab === 'process' || tab === 'outcome') && <div role="tabpanel" id={`tabpanel-${tab}`}><FilterBar className="mt-4" searchValue={query} onSearchChange={setQuery} searchPlaceholder="搜索 Eval ID、Case、Trace、Artifact 或评测维度" resultCount={filtered.length} onReset={() => setQuery('')} /><Section className="mt-4"><SectionHeader title={tab === 'process' ? '过程评测列表' : '产物 / 结果评测列表'} description={tab === 'process' ? '关注 Reason、记忆、skill、Act、Tool 等执行模块；上文只作为 Evidence。' : '关注产物基本质量、结果有效性与用户约束是否满足。'} /><DataTable className="mt-3" caption={tab === 'process' ? '过程评测列表' : '产物结果评测列表'} rows={filtered} columns={evaluationColumns} rowKey={(row) => row.id} onRowClick={(row) => setSelectedId(row.id)} /></Section></div>}
    {selectedBatch && <DetailDrawer open onClose={closeBatch} title={`批次详情 · ${text(selectedBatch.id)}`} description="批次配置与运行历史以快照形式保留，重试会生成新的作业，不覆盖历史。"><div className="space-y-5"><Section><SectionHeader title={text(firstValue(selectedBatch, ['name']), text(selectedBatch.id))} actions={<StatusBadge status={status(selectedBatch, 'DRAFT')} />} /><KeyValueGrid className="mt-3" items={[{ label: '输入 Trace', value: text(batchStat(selectedBatch, 'inputTraceCount', ids(firstValue(selectedBatch, ['traceIds', 'inputTraceIds'])).length), '0') }, { label: 'Eval Agent Version', value: text(firstValue(selectedBatch, ['evalAgentVersion', 'evalVersion']), '待记录') }, { label: 'Rubric Version', value: text(firstValue(selectedBatch, ['rubricVersion']), '待记录') }, { label: '成功 / 部分 / 失败 / 待处理', value: `${text(batchStat(selectedBatch, 'successCount'))} / ${text(batchStat(selectedBatch, 'partialCount'))} / ${text(batchStat(selectedBatch, 'failedCount'))} / ${text(batchStat(selectedBatch, 'pendingCount'))}` }]} /><div className="mt-4 flex flex-wrap gap-2"><Button variant="primary" icon={Play} onClick={() => runBatch(selectedBatch)}>运行批次</Button>{latestJob?.status === 'QUEUED' && <Button icon={Play} onClick={startEvaluationJob}>开始执行</Button>}{latestJob?.status === 'RUNNING' && <Button icon={ShieldCheck} onClick={completeEvaluationJob}>完成 Mock 运行</Button>}{latestJob?.status === 'RUNNING' && <Button variant="danger" icon={RefreshCw} onClick={failEvaluationJob}>标记失败</Button>}{['FAILED', 'PARTIAL', 'CANCELLED', 'Failed', 'Partial'].includes(status(selectedBatch)) && <Button icon={RefreshCw} onClick={() => runBatch(selectedBatch, true)}>重试失败项</Button>}</div></Section><Section><SectionHeader title="运行历史" actions={<History className="h-4 w-4 text-accent" />} /><div className="mt-3 space-y-2">{state.evaluationJobs.filter((job) => job.batchId === selectedBatch.id).length ? state.evaluationJobs.filter((job) => job.batchId === selectedBatch.id).map((job) => <div key={job.id} className="rounded-md border border-line bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><EntityId id={job.id} kind="evaluation-job" onOpen={navigation.open} /><StatusBadge status={job.status} /></div><p className="mt-1 text-[11px] text-muted">{dateText(job.createdAt)}{job.errorReason ? ` · ${job.errorReason}` : ''}</p></div>) : <p className="text-xs text-muted">尚未运行；点击“运行批次”创建 Queued 作业。</p>}</div></Section><Section><SectionHeader title="运行条件快照" actions={<ShieldCheck className="h-4 w-4 text-accent" />} /><pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-[10px] leading-5 text-slate-100">{JSON.stringify(firstValue(selectedBatch, ['configurationSnapshot', 'frozenConfigSnapshot', 'configSnapshot'], { runEnvironment: firstValue(selectedBatch, ['runEnvironment'], 'local-mock-runner') }), null, 2)}</pre></Section></div></DetailDrawer>}
    {selectedPackage && <DetailDrawer open onClose={closePackage} title={`Trace 评测包 · ${text(firstValue(selectedPackage, ['traceId']))}`} description="过程、产物、模块评分与分流状态在同一 Trace Evaluation Package 下可追溯。"><div className="space-y-5"><Section><SectionHeader title="Trace 基本信息" actions={<StatusBadge status={text(firstValue(selectedPackage, ['skillCategory']), 'UNCLASSIFIED')} label={text(firstValue(selectedPackage, ['skillCategory']), 'UNCLASSIFIED')} tone="neutral" showIcon={false} />} /><KeyValueGrid className="mt-3" items={[{ label: 'Query', value: text(firstValue(selectedPackage, ['query']), '未记录') }, { label: 'Batch', value: <IdLink id={text(firstValue(selectedPackage, ['batchId']))} kind="evaluation-batch" onOpen={navigation.open} /> }, { label: 'Case / Session', value: <span className="flex flex-wrap gap-2"><IdLink id={text(firstValue(selectedPackage, ['caseId']))} kind="case" onOpen={navigation.open} /><IdLink id={text(firstValue(selectedPackage, ['sessionId']))} kind="session" onOpen={navigation.open} /></span> }, { label: 'Agent / Skill Version', value: `${text(firstValue(selectedPackage, ['agentVersion']), '待记录')} / ${text(firstValue(selectedPackage, ['skillVersion']), '待记录')}` }, { label: 'Evidence 完整性', value: text(firstValue(selectedPackage, ['evidenceCompleteness']), 'UNKNOWN') }, { label: 'Owner', value: text(firstValue(selectedPackage, ['owner']), '未分配') }]} /></Section><Section><SectionHeader title="模块评测矩阵" description="固定展示 Reason、记忆、上文、skill、Act、Tool、Outcome / 产物；Context Assembly 只在 Evidence 中出现。" actions={<SearchCheck className="h-4 w-4 text-accent" />} /><div className="mt-3"><ModuleEvaluationMatrix modules={selectedPackageModules} onSelect={showPackageModuleEvidence} onReview={reviewPackageModule} /></div></Section><Section><SectionHeader title="分流与 Badcase" actions={<Workflow className="h-4 w-4 text-accent" />} /><KeyValueGrid className="mt-3" items={[{ label: 'Routing', value: text(firstValue(selectedPackage, ['routingStatus']), '待分流') }, { label: 'Badcase', value: text(firstValue(selectedPackage, ['badcaseStatus']), '待确认') }, { label: 'Finding 数', value: text(firstValue(selectedPackage, ['findingCount'], ids(firstValue(selectedPackage, ['findingIds'])).length)) }, { label: '处理 Owner', value: text(firstValue(selectedPackage, ['owner']), '未分配') }]} /><div className="mt-3 flex flex-wrap gap-2">{ids(firstValue(selectedPackage, ['routingDeliveryIds', 'deliveryIds'])).map((id) => <IdLink key={id} id={id} kind="routing-delivery" onOpen={navigation.open} />)}{!ids(firstValue(selectedPackage, ['routingDeliveryIds', 'deliveryIds'])).length && <TagList values={[]} empty="暂无分流 Delivery；模块失败确认后生成多路投递" />}</div></Section></div></DetailDrawer>}
    {selected && <LegacyEvaluationDrawer selected={selected} tab={tab as EvalTab} state={state} navigation={navigation} latestRevision={latestRevision} revisions={revisions} selectedEvidence={selectedEvidence} selectedObservation={selectedObservation} onClose={() => setSelectedId(undefined)} onOpenRevision={() => { setVerdict(text(selected.verdict, 'UNKNOWN') as EvaluationVerdict); const normalized = selected.score === undefined ? '' : evaluationScoreLabel(selected, '').replace(' / 2', ''); setScore(normalized); setRevisionOpen(true) }} />}
    <EvidenceBundleDrawer open={Boolean(selectedModule)} onClose={() => { setSelectedModule(undefined); setModuleReviewOpen(false) }} module={selectedModule} evidence={selectedModuleEvidence} onNavigateReference={navigation.open} onSaveReview={saveModuleReview} reviewOpen={moduleReviewOpen} />
    <Modal open={revisionOpen} onClose={() => setRevisionOpen(false)} title="新增人工修订" description="以新 Revision 追加保存，自动结论与历史版本不会被覆盖。主评分统一使用 0–2，PASS / FAIL 仅作为辅助判定。" footer={<div className="flex justify-end gap-2"><Button onClick={() => setRevisionOpen(false)}>取消</Button><Button variant="primary" onClick={saveRevision}>保存修订</Button></div>}><div className="space-y-3"><Field label="人工结论（辅助）"><SelectInput aria-label="人工结论" value={verdict} onChange={(event) => setVerdict(event.target.value as EvaluationVerdict)}>{['PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE'].map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="人工得分（0–2）"><TextInput aria-label="人工得分（0–2）" type="number" min="0" max="2" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} /></Field><Field label="修订说明"><TextArea aria-label="修订说明" value={reason} onChange={(event) => setReason(event.target.value)} /></Field></div></Modal>
    <Modal open={batchDraftOpen} onClose={() => setBatchDraftOpen(false)} title="创建评测批次" description="选择 Trace 集并冻结 Eval Agent / Rubric 版本；当前为本地 Mock 运行，不会调用真实评测服务。" size="lg" footer={<div className="flex justify-end gap-2"><Button onClick={() => setBatchDraftOpen(false)}>取消</Button><Button variant="primary" onClick={createBatch}>保存批次</Button></div>}><div className="grid gap-4 sm:grid-cols-2"><Field label="批次名称"><TextInput aria-label="批次名称" value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="例如：W40 线上 Trace 评测" /></Field><Field label="Eval Agent Version"><SelectInput aria-label="Eval Agent Version" value={batchEvalAgent} onChange={(event) => setBatchEvalAgent(event.target.value)}><option>eval-agent-v2.4</option><option>eval-agent-v2.3</option><option>待配置</option></SelectInput></Field><Field label="Rubric Version"><SelectInput aria-label="Rubric Version" value={batchRubric} onChange={(event) => setBatchRubric(event.target.value)}><option>rubric-v2.1</option><option>rubric-v2.0</option><option>待配置</option></SelectInput></Field><Field label="输入 Trace IDs" className="sm:col-span-2" hint="支持逗号、空格或换行分隔；留空时由真实服务选择 Trace 集。"><TextArea aria-label="输入 Trace IDs" value={batchTraceIds} onChange={(event) => setBatchTraceIds(event.target.value)} placeholder="trace-ppt-generate, trace-tool-export" /></Field></div></Modal>
    {navigation.drawer}
  </div>
}
