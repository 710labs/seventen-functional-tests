const { privateVideoMode } = require('../scripts/private-videos/session')
import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import { TestOptions } from '../options'
import { buildStorageStateWithListBypass } from '../support/qa/recaptcha-bypass'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
	testDir: './../tests',
	testIgnore: ['**/admin-drop-tests/**'],
	timeout: 10 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 12 : undefined,
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/health/pw-health-json-reporter.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 30 * 1000,
		baseURL: process.env.BASE_URL,
		storageState: buildStorageStateWithListBypass(process.env.BASE_URL),
		launchOptions: {
			slowMo: 200,
		},
		trace: 'off',
		video: privateVideoMode(),
		screenshot: 'off',
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
