## Purpose

将当前Trace真实流转历史呈现为有时间轴和明确连接关系的横向分支图，使使用者理解每次流程推进、分流及卡点；时间缺失或共享/验证关联保持独立语义，不构造虚假的治理因果。

## ADDED Requirements

### Requirement: Graph SHALL position events by actual time and relation
治理链路 SHALL 用横向时间轴、纵向分支及连线展示真实事件；节点显示时间/阶段/状态，各分支当前节点有外圈。连接 SHALL 基于明确父节点或可证实来源关系，不只因时间邻近。

#### Scenario: One finding routes to algorithm and Agent iteration
- **WHEN** Trace进入两路处理且一路失败
- **THEN** 图展示分叉及各自后续流程，失败红色卡点和另一路待处理同时可见

### Requirement: Graph SHALL support actual interaction
图 SHALL 支持滚动、缩放、适配全程、定位当前节点和可访问的节点详情；节点详情呈现操作者、原因、Evidence和对象ID，数据集节点展示名称版本用途冻结/加入时间。

#### Scenario: Inspect a dataset enrollment node
- **WHEN** 用户点击加入数据集节点
- **THEN** 展示真实成员范围、加入时间及后续实验关联，可跳转并返回相同Trace上下文

### Requirement: History uncertainty and repeated events SHALL be explicit
缺发生时间 SHALL 在图外显示未记录，不把updatedAt当发生时间；Case共享和用于验证 SHALL 虚线标识；重跑/复核/拒绝/发布/回滚 SHALL 保留独立节点，不覆盖旧历史。无记录的未来阶段 SHALL 不生成事件。

#### Scenario: A regression Trace has no problem-source relationship
- **WHEN** Trace仅作为回归验证样本
- **THEN** 可查看实验关联但不显示该Trace发起变体或问题已随发布解决
