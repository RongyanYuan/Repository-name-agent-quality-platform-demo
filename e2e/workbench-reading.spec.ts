import { expect, test } from '@playwright/test'

test('人类阅读路径：Case → Trace 评测 → Evidence → 统一治理历史', async ({ page }) => {
  await page.goto('/cases?timeRange=30d&environment=Production&traceId=trace-ppt-generate&caseView=trace')
  const detail = page.getByRole('dialog', { name: /Case 详情/ })
  await expect(detail.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
  await expect(detail.getByRole('heading', { name: 'Trace 模块评测矩阵' })).toBeVisible()
  await detail.getByRole('button', { name: '查看 skill Evidence' }).click()
  const evidence = page.getByRole('dialog', { name: /skill Evidence/ })
  await expect(evidence).toContainText('rubric-office-v2.1#skill')
  await evidence.getByRole('button', { name: 'Close panel', exact: true }).click()
  await detail.getByRole('button', { name: '查看 skill 进化历史', exact: true }).click()
  const module=page.getByRole('dialog',{name:'skill · 进化详情',exact:true})
  await module.getByRole('button',{name:'skill name/description错误',exact:true}).click()
  await module.getByRole('button',{name:'finding-trace-ppt-generate-skill',exact:true}).first().click()
  await expect(page).toHaveURL(/\/datasets-evaluations\?.*findingId=/)
  await expect(page).toHaveURL(/timeRange=30d/)
  await expect(page).toHaveURL(/environment=Production/)
})

test('统一工作台保留 Skill 与归因筛选', async ({ page }) => {
  await page.goto('/datasets-evaluations?view=history&timeRange=30d&environment=Production&skillId=skill-taste-executive')
  await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-taste-executive')
  await expect(page.getByRole('tab', { name: /归因历史/ })).toBeVisible()
  await page.getByRole('tab', { name: /数据集/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('view') === 'datasets'
    && (url.searchParams.get('skill') ?? url.searchParams.get('skillId')) === 'skill-taste-executive'
    && url.searchParams.get('timeRange') === '30d'
    && url.searchParams.get('environment') === 'Production')
})

test('问题簇、变体、实验的旧入口统一落在准出与进化历史', async ({ page }) => {
  await page.goto('/issues?timeRange=30d&environment=Production&clusterId=cluster-memory-version')
  await expect(page).toHaveURL(/\/datasets-evaluations\?.*(?=.*view=history)(?=.*clusterId=cluster-memory-version)/)
  await expect(page.getByRole('tab', { name: /归因历史/ })).toBeVisible()
})
