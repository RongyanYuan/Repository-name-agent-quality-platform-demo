import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './index'
import { selectVariantWorkbench } from './selectors'
import { EVOLUTION_ITEMS, evolutionItemLabel } from '../taxonomy'

describe('variant workbench selectors', () => {
  it('keeps the exact PRD attribution wording for all evolution item filters', () => {
    expect(EVOLUTION_ITEMS.filter(item => item.module === 'Memory').map(item => item.label)).toEqual(['生产错误（详情见记忆模块PRD）', '管理错误（详情见记忆模块PRD）', '召回率低（详情见记忆模块PRD）', '准确率低（详情见记忆模块PRD）'])
    expect(evolutionItemLabel('skill sop错误')).toBe('【skill sop错误】Skill内部脚本或工具不可用，参数规则错误；逻辑错误，编排错误')
    expect(evolutionItemLabel('资产质量')).toBe('【品味库资产质量】品味库调用资产质量不佳（蓝色案例）')
    expect(evolutionItemLabel('需求待补充')).toBe('待上文的需求方案评审后补充')
    expect(EVOLUTION_ITEMS).toHaveLength(18)
  })

  it('exposes Trace channel, vertical scenario, normalized scores and dataset purposes', () => {
    const state = createInitialEvolutionData()
    const trace = state.traces[0]
    const pkg = state.tracePackages.find((item) => item.traceId === trace.id)
    expect(trace.channel).toBeDefined()
    expect(trace.verticalScenario).toBeDefined()
    expect(pkg?.rating?.processFinal).toBeGreaterThanOrEqual(0)
    expect(pkg?.rating?.processFinal).toBeLessThanOrEqual(2)
    expect(state.datasets.some((dataset) => dataset.purpose === '原始归因集')).toBe(true)
    expect(state.datasets.some((dataset) => dataset.purpose === '窗口线上数据全集')).toBe(true)
  })
  it('groups Skills into normalized Taste and Production sections with lifecycle state', () => {
    const workbench = selectVariantWorkbench(createInitialEvolutionData())
    expect(workbench.sections.map((section) => section.id)).toEqual(expect.arrayContaining(['TASTE_SKILL', 'PRODUCTION_SKILL', 'OTHER']))
    const taste = workbench.sections.find((section) => section.id === 'TASTE_SKILL')!
    const production = workbench.sections.find((section) => section.id === 'PRODUCTION_SKILL')!
    expect(taste.rows.some((row) => row.skillId === 'skill-taste-executive')).toBe(true)
    expect(production.rows.some((row) => row.skillId === 'skill-ppt-builder')).toBe(true)
    expect(taste.rows.find((row) => row.skillId === 'skill-taste-executive')?.variants.map((variant) => variant.id)).toContain('variant-taste-red-v1')
    expect(production.rows.find((row) => row.skillId === 'skill-ppt-builder')?.routingPath).toContain('策略迭代')
  })

  it('keeps non-Skill variants out of production Skill rows and preserves every variant exactly once', () => {
    const state = createInitialEvolutionData()
    const workbench = selectVariantWorkbench(state)
    const productionIds = workbench.sections.find((section) => section.id === 'PRODUCTION_SKILL')!.rows.flatMap((row) => row.variants.map((variant) => variant.id))
    expect(productionIds).not.toContain('variant-memory-latest')
    expect(productionIds).not.toContain('variant-reason-office-plan')
    const ids = workbench.sections.flatMap((section) => section.rows.flatMap((row) => row.variants.map((variant) => variant.id)))
    expect(ids).toHaveLength(state.variants.length)
    expect(new Set(ids).size).toBe(state.variants.length)
  })

  it('includes production Badcases with no Variant yet instead of excluding unprocessed problems', () => {
    const state = createInitialEvolutionData()
    state.variants = []
    const production = selectVariantWorkbench(state).sections.find((section) => section.id === 'PRODUCTION_SKILL')!.rows[0]
    expect(production.badcaseCount).toBeGreaterThan(0)
    expect(production.variants).toHaveLength(0)
  })

  it('includes the complete Office production and taste Skill catalog with explicit versions', () => {
    const workbench = selectVariantWorkbench(createInitialEvolutionData())
    const production = workbench.sections.find((section) => section.id === 'PRODUCTION_SKILL')!
    const taste = workbench.sections.find((section) => section.id === 'TASTE_SKILL')!
    expect(production.rows.map((row) => row.skillId)).toEqual(expect.arrayContaining([
      'skill-ppt-builder', 'skill-spreadsheet', 'skill-word-builder', 'skill-canvas-builder'
    ]))
    expect(taste.rows.map((row) => row.skillId)).toEqual(expect.arrayContaining([
      'skill-taste-ppt-template-1', 'skill-taste-ppt-template-2', 'skill-taste-excel-template-1'
    ]))
    expect(production.rows.every((row) => row.currentVersion !== '待配置')).toBe(true)
    expect(taste.rows.every((row) => row.currentVersion !== '待配置')).toBe(true)
  })

  it('keeps a versioned self-evolution history for a Skill and exposes it in the workbench row', () => {
    const workbench = selectVariantWorkbench(createInitialEvolutionData())
    const ppt = workbench.sections.find((section) => section.id === 'PRODUCTION_SKILL')!.rows.find((row) => row.skillId === 'skill-ppt-builder')!
    expect(ppt.history.length).toBeGreaterThanOrEqual(5)
    expect(ppt.history.map((item) => item.version)).toContain('ppt-builder-2.6.0-rc.1')
    expect(ppt.history.some((item) => item.referenceId === 'variant-ppt-routing-v3')).toBe(true)
    expect(ppt.history.some((item) => item.referenceId === 'release-agent-3-0-0')).toBe(true)
  })
})
