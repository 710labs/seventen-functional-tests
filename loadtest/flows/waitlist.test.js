const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { after, before, test } = require('node:test')
const { chromium } = require('@playwright/test')
const { addCheckoutProducts } = require('./drop-cart')
const { storeFunnelMixed } = require('./funnel')
const { runWaitlist } = require('./waitlist')
const { planWaitlist } = require('./waitlist-settings')

const planInput = {
	mode: 'bypass-only',
	preset: '25 users',
	products: '101:1,102:3,103:0',
	checkoutProducts: '201,202',
	facility: '1',
	cartItems: '2',
}

test('the planner budgets enough users for each product and retains exact worker caps', () => {
	const { include } = planWaitlist(planInput)
	assert.deepEqual(include.map(product => [product.id, product.browsers]), [
		['101', 8], ['102', 10], ['103', 7],
	])
	for (const { browsers, workers } of include) {
		assert.equal(browsers % workers, 0)
		assert.ok(browsers / workers <= 10)
	}
	assert.throws(() => planWaitlist({ ...planInput, preset: '5 users' }), /at least 7/)
	assert.throws(() => planWaitlist({ ...planInput, checkoutProducts: '101,202' }), /disjoint/)
	assert.throws(() => planWaitlist({ ...planInput, checkoutProducts: '' }), /checkout products/)
	assert.equal(planWaitlist({ ...planInput, mode: 'waitlist-only', checkoutProducts: '' }).include.length, 3)
	assert.equal(planWaitlist({ ...planInput, preset: 'Off', products: '', facility: '' }).include.length, 0)
})

test('site-wide waitlist uses one catalog job and requires no configured product IDs', () => {
	const inputs = { ...planInput, mode: 'site-waitlist-only', products: '', checkoutProducts: '' }
	const plan = planWaitlist(inputs)
	assert.deepEqual(plan.include, [{ id: 'catalog', stock: 0, browsers: 25, workers: 5 }])
	assert.equal(plan.duration, 30)
	assert.deepEqual(plan.checkoutIds, [])
	assert.deepEqual(planWaitlist({ ...inputs, mode: 'dry' }), plan)
	assert.throws(() => planWaitlist({ ...inputs, preset: 'Off' }), /at least one user/)
})

test('mixed presets split exact browser arrivals between waitlist and checkout', () => {
	const inputs = { ...planInput, mode: 'mixed' }
	const singleProduct = planWaitlist({ ...inputs, preset: '50 users', products: '101:0' })
	assert.deepEqual(singleProduct.include, [{ id: '101', stock: 0, browsers: 25, checkoutBrowsers: 25, workers: 5 }])
	assert.equal(singleProduct.duration, 30)
	const stageProducts = planWaitlist({ ...inputs, preset: '100 users', products: '225505:0,225498:0,225511:0' }).include
	assert.deepEqual(stageProducts.map(product => product.browsers).sort((left, right) => left - right), [15, 15, 20])
	assert.equal(stageProducts.reduce((sum, product) => sum + product.workers, 0), 10)
	for (const total of [50, 100, 150, 200]) {
		const { include } = planWaitlist({ ...inputs, preset: `${total} users` })
		assert.equal(include.reduce((sum, { browsers }) => sum + browsers, 0), total / 2)
		for (const { stock, browsers, checkoutBrowsers, workers } of include) {
			assert.equal(checkoutBrowsers, browsers)
			assert.equal(browsers % workers, 0)
			assert.ok(2 * browsers / workers <= 10)
			assert.ok(browsers > stock)
		}
	}
	const lowSpare = planWaitlist({ ...inputs, preset: '50 users', products: '101:10,102:10,103:0' }).include
	assert.equal(lowSpare.reduce((sum, product) => sum + product.browsers, 0), 25)
	assert.ok(lowSpare.every(product => product.browsers > product.stock && product.browsers % product.workers === 0))
	assert.throws(() => planWaitlist(inputs), /requires an even total/)
	assert.throws(() => planWaitlist({ ...inputs, preset: '50 users', products: '101:25' }), /at least 26 waitlist browsers/)
	assert.throws(() => planWaitlist({ ...inputs, preset: '50 users', checkoutProducts: '101,202' }), /disjoint/)
})

function metrics() {
	const events = new EventEmitter()
	const counters = {}
	events.on('counter', (name, amount) => { counters[name] = (counters[name] || 0) + amount })
	return { events, counters }
}

