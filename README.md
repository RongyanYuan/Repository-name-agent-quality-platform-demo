# Office Agent 自进化治理平台

面向 Office Agent 的可运行中文治理 Demo，覆盖从线上 Case 到发布回查的完整闭环。

线上 Case → 过程/产物评测 → 多问题归因 → 直接修复或问题聚类 → 能力变体 → 单变体实验 → 窗口组合实验 → 准出决策 → 发布与回查

## 页面

- /overview 治理总览：质量、过程、性能、风险/商业化监控，以及按 Case、问题、变体、实验和决策区分统计单位的进化漏斗。
- /cases Case / Trace 分析：列表每条 Trace 只展示最新节点状态；详情为 Session 对话、评测中心、产物评测三个 Tab，默认评测中心。进化状态和完整历史统一在各模块内查看。
- /datasets-evaluations 数据集与评测：本页唯一筛选链为 Skill 分类 → 具体 Skill → 版本（默认最新，支持全部版本）→ 归因，顶部不重复显示 Skill 控件。支持按分类、具体 Skill 或唯一固定版本归因浏览测试集；仅保留“数据集”和“归因历史”两个视图。待进行/进行中归因在下拉展示，已完成项保留在历史。数据集详情按行展示成员 Trace，点击进入完整 Case 分析，返回保留原筛选与详情。
- /evaluations 重定向到 Case / Trace 分析；/datasets、/issues、/variants、/experiments、/releases、/assets-skills 重定向到数据集与评测对应视图。底层治理实体、实验与发布快照均保留。
- /rules 规则配置：触发门槛、实验次数、指标门禁和性能基线；未确定项显示“待配置”。

## V2 评测与分流链路

Trace 集 → Evaluation Batch / Job → Trace Evaluation Package → 模块 Finding → Routing Policy / Delivery → 算法 Badcase、Agent 迭代、品味库或 Personal Skill 二期规划 → Issue / Cluster / Variant → Experiment → Gate → Release。

V2 Mock 基础台账包含 40 条 Trace / 39 条 Case，另补充 29 条结构化 PRD 场景 Trace / Case，覆盖 `PRODUCTION_SKILL`、`GENERAL`、`PERSONAL_SKILL`、`TASTE_SKILL`、`UNCLASSIFIED`，以及 Draft、Queued、Running、Partial、Completed、Failed 六种批次状态。场景样例明确覆盖记忆四类归因、Reason/SOP、生产 Skill 文件/SOP/name-description、品味库召回/资产质量/资产不足、Act/Tool 稳定性和多路分发。品味样例提供 1000 名去重用户中 950 名偏好“红色”的聚合信号，并与 120 条相关数据、100 条触发规则、候选变体和单变体实验建立关联；950/1000 不是准出阈值。生产 Skill 失败按 PRD 区分 Skill 直接修复与策略迭代算法 Badcase；同一 Trace 的多个 Finding 可以产生多路 Delivery。个人 Skill 只展示 Query、Asset/File、已有 Skill、Conversation + Artifact 来源，不伪造自动生成服务。

旧地址 /tasks、/performance、/anomaly-monitoring、/benchmarks、/evaluation-config 保留兼容跳转；旧治理地址会携带原有筛选和对象 ID。

固定版本示例补充 11 个独立归因工作区、33 条完整 Case / Trace 和 33 个独立测试集，覆盖 PPT、Excel、Word、Canvas 和品味 Skill 的多个版本。工作区按 `skillId + skillVersion + attributionId` 管理，不把旧版本准出结论复用到新候选。

## 当前 Trace 阅读与人工复核

Case 列表按 Trace 分行，状态列只呈现最新有明确时间的实际节点及文字圆点。详情只有 Session 对话、评测中心、产物评测三个 Tab。公共头部统一身份 / Query / 来源 / 时间 / 最新状态；评分由各自 Tab 展示，切换 Trace 不借用另一 Trace 的数据。

过程评测仅保留过程模块与可展开细项，没有重复过程框或 Outcome 行。产物评测按 Artifact 切换，展示最终记录、具体维度 0–2、Judge Reason、Rubric、Evidence、时间、版本和人工复核。新增 Mock 包含 PPT、Word、Excel、生图与同一 Trace 双产物；未提供的专项标准显示待配置，缺评分不推算最终分。

独立治理链路 Tab 和重复定位按钮已移除。模块内的各归因方向默认收起，只显示归因名称；点击展开后查看固定目标 / 版本、分流、数据集、实验、准出、实际发布和时间历史。原治理事件与来源数据保留。模块人工复核历史使用独立抽屉，Case 共享处理审计在 Session 中折叠查看。执行节点和 Log 从评测 / Evidence 打开抽屉。

模块行可直接人工复核：输入 0–2 分、辅助结论和说明；保存后追加独立记录，保留自动 Judge Reason、Evidence 与 Rubric。重跑后旧复核会标记需要重新复核，自动最终分数不根据人工模块分数任意重算。上文只作为证据，不独立评分。执行、评测结论、模块复核和治理状态分别用带文字的绿 / 黄 / 红 / 灰圆点表示。

新增的时间化 Mock 场景可从这些旧别名访问：`trace-governance-demo-ppt`（聚类、实验、准出、发布、回滚与后续待处理分支）、`trace-governance-demo-tool`（直接修复）、`trace-governance-demo-parallel`（算法与 Agent 并行分流）、`trace-governance-demo-ppt-context`（未评测的兄弟 Trace）。Session / Trace 正式 ID 为稳定的 22 位数字字符串；旧 URL、搜索和快照引用仍可解析到同一对象。

