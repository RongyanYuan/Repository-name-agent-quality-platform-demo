## Purpose

为 Skill、Trace 评测、数据集、实验、准出和进化历史提供单一治理工作台，减少页面跳转和重复维护，同时保留完整对象关联与证据反查能力。

## ADDED Requirements

### Requirement: Unified workbench SHALL provide three connected views
系统 SHALL 提供“Trace 评测”“数据集”“准出与进化历史”三个视图，并共享 Skill、进化项、来源、实验类型、冻结状态、准出状态和时间窗口筛选。

#### Scenario: Switch between connected views
- **WHEN** 用户在统一工作台切换 Trace 评测、数据集或准出与进化历史
- **THEN** 当前 Skill + 进化项筛选保持不变，列表和详情切换到对应对象集合

#### Scenario: Filter by Skill and evolution item
- **WHEN** 用户选择一个 Skill 和一个进化项
- **THEN** 三个视图只展示对应对象，并显示明确的空数据状态

### Requirement: Workbench SHALL expose the complete governance chain without duplicate ownership
统一工作台 SHALL 展示来源 Trace、Query、Session、Artifact、过程/产物评测、数据集用途、实验结果、准出决策和发布历史；问题、归因、变体、实验和发布对象 SHALL 通过 ID 反查，但不在页面中创建重复维护入口。

#### Scenario: Trace to release history
- **WHEN** 用户从 Trace 评测记录进入准出与进化历史
- **THEN** 页面可以继续查看关联问题、变体、实验、准出决策和发布版本

#### Scenario: Empty governance chain
- **WHEN** 某 Skill + 进化项没有问题、实验或发布记录
- **THEN** 页面显示“尚未形成治理链路”及可用的下一步入口，不使用 UNKNOWN 代替缺失关系

### Requirement: Gate and release states SHALL remain independent
统一工作台 SHALL 分开显示实验结果、是否准出和实际发布状态；已完成实验但未提交决策时不得显示为已准出。

#### Scenario: Completed experiment awaiting decision
- **WHEN** 实验已完成但没有 GateDecision
- **THEN** 评测结果显示已完成，是否准出显示待决策，发布状态显示未发布

### Requirement: Workbench objects SHALL preserve source and return context
所有 Trace、Case、Dataset、Experiment、Decision、Variant 和 Release ID SHALL 可点击，并支持从详情返回原视图、筛选和时间窗口。

#### Scenario: Deep link preserves context
- **WHEN** 用户打开带有对象 ID 和 Skill/进化项筛选的旧链接
- **THEN** 系统重定向到统一工作台并恢复对象详情及原筛选

