## Purpose

为所有已评测 Trace 和产物 Case 提供统一的可追溯筛选、评分、来源和批量数据治理能力，使用户能够从 Trace 直接判断评测结果、成本和后续数据集去向。

## ADDED Requirements

### Requirement: Trace filtering SHALL expose channel, scenario, score, evolution and cost dimensions
Trace 页面 SHALL 将 Channel 和垂类场景放在筛选区最前，并支持小程序、genflow pc 端、genflow 垂类入口，以及 PPT、Word、Excel、生图选项；过程评分、产物评分、进化项、Token 消耗和耗时 SHALL 可组合筛选。

#### Scenario: Filter Trace by channel and vertical scenario
- **WHEN** 用户选择 Channel“genflow pc 端”和垂类场景“PPT”
- **THEN** 列表只展示同时满足两个条件的已评测 Trace，并保留筛选条件到 URL 与返回路径

#### Scenario: Filter by score range
- **WHEN** 用户输入过程最终评分 1.0–2.0 或产物细维度评分 0–1.0
- **THEN** 列表只展示对应分值范围内的 Trace，所有评分输入和展示范围均为 0–2

#### Scenario: Filter by exact attribution wording
- **WHEN** 用户按进化项筛选
- **THEN** 选项与归因维度表“归因（洞察）维度”原文逐字一致，包括括号、大小写和中文标点

### Requirement: Evaluated Trace rows SHALL show complete lineage and normalized scores
每条 Trace 行 SHALL 按 Trace → Query → Session → Artifact「产物」顺序展示关联信息，并展示具体来源/数据集归属标签、过程模块与细维度评分、过程最终评分、产物细维度与最终评分、Token、耗时、评测/进化状态、Query 时间和交付物下载链接。

#### Scenario: Show online and dataset provenance
- **WHEN** Trace 来自线上、回归数据集A或泛化数据集A
- **THEN** 行内显示对应来源标签，不以 UNKNOWN 替代可确定归属

#### Scenario: Keep all evaluated traces in scope
- **WHEN** 用户打开 Trace 列表且未设置筛选
- **THEN** 列表包含线上 Trace 和测试数据集中的已评测 Trace/产物 Case

#### Scenario: Download artifact from a trace row
- **WHEN** Trace 存在可用交付物
- **THEN** 行内提供可点击下载链接；缺少交付物时显示明确的不可用状态

### Requirement: Trace selection SHALL support safe bulk dataset actions
每条 Trace 前 SHALL 提供勾选框；用户可多选 Trace 批量导入评测集或加入 Golden Set「黄金集」。已属于任一数据集的 Case SHALL 被阻止重复加入，并展示阻止原因。

#### Scenario: Bulk import selected traces
- **WHEN** 用户勾选多条 Trace 并选择批量导入评测集
- **THEN** 系统创建或更新对应评测集成员，并保留每条 Trace 的来源与评分关联

#### Scenario: Prevent duplicate dataset membership
- **WHEN** 用户选择已属于数据集的 Case 再次加入 Golden Set
- **THEN** 系统不重复写入成员，并提示该 Case 已属于具体数据集

### Requirement: Trace detail SHALL be concise and evaluation-focused
Trace 明细 SHALL 仅保留 Session、Trace 评测、产物评测和状态纵览；过程与产物评测均 SHALL 展示细维度、最终评分、评分依据和可追溯证据。

#### Scenario: Open evaluated trace detail
- **WHEN** 用户点击 Trace 行
- **THEN** 打开包含 Session、Trace 评测、产物评测和当前状态的详情，并可回到原筛选列表

