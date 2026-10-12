## Context

V1 已有 `src/evolution` 领域模型、LocalStorage store、十个治理页面和旧 URL 兼容。评测中心目前以单条过程/产物评测为中心，Case workbench 已有 Session/Trace/Evidence/归因基础，但没有批次对象、模块 Finding 或多路 Delivery。新能力需要跨越数据、状态、评测中心、Case Drawer、Overview 和既有 Issue/Variant/Experiment/Release 关系。

## Goals / Non-Goals

**Goals:**

- 在现有 `/evaluations` 中增加批次历史、批量运行/重试和全量 Trace 评测台账。
- 用一份可序列化的 Trace Evaluation Package 驱动模块评测矩阵和 Evidence Drawer。
- 以 Finding → Routing Decision → Delivery → Badcase Queue 的显式实体实现多路分流，并在 Overview、Case、Issue、Variant、Experiment、Release 间双向跳转。
- 通过 schema migration 保留 V1 LocalStorage 数据、旧 metric/route/query 参数和已有编辑记录。
- 预留真实 Trace、Eval Agent、实验运行和发布服务的 data adapter 边界，Mock 数据明确标注。

**Non-Goals:**

- 不接入真实线上服务、鉴权、数据库或真正执行 LLM Judge。
- 不虚构尚未确定的成本/延迟阈值；基线缺失使用 UNKNOWN/待配置。
- 不把 Context Assembly 恢复为独立评测维度，也不把多个 Delivery 压成互斥的单选路由。

## Decisions

### 1. 兼容扩展 EvolutionState

在 `src/evolution/domain.ts` 追加批次、Finding、Routing、Badcase 类型，旧 `Eval`/`Attribution` 字段保留并通过适配 selector 映射到新对象。采用追加字段而不是重写 V1 类型，确保已有组件和深链仍可渲染。

### 2. 批次与 Trace Package 分层

`EvaluationBatch` 保存输入集合、版本和统计；`EvaluationJob` 保存一次运行/重试；`TraceEvaluationPackage` 保存单 Trace 的过程/产物覆盖、模块结果和 Evidence Bundle。批次统计从 package selector 计算，避免手工维护分母；重试只新增 Job 和历史，不覆盖 package 的自动记录。

### 3. 模块矩阵与证据统一组件

新增可复用 `ModuleEvaluationMatrix` 与 `EvidenceBundleDrawer`，由评测中心、Case Drawer 和 Trace 详情共享。模块顺序固定为 Reason、记忆、上文、skill、Act、Tool、Outcome/产物；每格同时显示 auto/human/status/score，点击打开根证据、Rubric、Observation/Log 和首错关系。

### 4. Finding 和 Delivery 一对多

一个 package 可有多个 `EvaluationFinding`；每个 finding 可以生成多个 `RoutingDelivery`。`RoutingPolicy` 只负责计算默认标签，人工确认/驳回写入新的 decision 和 audit，不覆盖自动结果。Production Skill、Taste Skill、Personal Skill、General/Unclassified 的默认策略在 selector 中集中维护。

### 5. 归因词典快照

新增 taxonomy version、moduleCode/dimensionCode 和 labelSnapshot；UI 仅显示最新确认的中文 wording，legacyRawLabel 仅用于迁移/调试。复合归因必须拆成多个 finding，无法拆分时状态为人工复核。

### 6. 页面承载与 URL

不新增指标专用网页；`/evaluations` 使用 Batch/Trace Ledger/Process/Outcome Tabs，`/issues` 增加 Routing Delivery 与 Badcase Queue Tabs。局部筛选参数 `batchId`、`skillCategory`、`routingStatus`、`badcaseStatus`、`rubricVersion` 采用现有 query merge 机制，跳转后保留全局筛选。

### 7. 数据 migration 和 adapter

LocalStorage 根状态带 `schemaVersion`。启动时将 V1 task/trace/eval/attribution 转成 package/finding/delivery 的兼容视图，保留原始对象和审计记录；Mock repository 暴露 `listBatches`、`listTracePackages`、`createEvaluationJob`、`listRoutingDeliveries` 等接口形状，未来可替换真实 provider。

### 8. 验证策略

先为 selectors、reducer 和 URL round-trip 写 Vitest，再为评测中心和 Case Drawer 写 Testing Library 交互测试，最后用 Playwright 覆盖批次→Trace→Evidence→Delivery→Badcase→Issue/Variant/Experiment/Release 反查链路与三种视口布局。

## Risks / Trade-offs

- [Risk] V1/V2 对象并存导致数字重复 → Mitigation：所有页面只从 package/finding selectors 计算 V2 数值，并显示统计单位。
- [Risk] Mock 批次数据过于理想化 → Mitigation：覆盖 Draft/Queued/Running/Partial/Completed/Failed、缺证据和多路分流边界，并显示 Mock 标记。
- [Risk] 新 Evidence Drawer 增加移动端宽度压力 → Mitigation：桌面双栏、窄屏单列和横向滚动，Playwright 检查 scrollWidth 与关键 bounding box。
- [Risk] 归因字典变更损坏历史报告 → Mitigation：每条 Attribution/Finding 固化 labelSnapshot 和 taxonomyVersion。

## Migration Plan

1. 扩展 domain 与 migration/fixtures，不改变旧页面行为。
2. 增加 selectors/reducer 与测试，确保 V1 LocalStorage 可读且新实体可写。
3. 接入评测中心批次/台账和共享模块矩阵，再接入 Case/Overview/Issues 分流入口。
4. 桥接 Issue/Cluster/Variant/Experiment/Gate/Release 反查和 Window/Rules/Personal Skill 字段。
5. 扩充 Mock 到 30–50 Trace，运行 lint、unit、build、e2e 和视觉检查。

回滚时保留 V1 schema 和旧路由，关闭 V2 tabs/feature flag 即可；不需要外部数据回滚。

## Open Questions

未知门禁、成本基线、个人 Skill 自动生成仍按“待配置/二期规划”展示，不影响本次实现。
