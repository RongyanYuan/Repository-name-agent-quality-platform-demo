## Why

新版 Office Agent 评测 PRD 将平台北极星从单纯的质量 KPI 调整为“用户满意度”，并要求先区分合格产物与过程效率，再通过用户接受、纠错和负反馈信号解释满意度。当前 Demo 仍使用二态 Eval、旧的结果可用性/过程指标命名，首页也没有独立的满意度、合格产物和过程效率 Section，因此需要一次有边界的全站口径升级。

## What Changes

- 重构现有质量总览首页为四个独立 Section：用户满意度（北极星）、合格产物、过程效率、模块诊断与首错归因；不新增指标网页。
- 在首页增加用户接受漏斗（首轮接受、最终接受、持续重复纠错、明确负反馈），并将“过程效率不符业务预期率”定义为不达标产物数 / 全部产物数。
- 将合格产物总指标及子维度统一为结果类型一致性、意图一致性、约束满足、准确性和文件有效性；保留旧字段别名以兼容既有深链。
- 将过程效率总指标与其时延、Token/成本、必要 Loop、Skill/Tool、Tool 结果、Retry/Recovery 子指标独立展示；Context 与 Memory 降为诊断 Evidence，不再伪造独立正式 KPI。
- 将 LLM Judge 从 PASS/FAIL 扩展为 PASS、FAIL、DERIVED_FAIL、UNKNOWN、N/A，并补充 reason、Rubric Evidence、score、is_root_cause、derived_from。
- 在 Task / Trace、Case、Dataset、Benchmark、评测配置和性能页同步新的字段、根因、用户行为和成本口径；保留现有七页 IA 与已完成的治理闭环。
- 增加原始性能及风险/商业化监控 Mock 数据：Total Latency Efficiency、TTFT（无数据时 UNKNOWN）、吞吐、Input/Output Token、缓存命中、Tool 频率、一次执行成功率、风控/商业化拦截及原因。
- 增加多视口视觉回归和文字边界检查，交付完整可运行的网站 Demo；本 change 不接入真实 Langfuse、后端、数据库或 LLM Judge。

## Capabilities

### New Capabilities

- `office-agent-eval-v2`: 统一描述新版首页指标层级、五态评测、用户满意度漏斗、模块首错归因、性能/风控监控和跨页面治理闭环。

### Modified Capabilities

无。上一版能力规格属于已完成 change，本次用新 capability 记录不兼容的评测口径变更。

## Impact

- 影响 `src/domain.ts`、`src/data.ts`、`src/selectors.ts`、`src/store.tsx` 以及首页、性能、Task/Trace、Case/Dataset、Benchmark、评测配置页面。
- 影响现有 Mock 数据字段、聚合公式、URL metric IDs、筛选器和测试；需要保留旧路径/字段别名以避免既有下钻链接失效。
- 不引入新的后端接口；继续使用现有 React/TypeScript/Tailwind/Recharts/Playwright 技术栈。
