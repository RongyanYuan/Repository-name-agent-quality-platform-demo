import { describe, expect, it } from 'vitest'
import { governanceItemsFor, governanceItemLabel, GOVERNANCE_OBJECTS, normalizeGovernanceLabel } from './governanceTaxonomy'

describe('governance taxonomy for dataset evaluation', () => {
  it('groups PRD attribution dimensions by governance object', () => {
    expect(GOVERNANCE_OBJECTS.map(item => item.id)).toEqual(['Memory', 'Context', 'Skill', 'Reason', 'Act', 'OTHER_BADCASE'])
    expect(governanceItemsFor('Memory').map(item => item.id)).toEqual(['memory-production', 'memory-management', 'memory-recall', 'memory-accuracy'])
    expect(governanceItemsFor('Act').map(item => item.id)).toEqual(['act-failed', 'act-stability'])
  })

  it('keeps bracketed Skill labels readable without changing their wording', () => {
    expect(normalizeGovernanceLabel('【品味库召回错误】品味库召回相关skill不符合应用场景')).toBe('品味库召回错误品味库召回相关skill不符合应用场景')
  })
  it('uses the PRD insight name in controls while preserving the full PRD rule in detail', () => {
    const item = governanceItemsFor('Skill').find(item => item.id === 'skill-sop')!
    expect(governanceItemLabel(item)).toBe('skill sop错误')
    expect(item.label).toBe('【skill sop错误】Skill内部脚本或工具不可用，参数规则错误；逻辑错误，编排错误')
  })
})
