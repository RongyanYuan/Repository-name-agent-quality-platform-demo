## Purpose

让模块归因路径跳转到对应Skill固定源版本或非Skill治理对象的评测与准出数据集，精确限制当前轮次的报告及对象，并保留返回原Trace评分细项和筛选的上下文。

## ADDED Requirements

### Requirement: Links SHALL preserve exact target and evolution cycle
Skill链接 SHALL 携具体Skill/固定源版本/归因/轮次；非Skill SHALL 按记忆/Reason/Act等目标对象/版本/归因筛选并清Skill范围。页面 SHALL 只显示精确关联的数据集/实验/准出状态。

#### Scenario: Navigate from a Memory attribution
- **WHEN** 用户从记忆归因查看数据集与评测
- **THEN** 保持记忆对象/归因/目标版本，不自动选中或锁定Skill，也不显示Skill其它报告

### Requirement: Return and legacy links SHALL remain coherent
返回 SHALL 恢复Trace、模块、细项与原筛选；旧Skill/版本/归因链接保持兼容，四主页面不增加。Case详情 SHALL 只有Session对话、评测中心、产物评测三个Tab；旧治理链路链接 SHALL 转到评测中心并按明确来源定位模块。

#### Scenario: Return from a filtered gate report
- **WHEN** 用户查看模块对应窗口准出报告后返回
- **THEN** 回到原模块归因详情，评分及路径准确，原列表/数据集筛选未丢失

### Requirement: Case Trace filters SHALL use exact time windows and dataset membership
Case / Trace 分析 SHALL 支持按治理时间窗口及数据集类型、具体数据集筛选。选中具体数据集后，只展示其明确 TRACE 成员及合法 CASE_SHARED 成员；不能因 Case 共享关系把其它 Trace 误加入。筛选条件 SHALL 写入独立 URL 字段并可返回恢复。

#### Scenario: Filter by a concrete evaluation dataset
- **WHEN** 用户选择“准出数据集 → 原始归因集A”
- **THEN** 列表只显示该数据集的 Trace，显示具体数据集名称/版本，返回后筛选仍保留

#### Scenario: Filter by a governance time window
- **WHEN** 用户选择一个 Window
- **THEN** 按 Trace Query 时间落在该 Window.timeRange 内筛选，不使用人工更新时间替代
