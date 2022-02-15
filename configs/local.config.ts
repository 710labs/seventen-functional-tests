import { PlaywrightTestConfig, devices } from '@playwright/test';
require('dotenv').config({ path: require('find-config')('.env') })

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
  testDir: './../tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 6 : undefined,
  reporter: 'html',
  use: {
    acceptDownloads: true,
    actionTimeout: 0,
    baseURL: process.env.BASE_URL,
    launchOptions: {
      slowMo: 200,
    },
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],
  outputDir: 'test-results/',
};
export default config;
