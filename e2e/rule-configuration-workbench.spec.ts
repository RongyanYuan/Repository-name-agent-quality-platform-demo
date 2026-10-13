import { expect, test, type Locator, type Page } from '@playwright/test'

const tasteAssetId = 'asset-catalog-skill-taste-executive'

test('侧边栏进入规则与返回总览时页面保持可用', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/overview')
  const nav = page.getByRole('navigation', { name: '主导航' })
  await nav.getByRole('link', { name: '规则配置', exact: true }).click()
  await expect(page.getByRole('button', { name: '配置聚类规则', exact: true })).toBeVisible()
  await expect(page.locator('[aria-label="全局筛选"]')).toHaveCount(0)
  await nav.getByRole('link', { name: '治理总览', exact: true }).click()
  await expect(page.getByRole('heading', { name: '治理总览', level: 1, exact: true }).last()).toBeVisible()
  await expect(page.locator('[aria-label="全局筛选"]')).toBeVisible()
  expect(errors).toEqual([])
})

async function openConfiguration(page: Page, name: '指标准出门禁' | '分流规则' | '聚类规则') {
  await page.getByRole('button', { name: `配置${name}`, exact: true }).click()
  const card = page.getByRole('region', { name: `${name}配置`, exact: true })
  await expect(card).toBeVisible()
  return card
}

async function chooseTasteRecall(card: Locator) {
  await card.getByLabel('资产类型', { exact: true }).selectOption('TASTE_SKILL')
  await card.getByLabel('具体资产', { exact: true }).selectOption(tasteAssetId)
  await card.getByLabel('归因', { exact: true }).selectOption('taste-recall')
}

test('规则配置仅保留三个配置入口，移除页面顶部筛选与旧控制面', async ({ page }) => {
  await page.goto('/rules?assetType=TASTE_SKILL&assetVersion=ALL&governanceObject=Memory')
  await expect(page.getByRole('heading', { name: '规则配置', exact: true })).toHaveCount(1)
  await expect(page.locator('[aria-label="全局筛选"]')).toHaveCount(0)
  await expect(page.getByPlaceholder('搜索规则名称或说明')).toHaveCount(0)
  for (const name of ['指标准出门禁', '分流规则', '聚类规则'] as const) {
    await expect(page.getByRole('button', { name: `配置${name}`, exact: true })).toHaveCount(1)
  }
  await expect(page.getByRole('table', { name: '治理规则配置列表' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '批次、分流与实验规则视图' })).toHaveCount(0)
  const card = await openConfiguration(page, '指标准出门禁')
  for (const label of ['资产类型', '具体资产', '资产版本', '归因']) {
    await expect(card.getByLabel(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: '分流规则配置', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '聚类规则配置', exact: true })).toHaveCount(0)
})

test('准出门禁支持 0–2 分配置、刷新持久化和独立归因作用域', async ({ page }) => {
  await page.goto('/rules')
  let card = await openConfiguration(page, '指标准出门禁')
  await chooseTasteRecall(card)
  const labels = ['过程最终得分下限', '产物最终得分下限', '泛化最终得分下限']
  for (const label of labels) await expect(card.getByLabel(label, { exact: true })).toHaveValue('')
  await expect(card.getByText('待配置', { exact: true }).first()).toBeVisible()
  await card.getByLabel(labels[0], { exact: true }).fill('2.1')
  await expect(card.getByRole('button', { name: '保存配置', exact: true })).toBeDisabled()
  await card.getByLabel(labels[0], { exact: true }).fill('1.2')
  await card.getByLabel(labels[1], { exact: true }).fill('1.6')
  await card.getByLabel(labels[2], { exact: true }).fill('1.4')
  const selectedVersion = await card.getByLabel('资产版本', { exact: true }).inputValue()
  await card.getByRole('button', { name: '保存配置', exact: true }).click()

  await page.reload()
  card = await openConfiguration(page, '指标准出门禁')
  await chooseTasteRecall(card)
  await card.getByLabel('资产版本', { exact: true }).selectOption(selectedVersion)
  await expect(card.getByLabel(labels[0], { exact: true })).toHaveValue('1.2')
  await expect(card.getByLabel(labels[1], { exact: true })).toHaveValue('1.6')
  await expect(card.getByLabel(labels[2], { exact: true })).toHaveValue('1.4')

  const alternativeVersion = await card.getByLabel('资产版本', { exact: true }).locator('option').evaluateAll((options, selected) => options.map(option => (option as HTMLOptionElement).value).find(value => value !== selected), selectedVersion)
  expect(alternativeVersion).not.toBeUndefined()
  await card.getByLabel('资产版本', { exact: true }).selectOption(alternativeVersion!)
  for (const label of labels) await expect(card.getByLabel(label, { exact: true })).toHaveValue('')
  await card.getByLabel('资产版本', { exact: true }).selectOption(selectedVersion)
  await expect(card.getByLabel(labels[0], { exact: true })).toHaveValue('1.2')

  const alternativeAttribution = await card.getByLabel('归因', { exact: true }).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).find(value => value && value !== 'ALL' && value !== 'taste-recall'))
  expect(alternativeAttribution).toBeTruthy()
  await card.getByLabel('归因', { exact: true }).selectOption(alternativeAttribution!)
  for (const label of labels) await expect(card.getByLabel(label, { exact: true })).toHaveValue('')
  await card.getByLabel('归因', { exact: true }).selectOption('taste-recall')
  await expect(card.getByLabel(labels[0], { exact: true })).toHaveValue('1.2')
})

test('分流可同时选择策略与 Agent，品味聚类默认 100 条且其他资产不继承', async ({ page }) => {
  await page.goto('/rules')
  let routing = await openConfiguration(page, '分流规则')
  await chooseTasteRecall(routing)
  await routing.getByRole('checkbox', { name: '策略迭代', exact: true }).check()
  await routing.getByRole('checkbox', { name: 'Agent 迭代', exact: true }).check()
  await routing.getByRole('button', { name: '保存配置', exact: true }).click()
  await page.reload()
  routing = await openConfiguration(page, '分流规则')
  await chooseTasteRecall(routing)
  await expect(routing.getByRole('checkbox', { name: '策略迭代', exact: true })).toBeChecked()
  await expect(routing.getByRole('checkbox', { name: 'Agent 迭代', exact: true })).toBeChecked()

  const clustering = await openConfiguration(page, '聚类规则')
  await chooseTasteRecall(clustering)
  await expect(clustering.getByLabel('最少相关 Case 数', { exact: true })).toHaveValue('100')
  await clustering.getByLabel('最少相关 Case 数', { exact: true }).fill('120')
  await clustering.getByRole('button', { name: '保存配置', exact: true }).click()
  await clustering.getByLabel('资产类型', { exact: true }).selectOption('MEMORY')
  await clustering.getByLabel('具体资产', { exact: true }).selectOption('asset-catalog-memory')
  await clustering.getByLabel('归因', { exact: true }).selectOption('memory-recall')
  await expect(clustering.getByLabel('最少相关 Case 数', { exact: true })).toHaveValue('')
  await expect(clustering.getByText('待配置', { exact: true }).first()).toBeVisible()
  await chooseTasteRecall(clustering)
  await expect(clustering.getByLabel('最少相关 Case 数', { exact: true })).toHaveValue('120')
})
