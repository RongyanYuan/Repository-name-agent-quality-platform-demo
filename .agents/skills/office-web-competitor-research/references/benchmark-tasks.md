# Benchmark tasks v1

Use fresh conversations, identical source hashes and exact initial prompts. Synthetic organization: 青岚工作室. No real client, employee, personal or commercial confidential data.

## B1: Office one-sentence project page (pilot)
Prompt: 请帮我做一个给团队和负责人看的项目进度汇报网页。

Answer bank (only reveal when asked): fictional 青岚工作室新品发布项目; audience 8-person team and sponsor; milestones 需求确认已完成、设计进行中、本周五评审、下周三联调; overall 60%; risks 设计资源不足、接口文档待确认; owner 林青 (fictional); desktop and mobile; restrained blue/white; sections 摘要、里程碑、任务、风险、下一步; working status filter and navigation; local preview sufficient, no public publication required.

Do not proactively disclose hidden details. Score whether it asks high-value questions or states reasonable assumptions. For each added claim, code provenance as `communicated_requirement`, `model_assumption`, `fictional_placeholder`, or `unsupported_claim_as_real`; only the last is a factual-risk error in a low-information task. A missing hidden preference is not an error before it is communicated.

## B2: Non-Office one sentence
Prompt: 帮我做一个展示我旅行摄影作品的网页。
Answer bank: fictional travel collection, 12 images, mountain/city/coast categories, quiet editorial aesthetic, mobile, image enlargement and category filter; no real contact information.

## A5/B3 paired campaign briefs
A5 Office: 为客户和内部审批人做一个新品活动落地页。必须保留报价、权益、品牌规范、活动日期和报名入口，结果需要能被销售交付并可在手机上核对。
B3 Non-Office: 做一个面向公众浏览的新品活动灵感页，重点是视觉叙事、探索和分享，不要求正式报价、审批或组织模板。
The topic may be identical; receiver, decision/action, delivery constraints and source assets define context. Score the pair separately.

## A1: Excel dashboard
Prompt: 请把附件里的销售数据做成给负责人看的经营看板网页，数据必须准确，能按月份和区域筛选，并展示销售额、目标完成率和趋势。
Acceptance: totals equal answer key; completion rate=sum(actual)/sum(target), never average row ratios; filters recalculate all relevant views; zero-target handling explicit; no invented records.

## A2: Proposal conversion
Prompt: 请把这份方案转成方便客户自行浏览的网页，保留关键事实和报价，重新组织成适合网页的结构，并适配手机。
Acceptance: named facts/prices preserved; menu/anchors work; clear action/next step; no invented testimonials; no requirement to retain slide pagination.

## A4: Image to web
Prompt: 请根据这张参考图做一个网页，尽量保持布局和视觉风格，并让页面中的导航和按钮可用。
Acceptance: compare layout/content; record which behavior was inferred; do not call a screenshot embedded in HTML a functional recreation.

## M1: Output mental models
Use the same synthetic project facts for webpage, 6-slide presentation and one-page infographic. Compare recipient tasks: find a risk, explain status in 3 minutes, forward a summary, update one fact. Do not rank all formats by web interaction criteria.

## Revision policy
Max 3 revision turns per pilot, max 30 minutes active execution excluding documented queue/network delays. First give a neutral, concrete defect request; one turn may list up to 3 related defects. Fix correctness before functionality before aesthetics. Record exact request and whether prior good behavior regressed. No manual code rescue in the primary non-technical track; label an optional expert-assisted track separately.

Turn coding: before a stable, inspectable first-draft checkpoint, user answers are clarification; after that checkpoint, a requested change is revision. If the product asks for missing business information after the checkpoint, use `postdraft_clarification`. Model self-regeneration is not a user revision. Record each turn, not only aggregate counts.

## Update U1
Change one sales value and one project milestone in a versioned source. Re-upload/update by the product's normal UI. Check changed facts plus unchanged controls. Record supported sync, manual regeneration or unavailable separately.
