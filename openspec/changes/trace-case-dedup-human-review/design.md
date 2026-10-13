## Context

动机和范围见 proposal.md。本次为跨模型、迁移、路由与详情组件的改版，满足创建技术设计的条件。

当前代码可复用的数据层包括 Session / Case / Trace、评测包和模块分数、Finding / Routing Delivery、数据集、变体、实验与冻结准出报告；Repository 已支持本地持久化和大快照压缩。主要缺口是：

- `CaseAnalysisWorkbench` 将 `CaseEvaluations` 同时放在 Trace 和评测 Tab，`LinksPanel` 又同时出现在 Trace 折叠区和治理 Tab。
- 活跃 Trace 切换使用局部 record 重映射，遗漏最终分数、耗时、产物和治理关系等 Case / Trace 语义差异。
- `CaseEvaluations` 没有向 Evidence Drawer 传人工保存回调，当前 reducer 只覆盖最新 human 字段并附加审计，缺少独立模块复核 revision。
- Dataset 只有 Case 成员数组，缺少 Trace 精度、加入时间和版本化成员事件；现有治理链接数组没有事件时间或并行分支。
- 现有文本 Session / Trace ID 广泛用于引用、测试和快照；不能用字符串全局替换破坏历史证据。

## Goals / Non-Goals

**Goals:**

- 建立类型明确的 Trace 阅读投影，让所有入口共享当前 Trace 的评分、证据、状态和治理来源。
- 使用可追溯、追加式数据表达人工复核和流转事件，保留原始自动数据与冻结快照。
- 长数字身份升级与业务语义调整分步完成，每步有独立回归及幂等迁移验证。
- 将用户要求转成 tasks.md 中可勾选的验收条目，实施后输出对应测试 / 浏览器证据。

**Non-Goals:**

- 不新增主页面，不接真实 Trace / Eval / 实验 / 发布服务，不生成真实 Office 文件。
- 不修改 PRD 归因 wording、Skill 固定版本规则、未知门禁或现有批量导入限制；不将 N/A / 缺失评测视为成功。
- 不强制重编号 Case、Observation、Log、Evidence 等所有对象；组件支持长值，但本轮只要求 Session / Trace 的数字 Mock 身份。
- 不把人工评分保存等同于自动分流、问题解决、实验准出或实际发布。

## Decisions

### 1. 五个 Tab 保留，完整内容单一归属

采用以下职责，不新建另一套详情页面：

| 区域 | 保留内容 | 不再重复呈现 |
| --- | --- | --- |
| 公共头部 | Case / Session / 活跃 Trace 身份、Query 摘要、来源、不同状态维度、Trace 切换 | 同一 Case ID 作为 Task ID 再出现一次、完整治理链 |
| 任务与关联 | 补充任务要求、产物摘要 / 下载、用户反馈 | 头部 ID 卡片、完整 Query、运行 Log、完整归因与人工审计 |
| Session 对话 | 多轮内容、时间、轮次到 Trace 的链接 | 第二套 Trace Timeline / 评测矩阵 |
| Trace 与 Evidence | 执行节点、选中节点摘要、Evidence / Log 入口 | `CaseEvaluations`、治理折叠区、人工历史副本 |
| 评测中心 | 当前 Trace 模块矩阵、独立过程与产物细维度、人工复核 | 第二套完整执行 Timeline、完整治理路径 |
| 治理链路 | 当前 Trace 治理分支、时间线、数据集去向、人工事件摘要 | 另一套评分编辑表单或全文 Evidence |

完整证据使用一个可复用内容组件；执行与评测入口可以打开同一 Evidence 呈现，不能为去重删除根证据 / 具体 Rubric。Observation 原始输入输出与 Log 只在其详情完整呈现。Case 处理确认 / 调整归因可保留公共操作，但名称和作用必须区别模块人工评分。

拒绝“隐藏整个评测能力来去重”；只移除交叉 Tab 的完整副本，保留必要只读摘要和语义链接。

### 2. 用完整 Trace 投影替代局部 record 拼接

在数据选择层建立 `TraceDetailView` / `selectTraceDetail`，输入完整状态及 canonical Trace ID，输出：执行身份、所属 Case / Session、运行时间和成本、Skill 版本、该 Trace 的产物 / 节点 / 证据 / 模块评测 / 复核 / Findings / 治理事件。

- Case 级信息单独分组，明确标记共享；列表可以一行一条 Trace，Case ID 用于归组和详情入口，避免把非主 Trace 隐藏在主 Trace 行后。
- URL 保留选中 `traceId` / `caseId` / Tab，所有 Tab 读取同一投影；切换时清除不属于新 Trace 的 Observation / Evidence 选择。
- Session 全文不裁成单 Trace；高亮当前 Trace 对应用户轮次。Artifact 属于各自 Trace，不以 Case 第一个 Artifact 代替。
- 详情从完整状态按明确 ID 读取，列表保持当前范围，冻结样本不会因线上 7 天筛选而打不开。

拒绝让每个 Tab 自行推断主 Trace 或用 Case 结果倒推模块评分。

