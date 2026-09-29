import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { createLocalEvolutionServices, type EvolutionServiceAdapters } from './services'

describe('local evolution service adapters', () => {
  const state = createInitialEvolutionData()

  it('returns typed Trace and Eval records with an explicit Mock provider boundary', async () => {
    const services = createLocalEvolutionServices(() => state)

    const trace = await services.trace.getTrace('trace-ppt-generate')
    const evaluation = await services.evaluation.run('case-ppt-management', 'OUTCOME')

    expect(trace).toMatchObject({ provider: 'LOCAL_MOCK', isMock: true, data: { trace: { id: 'trace-ppt-generate' } } })
    expect(trace.data.observations.map((item) => item.id)).toEqual(['obs-ppt-skill', 'obs-ppt-artifact'])
    expect(evaluation.data.map((item) => item.id)).toEqual(['outcome-eval-ppt-style'])
    expect(evaluation.label).toContain('Mock')
  })

  it('isolates local adapter results from the canonical state', async () => {
    const services = createLocalEvolutionServices(() => state)

    const result = await services.trace.getTrace('trace-ppt-generate')
    result.data.trace.status = 'FAILED'
    result.data.observations[0].output = '被调用方改写'

    expect(state.traces.find((item) => item.id === 'trace-ppt-generate')?.status).toBe('SUCCEEDED')
    expect(state.observations.find((item) => item.id === 'obs-ppt-skill')?.output).not.toBe('被调用方改写')
  })

  it('plans generation without claiming that the unavailable generation service ran', async () => {
    const services = createLocalEvolutionServices(() => state)

    const plan = await services.generationPlanning.plan({ assetId: 'asset-user-template', name: '个人汇报 Skill' })

    expect(plan).toMatchObject({ provider: 'LOCAL_MOCK', isMock: true, data: { status: 'PLANNED', generationExecuted: false, assetId: 'asset-user-template' } })
  })

  it('prepares experiment and release operations as local Mock results', async () => {
    const services = createLocalEvolutionServices(() => state)
    const experiment = state.experiments[0]
    const release = state.releases[0]

    expect(await services.experiment.start(experiment.id)).toMatchObject({ provider: 'LOCAL_MOCK', isMock: true, data: { experimentId: experiment.id, status: 'QUEUED' } })
    expect(await services.release.publish(release.id)).toMatchObject({ provider: 'LOCAL_MOCK', isMock: true, data: { releaseId: release.id, status: 'PENDING' } })
  })

  it('accepts independently replaceable providers through one typed contract', async () => {
    const replacements: EvolutionServiceAdapters = {
      trace: { getTrace: async (traceId) => ({ provider: 'EXTERNAL', isMock: false, label: 'Langfuse', data: { trace: { ...state.traces[0], id: traceId }, observations: [], evidence: [] } }) },
      evaluation: { run: async () => ({ provider: 'EXTERNAL', isMock: false, label: 'Eval Agent', data: [] }) } as EvolutionServiceAdapters['evaluation'],
      experiment: { start: async () => ({ provider: 'EXTERNAL', isMock: false, label: 'Experiment Runner', data: { experimentId: 'exp-replacement', status: 'RUNNING' } }) },
      generationPlanning: { plan: async ({ assetId, name }) => ({ provider: 'EXTERNAL', isMock: false, label: 'Generation Planner', data: { planId: 'plan-external', assetId, name, status: 'PLANNED', generationExecuted: false } }) },
      release: { publish: async () => ({ provider: 'EXTERNAL', isMock: false, label: 'Release Service', data: { releaseId: 'release-replacement', status: 'CANARY' } }) }
    }

    expect((await createLocalEvolutionServices(() => state, { trace: replacements.trace }).trace.getTrace('trace-external')).provider).toBe('EXTERNAL')
    expect((await createLocalEvolutionServices(() => state, { evaluation: replacements.evaluation }).evaluation.run('case-ppt-management', 'PROCESS')).label).toBe('Eval Agent')
    expect((await createLocalEvolutionServices(() => state, { experiment: replacements.experiment }).experiment.start('exp-replacement')).data.status).toBe('RUNNING')
    expect((await createLocalEvolutionServices(() => state, { generationPlanning: replacements.generationPlanning }).generationPlanning.plan({ assetId: 'asset-user-template', name: '计划' })).provider).toBe('EXTERNAL')
    expect((await createLocalEvolutionServices(() => state, { release: replacements.release }).release.publish('release-replacement')).data.status).toBe('CANARY')
  })

  it('replaces one provider without replacing the other local providers', async () => {
    const trace = { getTrace: async (traceId: string) => ({ provider: 'EXTERNAL' as const, isMock: false, label: 'Custom Trace', data: { trace: { ...state.traces[0], id: traceId }, observations: [], evidence: [] } }) }
    const services = createLocalEvolutionServices(() => state, { trace })

    expect((await services.trace.getTrace('trace-custom')).label).toBe('Custom Trace')
    expect((await services.evaluation.run('case-ppt-management', 'PROCESS')).provider).toBe('LOCAL_MOCK')
    expect((await services.experiment.start('exp-single-ppt-routing')).provider).toBe('LOCAL_MOCK')
    expect((await services.generationPlanning.plan({ name: '本地计划' })).provider).toBe('LOCAL_MOCK')
    expect((await services.release.publish('release-agent-2-5-0')).provider).toBe('LOCAL_MOCK')
  })
})
