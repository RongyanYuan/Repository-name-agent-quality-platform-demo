import { promises as fs } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import LZString from 'lz-string'
import type { DatasetExecutionRun, EvolutionState } from '../src/evolution/domain'

const datasetDetail = (page: Page) => page.getByRole('dialog', { name: /^数据集详情 · / })
const runResults = (page: Page) => datasetDetail(page).getByRole('table', { name: '运行结果', exact: true })

/** Decode the repository envelope without mutating the user's browser state. */
async function stored(page: Page): Promise<EvolutionState> {
  const raw = await page.evaluate(() => localStorage.getItem('office-agent-evolution-governance:v1'))
  expect(raw).toBeTruthy()
  const snapshots = new Map<string, unknown>()
  const envelope = JSON.parse(raw!, (_key, value: unknown) => {
    if (!value || typeof value !== 'object') return value
    const record = value as Record<string, unknown>
    if (record.$officeAgentSnapshotCodec === 'office-agent-lz-utf16-v1') {
      const snapshot = JSON.parse(LZString.decompressFromUTF16(String(record.data))!)
      snapshots.set(String(record.id), snapshot)
      return snapshot
    }
    if (typeof record.$officeAgentSnapshotRef === 'string') return snapshots.get(record.$officeAgentSnapshotRef)
    return value
  })
  return envelope.state
}

