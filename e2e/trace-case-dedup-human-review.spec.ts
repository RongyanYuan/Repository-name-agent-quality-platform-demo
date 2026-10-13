import { expect, test, type Page } from '@playwright/test'

const detail = (page:Page) => page.getByRole('dialog',{name:/Case 详情/})
const stored = (page:Page) => page.evaluate(()=>JSON.parse(localStorage.getItem('office-agent-evolution-governance:v1')!))

test('长数字身份、精确非主 Trace 与旧链接兼容',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.goto('/traces/trace-ppt-context?timeRange=30d&caseView=trace&observationId=obs-ppt-memory')
  await expect(page).toHaveURL(url=>url.pathname==='/cases' && /^\d{18,24}$/.test(url.searchParams.get('traceId') ?? ''))
  const id=new URL(page.url()).searchParams.get('traceId')!
  const execution=page.getByRole('dialog',{name:'执行节点详情'})
  await expect(execution).toContainText('obs-ppt-memory')
  await execution.getByRole('button',{name:'Close panel',exact:true}).click()
  await detail(page).getByRole('button',{name:'复制 Trace ID',exact:true}).first().click()
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(id)
  await expect(detail(page)).toContainText('已复制')
  await page.goto('/cases?traceId=trace-ppt-context&timeRange=30d&caseClosed=1')
  await expect(page.getByRole('table',{name:'Case / Trace 列表'}).getByRole('checkbox',{name:/选择 Trace/})).toHaveCount(10)
  await expect(page.getByRole('table',{name:'Case / Trace 列表'})).toContainText(id)
})

test('完整 PPT 链路：Evidence、两次复核、刷新、数据集与发布反查',async({page})=>{
  await page.goto('/cases?traceId=trace-governance-demo-ppt&caseView=eval&timeRange=30d')
  const before=await stored(page)
  const frozen=JSON.stringify({experiments:before.state.experiments,decisions:before.state.gateDecisions})
  const row=detail(page).getByRole('row').filter({has:page.getByRole('button',{name:'查看 skill 进化历史',exact:true})})
  await row.getByRole('button',{name:'查看 skill Evidence',exact:true}).click()
  const evidence=page.getByRole('dialog',{name:/skill Evidence/i})
  await expect(evidence).toContainText('rubric-governance-demo-v1')
  await expect(evidence).toContainText('管理层 PPT 首屏应呈现结论与业务行动')
  await expect(evidence).toContainText('Mock 实际产物为数据罗列')
  await evidence.getByRole('button',{name:'Close panel',exact:true}).click()
  for(const [score,reason] of [['0','浏览器首次复核：保留自动证据'],['1.25','浏览器二次复核：按 Rubric 修订']] as const){
    await row.getByRole('button',{name:/人工复核 skill|修改复核 skill/}).click()
    await page.getByLabel('人工分数（0–2）',{exact:true}).fill(score)
    await page.getByLabel('辅助结论',{exact:true}).selectOption('FAIL')
    await page.getByLabel('复核说明',{exact:true}).fill(reason)
    await page.getByRole('button',{name:'保存人工复核',exact:true}).click()
    await expect(page.getByRole('region',{name:'人工复核编辑器'})).toHaveCount(0)
  }
  await page.reload()
  await expect(row).toContainText('1.25 / 2')
  const after=await stored(page)
  expect(JSON.stringify({experiments:after.state.experiments,decisions:after.state.gateDecisions})).toBe(frozen)
  await detail(page).getByRole('button',{name:'查看 skill 复核历史',exact:true}).click()
  const history=page.getByRole('region',{name:'模块人工复核历史'})
  await expect(history.getByRole('article')).toHaveCount(4)
  await expect(history).toContainText('浏览器首次复核')
  await expect(history).toContainText('浏览器二次复核')
  await page.getByRole('dialog',{name:/模块人工复核历史/}).getByRole('button',{name:'关闭模块人工复核历史',exact:true}).click()
  await expect(detail(page).getByRole('tab',{name:'评测中心',exact:true})).toHaveAttribute('aria-selected','true')
  await detail(page).getByRole('button',{name:'查看 skill 进化历史',exact:true}).click()
  const module=page.getByRole('dialog',{name:/Skill · 进化详情/i})
  await module.getByRole('button',{name:'skill sop错误',exact:true}).click()
  const path=module.locator('article[data-evolution-record-id]').filter({has:page.getByRole('button',{name:'release-governance-demo-ppt',exact:true})}).first()
  await expect(path).toContainText('mock-v1')
  await path.getByRole('button',{name:'release-governance-demo-ppt',exact:true}).first().click()
  await expect(page).toHaveURL(/releaseId=release-governance-demo-ppt/)
  const report=page.getByRole('dialog',{name:/归因历史详情/})
  await expect(report).toContainText('variant-governance-demo-ppt')
  await expect(report).toContainText('experiment-governance-demo-window')
  await page.getByRole('button',{name:'返回来源页面',exact:true}).click()
  await expect(page.getByRole('dialog',{name:/Skill · 进化详情/i})).toBeVisible()
})

