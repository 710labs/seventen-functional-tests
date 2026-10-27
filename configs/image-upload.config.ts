const { hostedVideoMode } = require('../scripts/hosted-reports/session')
import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import {
	buildStorageStateWithListBypass,
	buildStorageStateWithRecaptchaBypass,
} from '../support/qa/recaptcha-bypass'

require('dotenv').config({ path: require('find-config')('.env') })

const storefront = process.env.IMAGE_UPLOAD_STOREFRONT || 'thelist'
const defaultTarget =
	storefront === 'live'
		? 'https://live-dev.710labs.com'
		: 'https://thelist-dev.710labs.com'
const target = process.env.IMAGE_UPLOAD_TARGET || defaultTarget

if (!['thelist', 'live'].includes(storefront)) {
	throw new Error(`Unsupported IMAGE_UPLOAD_STOREFRONT: ${storefront}`)
}

process.env.BASE_URL = target

export default defineConfig({
	testDir: path.resolve(__dirname, '../tests/image-upload-tests'),
	testMatch: 'storefront-image-uploads.spec.ts',
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	workers: 1,
	retries: 0,
	timeout: 10 * 60 * 1000,
	expect: {
		timeout: 30000,
	},
	reporter: [
		['../reporters/security/public-summary-reporter.cjs'],
		['../reporters/slack/pw-slack-webhook-reporter.ts'],
		['../reporters/health/pw-health-json-reporter.ts'],
	],
	outputDir: path.resolve(__dirname, '../test-results/image-upload'),
	use: {
		actionTimeout: 30000,
		baseURL: target,
		navigationTimeout: 60000,
		screenshot: 'off',
		storageState:
			storefront === 'thelist'
				? buildStorageStateWithListBypass(target)
				: buildStorageStateWithRecaptchaBypass(target),
		trace: 'off',
		video: hostedVideoMode(),
	},
	projects: [
		{
			name: 'Desktop Chrome',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1280, height: 720 },
			},
		},
	],
})
