## Context

用户已审核四阶段方案并明确apply；本轮以moduleScore/Finding/归因/独立进化轮次为单位。原数据有Issue/Cluster/Variant/Experiment/Gate/Release实体，但旧workbench按Skill交叉聚合，不能作模块路径状态源。当前工作区保留上两轮未提交成果，不重置、提交、推送或新建主导航。

## Goals / Non-Goals

实现模块表摘要、每细项归因路径详情、准确门槛/分流/准出/上线，以及Skill/非Skill目标跳转。没有配置的门槛不推断，没有来源边的实验/发布不借用，仅验证样本不声称发起进化。上文仍只作Evidence。

## Decisions

1. 新增可选 `moduleEvolutionBindings` 和 `evolutionRecords` 台账，旧EvolutionTarget保留兼容。Binding保存traceId/packageId/moduleScoreId/automaticRevisionId/processEvaluationId?/scoreDimensionId?/findingId/attributionRecordId?/evolutionRecordIds。Record为每一轮目标改进，保存目标对象及固定源版本/归因、sources、routingDeliveryIds、datasets、variants、single/window experiments、decisions、releases和createdAt；不同轮次不合并。
2. `EvolutionTargetIdentity` 区分SKILL与MODULE。SKILL必须具体skillId/skillVersion；MODULE用governanceObject/targetId/targetVersion?，无Skill字段。Version缺失明确未记录，不以执行过的Skill版本替代记忆策略版本。
3. 选择器 `selectModuleEvolution(state,{traceId,packageId,moduleScoreId,automaticRevisionId?,processEvaluationId?,scoreDimensionId?})` 严格沿binding→finding→record取路径，返回摘要、当前及历史路径、缺绑定提示；不使用旧track.stateLabel决定状态。Record关联到Delivery、SourceIssue/Cluster、Variant、Experiment、Decision、Release应互相校验。Strategy/Agent两路独立；当前路径四阶段状态不互相覆盖。
4. 可进化由确认归因、PRD优化方式和已配置条件判断。聚类展示数量/去重口径/门槛，品味仅使用明确100条条件；无规则待配置。准出区分单能力与窗口，只有当前候选准确关联的Gate才有效，发布另取实际Release。操作/自动重跑不隐式重分流，不重写旧轮次报告。
5. 模块矩阵新增进化摘要和明确详情入口。二级Drawer保留评分Reason/Rubric/Evidence入口，各归因方向默认收起，展开后列四阶段和完整时间历史。旧Evidence/人工编辑各自职责保持。详情可定位特定ProcessEval/细项；多个处理去向分行。独立Trace治理Tab删除，旧finding/record链接精确定位评测模块，不复制全Trace时间图。
6. 数据集工作台接受evolutionRecordId/targetId/targetVersion和原attribution筛选；精准轮次上下文只能显示其dataset/exam/gate/release。Skill链接携具体固定源版本；非Skill清Skill分类/skill/version，按模块target/归因过滤，返回保存原Trace/module/evaluation及页面筛选。没有匹配报告显示未进入/等待回传/未记录，不退回全Skill通过结果。
7. Mock增量台账和额外案例由独立helper构造；明确绑定只对可验证的seed/已知来源，旧未知对象显示未关联。Repositorymerge新数组时不替换评分、人工及冻结快照。已有自动revision改变时旧binding为历史，不冒充当前结论已确认。
8. 用户明确模块点击阅读方式：模块名和普通行打开归因方向列表，初始全部收起、仅显示归因短名称；Evidence 独立按钮。点击方向后，以目标对象/固定源版本/归因分组展示当前及历史轮次、策略/Agent路径和完整时间历史。方向筛选本身不自动展开；精确记录深链接和返回可以定位并展开对应方向。方向选择写入 URL，返回/刷新恢复。旧评测包只作历史；细项按明确 ID 限定。
9. Case详情只有Session对话、评测中心、产物评测三个Tab，默认评测中心。旧governance/trace链接转评测中心；有明确Finding/record时定位同Trace评分模块，无匹配不替代。模块复核历史迁移为独立Drawer，保留完整自动快照和多次人工记录；Case共享处理审计放在Session中折叠查看，来源实体与数据不删除。
10. 列表详情关闭动作清理 `traceId/sessionId` 等瞬时定位字段，保留全局/本地筛选；Case / Trace 列表分页批次从 3 调整为 10，筛选计数仍以全部命中记录计算。
11. Case / Trace 增加独立的 `timeWindowId` 和数据集筛选字段，避免复用工作台详情的 `windowId`/`datasetId`。数据记录保留 `datasetRefs`，从 `DatasetMembershipRecord` 的 TRACE/CASE_SHARED 关系计算；选中具体数据集只显示该数据集下的 Trace。时间窗口使用 Window.timeRange；旧相对时间参数继续兼容。
12. Dataset 增加明确来源类别与创建者信息，Mock 覆盖准出四类、黄金测试集和个人创建集。筛选选项采用“数据集类型 → 具体数据集”的互斥联动，切换类型清除不匹配名称。

## Interfaces / Ownership

- root：domain.ts、data/moduleEvolutionFixtures.ts、Seed/upgrade/validation、App/model路由、最终验收。
- selector agent：data/moduleEvolution.ts及tests，导出selectModuleEvolution/selectEvolutionRecord与构建精确workbench URL helper，四阶段及来源保护。
- UI agent：CaseEvaluations、ModuleEvaluationMatrix、ModuleEvolutionDetail.tsx和相关test；消费选择器接口，主表摘要与二级四阶段。
- workbench agent：generic目标与轮次dataset/history适配、DatasetEvaluationWorkbenchPage/skillWorkspace/traceDataset/AttributionHistoryDrawer及聚焦tests；不改source评分或report。

## Risks / Trade-offs

- 多归因或不同策略轮次串状态 → explicit binding及recordID，不按label和数组位置查关系。
- 非Skill误锁Skill → discriminated target及互斥URL处理，旧逻辑保持但精准新路径优先。
- 已发布后新问题继承准出 → 新record，旧历史明确readonly；候选版本和来源报告配对验证。
- 横向四阶段在笔记本拥挤 → 阶段卡2×2可读布局与细节折叠，1280/1440检查；主表仅短摘要。

## Migration Plan

optional契约→选择器/明确Mock→UI/工作台集成→旧链接及历史保护→全量单元/应用tsc/独立端口浏览器/构建。准出和发布仍Mock，数据访问层继续预留服务接口。
