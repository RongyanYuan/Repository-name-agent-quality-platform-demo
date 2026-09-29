## Context

See `proposal.md` for motivation. The repository is an existing Vite + React 18 + TypeScript + Tailwind application with React Router, reusable dashboard components, legacy QualityStore data, and a new `src/evolution` domain/store/page layer already under active development. The authoritative implementation currently contains the ten target routes, a versioned LocalStorage repository, three connected governance journeys, and broad component/integration/E2E coverage.

The design must therefore finish and reconcile the in-progress redesign rather than replace the stack. Important constraints are: preserve legacy deep links, preserve user work in the dirty tree, keep all business data visibly Mock, do not invent PRD thresholds, and keep process, outcome, performance, experiment decision, and release state separate.

## Goals / Non-Goals

**Goals:**

- Use one typed governance entity graph as the source for all new workspaces and lineage navigation.
- Make every promised workflow operable and persistent, including exact deep links and lifecycle transitions.
- Close semantic gaps that green UI tests do not currently catch: denominators, URL ownership, exact Window membership, report completeness, and release provenance.
- Keep external integrations replaceable while retaining a deterministic local demo.
- Verify behavior at selector/reducer, component, router, remount, and browser levels.

**Non-Goals:**

- Building production Trace/Langfuse, Eval Agent, experiment-runner, generation, or release backends.
- Inferring performance, cost, clustering, or Gate thresholds not supplied by the PRD.
- Automatically publishing private user assets.
- Reintroducing legacy pages as primary navigation destinations.

## Decisions

### 1. Retain the current stack and make `EvolutionState` canonical

All ten governance workspaces will read domain records from `EvolutionState`. Legacy `QualityStore` remains only for compatible global filters and legacy-route adapters until its remaining behavior is either mapped or retired. This avoids a high-risk framework migration and builds on the existing store, repository, selectors, validators, and tests.

Alternative considered: migrate to Next.js or rewrite every legacy component. Rejected because the PRD explicitly says to retain an existing stack, and a rewrite would discard working Trace/UI behavior without improving the demo boundary.

### 2. Define explicit ownership for global, local, and detail URL state

The global filter schema will include only globally scoped fields. Case-local fields will be parsed and serialized by a dedicated Case filter codec that supports repeated routing-label values. Object detail IDs remain separate. Context navigation will merge these layers and clear only irrelevant detail keys. Page state must be derived from the URL on deep link and Back, while user changes update the URL in one direction to avoid races.

Alternative considered: add every local field to the legacy global `FilterState`. Rejected because this couples unrelated pages and has already produced competing URL-to-store and page-local synchronization paths.

### 3. Use stable ID links as the universal lineage affordance

All entity IDs shown in tables, details, reports, Evidence lists, Window membership, and rollback records will use a shared typed ID link. The central route map owns destination paths and detail parameter names. IDs that refer to external unexpanded Mock samples are explicitly labeled unavailable rather than rendered as false links.

Alternative considered: keep row click and plain monospace text. Rejected because it makes provenance ambiguous and fails keyboard accessibility and deep-link expectations.

### 4. Separate current state from immutable revision/report snapshots

Mutable entities hold current lifecycle state, while evaluation revisions, attribution revisions, experiment config snapshots, run records, Gate report snapshots, and audit events remain append-only or immutable. Status updates may change current state but cannot rewrite provenance. Reducers enforce relationship updates in both directions for Issue, Cluster, Variant, Experiment, Window, and Release actions.

Alternative considered: derive old reports from current entities. Rejected because later rule, Dataset, version, or status changes would make historical decisions unreproducible.

### 5. Model experiment execution as an explicit deterministic lifecycle

Local Mock execution will expose transitions from DRAFT/QUEUED to RUNNING and then COMPLETED or FAILED, even when the deterministic runner completes quickly. Creation consumes the configured repeat-count rule and explicit UI selections for datasets and runtime conditions. Each arm uses the same frozen snapshot/config hash. A Window experiment takes its exact membership from the selected Window and validates a passing single Gate for every member.

Alternative considered: immediately synthesize completed results from hardcoded defaults. Rejected because it hides lifecycle behavior, ignores rule configuration, and can diverge from Window membership.

