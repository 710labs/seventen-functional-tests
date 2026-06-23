#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const defaultInputPath = '.auth/acuity-storage-state.json'
const defaultOutputPath = '.auth/acuity-storage-state.slim.json'
const secretSizeLimitBytes = 48 * 1024
const allowedCookieDomains = ['squarespace.com', 'acuityscheduling.com']

const inputPath = process.argv[2] || defaultInputPath
const outputPath = process.argv[3] || defaultOutputPath
const workspace = process.cwd()
const resolvedInputPath = path.resolve(workspace, inputPath)
const resolvedOutputPath = path.resolve(workspace, outputPath)

function isInsideWorkspace(resolvedPath) {
	const relativePath = path.relative(workspace, resolvedPath)
	return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function fail(message) {
	console.error(message)
	process.exit(1)
}

function cookieDomainMatches(cookieDomain) {
	const normalizedCookieDomain = String(cookieDomain || '')
		.toLowerCase()
		.replace(/^\./, '')

	return allowedCookieDomains.some(
		allowedDomain =>
			normalizedCookieDomain === allowedDomain ||
			normalizedCookieDomain.endsWith(`.${allowedDomain}`),
	)
}

if (!isInsideWorkspace(resolvedInputPath) || !isInsideWorkspace(resolvedOutputPath)) {
	fail('Acuity storage state input and output paths must stay inside the workspace.')
}

if (!fs.existsSync(resolvedInputPath)) {
	fail(`Acuity storage state file does not exist: ${inputPath}`)
}

let state
try {
	state = JSON.parse(fs.readFileSync(resolvedInputPath, 'utf8'))
} catch (error) {
	fail(`Acuity storage state file is not valid JSON: ${error.message}`)
}

if (!Array.isArray(state.cookies)) {
	fail('Acuity storage state is missing a cookies array.')
}

const slimState = {
	cookies: state.cookies.filter(cookie => cookieDomainMatches(cookie.domain)),
	origins: [],
}
const output = `${JSON.stringify(slimState, null, 2)}\n`
const base64Size = Buffer.byteLength(Buffer.from(output).toString('base64'))

fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
fs.writeFileSync(resolvedOutputPath, output)

console.log(`Wrote ${outputPath}`)
console.log(`Cookies kept: ${slimState.cookies.length} of ${state.cookies.length}`)
console.log(`State size: ${Buffer.byteLength(output)} bytes`)
console.log(`Base64 size: ${base64Size} bytes`)

if (base64Size > secretSizeLimitBytes) {
	fail(
		`Slim Acuity storage state is still larger than GitHub's ${secretSizeLimitBytes} byte secret limit.`,
	)
}

