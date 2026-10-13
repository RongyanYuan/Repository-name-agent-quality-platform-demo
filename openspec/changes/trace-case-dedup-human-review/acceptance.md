# trace-case-dedup-human-review 实施与验收记录

日期：2026-10-12（Asia/Shanghai）。本记录只按实际证据更新，不把规划或代码存在视为验收通过。

## 基线

- 工作目录：`/Users/yuanrongyan/Documents/ChatGPT/Agent管理前端页面`，当前 main，基准提交 `3d60ad1`。
- 实施前源代码无未提交变更；本 change 的规划文件为新增未跟踪文件，全部保留。
- 现有 schema 2，Seed `office-agent-governance-demo-2.4.1`。
- 基线：35 个测试文件、386 项测试通过；命令 `pnpm test`，日志 `/tmp/trace-update-baseline.log`。
- 原 4174 服务未运行，已恢复开发服务到 `http://127.0.0.1:4174/`；测试使用独立端口。
- 不提交、不推送、不归档，不清空用户 LocalStorage。

## 执行决策与所有权

- 本轮沿用当前 Demo 工作目录，保持用户 4174 可直接验收；不切换未知工作树或修改 Git 分支。批准的实施范围已包含当前项目代码修改。
- 优先级：已批准五份规格 → design → tasks。四个主导航、五个内部 Tab、归因原文、未知阈值和旧导入限制保持。
- 数据契约由主代理统一；数字身份及 Repository、治理事件及成员、模块复核及 Store / Editor 分别由独立代理编辑互不重叠文件，主代理负责 App、完整 Trace 投影、Case UI、状态与 ID 组件。
- 依赖：identity resolver → 路由 / 搜索；governance selector → Timeline / 列表；review input / durable commit → App 保存；最终全量测试在源代码稳定后运行。

## 最终验证

2026-10-12 17:43 GMT+8，40/40 项完成。最后运行代码修改于 17:37，最终测试基于该版本；随后只整理文档与截图。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `pnpm test` | 49 个文件 / 468 条测试全部通过，退出 0 | `/tmp/trace-unit-verified.log`；17:37:54 开始，284.50 秒 |
| 全部 Playwright | 43/43 通过，退出 0；独立端口 53124，2.9 分钟 | `BASE_URL=http://127.0.0.1:53124 pnpm exec playwright test --reporter=list --output=/tmp/trace-final-browser`；24 张截图 |
| `pnpm exec tsc -p tsconfig.app.json --noEmit` | 通过，退出 0 | 显式检查应用项目，避免根 tsconfig 空配置漏检 |
| `pnpm build` | 通过，退出 0 | `/tmp/trace-build-verified.log`；1645 modules；8.38 秒 |
| `pnpm lint` | 通过，退出 0 | 当前项目脚本为 TypeScript 检查 |
| OpenSpec strict / `git diff --check` | 通过，退出 0 | 五份规格和本 change 合法；无补丁空白错误 |
| 4174 服务 | HTTP 200；保留运行 | `http://127.0.0.1:4174/cases` |

构建仍提示单 JS 包超过 500 kB（约 839.54 kB / gzip 253.59 kB）；测试有 React Router v7 future flags 和终端颜色提示。均非构建或验收失败，本轮没有为消除提示改动业务逻辑。

## 逐条验收

以下文件名指项目中的实际测试。每条结果均为通过；引用的单元 / 页面测试包含在最终 468 条中，浏览器场景包含在最终 43 条中。

