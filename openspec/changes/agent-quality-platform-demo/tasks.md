## 1. Project Foundation

- [x] 1.1 Scaffold the Vite React + TypeScript application in the empty repository and verify the generated entry files and `npm run build` complete successfully
- [x] 1.2 Add Tailwind CSS, semantic color tokens, Lucide icons, Recharts, React Router, Vitest, Testing Library and Playwright dependencies/scripts, and verify dependency installation plus TypeScript configuration succeed
- [x] 1.3 Create the router and fixed Dashboard shell with routes for Overview, Performance, Task/Trace, Case & Badcase, Golden Dataset, Benchmark and Evaluation Configuration, and verify every route renders a non-empty page shell

## 2. Domain Model, Fixtures and State

- [x] 2.1 Define shared TypeScript domain types and enums for Task, Trace, Observation, EvalResult, Case, Dataset, DatasetEntry, BenchmarkRun, BenchmarkCaseResult, EvalConfig and FilterState, and verify type-checking catches invalid status or reference values
- [x] 2.2 Build deterministic Mock Data with at least 24 tasks covering PPT, Excel, Word, Coding and General, all three complexities, Effective/Effective but Inefficient/Failed states, two Agent Versions, required root causes and tool latency anomalies, and verify fixture counts and required field coverage with a data integrity test
- [x] 2.3 Add the required sales-Excel-to-management-PPT example with Memory as the first failure, Context as a derived failure, linked Evidence and Observation records, and verify a fixture test resolves the exact Task → Trace → root-cause chain
- [x] 2.4 Implement selectors for scoped task lists, outcome/process/performance metrics, first-failure root-cause aggregation, tool rolling baselines, Case views, Dataset membership and Benchmark deltas, and verify every aggregate returns source IDs for drill-down
- [x] 2.5 Implement the `QualityStore` reducer/context and actions for filters, human Eval overrides, Badcase review, Dataset changes and Benchmark runs, and verify reducer tests preserve automatic labels while applying auditable human changes
- [x] 2.6 Implement URL search-param serialization for global/local filters, deep-link task/trace/case/benchmark context and Back/Breadcrumb restoration, and verify a round-trip test restores all filter values and selected IDs

## 3. Shared UI and Visualization Primitives

- [x] 3.1 Establish the desktop-first typography, spacing, border, status-color and focus tokens in Tailwind/CSS and verify the shell has no gradient/orb decoration and passes contrast checks for PASS, FAIL, Warning and Derived states
- [x] 3.2 Build reusable StatusBadge, MetricCard, DataTable, FilterBar, Tabs, Breadcrumb, EmptyState, Drawer, Modal and form-control components, and verify component tests cover keyboard focus, empty data and close/back behavior
- [x] 3.3 Build accessible clickable bar, trend and distribution chart components with text/table summaries and stable dimensions, and verify a chart click emits the expected metric, time-window or root-cause drill-down payload
- [x] 3.4 Build the shared TraceTimeline, ObservationDetails and ABTraceComparison primitives with ordered nodes, Root Cause/First Failure/Derived markers, evidence links and added/removed stage markers, and verify component fixtures render the required Memory → Context failure chain

## 4. Quality Overview and Performance Monitoring

- [x] 4.1 Implement the Quality Overview page with seven outcome KPI cards, distinct process metrics and Root Cause distribution sections, and verify all values and pass/fail counts derive from the active global scope
- [x] 4.2 Add Overview process visualization switching, business/version/complexity filters and KPI/process/root-cause drill-down navigation, and verify clicks open the expected failed Task or Case filters while retaining global context
- [x] 4.3 Implement Performance Monitoring Task Performance, Tool Performance and Model Performance sections with percentile, cost, token, call, loop and retry values, and verify each section refreshes from the shared selectors when filters change
- [x] 4.4 Implement Tool rolling-baseline deviation warnings, anomaly data-point Drawer details and View All Anomalous Traces navigation, and verify a seeded P95 breach opens the correct time-window/tool-filtered Task list
- [x] 4.5 Add responsive overflow and loading/empty/error states for Overview and Performance tables/charts, and verify layouts at 1440px, 1024px and a narrow viewport do not overlap text or controls

## 5. Task / Trace Workbench

