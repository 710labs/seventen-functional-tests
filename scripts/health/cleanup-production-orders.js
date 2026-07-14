#!/usr/bin/env node
const fs = require('node:fs')
const { getCheck, readResult, resultPath, writeResult } = require('./result-utils')

function readOrderIds(files) {
	return [
		...new Set(
			files.flatMap(file =>
				fs.existsSync(file)
					? fs
							.readFileSync(file, 'utf8')
							.split(/\r?\n/)
							.map(value => value.trim())
							.filter(Boolean)
					: [],
			),
		),
	]
}

async function cancelOrders({
	ids,
	baseUrl,
	consumerKey,
	consumerSecret,
	fetchImpl = fetch,
}) {
	const authorization = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
	for (const id of ids) {
		const url = new URL(
			`/wp-json/wc/v3/orders/${encodeURIComponent(id)}`,
			`${baseUrl.replace(/\/+$/, '')}/`,
		)
		const response = await fetchImpl(url, {
			method: 'PUT',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'cancelled' }),
			signal: AbortSignal.timeout(20000),
		})
		if (!response.ok) throw new Error(`order ${id} returned HTTP ${response.status}`)
		console.log(`Cancelled production test order ${id}.`)
	}
}

function markCleanupFailure(check, error, outputFile = resultPath(check.id)) {
	const existing = fs.existsSync(outputFile) ? readResult(outputFile) : {}
	writeResult(
		check,
		{
			...existing,
			status: 'failed',
			finishedAt: new Date().toISOString(),
			failureSummary: [
				...(existing.failureSummary || []),
				`Production order cleanup failed: ${error.message}`,
			],
		},
		outputFile,
	)
}

async function main() {
	const check = getCheck(process.argv[2])
	const files = process.argv.slice(3)
	const ids = readOrderIds(files.length ? files : ['order_ids.txt', 'order_id.txt'])
	if (!ids.length) {
		console.log(`No production test orders were recorded for ${check.label}.`)
		return
	}

	try {
		const baseUrl = process.env.BASE_URL || ''
		const consumerKey = process.env.WC_CONSUMER_KEY || ''
		const consumerSecret = process.env.WC_CONSUMER_SECRET || ''
		const missing = [
			!baseUrl && 'BASE_URL',
			!consumerKey && 'WC_CONSUMER_KEY',
			!consumerSecret && 'WC_CONSUMER_SECRET',
		].filter(Boolean)
		if (missing.length) throw new Error(`missing required configuration: ${missing.join(', ')}`)
		await cancelOrders({ ids, baseUrl, consumerKey, consumerSecret })
	} catch (error) {
		markCleanupFailure(check, error)
		throw error
	}
}

if (require.main === module) {
	main().catch(error => {
		console.error(`Production order cleanup failed: ${error.message}`)
		process.exitCode = 1
	})
}

module.exports = { cancelOrders, markCleanupFailure, readOrderIds }
