import { defineConfig } from '@playwright/test'
import path from 'node:path'

// Isolated config: the SEO pulse never runs as part of the repo's existing functional suites,
// and the existing suites never pick up SEO specs. Run with:
//   npx playwright test -c seo/playwright.seo.config.ts --project=seo
const site = process.env.SEO_SITE ?? 'default'
const outDir = path.resolve(process.cwd(), process.env.SEO_OUT_DIR ?? `seo/out/${site}`)

export default defineConfig({
	testDir: './tests',
	outputDir: path.join(outDir, 'test-output'),
	timeout: 60_000,
	retries: process.env.CI ? 2 : 0, // retry before alerting — kills most network flap
	workers: 2, // be polite to production; this is a monitor, not a load test
	reporter: [
		['list'],
		['json', { outputFile: path.join(outDir, 'technical-results.json') }],
		['html', { outputFolder: path.join(outDir, 'html-report'), open: 'never' }],
	],
	use: {
		trace: 'retain-on-failure',
		// A bot-only UA gets connection-reset by the site's WAF. Use a real browser UA with an
		// identifying suffix so the traffic is recognisable in logs (and allowlist-able in the WAF).
		userAgent:
			'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 seventen-seo-pulse/1.0',
		...(process.env.PW_EXECUTABLE_PATH
			? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
			: {}),
	},
	projects: [
		{ name: 'seo', testMatch: /seo\.spec\.ts$/ },
		{ name: 'seo-unit', testMatch: /unit\/.*\.spec\.ts$/ },
	],
})
