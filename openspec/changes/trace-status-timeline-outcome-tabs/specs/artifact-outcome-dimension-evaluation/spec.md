## Purpose

让每个产物的最终评价与具体维度评分有明确归属和可复查依据，保留对应垂类Rubric、原始自动结论与追加人工历史，避免用Trace总分替代产物细项或混用多个Artifact。

## ADDED Requirements

### Requirement: Outcome tab SHALL group scores by Artifact
产物评测 SHALL 按当前Trace的Artifact分组，展示类型/版本/预览或下载边界、最终分数及具体维度0–2、Reason、Evidence、Rubric、时间与评测版本。缺失细项 SHALL 未评测，未知标准 SHALL 待配置。

#### Scenario: Multiple artifacts have different scores
- **WHEN** 一条Trace含两个不同产物
- **THEN** 切换产物只展示各自产物的维度、证据及历史，不将另一产物评分或Trace整体分数复制过来

### Requirement: Numeric scale SHALL remain explicit
旧自动0–1 SHALL 只显示转换一次，新0–2记录 SHALL 不重复转换；最终评分 SHALL 使用记录值，不从未配置规则平均细项生成。

#### Scenario: Missing total with observed dimensions
- **WHEN** 产物有细项但无最终评分
- **THEN** 细项保留实际评分，总分显示未评测，不虚构平均总分

### Requirement: Outcome dimension reviews SHALL append independently
适用产物细项 SHALL 可人工复核0–2及说明，精确绑定Trace/Artifact/Eval/自动版本，追加人员时间/Evidence/Rubric历史，自动结论和冻结报告不覆盖。失败 SHALL 保留输入，非法分数和缺说明 SHALL 拒绝。

#### Scenario: Review twice and refresh
- **WHEN** 用户保存两次不同细项评分后刷新
- **THEN** 最新值与两次历史均可查看，自动值与总分、其它产物、原发布/实验快照不变
