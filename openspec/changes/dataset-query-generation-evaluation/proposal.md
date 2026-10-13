## Why

自定义数据集的“添加 Query / Trace”实际只能加入已有 Trace，且测试集无法直接执行生成及评测。需要在现有数据集与评测页闭合人工 Query、批量运行和结果回查链路，保留历史与真实服务接入边界。

## What Changes

- 将人工添加 Query 与添加已有 Trace 分成独立入口；新增 Query 保存内容、产物类型及可选固定资产版本。
- 所有数据集类型提供“跑结果 & 评测”和“仅评测已有结果”，生成模式创建独立执行，保留来源。
- 按批次留存成员、输入、资产与评测标准快照，展示逐条状态、最终 0–2 分数、交付物、失败原因及 Case / Trace 回查。
- 冻结阻止新增输入，不阻止执行；重复执行追加批次，不覆盖历史、人工复核或准出结论。
- 提供明确的本地 Mock 执行与可替换服务接口，不将外部统计样本伪造为可运行 Query。

## Capabilities

### New Capabilities
- `dataset-execution-workbench`: 人工 Query、版本化运行批次、生成与评测、失败留存和来源回查。

### Modified Capabilities

无。保持现有导航与页面数量，继续使用原有 Case / Trace 评分及 Evidence 展示。

## Impact

新增可选数据集 Query 与执行台账，扩展本地数据动作、持久化验证和服务适配层；在数据集列表及详情中增加操作与结果历史组件。沿用 React、TypeScript、Vite 和现有组件，不新增依赖或外部写入。