| 任务 | 五份规格对应 | 实际证据 / 验收内容 | 结果 |
| --- | --- | --- | --- |
| 1.1 | 全部 | 本文基线、任务表、所有权记录；保留既有改版，未重置、提交或推送 | 通过 |
| 1.2 | identity / review / history | `repository.test.ts` 的 V1/旧 schema 增量加载；optional 契约、显式应用类型检查 | 通过 |
| 1.3 | ownership | `traceDetailProjection.test.ts`：两 Trace 分数、耗时、产物、Eval 和首错隔离；未评测兄弟不继承 FAIL；Observation-only App 深链接 | 通过 |
| 1.4 | history / ownership | `traceGovernanceFixtures.test.ts`：新 PPT 全链、直接修复、并行分流、重跑、N/A、拒绝、回滚；旧未评测 / 缺证据样例保留，完整 graph 校验无错误 | 通过 |
| 1.5 | identity / review | `identity.test.ts` 快照及自由文本深比较；`reviews.test.ts` 与 `traceCaseReview.integration.test.tsx` 自动、旧人工、分流、兄弟 Trace、冻结报告不变；Repository 用户标注保留 | 通过 |
| 2.1 | identity | `identity.test.ts` 稳定 22 位 ID、末位、前导零、超安全整数、命名空间及冲突 | 通过 |
| 2.2 | identity | `repository.test.ts` 原始旧 ID 连续两次加载、无重复、数字身份保留、alias 冲突原存储不变、冻结报告内容保留 | 通过 |
| 2.3 | identity | `canonicalizeIdentitySearch` 嵌套 returnTo / path / traceSet；`services.test.ts` 和 `v2Selectors.test.ts` alias 边界及搜索；浏览器旧 `/traces/trace-ppt-context` | 通过 |
| 2.4 | identity | `identityDisplay.test.tsx` 完整复制及失败后可选全文；浏览器复制并检查剪贴板及精确末位，复制不跳转 | 通过 |
| 2.5 | identity | Seed 正式 106 Trace / 104 Session 全部数字字符串；210 typed aliases；旧快照值未改，别名反查和计数去重测试 | 通过 |
| 3.1 | history | `traceGovernance.test.ts` 专属 / 共享 / 验证隔离、稳定顺序、别名分支合并、同秒不同 review 身份不合并 | 通过 |
| 3.2 | history | `traceDataset.test.ts` 单 Trace / 同 Case 多 Trace 明确加入；Timeline 名称、版本、用途、冻结与 joinedAt；兄弟显示共享和未记录 | 通过 |
| 3.3 | history / review | `traceGovernance.test.ts` 分流动作去重、无语义变化无假事件；`traceDataset.test.ts` 冻结/重复拒绝；`moduleReviewPersistence.test.tsx` 保存失败不发布状态或事件 | 通过 |
| 3.4 | history | 原始 Issue/Finding 边与 regression validation 单独选择；浏览器 Tool 直接修复及 PPT Variant → 单能力 / 窗口 / 决策 / Release 反查 | 通过 |
| 3.5 | history / status | 并行算法待处理与 Agent 失败独立；已发布后新问题待处理保留；`TraceGovernanceTimeline.test.tsx` 未来阶段无假事件、当前失败红色 | 通过 |
| 3.6 | history | 事件 GMT+8 日期到秒、同秒按 ID 稳定排序；Mock 查询 / 复核 / 加入 / 实验 / 发布 / 回退时间自洽；专用 releasedAt 与未知回滚时间不混用 | 通过 |
| 4.1 | review | `reviews.test.ts` 精确 Trace/package/module/autoRevision 写入；越界拒绝；旧兼容动作同样校验；冻结结果不变 | 通过 |
| 4.2 | review | 0、2、1.23 合法；-0.01、2.01、NaN、Infinity、空值、缺说明拒绝；UNKNOWN/N/A 无分数需解释；派生关系验证 | 通过 |
| 4.3 | review | `moduleReview.integration.test.tsx`、`evaluationCenterV2.test.tsx` 和 App 流程直接复核适用行，Context 仅证据 | 通过 |
| 4.4 | review / ownership | Matrix / Evidence / Editor 共享评分口径；显式 0–2 自动值不乘二；legacy 0–1 只显示转换；Judge Reason 与人工说明分开、不一致可见 | 通过 |
| 4.5 | review / history | `traceCaseReview.integration.test.tsx` 两次保存后卸载重挂；浏览器两次评分后刷新，4 条含 Mock 历史完整，模块 history 跳到唯一治理审计区 | 通过 |
| 4.6 | review | 保存失败留输入、防重入、review ID 去重、重跑清当前投影、旧历史 STALE；旧迁移不重新绑定；最终分数 / 分流 / 实验保持 | 通过 |
| 5.1 | status | `StatusIndicator.test.tsx` 9 项：执行/结论/复核/治理 context，红失败、黄派生、灰缺失和 N/A、当前失败红色及文本无障碍 | 通过 |
| 5.2 | ownership | `caseDetailDedup.test.tsx` Trace 仅 Timeline，完整矩阵只在评测 Tab；无旧治理折叠 / 人工副本 | 通过 |
| 5.3 | ownership | 任务区只补充、反馈、产物；头部一次身份/Query；必要 ID 在所属区域可点击；五 Tab 浏览器 walk-through | 通过 |
| 5.4 | ownership | `caseAnalysis.test.tsx` 执行节点根证据/Rubric/Log与评测共用 Evidence 内容；App observation/evidence/log 精确所属 Trace；完整原始 Input/Output 只在节点详情 | 通过 |
| 5.5 | history / ownership | 治理 Timeline 与详细模块审计唯一归属；数据集、实验、窗口、准出、发布 IDs 跳到统一工作台；完整 PPT 浏览器反查 | 通过 |
| 5.6 | ownership / status | 双 Trace 切换各 Tab 与面板清选择；非主无评测/产物不继承；Session 完整轮次与高亮；URL tab Back/Forward 同步 | 通过 |
| 6.1 | ownership | 每 Trace 独立行/勾选/分页；非主 alias 筛选只命中一行；一次导航推导 Case，旧 Case 入口保留 | 通过 |
| 6.2 | history / status | Case 表及 dataset samples 显示治理分支、最近流转和简短归属；使用最新 package；点击同 Trace governance Tab | 通过 |
| 6.3 | ownership / identity | `App.integration.test.tsx` / `skillDatasetWorkspace.test.tsx` / 浏览器 fixed/all versions returnTo；保留分类、Skill、归因、Tab、分页和 dataset drawer | 通过 |
| 6.4 | ownership | 四主导航；Skill分类或具体Skill锁 Skill，清空恢复模块；非法URL修正、Back/刷新、孤立 all/version 不造对象，浏览器互斥测试 | 通过 |
| 7.1 | 全部 | 新 PPT 浏览器：数字 ID → Evidence/Rubric → 两次人工复核/刷新 → 加入记录 → Variant/单能力/窗口 → frozen Gate/Release → 原页返回；快照 JSON 深比较 | 通过 |
| 7.2 | history / ownership | 直接 Tool 修复不要求 Cluster；parallel FAILED/PENDING 不互盖；未评测兄弟不继承发布、评分及产物 | 通过 |
| 7.3 | review / history / identity | 单元+页面覆盖未评测/N/A/缺根证据/缺加入时间/未运行/拒绝/回滚/失败保存/旧迁移；无假成功、无重复、不丢历史 | 通过 |
| 7.4 | status / ownership | 1280/1440 五 Tab、长 ID、Matrix/Editor、Dataset、parallel Timeline 16 张当前截图；检查控件矩形交叠与标题/按钮裁切；另有 1024/390 旧布局回归 | 通过 |
| 7.5 | 全部 | 最终 49 文件 / 468 测试全绿，显式 tsc 应用检查 0；红→绿日志见下 | 通过 |
| 7.6 | 全部 | 最终全部浏览器 43/43；独立 53124，4174 未被停；复制、alias、返回、刷新持久化全部实际运行 | 通过 |
| 7.7 | 全部 | build / lint / strict / diff-check 全 0；真实 curl 4174 返回 200；告警已如实列出 | 通过 |
| 7.8 | 全部 | 本记录40行、tasks40勾选、README启动/边界/待配置规则和截图；未自动归档/提交/推送 | 通过 |

