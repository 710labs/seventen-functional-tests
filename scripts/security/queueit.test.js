const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { isQueuedTest, reportingOutcome, QUEUEIT_REASON } = require('./queueit-status')
const { runStatus } = require('./summary')
const root = path.resolve(__dirname, '../..')

test('queue annotations cannot conceal earlier failures or global errors', () => {
	const queued = { outcome: () => 'skipped', annotations: [{ type: 'queueit', description: QUEUEIT_REASON }], results: [{ status: 'skipped' }] }
	assert.equal(isQueuedTest(queued), true)
	queued.results.unshift({ status: 'failed' })
	assert.equal(isQueuedTest(queued), false)
	assert.equal(reportingOutcome(queued), 'unexpected')
	assert.equal(runStatus('failed', { passed: 1, failed: 0, queued: 1 }), 'failed')
	assert.equal(runStatus('timedout', { passed: 0, failed: 0, queued: 1 }), 'failed')
})

test('real browser detection, safe runner, health and Slack agree on QueueIt', { timeout: 120000 }, () => {
	const directory = fs.mkdtempSync(path.join(root, '.security-fixture-'))
	try {
		const config = path.join(directory, 'config.cjs')
		const health = path.join(directory, 'health.json')
		const slack = path.join(directory, 'slack.json')
		fs.writeFileSync(config, `
global.fetch = async (_url, options) => { require('fs').writeFileSync(${JSON.stringify(slack)}, options.body); return { ok: true } }
module.exports = {
 testDir: __dirname, workers: 1, retries: 0, outputDir: ${JSON.stringify(path.join(directory, 'results'))},
 reporter: ${JSON.stringify(['reporters/slack/pw-slack-webhook-reporter.ts', 'reporters/health/pw-health-json-reporter.ts', 'reporters/security/public-summary-reporter.cjs'].map(file => [path.join(root, file)]))},
 use: { trace: 'off', video: 'off', screenshot: 'off', headless: true }
}`)
		fs.writeFileSync(path.join(directory, 'queue.spec.ts'), `
import { test, expect } from '@playwright/test'
import { skipIfQueueIt, withQueueItDetection, isQueueItWaitingRoom } from ${JSON.stringify(path.join(root, 'support/queueit'))}
const room = (state: string) => '<head><meta id="queue-it_log"></head><body data-pageid="' + state + '"><main id="main">SYNTHETIC_PRIVATE_QUEUE_TOKEN</main></body>'
for (const state of ['before', 'queue']) test('room-' + state, async ({ page }) => {
 await page.setContent(room(state))
 await skipIfQueueIt(page)
 throw new Error('Must stop before storefront actions')
})
test('late-queue', async ({ page }, info) => withQueueItDetection(page, info, async () => {
 await page.setContent(room('queue'))
 await page.getByRole('button', { name: 'Register' }).click({ timeout: 100 })
}))
test('ordinary-timeout', async ({ page }, info) => withQueueItDetection(page, info, async () => {
 await page.setContent('<button disabled>Register</button>')
 await page.getByRole('button', { name: 'Register' }).click({ timeout: 100 })
}))
test('assertion-on-queue', async ({ page }, info) => withQueueItDetection(page, info, async () => {
 await page.setContent(room('queue'))
 expect(1).toBe(2)
}))
test('ordinary-storefront', async ({ page }) => {
 for (const html of [
  '<script src="https://static.queue-it.net/connector.js" type="text/plain"></script><p>Waiting room</p>',
  '<meta id="queue-it_log"><main id="main">Error</main>',
  '<body data-pageid="queue"><main id="main">Generic queue</main></body>',
  '<meta id="queue-it_log"><body data-pageid="queue"><main id="main" hidden>Hidden</main></body>',
  room('error'),
 ]) { await page.setContent(html); expect(await isQueueItWaitingRoom(page)).toBe(false) }
})
`)
		for (const [pattern, expected, queued] of [
			['room-|late-queue', 'queued', 3],
			['ordinary-storefront', 'passed', 0],
			['ordinary-timeout', 'failed', 0],
			['assertion-on-queue', 'failed', 0],
			['room-before|ordinary-timeout', 'failed', 1],
		]) {
			const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config, '--grep', pattern], {
				cwd: root, encoding: 'utf8', timeout: 25000,
				env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', HEALTH_RESULT_FILE: health, SLACK_WEBHOOK_URL: 'https://notification.invalid/' },
			})
			assert.equal(result.status, expected === 'failed' ? 1 : 0, pattern + result.stdout + result.stderr)
			const summary = JSON.parse(result.stdout)
			assert.equal(summary.status, expected, pattern)
			assert.equal(summary.counts.queued || 0, queued, pattern)
			assert.equal(JSON.parse(fs.readFileSync(health)).status, expected, pattern)
			const notification = fs.readFileSync(slack, 'utf8')
			assert.match(notification, expected === 'queued' ? /hourglass_flowing_sand.*QueueIt active/ : expected === 'failed' ? /red_circle.*Failed/ : /large_green_circle.*Passed/)
			assert.doesNotMatch(result.stdout + fs.readFileSync(health) + notification, /SYNTHETIC_PRIVATE_QUEUE_TOKEN/)
		}
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
