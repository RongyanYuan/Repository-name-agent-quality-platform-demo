## Purpose

使演示数据的 Session / Trace 身份符合长数字字符串的线上形态，并在显示、复制、搜索、URL 和历史关系中保持同一对象身份，避免 JavaScript 数值精度丢失或迁移破坏既有人工记录及冻结报告。

## ADDED Requirements

### Requirement: Canonical Mock Session and Trace IDs SHALL be long numeric strings
Mock Session ID 和 Trace ID SHALL 使用唯一、稳定的 18–24 位纯数字字符串，读写、排序、搜索与 URL SHALL 保留完整文本，不转换成 JavaScript Number 或科学计数法。Case ID 保持可读形式；Observation / Log 等组件 SHALL 支持长 ID，但本轮不强制重编号所有其他实体。

#### Scenario: Handle IDs beyond safe integer precision
- **WHEN** 两个数字 ID 只有最后一位不同且均超过 Number 安全整数范围
- **THEN** 系统将其识别为不同对象，复制、搜索和 URL 均保留末尾数字

### Requirement: Identity display SHALL support full-value inspection and copying
所有关键 Session / Trace 身份展示 SHALL 有明确类型标签、可访问完整值和复制操作。列表可视觉缩写 / 截断，详情 SHALL 可查看完整值；复制始终取完整 ID，失败 SHALL 明确提示，不冒充复制成功。

#### Scenario: Copy a truncated Trace ID
- **WHEN** 用户复制表格中被视觉截断的 Trace ID
- **THEN** 剪贴板得到完整原始字符串，界面显示复制结果且不触发所在行导航

### Requirement: Legacy aliases SHALL resolve to the same canonical objects
旧 Session / Trace ID SHALL 继续支持链接、路径参数、筛选、Session 轮次、搜索及嵌套返回地址；新生成链接使用正式 ID。alias 与正式 ID SHALL 指向同一实体，不能在列表或统计中产生重复对象。

#### Scenario: Follow a bookmarked legacy Trace link
- **WHEN** 用户打开旧 trace-workspace 或 session ID 链接
- **THEN** 仍可定位准确 Case、Trace 或 Session，正式身份为数字字符串，返回筛选保持有效

### Requirement: Identity migration SHALL preserve user edits and frozen snapshots
ID 升级 SHALL 幂等、保留旧 alias、更新当前活动引用并维持引用完整性；人工分数、说明、审计、用户自建对象和冻结实验 / 准出报告 SHALL 保留。冻结快照内的旧 ID SHALL 可通过 alias 解析，不得为了改显示而改写整个历史报告或自由文本证据。已有数字身份 SHALL 不被重新分配；alias 冲突或升级校验失败 SHALL 保留原数据、停止写回并给出诊断，不得重置为 Seed。

#### Scenario: Reload an upgraded state twice
- **WHEN** 含人工评分和旧 ID 冻结报告的本地数据连续加载两次
- **THEN** 无重复对象或事件，人工记录与冻结内容保持，活动关联及历史链接均有效

#### Scenario: Alias collision during migration
- **WHEN** 升级发现同种类 alias 指向两个不同实体
- **THEN** 系统明确提示冲突并保留原本地状态，不错误合并、覆盖或清空已有记录
