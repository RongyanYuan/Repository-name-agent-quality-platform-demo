import { expect, test } from '@playwright/test'

test('治理总览仅展示三个大盘，产物结果使用 0 / 1 / 2 评分', async ({ page }) => {
  await page.goto('/overview?timeRange=30d&environment=Production')
  const main = page.locator('main')
  await expect(main.locator('h2')).toHaveText(['产物结果大盘', '资产大盘', '过程大盘'])
  await expect(page.getByRole('heading', { name: '治理总览', exact: true, level: 1 })).toHaveCount(1)

  for (const label of ['总 Case 数', '有产物结果的 Case', '0 分', '1 分', '2 分', '采纳率']) {
    await expect(main.getByText(label, { exact: true })).toBeVisible()
  }
  for (const label of ['已进化资产', '进化项', '贡献 Trace', '待进化项', '进化后线上产物平均分']) {
    await expect(main.getByText(label, { exact: true })).toBeVisible()
  }
  for (const oldTitle of ['进化漏斗', '批量评测覆盖与数据分流', '模块问题分布', '性能与安全原始信号', '用户满意度', '合格产物', '模块诊断与首错归因']) {
    await expect(main.getByRole('heading', { name: oldTitle, exact: true })).toHaveCount(0)
  }
  await expect(main.getByText(/GSB/)).toHaveCount(0)
  await expect(main.getByText('Mock 演示数据', { exact: true })).toBeVisible()
})

test('过程效率按四种产物区分，质量复用 PRD 记忆 / skill / Reason / Act 模块', async ({ page }) => {
  await page.goto('/overview?timeRange=30d&environment=Production')
  const efficiency = page.getByRole('table', { name: '按产物类型的过程效率', exact: true })
  const quality = page.getByRole('table', { name: '按产物类型的过程质量', exact: true })
  await expect(efficiency).toBeVisible()
  await expect(quality).toBeVisible()

  for (const type of ['PPT', 'Word', 'Excel', '生图']) {
    await expect(efficiency.getByRole('rowheader').filter({ hasText: new RegExp(`^${type}$`) })).toBeVisible()
    await expect(quality.getByRole('columnheader', { name: type, exact: true })).toBeVisible()
  }
  for (const module of ['记忆', 'skill', 'Reason', 'Act']) {
    await expect(quality.getByRole('row', { name: new RegExp(`^${module}\\s`) })).toBeVisible()
  }
  await expect(quality.getByRole('row', { name: /^上文\s|^上下文\s/ })).toHaveCount(0)
  await expect(efficiency).not.toContainText('NaN')
  await expect(quality).not.toContainText('NaN')
  await expect(quality).not.toContainText('UNKNOWN')
})

test('QA 链接使用指定平台，资产入口保留总览筛选并清理规则配置上下文', async ({ page }) => {
  await page.goto('/overview?timeRange=30d&environment=Production&businessType=PPT&ruleType=CLUSTER&ruleAssetType=TASTE_SKILL&ruleAssetId=asset-catalog-skill-taste-executive&ruleAttribution=skill-capability')
  const qa = page.getByRole('link', { name: '前往 QA 平台', exact: true })
  await expect(qa).toHaveAttribute('href', 'https://autoeval.baidu-int.com/tasks')
  await expect(qa).toHaveAttribute('target', '_blank')

  await page.getByRole('link', { name: '查看资产管理', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/assets-skills'
    && url.searchParams.get('timeRange') === '30d'
    && url.searchParams.get('environment') === 'Production'
    && url.searchParams.get('businessType') === 'PPT'
    && ['ruleType', 'ruleAssetType', 'ruleAssetId', 'ruleAttribution'].every(key => !url.searchParams.has(key)))
  await expect(page.locator('main').getByRole('heading', { name: '资产管理', exact: true, level: 1 })).toBeVisible()
})
