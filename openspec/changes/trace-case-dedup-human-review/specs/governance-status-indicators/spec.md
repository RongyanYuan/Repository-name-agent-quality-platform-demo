## Purpose

用绿色、黄色、红色与灰色的圆形 Icon 配合文字表达执行、评测、复核及治理状态，帮助用户快速识别当前 Trace 的问题和处理位置，同时避免用一个总状态混淆不同业务含义。

## ADDED Requirements

### Requirement: Status circles SHALL use shared explicit semantics
系统 SHALL 使用统一圆点 / 圆圈与文字：绿色表示该状态维度的成功 / 完成，黄色表示待处理 / 运行中 / 待复核，红色表示失败 / 拒绝 / 回滚，灰色表示无记录 / 不适用 / 尚未进入。派生失败 SHALL 保留“派生”标识并使用黄色 / 浅橙区别直接失败；圆点颜色 SHALL 不从任意显示文案子串或未配置得分阈值猜测。

#### Scenario: Evaluation execution completed with a failed verdict
- **WHEN** 一次评测运行成功完成但业务结论失败
- **THEN** “评测运行已完成”可显示绿色，而“评测结论失败”显示红色，不将完成状态当作通过

### Requirement: Evaluation verdict and review workflow SHALL remain separate
模块行 SHALL 区分结论和复核进度；有效结论可显示最新人工辅助结论并保留自动结论，未复核 SHALL 只影响复核进度，不把自动 PASS 变成黄色失败。评分继续以 0–2 展示，状态圆点 SHALL 不替代数字评分。

#### Scenario: Automatic pass awaiting manual review
- **WHEN** 模块自动结论 PASS 且尚无人工复核
- **THEN** 自动 / 当前结论为绿色 PASS，复核状态为黄色未复核，两者明确分开且显示数值分数

### Requirement: Indicators SHALL be consistent across Trace surfaces
圆点 SHALL 用于 Trace 行、Case 头部当前 Trace 摘要、多 Trace 切换条、模块矩阵、治理节点和数据集样本摘要。Case 共享汇总 SHALL 标明单位，不伪装成当前 Trace；首错、派生、缺失和复核不一致 SHALL 保留文字信息。

#### Scenario: Switch from a failed Trace to a successful Trace
- **WHEN** 用户切换两个状态不同的 Trace
- **THEN** 头部、切换条、评测和治理摘要使用所选 Trace 的各状态，Case 共享状态仍独立标注

### Requirement: State and current-position indications SHALL be accessible
状态 SHALL 同时有可读文字、必要说明与无障碍标签，不能只靠颜色。当前停留节点 SHALL 额外使用外圈 / 标记强调，不强制改成黄色；失败的当前节点仍为红色。未知状态 SHALL 提供解释，不伪造可验证结论。

#### Scenario: Current governance branch is blocked
- **WHEN** 当前处理分支执行失败
- **THEN** 节点以红色圆点及“当前停留 / 失败”文字展示，而不是因当前节点高亮变成黄色
