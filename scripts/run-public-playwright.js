#!/usr/bin/env node
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { sanitizeSummary } = require('./security/summary')
const { prepareSession, sessionVariable } = require('./private-videos/session')

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
		const env = { ...process.env, PUBLIC_SUMMARY_FILE: summaryFile }
		delete env.DEBUG
		delete env.PWDEBUG
		// A caller cannot reuse an unverified session from an earlier invocation.
		delete env[sessionVariable]
		const sessionFile = await prepareSession(temporary, env)
		if (sessionFile) env[sessionVariable] = sessionFile
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
		if (process.env.GITHUB_STEP_SUMMARY && summary.recordings) {
			const recordings = summary.recordings
			const label = String(process.env.HEALTH_CHECK_ID || process.env.ENV_ID || 'tests').replace(/[^a-zA-Z0-9_-]/g, '-')
			const lines = [`\n### Private failure videos — ${label}`, '',
				`${recordings.uploaded} uploaded; ${recordings.failed} upload errors; ${recordings.missing} failed attempts without a video. AWS sign-in is required.`, '']
			for (const video of recordings.videos || []) lines.push(`- Test ${video.id}, attempt ${video.retry + 1}: [Open video in AWS Console](${video.url})`)
			if (recordings.url) lines.push('', `[All recordings and private test-name manifest](${recordings.url})`)
			fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
		}
		process.exitCode = child.status === 0 && ['passed', 'queued'].includes(summary.status) ? 0 : 1
	} catch {
		console.error(phase === 'preflight'
			? 'Private failure video preflight failed. Check the AWS role, bucket region, and private access settings. No tests or recordings were started.'
			: 'Playwright failed before producing a safe summary. Inspect privately with synthetic credentials.')
		process.exitCode = 1
	} finally {
		fs.rmSync(temporary, { recursive: true, force: true })
	}
}
main()
