import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import generateCustomLayoutAsync from '../reporters/slack/slack-alert-layout'
import { TestOptions } from '../options'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
	testDir: './../tests',
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
		['@estruyf/github-actions-reporter'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 30 * 1000,
		baseURL: process.env.BASE_URL,
		launchOptions: {
			slowMo: 200,
		},
		trace: 'on',
		video: 'on',
		screenshot: 'on',
		orders: [
			[
				'1280525', //The Sweeties #7 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234042&action=edit)
				'1410716', //Lemon Heads #4 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234034&action=edit)
				'1275126', //Starburst 36 #1 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234030&action=edit)
				'BATTERY-1', //TEST Pod Battery (https://thelist-mi.710labs.com/wp-admin/post.php?post=234043&action=edit)
			],
			[
				'1280525', //The Sweeties #7 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234042&action=edit)
				'1410716', //Lemon Heads #4 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234034&action=edit)
				'1275126', //Starburst 36 #1 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234030&action=edit)
				'BATTERY-1', //TEST Pod Battery (https://thelist-mi.710labs.com/wp-admin/post.php?post=234043&action=edit)
			],
			[
				'1280525', //The Sweeties #7 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234042&action=edit)
				'1410716', //Lemon Heads #4 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234034&action=edit)
				'1275126', //Starburst 36 #1 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234030&action=edit)
				'BATTERY-1', //TEST Pod Battery (https://thelist-mi.710labs.com/wp-admin/post.php?post=234043&action=edit)
			],
			[
				'1280525', //The Sweeties #7 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234042&action=edit)
				'1410716', //Lemon Heads #4 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234034&action=edit)
				'1275126', //Starburst 36 #1 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234030&action=edit)
				'BATTERY-1', //TEST Pod Battery (https://thelist-mi.710labs.com/wp-admin/post.php?post=234043&action=edit)
			],
			[
				'1280525', //The Sweeties #7 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234042&action=edit)
				'1410716', //Lemon Heads #4 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234034&action=edit)
				'1275126', //Starburst 36 #1 (https://thelist-mi.710labs.com/wp-admin/post.php?post=234030&action=edit)
				'BATTERY-1', //TEST Pod Battery (https://thelist-mi.710labs.com/wp-admin/post.php?post=234043&action=edit)
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
