## Why

现有 Agent Quality Demo 已能展示质量、Trace、Eval、Badcase 和 Benchmark，但不足以支撑 Office Agent 从线上 Case 形成可审计改进、实验准出和发布回查的治理闭环。本变更将产品升级为「Office Agent 自进化治理平台」，让异常、证据、归因、问题、变体、实验、决策和发布都能双向追溯并实际操作。

## What Changes

- 将主导航重构为治理总览、Case / Trace、评测、归因与问题簇、能力变体、实验与准出、发布版本、资产与 Skill、数据集和规则配置，并保留旧深链兼容。
- 建立结构化、可持久化的本地治理数据层，覆盖 Session 至 Release Version 的全部实体、关系、快照与审计记录，并预留 Trace/Langfuse、Eval Agent、实验运行与发布服务端口。
- 让总览的质量、过程、性能、风控/商业化和进化漏斗支持全局筛选、正确的统计单位与保留上下文的下钻。
- 提供统一 Case / Trace 工作台，包含 Session 多轮、精确 Trace / Observation / Log / Evidence、产物、Skill / Tool、评测和治理进度，支持 URL 深链、筛选保留和人工操作。
- 将过程评测与产物/结果评测分开管理，保存版本、时间、分数/结论、判定依据、Evidence 与不覆盖历史的人工 Revision。
- 允许一个 Case 产生多个问题并多路分发，支持直接优化、聚类优化、品味库 100 条口径、二期去向和未定规则的「待配置」状态。
- 实现问题簇到变体、单变体实验、窗口组合实验、准出报告、发布/灰度/观察/回滚的可操作生命周期，冻结实验配置与决策证据。
- 展示 Skill 和资产的版本、私库/公库与进化记录，个人资产进入公库必须经过脱敏、审核和显式发布；未建设生成服务仅提供规划入口。
- 明确 Mock 数据边界，对空数据、缺失评测、实验未运行、多标签和待定规则给出可见状态，不伪造真实线上结论。

## Capabilities

### New Capabilities
- `governance-shell-and-overview`: 平台信息架构、全局筛选、治理总览、性能/安全信号、进化漏斗和可保留上下文的下钻。
- `case-trace-and-evaluation-governance`: Case / Session / Trace / Observation / Log / Artifact / Eval / Evidence 的联合分析，过程与结果评测独立管理，人工 Revision 与双向导航。
- `attribution-clustering-and-variants`: 多问题归因、多路分发、直接/聚类优化、问题簇触发规则和不丢失溯源的能力变体。
- `experiments-gates-and-releases`: 单变体/窗口组合实验、可复现配置快照、重复运行、指标对比、准出报告、发布状态和完整逆向回查。
- `skills-assets-datasets-and-rules`: Skill/资产治理、私库入公库安全流程、待建设生成入口、版本化实验数据集和可配置/待定规则。
- `local-governance-data-and-lineage`: 完整领域实体图、双向关系、本地持久化、审计、结构验证、Mock 种子与外部服务适配边界。

### Modified Capabilities

无。当前主规范目录为空；过往完成 change 仅作为实现背景，本变更以新 capability 建立完整自进化治理契约。

## Impact

- 前端路由、导航、全局筛选、所有治理页面与共享 UI 组件。
- 新增 `EvolutionState` 领域层、Repository/Store/Selector/Validator 与 LocalStorage schema，以及 Trace、Eval、Experiment、Release 的适配端口。
- 需重新校验旧 URL 参数、现有 QualityStore 与新治理 Store 之间的作用域一致性。
- 无新的运行时依赖或真实后端要求；所有业务数据仍必须明确标识为 Mock。
