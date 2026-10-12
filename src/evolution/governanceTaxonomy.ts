import { EVOLUTION_ITEMS, type EvolutionItemDefinition } from './taxonomy'

export type GovernanceObjectId = 'Memory' | 'Context' | 'Skill' | 'Reason' | 'Act' | 'OTHER_BADCASE'

export interface GovernanceObjectDefinition {
  id: GovernanceObjectId
  label: string
  description: string
  itemIds: string[]
}

const OTHER_BADCASE_ITEM: EvolutionItemDefinition = {
  id: 'other-badcase-unclassified',
  module: 'Reason',
  label: '未覆盖归因（待补充）',
  optimization: '待配置',
  condition: '待配置'
}

export const GOVERNANCE_OBJECTS: readonly GovernanceObjectDefinition[] = [
  { id: 'Memory', label: '记忆', description: '记忆生产、管理、召回与准确性问题。', itemIds: ['memory-production', 'memory-management', 'memory-recall', 'memory-accuracy'] },
  { id: 'Context', label: '上下文 / 上文', description: '仅作为证据与归因线索，不单独计分。', itemIds: ['context-pending'] },
  { id: 'Skill', label: 'skill', description: '生产 Skill、品味 Skill 与个人 Skill 的能力治理。', itemIds: ['skill-capability', 'skill-file', 'skill-sop', 'skill-description', 'taste-recall', 'taste-quality', 'taste-shortage'] },
  { id: 'Reason', label: 'Reason', description: '任务理解、选择与工具参数等 Reason 能力问题。', itemIds: ['reason-query', 'reason-context', 'reason-choice', 'reason-params'] },
  { id: 'Act', label: 'Act', description: '工具执行与重试、超时等工程稳定性问题。', itemIds: ['act-failed', 'act-stability'] },
  { id: 'OTHER_BADCASE', label: '其他 Badcase', description: '暂未匹配 PRD 归因表的 Badcase 兜底入口，不新增正式归因。', itemIds: [OTHER_BADCASE_ITEM.id] }
]

export function governanceItemsFor(objectId?: GovernanceObjectId | ''): EvolutionItemDefinition[] {
  const definition = GOVERNANCE_OBJECTS.find(item => item.id === objectId)
  if (!definition) return [...EVOLUTION_ITEMS, OTHER_BADCASE_ITEM]
  return definition.itemIds.map(itemId => EVOLUTION_ITEMS.find(item => item.id === itemId) ?? (itemId === OTHER_BADCASE_ITEM.id ? OTHER_BADCASE_ITEM : undefined)).filter((item): item is EvolutionItemDefinition => Boolean(item))
}

export function governanceObjectForEvolutionItem(itemId?: string): GovernanceObjectId | undefined {
  if (!itemId) return undefined
  return GOVERNANCE_OBJECTS.find(item => item.itemIds.includes(itemId))?.id
}

export function normalizeGovernanceLabel(label: string): string {
  return label.replaceAll('【', '').replaceAll('】', '')
}

export function governanceItemLabel(item?: EvolutionItemDefinition): string {
  if (!item) return '未覆盖归因（待补充）'
  // Keep the full rule wording for evidence/detail; controls use its named insight.
  return item.label.match(/^【([^】]+)】/)?.[1] ?? item.label
}