数据集成员区分明确加入的 Trace 与 Case 共享归属。缺少原始加入时间会显示“加入时间未记录”，回归 / 泛化样本标记“用于验证”，不会被当成变体来源或问题已解决。

## 模块归因与独立进化轮次

点击过程评分表的模块名或普通行，即进入该模块的进化方向列表。各项默认收起，仅显示归因短名称，例如 `skill name/description错误`、`skill sop错误`；可分别展开和收起。展开后按具体目标、固定源版本和归因显示当前及历史轮次，策略与 Agent 路径分别保留；完整时间历史在状态卡之前，长记录可滚动查看。Evidence、人工复核和复核历史保留独立入口。方向筛选本身不自动展开，精确记录链接返回会定位相应方向。

详情按 Trace、评测包、自动版本、模块及细项精确关联归因，并包含同一 Trace、同一模块的明确旧评测包历史；旧包只作历史，不参与当前状态。每条归因可以进入策略与 Agent 两条路径，分别展示“是否可进化、流转去向、准出状态、是否上线”。低分只是问题线索，不自动满足进化条件。上文仅作为证据。

点击数据集或准出链接后，只查看该路径明确关联的对象、数据集、实验和报告。Skill 使用具体 Skill 的固定源版本；记忆、Reason、Act 等使用各自治理目标及版本，并清除 Skill 筛选。共用数据集按进化轮次分别展示准出结论，历史通过不会成为新轮次的状态。返回保留原 Trace、模块、评分细项和筛选。

`trace-ppt-generate`（正式 ID `2037904916466732346556`）的 skill 模块提供多归因和两路流转示例：SOP 策略路径等待回传，Agent 修复路径已通过 Mock 人工准出、待发布；品味召回路径独立积累。记忆准确率采用独立治理目标 `memory-policy`，门槛待配置。所有示例均为 Mock，未执行真实策略提交、实验或发布。

## 启动

```sh
pnpm install
pnpm dev --host 127.0.0.1 --port 4174 --strictPort
```

打开 http://127.0.0.1:4174/overview 。

## Mock 与真实接口边界

- 全部指标、Case、评测、问题簇、变体、实验和发布均为结构化 Mock 数据，不代表真实线上表现。
- 本地数据由带 schema version 的 Repository 和 LocalStorage 持久化，支持重置、迁移保护和审计轨迹。
- V2 Repository 会对 V1 LocalStorage 做增量迁移，并对旧版 Mock 快照做一次 `MOCK_FIXTURE_UPGRADED` 增量升级：保留原 Case/Trace/Eval/审计记录、人工字段和历史实验快照，只补齐新的场景数据、Batch/Package/PreferenceSignal 数组。
- 自动评测、人工修订、实验配置快照、准出决策和发布状态分开保存。
- Seed 当前为 `office-agent-governance-demo-2.7.3`，schema 保持 2。身份迁移只更新活动引用；冻结快照、自由文本证据、用户对象和历史复核保留。产物细项、父节点关系、模块来源绑定、独立进化轮次和数据集筛选 Mock 增量补齐，不替换原评分与人工复核。升级或 alias 冲突失败时保留原存储并提供诊断与原始数据导出，不自动重置。
- 模块复核与 Case 导入先保存再更新界面。存储失败保留输入和所选 Trace，不生成假成功事件。
- 大评测快照无损压缩并去重后保存，保留旧 JSON 数据兼容；不会为规避本地容量限制删除 Evidence、Rubric、审计记录或历史结果。
- Mock 包含三条可追溯链：管理层 PPT 聚类进化并发布、确定性 Tool/Skill 错误直接修复、多归因多路分发。
- Trace/Langfuse、Eval Agent、实验运行、资产生成与发布服务尚未连接；数据访问层预留真实接口。
- 个人资产不会默认公开；进入公库必须经过脱敏、审核和发布。

## 待配置规则

PRD 未提供的耗时/成本基线、多数聚类门槛和指标门禁显示“待配置”，不会用虚构阈值给出效率或准出结论。品味库按 Skill 累积 100 条相关数据是明确计数条件；实验默认每 Case 运行 3 次并可配置。

人工模块评分如何形成最终评分尚未定义，因此自动最终分数、人工模块分数和辅助结论分开显示。上文归因细项仍待需求评审。

## 验证

pnpm run lint
pnpm test
pnpm run build
pnpm run test:e2e

本轮逐项证据见 [模块归因与独立进化轮次验收记录](openspec/changes/module-attribution-evolution-paths/acceptance.md)：原始全量回归 572 项通过；模块点击与完整方向历史、三 Tab、默认折叠、Case 范围及时间窗口/数据集筛选修正后，最新全量回归 598 项与 57 个浏览器场景通过。此前证据见 [四 Tab、产物细项与治理时间图](openspec/changes/trace-status-timeline-outcome-tabs/acceptance.md) 和 [身份与模块人工复核](openspec/changes/trace-case-dedup-human-review/acceptance.md)。浏览器测试建议使用独立端口，例如 `BASE_URL=http://127.0.0.1:53124 pnpm test:e2e`，保持 4174 的开发服务可用。

Case / Trace 分析还支持治理时间窗口和数据集筛选：按 Window 或自定义 Query 时间范围，以及“准出数据集 / 黄金测试集 / 个人创建集 → 具体数据集名称”筛选。结果使用 Trace 级数据集成员关系，避免同 Case 的兄弟 Trace 被误加入。
