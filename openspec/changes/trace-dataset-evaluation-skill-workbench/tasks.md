## 1. Domain model and normalized taxonomy

- [x] 1.1 Extend Trace, Case, evaluation, dataset, experiment and Skill Mock entities with Channel, vertical scenario, 0–2 score, cost, provenance label, dataset purpose and gate-status fields; verify type-checking and graph validation pass.
- [x] 1.2 Add the exact 3.1 attribution taxonomy entries and a normalized label selector; verify a taxonomy snapshot test covers every required wording and legacy labels remain readable.
- [x] 1.3 Add seed/schema migration for existing local snapshots and generate balanced online, regression, generalization and Golden Set examples; verify migration preserves human edits and adds new fields.

## 2. Trace filtering and list workbench

- [x] 2.1 Add URL-backed Channel and vertical scenario filters before the existing Trace filters; verify sequential filter changes survive refresh, navigation and Back.
- [x] 2.2 Add 0–2 process/observation and artifact/final score range filters plus exact evolution-item and cost filters for Token and latency; verify selector tests cover combined filters and empty states.
- [x] 2.3 Refactor Trace rows to the Trace → Query → Session → Artifact order with source/dataset tags, process/outcome score summaries, Token, latency, Query time, evaluation/evolution state and artifact download link; verify rendered row and accessibility tests.
- [x] 2.4 Add multi-select checkboxes and bulk action toolbar for importing selected Traces into an evaluation dataset or Golden Set; verify successful persistence, audit events and selection reset.
- [x] 2.5 Add duplicate-membership blocking for Case IDs already in a dataset; verify the UI identifies each blocked Case and does not create duplicate entries.
- [x] 2.6 Simplify Trace detail to Session, Trace evaluation, Artifact evaluation and status overview while keeping Evidence and return-to-filter behavior; verify detail integration tests.

## 3. Unified dataset and evaluation workbench

- [x] 3.1 Merge evaluation and dataset navigation into a unified “数据集与评测” route while preserving legacy redirects and query parameters; verify route integration tests.
- [x] 3.2 Implement Skill + exact evolution-item filters and derive linked evaluation sets, gate sets, experiments and history; verify linked and empty-state selector tests.
- [x] 3.3 Render dataset name, purpose, Skill, evolution item, experiment type, frozen state, time window, evaluation result and 是否准出 as separate fields; verify A/B/C dataset and both experiment-type scenarios.
- [x] 3.4 Add historical evolution timeline with through-time, source Trace, experiment, gate decision and release references; verify object IDs navigate back to owning pages.
- [x] 3.5 Add separate “是否准出” representation independent of experiment and release status; verify pending-decision and human-review scenarios.

## 4. Skill detail pruning and navigation

- [x] 4.1 Refactor Skill detail to identity, versions, update time and unified dataset/evaluation link; verify Skill detail rendering and deep-link tests.
- [x] 4.2 Remove standalone Asset, Issue/Attribution, Experiment/Gate, Variant and Release sections from Skill detail without deleting underlying entities; verify absence assertions and reference navigation.
- [x] 4.3 Normalize page labels, breadcrumbs and legacy links for the merged workbench; verify existing route compatibility tests.

## 5. Verification and delivery

- [x] 5.1 Add end-to-end coverage for Trace filtering, source labels, bulk Golden Set import, duplicate blocking and dataset/evaluation Skill + evolution-item filtering; verify Playwright passes.
- [x] 5.2 Run `pnpm lint`, `pnpm test`, `pnpm build` and `openspec validate --changes --strict`; verify all commands pass and no required artifact or test is missing.
