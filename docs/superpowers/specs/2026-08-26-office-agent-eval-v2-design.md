# Office Agent 评测体系 v2：首页质量看板与全站口径改造

## Status

已根据新版《Office Agent 评测体系 PRD「一期」》和用户确认的首页信息层级形成设计。当前阶段只冻结产品与交互方向，待审阅后进入实现。

## 1. 目标与边界

本次改造保留现有 Agent Quality Platform 的七页网站 Demo 和导航结构，重点重构首页「质量总览」的数据看板，并同步更新 Task / Trace、Case、Dataset、Benchmark、评测配置和性能页的共享评测口径。

首页不新增独立网页，采用纵向的四个独立 Section：

1. 北极星指标：用户满意度
2. 合格产物
3. 过程效率
4. 模块诊断与首错归因

所有 Section 都继续使用指标卡、趋势线、可点击下钻和同一组全局筛选（时间范围、Agent Version、业务类型、环境、搜索）。最终交付仍必须是完整可运行的网站 Demo，而不是只更新首页截图。

## 2. 首页指标层级

### 2.1 北极星：用户满意度

用户满意度置于首页首屏最醒目位置，展示当前值、周期变化、趋势线和组成信号。口径为“最终被用户接受的合格产物 / 全部产物”。

需要区分以下用户行为：

- 首轮接受：首轮交付后下载、复制、点赞或明确接受，且没有纠错/重生成。
- 最终接受：发生正常新增需求后，最终下载、复制或明确接受。
- 持续重复纠错：原需求没有实质新增，且重复纠错轮次大于 1。
- 明确负反馈：Dislike、差评或“不对 / 重做 / 不满意”等拒绝信号。

首页趋势线下方显示四类信号的数量和比例，点击信号可进入 Task / Trace 并带入行为过滤与 Evidence 上下文。

### 2.2 合格产物 Section

该 Section 有一个独立的综合总指标「合格产物率」和一条趋势线。它判断产物是否满足基本交付要求，子指标作为总指标 Section 内的可下钻卡片展示：

- 结果类型一致性
- 意图一致性
- 约束满足
- 准确性
- 文件有效性

准确性在详情中继续拆成事实/逻辑正确、证据可追溯和执行结果正确。显示层将旧的「结果可用性」更名为「文件有效性」；数据层保留旧字段别名作为兼容映射，避免既有链接失效。

### 2.3 过程效率 Section

该 Section 有一个独立的综合总指标「过程效率达标率」和一条趋势线。子指标作为 Section 内的可下钻卡片展示：

- 总时延效率
- Token / 成本效率
- 必要 Loop
- Skill / Tool 选择有效率
- Tool 结果成功率
- Retry 有效率
- Recovery 成功率

「**过程效率不符业务预期率**」也放在此 Section 内，但作为 Warning 色的独立诊断指标，不作为第三个总分。其分母明确为**全部产物**：

`过程效率不符业务预期率 = 过程效率未达标的产物数 / 全部产物数`

这意味着它与合格产物率、过程效率达标率分别表达不同问题，不能通过加总或单一综合分替代。

### 2.4 模块诊断 Section

模块诊断用于解释总指标，不作为新的质量总分。Task Understanding、Decision、Context、Memory、Skill、Tool、Retry、Recovery 等节点逐节点展示：

`PASS / FAIL / DERIVED_FAIL / UNKNOWN / N/A`

每条 Trace 只能有一个首个关键失败 Root Cause。下游由上游传播的失败保留为 `DERIVED_FAIL`，但不重复计入 Root Cause 分布。Context 和 Memory 保留为诊断证据；在当前 PRD 一期不伪造独立正式 KPI。

## 3. 全站同步变化

### Task / Trace

- Eval 状态从二态扩展为五态，并增加 `reason`、Rubric Evidence、`score (0..1)`、`is_root_cause`、`derived_from`。
- Task 详情增加用户接受行为、纠错/重生成次数、最终有效产物判定、文件/链接/Action 有效性。
- Trace 节点按局部上游输入、当前输出和临近反馈判断，不用最终结果反推节点是否正确。
- Result Eval 和 Process Eval 分栏展示，Evidence 可回到 Observation Details。

### Case / Badcase / Dataset

- Case 根因以首个非派生失败节点为准，支持 UNKNOWN/N/A 和用户行为 Evidence。
- Dataset 条目增加 Expected Outcome、Expected Constraint、Expected Process、Golden Label、文件有效性和用户接受标签。
- 禁用 Dataset 条目保留历史，但不能进入新 Benchmark。

### Benchmark

- Result Eval、Process Eval、Performance Metric 三组独立比较。
- 成本偏离仅对成功结果做评测。
- Benchmark 结果可回到失败/回归 Case、Task、Trace 和 Rubric 版本。

