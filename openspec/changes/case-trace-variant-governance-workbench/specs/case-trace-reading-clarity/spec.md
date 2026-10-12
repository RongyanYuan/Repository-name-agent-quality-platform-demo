## Purpose

让治理人员从 Case 列表进入一个可读、可复查的完整任务上下文，在同一处理解 Trace、过程/产物评测、Evidence、来源和后续治理去向。

## ADDED Requirements

### Requirement: Semantic Case entry from Query rows
Case / Trace 分析列表 SHALL present Query as the primary content and SHALL provide a clearly named primary action such as “查看完整 Case”. Case ID、Session、Trace、Evidence 和 Log SHALL be secondary semantic links with visible labels that explain their destination; the row SHALL NOT rely on a stack of unexplained bare IDs.

#### Scenario: Open a Case from the main Query action
- **WHEN** a user clicks “查看完整 Case” on a Query row
- **THEN** the Case detail opens directly and defaults to “Trace 与 Evidence” when an associated Trace exists

#### Scenario: Use a secondary Session or Trace link
- **WHEN** a user clicks “查看 Session 对话” or “查看 Trace 执行”
- **THEN** the owning Case opens with the requested Session or Trace context selected, while the previous list filters remain restorable

### Requirement: Complete Case detail composition
Case detail SHALL expose the user task, unified Case source, Session summary, all related Traces, the selected Trace timeline, module evaluation matrix, independent Process Eval and Outcome/产物 Eval, LLM Judge Reason, Root Evidence, Rubric Rule, Observation/Log, Findings, Routing Delivery, Issue/Cluster, Variant, Experiment, Gate and Release links.

#### Scenario: Inspect a failed Office Case
- **WHEN** a user opens the management-PPT Case
- **THEN** the detail shows the complete Trace, failed module status, Judge Reason, Root Evidence + Rubric, related artifact evaluation and the next governance objects without leaving the Case context

#### Scenario: Show missing evaluation data honestly
- **WHEN** a Case has no Process Eval, Outcome Eval or Evidence Bundle
- **THEN** the corresponding panel displays “未评测”“UNKNOWN”“N/A” or “暂无根证据” with a clear explanation and never infers PASS from the missing record

### Requirement: Active Trace synchronization
When a Case contains multiple Traces, selecting another Trace SHALL update the active Trace timeline, module scores, Findings, Evidence, Observation/Log details, Judge Reason and scenario/path cards to the selected Trace. Context Assembly SHALL remain evidence-only and SHALL NOT become an independent module KPI.

#### Scenario: Switch from context Trace to generation Trace
- **WHEN** a user switches the management-PPT Case from `trace-ppt-context` to `trace-ppt-generate`
- **THEN** the matrix and Evidence panel show the selected Trace’s Memory/Skill/Outcome results rather than continuing to show the previous Trace’s results

### Requirement: Unified Case source vocabulary
Every Case SHALL expose one normalized source label from exactly: “线上+时间窗口”, “黄金测试集”, or “mock集”. Source label SHALL be independent from discovery method, which MAY be Auto Eval, User Feedback, System Error or Manual Review.

#### Scenario: Display a Mock Case source
- **WHEN** a Case originates from structured demonstration data
- **THEN** the Case list and Case detail show “mock集” and do not call it “线上数据”

#### Scenario: Display a Golden Dataset source
- **WHEN** a Case comes from a frozen Golden Dataset
- **THEN** the Case list and Case detail show “黄金测试集” and retain the Dataset ID/version as a secondary link

### Requirement: Evidence and lineage navigation
All displayed governance IDs SHALL be operable semantic links or explicitly marked unavailable. A Finding link SHALL open its Finding/Delivery context; Issue, Cluster, Variant, Experiment, Gate and Release links SHALL open their owning detail and preserve the source Case/filter context for return.

#### Scenario: Follow a Finding to a Variant
- **WHEN** a user follows a Finding from the Case Eval panel
- **THEN** the governance page shows the Finding’s Routing Delivery and provides links to its Issue/Cluster/Variant, with a return path to the source Case and Trace
