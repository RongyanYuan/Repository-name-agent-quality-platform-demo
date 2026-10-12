# AI 产品 Web 生成能力介绍调研

**版本**：v1.0  
**调研日期**：2026-09-30  
**研究目的**：为百度 Office 场景的网页产品确定竞品边界、能力分类和后续实测优先级。

## 结论先行

当前市场的“Web 生成”并不是一种统一产品形态，而是四类产品的交集：

1. **网页/应用生成器**：直接把自然语言变成可运行的网站或应用，重点是页面、代码、数据库和部署。
2. **通用 Agent/Artifact 产品**：把网页、HTML、交互组件作为多种任务产物之一，重点是快速完成复杂任务或在对话旁生成可编辑结果。
3. **Office/办公 Agent**：从文档、表格、PPT、知识和本地文件出发，把网页作为办公交付、工作台或应用化结果的一部分。
4. **企业 Agent/低代码平台**：面向企业开发者或 IT 团队，提供 Agent、工作流、知识库、数据连接和 Web 发布能力。

对于百度的 Office 网页方向，最值得对标的不是某一个“最会写网页”的产品，而是三条能力链：

- **首稿链**：一句话/附件 → 结构理解 → 页面生成 → 首次可用。
- **交付链**：内容、数据、模板、权限 → 可审阅、可发布、可复用的网页。
- **运营链**：源文件更新 → 网页刷新 → 版本、协作、权限和长期维护。

现有官方介绍中，Lovable、Bolt、v0、Replit 已经把“自然语言 → 网站/应用 → 预览/发布/部署”讲成完整产品生命周期；Manus 和 Claude Artifacts 把网页作为通用 Agent 的一种可编辑产物；Kimi、豆包、WorkBuddy、智谱和 WPS 则更接近“工作入口/办公入口”。但“官方宣称能生成网页”不等于“能稳定完成 Office 级交付”，尤其是附件解析、数据准确、跨 Word/Excel/PPT 一致性、更新和审计，目前仍需统一任务实测。

本文件是**官方产品介绍与能力定位调研**，不是同任务横向性能排行榜。当前结论中，产品官方定位属于 `OFFICIAL_CLAIM`；官方产品 UI 中直接看到的入口属于 `OFFICIAL_OBSERVED`；我们在网页入口实际操作看到的行为属于 `OBSERVED`；登录/权限阻塞属于 `BLOCKED`；未找到一手页面证据的能力保持 `UNVERIFIED`，不等于产品不支持。

截至 2026-09-30，中文产品中网页证据最完整的三组是：**Kimi Build**（网页生成核心产品、多模态输入、自然语言/视觉编辑、一键发布）、**WorkBuddy**（网页应用、后端、灵感做同款、预览、发布和更新）和 **WPS Comate**（网页应用、精选模板、对话迭代、发布/运营数据、已有文档转网页案例）。豆包工作已在官方帮助页明确网页/应用生成和 AI 编辑，但公开资料对模板、公开部署和附件格式仍不完整。

```text
Web 生成产品地图
├── 生成目标
│   ├── 网站/应用：Lovable、Bolt、v0、Replit、Manus
│   ├── Artifact/HTML：Claude Artifacts、智谱清言
│   ├── 办公交付：豆包、WorkBuddy、Kimi、WPS、百度相关产品
│   └── 企业平台：千帆、Dify、Coze、Power Apps
├── 输入方式
│   ├── 一句话/自然语言
│   ├── 文件、图片、数据和知识库
│   ├── 模板/灵感/示例
│   └── 代码、API、工作流和数据库
├── 交付阶段
│   ├── 文本或代码
│   ├── 可预览交互结果
│   ├── 可编辑项目
│   ├── 可分享/可部署网页
│   └── 可持续更新和治理
└── 百度研究重点
    ├── Office 附件语义和事实保真
    ├── 网页、PPT、Word、Excel 的统一事实源
    ├── 模板/灵感与结构化追问的组合
    └── 企业权限、引用、版本和持续运营
```

## 研究口径

### 产品介绍和实际能力分开

- **官方介绍**：产品官网、官方文档、官方博客、官方帮助中心公开说明。
- **入口观察**：在 2026-09-30 的公开网页或桌面入口实际看到的菜单、模式、输入框和登录限制。
- **能力实测**：使用同一提示词或附件完成任务，并检查产物、交互、发布和更新。