## 可直接演示的样例

所有链接仍接收旧 alias，并自动解析正式数字 ID；演示数据不代表真实线上质量。

- [管理层 PPT：评分与复核](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-ppt&caseView=eval&timeRange=30d)。包含历史两次复核、重跑后待重新复核、原始归因集、单能力/窗口 3 次双臂运行、冻结准出报告、发布、回滚及新待处理分支。
- [确定性 Tool 直接修复](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-tool&caseView=governance&timeRange=30d)。
- [并行算法 / Agent 分支](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-parallel&caseView=governance&timeRange=30d)。
- [未评测兄弟 Trace](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-ppt-context&caseView=eval&timeRange=30d)，不会继承生成 Trace 的分数、产物或发布。
- 缺根证据样例 `case-v2-05` / `package-trace-v2-05`；待运行实验 `exp-single-memory-latest`。旧成员缺时间不补造。

最终 Seed `office-agent-governance-demo-2.5.0`，schema 2；104 Case、106 Trace、104 Session、105 评测包、2 条预置模块复核。可在本地继续复核，新增记录持久化保存。

## 截图与先失败后通过证据

当前 1280 / 1440 的八种视图各一张，已从测试输出复制至本 change 的 `artifacts/`，共 16 张。测试原输出 `/tmp/trace-final-browser` 另保留全部 24 张。

