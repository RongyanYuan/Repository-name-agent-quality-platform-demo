## Purpose

在过程模块及细项二级评测详情中呈现可进化、分流、准出和上线四个独立阶段，使使用者理解当前归因的实际进度与条件，保留每次事件时间及证据，避免评分、准出与发布语义混同。

## ADDED Requirements

### Requirement: Every associated path SHALL expose four independent stages
模块表 SHALL 显示进化摘要和详情入口，二级详情 SHALL 按归因/处理路径展示是否可进化、流转至策略或Agent、准出及上线，含状态/时间/原因/对象ID及历史。策略和Agent SHALL 分行。

#### Scenario: One attribution is distributed twice
- **WHEN** 同Finding进入策略与Agent迭代
- **THEN** 一路待回传和另一路已准出待上线分别显示，不用一个状态覆盖

### Requirement: Eligibility SHALL use configured PRD conditions
可进化 SHALL 使用确认归因及PRD直接/聚类方式与已配置规则，低分只作候选线索；无门槛 SHALL 待配置，聚类显示明确数量/单位/口径。上文 SHALL 仅证据，无评分或进化阶段。

#### Scenario: Low score has no configured trigger
- **WHEN** 模块低分但归因未确认或门槛未配置
- **THEN** 显示待确认/规则待配置，不擅自认定可进化

### Requirement: Module selection SHALL show direction-specific complete history
评测中心的模块名与普通行 SHALL 打开该模块的归因方向列表，初始各项收起，只显示归因短名称，点击后才展示状态与完整历史。详情 SHALL 按具体治理目标、固定源版本与归因组织当前和历史轮次；方向筛选本身不自动展开，明确记录深链接及返回可展开目标方向。Evidence、人工复核和完整复核历史 SHALL 保持独立入口，评分依据可展开查看。方向筛选 SHALL 随返回与刷新恢复。

#### Scenario: Open a module with multiple directions
- **WHEN** 用户点击 skill 模块，再点击默认收起的 skill sop错误项
- **THEN** 展开此固定版本方向的当前及历史轮次、各自策略/Agent流转时间与数据集，其他方向保持各自收起/展开状态

### Requirement: Gate and actual release SHALL remain separate
准出 SHALL 来自该轮候选准确关联的实验/决策，区分单能力与窗口；上线 SHALL 来自包含该变体的实际发布记录，支持待发布/灰度/正式/观察/回滚。未回传或缺记录 SHALL 明确说明。

#### Scenario: Gate passed but no release exists
- **WHEN** 该轮通过准出而没有发布记录
- **THEN** 准出显示通过，上线显示待发布，不标已上线