### 3. 模块复核采用追加记录，旧 human 字段只作兼容投影

新增类型明确的模块复核记录，核心字段：

```text
id, traceId, packageId, moduleScoreId, automaticRevisionId
humanScore?, auxiliaryVerdict, reason, reviewer, reviewedAt
evidenceIds, rubricVersion, rubricRule, evalAgentVersion
automaticSnapshot, supersedesReviewId?, origin
```

- `automaticSnapshot` 保存当次自动分数的原始量纲、结论、Reason、证据 / Rubric 引用；历史原始 0–1 值只在显示层转为 0–2，不把旧自动记录重写为新量纲。
- “人工复核 / 修改复核”与“查看 Evidence”在矩阵行明确分开，复用同一复核编辑器；Evidence 中的复核入口打开该编辑器，不另维护一份独立表单状态。
- 保存通过 `App → EvolutionCasesPage → CaseAnalysisWorkbench → CaseEvaluations` 类型化回调，只允许修改当前 Trace、包及模块；范围校验同时放在编辑器与写入边界。
- 适用模块人工已评分结论要求有效 0–2 数值（步长 0.01），分数 0 合法；UNKNOWN / N/A 可留空并说明原因。辅助结论支持现有模块五态，派生选择需有现有来源证据，不新造首错关系。
- 保存说明必填；自动 Judge Reason 和人工说明并列。最新适用 revision 更新兼容 human 字段，全部 revision 在治理 Tab 的模块审计中逐条查看。
- 复核编辑器展示最新值和人员时间；“查看复核历史”切换到治理 Tab 并定位当前模块的审计事件，完整人工历史只有一处，不在任务、Trace 或评测面板重复整份列表。
- 人工未复核、已复核、自动 / 人工不一致为复核维度，独立于执行 / 评测维度。重跑产生新自动 revision 时保留旧人工记录，不能把针对旧版本的复核默默当成新结果已复核。
- 保存成功必须以实际持久化结果为准；错误保留输入。采用现有 lossless snapshot 压缩，不靠删除历史绕过容量限制。
- 模块评分不任意平均成新最终分数；继续显示“自动最终分数”，人工最终聚合规则未配置时明确说明。不会自动改现有分流或冻结报告。
- Context / 上文在矩阵中移至只读证据说明，不开放独立评分；当前 PRD 不覆盖的其他模块保持明确未评测 / 不适用状态。

拒绝只更新 `humanScore` 而不留原始自动快照和历史；审计保留为交叉索引，不作为丢失精度的唯一复核来源。

### 4. 治理事件与成员记录使用显式 Trace 范围

追加式 `TraceGovernanceEvent` 包含：

```text
id, traceId, caseId, branchId?, occurredAt?, recordedAt
stage, statusCode, actor, description
sourceRef?, targetRefs[], origin, relationType, sourceEventId?
```

`origin` 区分 Mock seed、真实本地操作、历史导入；`relationType` 区分 Trace 直接来源、Case 共享、用于验证。事件状态使用枚举，不从中文文案猜测。

配套 `DatasetMembershipRecord` 保存 datasetId、datasetVersion、caseId、明确 traceIds 或 CASE_SHARED 范围、joinedAt、actor、来源、成员事件 ID。保留现有 dataset.caseIds 和批量重复加入政策，不借本改版放宽加入限制；只补精度和历史。

- 新动作（复核、归因、分流状态变化、成功加入数据集、实验、准出、发布 / 回滚）在同一事务记录实体变化与事件。失败 / 被重复加入限制阻止的动作不产生“成功加入”事件。
- 已有专用动作时间优先用 `evaluatedAt / revisedAt / deliveredAt / decidedAt / releasedAt` 等；只有 `updatedAt` 时只能称“记录更新时间”。成员加入时间未知显示“未记录”，不能借 dataset.updatedAt 补造。
- 对既有实体做只读历史适配时使用稳定来源事件 ID 去重；多次加载不能生成新时间、重复事件或跨 Trace 复制审计。
- Timeline 按有证据的 occurredAt 升序、相同时间按稳定 ID 排序，未知时间关联独立展示；页面时间使用 Asia/Shanghai，并展示完整日期到秒及 GMT+8 说明。
- 阶段总览单独标“尚未进入 / 不适用”，不把未来阶段作为假历史事件。多路分发按 branch 展示各自状态，节点强调使用外圈和“当前停留”，颜色仍取实际状态。
- 从数据集样本进入实验只代表验证覆盖，不自动代表该 Trace 是变体问题来源或问题已随发布解决。仅明确 Issue / Finding / Variant 来源关系可进入来源分支。
- 样本行只放治理阶段、最近流转、数据集摘要及入口；完整时间线仍唯一属于 Case 详情治理 Tab。

拒绝用所有 Case 关联对象按数组顺序伪装 Trace 时间线，也拒绝强制每条 Trace 都走完整线性十步。

### 5. 数字身份升级使用 typed alias 和受控活动引用迁移

