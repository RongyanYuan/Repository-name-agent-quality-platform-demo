## Purpose

围绕同一个 Skill 与同一个进化项统一管理评测集、准出集、实验关联和历史结果，形成从数据集样本到单能力变体实验及窗口版本实验的可追溯工作台。

## ADDED Requirements

### Requirement: Dataset and evaluation views SHALL be a single linked workbench
系统 SHALL 提供统一的“数据集与评测”入口，页面上方支持 Skill + 进化项筛选；筛选结果 SHALL 同时展示对应评测集、准出集、实验类型、评测结果和是否准出状态。

#### Scenario: Filter by Skill and evolution item
- **WHEN** 用户选择一个 Skill 和一个归因维度原文进化项
- **THEN** 页面只展示该 Skill + 进化项对应的数据集、实验、评测和准出记录

#### Scenario: Show empty linked state
- **WHEN** Skill + 进化项没有关联数据集或实验
- **THEN** 页面显示明确的“暂无关联数据/尚未形成准出记录”状态，不显示 UNKNOWN 代替空关系

### Requirement: Dataset rows SHALL separate name, purpose and lifecycle metadata
数据集列表 SHALL 分列展示具体名称（如 A/B/C、回归数据集A、泛化数据集A）、数据集用途、Skill、进化项、实验类型、冻结状态、时间窗口、评测结果和是否准出；测试集 SHALL 使用进化项作为标签。

#### Scenario: Display single-variant dataset mapping
- **WHEN** 实验类型为单能力变体实验
- **THEN** 页面分别展示原始归因集、同类泛化集和相邻及无关回归集及其用途

#### Scenario: Display window-version dataset mapping
- **WHEN** 实验类型为窗口版本实验
- **THEN** 页面分别展示窗口线上数据全集和泛化集合，并标明组合实验与准出状态

#### Scenario: Preserve freeze and time window status
- **WHEN** 数据集已冻结或绑定时间窗口
- **THEN** 页面显示“已冻结/未冻结”和具体时间窗口；未配置时显示“待配置”而非虚构结论

### Requirement: Evolution history SHALL be queryable by item and time
系统 SHALL 保留同一 Skill + 进化项的进化历史记录及通过时间，并允许从数据集或准出记录反查评测 Trace、实验和来源问题。

#### Scenario: View historical evolution records
- **WHEN** 用户展开某个进化项的历史
- **THEN** 页面按时间展示评测、数据集、单能力变体实验、窗口版本实验和准出记录

### Requirement: Experiment results SHALL expose gate status independently
准出实验集合 SHALL 增加“是否准出”字段；实验结论、准出状态和实际发布状态 SHALL 分开存储和展示。

#### Scenario: Distinguish experiment result from gate decision
- **WHEN** 实验已有结果但尚未提交准出
- **THEN** 页面显示评测结果并将是否准出标记为“待决策”，不得推断为已准出

