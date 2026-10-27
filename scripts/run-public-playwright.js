#!/usr/bin/env node
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { sanitizeSummary } = require('./security/summary')
const { prepareSession, sessionVariable, errorCode } = require('./hosted-reports/session')

const args = process.argv.slice(2)
// Reporter overrides and interactive modes bypass the public output boundary.
if (args.some(arg => /^--(?:reporter|trace|ui|debug|list)(?:=|$|-)/.test(arg))) {
	console.error('Reporting overrides and interactive modes are disabled in the safe runner.')
	process.exit(1)
}
async function main() {
	const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-public-'))
	const summaryFile = path.join(temporary, 'summary.json')
	let phase = 'preflight'
	try {
		const env = { ...process.env, PUBLIC_SUMMARY_FILE: summaryFile,
			REPORT_INVOCATION: process.env.PUBLIC_SUMMARY_FILE ? path.basename(process.env.PUBLIC_SUMMARY_FILE, '.json') : 'tests' }
		delete env.DEBUG
		delete env.PWDEBUG
		// A caller cannot reuse an unverified session from an earlier invocation.
		delete env[sessionVariable]
		const sessionFile = await prepareSession(temporary, env)
		if (sessionFile) {
			env[sessionVariable] = sessionFile
			// Keep report assets together and never honor caller-supplied remote attachment URLs.
			env.PLAYWRIGHT_HTML_OUTPUT_DIR = path.join(temporary, 'playwright-report')
			env.PLAYWRIGHT_HTML_ATTACHMENTS_BASE_URL = 'data/'
			env.PLAYWRIGHT_HTML_OPEN = 'never'
		}
		phase = 'tests'
		// Suppress even config/import/global-setup errors, which occur before reporters load.
		const child = spawnSync(process.execPath, [
			'--require', require.resolve('./security/guard-playwright.cjs'),
			require.resolve('@playwright/test/cli'), 'test', ...args,
		], {
			stdio: 'ignore', env,
		})
		const summary = sanitizeSummary(JSON.parse(fs.readFileSync(summaryFile, 'utf8')))
		if (child.status !== 0 || child.signal) summary.status = 'failed'
		console.log(JSON.stringify(summary))
		if (process.env.PUBLIC_SUMMARY_FILE) {
			fs.mkdirSync(path.dirname(process.env.PUBLIC_SUMMARY_FILE), { recursive: true })
			fs.writeFileSync(process.env.PUBLIC_SUMMARY_FILE, JSON.stringify(summary) + '\n', { mode: 0o600 })
		}
		if (process.env.GITHUB_STEP_SUMMARY && summary.hostedReport) {
			const report = summary.hostedReport
			const lines = ['\n### Playwright report', '',
				report.status === 'complete' ? 'HTML report and attachments are available.' : `Report upload incomplete (${report.error || 'upload_failed'}).`]
			if (report.url) lines.push('', `[Test Report](${report.url})`)
			fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
		}
		process.exitCode = child.status === 0 && ['passed', 'queued'].includes(summary.status) ? 0 : 1
	} catch (error) {
		console.error(phase === 'preflight'
			? `Hosted report preflight failed (${errorCode(error)}). Check the original S3 reporting secrets and anonymous read access on the report bucket. No tests or recordings were started.`
			: 'Playwright failed before producing a safe summary. Inspect privately with synthetic credentials.')
		process.exitCode = 1
	} finally {
		fs.rmSync(temporary, { recursive: true, force: true })
	}
}
main()
