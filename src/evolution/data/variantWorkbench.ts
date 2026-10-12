import type { EvolutionState, SkillCategory, Variant, EvolutionModule, SkillEvolutionHistoryEntry } from '../domain'
import { governanceLabel } from '../labels'

export function selectVariantLineage(state: EvolutionState, variantId: string) {
  const variant = state.variants.find((item) => item.id === variantId)
  if (!variant) return undefined
  const issues = state.issues.filter((item) => variant.sourceIssueIds.includes(item.id))
  const clusters = state.issueClusters.filter((item) => variant.sourceClusterIds.includes(item.id))
  const caseIds = [...new Set([...variant.sourceCaseIds, ...issues.map((item) => item.caseId), ...clusters.flatMap((item) => item.caseIds)])]
  const findings = state.evaluationFindings.filter((item) => caseIds.includes(item.caseId) && (variant.evidenceIds.some((id) => item.evidenceBundle.rootEvidenceIds.includes(id)) || issues.some((issue) => issue.dimension === item.dimensionLabel)))
  const deliveries = state.routingDeliveries.filter((item) => item.variantId === variant.id || findings.some((finding) => finding.id === item.findingId) || Boolean(item.issueId && variant.sourceIssueIds.includes(item.issueId)))
  const experiments = state.experiments.filter((item) => item.variantIds.includes(variant.id))
  const windows = state.windows.filter((item) => item.candidateVariantIds.includes(variant.id) || experiments.some((experiment) => experiment.windowId === item.id))
  const gates = state.gateDecisions.filter((item) => experiments.some((experiment) => experiment.id === item.experimentId))
  const releases = state.releases.filter((item) => item.variantIds.includes(variant.id))
  const sourceCases = state.cases.filter((item) => caseIds.includes(item.id))
  const traceIds = [...new Set([...findings.map((item) => item.traceId), ...sourceCases.flatMap((item) => item.traceIds)])]
  return { variant, issues, clusters, cases: sourceCases, findings, deliveries, experiments, singleExperiments: experiments.filter((item) => item.level === 'SINGLE_VARIANT'), combinationExperiments: experiments.filter((item) => item.level === 'WINDOW_COMBINATION'), windows, gates, releases, traceIds, evidence: state.evidence.filter((item) => variant.evidenceIds.includes(item.id)) }
}

export type VariantWorkbenchVariant = Variant & { windowIds: string[]; experimentStatuses: string[]; gateStatuses: string[]; releaseStatuses: string[] }
export interface VariantWorkbenchSkillRow {
  skillId: string; skillName: string; category: SkillCategory; targetModule?: EvolutionModule; isSkill: boolean
  currentVersion: string; updatedAt: string; owner: string; variantCount: number; candidateCount: number; status: string; routingPath: string
  sourceIssueIds: string[]; findingIds: string[]; badcaseCount: number; windowIds: string[]; experimentIds: string[]; gateStatuses: string[]; releaseStatuses: string[]
  relatedDataCount?: number; relatedDataThreshold?: number; preference?: EvolutionState['tastePreferenceSignals'][number]
  history: SkillEvolutionHistoryEntry[]
  variants: VariantWorkbenchVariant[]
}
export interface VariantWorkbenchSection { id: 'TASTE_SKILL' | 'PRODUCTION_SKILL' | 'OTHER'; label: string; rows: VariantWorkbenchSkillRow[] }
export interface VariantWorkbench { sections: VariantWorkbenchSection[] }

