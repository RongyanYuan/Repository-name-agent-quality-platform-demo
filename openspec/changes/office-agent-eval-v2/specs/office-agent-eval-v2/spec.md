## Purpose

为 Office Agent 质量治理提供一套以用户满意度为北极星、以合格产物和过程效率为独立综合指标、以局部 Evidence 和首错归因为诊断基础的可操作前端评测闭环。

## ADDED Requirements

### Requirement: Homepage SHALL show an independent north-star satisfaction section

首页质量总览 SHALL 在首屏独立展示用户满意度总指标、趋势线和组成信号。用户满意度 SHALL 以最终被用户接受的合格产物数除以全部产物数计算，并 SHALL 区分首轮接受、最终接受、持续重复纠错和明确负反馈。

#### Scenario: Satisfaction section is visible and distinct
- **WHEN** 用户打开质量总览首页
- **THEN** 首页首屏 SHALL 以独立标题和视觉层级展示用户满意度，不得把它埋在合格产物或过程效率卡片中

#### Scenario: Satisfaction values follow global scope
- **WHEN** 用户切换时间范围、Agent Version、业务类型或环境
- **THEN** 用户满意度数值、趋势线和四类行为信号 SHALL 同步刷新

#### Scenario: Satisfaction signal drills down
- **WHEN** 用户点击首轮接受或明确负反馈信号
- **THEN** 系统 SHALL 打开现有 Task / Trace 页面，并带入对应行为过滤和来源 Evidence

### Requirement: Homepage SHALL show qualified product as an independent composite section

首页 SHALL 独立展示「合格产物率」总指标、趋势线和子维度。合格产物率 SHALL 由结果类型一致性、意图一致性、约束满足、准确性和文件有效性共同判断；任一硬门槛失败时，产物不得被标为合格。

#### Scenario: Qualified product section shows all five dimensions
- **WHEN** 用户打开质量总览首页
- **THEN** 合格产物 Section SHALL 同时显示总指标趋势线及结果类型、意图、约束、准确性、文件有效性五个可下钻子指标

#### Scenario: Accuracy exposes evidence semantics
- **WHEN** 用户打开准确性子指标或其 Task 下钻
- **THEN** 系统 SHALL 能区分事实/逻辑正确、证据可追溯和执行结果正确的证据原因

#### Scenario: File validity replaces the old display label
- **WHEN** 用户查看首页或 Task 结果评测
- **THEN** 面向用户的名称 SHALL 为「文件有效性」，旧的「结果可用性」ID/深链 SHALL 仍能解析到该维度

### Requirement: Homepage SHALL show process efficiency as an independent composite section

首页 SHALL 独立展示「过程效率达标率」总指标、趋势线和时延效率、Token/成本、必要 Loop、Skill/Tool 选择、Tool 结果、Retry、Recovery 等子指标。过程效率 SHALL 与合格产物率分开计算，不得隐式合并为单一总分。

#### Scenario: Process efficiency section is independently interpretable
- **WHEN** 同一范围同时显示合格产物率和过程效率达标率
- **THEN** 两个总指标 SHALL 各自保留名称、单位、趋势和下钻来源，用户能够区分“做对了”和“做得是否符合过程标准”

#### Scenario: Inefficient expected rate uses all products
- **WHEN** 系统计算「过程效率不符业务预期率」
- **THEN** 计算 SHALL 使用 `过程效率未达标的产物数 / 全部产物数`，并把该指标放在过程效率 Section 内以 Warning 样式展示

#### Scenario: Process child metric drills down
- **WHEN** 用户点击时延效率、Tool 结果或 Retry 子指标
- **THEN** 系统 SHALL 打开 Task / Trace 或异常 Case，并带入对应过程维度和失败状态过滤

### Requirement: Module diagnostics SHALL use five-state local evaluation and first-failure attribution

模块诊断 SHALL 对 Task Understanding、Decision、Context、Memory、Skill、Tool、Retry 和 Recovery 等实际节点显示 `PASS`、`FAIL`、`DERIVED_FAIL`、`UNKNOWN` 或 `N/A`，并 SHALL 使用局部上游输入、当前输出和临近反馈判断。每条 Trace SHALL 只有一个首个关键失败 Root Cause；派生失败必须保留但不得重复计入根因分布。

#### Scenario: Memory is the root and Context is derived
- **WHEN** 示例任务先在 Memory 错误召回，再导致 Context 内容污染
- **THEN** Memory SHALL 标记为 `FAIL`、首错和 Root Cause，Context SHALL 标记为 `DERIVED_FAIL` 并引用 Memory，Skill Routing 可独立为 PASS

