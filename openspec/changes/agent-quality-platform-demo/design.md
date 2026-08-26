## Context

当前仓库只有 OpenSpec 配置，没有前端源码或后端接口。实现范围由 proposal 和五份 capability spec 定义：这是一个桌面优先、前端 Mock 驱动的质量治理工作台，不是生产监控服务。实现必须同时承载密集表格、指标图表、Trace 时间线、编辑表单和跨页面下钻，因此需要一套共享领域模型和可预测的客户端状态边界。

## Goals / Non-Goals

**Goals:**

- 在一个可运行的 React 应用中覆盖七个导航页面和完整的 Metric → Task/Trace → Eval → Case → Dataset → Benchmark → Version Compare 链路。
- 用类型化 Mock Data 保证 Task、Trace、Observation、Eval、Case、Dataset 和 Benchmark 之间的引用一致，示例失败链路可复现。
- 让全局筛选、下钻参数和详情 Drawer 通过 URL 与共享状态协作，支持刷新、Back 和 Breadcrumb 后恢复上下文。
- 用可复用的表格、指标卡、状态徽标、图表、Timeline、Drawer、Modal、Tabs 和筛选控件保持视觉与交互一致。
- 让核心治理动作在本地立即可见：人工 Override、Badcase 确认、Dataset 加入/禁用、Benchmark 运行和 Case 分类。

**Non-Goals:**

- 不接入 Langfuse、真实 Agent runtime、数据库、鉴权、网络 API 或持久化服务。
- 不实现真实的 LLM-as-Judge、阈值计算、分布式 Benchmark 执行或后台任务队列；这些行为由可解释的确定性 Mock 结果模拟。
- 不在本 change 内实现移动端等价布局、用户权限系统或生产级数据刷新策略。

## Decisions

### 1. 应用骨架与路由

采用 Vite + React + TypeScript，使用 React Router 的嵌套路由组织固定 Dashboard shell 和七个页面：`/overview`、`/performance`、`/tasks`、`/cases`、`/datasets`、`/benchmarks`、`/evaluation-config`。选择路由而不是单组件条件渲染，是为了让浏览器 Back、深链和页面级筛选有稳定的地址语义；替代方案是手写 view switch，但会让下钻和恢复状态难以测试。

全局筛选器（时间范围、Agent Version、业务类型、环境、搜索词）以及页面局部筛选器编码到 URL search params。每个下钻动作只增加或替换必要参数（例如 `metric=intent-consistency&status=failed`），并保留来源页参数；详情 Drawer 使用可复制的 `taskId`/`traceId` 参数。没有真实后端时，URL 是刷新和返回行为的唯一可序列化上下文。

### 2. 领域模型与 Mock 数据

在 `src/domain` 定义共享枚举和类型：`Task`、`Trace`、`Observation`、`EvalResult`、`Case`、`Dataset`、`DatasetEntry`、`BenchmarkRun`、`BenchmarkCaseResult`、`EvalConfig` 和 `FilterState`。所有关系使用稳定 ID 引用，避免页面各自维护相似但不一致的对象。

在 `src/data` 放置确定性的种子数据和派生选择器：至少 24 个 Task，覆盖五种业务类型、三种复杂度、三种结果状态、两个 Agent 版本、所有主要 Root Cause 和 Tool latency 异常；其中必须包含“根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层”的 Memory 首次失败 Trace。选择器负责从同一 Task 生成指标卡数量、Case 列表和 Benchmark 分类，保证每个聚合数字都能反查到记录。

### 3. 客户端状态边界

使用一个轻量 `QualityStore`（React Context + `useReducer`）持有可变 Demo 状态：人工标签、Case 状态、Dataset entries、Benchmark runs 和当前全局筛选。纯计算（过滤、聚合、Delta、首个失败节点判断）使用独立的 selector 函数，不在组件中重复计算。选择 reducer 而不是多个局部 `useState`，是为了让从 Task 标注到 Case/Dataset/Benchmark 的跨页更新保持原子且可测试；不引入 Redux/Zustand，避免 Demo 为单一前端状态增加额外架构。

Reducer action 只表达用户行为（例如 `overrideEval`、`confirmBadcase`、`addDatasetEntry`、`toggleDatasetEntry`、`runBenchmark`），所有 action 都携带来源 ID 和必要的审计时间。Benchmark 使用确定性派生函数即时生成 run 结果和四类 Case 分类，状态上仍保留 `queued/running/completed` 以便 UI 展示运行反馈。

### 4. 组件与页面分层

按 `src/components/ui`、`src/components/charts`、`src/components/trace`、`src/components/governance` 和 `src/pages` 分层。UI 层只处理外观和通用交互；领域组件接收类型化 props；页面负责组合 selector、路由参数和 store action。固定 shell 包含侧栏、顶部全局栏、Breadcrumb、更新时间和统一的内容宽度。

