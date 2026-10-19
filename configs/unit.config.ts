import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: '../tests/unit',
	forbidOnly: !!process.env.CI,
	timeout: 30000,
	workers: 2,
	reporter: [['../reporters/security/public-summary-reporter.cjs']],
	use: {
		headless: true,
		trace: 'off',
		video: 'off',
		screenshot: 'off',
	},
})
