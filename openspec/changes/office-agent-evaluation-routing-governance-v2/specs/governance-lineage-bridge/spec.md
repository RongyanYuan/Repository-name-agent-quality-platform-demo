## Purpose

把新的批量评测和分流对象接入既有 Case、Issue、Cluster、Variant、Experiment、Gate 与 Release 关系，保证治理平台可正向处理问题，也可从发布版本反查原始 Trace 证据。

## ADDED Requirements

### Requirement: 评测结果可进入既有治理链路
系统 SHALL 支持从 Trace Evaluation Package 或 Evaluation Finding 创建 Issue/Issue Cluster/Variant，并保留来源 Batch、Case、Session、Trace、Evidence 和归因快照。

#### Scenario: 从问题簇创建变体
- **WHEN** 用户在已确认的 Issue Cluster 上创建 Variant
- **THEN** Variant 详情显示来源 Finding、Trace、证据、Skill Category 和创建前后的版本信息

### Requirement: 实验运行冻结评测上下文
系统 SHALL 在 Experiment Run 中冻结 Eval、Rubric、Artifact、Evidence Bundle、运行条件、数据集版本和重复次数；报告必须能回到冻结快照，不受后续编辑影响。

#### Scenario: 复查实验报告
- **WHEN** 用户打开已完成的单变体或窗口组合实验
- **THEN** 页面展示 Baseline/Candidate、数据集、评测版本、运行条件、失败 Case、风险和 Gate 决策，并可回跳原始 Trace

### Requirement: 发布版本可反查
系统 SHALL 支持从任意 Release Version 反查组合实验、变体、问题、Routing Delivery、Case、Session、Trace 和根证据，也支持从 Trace 正向查看当前处理进度。

#### Scenario: 发布版本反查来源
- **WHEN** 用户在发布版本详情点击某个变体或问题
- **THEN** 系统沿关联 ID 展示来源 Case/Trace、实验报告、准出决策和可回滚版本