本轮主要完成前两项。能力实测已开始，但还没有足够的同任务样本用于排名。

### “网页生成”统一拆成五个阶段

| 阶段 | 含义 | 常见产品信号 |
|---|---|---|
| 生成 | 从自然语言或材料产出 HTML、组件、页面或应用 | Prompt、Chat、代码面板 |
| 预览 | 可以看到真实页面或交互结果 | Live preview、Artifact、Preview |
| 编辑 | 可以通过对话、视觉控件、源码或结构化面板修改 | Design mode、代码编辑、对话迭代 |
| 发布 | 生成可访问链接、部署到平台或嵌入业务系统 | Publish、Deploy、Share、Domain |
| 运营 | 数据刷新、权限、协作、版本、监控、回滚 | Database、RBAC、analytics、sync |

一个产品可能只完成前两阶段。报告中不把“生成 HTML 代码”直接等同于“完成可交付网页”。

## 一、明确以 Web/应用生成为核心的产品

| 产品 | 官方定位与网页生成介绍 | 输入与交互 | 模板/灵感 | 编辑、发布、维护 | Office 关系 | 证据 |
|---|---|---|---|---|---|---|
| [Lovable](https://docs.lovable.dev/introduction/welcome) | 官方文档称其为全栈 AI 开发平台，使用自然语言构建、迭代和部署 Web 应用，生成前端、后端、数据库、认证和集成，并保留可编辑代码。 | 支持自然语言、项目上下文、URL/网页参考，以及图片、PDF、Word、Excel、PowerPoint 等附件；可从 Figma 或参考页面开始。 | 有 [Templates](https://lovable.dev/templates) 和企业 Design templates，后者可复用完整代码库、设计、组件和结构。 | 支持项目 Chat 的 Build/Chat/Plan、元素选择、截图标注、inline 编辑、版本历史；可发布 lovable.app URL、自定义域名、Git 同步、监控和 API。 | 非 Office 原生；官方支持读取 Office 附件并生成文件，但未承诺格式保真或跨产物同步。 | 官方文档，强；实际附件解析、首稿质量和维护体验仍待实测。 |
| [Bolt.new](https://bolt.new/) | 官方页面定位为 AI builder，覆盖 websites、apps、prototypes，并强调使用聊天生成应用和网站；页面同时提供 AI Website Builder、AI App Builder、SaaS、Prototyping 等入口。 | 自然语言聊天；页面展示 Plan / Build now、Website、Slides、App、Prototype 等起始方式。 | 官方页面有 Bolt Templates，示例包括 dashboards、storefronts、portfolios。 | 官方页面强调 production-ready starting points，但具体部署、数据库和维护边界需按任务测试。 | 非 Office 原生；适合对比空白 Prompt、模板到网页的转化效率。 | 官方产品页，强；部分功能需登录/套餐核验。 |
| [v0 by Vercel](https://v0.dev/) | 官方页面的核心表达是 Prompt → Build → Publish；可以生成工作应用，在数秒内发布 live website。 | 自然语言、组件、API、数据库；官方说明 Agent 默认会规划、创建任务并连接数据库。 | 有 Templates，按 Apps、Games、Landing Pages、Components、Dashboards 等分类；可建立 design systems。 | 支持 GitHub 同步、Vercel 一键部署、视觉 Design mode、实时预览和代码协作。 | 非 Office 原生；适合对比网页首稿、设计控制、模板和部署闭环。 | 官方首页，强；附件转 Office 网页仍待实测。 |
| [Replit Agent](https://replit.com/products/agent) | 官方定位是通过聊天构建应用的 AI Coding Agent；用户用自然语言描述想法，继续对话完善，再从同一工作区启动生产级应用。官方页面列出 apps、sites、tools、businesses 等结果。 | 自然语言、对话迭代、数据库、集成和代码上下文。 | Replit 有 Templates 和 Gallery，但 Agent 页面不是以模板为主要入口；需实测模板对首稿的影响。 | 官方 FAQ 明确围绕 launch、deployment、production-ready app 展开。 | 非 Office 原生；对技术兜底、代码可维护性和发布有参考价值。 | 官方产品页，强；非技术用户独立交付仍待实测。 |
| [Manus](https://manus.im/) | 官方 Website Builder 文档把流程定义为自然语言任务 → development plan → 用户反馈/调整 → full-stack 网站 → live preview → deploy；覆盖 backend、database、auth、analytics。 | 支持 Prompt、Figma frame links 等参考输入；先给结构、功能和技术计划，用户可在构建前调整。 | 官方文档有示例用例和 Make a Copy，但本轮未确认独立模板/灵感库。 | 支持自然语言修改、Quick Style Controls、元素选择、批量编辑、桌面/移动预览、一键发布、自动 SSL、自定义域名和 redeploy；Pro 可编辑已部署网站。 | 非 Office 原生；适合对比“先计划、再生成、再发布维护”的 Agent 体验。 | [Website Builder](https://manus.im/docs/website-builder/getting-started)、[Editing](https://manus.im/docs/website-builder/editing-and-previewing)、[Publishing](https://manus.im/docs/website-builder/publishing)，官方强；真实质量仍待实测。 |
| [Gamma](https://gamma.app/products/websites) | 官方主页定位覆盖 presentations、websites、documents、social 和 graphics；Websites 页面把“idea/prompt 或已有 deck/document → website”作为流程。 | 支持 Prompt、粘贴 outline、导入 deck/document；AI 负责写文案、组织 sections 和 responsive layout。 | 官方有 100+ themes、smart templates、blocks、Inspiration、Templates 和 Explore；[Templates](https://gamma.app/templates) 支持搜索、分类和 adapt/remix，主题与品牌可复用。 | 支持编辑 section、嵌入 forms/videos、移动预览、gamma.site 子域或自定义域名发布；同时可导出 PPT/PDF/PNG/Google Slides。 | 与 Office 的关系是“已有文档/演示转网页”，但格式保真和数据更新仍待实测。 | 官方产品页，强；附件解析、追问和迭代成本未验证。 |

### 这一类产品的共同模式

1. **用户目标是“做出可运行的东西”**，不是“把已有 Office 文件交付得更好”。
2. **网页是第一等产物**，所以产品从首稿开始就围绕预览、代码、部署、域名和运行时设计。
3. **模板主要解决空白页问题**，通常以网站类型、页面类型、行业案例或组件为组织方式。
4. **追问不是所有产品的默认入口**。很多产品倾向于先生成，再通过对话或设计工具修正。
5. **强项在网页工程闭环**；弱项通常是 Office 语义、事实追溯、中文业务口径和组织审批。

## 二、把 Web 作为通用 Agent 产物的产品

| 产品 | 官方介绍 | Web 相关能力 | 交互特征 | Office 关系 | 证据 |
|---|---|---|---|---|---|
| [Claude Artifacts](https://www.anthropic.com/news/claude-3-5-sonnet) | Anthropic 在 Claude 3.5 Sonnet 发布文中介绍 Artifacts：用户要求生成代码片段、文本文件或网站设计时，结果会出现在对话旁的专用窗口，用户可以实时查看、编辑和继续构建。 | 重点是对话旁的可编辑 Artifact/网站设计，而不是完整建站平台。 | 生成后立即可见，适合边看边改；官方新闻页没有把数据库、域名、企业发布作为核心承诺。 | 可处理办公内容，但不是 Office 专业交付产品。 | 官方发布文，强；当前版本的具体网页发布能力需实测。 |
| [Dify](https://dify.ai/) | 官方定位是 Production-Ready Agentic Workflows 平台；支持通过 Skills、Tools、Knowledge 构建 Agent，并可把 AI 应用发布为 Web app 或 API。 | Web 主要是 Agent 应用的发布容器，重点在工作流、知识、工具和企业部署。 | 可聊天配置或可视化配置；逻辑、调试和部署可见。 | 不直接面向普通 Office 用户，但适合做企业 Office Agent 底座。 | 官方首页，强；不是终端网页生成器。 |
| [Coze/扣子](https://www.coze.cn/) | 官方首页定位为 AI 办公助手一站式平台；官方文档提供 Web SDK 等开放能力。 | 更偏 Agent、技能、工作流和嵌入/开放，不应直接等同于自然语言生成网页。 | 通过 Agent、技能和开放接口组合任务；模板/技能市场是重要入口。 | 对中文办公、技能和企业自动化有参考价值；网页视觉交付需单独测试。 | 官方首页与文档，强/中；网页生成能力需拆成具体模式核验。 |

### 这一类产品的关键启发

- Artifact 模式把“页面”放在对话旁边，降低查看和修改成本。
- 企业 Agent 平台把“网页”当作部署面，把真正的核心放在知识、工具、流程、权限和观测。
- 百度如果要做 Office 网页产品，需要明确是终端交付产品，还是千帆/Agent 平台上的能力组件，不能把两者混成一个竞品。

## 三、Office 邻近的企业网页与应用平台

这些产品不一定争夺“AI 生成网页”的同一个入口，但它们代表企业用户已经熟悉的发布、权限、数据和工作流标准。

| 产品 | 官方 Web/App 生成介绍 | 模板、编辑和发布 | 与 Office 研究的关系 |
|---|---|---|---|
| [Microsoft Power Pages Copilot](https://learn.microsoft.com/en-us/power-pages/getting-started/create-site-copilot) | 官方文档说明可用自然语言描述站点类型、目标用户和信息，Copilot 生成站点名称、地址、首页布局和后续页面；还可用 Create page Copilot、Theme Copilot 生成页面和主题。 | Design Studio 支持 Copilot/WYSIWYG 编辑、页面/section/form 创建；可预览桌面/移动端、生成二维码或邮件链接并发布。 | 代表企业网页的权限、表单、数据和发布标准；官方文档称首个站点、语言和表单自动生成有边界，需实测。 |
| [Power Apps Copilot](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/ai-overview) | 可用自然语言生成业务 App 和数据模型。 | 更偏业务应用、数据和流程，不是营销网页生成器。 | 用来比较“把资料变成能用的应用”与“把资料变好看”的区别。 |
| [Microsoft 365 Copilot](https://learn.microsoft.com/en-us/microsoft-365-copilot/microsoft-365-copilot-overview) | 官方 Word/Excel/PowerPoint Agents 支持从 Prompt、上传文件、Web 或企业 Graph 生成和完善 Office 产物；PPT Agent 可结合 Word 文件和企业模板生成可编辑演示。 | 后续指令可 refine，结果存 OneDrive，细粒度编辑回到原生 Office 应用；官方未证实普通网站生成。 | 是 Office 原生交付的基准，用来比较“Office 产物先于网页”的路径。 |
| [Google Sites](https://workspace.google.com/products/sites/) / [AppSheet](https://about.appsheet.com/home/) | Google Sites 提供模板、协作编辑和发布；AppSheet 官方主张用自然语言描述想做的 App，让 Gemini 协助生成。 | Sites 有模板 Gallery、复制站点、分享和发布；AppSheet强调表单、数据库、工作流和 Workspace 集成。 | Gemini/Google Workspace 目前未见官方证据证明可直接用自然语言生成普通可发布网站；AppSheet 是企业应用对照。 |
| [Canva Websites](https://www.canva.com/website-builder/) | 官方有 Website Builder、Magic Design 和设计工具入口，但本轮访问被 Cloudflare 阻断。 | 模板与视觉设计能力应纳入后续人工浏览器测试；当前不把“一句话网页、附件转网页、追问和发布维护”写成已验证事实。 | 代表视觉/模板优先的产品心智，适合与 Office 交付型网页对照。 |

## 四、国内综合办公 Agent 与 Office 产品

| 产品 | 官方入口/介绍证据 | 已看到的 Web/办公信号 | 需要重点核验 |
|---|---|---|---|
| [豆包](https://www.doubao.com/) | 官方工作帮助页明确写：自然语言 + 参考资料 + 具体要求后，Agent 可自主拆解、调用工具，完成调研、内容创作、数据处理和应用搭建，并生成可继续修改、分享和协作的结果；能力说明包括“在线应用与系统生成”和对文档、PPT、网页或应用的定向编辑。 | 支持自然语言目标、本地文件、网页内容和企业资料；执行中可补充信息、调整要求，初稿后继续提出修改意见。 | 官方工作页更强调专业 Skill、技能示例和持续交付；网页模板/视觉灵感库未被当前官方帮助页明确说明。 | 官方宣称可生成轻量在线应用、数据看板、运营台账和业务系统；可分享、协作和继续编辑。是否有公开网站部署、版本管理和网页域名仍待核验。 | Office 关系强：官方入口直接覆盖 PPT、文档、表格，并将网页/应用作为交付形态之一。 | 官方帮助页，强；具体网页生成体验、发布方式和附件转网页格式仍待实测。 |
| [WorkBuddy](https://workbuddy.tencent.com/) | 官方 Work 文档定位为 AI Agent 办公工作台；网页应用文档明确支持“根据需求生成带后端的网页应用，并直接发布上线”。 | 入口包括“代码开发→网站开发/Agent 应用”，也可直接描述使用者、操作、数据保存和发布要求；支持本地 HTML/CSV 维护看板、台账和工作台。 | 官方有“灵感”页：浏览精选成品、按场景搜索、查看 Prompt/Skill/专家、一键做同款、收藏和继续发送到对话/任务。设计创意文档还说明有 Web App、Landing Page 等风格模板。 | 生成后有网页应用卡片和右侧预览，可自然语言修改；支持数据库、登录认证、文件存储、权限和统计；可获得独立网站链接，修改后需再次更新发布。轻量发布支持 HTML+CSV 数据与页面双向同步。 | Office/企业工作流关联强，但官方网页应用文档未明确 PPT/Word/Excel 附件转网页。 | 官方文档，强；实际生成质量、附件解析和多轮追问仍待实测。 |
| [Kimi](https://www.kimi.com/) | 官方入口可见 New chat、Plugins、Scheduled、Inspiration、Slides、Deep Research、Docs、Build、Sheets、Design；[Kimi Build](https://www.kimi.ai/en/build) 官方定位是 AI Website Builder。 | Kimi Build 官方页面称支持文本、图片、视频、截图输入，可生成多页、响应式、带轻量后端逻辑/数据库/认证和交互的网站，也支持从截图/录屏复刻布局与风格。 | 官方页面一处写可从 preset template 开始，另一处写 “No templates, no setup required”，存在口径矛盾；同时列 Portfolio、Photography、Blog、Marketing & landing page、Business 用例。 | 支持自然语言和视觉编辑、预览桌面/平板/移动端、一键部署和分享；自定义域名、版本回滚和 Office 附件转换仍待核验。 | Build 更偏非 Office 创作/营销/作品集；Kimi 同时有 Slides、Docs、Sheets，需要分别测试。 | Kimi Build 官方页，强；模板口径、追问、附件转网页和办公交付待实测。 |
| [DeepSeek](https://www.deepseek.com/) | 官方站点主要是模型与助手入口；当前公开网页产品没有在首页形成明确的网页生成产品叙事。 | 不能因为 DeepSeek 模型可生成代码，就推断 DeepSeek 终端产品具备网页生成工作台。 | 分开测试终端 UI、API、第三方 Agent 集成；确认是否有预览、发布、附件和项目管理。 |
| [智谱清言](https://chatglm.cn/) | 官方入口提供新对话、AI 画图、AI 阅读、AI 生视频、云知识库、探索智能体等入口；页面有任务、研究报告、PPT 制作、数据分析，官方 UI 的“更多”中还可见“网页应用”。 | 2026-09-30 实际观察到：默认入口对一句话项目汇报未追问，进入 HTML 代码生成/展示阶段；点击“网页应用”专项入口则触发登录。当前记录为部分执行，不等同完整网页交付。 | 是否有正式网页预览、交互检查、发布和模板入口；Office 附件是否能保持事实和格式。 |
| [WPS 365 / WPS AI / Comate](https://365.wps.cn/home) | WPS 365 将文字、表格、演示、PDF、智能文档、智能表格、智能表单、多维表格和 WPS AI/Comate 放在同一办公套件中。Comate 官方应用文档明确支持通过 AI 对话生成网页应用，无需编码创建和发布。 | 应用生成页采用左侧 AI 对话 + 组件/代码文件 + 右侧实时预览；支持桌面/平板/手机切换、预览/代码/仪表盘/后台任务；可接组织数据和流程。 | 有“精选模板”，可搜索“汇报”“看板”等关键词、查看详情并一键使用模板；这与 WPS Office 原生资产形成直接竞争。 | 官方文档写明“对话编辑→预览调试→发布上线”，应用可进入“我的应用”；发布后提供访问量、用户数、趋势和访问记录，支持持续编辑与更新。 | 这是最直接的 Office + 网页应用竞品；但 Excel/Word/PPT 到网页的语义绑定、公式保真和跨产物同步仍需实测。 | [WPS 365](https://365.wps.cn/home)、[Comate Help](https://comate.wps.cn/help)、[应用文档](https://365.kdocs.cn/l/csybKaE3yrmL)，官方强。 |
| [百度千帆](https://cloud.baidu.com/product-s/qianfan_home) | 官方定位为“以 Agent 为核心的一站式企业级大模型服务平台”；页面列出多智能体协同、自主规划、工作流、知识库 RAG、全链路可观测，并展示网页探索、代码编写、报告撰写等预置 Agent。 | 更适合作为百度内部底座、企业平台和能力复用层，而不是普通职场用户的直接网页生成器。 | AppBuilder 是否提供稳定的网页应用生成/发布；与百度文库、网盘、Office Agent 的边界和复用。 |

### 国内产品的共同模式

- **入口竞争比单点功能更重要**：豆包、WorkBuddy、Kimi、智谱都在争夺“把任务交给 AI”的入口。
- **模板/灵感正在变成自然语言的补充输入**：Kimi 已在公开入口显示 Inspiration；WPS、网页生成器和设计产品普遍使用模板/案例降低空白页压力。
- **办公产品更可能从附件和已有工作资产出发**，网页产品则更常从一句话或模板出发。
- **中国市场的关键差异不一定是模型质量**，而是本地文件、组织知识、企业权限、中文模板、生态连接和发布方式。

## 五、能力矩阵：官方介绍层

“✓”表示官方页面明确介绍或公开入口明确存在；“△”表示相关但需要实测/登录核验；“?”表示本轮没有足够一手证据。

| 产品 | 一句话网页 | 附件/材料输入 | 模板/灵感 | 实时预览/可编辑 | 发布/部署 | 数据/知识/权限 | Office 原生 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Lovable | ✓ | △ | △ | ✓ | ✓ | ✓ | ? |
| Bolt | ✓ | △ | ✓ | ✓ | △ | △ | ? |
| v0 | ✓ | △ | ✓ | ✓ | ✓ | ✓ | ? |
| Replit Agent | ✓ | △ | △ | ✓ | ✓ | ✓ | ? |
| Manus | ✓ | △ | △ | △ | △ | △ | ? |
| Gamma | ✓ | ✓ | ✓ | ✓ | ✓ | △ | △ |
| Claude Artifacts | ✓ | △ | ? | ✓ | △ | △ | ? |
| 豆包工作 | ✓ | △ | △ | △ | ? | △ | ✓ |
| WorkBuddy | ✓ | △ | ✓ | ✓ | ✓ | ✓ | △ |
| Kimi Build | ✓ | △ | △/矛盾 | ✓ | ✓ | △ | △ |
| DeepSeek | ? | ? | ? | ? | ? | △ | ? |
| 智谱清言 | △ | △ | △ | △ | ? | △ | △ |
| WPS AI/Comate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 千帆/AppBuilder | △ | △ | △ | △ | ✓ | ✓ | ? |
| Coze | △ | △ | ✓ | △ | ✓ | ✓ | ? |
| Dify | △ | ✓ | ? | △ | ✓ | ✓ | ? |

注意：这里的“✓”只是产品介绍层面的能力信号，不代表在同一任务中一定成功。特别是附件输入、持续更新、Office 原生和生产级网页交付，必须进入下一轮统一 Benchmark。

## 六、模板与灵感库：产品介绍中最重要的共同趋势

### 模板和灵感分别解决什么问题

| 入口 | 解决的用户问题 | 对 Agent 的作用 |
|---|---|---|
| 模板 | “我知道要做什么，但不想从空白开始” | 提供结构、组件、版式和默认交互 |
| 灵感库 | “我不知道怎么描述我想要的风格/页面” | 帮用户表达审美、密度、氛围和叙事方向 |
| 示例项目 | “我想先看一个完整结果” | 让用户通过结果反推需求 |
| 结构化 Brief | “我知道目标，但不知道网页需要什么信息” | 把受众、内容、交互、数据和发布约束显式化 |
| 自有模板 | “团队已经有固定交付规范” | 沉淀组织记忆、品牌和质量标准 |

### 当前观察到的产品差异

- v0、Bolt 等网页产品把模板作为网站类型、组件和完整页面的起点。
- Kimi 公开入口直接把 Inspiration 放在主导航附近，说明灵感浏览可能是产品入口而非辅助功能。
- Claude Artifacts 更偏“先对话生成，再在旁边编辑”，模板并不是官方叙事核心。
- Office Agent 的模板价值应该从“好看”升级为“可交付”：包括标题结构、指标口径、品牌规范、审批节点、导出规则和更新逻辑。
- WorkBuddy 官方文档把两种网页价值分开：静态 HTML 是“把资料变好看”（汇报、复盘、攻略、作品集）；HTML+CSV 轻应用是“把资料变能用”（工作台、客户跟进、任务看板、记账），并支持数据与页面双向同步。这是 Office 网页产品区分“展示层”和“使用层”的重要参照。

### 对百度产品的建议

模板/灵感库不要只做视觉瀑布流，至少要带以下元数据：

- 适用接收人：老板、客户、团队、公众
- 适用任务：汇报、提案、看板、培训、活动、知识门户
- 输入要求：Word、Excel、PPT、图片、数据库或一句话
- 输出形态：网页、PPT、Word、Excel 或多端组合
- 交互能力：筛选、下钻、搜索、表单、评论、审批
- 交付约束：移动端、打印、公开链接、内部权限、私有化
- 可替换变量：标题、数据、品牌、图片、指标、时间范围
- 质量承诺：事实来源、公式、引用、版式和可访问性

## 七、产品介绍透露出的用户心智假设

### Web 生成器的用户心智

> “我想快速得到一个可运行、可分享、可继续修改的网页或应用。”

产品介绍通常强调：自然语言、实时预览、模板、代码/设计模式、发布、域名、数据库和部署。

### Office Agent 的用户心智

> “我想把已有资料和数据变成可以正式交付的结果。”

产品介绍应重点回答：附件理解、事实和公式、结构、模板、审批、版本、导出、引用、权限和更新。当前很多办公产品的官网仍然主要讲文档/PPT/表格生成，网页是否是正式交付形态，需要通过产品实测才能确认。

### 通用 Agent 的用户心智

> “我不想学习工具，我只想把一项复杂任务交给 AI。”

这类产品的风险是：首稿可能看起来完整，但默认补充了用户没有提供的事实、受众和风格。因此后续测试要专门测“追问是否问到会改变验收结果的信息”。

## 八、对百度 Office 网页方向的启示

1. **不要从通用建站器切入。** 通用网页产品已经把自然语言、模板、预览和部署讲成成熟叙事，百度很难只靠“也能生成网页”形成差异。
2. **更有价值的定位是 Office 交付物的交互化和持续运营。** 例如 Excel 经营数据 → 看板 → PPT/Word 汇报 → 下月自动更新。
3. **产品入口应支持两条路径。**
   - 附件优先：适合 Office 任务，先理解内容和数据，再追问关键缺口。
   - 灵感/模板优先：适合非 Office 或视觉探索任务，先表达结构和风格，再适配附件。
4. **追问应围绕验收标准，而不是泛泛问偏好。** 第一优先级应问接收人、任务、事实来源、数据、权限、移动端/打印和发布方式；风格问题排在影响交付的约束之后。
5. **网页、PPT、Word、Excel 需要共享事实源。** Web 的优势是交互和更新，PPT 的优势是讲解和节奏，Word 的优势是正式归档，Excel 的优势是计算和维护；产品不应强迫用户只选一种产物。
6. **百度真正可建立的壁垒是治理型生产能力。** 包括中文业务语境、组织知识、来源引用、数据口径、Office 格式、模板、权限、版本和私有化。

## 九、下一步实测优先级

### 第一批：国内入口和直接替代

1. 豆包工作模式
2. WorkBuddy
3. Kimi：默认聊天、Build/Design、Inspiration 分开
4. 智谱清言：默认对话、任务、PPT/数据分析入口分开
5. WPS AI/Comate
6. 百度相关 Office/Agent 产品

### 第二批：网页能力基准

1. v0
2. Bolt
3. Lovable
4. Replit Agent
5. Manus
6. Claude Artifacts

### 统一测试任务

- B1：一句话生成 Office 项目进度汇报网页
- A1：Excel → 经营看板
- A2：PPT/Word → 客户方案微站
- A5：带客户/审批/报价/品牌约束的 Office 活动页
- B3：同主题、面向公众浏览的非 Office 活动灵感页
- T1/T2：空白、模板、灵感三种起点对比
- U1：修改源文件后检查网页和 Office 产物是否同步

## 证据与来源

### 官方一手来源

- [Lovable Documentation](https://docs.lovable.dev/introduction/welcome)；[Docs index](https://docs.lovable.dev/llms.txt)；[Quick start](https://docs.lovable.dev/introduction/getting-started.md)；[Attachments](https://docs.lovable.dev/features/projects/chat.md)；[Generate files](https://docs.lovable.dev/features/generate-files.md)；[Publish](https://docs.lovable.dev/features/publish.md)；[Templates](https://lovable.dev/templates)
- [Bolt.new](https://bolt.new/)
- [Bolt documentation](https://support.bolt.new/get-started/intro-bolt.md)；[Plan mode](https://support.bolt.new/best-practices/plan-mode.md)；[Prompt library](https://support.bolt.new/building/prompt-library.md)
- [v0 by Vercel](https://v0.dev/)
- [v0 docs](https://v0.app/docs)；[Templates](https://v0.app/docs/templates)；[Design mode](https://v0.app/docs/design-mode)；[Deployments](https://v0.app/docs/deployments)
- [Replit Agent](https://replit.com/products/agent)
- [Replit Agent docs](https://docs.replit.com/features/agent/overview)；[Plan mode](https://docs.replit.com/features/agent/plan-mode)；[Slide decks](https://docs.replit.com/features/artifact-types/slide-decks)；[Publishing](https://docs.replit.com/features/publishing/overview)
- [Manus](https://manus.im/)
- [Gamma Websites](https://gamma.app/products/websites)；[Gamma](https://gamma.app/)
- [Anthropic: Claude 3.5 Sonnet and Artifacts](https://www.anthropic.com/news/claude-3-5-sonnet)；[Artifacts help](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)
- [Dify](https://dify.ai/)
- [扣子](https://www.coze.cn/)；[扣子 Web SDK 文档](https://www.coze.cn/open/docs/guides/web_sdk)
- [豆包](https://www.doubao.com/)；[豆包工作帮助：About Doubao Work](https://www.doubao.com/work/docs/zh-cn/articles/095732655658-about-doubao-work)
- [WorkBuddy / CodeBuddy Work](https://workbuddy.tencent.com/)；[Web App](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Web-App)；[灵感](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Ispiration)；[设计创意](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Design-Idea)；[轻量发布](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Library/Lightweight-Publish)
- [Kimi](https://www.kimi.com/)；[Kimi Build](https://www.kimi.ai/en/build)；[Kimi Websites](https://www.kimi.ai/features/websites)
- [DeepSeek](https://www.deepseek.com/)
- [智谱清言](https://chatglm.cn/)
- [WPS 365](https://365.wps.cn/home)；[WPS Comate Help](https://comate.wps.cn/help)；[应用文档](https://365.kdocs.cn/l/csybKaE3yrmL)
- [百度千帆](https://cloud.baidu.com/product-s/qianfan_home)
- [Microsoft Power Pages Copilot](https://learn.microsoft.com/en-us/power-pages/getting-started/create-site-copilot)；[Power Apps Copilot](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/ai-overview)
- [Microsoft 365 Copilot](https://learn.microsoft.com/en-us/microsoft-365-copilot/microsoft-365-copilot-overview)；[Word/Excel/PowerPoint Agents](https://learn.microsoft.com/en-us/microsoft-365-copilot/wordexcelppt-agents)
- [Google Sites](https://workspace.google.com/products/sites/)；[AppSheet](https://about.appsheet.com/home/)
- [Canva Website Builder](https://www.canva.com/website-builder/)

### 本轮实际入口观察

- 豆包：公开网页可进入“工作”模式；提交 B1 后出现账号登录弹窗。
- Kimi：公开入口可见 Inspiration、Slides、Docs、Build、Sheets、Design 等入口；提交 B1 后出现登录弹窗。
- DeepSeek：网页端进入登录页，未形成可匿名测试的网页生成入口。
- 智谱清言：匿名入口可接受 B1，进入 HTML 代码生成/展示阶段；尚未完成预览、交互、发布验收。
- WPS：官网可见在线使用入口，但本轮未进入 Comate 工作台。

以上入口观察记录在：[第一轮测试记录](./first-round-findings.md) 和 [运行报告](./REPORT.md)。

## 重要限制

- 当前报告没有把登录阻塞、未进入工作台和未测试产品当作能力失败。
- 官方产品页证明的是产品定位和公开承诺，不证明在同一输入下的成功率、视觉质量或 Office 交付质量。
- 用户“更喜欢网页还是 PPT/图片”的心智不能由产品首页或模板数量推断，需要后续任务实验和访谈验证。
- 任何产品的最终排名都必须等统一素材、统一提示词、同级账号和至少两次试验完成后再做。
