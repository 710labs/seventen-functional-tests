import { PlaywrightTestConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from './support/qa/recaptcha-bypass'
require('dotenv').config({ path: require('find-config')('.env') })

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: 'tests',
	testIgnore: ['**/admin-drop-tests/**'],
	timeout: 10 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 12 : undefined,
	reporter: [
		['./reporters/security/public-summary-reporter.cjs'],
		['./reporters/slack/pw-slack-webhook-reporter.ts'],
		['./reporters/health/pw-health-json-reporter.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 10 * 60000,
		baseURL: process.env.BASE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(process.env.BASE_URL),
		launchOptions: {
			slowMo: 200,
			headless: !!process.env.CI,
		},
		trace: 'off',
		screenshot: 'off',
		video: 'off',
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
