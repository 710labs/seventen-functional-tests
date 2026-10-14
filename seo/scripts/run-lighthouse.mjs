#!/usr/bin/env node
// Pass config-derived URLs as arguments, never interpolate them into shell commands.
import { spawnSync } from 'node:child_process'
import { resolveSite } from '../lib/config.mjs'
const site = resolveSite()
const result = spawnSync(
	process.execPath,
	[
		'node_modules/@lhci/cli/src/cli.js',
		'autorun',
		`--config=seo/lighthouse/lighthouserc.${site.robotsExpectedState}.json`,
		...(site.lighthousePages ?? site.keyPages).map(p => `--collect.url=${site.baseUrl}${p}`),
	],
	{ stdio: 'inherit' },
)
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
