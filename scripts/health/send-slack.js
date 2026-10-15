#!/usr/bin/env node
const fs = require('node:fs')

async function main() {
	const webhookUrl = process.env.SLACK_WEBHOOK_URL
	if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not configured')
	const payloadFile = process.argv[2] || 'health-slack.json'
	const payload = fs.readFileSync(payloadFile, 'utf8')
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload,
		signal: AbortSignal.timeout(20000),
	})
	if (!response.ok) throw new Error(`Slack returned HTTP ${response.status}`)
	console.log('Daily System Health Slack digest sent successfully.')
}

main().catch(error => {
	console.error('Daily System Health Slack delivery failed.')
	process.exitCode = 1
})
