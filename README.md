# Agent Quality Platform Demo

Office Agent 评测与质量治理平台的完整前端 Mock Demo。首页质量总览按新版 PRD 拆成四个独立 Section：用户满意度（北极星）、合格产物、过程效率、模块诊断与首错归因。

## 指标口径

- 用户满意度 = 最终被用户接受的合格产物数 / 全部产物数，并展示首轮接受、最终接受、重复纠错和明确负反馈。
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

All data is deterministic Mock Data and local to the browser session. No production APIs, database, credentials or real LLM Judge are used. The eight routes are:

`/overview` · `/performance` · `/anomaly-monitoring` · `/tasks` · `/cases` · `/datasets` · `/benchmarks` · `/evaluation-config`

首页模块诊断展示节点五态计数、首错次数、派生失败次数和 Evidence 覆盖，不把多条 Trace 的异常比例当作模块质量分数。合格产物与过程效率的子指标支持收起/展开；异常监控页承载原始监控信号和可下钻异常。

合格产物按层级拆分为 Office（PPT / Excel / Word，由 Office Eval Agent 返回评分、通过状态和原因）与其他产物（Coding / General，由通用规则评测）。收起子指标时，两层摘要仍然可见。
