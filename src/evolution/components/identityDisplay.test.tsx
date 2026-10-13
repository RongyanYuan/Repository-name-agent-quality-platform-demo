import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntityId } from './ViewPrimitives'

describe('copyable opaque identities', () => {
  it('copies the full ID without navigating or losing trailing digits', async () => {
    let clipboard = ''
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { clipboard = text } } })
    const navigate = vi.fn()
    render(<EntityId kind="trace" id="202610120001923912000001" onOpen={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: '复制 Trace ID' }))
    await waitFor(() => expect(screen.getByText('已复制')).toBeVisible())
    expect(clipboard).toBe('202610120001923912000001')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '202610120001923912000001' })).toHaveAttribute('title', 'trace: 202610120001923912000001')
  })
  it('reports clipboard permission failure and keeps the original text selectable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
    render(<EntityId kind="session" id="000000000000000000001" />)
    fireEvent.click(screen.getByRole('button', { name: '复制 Session ID' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('复制失败，请选中文本复制'))
    expect(screen.getByRole('status')).toHaveTextContent('000000000000000000001')
  })
})
