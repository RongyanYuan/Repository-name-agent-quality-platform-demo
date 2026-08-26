## Purpose

为质量治理人员提供一套可追溯的 Task / Trace 工作台，使聚合指标下钻、结果评测证据核验、过程节点分析以及人工治理动作都能围绕同一条任务记录完成。

## ADDED Requirements

### Requirement: Task / Trace list exposes actionable task records

平台 SHALL 展示可分页或连续浏览的 Task / Trace 列表，并为每条记录提供 `task_id`、Query 摘要、Outcome Type、Complexity、Agent Version、Task Status、Root Cause、Latency、时间戳、Badcase 标记和 Golden Case 标记。Outcome Type MUST 至少区分信息交付、内容产物交付和操作执行；Task Status MUST 至少区分 Effective、Effective but Inefficient 和 Failed。

#### Scenario: User scans a mixed task list

- **WHEN** 用户打开 Task / Trace 工作台且没有应用额外筛选
- **THEN** 平台展示来自不同业务类型、复杂度、Agent Version 和任务状态的记录，并且每行都能识别其状态、根因和性能信息

#### Scenario: User opens a task from the list

- **WHEN** 用户选择任意 Task / Trace 行
- **THEN** 平台打开该任务的详情视图，并保留进入前的列表筛选上下文

#### Scenario: No task matches the current query

- **WHEN** 当前搜索词或筛选组合没有匹配记录
- **THEN** 平台显示明确的空结果状态，并保留可修改的搜索词和筛选条件

### Requirement: Task / Trace list supports multi-dimensional filtering and search

平台 SHALL 支持按 PASS / FAIL、Outcome Type、Complexity、Root Cause、Agent Version、Skill、是否 Badcase 和是否 Golden Case 筛选 Task / Trace，并 SHALL 支持通过 `task_id`、`trace_id` 或 Query 搜索。任一筛选条件变化后，列表、结果数量和空状态 MUST 立即反映新的条件。

#### Scenario: User filters failed intent evaluations

- **WHEN** 用户选择结果评测维度“意图一致性 = FAIL”
- **THEN** 平台仅展示该维度评测失败的 Task，并在当前筛选区域明确显示该条件

#### Scenario: User searches by trace identifier

- **WHEN** 用户输入一个完整或部分 `trace_id`
- **THEN** 平台展示包含该标识的相关 Task，并允许用户直接打开对应详情

#### Scenario: User combines filters

- **WHEN** 用户同时选择“复杂度 = 复杂”“Root Cause = Memory”和“Badcase = 是”
- **THEN** 平台只展示同时满足全部条件的记录，而不是分别满足任一条件的记录

### Requirement: Cross-page deep links preserve an actionable filter context

平台 SHALL 接受来自质量指标、过程指标或性能异常点的下钻条件，并将其转换为 Task / Trace 工作台中可见且可清除的筛选条件。用户通过 Breadcrumb 或返回操作离开详情后，平台 MUST 恢复进入前的搜索词、筛选条件和列表位置；从详情再次返回列表时不得静默丢弃这些状态。

#### Scenario: KPI click opens failed tasks

- **WHEN** 用户从“意图一致率”指标卡点击下钻
- **THEN** 平台进入 Task / Trace 工作台，并自动应用“意图一致性 = FAIL”筛选，同时显示匹配的失败 Task

#### Scenario: Performance anomaly opens affected traces

- **WHEN** 用户从性能监控中的异常工具数据点选择“查看异常 Trace”
- **THEN** 平台进入 Task / Trace 工作台，并自动限制到该时间窗口和异常工具相关的 Trace

#### Scenario: Breadcrumb return restores the list

- **WHEN** 用户在已设置搜索词和多项筛选的列表中打开详情，再点击 Breadcrumb 返回
- **THEN** 平台恢复原搜索词、全部筛选条件和之前的列表浏览位置

### Requirement: Task detail identifies the task and its delivered outcome

详情视图 SHALL 同时展示原始 Query、`task_id`、`trace_id`、`session_id`、Agent Version、Complexity、最终交付结果和 Task Status，并 SHALL 提供从任务信息进入其完整 Trace 的明确入口。详情中的身份标识 MUST 与列表中被选记录一致。

#### Scenario: User verifies task identity

- **WHEN** 用户从列表打开一条 Task
- **THEN** 详情视图显示该 Task 的全部标识字段、原始 Query 和最终交付结果，且不存在与其他 Task 混淆的标识

