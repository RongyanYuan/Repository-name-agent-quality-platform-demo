import type { Case, EvolutionState, SkillCategory } from './domain'

export type CaseSourceLabel = '线上+时间窗口' | '黄金测试集' | 'mock集'

export function resolveCaseSource(state: EvolutionState, record: Case): { label: CaseSourceLabel; refId?: string; refVersion?: string } {
  if (record.sourceType === 'GOLDEN_DATASET') return { label: '黄金测试集' }
  if (record.sourceType === 'MOCK_SET') return { label: 'mock集' }
  if (record.sourceType === 'ONLINE_WINDOW') return { label: '线上+时间窗口' }
  if (record.id.startsWith('case-v2-') || record.labels.some((label) => label.startsWith('V2-'))) return { label: 'mock集' }
  const dataset = state.datasets.find((item) => item.caseIds.includes(record.id) && item.type === 'ATTRIBUTION')
  if (dataset?.source.toLocaleLowerCase().includes('golden') || dataset?.source.includes('黄金')) return { label: '黄金测试集', refId: dataset.id, refVersion: dataset.version }
  const window = state.windows.find((item) => item.timeRange && Date.parse(record.createdAt) >= Date.parse(item.timeRange.from) && Date.parse(record.createdAt) <= Date.parse(item.timeRange.to))
  if (window && record.environment === 'Production') return { label: '线上+时间窗口', refId: window.id }
  return { label: 'mock集' }
}

export function governanceLabel(value: string): string {
  const labels: Record<string, string> = {
    PRODUCTION_SKILL: '生产 Skill', TASTE_SKILL: '品味 Skill', PERSONAL_SKILL: '个人 Skill', UNCLASSIFIED: '未分类', GENERAL: '通用能力',
    Agent迭代: 'Agent 迭代', AGENT_ITERATION: 'Agent 迭代', 策略迭代: '策略迭代',
    DIRECT_FIX: '直接优化', CLUSTER_OPTIMIZATION: '聚类优化',
    DRAFT: '草稿', READY: '候选', EXPERIMENTING: '实验中', SINGLE_PASSED: '单变体已通过', WINDOW_VALIDATED: '窗口已验证', RELEASED: '已发布', REJECTED: '已拒绝',
    SKILL_CONTENT: 'Skill 内容', SKILL_METADATA: 'Skill 名称/描述', PROMPT_OR_POLICY: 'Prompt / 策略', TOOL_STABILITY: 'Tool / Runtime 稳定性', ASSET: '资产',
    QUEUED: '待运行', RUNNING: '运行中', COMPLETED: '已完成', DECIDED: '已决策', FAILED: '运行失败', PENDING: '待处理',
    MANUAL_REVIEW: '人工复核', REJECT: '拒绝', CANARY: '灰度', OBSERVING: '观察中', ROLLED_BACK: '已回滚',
    ALGORITHM_BADCASE: '算法 Badcase', TASTE_LIBRARY: '品味库队列', PERSONAL_SKILL_PLANNING: '个人 Skill 二期规划', ISSUE_CLUSTER: '问题簇',
    Auto: '自动评测', 'Auto Eval': '自动评测', 'User Feedback': '用户反馈', 'System Error': '系统错误', 'Manual Review': '人工复核',
    Memory: '记忆', Skill: 'skill', Context: '上文',
    PASS: 'PASS', FAIL: 'FAIL', DERIVED_FAIL: '派生失败', UNKNOWN: 'UNKNOWN', 'N/A': 'N/A'
  }
  return labels[value] ?? value
}

export const skillCategoryLabel = (category?: SkillCategory) => governanceLabel(category ?? 'UNCLASSIFIED')
