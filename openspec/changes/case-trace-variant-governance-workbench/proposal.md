## Why

当前 Demo 的 Case / Trace 列表在 Query 下同时堆叠 Case、Session、Trace 等裸 ID，用户无法快速判断每个链接的用途；打开 Case 后也不能以清晰的主路径一次看到完整 Trace、过程/产物评测、Evidence 和 Case 来源。能力变体又分散在问题簇、Skill/资产和变体页面，品味 Skill、生产 Skill 与实验窗口之间缺少统一阅读模型，导致治理链路难以理解和复查。

本次变更把“人类从异常到治理”的阅读路径统一为：Case → 完整 Trace / 评测 → 来源与证据 → Finding / 分流 → 问题簇或直接修复 → 能力变体 → 实验窗口。所有文案、来源标签和跳转入口严格遵循现有 PRD 与已落地的 V2 领域模型。

## What Changes

- 重构 Case / Trace 列表的 Query 单元：Query 作为主内容，提供明确的“查看完整 Case”入口；Case ID、Session、Trace、Evidence、Log 作为带语义的次级关联入口，不再并列显示为难以理解的裸链接。
- 将 Case 详情默认入口统一为“Trace 与 Evidence”，在同一详情中展示完整 Trace Timeline、当前 Trace 的模块评测矩阵、过程评测、产物/结果评测、LLM Judge Reason、Root Evidence、Rubric、Observation、Log、Finding、Routing Delivery、问题簇、变体与实验链路。
- 修复多 Trace Case 的上下文同步：切换 Trace 后，Trace Timeline、模块评分、Findings、Evidence 和评测场景必须全部跟随当前 Trace；Session 对话中的每个 Query 继续保留对应 Trace 入口。
- 统一 Case 来源字典及展示：`ONLINE_WINDOW` 显示“线上+时间窗口”，`GOLDEN_DATASET` 显示“黄金测试集”，`MOCK_SET` 显示“mock集”；来源与发现方式（Auto Eval、User Feedback、System Error、Manual Review）分开呈现。
- 统一 Finding/归因跳转语义：Finding 进入“归因与问题簇”的对应 Delivery/Finding 详情，Issue、Issue Cluster、Variant、Experiment、Gate、Release 使用各自明确的对象名称和反查入口。
- 将 `/variants` 重构为统一“能力变体工作台”：
  - “品味 Skill” Section：按 Skill 行展示 Skill ID/名称、当前版本、候选变体、当前状态、最近更新时间、偏好/相关数据进度、窗口、单变体实验、组合实验、准出和发布状态。
  - “生产 Skill” Section：按 Skill 行展示生产 Skill 版本、候选版本、状态、最近更新时间、算法 Badcase 数、策略迭代路径、来源 Finding/Issue/Cluster、实验与发布状态。
  - 其他能力（Reason、Memory、Act/Tool、Personal Skill 规划）收纳为可折叠 Section，采用相同字段结构。
- 在能力变体工作台中集中展示生命周期：来源 Case / Finding / Issue → 修改内容与版本 → 单变体实验 → 窗口组合实验 → Gate → Release；资产与 Skill 页面只保留基础治理和跳转入口，不重复实现变体生命周期。
- 统一中文术语和状态：生产 Skill、品味 Skill、线上+时间窗口、黄金测试集、mock集、直接优化、聚类优化、策略迭代、Agent 迭代、待配置、未复核、派生失败等文案在列表、详情、筛选器和 Drawer 中保持一致。
- 增加人类阅读路径验收：Case → 完整 Trace → Evidence → Finding → Delivery → Issue/Cluster → Variant → Experiment/Gate/Release，以及品味 Skill → 100 条相关数据触发 → 单变体实验；同时检查无障碍名称、空数据、缺失评测和返回/筛选条件保留。

## Capabilities

### New Capabilities

- `case-trace-reading-clarity`: 统一 Case / Trace 列表入口、完整 Case 详情、Trace/Evidence 默认路径、来源标签与多 Trace 同步。
- `variant-governance-workbench`: 统一品味 Skill、生产 Skill 和其他能力变体的分区、Skill 行视图、实验窗口状态与完整反查链路。
- `governance-terminology-and-navigation`: 统一对象命名、状态/来源文案、语义化关联入口、筛选条件保留和人类阅读路径验收。

### Modified Capabilities

- None. Existing capability specs are change-local artifacts from completed changes rather than shared main specs; this change introduces explicit delta capabilities and preserves the existing V2 contracts.

## Impact

- 主要影响 `src/evolution/cases/CaseAnalysisWorkbench.tsx`、`src/evolution/cases/model.ts`、`src/evolution/pages/VariantsPage.tsx`、`src/evolution/pages/AssetsSkillsPage.tsx`、`src/evolution/pages/AttributionClustersPage.tsx`、`src/evolution/components/ViewPrimitives.tsx`、`src/App.tsx` 与对应 Mock selector/domain 测试。
- 需要为 Variant/Skill/Window/Experiment/Gate/Release 增加统一的派生选择器或展示适配，但不破坏现有 ID、LocalStorage schema、人工标注和实验快照。
- 不新增真实后端；继续使用结构化 Mock、LocalStorage 和可替换 adapter。PRD 尚未确定的准出门禁、成本/时延阈值继续显示“待配置”。
- 不恢复 Context Assembly 为独立评测指标；Context 只在 Judge Reason、Evidence 和派生失败关系中呈现。