### 6. Treat Gate thresholds as configuration, not Demo inference

Metric gate status remains PENDING while the Gate rule is pending. Reviewers can still record PASS/REJECT/MANUAL_REVIEW using HUMAN_REVIEW and a mandatory reason. Once configured, new reports may record CONFIGURED_THRESHOLD with the evaluated snapshot. The experiment conclusion remains distinct from Release status.

Alternative considered: infer a threshold from seeded metric deltas. Rejected because the PRD prohibits invented thresholds.

### 7. Derive overview values from entity units and expose exact drill-down sets

Case-level rates use unique Case denominators; issue distributions use Issue counts; Variant, Experiment, and Decision funnel stages retain their own units. Badcase is derived from an explicit failed/confirmed rule rather than generic workflow status. Monitoring selectors calculate percentiles and reason distributions from Trace telemetry. Every visual stores or derives the exact IDs it counts, then navigates through the context-preserving route helper.

Alternative considered: reuse Eval-row counts as quality rates. Rejected because a Case can have multiple Eval rows and would be over-weighted.

### 8. Preserve local data safely across schema evolution

The repository continues to wrap state in a schema-versioned envelope, clone at boundaries, validate relationship invariants, recover corrupt/incompatible data with an audit event, and support explicit reset. Schema version must be incremented when new required fields/invariants make old snapshots unsafe. Provider remount tests will prove actual rehydration rather than only inspecting LocalStorage.

Alternative considered: seed on every load. Rejected because it breaks the required local persistence of governance actions.

### 9. Keep integration ports narrow and truthful

Trace, Eval, experiment, generation-planning, and release interactions are represented by typed service ports and local adapters. Pages call services/repository-facing actions rather than importing fixtures as truth. External provider absence is a supported local mode and is always marked Mock.

Alternative considered: stub successful remote calls in page code. Rejected because that would misrepresent unimplemented services as operational.

## Risks / Trade-offs

- **[Dual-store scope can drift]** → Introduce explicit filter codecs and integration tests for global + local + detail parameters before removing compatibility paths.
- **[Existing browser LocalStorage contains an older schema]** → Increment schema when necessary, validate on load, recover to the new Mock seed with a visible audit record, and document reset behavior.
- **[Mock data volume is small for percentiles]** → Label all results as Mock, show exact sample counts, and avoid claims of statistical significance.
- **[Dense desktop UI can overflow at laptop/mobile widths]** → Use responsive grids, scrollable tables/drawers, and automated horizontal-overflow/text-clipping checks on all ten routes.
- **[Direct status mutations can create impossible lineage]** → Route all lifecycle operations through invariant-aware reducers and validate the graph before persistence.
- **[Human PASS while gates are pending can look automatic]** → Display `HUMAN_REVIEW`, PENDING metric gates, reviewer, and reason together in Gate reports.
- **[Seeded legacy releases can imply false provenance]** → Give each release truthful Window/Variant/report relationships or identify it as a baseline without unrelated reverse lineage.

## Migration Plan

1. Freeze current evidence with a full test/build baseline and keep legacy routes covered.
2. Reconcile domain types, seed data, validation invariants, selectors, filter codecs, and repository schema first.
3. Correct overview semantics and Case/Trace/Eval deep-link behavior before downstream mutation workflows.
4. Complete Issue/Cluster/Variant creation fields and atomic links.
5. Complete Dataset/rule lifecycle, then experiment creation/running/reporting, and only then release operations.
6. Make all entity IDs navigable and run end-to-end forward/reverse lineage checks.
7. Run unit, integration, build, all-route responsive browser tests, and an actual persistence remount scenario.

Rollback consists of reverting the new source and routing changes while leaving the prior LocalStorage key untouched; if a schema bump was used, the prior build will ignore or reset incompatible data according to its repository policy. No production backend or user data migration is involved.

## Open Questions

- The production source of expected latency/cost baselines remains undecided; the UI will keep 「基线待配置」 until an interface and values are supplied.
- Non-taste clustering thresholds and automatic Gate thresholds remain undecided and stay configurable/pending.
- The detailed taxonomy for the prior-context module remains 「需求待补充」.
- Production authentication, authorization, and approval identities are outside this local Demo and must be designed before backend rollout.
