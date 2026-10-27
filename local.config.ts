const { hostedVideoMode } = require('./scripts/hosted-reports/session')
import { PlaywrightTestConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from './support/qa/recaptcha-bypass'
require('dotenv').config({ path: require('find-config')('.env') })

const LOCAL_BASE_URL = 'https://thelist-dev.710labs.com'

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
	testDir: './../tests',
	timeout: 10 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 12 : undefined,
	reporter: [['./reporters/security/public-summary-reporter.cjs']],
	use: {
		acceptDownloads: true,
		actionTimeout: 10 * 60000,
		baseURL: LOCAL_BASE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(LOCAL_BASE_URL),
		launchOptions: {
			slowMo: 200,
		},
		trace: 'off',
		video: hostedVideoMode(),
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
