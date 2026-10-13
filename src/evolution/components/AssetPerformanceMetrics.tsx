import type { AssetCategoryWorkbenchResult } from '../data/assetCategoryWorkbench'

export function AssetPerformanceMetrics({ summary, category }: { summary?: AssetCategoryWorkbenchResult; category: boolean }) {
  const items = [
    ...(category ? [{ label: '资产数', value: summary?.assets.length ?? 0 }] : []),
    { label: '产物平均分', value: summary?.averageScore === undefined ? '暂无评测结果' : `${summary.averageScore.toFixed(2)} / 2` },
    { label: '已评测产物', value: summary?.evaluatedCount ?? 0 },
    { label: '进化项数', value: summary?.evolutionCount ?? 0 },
    { label: '贡献 Trace', value: summary?.traceCount ?? 0 }
  ]
  return <div role="region" aria-label={category ? '类别总览指标' : '资产表现指标'} className="mt-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
    {items.map(item => <div key={item.label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 11, color: '#667085', margin: 0 }}>{item.label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 0' }}>{item.value}</p>
    </div>)}
  </div>
}
