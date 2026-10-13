#!/usr/bin/env node
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { sanitizeSummary } = require('./security/summary')

const args = process.argv.slice(2)
// Reporter overrides and interactive modes bypass the public output boundary.
if (args.some(arg => /^--(?:reporter|trace|ui|debug|list)(?:=|$|-)/.test(arg))) {
	console.error('Reporting overrides and interactive modes are disabled in the safe runner.')
	process.exit(1)
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-public-'))
const summaryFile = path.join(temporary, 'summary.json')
let exitCode = 1
try {
	const env = { ...process.env, PUBLIC_SUMMARY_FILE: summaryFile }
	delete env.DEBUG
	delete env.PWDEBUG
	// Suppress even config/import/global-setup errors, which occur before reporters load.
	const child = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...args], {
		stdio: 'ignore', env,
	})
	const summary = sanitizeSummary(JSON.parse(fs.readFileSync(summaryFile, 'utf8')))
	if (child.status !== 0 || child.signal) summary.status = 'failed'
	console.log(JSON.stringify(summary))
	if (process.env.PUBLIC_SUMMARY_FILE) {
		fs.mkdirSync(path.dirname(process.env.PUBLIC_SUMMARY_FILE), { recursive: true })
		fs.writeFileSync(process.env.PUBLIC_SUMMARY_FILE, JSON.stringify(summary) + '\n', { mode: 0o600 })
	}
	exitCode = child.status === 0 && summary.status === 'passed' ? 0 : 1
} catch {
	console.error('Playwright failed before producing a safe summary. Inspect privately with synthetic credentials.')
} finally {
	fs.rmSync(temporary, { recursive: true, force: true })
}
process.exitCode = exitCode
