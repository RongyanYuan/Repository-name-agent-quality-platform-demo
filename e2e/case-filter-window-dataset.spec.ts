import { expect, test } from '@playwright/test'

test('Case / Trace 支持治理时间窗口与具体数据集两级筛选', async ({ page }) => {
  await page.goto('/cases?caseClosed=1&timeRange=30d')
  const filters = page.getByRole('region', { name: '统一筛选' })
  await expect(filters.getByLabel('时间窗口')).toBeVisible()
  await expect(filters.getByLabel('数据集类型')).toBeVisible()
  await expect(filters.getByLabel('具体数据集')).toBeVisible()

  await filters.getByLabel('数据集类型').selectOption('GOLDEN')
  const goldenDataset = filters.getByLabel('具体数据集')
  await expect(goldenDataset.locator('option').filter({ hasText: '黄金测试集A' })).toHaveCount(1)
  const goldenId = await goldenDataset.locator('option').nth(1).getAttribute('value')
  expect(goldenId).toBeTruthy()
  await goldenDataset.selectOption(goldenId!)
  await expect(page).toHaveURL(url => url.searchParams.get('datasetCategory') === 'GOLDEN' && url.searchParams.get('datasetId') === goldenId)
  await expect(page.getByRole('table', { name: 'Case / Trace 列表' })).toContainText('黄金测试集A')

  await filters.getByLabel('数据集类型').selectOption('GATE')
  await expect(goldenDataset).toHaveValue('')
  await filters.getByLabel('时间窗口').selectOption('CUSTOM')
  await filters.getByLabel('自定义开始时间').fill('2026-09-20T00:00')
  await filters.getByLabel('自定义结束时间').fill('2026-09-27T23:59')
  await expect(page).toHaveURL(url => url.searchParams.has('timeFrom') && url.searchParams.has('timeTo') && url.searchParams.get('timeRange') === 'all')
  await filters.getByLabel('自定义结束时间').fill('2026-09-19T23:59')
  await expect(filters).toContainText('结束时间不能早于开始时间')
  await filters.getByRole('button', { name: '重置', exact: true }).click()
  await expect(page).not.toHaveURL(/datasetCategory|datasetId|timeFrom|timeTo|timeWindowId/)
})
