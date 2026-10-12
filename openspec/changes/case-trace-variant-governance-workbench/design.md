## Context

当前应用已经有 V2 `TraceEvaluationPackage`、`EvaluationFinding`、Routing Delivery、Issue/Cluster/Variant、Experiment/Window/Gate/Release 实体和 LocalStorage 持久化。Case 页面已经能展示 Session、Trace、Evidence 与模块矩阵，但列表入口仍把多个裸 ID 放在 Query 单元中；Variant 页面仍是混合平表，Skill/资产和问题簇页面保留了分散的变体入口。新设计必须复用现有实体、稳定 ID 和 URL 状态，不引入后端或新的状态存储。

## Goals / Non-Goals

**Goals:**

- 用单一 Case 详情上下文承载 Trace、过程/产物评测、Evidence、来源和治理链路。
- 让多 Trace Case 的当前 Trace 成为唯一评测和 Evidence 上下文。
- 让 `/variants` 成为按 Skill Category 分区的能力变体工作台，并聚合现有 Window、Experiment、Gate、Release 关系。
- 通过语义化对象链接、统一来源/状态文案和 URL query merge 保留返回路径。
- 保持已有 V2 数据、人工修订、实验快照和 LocalStorage 兼容。

**Non-Goals:**

- 不接入真实 Trace/Langfuse、Eval Agent、实验运行或发布服务。
- 不把 Context Assembly 恢复为独立评测指标。
- 不改变 PRD 未确定的准出、成本、时延和聚类阈值。
- 不把 1000/950 偏好比例当作准出门禁，也不把非偏好用户自动标记为 Badcase。

## Decisions

### 1. Case 详情采用“主操作 + 语义关联”的导航模型

列表 Query 单元只保留 Query、来源标签和“查看完整 Case”主按钮；Session、Trace、Evidence、Log 用带动词的次级按钮。主按钮打开 Drawer/详情并默认选择 `Trace 与 Evidence`，已有 `caseId`、`traceId`、`observationId`、`evidenceId` URL 参数继续通过现有路由适配。

备选方案是把每个 ID 继续作为蓝色裸链接，但这无法表达链接意图，也不能满足人类阅读路径验收，因此不采用。

### 2. 用 CaseAnalysisRecord 的 Trace 映射承载当前 Trace

在 Case 分析模型中建立 `traceId → moduleEvaluations / findings / scenarios / evidence` 的派生映射。详情使用 `selectedTraceId` 状态；切换 Trace 时仅替换活动 Trace 和映射数据，不复制或修改领域实体。这样保持现有 package 数据不可变，也能避免多 Trace 详情继续读取 primary Trace 的评分。

### 3. 来源标签由显式字段优先、历史数据派生兜底

Case 增加可选 `sourceType` 快照；新 Mock/本地创建 Case 直接记录 `ONLINE_WINDOW`、`GOLDEN_DATASET` 或 `MOCK_SET`。旧记录由 batch/dataset/window 关系派生并映射到同一展示字典。发现方式不写进 sourceType，而由 finding/feedback/error 来源单独展示。

### 4. Variant 工作台使用 selector 聚合，不复制实体

新增变体工作台 selector，按 `Skill.category` 分组 Skill 行，再从 Skill 的 `evolutionRecordIds`、Variant source IDs、Window candidate IDs、Experiment variant IDs、Gate 和 Release 反查状态。Variant 详情在同一页面呈现生命周期链路；AttributionClustersPage 和 AssetsSkillsPage 的创建/进化入口只带 source query 跳转到 `/variants`。

备选方案是新增 Variant/Skill 关系表并同步写入所有对象；这会增加迁移和双写不一致风险，因此优先使用现有反向关系并只在必要时保存不可变快照。

### 5. 术语映射集中维护

新增展示层 label maps：Case source、Skill category、Variant status、Optimization mode、Routing label、Experiment/Gate/Release status。数据层保留稳定英文枚举和历史 wording，页面不直接渲染内部枚举，避免同一状态在不同页面出现不同中文。

### 6. URL 作为返回上下文的唯一序列化边界

沿用 `useContextNavigation`、Case local filter merge 和现有 `DETAIL_KEYS`。跳转只新增目标对象 ID、Section/Skill/Window 参数，不清理时间范围、环境、Agent 版本和页面筛选；Back/Close 读取上一层 location 恢复同一行和折叠状态。

### 7. 验证采用行为测试和人类路径测试

单测覆盖 source mapping、Trace 映射、Variant selector 和术语映射；Testing Library 覆盖主按钮、语义链接、Section 收起/展开和当前 Trace 同步；Playwright 覆盖完整 Case → Finding → Delivery → Variant → Experiment/Gate/Release、品味触发路径、生产 Skill Badcase 路径和 1440/1024/390 视口。

## Risks / Trade-offs

- [Risk] 旧 LocalStorage 缺少 `sourceType` 或 Skill/Variant 直接关系 → Mitigation：显式字段优先、关系派生兜底，并在迁移中只补新字段，不覆盖人工变更。
- [Risk] 一个 Case 多 Finding、多 Delivery 使详情信息密度过高 → Mitigation：使用分组 Section、可折叠 Evidence/治理链路和语义化摘要，保持主路径单列。
- [Risk] Skill 行聚合无法表达多个候选 Variant → Mitigation：Skill 行展示聚合状态，展开后展示 Variant 子行；详情保留每个 Variant 的不可变来源。
- [Risk] 旧链接仍传递裸 ID → Mitigation：保留兼容 query 参数，并在拥有页面内部转换为语义化按钮/标签。
- [Risk] Mock 数据与真实服务边界被误解 → Mitigation：页面保留 Mock 标记，规则/门禁未配置时明确显示“待配置”。

## Migration Plan

1. 增加展示层 selector、来源/术语映射和 CaseAnalysisRecord 的 Trace 映射，不改变现有领域对象 ID。
2. 增加旧 LocalStorage 的增量迁移：补 sourceType、Variant 关系派生和新的 workbench query 参数，保留人工标注与审计。
3. 先切换 Case 列表/详情入口，再切换 `/variants` 工作台，最后移除重复创建入口（保留跳转兼容）。
4. 运行单测、构建、Playwright 和三视口检查；若发现问题，关闭新工作台入口即可回退到原页面，数据仍可由旧 selector 读取。

## Open Questions

- PRD 未明确的其他能力 Section 是否需要按 Reason、Memory、Act/Tool 再细分；本变更先统一收纳到“其他能力”，不改变数据模型。
- 真正线上 Case 的 sourceType 如何由外部 Batch/Dataset/Window 服务赋值，保留 adapter 接口，当前继续使用本地派生规则。
