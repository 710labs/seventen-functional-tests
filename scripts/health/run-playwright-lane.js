#!/usr/bin/env node
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const { manifest, readResult, resultPath, writeResult } = require('./result-utils')

const lane = process.argv[2]
const checks = manifest.checks.filter(check => check.lane === lane)
if (!checks.length) throw new Error(`Unknown or empty health lane: ${lane}`)

let failed = false

for (const check of checks) {
	console.log(`\n===== ${check.label} =====`)
	const switchStartedAt = Date.now()
	const switched = spawnSync('node', ['./scripts/set-qa-domain.js', check.state], {
		stdio: 'inherit',
		env: process.env,
	})

	if (switched.status !== 0 || switched.signal) {
		failed = true
		writeResult(check, {
			status: 'failed',
			startedAt: new Date(switchStartedAt).toISOString(),
			finishedAt: new Date().toISOString(),
			durationSeconds: Math.round((Date.now() - switchStartedAt) / 1000),
			failureSummary: [
				`Could not switch the shared ${lane} domain to ${check.state.toUpperCase()}.`,
			],
		})
		continue
	}

	const test = spawnSync('node', ['./scripts/health/run-playwright-check.js', check.id], {
		stdio: 'inherit',
		env: process.env,
	})
	if (test.status !== 0 || test.signal) failed = true
}

console.log(`\n===== Restore ${lane} domain to CA =====`)
const reset = spawnSync('node', ['./scripts/set-qa-domain.js', 'ca'], {
	stdio: 'inherit',
	env: process.env,
})
if (reset.status !== 0 || reset.signal) {
	failed = true
	const lastCheck = checks.at(-1)
	const outputFile = resultPath(lastCheck.id)
	const existing = fs.existsSync(outputFile) ? readResult(outputFile) : {}
	writeResult(
		lastCheck,
		{
			...existing,
			status: 'failed',
			failureSummary: [
				...(existing.failureSummary || []),
				`Tests completed, but the shared ${lane} domain could not be restored to CA.`,
			],
		},
		outputFile,
	)
}

process.exitCode = failed ? 1 : 0
