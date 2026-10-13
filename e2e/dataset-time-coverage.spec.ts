import { expect, test } from '@playwright/test'

const datasetTable = (page: import('@playwright/test').Page) => page.getByRole('table', { name: '数据集与评测列表' })

test.describe('数据集样本时间覆盖筛选', () => {
  test('两个 datetime 使用样本覆盖范围做交集筛选，并在刷新后保留', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=datasets&datasetCategory=GOLDEN')
    const filters = page.getByRole('region', { name: '治理范围筛选' })
    const table = datasetTable(page)
    await expect(filters.getByLabel('数据集类型')).toHaveValue('GOLDEN')

    // The Mock taste-history set covers 09/24 (the displayed wall-clock date
    // is independent of whether the browser runs in UTC or Asia/Shanghai).
    await filters.getByLabel('自定义开始时间').fill('2026-09-24T00:00')
    await filters.getByLabel('自定义结束时间').fill('2026-09-24T23:59')
    await expect(table).toContainText('黄金测试集C · 品味偏好历史')
    await expect(table).not.toContainText('黄金测试集A · 全链路基线')
    await expect(table).not.toContainText('黄金测试集B · 多轮上下文')
    await expect(page).toHaveURL(url => url.searchParams.get('datasetTimeFrom') === '2026-09-24T00:00' && url.searchParams.get('datasetTimeTo') === '2026-09-24T23:59')

    await page.reload()
    const refreshedFilters = page.getByRole('region', { name: '治理范围筛选' })
    await expect(refreshedFilters.getByLabel('自定义开始时间')).toHaveValue('2026-09-24T00:00')
    await expect(refreshedFilters.getByLabel('自定义结束时间')).toHaveValue('2026-09-24T23:59')
    await expect(datasetTable(page)).toContainText('黄金测试集C · 品味偏好历史')
  })

  test('仅填写一个边界可筛选，结束时间早于开始时间时显示空结果', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=datasets&datasetCategory=PERSONAL')
    const filters = page.getByRole('region', { name: '治理范围筛选' })
    const table = datasetTable(page)
    await filters.getByLabel('自定义开始时间').fill('2026-09-24T00:00')
    await expect(table).toContainText('我的 Memory 历史复核集')
    await expect(filters.getByLabel('自定义结束时间')).toHaveValue('')

    await filters.getByLabel('自定义结束时间').fill('2026-09-23T23:59')
    await expect(filters).toContainText('自定义结束时间不能早于开始时间')
    await expect(table).toContainText('暂无对应测试集')
    await expect(page).toHaveURL(url => url.searchParams.get('datasetTimeFrom') === '2026-09-24T00:00' && url.searchParams.get('datasetTimeTo') === '2026-09-23T23:59')
  })
})
