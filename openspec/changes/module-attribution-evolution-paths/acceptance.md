# 模块归因与独立进化轮次验收

日期：2026-10-12，Asia/Shanghai。变更：`module-attribution-evolution-paths`。

## 验收状态

原始 13/13 任务、三 Tab / 折叠补充 3/3、Case 范围补充 1/1 及时间窗口/数据集筛选补充 4/4 完成；OpenSpec 当前任务清单全部完成。以下原始结果保留，最新证据见文末补充验收。

- 完整单元与页面回归：67 文件 / 572 测试，0 失败，退出 0，255.87 秒；[日志](artifacts/unit.log)。
- 完整浏览器回归：53/53，0 失败，退出 0，2.7 分钟；独立端口 53124，[日志](artifacts/browser.log)。
- build、lint、显式 `tsc -p tsconfig.app.json --noEmit`、OpenSpec strict 和 diff-check 通过；[构建日志](artifacts/build.log)。构建保留单个大于 500 kB 的 bundle 提示，本轮未扩展到拆包优化。
- 4174 开发服务 HTTP 200；当前真实浏览器本地快照完成增量升级，无需重置数据。
- 类型检查发现三处测试使用了另一测试工具的参数，修正后对应 11 项检查重新全部通过；产品代码未变，[复查日志](artifacts/test-types.log)。
- 实施前针对性基线 19/19；本轮来源/状态/工作台针对性检查 49/49，预览升级检查 2/2。最终全量结果以上述日志为准。

## 范围与数据保护

用户明确要求应用已确认方案。沿用原 React / TypeScript / Vite 项目，保留四个主页面和四个 Case 详情 Tab。当前 checkout 的已有修改保持；未重置、提交、推送或归档。

新增可选模块来源绑定与独立进化轮次台账。具体范围为 Trace → 评测包 → 自动版本 → 模块或评分细项 → Finding / 归因 → 目标固定源版本 → 进化轮次 → 处理路径。没有明确关系时显示未关联，不借用同 Case、Skill 或数据集中的其它结果。

Seed 为 `office-agent-governance-demo-2.7.1`，schema 保持 2。迁移增量加入对象及反向关系，保留人工评分、说明、自动记录和冻结报告。对实施期间保存的 2.7.0 预览，仅修正该版本的明确 Mock 品味来源关系；有人工修改审计的记录保持原样。

## 逐项验收

| 任务 | 检查内容与证据 | 结果 |
| --- | --- | --- |
| 1.1 | `repository.test.ts`、模块 optional 契约、显式应用 tsc；旧数据/人工内容/冻结历史保留 | 通过 |
| 1.2 | `moduleEvolutionFixtures.test.ts`：幂等、全图合法、旧评分/报告深比较、真实旧种子和预览升级 | 通过 |
| 1.3 | `moduleEvolution.test.ts` / validation：精确模块/细项/自动版本、验证样本不作为来源、历史隔离 | 通过 |
| 2.1 | selector/fixture 检查：归因确认、PRD 方式、独立 37/100、待配置、Context 仅证据 | 通过 |
| 2.2 | selector 和新浏览器场景：同 SOP 两去向，策略等待回传、Agent 处理中，报告不串用 | 通过 |
| 2.3 | selector：逐候选单能力/窗口报告和 Baseline 配对；准出/复核/拒绝/发布/回滚分开 | 通过 |
| 3.1 | matrix/detail/integration 及 1280/1440 浏览器：评分摘要、细项详情、四阶段与原人工入口 | 通过 |
| 3.2 | workbench helper/page 检查：固定 Skill / Memory 版本、互斥筛选、精确轮次报告、共享集分行 | 通过 |
| 3.3 | 新浏览器场景和 App integration：返回/Back/Forward/刷新/关闭、细项、筛选、图高亮和旧 alias | 通过 |
| 4.1 | 53 个浏览器场景：新增多路/已准出未上线/Memory，加原回滚、双次复核、冻结保护与返回 | 通过 |
| 4.2 | 完整 572 单元/页面与 53 浏览器、显式 tsc、4174 HTTP 200 | 通过 |
| 4.3 | 8 张当前 1280/1440 截图已阅读；阶段卡几何交叠及控件裁切检查为零 | 通过 |
| 4.4 | build/lint/strict/diff-check、README/本记录与日志截图留存 | 通过 |

