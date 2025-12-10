import { PlaywrightTestConfig, devices } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })

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
		['list'],
		['html'],
	],
	use: {
		acceptDownloads: true,
		actionTimeout: 10 * 60000,
		baseURL: 'https://thelist-dev.710labs.com',
		launchOptions: {
			slowMo: 1000, // Slow down so user can see what is happening
            headless: false // Headed by default as requested
		},
		trace: 'retain-on-failure',
		screenshot: 'on',
		video: 'on',
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
