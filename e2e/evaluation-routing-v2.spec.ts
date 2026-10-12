import { expect, test } from '@playwright/test'

test('旧评测链接迁移到 Case Eval 并保留评测对象和线上范围', async ({ page }) => {
  await page.goto('/evaluations?timeRange=30d&environment=Production&evaluationId=process-eval-ppt-recall')
  await expect(page).toHaveURL(url => url.pathname === '/cases'
    && url.searchParams.get('evaluationId') === 'process-eval-ppt-recall'
    && url.searchParams.get('caseId') === 'case-ppt-management'
    && url.searchParams.get('traceId') === 'trace-ppt-generate'
    && url.searchParams.get('caseView') === 'eval'
    && url.searchParams.get('timeRange') === '30d'
    && url.searchParams.get('environment') === 'Production')
  const detail = page.getByRole('dialog', { name: /Case 详情/ })
  await expect(detail.getByRole('tab', { name: '评测中心' })).toHaveAttribute('aria-selected', 'true')
  await expect(detail).toContainText('process-eval-ppt-recall')
  await expect(detail).toContainText('未召回管理层汇报 SOP')
})

test('统一工作台在数据集和归因历史间切换时保留原有 Skill 与归因筛选', async ({ page }) => {
  await page.goto('/datasets-evaluations?timeRange=30d&environment=Production&skillId=skill-ppt-builder&evolutionItem=skill-sop')
  await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
  await expect(page.getByLabel('归因', { exact: true })).toHaveValue('skill-sop')
  await page.getByRole('tab', { name: /归因历史/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('view') === 'history'
    && (url.searchParams.get('skill') ?? url.searchParams.get('skillId')) === 'skill-ppt-builder'
    && url.searchParams.get('attribution') === 'skill-sop')
  await expect(page.getByRole('table', { name: '归因历史列表' })).toContainText('skill-ppt-builder@2.6.0#skill-sop')
  await page.getByRole('tab', { name: /数据集/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('view') === 'datasets'
    && (url.searchParams.get('skill') ?? url.searchParams.get('skillId')) === 'skill-ppt-builder'
    && url.searchParams.get('attribution') === 'skill-sop'
    && url.searchParams.get('timeRange') === '30d'
    && url.searchParams.get('environment') === 'Production')
  await expect(page.getByRole('table', { name: '数据集与评测列表' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Trace/ })).toHaveCount(0)
})

test('旧 Trace 工作台链接仍进入 Case 的完整执行过程', async ({ page }) => {
  await page.goto('/datasets-evaluations?view=traces&traceId=trace-ppt-generate&timeRange=30d&environment=Production')
  await expect(page).toHaveURL(url => url.pathname === '/cases'
    && url.searchParams.get('traceId') === 'trace-ppt-generate'
    && url.searchParams.get('caseView') === 'trace'
    && url.searchParams.get('timeRange') === '30d')
  const detail = page.getByRole('dialog', { name: /Case 详情/ })
  await expect(detail.getByRole('tab', { name: 'Trace 与 Evidence' })).toHaveAttribute('aria-selected', 'true')
  await expect(detail.getByRole('heading', { name: 'Trace 模块评测矩阵' })).toBeVisible()
})
