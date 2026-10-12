## Purpose

把品味 Skill、生产 Skill 和其他能力的变体治理收敛到一个可读、可筛选、可反查的工作台，完整呈现从来源问题到实验窗口、准出和发布的能力生命周期。

## ADDED Requirements

### Requirement: Skill-category sections and Skill rows
The unified Variant workbench SHALL contain independent collapsible Sections named “品味 Skill”, “生产 Skill” and “其他能力”. Each Skill SHALL be represented as a row rather than an unexplained flat Variant item. A row SHALL show Skill ID/name, category, current version, candidate version or candidate count, current status, last updated time, owner or responsible team, source problem/cluster count, experiment window, Gate/Release state and the relevant routing path.

#### Scenario: Read a Taste Skill row
- **WHEN** a user opens the Variant workbench with no narrow filter
- **THEN** the “品味 Skill” Section shows the Skill row, current/candidate versions, status, last update, preference/related-data progress, single-variant experiment, window experiment and release state

#### Scenario: Read a Production Skill row
- **WHEN** a Production Skill has algorithm Badcase findings
- **THEN** the “生产 Skill” Section shows its Badcase count, “策略迭代 → 算法 Badcase” path, source Finding/Issue/Cluster links, candidate status and experiment state

### Requirement: Unified Variant lifecycle detail
Opening a Skill row or Variant SHALL show one lifecycle view ordered as: source Case/Finding → Issue/Issue Cluster or direct fix → change content and version diff → single-variant experiment → window combination experiment → Gate decision → Release. The view SHALL preserve immutable source IDs, Evidence IDs, timestamps and historical versions.

#### Scenario: Trace a released Production Variant
- **WHEN** a user opens a released production Variant
- **THEN** the detail shows its source Cases, Findings, Issues/Clusters, Root Evidence, single report, window report, Gate conclusion, Release version and rollback reference

#### Scenario: Create a Variant from the unified workbench
- **WHEN** a user starts Variant creation from an eligible Issue/Cluster
- **THEN** the workbench pre-fills the source, validates direct-vs-cluster optimization rules, persists the Variant provenance and returns to the same Section/row without creating a duplicate lifecycle implementation elsewhere

### Requirement: Taste preference and trigger semantics
The workbench SHALL distinguish user-preference aggregation from the Skill-scoped 100-related-data trigger. A preference signal MAY show 1000 users with 950 preferring “红色”, but that ratio SHALL NOT be treated as a Gate threshold or as proof that the other 50 users are Badcases. The 100-related-data rule SHALL remain the only configured taste-library trigger.

#### Scenario: Show the red preference signal
- **WHEN** a Taste Skill has the structured red-preference signal
- **THEN** the row/detail displays 1000 total users, 950 red-preference users, the source and Judge Reason, and separately displays the related-data count such as 120/100

#### Scenario: Block an under-threshold taste Variant
- **WHEN** a taste Issue Cluster has fewer than 100 qualifying related records
- **THEN** the workbench shows the exact count and counting rule and disables Variant creation; other unspecified thresholds remain “待配置”

### Requirement: Centralize Skill and Asset navigation
Assets/Skills SHALL link to the unified Variant workbench for evolution records and SHALL NOT duplicate Variant creation, experiment lifecycle or release lineage. Attribution/Issue pages SHALL navigate to the workbench with source Issue/Cluster parameters rather than opening a second creation flow.

#### Scenario: Navigate from a Skill detail
- **WHEN** a user clicks a Skill’s evolution record from Assets/Skills
- **THEN** the unified Variant workbench opens filtered to that Skill/category and preserves the previous global filters
