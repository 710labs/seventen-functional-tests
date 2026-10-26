const { privateVideoMode } = require('../scripts/private-videos/session')
import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import type { TestOptions } from '../options'
import { buildStorageStateWithRecaptchaBypass } from '../support/qa/recaptcha-bypass'

const LIVE_AND_CONCIERGE_BASE_URL = 'https://live-dev.710labs.com/'

/* https://playwright.dev/docs/test-configuration */
export default defineConfig<TestOptions>({
	testDir: './../tests',
	testIgnore: ['**/admin-drop-tests/**'],
	timeout: 15 * 60000,
	expect: {
		timeout: 15 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/health/pw-health-json-reporter.ts'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 30 * 1000,
		baseURL: LIVE_AND_CONCIERGE_BASE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(LIVE_AND_CONCIERGE_BASE_URL),
		launchOptions: {
			slowMo: 200,
		},
		trace: 'off',
		video: privateVideoMode(),
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
	],
	outputDir: '../test-results/',
})
