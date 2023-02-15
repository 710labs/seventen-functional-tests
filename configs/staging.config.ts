import { PlaywrightTestConfig, devices } from '@playwright/test';
require('dotenv').config({ path: require('find-config')('.env') });
import generateCustomLayoutAsync from "../slack/slack-alert-layout-s3";

/* https://playwright.dev/docs/test-configuration */
const config: PlaywrightTestConfig = {
  testDir: './../tests',
  timeout: 300 * 1000,
  expect: {
    timeout: 20000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 12 : undefined,
  reporter: [['list'], ['html'], [
    "./../node_modules/playwright-slack-report/dist/src/SlackReporter.js",
    {
      channels: ["tech-savagery-tests", "710labs-qatest-results"],
      sendResults: "always", // "always" , "on-failure", "off"
      layoutAsync: generateCustomLayoutAsync,
      maxNumberOfFailuresToShow: 20,
      meta: [
        {
          key: 'Environment',
          value: process.env.ENV,
        },
        {
          key: 'Execution Type',
          value: process.env.EXECUTION_TYPE
        }
      ],
    },
  ],],
  use: {
    acceptDownloads: true,
    actionTimeout: 0,
    baseURL: 'https://thelist-stage.710labs.com',
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
    // {
    //   name: 'mobile-safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },
  ],
  outputDir: '../test-results/',
};
export default config;
