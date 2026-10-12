## Purpose

让治理平台在列表、详情、筛选器和跳转过程中使用一致的中文对象名、状态名和来源名，并通过可测试的人类阅读路径降低跨页面理解成本。

## ADDED Requirements

### Requirement: Normalized governance terminology
The UI SHALL use a single normalized vocabulary for Case sources, Skill categories, optimization modes, routing labels, evaluation states and lifecycle states. It SHALL use “生产 Skill”“品味 Skill”“线上+时间窗口”“黄金测试集”“mock集”“直接优化”“聚类优化”“策略迭代”“Agent 迭代”“待配置”“未复核”“派生失败” consistently across tables, cards, drawers, filters and breadcrumbs.

#### Scenario: Render the same status in list and detail
- **WHEN** a Variant is `SINGLE_PASSED` and a Case source is `MOCK_SET`
- **THEN** the list, detail, filter summary and breadcrumb use the same normalized Chinese labels and retain the stable ID separately

### Requirement: Restorable navigation context
Cross-page navigation SHALL preserve global filters, page-local filters and the originating object context. Back, breadcrumb, close and return-to-list actions SHALL restore the user’s prior query, time range, environment, version, category and selected object where applicable.

#### Scenario: Return from Evidence to filtered Case list
- **WHEN** a user opens a Trace Evidence drawer from a filtered Case list and then closes or uses Back
- **THEN** the Case list restores the same filters and selected page position without dropping the source context

#### Scenario: Navigate from Variant to Experiment and back
- **WHEN** a user opens a Variant’s experiment and returns to the Variant workbench
- **THEN** the same Skill Section, Skill row, window filter and Variant detail remain selected

### Requirement: Human reading path acceptance
The platform SHALL provide automated or manual acceptance coverage for the following paths: Case → full Trace → Evidence → Finding → Delivery → Issue/Cluster → Variant → Experiment/Gate/Release; Taste Skill → related-data trigger → single-variant experiment; Production Skill → Badcase → strategy iteration → algorithm queue. The path SHALL remain understandable when data is empty, an evaluation is missing, a threshold is pending or a Case has multiple attributions.

#### Scenario: Follow the complete Office governance path
- **WHEN** a reviewer starts from the management-PPT Case and follows the primary actions
- **THEN** every step has a semantic title/action, the next object is identifiable, and the reviewer can return to the original Case with filters intact

#### Scenario: Read an empty or pending state
- **WHEN** a Section has no Variant, a Skill has no experiment, or a threshold is not configured
- **THEN** the UI displays a specific empty/pending explanation and an available next action instead of a blank panel or ambiguous “UNKNOWN” link

### Requirement: Accessible semantic controls
Primary actions and secondary links SHALL expose descriptive accessible names, distinguish buttons from navigation links, and remain operable at desktop, tablet and mobile widths without clipped headings or horizontal page overflow.

#### Scenario: Use Case and Variant controls without visual context
- **WHEN** a user navigates by keyboard or assistive technology
- **THEN** actions announce “查看完整 Case”“查看 Session 对话”“查看 Trace 执行” and Section expand/collapse state, while stable IDs remain available as secondary labels
