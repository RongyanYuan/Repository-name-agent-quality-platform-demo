import type { AssetCatalogEntry, EvolutionModule, EvolutionState, RuleConfig, RuleScope, ScopedRuleConfiguration, ScopedRuleType } from '../domain'
import { EVOLUTION_ITEMS, type EvolutionItemDefinition } from '../taxonomy'

export type { RuleScope, ScopedRuleConfiguration, ScopedRuleType } from '../domain'
export interface ScopedRuleValidationError { path: string; message: string }

const moduleForAsset = (asset: AssetCatalogEntry): EvolutionModule => {
  if (asset.skillId || ['PRODUCTION_SKILL', 'TASTE_SKILL', 'PERSONAL_SKILL'].includes(asset.kind)) return 'Skill'
  if (asset.kind === 'MEMORY') return 'Memory'
  if (asset.kind === 'TOOL') return 'Act'
  if (asset.kind === 'SYSTEM_PROMPT') return 'Reason'
  return 'Context'
}

/** Reuse the PRD taxonomy verbatim, including attributions with no history yet. */
export function ruleAttributionsForAsset(state: EvolutionState, assetId: string): readonly EvolutionItemDefinition[] {
  const asset = state.assetCatalog?.find(item => item.id === assetId)
  return asset ? EVOLUTION_ITEMS.filter(item => item.module === moduleForAsset(asset)) : []
}

export function ruleScopeId(type: ScopedRuleType, scope: RuleScope): string {
  return ['scoped-rule', type, scope.assetId, scope.attributionId, scope.assetVersion ?? 'ALL'].map(encodeURIComponent).join(':')
}

/** Exact scope lookup only: a Skill rule cannot leak into another Skill or module. */
export function resolveScopedRule(state: EvolutionState, type: ScopedRuleType, scope: RuleScope): RuleConfig | undefined {
  const id = ruleScopeId(type, scope)
  return state.rules.find(item => item.id === id && item.configuration?.type === type)
}

export function isTasteClusterScope(state: EvolutionState, scope: RuleScope): boolean {
  const asset = state.assetCatalog?.find(item => item.id === scope.assetId)
  return asset?.kind === 'TASTE_SKILL' && ['taste-recall', 'taste-quality', 'taste-shortage'].includes(scope.attributionId)
}

/** Templates provide only the explicit PRD taste threshold; other thresholds stay unset. */
export function createScopedRule(state: EvolutionState, type: ScopedRuleType, scope: RuleScope, at = state.updatedAt): RuleConfig {
  const asset = state.assetCatalog?.find(item => item.id === scope.assetId)
  const attribution = ruleAttributionsForAsset(state, scope.assetId).find(item => item.id === scope.attributionId)
  const category: RuleConfig['category'] = type === 'CLUSTER' ? 'TRIGGER' : type
  const titles = { GATE: '指标准出门禁', ROUTING: '分流规则', CLUSTER: '聚类规则' }
  const copiedScope = { ...scope }
  const tasteCluster = type === 'CLUSTER' && isTasteClusterScope(state, scope)
  let configuration: ScopedRuleConfiguration
  if (type === 'GATE') configuration = { type, scope: copiedScope, settings: { requireHumanReview: true } }
  else if (type === 'ROUTING') configuration = { type, scope: copiedScope, settings: { destinations: [] } }
  else configuration = { type, scope: copiedScope, settings: { ...(tasteCluster ? { minCases: 100 } : {}), countingUnit: 'CONFIRMED_CASE', requireHumanConfirmation: true } }
  return {
    id: ruleScopeId(type, scope), name: `${titles[type]} · ${asset?.name ?? scope.assetId} · ${attribution?.label ?? scope.attributionId}`,
    category, status: tasteCluster ? 'CONFIGURED' : 'PENDING', configuration,
    description: tasteCluster ? 'PRD：按同一品味 Skill 去重的人工确认相关 Case 积累 100 条；其他未明确门槛待配置。' : '仅适用于所选资产、归因及版本；未给出的业务阈值待配置。',
    createdAt: at, updatedAt: at
  }
}

