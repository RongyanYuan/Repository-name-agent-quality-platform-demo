import { useCallback, useEffect, useRef, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  LayoutDashboard,
  ListTree,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon
} from 'lucide-react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { BUSINESS_TYPES, ENVIRONMENTS, type FilterState } from './domain'
import { VERSION_OPTIONS } from './data'
import { defaultFilters, getScopeLabel } from './selectors'
import { DETAIL_QUERY_KEYS, GLOBAL_FILTER_KEYS, parseGlobalFilters, serializeGlobalFilters } from './urlState'
import { useQuality } from './store'
import { useEvolution } from './evolution/store'

export interface NavigationItem {
  path: string
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavigationItem[] = [
  { path: '/overview', label: '治理总览', shortLabel: '总览', description: '产物结果、资产进化与过程表现', icon: LayoutDashboard },
  { path: '/cases', label: 'Case / Trace 分析', shortLabel: 'Case', description: '从线上任务定位 Trace、Evidence 与治理进度', icon: ListTree },
  { path: '/datasets-evaluations', label: '数据集与评测', shortLabel: '数据评测', description: '按治理对象、固定源版本与归因管理数据集和评测历史', icon: ClipboardCheck },
  { path: '/assets-skills', label: '资产管理', shortLabel: '资产', description: '资产版本、产物表现、Trace 贡献与进化历史', icon: Sparkles },
  { path: '/rules', label: '规则配置', shortLabel: '规则', description: '按资产与归因配置准出、分流和聚类规则', icon: SlidersHorizontal }
]

const TIME_OPTIONS: Array<{ value: FilterState['timeRange']; label: string }> = [
  { value: '24h', label: '过去 24 小时' },
  { value: '7d', label: '过去 7 天' },
  { value: '14d', label: '过去 14 天' },
  { value: '30d', label: '过去 30 天' }
]

// These keys are serialized by selectors and are deliberately kept separate
// from detail/context keys so a Task -> Trace -> Case journey can be restored.
export const FILTER_KEYS = GLOBAL_FILTER_KEYS

export const DETAIL_KEYS = DETAIL_QUERY_KEYS

const routeForPath = (pathname: string) => NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))

const filtersEqual = (left: FilterState, right: FilterState) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...keys].every((key) => (left as unknown as Record<string, unknown>)[key] === (right as unknown as Record<string, unknown>)[key])
}

const formatUpdatedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

export interface ContextPathOptions {
  params?: Record<string, string | undefined>
  clear?: readonly string[]
}

/**
 * Hook used by pages for drill-down navigation. Global and local filters are
 * retained by default; detail keys can be cleared when returning to a list.
 */
export function buildContextHref(currentSearch: string, path: string, options: ContextPathOptions = {}) {
  const [pathname, rawSearch = ''] = path.split('?')
  const params = new URLSearchParams(currentSearch)
  const targetParams = new URLSearchParams(rawSearch)
  ;(options.clear ?? []).forEach((key) => params.delete(key))
  targetParams.forEach((value, key) => params.set(key, value))
  Object.entries(options.params ?? {}).forEach(([key, value]) => { if (value === undefined || value === '') params.delete(key); else params.set(key, value) })
  const search = params.toString()
  return `${pathname}${search ? `?${search}` : ''}`
}

export function useContextNavigation() {
  const location = useLocation()
  const navigate = useNavigate()

  const contextHref = useCallback((path: string, options: ContextPathOptions = {}) => buildContextHref(location.search, path, options), [location.search])

  const navigateContext = useCallback((path: string, options: ContextPathOptions = {}) => {
    navigate(contextHref(path, options))
  }, [contextHref, navigate])

  return { contextHref, navigateContext }
}

function GlobalFilterBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { state, dispatch } = useQuality()
  const { state: evolutionState } = useEvolution()
  const filters = state.filters
  const isDatasetEvaluationWorkbench = location.pathname === '/datasets-evaluations'
  const isAssetManagement = location.pathname === '/assets-skills'

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    dispatch({ type: 'SET_FILTERS', filters: { [key]: value } as Partial<FilterState> })
  }, [dispatch])

  if (isAssetManagement || location.pathname === '/rules') return null

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => setFilter('search', event.target.value)
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (location.pathname !== '/cases') navigate('/cases')
  }

  const drilldownFilters = [
    filters.rootCause ? `首错归因：${filters.rootCause}` : undefined,
    filters.metric ? `指标：${filters.metric}` : undefined,
    filters.status ? `状态：${filters.status}` : undefined,
    filters.outcomeType ? `产物类型：${filters.outcomeType}` : undefined,
    filters.complexity ? `复杂度：${filters.complexity}` : undefined,
    filters.skill ? `Skill：${filters.skill}` : undefined,
    filters.badcase ? `Badcase：${filters.badcase === 'yes' ? '是' : '否'}` : undefined,
    filters.golden ? `Golden：${filters.golden === 'yes' ? '是' : '否'}` : undefined,
    filters.anomalyTool ? `异常 Tool：${filters.anomalyTool}` : undefined,
    filters.anomalyWindow ? `异常窗口：${filters.anomalyWindow}` : undefined,
    filters.interceptionReason ? `拦截原因：${filters.interceptionReason}` : undefined
  ].filter((value): value is string => Boolean(value))

  const clearDrilldownFilters = () => {
    const params = new URLSearchParams(location.search)
    const keys = ['status', 'outcomeType', 'complexity', 'rootCause', 'skill', 'badcase', 'golden', 'metric', 'anomalyTool', 'anomalyWindow', 'interceptionReason', 'acceptanceSignal', 'validity', 'processStatus', 'benchmarkId'] as const
    keys.forEach((key) => params.delete(key))
    dispatch({ type: 'SET_FILTERS', filters: Object.fromEntries(keys.map((key) => [key, undefined])) })
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' })
  }

  return (
    <>
      <div className="global-filter-bar" aria-label="全局筛选">
        <div className="filter-group filter-group--range">
          <label htmlFor="global-time-range">时间范围</label>
          <select id="global-time-range" value={filters.timeRange} onChange={(event) => setFilter('timeRange', event.target.value as FilterState['timeRange'])}>
            {TIME_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="global-agent-version">Agent 版本</label>
          <select id="global-agent-version" value={filters.agentVersion} onChange={(event) => setFilter('agentVersion', event.target.value)}>
            <option value="All Versions">全部版本</option>
            {VERSION_OPTIONS.map((version) => <option value={version} key={version}>{version}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="global-business-type">业务类型</label>
          <select id="global-business-type" value={filters.businessType} onChange={(event) => setFilter('businessType', event.target.value as FilterState['businessType'])}>
            {BUSINESS_TYPES.map((business) => <option value={business} key={business}>{business === 'All' ? '全部业务' : business}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="global-environment">环境</label>
          <select id="global-environment" value={filters.environment} onChange={(event) => setFilter('environment', event.target.value as FilterState['environment'])}>
            {ENVIRONMENTS.map((environment) => <option value={environment} key={environment}>{environment}</option>)}
          </select>
        </div>
        {!isDatasetEvaluationWorkbench && <div className="filter-group">
          <label htmlFor="global-skill">全局 Skill</label>
          <select id="global-skill" value={filters.skill ?? ''} onChange={(event) => setFilter('skill', event.target.value || undefined)}>
            <option value="">全部 Skill</option>
            {evolutionState.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
        </div>}
        <form className="global-search" onSubmit={submitSearch} role="search">
          <Search size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="global-search-input">搜索 task_id、query、session_id、trace_id 或 skill_id</label>
        <input id="global-search-input" value={filters.search} onChange={onSearchChange} placeholder="搜索 task_id / query / session_id / trace_id / skill_id" />
          {filters.search && <button type="button" className="icon-button icon-button--quiet" aria-label="清除搜索" onClick={() => setFilter('search', '')}>×</button>}
        </form>
      </div>
      {drilldownFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50 px-5 py-2 text-[11px] text-muted" role="status" aria-label="当前下钻筛选">
        <span className="font-medium text-ink">当前下钻筛选</span>
        {drilldownFilters.map((filter) => <span key={filter} className="rounded border border-accent/20 bg-white px-2 py-1 text-accent">{filter}</span>)}
        <button type="button" className="ml-auto text-[11px] font-medium text-accent hover:text-ink" onClick={clearDrilldownFilters}>清除下钻筛选</button>
      </div>}
    </>
  )
}

function Breadcrumbs() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = routeForPath(location.pathname)
  const segments = location.pathname.split('/').filter(Boolean)
  const isDetail = segments.length > 1
  const detailLabel = isDetail ? segments[segments.length - 1] : undefined
  const returnTo = new URLSearchParams(location.search).get('returnTo')
  const validReturnTo = returnTo && /^\/(overview|cases|evaluations|datasets-evaluations|issues|variants|experiments|releases|assets-skills|datasets|rules)(\?|$)/.test(returnTo) ? returnTo : undefined
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/overview')
  }

  return (
    <div className="breadcrumb-row">
      <button type="button" className="back-button" onClick={handleBack} aria-label="返回上一页">
        <ArrowLeft size={15} aria-hidden="true" />
        <span>返回</span>
      </button>
      {validReturnTo && <button type="button" className="back-button" onClick={() => navigate(validReturnTo)} aria-label="返回来源页面">返回来源</button>}
      <nav className="breadcrumbs" aria-label="面包屑导航">
        <Link to={{ pathname: '/overview', search: location.search }}>治理总览</Link>
        {current && current.path !== '/overview' && <><ChevronRight size={14} aria-hidden="true" /><Link to={{ pathname: current.path, search: location.search }}>{current.label}</Link></>}
        {detailLabel && <><ChevronRight size={14} aria-hidden="true" /><span className="breadcrumb-current">{detailLabel}</span></>}
      </nav>
    </div>
  )
}

function Sidebar() {
  const location = useLocation()
  const { contextHref } = useContextNavigation()
  const current = routeForPath(location.pathname)
  return (
    <aside className="app-sidebar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true"><Sparkles size={18} /></div>
        <div>
          <div className="brand-name">Office Agent</div>
          <div className="brand-subtitle">自进化治理平台</div>
        </div>
      </div>
      <div className="sidebar-scope">
        <span className="status-dot status-dot--live" aria-hidden="true" />
        <span>Mock 演示工作区</span>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        <div className="nav-caption">工作区</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={contextHref(item.path, { clear: DETAIL_KEYS })}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
              end={item.path === '/overview'}
              title={item.description}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="sidebar-help" title="查看工作区说明">
          <CircleHelp size={17} aria-hidden="true" />
          <span>使用说明</span>
        </button>
        <div className="sidebar-version"><span>本地数据</span><strong>Mock Demo</strong></div>
      </div>
      {current && <span className="sr-only">当前页面：{current.label}</span>}
    </aside>
  )
}

function TopBar() {
  const { state } = useQuality()
  const { state: evolutionState } = useEvolution()
  const location = useLocation()
  const current = routeForPath(location.pathname) ?? NAV_ITEMS[0]
  return (
    <header className="app-topbar">
      <div className="topbar-heading">
        <div className="eyebrow">OFFICE AGENT SELF-EVOLUTION</div>
        <h1>{current.label}</h1>
        <p>{current.description}</p>
      </div>
      <div className="topbar-meta">
        <div className="scope-pill" title="当前全局数据范围">{getScopeLabel(state.filters)}</div>
        <div className="updated-at"><span className="status-dot status-dot--live" aria-hidden="true" /><span>Mock 数据更新于 {formatUpdatedAt(evolutionState.updatedAt)}</span></div>
      </div>
    </header>
  )
}

export function DashboardLayout({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { state, dispatch } = useQuality()
  const previousFiltersRef = useRef(state.filters)

  // Restore URL filters on browser refresh and on Back/Breadcrumb navigation.
  // This effect must only react to URL changes. Watching state.filters here
  // races with the state -> URL effect below and can overwrite a fresh user
  // selection with the previous URL for one render (or indefinitely).
  useEffect(() => {
    const urlFilters = parseGlobalFilters(location.search, defaultFilters, { includeSkill: !['/datasets-evaluations', '/assets-skills'].includes(location.pathname) })
    const currentGlobal = Object.fromEntries(GLOBAL_FILTER_KEYS.map((key) => [key, state.filters[key]])) as unknown as typeof urlFilters
    if (!filtersEqual(urlFilters, currentGlobal)) dispatch({ type: 'SET_FILTERS', filters: urlFilters })
  }, [dispatch, location.search, location.pathname])

  // Keep all known filter values serializable while preserving detail IDs and
  // page-specific query parameters owned by the route.
  useEffect(() => {
    // This effect only serializes user-driven filter changes. When the URL is
    // the source of truth (Back/deep link), the first effect updates the store
    // before this one runs again.
    if (filtersEqual(previousFiltersRef.current, state.filters)) return
    previousFiltersRef.current = state.filters
    const current = new URLSearchParams(location.search)
    const isWorkbench = ['/datasets-evaluations', '/assets-skills'].includes(location.pathname)
    const encoded = new URLSearchParams(serializeGlobalFilters(isWorkbench ? { ...state.filters, skill: undefined } : state.filters))
    // Case / Trace custom windows use `timeRange=all` plus timeFrom/timeTo.
    // The legacy global store only knows relative ranges, so preserve this
    // route-owned sentinel while serializing the other global filters.
    const preserveCaseWindow = location.pathname === '/cases' && current.get('timeRange') === 'all'
    if (preserveCaseWindow) encoded.delete('timeRange')
    FILTER_KEYS.forEach((key) => { if ((!isWorkbench || key !== 'skill') && !(preserveCaseWindow && key === 'timeRange')) current.delete(key) })
    encoded.forEach((value, key) => current.set(key, value))
    const nextSearch = current.toString()
    if (nextSearch !== location.search.replace(/^\?/, '')) {
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash: location.hash }, { replace: true })
    }
  }, [location.hash, location.pathname, location.search, navigate, state.filters])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <GlobalFilterBar />
        <div className="content-frame">
          <Breadcrumbs />
          <main className="page-content">{children ?? <Outlet />}</main>
        </div>
      </div>
    </div>
  )
}

export { formatUpdatedAt }
