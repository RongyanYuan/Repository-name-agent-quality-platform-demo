import { expect, test } from '@playwright/test'

test('Trace filters and unified dataset evaluation workbench are connected', async ({ page }) => {
  await page.goto('/cases?timeRange=30d&environment=Production')
  await expect(page.getByLabel('Channel')).toBeVisible()
  await expect(page.getByLabel('垂类场景')).toBeVisible()
  await expect(page.getByLabel('归因', { exact: true })).toBeVisible()
  await page.getByLabel('Channel').selectOption('genflow pc 端')
  await page.getByLabel('垂类场景').selectOption('PPT')
  await expect(page).toHaveURL(/channel=genflow\+pc\+%E7%AB%AF/)
  const traceCheckbox = page.getByRole('checkbox', { name: /选择 Trace/ }).first()
  await traceCheckbox.check()
  await expect(page.getByRole('button', { name: '加入黄金集' })).toBeVisible()

  await page.goto('/datasets-evaluations?timeRange=30d&environment=Production')
  await expect(page.getByRole('heading', { name: '数据集与评测', exact: true })).toBeVisible()
  await page.getByLabel('Skill 分类', { exact: true }).selectOption('PRODUCTION_SKILL')
  await page.getByLabel('具体 Skill', { exact: true }).selectOption('skill-ppt-builder')
  await page.getByLabel('归因', { exact: true }).selectOption('skill-sop')
  await expect(page.getByRole('table', { name: '数据集与评测列表' })).toContainText('原始归因集A')
})