export function buildVariantWorkbench(state: EvolutionState): VariantWorkbench {
  const sectionIds = ['TASTE_SKILL', 'PRODUCTION_SKILL', 'OTHER'] as const
  const sections: VariantWorkbenchSection[] = sectionIds.map((id) => ({ id, label: id === 'OTHER' ? '其他能力' : governanceLabel(id), rows: [] }))
  const grouped = new Map<string, Variant[]>()
  state.skills.forEach((skill) => grouped.set(skill.id, []))
  // Skill membership is explicit when available. Non-Skill capabilities never
  // inherit a production classification merely by sharing a source Case.
  state.variants.forEach((variant) => {
    const explicit = state.skills.find((skill) => skill.evolutionRecordIds.includes(variant.id))
    const sourceSkill = variant.targetModule === 'Skill' ? state.skills.find((skill) => variant.sourceCaseIds.some((caseId) => state.cases.find((item) => item.id === caseId)?.skillIds.includes(skill.id))) : undefined
    const groupId = explicit?.id ?? sourceSkill?.id ?? `module-${variant.targetModule}`
    grouped.set(groupId, [...(grouped.get(groupId) ?? []), variant])
  })
  grouped.forEach((variants, groupId) => {
    const skill = state.skills.find((item) => item.id === groupId)
    const category = skill?.category ?? 'GENERAL'
    const targetModule = !skill ? variants[0]?.targetModule : undefined
    const sourceCases = state.cases.filter((item) => skill ? item.skillIds.includes(skill.id) : variants.some((variant) => variant.sourceCaseIds.includes(item.id)))
    const findings = state.evaluationFindings.filter((item) => skill ? state.tracePackages.some((pkg) => pkg.id === item.packageId && pkg.skillIds.includes(skill.id) && pkg.skillCategory === category) : variants.some((variant) => variant.sourceCaseIds.includes(item.caseId) && variant.targetModule.toUpperCase() === item.moduleCode))
    const sourceIssues = state.issues.filter((item) => skill ? item.module === 'Skill' && sourceCases.some((record) => record.id === item.caseId) : variants.some((variant) => variant.sourceIssueIds.includes(item.id)))
    const badcases = state.algorithmBadcases.filter((item) => findings.some((finding) => finding.id === item.findingId))
    const lineages = variants.map((variant) => selectVariantLineage(state, variant.id)!)
    const preference = skill ? state.tastePreferenceSignals.find((item) => item.skillId === skill.id) : undefined
    const latest = [...variants].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
    const dates = [skill?.updatedAt, ...variants.map((item) => item.updatedAt), ...sourceIssues.map((item) => item.updatedAt)].filter((value): value is string => Boolean(value)).sort()
    const active = variants.filter((item) => !['RELEASED', 'REJECTED'].includes(item.status))
    const row: VariantWorkbenchSkillRow = {
      skillId: groupId, skillName: skill?.name ?? `${governanceLabel(targetModule ?? '能力')} 能力`, isSkill: Boolean(skill), targetModule, category,
      currentVersion: skill?.version ?? latest?.currentVersion ?? '待配置', updatedAt: dates.at(-1) ?? state.updatedAt,
      owner: [...new Set(sourceIssues.map((item) => item.owner).filter(Boolean))].join(' / ') || '未分配', variantCount: variants.length, candidateCount: active.length,
      status: active.length ? governanceLabel([...active].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0].status) : latest ? governanceLabel(latest.status) : '暂无变体',
      routingPath: category === 'TASTE_SKILL' ? 'Agent 迭代 → 品味库聚类' : category === 'PRODUCTION_SKILL' ? '策略迭代 → 算法 Badcase；确定性 Skill 错误 → 直接优化' : category === 'PERSONAL_SKILL' ? '个人能力转 Skill（二期）' : '按模块进入直接优化或问题聚类',
      sourceIssueIds: sourceIssues.map((item) => item.id), findingIds: findings.map((item) => item.id), badcaseCount: badcases.length,
      windowIds: [...new Set(lineages.flatMap((item) => item.windows.map((window) => window.id)))], experimentIds: [...new Set(lineages.flatMap((item) => item.experiments.map((experiment) => experiment.id)))], gateStatuses: lineages.flatMap((item) => item.gates.map((gate) => gate.conclusion)), releaseStatuses: lineages.flatMap((item) => item.releases.map((release) => release.status)), relatedDataCount: preference?.relatedDataCount, relatedDataThreshold: preference?.relatedDataThreshold, preference,
      history: skill?.evolutionHistory ?? [],
      variants: variants.map((variant, index) => ({ ...variant, experimentIds: lineages[index].experiments.map((item) => item.id), windowIds: lineages[index].windows.map((item) => item.id), experimentStatuses: lineages[index].experiments.map((item) => item.status), gateStatuses: lineages[index].gates.map((item) => item.conclusion), releaseStatuses: lineages[index].releases.map((item) => item.status) }))
    }
    const sectionId = category === 'TASTE_SKILL' || category === 'PRODUCTION_SKILL' ? category : 'OTHER'
    sections.find((section) => section.id === sectionId)!.rows.push(row)
  })
  return { sections }
}
