import fs from 'node:fs/promises'

const outputDir = process.env.POS_RESULTS_DIR || 'pos-results'
const outputPath = `${outputDir}/order-ids.json`
const metadataPath = `${outputDir}/order-id-source.json`

const source = process.env.POS_ORDER_SOURCE || 'file'
const requireOrders = process.env.POS_REQUIRE_ORDERS === 'true'
const maxOrders = Number.parseInt(process.env.POS_ORDER_LIMIT || '10', 10)

await fs.mkdir(outputDir, { recursive: true })

const writeOutputs = async summary => {
	await fs.writeFile(outputPath, `${JSON.stringify(summary.orderIds, null, 2)}\n`)
	await fs.writeFile(metadataPath, `${JSON.stringify(summary, null, 2)}\n`)
}

if (source === 'file') {
	let orderIds = []

	try {
		const raw = await fs.readFile('order_ids.txt', 'utf8')
		orderIds = raw
			.split(/\r?\n/)
			.map(value => value.trim())
			.filter(Boolean)
		orderIds = [...new Set(orderIds)]
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error
		}
	}

	await writeOutputs({
		source,
		required: requireOrders,
		orderIds,
		orderCount: orderIds.length,
		status: orderIds.length > 0 ? 'ready' : 'skipped',
	})

	process.exit(0)
}

if (source !== 'endpoint') {
	throw new Error(`Unsupported POS_ORDER_SOURCE: ${source}`)
}

const baseRaw = process.env.POS_BASE_URL || ''
const auth = process.env.POS_QA_AUTH || ''

if (!baseRaw) {
	throw new Error('POS_BASE_URL is required when POS_ORDER_SOURCE=endpoint')
}

if (!auth) {
	throw new Error('POS_QA_AUTH is required when POS_ORDER_SOURCE=endpoint')
}

const base = baseRaw.replace(/\/+$/, '')
const endpoint = `${base}/wp-content/plugins/persy/interface/qa/orders/?auth=${encodeURIComponent(auth)}`
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 20000)

let response
try {
	response = await fetch(endpoint, {
		headers: { Accept: 'application/json' },
		signal: controller.signal,
	})
} finally {
	clearTimeout(timeout)
}

if (!response.ok) {
	throw new Error(`Order endpoint returned HTTP ${response.status}`)
}

const payload = await response.json()
const orderIds = Array.isArray(payload.orders)
	? payload.orders
			.slice(0, maxOrders)
			.map(order => order.woocommerceId)
			.filter(Boolean)
	: []

await writeOutputs({
	source,
	required: requireOrders,
	orderIds,
	orderCount: orderIds.length,
	status: orderIds.length > 0 ? 'ready' : 'skipped',
	baseUrl: base,
})

if (requireOrders && orderIds.length === 0) {
	process.exit(1)
}
