## Purpose

定义 Office Agent 自进化治理平台的统一信息架构、全局数据作用域、可下钻治理总览与不伪造阈值的线上监控体验。

## ADDED Requirements

### Requirement: Ten-destination governance navigation
The platform SHALL provide ten primary destinations named 治理总览, Case / Trace 分析, 评测中心, 归因与问题簇, 能力变体, 实验与准出, 发布版本, 资产与 Skill, 数据集, and 规则配置.

#### Scenario: User opens each destination
- **WHEN** a user selects any primary navigation item
- **THEN** the platform displays that governance workspace without losing compatible global filters

### Requirement: Global scope and contextual navigation
The platform SHALL apply time range, business scenario, Skill, Agent version, environment, and search filters to compatible indicators and lists, SHALL serialize applicable global and page-local filters in the URL, and SHALL preserve those filters across drill-down, back, breadcrumb, and object-ID navigation.

#### Scenario: Drill down with active filters
- **WHEN** a user filters to a Skill and version and opens a chart detail object
- **THEN** the target route retains the filter values and shows data from the same scope

#### Scenario: Reload a filtered deep link
- **WHEN** a user reloads a URL containing supported global and local filters plus an object ID
- **THEN** the platform restores both the filtered list and the requested object detail without flicker or filter loss

### Requirement: Governance quality and issue overview
The overview SHALL expose Case volume, result effectiveness, process evaluation performance, Badcase count and distribution, and Reason, Memory, Skill, and Act issue distributions using explicit denominators and clickable detail sets.

#### Scenario: Open a Badcase distribution
- **WHEN** a user selects the Badcase indicator
- **THEN** the platform shows only Cases that meet the declared Badcase rule and allows each Case to be opened with the current scope preserved

### Requirement: Raw performance and interception monitoring
The overview SHALL show total latency and TTFT average plus applicable P50/P90/P95, input and output Token totals, cache hits and rate, model and Tool calls, per-Tool frequency, Tool one-shot success, Loop and Retry, risk interception, commercial interception, and normalized interception reason distributions. It SHALL show raw observations and 「基线待配置」 when an expected-latency or cost baseline is unavailable, rather than infer an efficiency judgment.

#### Scenario: Baseline has not been configured
- **WHEN** raw latency or cost observations exist but the matching baseline is absent
- **THEN** the platform displays raw values and 「基线待配置」 and does not display a fabricated pass/fail conclusion

#### Scenario: User opens an interception reason
- **WHEN** a user selects a risk or commercial interception reason
- **THEN** the platform opens the related Case/Trace set with that reason and existing scope represented in the target context

### Requirement: Typed self-evolution funnel
The overview SHALL display 线上 Case → 完成评测 → 确认问题 → 直接修复/问题簇 → 能力变体 → 单变体实验 → 窗口组合实验 → 准出/拒绝/人工复核, SHALL label every stage as Case, 问题, 变体, 实验, or 决策, and SHALL NOT calculate conversion percentages across different units.

#### Scenario: Open a funnel stage
- **WHEN** a user selects any funnel stage
- **THEN** the platform displays the exact entity IDs counted by that stage and lets the user open each entity on its owning page

### Requirement: Explicit non-production boundary and resilient states
Every governance workspace SHALL identify the data as local Mock/demo data and SHALL provide clear states for empty sets, missing evaluations, missing observations, unavailable rules, and unrun experiments.

#### Scenario: A filtered scope is empty
- **WHEN** no records match the current filter scope
- **THEN** the platform displays an explicit empty state and does not treat missing records as PASS