#### Scenario: Task has no delivered result

- **WHEN** 被打开的 Task 未产生最终交付结果
- **THEN** 详情视图明确显示结果缺失或失败状态，而不是展示空白或把缺失误报为成功

### Requirement: Result Eval separates dimensions and exposes evaluation provenance

平台 SHALL 在 Task 详情中分别展示结果类型一致性、意图一致性、约束满足、准确性和结果可用性五个 Result Eval 维度；每个维度 MUST 有可识别的 PASS 或 FAIL 状态，并同时区分自动评测结果和人工标注结果。用户展开某一维度时，平台 SHALL 展示 Eval Reason、Evidence ID 或 Observation ID，以及对应的评测来源和时间上下文（如有）。结果评测 MUST 与过程评测和性能指标分栏呈现，不得合并成无法解释的单一总分。

#### Scenario: User reviews a passing result dimension

- **WHEN** 用户展开一个自动评测为 PASS 的结果维度
- **THEN** 平台显示 PASS 状态、自动评测理由和可追溯的 Evidence ID 或 Observation ID

#### Scenario: User reviews a failed result dimension

- **WHEN** 用户展开一个自动评测为 FAIL 的结果维度
- **THEN** 平台显示 FAIL 状态、失败理由、关联证据引用和可继续打开的证据入口

#### Scenario: Automatic and human labels disagree

- **WHEN** 自动评测结果与人工标注结果不一致
- **THEN** 平台在该维度显著标记“Eval Disagreement”，并并排呈现两种结果及各自理由

### Requirement: Every evaluation result links to inspectable evidence

每条 Eval 结果 SHALL 关联至少一个可定位的 Evidence ID、Observation ID 或明确的证据缺失状态。用户选择证据引用时，平台 MUST 打开与该评测结果对应的 Observation Details；证据不可用时 MUST 显示不可用原因，并保留评测结果及其来源信息，不得提供无响应的链接。

#### Scenario: User follows evidence from an eval

- **WHEN** 用户点击某个 Result Eval 的 Evidence ID
- **THEN** 平台打开对应 Observation Details，并定位到能支持该评测结论的输入、输出或错误信息

#### Scenario: Evidence is unavailable

- **WHEN** 某条 Eval 结果没有可读取的证据
- **THEN** 平台显示“证据不可用”及原因，并保留该结果的自动/人工来源和评测理由

### Requirement: Trace timeline shows ordered process outcomes and failure attribution

平台 SHALL 以按时间或执行顺序排列的 Trace Timeline 展示 Task Understanding、Planning / Decision、Memory、Context Assembly、Skill Routing、Skill、Tool、Loop / Retry 和 Final Outcome 等已发生节点。每个节点 MUST 显示 Node Type、输入摘要、输出摘要、Latency、Model 或 Tool、PASS / FAIL 状态，并明确标识 Root Cause、First Failure 或 Derived Failure。平台 MUST 将首个关键失败节点作为 Root Cause 归因，并将由其产生的后续失败标记为 Derived，而不把派生错误重复计入首个根因。

#### Scenario: User follows a failed memory trace

- **WHEN** Task 的 Memory 节点是第一个关键失败且 Context Assembly 由此失败
- **THEN** 时间线将 Memory 标记为 FAIL / First Failure / Root Cause，将 Context Assembly 标记为 FAIL / Derived，并保留后续节点的实际结果

#### Scenario: User inspects a successful trace

- **WHEN** Task 的所有关键节点和 Final Outcome 均通过
- **THEN** 时间线按执行顺序展示节点并将其标记为 PASS，不显示虚构的根因或派生失败

#### Scenario: Trace contains retries or loops

- **WHEN** Trace 包含 Loop、Retry 或 Recovery 节点
- **THEN** 时间线显示每次相关节点及其顺序、耗时和结果，使用户能够区分恢复成功、重复调用和最终失败

### Requirement: Observation Details exposes node-level evidence and metadata

用户选择 Trace 节点或 Evidence 后，平台 SHALL 展示对应的 Observation Details，其中至少包含 Input、Output、Metadata、Evidence、Error、Model / Token、Tool Result 和 Eval Result；缺失字段 MUST 明确显示为未记录，而不得用其他节点的数据填充。详情面板 SHALL 显示当前节点标识，并允许用户返回原时间线而不丢失所在任务。

