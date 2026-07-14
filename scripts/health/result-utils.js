const fs = require('node:fs')
const path = require('node:path')

const manifest = require('./checks.json')

function getCheck(id) {
	const check = manifest.checks.find(candidate => candidate.id === id)
	if (!check) throw new Error(`Unknown health check: ${id}`)
	return check
}

function resultPath(id, directory = process.env.HEALTH_RESULTS_DIR || 'health-results') {
	return path.join(directory, `${id}.json`)
}

function runUrl() {
	if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) {
		return null
	}
	return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
}

function writeResult(check, values, outputFile = resultPath(check.id)) {
	const now = new Date().toISOString()
	const payload = {
		schemaVersion: 1,
		id: check.id,
		label: check.label,
		group: check.group,
		status: 'failed',
		startedAt: now,
		finishedAt: now,
		durationSeconds: 0,
		counts: null,
		failureSummary: [],
		reportUrl: null,
		runUrl: runUrl(),
		...values,
	}
	fs.mkdirSync(path.dirname(outputFile), { recursive: true })
	fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`)
	return payload
}

function readResult(outputFile) {
	return JSON.parse(fs.readFileSync(outputFile, 'utf8'))
}

module.exports = { getCheck, manifest, readResult, resultPath, runUrl, writeResult }
