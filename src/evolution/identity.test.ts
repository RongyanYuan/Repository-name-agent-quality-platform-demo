import { describe, expect, it } from 'vitest'
import { createInitialEvolutionData } from './data'
import { aliasesForIdentity, canonicalizeIdentitySearch, canonicalizeIdentityState, resolveIdentity } from './identity'
import { validateEvolutionState } from './data/validation'

describe('typed Session / Trace identity', () => {
  it('publishes stable distinct numeric seed identities and resolves their legacy names', () => {
    const first = createInitialEvolutionData()
    const second = createInitialEvolutionData()
    expect(first.traces.map(trace => trace.id)).toEqual(second.traces.map(trace => trace.id))
    expect([...first.sessions, ...first.traces].every(record => /^\d{18,24}$/.test(record.id))).toBe(true)
    expect(new Set([...first.sessions, ...first.traces].map(record => record.id)).size).toBe(first.sessions.length + first.traces.length)
    const traceId = resolveIdentity(first, 'trace', 'trace-ppt-generate')
    expect(first.traces.find(trace => trace.id === traceId)?.caseId).toBe('case-ppt-management')
    expect(aliasesForIdentity(first, 'trace', traceId)).toContain('trace-ppt-generate')
    expect(resolveIdentity(first, 'session', 'session-ppt-management')).toBe(first.cases[0].sessionId)
  })

  it('keeps last digits and leading zeroes of explicit numeric identities distinct', () => {
    const state = createInitialEvolutionData()
    const trace = state.traces[0]
    state.traces = ['900719925474099201', '900719925474099202', '000719925474099201'].map(id => ({ ...trace, id }))
    state.identityAliases = []
    const migrated = canonicalizeIdentityState(state)
    expect(migrated.traces.map(item => item.id)).toEqual(['900719925474099201', '900719925474099202', '000719925474099201'])
    expect(resolveIdentity(migrated, 'trace', '000719925474099201')).toBe('000719925474099201')
  })

  it('rewrites typed live references while keeping snapshots and free evidence byte-equivalent', () => {
    const state = createInitialEvolutionData()
    const canonical = resolveIdentity(state, 'trace', 'trace-ppt-generate')
    const session = resolveIdentity(state, 'session', 'session-ppt-management')
    const legacy = structuredClone(state)
    legacy.traces.find(trace => trace.id === canonical)!.id = 'trace-ppt-generate'
    legacy.traces.find(trace => trace.id === 'trace-ppt-generate')!.sessionId = 'session-ppt-management'
    legacy.sessions.find(item => item.id === session)!.id = 'session-ppt-management'
    legacy.sessions.find(item => item.id === 'session-ppt-management')!.traceIds = ['trace-ppt-generate']
    legacy.sessions.find(item => item.id === 'session-ppt-management')!.turns[0].traceId = 'trace-ppt-generate'
    legacy.cases[0].traceIds = ['trace-ppt-generate']
    legacy.cases[0].sessionId = 'session-ppt-management'
    legacy.observations[0].traceId = 'trace-ppt-generate'
    legacy.evidence[0].traceId = 'trace-ppt-generate'
    legacy.evidence[0].content = 'Literal trace-ppt-generate and session-ppt-management stay historical.'
    legacy.artifacts[0].traceId = 'trace-ppt-generate'
    legacy.processEvals[0].traceId = 'trace-ppt-generate'
    legacy.outcomeEvals[0].traceId = 'trace-ppt-generate'
    legacy.attributions[0].traceId = 'trace-ppt-generate'
    legacy.tracePackages[0].traceId = 'trace-ppt-generate'
    legacy.tracePackages[0].sessionId = 'session-ppt-management'
    legacy.tracePackages[0].moduleScores[0].traceId = 'trace-ppt-generate'
    legacy.evaluationBatches[0].traceIds = ['trace-ppt-generate']
    legacy.evaluationJobs[0].traceIds = ['trace-ppt-generate']
    legacy.evaluationJobs[0].processedTraceIds = ['trace-ppt-generate']
    legacy.evaluationJobs[0].failedTraceIds = ['trace-ppt-generate']
    legacy.evaluationJobs[0].configurationSnapshot = { traceId: 'trace-ppt-generate', sessionId: 'session-ppt-management', nested: { traceIds: ['trace-ppt-generate'] } }
    legacy.evaluationFindings[0].traceId = 'trace-ppt-generate'
    legacy.evaluationFindings[0].sessionId = 'session-ppt-management'
    legacy.routingDecisions[0].traceId = 'trace-ppt-generate'
    legacy.routingDeliveries[0].traceId = 'trace-ppt-generate'
    legacy.algorithmBadcases[0].traceId = 'trace-ppt-generate'
    legacy.skills.find(skill => skill.planningSources?.length)!.planningSources![0].conversationTraceIds = ['trace-ppt-generate']
    const snapshots = JSON.stringify({ experiments: legacy.experiments, runs: legacy.experimentRuns, decisions: legacy.gateDecisions })
    const migrated = canonicalizeIdentityState(legacy)
    expect(migrated.cases[0]).toMatchObject({ sessionId: session, traceIds: [canonical] })
    expect(migrated.sessions.find(item => item.id === session)).toMatchObject({ traceIds: [canonical], turns: [expect.objectContaining({ traceId: canonical }), ...migrated.sessions.find(item => item.id === session)!.turns.slice(1)] })
    for (const key of ['observations', 'evidence', 'artifacts', 'processEvals', 'outcomeEvals', 'attributions', 'tracePackages', 'evaluationFindings', 'routingDecisions', 'routingDeliveries', 'algorithmBadcases'] as const) expect(migrated[key][0].traceId, key).toBe(canonical)
    expect(migrated.tracePackages[0].moduleScores[0].traceId).toBe(canonical)
    expect(migrated.tracePackages[0].sessionId).toBe(session)
    expect(migrated.evaluationJobs[0]).toMatchObject({ traceIds: [canonical], processedTraceIds: [canonical], failedTraceIds: [canonical] })
    expect(migrated.evaluationJobs[0].configurationSnapshot).toEqual(legacy.evaluationJobs[0].configurationSnapshot)
    expect(migrated.evaluationBatches[0].traceIds).toEqual([canonical])
    expect(migrated.skills.find(skill => skill.planningSources?.length)!.planningSources![0].conversationTraceIds).toEqual([canonical])
    expect(migrated.evidence[0].content).toBe(legacy.evidence[0].content)
    expect(JSON.stringify({ experiments: migrated.experiments, runs: migrated.experimentRuns, decisions: migrated.gateDecisions })).toBe(snapshots)
    expect(canonicalizeIdentityState(migrated)).toEqual(migrated)
    expect(legacy.traces.some(trace => trace.id === 'trace-ppt-generate')).toBe(true)
  })

  it('rejects conflicting aliases without mutating the source state', () => {
    const state = createInitialEvolutionData()
    state.identityAliases = [
      { kind: 'trace', alias: 'legacy', canonicalId: state.traces[0].id },
      { kind: 'trace', alias: 'legacy', canonicalId: state.traces[1].id }
    ]
    const before = JSON.stringify(state)
    expect(() => canonicalizeIdentityState(state)).toThrow(/legacy.*冲突|冲突.*legacy/)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('keeps unknown custom textual records and namespaces typed aliases', () => {
    const state = createInitialEvolutionData()
    state.traces.push({ ...state.traces[0], id: 'my-custom-trace' })
    state.traces.push({ ...state.traces[0], id: 'trace-v2-user-created' })
    state.identityAliases = [
      ...(state.identityAliases ?? []),
      { kind: 'trace', alias: 'shared-old-id', canonicalId: state.traces[0].id },
      { kind: 'session', alias: 'shared-old-id', canonicalId: state.sessions[0].id }
    ]
    const migrated = canonicalizeIdentityState(state)
    expect(migrated.traces.some(trace => trace.id === 'my-custom-trace')).toBe(true)
    expect(migrated.traces.some(trace => trace.id === 'trace-v2-user-created')).toBe(true)
    expect(resolveIdentity(migrated, 'trace', 'shared-old-id')).toBe(state.traces[0].id)
    expect(resolveIdentity(migrated, 'session', 'shared-old-id')).toBe(state.sessions[0].id)
  })

  it('rejects an alias that shadows another existing canonical record', () => {
    const state = createInitialEvolutionData()
    state.identityAliases = [{ kind: 'trace', alias: state.traces[0].id, canonicalId: state.traces[1].id }]
    expect(() => canonicalizeIdentityState(state)).toThrow(/冲突/)
  })

  it('validates Session turns, module score references and frozen old aliases without rewriting snapshots', () => {
    const valid = createInitialEvolutionData()
    expect(validateEvolutionState(valid)).toEqual([])
    const invalid = structuredClone(valid)
    invalid.sessions[0].turns[0].traceId = 'missing-turn-trace'
    invalid.tracePackages[0].moduleScores[0].traceId = 'missing-module-trace'
    expect(validateEvolutionState(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('turns'), message: expect.stringContaining('missing-turn-trace') }),
      expect.objectContaining({ path: expect.stringContaining('moduleScores'), message: expect.stringContaining('missing-module-trace') })
    ]))
  })

  it('canonicalizes URL identities and nested local return addresses while retaining filters and paths', () => {
    const state = createInitialEvolutionData()
    const secondReturn = '/datasets?datasetId=dataset-attribution&page=3&tab=members'
    const returnTo = `/cases?traceId=trace-tool-export&skillVersion=all&returnTo=${encodeURIComponent(secondReturn)}`
    const query = new URLSearchParams({ traceId: 'trace-ppt-generate', sessionId: 'session-ppt-management', traceSet: 'trace-ppt-context,trace-tool-export', caseSet: 'case-ppt-management,case-tool-export', attribution: 'Skill', returnTo })
    const normalized = new URLSearchParams(canonicalizeIdentitySearch(state, `?${query}`))
    expect(normalized.get('traceId')).toBe(resolveIdentity(state, 'trace', 'trace-ppt-generate'))
    expect(normalized.get('sessionId')).toBe(resolveIdentity(state, 'session', 'session-ppt-management'))
    expect(normalized.get('traceSet')).toBe([resolveIdentity(state, 'trace', 'trace-ppt-context'), resolveIdentity(state, 'trace', 'trace-tool-export')].join(','))
    expect(normalized.get('caseSet')).toBe('case-ppt-management,case-tool-export')
    expect(normalized.get('attribution')).toBe('Skill')
    const returned = new URL(normalized.get('returnTo')!, 'https://local.example')
    expect(returned.pathname).toBe('/cases')
    expect(returned.searchParams.get('traceId')).toBe(resolveIdentity(state, 'trace', 'trace-tool-export'))
    expect(returned.searchParams.get('skillVersion')).toBe('all')
    expect(returned.searchParams.get('returnTo')).toBe(secondReturn)
    expect(canonicalizeIdentitySearch(state, canonicalizeIdentitySearch(state, `?${query}`))).toBe(canonicalizeIdentitySearch(state, `?${query}`))
  })

  it('keeps unrelated and external return URLs byte-equivalent and resolves local path IDs', () => {
    const state = createInitialEvolutionData()
    const unrelated = '?q=a%20b&page=2'
    expect(canonicalizeIdentitySearch(state, unrelated)).toBe(unrelated)
    const external = 'https://example.org/cases?traceId=trace-ppt-generate'
    const params = new URLSearchParams({ returnTo: external })
    expect(new URLSearchParams(canonicalizeIdentitySearch(state, `?${params}`)).get('returnTo')).toBe(external)
    const local = new URLSearchParams({ returnTo: '/traces/trace-ppt-generate?caseTab=governance#module-1' })
    expect(new URLSearchParams(canonicalizeIdentitySearch(state, `?${local}`)).get('returnTo')).toBe(`/traces/${resolveIdentity(state, 'trace', 'trace-ppt-generate')}?caseTab=governance#module-1`)
  })
})
