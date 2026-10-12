import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'Asia/Shanghai' })

test.describe('Skill 版本数据集评测工作台', () => {
  test('工作台只有本地分类、具体 Skill、版本和归因选择链', async ({ page }) => {
    await page.goto('/datasets-evaluations')
    await expect(page.getByLabel('Skill 分类', { exact: true })).toHaveCount(1)
    await expect(page.getByLabel('Skill 分类', { exact: true })).toBeVisible()
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveCount(1)
    await expect(page.getByLabel('具体 Skill', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Skill 版本', { exact: true })).toBeVisible()
    await expect(page.getByLabel('归因', { exact: true })).toBeVisible()
    await expect(page.getByLabel('全局 Skill', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '数据集与评测', level: 1, exact: true })).toHaveCount(1)
  })

  test('工作台隐藏顶部 Skill 而其他页面仍保留全局 Skill 选择器', async ({ page }) => {
    for (const route of ['/overview', '/cases', '/rules']) {
      await page.goto(route)
      await expect(page.getByLabel('全局 Skill', { exact: true })).toHaveCount(1)
      await expect(page.getByLabel('全局 Skill', { exact: true })).toBeVisible()
      await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveCount(0)
    }
    await page.goto('/datasets-evaluations')
    await expect(page.getByLabel('全局 Skill', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveCount(1)
  })

  test('页面只有一个标题，数据集和归因历史是仅有的工作台视图', async ({ page }) => {
    await page.goto('/datasets-evaluations')
    await expect(page.getByRole('heading', { name: '数据集与评测', level: 1, exact: true })).toHaveCount(1)
    await expect(page.getByRole('tab')).toHaveCount(2)
    await expect(page.getByRole('tab', { name: /^数据集/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^归因历史/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Trace/ })).toHaveCount(0)
  })

  test('本地 Skill 分类链默认最新固定版本且归因仅显示当前版本活动项', async ({ page }) => {
    await page.goto('/datasets-evaluations')

    const category = page.getByLabel('Skill 分类', { exact: true })
    const skills = page.getByLabel('具体 Skill', { exact: true })
    await category.selectOption('PRODUCTION_SKILL')
    await skills.selectOption('skill-ppt-builder')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.6.0')

    const versions = page.getByLabel('Skill 版本', { exact: true }).locator('option')
    await expect(versions).toHaveText(['全部版本', '2.6.0 · 已发布', '2.6.0-rc.1 · 候选版本', '2.5.0 · 历史版本'])

    const attributionOptions = page.getByLabel('归因', { exact: true }).locator('option')
    expect(await attributionOptions.evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual(['', 'skill-capability', 'skill-description', 'skill-file', 'skill-sop'])
    await expect(attributionOptions.filter({ hasText: '品味库召回错误' })).toHaveCount(0)

    await category.selectOption('TASTE_SKILL')
    await skills.selectOption('skill-taste-executive')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('1.0.0-rc.1')
    await expect(page.getByLabel('归因', { exact: true }).locator('option')).toHaveText([
      '全部进行中归因',
      '品味库资产不足 · 待实验',
      '品味库召回错误 · 待实验'
    ])
  })

  test('用户原始 SOP 链接可直接选择分类、具体 Skill、固定版本和全部版本', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=datasets&governanceObject=Skill&attribution=skill-sop')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('')
    await page.getByLabel('Skill 分类', { exact: true }).selectOption('PRODUCTION_SKILL')
    await page.getByLabel('具体 Skill', { exact: true }).selectOption('skill-ppt-builder')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toBeEnabled()
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.6.0')
    await page.getByLabel('归因', { exact: true }).selectOption('skill-sop')
    await expect(page.getByRole('table', { name: '数据集与评测列表' })).toContainText('dataset-workspace-ppt-260-sop-attribution')
    await page.getByLabel('Skill 版本', { exact: true }).selectOption('2.6.0-rc.1')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('')
    await page.getByLabel('归因', { exact: true }).selectOption('skill-sop')
    await expect(page.getByRole('table', { name: '数据集与评测列表' })).toContainText('dataset-workspace-ppt-260rc-sop-attribution')
    await expect(page.getByRole('table', { name: '数据集与评测列表' })).not.toContainText('dataset-workspace-ppt-260-sop-attribution')
    await page.getByLabel('Skill 版本', { exact: true }).selectOption('all')
    await expect(page.getByLabel('Skill 版本', { exact: true }).locator('option[value="all"]')).toHaveCount(1)
    const datasets = page.getByRole('table', { name: '数据集与评测列表' })
    await expect(datasets).toContainText('dataset-workspace-ppt-260-sop-attribution')
    await expect(datasets).toContainText('dataset-workspace-ppt-260rc-sop-attribution')
    await expect(datasets).toContainText('dataset-attribution')
  })

  test('Skill 分类约束具体 Skill、数据集和历史，全部分类可恢复完整范围', async ({ page }) => {
    await page.goto('/datasets-evaluations')
    const category = page.getByLabel('Skill 分类', { exact: true })
    expect(await category.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual(['', 'GENERAL', 'PERSONAL_SKILL', 'PRODUCTION_SKILL', 'TASTE_SKILL', 'UNCLASSIFIED'])
    const skills = page.getByLabel('具体 Skill', { exact: true })
    await category.selectOption('PRODUCTION_SKILL')
    await expect(skills.locator('option[value="skill-ppt-builder"]')).toHaveCount(1)
    await expect(skills.locator('option[value="skill-taste-executive"]')).toHaveCount(0)
    const datasets = page.getByRole('table', { name: '数据集与评测列表' })
    await expect(datasets).toContainText('dataset-workspace-ppt-260-sop-attribution')
    await expect(datasets).not.toContainText('dataset-workspace-taste')
    await category.selectOption('TASTE_SKILL')
    await expect(skills.locator('option[value="skill-taste-executive"]')).toHaveCount(1)
    await expect(skills.locator('option[value="skill-ppt-builder"]')).toHaveCount(0)
    await expect(datasets).toContainText('dataset-workspace-taste-100rc-recall-attribution')
    await expect(datasets).not.toContainText('dataset-workspace-ppt')
    await page.getByRole('tab', { name: /^归因历史/ }).click()
    const history = page.getByRole('table', { name: '归因历史列表' })
    await expect(history).toContainText('skill-taste-executive@0.9.0#taste-recall')
    await expect(history).not.toContainText('skill-ppt-builder')
    for (const scope of [
      { category: 'PERSONAL_SKILL', skill: 'skill-personal-planned' },
      { category: 'GENERAL', skill: 'skill-general-docs' },
      { category: 'UNCLASSIFIED', skill: 'skill-unclassified' }
    ]) {
      await category.selectOption(scope.category)
      await expect(skills.locator(`option[value="${scope.skill}"]`)).toHaveCount(1)
      await expect(skills.locator('option[value="skill-ppt-builder"]')).toHaveCount(0)
      await expect(history).not.toContainText('skill-ppt-builder')
      await expect(history).not.toContainText('skill-taste-executive')
      if (scope.category === 'PERSONAL_SKILL') await expect(history).toContainText(scope.skill)
      else await expect(history).toContainText('当前对象尚无归因记录')
      await page.getByRole('tab', { name: /^数据集/ }).click()
      await expect(page.getByRole('table', { name: '数据集与评测列表' })).not.toContainText('dataset-workspace-ppt')
      await expect(page.getByRole('table', { name: '数据集与评测列表' })).not.toContainText('dataset-workspace-taste')
      await page.getByRole('tab', { name: /^归因历史/ }).click()
    }
    await category.selectOption('')
    await expect(skills.locator('option[value="skill-ppt-builder"]')).toHaveCount(1)
    await expect(skills.locator('option[value="skill-taste-executive"]')).toHaveCount(1)
    await expect(history).toContainText('skill-ppt-builder@2.6.0#skill-sop')
    await expect(history).toContainText('skill-taste-executive@1.0.0-rc.1#taste-recall')
  })

  test('清空具体 Skill 清除旧 skillId 和历史实验链接，刷新或切换视图均不会恢复', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=history&skillCategory=PRODUCTION_SKILL&skillId=skill-ppt-builder&skillVersion=2.5.0&attribution=skill-sop&historyItem=skill-ppt-builder%402.5.0%23skill-sop&experimentId=exp-single-ppt-routing')
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
    await page.getByLabel('具体 Skill', { exact: true }).selectOption('')
    const cleared = ['skill', 'skillId', 'skillVersion', 'attribution', 'evolutionItem', 'historyItem', 'experimentId', 'datasetId']
    await expect(page).toHaveURL(url => cleared.every(key => !url.searchParams.has(key)))
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toBeDisabled()
    await expect(page.getByRole('dialog', { name: /归因历史详情/ })).toHaveCount(0)
    await page.reload()
    await expect(page).toHaveURL(url => cleared.every(key => !url.searchParams.has(key)))
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('')
    await page.getByRole('tab', { name: /^数据集/ }).click()
    await page.getByRole('tab', { name: /^归因历史/ }).click()
    await expect(page).toHaveURL(url => cleared.every(key => !url.searchParams.has(key)))
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('')
  })

  test('分类和 Skill 切换清除不匹配版本、归因和详情且不自动恢复旧 Skill', async ({ page }) => {
    await page.goto('/datasets-evaluations?skillId=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=history&historyItem=skill-ppt-builder%402.6.0%23skill-sop')
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
    await page.getByLabel('Skill 分类', { exact: true }).selectOption('TASTE_SKILL')
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('')
    await expect(page.getByRole('dialog', { name: /归因历史详情/ })).toHaveCount(0)
    await expect(page).toHaveURL(url => !url.searchParams.has('skillId') && !url.searchParams.has('skill') && !url.searchParams.has('skillVersion') && !url.searchParams.has('attribution') && !url.searchParams.has('historyItem') && !url.searchParams.has('experimentId'))
    await page.getByLabel('具体 Skill', { exact: true }).selectOption('skill-taste-executive')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('1.0.0-rc.1')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('')
  })

  test('全部版本模式展示 Skill 级历史，并可进入数据集成员 Case 后恢复完整本地筛选', async ({ page }) => {
    await page.goto('/datasets-evaluations')
    await page.getByLabel('Skill 分类', { exact: true }).selectOption('PRODUCTION_SKILL')
    await page.getByLabel('具体 Skill', { exact: true }).selectOption('skill-ppt-builder')
    await page.getByLabel('Skill 版本', { exact: true }).selectOption('all')
    await page.getByLabel('归因', { exact: true }).selectOption('skill-sop')
    await expect(page.getByLabel('Skill 版本', { exact: true }).locator('option[value="all"]')).toHaveCount(1)
    await expect(page).toHaveURL(url => url.searchParams.get('skill') === 'skill-ppt-builder' && url.searchParams.get('skillVersion') === 'all')
    await page.getByRole('tab', { name: /^归因历史/ }).click()
    await expect(page.getByRole('table', { name: '归因历史列表' })).toContainText('skill-ppt-builder@2.5.0#skill-sop')
    await expect(page.getByRole('table', { name: '归因历史列表' })).toContainText('skill-ppt-builder@2.6.0#skill-sop')
    await page.getByRole('tab', { name: /^数据集/ }).click()
    await page.getByRole('row', { name: /dataset-workspace-ppt-260-sop-attribution/ }).click()
    await page.getByRole('dialog', { name: /数据集详情/ }).getByRole('button', { name: '查看 Case / Trace' }).first().click()
    await expect(page.getByRole('dialog', { name: /Case 详情/ })).toBeVisible()
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('all')
    await expect(page.getByLabel('Skill 分类', { exact: true })).toHaveValue('PRODUCTION_SKILL')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('skill-sop')
    await expect(page.getByRole('dialog', { name: /数据集详情/ })).toContainText('dataset-workspace-ppt-260-sop-attribution')
  })

  test('已完成归因仍在旧版本历史中但不会出现在进行中下拉', async ({ page }) => {
    await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.5.0&attribution=skill-sop&view=history')
    const attribution = page.getByLabel('归因', { exact: true })
    await expect(attribution.locator('option[value="skill-sop"]')).toHaveCount(0)
    await expect(page.getByText(/已完成归因（保留历史筛选）/)).toBeVisible()
    const history = page.getByRole('table', { name: '归因历史列表' })
    const completed = history.getByRole('row').filter({ hasText: 'skill-ppt-builder@2.5.0#skill-sop' })
    await expect(completed).toContainText('已准出')
    await completed.click()
    const detail = page.getByRole('dialog', { name: /归因历史详情/ })
    await expect(detail.getByRole('heading', { name: '完整历史时间线' })).toBeVisible()
    await expect(detail.getByRole('heading', { name: '单能力实验配置与结果' })).toBeVisible()
    await expect(detail).toContainText('准出决策')
    await expect(detail).toContainText('2.5.0')
  })

  test('切换版本或 Skill 清除旧归因并使用新 Skill 最新版本', async ({ page }) => {
    await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=datasets')
    await page.getByLabel('Skill 版本', { exact: true }).selectOption('2.6.0-rc.1')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('')
    await expect(page).toHaveURL(url => !url.searchParams.has('attribution') && !url.searchParams.has('datasetId'))
    await page.getByLabel('归因', { exact: true }).selectOption('skill-sop')
    await page.getByLabel('Skill 分类', { exact: true }).selectOption('TASTE_SKILL')
    await page.getByLabel('具体 Skill', { exact: true }).selectOption('skill-taste-executive')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('1.0.0-rc.1')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('')
    await expect(page.getByRole('region', { name: 'Skill 信息' })).toContainText('管理层品味库 Skill')
    const datasets = page.getByRole('table', { name: '数据集与评测列表' })
    await expect(datasets).toContainText('dataset-workspace-taste-100rc-recall-attribution')
    await expect(datasets).not.toContainText('dataset-workspace-ppt')
  })

  test('各 Skill 的所有固定版本历史均可查询且跨版本不会混合', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=history')
    const history = page.getByRole('table', { name: '归因历史列表' })
    const targets = [
      { skill: 'skill-ppt-builder', version: '2.6.0', key: 'skill-ppt-builder@2.6.0#skill-sop' },
      { skill: 'skill-ppt-builder', version: '2.6.0-rc.1', key: 'skill-ppt-builder@2.6.0-rc.1#skill-sop' },
      { skill: 'skill-ppt-builder', version: '2.5.0', key: 'skill-ppt-builder@2.5.0#skill-sop' },
      { skill: 'skill-taste-executive', version: '1.0.0-rc.1', key: 'skill-taste-executive@1.0.0-rc.1#taste-recall' },
      { skill: 'skill-taste-executive', version: '0.9.0', key: 'skill-taste-executive@0.9.0#taste-quality' }
    ]
    for (const target of targets) await expect(history).toContainText(target.key)
    for (const target of targets) {
      await page.getByLabel('Skill 分类', { exact: true }).selectOption(target.skill === 'skill-taste-executive' ? 'TASTE_SKILL' : 'PRODUCTION_SKILL')
      await page.getByLabel('具体 Skill', { exact: true }).selectOption(target.skill)
      await page.getByLabel('Skill 版本', { exact: true }).selectOption(target.version)
      await expect(history).toContainText(target.key)
      for (const other of targets.filter(other => other.key !== target.key)) {
        await expect(history).not.toContainText(other.key)
      }
    }
  })

  test('未选 Skill 时点击旧版本历史，往返 Case 后仍保留该固定版本', async ({ page }) => {
    await page.goto('/datasets-evaluations?view=history')
    const key = 'skill-ppt-builder@2.5.0#skill-sop'
    await page.getByRole('table', { name: '归因历史列表' }).getByRole('row').filter({ hasText: key }).click()
    const detail = page.getByRole('dialog', { name: /归因历史详情/ })
    await expect(detail).toContainText(key)
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.5.0')
    await detail.getByRole('button', { name: 'case-ppt-management', exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: /Case 详情/ })).toBeVisible()
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await expect(page.getByLabel('具体 Skill', { exact: true })).toHaveValue('skill-ppt-builder')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.5.0')
    await expect(page.getByRole('dialog', { name: /归因历史详情/ })).toContainText(key)
    await expect(page).toHaveURL(url => url.searchParams.get('historyItem') === key)
  })

  test('数据集详情展示完整成员列并可进入 Case 的 Trace 与 Eval', async ({ page }) => {
    await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=datasets')
    const row = page.getByRole('row', { name: /dataset-workspace-ppt-260-sop-attribution/ })
    await expect(row).toBeVisible()
    await row.click()

    const detail = page.getByRole('dialog', { name: /数据集详情/ })
    const samples = detail.getByRole('table', { name: '数据集样本 Trace' })
    await expect(samples.getByRole('columnheader', { name: 'Query', exact: true })).toBeVisible()
    await expect(samples.getByRole('columnheader', { name: 'Query 时间' })).toBeVisible()
    await expect(samples.getByRole('columnheader', { name: '来源' })).toBeVisible()
    await expect(samples.getByRole('columnheader', { name: '过程 / 产物（0–2）' })).toBeVisible()
    await expect(samples).toContainText('trace-workspace-ppt-260-sop-1')
    await expect(samples.locator('tbody tr')).toHaveCount(2)
    await expect(samples).toContainText('trace-workspace-ppt-260-sop-2')
    await expect(samples).not.toContainText('trace-workspace-ppt-260-sop-3')
    await expect(samples).not.toContainText('trace-tool-export')
    await expect(samples).toContainText('线上+时间窗口')
    await expect(samples).toContainText('过程 1.55 / 2')
    await expect(samples).toContainText('产物 0.70 / 2')
    await expect(samples.getByRole('row').filter({ hasText: 'trace-workspace-ppt-260-sop-1' })).toContainText('09/27 12:00')

    await samples.getByRole('button', { name: '查看 Case / Trace' }).first().click()
    const caseDetail = page.getByRole('dialog', { name: /Case 详情/ })
    await expect(caseDetail).toContainText('trace-workspace-ppt-260-sop-1')
    await caseDetail.getByRole('button', { name: '查看 Trace 执行' }).click()
    await expect(caseDetail.getByRole('tab', { name: 'Trace 与 Evidence' })).toHaveAttribute('aria-selected', 'true')
    await expect(caseDetail).toContainText('6 条 observations')
    await expect(caseDetail).toContainText('render → read → validate')
    await caseDetail.getByRole('button', { name: '查看 skill Evidence' }).click()
    const evidence = page.getByRole('dialog', { name: /skill Evidence/ })
    await expect(evidence).toContainText('rubric-office-v2.1#skill')
    await evidence.getByRole('button', { name: 'Close panel', exact: true }).click()
    await caseDetail.getByRole('tab', { name: '评测中心' }).click()
    await expect(caseDetail.getByRole('heading', { name: 'Trace 模块评测矩阵' })).toBeVisible()
    await expect(caseDetail).toContainText('LLM Judge Reason')
  })

  test('从数据集成员返回时恢复 Skill 版本、归因和数据集', async ({ page }) => {
    await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.6.0&attribution=skill-sop&view=datasets&datasetId=dataset-workspace-ppt-260-sop-attribution')
    const detail = page.getByRole('dialog', { name: /数据集详情/ })
    await detail.getByRole('button', { name: '查看 Case / Trace' }).first().click()
    await expect(page.getByRole('dialog', { name: /Case 详情/ })).toBeVisible()
    await page.getByRole('button', { name: '返回来源页面' }).click()

    await expect(page).toHaveURL(url => url.pathname === '/datasets-evaluations'
      && url.searchParams.get('skill') === 'skill-ppt-builder'
      && url.searchParams.get('skillVersion') === '2.6.0'
      && url.searchParams.get('attribution') === 'skill-sop'
      && url.searchParams.get('datasetId') === 'dataset-workspace-ppt-260-sop-attribution')
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.6.0')
    await expect(page.getByLabel('归因', { exact: true })).toHaveValue('skill-sop')
    await expect(page.getByRole('dialog', { name: /数据集详情/ })).toContainText('dataset-workspace-ppt-260-sop-attribution')
  })

  test('旧版本历史能反查来源任务并打开当次冻结准出报告', async ({ page }) => {
    await page.goto('/datasets-evaluations?skill=skill-ppt-builder&skillVersion=2.5.0&view=history&historyItem=skill-ppt-builder%402.5.0%23skill-sop&decisionId=gate-single-ppt-routing')
    const detail = page.getByRole('dialog', { name: /归因历史详情/ })
    await expect(detail).toContainText('case-ppt-management')
    await expect(detail).toContainText('process-eval-ppt-recall')
    await expect(detail).toContainText('outcome-eval-ppt-style')
    const report = detail.getByRole('region', { name: '冻结准出报告 gate-single-ppt-routing' })
    await expect(report).toBeVisible()
    await expect(report).toContainText('冻结配置')
    await expect(report.getByRole('table', { name: '冻结准出指标 gate-single-ppt-routing' })).toBeVisible()
    await expect(report).toContainText('冻结运行记录')
    await expect(detail.getByRole('heading', { name: '当前实验台账' })).toBeVisible()
    await detail.getByRole('button', { name: 'case-ppt-management', exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: /Case 详情/ })).toContainText('trace-ppt-generate')
    await page.getByRole('button', { name: '返回来源页面' }).click()
    await expect(page.getByLabel('Skill 版本', { exact: true })).toHaveValue('2.5.0')
    await expect(page.getByRole('region', { name: '冻结准出报告 gate-single-ppt-routing' })).toBeVisible()
  })
})
