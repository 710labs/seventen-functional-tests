import { PlaywrightTestConfig, devices } from '@playwright/test'
import generateCustomLayoutAsync from '../slack/slack-alert-layout-s3'
require('dotenv').config({ path: require('find-config')('.env') })

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: './../utils',
	timeout: 300 * 1000,
	expect: {
		timeout: 5 * 1000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 0 : 0,
	workers: process.env.CI ? 12 : 5,
	reporter: [
		['list'],
		['html'],
		[
			'./../node_modules/playwright-slack-report/dist/src/SlackReporter.js',
			{
				channels: ['tech-savagery-tests'],
				sendResults: 'never',
				layoutAsync: generateCustomLayoutAsync,
				maxNumberOfFailuresToShow: 20,
				meta: [
					{
						key: 'Execution Type',
						value: 'Acuity Slot Scripts',
					},
				],
			},
		],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 300 * 1000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 200,
		},
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
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
