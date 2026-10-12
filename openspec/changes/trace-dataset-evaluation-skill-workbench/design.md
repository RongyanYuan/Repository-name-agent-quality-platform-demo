## Context

现有实现已经具备 Case/Trace、评测批次、数据集、Skill、变体和实验实体，但页面入口、筛选状态和数据关系分散。已有本地 Mock 数据与 URL 状态同步机制需要继续兼容，且现有归因维度、Evidence、实验快照和人工标注不能被覆盖。

## Goals / Non-Goals

**Goals:**

- 用稳定的前端领域模型表达 Channel、垂类场景、过程/产物 0–2 评分、成本、来源标签和数据集用途。
- 让 Trace 列表和数据集与评测工作台共享 Skill/进化项筛选、对象 ID 和返回路径。
- 保持批量导入、Golden Set 去重、评测结果、准出状态和历史记录的本地持久化。
- 让 Skill 细项成为轻量身份与关联入口，避免重复展示已经统一到数据集与评测页的治理对象。

**Non-Goals:**

- 不接入真实 Eval Agent、Trace/Langfuse、发布服务或后端数据库。
- 不定义 PRD 未给出的业务阈值、准出门禁或评分解释规则；此类信息继续显示为待配置或使用 Mock 口径。
- 不删除历史 URL 参数、旧数据集、旧实验快照或用户已经保存的人工标注。

## Decisions

### 1. 扩展现有实体而不是新建平行数据层

在 `Trace`、`Case`、`ModuleEvaluationScore`、`Dataset`、`Experiment` 和 `Skill` 上增加可选字段：Channel、垂类场景、0–2 过程/产物评分、数据集来源标签、用途、冻结状态和历史时间。使用 selector 计算列表投影，避免页面直接复制多份关系数据。替代方案是单独维护 TraceWorkbenchStore，但会造成与现有 EvolutionState 的双重事实来源。

### 2. 统一归因维度字典

将附录归因表原文集中放入可复用的 taxonomy 常量，筛选、标签、数据集和历史记录均使用同一 ID + 原文 label。旧版本标签继续通过 legacyRawLabel 保留，避免历史数据迁移破坏；新数据禁止使用同义改写。

### 3. URL 驱动筛选与跨页联动

Trace 筛选、Skill + 进化项筛选、分页、选中行和详情对象均写入 URL。页面跳转只增加目标对象参数并携带 `returnTo`，返回时恢复原筛选。旧 `/evaluations`、`/datasets` 和旧 Skill 深链保留重定向到新的统一页面。

### 4. 数据集与评测采用“对象集合 + 用途投影”

同一个 Skill + 进化项作为工作台主键，页面从 Dataset、Experiment、GateDecision 和 Release 的快照中投影评测集、准出集和实验信息。数据集名称与数据集用途分列，避免把“回归数据集A”等业务名称误当作实验类型。准出状态单独从 GateDecision 读取，不从实验 status 推断。

### 5. 批量操作使用可审计本地 mutation

批量加入评测集和 Golden Set 通过现有 Evolution reducer/repository 写入成员和 AuditEvent；执行前以 Case ID 检查所有数据集成员，重复项逐条返回阻止原因。批量导入不删除原始来源标签和 Trace 评测结果。

### 6. Skill 页面做入口收敛而非删除实体

Skill 细项隐藏资产、问题与归因、实验与准出、能力变体、发布版本的重复区块，但保留对应对象 ID 的统一入口和基本版本信息。实体仍留在数据层供反查、实验快照和历史展示使用。

## Risks / Trade-offs

- [Risk] 旧 Mock 快照缺少新字段 → [Mitigation] 提升 seed/schema 版本并增加增量迁移，只补默认值和新种子关系，不覆盖人工修改。
- [Risk] 0–2 评分与旧 PASS/FAIL 同时存在 → [Mitigation] 列表显示数值评分，旧状态作为兼容标签；缺失评分明确显示待评测。
- [Risk] 一个 Case 属于多个数据集导致重复计数 → [Mitigation] 所有批量写入按 Case ID 去重，页面分开显示数据集归属而不混用分母。
- [Risk] 归因原文包含括号、斜杠和中英文混排，筛选容易被改写 → [Mitigation] taxonomy 常量、测试快照和页面选项共享同一来源。
- [Risk] 合并入口导致旧链接失效 → [Mitigation] 保留旧路由重定向并携带原筛选和对象 ID。

## Migration Plan

1. 增加本地 Mock seed/schema 版本与迁移默认字段。
2. 先上线 Trace selector 和统一筛选 URL，再接入批量 mutation。
3. 上线数据集与评测统一页面，并保留旧页面重定向。
4. 精简 Skill 细项展示，确认旧对象深链仍能打开统一工作台。
5. 运行单元、集成、E2E 和构建验证；若回滚，恢复旧入口组件，保留已写入的新增字段和审计记录。
