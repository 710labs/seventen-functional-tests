#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { manifest } = require('./result-utils')

const root = path.resolve(__dirname, '../..')
const packageJson = require(path.join(root, 'package.json'))
const workflowDirectory = path.join(root, '.github/workflows')
const workflowFile = path.join(workflowDirectory, 'daily-system-health.yml')
const workflow = fs.readFileSync(workflowFile, 'utf8')

function assert(condition, message) {
	if (!condition) throw new Error(message)
}

const functionalChecks = manifest.checks.filter(check => check.type !== 'seo')
const seoChecks = manifest.checks.filter(check => check.type === 'seo')
assert(
	functionalChecks.length === 22,
	`Expected 22 functional health checks, found ${functionalChecks.length}`,
)
assert(seoChecks.length >= 3, 'Expected SEO checks for Live Prod, Stage, and Dev')
for (const label of ['LIVE - PROD', 'LIVE - STAGE', 'LIVE - DEV']) {
	assert(
		seoChecks.some(check => check.label === label),
		`Missing SEO environment ${label}`,
	)
}
assert(
	workflow.includes('uses: ./.github/workflows/seo-pulse.yml'),
	'Daily health must call the SEO workflow',
)
assert(/      - seo\n/.test(workflow), 'Daily aggregation must wait for SEO')
const seoWorkflow = fs.readFileSync(path.join(workflowDirectory, 'seo-pulse.yml'), 'utf8')
assert(seoWorkflow.includes('workflow_call:'), 'SEO workflow must be reusable')
assert(
	!seoWorkflow.includes('SLACK_WEBHOOK_URL'),
	'Only the final Daily System Health digest may post to Slack',
)
assert(
	new Set(manifest.checks.map(check => check.id)).size === manifest.checks.length,
	'Health check IDs must be unique',
)

for (const check of manifest.checks.filter(check => check.type === 'playwright')) {
	assert(
		packageJson.scripts[check.command],
		`${check.id} references missing npm script ${check.command}`,
	)
}

for (const lane of ['list-dev', 'list-stage']) {
	assert(
		manifest.checks.filter(check => check.lane === lane).length === 4,
		`${lane} must contain four state checks`,
	)
	assert(workflow.includes(`run-playwright-lane.js ${lane}`), `Workflow does not run ${lane}`)
}

const listProdChecks = manifest.checks.filter(check => check.id.startsWith('list-prod-'))
assert(
	listProdChecks.length === 4,
	`list-prod must contain four state checks, found ${listProdChecks.length}`,
)
assert(workflow.includes('list-prod:'), 'Workflow does not define the List Prod matrix')

for (const check of functionalChecks.filter(check => !check.lane)) {
	assert(workflow.includes(check.id), `Workflow does not reference ${check.id}`)
}

const scheduledWorkflows = fs
	.readdirSync(workflowDirectory)
	.filter(file => file.endsWith('.yml'))
	.filter(file =>
		/^\s+schedule:/m.test(fs.readFileSync(path.join(workflowDirectory, file), 'utf8')),
	)
assert(
	scheduledWorkflows.length === 1 && scheduledWorkflows[0] === 'daily-system-health.yml',
	`Expected only daily-system-health.yml to be scheduled; found ${scheduledWorkflows.join(', ') || 'none'}`,
)

const slackWebhookReferences = workflow.match(/SLACK_WEBHOOK_URL/g) || []
assert(
	slackWebhookReferences.length === 2,
	'Slack webhook must only be passed to the final digest step',
)

console.log('Daily System Health configuration is internally consistent.')
