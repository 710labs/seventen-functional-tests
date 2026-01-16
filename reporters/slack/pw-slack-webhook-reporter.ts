import { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

interface TestSummary {
	passed: number
	failed: number
	skipped: number
	tests: Array<{
		name: string
		status: string
		projectName: string
		reason?: string
	}>
}

class SlackWebhookReporter implements Reporter {
	private summary: TestSummary = {
		passed: 0,
		failed: 0,
		skipped: 0,
		tests: [],
	}

	onTestEnd(test: TestCase, result: TestResult) {
		const status = result.status
		const testInfo = {
			name: test.title,
			status: status,
			projectName: test.parent.title,
			reason: result.error?.message,
		}

		this.summary.tests.push(testInfo)

		if (status === 'passed') {
			this.summary.passed++
		} else if (status === 'failed' || status === 'timedOut') {
			this.summary.failed++
		} else if (status === 'skipped') {
			this.summary.skipped++
		}
	}

	async onEnd(result: FullResult) {
		const webhookUrl = process.env.SLACK_WEBHOOK_URL

		if (!webhookUrl) {
			console.log('⚠️ SLACK_WEBHOOK_URL not set, skipping Slack notification')
			return
		}

		try {
			// Build failure summary
			const failedTests = this.summary.tests
				.filter(t => t.status === 'failed' || t.status === 'timedOut')
				.map(t => `${t.name} [${t.projectName}]`)
				.slice(0, 20)
				.join('\n')

			const total = this.summary.passed + this.summary.failed + this.summary.skipped
			const statusEmoji = this.summary.failed === 0 ? ':large_green_circle:' : ':red_circle:'
			const statusText = this.summary.failed === 0 ? 'Passed' : 'Failed'

			// Build S3 report URL
			const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}/index.html`
			const githubUrl = `https://github.com/710labs/seventen-functional-tests/actions/runs/${process.env.UNIQUE_RUN_ID}`

			// Build Slack Block Kit message
			const message = {
				blocks: [
					{
						type: 'header',
						text: {
							type: 'plain_text',
							text: 'Direct To Consumer Tests',
							emoji: true,
						},
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `*Environment* :\t${process.env.ENV}\n`,
						},
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `*Execution Type* :\t${process.env.EXECUTION_TYPE}\n`,
						},
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `*Test Run ID* :\t${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}\n`,
						},
					},
					{
						type: 'divider',
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text:
								`\n\n ${statusEmoji} ${statusText}\n` +
								`\n\n${this.summary.passed} (Passed) \n${this.summary.failed} (Failed) \n${
									this.summary.skipped > 0 ? `${this.summary.skipped} (Skipped)` : ''
								}\n${total} (Total)` +
								`${failedTests.length > 0 ? `\n\n Failures or Flaky: \n ${failedTests}` : ''}`,
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
									text: 'Test Report',
								},
								style: 'primary',
								url: s3Url,
							},
							{
								type: 'button',
								text: {
									type: 'plain_text',
									emoji: false,
									text: 'GitHub Action',
								},
								style: 'primary',
								url: githubUrl,
							},
						],
					},
					{
						type: 'divider',
					},
				],
			}

			// Send to Slack webhook
			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(message),
			})

			if (response.ok) {
				console.log('✅ Slack notification sent successfully')
			} else {
				console.log(`❌ Slack notification failed: ${response.status} ${response.statusText}`)
			}
		} catch (error) {
			console.log('❌ Slack webhook error:', error)
		}
	}
}

export default SlackWebhookReporter
