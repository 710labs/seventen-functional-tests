import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import { TestOptions } from '../options'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
	testDir: './../tests',
	timeout: 10 * 60000,
	expect: {
		timeout: 5 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 12 : undefined,
	reporter: [
		['list'],
		['html'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/s3/pw-report-s3-upload.ts'],
		['@estruyf/github-actions-reporter'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 30 * 1000,
		baseURL: 'https://thelist-stage.710labs.com',
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
				'Battery - Accessories', //Pod Battery (https://thelist-stage.710labs.com/wp-admin/post.php?post=95733&action=edit)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
				'Battery - Accessories', //Pod Battery (https://thelist-stage.710labs.com/wp-admin/post.php?post=95733&action=edit)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
				'Battery - Accessories', //Pod Battery (https://thelist-stage.710labs.com/wp-admin/post.php?post=95733&action=edit)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
				'Battery - Accessories', //Pod Battery (https://thelist-stage.710labs.com/wp-admin/post.php?post=95733&action=edit)
			],
			[
				'1263018', //Gak Smoothie (https://thelist-stage.710labs.com/product/gak-smoovie-5-4/)
				'1271376', //Guava (https://thelist-stage.710labs.com/product/guava/)
				'1261669', //Bad Apple #7 (https://thelist-stage.710labs.com/product/bad-apple-7/)
				'Battery - Accessories', //Pod Battery (https://thelist-stage.710labs.com/wp-admin/post.php?post=95733&action=edit)
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
