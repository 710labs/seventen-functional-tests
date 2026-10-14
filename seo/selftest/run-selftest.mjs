#!/usr/bin/env node
/**
 * Regression tests for the SEO pulse itself.
 *
 * Serves the fixture sites in seo/selftest/fixtures on localhost, runs the real SEO suite
 * against each scenario in sites.selftest.json, and asserts the EXACT set of failures,
 * warnings and fixed-known-issue flags. If someone weakens a check, breaks the known-issues
 * mechanism, or makes an outage downgrade to a warning, this fails the PR.
 *
 *   node seo/selftest/run-selftest.mjs            # all scenarios
 *   node seo/selftest/run-selftest.mjs outage     # one scenario
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeTechnical, checkIdOf } from '../lib/results.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const CONFIG = 'seo/selftest/sites.selftest.json'
const cfg = JSON.parse(readFileSync(path.join(here, 'sites.selftest.json'), 'utf8'))

// Expected outcome per scenario. ids are check ids (text before ": " in the annotation).
const EXPECT = {
	good: { exit: 0, failures: [], warnings: [], fixed: [], otherErrors: 0 },
	'good-stale-known': {
		exit: 0,
		failures: [],
		warnings: [],
		fixed: ['single-h1:/shop/'],
		otherErrors: 0,
	},
	'prod-strict': {
		exit: 1,
		failures: ['img-alt:/shop/', 'org-schema:/shop/', 'single-h1:/shop/'],
		warnings: ['sitemap-present'], // launch-readiness gap only warns while robots is blocked
		fixed: [],
		otherErrors: 0,
	},
	'prod-known': {
		exit: 0,
		failures: [],
		warnings: ['img-alt:/shop/', 'org-schema:/shop/', 'single-h1:/shop/', 'sitemap-present'],
		fixed: [],
		otherErrors: 0,
	},
	'prod-launched': {
		exit: 1,
		failures: ['robots-sitemap-ref', 'robots-state', 'sitemap-present'],
		warnings: ['img-alt:/shop/', 'org-schema:/shop/', 'single-h1:/shop/'],
		fixed: [],
		otherErrors: 0,
	},
	regressed: {
		exit: 1,
		failures: [
			'product-description-unique:/product/gak-smoovie-5/',
			'product-noindex:/product/rambutan-11/',
			'product-schema:/product/rambutan-11/',
			'product-title-unique:/product/gak-smoovie-5/',
		],
		warnings: [],
		fixed: [],
		otherErrors: 0,
	},
	// Outages hard-fail even though bogus ids for them are listed in knownIssues.
	outage: {
		exit: 1,
		failures: [],
		warnings: [],
		fixed: [],
		otherErrors: 2,
		otherErrorsMatch: [/HTTP 404/, /no product links/],
	},
}

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.txt': 'text/plain',
	'.xml': 'application/xml',
}

function serve(dir, port) {
	const server = http.createServer(async (req, res) => {
		let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
		if (rel.endsWith('/')) rel += 'index.html'
		const file = path.join(dir, path.normalize(rel))
		if (!file.startsWith(dir)) return res.writeHead(403).end()
		try {
			if (!(await stat(file)).isFile()) throw new Error('not a file')
			res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
			res.end(await readFile(file))
		} catch {
			res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Not found</h1>')
		}
	})
	return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)))
}

function runScenario(site) {
	return new Promise(resolve => {
		const outDir = `seo/out/selftest/${site.id}`
		const child = spawn(
			'npx',
			[
				'playwright',
				'test',
				'-c',
				'seo/playwright.seo.config.ts',
				'--project=seo',
				'--retries=0',
				'--reporter=json',
			],
			{
				env: {
					...process.env,
					SEO_CONFIG: CONFIG,
					SEO_SITE: site.id,
					SEO_OUT_DIR: outDir,
					SEO_ROTATION_SEED: '0',
					CI: '',
				},
				stdio: ['ignore', 'pipe', 'pipe'],
			},
		)
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', d => (stdout += d))
		child.stderr.on('data', d => (stderr += d))
		child.on('close', code => resolve({ code, stdout, stderr, outDir }))
	})
}

const sorted = a => [...new Set(a)].sort()
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

async function main() {
	const only = process.argv[2]
	const sites = cfg.sites.filter(s => !only || s.id === only)
	if (sites.length === 0) throw new Error(`no scenario "${only}"`)

	const servers = []
	const ports = new Map()
	for (const s of cfg.sites) {
		const port = Number(new URL(s.baseUrl).port)
		if (!ports.has(port)) {
			ports.set(port, s.fixture)
			servers.push(await serve(path.join(here, 'fixtures', s.fixture), port))
		} else if (ports.get(port) !== s.fixture) {
			throw new Error(`port ${port} mapped to two fixtures`)
		}
	}

	let failed = 0
	try {
		for (const site of sites) {
			const exp = EXPECT[site.id]
			if (!exp) throw new Error(`no expectation defined for scenario "${site.id}"`)
			const { code, stdout, stderr } = await runScenario(site)
			let summary
			try {
				summary = summarizeTechnical(JSON.parse(stdout))
			} catch {
				console.error(
					`✗ ${site.id}: could not parse Playwright JSON output\n${stderr.slice(0, 2000)}`,
				)
				failed++
				continue
			}
			const got = {
				exit: code === 0 ? 0 : 1,
				failures: summary.failures.map(checkIdOf),
				warnings: summary.warnings.map(checkIdOf),
				fixed: summary.fixedKnownIssues.map(checkIdOf),
				otherErrors: summary.otherErrors.length,
			}
			const problems = []
			if (got.exit !== exp.exit) problems.push(`exit ${got.exit}, expected ${exp.exit}`)
			for (const k of ['failures', 'warnings', 'fixed']) {
				if (!same(got[k], exp[k]))
					problems.push(
						`${k}: got ${JSON.stringify(sorted(got[k]))}, expected ${JSON.stringify(sorted(exp[k]))}`,
					)
			}
			if (got.otherErrors !== exp.otherErrors)
				problems.push(
					`otherErrors: got ${got.otherErrors} (${JSON.stringify(summary.otherErrors)}), expected ${exp.otherErrors}`,
				)
			for (const re of exp.otherErrorsMatch ?? []) {
				if (!summary.otherErrors.some(e => re.test(e)))
					problems.push(`no hard error matching ${re}`)
			}
			if (problems.length) {
				failed++
				console.error(`✗ ${site.id}\n   - ${problems.join('\n   - ')}`)
			} else {
				console.log(
					`✓ ${site.id}  (exit ${got.exit}; ${got.failures.length} failures, ${got.warnings.length} warnings, ${got.fixed.length} fixed, ${got.otherErrors} hard errors)`,
				)
			}
		}
	} finally {
		servers.forEach(s => s.close())
	}

	console.log(`\n${sites.length - failed}/${sites.length} self-test scenarios behaved as expected`)
	process.exit(failed ? 1 : 0)
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