## 布局截图

| 内容 | 1280 | 1440 |
| --- | --- | --- |
| 评分矩阵与短摘要 | [截图](artifacts/module-matrix-1280.png) | [截图](artifacts/module-matrix-1440.png) |
| 当前轮次四阶段 | [截图](artifacts/module-path-stages-1280.png) | [截图](artifacts/module-path-stages-1440.png) |
| 固定 Skill 版本数据集 | [截图](artifacts/module-datasets-1280.png) | [截图](artifacts/module-datasets-1440.png) |
| Memory 独立目标数据集 | [截图](artifacts/module-memory-datasets-1280.png) | [截图](artifacts/module-memory-datasets-1440.png) |

## 可复查示例

打开 `/cases?traceId=2037904916466732346556&caseId=case-ppt-management&caseView=eval&timeRange=30d&environment=Production`。

1. skill 模块「查看进化详情」：同一模块有多个归因；SOP 策略路径等待回传，Agent 路径单能力和窗口准出通过，实际待发布；历史轮次单独保留。
2. 品味召回：目标为 `skill-taste-executive@0.9.0`，独立的 37 条已确认相关 Case Mock 快照 / 100 条规则，处于积累中，不使用生产 Skill 的计数或 950/1000 偏好用户比例。
3. 记忆模块：目标为 `memory-policy@memory-policy-demo-v1`、准确率低，规则待配置。跳转数据集不携带 Skill 分类、Skill ID 或 Skill 版本。
4. SOP 进化数据集有五种用途，各集仅明确加入当前生成 Trace。点击样本回到 Case 分析，不将同 Case 的上下文 Trace 作为独立成员。
5. 返回来源恢复原 Trace、模块与评分细项；定位治理路径高亮对应对象；浏览器后退恢复进化详情。

## 审查发现与修复

- 共用数据集将旧通过结论合并到新轮次：改为每轮次单独一行，稳定唯一键；实验点击验证真实所属轮次。
- 浏览器 Back 被本地 Tab / 抽屉状态覆盖：路由模式直接跟随 URL，打开和关闭模块详情同步其来源参数。
- 样本列表按 Case 展开全部 Trace：明确 TRACE 成员按真实加入 ID 取样；旧无明确记录的数据集保留 Case 共享语义。
- 品味目标换成独立 Skill 却沿用生产 Skill 聚类统计：新增自己的问题簇和独立 Mock 计数，并补齐升级中的反向关系。
- 同轮次候选 B 单能力通过错误支持候选 A 窗口准出：逐候选核对各自报告、Baseline 和时间；实际发布仍作为独立事实保存。
- 历史发布时间早于准出：保留原始历史并提示冲突，不伪造或改写时间。

## Mock 与待配置边界

所有新增归因、聚类计数、数据集、实验、人工准出和发布状态均为 Mock。没有接入真实 Trace / Eval Agent、策略团队、实验或发布服务。准出与实际发布分开存储，演示操作没有执行真实上线。

低分仅作候选线索；确认归因后仍须符合 PRD 直接/聚类条件。品味库 100 条是已明确规则；其它未定门槛、成本/耗时基线与指标门禁维持待配置。SOP 示例通过来自明确 Mock 人工决策，指标门禁仍待配置。上文不增加独立评分或进化阶段。没有发生时间的字段维持“时间未记录”。

## 最新三 Tab、折叠与 Case 范围验收

| 项目 | 证据 | 结果 |
| --- | --- | --- |
| Case 详情 | Session 对话 / 评测中心 / 产物评测 3 个 Tab；默认评测中心；治理链路旧地址转入评测中心 | 通过 |
| 归因方向 | 所有模块均按归因短名称默认收起；点击单项独立展开；同归因的历史和策略/Agent路径合并；不同目标版本不合并 | 通过 |
| 复核与审计 | 模块人工复核历史独立抽屉；Session 保留 Case 共享处理审计；自动快照和 Evidence 未丢失 | 通过 |
| Case / Trace 范围 | 详情关闭清除 Trace / Session 临时定位；Case / Trace 分页批次 10 条；全部筛选命中数量保留 | 通过 |
| 相关单元 | 三 Tab、归因折叠、路由、方向、历史、Skill 工作台和复核相关 29 项通过 | 通过 |
| 完整单元 / 页面 | 69 文件 / 593 项通过，退出 0；日志见 `artifacts/three-tabs-full-unit.log` | 通过 |
| 完整浏览器 | 56/56 通过，退出 0；独立端口 53124，日志见 `artifacts/three-tabs-full-browser.log` | 通过 |
| 构建与静态检查 | build、lint、显式应用 tsc、OpenSpec strict、diff-check 通过；4174 HTTP 200 | 通过 |

