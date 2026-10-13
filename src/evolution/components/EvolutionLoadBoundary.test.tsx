import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EvolutionLoadError } from '../repository'
import { EvolutionLoadBoundary } from './EvolutionLoadBoundary'

describe('migration failure diagnosis',()=>{
  it('keeps an export of the original state available without resetting data',()=>{
    const raw='{"state":{"humanNote":"保留原始标注"}}'
    const Failure=()=>{throw new EvolutionLoadError('alias 冲突',raw)}
    const warn=vi.spyOn(console,'error').mockImplementation(()=>{})
    const createURL=vi.fn(()=> 'blob:original-state'), revoke=vi.fn()
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:createURL})
    Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke})
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
    render(<EvolutionLoadBoundary><Failure/></EvolutionLoadBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('alias 冲突')
    expect(screen.getByRole('alert')).toHaveTextContent('原始数据已保留')
    fireEvent.click(screen.getByRole('button',{name:'导出原始数据'}))
    expect(createURL).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalledOnce()
    click.mockRestore();warn.mockRestore()
  })
})