function menu(products, cartSize, options) {
	const cards = [...products].map(([id, stock]) => `
		<li class="product post-${id} ${stock ? 'instock' : 'outofstock'}">
			<span data-gtm4wp_product_data='${JSON.stringify({ internal_id: id, stocklevel: stock })}'></span>
			${stock && !options.siteWaitlistOnly ? `<button class="fasd_to_cart" data-id="${id}" data-facility="1" data-method="pickup">Add to cart</button>` : ''}
			${(!stock || options.earlyWaitlist || options.siteWaitlistOnly) && options.missingJoin !== id ? `<button class="waitlist-button" data-product_id="${id}">Join Waitlist</button>` : ''}
		</li>`).join('')
	return `
		<a class="cart-contents" href="/cart/">Cart (${cartSize})</a>
		<p class="woocommerce-error" hidden></p>
		<ul>${cards}</ul>
		${options.next ? '<nav class="woocommerce-pagination"><a class="next" href="/page/2/">Next</a></nav>' : ''}
		<div id="waitlistElement" hidden>
			<button type="button" aria-label="Close">Close</button>
			<form id="waitlistForm">
				<input type="hidden" id="waitlist_product_id">
				<input type="hidden" id="waitlist_method" value="pickup">
				<input type="hidden" id="waitlist_facility_id" value="1">
				<span id="waitlist_error"></span>
				<button type="button" id="waitlistSubmit">Join waitlist</button>
			</form>
		</div>
		<script>
			document.querySelector('#waitlistElement [aria-label="Close"]').onclick = () => {
				document.querySelector('#waitlistElement').hidden = true;
			};
			document.querySelectorAll('.fasd_to_cart').forEach(button => {
				button.onclick = async () => {
					const result = await fetch('/add/' + button.dataset.id, { method: 'POST' });
					if (result.ok) {
						document.querySelector('.cart-contents').textContent = 'Cart (' + await result.text() + ')';
					} else {
						const error = document.querySelector('.woocommerce-error');
						error.textContent = 'This item is out of stock';
						error.hidden = false;
					}
				};
			});
			document.querySelectorAll('.waitlist-button').forEach(button => {
				button.onclick = () => {
					document.querySelector('#waitlist_product_id').value = button.dataset.product_id;
					document.querySelector('#waitlistElement').hidden = false;
				};
			});
			document.querySelector('#waitlistSubmit').onclick = async () => {
				const id = document.querySelector('#waitlist_product_id').value;
				await fetch('/join/' + id, { method: 'POST' });
				const button = document.querySelector('.waitlist-button[data-product_id="' + id + '"]');
				button.textContent = 'On waitlist';
				button.classList.add('on-waitlist');
				button.setAttribute('aria-disabled', 'true');
				if (!${Boolean(options.keepModalOpen)}) document.querySelector('#waitlistElement').hidden = true;
			};
		</script>`
}

let browser
before(async () => { browser = await chromium.launch() })
after(async () => { await browser?.close() })

async function shopper(t, products, calls, options = {}) {
	const context = await browser.newContext()
	t.after(() => context.close())
	const cart = new Set()
	await context.route('https://waitlist.fixture/**', async route => {
		const path = new URL(route.request().url()).pathname
		const [, action, id] = path.split('/')
		switch (action) {
			case 'add':
				calls.push(path)
				if (!products.get(id)) return route.fulfill({ status: 409 })
				products.set(id, products.get(id) - 1)
				cart.add(id)
				return route.fulfill({ body: String(cart.size) })
			case 'join':
				calls.push(path)
				return route.fulfill({ status: 200 })
			case 'cart':
				return route.fulfill({
					contentType: 'text/html',
					body: cart.size
						? [...cart].map(product => `<div class="cart_item"><a data-product_id="${product}">Remove</a></div>`).join('')
						: '<p>Your cart is empty</p>',
				})
			default:
				return route.fulfill({
					contentType: 'text/html',
					body: path === '/page/2/'
						? menu(options.secondPage, cart.size, options)
						: menu(products, cart.size, { ...options, next: Boolean(options.secondPage) }),
				})
		}
	})
	const page = await context.newPage()
	await page.goto('https://waitlist.fixture/')
	return page
}

function waitlistEnv(stock, facility = '1') {
	return {
		ARTILLERY_WAITLIST_PRODUCT_ID: '101',
		ARTILLERY_WAITLIST_STARTING_STOCK: String(stock),
		ARTILLERY_WAITLIST_FACILITY_ID: facility,
	}
}

test('the mixed browser flow sends equal numbers of shoppers to each product pool', async t => {
	const env = {
		...waitlistEnv(0),
		ARTILLERY_WAITLIST_CATALOG: 'false',
		ARTILLERY_CHECKOUT_PRODUCT_IDS: '201',
		ARTILLERY_CART_ITEM_COUNT: '1',
	}
	for (const [name, value] of Object.entries(env)) {
		const previous = process.env[name]
		process.env[name] = value
		t.after(() => {
			if (previous === undefined) delete process.env[name]
			else process.env[name] = previous
		})
	}
	const products = new Map([['101', 0], ['201', 20]])
	const calls = []
	const pages = await Promise.all(Array.from({ length: 4 }, () => shopper(t, products, calls)))
	const { events, counters } = metrics()
	const test = {
		// Start from the seeded storefront and exercise both cohorts' product actions.
		step: (name, run) => ['Join waitlist', 'Add To Cart'].includes(name) ? run() : undefined,
	}
	await Promise.all(pages.map(page => storeFunnelMixed(page, {}, events, test)))
	assert.equal(calls.filter(call => call === '/join/101').length, 2)
	assert.equal(calls.filter(call => call === '/add/201').length, 2)
	assert.equal(calls.length, 4)
	assert.equal(counters['mixed.waitlist_started'], 2)
	assert.equal(counters['mixed.checkout_started'], 2)
	assert.equal(counters['mixed.waitlist_completed'], 2)
	assert.equal(counters['mixed.checkout_completed'], 2)
})