- [x] 5.1 Implement the Task / Trace list with required identifiers, outcome/status/root-cause/performance columns, pagination or continuous browsing, search and all specified filters, and verify combined filters return only intersecting records
- [x] 5.2 Implement Task detail identity, query, delivered result, Result Eval five-dimension panel and separate result/process/performance sections, and verify PASS/FAIL states and Auto Eval provenance match the selected fixture
- [x] 5.3 Connect each Eval result to Evidence/Observation IDs and implement the Observation Details Drawer for input/output/metadata/error/model/token/tool/eval fields, and verify missing evidence renders an explicit unavailable state
- [x] 5.4 Integrate TraceTimeline into Task detail with ordered Task Understanding, Planning, Memory, Context, Skill, Tool, Loop/Retry and Final Outcome nodes, and verify first-failure/derived attribution is not duplicated
- [x] 5.5 Implement human Result Eval Override editing with operator, note, timestamp and disagreement display, and verify an automatic FAIL → human PASS action preserves both values and updates the effective label
- [x] 5.6 Implement Task-level Badcase editing (dimension, first node, root cause, derived flag, severity, owner, note), Confirm/Resolve actions and Add to Dataset entry flow, and verify the seeded Memory case updates Task, Case and Dataset links together
- [x] 5.7 Add Task/Trace list-to-detail-to-list Back and Breadcrumb integration tests covering KPI and performance deep links, and verify search, local filters and list position are restored

## 6. Case and Golden Dataset Governance

- [x] 6.1 Implement Case & Badcase tabs for All, Candidate, Confirmed and Resolved with Case Source, failure, root-cause, severity and owner filters, and verify each tab and filter returns the expected seeded cases
- [x] 6.2 Implement Case review forms showing Auto Eval vs Human Label, required-field validation, disagreement state, severity/owner/note editing and Confirm/Resolve transitions, and verify invalid saves do not discard unsaved values
- [x] 6.3 Implement Golden Dataset list/detail views with Golden/Historical/Challenge types, explicit expected outcome/constraint/label fields, capability tags, source Trace and version metadata, and verify incomplete Golden entries cannot be enabled
- [x] 6.4 Implement Dataset create/edit, bulk selection, enable/disable, duplicate prevention and entry history, and verify disabled entries remain auditable but are excluded from a newly launched Benchmark
- [x] 6.5 Connect Case/Task/Dataset navigation and context restoration, and verify returning from a Dataset entry restores the originating filtered Case or Task view

## 7. Benchmark and Regression

- [x] 7.1 Implement Benchmark creation with Dataset, Version A/B, Environment and Eval Rubric selections plus queued/running/completed mock status, and verify incomplete selections keep Run Benchmark disabled
- [x] 7.2 Implement deterministic Benchmark execution from enabled Dataset entries and generate separate result/process/performance metric deltas, and verify a completed run records immutable inputs and source counts
- [x] 7.3 Implement Improved, Regressed, Unchanged Failed and Newly Failed Case result tabs with counts and metric-row breakdown links, and verify seeded A/B fixtures land in the correct category
- [x] 7.4 Implement the A/B Trace comparison view aligned by stage with status, latency, model/tool call changes, evidence links and Added/Removed markers, and verify opening a Regressed Case highlights the changed stage
- [x] 7.5 Implement Benchmark history and result-to-Case/Task navigation with dataset/version/category context restoration, and verify reopening a completed historical run does not rerun or mutate it

## 8. Evaluation Configuration

- [x] 8.1 Implement separate Result Eval, Process Eval and Performance Metric configuration sections with all specified dimensions, Eval Type, Rubric Version, Enabled state and Pass Threshold fields, and verify no combined total score replaces the three families
- [x] 8.2 Add Process Eval Prompt, Evidence Requirement and Judge Version details plus enable/disable and active-summary behavior, and verify disabled rules are excluded while historical metadata remains visible
- [x] 8.3 Implement configuration version list/comparison, Benchmark rubric references, active-rule validation and View Exceptions links, and verify incomplete or duplicate active rules are blocked with actionable feedback

## 9. Integration, Verification and Handoff

- [x] 9.1 Add unit tests for fixture integrity, selectors, first-failure attribution, reducer actions, URL state and Benchmark classification, and verify the full unit test command passes
- [x] 9.2 Add React interaction tests for global filtering, KPI drill-down, Trace evidence, human override, Badcase confirmation, Dataset inclusion and configuration validation, and verify all critical action paths pass
- [x] 9.3 Add a Playwright smoke flow covering Metric → Task/Trace → Eval Evidence → human Override → Badcase → Golden Dataset → Benchmark → Regression A/B Trace, and verify the flow works from a fresh app load
- [x] 9.4 Run lint, type-check, production build and OpenSpec-required test commands, and verify there are no errors or warnings that prevent delivery
- [x] 9.5 Start the local development server, inspect the seven pages at desktop and narrow widths, and verify the final Demo is non-blank, clickable and documented with the run command in the project README
