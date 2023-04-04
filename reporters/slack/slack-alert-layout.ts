import { Block, KnownBlock } from '@slack/types'
import { SummaryResults } from 'playwright-slack-report/dist/src'

export async function generateCustomLayoutAsync(
	summaryResults: SummaryResults,
): Promise<Array<KnownBlock | Block>> {
	const maxNumberOfFailureLength = 700
	const fails: any[] = []
	const failSummary: any[] = []
	const passSummary: any[] = []
	const skipSummary: any[] = []
	var failSummaryText: string = ''
	var passSummaryText: string = ''
	var skipSummaryText: string = ''
	const meta: any[] = []
	for (let i = 0; i < summaryResults.tests.length; i += 1) {
		const { reason, name, status } = summaryResults.tests[i]
		if (status === 'failed' || status === 'timedOut') {
			var formattedFailure = reason
				.substring(0, maxNumberOfFailureLength)
				.split('\n')
				.map(l => `>${l}`)
				.join('\n')
			var errorStart = formattedFailure.indexOf('Error:')
			var errorEnd = formattedFailure.indexOf('>')
			formattedFailure = formattedFailure.substring(errorStart, errorEnd)
			fails.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*${name}*\n\n${formattedFailure}`,
				},
			})
		}
	}

	for (let i = 0; i < summaryResults.tests.length; i += 1) {
		const { name, projectName, status } = summaryResults.tests[i]
		if (status === 'passed') {
			passSummary.push(`${name} [${projectName}]\n`)
			passSummary.sort()
			passSummaryText = passSummary.join('')
		}
		if (status === 'failed' || status === 'timedOut') {
			failSummary.push(`${name} [${projectName}]\n`)
			failSummary.sort()
			failSummaryText = failSummary.join('')
		}
		if (status === 'skipped') {
			skipSummary.push(`${name} [${projectName}]\n`)
			skipSummary.sort()
			skipSummaryText = skipSummary.join('')
		}
	}

	if (summaryResults.meta) {
		for (let i = 0; i < summaryResults.meta.length; i += 1) {
			const { key, value } = summaryResults.meta[i]
			meta.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*${key}* :\t${value}\n`,
				},
			})
		}
	}
	return [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: 'Direct To Consumer Tests',
				emoji: true,
			},
		},
		...meta,
		{
			type: 'divider',
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text:
					`\n\n ${
						summaryResults.failed == 0 ? ':large_green_circle: Passed' : ':red_circle: Failed'
					}\n` +
					`\n\n${summaryResults.passed} (Passed) \n${summaryResults.failed} (Failed) \n${
						summaryResults.skipped > 0 ? `${summaryResults.skipped} (Skipped)` : ''
					}\n${summaryResults.passed + summaryResults.failed + summaryResults.skipped} (Total)
					` +
					`\n\n ${failSummaryText.length > 0 ? 'Failures:' : ''} \n ${
						failSummaryText.length > 0 ? failSummaryText : ''
					}`,
			},
		},
		{
			type: 'divider',
		},
		{
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: {
						type: 'plain_text',
						emoji: false,
						text: `
						Test Report`,
					},
					style: 'primary',
					value: 'click_me',
					url: `https://tech-savagery-test-artifacts.s3.us-west-1.amazonaws.com/${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}/index.html`,
				},
				{
					type: 'button',
					text: {
						type: 'plain_text',
						emoji: false,
						text: `GitHub Action`,
					},
					style: 'primary',
					value: 'click_me',
					url: `https://github.com/710labs/seventen-functional-tests/actions/runs/${process.env.UNIQUE_RUN_ID}`,
				},
			],
		},
		{
			type: 'divider',
		},
		//...fails,
	]
}

export default generateCustomLayoutAsync
