## Purpose

把模块评测 Finding 按 Skill 分类和既定策略分发到算法 Badcase、Agent 迭代、品味库和 Personal Skill 队列，并允许同一 Trace 的多个问题同时进入不同处理链。

## ADDED Requirements

### Requirement: Skill 分类和中文归因稳定
系统 SHALL 使用 PRODUCTION_SKILL、GENERAL、PERSONAL_SKILL、TASTE_SKILL、UNCLASSIFIED 五类 Skill Category，并严格使用 PRD 归因字典的模块与维度 wording，复合标签必须拆分或进入人工复核。

#### Scenario: Production Skill 失败归因
- **WHEN** Production Skill 的 Finding 为 FAIL
- **THEN** 系统生成 `策略迭代` 的 Routing Decision，并创建算法 Badcase Candidate

#### Scenario: 品味 Skill 失败归因
- **WHEN** Taste Skill 的 Finding 为 FAIL
- **THEN** 系统生成 `Agent迭代` 的 Routing Decision，并投递品味库队列

### Requirement: 多路分流不互斥
系统 SHALL 允许一个 Trace/Case 产生多个 EvaluationFinding、RoutingDecision 和 RoutingDelivery；同一记录可同时投递算法 Badcase、Issue Cluster、Personal Skill 规划或直接修复验证。

#### Scenario: 多模块、多路投递
- **WHEN** 同一 Trace 同时命中 Skill 失败和 Tool 确定性错误
- **THEN** 系统分别创建 Skill 的 Agent/策略分流和 Tool 的直接优化验证投递，并在详情中显示两条独立去向

### Requirement: Badcase 队列支持确认
系统 SHALL 将自动生成的算法 Badcase Candidate 置为待确认，允许人工确认、驳回、补充 Owner、备注和关联回归数据集；确认结果必须保留自动判断和人工操作记录。

#### Scenario: 确认算法 Badcase
- **WHEN** 用户在 Badcase Queue 打开 Candidate 并点击确认
- **THEN** 状态变为 Confirmed，显示算法团队 Owner、来源 Trace/证据和后续 Issue/Cluster/Variant 关联入口

### Requirement: 归因字典保存版本快照
系统 SHALL 在 Attribution 中保存 moduleCode、dimensionCode、dimensionLabel、description、optimizationDimension、selectedOptimizationCondition、taxonomyVersion、labelSnapshot 和 legacyRawLabel，确保后续字典变更不影响历史报告。

#### Scenario: 查看历史归因
- **WHEN** 用户查看已完成实验或发布版本反查的旧 Attribution
- **THEN** 页面展示当时的 labelSnapshot 和 taxonomyVersion，而不是用当前字典重算
