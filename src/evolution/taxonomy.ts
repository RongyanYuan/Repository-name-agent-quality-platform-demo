import type { EvolutionModule } from './domain'

export interface EvolutionItemDefinition {
  id: string
  module: EvolutionModule
  label: string
  optimization: string
  condition: string
}

export const EVOLUTION_ITEMS: readonly EvolutionItemDefinition[] = [
  { id: 'memory-production', module: 'Memory', label: '生产错误（详情见记忆模块PRD）', optimization: '能力修补', condition: '聚类优化' },
  { id: 'memory-management', module: 'Memory', label: '管理错误（详情见记忆模块PRD）', optimization: '能力修补', condition: '聚类优化' },
  { id: 'memory-recall', module: 'Memory', label: '召回率低（详情见记忆模块PRD）', optimization: '能力修补', condition: '聚类优化' },
  { id: 'memory-accuracy', module: 'Memory', label: '准确率低（详情见记忆模块PRD）', optimization: '能力修补', condition: '聚类优化' },
  { id: 'context-pending', module: 'Context', label: '待上文的需求方案评审后补充', optimization: '——', condition: '——' },
  { id: 'skill-capability', module: 'Skill', label: '【能力缺乏】当前可用Skill不具备完成任务所需能力', optimization: '新增能力', condition: '聚类优化' },
  { id: 'skill-file', module: 'Skill', label: '【skill文件不可用】skill文件不可加载', optimization: '能力修补', condition: '直接优化' },
  { id: 'skill-sop', module: 'Skill', label: '【skill sop错误】Skill内部脚本或工具不可用，参数规则错误；逻辑错误，编排错误', optimization: '能力修补', condition: '直接优化' },
  { id: 'skill-description', module: 'Skill', label: '【skill name/description错误】skill名字或摘要未能充分反映skill可支持的场景', optimization: '能力修补', condition: '直接优化' },
  { id: 'taste-recall', module: 'Skill', label: '【品味库召回错误】品味库召回相关skill不符合应用场景', optimization: '能力修补', condition: '聚类优化' },
  { id: 'taste-quality', module: 'Skill', label: '【品味库资产质量】品味库调用资产质量不佳（蓝色案例）', optimization: '能力修补', condition: '聚类优化' },
  { id: 'taste-shortage', module: 'Skill', label: '【品味库资产不足】品味库缺乏充分匹配相关场景的skill', optimization: '新增能力', condition: '聚类优化/直接优化' },
  { id: 'reason-query', module: 'Reason', label: '没有充分响应用户query的客观诉求', optimization: '能力修补', condition: '聚类优化' },
  { id: 'reason-context', module: 'Reason', label: '没有充分结合上文', optimization: '能力修补', condition: '聚类优化' },
  { id: 'reason-choice', module: 'Reason', label: '没有做出最正确/高效的选择', optimization: '能力修补', condition: '聚类优化' },
  { id: 'reason-params', module: 'Reason', label: '调用工具所需参数是否正确', optimization: '能力修补', condition: '聚类优化' },
  { id: 'act-failed', module: 'Act', label: '工具未执行成功', optimization: '能力修补', condition: '直接优化' },
  { id: 'act-stability', module: 'Act', label: '未遵循重试，超时等工程稳定性规则', optimization: '能力修补', condition: '直接优化' }
]

const aliases: Record<string, string> = {
  '生产错误': 'memory-production', '管理错误': 'memory-management', '召回率低': 'memory-recall', '准确率低': 'memory-accuracy',
  '需求待补充': 'context-pending', '能力缺乏': 'skill-capability', 'skill文件不可用': 'skill-file', 'skill sop错误': 'skill-sop',
  'skill name/description错误': 'skill-description', '品味库召回错误': 'taste-recall', '品味库资产质量': 'taste-quality', '品味库资产不足': 'taste-shortage',
  '资产质量': 'taste-quality', '资产不足': 'taste-shortage', '文件不可用': 'skill-file', 'SOP 错误': 'skill-sop', 'name/description 错误': 'skill-description',
  '没有充分响应用户query的客观诉求': 'reason-query', '没有充分结合上文': 'reason-context', '没有做出最正确/高效的选择': 'reason-choice', '调用工具所需参数是否正确': 'reason-params',
  '工具未执行成功': 'act-failed', '未遵循重试，超时等工程稳定性规则': 'act-stability'
}

export function evolutionItemId(value?: string) {
  if (!value) return undefined
  if (EVOLUTION_ITEMS.some(item => item.id === value)) return value
  if (aliases[value]) return aliases[value]
  return EVOLUTION_ITEMS.find(item => item.label === value)?.id
}

export function evolutionItemLabel(value?: string) {
  const id = evolutionItemId(value)
  return EVOLUTION_ITEMS.find(item => item.id === id)?.label ?? value ?? '待上文的需求方案评审后补充'
}
