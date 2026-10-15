#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
function sourceFiles(directory) {
	if (!fs.existsSync(directory)) return []
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = path.join(directory, entry.name)
		return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : []
	})
}
function validate(directory = root) {
	const errors = []
	const read = file => fs.readFileSync(path.join(directory, file), 'utf8')
	const configs = [...fs.readdirSync(path.join(directory, 'configs')).filter(f => f.endsWith('.config.ts')).map(f => `configs/${f}`), 'playwright.config.ts', 'utils_playwright.config.ts', 'local.config.ts']
	for (const file of configs) {
		const source = read(file)
		for (const key of ['trace', 'video', 'screenshot']) {
			const values = [...source.matchAll(new RegExp(`\\b${key}:\\s*([^,\\n]+)`, 'g'))].map(m => m[1])
			if (!values.length || values.some(value => value !== "'off'")) errors.push(`${file}: ${key} must be off`)
		}
		if (!source.includes('reporters/security/public-summary-reporter.cjs')) errors.push(`${file}: missing safe reporter`)
		const reporterBlock = source.match(/reporter:\s*\[([\s\S]*?)(?=\n\t[A-Za-z])/)?.[1] || ''
		const unapproved = reporterBlock.replace(/['"]\.\.?\/reporters\/(?:security\/public-summary-reporter\.cjs|slack\/pw-slack-webhook-reporter\.ts|health\/pw-health-json-reporter\.ts)['"]/g, '').replace(/[\s\[\],]/g, '')
		if (!reporterBlock || unapproved) errors.push(`${file}: reporter is not allowlisted`)
		if (/\['(?:list|line|dot|html|json|blob)'|tesults|reporters\/s3|github-actions-reporter|playwright-slack-report/.test(source)) errors.push(`${file}: unsafe reporter`)
		if (/eyJ[A-Za-z0-9_-]{30}/.test(source)) errors.push(`${file}: embedded credential`)
	}
	// Config defaults do not cover test.use(), fixture extensions, or imported
	// option objects. Flag recording options in the test/support source as well.
	const testSources = ['tests', 'utils', 'models', 'support'].flatMap(folder => sourceFiles(path.join(directory, folder)))
	if (fs.existsSync(path.join(directory, 'options.ts'))) testSources.push(path.join(directory, 'options.ts'))
	for (const file of testSources) {
		const source = fs.readFileSync(file, 'utf8')
		for (const match of source.matchAll(/\b(trace|video|screenshot)['"]?\s*:\s*([^,\n}]+)/g)) {
			if (!/^\[?\s*(['"])off\1\s*$/.test(match[2])) errors.push(`${path.relative(directory, file)}: ${match[1]} override must be off`)
		}
	}
	for (const file of fs.readdirSync(path.join(directory, '.github/workflows'))) {
		const source = read(`.github/workflows/${file}`)
		// Check every upload step, including multiline paths, independent of action version.
		for (const match of source.matchAll(/^      - .*?(?=^ {0,6}\S|$(?![\s\S]))/gms)) {
			if (/actions\/upload-artifact/.test(match[0]) && /playwright-report|test-results|blob-report|acuity-auth-artifacts|\.auth\//.test(match[0])) errors.push(`${file}: raw browser artifact upload`)
		}
		if (/\b(?:npx )?playwright test\b|--reporter(?:=|\s)|--trace(?:=|\s)|playwright merge-reports|run:.*upload-playwright-report-s3/.test(source)) errors.push(`${file}: bypasses safe runner`)
	}
	const scripts = JSON.parse(read('package.json')).scripts
	for (const [name, command] of Object.entries(scripts)) {
		if (/\bplaywright test\b|--reporter(?:=|\s)|--trace(?:=|\s)/.test(command)) errors.push(`npm ${name}: bypasses safe runner`)
	}
	return errors
}
if (require.main === module) {
	const errors = validate()
	if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
	else console.log('Public Playwright reporting policy passed.')
}
module.exports = { validate }
