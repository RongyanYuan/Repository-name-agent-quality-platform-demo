## 1. Domain and Mock Data

- [x] 1.1 Extend `src/domain.ts` with five-state Judge status, ProductAcceptanceEvent, ProductValidity, ProcessEfficiency, RootCauseAttribution, RiskCommercialEvent and rubric evidence types, and verify `tsc --noEmit` passes
- [x] 1.2 Extend `src/data.ts` with acceptance events, validity/efficiency fields, expected latency, TTFT/cache/token/tool/risk signals and task-001 evidence, and verify at least 24 tasks and all required event types with a fixture test
- [x] 1.3 Add five-state local attribution and score/evidence fixtures, and verify Memory is the only first failure while Context is DERIVED_FAIL and missing data is UNKNOWN/N/A

## 2. Selectors and Shared State

- [x] 2.1 Implement selectors for user satisfaction, qualified product rate, process efficiency target rate and process-efficiency-out-of-expectation rate, and verify the latter uses all products as denominator
- [x] 2.2 Update root-cause, metric alias and drill-down selectors so first non-derived failures are counted once and old Result Usability/metric IDs remain resolvable, and verify source IDs are returned
- [x] 2.3 Implement performance selectors for latency efficiency bands, TTFT UNKNOWN, throughput, token/cost deviation, cache hits, Tool frequency, one-shot success, risk and commercial blocks, and verify success-only cost behavior
- [x] 2.4 Extend `QualityStore` actions/reducer for acceptance events, product validity, process efficiency and five-state overrides while retaining automatic values, operator, reason, score and timestamp; verify reducer tests

## 3. Homepage Dashboard

- [x] 3.1 Replace the flat Overview KPI grid with independent User Satisfaction, Qualified Product, Process Efficiency and Module Diagnostics sections, and verify section order and headings in a component test
- [x] 3.2 Add KPI cards and trend lines for each total and child metric, place `过程效率不符业务预期率` inside Process Efficiency with Warning treatment and all-products denominator, and verify its rendered label and value
- [x] 3.3 Add satisfaction signal cards and acceptance/negative-feedback drill-downs, and verify clicks preserve global filters and open Task / Trace
- [x] 3.4 Add module five-state counts and first-failure/root-cause visualization, and verify derived failures are visible but not double-counted
- [x] 3.5 Ensure homepage child metrics, trends and root-cause items navigate to existing Task/Case routes without creating a metrics-only page, and verify URL filter payloads

## 4. Task, Trace and Governance Pages

- [x] 4.1 Update Task / Trace detail to show five-state Judge status, score, Rubric Evidence, product validity and acceptance/correction events with explicit UNKNOWN/N/A, and verify task-001 evidence
- [x] 4.2 Update `src/trace.tsx` to render `DERIVED_FAIL`, `derived_from`, `is_root_cause` and local evidence without inferring status from final outcome, and verify the Memory → Context chain
- [x] 4.3 Update Case/Dataset views for first-failure root cause, user behavior evidence, File Validity, Golden Label and source history, and verify Case/Dataset actions remain functional
- [x] 4.4 Update Benchmark/A-B Trace and evaluation configuration for separated result/process/performance groups, success-only cost, Decision gates, Tool/Skill/Tool Result rules and five-state fields, and verify configuration validation

## 5. Performance and Risk Views

- [x] 5.1 Add Total Latency Efficiency, TTFT, throughput, input/output token, cache and cost panels to the existing Performance page, and verify missing baseline values display UNKNOWN/未建立
- [x] 5.2 Add Tool frequency/one-shot success and Risk/Commercial interception sections with trend lines and reason distributions, and verify anomaly links open filtered Task / Trace
- [x] 5.3 Retain legacy P50/P90/P95, rolling baselines and model details as secondary compatibility views, and verify old routes and labels continue to resolve

## 6. Verification and Delivery

- [x] 6.1 Add unit and Testing Library coverage for fixtures, selectors, reducer, homepage sections, five-state Evidence, configuration validation and all-products denominator, and verify `CI=1 pnpm test` passes
- [x] 6.2 Add/extend Playwright smoke coverage for homepage north star → Task/Trace → Evidence → Case → Dataset → Benchmark → A/B Trace and verify every step changes visible state without runtime errors
- [x] 6.3 Add Playwright visual checks at 1440x900, 1024x900 and 390x844 for no horizontal overflow, no intersecting key bounding boxes and visible new section labels, and verify the report passes
- [x] 6.4 Run `CI=1 pnpm run lint`, `CI=1 pnpm run build`, `CI=1 pnpm test:e2e`, inspect the complete site in the local browser and verify all seven routes are non-blank and text is not misaligned
- [x] 6.5 Update `README.md` with the new homepage hierarchy, metric definitions, local Mock Data boundary and start command, and verify a fresh user can launch the complete website Demo
