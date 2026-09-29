import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]

const routes = ['/overview', '/cases', '/evaluations', '/issues', '/variants', '/experiments', '/releases', '/assets-skills', '/datasets', '/rules']

test.describe('self-evolution governance responsive text-fit checks', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} routes have no horizontal overflow or clipped key headings`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator('main')).toBeVisible()
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

test('governance flow exposes provenance across Case, Dataset and Experiment', async ({ page }) => {
  await page.goto('/cases')
  await page.getByText('根据刚才的销售 Excel 生成一份面向管理层的季度经营 PPT。').click()
  await expect(page.getByRole('dialog', { name: /Case 详情 · case-ppt-management/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Trace 与 Evidence' }).click()
  await expect(page.getByText('失败 Evidence / Log')).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.goto('/datasets')
  await page.getByText('原始归因集').click()
  await expect(page.getByRole('dialog', { name: '数据集详情' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '本地 Case 成员' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'case-ppt-management' })).toBeVisible()
  await page.goto('/experiments')
  await expect(page.locator('main').getByRole('heading', { name: '实验与准出', exact: true })).toBeVisible()
  await expect(page.getByText(/Baseline|Candidate/).first()).toBeVisible()
})
