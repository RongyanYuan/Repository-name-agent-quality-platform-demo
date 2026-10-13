# Trace 最新状态、四 Tab 与治理时间分支图验收

日期：2026-10-12，Asia/Shanghai。本记录根据实际测试与截图填写。

## 基线及授权

- 用户已审阅本轮方案，补充删除「任务与关联」，再明确要求开始修改。
- 沿用原 React / TypeScript / Vite 项目与 checkout，保留上轮所有未提交成果和用户本地数据；未 reset、提交、推送或归档。
- 实施前基线：49 文件 / 468 测试通过，`/tmp/trace-tabs-baseline.log`，18:23:20 开始，181.95 秒。
- 新 change：`trace-status-timeline-outcome-tabs`；三份规格，17 条任务。schema 2，Seed 增量升级到 `office-agent-governance-demo-2.6.0`。

## 已验证的结果

- 最终全套浏览器：48/48 通过，退出 0，2.2 分钟；独立端口 53124。日志 `/tmp/trace-tabs-acceptance-browser.log`，截图 `/tmp/trace-tabs-acceptance-browser`。
- 最终单元 / 页面：59 文件 / 517 测试全部通过，退出0；`/tmp/trace-tabs-final-unit.log`，19:22:10开始，221.29秒。
- 最新 build 通过，日志 `/tmp/trace-tabs-final-build.log`；显式 `tsc -p tsconfig.app.json --noEmit`、lint、OpenSpec strict 与 diff-check 通过。
- Seed 图校验 `validateEvolutionState` 返回空错误数组：105 Case / 107 Trace / 105 Session / 101 Artifact / 116 OutcomeEval / 26 显式治理事件。
- 开发地址 `http://127.0.0.1:4174/cases` HTTP 200；用户服务未被浏览器测试停止。

## 逐项记录

| 任务 | 验证与证据 | 结果 |
| --- | --- | --- |
| 1.1 | 上述基线、确认方案、三规格 strict 校验、工作区已有变更保护 | 通过 |
| 1.2 | 可选 parent/评分量纲/Rubric/自动快照字段；Repository 原数据加载/冻结深比较；显式应用 tsc | 通过 |
| 1.3 | `governanceGraph.test.ts`：真实最新时间、并行分支、排除较新验证/共享与未知时间，未知时间不用 recordedAt 伪造 | 通过 |
| 2.1 | 图投影同秒避重叠、明确父节点/唯一对象来源；互相引用不生成循环；`governanceParentValidation.test.ts` 缺父、跨 Trace、cycle 拒绝；fixture 幂等及原快照不变 | 通过 |
| 2.2 | 默认紧凑记录组、真实时间跨度和原事件保留；全节点/缩放/全程/最新及分支定位；浏览器最小320时间刻度无重叠、并行失败/待处理可见 | 通过 |
| 2.3 | 节点 Drawer 操作人/时间/原因/Evidence/数据集版本/用途/冻结/成员范围；共享/用于验证虚线和未知时间独立；旧对象反查 / 返回 | 通过 |
| 3.1 | `processEvaluationOwnership.test.tsx` 与模块人工复核测试：无重复过程框/Outcome，显式模块归属、0–2细项和 Context只证据；旧 ProcessEval精确高亮/Reason/Evidence | 通过 |
| 3.2 | `artifactOutcomes.test.ts` 与产物组件：按Artifact切换、无跨Trace/多产物评分互借、0–1仅转换一次、缺总分不平均；时间含GMT+8 | 通过 |
| 3.3 | `artifactOutcomeFixtures.test.ts`：PPT/Word/Excel/生图及双产物，细项仅增量加入、幂等、原自动/人工/实验快照不替换；全图合法 | 通过 |
| 3.4 | `outcomeReviews.test.ts` 与 `CaseOutcomeEvaluations.test.tsx`：边界0/2、非法有限值/缺说明/跨范围拒绝；两次追加、保存失败留输入、重跑版本、完整自动Rubric快照和刷新保护 | 通过 |
| 4.1 | `fourTabReading.test.tsx` / 浏览器：删除执行/模块复核与治理长列，单状态圆点+文字、准确最新Trace、成本/评分/选择/分页/条Trace单位保留 | 通过 |
| 4.2 | 四Tab严格Session/评测/产物/治理，默认治理；公共头部一次身份Query最新状态；Session保留反馈；切换Trace复位证据和归因表单 | 通过 |
| 4.3 | App旧 task→outcome、trace→eval、Artifact/Outcome/ProcessEval/Observation/Log/Evidence精确入口；产物Evidence保留1.10/Rubric/版本/Log和context；固定/all版返回/Back兼容 | 通过 |
| 5.1 | 新5条浏览器场景+全部43条旧覆盖：两次复核/刷新、Artifact切换、并行卡点、回滚/数据集反查、缺评测、旧链接；Escape只关顶层并恢复Case焦点 | 通过 |
| 5.2 | 1280/1440四Tab、横向紧凑图、dataset节点、产物复核截图；节点矩形无交叠、最小刻度无重叠、标题/Tab无裁切；截图前验证选中Tab且关闭动画，追加2条视觉重测全绿 | 通过 |
| 5.3 | 完整单元/页面59文件517测试全绿，全套浏览器48/48及显式tsc通过，4174保持200 | 通过 |
| 5.4 | build/lint/strict/diff-check通过；README已更新四Tab、增量Mock、标准待配置、真实接口边界；未提交/推送 | 通过 |

