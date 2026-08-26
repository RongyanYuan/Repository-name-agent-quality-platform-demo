# Agent Observability v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct module diagnostics semantics, add collapsible homepage child metrics, and ship a dedicated anomaly-monitoring page for raw latency, streaming, token, cost, Tool and interception signals.

**Architecture:** Reuse the existing typed `QualityData`, selectors, Tailwind panels and navigation context. Add a selector dedicated to module state counts rather than percentages, keep the homepage as the composite quality view, and add `/anomaly-monitoring` as a separate route that consumes the existing performance selector. Preserve global filters and Task/Trace drill-down URLs.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Module diagnostic state counts

**Files:**
- Modify: `src/selectors.ts` module diagnostic types and `getModuleDiagnostics`
- Modify: `src/qualityPages.tsx` `ModuleDiagnosticCard` and Overview module section
- Test: `src/homeDashboard.test.tsx`, `src/eval-v3.test.ts`

- [x] Add a failing selector test asserting each module exposes PASS/FAIL/DERIVED_FAIL/UNKNOWN/N/A counts, first-failure count, derived count and evidence coverage, with no `percent` used as the primary value.
- [x] Run `./node_modules/.bin/vitest run src/eval-v3.test.ts` and confirm the new selector contract fails.
- [x] Implement `ModuleDiagnosticSummary` in `src/selectors.ts`; derive observations from filtered tasks, count explicit Judge states, count first non-derived failures through `getFirstFailureAttribution`, count derived failures separately, and calculate evidence coverage as observed nodes with local evidence divided by observed nodes.
- [x] Update `ModuleDiagnosticCard` to show a state distribution row and labels `首错`, `派生`, `Evidence 覆盖`; remove the percentage headline and keep the card click drill-down.
- [x] Add tests proving task-001 Memory is a root failure, Context is derived, and a module with no calls is N/A rather than 100% failure.
- [x] Run the focused tests and then `./node_modules/.bin/vitest run`.

### Task 2: Collapsible homepage child metrics

**Files:**
- Modify: `src/qualityPages.tsx` Overview section state and SectionHeader actions
- Modify: `src/ui.tsx` shared icon-button tooltip/title behavior if needed
- Test: `src/homeDashboard.test.tsx`

- [x] Add a failing Testing Library test that finds `合格产物` and `过程效率` child-metric toggle buttons with `aria-expanded="true"`, clicks each, and verifies child cards disappear while the total card remains.
- [x] Implement independent `useState` flags in `OverviewPage`, using `IconButton` with `ChevronDown`/`ChevronUp`, `aria-expanded`, `aria-controls`, and a descriptive `title`.
- [x] Wrap each child metric grid in a stable container with an id; keep totals, trends, denominator copy and drill-down handlers mounted in both states.
- [x] Add mobile-safe `min-w-0` and flex wrapping to the SectionHeader action area.
- [x] Run `./node_modules/.bin/vitest run src/homeDashboard.test.tsx` and the full unit suite.

### Task 3: Dedicated anomaly-monitoring page

**Files:**
- Create: `src/anomalyMonitoringPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/layout.tsx`
- Modify: `src/selectors.ts` only where anomaly-specific source grouping is missing
- Test: `src/anomalyMonitoring.test.tsx`

- [x] Add a failing page test asserting the new page renders four sections: 响应与流式、Token/缓存/成本、调用与一次执行、商业化与风控, and shows `UNKNOWN / 基线未建立` for missing TTFT or cost baseline.
- [x] Add `/anomaly-monitoring` to `ROUTE_PATHS`, `pageSlots`, and the router; add a navigation item with an alert/activity icon and preserve all existing routes.
- [x] Implement the page with reusable KPI cards and compact trend lines. Use `getPerformanceMetrics(state, state.filters)` for latency bands, TTFT, throughput, token totals, cache hit, Tool frequency, one-shot success, cost denominator, risk and commercial events.
- [x] Render response ratios using the four business bands; show ratio and status separately, never infer missing baselines as PASS/FAIL.
- [x] Render Input/Output Token and raw Model/Tool/Retry/Loop counts. Show cost deviation only when successful/qualified products have a baseline; otherwise show `UNKNOWN`.
- [x] Render normalized reason distributions for risk and commercial blocks. Each card/reason button navigates to `/tasks` with `metric`, interception type and existing global filters.
- [x] Add a focused test for one-shot success excluding retry/recovery and for risk/commercial drill-down URL payloads.

### Task 4: Navigation and responsive coverage

**Files:**
- Modify: `e2e/visual-layout.spec.ts`
- Modify: `e2e/quality-flow.spec.ts`
- Modify: `src/layout.tsx` responsive nav labels if necessary

- [x] Extend route list to include `/anomaly-monitoring` and assert the page is non-blank at 1440x900, 1024x900 and 390x844.
- [x] Add a smoke step from anomaly KPI to Task / Trace and verify the URL retains the anomaly metric.
- [x] Add assertions that collapsed homepage sections remain usable at 390px and no page-level overflow occurs; permit table-local horizontal scrolling.
- [x] Run `CI=1 pnpm run test:e2e`.

### Task 5: Documentation and final verification

**Files:**
- Modify: `README.md`

- [x] Document the module diagnostic semantics, collapsible child metrics, anomaly-monitoring route and all UNKNOWN/baseline rules.
- [x] Run `CI=1 pnpm run lint`, `CI=1 pnpm run build`, `CI=1 pnpm test`, and `CI=1 pnpm run test:e2e`.
- [x] Start the local Vite demo on port 4174 and inspect all eight routes for visible headings, working navigation and no text overlap.
