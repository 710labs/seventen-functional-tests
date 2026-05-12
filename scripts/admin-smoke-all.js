#!/usr/bin/env node

const { spawnSync } = require('child_process')

const configArgs = ['playwright', 'test', '--config=configs/admin-drop.config.ts', '--workers=1']
const extraArgs = process.argv.slice(2)
const fullMenuFixture = process.env.ADMIN_SMOKE_ALL_MENU_FIXTURE || 'ca-menu-4-7-25'

const phases = [
	{
		name: 'Default non-destructive admin smoke',
		args: ['--grep-invert', 'Menu upload|@rules'],
	},
	{
		name: `Menu upload (${fullMenuFixture})`,
		args: ['--grep', 'Menu upload'],
		env: {
			MENU_UPLOAD_FIXTURE: fullMenuFixture,
		},
	},
	{
		name: 'Focused rule: minimum order',
		args: ['--grep', '@minorder'],
	},
	{
		name: 'Focused rule: max quantity',
		args: ['--grep', '@maxqty'],
	},
]

const startedAt = Date.now()
const results = []
let shouldSkipRemaining = false

function formatDuration(ms) {
	const seconds = Math.round(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60

	if (minutes === 0) {
		return `${remainder}s`
	}

	return `${minutes}m ${remainder}s`
}

function printPhaseHeader(index, phase) {
	console.log('')
	console.log('='.repeat(80))
	console.log(`Admin Drop Smoke Phase ${index + 1}/${phases.length}: ${phase.name}`)
	console.log('='.repeat(80))
}

for (const [index, phase] of phases.entries()) {
	if (shouldSkipRemaining) {
		results.push({
			name: phase.name,
			status: 'SKIPPED',
			durationMs: 0,
			exitCode: null,
		})
		continue
	}

	printPhaseHeader(index, phase)

	const phaseStartedAt = Date.now()
	const result = spawnSync('npx', [...configArgs, ...phase.args, ...extraArgs], {
		stdio: 'inherit',
		env: {
			...process.env,
			...(phase.env || {}),
		},
	})
	const durationMs = Date.now() - phaseStartedAt
	const exitCode = typeof result.status === 'number' ? result.status : 1

	results.push({
		name: phase.name,
		status: exitCode === 0 ? 'PASSED' : 'FAILED',
		durationMs,
		exitCode,
	})

	if (exitCode !== 0) {
		shouldSkipRemaining = true
	}
}

const totalDurationMs = Date.now() - startedAt
const passed = results.filter(result => result.status === 'PASSED').length
const failed = results.filter(result => result.status === 'FAILED').length
const skipped = results.filter(result => result.status === 'SKIPPED').length

console.log('')
console.log('='.repeat(80))
console.log('Admin Drop Smoke Overall Summary')
console.log('='.repeat(80))

for (const [index, result] of results.entries()) {
	const duration = result.status === 'SKIPPED' ? '-' : formatDuration(result.durationMs)
	console.log(`${index + 1}. ${result.status.padEnd(7)} ${duration.padStart(8)}  ${result.name}`)
}

console.log('')
console.log(
	`Overall: ${failed === 0 ? 'PASSED' : 'FAILED'} (${passed}/${results.length} phases passed, ${failed} failed, ${skipped} skipped)`,
)
console.log(`Total duration: ${formatDuration(totalDurationMs)}`)

process.exit(failed === 0 ? 0 : 1)