本轮浏览器检查确认模块折叠示例：`skill sop错误`、`skill name/description错误` 默认仅显示名称，点击后才显示完整来源、版本、数据集、实验和时间历史。关闭 Trace 详情后列表恢复 10 行首屏与完整命中计数，不再把用户正在看的 Trace 当成全局列表筛选。

## 最新时间窗口与数据集筛选验收

| 项目 | 证据 | 结果 |
| --- | --- | --- |
| 时间窗口 | Window 下拉、Query 时间闭区间、自定义起止时间、结束早于开始的行内错误 | 通过 |
| 数据集两级筛选 | 数据集类型 → 具体名称；准出、黄金测试集、个人创建集均有 Mock 选项 | 通过 |
| Trace 精确归属 | `datasetRefs` 使用 TRACE / CASE_SHARED membership；具体数据集不会带入同 Case 兄弟 Trace | 通过 |
| URL 与返回 | `timeWindowId/timeFrom/timeTo/datasetCategory/datasetId` 可刷新与返回恢复；旧相对时间兼容 | 通过 |
| 全量单元 / 页面 | 70 文件 / 598 项通过，退出 0；日志见 `artifacts/dataset-filter-full-unit.log` | 通过 |
| 全量浏览器 | 57/57 通过，退出 0；新增筛选场景与原链路均通过；日志见 `artifacts/dataset-filter-full-browser.log` | 通过 |
| 构建与静态检查 | build、lint、显式应用 tsc、OpenSpec strict、diff-check；4174 HTTP 200 | 通过 |

## 用户澄清：模块点击查看不同方向完整历史

本轮补充三个任务通过，此前 13 个任务的结果与日志保留。

- 入口调整为评测中心模块名或普通行直接进入进化历史，Evidence 和人工复核仍独立。
- 以目标对象、固定源版本、归因作为精确方向，默认全部方向，可选择单方向；同方向的当前与历史轮次集中显示，多路分流按路径分别展示。
- 完整时间历史在路径来源信息之后、四阶段状态之前默认展开；长记录通过独立滚动查看全部内容，不删减历史事件。
- 同一 Trace / 模块的明确旧评测包绑定补入只读历史，显示来源评测包与自动版本；当前状态仍以当前包和自动版本为准，细项不按同名推断关系。
- 方向选择由 URL 管理，刷新、浏览器前后退与数据集返回恢复；新模块/细项、关闭、切换 Tab 清除旧方向。
- 补充问题、问题簇、候选变体的明确创建事件，只用 `createdAt` 表示建立时间，未用更新时间假造状态变化。

| 补充任务 | 验收证据 | 结果 |
| --- | --- | --- |
| 5.1 | 模块名/普通行默认历史、Evidence/人工独立；精确方向分组、时间历史前移及默认展开、评分依据可查看 | 通过 |
| 5.2 | 31 项选择器检查；旧评测包合法来源、无跨 Trace/模块借用、明确细项及方向源版本、刷新/Back/Forward/返回 | 通过 |
| 5.3 | 相关 120 项及布局前移后 13 项复查；完整 55/55 浏览器、最终阅读场景 2/2、构建/lint/显式应用 tsc/strict/diff-check | 通过 |

相关单元/页面：[120 项日志](artifacts/direction-unit.log)，前移时间历史后的 [13 项复查日志](artifacts/direction-ui.log)。未重复宣称之前全量 572 项在本次澄清后全部重跑。

完整浏览器：[55/55 日志](artifacts/direction-browser.log)，退出 0，3.7 分钟；最终时间线用语及截图：[2/2 阅读场景](artifacts/direction-reading.log)，退出 0。旧模块行改为可点击按钮后，其可访问名称改变，旧检查定位随之更新，完整复核与发布反查行为仍通过。