| 视图 | 1280 | 1440 |
| --- | --- | --- |
| 任务与关联 | [截图](artifacts/任务与关联-1280.png) | [截图](artifacts/任务与关联-1440.png) |
| Session | [截图](<artifacts/Session 对话-1280.png>) | [截图](<artifacts/Session 对话-1440.png>) |
| Trace 与 Evidence | [截图](<artifacts/Trace 与 Evidence-1280.png>) | [截图](<artifacts/Trace 与 Evidence-1440.png>) |
| 评测矩阵 | [截图](artifacts/评测中心-1280.png) | [截图](artifacts/评测中心-1440.png) |
| 人工复核 | [截图](artifacts/module-review-1280.png) | [截图](artifacts/module-review-1440.png) |
| 治理历史 | [截图](artifacts/治理链路-1280.png) | [截图](artifacts/治理链路-1440.png) |
| 并行时间线 | [截图](artifacts/并行时间线-1280.png) | [截图](artifacts/并行时间线-1440.png) |
| 数据集样本 | [截图](artifacts/dataset-members-1280.png) | [截图](artifacts/dataset-members-1440.png) |

关键红测包括 `/tmp/status-circle-red.log`、`/tmp/identity-display-red.log`、`/tmp/trace-projection-red.log`、`/tmp/trace-detail-red.log`、`/tmp/trace-final-audit-red.log`（未评测兄弟继承 FAIL、Observation-only 选错 Trace）。审查另复现并修正非法 legacy override、旧复核迁移误绑定新 revision、列表取旧包、同秒 review 丢事件和 alias 分支重复；均有对应最终回归测试。

## 真实接口与待配置范围

Trace / Eval Agent / 实验 / 发布 / 产物文件仍为 Mock 或接口预留。本轮新增本地事件与复核只表示演示中的实际操作，不声称修改线上 Agent 或真实发布。未清空用户存储；迁移失败会保留原状态并提供原始 JSON 导出。

耗时与成本基线、多数聚类门槛、指标门禁、人工模块评分聚合成最终分数的规则、上文细项仍待配置 / 需求评审。没有配置时保持原始数据、独立人工数值及明确状态，不推算总分或自动分流 / 准出。品味库 100 条条件仅沿用 PRD 明确口径，950/1000 是 Mock 偏好聚合，不是准出阈值。
