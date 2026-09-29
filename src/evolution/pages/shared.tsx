import { useMemo, useState, type ReactNode } from 'react'
import type { ReferenceTarget } from '../components/ViewPrimitives'
import { IdLink, ReferenceDrawer } from '../components/ViewPrimitives'

export type AnyEntity = { id: string; [key: string]: unknown }
export type AnyState = Record<string, unknown>

export const text = (value: unknown, fallback = '—') => typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : fallback
export const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
export const entities = (state: AnyState, key: string): AnyEntity[] => {
  const value = state[key]
  return Array.isArray(value) ? value.filter((item): item is AnyEntity => Boolean(item && typeof item === 'object' && typeof item.id === 'string')) : []
}
export const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const byId = (state: AnyState, key: string, id?: string) => id ? entities(state, key).find((item) => item.id === id) : undefined
export const dateText = (value: unknown) => {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
export const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function useReferenceNavigation(external?: (target: ReferenceTarget) => void) {
  const [target, setTarget] = useState<ReferenceTarget>()
  const open = (next: ReferenceTarget) => external ? external(next) : setTarget(next)
  const drawer = <ReferenceDrawer target={target} onClose={() => setTarget(undefined)} />
  return { open, drawer }
}

export function RelatedIds({ label, ids, kind, onOpen }: { label: string; ids: string[]; kind: ReferenceTarget['kind']; onOpen: (target: ReferenceTarget) => void }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p><div className="mt-1.5 flex flex-wrap gap-2">{ids.length ? ids.map((id) => <IdLink key={id} id={id} kind={kind} onOpen={onOpen} />) : <span className="text-xs text-muted">暂无关联</span>}</div></div>
}

export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel ${className}`}>{children}</section>
}

export function useCollectionFilters<T extends AnyEntity>(rows: T[], fields: string[]) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return rows
    return rows.filter((row) => fields.some((field) => {
      const value = row[field]
      return (Array.isArray(value) ? value.join(' ') : String(value ?? '')).toLocaleLowerCase().includes(needle)
    }))
  }, [fields, query, rows])
  return { query, setQuery, filtered }
}
