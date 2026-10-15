const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { sanitizeSummary } = require('./summary')
const { validate } = require('./validate-public-reporting')
const root = path.resolve(__dirname, '../..')
const canary = 'SYNTHETIC_SECRET_DO_NOT_PUBLISH_7251'

function files(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = path.join(directory, entry.name)
		return entry.isDirectory() ? files(file) : [file]
	})
}

test('repository reporting policy', () => assert.deepEqual(validate(), []))

test('safe summary drops unapproved fields and rejects malformed identifiers', () => {
	const input = { schemaVersion: 1, status: 'passed', counts: { passed: 1, failed: 0, flaky: 0, skipped: 0 }, tests: [{ id: '0123456789abcdef', status: 'passed', durationMs: 2, retries: 0, error: canary }], cookie: canary }
	assert.ok(!JSON.stringify(sanitizeSummary(input)).includes(canary))
	input.tests[0].id = canary
	assert.throws(() => sanitizeSummary(input))
})

test('real runner blocks recording before hooks or browser fixtures run', { timeout: 120000 }, () => {
	const directory = fs.mkdtempSync(path.join(root, '.security-fixture-'))
	try {
		const cases = [
			...['trace', 'video', 'screenshot'].flatMap(key => [
				{ name: `config-${key}`, use: { [key]: 'on' } },
				{ name: `project-${key}`, projectUse: { [key]: 'on' } },
				{ name: `test-use-${key}`, setup: `test.use({ ${key}: 'on' })` },
				{ name: `test-extend-${key}`, setup: `test = test.extend({ ${key}: ['on', { option: true, scope: 'worker' }] })` },
			]),
			{ name: 'computed-option', setup: `test.use({ ['tr' + 'ace']: 'on' })` },
			{ name: 'derived-test', setup: `test = test.extend({}); test.use({ trace: 'on' })` },
			{ name: 'merged-test', setup: `test = require('@playwright/test').mergeTests(test.extend({})); test.use({ trace: 'on' })` },
			{ name: 'esm-test', esm: true, setup: `test.use({ trace: 'on' })` },
			{ name: 'worker-only-override', setup: `if (process.env.TEST_WORKER_INDEX !== undefined) test.use({ trace: 'on' })` },
		]
		for (const item of cases) {
			const fixture = path.join(directory, item.name)
			fs.mkdirSync(fixture)
			const marker = path.join(fixture, 'hook-ran')
			const config = path.join(fixture, 'config.cjs')
			fs.writeFileSync(config, `module.exports = {
 testDir: __dirname, workers: 1, retries: 0, outputDir: ${JSON.stringify(path.join(fixture, 'results'))},
 reporter: [[${JSON.stringify(path.join(root, 'reporters/security/public-summary-reporter.cjs'))}]],
 use: ${JSON.stringify({ trace: 'off', video: 'off', screenshot: 'off', headless: true, ...item.use })},
 projects: [{ name: 'probe', use: ${JSON.stringify(item.projectUse || {})} }]
}`)
			fs.writeFileSync(path.join(fixture, `probe.spec.${item.esm ? 'mjs' : 'cjs'}`), `
${item.esm ? "import { test } from '@playwright/test'; import fs from 'node:fs'" : "let { test } = require('@playwright/test'); const fs = require('node:fs')"}
${item.setup || ''}
test.beforeAll(() => fs.writeFileSync(${JSON.stringify(marker)}, 'ran'))
test('must not execute', async ({ page }) => { await page.setContent('<p>synthetic</p>') })
`)
			const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config], {
				cwd: root, encoding: 'utf8', timeout: 15000,
				env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true' },
			})
			assert.equal(result.status, 1, item.name + result.stdout + result.stderr)
			assert.equal(fs.existsSync(marker), false, `${item.name}: hook executed`)
			assert.ok(!files(fixture).some(file => /\.(zip|webm|png|har)$/.test(file)), `${item.name}: recording created`)
		}
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('passing, failing and retrying browser tests never publish canaries', { timeout: 120000 }, () => {
	const directory = fs.mkdtempSync(path.join(root, '.security-fixture-'))
	try {
		const config = path.join(directory, 'playwright.config.cjs')
		const summary = path.join(directory, 'summary.json')
		const health = path.join(directory, 'health.json')
		fs.writeFileSync(config, `module.exports = {
 testDir: __dirname, testMatch: 'canary.spec.cjs', retries: 1, workers: 1,
 outputDir: ${JSON.stringify(path.join(directory, 'results'))},
 reporter: [[${JSON.stringify(path.join(root, 'reporters/security/public-summary-reporter.cjs'))}], [${JSON.stringify(path.join(root, 'reporters/health/pw-health-json-reporter.ts'))}]],
 use: { trace: 'off', video: 'off', screenshot: 'off', headless: true }
}`)
		fs.writeFileSync(path.join(directory, 'canary.spec.cjs'), `
const { test: base, expect } = require('@playwright/test')
const test = base.extend({ trace: ['off', { option: true, scope: 'worker' }] })
test.use({ screenshot: 'off', video: 'off' })
const secret = ${JSON.stringify(canary)}
console.log(secret) // test discovery output
for (const mode of ['pass', 'fail', 'retry']) test(mode + secret, async ({ page, context }, info) => {
 await context.addCookies([{ name: 'qa_wf_captcha_bypass', value: secret, domain: 'fixture.invalid', path: '/' }])
 await context.setExtraHTTPHeaders({ Authorization: secret })
 await page.route('https://fixture.invalid/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<input type="password"><p>' + secret + '</p>' }))
 await page.goto('https://fixture.invalid/')
 await page.locator('input').fill(secret)
 console.log(secret); console.error(secret)
 await info.attach(secret, { body: Buffer.from(secret), contentType: 'text/plain' })
 if (mode === 'fail' || (mode === 'retry' && info.retry === 0)) expect(secret).toBe('intentionally incorrect')
})
`)
		const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config], {
			cwd: root, encoding: 'utf8', timeout: 110000,
			env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', PUBLIC_SUMMARY_FILE: summary, HEALTH_RESULT_FILE: health },
		})
		assert.equal(result.status, 1, result.stdout + result.stderr)
		assert.ok(!`${result.stdout}${result.stderr}`.includes(canary))
		const output = JSON.parse(fs.readFileSync(summary, 'utf8'))
		assert.deepEqual(output.counts, { passed: 1, failed: 1, flaky: 1, skipped: 0 }, result.stdout + result.stderr)
		assert.equal(output.status, 'failed')
		const healthResult = JSON.parse(fs.readFileSync(health, 'utf8'))
		assert.deepEqual(healthResult.counts, { passed: 2, failed: 1, skipped: 0 })
		assert.equal(healthResult.reportUrl, null)
		assert.ok(!fs.readFileSync(health, 'utf8').includes(canary))
		assert.ok(!fs.readFileSync(summary, 'utf8').includes(canary))
		assert.ok(!files(path.join(directory, 'results')).some(file => /\.(zip|webm|png|har)$/.test(file)))
		// Verify success still exits zero.
		const success = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config, '--grep', 'passSYNTHETIC_SECRET'], {
			cwd: root, encoding: 'utf8', timeout: 30000,
			env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true' },
		})
		assert.equal(success.status, 0, success.stdout + success.stderr)
		assert.ok(!`${success.stdout}${success.stderr}`.includes(canary))
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('configuration failures and reporting overrides cannot leak raw errors', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-config-failure-'))
	try {
		const config = path.join(directory, 'bad.config.cjs')
		fs.writeFileSync(config, `console.error('${canary}'); throw new Error('${canary}')`)
		for (const args of [['--config', config], ['--reporter=html'], ['--trace=on'], ['--ui']]) {
			const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', ...args], { cwd: root, encoding: 'utf8' })
			assert.equal(result.status, 1)
			assert.ok(!`${result.stdout}${result.stderr}`.includes(canary))
		}
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('runner, health and Slack agree on skipped, empty, passing and flaky runs', { timeout: 60000 }, () => {
	const directory = fs.mkdtempSync(path.join(root, '.security-fixture-'))
	try {
		for (const mode of ['skipped', 'empty', 'passed', 'flaky']) {
			const fixture = path.join(directory, mode)
			fs.mkdirSync(fixture)
			const health = path.join(fixture, 'health.json')
			const slack = path.join(fixture, 'slack.json')
			const config = path.join(fixture, 'config.cjs')
			fs.writeFileSync(config, `
global.fetch = async (_url, options) => { require('fs').writeFileSync(${JSON.stringify(slack)}, options.body); return { ok: true } }
module.exports = {
 testDir: __dirname, workers: 1, retries: 1, outputDir: ${JSON.stringify(path.join(fixture, 'results'))},
 reporter: ${JSON.stringify(['reporters/slack/pw-slack-webhook-reporter.ts', 'reporters/health/pw-health-json-reporter.ts', 'reporters/security/public-summary-reporter.cjs'].map(file => [path.join(root, file)]))},
 use: { trace: 'off', video: 'off', screenshot: 'off' }
}`)
			if (mode !== 'empty') fs.writeFileSync(path.join(fixture, 'probe.spec.cjs'), `
const { test, expect } = require('@playwright/test')
test.skip('skipped', async () => {})
${mode === 'skipped' ? '' : `test('executed', async ({}, info) => expect(${JSON.stringify(mode)} !== 'flaky' || info.retry > 0).toBe(true))`}
`)
			const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config], {
				cwd: root, encoding: 'utf8', timeout: 15000,
				env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', HEALTH_RESULT_FILE: health, SLACK_WEBHOOK_URL: 'https://notification.invalid/' },
			})
			const failed = mode === 'skipped' || mode === 'empty'
			assert.equal(result.status, failed ? 1 : 0, mode + result.stdout + result.stderr)
			const summary = JSON.parse(result.stdout)
			assert.equal(summary.status, failed ? 'failed' : 'passed', mode)
			const healthResult = JSON.parse(fs.readFileSync(health, 'utf8'))
			assert.equal(healthResult.status, summary.status, mode)
			const notification = fs.readFileSync(slack, 'utf8')
			assert.ok(notification.includes(failed ? ':red_circle: Failed' : mode === 'flaky' ? ':large_yellow_circle: Flaky' : ':large_green_circle: Passed'), mode)
			assert.equal(summary.counts.skipped, mode === 'empty' ? 0 : 1)
			assert.equal(summary.counts.flaky, mode === 'flaky' ? 1 : 0)
			assert.equal(healthResult.counts.passed, failed ? 0 : 1)
		}
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('policy detects unsafe artifact uploads and reporter overrides', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-policy-'))
	try {
		fs.cpSync(path.join(root, 'configs'), path.join(directory, 'configs'), { recursive: true })
		fs.mkdirSync(path.join(directory, '.github/workflows'), { recursive: true })
		for (const file of ['playwright.config.ts', 'utils_playwright.config.ts', 'local.config.ts', 'package.json']) fs.copyFileSync(path.join(root, file), path.join(directory, file))
		fs.writeFileSync(path.join(directory, '.github/workflows/unsafe.yml'), `jobs:
  test:
    steps:
      - run: npx playwright test --trace=on
      - uses: actions/upload-artifact@v4
        with:
          path: |
            playwright-report/
            test-results/
`)
		assert.ok(validate(directory).some(message => message.includes('raw browser artifact')))
		assert.ok(validate(directory).some(message => message.includes('bypasses safe runner')))
		const config = path.join(directory, 'configs/liveandconcierge.config.ts')
		fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace("trace: 'off'", "trace: 'retain-on-failure'"))
		assert.ok(validate(directory).some(message => message.includes('trace must be off')))
		fs.mkdirSync(path.join(directory, 'tests'))
		fs.writeFileSync(path.join(directory, 'tests/override.spec.ts'), `import { test } from '@playwright/test'; test.use({ trace: 'on' })`)
		assert.ok(validate(directory).some(message => message.includes('trace override must be off')))
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('Slack notifications contain safe identifiers and flag setup failures', async () => {
	const vm = require('node:vm')
	const ts = require('typescript')
	const file = path.join(root, 'reporters/slack/pw-slack-webhook-reporter.ts')
	const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
	const messages = []
	const context = {
		exports: {}, require: require('node:module').createRequire(file),
		process: { env: { SLACK_WEBHOOK_URL: 'https://notification.invalid/', ENV: 'synthetic', UNIQUE_RUN_ID: '123' } },
		console: { log() {} },
		fetch: async (_url, options) => { messages.push(JSON.parse(options.body)); return { ok: true } },
	}
	vm.runInNewContext(compiled, context)
	const reporter = new context.exports.default()
	reporter.onTestEnd({ id: canary, title: canary, parent: { title: canary }, outcome: () => 'unexpected' }, {})
	await reporter.onEnd({ status: 'failed' })
	const body = JSON.stringify(messages[0])
	assert.ok(!body.includes(canary))
	assert.ok(!body.includes('amazonaws') && !body.includes('Test Report'))
	assert.ok(body.includes('Failed'))
	const setupFailure = new context.exports.default()
	await setupFailure.onEnd({ status: 'failed' })
	assert.ok(JSON.stringify(messages[1]).includes('Failed'))
	for (const [outcomes, expected] of [
		[['skipped'], ':red_circle: Failed'],
		[['expected', 'skipped'], ':large_green_circle: Passed'],
		[['flaky', 'skipped'], ':large_yellow_circle: Flaky'],
	]) {
		const check = new context.exports.default()
		for (const [index, outcome] of outcomes.entries()) check.onTestEnd({ id: `synthetic-${index}`, outcome: () => outcome }, {})
		await check.onEnd({ status: 'passed' })
		assert.ok(JSON.stringify(messages.at(-1)).includes(expected), expected)
	}
})

test('every resolved config and project disables browser recording', () => {
	const vm = require('node:vm')
	const ts = require('typescript')
	const configs = [...fs.readdirSync(path.join(root, 'configs')).filter(f => f.endsWith('.config.ts')).map(f => `configs/${f}`), 'playwright.config.ts', 'local.config.ts', 'utils_playwright.config.ts']
	for (const relative of configs) {
		const file = path.join(root, relative)
		const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
		const nativeRequire = require('node:module').createRequire(file)
		const context = {
			exports: {}, URL, __dirname: path.dirname(file), process: { env: { CI: 'true' } },
			require: name => {
				if (name === 'dotenv') return { config() {} }
				if (name === 'find-config') return () => undefined
				if (name.includes('recaptcha-bypass')) return { buildStorageStateWithRecaptchaBypass: () => ({}), buildStorageStateWithListBypass: () => ({}) }
				return nativeRequire(name)
			},
		}
		vm.runInNewContext(compiled, context)
		const config = context.exports.default
		for (const project of config.projects || [{}]) {
			const use = { ...config.use, ...project.use }
			for (const key of ['trace', 'video', 'screenshot']) assert.equal(use[key], 'off', `${relative}: ${key}`)
		}
		for (const [reporter] of config.reporter) assert.match(reporter, /^\.\.?\/reporters\/(security\/public-summary-reporter\.cjs|health\/pw-health-json-reporter\.ts|slack\/pw-slack-webhook-reporter\.ts)$/)
	}
})

test('domain switch failures do not print response bodies in CI', () => {
	const child = spawnSync(process.execPath, ['-e', `
process.argv = ['node', 'scripts/set-qa-domain.js', 'ca'];
global.fetch = async () => ({ ok: false, status: 500, text: async () => '${canary}' });
require('./scripts/set-qa-domain.js');
`], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, CI: 'true', BASE_URL: 'https://fixture.invalid', QA_ENDPOINT: '/wp-json/seventen-qa/v1/', API_KEY: 'synthetic' } })
	assert.equal(child.status, 1)
	assert.ok(!`${child.stdout}${child.stderr}`.includes(canary))
	assert.match(child.stderr, /HTTP 500/)
})

test('admin notification aggregates only safe phase summaries', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-admin-summary-'))
	try {
		fs.mkdirSync(path.join(directory, 'public-results'))
		for (const phase of [1, 2]) fs.writeFileSync(path.join(directory, `public-results/admin-drop-${phase}.json`), JSON.stringify({
			schemaVersion: 1, status: 'passed', counts: { passed: 1, failed: 0, flaky: 0, skipped: 0 },
			tests: [{ id: '0123456789abcdef', status: 'passed', durationMs: 1, retries: 0 }], rawError: canary,
		}))
		const payloadFile = path.join(directory, 'notification.json')
		const result = spawnSync(process.execPath, ['-e', `
 global.fetch = async (_url, options) => { require('fs').writeFileSync(${JSON.stringify(payloadFile)}, options.body); return { ok: true } };
 require(${JSON.stringify(path.join(root, 'scripts/send-admin-drop-slack-report.js'))});
`], { cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, ADMIN_DROP_TEST_OUTCOME: 'success', SLACK_WEBHOOK_URL: 'https://notification.invalid/' } })
		assert.equal(result.status, 0, result.stderr)
		const payload = fs.readFileSync(payloadFile, 'utf8')
		assert.match(payload, /2 passed/)
		assert.match(payload, /2 phases/)
		assert.ok(!payload.includes(canary))
		assert.ok(!payload.includes('amazonaws'))
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
