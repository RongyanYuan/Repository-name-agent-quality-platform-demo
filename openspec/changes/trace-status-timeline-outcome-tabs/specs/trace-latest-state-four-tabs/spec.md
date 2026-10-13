## Purpose

为 Trace 列表及详情建立清晰一致的阅读结构，列表只展示真实最新流转状态，详情用四个职责独立的 Tab 保留对话、评测、产物与治理关联，兼容既有身份和证据链接。

## ADDED Requirements

### Requirement: Trace list SHALL show one latest actual state
列表 SHALL 删除执行 / 模块复核列，治理去向 / 最近流转列 SHALL 改为状态，只显示当前Trace最新真实流转节点名与带文字圆点。并行状态 SHALL 保留在详情；列表不推断所有问题完成。

#### Scenario: Parallel pending branch follows a released branch
- **WHEN** Trace 先发布一个变体，之后另一问题进入待处理
- **THEN** 列表显示后续真实节点状态，点击进入相同Trace治理图，已发布历史及其它卡点保留

### Requirement: Detail SHALL contain exactly four tabs
详情 SHALL 只提供Session对话、评测中心、产物评测、治理链路，默认治理链路；删除任务与关联和Trace与Evidence。公共头部只呈现一次Query/来源/时间/身份/最新状态。

#### Scenario: Open a Trace from list
- **WHEN** 用户点击某Trace
- **THEN** 打开该Trace的治理链路，四Tab互相独立且没有任务或Trace/Evidence Tab

### Requirement: Process evaluation SHALL have one scored presentation
评测中心 SHALL 保留过程模块与细项0–2、Judge Reason、Evidence及复核，排除OUTCOME行和下方独立过程框。上文 SHALL 仅为证据。

#### Scenario: Inspect and review Skill
- **WHEN** 用户查看评测中心
- **THEN** 可从skill行查看细项/Rubric和人工复核，无第二份过程评分或产物框

### Requirement: Legacy evidence links and return scope SHALL remain usable
旧task/trace/Artifact/Eval/Observation/Log/Evidence链接 SHALL 映射到正确新Tab或抽屉，切换Trace清理旧选择；返回保留分类、Skill、版本、归因、分页和数据集Drawer。

#### Scenario: Open an Observation-only old bookmark
- **WHEN** 用户打开旧非主Trace节点链接
- **THEN** 进入评测中心并展示正确Trace的节点详情，可返回来源筛选，不继承另一Trace内容