#### Scenario: User opens a tool observation

- **WHEN** 用户点击 Trace 中的 Tool 节点
- **THEN** 平台展示该次调用的输入、工具返回值、错误（如有）、耗时和相关评测证据，并明确该 Observation 的标识

#### Scenario: User opens a model observation

- **WHEN** 用户点击 Model 节点
- **THEN** 平台展示该节点的输入、输出、模型信息、Token 使用、Latency 和 Eval Result，且内容对应当前节点而非整个 Task 的汇总

#### Scenario: Observation field is not recorded

- **WHEN** 当前 Observation 没有记录某个可选字段
- **THEN** 平台在该字段位置显示未记录状态，并继续允许用户查看其他已记录字段

### Requirement: Human reviewers can override evaluation labels with an audit-visible result

平台 SHALL 允许具备标注权限的用户对每个 Result Eval 维度设置人工 PASS 或 FAIL、填写人工理由或 Note，并提交人工 Override。提交后，平台 MUST 保留原自动评测值、人工值、操作者和更新时间，并明确显示当前生效的人工结果；撤销或修改 Override 时也 MUST 保留自动结果可查。

#### Scenario: Reviewer overrides an automatic failure

- **WHEN** 人工审核者将某个自动 FAIL 维度改为 PASS 并提交理由
- **THEN** 平台显示人工 PASS 为当前人工结论，同时保留自动 FAIL、人工理由、操作者和更新时间，并标记该条记录存在评测分歧或人工覆盖

#### Scenario: Reviewer edits an existing override

- **WHEN** 人工审核者修改已提交的人工标签或理由
- **THEN** 平台更新当前人工结论，并继续提供自动原值及最新人工变更信息供追溯

### Requirement: Reviewers can govern Badcase attribution from Task details

平台 SHALL 允许用户从 Task / Trace 详情发起 Badcase 标注，并在提交前设置或修改 Pass / Fail 结论、Failure Dimension、First Failure Node、Root Cause、Derived Failure、Severity（P0、P1、P2、P3）、Owner（General Agent、PPT、Excel、Word、Tool、Infra）和人工 Note。提交后，Task 与 Case 状态 MUST 同步显示 Confirmed Badcase、根因、责任人和严重级别；用户也 SHALL 能取消确认或修改这些字段。

#### Scenario: Reviewer confirms the memory badcase

- **WHEN** 用户在示例 Memory 首次失败的 Task 上选择 Confirmed Badcase，设置 Root Cause = Memory、Severity = P1 并分配 Owner = General Agent
- **THEN** 平台保存该归因，在 Task 详情和相关 Case 入口显示确认状态、根因、严重级别和 Owner，并将 Context 的后续失败保留为 Derived

#### Scenario: Reviewer revises attribution

- **WHEN** 用户将已确认 Badcase 的 First Failure Node 或 Root Cause 改为其他值并保存
- **THEN** 平台更新当前归因及相关列表筛选结果，同时保留人工 Note 和最近更新时间

### Requirement: Confirmed Badcases can be added to a dataset with explicit golden expectations

平台 SHALL 允许用户从 Task 详情或已确认 Badcase 一键加入 Golden Dataset，并要求或展示 Dataset 类型（Golden Case、Historical Badcase、Challenge Case）、Dataset Version、Expected Outcome、Expected Constraint 和 Golden Label；加入成功后，Task / Case MUST 显示所属 Dataset 及版本，且重复加入同一版本时不得生成不可区分的重复条目。

#### Scenario: User adds a confirmed badcase to a golden dataset

- **WHEN** 用户从已确认 Badcase 选择加入 Dataset，指定 Golden Case、Dataset Version、Expected Outcome、Expected Constraint 和 Golden Label 后提交
- **THEN** 平台创建可识别的 Dataset 关联，在 Task / Case 详情显示 Dataset 名称与版本，并保留 Source Trace 引用

#### Scenario: User adds a task without a complete golden label

- **WHEN** 用户尝试加入 Dataset 但未提供必需的 Golden Label 或 Expected Outcome
- **THEN** 平台阻止提交并指出缺失字段，Task / Case 的现有 Badcase 状态不被改变

#### Scenario: User opens the dataset link from a task

- **WHEN** 用户点击 Task 详情中的 Dataset 关联
- **THEN** 平台打开对应 Dataset Case，并保留返回该 Task / Trace 详情所需的筛选和导航上下文

