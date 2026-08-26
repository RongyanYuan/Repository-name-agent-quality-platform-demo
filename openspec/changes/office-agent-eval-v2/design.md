## Context

当前 Demo 是一个 Vite + React + TypeScript 的七页前端应用，数据由 `src/data.ts` 的确定性 Mock fixtures 提供，`QualityStore` 通过 React Context/reducer 管理会话级编辑状态。旧版本已经有 KPI、Task/Trace、Case、Dataset、Benchmark、评测配置和性能页面，但领域类型仍是二态 Eval，首页把结果/过程指标平铺，且没有用户接受事件。

本 change 只改变评测口径和展示层级，不接入真实 Langfuse、后端或生产数据。现有路由和已完成的 Case/Dataset/Benchmark 交互必须继续可用。

## Goals / Non-Goals

**Goals:**

- 用同一份类型化 Task/Trace/Event 数据驱动首页的用户满意度、合格产物、过程效率和模块诊断四个独立 Section。
- 保留并扩展现有七页网站 Demo，使五态 Judge、用户接受信号、首错归因、性能原始指标和风险/商业化信号在所有相关页面一致。
- 让合格产物率和过程效率达标率独立可解释；将过程效率不符业务预期率固定为全部产物分母。
- 保持旧 URL metric ID、Result Usability 字段和页面入口的兼容映射。
- 通过可复用组件、稳定网格和多视口 bounding-box 检查，交付无文字错位的可操作 Demo。

**Non-Goals:**

- 不实现真实 LLM-as-Judge、Langfuse 查询、用户鉴权、数据库、持久化或生产告警。
- 不为二/三期复杂度成本基线、TTFT 阈值或预期 latency 阈值编造正式数值；缺失数据显示 UNKNOWN/基线未建立。
- 不新增指标专用网页，不把 Context/Memory 或旧的 Unnecessary Tool/Model Call 偷换成新的总分。

## Decisions

### 1. 领域模型采用兼容扩展而不是替换

在 `src/domain.ts` 增加 `JudgeStatus` 五态、`ProductAcceptanceEvent`、`ProductValidity`、`ProcessEfficiency`、`RootCauseAttribution` 和 `RiskCommercialEvent`。保留现有 `EvalStatus` 的 PASS/FAIL 消费路径，通过联合类型/适配器让旧组件继续渲染；将 `Result Usability` 映射为 `File Validity` 的显示别名。这样可避免一次性改坏现有 Case、Benchmark 和测试链接；替代方案是重写所有旧类型，但迁移面大且无产品收益。

### 2. 首页使用四个独立 Section 和统一趋势组件

`OverviewPage` 不再直接渲染平铺 KPI 网格，而是组合 `SatisfactionSection`、`QualifiedProductSection`、`ProcessEfficiencySection` 和 `ModuleDiagnosticsSection`。每个 Section 有一个总指标卡、一条趋势线、子指标卡和来源 ID；所有点击通过 `useContextNavigation` 进入现有 `/tasks` 或 `/cases` 路由。选择组合 Section 而非新路由，是为了满足用户确认的“首页数据看板独立 section”要求，并保持现有导航和 Back 行为。

用户满意度的主值使用 `acceptedQualifiedProducts / allProducts`。合格产物率由五个硬门槛共同决定；过程效率达标率单独计算。过程效率不符业务预期率使用 `processOutOfExpectationProducts / allProducts`，在过程 Section 内以 Warning 色显示。

### 3. 首错归因由 observation selector 统一计算

新增 `getFirstFailureAttribution`：按 sequence 找到第一个非派生失败节点作为 Root Cause；所有后续传播失败设置 `DERIVED_FAIL` 和 `derivedFrom`，但不进入 Root Cause 计数。Task、Case、Overview 和 A/B Trace 都调用同一个 selector，避免页面各自根据最终结果猜根因。

### 4. 用户行为事件采用确定性 Mock 状态机

每个产品记录一组有序 acceptance events，并区分 `correction` 与 `new_requirement`。selector 根据事件顺序计算首轮接受、最终接受、持续重复纠错和明确负反馈；reducer 允许 Demo 中人工修正事件标签但保留自动判定。这样能展示 PRD 的行为漏斗而不需要模拟真实网络事件。

