import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusIndicator } from './StatusIndicator'

describe('explicit status circles', () => {
  it('shows an algorithm Badcase candidate as awaiting confirmation',()=>{
    render(<StatusIndicator status="CANDIDATE" context="governance"/> )
    expect(screen.getByRole('status')).toHaveAttribute('data-color','yellow')
    expect(screen.getByRole('status')).toHaveTextContent('候选待确认')
  })
  it.each([
    ['PASS', 'verdict', 'green'], ['FAIL', 'verdict', 'red'],
    ['COMPLETED', 'execution', 'green'], ['RUNNING', 'execution', 'yellow'],
    ['UNREVIEWED', 'review', 'yellow'], ['N/A', 'verdict', 'gray'],
    ['DERIVED_FAIL', 'verdict', 'yellow'], ['ROLLED_BACK', 'governance', 'red']
  ] as const)('maps %s in %s without score thresholds', (status, context, color) => {
    render(<StatusIndicator status={status} context={context} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-color', color)
    expect(screen.getByRole('status').textContent).not.toBe('')
  })
  it('keeps a failed current position red, and distinguishes verdict from review workflow', () => {
    render(<><StatusIndicator status="FAILED" current label="当前分支失败" /><StatusIndicator status="PASS" context="verdict" /><StatusIndicator status="UNREVIEWED" context="review" /></>)
    const current = screen.getByLabelText('当前分支失败')
    expect(current).toHaveAttribute('data-color', 'red')
    expect(current).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('通过')).toHaveAttribute('data-color', 'green')
    expect(screen.getByLabelText('未复核')).toHaveAttribute('data-color', 'yellow')
  })
})
