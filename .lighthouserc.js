const asNumber = (value, fallback) => {
	const parsed = Number.parseFloat(value ?? '')
	return Number.isFinite(parsed) ? parsed : fallback
}

module.exports = {
	ci: {
		collect: {
			url: [process.env.LHCI_TARGET_URL || 'http://localhost'],
			numberOfRuns: Number.parseInt(process.env.LH_RUNS || '3', 10),
			settings: {
				chromeFlags: '--no-sandbox --headless',
				preset: 'desktop',
				skipAudits: ['uses-http2'],
			},
		},
		assert: {
			assertions: {
				'categories:performance': ['error', { minScore: asNumber(process.env.LH_PERF_MIN, 0.75) }],
				'categories:accessibility': ['warn', { minScore: asNumber(process.env.LH_A11Y_MIN, 0.75) }],
				'categories:best-practices': ['warn', { minScore: asNumber(process.env.LH_BP_MIN, 0.75) }],
				'categories:seo': ['warn', { minScore: asNumber(process.env.LH_SEO_MIN, 0.8) }],
				'first-contentful-paint': ['warn', { maxNumericValue: asNumber(process.env.LH_FCP_MAX, 3000) }],
				'largest-contentful-paint': ['error', { maxNumericValue: asNumber(process.env.LH_LCP_MAX, 4000) }],
				'cumulative-layout-shift': ['error', { maxNumericValue: asNumber(process.env.LH_CLS_MAX, 0.1) }],
				'total-blocking-time': ['warn', { maxNumericValue: asNumber(process.env.LH_TBT_MAX, 600) }],
			},
		},
		upload: {
			target: 'filesystem',
			outputDir: process.env.LH_OUTPUT_DIR || '.lighthouseci',
		},
	},
}
