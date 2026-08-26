import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]

const routes = ['/overview', '/performance', '/anomaly-monitoring', '/tasks', '/cases', '/datasets', '/benchmarks', '/evaluation-config']

test.describe('v2 responsive text-fit checks', () => {
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

test('v2 governance flow exposes provenance across Case, Dataset and Benchmark', async ({ page }) => {
  await page.goto('/cases')
  await page.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。').click()
  await expect(page.getByRole('heading', { name: 'Trace first-failure attribution' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'User behavior evidence' })).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.goto('/datasets')
  await page.getByText('根据刚才的销售 Excel 做一份 PPT，这次改成面向管理层。').click()
  await expect(page.getByText('File Validity')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Source & version history' })).toBeVisible()
  await page.goto('/benchmarks')
  await expect(page.locator('main').getByRole('heading', { name: 'Benchmark', exact: true })).toBeVisible()
  await expect(page.getByText('Result Eval、Process Eval 和 Performance Metric')).toBeVisible()
})

test('anomaly monitoring drills into filtered Task / Trace', async ({ page }) => {
  await page.goto('/anomaly-monitoring')
  await page.getByRole('button', { name: /风控拦截率/ }).click()
  await expect(page).toHaveURL(/\/tasks\?.*metric=risk-interception/)
  await expect(page.locator('main').getByRole('heading', { name: 'Task / Trace', exact: true })).toBeVisible()
})
