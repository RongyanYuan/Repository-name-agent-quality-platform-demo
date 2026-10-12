## Why

当前平台把 Skill、评测中心、数据集、问题与归因、实验与准出、能力变体、发布版本拆成多个入口，导致同一条进化链路被重复浏览和维护。用户希望将治理工作收敛到“Case / Trace”与“数据集与评测”两个核心工作台，并保留完整对象反查能力。

## What Changes

- 将 Skill、评测中心、数据集融合为统一“数据集与评测”页面。
- 在统一页面内提供三个视图：Trace 评测、数据集、准出与进化历史。
- 统一页面顶部提供 Skill、进化项、来源、实验类型、冻结状态、准出状态和时间窗口筛选。
- 从统一页面支持查看 Skill 基本信息、评测集、数据集用途、实验结果、准出决策和来源 Trace。
- 从 Skill 详情移除资产、问题与归因、实验与准出、能力变体、发布版本等重复治理区块，只保留身份信息和统一工作台入口。
- 主导航移除问题与归因、实验与准出、能力变体、发布版本、独立资产与 Skill 页面，保留治理总览、Case / Trace、数据集与评测、规则配置等核心入口。
- 保留问题、归因、变体、实验、准出和发布实体作为数据层及历史反查对象，不删除治理关系。
- 旧 `/evaluations`、`/datasets`、`/assets-skills`、`/issues`、`/variants`、`/experiments`、`/releases` 链接继续兼容，并重定向到统一工作台对应视图。

## Capabilities

### New Capabilities

- `consolidated-dataset-evaluation-workbench`: 提供统一的 Trace 评测、数据集、实验、准出和进化历史工作台。
- `governance-navigation-consolidation`: 收敛主导航、旧路由和对象反查路径，避免重复页面。

### Modified Capabilities

<!-- Existing repository specs are stored only in completed change artifacts; this change introduces replacement contracts rather than editing a main spec. -->

## Impact

- 影响 `src/layout.tsx`、`src/App.tsx` 的主导航、路由、对象反查和兼容重定向。
- 扩展 `DatasetEvaluationWorkbenchPage`，接入 Trace 评测、Skill 筛选、数据集和准出历史。
- 精简 `AssetsSkillsPage`，保留 Skill 身份与统一工作台入口。
- 继续使用现有 EvolutionState、Mock 数据、URL 状态和本地持久化，不引入后端依赖。
- 更新页面集成测试、对象深链测试和 Playwright 导航验收。
