const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { after, before, test } = require('node:test')
const { chromium } = require('@playwright/test')
const { addCheckoutProducts } = require('./drop-cart')
const { runWaitlist } = require('./waitlist')
const { planWaitlist } = require('./waitlist-settings')

const planInput = {
	mode: 'bypass-only',
	browsers: '20',
	products: '101:1,102:3,103:0',
	checkoutProducts: '201,202',
	facility: '1',
	duration: '1',
	cartItems: '2',
}

test('the planner budgets enough users for each product and retains exact worker caps', () => {
	const { include } = planWaitlist(planInput)
	assert.deepEqual(include.map(product => [product.id, product.browsers]), [
		['101', 7], ['102', 8], ['103', 5],
	])
	for (const { browsers, workers } of include) {
		assert.equal(browsers % workers, 0)
		assert.ok(browsers / workers <= 10)
	}
	const uneven = planWaitlist({ ...planInput, browsers: '23', products: '101:1' })
	assert.equal(uneven.include[0].browsers, 23)
	assert.equal(uneven.include[0].browsers % uneven.include[0].workers, 0)
	assert.throws(() => planWaitlist({ ...planInput, browsers: '6' }), /at least 7/)
	assert.throws(() => planWaitlist({ ...planInput, checkoutProducts: '101,202' }), /disjoint/)
	assert.throws(() => planWaitlist({ ...planInput, checkoutProducts: '' }), /checkout products/)
	assert.equal(planWaitlist({ ...planInput, mode: 'waitlist-only', checkoutProducts: '' }).include.length, 3)
	assert.equal(planWaitlist({ ...planInput, browsers: '0', products: '', facility: '' }).include.length, 0)
})

function metrics() {
	const events = new EventEmitter()
	const counters = {}
	events.on('counter', (name, amount) => { counters[name] = (counters[name] || 0) + amount })
	return { events, counters }
}

function menu(products, cartSize, earlyWaitlist) {
	const cards = [...products].map(([id, stock]) => `
		<li class="product post-${id} ${stock ? 'instock' : 'outofstock'}">
			<span data-gtm4wp_product_data='${JSON.stringify({ internal_id: id, stocklevel: stock })}'></span>
			${stock ? `<button class="fasd_to_cart" data-id="${id}" data-facility="1" data-method="pickup">Add to cart</button>` : ''}
			${!stock || earlyWaitlist ? `<button class="waitlist-button" data-product_id="${id}">Join Waitlist</button>` : ''}
		</li>`).join('')
	return `
		<a class="cart-contents" href="/cart/">Cart (${cartSize})</a>
		<p class="woocommerce-error" hidden></p>
		<ul>${cards}</ul>
		<div id="waitlistElement" hidden>
			<form id="waitlistForm">
				<input type="hidden" id="waitlist_product_id">
				<input type="hidden" id="waitlist_method" value="pickup">
				<input type="hidden" id="waitlist_facility_id" value="1">
				<span id="waitlist_error"></span>
				<button type="button" id="waitlistSubmit">Join waitlist</button>
			</form>
		</div>
		<script>
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
				document.querySelector('#waitlistElement').hidden = true;
			};
		</script>`
}

let browser
before(async () => { browser = await chromium.launch() })
after(async () => { await browser?.close() })

async function shopper(t, products, calls, earlyWaitlist = false) {
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
				return route.fulfill({ contentType: 'text/html', body: menu(products, cart.size, earlyWaitlist) })
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
	const page = await shopper(t, new Map([['101', 1]]), calls, true)
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
