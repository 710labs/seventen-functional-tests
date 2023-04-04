import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout'
require('dotenv').config({ path: require('find-config')('.env') })
import type { TestOptions } from '../options'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
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
				channels: ['tech-savagery-tests'],
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
		actionTimeout: 15 * 1000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 200,
		},
		trace: 'on',
		video: 'on',
		screenshot: 'on',
		orders: [
			[
				'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
				'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
				'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
				'PERSYBATTERY - Accessories',
			],
			[
				'1271381 | Half Ounce', //Gummiez #12 (https://thelist-dev.710labs.com/product/gummiez-12/)
				'1221676', //Cake Crasher (https://thelist-dev.710labs.com/product/cake-crasher/)
				'1149561', //Gak Smoovie #5 (https://thelist-dev.710labs.com/product/gak-smoovie-5/)
				'PERSYBATTERY - Accessories',
			],
			[
				'1233744', //Blueberry Haze (https://thelist-dev.710labs.com/product/blueberry-haze-2/)
				'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
				'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
				'PERSYBATTERY - Accessories',
			],
			[
				'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
				'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
				'1099685', //Zkittlez (https://thelist-dev.710labs.com/product/zkittlez/)
				'PERSYBATTERY - Accessories',
			],
			[
				'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
				'1032839', //Sundae Driver (https://thelist-dev.710labs.com/product/sundae-driver/)
				'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
				'PERSYBATTERY - Accessories',
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
	],
	outputDir: '../test-results/',
})
