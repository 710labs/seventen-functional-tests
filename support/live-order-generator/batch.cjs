const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const generatedBatchIds = new Set()
const isBatchId = value => typeof value === 'string' && /^[0-9A-Z]{6}$/.test(value)

function assertBatchId(value) {
	if (!isBatchId(value)) throw new Error('A six-character LIVE_ORDER_BATCH_ID is required; use npm run live:stage:generate-orders')
	return value
}

function createBatch(directory) {
	fs.mkdirSync(directory, { recursive: true })
	if (fs.readdirSync(directory).length) {
		throw new Error('Existing batch or order evidence found; archive output/live-order-generator before starting a new run')
	}
	let batchId
	do {
		batchId = crypto.randomInt(36 ** 6).toString(36).toUpperCase().padStart(6, '0')
	} while (generatedBatchIds.has(batchId))
	generatedBatchIds.add(batchId)
	const batch = { batchId, createdAt: new Date().toISOString() }
	// Exclusive creation prevents two local invocations from sharing the same output directory.
	fs.writeFileSync(path.join(directory, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' })
	return batch
}

function readBatch(directory) {
	const file = path.join(directory, 'batch.json')
	if (!fs.existsSync(file)) return null
	const batch = JSON.parse(fs.readFileSync(file, 'utf8'))
	assertBatchId(batch?.batchId)
	if (typeof batch.createdAt !== 'string' || !Number.isFinite(Date.parse(batch.createdAt))) throw new Error('Invalid batch creation time')
	return { batchId: batch.batchId, createdAt: batch.createdAt }
}

module.exports = { isBatchId, assertBatchId, createBatch, readBatch }
