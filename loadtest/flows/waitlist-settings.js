const WAITLIST_PRESETS = new Map([
	['Off', 0],
	['Smoke (1 user)', 1],
	...[5, 25, 50, 100, 150, 200].map(browsers => [`${browsers} users`, browsers]),
])

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

function workerCount(browsers, maxPerWorker = 10) {
	// Fargate runs the rendered per-worker phase on every worker.
	// Use an exact divisor so the browser allocation is preserved.
	const perWorker = Math.min(browsers, maxPerWorker)
	const size = Array.from({ length: perWorker }, (_, offset) => perWorker - offset)
		.find(candidate => browsers % candidate === 0)
	return browsers / size
}

function allocateMixedProducts(pool, count, spare) {
	const workersFor = Array.from({ length: count }, (_, index) => workerCount(index + 1, 5))
	let plans = new Map([[0, { workers: 0, imbalance: 0, include: [] }]])

	// Every worker runs the same arrivals for its product. Choose product counts
	// that minimize workers, then keep extra arrivals as even as possible.
	for (const product of pool) {
		const nextPlans = new Map()
		const minimum = product.stock + 1
		for (const [allocated, plan] of plans) {
			const max = Math.min(minimum + spare, count - allocated)
			for (let browsers = minimum; browsers <= max; browsers += 1) {
				const workers = workersFor[browsers - 1]
				const totalWorkers = plan.workers + workers
				const imbalance = plan.imbalance + (browsers - minimum) ** 2
				const total = allocated + browsers
				const previous = nextPlans.get(total)
				if (previous && (previous.workers < totalWorkers ||
					(previous.workers === totalWorkers && previous.imbalance <= imbalance))) continue
				nextPlans.set(total, {
					workers: totalWorkers,
					imbalance,
					include: [...plan.include, { ...product, browsers, checkoutBrowsers: browsers, workers }],
				})
			}
		}
		plans = nextPlans
	}

	return plans.get(count).include
}

function planWaitlist({ mode, preset, products, checkoutProducts, facility, cartItems }) {
	const total = WAITLIST_PRESETS.get(preset)
	if (total === undefined) throw new Error('Select a supported waitlist preset.')
	const siteWaitlistOnly = mode === 'site-waitlist-only'
	const checkoutIds = siteWaitlistOnly ? [] : parseProductIds(checkoutProducts)
	const evenSplit = mode === 'mixed'
	const mixed = evenSplit || ['flip', 'bypass-only', 'realqueue-only'].includes(mode)
	if (evenSplit && (total < 2 || total % 2 !== 0)) {
		throw new Error('Mixed mode requires an even total. Select 50, 100, 150, or 200 users.')
	}
	const count = evenSplit ? total / 2 : total

	if (count === 0) {
		if (siteWaitlistOnly || mode === 'waitlist-only') {
			throw new Error(`${mode} requires a waitlist preset with at least one user.`)
		}
		return { include: [], checkoutIds, facility: '', duration: 0 }
	}
	if (!mixed && !['waitlist-only', 'site-waitlist-only', 'dry'].includes(mode)) {
		throw new Error('Waitlist traffic requires a browser mode, waitlist-only, site-waitlist-only, or dry.')
	}
	const seconds = count === 1 ? 1 : 30
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
	const include = evenSplit ? allocateMixedProducts(pool, count, spare) : pool.map((product, index) => {
		const browsers = product.stock + 1 + Math.floor(spare / pool.length) + Number(index < spare % pool.length)
		return { ...product, browsers, workers: workerCount(browsers) }
	})

	return { include, checkoutIds, facility: facilityId, duration: seconds }
}

module.exports = { integer, parseProductIds, planWaitlist }
