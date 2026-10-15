import { PlaywrightTestConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from '../support/qa/recaptcha-bypass'
require('dotenv').config({ path: require('find-config')('.env') })

const config: PlaywrightTestConfig = {
	testDir: './../utils/generators/',
	timeout: 40 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 12 : 5,
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/health/pw-health-json-reporter.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 20 * 1000,
		baseURL: process.env.POSSYNC_URL,
		storageState: buildStorageStateWithRecaptchaBypass(process.env.POSSYNC_URL),
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
	],
	outputDir: '../test-results/',
}
export default config
