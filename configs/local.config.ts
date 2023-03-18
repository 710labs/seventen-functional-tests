import { PlaywrightTestConfig, devices } from '@playwright/test'
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout-s3'
require('dotenv').config({ path: require('find-config')('.env') })
import { v4 as uuidv4 } from 'uuid'

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: './../tests',
	timeout: 180 * 1000,
	expect: {
		timeout: 5 * 1000,
	},
	// fullyParallel: true,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 0 : 0,
	//workers: process.env.CI ? 12 : 5,
	workers: process.env.CI ? 1 : undefined,
	reporter: [
		['list'],
		['html'],
		// [
		// 	'./../node_modules/playwright-slack-report/dist/src/SlackReporter.js',
		// 	{
		// 		channels: ['tech-savagery-tests'],
		// 		sendResults: 'always',
		// 		layoutAsync: generateCustomLayoutAsync,
		// 		maxNumberOfFailuresToShow: 20,
		// 		meta: [
		// 			{
		// 				key: 'Environment',
		// 				value: process.env.ENV,
		// 			},
		// 			{
		// 				key: 'Execution Type',
		// 				value: process.env.EXECUTION_TYPE,
		// 			},
		// 		],
		// 	},
		// ],
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
