# Agent Quality Platform Demo

Office Agent 评测与质量治理平台的完整前端 Mock Demo。首页质量总览按新版 PRD 拆成四个独立 Section：用户满意度（北极星）、合格产物、过程效率、模块诊断与首错归因。

## 指标口径

- 用户满意度 = 最终被用户接受的有效产物数 / 全部产物数；有效产物 = 合格产物且过程有效。过程业务预期未建立（UNKNOWN）的产物不计入有效产物。
- 合格产物率由结果类型一致性、意图一致性、约束满足、准确性、文件有效性五个硬门槛共同判定。
- 过程效率达标率独立于合格产物率；「过程效率不符业务预期率」固定为过程效率未达标产物数 / 全部产物数。
- 模块评测使用 PASS、FAIL、DERIVED_FAIL、UNKNOWN、N/A 五态；首错归因只统计首个非派生失败节点。
- 性能页区分原始时延效率、TTFT、吞吐、Input/Output Token、缓存、Tool 频率、一次执行成功率以及风控/商业化拦截。无数据的 TTFT 或基线显示 UNKNOWN / 基线未建立。

## Run

```bash
pnpm install
pnpm dev -- --host 127.0.0.1 --port 4174
```

Open `http://127.0.0.1:4174`.

The demo keeps result evaluation, process evaluation and performance signals separate while connecting:

`Metric -> Task/Trace -> Eval Evidence -> Case/Badcase -> Golden Dataset -> Benchmark -> A/B Trace`

Mock data contains 61 Tasks and 30+ governance Cases across PPT, Excel, Word, Coding and General, with all three complexity levels, three task outcomes, ten root-cause categories, five judge states, missing TTFT/latency/cost baselines, Tool/Retry/Recovery boundaries, acceptance behavior variants, risk/commercial interception, and Golden/Historical/Challenge datasets.

All data is deterministic Mock Data and local to the browser session. No production APIs, database, credentials or real LLM Judge are used. The eight routes are:

`/overview` · `/performance` · `/anomaly-monitoring` · `/tasks` · `/cases` · `/datasets` · `/benchmarks` · `/evaluation-config`

首页模块诊断展示节点五态计数、首错次数、派生失败次数和 Evidence 覆盖，不把多条 Trace 的异常比例当作模块质量分数。合格产物与过程效率的子指标支持收起/展开；异常监控页承载原始监控信号和可下钻异常。

Context 当前采用全量组装，不作为独立 Process Eval 或 KPI。Trace 保留 Context assembly snapshot，状态显示 `N/A`；当 Task Understanding、Decision、Skill 等模块受 Context 污染、缺失或矛盾影响时，LLM Judge 必须在该模块 reason 中说明，并关联 Root evidence 与具体 Rubric rule。

Task 详情中的 Session ID 可打开完整 Session 对话；同一 Session 下每个 query 都展示对应的 Trace 入口。Trace 节点不再重复显示 `1 evidence` 等计数，Evidence 统一在 Judge 结果和 Observation Details 中查看。

合格产物按层级拆分为 Office（PPT / Excel / Word，由 Office Eval Agent 返回评分、通过状态和原因）与其他产物（Coding / General，由通用规则评测）。收起子指标时，两层摘要仍然可见。
