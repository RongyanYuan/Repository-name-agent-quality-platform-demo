export interface AssetScorePoint {
  at: string
  label: string
  version: string
  score: number
}

/** A version progression is one line: every point retains its version and
 * the recorded version time, even when several versions fall in one month. */
export function AssetPerformanceChart({ points, label = '历史版本产物平均分' }: { points: AssetScorePoint[]; label?: string }) {
  if (!points.length) return <p className="text-xs text-muted">暂无评测结果</p>
  const ordered = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.version.localeCompare(b.version, undefined, { numeric: true }))
  const width = Math.max(760, ordered.length * 145)
  const height = 320
  const left = 76; const right = 76; const top = 52; const bottom = 66
  const innerWidth = width - left - right; const innerHeight = height - top - bottom
  const timestamps = ordered.map(point => Date.parse(point.at))
  const start = timestamps[0]; const end = timestamps.at(-1)!
  const position = (point: AssetScorePoint) => ({
    x: end === start ? left + innerWidth / 2 : left + ((Date.parse(point.at) - start) / (end - start)) * innerWidth,
    y: top + (1 - point.score / 2) * innerHeight
  })
  return <div className="overflow-x-auto"><svg className="score-chart w-full min-w-[640px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    {[0, 0.5, 1, 1.5, 2].map(score => {
      const y = top + (1 - score / 2) * innerHeight
      return <g key={score}><line className="chart-grid" x1={left} y1={y} x2={width - right} y2={y} stroke="#e5eaf1"/><text x={left - 14} y={y + 4} textAnchor="end" fill="#64748b" fontSize="12">{score}</text></g>
    })}
    <path d={`M ${left} ${top} V ${height - bottom} H ${width - right}`} fill="none" stroke="#94a3b8" strokeWidth="1.2"/>
    {ordered.length > 1 && <polyline className="chart-line" points={ordered.map(point => { const p = position(point); return `${p.x},${p.y}` }).join(' ')} fill="none" stroke="#1d5fd1" strokeWidth="3" strokeLinejoin="round"/>}
    {ordered.map((point, index) => {
      const p = position(point)
      return <g key={`${point.version}-${point.at}-${index}`}><title>{point.version} · {point.label} · {point.score.toFixed(2)} / 2</title><circle className="chart-dot" cx={p.x} cy={p.y} r="5" fill="white" stroke="#1d5fd1" strokeWidth="3"/>
        <text className="chart-value" x={p.x} y={p.y - 25} textAnchor="middle" fill="#1f2937" fontSize="13" fontWeight="700">{point.score.toFixed(2)}</text>
        <text className="chart-version" x={p.x} y={p.y - 10} textAnchor="middle" fill="#1d5fd1" fontSize="11">{point.version}</text>
        <text className="chart-label" x={p.x} y={height - 39} textAnchor="middle" fill="#64748b" fontSize="11">{point.label}</text>
      </g>
    })}
    <text className="chart-title" x={width / 2} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="12">时间</text>
    <text className="chart-title" x="18" y={height / 2} textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`} fill="#64748b" fontSize="12">评分（0–2）</text>
  </svg></div>
}
