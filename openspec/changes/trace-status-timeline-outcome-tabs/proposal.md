## Why

Trace 列表把执行、复核与所有治理分支混在一起，详情重复呈现过程与产物评测；带日期的事件卡片仍无法直观看出分叉和卡点。用户已确认本轮方案并要求开始修改，需要收敛到单一最新状态、四个详情 Tab 和真实时间分支图。

## What Changes

- 列表删除执行 / 模块复核列，治理去向 / 最近流转改为状态，只展示最新有明确时间的实际节点，点击进入治理链路。
- 详情删除任务与关联、Trace 与 Evidence；保留 Session 对话、评测中心、产物评测、治理链路四个 Tab，默认治理链路。
- 过程评测只保留模块及细项评分、Reason、Evidence 与人工复核；删除下方重复过程框与 Outcome 行。
- 按 Artifact 单独展示产物信息、最终分数、垂类细项、Rubric、Evidence、评测时间 / 版本和人工修订历史，0–2 量纲明确。
- 治理区域改为横向时间轴与分支图，支持缩放、滚动、当前节点定位、节点详情；缺时间、Case 共享、用于验证分别标识。
- 保留数字 ID / alias、旧链接与返回筛选、追加人工历史和冻结快照；新增 Mock 细项只表达演示，未知标准仍待配置。

## Capabilities

### New Capabilities

- `trace-latest-state-four-tabs`: 最新状态列、四个详情职责、兼容路由与证据抽屉。
- `artifact-outcome-dimension-evaluation`: 产物归属明确的细项评分、Rubric / Evidence 和追加复核。
- `temporal-governance-branch-graph`: 时间定位、明确流转关系、分支卡点和可交互节点详情。

### Modified Capabilities

无主规格目录；本轮替代上一 change 的五 Tab 展示要求，保留其数据保护和身份契约，不改写已交付历史文件。

## Impact

沿用 React / TypeScript / Vite / Tailwind 与现有 Repository。影响 Case 列表、详情、评分投影、产物 Mock、治理事件图、路由与相关测试。四个主导航不变，无新增真实服务、业务阈值、提交或推送。
