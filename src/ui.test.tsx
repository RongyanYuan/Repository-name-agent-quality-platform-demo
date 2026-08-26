import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BarChartView } from './charts'
import { Button, DataTable, Drawer, EmptyState } from './ui'

describe('dashboard primitives', () => {
  it('renders an empty state and keyboard-friendly button', () => {
    const action = vi.fn()
    render(<><EmptyState title="No records" description="Nothing matches." /><Button onClick={action}>Open</Button></>)
    expect(screen.getByRole('heading', { name: 'No records' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(action).toHaveBeenCalledOnce()
  })

  it('supports row selection and a closable Drawer', () => {
    const onRowClick = vi.fn()
    const onClose = vi.fn()
    render(<><DataTable columns={[{ key: 'name', header: 'Name', accessor: (row: { id: string; name: string }) => row.name }]} rows={[{ id: '1', name: 'First row' }]} rowKey={(row) => row.id} onRowClick={onRowClick} /><Drawer open onClose={onClose} title="Details">Drawer body</Drawer></>)
    fireEvent.click(screen.getByRole('row', { name: 'First row' }))
    expect(onRowClick).toHaveBeenCalledOnce()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Details' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('exposes clickable chart data rows for keyboard and pointer drill-down', () => {
    const onBarClick = vi.fn()
    render(<BarChartView data={[{ label: 'Memory', value: 4 }, { label: 'Tool', value: 2 }]} title="Root causes" onBarClick={onBarClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Memory 4' }))
    expect(onBarClick).toHaveBeenCalledWith({ label: 'Memory', value: 4 }, 0)
  })
})
