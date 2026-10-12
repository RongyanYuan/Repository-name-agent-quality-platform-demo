## Purpose

让评测 Agent 能以可复查的批次处理 Trace 集，并让治理人员看到每条已评测 Trace 的覆盖、结果、证据完整性和后续分流状态。

## ADDED Requirements

### Requirement: 批量评测批次可追踪
系统 SHALL 支持创建包含 Trace 集、Eval Agent Version、Rubric Version、运行条件和创建人的 EvaluationBatch，并将批次状态限制为 Draft、Queued、Running、Partial、Completed、Failed。

#### Scenario: 创建待运行批次
- **WHEN** 用户选择一个或多个 Trace 集并保存批次
- **THEN** 系统显示批次 ID、输入 Trace 数、评测版本、Rubric 版本和 Draft 状态

#### Scenario: 批次完成统计
- **WHEN** 批次运行结束且至少有一条 Trace 成功评测
- **THEN** 系统展示成功、部分完成、失败、待处理数量，并将状态设为 Completed 或 Partial

### Requirement: 批次失败可重试且保留历史
系统 SHALL 为失败批次和失败 Trace 提供重试入口，并保留每次运行的状态、时间、错误原因和运行条件快照，不覆盖历史结果。

#### Scenario: 重试失败批次
- **WHEN** 用户在 Failed 或 Partial 批次上点击重试
- **THEN** 系统生成新的 EvaluationJob，原批次运行记录仍可查看，新的作业进入 Queued

### Requirement: 全量 Trace 评测台账
系统 SHALL 展示所有进入评测批次的 Trace，无论评测成功、失败、缺失模块结果或尚未处理，并支持按 Batch、Case、Session、Trace、Query、Agent/Skill 版本、Skill Category、评测覆盖、模块失败数、Evidence 完整性、Routing 状态、Badcase 状态和 Owner 筛选。

#### Scenario: 打开 Trace 台账
- **WHEN** 用户进入评测中心并选择“全部已评测 Trace”
- **THEN** 每行显示 Batch、Case、Session、Trace ID、Query、过程/产物评测覆盖、模块失败数、Evidence 完整性、Routing 状态、Badcase 状态和 Owner

#### Scenario: 空或缺失评测
- **WHEN** Trace 没有过程评测、产物评测或 Evidence
- **THEN** 对应列显示明确的 UNKNOWN、N/A 或待处理状态，而不是伪造 PASS
