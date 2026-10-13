import { GitBranch, Route, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Button, Field, Modal, SectionHeader, SelectInput, StatusBadge, TextInput } from '../../ui'
import type { AssetCatalogKind, RuleConfig, RuleScope, ScopedRuleType } from '../domain'
import { EntityId, KeyValueGrid } from '../components/ViewPrimitives'
import { useEvolution } from '../store'
import { ASSET_CATALOG_KIND_LABELS } from '../data/assetManagement'
import { createScopedRule, isTasteClusterScope, resolveScopedRule, ruleAttributionsForAsset, ruleScopeId, validateScopedRule } from '../data/scopedRules'
import { governanceItemLabel } from '../governanceTaxonomy'
import { dateText, Section } from './shared'
import { DETAIL_KEYS, useContextNavigation } from '../../layout'

const categories: Array<{ type: ScopedRuleType; title: string; description: string; icon: LucideIcon }> = [
  { type: 'GATE', title: '指标准出门禁', description: '配置过程、产物和泛化得分门槛。', icon: ShieldCheck },
  { type: 'ROUTING', title: '分流规则', description: '配置策略迭代、Agent 迭代及责任人。', icon: Route },
  { type: 'CLUSTER', title: '聚类规则', description: '配置相关 Case 触发数与统计窗口。', icon: GitBranch }
]
const validType = (value: string | null): ScopedRuleType | undefined => categories.find(item => item.type === value)?.type
const numberValue = (value: string) => value.trim() ? Number(value) : undefined
interface Draft { processMin: string; outcomeMin: string; generalizationMin: string; requireHumanReview: boolean; strategy: boolean; agent: boolean; owner: string; minCases: string; windowDays: string }
const emptyDraft = (): Draft => ({ processMin: '', outcomeMin: '', generalizationMin: '', requireHumanReview: true, strategy: false, agent: false, owner: '', minCases: '', windowDays: '' })

