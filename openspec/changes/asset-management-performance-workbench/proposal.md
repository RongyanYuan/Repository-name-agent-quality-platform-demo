## Why

当前资产页只能管理上传、脱敏、审核和发布，无法回答某个资产版本的产物表现、Trace 贡献和进化来源。治理人员需要在一个资产范围内把版本表现、月度趋势、进化历史和数据集串起来，并能导出可复查报告。

## What Changes

- 将现有 `/assets-skills` 工作区升级为资产管理工作台，保留旧链接兼容。
- 增加资产类型 → 具体资产 → 版本的级联筛选、搜索、时间窗口和自定义 datetime 筛选。
- 增加资产版本表现表：产物平均分、进化项、去重 Trace 贡献数和数据集关联。
- 增加资产类型聚合视图：最新版本按月的 0–2 产物平均分趋势和 Trace 贡献总数。
- 增加具体资产的进化历史窗口，展示归因、版本、Trace 贡献和数据集跳转。
- 增加筛选后可用的 HTML 报告下载，报告包含有效的本地线上平台跳转链接；真实报告服务保留适配接口。
- 补齐品味 Skill、生产 Skill、Memory、Tool、System Prompt 的多版本和多月份 Mock 数据。

## Capabilities

### New Capabilities

- `asset-performance-workbench`: 资产目录、版本表现、聚合趋势、Trace 贡献、进化历史和报告导出。

### Modified Capabilities

无主规格目录；沿用现有数据集与评测、资产发布和进化记录的本地 Mock 数据层。

## Impact

主要影响 `AssetsSkillsPage`、主导航、资产/Skill 数据模型、Outcome Eval 与 EvolutionRecord 选择器、Mock Seed、URL 状态和浏览器回归测试。继续使用 React、TypeScript、Vite、Recharts 和本地 Repository，不接入真实评测、实验或发布服务。
