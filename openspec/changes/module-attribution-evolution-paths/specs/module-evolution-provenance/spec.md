## Purpose

将当前Trace具体评分模块及细项与其归因问题、独立进化轮次明确关联，避免同Case、Skill或数据集的其它路径状态被错误归入当前评分，同时保留不同自动版本及历史轮次的来源依据。

## ADDED Requirements

### Requirement: Score governance SHALL follow explicit provenance
评分详情 SHALL 按Trace、评测包、自动版本、模块评分及可选细项定位Finding/归因/进化轮次，支持一模块多归因、同归因多处理路径；缺失或歧义 SHALL 显示未关联，不借用同Case/Skill其它路径。

#### Scenario: A module has two different attributions
- **WHEN** 同一skill模块存在SOP错误及品味召回错误
- **THEN** 两条归因独立绑定、显示不同数据集/处理/准出/发布状态

### Requirement: Evolution cycles and historical snapshots SHALL remain independent
每轮进化 SHALL 保留目标对象、固定源版本、归因及明确来源实体，重跑或新轮次 SHALL 不覆盖旧绑定、评分、复核及冻结报告。仅验证覆盖 SHALL 不视为来源进化。

#### Scenario: A newer cycle follows a published fix
- **WHEN** 同Skill源版本归因有历史已发布和新待处理轮次
- **THEN** 历史通过可回看，新轮次不会继承通过或已上线

### Requirement: Complete module history SHALL retain explicit prior package sources
模块历史 SHALL 包含同一 Trace、同一模块的旧评测包中可核验的明确绑定，保留来源评测包和自动版本，只读标记历史。细项历史 SHALL 按明确细项 ID 范围取值，不通过名称或同 Case 猜测关联；旧报告 SHALL 不参与当前状态。

#### Scenario: The latest evaluation package replaces an earlier package
- **WHEN** 同 Trace 模块有旧评测包路径，当前包尚无对应进化
- **THEN** 当前明确未关联，旧路径在该模块方向的历史中可查，不冒充当前进度
