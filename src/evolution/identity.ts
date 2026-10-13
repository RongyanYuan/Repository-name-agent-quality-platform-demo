import type { EvolutionState } from './domain'

export type IdentityKind = 'trace' | 'session'

export interface IdentityAlias {
  kind: IdentityKind
  alias: string
  canonicalId: string
}

type IdentityState = EvolutionState

const NUMERIC_ID = /^\d{18,24}$/
const clone = <T,>(value: T): T => structuredClone(value)

const seedIdentities: Record<IdentityKind, Set<string>> = { trace: new Set(), session: new Set() }

function numericId(kind: IdentityKind, legacy: string): string {
  // Stable text hashing stays in BigInt throughout. No Number conversion means
  // IDs beyond MAX_SAFE_INTEGER remain exact and stable.
  let hash = 14695981039346656037n
  const input = `${kind}:${legacy}`
  for (const char of input) {
    hash ^= BigInt(char.codePointAt(0) ?? 0)
    hash = (hash * 1099511628211n) % 90000000000000000000n
  }
  // Each kind has a separate namespace and the 20-digit body is fixed width.
  return `${kind === 'session' ? '10' : '20'}${hash.toString().padStart(20, '0')}`
}

function aliasesByKind(state: IdentityState): Map<IdentityKind, Map<string, string>> {
  const result = new Map<IdentityKind, Map<string, string>>([
    ['trace', new Map<string, string>()],
    ['session', new Map<string, string>()]
  ])
  for (const alias of state.identityAliases ?? []) {
    if (!alias || (alias.kind !== 'trace' && alias.kind !== 'session') || !alias.alias || !alias.canonicalId) continue
    const map = result.get(alias.kind)!
    const existing = map.get(alias.alias)
    if (existing && existing !== alias.canonicalId) throw new Error(`身份 alias 冲突：${alias.kind}:${alias.alias} 指向多个正式 ID`)
    map.set(alias.alias, alias.canonicalId)
  }
  return result
}

function directCanonical(state: IdentityState, kind: IdentityKind, id: string): string {
  const aliases = aliasesByKind(state).get(kind)!
  let current = id
  const seen = new Set<string>()
  while (aliases.has(current)) {
    if (seen.has(current)) throw new Error(`身份 alias 循环：${kind}:${id}`)
    seen.add(current)
    current = aliases.get(current)!
  }
  return current
}

export function resolveIdentity(state: EvolutionState, kind: IdentityKind, id: string): string {
  return directCanonical(state as IdentityState, kind, id)
}

/** Build one immutable index for scans through frozen snapshot references. */
export function createIdentityResolver(state: EvolutionState): (kind: IdentityKind, id: string) => string {
  const aliases = aliasesByKind(state as IdentityState)
  return (kind, id) => {
    const map = aliases.get(kind)!
    let current = id
    const seen = new Set<string>()
    while (map.has(current)) {
      if (seen.has(current)) throw new Error(`身份 alias 循环：${kind}:${id}`)
      seen.add(current)
      current = map.get(current)!
    }
    return current
  }
}

export function aliasesForIdentity(state: EvolutionState, kind: IdentityKind, id: string): string[] {
  const typed = state as IdentityState
  const resolve = createIdentityResolver(typed)
  const canonicalId = resolve(kind, id)
  const aliases = typed.identityAliases ?? []
  return [canonicalId, ...aliases.filter(alias => alias.kind === kind && resolve(kind, alias.alias) === canonicalId).map(alias => alias.alias).filter(alias => alias !== canonicalId)]
}

