# Office Agent Eval v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the complete Agent Quality Platform Demo to reflect the new Office Agent evaluation PRD, with a prominent homepage north star, separate quality/efficiency sections, five-state evaluation evidence, and no visual text overlap.

**Architecture:** Preserve the existing seven-route React dashboard and shared `QualityStore`, extending its typed domain model and selectors instead of creating a second application. The homepage will derive four independent sections from one normalized task/trace/event dataset; downstream Task, Case, Dataset, Benchmark and Performance views will consume the same selectors and URL context.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts, Lucide, Vitest, Testing Library, Playwright.

---

### Task 1: Extend the domain contract and fixture events

**Files:**
- Modify: `src/domain.ts`
- Modify: `src/data.ts`
- Modify: `src/domain.test.ts`
- Create: `src/eval-v2.test.ts`

- [ ] **Step 1: Add the new typed states and fields**

Add `UNKNOWN`, `N/A`, and `DERIVED_FAIL` to evaluation state handling without removing the existing `PASS` and `FAIL` display values. Add typed structures for `ProductAcceptanceEvent`, `ProductValidity`, `ProcessEfficiency`, `RootCauseAttribution`, `RiskCommercialEvent`, rubric evidence, and local evaluation score. Keep an explicit compatibility alias for the old `Result Usability` field so existing routes can resolve it to `File Validity`.

- [ ] **Step 2: Add deterministic acceptance and validity fixtures**

Extend `src/data.ts` with download/copy/like/accept/dislike/correction/regeneration/new-requirement events, a product-validity record for every seeded product, expected latency where available, input/output token counts, cache hits, tool one-shot success, risk/commercial blocks, and the required `task-001` evidence (`query_requirement`, `memory_value`, `final_output_audience`). Keep at least 24 tasks and all existing business/complexity/version coverage.

- [ ] **Step 3: Write failing integrity tests**

In `src/eval-v2.test.ts`, assert that the acceptance event types are present, the north-star denominator can be computed from all products, `task-001` has Memory as the only first failure and Context as `DERIVED_FAIL`, every Judge result has a score in `[0, 1]`, and missing TTFT/expected latency is represented as `UNKNOWN` rather than inferred PASS.

- [ ] **Step 4: Run the focused test**

Run: `./node_modules/.bin/vitest run src/eval-v2.test.ts`

Expected: FAIL because the new types, events, and selectors are not implemented yet.

- [ ] **Step 5: Implement the minimum model and fixture changes**

Implement the structures and fixtures from Steps 1–2. Preserve stable IDs and existing fixture links; do not change the existing seven-route shape.

- [ ] **Step 6: Run the focused test again**

Run: `./node_modules/.bin/vitest run src/eval-v2.test.ts`

Expected: PASS.

### Task 2: Rebuild selectors and shared store behavior

**Files:**
- Modify: `src/selectors.ts`
- Modify: `src/store.tsx`
- Modify: `src/store.test.ts`
- Modify: `src/domain.test.ts`

- [ ] **Step 1: Add selector tests for the new homepage metrics**

Test `getUserSatisfactionMetrics`, `getQualifiedProductMetrics`, `getProcessEfficiencyMetrics`, `getInefficientExpectedRate`, `getModuleDiagnostics`, and `getRootCauseMetrics` against the seeded dataset. Assert that the inefficient-expected rate uses all products as its denominator, Context/Memory are diagnostic-only, and source IDs are returned for every aggregate.

- [ ] **Step 2: Implement the selector formulas**

Implement the north-star formula `acceptedQualifiedProducts / allProducts`, qualified-product multiplication across the five quality dimensions, independent process-efficiency scoring, and `processEfficiencyOutOfExpectationRate = productsNotMeetingProcessExpectation / allProducts`. Map Medium raw complexity into the Complex homepage band while preserving its detail value. Expose a `metricDimensionMap` for old and new drill-down IDs.

- [ ] **Step 3: Implement five-state first-failure attribution**

Derive Root Cause from the first non-derived failing observation; retain downstream failures as `DERIVED_FAIL` with `derivedFrom`, and never count them again in the root-cause aggregate. Return local evidence references and `isRootCause` for the observation-level view.

- [ ] **Step 4: Extend reducer actions**

Add actions for acceptance-event review, product-validity override, process-efficiency review, and rubric configuration updates while preserving existing human Eval, Case, Dataset and Benchmark actions. Every override must retain the automatic value, operator, reason, score and timestamp.

- [ ] **Step 5: Run unit tests**

Run: `./node_modules/.bin/vitest run src/domain.test.ts src/eval-v2.test.ts src/store.test.ts`

Expected: PASS.

### Task 3: Recompose the homepage dashboard sections

**Files:**
- Modify: `src/qualityPages.tsx`
- Modify: `src/styles.css`
- Create: `src/homeDashboard.test.tsx`

- [ ] **Step 1: Add homepage interaction tests**

Test that the homepage renders four independent sections in order, that each total and child metric has a trend visualization, that the north-star card is visually labeled separately, that the inefficient-expected card is inside Process Efficiency, and that clicking a metric navigates to `/tasks` with a failure/metric filter.

- [ ] **Step 2: Replace the current KPI grid**

Render a prominent `用户满意度` section with acceptance-signal cards and a line chart; render a `合格产物` section with `合格产物率` total and five child metrics; render a `过程效率` section with `过程效率达标率`, process child metrics, and `过程效率不符业务预期率` using Warning styling; render a lower `模块诊断` section with five-state counts and root-cause distribution.

