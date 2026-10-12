## Why

当前治理平台把 Trace、评测、数据集和 Skill 治理分散在多个入口，用户难以从一条已评测 Trace 直接判断来源、评分、成本和后续进化去向，也无法围绕同一个 Skill + 进化项连续查看评测集、准出集和实验状态。本次更新将这些入口收敛为可筛选、可批量操作、可反查的数据治理工作台。

## What Changes

- 重构 Trace 页面筛选顺序：Channel、垂类场景置于最前，补充过程/产物评分、进化项、Token、耗时筛选。
- 将过程评测和产物评测统一为 0–2 分制；Trace 列表展示模块、细维度、最终评分、成本、来源/数据集标签、评测状态和交付物下载链接。
- 保持列表覆盖所有已评测 Trace 与产物 Case，包括测试数据集中的 Case；关联顺序统一为 Trace → Query → Session → Artifact「产物」。
- 为 Trace 增加勾选、多选、批量导入评测集、加入 Golden Set「黄金集」能力；已属于数据集的 Case 不得重复加入。
- Trace 明细收敛为 Session、Trace 评测、产物评测和状态纵览，保留来源标签与评分证据。
- 合并“评测中心”和“数据集”入口为“数据集与评测”页面，支持 Skill + 进化项联动筛选。
- 在“数据集与评测”页面展示评测集、准出集、实验类型、数据集用途、冻结状态、时间窗口、评测结果和是否准出。
- 进化项筛选、标签和关联展示严格复用归因维度表原文，包括“能力缺乏”“skill文件不可用”“skill sop错误”“品味库召回错误”等文案，不做同义改写。
- 保留单能力变体实验与窗口版本实验的关联：原始归因集、同类泛化集、相邻及无关回归集、窗口线上数据全集、泛化集合分别展示用途。
- 删除 Skill 细项中的资产、问题与归因、实验与准出、能力变体、发布版本入口，避免与统一数据集与评测工作台重复；Skill 细项保留 Skill 基本信息、版本和评测/数据集关联。
- 保留 A/B/C 等具体数据集名称，并将“数据集名称”和“数据集用途”分列展示；增加进化项历史与通过时间。

## Capabilities

### New Capabilities

- `trace-evaluation-filtering`: 提供统一 Trace 列表、Channel/垂类/评分/进化项/成本筛选、来源标签、交付物下载和批量数据集操作。
- `dataset-evaluation-skill-workbench`: 合并数据集与评测视图，围绕 Skill + 进化项展示评测集、准出集、实验、冻结状态、时间窗口和准出结果。
- `skill-detail-surface-pruning`: 精简 Skill 细项页面，移除重复的资产、问题、实验、变体和发布治理入口。

### Modified Capabilities

<!-- No repository-level main specs currently exist for these areas; the new capabilities define the replacement contracts. -->

## Impact

- 主要影响 `src/evolution/cases` 的 Trace 列表、筛选状态、批量选择和 Trace 详情。
- 影响 `src/evolution/pages/EvaluationCenterPage.tsx`、`EvolutionDatasetsPage.tsx`、`AssetsSkillsPage.tsx` 及路由导航文案。
- 扩展本地 Mock 数据模型，补充 Channel、垂类场景、0–2 评分、数据集归属标签、评测集/准出集用途、成本字段和 Skill + 进化项关系。
- 扩展 URL 筛选状态与本地持久化，保留现有旧链接兼容；不引入真实后端或新的外部依赖。
- 需要新增单元、页面集成和端到端验收，覆盖评分筛选、批量导入、重复加入限制、来源标签和 Skill/进化项联动。
