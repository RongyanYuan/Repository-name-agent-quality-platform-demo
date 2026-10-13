## Purpose

为每条 Trace 提供带时间、证据来源和明确目标的治理流转历史，直观展示已进入的数据集与当前处理分支，同时区分 Case 共享关联、样本用于验证以及真正由该 Trace 发起的改进。

## ADDED Requirements

### Requirement: Trace governance SHALL show timestamped and branch-aware events
治理 Tab SHALL 按当前 Trace 展示事件，包含事件时间、阶段、状态、操作者 / 系统、说明及可点击对象。支持任务产生、过程 / 产物评测、人工复核、归因、分流、数据集加入、直接修复 / 聚类、变体、单能力 / 窗口实验、准出、发布 / 回滚；流程 SHALL 允许跳过非适用阶段、重复评测、回退以及多个并行去向，不强制线性流水线。

#### Scenario: A Trace has both an algorithm Badcase and self-evolution route
- **WHEN** 一个 Trace 的多个 Finding 分别进入策略迭代和 Agent 迭代
- **THEN** 页面显示两条独立分支、各自目标和状态，不以最后一条事件覆盖另一条分支

### Requirement: Current position SHALL derive from actual branch state
治理摘要 SHALL 展示当前各活跃分支的阶段、最近流转时间和目标，并清楚区别已完成、进行中、阻塞 / 失败及尚未进入。当前节点 SHALL 有明确强调样式；系统 SHALL 不因某分支已发布而把其他待复核分支标为完成。

#### Scenario: Published change with a newer pending finding
- **WHEN** 历史变体已发布但同一 Trace 后续又有新待处理问题
- **THEN** 历史发布保留，当前摘要仍显示新的待处理分支和对应时间

### Requirement: Dataset enrollment SHALL record membership identity and time
Trace 数据集事件 SHALL 展示具体数据集名称、ID、版本、用途、是否冻结、成员加入时间、来源及后续实验关联。Trace 成员关系 SHALL 与 Case 共享归属区别展示；仅凭一个 Case 在数据集中 SHALL NOT 声称其每条 Trace 都被单独加入。

#### Scenario: Enroll a single Trace of a multi-Trace Case
- **WHEN** Case 的 Trace B 被明确加入原始归因集 A，而 Trace A 没有独立加入记录
- **THEN** B 显示对应加入时间与用途，A 至多显示“Case 共享归属”，不复制 B 的流转事件

#### Scenario: Membership time is missing
- **WHEN** 旧成员仅有 Case 归属，没有原始加入时间
- **THEN** 页面显示“加入时间未记录”并将该关联与已定时事件分开；不得用数据集 updatedAt、Query 时间或当前访问时间替代

### Requirement: Event timestamps SHALL retain provenance and chronology
事件 SHALL 使用实际动作时间，展示年月日、时分秒及明确时区；相同时间稳定排序。旧实体关联只有更新时间时 SHALL 显示该时间的真实语义而非冒充动作时间。Mock 可提供显式构造的事件时间，但 SHALL 标识 Mock；时间未知不制造顺序、耗时或超时结论。

#### Scenario: Chronology includes rerun and human revision
- **WHEN** 自动评测、人工复核、重跑与再次复核依次发生
- **THEN** 历史按各自发生时间展示且保留全部记录，操作等待时长不被解释为 Agent 执行耗时

### Requirement: Governance links SHALL distinguish origin from validation coverage
Issue、Cluster、Variant、Experiment、Decision、Release 等事件 SHALL 以明确关系绑定到当前 Trace。仅作为回归 / 泛化验证样本的 Trace SHALL 标识“用于验证”，不能因此显示“由此 Trace 发起”或“已发布”；共享 Case 来源 SHALL 明确标识。

#### Scenario: Regression membership in an unrelated variant experiment
- **WHEN** Trace 只出现在某实验的回归数据集中而不是变体来源
- **THEN** 页面可反查实验，但不会把该变体的准出与发布当成此 Trace 的问题已解决

### Requirement: List summaries SHALL link to the same complete governance history
Case / Trace 列表及数据集样本行 SHALL 显示当前治理阶段、最近流转时间和简短数据集归属，并提供打开该 Trace 治理 Tab 的操作；完整对象历史 SHALL 不在行内重复展开。返回 SHALL 恢复原列表和数据集上下文。

#### Scenario: Open governance from a dataset member
- **WHEN** 用户点击某数据集 Trace 的当前治理状态或明确查看链路入口
- **THEN** 打开同一 Trace 的治理时间线，所见去向与列表摘要一致，返回后保持原数据集和筛选