- [ ] **Step 3: Keep every section interactive**

Use the existing MetricCard/TrendChart/BarChart primitives. Every total, child metric, acceptance signal and root-cause item must navigate to the existing Task or Case route with the current global filters preserved. Do not create a new metrics route.

- [ ] **Step 4: Remove misleading old labels**

Replace homepage display text `结果可用性` with `文件有效性`; remove Context/Memory as formal process KPI cards; rename `有效但低效任务率` to `过程效率不符业务预期率`; keep old IDs as compatibility aliases in selectors/URLs.

- [ ] **Step 5: Run homepage tests and build**

Run: `./node_modules/.bin/vitest run src/homeDashboard.test.tsx` and `./node_modules/.bin/vite build`

Expected: PASS with no syntax errors.

### Task 4: Synchronize Task/Trace, Case, Dataset, Benchmark and configuration pages

**Files:**
- Modify: `src/qualityPages.tsx`
- Modify: `src/governancePages.tsx`
- Modify: `src/trace.tsx`
- Modify: `src/App.tsx`
- Create: `src/eval-config-v2.test.tsx`

- [ ] **Step 1: Extend Task/Trace details**

Show five-state Judge status, score, rubric evidence, local input/output evidence, `is_root_cause`, `derived_from`, product validity, acceptance events, correction vs new-requirement classification, and explicit UNKNOWN/N/A fields. Keep Auto Eval vs Human Override visible.

- [ ] **Step 2: Update Case and Dataset governance**

Use first-failure attribution for Case root cause, expose user behavior evidence, add File Validity and Golden Label fields to Dataset entries, and preserve source Trace/version history. Ensure duplicate and disabled-entry rules remain functional.

- [ ] **Step 3: Update Benchmark and A/B Trace views**

Keep result/process/performance groups independent, mark cost evaluation as success-only, carry rubric version and source IDs, and show five-state/derived differences in A/B Trace comparison.

- [ ] **Step 4: Update evaluation configuration**

Add Decision Hard/Soft Gate, Skill/Tool selection rules, Tool Result and one-shot-success rules, five-state Judge fields, TTFT/latency/cost/risk configuration, and a visible “not a standalone KPI” treatment for Context and Memory.

- [ ] **Step 5: Add configuration interaction tests**

Test enabling/disabling a rule, opening rubric evidence, blocking an incomplete Process Eval rule, and navigating View Exceptions with the selected metric filter.

- [ ] **Step 6: Run page-level tests**

Run: `./node_modules/.bin/vitest run src/eval-config-v2.test.tsx`

Expected: PASS.

### Task 5: Expand performance and risk monitoring

**Files:**
- Modify: `src/qualityPages.tsx`
- Modify: `src/selectors.ts`
- Modify: `src/data.ts`
- Create: `src/performance-v2.test.tsx`

- [ ] **Step 1: Add performance selector tests**

Assert total latency efficiency bands (`<=1`, `1–1.5`, `1.5–2`, `>2`), TTFT UNKNOWN handling, throughput, input/output token cost deviation, cache hits, Tool frequency, one-shot success excluding retry/recovery, and risk/commercial block rates/reasons.

- [ ] **Step 2: Implement performance selectors and data**

Derive the new metrics from raw fixture events and display “baseline not established” where the PRD defers a threshold. Apply cost evaluation only to successful products. Preserve existing P50/P90/P95 and rolling baseline panels as secondary compatibility views.

- [ ] **Step 3: Add the performance/risk sections**

Render the new metrics on the existing Performance page with independent cards, trend lines, warning bands, Tool frequency/one-shot success table, and risk/commercial reason distributions. Link every anomaly to Task/Trace.

- [ ] **Step 4: Run focused tests**

Run: `./node_modules/.bin/vitest run src/performance-v2.test.tsx`

Expected: PASS.

### Task 6: Visual QA, responsive checks and end-to-end handoff

**Files:**
- Modify: `src/styles.css`
- Modify: `e2e/quality-flow.spec.ts`
- Create: `e2e/visual-layout.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add visual layout assertions**

Use Playwright to load Overview, Performance, Tasks, Cases, Datasets, Benchmarks and Evaluation Config at 1440×900, 1024×900 and 390×844. Assert no horizontal overflow in the main shell, no intersecting bounding boxes for headings/buttons/cards, and visible text for the new section names.

- [ ] **Step 2: Add the full v2 smoke path**

Cover homepage north-star click, qualified-product child metric click, process-efficiency diagnostic click, Task evidence, five-state/derived marker, Case override, Dataset add, Benchmark run, Regression bucket and A/B Trace details.

- [ ] **Step 3: Fix all overflow and text-fit issues**

Use stable grid tracks, `min-width`, responsive stacking, line clamping and horizontal table scrolling. Do not reduce text into unreadable sizes or hide required labels.

- [ ] **Step 4: Run the complete verification suite**

Run: `CI=1 pnpm run lint`, `CI=1 pnpm test`, `CI=1 pnpm run build`, `CI=1 pnpm test:e2e`

Expected: all commands exit 0; only documented non-blocking bundle-size warnings may remain.

- [ ] **Step 5: Start the demo and document the URL**

Run: `./node_modules/.bin/vite --host 127.0.0.1 --port 4174`

Verify the final URL responds and update `README.md` with the run command, homepage section hierarchy, and the fact that the demo uses local Mock Data only.
