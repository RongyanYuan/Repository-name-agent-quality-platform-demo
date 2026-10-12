## Purpose

将治理平台的主导航和页面边界从多个重复台账收敛为少量清晰入口，并保留旧链接兼容，降低用户理解和维护成本。

## ADDED Requirements

### Requirement: Primary navigation SHALL remove redundant governance pages
主导航 SHALL 不再展示问题与归因、实验与准出、能力变体、发布版本和独立资产与 Skill 页面；主导航至少保留治理总览、Case / Trace、数据集与评测、规则配置。

#### Scenario: Render consolidated navigation
- **WHEN** 用户打开平台
- **THEN** 主导航显示数据集与评测，且不显示上述五个冗余页面入口

### Requirement: Legacy routes SHALL redirect to the unified workbench
系统 SHALL 兼容 `/evaluations`、`/datasets`、`/assets-skills`、`/issues`、`/variants`、`/experiments` 和 `/releases`，并将它们重定向到统一工作台的对应视图，同时保留查询参数和对象 ID。

#### Scenario: Open a legacy variant link
- **WHEN** 用户打开包含 `variantId` 的 `/variants` 链接
- **THEN** 系统跳转到统一工作台的准出与进化历史视图，并打开对应变体详情

#### Scenario: Open a legacy dataset link
- **WHEN** 用户打开包含 `datasetId` 的 `/datasets` 链接
- **THEN** 系统跳转到统一工作台的数据集视图，并保留时间范围、环境和来源筛选

### Requirement: Skill detail SHALL be an identity surface only
Skill 详情 SHALL 保留 Skill ID、名称、分类、版本、归属、更新时间和统一工作台入口；不得在 Skill 详情重复展示资产、问题与归因、实验与准出、能力变体或发布版本台账。

#### Scenario: Open Skill detail
- **WHEN** 用户点击 Skill
- **THEN** 打开轻量 Skill 详情并提供“打开数据集与评测”按钮

