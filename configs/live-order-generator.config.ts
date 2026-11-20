import { defineConfig, devices } from '@playwright/test'
import { buildStorageStateWithRecaptchaBypass } from '../support/qa/recaptcha-bypass'
const { hostedVideoMode } = require('../scripts/hosted-reports/session')
require('dotenv').config({ path: require('find-config')('.env') })
const { STAGE_URL } = require('../support/live-order-generator/targets.cjs')

export default defineConfig({
	testDir: '../generators/live-stage',
	testMatch: 'orders.spec.ts',
	timeout: 8 * 60 * 1000,
	expect: { timeout: 15000 },
	forbidOnly: !!process.env.CI,
	// A retry after checkout could create an additional order.
	retries: 0,
	workers: 1,
	fullyParallel: false,
	repeatEach: 1,
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
	],
	use: {
		baseURL: STAGE_URL,
		storageState: buildStorageStateWithRecaptchaBypass(STAGE_URL),
		actionTimeout: 30000,
		navigationTimeout: 30000,
		trace: 'off',
		video: hostedVideoMode(),
		screenshot: 'off',
	},
	projects: [{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }],
	outputDir: '../test-results/live-order-generator',
})
