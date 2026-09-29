## 1. Baseline and canonical data foundation

- [x] 1.1 Preserve the existing Vite/React/TypeScript/Tailwind stack, add the ten governance routes and legacy-route redirects, and verify router integration tests enumerate all ten destinations and preserve legacy context.
- [x] 1.2 Define the complete `EvolutionState` entity graph for Session through Release Version, Rule, and Audit Event, and verify TypeScript plus relationship tests cover every required entity type.
- [x] 1.3 Implement a schema-versioned LocalStorage Repository, Store, selectors, reset/recovery, and audit events, and verify repository round-trip, corruption recovery, and reducer audit tests pass.
- [x] 1.4 Implement concrete typed local service adapters for Trace/Eval/experiment/generation-planning/release ports (not interfaces alone), clearly label Mock provider output, and verify adapter contract tests can replace each provider independently.
- [x] 1.5 Strengthen graph validation for exact Window/combination/release membership, processing-chain destinations, reciprocal links, and truthful baseline releases, then repair the seed and verify deliberate mismatches report exact paths.
- [x] 1.6 Add a true provider unmount/remount test that creates an Issue and Eval revision, reloads from the same repository, and verifies records plus audit/revision history survive.

## 2. Filter, route, and universal lineage consistency

- [x] 2.1 Provide global time, Agent version, business, environment, search, and visible Skill controls and verify they scope Evolution Case data without flicker.
- [x] 2.2 Separate global, Case-local, and detail URL codecs; support repeated routing labels; remove competing parse/serialize ownership; and verify reload, Back, breadcrumb, and sequential changes retain every active value.
- [x] 2.3 Extend Case query matching to declared IDs and user text while preserving the dedicated Session/Trace/Skill/Log fields, and verify representative partial matches and no-result behavior.
- [x] 2.4 Replace every displayed internal entity ID with the shared typed link in Case rows/details, Eval Evidence, Issue/Cluster, Variant, Experiment runs/reports, Release rollback/lineage, Skill evolution, and Dataset contexts; verify keyboard and route tests for each kind.
- [x] 2.5 Ensure overview distribution and all downstream drill-down paths use context navigation rather than raw query strings, and verify current scope remains in Case, Issue, Variant, Experiment, Decision, and Release destinations.

## 3. Governance overview and online monitoring

- [x] 3.1 Implement a typed evolution funnel whose stages expose exact IDs and Case/Issue/Variant/Experiment/Decision units, and verify no cross-unit conversion rate is calculated.
- [x] 3.2 Correct Case-level result effectiveness, process performance, and Badcase selectors so unique Case denominators and explicit failed/confirmed rules are used; add PASS, FAIL, missing-Eval, and resolved-success seed coverage and verify exact numerator/denominator sets.
- [x] 3.3 Derive Reason/Memory/Skill/Act issue distributions and latency/TTFT percentiles, Token/cache/model/Tool/Loop/Retry signals, Tool frequency/one-shot success, and risk/commercial reason distributions from scoped entities; verify selector values against deterministic telemetry.
- [x] 3.4 Make quality, module, Tool, latency/TTFT, risk, and commercial indicators open exact scoped Case/Trace detail sets while preserving filters; verify each drill-down list matches the IDs counted.
- [x] 3.5 Display raw latency/cost signals with `基线待配置` when no threshold exists, and verify the UI does not infer an efficiency verdict.

## 4. Case, Session, Trace, and evaluation governance

- [x] 4.1 Build the unified Case filter bar for query, Session, Trace, Skill ID/version, time, process/outcome Eval, Log, multiple routing labels, and multi-scenario status, and verify filter combinations in model/component tests.
- [x] 4.2 Render authoritative ordered Session turns with each turn's exact Trace link and verify the four-turn management-PPT Session from source data.
- [x] 4.3 Add an in-detail Trace selector for multi-Trace Cases, keep deep-linked Trace/Observation/Evidence selection exact, and verify switching Traces updates the timeline and URL without losing Case context.
- [x] 4.4 Render Trace nodes, failure/root meaning, Evidence and Log detail plus Artifact-to-process navigation, and verify a failed node opens the matching Log/Evidence.
- [x] 4.5 Keep process and outcome Eval lists/details independent with version, time, verdict/score, reason, Evidence, and append-only human revisions; verify automatic history is not overwritten.
- [x] 4.6 Make Eval Evidence IDs and Rubric/Observation/Log references open their actual source objects, replace placeholder Rubric copy with linked recorded data or an explicit unavailable state, and verify cross-navigation from both Eval types.
- [x] 4.7 Let users select which attribution to revise in a multi-attribution Case, use the required taxonomy rather than unrestricted dimensions, and verify only the chosen attribution receives the appended revision.
- [x] 4.8 Persist Case human confirmation and attribution notes through Store actions with audit entries, and verify close/reopen behavior in component/integration tests.

## 5. Attribution, issue clusters, and capability variants