#### Scenario: Evidence is insufficient
- **WHEN** 某个节点缺少判断所需 Evidence
- **THEN** 节点 SHALL 标记为 `UNKNOWN`，不得根据最终产物反推 PASS 或 FAIL

#### Scenario: Module is absent
- **WHEN** 某个模块在 Trace 中没有发生
- **THEN** 节点 SHALL 标记为 `N/A`，不得伪造一次调用或失败

### Requirement: Task and Case details SHALL expose acceptance, judge and attribution evidence

Task / Trace 和 Case 详情 SHALL 展示 Judge status、score (0..1)、reason、Rubric Evidence、`is_root_cause`、`derived_from`、用户接受/纠错事件、产品有效性和 Auto Eval vs Human Override。Case 根因 SHALL 来自首个非派生失败节点。

#### Scenario: Reviewer sees the complete task evidence
- **WHEN** 用户打开 Task 详情
- **THEN** 系统 SHALL 同时提供结果评测、过程评测、用户行为、首错归因和可打开的 Observation Evidence

#### Scenario: Human override remains auditable
- **WHEN** 人工将自动 FAIL 改为 PASS 或反之
- **THEN** 系统 SHALL 保留自动值、人工值、操作人、理由、score 和时间，并显著标记分歧

#### Scenario: Case root cause follows the first failure
- **WHEN** 下游节点因上游错误而失败
- **THEN** Case 列表和 Root Cause 分布 SHALL 只使用首个关键失败作为根因，下游仅显示为派生失败

### Requirement: Performance monitoring SHALL expose raw efficiency, cost and risk signals

性能页 SHALL 展示 Total Latency Efficiency、TTFT、模型吞吐、Input/Output Token、缓存命中、Tool 调用频率、一次执行成功率、风控拦截率/原因和商业化拦截率/原因。没有数据的 TTFT 或预期基线 SHALL 显示 `UNKNOWN` 或“基线未建立”，不得推断为通过。

#### Scenario: Latency efficiency uses the four business bands
- **WHEN** 任务存在实际时延和预期时延
- **THEN** 系统 SHALL 按 `<=1`、`1–1.5`、`1.5–2`、`>2` 显示正常、可接受、低效和异常带

#### Scenario: Cost is evaluated only for successful products
- **WHEN** 系统展示成本偏离或成本基线
- **THEN** 只有成功/合格产物 SHALL 进入成本评测分母，失败产物仍可展示原始 Token 和调用数据

#### Scenario: One-shot Tool success excludes recovery
- **WHEN** Tool 首次失败后通过 Retry 或 Recovery 成功
- **THEN** Tool 成功率可记录最终结果，但一次执行成功率 SHALL 不把该调用计为一次成功

### Requirement: Existing governance pages SHALL preserve the full website workflow

系统 SHALL 保留现有七页导航、Case/Dataset/Benchmark 操作、全局筛选、Breadcrumb/Back 和深链，并将 v2 字段同步到这些页面。首页新增 Section 不得替代或拆出新指标网页。

#### Scenario: Existing route remains usable after the metric change
- **WHEN** 用户从首页下钻到 Task、Case、Dataset 或 Benchmark
- **THEN** 目标页面 SHALL 正常打开并继承全局筛选、metric ID 和来源上下文

#### Scenario: Benchmark keeps dimensions separate
- **WHEN** 用户运行或查看 Benchmark
- **THEN** 结果、过程和性能 SHALL 分组展示，成本只评测成功产物，并可回到失败 Case/Trace 与 Rubric 版本

### Requirement: The delivered demo SHALL pass visual text-fit checks

最终网站 Demo SHALL 在 1440×900、1024×900 和 390×844 视口下保持可读和可操作。标题、指标卡、趋势线、按钮、表格、Drawer 和筛选控件中的文字不得互相重叠、溢出或被截断；所有核心交互 SHALL 可点击。

#### Scenario: Desktop dashboard fits without overlap
- **WHEN** 用户在 1440×900 打开首页和主要业务页
- **THEN** 页面 SHALL 保持稳定网格、无横向溢出，且 Section 标题、总指标和趋势线不发生重叠

#### Scenario: Narrow viewport remains usable
- **WHEN** 用户在 390×844 打开网站
- **THEN** Section SHALL 堆叠或横向滚动而不遮挡文字，筛选控件和 Drawer 内容仍可访问

#### Scenario: Full smoke flow is executable
- **WHEN** 测试从首页开始执行满意度/指标下钻、Evidence、人工 Override、Case、Dataset、Benchmark 和 A/B Trace 操作
- **THEN** 每一步 SHALL 有可观察的页面或状态变化，且不得出现空白页或运行时错误
