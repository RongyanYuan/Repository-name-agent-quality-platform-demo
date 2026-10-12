## Why

当前 Demo 已能展示单条 Task/Trace 与治理闭环，但还缺少“评测 Agent 处理一批线上 Trace 后，按模块产出证据、生成问题、按 Skill 类型分流并进入算法 Badcase/Agent 迭代”的主流程。没有批次台账和可追溯分流，使用者无法确认所有评测过的 Trace 是否覆盖、为什么被路由、以及一个发布版本最终来自哪些原始证据。

## What Changes

- 新增 Trace 集批量评测批次、评测作业、失败重试和批次状态；保留 Eval Agent 与 Rubric 版本快照。
- 新增全量 Trace 评测台账，支持按 Batch/Case/Session/Trace/Skill/版本/评测覆盖/分流状态筛选，并可打开单条 Trace 的模块评分与 Evidence。
- 按 Reason、记忆、上文、skill、Act、Tool、Outcome/产物展示五态模块评测；Context Assembly 只作为根证据或派生证据，不恢复为独立指标。
- 新增 Evaluation Finding、Routing Policy、Routing Decision、Routing Delivery、Algorithm Badcase Item、Badcase Queue，并支持同一 Trace 多模块、多路投递。
- 严格使用 Production Skill、General、Personal Skill、Taste Skill、Unclassified 分类和既定中文归因字典；Production Skill 失败默认进入“策略迭代 / 算法 Badcase Candidate”。
- 恢复并桥接首页满意度、合格产物、过程效率、模块诊断四层指标；补齐 Model Call、模型耗时、吞吐量、成本/缓存等原始信号展示。
- 将评测、Rubric、Artifact、Evidence Bundle 和运行条件冻结到 Experiment Run；补齐 Window cutoff/frozen 状态、个人 Skill 规划来源、规则待配置状态。
- 扩充结构化 Mock 数据与 LocalStorage migration，保留 V1 URL、对象 ID 深链和原有筛选条件。

## Capabilities

### New Capabilities

- `evaluation-batch-ledger`: Trace 集批量评测、批次历史、全量 Trace 评测台账和重试。
- `trace-module-evidence`: 五态模块评分、自动/人工结果、Judge Reason、Rubric Evidence 与 Observation/Log 关联。
- `evaluation-routing-badcase`: Evaluation Finding、Skill 分类、Routing Policy/Delivery、多路 Badcase 队列和确认投递。
- `governance-lineage-bridge`: 将批量评测和分流结果接入现有 Case、Issue、Cluster、Variant、Experiment、Gate、Release 反查链路。

### Modified Capabilities

<!-- V1 仅存在于 change-local specs，没有可安全引用的主 specs 路径；兼容行为由 governance-lineage-bridge 作为新增契约承接。 -->

## Impact

- 主要影响 `src/evolution/domain.ts`、`src/evolution/data.ts`、`src/evolution/store.ts`、评测/Overview/Case/Trace/实验页面及共享筛选与路由组件。
- 仅使用本地结构化 Mock 与 LocalStorage，不新增真实后端依赖；数据访问抽象预留 Trace/Eval/实验/发布服务接口。
- 新增 Vitest/Testing Library/Playwright 覆盖批次、台账、Evidence、分流和完整反查链路；旧页面与 URL 保持兼容。
