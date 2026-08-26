## Why

Agent 质量数据通常分散在指标、Trace、Eval、人工标注和回归报告中，无法从一个聚合指标追溯到失败节点，也无法把确认后的 Badcase 重新投入 Golden Dataset 和版本 Benchmark。这个 change 将在当前空项目中建立一个可操作的 Agent Quality Platform 前端 Demo，用一套明确的结果评测、过程评测和性能指标模型把质量治理链路串起来，先用高保真的 Mock Data 验证产品闭环和交互设计。

## What Changes

- 新建桌面优先的 React + TypeScript + Tailwind Dashboard shell，提供固定侧栏、全局筛选器、面包屑和可复用的表格、卡片、Drawer、Modal、Tabs、图表组件。
- 增加质量总览和性能监控页面，支持 KPI/异常点下钻到失败 Task、Trace 和根因。
- 增加 Task / Trace 工作台，展示 Result Eval、Evidence、Trace Timeline 和 Observation Details，并支持人工 Override、Badcase 标注和 Dataset 加入。
- 增加 Case & Badcase、Golden Dataset、Benchmark / Regression 和 A/B Trace 对比页面，形成从 Case 治理到版本回归的闭环。
- 增加评测配置页面，明确区分结果评测、过程评测和性能指标，并展示 Rule、Script、LLM-as-Judge、Rubric Version 和阈值。
- 提供至少 20 条覆盖 PPT、Excel、Word、Coding、General、不同复杂度、Agent 版本、失败根因和性能异常的 Mock Data；所有筛选、导航、Drawer、标注、Dataset、Benchmark 操作在前端可运行。
- 记录关键交互状态和筛选条件，使页面之间的下钻、返回和 Breadcrumb 操作保留上下文；本阶段不接入真实后端、认证或生产数据。

## Capabilities

### New Capabilities

- `quality-overview-performance`: 质量总览 KPI、过程指标、Root Cause 分布和 Task/Tool/Model 性能监控，以及异常下钻行为。
- `task-trace-evaluation`: Task/Trace 列表与详情、Result Eval、Evidence、Trace Timeline、Observation Details 和人工 Override 工作流。
- `case-dataset-governance`: Case/Badcase 分类、根因与责任标注、人工 Note、Badcase 确认和 Golden Dataset 管理。
- `benchmark-regression`: Dataset 驱动的 Benchmark/Regression 运行、版本结果对比、回归 Case 列表和 A/B Trace 对比。
- `evaluation-configuration`: 结果评测、过程评测和性能指标的配置、版本、启用状态、证据要求与阈值展示。

### Modified Capabilities

无。当前 `openspec/specs/` 中没有既有能力规格。

## Impact

- 影响当前空项目的前端源码、路由、组件、样式和 Mock Data 层；预计建立 Vite/React/TypeScript/Tailwind 的可运行 Demo。
- 可引入轻量图表和图标依赖，但不需要后端 API、数据库、登录、真实 Langfuse 或外部评测服务。
- 需要定义统一的 Task、Trace、Observation、Eval、Case、Dataset、Benchmark 和筛选状态类型，供所有页面共享。
- 产物面向桌面端 1440px 工作台，同时保持基本响应式约束；视觉基调为高信息密度的 AI Infra/Observability Dashboard，避免营销式渐变和装饰。
