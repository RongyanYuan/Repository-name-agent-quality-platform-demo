import { initialEvolutionData } from '../src/evolution/data'
import { resolveIdentity } from '../src/evolution/identity'

/** Tests enter through legacy bookmarks and expect the same canonical identity as the seeded app. */
export const traceIdentity = (alias: string) => resolveIdentity(initialEvolutionData, 'trace', alias)