## 修复的实际审查问题

- 时间范围数天时，前几分钟节点堆成多层：默认改为按显示重叠收为记录组，节点时间/明确关系仍可逐条查看。
- 时间轴最小缩放6个刻度文字重叠：按时间宽度自适应刻度数。
- 不同对象同秒互相引用形成循环：不推断双向关系，连接前检查现有路径。
- 子层Escape同时关Case：统一只关闭DOM顶层Drawer/Modal，并恢复仍开Case焦点。
- 产物根Evidence跳转丢评分和Rubric：链接携Artifact+Evaluation上下文，精确合成评分Evidence与Observation Log；不会重复打开评分Drawer。
- 新生图Case继承多场景及生产分类：显式设置生图/GENERAL/单场景，旧监控样本口径不被污染。
- Tool Finding错误写成Skill SOP：统一为PRD「工具未执行成功」；候选Badcase状态明确黄圈「候选待确认」。

红→绿证据包括 `/tmp/trace-four-tabs-red.log`、`/tmp/trace-parent-validation-red.log`、`/tmp/trace-outcome-evidence-red.log`、`/tmp/trace-layer-focus-red.log`、`/tmp/trace-candidate-red.log`，以及各工作线新增图/产物/过程测试。真实浏览器独立审查复现过Escape和评分Evidence丢失，修复后浏览器完整场景已通过。

## Mock 与待配置范围

Trace / Eval Agent / 实验 / 发布 / 真实文件存储仍未接入。下载入口对 Mock 显示「查看产物 · Mock」，产物详情明确没有真实文件服务；不会虚构可下载文件。

PPT/Word/Excel/生图细项复用原有可用性/用户约束/风格检查；PRD未提供的专项标准和评分档位仍待配置。自动最终评分使用记录值，人工细项不会凭任意平均更新总分、分流或准出。耗时/成本基线、门禁、大多数聚类门槛和上文需求保持待配置。

## 验收入口

- [管理层PPT治理时间图](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-ppt&caseView=governance&timeRange=30d)
- [管理层PPT产物细项与双产物](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-ppt&caseView=outcome&timeRange=30d)
- [并行算法与Agent卡点](http://127.0.0.1:4174/cases?traceId=trace-governance-demo-parallel&caseView=governance&timeRange=30d)
- [生图细项及待配置标准](http://127.0.0.1:4174/cases?traceId=trace-outcome-dimension-demo-image&caseView=outcome&timeRange=30d)

## 保存的截图与检查结果

关键截图共12张，保存在本 change 的 `artifacts/`。最后截图重测2/2通过，日志 `/tmp/trace-tabs-delivery-screens.log`，独立端口53123，9.6秒。全部48条浏览器场景与该视觉重测之间没有再修改运行代码。

| 视图 | 1280 | 1440 |
| --- | --- | --- |
| Session 对话 | [截图](<artifacts/Session 对话-1280.png>) | [截图](<artifacts/Session 对话-1440.png>) |
| 过程评测 | [截图](artifacts/评测中心-1280.png) | [截图](artifacts/评测中心-1440.png) |
| 产物细项 | [截图](artifacts/产物评测-1280.png) | [截图](artifacts/产物评测-1440.png) |
| 紧凑时间分支图 | [截图](artifacts/治理链路-1280.png) | [截图](artifacts/治理链路-1440.png) |
| 数据集节点详情 | [截图](artifacts/dataset-node-1280.png) | [截图](artifacts/dataset-node-1440.png) |
| 产物人工复核 | [截图](artifacts/outcome-review-1280.png) | [截图](artifacts/outcome-review-1440.png) |

构建退出0，1652 modules，3.06秒；JS889.01kB / gzip268.53kB，保留原有“大于500kB”提示。React Router future flags及终端颜色提示仍存在，均未导致失败。lint、显式应用类型检查、strict和diff-check均退出0。

本轮17/17项完成，不自动归档，代码和文档均留在当前工作区供审阅。