test('concurrent stale buttons produce one hold and one confirmed join alongside checkout traffic', async t => {
	const products = new Map([['101', 1], ['201', 20]])
	const calls = []
	const [first, second, checkout] = await Promise.all([
		shopper(t, products, calls),
		shopper(t, products, calls),
		shopper(t, products, calls),
	])
	const { events, counters } = metrics()
	await Promise.all([
		runWaitlist(first, events, waitlistEnv(1)),
		runWaitlist(second, events, waitlistEnv(1)),
		addCheckoutProducts(checkout, ['201'], 1, 'Recreational', events, '1'),
	])
	assert.deepEqual(calls.filter(call => call.endsWith('/101')), ['/add/101', '/add/101', '/join/101'])
	assert.deepEqual(calls.filter(call => call.endsWith('/201')), ['/add/201'])
	assert.equal(counters['waitlist.cart_holds'], 1)
	assert.equal(counters['waitlist.stock_rejections'], 1)
	assert.equal(counters['waitlist.stock_recoveries'], 1)
	assert.equal(counters['waitlist.confirmed'], 1)
})

test('waitlist shown at positive stock fails before any cart or waitlist write', async t => {
	const calls = []
	const page = await shopper(t, new Map([['101', 1]]), calls, { earlyWaitlist: true })
	const { events, counters } = metrics()
	await assert.rejects(runWaitlist(page, events, waitlistEnv(1)), /with 1 units available/)
	assert.equal(counters['waitlist.appeared_before_zero'], 1)
	assert.deepEqual(calls, [])
})

test('an unexpected pickup facility fails before submitting the modal', async t => {
	const calls = []
	const page = await shopper(t, new Map([['101', 0]]), calls)
	await assert.rejects(runWaitlist(page, metrics().events, waitlistEnv(0, '2')), /unexpected facility_id/)
	assert.deepEqual(calls, [])
})

test('checkout recovers from stale inventory using only the configured pool', async t => {
	const products = new Map([['201', 1], ['101', 10], ['202', 10]])
	const calls = []
	const page = await shopper(t, products, calls)
	products.set('201', 0)
	const { events, counters } = metrics()
	await addCheckoutProducts(page, ['201', '202'], 1, 'Recreational', events, '1')
	assert.deepEqual(calls, ['/add/201', '/add/202'])
	assert.equal(counters['checkout.stock_rejections'], 1)
	assert.equal(counters['checkout.stock_recoveries'], 1)
})

const catalogEnv = {
	ARTILLERY_WAITLIST_FACILITY_ID: '1',
	ARTILLERY_WAITLIST_CATALOG: 'true',
}

test('concurrent site-wide shoppers join distinct products in sequence across the catalog', async t => {
	const calls = [[], []]
	const products = new Map([['101', 10], ['102', 0]])
	const options = {
		siteWaitlistOnly: true,
		keepModalOpen: true,
		secondPage: new Map([['102', 0], ['103', 10]]),
	}
	const pages = await Promise.all(calls.map(shopperCalls => shopper(t, products, shopperCalls, options)))
	const { events, counters } = metrics()
	await Promise.all(pages.map(page => runWaitlist(page, events, catalogEnv)))
	for (const shopperCalls of calls) {
		assert.deepEqual(shopperCalls, ['/join/101', '/join/102', '/join/103'])
	}
	assert.equal(counters['waitlist.catalog_products_checked'], 6)
	assert.equal(counters['waitlist.confirmed'], 6)
	assert.equal(counters['waitlist.catalog_completed'], 2)
})

test('site-wide waitlist fails before making any signups if a later page still offers add to cart', async t => {
	const calls = []
	const page = await shopper(t, new Map([['101', 0]]), calls, {
		secondPage: new Map([['102', 10]]),
	})
	const { events, counters } = metrics()
	await assert.rejects(runWaitlist(page, events, catalogEnv), /Add to cart control/)
	assert.deepEqual(calls, [])
	assert.equal(counters['waitlist.catalog_cart_controls_visible'], 1)
})

test('site-wide waitlist fails when any catalog card is missing a join button', async t => {
	const calls = []
	const page = await shopper(t, new Map([['101', 10], ['102', 0]]), calls, {
		siteWaitlistOnly: true,
		missingJoin: '102',
	})
	const { events, counters } = metrics()
	await assert.rejects(runWaitlist(page, events, catalogEnv), /102.*no enabled Join Waitlist button/)
	assert.deepEqual(calls, [])
	assert.equal(counters['waitlist.catalog_join_missing'], 1)
})
