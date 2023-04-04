import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout'
import { TestOptions } from '../options'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
	testDir: './../tests',
	timeout: 180 * 1000,
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
			'./../node_modules/playwright-slack-report/dist/src/SlackReporter.js',
			{
				channels: ['tech-savagery-tests', '710labs-qatest-results'],
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
		baseURL: process.env.BASE_URL,
		launchOptions: {
			slowMo: 200,
		},
		trace: 'on',
		video: 'on',
		screenshot: 'on',
		orders: [
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
			],
		],
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
})