### 5. 性能指标分为原始信号、效率带和待建基线

Performance selector 从 raw latency、expected latency、TTFT、token、cache、tool call、retry 和 loop 字段生成四档 latency efficiency、吞吐、成本偏离、Tool frequency 和 one-shot success。成功结果才进入成本评测；retry/recovery 成功不计入 one-shot success。TTFT 或预期基线缺失时返回 UNKNOWN/未建立，不回填 PASS。风险/商业化拦截作为性能页的独立分区。

旧 P50/P90/P95、7/14 天 rolling baseline 和 Model 明细保留为兼容视图，但新首页总指标不依赖这些旧字段。

### 6. 状态与筛选保持 URL 可序列化

继续使用现有 `FilterState` 和 URL search params，新增 `acceptanceSignal`、`validity`、`processStatus`、`benchmarkId` 等参数时保持未知参数透传。全局筛选由 `QualityStore` 同步，页面局部筛选只追加自己的键；详情 Drawer 使用 task/trace/case IDs。这样刷新、Breadcrumb、Back、KPI 下钻和异常下钻都能恢复上下文。

### 7. 视觉实现以稳定尺寸和语义文本为门禁

复用现有 Tailwind tokens、MetricCard、TrendChart、DataTable、Drawer、TraceTimeline 等组件；新增 Section header、总指标卡和行为信号卡时使用固定 grid/min-width、`line-clamp` 和横向滚动，不用负 margin 或绝对定位覆盖文本。每个状态同时显示文字和颜色。Playwright 在 1440×900、1024×900、390×844 检查 `scrollWidth`、元素 bounding boxes 和关键文本可见性。

### 8. 测试按数据、交互、视觉三层组织

- Vitest：fixtures、五态归因、满意度/合格产物/过程效率公式、成本成功率、reducer 和 URL round-trip。
- Testing Library：首页四 Section、Metric/Trend 点击、五态 Evidence、人工 Override、Case/Dataset/Benchmark 配置。
- Playwright：从首页下钻到 Task/Trace、Evidence、Case、Dataset、Benchmark 和 A/B Trace 的完整 smoke flow，以及七页三尺寸布局检查。

## Risks / Trade-offs

- [Risk] 旧字段和新字段并存可能造成同义标签重复 → Mitigation：显示层统一新命名，数据层集中维护 alias map，并为旧 metric ID 添加回归测试。
- [Risk] 用户满意度事件是 Mock，容易给出过于确定的业务结论 → Mitigation：在页面标注 Demo/Mock 数据，展示事件来源和计算分母，不冒充线上真实数据。
- [Risk] Medium 复杂度被映射到 Complex 后误解成本分布 → Mitigation：主聚合按两档展示，Task 详情保留原始 Medium 标签和兼容说明。
- [Risk] 缺少 expected latency/TTFT 会让效率卡片看起来空白 → Mitigation：使用 UNKNOWN/基线未建立状态和解释性文案，仍保留原始 latency/token。
- [Risk] 首页信息密度增加导致文字错位 → Mitigation：Section 内采用响应式堆叠、固定卡片宽度、可见溢出检测和三尺寸 Playwright 检查。

## Migration Plan

1. 扩展 domain/data fixtures 和 selectors，先保持旧页面可编译。
2. 更新 QualityStore 和 URL 适配器，再替换首页四 Section。
3. 同步 Task/Trace、Case/Dataset、Benchmark、评测配置和 Performance 页面。
4. 增加单元/交互/端到端/视觉检查，运行 lint、test、build。
5. 启动本地 Vite Demo，逐页检查 1440px、1024px、390px，并更新 README。

回滚时可删除本 change 新增字段和 Section 组件，恢复旧 selectors；由于没有后端或数据库迁移，不需要数据回滚。

## Open Questions

无。本设计已采用用户确认的首页 section、命名和全部产物分母；未有数据的 TTFT/基线统一按 UNKNOWN/未建立处理。