Trace Timeline 是共享的领域组件：先按 `sequence` 排序，再把第一条失败 Observation 标为 Root Cause，后续失败标为 Derived；节点详情 Drawer 展示 Input、Output、Metadata、Evidence、Error、Model/Token、Tool Result 和 Eval Result。这样 Overview、Task、Case 和 A/B 对比不会各自实现一套失败判定。

### 5. 视觉、图表和交互约束

采用 Tailwind CSS 的语义色 token 和少量 CSS variables，使用 Lucide 图标、绿色 PASS、红色 FAIL、橙色 Warning、浅橙/灰色 Derived；不使用大面积渐变或装饰性圆形。图表统一封装为可点击的柱状图、折线图和分布图组件，点击点位通过回调更新 URL 筛选或打开异常 Drawer。选择 Recharts 是因为它能在 React 中快速提供可测试的 SVG 图表；图表同时提供表格/文本摘要，避免只依赖颜色或悬停。

桌面工作台以 1440px 为基准，侧栏和工具栏使用稳定尺寸，内容区在较窄窗口改为可横向滚动的表格和堆叠面板。所有按钮使用熟悉图标加文字或 tooltip，状态徽标不承担唯一信息，表单控件带可见 label 和键盘焦点样式。

### 6. 关键闭环实现

- KPI 卡和过程指标 selector 产出 `drilldownFilter`，点击后导航到 `/tasks` 或 `/cases` 并默认筛选失败记录。
- Task 详情同时渲染 Result Eval 列表和 Trace Timeline；展开 Eval 时读取其 `evidenceIds`，再从 Observation 索引显示 Evidence/Observation Details。
- Case 编辑表单写入同一 reducer，保存后立即刷新 Auto Eval vs Human Label 对比、Case tab 和 Dataset 可用状态。
- Dataset 页面批量选择启用项，Benchmark 创建器读取 Dataset 版本和 Eval Rubric；运行后用固定比较函数生成 metric deltas 与四类 changed cases。
- Benchmark Case 点击带入 `benchmarkId`、`caseId`、`comparison=true`，A/B Trace 组件按阶段 ID 对齐并标注 Added/Removed、状态转换和 latency delta。

### 7. 验证策略

实现阶段至少加入三层验证：selector/reducer/Benchmark 分类的 Vitest 单元测试；关键页面和 Drawer 的 React Testing Library 交互测试；Playwright smoke 流程覆盖“点击 KPI → 失败 Task → 打开 Trace → Override → 加入 Dataset → 运行 Benchmark → 打开回归 A/B Trace”。`npm run build` 和 `npm run lint` 作为交付门禁，Mock 数据完整性（ID 引用、20+ Task、必需示例 Trace）用启动时开发断言或单元测试检查。

## Risks / Trade-offs

- [Risk] 多页面共享状态容易出现筛选和 reducer 逻辑分散 → Mitigation：所有跨页行为集中在 `QualityStore` 和 selectors，页面不直接修改派生集合。
- [Risk] Mock 聚合值与列表明细不一致会破坏“指标可下钻”承诺 → Mitigation：所有 KPI、图表和 Benchmark 数字从同一稳定数据源派生，并为每个 selector 写反查测试。
- [Risk] 高密度桌面布局在较窄窗口产生溢出 → Mitigation：为表格、Timeline 和工具栏设定最小尺寸与横向滚动断点，并做 1440px、1024px 和移动窄宽度 smoke 检查。
- [Risk] 图表颜色或动画造成可读性和测试不稳定 → Mitigation：提供文本摘要、固定颜色 token，关闭关键图表的随机动画，交互依赖语义事件而非坐标。
- [Risk] 本地 reducer 状态在刷新后丢失可能与“保留上下文”混淆 → Mitigation：URL 只保存筛选/定位上下文，明确 Demo 状态是会话级 Mock；在 UI 中显示数据更新时间和 Demo 标识。

## Migration Plan

1. 用 Vite 创建 React/TypeScript 基础工程并加入 Tailwind、React Router、Recharts、Lucide、Vitest、Testing Library 和 Playwright。
2. 先实现领域类型、种子数据、selectors 和 `QualityStore`，通过单元测试确认引用与聚合正确。
3. 按 Overview/Performance、Task/Trace、Case/Dataset、Benchmark、Eval Config 顺序接入页面和路由，再补齐跨页闭环。
4. 运行 lint、单元/组件测试、Playwright smoke 和生产构建，启动本地 dev server 验收。

这是一个全新空项目，没有旧实现需要迁移或数据库迁移。若实现被撤回，只需移除本 change 新增的前端工程文件和依赖；OpenSpec 规划产物保留用于审计。

## Open Questions

无。视觉 token、Mock 状态和客户端持久化边界已按 Demo 目标确定，后续不会改变本 change 的规格或任务顺序。
