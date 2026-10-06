#!/usr/bin/env node
// Never sends Slack. Daily System Health owns the one combined message.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { collect } from './report.mjs'
import { toHealthResult } from '../lib/health-results.mjs'

const outRoot = path.resolve(process.env.SEO_OUT_ROOT || 'seo/out')
const healthDir = path.resolve(process.env.HEALTH_RESULTS_DIR || 'health-results')
const runUrl = process.env.RUN_URL || ''
const sites = collect(outRoot, loadConfig())
const results = sites.map(site => toHealthResult(site, runUrl))
const markdown = ['## SEO', '', ...results.map(result => result.seoMarkdown)].join('\n')
mkdirSync(healthDir, { recursive: true })
mkdirSync(outRoot, { recursive: true })
for (const result of results)
	writeFileSync(path.join(healthDir, `${result.id}.json`), JSON.stringify(result, null, 2) + '\n')
writeFileSync(path.join(outRoot, 'report.md'), markdown)
if (process.env.GITHUB_STEP_SUMMARY)
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n')
console.log(
	`SEO health results: ${results.map(result => `${result.label}: ${result.status}`).join(', ')}`,
)
