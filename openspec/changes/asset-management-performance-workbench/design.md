## Context

现有 `AssetsSkillsPage` 管理 Skill 和 Asset 的基础治理，但 `Asset` 没有版本、产物、Trace 或进化关系；`Skill` 的版本目录只覆盖 Skill。现有 `OutcomeEval`、`Trace`、`EvolutionRecord`、`Dataset` 和 `Window` 已能提供评分、来源和数据集关系，但需要一个统一投影来支持 Memory、Tool 和 System Prompt。

## Goals / Non-Goals

**Goals:**

- 在现有 `/assets-skills` 路由上形成资产管理工作台，保留旧深链。
- 用 URL 管理资产类型、资产、版本、搜索、预设窗口和 datetime 范围，保证刷新、返回和报告链接可复查。
- 建立统一资产目录投影，连接 Skill 版本、模块目标版本和通用资产版本。
- 用 0–2 Outcome Eval 聚合版本表现和月度趋势，贡献 Trace 按唯一 Trace ID 统计。
- 把资产进化历史精确链接到数据集与评测工作台。
- 通过本地 HTML 报告适配器预留真实报告服务。

**Non-Goals:**

- 不接入真实线上报告服务、评测 Agent、实验服务或发布服务。
- 不新增独立的问题与归因、实验与准出、能力变体或发布页面。
- 不根据评分自行推导准出阈值或上线结论。

## Decisions

1. **统一资产目录投影。** 新增 `AssetCatalogEntry`、`AssetVersionRecord`、`AssetPerformanceRecord` 作为本地数据层的可查询投影。Skill 来源使用 `Skill.versions`，Memory/Reason/Act 使用明确 `EvolutionRecord.target`，Tool/System Prompt 使用显式 Mock 目录记录并保留 `sourceKind`。选择投影而不是把所有对象硬塞进 `Asset.kind`，避免破坏现有私库资产脱敏与发布契约。

2. **评分来源固定为产物最终评测。** 版本表现从 Trace 的最终 `OutcomeEval` 读取 0–2 分；每个 Artifact 只取当前有效的最终评测记录。月度分桶优先使用 Trace `queryAt`，缺失时使用 `startedAt`，并在没有评分的月份保持空点。不会用过程分或人工未确认记录替代产物分。

3. **贡献 Trace 使用明确来源边。** 进化项的 Trace 集由 `EvolutionRecord` 的 source Finding、Attribution、Issue、Cluster 和 `ModuleEvolutionBinding` 解析；明细按进化项去重，资产总计再次按 Trace ID 去重。没有来源边的记录显示未关联，不按同 Case 或同 Skill 猜测。

4. **筛选级联与 URL 状态。** 使用 `assetType`、`assetId`、`assetVersion`、`assetQuery`、`assetTimeWindowId`、`assetTimeFrom`、`assetTimeTo` 参数。上级变化原子清除下级参数；预设 Window 与 datetime 互斥。报告链接携带完整筛选快照和返回地址。

5. **三窗口保持单页阅读。** 第一窗口是范围和报告动作；第二窗口根据 scope 在版本表现表和类别月度趋势之间切换；第三窗口只有具体资产选择后渲染进化历史。这样避免为版本、实验、数据集再创建重复详情页。

6. **报告使用本地 HTML 适配器。** `AssetReportService` 先生成包含筛选快照、表格、趋势数据和本地线上跳转链接的 HTML Blob，下载文件名包含资产和版本。真实服务接入只需替换适配器返回的 `downloadUrl/reportUrl`，演示数据明确标记为 Mock。

7. **Mock 版本覆盖。** 增加品味 Skill、生产 Skill、Memory、Tool、System Prompt 的固定版本和多月份产物评测。每条性能记录保留 traceId、artifactId、outcomeEvalId、evaluatedAt 和 evolutionRecordIds，确保图表和历史均可反查。

## Risks / Trade-offs

- [资产类型语义重叠] Tool 和 System Prompt 当前不是一等 `Asset` 类型 → 用 `sourceKind` 和来源 ID 显式区分，未关联的进化记录显示待关联。
- [评分时间与生成时间不一致] OutcomeEval 更新可能晚于 Trace → 月度趋势优先使用 Trace Query 时间，并保留评测时间用于报告审计。
- [重复分母] 一个 Trace 可能命中多个进化项 → 明细和总计分别展示，并在数据层做唯一 Trace 去重。
- [本地报告不等于真实线上报告] 当前没有外部服务 → 报告链接落到可访问的本地资产管理深链，并在报告中标注 Mock；服务接口保持可替换。
- [旧本地快照缺少资产版本] → Repository 增量补齐目录和版本记录，不覆盖人工编辑、冻结报告或用户私库资产。

## Migration Plan

1. 增加统一资产目录、版本、性能记录和报告快照的可选状态字段，补齐 Seed 版本和迁移。
2. 增加选择器与聚合函数，先通过数据层测试验证 0–2 平均分、月份、Trace 去重和进化链接。
3. 重构 `/assets-skills` 页面为三窗口工作台，保留上传、脱敏、审核和发布动作。
4. 增加 URL、下载报告、数据集返回和浏览器回归测试。
5. 失败时保留旧 `/assets-skills` 结构的本地兼容分支；不重置 localStorage、不提交或推送。
