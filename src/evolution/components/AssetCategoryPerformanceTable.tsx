import { DataTable, type Column } from '../../ui'
import type { AssetCatalogEntry } from '../domain'
import type { AssetCategoryRow } from '../data/assetCategoryWorkbench'
import { dateText } from '../pages/shared'
import { AssetVersionStatusBadge } from './AssetVersionStatusBadge'

export function AssetCategoryPerformanceTable({ rows, assetHref, onSelect }: {
  rows: AssetCategoryRow[]
  assetHref: (asset: AssetCatalogEntry) => string
  onSelect?: (asset: AssetCatalogEntry) => void
}) {
  const columns: Column<AssetCategoryRow>[] = [
    { key: 'asset', header: '资产名称', accessor: row => <div className="min-w-[120px]"><a className="font-semibold text-accent hover:underline" href={assetHref(row.asset)} onClick={onSelect ? event => { event.preventDefault(); event.stopPropagation(); onSelect(row.asset) } : undefined}>{row.asset.name}</a><p className="mt-1 break-all font-mono text-[10px] text-muted">{row.asset.id}</p></div> },
    { key: 'version', header: '当前版本', accessor: row => <span className="font-mono text-[11px]">{row.currentVersion?.version ?? '未记录'}</span> },
    { key: 'status', header: '当前状态', accessor: row => row.currentVersion ? <AssetVersionStatusBadge version={row.currentVersion} /> : <span className="text-muted">部署待确认</span> },
    { key: 'score', header: '窗口产物均分（0–2）', accessor: row => row.averageScore === undefined ? <span className="text-muted">暂无评测结果</span> : <span className="font-mono">{row.averageScore.toFixed(2)}</span> },
    { key: 'evaluated', header: '评测产物', accessor: row => row.evaluatedCount },
    { key: 'evolution', header: '进化项', accessor: row => row.evolutionCount },
    { key: 'traces', header: '贡献 Trace', accessor: row => row.traceCount },
    { key: 'updated', header: '最近更新', accessor: row => <span className="whitespace-nowrap text-[11px] text-muted">{dateText(row.updatedAt)}</span> }
  ]
  return <DataTable className="mt-4" caption="分类资产表现" rows={rows} rowKey={row => row.asset.id} columns={columns} onRowClick={onSelect ? row => onSelect(row.asset) : undefined} empty={<span>暂无符合筛选条件的资产</span>} />
}
