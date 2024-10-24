import { PlaywrightTestConfig, devices } from '@playwright/test'
import generateCustomLayout from './reporters/slack/slack-alert-layout'
require('dotenv').config({ path: require('find-config')('.env') })

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: 'tests',
	timeout: 10 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 12 : undefined,
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
			'./node_modules/playwright-slack-report/dist/src/SlackReporter.js',
			{
				channels: ['tech-savagery-tests'], // provide one or more Slack channels
				sendResults: 'always', // "always" , "on-failure", "off"
				layout: generateCustomLayout,
				maxNumberOfFailuresToShow: 20,
			},
		],
		['@estruyf/github-actions-reporter'],
	],
	use: {
		acceptDownloads: true,
		actiontimeout: 10 * 60000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 200,
		},
		trace: 'retain-on-failure',
		screenshot: 'on',
		video: 'on',
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
		// {
		//   name: 'mobile-safari',
		//   use: {
		//     ...devices['iPhone 12'],
		//   },
		// },
	],
	outputDir: '../test-results/',
}
export default config
