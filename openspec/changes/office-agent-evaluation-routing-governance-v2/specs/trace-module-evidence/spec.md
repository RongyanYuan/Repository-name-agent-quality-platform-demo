## Purpose

让每条 Trace 的模块评分、判定依据和根证据可独立查看，并区分自动评测、人工确认、首个失败与派生失败，避免把最终产物结果倒推成过程结论。

## ADDED Requirements

### Requirement: 模块评测使用五态状态
系统 SHALL 在 Reason、记忆、上文、skill、Act、Tool、Outcome/产物模块上支持 PASS、FAIL、DERIVED_FAIL、UNKNOWN、N/A 五态，并同时保存自动状态、人工状态、Score、Judge Reason、Eval Agent Version 和 Rubric Version。

#### Scenario: 展示 Memory 到 Context 的失败链
- **WHEN** Memory 是第一个非派生失败且 Context 仅受其传播影响
- **THEN** Memory 显示 FAIL 且标为 First Failure，Context 显示 DERIVED_FAIL 并关联 derived_from=Memory

#### Scenario: 未覆盖模块
- **WHEN** 某模块不在本次 Rubric 覆盖范围或没有足够观测
- **THEN** 模块显示 N/A 或 UNKNOWN，并提供原因，不根据最终产物状态补判

### Requirement: Evidence 包含根证据与 Rubric
系统 SHALL 为每个模块结果提供 Root Evidence、Rubric Rule、Observation、Log、First Failure、Derived Failure 关联；上下文组装只能作为证据字段或失败原因的一部分，不能作为独立评测指标。

#### Scenario: 打开模块 Evidence
- **WHEN** 用户点击 Trace 的一个模块评分
- **THEN** 详情显示 Judge Reason、Root Evidence、Rubric Rule、Observation/Log ID、输入输出摘要和自动/人工判定

#### Scenario: 人工覆盖自动结果
- **WHEN** 用户提交人工状态、分数或备注
- **THEN** 自动评测记录保持不变，系统新增人工覆盖记录、操作者、时间和原因，并在不一致时显示 Eval Disagreement
