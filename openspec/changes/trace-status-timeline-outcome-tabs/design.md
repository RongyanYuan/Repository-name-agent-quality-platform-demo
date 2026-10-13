## Context

详见 proposal。上轮已提供数字身份、Trace 专属投影、追加模块复核和治理事件；本轮调整呈现职责，并补齐事件关系及产物细项。用户已在聊天审核方案，最新“现在开始修改”授权实施。工作目录包含上轮未提交成果，全部保留，沿用当前 checkout 与 4174，不自动提交或切换分支。

## Goals / Non-Goals

目标是列表一条最新状态、四个详情 Tab、一个真实时间分支图、按 Artifact 的可审计细项评分。不会新建主页面、真实执行/发布服务、业务门槛或基于模块平均数的最终分数。

## Decisions

1. 四个 Tab 为 `session/eval/outcome/governance`，默认 governance。旧 task 映射 outcome，旧 trace 映射 eval；observation/log/evidence 深链接在 eval 下打开准确抽屉；旧 outcome-eval/artifact 链接去 outcome。公共头部一次展示身份/Query/来源/时间/最新状态，不复制完整分支。
2. 新状态选择器从当前 Trace 的直接来源事件中按真实 occurredAt + 稳定 ID 选最新；不按失败优先，不取 Case 共享/验证关系，不用更新时间冒充。只有未知时间时保留当前可证实状态并标明未记录。
3. 图使用横向滚动容器、SVG 连线和可点击 HTML 节点。X 由实际时间决定，Y 为主干与处理分支泳道；默认紧凑纵览把同泳道显示范围重叠的节点收为可点开的时间段记录组，每条实际时间/关系/状态仍保留；展开全节点时近时间节点分层避重叠。支持缩放/适配全程/定位当前节点；时间刻度数量随可用宽度变化。已有事件 optional `parentEventIds` 保留明确父子关系，来源对象关联可产生可证明的关系边，不用时间相邻猜因果，双向含糊关系和循环连接不推断。未知时间关联在图外，CASE_SHARED/VALIDATION 用虚线且不成为问题已解决依据。
4. 节点 Drawer 承担操作人/原因/对象/数据集名称版本用途冻结/证据详情。原分支卡、数据集卡和完整事件卡列表删除，复核历史在同一治理区保持可定位且可折叠，避免重复主体。
5. CaseEvaluations 仅过程模块。ModuleEvaluationMatrix 增加 process 模式，排除 OUTCOME 并展示已有模块细项。Evidence 和执行详情保留 Drawer，不再依赖已删 trace Tab。
6. 新 `selectArtifactOutcomeEvaluations(state,traceId)` 输出按产物分组的最终分数和维度记录、自动/人工量纲、时间、版本、Rubric/Evidence/历史。Artifact/OutcomeEval 数据可选补 scoreScale/rubricRule 等，旧自动默认0–1，只显示转换一次。新人工细项分0–2由 typed `REVIEW_OUTCOME_DIMENSION` 动作校验Trace/artifact/eval/自动版本，追加Revision并先持久化再显示成功，原自动/冻结报告/最终分数保持。
7. 新 Mock enrichment 只补缺失的细项和显式图关系，幂等；旧自动数据与冻结快照不重写。PPT/Word/Excel/生图标准复用已有PRD/Mock rubric，未给业务标准标待配置。完整Trace样例维度保持Artifact隔离。

## Interfaces and file ownership

- root：domain.ts、CaseDetailPanel.tsx、CaseAnalysisWorkbench.tsx、model.ts、App.tsx、数据 Seed 接口及最终验收。
- graph agent：data/governanceGraph.ts（selectLatestTraceState / buildGovernanceGraph）、TraceGovernanceTimeline.tsx、图测试；只读引用事件，显式 parent fixture 可独立 helper。
- outcome agent：data/artifactOutcomes.ts、data/artifactOutcomeFixtures.ts、CaseOutcomeEvaluations.tsx、outcome review helper、store.ts 的新动作及聚焦测试。
- process agent：CaseEvaluations.tsx、ModuleEvaluationMatrix.tsx、过程相关测试和旧测试职责更新。

`TraceGovernanceTimeline` 继续消费 history/onNavigateReference/moduleScoreId；新增状态选择器输出 `{event?,status,label,timeKnown}`。`CaseOutcomeEvaluations` 消费 state/traceId/onNavigateReference/onReview(input):Promise<void>/onOpenObservation；OutcomeReviewInput 必须精确绑定Trace/artifact/evaluation/automaticRevisionId。

## Risks / Trade-offs

- 历史缺父节点 → 仅画可证实关系，明确未知起点，不补假时间。
- 时间跨度分钟到数天 → 时间缩放与自适应，近节点多层避重叠，不修改事件真实时间。
- 删 Tab 导致旧路径断链 → 统一兼容映射，旧 ID 与返回上下文回归。
- 新细项和冻结总分误混 → 原最终分数独立显示、0–2量纲明确、自动和人工快照深比较。

## Migration Plan

先建立类型与选择器接口，再分别实现图、产物和过程；根路由/四Tab集成后更新有意改变的测试断言，保留原链路覆盖。运行全量单元、显式应用tsc、独立端口Playwright、构建和1280/1440视觉检查，逐项记录。未知门禁、真实接口及文件存储仍为原Mock边界。
