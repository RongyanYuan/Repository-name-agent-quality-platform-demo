import { cn } from '../../ui'

export type IndicatorContext = 'execution' | 'verdict' | 'review' | 'governance'
const green = new Set(['PASS', 'SUCCEEDED', 'SUCCESS', 'COMPLETED', 'RESOLVED', 'VERIFIED', 'RELEASED', 'CONFIRMED', 'ACKNOWLEDGED', 'DELIVERED', 'AVAILABLE', 'REVIEWED', 'Effective'])
const red = new Set(['FAIL', 'FAILED', 'REJECT', 'REJECTED', 'ROLLED_BACK', 'INVALID', 'MISSING', 'ERROR', 'Failed'])
const yellow = new Set(['CANDIDATE', 'PENDING', 'QUEUED', 'RUNNING', 'PARTIAL', 'DRAFT', 'NEW', 'OPEN', 'IN_PROGRESS', 'FIXING', 'MANUAL_REVIEW', 'CANARY', 'OBSERVING', 'READY', 'UNREVIEWED', 'STALE', 'DERIVED_FAIL', 'Effective but Inefficient'])
const labels: Record<string, string> = { CANDIDATE: '候选待确认', PASS: '通过', FAIL: '失败', SUCCEEDED: '执行成功', FAILED: '失败', COMPLETED: '已完成', RUNNING: '进行中', PENDING: '待处理', QUEUED: '待运行', PARTIAL: '部分完成', DRAFT: '草稿', OPEN: '待处理', NEW: '新记录', IN_PROGRESS: '处理中', FIXING: '修复中', MANUAL_REVIEW: '待人工复核', CANARY: '灰度中', OBSERVING: '观察中', READY: '待启动', UNREVIEWED: '未复核', STALE: '需重新复核', REVIEWED: '已复核', CONFIRMED: '已确认', RESOLVED: '已解决', VERIFIED: '已验证', RELEASED: '已发布', REJECT: '拒绝', REJECTED: '已拒绝', ROLLED_BACK: '已回滚', DERIVED_FAIL: '派生失败', UNKNOWN: '未记录', 'N/A': '不适用', NOT_APPLICABLE: '不适用', NOT_ENTERED: '尚未进入', AVAILABLE: '可用', INVALID: '不可用', MISSING: '缺失', DELIVERED: '已分流', ACKNOWLEDGED: '已接收', Effective: '有效', Failed: '失败', 'Effective but Inefficient': '有效但低效' }

export function statusIndicatorColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  return green.has(status) ? 'green' : red.has(status) ? 'red' : yellow.has(status) ? 'yellow' : 'gray'
}
export function statusIndicatorText(status: string): string { return labels[status] ?? '状态未记录' }
export function StatusIndicator({ status, context = 'governance', label, current = false, className }: { status: string; context?: IndicatorContext; label?: string; current?: boolean; className?: string }) {
  const color = statusIndicatorColor(status)
  const text = label ?? labels[status] ?? '状态未记录'
  return <span role="status" aria-label={text} aria-current={current ? 'step' : undefined} title={text} data-status={status} data-context={context} data-color={color} className={cn('inline-flex max-w-full items-center gap-2 text-xs', className)}>
    <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color === 'green' ? 'bg-pass' : color === 'red' ? 'bg-fail' : color === 'yellow' ? 'bg-warn' : 'bg-slate-400', current && 'ring-2 ring-slate-300 ring-offset-2')} />
    <span className="min-w-0 break-words">{text}{current && ' · 当前停留'}</span>
  </span>
}
