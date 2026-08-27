import type { ComponentType } from 'react'
import { ArrowUpRight, Database, ListFilter, Route } from 'lucide-react'
import { Navigate, NavLink, Route as RouterRoute, Routes, useLocation, useParams } from 'react-router-dom'
import { DashboardLayout, DETAIL_KEYS, NAV_ITEMS, useContextNavigation } from './layout'
import { filterTasks, getScopeLabel } from './selectors'
import { useQuality } from './store'
import { EvaluationConfigPage as RealEvaluationConfigPage, OverviewPage as RealOverviewPage, PerformancePage as RealPerformancePage, TasksPage as RealTasksPage } from './qualityPages'
import { BenchmarksPage as RealBenchmarksPage, CasesPage as RealCasesPage, DatasetsPage as RealDatasetsPage } from './governancePages'
import { AnomalyMonitoringPage as RealAnomalyMonitoringPage } from './anomalyMonitoringPage'

export const ROUTE_PATHS = {
  overview: '/overview',
  performance: '/performance',
  anomalyMonitoring: '/anomaly-monitoring',
  tasks: '/tasks',
  cases: '/cases',
  datasets: '/datasets',
  benchmarks: '/benchmarks',
  evaluationConfig: '/evaluation-config'
} as const

export interface PagePlaceholderProps {
  title: string
  eyebrow: string
  description: string
  accent?: 'blue' | 'green' | 'orange' | 'red'
}

/**
 * A deliberately small route slot. Feature pages can replace these exports
 * without touching the shell, navigation, filter synchronization or URLs.
 */
export function PagePlaceholder({ title, eyebrow, description, accent = 'blue' }: PagePlaceholderProps) {
  const { state } = useQuality()
  const { contextHref } = useContextNavigation()
  const scopedTasks = filterTasks(state, state.filters)
  const failedTasks = scopedTasks.filter((task) => task.status === 'Failed')
  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <div className="placeholder-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 id="placeholder-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className={`placeholder-accent placeholder-accent--${accent}`} aria-hidden="true" />
      </div>
      <div className="placeholder-grid">
        <div className="placeholder-card">
          <span className="placeholder-card-label">当前范围</span>
          <strong>{getScopeLabel(state.filters)}</strong>
          <span className="placeholder-card-note">筛选结果会在所有页面间保持</span>
        </div>
        <div className="placeholder-card">
          <span className="placeholder-card-label">当前范围 Task</span>
          <strong>{scopedTasks.length}</strong>
          <span className="placeholder-card-note">符合当前全局筛选的任务</span>
        </div>
        <div className="placeholder-card">
          <span className="placeholder-card-label">需要关注</span>
          <strong className="text-fail">{failedTasks.length}</strong>
          <span className="placeholder-card-note">失败 Task / Trace</span>
        </div>
      </div>
      <div className="placeholder-empty-state">
        <div className="placeholder-empty-icon"><Route size={22} aria-hidden="true" /></div>
        <div>
          <h3>页面组件已接入路由</h3>
          <p>该区域是可替换的页面插槽，业务组件可以直接读取 QualityStore 和全局筛选上下文。</p>
          <div className="placeholder-actions">
            <NavLink className="button button--primary" to={contextHref('/tasks', { clear: DETAIL_KEYS, params: { status: 'FAIL' } })}>
              <ListFilter size={16} aria-hidden="true" />
              查看失败任务
              <ArrowUpRight size={15} aria-hidden="true" />
            </NavLink>
            <NavLink className="button button--secondary" to={contextHref('/datasets', { clear: DETAIL_KEYS })}>
              <Database size={16} aria-hidden="true" />
              打开 Golden Dataset
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  )
}

export const OverviewPage = RealOverviewPage
export const PerformancePage = RealPerformancePage
export const AnomalyMonitoringPage = RealAnomalyMonitoringPage
export const TasksPage = RealTasksPage
export const CasesPage = RealCasesPage
export const DatasetsPage = RealDatasetsPage
export const BenchmarksPage = RealBenchmarksPage
export const EvaluationConfigPage = RealEvaluationConfigPage

export const pageSlots: Record<keyof typeof ROUTE_PATHS, ComponentType> = {
  overview: OverviewPage,
  performance: PerformancePage,
  anomalyMonitoring: AnomalyMonitoringPage,
  tasks: TasksPage,
  cases: CasesPage,
  datasets: DatasetsPage,
  benchmarks: BenchmarksPage,
  evaluationConfig: EvaluationConfigPage
}

function DetailPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <PagePlaceholder eyebrow="DETAIL VIEW" title={title} description={description} accent="blue" />
  )
}

function DetailRedirect({ target, param, params: paramKeys = [], extra }: { target: string; param?: string; params?: string[]; extra?: Record<string, string> }) {
  const location = useLocation()
  const routeParams = useParams()
  const search = new URLSearchParams(location.search)
  const keys = [param, ...paramKeys].filter(Boolean) as string[]
  keys.forEach((key) => { const value = routeParams[key]; if (value) search.set(key, value) })
  Object.entries(extra ?? {}).forEach(([key, item]) => search.set(key, item))
  return <Navigate replace to={{ pathname: target, search: `?${search.toString()}` }} />
}

export default function App() {
  return (
    <Routes>
      <RouterRoute element={<DashboardLayout />}>
        <RouterRoute index element={<Navigate to={ROUTE_PATHS.overview} replace />} />
        <RouterRoute path="overview" element={<OverviewPage />} />
        <RouterRoute path="performance" element={<PerformancePage />} />
        <RouterRoute path="anomaly-monitoring" element={<AnomalyMonitoringPage />} />
        <RouterRoute path="tasks" element={<TasksPage />} />
        <RouterRoute path="tasks/:taskId" element={<DetailRedirect target="/tasks" param="taskId" />} />
        <RouterRoute path="traces/:traceId" element={<DetailRedirect target="/tasks" param="traceId" />} />
        <RouterRoute path="cases" element={<CasesPage />} />
        <RouterRoute path="cases/:caseId" element={<DetailRedirect target="/cases" param="caseId" />} />
        <RouterRoute path="datasets" element={<DatasetsPage />} />
        <RouterRoute path="datasets/:datasetId" element={<DetailRedirect target="/datasets" param="datasetId" />} />
        <RouterRoute path="benchmarks" element={<BenchmarksPage />} />
        <RouterRoute path="benchmarks/:benchmarkId" element={<DetailRedirect target="/benchmarks" param="benchmarkId" />} />
        <RouterRoute path="benchmarks/:benchmarkId/cases/:caseId" element={<DetailRedirect target="/benchmarks" params={['benchmarkId', 'caseId']} extra={{ comparison: 'true' }} />} />
        <RouterRoute path="evaluation-config" element={<EvaluationConfigPage />} />
        <RouterRoute path="*" element={<DetailPlaceholder title="页面不存在" description="请从左侧导航选择一个质量治理模块。" />} />
      </RouterRoute>
    </Routes>
  )
}