### Performance

- 保留现有时延、Tool baseline 和 Model 明细作为兼容视图。
- 增加 Total Latency Efficiency、TTFT（无埋点时显示 UNKNOWN）、模型吞吐、Input/Output Token、缓存命中、Tool 调用频率、一次执行成功率。
- 增加风控拦截率/原因和商业化拦截率/原因分区。
- 二/三期成本基线和复杂度预期不在本次 Demo 中虚构；一期先展示原始成本数据和“基线待积累”状态。

### 评测配置

- 增加 Decision Hard/Soft Gate、Tool/Skill 选择规则、Tool 结果规则和五态 Judge 契约。
- Context 不作为独立 KPI，但保留 Evidence 和异常入口。
- Memory 没有正式效率 KPI 时只展示节点状态、Evidence 和 UNKNOWN 覆盖情况。
- 每条规则保留 Rubric Version、Prompt、Evidence Requirement、Judge Version 和启用状态。

## 4. 数据与状态设计

在现有共享领域模型上增加：

- `ProductAcceptanceEvent`：download、copy、like、dislike、accept、correction、regeneration、new_requirement。
- `ProductValidity`：合格产物五维结果、文件/链接/Action 可用性和最终有效状态。
- `ProcessEfficiency`：实际/预期时延、Token/成本、必要 Loop、Tool/Skill 选择、Tool 结果、Retry、Recovery。
- `JudgeResult`：五态 status、reason、Rubric evidence、score、root/derived attribution。
- `RootCauseAttribution`：first failure node、root cause module、derived failures 和局部证据。
- `RiskCommercialEvent`：拦截类型、标准化原因和时间窗口。

继续使用现有客户端 Mock Store 和 URL search params。聚合指标、趋势线和下钻链接全部从同一份 Task/Trace 数据派生，并携带 source IDs，确保“指标 → Task/Trace”可反查。

复杂度兼容策略：底层继续保留 Simple / Medium / Complex 原始值，保证既有 Task、Trace 和筛选链接不失效；首页一期的主聚合只展示 Simple / Complex 两个业务带，Medium 在明细中保留原标签，并按 Complex 带参与主趋势展示。二/三期成本基线仍不在本次 Demo 中假造。

时延策略：时延始终作为过程效率指标，不隐式乘入合格产物率。合格产物率只由结果类型、意图、约束、准确性和文件有效性构成；过程效率达标率单独使用实际/预期时延、Token/成本、必要路径和恢复信号。若某条记录没有预期时延，相关效率状态显示 UNKNOWN 或“基线未建立”，而不是推断为 PASS/FAIL。

## 5. 视觉和可用性验收

- 继续使用现有白/灰/深色文字的 Observability Dashboard 风格；绿色 PASS、红色 FAIL、橙色 Warning、浅橙/灰色 Derived。
- 北极星 Section 具有明显视觉权重；合格产物和过程效率用清晰的分隔线、标题和总指标卡区分。
- 每个总指标和子指标均使用稳定尺寸的 KPI 卡或趋势图，不用纯颜色承载语义。
- 1440px、1024px 和 390px 三种视口执行截图检查。
- 对标题、指标数值、按钮、表格单元格、趋势图标签和 Drawer 内容执行 DOM bounding-box 检查，确保不溢出、不重叠、不被截断；必要时使用换行、`min-width`、`line-clamp` 或横向滚动。
- 七个路由、深链、Back/Breadcrumb、Drawer、Modal、Tabs 和筛选状态都要在最终网站中可操作。

## 6. 实施顺序

1. 更新共享类型、Mock Data、Acceptance Event、五态 Judge 和 Root Cause selector。
2. 重构首页四个独立 Section、总指标趋势线、子指标卡和下钻逻辑。
3. 同步 Task / Trace 详情、Case/Dataset、Benchmark 和评测配置的字段与交互。
4. 扩展 Performance 页的原始指标、基线待积累状态和风险/商业化分区。
5. 增加 selector/reducer、React 交互和 Playwright smoke 测试。
6. 运行 lint、unit、build、端到端测试和多视口文字边界检查，启动完整 Demo 供验收。

## 7. 非目标

- 本次不接入真实 Langfuse、真实 LLM Judge、后端 API、数据库或鉴权。
- 不提前定义二/三期复杂度成本基线或 TTFT 阈值；TTFT 没有数据时显示 UNKNOWN。
- 不把 Context、Memory 或旧的 Unnecessary Tool/Model Call 指标悄悄升级为新的正式总分。
- 不新增独立指标网页；所有核心指标都在现有首页数据看板的独立 Section 中展示。
