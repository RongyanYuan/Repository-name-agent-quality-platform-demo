import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'workbench-wide', width: 1280, height: 900 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]

const routes = ['/overview', '/cases', '/datasets-evaluations', '/evaluations', '/issues', '/variants', '/experiments', '/releases', '/assets-skills', '/datasets', '/rules']

test.describe('治理平台响应式文字适配', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} 路由无横向溢出或裁切标题`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator('main')).toBeVisible()
        await page.waitForLoadState('networkidle')
        const result = await page.evaluate(() => {
          const body = document.body
          const keyNodes = Array.from(document.querySelectorAll('main h1, main h2, main h3, main [role="heading"]'))
          const clipped = keyNodes.filter((node) => {
            const element = node as HTMLElement
            const rect = element.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0 && (element.scrollWidth > element.clientWidth + 1 || rect.right > window.innerWidth + 1 || rect.left < -1)
          }).slice(0, 12).map((node) => (node.textContent ?? '').trim()).filter(Boolean)
          return { overflow: body.scrollWidth > window.innerWidth + 1, clipped }
        })
        expect(result.overflow, `${route} overflows at ${viewport.width}px`).toBe(false)
        expect(result.clipped, `${route} has clipped text: ${result.clipped.join(' | ')}`).toEqual([])
      }
    })
  }
})

test('统一工作台可以反查 Case、数据集和实验对象', async ({ page }) => {
  await page.goto('/cases')
  await page.getByRole('button', { name: /查看完整 Case/ }).first().click()
  await expect(page.getByRole('dialog', { name: /Case 详情/ })).toBeVisible()
  await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=datasets')
  await page.getByRole('row', { name: /dataset-workspace-ppt-260-sop-attribution/ }).click()
  await expect(page.getByRole('dialog', { name: /数据集详情/ })).toBeVisible()
  await page.goto('/datasets-evaluations?view=history&experimentId=exp-single-ppt-routing')
  await expect(page.getByRole('dialog', { name: /归因历史详情|准出与进化历史详情/ })).toContainText('exp-single-ppt-routing')
})

for (const width of [1280, 1440]) {
  test(`${width}px 工作台筛选控件无重叠且选中文本完整显示`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/datasets-evaluations?skill=skill-taste-executive&attribution=taste-recall')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('1.0.0-rc.1')
    const result = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll<HTMLElement>('.global-filter-bar select, .global-filter-bar form, main select'))
      const overlaps: string[] = []
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          const a = controls[i].getBoundingClientRect()
          const b = controls[j].getBoundingClientRect()
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
            && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
            overlaps.push(`${controls[i].getAttribute('aria-label') || controls[i].id || 'search'} / ${controls[j].getAttribute('aria-label') || controls[j].id || 'search'}`)
          }
        }
      }
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      const clipped: string[] = []
      document.querySelectorAll<HTMLSelectElement>('main select').forEach(select => {
        const style = getComputedStyle(select)
        context.font = style.font
        const text = select.selectedOptions[0]?.textContent ?? ''
        const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        if (context.measureText(text).width > available + 1) clipped.push(text)
      })
      return { overlaps, clipped }
    })
    expect(result.overlaps, `Controls overlap at ${width}px`).toEqual([])
    expect(result.clipped, `Selected text is clipped at ${width}px`).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`skill-selection-${width}.png`) })
  })

  test(`${width}px 数据集、归因历史与 Case 抽屉标题和操作完整显示`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const scenarios = [
      { name: 'dataset-members', url: '/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&datasetId=dataset-workspace-ppt-260-sop-attribution', dialog: /数据集详情/ },
      { name: 'attribution-history', url: '/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.5.0&view=history&historyItem=skill-ppt-builder%402.5.0%23skill-sop', dialog: /归因历史详情/ },
      { name: 'case-trace', url: '/cases?caseId=case-workspace-ppt-260-sop-1&traceId=trace-workspace-ppt-260-sop-1&caseView=trace', dialog: /Case 详情/ }
    ]
    for (const scenario of scenarios) {
      await test.step(scenario.name, async () => {
        await page.goto(scenario.url)
        const detail = page.getByRole('dialog', { name: scenario.dialog })
        await expect(detail).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath(`${scenario.name}-${width}.png`) })
        const clipped = await detail.locator('h1, h2, h3, [role="tab"], th, button').evaluateAll(nodes => nodes.filter(node => {
          const element = node as HTMLElement
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && (element.scrollWidth > element.clientWidth + 1 || rect.right > innerWidth + 1 || rect.left < -1)
        }).map(node => (node.textContent ?? '').trim()).filter(Boolean))
        expect(clipped, `${scenario.name} clipped text at ${width}px`).toEqual([])
      })
    }
  })
}
