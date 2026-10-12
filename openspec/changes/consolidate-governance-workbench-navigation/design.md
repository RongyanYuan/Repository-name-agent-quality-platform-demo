## Context

当前项目已存在 `DatasetEvaluationWorkbenchPage` 初版，以及独立的 EvaluationCenter、EvolutionDatasets、AssetsSkills、AttributionClusters、Variants、ExperimentsGates、Releases 页面。治理实体和本地持久化已经成熟，本次只调整页面边界、导航和详情投影。

## Goals / Non-Goals

**Goals:**

- 让“数据集与评测”成为 Skill、评测、数据集和治理历史的唯一主要入口。
- 通过三个内部视图承载 Trace 评测、数据集生命周期和准出/进化历史。
- 保留所有对象 ID、深链、Evidence、人工标注、实验快照和发布状态。
- 让旧 URL 可迁移，避免用户收藏链接失效。

**Non-Goals:**

- 不删除 EvolutionState 中的问题、归因、变体、实验、Gate 或 Release 实体。
- 不在本次变更中接入真实后端或重新设计质量总览。
- 不改变现有评测评分、归因 taxonomy 和数据集分母口径。

## Decisions

### 1. 统一页面使用内部视图，不拆分新路由

使用 `/datasets-evaluations` 作为正式入口，内部 Tab 通过 URL 参数表达，如 `view=traces`、`view=datasets`、`view=history`。这样可以共享 Skill + 进化项筛选，避免三个页面各自维护一套状态。

### 2. 旧页面保留为兼容重定向

旧页面不再出现在主导航，但路由仍存在。根据对象参数和旧页面类型转换到统一工作台的对应视图；无法映射的旧筛选保留在 `returnTo` 或兼容参数中。

### 3. 问题、变体、实验和发布采用详情投影

统一工作台只展示关联对象和状态摘要；点击 ID 打开统一详情 Drawer 或 owning context。创建/编辑动作不在这些摘要区重复实现，使用现有治理服务和数据层能力。

### 4. Skill 详情保留身份与入口

Skill 详情只承担身份确认和导航，不再渲染资产、问题、变体、实验、发布历史。资产页若仍保留内部访问，只作为后台兼容页面，不出现在 Skill 详情和主导航。

## Risks / Trade-offs

- [Risk] 用户习惯旧入口 → [Mitigation] 旧路由重定向并显示统一页面的对应 Tab。
- [Risk] 统一页面数据密度较高 → [Mitigation] 使用三个内部视图、折叠详情和明确对象单位，避免一次性堆叠全部字段。
- [Risk] 历史对象没有完整映射 → [Mitigation] 保留对象 ID 和“尚未形成治理链路”状态，不虚构关联。

## Migration Plan

1. 扩展统一工作台视图和 URL 状态。
2. 更新主导航，移除冗余入口。
3. 增加旧路由转换和对象深链兼容。
4. 精简 Skill 详情，并保留资产页内部兼容能力。
5. 运行单元、集成、E2E 和构建验证。
