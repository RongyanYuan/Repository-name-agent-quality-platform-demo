import { ChevronRight } from 'lucide-react'
import { Button, StatusBadge, cn } from '../../ui'
import { formatLegacyScoreOutOfTwo, formatNormalizedScoreOutOfTwo } from '../score'

export type ModuleEvaluationRecord = Record<string, unknown> & { id?: string }

const MODULE_ORDER = ['Reason', '记忆', '上文', 'skill', 'Act', 'Tool', 'Outcome / 产物'] as const

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof fallback === 'string' ? fallback : String(fallback ?? '—')
}

const first = (item: ModuleEvaluationRecord, keys: string[], fallback?: unknown) => {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

const normalizeModule = (item: ModuleEvaluationRecord) => {
  const value = text(first(item, ['moduleLabel', 'module', 'moduleCode', 'name']), '未知模块')
  const lower = value.toLocaleLowerCase()
  if (lower.includes('outcome') || lower.includes('产物') || lower.includes('结果')) return 'Outcome / 产物'
  if (lower.includes('memory') || value === '记忆') return '记忆'
  if (lower.includes('context') || value === '上文') return '上文'
  if (lower.includes('skill')) return 'skill'
  if (lower.includes('reason')) return 'Reason'
  if (lower.includes('tool')) return 'Tool'
  if (lower.includes('act')) return 'Act'
  return value
}

const statusLabel = (status: unknown) => {
  const normalized = text(status, 'UNKNOWN').toUpperCase()
  if (normalized === 'DERIVED_FAIL' || normalized === 'DERIVED FAILURE' || normalized === 'DERIVED') return '派生失败'
  if (normalized === 'NOT_APPLICABLE' || normalized === 'N/A') return 'N/A'
  if (normalized === 'PASS') return 'PASS'
  if (normalized === 'FAIL') return 'FAIL'
  return 'UNKNOWN'
}

const statusTone = (status: unknown): 'pass' | 'fail' | 'derived' | 'neutral' => {
  const normalized = text(status, 'UNKNOWN').toUpperCase()
  if (normalized === 'PASS') return 'pass'
  if (normalized === 'FAIL') return 'fail'
  if (normalized === 'DERIVED_FAIL' || normalized === 'DERIVED FAILURE' || normalized === 'DERIVED') return 'derived'
  return 'neutral'
}

export function moduleEvaluationStatus(item: ModuleEvaluationRecord) {
  return first(item, ['humanStatus', 'humanVerdict', 'manualStatus', 'status', 'autoStatus', 'verdict'], 'UNKNOWN')
}

export function ModuleEvaluationMatrix({ modules, onSelect, selectedId, compact = false, className }: { modules: ModuleEvaluationRecord[]; onSelect?: (module: ModuleEvaluationRecord) => void; selectedId?: string; compact?: boolean; className?: string }) {
  const byModule = new Map<string, ModuleEvaluationRecord>()
  modules.forEach((item) => {
    const module = normalizeModule(item)
    if (!byModule.has(module)) byModule.set(module, item)
  })
  // Context Assembly is intentionally not a module row. It only appears in the evidence drawer/reason.
  const ordered = [...MODULE_ORDER.map((module) => byModule.get(module) ?? ({ id: `missing-${module}`, moduleLabel: module, module, status: 'UNKNOWN', isMissing: true } as ModuleEvaluationRecord)), ...[...byModule.entries()].filter(([module]) => !MODULE_ORDER.includes(module as (typeof MODULE_ORDER)[number])).map(([, item]) => item)]
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-line', className)}>
      <table className={cn('w-full min-w-[720px] border-collapse text-left text-xs', compact && 'min-w-[620px]')}>
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">模块</th>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">自动分数（0–2）</th>
            <th className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">人工分数（0–2）</th>
            <th className="border-b border-line px-3 py-2 font-semibold">判定依据 / 首错关系</th>
            <th className="w-8 border-b border-line px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordered.map((item) => {
            const module = normalizeModule(item)
            const auto = first(item, ['autoStatus', 'autoVerdict', 'automaticStatus', 'verdict', 'status'], 'UNKNOWN')
            const human = first(item, ['humanStatus', 'humanVerdict', 'manualStatus'], undefined)
            const humanScore = first(item, ['humanScore', 'human_score'], undefined)
            const reason = text(first(item, ['judgeReason', 'reason', 'autoReason', 'description']), item.isMissing ? '本次 Rubric 未覆盖或缺少观测，未根据最终产物补判。' : '判定依据未记录')
            const derived = Boolean(first(item, ['derivedFrom', 'derivedFailureFrom', 'isDerived'], false)) || String(auto).toUpperCase() === 'DERIVED_FAIL'
            const firstFailure = Boolean(first(item, ['firstFailure', 'isFirstFailure', 'rootCause'], false))
            const isMissing = Boolean(item.isMissing)
            return (
              <tr key={String(item.id ?? module)} className={cn(onSelect && !isMissing && 'cursor-pointer transition hover:bg-slate-50', selectedId === item.id && 'bg-accent/5')} onClick={() => onSelect?.(item)}>
                <td className="px-3 py-2.5 align-top"><div className="font-semibold text-ink">{module}</div>{module === '上文' && <div className="mt-1 text-[10px] text-muted">仅作为证据，不单独统计 Context 指标</div>}</td>
                <td className="px-3 py-2.5 align-top font-mono text-[11px] text-ink">{formatLegacyScoreOutOfTwo(first(item, ['autoScore', 'score'], undefined))}</td>
                <td className="px-3 py-2.5 align-top font-mono text-[11px] text-ink">{human ? formatNormalizedScoreOutOfTwo(humanScore, '未评分') : <span className="text-[11px] text-muted">未复核</span>}</td>
                <td className="max-w-[420px] px-3 py-2.5 align-top"><p className="line-clamp-2 text-[11px] leading-5 text-muted">{String(reason)}</p><div className="mt-1 flex flex-wrap gap-1.5">{Boolean(firstFailure) && <StatusBadge status="First Failure" label="首个失败" tone="fail" showIcon={false} />}{Boolean(derived) && <StatusBadge status="DERIVED_FAIL" label="派生失败" tone="derived" showIcon={false} />}{Boolean(human) && String(human).toUpperCase() !== String(auto).toUpperCase() && <StatusBadge status="Eval Disagreement" label="Eval Disagreement" tone="warn" showIcon={false} />}</div></td>
                <td className="px-2 py-2.5 text-right">{onSelect && !isMissing && <Button variant="ghost" size="sm" aria-label={`查看 ${module} Evidence`} icon={ChevronRight}>{null}</Button>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { MODULE_ORDER }