[最新构建日志](artifacts/direction-build.log)通过，保留原 bundle 大小提示；lint、显式应用 tsc、OpenSpec strict 及 diff-check 均退出 0。4174 服务保持可用，未重置本地数据或新增真实服务操作。

最终 [1280px 历史截图](artifacts/module-direction-history-1280.png)和 [1440px 历史截图](artifacts/module-direction-history-1440.png)已人工阅读。来源、固定版本、15 条完整时间历史及四阶段分工可见，历史区保留全部记录并可滚动。

## 本轮：数据集与评测页面扩展验收

日期：2026-10-13，Asia/Shanghai。

| 项目 | 验收内容 | 结果 |
| --- | --- | --- |
| 时间窗口筛选 | 数据集与评测页提供数据集所属 Window 下拉；筛选条件写入 URL，切换后清除失效的详情定位 | 通过 |
| 自定义时间范围 | 支持开始 / 结束两个 datetime 输入；写入 `datasetTimeFrom/datasetTimeTo`，与已配置 Window 互斥，结束早于开始时显示错误并不返回结果 | 通过 |
| Dataset 样本时间 | 自定义集加入 Trace 后按成员 Trace 的 `queryAt`（缺失时使用 `startedAt` / `endedAt`）派生 `timeRange`；旧本地快照通过 Seed 2.7.3 增量回填 | 通过 |
| 时间 Mock 覆盖 | 新增黄金、准出、个人创建三类时间分布不同的 Mock 数据集，均带 TRACE membership，可用于闭区间和单边界测试 | 通过 |
| 数据集类别筛选 | 仅按类别筛选“准出数据集 / 黄金测试集 / 个人创建集”；列表同时展示具体类别、用途和冻结状态 | 通过 |
| 自定义数据集 | 创建卡片要求名称与描述 / 用途，默认归类“个人创建集 · 自定义数据集”；创建后自动进入详情 | 通过 |
| Query / Trace 加入 | 自定义集详情可勾选尚未加入的 Trace，按真实 Trace membership 写入；列表展示 Query、Trace、时间和 0–2 评分 | 通过 |
| 按资产均匀抽样 | 支持 Skill 固定版本、Memory、Reason、Act、Context 等治理资产；按历史进化项经历过的去重 Trace 数计算比例、配额和实际抽样数 | 通过 |
| 抽样可复查 | 同一 Trace 命中多个进化项时去重；保存资产、固定版本、历史数量、比例、配额、实际 Trace 和规则快照 | 通过 |
| 冻结保护 | 冻结数据集拒绝手动添加和抽样写入，不新增 membership 或审计事件 | 通过 |
| 本地持久化 | 自定义数据集、Trace membership、抽样快照和审计记录可刷新恢复；旧本地数据增量迁移 | 通过 |

本轮验证结果：完整 Vitest `72` 个测试文件、`605` 项测试全部通过；自定义数据集相关 7 项测试全部通过；Playwright `case-filter-window-dataset` 与 `trace-dataset-evaluation-workbench` 共 `2/2` 通过；build、lint、应用 TypeScript、OpenSpec strict、diff-check 通过；4174 服务 HTTP 200。

本轮仍为本地 Mock 数据层，未调用真实 Trace、评测 Agent、实验或发布服务。抽样比例使用 Mock 台账中的历史 Trace 关联；没有历史关联的资产显示无可抽样记录，不推断真实线上分布。

## 后续修复：模块筛选不替换统一工作台

选择“归因对象 → 记忆 / Reason / Act”等普通筛选时，继续保留统一数据集与评测工作台的上方 Skill、版本、时间和数据集筛选。仅显式历史视图、进化记录或目标深链进入模块目标工作台。回归测试覆盖上方筛选仍可见，相关 12 项测试通过，Build、OpenSpec strict、diff-check 与 4174 HTTP 200 复查通过。

## 后续修复：归因历史返回数据集保留筛选

从模块归因历史切回数据集时，若 URL 仅携带模块范围而没有明确目标 ID，则自动回到统一工作台，清除临时 `evolutionScope=records`，保留时间窗口、两个 datetime、数据集类别和模块筛选。回归测试覆盖 Memory 历史返回路径，相关 15 项测试通过。
