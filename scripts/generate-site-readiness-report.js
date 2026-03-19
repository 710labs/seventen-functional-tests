const fs = require('node:fs')
const path = require('node:path')

const artifactsRoot = process.env.ARTIFACTS_ROOT || 'artifacts'
const templatePath = process.env.REPORT_TEMPLATE_PATH || '.github/site-readiness-report-template.md'

const readJson = filePath => {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'))
	} catch {
		return null
	}
}

const findFirst = relativePath => {
	const fullPath = path.join(artifactsRoot, relativePath)
	return fs.existsSync(fullPath) ? fullPath : null
}

const functional = readJson(findFirst('functional-results/functional-summary.json'))
const lighthouse = readJson(findFirst('lighthouse-results/lighthouse-summary.json'))
const loadTest = readJson(findFirst('load-test-results/load-test-summary.json'))
const security = readJson(findFirst('security-results/security-summary.json'))

const jobResultToStatus = result => {
	switch (result) {
		case 'success':
			return 'PASS'
		case 'failure':
			return 'FAIL'
		case 'skipped':
			return 'SKIP'
		default:
			return 'WARN'
	}
}

const statusEmoji = status => {
	switch (status) {
		case 'PASS':
			return '✅'
		case 'WARN':
			return '⚠️'
		case 'FAIL':
			return '❌'
		case 'SKIP':
			return '⏭️'
		default:
			return 'ℹ️'
	}
}

const rows = []

const functionalStatus =
	functional?.overallStatus === 'fail'
		? 'FAIL'
		: functional?.overallStatus === 'pass'
			? 'PASS'
			: jobResultToStatus(process.env.FUNCTIONAL_RESULT)

rows.push({
	gate: 'Functional Gate',
	status: functionalStatus,
	details: functional
		? `Playwright ${functional.playwrightStatus}; POS ${functional.posStatus}; order IDs ${functional.orderCount}`
		: `Functional job result: ${process.env.FUNCTIONAL_RESULT}`,
})

const lighthouseStatus =
	!lighthouse && process.env.LIGHTHOUSE_RESULT === 'skipped'
		? 'SKIP'
		: lighthouse?.status === 'fail'
			? 'FAIL'
			: lighthouse?.status === 'warn'
				? 'WARN'
				: lighthouse?.status === 'pass'
					? 'PASS'
					: jobResultToStatus(process.env.LIGHTHOUSE_RESULT)

rows.push({
	gate: 'Lighthouse',
	status: lighthouseStatus,
	details: lighthouse
		? `Perf ${lighthouse.averages.performance}; A11y ${lighthouse.averages.accessibility}; SEO ${lighthouse.averages.seo}`
		: process.env.LIGHTHOUSE_RESULT === 'skipped'
			? 'Lighthouse did not run.'
			: `Lighthouse job result: ${process.env.LIGHTHOUSE_RESULT}`,
})

const loadStatus =
	process.env.RUN_LOAD_TEST === 'false'
		? 'SKIP'
		: loadTest?.status === 'fail'
			? 'FAIL'
			: loadTest?.status === 'pass'
				? 'PASS'
				: jobResultToStatus(process.env.LOAD_RESULT)

rows.push({
	gate: 'Load Test',
	status: loadStatus,
	details:
		process.env.RUN_LOAD_TEST === 'false'
			? 'Disabled by workflow input.'
			: loadTest
				? `${loadTest.maxVusers} max VUs, arrival ${loadTest.arrivalRate}/s, duration ${loadTest.durationSeconds}s`
				: `Load test job result: ${process.env.LOAD_RESULT}`,
})

const securityStatus =
	process.env.RUN_SECURITY === 'false'
		? 'SKIP'
		: security?.overallStatus === 'fail'
			? 'FAIL'
			: security?.overallStatus === 'warn'
				? 'WARN'
				: security?.overallStatus === 'pass'
					? 'PASS'
					: jobResultToStatus(process.env.SECURITY_RESULT)

rows.push({
	gate: 'Security',
	status: securityStatus,
	details:
		process.env.RUN_SECURITY === 'false'
			? 'Disabled by workflow input.'
			: security
				? `ZAP ${security.tools.zap.status}, Observatory ${security.tools.observatory.status}, Trivy ${security.tools.trivy.status}, TruffleHog ${security.tools.trufflehog.status}`
				: `Security job result: ${process.env.SECURITY_RESULT}`,
})

let overallStatus = 'PASS'
if (rows.some(row => row.status === 'FAIL')) {
	overallStatus = 'FAIL'
} else if (rows.some(row => row.status === 'WARN')) {
	overallStatus = 'WARN'
}

const statusText =
	overallStatus === 'FAIL'
		? 'FAIL'
		: overallStatus === 'WARN'
			? 'REVIEW REQUIRED'
			: 'PASS'

const rowsMarkdown = rows
	.map(
		row =>
			`| ${statusEmoji(row.status)} ${row.gate} | ${row.status} | ${row.details.replace(/\|/g, '\\|')} |`,
	)
	.join('\n')

const reportJson = {
	site: process.env.SITE,
	targetUrl: process.env.TARGET_URL,
	triggeredBy: process.env.TRIGGERED_BY,
	runUrl: process.env.RUN_URL,
	status: overallStatus,
	statusText,
	rows,
}

const template = fs.readFileSync(templatePath, 'utf8')
const markdown = template
	.replaceAll('{{site}}', process.env.SITE)
	.replaceAll('{{target_url}}', process.env.TARGET_URL)
	.replaceAll('{{triggered_by}}', process.env.TRIGGERED_BY)
	.replaceAll('{{run_url}}', process.env.RUN_URL)
	.replaceAll('{{rows}}', rowsMarkdown)
	.replaceAll('{{overall_emoji}}', statusEmoji(overallStatus))
	.replaceAll('{{overall_text}}', statusText)

fs.writeFileSync('site-readiness-report.md', `${markdown.trim()}\n`)
fs.writeFileSync('site-readiness-report.json', `${JSON.stringify(reportJson, null, 2)}\n`)

const slackPayload = {
	text: `${statusEmoji(overallStatus)} Site Readiness ${statusText}: ${process.env.SITE}`,
	attachments: [
		{
			color:
				overallStatus === 'FAIL'
					? 'danger'
					: overallStatus === 'WARN'
						? 'warning'
						: 'good',
			blocks: [
				{
					type: 'header',
					text: {
						type: 'plain_text',
						text: `${statusEmoji(overallStatus)} Site Readiness ${statusText}`,
					},
				},
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*Site:*\n${process.env.SITE}` },
						{ type: 'mrkdwn', text: `*Triggered By:*\n${process.env.TRIGGERED_BY}` },
						{ type: 'mrkdwn', text: `*Run:*\n<${process.env.RUN_URL}|Open workflow run>` },
						{ type: 'mrkdwn', text: `*Target URL:*\n${process.env.TARGET_URL}` },
					],
				},
			],
		},
	],
}

fs.writeFileSync('slack-payload.json', `${JSON.stringify(slackPayload, null, 2)}\n`)
