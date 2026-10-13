## Purpose

让治理人员在当前 Trace 的评测区直接复核每个适用模块的 0–2 分数，核对根证据与 Rubric，并保存与自动结论独立的人工说明及完整历史，避免 Case 确认被误认为模块评分复核。

## ADDED Requirements

### Requirement: Every applicable module SHALL expose an explicit human-review action
当前 Trace 评测矩阵 SHALL 展示自动分数、人工分数、自动 Judge Reason、复核状态以及独立的“查看 Evidence”和“人工复核 / 修改复核”操作。人工入口 SHALL 不藏在不明箭头后；只读入口 SHALL 明确说明原因。Case 级处理确认 SHALL NOT 代替模块复核。

#### Scenario: Review the failed Skill module
- **WHEN** 用户进入当前 Trace 的评测 Tab
- **THEN** Skill 行直接提供人工复核按钮，打开明确对应 Trace、评测包与模块的复核面板

### Requirement: Human review SHALL validate the numeric 0–2 contract
复核面板 SHALL 并列展示只读自动分数 / Reason、人工分数输入、辅助结论、必填复核说明、证据引用、评测版本和人员时间。已评分人工结论 SHALL 使用有限数值且 0 ≤ 分数 ≤ 2；0 为合法值，空值不得转为 0。UNKNOWN / N/A 可无分数但 SHALL 解释原因；超范围、NaN、无穷值和缺少说明 SHALL 阻止保存并显示错误。辅助结论 SHALL 不依据未配置业务阈值自动生成。

#### Scenario: Reject invalid scores and preserve a zero score
- **WHEN** 用户分别提交 0、2、-0.01、2.01、空值或非数值
- **THEN** 边界 0 和 2 在完整说明下可保存，非法值被拒绝；无分数状态只能按明确的 UNKNOWN / N/A 规则保存

### Requirement: Automatic and human results SHALL remain separate immutable histories
每次保存 SHALL 追加独立复核记录，包含 Trace、评测包、模块、自动结果版本、人工分数、辅助结论、说明、证据 / Rubric 引用、复核人和复核时间。自动评分与自动 Judge Reason、历史人工记录及已冻结实验 / 准出报告 SHALL 不被覆盖；最新人工结果可作当前展示投影，历史可逐次查看。

#### Scenario: Revise a module twice and reload
- **WHEN** 用户对同一模块保存两次不同评分后刷新页面
- **THEN** 两次记录均保留，矩阵显示最新人工分数，自动分数和 Reason 未变，其他 Trace 和已冻结报告保持原内容

#### Scenario: Save fails
- **WHEN** 本地持久化或后续服务接口保存失败
- **THEN** 面板保留输入并显示失败，不显示虚假的“已保存”或“已复核”状态

### Requirement: Evaluation disagreement SHALL be explicit without replacing Judge Reason
自动与人工存在不同辅助结论或同量纲分数差异时，系统 SHALL 显示“自动 / 人工不一致”及双方值；人工说明 SHALL 使用独立字段，不以“LLM Judge Reason”名义替换自动说明。仅缺少人工复核 SHALL 显示“未复核”，不等同于自动评测失败。

#### Scenario: Override an automatic pass
- **WHEN** 自动结论通过而人工结论失败
- **THEN** 用户同时看到自动值、人工值、两种说明和不一致标识，且可回看相应根证据与历史

### Requirement: Context SHALL remain evidence-only
上文 / Context Assembly SHALL 不提供独立自动或人工评分入口，也不计入过程分数；其影响 SHALL 在相关模块 Reason、Evidence 和 Session 对话中展示。其他未观测 / 未覆盖模块 SHALL 明确区别“未评测”和“不适用”，不伪造自动分数。

#### Scenario: Context causes a Skill failure
- **WHEN** Skill 失败原因涉及多轮上下文
- **THEN** 人工复核 Skill 并引用 Session / 根证据，Context 保持证据线索而不是新增独立分数

### Requirement: Review updates SHALL not silently redefine aggregate scores or reroute data
模块复核成功 SHALL 更新当前模块展示、复核历史与治理事件摘要；自动最终分数和已有分流 SHALL 保持可追溯。没有明确最终聚合公式时 SHALL 不通过任意平均生成新的总分，也不自动创建或取消 Badcase、变体、实验及发布。

#### Scenario: Review a module while the final rubric is not configured
- **WHEN** 用户修改一个模块分数且不存在批准的最终分数聚合规则
- **THEN** 模块展示人工分数，自动最终分数保持原值并明确标注口径，已有分流和报告不被隐式改写
