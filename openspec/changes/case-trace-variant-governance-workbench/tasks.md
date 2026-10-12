## 1. Case / Trace 入口与数据契约

- [x] 1.1 Add normalized Case source mapping and display labels for `ONLINE_WINDOW`, `GOLDEN_DATASET`, and `MOCK_SET`, preserving discovery method separately; verify source-label unit tests cover legacy and new Cases.
- [x] 1.2 Add CaseAnalysis model fields for source label, active-Trace evaluation package, Finding scenarios, and governance destinations; verify legacy Case filters and object IDs remain URL-compatible.
- [x] 1.3 Replace the Query row’s stacked bare IDs with a primary “查看完整 Case” action and semantic Session/Trace/Evidence/Log actions; verify Testing Library accessibility names and row click behavior.
- [x] 1.4 Make Case detail default to “Trace 与 Evidence” when a Trace exists and show source, complete Trace, evaluation summaries, Judge Reason, Root Evidence, Rubric, Observation/Log and governance links; verify the management-PPT Case renders the full composition.
- [x] 1.5 Synchronize selected Trace across timeline, module matrix, Findings, Evidence and scenario cards; verify a multi-Trace Case switches from `trace-ppt-context` to `trace-ppt-generate` without stale scores.

## 2. Evidence, Finding and navigation semantics

- [x] 2.1 Update Finding/Evidence navigation to use semantic object labels and route Finding links to Routing Delivery/Issue context; verify every displayed ID is operable or explicitly marked unavailable.
- [x] 2.2 Preserve global filters, Case-local filters, selected Trace and page position across Case → Evidence → Finding/Delivery → Case return navigation; verify URL round-trip tests for Back, Close and Breadcrumb.
- [x] 2.3 Normalize Case source, discovery method, evaluation state, optimization mode and routing terminology in shared label maps; verify the same labels appear in list, detail, filters and breadcrumbs.

## 3. Unified Variant workbench

- [x] 3.1 Add selectors that aggregate Skill rows from Skill, Variant, Window, Experiment, Gate and Release relationships without duplicating lifecycle entities; verify rows include version, status, updated time, owner, source count, window and release state.
- [x] 3.2 Refactor `/variants` into collapsible “品味 Skill”“生产 Skill”“其他能力” Sections with one Skill row and expandable Variant rows; verify taste and production fixtures appear in their correct Sections.
- [x] 3.3 Add unified Variant lifecycle detail showing source Case/Finding/Issue/Cluster, Evidence, version diff, single experiment, window experiment, Gate and Release/rollback links; verify a released production Variant and red-preference Variant are fully traceable.
- [x] 3.4 Centralize Variant creation in the workbench with source Issue/Cluster prefill and direct-vs-cluster validation; verify Attribution/Issue/Asset pages navigate to the workbench instead of duplicating creation flows.
- [x] 3.5 Link Assets/Skills evolution records to filtered Variant workbench views and remove duplicate lifecycle controls; verify Skill → Variant → Experiment navigation preserves filters.

## 4. Human reading path and responsive UX

- [x] 4.1 Add behavior tests for Case → full Trace → Evidence → Finding → Delivery → Issue/Cluster → Variant → Experiment/Gate/Release, taste trigger → single experiment, and production Badcase → strategy iteration → algorithm queue.
- [x] 4.2 Add explicit empty/pending/unknown states for missing evaluations, no variants, unconfigured thresholds and no experiment; verify no blank or ambiguous object links remain.
- [x] 4.3 Run `pnpm test`, `pnpm run lint`, `pnpm run build`, `PW_REUSE_SERVER=1 pnpm test:e2e`, and `openspec validate --changes --strict`; verify desktop/tablet/mobile no-overflow checks and the complete test suite pass.
