import { Component, type ReactNode } from 'react'
import { EvolutionLoadError } from '../repository'

/** Keep failed migrations reviewable without resetting the stored user state. */
export class EvolutionLoadBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const error = this.state.error
    if (!error) return this.props.children
    const loadError = error instanceof EvolutionLoadError ? error : undefined
    const exportOriginal = () => {
      if (!loadError) return
      const url = URL.createObjectURL(new Blob([loadError.rawData], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'governance-original-state.json'; link.click()
      URL.revokeObjectURL(url)
    }
    return <main className="mx-auto mt-16 max-w-3xl rounded-lg border border-line bg-white p-6" role="alert">
      <h1 className="text-xl font-semibold">本地治理数据暂时无法加载</h1>
      <p className="mt-3 text-sm">原始数据已保留。身份迁移或数据校验未通过，本次没有重置您的标注与历史。</p>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded bg-slate-50 p-4 text-xs">{loadError?.diagnostic ?? error.message}</pre>
      {loadError && <button type="button" className="button button--primary mt-4" onClick={exportOriginal}>导出原始数据</button>}
      <button type="button" className="button mt-4 ml-3" onClick={()=>window.location.reload()}>重新加载</button>
    </main>
  }
}
