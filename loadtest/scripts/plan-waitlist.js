const fs = require('node:fs')
const { planWaitlist } = require('../flows/waitlist-settings')

try {
	const plan = planWaitlist({
		mode: process.env.INPUT_MODE,
		preset: process.env.INPUT_WAITLIST_PRESET,
		products: process.env.INPUT_WAITLIST_PRODUCTS || '',
		checkoutProducts: process.env.INPUT_CHECKOUT_PRODUCT_IDS || '',
		facility: process.env.INPUT_WAITLIST_FACILITY_ID || '',
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
		const mixed = process.env.INPUT_MODE === 'mixed'
		const waitlistBrowsers = plan.include.reduce((total, product) => total + product.browsers, 0)
		const rows = plan.include.map(product => {
			const catalog = product.id === 'catalog'
			const columns = [catalog ? 'Entire storefront' : product.id, catalog ? '—' : product.stock, product.browsers]
			if (mixed) columns.push(product.checkoutBrowsers)
			columns.push(product.workers)
			return `| ${columns.join(' | ')} |`
		})
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
			mixed ? '\n## Mixed browser plan\n' : '\n## Waitlist products\n',
			...(mixed ? [`${waitlistBrowsers * 2} total browsers, ${waitlistBrowsers} waitlist and ${waitlistBrowsers} checkout.\n`] : []),
			`Pickup facility ${plan.facility}, ${plan.duration}s arrival phase.\n`,
			`| Scope | Starting stock | Waitlist browsers | ${mixed ? 'Checkout browsers | ' : ''}Fargate workers |`,
			`| --- | ---: | ---: | ${mixed ? '---: | ' : ''}---: |`,
			...rows,
			'',
		].join('\n'))
	}
} catch (error) {
	console.error(error.message)
	process.exitCode = 1
}
