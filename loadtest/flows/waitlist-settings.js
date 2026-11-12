function integer(value, label, minimum = 1) {
	const parsed = Number(value)
	if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(parsed) || parsed < minimum) {
		throw new Error(`${label} must be an integer of at least ${minimum}.`)
	}
	return parsed
}

function parseProductIds(raw = '') {
	if (!raw.trim()) return []
	const ids = raw.split(',').map(value => String(integer(value.trim(), 'Product ID')))
	if (new Set(ids).size !== ids.length) throw new Error('Product IDs must be unique.')
	return ids
}

function workerCount(browsers) {
	// Fargate runs the rendered per-worker phase on every worker.
	// Use an exact divisor so the browser allocation is preserved.
	const perWorker = Math.min(browsers, 10)
	const size = Array.from({ length: perWorker }, (_, offset) => perWorker - offset)
		.find(candidate => browsers % candidate === 0)
	return browsers / size
}

function planWaitlist({ mode, browsers, products, checkoutProducts, facility, duration, cartItems }) {
	const count = integer(browsers, 'waitlist_browsers', 0)
	const siteWaitlistOnly = mode === 'site-waitlist-only'
	const checkoutIds = siteWaitlistOnly ? [] : parseProductIds(checkoutProducts)
	const mixed = ['flip', 'bypass-only', 'realqueue-only'].includes(mode)

	if (count === 0) {
		if (siteWaitlistOnly || mode === 'waitlist-only') {
			throw new Error(`${mode} requires waitlist_browsers above zero.`)
		}
		return { include: [], checkoutIds, facility: '', duration: 0 }
	}
	if (!mixed && !['waitlist-only', 'site-waitlist-only', 'dry'].includes(mode)) {
		throw new Error('Waitlist traffic requires a browser mode, waitlist-only, site-waitlist-only, or dry.')
	}
	if (count > 200) throw new Error('waitlist_browsers must be at most 200.')
	const seconds = integer(duration, 'waitlist_duration_seconds')
	if (seconds > 900) throw new Error('waitlist_duration_seconds must be at most 900.')
	const facilityId = String(integer(facility, 'waitlist_facility_id'))
	if (siteWaitlistOnly || (mode === 'dry' && !products.trim())) {
		return {
			include: [{ id: 'catalog', stock: 0, browsers: count, workers: workerCount(count) }],
			checkoutIds: [],
			facility: facilityId,
			duration: seconds,
		}
	}
	const entries = products.split(',').map(entry => entry.trim().split(':'))
	if (entries.some(entry => entry.length !== 2)) {
		throw new Error('waitlist_products must use productId:startingStock pairs.')
	}
	const ids = parseProductIds(entries.map(([id]) => id.trim()).join(','))
	const pool = ids.map((id, index) => ({
		id,
		stock: integer(entries[index][1].trim(), `Starting stock for product ${id}`, 0),
	}))
	if (pool.length === 0) throw new Error('Provide at least one waitlist product.')
	if (ids.some(id => checkoutIds.includes(id))) {
		throw new Error('Checkout and waitlist product pools must be disjoint.')
	}
	if (mixed && checkoutIds.length < integer(cartItems, 'cart_item_count')) {
		throw new Error('Mixed runs require at least cart_item_count distinct checkout products.')
	}

	const minimum = pool.reduce((sum, product) => sum + product.stock + 1, 0)
	if (count < minimum) {
		throw new Error(`This pool requires at least ${minimum} waitlist browsers to hold stock and join each waitlist.`)
	}
	const spare = count - minimum
	const include = pool.map((product, index) => {
		const browsers = product.stock + 1 + Math.floor(spare / pool.length) + Number(index < spare % pool.length)
		return { ...product, browsers, workers: workerCount(browsers) }
	})

	return { include, checkoutIds, facility: facilityId, duration: seconds }
}

module.exports = { integer, parseProductIds, planWaitlist }