test('旧治理链接进入评测中心、未评测兄弟 Trace 不继承发布',async({page})=>{
  await page.goto('/cases?traceId=trace-governance-demo-tool&caseView=governance&timeRange=30d')
  await expect(page).toHaveURL(/caseView=eval/)
  await expect(detail(page).getByRole('tab',{name:'治理链路',exact:true})).toHaveCount(0)
  await page.goto('/cases?traceId=trace-governance-demo-parallel&caseView=governance&timeRange=30d')
  await expect(page).toHaveURL(/caseView=eval/)
  await expect(detail(page).getByRole('heading',{name:'Trace 模块评测矩阵',exact:true})).toBeVisible()
  await page.goto('/cases?traceId=trace-governance-demo-ppt-context&caseView=eval&timeRange=30d')
  await expect(detail(page).getByRole('heading',{name:'未评测',exact:true})).toBeVisible()
  await expect(detail(page).getByRole('button',{name:/人工复核 skill/})).toHaveCount(0)
  await detail(page).getByRole('tab',{name:'产物评测',exact:true}).click()
  await expect(detail(page)).toContainText('当前 Trace 无产物')
  await detail(page).getByRole('tab',{name:'评测中心',exact:true}).click()
  await expect(detail(page).getByRole('button',{name:/进化历史/})).toHaveCount(0)
})

test('数据集样本治理入口与固定版本返回上下文',async({page})=>{
  const source='/datasets-evaluations?skillCategory=PRODUCTION_SKILL&skill=skill-ppt-builder&skillVersion=all&attribution=skill-sop&datasetId=dataset-governance-demo-ppt&view=datasets&timeRange=30d&environment=Production'
  await page.goto(source)
  const members=page.getByRole('table',{name:'数据集样本 Trace'})
  await members.getByRole('button',{name:'查看 Case / Trace',exact:true}).first().click()
  await expect(detail(page).getByRole('tab',{name:'评测中心',exact:true})).toHaveAttribute('aria-selected','true')
  await page.getByRole('button',{name:'返回来源页面',exact:true}).click()
  await expect(page.getByLabel('具体 Skill',{exact:true})).toHaveValue('skill-ppt-builder')
  await expect(page.getByLabel('Skill 版本',{exact:true})).toHaveValue('all')
  await expect(page.getByRole('dialog',{name:/数据集详情/})).toContainText('dataset-governance-demo-ppt')
})

for(const width of [1280,1440]) test(`${width}px 长 ID、所有 Tab、矩阵、复核与并行时间线布局`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900})
  await page.goto('/cases?traceId=trace-governance-demo-ppt&caseView=trace&timeRange=30d')
  const check=async(name:string)=>{
    const panel=detail(page)
    const clipped=await panel.locator('header h2,[role="tab"],button,input,textarea,select').evaluateAll(nodes=>nodes.filter(node=>{
      const el=node as HTMLElement,r=el.getBoundingClientRect()
      if(el.closest('[aria-label="治理时间分支图"]'))return false
      if(!r.width||!r.height) return false
      return r.left < -1 || r.right > innerWidth+1 || el.scrollWidth > el.clientWidth+2
    }).map(node=>node.getAttribute('aria-label')||node.textContent||node.nodeName))
    expect(clipped,`${name} at ${width}`).toEqual([])
    const overlaps=await panel.locator('input,textarea,select,[role="tab"]').evaluateAll(nodes=>{
      const results:string[]=[]
      for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){
        const x=nodes[a].getBoundingClientRect(),y=nodes[b].getBoundingClientRect()
        if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)results.push(`${nodes[a].getAttribute('aria-label')} / ${nodes[b].getAttribute('aria-label')}`)
      }return results
    })
    expect(overlaps).toEqual([])
    await page.screenshot({path:testInfo.outputPath(`${name}-${width}.png`)})
  }
  for(const tab of ['Session 对话','评测中心','产物评测']){
    await detail(page).getByRole('tab',{name:tab,exact:true}).click()
    await check(tab)
  }
  await detail(page).getByRole('tab',{name:'评测中心',exact:true}).click()
  await detail(page).getByRole('button',{name:'人工复核 skill',exact:true}).click()
  await expect(page.getByRole('region',{name:'人工复核编辑器'})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath(`module-review-${width}.png`)})
  await page.getByRole('button',{name:'取消',exact:true}).click()
  await page.goto('/cases?traceId=trace-governance-demo-parallel&caseView=governance&timeRange=30d')
  await check('并行时间线')
  await page.goto('/datasets-evaluations?datasetId=dataset-governance-demo-ppt&timeRange=30d')
  await expect(page.getByRole('table',{name:'数据集样本 Trace'})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath(`dataset-members-${width}.png`)})
})