async function createDataset(page: Page, name: string) {
  await page.goto('/datasets-evaluations?view=datasets&datasetCategory=PERSONAL&datasetTimeFrom=2026-01-01T00:00&datasetTimeTo=2027-12-31T23:59')
  await page.getByRole('button', { name: '创建自定义数据集', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建自定义数据集', exact: true })
  await dialog.getByLabel('数据集名称', { exact: true }).fill(name)
  await dialog.getByLabel('描述 / 用途', { exact: true }).fill('本地 Mock 验收：人工任务输入、执行、评测与历史回查')
  await dialog.getByRole('button', { name: '确认创建', exact: true }).click()
  await expect(datasetDetail(page)).toBeVisible()
  return new URL(page.url()).searchParams.get('datasetId')!
}

async function addQuery(page: Page, query: string, product = 'PPT', asset?: { id: string; versionId: string }) {
  await datasetDetail(page).getByRole('button', { name: '添加 Query', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '添加 Query', exact: true })
  await dialog.getByLabel(/^Query\s*内容$/).fill(query)
  await dialog.getByLabel('产物类型', { exact: true }).selectOption({ label: product })
  if (asset) {
    await dialog.getByLabel('Query 关联资产', { exact: true }).selectOption(asset.id)
    await dialog.getByLabel('Query 固定版本', { exact: true }).selectOption(asset.versionId)
  }
  await dialog.getByRole('button', { name: '保存 Query', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(datasetDetail(page).getByRole('table', { name: '人工 Query', exact: true })).toContainText(query)
}

async function runDataset(page: Page, datasetId: string, options: { evaluationOnly?: boolean; scenario?: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILURE'; pendingOnly?: boolean } = {}) {
  await datasetDetail(page).getByRole('button', { name: options.evaluationOnly ? '仅评测已有结果' : '跑结果 & 评测', exact: true }).click()
  const config = page.getByRole('dialog', { name: '运行配置', exact: true })
  await expect(config).toContainText('Mock')
  if (options.scenario) await config.getByLabel('Mock 运行情景', { exact: true }).selectOption(options.scenario)
  await config.getByLabel('运行范围', { exact: true }).selectOption(options.pendingOnly ? 'PENDING' : 'ALL')
  await config.getByRole('button', { name: '确认运行', exact: true }).click()
  await expect(config).toHaveCount(0)
  await expect.poll(async () => {
    const state = await stored(page)
    return state.datasetExecutionRuns?.filter(run => run.datasetId === datasetId).at(-1)?.status
  }, { timeout: 30000 }).toMatch(/^(COMPLETED|PARTIAL|FAILED)$/)
  const state = await stored(page)
  const run = state.datasetExecutionRuns!.filter(item => item.datasetId === datasetId).at(-1)!
  await expect(datasetDetail(page).getByLabel('运行批次', { exact: true })).toHaveValue(run.id)
  await expect(runResults(page)).toBeVisible()
  return run
}

function assertScores(run: DatasetExecutionRun) {
  const completed = run.items.filter(item => item.status === 'COMPLETED')
  expect(completed.length).toBeGreaterThan(0)
  for (const item of completed) {
    expect(item.traceId).toMatch(/^\d{18,24}$/)
    expect(item.sessionId).toMatch(/^\d{18,24}$/)
    expect(item.resultSnapshot).toBeDefined()
    expect(item.processFinal).toBeGreaterThanOrEqual(0)
    expect(item.processFinal).toBeLessThanOrEqual(2)
    expect(item.outcomeFinal).toBeGreaterThanOrEqual(0)
    expect(item.outcomeFinal).toBeLessThanOrEqual(2)
    expect(item.resultSnapshot!.moduleScores.map(score => score.moduleCode).sort()).toEqual(['ACT', 'MEMORY', 'REASON', 'SKILL'])
    expect(item.resultSnapshot!.evidence.length).toBeGreaterThanOrEqual(4)
    expect(item.resultSnapshot!.outcomeEvals.length).toBeGreaterThan(1)
  }
}

test('人工 Query 保存、跨刷新、生成评测、交付物与 Case 返回上下文完整闭环', async ({ page }, testInfo) => {
  const datasetId = await createDataset(page, '人工 Query 全链路验收集')
  await addQuery(page, '生成面向管理层的季度经营分析 PPT，突出增长与行动计划')
  await addQuery(page, '生成区域销售分析 Excel，包含汇总表与趋势图', 'Excel')
  await expect(datasetDetail(page).getByRole('table', { name: '人工 Query', exact: true })).toContainText('待运行')
  await page.reload()
  await expect(datasetDetail(page).getByRole('table', { name: '人工 Query', exact: true })).toContainText('季度经营分析 PPT')
  const before = await stored(page)
  const run = await runDataset(page, datasetId)
  assertScores(run)
  expect(run.items).toHaveLength(2)
  const after = await stored(page)
  expect(after.cases.length).toBe(before.cases.length + 2)
  expect(after.traces.length).toBe(before.traces.length + 2)
  expect(after.gateDecisions).toEqual(before.gateDecisions)
  expect(after.datasets.find(dataset => dataset.id === datasetId)?.caseIds).toEqual([])

  const downloadPromise = page.waitForEvent('download')
  await runResults(page).getByRole('link', { name: /下载产物/ }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.html$/)
  const report = await fs.readFile((await download.path())!, 'utf8')
  expect(report).toContain('Mock')
  expect(report).toContain('季度经营分析 PPT')
  const datasetURL = page.url()
  await runResults(page).getByRole('button', { name: '查看 Case / Trace', exact: true }).first().click()
  await expect(page).toHaveURL(url => url.pathname === '/cases' && Boolean(url.searchParams.get('traceId')) && Boolean(url.searchParams.get('returnTo')))
  const returnTo = new URL(page.url()).searchParams.get('returnTo')!
  expect(returnTo).toBe(new URL(datasetURL).pathname + new URL(datasetURL).search)
  const caseDetail = page.getByRole('dialog', { name: /Case 详情/ })
  await expect(caseDetail).toContainText('Mock')
  await expect(caseDetail.getByRole('heading', { name: 'Trace 模块评测矩阵', exact: true })).toBeVisible()
  await caseDetail.getByRole('button', { name: '查看 skill Evidence', exact: true }).click()
  const evidence = page.getByRole('dialog', { name: /skill Evidence/ })
  await expect(evidence).toContainText(run.configSnapshot.rubricVersion)
  await expect(evidence).toContainText('Mock')
  await evidence.getByRole('button', { name: 'Close panel', exact: true }).click()
  await caseDetail.getByRole('tab', { name: '产物评测', exact: true }).click()
  await expect(caseDetail.getByRole('heading', { name: '产物细项评分', exact: true })).toBeVisible()
  await expect(caseDetail.getByRole('table')).toContainText('最终评分')
  await expect(caseDetail.getByRole('table')).toContainText('管理层风格匹配')
  await page.getByRole('button', { name: '返回来源页面', exact: true }).click()
  await expect(page).toHaveURL(datasetURL)
  await expect(datasetDetail(page).getByLabel('运行批次', { exact: true })).toHaveValue(run.id)
  await page.reload()
  await expect(runResults(page)).toContainText('季度经营分析 PPT')
  await runResults(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('dataset-query-completed.png'), fullPage: true })
})

test('重复生成追加批次、保留历史，仅评测复用已生成 Trace 与产物', async ({ page }) => {
  const datasetId = await createDataset(page, '独立批次与重新评测验收集')
  await addQuery(page, '生成项目风险管理 Word 报告，列出责任人与截止日期', 'Word')
  const first = await runDataset(page, datasetId)
  const firstSnapshot = JSON.stringify(first)
  const second = await runDataset(page, datasetId)
  expect(second.id).not.toBe(first.id)
  expect(second.items[0].traceId).not.toBe(first.items[0].traceId)
  const beforeEval = await stored(page)
  const evaluation = await runDataset(page, datasetId, { evaluationOnly: true })
  expect(evaluation.mode).toBe('EVALUATE_ONLY')
  expect(evaluation.items[0].traceId).toBe(second.items[0].traceId)
  expect(evaluation.items[0].artifactIds).toEqual(second.items[0].artifactIds)
  const afterEval = await stored(page)
  expect(afterEval.traces.length).toBe(beforeEval.traces.length)
  expect(afterEval.cases.length).toBe(beforeEval.cases.length)
  expect(afterEval.sessions.length).toBe(beforeEval.sessions.length)
  expect(afterEval.artifacts.length).toBe(beforeEval.artifacts.length)
  expect(JSON.stringify(afterEval.datasetExecutionRuns!.find(run => run.id === first.id))).toBe(firstSnapshot)
  expect(afterEval.moduleReviews).toEqual(beforeEval.moduleReviews)
  await datasetDetail(page).getByLabel('运行批次', { exact: true }).selectOption(first.id)
  await expect(runResults(page)).toContainText(first.items[0].traceId!)
  await expect(runResults(page)).not.toContainText(second.items[0].traceId!)
  await page.reload()
  await expect(datasetDetail(page).getByLabel('运行批次', { exact: true })).toHaveValue(first.id)
})

test('部分失败保留成功结果与原因，全失败可复查且旧结果不变', async ({ page }) => {
  const datasetId = await createDataset(page, '失败路径验收集')
  await addQuery(page, '生成简洁的客户沟通 PPT')
  await addQuery(page, '生成品牌发布会主视觉图片', '生图')
  const partial = await runDataset(page, datasetId, { scenario: 'PARTIAL_FAILURE' })
  expect(partial.status).toBe('PARTIAL')
  const successes = partial.items.filter(item => item.status === 'COMPLETED')
  const failures = partial.items.filter(item => item.status === 'FAILED')
  expect(successes).toHaveLength(1)
  expect(failures).toHaveLength(1)
  expect(failures[0].errorReason).toBeTruthy()
  await expect(runResults(page)).toContainText(failures[0].errorReason!)
  await expect(runResults(page).getByRole('button', { name: '查看 Case / Trace', exact: true })).toHaveCount(1)
  const partialSnapshot = JSON.stringify(partial)
  const failure = await runDataset(page, datasetId, { scenario: 'FAILURE' })
  expect(failure.status).toBe('FAILED')
  expect(failure.items.every(item => item.status === 'FAILED' && item.errorReason)).toBe(true)
  expect(JSON.stringify((await stored(page)).datasetExecutionRuns!.find(run => run.id === partial.id))).toBe(partialSnapshot)
  await datasetDetail(page).getByLabel('运行批次', { exact: true }).selectOption(partial.id)
  await expect(runResults(page)).toContainText(successes[0].traceId!)
})

test('冻结准出/黄金预设均可运行，外部统计不伪造输入；仅评测不重复生成', async ({ page }) => {
  await page.goto('/datasets-evaluations?view=datasets&datasetId=dataset-generalization&datasetCategory=GATE')
  const detail = datasetDetail(page)
  await expect(detail).toContainText('已冻结')
  await expect(detail.getByRole('button', { name: '添加 Query', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: '添加已有 Trace', exact: true })).toHaveCount(0)
  const before = await stored(page)
  const sourceDataset = before.datasets.find(dataset => dataset.id === 'dataset-generalization')!
  expect(sourceDataset.population.externalSampleCount).toBeGreaterThan(0)
  const first = await runDataset(page, sourceDataset.id)
  assertScores(first)
  expect(first.items.length).toBeLessThan(sourceDataset.sampleCount)
  const generated = await stored(page)
  expect(generated.datasets.find(dataset => dataset.id === sourceDataset.id)).toEqual(sourceDataset)
  expect(first.configSnapshot.inputs.every(input => Boolean(input.sourceTraceId))).toBe(true)
  const evaluation = await runDataset(page, sourceDataset.id, { evaluationOnly: true })
  expect(evaluation.mode).toBe('EVALUATE_ONLY')
  const evaluated = await stored(page)
  expect(evaluated.traces.length).toBe(generated.traces.length)
  expect(evaluated.artifacts.length).toBe(generated.artifacts.length)
  expect(evaluation.items.every(item => !item.traceId || item.traceId === item.input.sourceTraceId)).toBe(true)

  await page.goto('/datasets-evaluations?view=datasets&datasetCategory=GOLDEN')
  const goldenRow = page.getByRole('table', { name: '数据集与评测列表', exact: true }).getByRole('row').filter({ hasText: 'dataset-golden-test-set-a' })
  await expect(goldenRow.getByRole('button', { name: '跑结果 & 评测', exact: true })).toBeEnabled()
  await goldenRow.getByRole('button', { name: '跑结果 & 评测', exact: true }).click()
  const config = page.getByRole('dialog', { name: '运行配置', exact: true })
  await config.getByLabel('运行范围', { exact: true }).selectOption('ALL')
  await config.getByRole('button', { name: '确认运行', exact: true }).click()
  await expect.poll(async () => (await stored(page)).datasetExecutionRuns?.filter(run => run.datasetId === 'dataset-golden-test-set-a').at(-1)?.status, { timeout: 30000 }).toMatch(/^(COMPLETED|PARTIAL)$/)
  await expect(runResults(page)).toBeVisible()
})

test('固定资产版本随 Query 留存，待运行范围只执行新增输入且不扩大历史批次', async ({ page }) => {
  const datasetId = await createDataset(page, '固定版本与增量运行验收集')
  const state = await stored(page)
  const asset = state.assetCatalog!.find(item => item.id === 'asset-catalog-skill-ppt-builder')!
  const version = state.assetVersions!.find(item => item.assetId === asset.id && item.version === '2.5.0')!
  await addQuery(page, '用固定源版本生成团队周报 PPT', 'PPT', { id: asset.id, versionId: version.id })
  const first = await runDataset(page, datasetId, { pendingOnly: true })
  expect(first.configSnapshot.inputs[0].assetId).toBe(asset.id)
  expect(first.configSnapshot.inputs[0].assetVersionId).toBe(version.id)
  const snapshot = JSON.stringify(first)
  await datasetDetail(page).getByRole('button', { name: '跑结果 & 评测', exact: true }).click()
  const config = page.getByRole('dialog', { name: '运行配置', exact: true })
  await expect(config.getByLabel('运行范围', { exact: true })).toHaveValue('PENDING')
  await expect(config.getByRole('button', { name: '确认运行', exact: true })).toBeDisabled()
  await expect(config).toContainText('没有待运行或未评测样本')
  await config.getByRole('button', { name: '取消', exact: true }).click()
  await addQuery(page, '生成新增财务分析 Excel', 'Excel')
  const next = await runDataset(page, datasetId, { pendingOnly: true })
  expect(next.items).toHaveLength(1)
  expect(next.items[0].input.query).toBe('生成新增财务分析 Excel')
  expect(JSON.stringify((await stored(page)).datasetExecutionRuns!.find(run => run.id === first.id))).toBe(snapshot)
  await page.reload()
  const drafts = datasetDetail(page).getByRole('table', { name: '人工 Query', exact: true })
  await expect(drafts).toContainText('2.5.0')
  await expect(drafts).toContainText('团队周报 PPT')
  await expect(drafts).toContainText('财务分析 Excel')
})
