import { PlaywrightTestConfig, devices } from '@playwright/test'
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout-s3'
require('dotenv').config({ path: require('find-config')('.env') })

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: './../tests',
	timeout: 300 * 1000,
	expect: {
		timeout: 5 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 0 : 0,
	reporter: [
		['list'],
		['html'],
		[
			'playwright-tesults-reporter',
			{
				'tesults-target':
					'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6IjM0ZTE3ODMzLWExOTItNDQxNS1hNjI0LTM1ZThjMGNmZmE2ZC0xNjY2NzYzMjEzNjE2IiwiZXhwIjo0MTAyNDQ0ODAwMDAwLCJ2ZXIiOiIwIiwic2VzIjoiNjY2ZjFmZGYtODY5Yi00MWRlLTk2ZGItNjBlNjI5OTdhZmQ0IiwidHlwZSI6InQifQ.4BjX_l1WjT0zaUNtXlD-upc2i7KbchKnngCXoA0EXUo',
			},
		],
		[
			'./../node_modules/playwright-slack-report/dist/src/SlackReporter.js',
			{
				channels: ['tech-savagery-tests', '710labs-qatest-results'], // provide one or more Slack channels
				sendResults: 'always', // "always" , "on-failure", "off"
				layoutAsync: generateCustomLayoutAsync,
				maxNumberOfFailuresToShow: 20,
				meta: [
					{
						key: 'Environment',
						value: process.env.ENV,
					},
					{
						key: 'Execution Type',
						value: process.env.EXECUTION_TYPE,
					},
					{
						key: 'Test Run ID',
						value: process.env.UNIQUE_RUN_ID + '-' + process.env.RUN_ID,
					},
				],
			},
		],
		['../reporters/s3/pw-report-s3-upload.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 300 * 1000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 200,
		},
		trace: 'on',
		video: 'on',
		screenshot: 'on',
	},
	projects: [
		{
			name: 'Desktop Chrome',
			use: {
				...devices['Desktop Chrome'],
			},
		},
		{
			name: 'Mobile Chrome',
			use: {
				...devices['Pixel 5'],
			},
		},
	],
	outputDir: '../test-results/',
}
export default config
