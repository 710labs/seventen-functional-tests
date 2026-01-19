import { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

interface TestSummary {
	passed: number
	failed: number
	flaky: number
	skipped: number
}

class SlackWebhookReporter implements Reporter {
	private summary: TestSummary = {
		passed: 0,
		failed: 0,
		flaky: 0,
		skipped: 0,
	}

	// Store unique tests by ID to avoid counting retries multiple times
	private testResults: Map<string, TestCase> = new Map()

	onTestEnd(test: TestCase, result: TestResult) {
		// Store the test reference (overwrites previous attempts from retries)
		this.testResults.set(test.id, test)
	}

	async onEnd(result: FullResult) {
		// Count final outcomes using test.outcome() which correctly identifies flaky tests
		Array.from(this.testResults.values()).forEach(test => {
			const outcome = test.outcome()
			if (outcome === 'expected') {
				this.summary.passed++
			} else if (outcome === 'flaky') {
				this.summary.flaky++
			} else if (outcome === 'unexpected') {
				this.summary.failed++
			} else if (outcome === 'skipped') {
				this.summary.skipped++
			}
		})

		const webhookUrl = process.env.SLACK_WEBHOOK_URL

		if (!webhookUrl) {
			console.log('⚠️ SLACK_WEBHOOK_URL not set, skipping Slack notification')
			return
		}

		try {
			// Build failure/flaky summary
			const failedOrFlakyTests = Array.from(this.testResults.values())
				.filter(t => t.outcome() === 'unexpected' || t.outcome() === 'flaky')
				.map(t => `${t.title} [${t.parent.title}]`)
				.slice(0, 20)
				.join('\n')

			const total = this.summary.passed + this.summary.failed + this.summary.flaky + this.summary.skipped

			// Determine status: red for failures, yellow for flaky-only, green for all passed
			const statusEmoji =
				this.summary.failed > 0
					? ':red_circle:'
					: this.summary.flaky > 0
						? ':large_yellow_circle:'
						: ':large_green_circle:'

			const statusText =
				this.summary.failed > 0 ? 'Failed' : this.summary.flaky > 0 ? 'Flaky' : 'Passed'

			// Build S3 report URL
			const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}/index.html`
			const githubUrl = `https://github.com/710labs/seventen-functional-tests/actions/runs/${process.env.UNIQUE_RUN_ID}`

			// Build counts text
			const countsText =
				`${this.summary.passed} (Passed)\n` +
				`${this.summary.failed} (Failed)\n` +
				`${this.summary.flaky > 0 ? `${this.summary.flaky} (Flaky)\n` : ''}` +
				`${this.summary.skipped > 0 ? `${this.summary.skipped} (Skipped)\n` : ''}` +
				`${total} (Total)`

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
								`\n\n ${statusEmoji} ${statusText}\n\n` +
								countsText +
								`${failedOrFlakyTests.length > 0 ? `\n\n Failures or Flaky: \n ${failedOrFlakyTests}` : ''}`,
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
