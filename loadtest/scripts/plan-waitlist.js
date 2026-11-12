const fs = require('node:fs')
const { planWaitlist } = require('../flows/waitlist-settings')

try {
	const plan = planWaitlist({
		mode: process.env.INPUT_MODE,
		browsers: process.env.INPUT_WAITLIST_BROWSERS,
		products: process.env.INPUT_WAITLIST_PRODUCTS || '',
		checkoutProducts: process.env.INPUT_CHECKOUT_PRODUCT_IDS || '',
		facility: process.env.INPUT_WAITLIST_FACILITY_ID || '',
		duration: process.env.INPUT_WAITLIST_DURATION_SECONDS,
		cartItems: process.env.INPUT_CART_ITEM_COUNT,
	})
	fs.appendFileSync(process.env.GITHUB_OUTPUT, [
		`run_waitlist=${plan.include.length > 0 && process.env.INPUT_MODE !== 'dry'}`,
		`waitlist_matrix=${JSON.stringify({ include: plan.include })}`,
		`checkout_product_ids=${plan.checkoutIds.join(',')}`,
		`waitlist_facility_id=${plan.facility}`,
		`waitlist_duration_seconds=${plan.duration}`,
		'',
	].join('\n'))
	if (plan.include.length) {
		const rows = plan.include.map(product =>
			`| ${product.id} | ${product.stock} | ${product.browsers} | ${product.workers} |`)
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
			'\n## Waitlist products\n',
			`Pickup facility ${plan.facility}, ${plan.duration}s arrival phase.\n`,
			'| Product ID | Starting stock | Browsers | Fargate workers |',
			'| --- | ---: | ---: | ---: |',
			...rows,
			'',
		].join('\n'))
	}
} catch (error) {
	console.error(error.message)
	process.exitCode = 1
}
