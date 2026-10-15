import { PlaywrightTestConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from '../support/qa/recaptcha-bypass'
require('dotenv').config({ path: require('find-config')('.env') })
import { v4 as uuidv4 } from 'uuid'

const LOCAL_BASE_URL = 'https://thelist-dev.710labs.com'

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: './../tests',
	testIgnore: ['**/admin-drop-tests/**'],
	timeout: 180 * 1000,
	expect: {
		timeout: 5 * 1000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 0 : 0,
	workers: process.env.CI ? 12 : 5,
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/health/pw-health-json-reporter.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 10 * 60000,
		baseURL: LOCAL_BASE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(LOCAL_BASE_URL),
		launchOptions: {
			slowMo: 200,
		},
		trace: 'off',
		video: 'off',
		screenshot: 'off',
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
