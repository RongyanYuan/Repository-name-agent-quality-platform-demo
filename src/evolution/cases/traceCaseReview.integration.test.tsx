import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { QualityProvider } from '../../store'
import { createInitialEvolutionData } from '../data'
import { EvolutionProvider } from '../store'
import { automaticModuleRevisionId } from '../reviews'
import { resolveIdentity } from '../identity'
import type { EvolutionRepository } from '../repository'

describe('current Case module review through the application', () => {
  it('persists two reviews across remount without changing automatic results, sibling Trace or frozen reports', async () => {
    localStorage.clear()
    let saved = createInitialEvolutionData()
    const traceId = resolveIdentity(saved,'trace','trace-ppt-generate')
    const pkg = saved.tracePackages.find(item=>item.traceId===traceId)!
    const skill = pkg.moduleScores.find(item=>item.moduleCode==='SKILL')!
    const automatic = structuredClone(skill)
    const snapshots = structuredClone({experiments:saved.experiments,decisions:saved.gateDecisions})
    const sibling = structuredClone(saved.tracePackages.find(item=>item.traceId===resolveIdentity(saved,'trace','trace-ppt-context')))
    const repository: EvolutionRepository = { load:()=>structuredClone(saved), save:next=>{saved=structuredClone(next)},reset:()=>saved }
    const mount=()=>render(<MemoryRouter initialEntries={['/cases?traceId=trace-ppt-generate&caseView=eval&timeRange=all']}><QualityProvider><EvolutionProvider repository={repository}><App/></EvolutionProvider></QualityProvider></MemoryRouter>)
    const first=mount()
    const submit=async(score:string,verdict:string,reason:string)=>{
      const row=screen.getByRole('row',{name:/^skill /})
      fireEvent.click(within(row).getByRole('button',{name:/人工复核|修改复核/}))
      fireEvent.change(screen.getByLabelText('人工分数（0–2）'),{target:{value:score}})
      fireEvent.change(screen.getByLabelText('辅助结论'),{target:{value:verdict}})
      fireEvent.change(screen.getByLabelText('复核说明'),{target:{value:reason}})
      fireEvent.click(screen.getByRole('button',{name:'保存人工复核'}))
      await waitFor(()=>expect(screen.queryByRole('region',{name:'人工复核编辑器'})).not.toBeInTheDocument())
    }
    await submit('0','FAIL','首次复核：根证据支持 0 分')
    await submit('1.25','PASS','第二次复核：按同一 Rubric 修订')
    const reviews=saved.moduleReviews!.filter(item=>item.moduleScoreId===skill.id)
    expect(reviews.map(item=>item.humanScore)).toEqual([0,1.25])
    expect(reviews.every(item=>item.automaticRevisionId===automaticModuleRevisionId(automatic))).toBe(true)
    expect(saved.tracePackages.find(item=>item.traceId===traceId)!.rating).toEqual(pkg.rating)
    expect(saved.tracePackages.find(item=>item.traceId===traceId)!.moduleScores.find(item=>item.id===skill.id)).toMatchObject({score:automatic.score,judgeReason:automatic.judgeReason,evidence:automatic.evidence})
    expect(saved.tracePackages.find(item=>item.traceId===sibling!.traceId)).toEqual(sibling)
    expect({experiments:saved.experiments,decisions:saved.gateDecisions}).toEqual(snapshots)
    first.unmount(); mount()
    expect(screen.getByRole('row',{name:/^skill /})).toHaveTextContent('1.25 / 2')
    fireEvent.click(within(screen.getByRole('row',{name:/^skill /})).getByRole('button',{name:'查看 skill 复核历史'}))
    expect(screen.queryByRole('tab',{name:'治理链路'})).not.toBeInTheDocument()
    expect(screen.getByRole('tab',{name:'评测中心'})).toHaveAttribute('aria-selected','true')
    expect(screen.getByRole('dialog',{name:'模块人工复核历史'})).toBeVisible()
    const history=screen.getByRole('region',{name:'模块人工复核历史'})
    expect(within(history).getAllByRole('article')).toHaveLength(2)
    expect(history).toHaveTextContent('首次复核：根证据支持 0 分')
    expect(history).toHaveTextContent('第二次复核：按同一 Rubric 修订')
    fireEvent.click(screen.getByRole('button',{name:'关闭模块人工复核历史'}))
    expect(screen.queryByRole('dialog',{name:'模块人工复核历史'})).not.toBeInTheDocument()
    expect(screen.getByRole('row',{name:/^skill /})).toHaveTextContent('1.25 / 2')
  },20000)
})