export function validateScopedRule(state: EvolutionState, rule: RuleConfig): ScopedRuleValidationError[] {
  const config = rule.configuration
  if (!config) return []
  const errors: ScopedRuleValidationError[] = []
  const path = `rules.${rule.id}.configuration`
  const add = (field: string, message: string) => errors.push({ path: `${path}.${field}`, message })
  const asset = state.assetCatalog?.find(item => item.id === config.scope.assetId)
  if (!asset) add('scope.assetId', '请选择有效资产')
  const attribution = ruleAttributionsForAsset(state, config.scope.assetId).find(item => item.id === config.scope.attributionId)
  if (!attribution) add('scope.attributionId', '归因必须属于所选资产对应的模块')
  if (config.scope.assetVersion !== undefined && !(state.assetVersions ?? []).some(item => item.assetId === config.scope.assetId && item.version === config.scope.assetVersion)) add('scope.assetVersion', '版本必须属于所选资产；全部版本请省略版本字段')
  if (rule.id !== ruleScopeId(config.type, config.scope)) add('scope', '规则 ID 必须与类型、资产、归因及版本一致')
  if (rule.category !== (config.type === 'CLUSTER' ? 'TRIGGER' : config.type)) add('type', '规则类别与配置类型不一致')

  if (config.type === 'GATE') {
    const scoreKeys = ['processMin', 'outcomeMin', 'generalizationMin'] as const
    scoreKeys.forEach(key => {
      const value = config.settings[key]
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 2)) add(`settings.${key}`, '评分门槛必须在 0–2 之间')
    })
    if (rule.status === 'CONFIGURED' && !scoreKeys.some(key => config.settings[key] !== undefined)) add('settings', '至少配置一项评分门槛，否则保存为待配置')
    if (typeof config.settings.requireHumanReview !== 'boolean') add('settings.requireHumanReview', '请明确是否需要人工复核')
  } else if (config.type === 'ROUTING') {
    if (!Array.isArray(config.settings.destinations) || config.settings.destinations.some(item => !['STRATEGY', 'AGENT'].includes(item)) || new Set(config.settings.destinations).size !== config.settings.destinations.length) add('settings.destinations', '分流去向仅支持策略迭代与 Agent 迭代，允许多选且不能重复')
    else if (rule.status === 'CONFIGURED' && config.settings.destinations.length === 0) add('settings.destinations', '请至少选择一个分流去向，否则保存为待配置')
  } else if (config.type === 'CLUSTER') {
    const { minCases, windowDays, minimumSimilarity } = config.settings
    if (minCases !== undefined && (!Number.isSafeInteger(minCases) || minCases <= 0)) add('settings.minCases', '相关 Case 数必须为正整数')
    if (windowDays !== undefined && (!Number.isSafeInteger(windowDays) || windowDays <= 0)) add('settings.windowDays', '统计窗口天数必须为正整数')
    if (minimumSimilarity !== undefined && (!Number.isFinite(minimumSimilarity) || minimumSimilarity < 0 || minimumSimilarity > 1)) add('settings.minimumSimilarity', '相似度必须在 0–1 之间')
    if (config.settings.countingUnit !== 'CONFIRMED_CASE' || config.settings.requireHumanConfirmation !== true) add('settings.countingUnit', '聚类口径必须按人工确认的相关 Case 去重')
    if (rule.status === 'CONFIGURED' && minCases === undefined) add('settings.minCases', '请配置聚类触发 Case 数，否则保存为待配置')
    if (rule.status === 'CONFIGURED' && attribution && !attribution.condition.includes('聚类优化')) add('scope.attributionId', '此归因按 PRD 直接优化或需求待补充，不能配置聚类触发')
  }
  return errors
}
