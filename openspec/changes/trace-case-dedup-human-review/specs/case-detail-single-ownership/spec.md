## Purpose

为 Case / Trace 展开页建立唯一内容职责，减少重复阅读与重复编辑，同时保留当前 Trace 的完整执行、证据、独立过程及产物评测、Session 对话和后续治理反查能力。

## ADDED Requirements

### Requirement: Each Case detail tab SHALL have a single content responsibility
系统 SHALL 保留任务与关联、Session 对话、Trace 与 Evidence、评测中心、治理链路五个内部 Tab，并保持四个主导航不变。详情公共头部 SHALL 仅提供一次 Case / Session / 当前 Trace 身份、Query 摘要、来源和分开的执行 / 治理状态；任务区 SHALL 只展示补充任务要求、产物摘要及用户反馈。快捷跳转和必要摘要 SHALL NOT 复制完整模块内容。

#### Scenario: Inspect a complete Case without duplicate sections
- **WHEN** 用户逐个浏览完整 Case 的五个 Tab
- **THEN** 完整 Session 对话仅在 Session Tab、完整评测矩阵仅在评测 Tab、完整治理流转与人工审计仅在治理 Tab出现；任务区不重复头部 ID、完整 Query、Log 列表或完整归因表单

### Requirement: Trace execution SHALL NOT embed a second evaluation or governance panel
Trace Tab SHALL 仅展示当前 Trace 执行 Timeline、所选 Observation 的必要摘要以及 Evidence / Log 入口。系统 SHALL 删除该 Tab 内的完整评测组件、“查看治理链路与处理进度”折叠区和完整人工历史副本；完整评测与治理 SHALL 通过对应 Tab 访问。

#### Scenario: Open execution view
- **WHEN** 用户打开 Trace 与 Evidence
- **THEN** 页面展示执行节点而不渲染完整模块矩阵、治理链接列表或人工审计列表，且可通过明确入口进入评测或治理 Tab

### Requirement: Node and evaluation evidence SHALL share one complete evidence presentation
执行节点及模块评测中的 Evidence 链接 SHALL 使用同一完整证据呈现规则，保留根证据、具体 Rubric 条款、Judge Reason、Observation / Log、首错与派生关联。执行原始 Input / Output / Error 详情 SHALL 由 Observation / Log 详情承担，不在每个卡片完整重复。

#### Scenario: Navigate from a module score to execution evidence
- **WHEN** 用户从模块评测打开 Evidence，再定位 Observation 或 Log
- **THEN** 所有入口指向同一证据和节点，保留当前 Trace 与评测上下文，而不是打开另一套不同来源的内容

### Requirement: Active Trace SHALL determine all trace-specific content
系统 SHALL 在切换 Trace 时同步评分、适用模块、评测版本、Evidence、Observation / Log、产物关联、耗时、人工复核历史、Findings 和治理流转；Session 对话仍展示完整 Session，并明确标识当前 Trace 对应轮次。Case 共享信息 SHALL 有明确标签，不能被误当作所选 Trace 的事件。

#### Scenario: Switch two Traces with different findings
- **WHEN** 一个 Case 的两个 Trace 分别有记忆失败与 Skill 失败，用户切换 Trace
- **THEN** 各 Tab 展示所选 Trace 的数据，上一 Trace 的证据、评分、复核和治理分支不残留

### Requirement: Trace list entry and return context SHALL remain unambiguous
Case / Trace 列表 SHALL 让每条 Trace 独立可识别、可打开且不以 Case 主 Trace 代替其他 Trace。点击行 SHALL 打开确切 Case 和 Trace，返回 SHALL 恢复原筛选、分页、Tab 和数据集详情；明确对象详情 SHALL 不被列表范围误阻挡。

#### Scenario: Open a non-primary Trace from a frozen dataset
- **WHEN** 用户从数据集成员行进入不在当前线上时间范围的非主 Trace
- **THEN** 完整详情仍可打开，返回恢复 Skill 分类、具体 Skill、固定 / 全部版本、归因、数据集和成员位置

### Requirement: Existing Skill and governance-object mutual exclusion SHALL be preserved
选择 Skill 分类或具体 Skill 时，系统 SHALL 固定治理对象为 Skill 并清理不兼容归因；不选择 Skill 范围时 SHALL 保留跨模块对象筛选。只存在孤立版本参数 SHALL NOT 自动构造一个不存在的 Skill 选择。

#### Scenario: Return through an incompatible old URL
- **WHEN** 用户打开或返回带具体 Skill 及 Memory 归因对象的旧链接
- **THEN** 系统恢复合法 Skill 模式，并提供完整 Trace 反查能力，不显示 Skill 与 Memory 混合筛选
