#!/usr/bin/env node
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const { getCheck, readResult, resultPath, writeResult } = require('./result-utils')

const id = process.argv[2]
const check = getCheck(id)
if (check.type !== 'playwright' || !check.command) {
	throw new Error(`${id} is not a Playwright health check`)
}

const outputFile = resultPath(check.id)
const startedAt = Date.now()
fs.rmSync(outputFile, { force: true })

const child = spawnSync('npm', ['run', check.command], {
	stdio: 'inherit',
	env: {
		...process.env,
		ENV: check.environment,
		ENV_ID: check.envId,
		HEALTH_CHECK_ID: check.id,
		HEALTH_CHECK_LABEL: check.label,
		HEALTH_CHECK_GROUP: check.group,
		HEALTH_RESULT_FILE: outputFile,
	},
})

if (!fs.existsSync(outputFile)) {
	writeResult(
		check,
		{
			status: 'failed',
			startedAt: new Date(startedAt).toISOString(),
			finishedAt: new Date().toISOString(),
			durationSeconds: Math.round((Date.now() - startedAt) / 1000),
			failureSummary: [
				child.error?.message ||
					`Playwright exited with ${child.signal ? `signal ${child.signal}` : `code ${child.status}`}`,
				'No structured Playwright result was produced.',
			],
		},
		outputFile,
	)
} else if (child.status !== 0 || child.signal) {
	const result = readResult(outputFile)
	result.status = 'failed'
	result.failureSummary = [
		...(result.failureSummary || []),
		`Playwright command exited with ${child.signal ? `signal ${child.signal}` : `code ${child.status}`}.`,
	]
	writeResult(check, result, outputFile)
}

process.exitCode = child.status === 0 && !child.signal ? 0 : 1
