## Why

Case / Trace 详情目前在执行、评测和治理 Tab 重复展示完整模块，模块人工复核未接入当前 Case 入口，治理去向又缺少 Trace 级时间和数据集成员记录。长数字 Trace / Session ID、明确状态圆点、独立人工评分和可审计流转历史需要一并落地，才能从任一 Trace 理解执行结果、当前处理位置及后续验证。

## What Changes

- 保留四个主导航与五个 Case 内部 Tab，明确任务、Session、执行、评测、治理各自职责；删除 Trace Tab 内完整评测矩阵、治理折叠区和重复人工历史。
- Session / Trace Mock ID 使用稳定、唯一的 18–24 位数字字符串；统一复制、完整值查看、搜索和 URL，保留旧 ID alias 与历史快照可解析性。
- 新增带文字的绿色 / 黄色 / 红色 / 灰色状态圆点，分开表达执行状态、评测结论、人工复核状态和治理状态，不以未配置分数阈值推导颜色。
- 在当前 Trace 的评测矩阵增加“人工复核 / 修改复核”：0–2 人工分数、辅助结论、说明、证据、评测版本、人员与时间；逐次追加记录，不覆盖自动结果、旧复核和已冻结报告。
- 在治理 Tab 提供当前 Trace 的时间化流转、多路分发、数据集名称 / 版本 / 用途 / 加入时间、实验、准出、发布与回滚；为不存在的阶段提供明确状态，不虚构时间或成功结论。
- 列表和数据集样本增加当前治理摘要、最近流转时间和关联入口；同一 Case 的多 Trace 分别可进入，不再以主 Trace 代替其他 Trace。
- 保留现有 Skill 版本 / 归因筛选互斥、旧链接兼容、返回筛选、本地持久化及完整 Mock 标识；补齐均衡边界数据和逐条验收记录。

## Capabilities

### New Capabilities

- `case-detail-single-ownership`: Case 内五个 Tab 的唯一内容职责、去重及当前 Trace 同步。
- `trace-module-human-review`: 当前 Trace 的适用模块人工评分、证据与追加历史。
- `trace-governance-event-history`: Trace 专属、分支感知的治理事件与数据集成员流转记录。
- `trace-session-numeric-identity`: 数字字符串身份、统一 ID 组件、alias、搜索、迁移与快照兼容。
- `governance-status-indicators`: 多状态维度的统一圆点、语义映射和无障碍展示。

### Modified Capabilities

无。当前项目主规格目录尚未建立，既有行为位于历史 change；本 change 的新规格明确本轮替代的页面职责与验收契约，不修改历史规划文件。

## Impact

- 沿用 React、TypeScript、Tailwind、现有 Router、Repository 和本地 Mock，不新增后端、主导航或业务阈值。
- 主要涉及 `src/evolution/domain.ts`、`store.ts`、`repository.ts`、Mock / migration / selectors、Case 页面和模型、模块矩阵 / Evidence / ID 组件、数据集样本列表，以及 `src/App.tsx` 路由关联。
- 扩展的数据结构包括 ID alias、模块复核 revision、数据集成员事件与 Trace 治理事件；需要幂等增量迁移、历史快照保护和本地容量回归。
- 增加单元、页面集成、Playwright 与 1280 / 1440px 阅读验收；逐条记录结果，未执行项不得标为通过。
