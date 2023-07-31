import { PlaywrightTestConfig, devices } from '@playwright/test'
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout'
require('dotenv').config({ path: require('find-config')('.env') })

const config: PlaywrightTestConfig = {
	testDir: './../utils/generators/',
	timeout: 40 * 60000,
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
		[
			'./../node_modules/playwright-slack-report/dist/src/SlackReporter.js',
			{
				channels: ['tech-savagery-tests', '710labs-qatest-results'],
				sendResults: 'always',
				layoutAsync: generateCustomLayoutAsync,
				maxNumberOfFailuresToShow: 20,
				meta: [
					{
						key: 'EXECUTION TYPE',
						value: 'POS ORDER SYNC',
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
		actionTimeout: 20 * 1000,
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