正式数字 ID 是不含业务判断的稳定 18–24 位字符串。Mock 分配器使用固定种类命名空间和稳定顺序 / 映射，不用浮点 Number、访问时间或随机刷新重新生成。已有真实数字 ID 和用户自建记录保留，不因 seed 变化重编号。

新增 alias 结构按 `{ kind: session|trace, alias, canonicalId }` 管理，处理同名冲突为明确错误而非错误合并：

1. 分配 Session / Trace canonical ID，并登记旧 ID。
2. 按字段类型重写活动 Session、Case、Trace、Turn、Observation、Evidence、Eval、Finding、Routing、Run 等 FK 和新事件；不使用任意字符串深替换。
3. 对冻结 `configSnapshot / evaluationSnapshot / evalSnapshot / reportSnapshot` 全部保持原内容。访问其旧 ID 时用 alias resolver 查活动对象，报告自身仍显示“快照原 ID”。
4. Route / path / filter / search / Session turn / Trace set 和嵌套 returnTo 使用同一解析规则；新链接输出 canonical ID。搜索支持 alias 命中，不创建重复对象。
5. Seed 补新样例前先识别已有 canonical 对象与 alias，避免旧 ID 被当作缺失对象重复加入；校验必须理解快照旧 alias 的合法引用。

ID 显示、搜索和排序不经 Number 转换；需要数字顺序时用长度及逐字符比较，需保留前导零的原始身份，不能借排序归一化合并对象。

alias 冲突或迁移校验失败必须保留原本地数据、停止本次写回并提供可读诊断 / 导出入口，不能走“恢复 Seed”路径清除人工记录。迁移成功后才原子写回新状态。

公共 ID 组件提供类型标签、可读完整值、可视觉截断的列表展示、复制和结果反馈。Observation / Log 不强制数字化，但同组件必须支持长字符串。没有 Copy 权限时提供可选择文本和失败提示。

### 6. 圆点语义集中，四个状态维度独立

创建共享 `StatusIndicator`，消费显式 domain code + context（execution / verdict / review / governance），输出 green / yellow / red / gray 和中文文字。使用现有样式 token，不替换平台所有非健康标签。

- green：该维度成功或完成；yellow：待处理 / 进行中 / 待复核；red：失败 / 拒绝 / 回滚；gray：无记录 / 不适用 / 尚未进入。
- 派生失败为 yellow / 浅橙并带“派生”，保留来源关联，不伪装直接首错。
- 未人工复核是 yellow 的复核状态；自动 PASS 仍为 green 的结论，不因未复核变成黄色失败。
- 评测运行成功完成但结论失败：两个独立状态，不能只显示绿色完成。
- 不用未经确认的分数门槛映射红黄绿；0–2 数字一直显示。当前节点额外外圈强调，不把失败改成 yellow。

## Risks / Trade-offs

- [Risk] 历史改名使旧测试、链接、快照失效 → 迁移 / alias 优先建立并有完整 FK 校验；旧链接 smoke coverage 和冻结报告内容深比较。
- [Risk] activeTrace 与 Case 共享内容混淆 → 完整投影和明确共享标签；双 Trace 在不同状态、版本、产物、复核和分流场景验收。
- [Risk] 缺少真实成员时间 → 历史显示未记录，新 Mock 单独构造时间自洽的完整链，不篡改既有冻结报告时间。
- [Risk] 事件与实体状态分叉 → 动作原子写入，事件有来源 ID，选择器只投影；拒绝失败操作的成功事件。
- [Risk] 复核重跑、重复保存及本地容量 → revision ID / source revision 绑定，保存防重入，保留旧记录，继续压缩重复快照并验证 5MB 限制。
- [Risk] 长 ID / 行内操作增加宽度 → 表格保留关键列、非关键详情进 Drawer；1280 / 1440 验证控件、按钮、标题、数字和时间线，不只检查 body overflow。
- [Risk] 错误变更真实接口语义 → alias / projections 在数据访问层封装，本轮全为 Mock；上线接口仍使用服务返回的真实 ID 与时间，不声称本演示分配器是生产规则。

## Migration Plan

1. 实施前记录当前版本、测试基线和存储 schema；不 reset 用户数据、不自动提交或推送。
2. 先加 ID alias / review revision / membership / event 类型和向后兼容读取，冻结快照保持原样。
3. 用小型确定性 fixture 红测：数字精度、二次迁移、人工数据不丢、双 Trace 不串、成员时间未知、并行分流及冻结快照。
4. 建立 live FK 迁移和 seed 去重，补齐新的时间自洽 Mock；旧无法证明的时间或关系保持缺失说明。
5. 接入 Trace 投影、去重 UI、状态圆点、人工复核与数据集摘要，保持导航、互斥筛选、旧 alias 和 returnTo。
6. 所有新动作追加 review / governance 记录并确认实际保存；刷新、卸载 / 重挂、重跑和失败保存分别验收。
7. 全量单元 / 集成 / Playwright、构建、类型检查与 OpenSpec 校验；按 tasks.md 输出逐条实际结果和剩余缺口。
8. 回退代码前先保留新版本地状态导出，旧版本不直接读取不认识的新 schema；不得为回退清空用户标注。本轮不自动归档 change。
