# Office Agent 自进化治理平台

面向 Office Agent 的可运行中文治理 Demo，覆盖从线上 Case 到发布回查的完整闭环。

线上 Case → 过程/产物评测 → 多问题归因 → 直接修复或问题聚类 → 能力变体 → 单变体实验 → 窗口组合实验 → 准出决策 → 发布与回查

## 页面

- /overview 治理总览：质量、过程、性能、风险/商业化监控，以及按 Case、问题、变体、实验和决策区分统计单位的进化漏斗。
- /cases Case / Trace 分析：Session、多轮对话、Trace 节点、日志、Evidence、Artifact、评测、归因和治理链路。
- /datasets-evaluations 数据集与评测：本页唯一筛选链为 Skill 分类 → 具体 Skill → 版本（默认最新，支持全部版本）→ 归因，顶部不重复显示 Skill 控件。支持按分类、具体 Skill 或唯一固定版本归因浏览测试集；仅保留“数据集”和“归因历史”两个视图。待进行/进行中归因在下拉展示，已完成项保留在历史。数据集详情按行展示成员 Trace，点击进入完整 Case 分析，返回保留原筛选与详情。
- /evaluations 重定向到 Case / Trace 分析；/datasets、/issues、/variants、/experiments、/releases、/assets-skills 重定向到数据集与评测对应视图。底层治理实体、实验与发布快照均保留。
- /rules 规则配置：触发门槛、实验次数、指标门禁和性能基线；未确定项显示“待配置”。

## V2 评测与分流链路

Trace 集 → Evaluation Batch / Job → Trace Evaluation Package → 模块 Finding → Routing Policy / Delivery → 算法 Badcase、Agent 迭代、品味库或 Personal Skill 二期规划 → Issue / Cluster / Variant → Experiment → Gate → Release。

V2 Mock 基础台账包含 40 条 Trace / 39 条 Case，另补充 29 条结构化 PRD 场景 Trace / Case，覆盖 `PRODUCTION_SKILL`、`GENERAL`、`PERSONAL_SKILL`、`TASTE_SKILL`、`UNCLASSIFIED`，以及 Draft、Queued、Running、Partial、Completed、Failed 六种批次状态。场景样例明确覆盖记忆四类归因、Reason/SOP、生产 Skill 文件/SOP/name-description、品味库召回/资产质量/资产不足、Act/Tool 稳定性和多路分发。品味样例提供 1000 名去重用户中 950 名偏好“红色”的聚合信号，并与 120 条相关数据、100 条触发规则、候选变体和单变体实验建立关联；950/1000 不是准出阈值。生产 Skill 失败按 PRD 区分 Skill 直接修复与策略迭代算法 Badcase；同一 Trace 的多个 Finding 可以产生多路 Delivery。个人 Skill 只展示 Query、Asset/File、已有 Skill、Conversation + Artifact 来源，不伪造自动生成服务。

旧地址 /tasks、/performance、/anomaly-monitoring、/benchmarks、/evaluation-config 保留兼容跳转；旧治理地址会携带原有筛选和对象 ID。

固定版本示例补充 11 个独立归因工作区、33 条完整 Case / Trace 和 33 个独立测试集，覆盖 PPT、Excel、Word、Canvas 和品味 Skill 的多个版本。工作区按 `skillId + skillVersion + attributionId` 管理，不把旧版本准出结论复用到新候选。

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
- 大评测快照无损压缩并去重后保存，保留旧 JSON 数据兼容；不会为规避本地容量限制删除 Evidence、Rubric、审计记录或历史结果。
- Mock 包含三条可追溯链：管理层 PPT 聚类进化并发布、确定性 Tool/Skill 错误直接修复、多归因多路分发。
- Trace/Langfuse、Eval Agent、实验运行、资产生成与发布服务尚未连接；数据访问层预留真实接口。
- 个人资产不会默认公开；进入公库必须经过脱敏、审核和发布。

## 待配置规则

PRD 未提供的耗时/成本基线、多数聚类门槛和指标门禁显示“待配置”，不会用虚构阈值给出效率或准出结论。品味库按 Skill 累积 100 条相关数据是明确计数条件；实验默认每 Case 运行 3 次并可配置。

## 验证

pnpm run lint
pnpm test
pnpm run build
pnpm run test:e2e