function rewriteTypedReferences(state: EvolutionState, maps: Record<IdentityKind, Map<string, string>>): EvolutionState {
  const resolve = (kind: IdentityKind, id: string) => maps[kind].get(id) ?? id
  const references = <T extends { traceId?: string; sessionId?: string },>(record: T): T => ({
    ...record,
    ...('traceId' in record && record.traceId !== undefined ? { traceId: resolve('trace', record.traceId) } : {}),
    ...('sessionId' in record && record.sessionId !== undefined ? { sessionId: resolve('session', record.sessionId) } : {})
  })
  const reference = <T extends { kind: string; id: string },>(record: T): T => ({ ...record, id: record.kind === 'trace' || record.kind === 'session' ? resolve(record.kind, record.id) : record.id })
  // Only schema-owned active fields are rewritten. Snapshot/unknown records
  // never pass through this mapper, even if they happen to contain traceId.
  state.sessions = state.sessions.map(session => ({ ...session, id: resolve('session', session.id), traceIds: session.traceIds.map(id => resolve('trace', id)), turns: session.turns.map(references) }))
  state.traces = state.traces.map(trace => ({ ...references(trace), id: resolve('trace', trace.id) }))
  state.cases = state.cases.map(record => ({ ...references(record), traceIds: record.traceIds.map(id => resolve('trace', id)) }))
  state.observations = state.observations?.map(references)
  state.evidence = state.evidence?.map(references)
  state.artifacts = state.artifacts?.map(references)
  state.processEvals = state.processEvals?.map(references)
  state.outcomeEvals = state.outcomeEvals?.map(references)
  state.attributions = state.attributions?.map(references)
  state.tracePackages = state.tracePackages?.map(pkg => ({ ...references(pkg), moduleScores: pkg.moduleScores.map(references) }))
  state.evaluationBatches = state.evaluationBatches?.map(batch => ({ ...batch, traceIds: batch.traceIds.map(id => resolve('trace', id)) }))
  state.evaluationJobs = state.evaluationJobs?.map(job => ({ ...job, traceIds: job.traceIds.map(id => resolve('trace', id)), processedTraceIds: job.processedTraceIds.map(id => resolve('trace', id)), failedTraceIds: job.failedTraceIds.map(id => resolve('trace', id)) }))
  state.evaluationFindings = state.evaluationFindings?.map(references)
  state.routingDecisions = state.routingDecisions?.map(references)
  state.routingDeliveries = state.routingDeliveries?.map(references)
  state.algorithmBadcases = state.algorithmBadcases?.map(references)
  state.moduleReviews = state.moduleReviews?.map(references)
  state.moduleEvolutionBindings = state.moduleEvolutionBindings?.map(references)
  state.datasetMemberships = state.datasetMemberships?.map(membership => ({ ...membership, traceIds: membership.traceIds.map(id => resolve('trace', id)) }))
  state.assetPerformanceRecords = state.assetPerformanceRecords?.map(references)
  state.assetEvolutionContributions = state.assetEvolutionContributions?.map(contribution => ({ ...contribution, traceIds: contribution.traceIds.map(id => resolve('trace', id)) }))
  state.governanceEvents = state.governanceEvents?.map(event => ({ ...references(event), sourceRef: event.sourceRef ? reference(event.sourceRef) : undefined, targetRefs: event.targetRefs.map(reference) }))
  state.skills = state.skills?.map(skill => ({
    ...skill,
    ...(skill.planningSources ? { planningSources: skill.planningSources.map(source => ({ ...source, conversationTraceIds: source.conversationTraceIds.map(id => resolve('trace', id)) })) } : {}),
    ...(skill.evolutionHistory ? { evolutionHistory: skill.evolutionHistory.map(entry => ({ ...entry, ...(entry.referenceId && (entry.referenceKind === 'trace' || entry.referenceKind === 'session') ? { referenceId: resolve(entry.referenceKind, entry.referenceId) } : {}) })) } : {})
  }))
  state.auditTrail = state.auditTrail?.map(event => {
    const kind = event.entityType.toLowerCase()
    return kind === 'trace' || kind === 'session' ? { ...event, entityId: resolve(kind, event.entityId) } : event
  })
  return state
}

/**
 * Canonicalize Mock Session/Trace IDs and their active references. Frozen
 * experiment/report snapshots and free-form Evidence text are left untouched.
 * The input is never mutated; failed alias validation throws before a caller
 * can persist the returned state.
 */
export function canonicalizeIdentityState(state: EvolutionState): EvolutionState {
  const source = state as IdentityState
  const aliases = aliasesByKind(source)
  const maps: Record<IdentityKind, Map<string, string>> = { trace: new Map(), session: new Map() }
  const existing = { trace: new Set(source.traces.map(item => item.id)), session: new Set(source.sessions.map(item => item.id)) }

  for (const kind of ['session', 'trace'] as const) {
    const records = kind === 'session' ? source.sessions : source.traces
    for (const record of [...records].sort((left, right) => left.id.localeCompare(right.id))) {
      const aliasTarget = aliases.get(kind)!.get(record.id)
      const target = aliasTarget ? directCanonical(source, kind, record.id) : (NUMERIC_ID.test(record.id) || !seedIdentities[kind].has(record.id) ? record.id : numericId(kind, record.id))
      if (target !== record.id && existing[kind].has(target)) {
        throw new Error(`身份 alias 冲突：${kind}:${record.id} 指向已有正式 ID ${target}`)
      }
      const prior = [...maps[kind].entries()].find(([, value]) => value === target && value !== record.id)
      if (prior) throw new Error(`身份迁移冲突：${kind}:${record.id} 与 ${prior[0]} 生成相同正式 ID ${target}`)
      maps[kind].set(record.id, target)
    }
    for (const alias of aliases.get(kind)!.keys()) {
      const target = directCanonical(source, kind, alias)
      maps[kind].set(alias, maps[kind].get(target) ?? target)
    }
  }

  const rewritten = rewriteTypedReferences(clone(source), maps)
  const nextAliases = new Map<string, IdentityAlias>()
  for (const kind of ['session', 'trace'] as const) {
    for (const [oldId, canonicalId] of maps[kind]) {
      if (oldId !== canonicalId) nextAliases.set(`${kind}:${oldId}`, { kind, alias: oldId, canonicalId })
    }
  }
  for (const alias of source.identityAliases ?? []) {
    const canonicalId = maps[alias.kind].get(alias.canonicalId) ?? alias.canonicalId
    const next = { ...alias, canonicalId }
    const key = `${next.kind}:${next.alias}`
    const existingAlias = nextAliases.get(key)
    if (existingAlias && existingAlias.canonicalId !== next.canonicalId) throw new Error(`身份 alias 冲突：${next.kind}:${next.alias} 指向多个正式 ID`)
    nextAliases.set(key, next)
  }
  rewritten.identityAliases = [...nextAliases.values()]
  return rewritten as EvolutionState
}

