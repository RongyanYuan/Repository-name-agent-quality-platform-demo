# Office Agent 自进化治理平台

面向 Office Agent 的可运行中文治理 Demo，覆盖从线上 Case 到发布回查的完整闭环。

线上 Case → 过程/产物评测 → 多问题归因 → 直接修复或问题聚类 → 能力变体 → 单变体实验 → 窗口组合实验 → 准出决策 → 发布与回查

## 页面

- /overview 治理总览：质量、过程、性能、风险/商业化监控，以及按 Case、问题、变体、实验和决策区分统计单位的进化漏斗。
- /cases Case / Trace 分析：Session、多轮对话、Trace 节点、日志、Evidence、Artifact、评测、归因和治理链路。
- /evaluations 评测中心：过程评测与产物评测独立列表、详情、版本、Evidence 和人工修订历史。
- /issues 归因与问题簇：一 Case 多问题、多归因、多路分发、直接优化与聚类优化。
- /variants 能力变体：来源 Case/问题簇、修改内容、版本、Evidence 与实验关联。
- /experiments 实验与准出：单变体实验、窗口组合实验、重复运行、配置快照、指标、风险与决策。
- /releases 发布版本：待发布、灰度、正式发布、观察、回滚及反向追踪。
- /assets-skills 资产与 Skill：私库/公库、脱敏、审核、发布和待建设入口。
- /datasets 数据集：归因集、泛化集、回归集、窗口线上数据集及版本。
- /rules 规则配置：触发门槛、实验次数、指标门禁和性能基线；未确定项显示“待配置”。

旧地址 /tasks、/performance、/anomaly-monitoring、/benchmarks、/evaluation-config 保留兼容跳转。

## 启动

pnpm install
pnpm dev -- --host 127.0.0.1 --port 4174

打开 http://127.0.0.1:4174/overview 。

## Mock 与真实接口边界

- 全部指标、Case、评测、问题簇、变体、实验和发布均为结构化 Mock 数据，不代表真实线上表现。
- 本地数据由带 schema version 的 Repository 和 LocalStorage 持久化，支持重置、迁移保护和审计轨迹。
- 自动评测、人工修订、实验配置快照、准出决策和发布状态分开保存。
- Mock 包含三条可追溯链：管理层 PPT 聚类进化并发布、确定性 Tool/Skill 错误直接修复、多归因多路分发。
- Trace/Langfuse、Eval Agent、实验运行、资产生成与发布服务尚未连接；数据访问层预留真实接口。
- 个人资产不会默认公开；进入公库必须经过脱敏、审核和发布。

## 待配置规则

PRD 未提供的耗时/成本基线、多数聚类门槛和指标门禁显示“待配置”，不会用虚构阈值给出效率或准出结论。品味库按 Skill 累积 100 条相关数据是明确计数条件；实验默认每 Case 运行 3 次并可配置。

## 验证

pnpm run lint
pnpm test
pnpm run build
pnpm run test:e2e
