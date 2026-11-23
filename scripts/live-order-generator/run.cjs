const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createBatch } = require('../../support/live-order-generator/batch.cjs')

function runGenerator({ directory = path.resolve('output/live-order-generator'), args = [], spawn = spawnSync } = {}) {
	const batch = createBatch(directory)
	console.log(`Live Stage order batch: ${batch.batchId}`)
	const child = spawn(process.execPath, [
		path.resolve(__dirname, '../run-public-playwright.js'),
		`--config=${path.resolve(__dirname, '../../configs/live-order-generator.config.ts')}`,
		...args,
	], { stdio: 'inherit', env: { ...process.env, LIVE_ORDER_BATCH_ID: batch.batchId } })
	return child.status === 0 && !child.signal && !child.error ? 0 : child.status || 1
}

if (require.main === module) {
	try { process.exitCode = runGenerator({ args: process.argv.slice(2) }) }
	catch {
		console.error('Unable to initialize a fresh Live Stage order batch. Archive output/live-order-generator and check directory access before retrying.')
		process.exitCode = 1
	}
}

module.exports = { runGenerator }
