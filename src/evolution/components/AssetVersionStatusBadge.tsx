import type { AssetVersion } from '../domain'

const LIFECYCLE_LABELS = {
  ACTIVE: '当前版本 · 部署待确认',
  CANDIDATE: '候选版本',
  DEPRECATED: '历史版本',
  PLANNED: '待建设'
} as const

/** Deployment is explicit metadata, independent of asset kind and score filters. */
export function AssetVersionStatusBadge({ version }: { version: AssetVersion }) {
  const deployment = version.deployment
  let label: string = LIFECYCLE_LABELS[version.status]
  let color = '#64748b'; let background = '#f8fafc'; let border = '#e2e8f0'
  if (deployment?.status === 'ACTIVE' && deployment.environment === 'Production') {
    label = 'Production · 使用中'
    color = '#138a5b'; background = '#eef9f3'; border = '#bde5cf'
  } else if (deployment?.status === 'CANARY' && deployment.environment === 'Production') {
    label = 'Production · 灰度中'
    color = '#a36511'; background = '#fff8eb'; border = '#f3d8a1'
  } else if (deployment?.status === 'ACTIVE' && deployment.environment === 'Staging') {
    label = 'Staging · 验证中'
    color = '#a36511'; background = '#fff8eb'; border = '#f3d8a1'
  } else if (deployment?.status === 'OFFLINE') {
    label = '历史版本 · 已下线'
  } else if (deployment?.status === 'NOT_DEPLOYED') {
    label = version.status === 'PLANNED' ? '待建设 · 未部署' : '未部署'
  }
  const title = deployment
    ? `${deployment.source === 'MOCK' ? '本地 Mock 部署记录，非真实线上部署' : '版本部署记录'} · 更新于 ${deployment.updatedAt}`
    : '尚未记录该版本的部署状态'
  // Inline colors keep exported HTML reports identical without Tailwind.
  return <span role="status" title={title} data-deployment-status={deployment?.status ?? 'UNRECORDED'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: `1px solid ${border}`, borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 500, lineHeight: 1.2, color, backgroundColor: background }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
    {label}
  </span>
}
