import { expect, test } from '@playwright/test'

test('核心导航收敛为四个入口，Case 可进入完整 Trace', async ({ page }) => {
  await page.goto('/overview')
  await expect(page.getByText('Office Agent', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link')).toHaveCount(4)
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '数据集与评测' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '能力变体' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Case / Trace 分析' }).click()
  await page.getByRole('button', { name: /查看完整 Case/ }).first().click()
  const detail = page.getByRole('dialog', { name: /Case 详情/ })
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: '查看 Trace 执行' }).click()
  await expect(detail.getByRole('heading', { name: 'Trace 模块评测矩阵' })).toBeVisible()
  await expect(detail.getByRole('heading', { name: '产物 / 结果评测' })).toBeVisible()
})

test('Case 治理链路中的问题、变体和实验 ID 进入统一历史视图', async ({ page }) => {
  await page.goto('/cases?timeRange=30d&environment=Production&caseId=case-ppt-management')
  await page.getByRole('tab', { name: '治理链路' }).click()
  await page.getByRole('button', { name: 'variant-ppt-routing-v3' }).click()
  await expect(page).toHaveURL(/\/datasets-evaluations\?.*variantId=variant-ppt-routing-v3.*view=history/)
  await expect(page.locator('main').getByRole('heading', { name: '归因与进化历史', exact: true })).toBeVisible()

  await page.goto('/datasets-evaluations?view=history&timeRange=30d&environment=Production&experimentId=exp-single-ppt-routing')
  await expect(page.getByRole('dialog', { name: /归因历史详情/ })).toContainText('exp-single-ppt-routing')
})

test('所有旧治理 URL 都重定向到统一工作台并保留筛选与对象 ID', async ({ page }) => {
  const redirects = [
    ['/issues?timeRange=30d&issueId=issue-skill-recall', '(?=.*view=history)(?=.*issueId=issue-skill-recall)'],
    ['/variants?timeRange=30d&variantId=variant-ppt-routing-v3', '(?=.*view=history)(?=.*variantId=variant-ppt-routing-v3)'],
    ['/experiments?timeRange=30d&experimentId=exp-single-ppt-routing', '(?=.*view=history)(?=.*experimentId=exp-single-ppt-routing)'],
    ['/releases?timeRange=30d&releaseId=release-agent-3-0-0', '(?=.*view=history)(?=.*releaseId=release-agent-3-0-0)'],
    ['/datasets?timeRange=30d&datasetId=dataset-attribution', '(?=.*view=datasets)(?=.*datasetId=dataset-attribution)'],
    ['/assets-skills?timeRange=30d&skillId=skill-ppt-builder', '(?=.*view=datasets)(?=.*skillId=skill-ppt-builder)']
  ] as const
  for (const [url, expected] of redirects) {
    await page.goto(url)
    await expect(page).toHaveURL(new RegExp(`\\/datasets-evaluations\\?.*${expected}`))
  }
})

test('Case confirmation and attribution revision persist after reload', async ({ page }) => {
  await page.goto('/cases?caseId=case-multi-route&timeRange=30d')
  await page.getByRole('button', { name: '人工确认' }).click()
  await page.getByLabel('确认说明').fill('E2E 人工确认持久化')
  await page.getByRole('button', { name: '保存人工结论' }).click()
  await page.getByRole('button', { name: '调整归因' }).click()
  await page.getByLabel('目标归因').selectOption('attribution-reason-tool')
  await page.getByLabel('归因模块').selectOption('Reason')
  await page.getByLabel('归因维度').selectOption('调用工具所需参数是否正确')
  const attributionDialog = page.getByRole('dialog', { name: '调整归因' })
  await attributionDialog.locator('textarea').fill('E2E 指定归因持久化')
  await page.getByRole('button', { name: '保存归因调整' }).click()
  await page.reload()
  await expect(page.getByText('E2E 人工确认持久化')).toBeVisible()
  await expect(page.getByText('E2E 指定归因持久化')).toBeVisible()
})

test('规则配置仍保留为独立入口', async ({ page }) => {
  await page.goto('/evaluation-config?businessType=PPT')
  await expect(page).toHaveURL(/\/rules\?.*businessType=PPT/)
  await expect(page.locator('main').getByRole('heading', { name: '规则配置', exact: true })).toBeVisible()
})
