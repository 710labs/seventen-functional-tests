import path from 'path'
import { defineConfig, devices } from '@playwright/test'

require('dotenv').config({ path: require('find-config')('.env') })

const authFile = path.join(__dirname, '../.auth/admin-drop.json')

export default defineConfig({
	testDir: './../tests/admin-drop-tests',
	timeout: 10 * 60000,
	expect: {
		timeout: 10 * 1000,
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['html'], ['@estruyf/github-actions-reporter']],
	use: {
		acceptDownloads: true,
		actionTimeout: 30 * 1000,
		baseURL: process.env.BASE_URL,
		trace: 'on',
		video: 'on',
		screenshot: 'on',
	},
	projects: [
		{
			name: 'setup',
			testMatch: /.*\.setup\.ts/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
		{
			name: 'admin-drop',
			dependencies: ['setup'],
			testIgnore: /.*\.setup\.ts/,
			use: {
				...devices['Desktop Chrome'],
				storageState: authFile,
			},
		},
	],
	outputDir: '../test-results/',
})
