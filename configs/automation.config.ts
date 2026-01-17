import { PlaywrightTestConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })

const config: PlaywrightTestConfig = {
	testDir: './../utils/generators/',
	timeout: 3 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 12 : 5,
	reporter: [
		['list'],
		['html'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/s3/pw-report-s3-upload.ts'],
		['@estruyf/github-actions-reporter'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 20 * 1000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 200,
		},
		trace: 'off',
		video: 'off',
		screenshot: 'off',
	},
	projects: [
		{
			name: 'Desktop Chrome',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
	outputDir: '../test-results/',
}
export default config