- [x] 5.1 Model the required Memory, Skill, Reason, Act, and pending prior-context taxonomies plus non-exclusive strategy/Agent/phase-two routes, and verify domain constants and multi-route seed data.
- [x] 5.2 Complete the new-Issue form with editable description, explicit Evidence selection, full responsibility/lifecycle fields, independent destinations, and phase-two route state; verify one Case can create multiple differently configured Issues.
- [x] 5.3 Support direct fixes and Case/Issue cluster membership changes with reciprocal Store links, and verify the deterministic Tool direct-fix and multi-attribution journeys.
- [x] 5.4 Derive and display the taste-library count by qualifying confirmed Case and Skill ID, enforce 100 only for that rule, show other thresholds as `待配置`, and verify both 37/100 blocking and no-implicit-100 behavior.
- [x] 5.5 Complete Variant creation inputs for change type/content/current/candidate versions and validate cluster eligibility; verify the new Variant atomically appears on source Issues and Cluster with copied Evidence.
- [x] 5.6 Expand Variant detail to show creation time, current status, source Issue/Case/Cluster, clickable Evidence, and associated Experiments; verify provenance remains unchanged after lifecycle updates.

## 6. Datasets and rules

- [x] 6.1 Seed attribution, generalization, regression, and Window-online Dataset versions with explicit local/external population reconciliation, source, scope, time range, and frozen state; verify counts reconcile.
- [x] 6.2 Implement create/edit-member/version/freeze Dataset actions and UI, prohibit mutation of frozen versions, and verify later edits create a new version while old Experiment snapshots remain unchanged.
- [x] 6.3 Provide editable trigger, experiment, and Gate rules with configured/pending states and verify unknown business thresholds remain `待配置`.
- [x] 6.4 Add monitoring baseline rules and make new Experiment creation consume the configured repeat rule instead of hardcoded three; verify a rule change affects only new config snapshots.

## 7. Experiment lifecycle and Gate reports

- [x] 7.1 Store single-Variant and Window-combination Experiment models, paired Baseline/Candidate runs, dataset/config snapshots, categorized metric means/variability, and separate Gate Decisions; verify graph and report snapshot invariants.
- [x] 7.2 Expand Experiment creation so users choose Variant/Window membership, Dataset versions, model, Tool permissions, timeout, environment, and repeat count; verify all selections are frozen and shared by both arms.
- [x] 7.3 Implement observable QUEUED/RUNNING/COMPLETED/FAILED local Mock run transitions and retry-safe run generation, and verify the lifecycle rather than only immediate completion.
- [x] 7.4 Source combination membership exactly from the selected Window, require a PASS single report for every included Variant, repair W35 seed mismatch, and verify invalid creation and run actions are rejected.
- [x] 7.5 Complete Experiment detail with exact Window membership, applicable source single reports only, linked failed Cases, rollback items, risks, and all paired runs; verify values match the frozen entity graph.
- [x] 7.6 Complete Gate report detail with structured config, Dataset versions, Baseline/Candidate means and variability, failed Cases, rollback items, risks, Evidence links, decision basis/reason/actor/time, and verify PASS/REJECT/MANUAL_REVIEW reports.
- [x] 7.7 Keep all metric gates PENDING while threshold rules are pending and require explicit HUMAN_REVIEW for PASS, verified by invariant and UI tests.

## 8. Releases, Skills, and Assets

- [x] 8.1 Support PENDING, CANARY, RELEASED, OBSERVING, and ROLLED_BACK Release status plus valid rollback target/reason, and verify Release state stays separate from Gate conclusion.
- [x] 8.2 Make Release detail show exact Window, Variant membership, combination and single reports, Gate, approver/time, rollback link, and reverse Issue/Cluster/Case lineage; repair baseline releases that claim unrelated provenance and verify every Release's lineage.
- [x] 8.3 List Skills and Assets and enforce private Asset upload plus sanitization, review, and explicit publication safeguards; verify premature publication is rejected.
- [x] 8.4 Provide a private planned personal-Skill flow from an Asset without claiming generation occurred, and verify `PLANNED`/`待建设` state.
- [x] 8.5 Make Skill evolution and Asset/Skill relationship IDs operable and show full type/version/ownership/progress data in details; verify forward and reverse navigation.

## 9. End-to-end acceptance and delivery

- [x] 9.1 Seed the management-PPT clustered evolution path, deterministic Tool direct-fix path, and multi-attribution/multi-route path, and verify their core forward references with data tests.
- [x] 9.2 Add a browser test that traverses the complete management-PPT path Case → Evidence → Issue/Cluster → Variant → single report → Window report → Gate → Release and reverses to the source Case with filters preserved.
- [x] 9.3 Add browser workflows for Case confirmation, Issue creation, cluster membership, Variant creation, Dataset version/freeze, Experiment run/decision, Release update/rollback, Asset publication, and remount persistence; verify each state change remains after reload.
- [x] 9.4 Run the complete unit/component/integration suite, TypeScript lint, production build, and all ten route responsive overflow/text checks at desktop, tablet, and mobile, and capture fresh successful output before completion.
- [x] 9.5 Re-run strict OpenSpec validation and a requirement-by-requirement completion audit after all unchecked tasks pass; update this checklist only from current source/test/browser evidence and document startup, Mock/real boundaries, and pending PRD rules.
