const { hostedVideoMode } = require('./scripts/hosted-reports/session')
import { PlaywrightTestConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from './support/qa/recaptcha-bypass'
require('dotenv').config({ path: require('find-config')('.env') })

const UTILS_BASE_URL = 'https://thelist-dev.710labs.com'

const config: PlaywrightTestConfig = {
	testDir: 'utils', 
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
		baseURL: UTILS_BASE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(UTILS_BASE_URL),
		launchOptions: {
			slowMo: 1000, // Slow down so user can see what is happening
            headless: false // Headed by default as requested
		},
		trace: 'off',
		screenshot: 'off',
		video: hostedVideoMode(),
	},
	projects: [
		{
			name: 'Desktop Chrome',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
	outputDir: 'test-results/',
}
export default config