export function RuleConfigurationPage({ initialRuleId }: { initialRuleId?: string } = {}) {
  const location = useLocation()
  const { navigateContext } = useContextNavigation()
  const { state, commit } = useEvolution()
  const [params, setParams] = useSearchParams()
  const linked = state.rules.find(rule => rule.id === initialRuleId)
  const type = validType(params.get('ruleType')) ?? linked?.configuration?.type
  const assetId = params.get('ruleAssetId') ?? linked?.configuration?.scope.assetId ?? ''
  const asset = state.assetCatalog?.find(item => item.id === assetId)
  const assetType = params.get('ruleAssetType') ?? asset?.kind ?? ''
  const assetVersion = params.get('ruleAssetVersion') ?? linked?.configuration?.scope.assetVersion ?? ''
  const attributionId = params.get('ruleAttribution') ?? linked?.configuration?.scope.attributionId ?? ''
  const scope: RuleScope = { assetId, attributionId, ...(assetVersion ? { assetVersion } : {}) }
  const assetOptions = (state.assetCatalog ?? []).filter(item => !assetType || item.kind === assetType)
  const versions = (state.assetVersions ?? []).filter(item => item.assetId === assetId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const attributions = ruleAttributionsForAsset(state, assetId)
  const attribution = attributions.find(item => item.id === attributionId)
  const completeScope = Boolean(type && asset && attribution && (!assetVersion || versions.some(item => item.version === assetVersion)))
  const stored = type && completeScope ? resolveScopedRule(state, type, scope) : undefined
  const template = type && completeScope ? createScopedRule(state, type, scope) : undefined
  const selectedCategory = categories.find(item => item.type === type)
  const scopeKey = type ? ruleScopeId(type, scope) : ''
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [legacyClosed, setLegacyClosed] = useState(false)
  const [legacyEdit, setLegacyEdit] = useState(false)
  const [legacyValue, setLegacyValue] = useState('')
  const [legacyError, setLegacyError] = useState('')

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    next.delete('ruleId')
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace: true })
    setFeedback('')
  }
  useEffect(() => {
    const value = stored ?? template
    const next = emptyDraft()
    const config = value?.configuration
    if (config?.type === 'GATE') {
      next.processMin = config.settings.processMin === undefined ? '' : String(config.settings.processMin)
      next.outcomeMin = config.settings.outcomeMin === undefined ? '' : String(config.settings.outcomeMin)
      next.generalizationMin = config.settings.generalizationMin === undefined ? '' : String(config.settings.generalizationMin)
      next.requireHumanReview = config.settings.requireHumanReview
    } else if (config?.type === 'ROUTING') {
      next.strategy = config.settings.destinations.includes('STRATEGY')
      next.agent = config.settings.destinations.includes('AGENT')
      next.owner = config.settings.owner ?? ''
    } else if (config?.type === 'CLUSTER') {
      next.minCases = config.settings.minCases === undefined ? '' : String(config.settings.minCases)
      next.windowDays = config.settings.windowDays === undefined ? '' : String(config.settings.windowDays)
    }
    setDraft(next)
    setFeedback('')
  }, [scopeKey, stored?.updatedAt])
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft(current => ({ ...current, [key]: value })); setFeedback('') }

  let candidate: RuleConfig | undefined
  if (template && type) {
    candidate = { ...(stored ?? template), configuration: structuredClone(template.configuration!) }
    const config = candidate.configuration!
    if (config.type === 'GATE') {
      config.settings = { processMin: numberValue(draft.processMin), outcomeMin: numberValue(draft.outcomeMin), generalizationMin: numberValue(draft.generalizationMin), requireHumanReview: draft.requireHumanReview }
      candidate.status = [draft.processMin, draft.outcomeMin, draft.generalizationMin].some(value => value.trim()) ? 'CONFIGURED' : 'PENDING'
    } else if (config.type === 'ROUTING') {
      config.settings = { destinations: [...(draft.strategy ? ['STRATEGY' as const] : []), ...(draft.agent ? ['AGENT' as const] : [])], owner: draft.owner.trim() || undefined }
      candidate.status = config.settings.destinations.length ? 'CONFIGURED' : 'PENDING'
    } else {
      config.settings = { minCases: numberValue(draft.minCases), windowDays: numberValue(draft.windowDays), countingUnit: 'CONFIRMED_CASE', requireHumanConfirmation: true }
      candidate.status = draft.minCases.trim() ? 'CONFIGURED' : 'PENDING'
    }
  }
  const validationErrors = candidate ? validateScopedRule(state, candidate) : []
  const clusterAllowed = type !== 'CLUSTER' || Boolean(attribution?.condition.includes('聚类优化'))
  const blocked = !completeScope || !candidate || validationErrors.length > 0 || !clusterAllowed || saving
  const save = async () => {
    if (blocked || !candidate) return
    setSaving(true)
    try {
      await commit({ type: 'UPSERT_SCOPED_RULE', rule: candidate, meta: { actor: '当前用户', reason: '按资产、固定版本及 PRD 归因保存治理规则' } })
      setFeedback(candidate.status === 'PENDING' ? '已保存，未填写的门槛保持待配置。' : '配置已保存。')
    } catch (error) { setFeedback('保存失败：' + (error instanceof Error ? error.message : String(error))) }
    finally { setSaving(false) }
  }
  const status = stored?.status ?? template?.status ?? 'PENDING'
  const legacy = !legacyClosed && linked && !linked.configuration ? linked : undefined
  const saveLegacy = async () => {
    if (!legacy || !legacyValue.trim()) return
    try {
      const parsed = Number(legacyValue)
      await commit({ type: 'UPDATE_RULE', ruleId: legacy.id, patch: { status: 'CONFIGURED', value: Number.isFinite(parsed) ? parsed : legacyValue.trim() }, meta: { actor: '当前用户', reason: '编辑历史平台规则' } })
      setLegacyEdit(false)
    } catch (error) { setLegacyError('保存失败：' + (error instanceof Error ? error.message : String(error))) }
  }

  return <div className="space-y-4">
    <p className="text-xs leading-6 text-muted">选择规则类别，在配置卡片内指定资产、版本和归因。每个范围独立保存，PRD 未明确的门槛保持待配置。</p>
    <div className="grid gap-4 md:grid-cols-3">
      {categories.map(item => {
        const count = state.rules.filter(rule => rule.configuration?.type === item.type && rule.status === 'CONFIGURED').length
        const Icon = item.icon
        return <button key={item.type} type="button" aria-label={'配置' + item.title} aria-pressed={type === item.type} onClick={() => update({ ruleType: item.type })} className={'rounded-lg border bg-panel p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' + (type === item.type ? 'border-accent shadow-panel' : 'border-line hover:border-accent/50')}>
          <Icon className="mb-3 h-5 w-5 text-accent" aria-hidden="true"/>
          <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold text-ink">{item.title}</h2><StatusBadge status={count ? 'CONFIGURED' : 'PENDING'} label={count ? '已有配置' : '待配置'} tone={count ? 'pass' : 'warn'} showIcon={false}/></div>
          <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
          <p className="mt-4 text-[11px] text-muted">{count ? count + ' 个范围已配置' : '选择资产与归因后配置'}<span className="float-right text-accent">打开配置 →</span></p>
        </button>
      })}
    </div>

    {selectedCategory && <section role="region" aria-label={selectedCategory.title + '配置'} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
      <SectionHeader title={selectedCategory.title + '配置'} description="此处选择的是规则的适用对象，不受线上时间或环境筛选影响。" actions={<StatusBadge status={status} label={status === 'CONFIGURED' ? (stored ? '已配置' : 'PRD 默认') : '待配置'} tone={status === 'CONFIGURED' ? 'pass' : 'warn'}/>}/>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="资产类型"><SelectInput aria-label="资产类型" value={assetType} onChange={event => update({ ruleAssetType: event.target.value, ruleAssetId: undefined, ruleAssetVersion: undefined, ruleAttribution: undefined })}><option value="">选择资产类型</option>{Object.entries(ASSET_CATALOG_KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</SelectInput></Field>
        <Field label="具体资产"><SelectInput aria-label="具体资产" value={assetId} disabled={!assetType} onChange={event => update({ ruleAssetId: event.target.value, ruleAssetVersion: undefined, ruleAttribution: undefined })}><option value="">{assetType ? '选择具体资产' : '先选择资产类型'}</option>{assetOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="资产版本"><SelectInput aria-label="资产版本" value={assetVersion} disabled={!asset} onChange={event => update({ ruleAssetVersion: event.target.value })}><option value="">全部版本（独立配置范围）</option>{versions.map(item => <option key={item.id} value={item.version}>{item.version}</option>)}</SelectInput></Field>
        <Field label="归因"><SelectInput aria-label="归因" value={attributionId} disabled={!asset} onChange={event => update({ ruleAttribution: event.target.value })}><option value="">{asset ? '选择归因' : '先选择具体资产'}</option>{attributions.map(item => <option key={item.id} value={item.id}>{governanceItemLabel(item)}</option>)}</SelectInput></Field>
      </div>

      {completeScope ? <div className="mt-5 border-t border-line pt-5">
        <div className="mb-5 flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-50 px-3 py-2">{asset?.name}</span><span className="rounded bg-slate-50 px-3 py-2">{assetVersion || '全部版本'}</span><span className="rounded bg-slate-50 px-3 py-2">{governanceItemLabel(attribution)}</span></div>
        {type === 'GATE' && <>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="过程最终得分下限" hint="0–2；留空为待配置"><TextInput aria-label="过程最终得分下限" type="number" min={0} max={2} step="0.1" value={draft.processMin} placeholder="待配置" onChange={event => change('processMin', event.target.value)}/></Field>
            <Field label="产物最终得分下限" hint="0–2；采用对应垂类评测标准"><TextInput aria-label="产物最终得分下限" type="number" min={0} max={2} step="0.1" value={draft.outcomeMin} placeholder="待配置" onChange={event => change('outcomeMin', event.target.value)}/></Field>
            <Field label="泛化最终得分下限" hint="0–2；留空为待配置"><TextInput aria-label="泛化最终得分下限" type="number" min={0} max={2} step="0.1" value={draft.generalizationMin} placeholder="待配置" onChange={event => change('generalizationMin', event.target.value)}/></Field>
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-accent" checked={draft.requireHumanReview} onChange={event => change('requireHumanReview', event.target.checked)}/>准出前需人工复核</label>
        </>}
        {type === 'ROUTING' && <>
          <fieldset><legend className="text-xs font-semibold">分流去向（支持多选）</legend><div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-4"><input type="checkbox" aria-label="策略迭代" className="mt-1 accent-accent" checked={draft.strategy} onChange={event => change('strategy', event.target.checked)}/><span><span className="text-sm font-semibold">策略迭代</span><span className="mt-1 block text-xs text-muted">提交算法团队 Badcase 队列。</span></span></label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-4"><input type="checkbox" aria-label="Agent 迭代" className="mt-1 accent-accent" checked={draft.agent} onChange={event => change('agent', event.target.checked)}/><span><span className="text-sm font-semibold">Agent 迭代</span><span className="mt-1 block text-xs text-muted">进入能力修补或聚类进化。</span></span></label>
          </div></fieldset>
          {asset?.kind === 'PRODUCTION_SKILL' && <p className="mt-3 text-xs text-muted">生产 Skill 的 Badcase 优先分流给算法团队；同一归因可以同时进入多条处理链。</p>}
          <Field label="责任人 / 团队" className="mt-4"><TextInput aria-label="责任人 / 团队" value={draft.owner} placeholder="待指定" onChange={event => change('owner', event.target.value)}/></Field>
        </>}
        {type === 'CLUSTER' && <>
          {!clusterAllowed && <p role="status" className="mb-4 rounded-lg bg-warn/10 p-3 text-xs text-warn">{attribution?.condition === '待配置' ? '该归因需求待补充，聚类规则暂不可配置。' : '该归因按 PRD 直接优化，聚类规则不适用。'}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="最少相关 Case 数" hint={isTasteClusterScope(state, scope) ? 'PRD 已明确：品味库按同一 Skill 积累 100 条相关数据。' : 'PRD 未明确的触发数保持待配置。'}><TextInput aria-label="最少相关 Case 数" type="number" min={1} step={1} disabled={!clusterAllowed} value={draft.minCases} placeholder="待配置" onChange={event => change('minCases', event.target.value)}/></Field>
            <Field label="统计窗口（天）" hint="留空表示未配置统计窗口。"><TextInput aria-label="统计窗口（天）" type="number" min={1} step={1} disabled={!clusterAllowed} value={draft.windowDays} placeholder="待配置" onChange={event => change('windowDays', event.target.value)}/></Field>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs leading-6 text-muted"><p className="font-semibold text-ink">计数口径</p><p>同一资产、归因和版本范围，按人工确认的相关 Case ID 去重。同一个 Case 的多条 Trace 不重复增加 Case 数。</p><p>品味库以同一 Skill 的相关 Case 为统计基础；选择固定版本时仅覆盖该版本。未配置的门槛不会被推断为已触发。</p></div>
        </>}
        {validationErrors.length > 0 && <p role="alert" className="mt-4 text-xs text-fail">{[...new Set(validationErrors.map(error => error.message))].join('；')}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="text-[11px] text-muted">{stored ? '上次更新 ' + dateText(stored.updatedAt) : '仅预览当前范围；保存后持久化到本地。'}</p><Button variant="primary" onClick={save} disabled={blocked}>{saving ? '正在保存…' : '保存配置'}</Button></div>
        {feedback && <p role={feedback.startsWith('保存失败') ? 'alert' : 'status'} className={'mt-3 text-xs ' + (feedback.startsWith('保存失败') ? 'text-fail' : 'text-pass')}>{feedback}</p>}
      </div> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-xs text-muted">请选择具体资产和归因，展示该范围的配置细项。</p>}
      <p className="mt-4 text-[10px] text-muted">Mock 本地规则配置。真实分流、聚类与准出执行服务尚未接入；保存不会覆盖历史评测或准出报告。</p>
    </section>}

    {legacy && <Modal open title="规则详情" onClose={() => { setLegacyClosed(true); update({}) }} footer={<><Button onClick={() => { setLegacyValue(legacy.value === undefined ? '' : String(legacy.value)); setLegacyError(''); setLegacyEdit(true) }}>编辑规则</Button><Button onClick={() => { setLegacyClosed(true); update({}) }}>关闭</Button></>}>
      <h2 className="text-sm font-semibold">{legacy.name}</h2><EntityId id={legacy.id} kind="rule" onOpen={target => { if (new URLSearchParams(location.search).get('ruleId') !== target.id) navigateContext('/rules', { clear: DETAIL_KEYS, params: { ruleId: target.id } }) }}/>
      <p className="my-3 text-xs text-muted">历史平台规则。新增规则通过页面卡片按资产与归因单独配置。</p>
      <KeyValueGrid items={[{ label: '当前值', value: legacy.status === 'PENDING' ? '待配置' : String(legacy.value) }, { label: '状态', value: legacy.status === 'PENDING' ? '待配置' : '已配置' }, { label: '口径说明', value: legacy.description }, { label: '更新时间', value: dateText(legacy.updatedAt) }]}/>
    </Modal>}
    <Modal open={legacyEdit} onClose={() => setLegacyEdit(false)} title="编辑规则" footer={<Button variant="primary" onClick={saveLegacy} disabled={!legacyValue.trim()}>保存规则</Button>}><Field label="规则值"><TextInput aria-label="规则值" value={legacyValue} onChange={event => setLegacyValue(event.target.value)}/></Field>{legacyError && <p role="alert" className="mt-3 text-xs text-fail">{legacyError}</p>}</Modal>
  </div>
}
