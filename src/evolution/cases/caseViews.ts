export const CASE_DETAIL_VIEWS = [
  { id: 'session', label: 'Session 对话' },
  { id: 'eval', label: '评测中心' },
  { id: 'outcome', label: '产物评测' }
] as const

export type CaseDetailView = typeof CASE_DETAIL_VIEWS[number]['id']

export function normalizeCaseView(value?: string | null): CaseDetailView {
  if (value === 'task') return 'outcome'
  if (value === 'trace' || value === 'governance') return 'eval'
  return CASE_DETAIL_VIEWS.some(view => view.id === value) ? value as CaseDetailView : 'eval'
}