/** Used by the seed builder to retain its legacy names as aliases. */
export function canonicalizeSeedIdentityState(state: EvolutionState): EvolutionState {
  state.sessions.forEach(session => seedIdentities.session.add(session.id))
  state.traces.forEach(trace => seedIdentities.trace.add(trace.id))
  return canonicalizeIdentityState(state)
}

/** Keep a pre-existing numeric identity when adding later Mock fixtures. */
export function alignSeedIdentityState(seed: EvolutionState, current: EvolutionState): EvolutionState {
  const maps: Record<IdentityKind, Map<string, string>> = { trace: new Map(), session: new Map() }
  const resolveCurrent = createIdentityResolver(current)
  for (const kind of ['session', 'trace'] as const) {
    const records = kind === 'session' ? current.sessions : current.traces
    const existing = new Set(records.map(item => item.id))
    for (const alias of seed.identityAliases ?? []) {
      if (alias.kind !== kind) continue
      const target = resolveCurrent(kind, alias.alias)
      if (!existing.has(target)) continue
      const previousTarget = maps[kind].get(alias.canonicalId)
      if (previousTarget && previousTarget !== target) throw new Error(`身份 alias 冲突：${kind}:${alias.alias} 在现有数据中对应不同对象`)
      maps[kind].set(alias.canonicalId, target)
    }
  }
  const result = rewriteTypedReferences(clone(seed), maps)
  result.identityAliases = result.identityAliases?.map(alias => ({ ...alias, canonicalId: maps[alias.kind].get(alias.canonicalId) ?? alias.canonicalId }))
  return result
}

/** Canonical URL identities share the same typed alias resolver as data lookup. */
export function canonicalizeIdentitySearch(state: EvolutionState, search: string): string {
  const resolve = createIdentityResolver(state)
  const normalize = (query: string, depth: number): string => {
    if (!query || depth > 5) return query
    const params = new URLSearchParams(query)
    let changed = false
    const replace = (key: string, value: string) => {
      if (params.get(key) === value) return
      params.set(key, value)
      changed = true
    }
    for (const kind of ['trace', 'session'] as const) {
      const key = `${kind}Id`
      const id = params.get(key)
      if (id) replace(key, resolve(kind, id))
    }
    const traceSet = params.get('traceSet')
    if (traceSet) replace('traceSet', traceSet.split(',').map(id => resolve('trace', id)).join(','))
    const returnTo = params.get('returnTo')
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && depth < 5) {
      const hashIndex = returnTo.indexOf('#')
      const fragment = hashIndex < 0 ? '' : returnTo.slice(hashIndex)
      const address = hashIndex < 0 ? returnTo : returnTo.slice(0, hashIndex)
      const queryIndex = address.indexOf('?')
      let path = queryIndex < 0 ? address : address.slice(0, queryIndex)
      const nestedQuery = queryIndex < 0 ? '' : address.slice(queryIndex)
      const match = path.match(/^\/(traces|sessions|trace-workspace)\/([^/]+)$/)
      if (match) {
        try {
          const kind: IdentityKind = match[1] === 'sessions' ? 'session' : 'trace'
          const id = decodeURIComponent(match[2])
          const canonical = resolve(kind, id)
          if (canonical !== id) path = `/${match[1]}/${encodeURIComponent(canonical)}`
        } catch { /* An undecodable path is retained as supplied. */ }
      }
      replace('returnTo', `${path}${normalize(nestedQuery, depth + 1)}${fragment}`)
    }
    if (!changed) return query
    const normalized = params.toString()
    return normalized ? `?${normalized}` : ''
  }
  return normalize(search, 0)
}
