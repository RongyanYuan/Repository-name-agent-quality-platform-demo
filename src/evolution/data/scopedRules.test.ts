import { beforeAll, describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from '../data'
import type { EvolutionState, RuleConfig, RuleScope } from '../domain'
import { createLocalEvolutionRepository } from '../repository'
import { evolutionReducer } from '../store'
import { EVOLUTION_ITEMS } from '../taxonomy'
import { createScopedRule, resolveScopedRule, ruleAttributionsForAsset, ruleScopeId, validateScopedRule } from './scopedRules'
import { validateEvolutionState } from './validation'

let initial: EvolutionState
beforeAll(() => { initial = createInitialEvolutionData() })
const state = () => structuredClone(initial)
const skillScope: RuleScope = { assetId: 'asset-catalog-skill-ppt-builder', attributionId: 'skill-sop' }
const memoryScope: RuleScope = { assetId: 'asset-catalog-memory', attributionId: 'memory-recall' }
const meta = { actor: '规则测试员', reason: '确认配置规则', at: '2026-10-13T09:00:00.000Z', auditId: 'audit-scoped-rule' }

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('asset and attribution scoped rules', () => {
  it('keeps all PRD labels verbatim and excludes other modules', () => {
    const current = state()
    expect(ruleAttributionsForAsset(current, skillScope.assetId)).toEqual(EVOLUTION_ITEMS.filter(item => item.module === 'Skill'))
    expect(ruleAttributionsForAsset(current, memoryScope.assetId)).toEqual(EVOLUTION_ITEMS.filter(item => item.module === 'Memory'))
    expect(ruleAttributionsForAsset(current, 'asset-catalog-tool-export')).toEqual(EVOLUTION_ITEMS.filter(item => item.module === 'Act'))
    expect(ruleAttributionsForAsset(current, 'asset-catalog-system-prompt')).toEqual(EVOLUTION_ITEMS.filter(item => item.module === 'Reason'))
    expect(ruleAttributionsForAsset(current, 'asset-catalog-other-capability')).toEqual(EVOLUTION_ITEMS.filter(item => item.module === 'Context'))
    expect(ruleAttributionsForAsset(current, 'missing')).toEqual([])
  })

  it('leaves unprovided gate, routing and other cluster thresholds pending', () => {
    const current = state()
    const gate = createScopedRule(current, 'GATE', skillScope)
    const routing = createScopedRule(current, 'ROUTING', skillScope)
    const cluster = createScopedRule(current, 'CLUSTER', memoryScope)
    expect(gate.configuration).toEqual({ type: 'GATE', scope: skillScope, settings: { requireHumanReview: true } })
    expect(routing.configuration).toEqual({ type: 'ROUTING', scope: skillScope, settings: { destinations: [] } })
    expect(cluster.configuration).toEqual({ type: 'CLUSTER', scope: memoryScope, settings: { countingUnit: 'CONFIRMED_CASE', requireHumanConfirmation: true } })
    for (const rule of [gate, routing, cluster]) {
      expect(rule.status).toBe('PENDING')
      expect(validateScopedRule(current, rule)).toEqual([])
    }
  })

  it('uses 100 only for taste Skill cluster attributions, independent of production Skill', () => {
    const current = state()
    const taste = createScopedRule(current, 'CLUSTER', { assetId: 'asset-catalog-skill-taste-executive', attributionId: 'taste-recall' })
    expect(taste.status).toBe('CONFIGURED')
    expect(taste.configuration?.type === 'CLUSTER' && taste.configuration.settings.minCases).toBe(100)
    expect(validateScopedRule(current, taste)).toEqual([])
    for (const scope of [skillScope, { ...skillScope, attributionId: 'taste-recall' }, { assetId: 'asset-catalog-skill-taste-executive', attributionId: 'skill-capability' }]) {
      const rule = createScopedRule(current, 'CLUSTER', scope)
      expect(rule.status).toBe('PENDING')
      expect(rule.configuration?.type === 'CLUSTER' && rule.configuration.settings.minCases).toBeUndefined()
    }
  })

  it('does not leak configured rules across assets, attributions, versions or categories', () => {
    const current = state()
    const rule = createScopedRule(current, 'GATE', skillScope)
    rule.status = 'CONFIGURED'
    if (rule.configuration?.type === 'GATE') rule.configuration.settings.processMin = 0
    const next = evolutionReducer(current, { type: 'UPSERT_SCOPED_RULE', rule, meta })
    expect(resolveScopedRule(next, 'GATE', skillScope)?.configuration).toEqual(rule.configuration)
    expect(resolveScopedRule(next, 'GATE', memoryScope)).toBeUndefined()
    expect(resolveScopedRule(next, 'GATE', { ...skillScope, attributionId: 'skill-file' })).toBeUndefined()
    expect(resolveScopedRule(next, 'GATE', { ...skillScope, assetVersion: '2.6.0' })).toBeUndefined()
    expect(resolveScopedRule(next, 'ROUTING', skillScope)).toBeUndefined()
    expect(next.rules.filter(item => !item.configuration)).toEqual(current.rules)
  })

  it('supports multi-routing and version-scoped configuration without changing global defaults', () => {
    const current = state()
    const version = current.assetVersions!.find(item => item.assetId === skillScope.assetId)!.version
    const scope = { ...skillScope, assetVersion: version }
    const rule = createScopedRule(current, 'ROUTING', scope)
    rule.status = 'CONFIGURED'
    if (rule.configuration?.type === 'ROUTING') rule.configuration.settings = { destinations: ['STRATEGY', 'AGENT'], owner: '算法团队 / Agent 团队' }
    const next = evolutionReducer(current, { type: 'UPSERT_SCOPED_RULE', rule, meta })
    expect(resolveScopedRule(next, 'ROUTING', scope)).toMatchObject({ status: 'CONFIGURED', configuration: { settings: { destinations: ['STRATEGY', 'AGENT'] } } })
    expect(resolveScopedRule(next, 'ROUTING', skillScope)).toBeUndefined()
    expect(validateEvolutionState(next)).toEqual([])
  })

  it('updates in place with an audit snapshot and preserves the original creation time', () => {
    const current = state()
    const rule = createScopedRule(current, 'GATE', memoryScope)
    const created = evolutionReducer(current, { type: 'UPSERT_SCOPED_RULE', rule, meta })
    const saved = resolveScopedRule(created, 'GATE', memoryScope)!
    const changed = structuredClone(saved)
    changed.status = 'CONFIGURED'
    if (changed.configuration?.type === 'GATE') changed.configuration.settings.outcomeMin = 1.5
    const next = evolutionReducer(created, { type: 'UPSERT_SCOPED_RULE', rule: changed, meta: { ...meta, at: '2026-10-14T09:00:00.000Z', auditId: 'audit-scoped-rule-update' } })
    const updated = resolveScopedRule(next, 'GATE', memoryScope)!
    expect(next.rules.filter(item => item.id === rule.id)).toHaveLength(1)
    expect(updated.createdAt).toBe(meta.at)
    expect(updated.updatedAt).toBe('2026-10-14T09:00:00.000Z')
    expect(next.auditTrail.at(-1)?.changes).toEqual({ configuration: changed.configuration, status: 'CONFIGURED' })
    changed.configuration!.scope.assetId = 'missing'
    expect(updated.configuration?.scope.assetId).toBe(memoryScope.assetId)
  })

  it('round-trips configured values and pending drafts through local persistence', () => {
    const current = state()
    const gate = createScopedRule(current, 'GATE', skillScope)
    gate.status = 'CONFIGURED'
    if (gate.configuration?.type === 'GATE') gate.configuration.settings = { processMin: 0, outcomeMin: 1.7, requireHumanReview: false }
    const cluster = createScopedRule(current, 'CLUSTER', memoryScope)
    const saved = evolutionReducer(evolutionReducer(current, { type: 'UPSERT_SCOPED_RULE', rule: gate, meta }), { type: 'UPSERT_SCOPED_RULE', rule: cluster, meta: { ...meta, auditId: 'audit-pending-cluster' } })
    const repository = createLocalEvolutionRepository({ storage: new MemoryStorage(), storageKey: 'scoped-rules-test' })
    repository.save(saved)
    const loaded = repository.load()
    expect(resolveScopedRule(loaded, 'GATE', skillScope)).toEqual(resolveScopedRule(saved, 'GATE', skillScope))
    expect(resolveScopedRule(loaded, 'CLUSTER', memoryScope)?.status).toBe('PENDING')
    expect(loaded.rules.filter(item => !item.configuration)).toEqual(current.rules)
    expect(validateEvolutionState(loaded)).toEqual([])
  })

  it('continues to update legacy rule IDs without creating scoped rules', () => {
    const current = state()
    const updated = evolutionReducer(current, { type: 'UPDATE_RULE', ruleId: 'rule-repeat-count', patch: { value: 5 }, meta })
    expect(updated.rules.find(item => item.id === 'rule-repeat-count')?.value).toBe(5)
    expect(updated.rules.find(item => item.id === 'rule-taste-100')?.value).toBe(100)
    expect(updated.rules.some(item => item.configuration)).toBe(false)
  })

  it.each([
    { field: 'assetId', scope: { ...skillScope, assetId: 'missing' } },
    { field: 'attributionId', scope: { ...skillScope, attributionId: 'memory-recall' } },
    { field: 'assetVersion', scope: { ...skillScope, assetVersion: 'memory-policy-v1' } }
  ])('rejects a mismatched $field without mutating the state', ({ scope, field }) => {
    const current = state()
    const rule = createScopedRule(current, 'GATE', scope)
    expect(validateScopedRule(current, rule).some(error => error.path.endsWith(`scope.${field}`))).toBe(true)
    expect(evolutionReducer(current, { type: 'UPSERT_SCOPED_RULE', rule, meta })).toBe(current)
  })

  it.each([-0.01, 2.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid 0–2 thresholds: %s', value => {
    const current = state()
    const rule = createScopedRule(current, 'GATE', skillScope)
    if (rule.configuration?.type === 'GATE') rule.configuration.settings.processMin = value
    expect(validateScopedRule(current, rule).some(error => error.path.endsWith('settings.processMin'))).toBe(true)
  })

  it('rejects empty configured rules, invalid Case counts and direct-only clustering', () => {
    const current = state()
    const rules: RuleConfig[] = [createScopedRule(current, 'GATE', skillScope), createScopedRule(current, 'ROUTING', skillScope), createScopedRule(current, 'CLUSTER', memoryScope)]
    rules.forEach(rule => {
      rule.status = 'CONFIGURED'
      expect(validateScopedRule(current, rule).length).toBeGreaterThan(0)
    })
    const cluster = createScopedRule(current, 'CLUSTER', memoryScope)
    if (cluster.configuration?.type === 'CLUSTER') cluster.configuration.settings.minCases = 2.5
    expect(validateScopedRule(current, cluster).some(error => error.path.endsWith('settings.minCases'))).toBe(true)
    const direct = createScopedRule(current, 'CLUSTER', skillScope)
    direct.status = 'CONFIGURED'
    if (direct.configuration?.type === 'CLUSTER') direct.configuration.settings.minCases = 10
    expect(validateScopedRule(current, direct).some(error => error.path.endsWith('scope.attributionId'))).toBe(true)
    expect(ruleScopeId('GATE', skillScope)).not.toBe(ruleScopeId('ROUTING', skillScope))
  })
})
