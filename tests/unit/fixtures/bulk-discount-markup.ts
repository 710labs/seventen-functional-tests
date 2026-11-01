// Shape and displayed values supplied by the user on 2026-11-01.
// These are static UI fixtures, not values generated from the pricing oracle.
export const shopOffersMarkup = `<div class="svntn-wdr-offers"><span class="svntn-wdr-offers__label">List member pricing</span><span class="svntn-wdr-chip"><strong>Buy 3+</strong> <span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>5</span> off each</span><span class="svntn-wdr-chip"><strong>Buy 5+</strong> <span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>7</span> off each</span></div>`

export function suppliedSummaryMarkup(checkout = false, removeLinks = true) {
	return `<${checkout ? 'tfoot' : 'tbody'}>
		<tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal"><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no" dir="auto">$</span>441.00</bdi></span></td></tr>
		${checkout ? '' : '<tr class="svntn-wdr-section"><th colspan="2">List member pricing</th></tr>'}
		<tr class="cart-discount coupon-live-rosin${checkout ? '' : ' svntn-wdr-row'}">
			<th>Live Rosin Badder 3+</th><td data-title="Live Rosin Badder 3+">-<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>15.00</span>
			${removeLinks ? '<a role="button" aria-label="Remove live rosin coupon" href="?remove_coupon=live%20rosin" class="woocommerce-remove-coupon" data-coupon="live rosin">[Remove]</a>' : ''}</td>
		</tr>
		<tr class="cart-discount coupon-live-rosin-vapes-bulk-discount${checkout ? '' : ' svntn-wdr-row'}">
			<th>Live Rosin Vapes 5+</th><td data-title="Live Rosin Vapes 5+">-<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>35.00</span>
			${removeLinks ? '<a role="button" aria-label="Remove live rosin vapes bulk discount coupon" href="?remove_coupon=live%20rosin%20vapes%20bulk%20discount" class="woocommerce-remove-coupon" data-coupon="live rosin vapes bulk discount">[Remove]</a>' : ''}</td>
		</tr>
		${checkout ? '<tr class="woocommerce-shipping-totals shipping"><th>Shipment</th><td data-title="Shipment"><ul id="shipping_method" class="woocommerce-shipping-methods"><li><input type="hidden" name="shipping_method[0]" data-index="0" id="shipping_method_0_free_shipping2" value="free_shipping:2" class="shipping_method"><label for="shipping_method_0_free_shipping2">Fulfillment</label></li></ul></td></tr>' : ''}
		<tr class="tax-rate tax-rate-us-ca-gross-1"><th>Gross</th><td data-title="Gross"><span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>31.28</span></td></tr>
		<tr class="tax-rate tax-rate-us-ca-excise-2"><th>Excise</th><td data-title="Excise"><span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>63.34</span></td></tr>
		<tr class="tax-rate tax-rate-us-ca-sales-3"><th>Sales</th><td data-title="Sales"><span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol" dir="auto">$</span>37.64</span></td></tr>
		<tr class="order-total"><th>Total</th><td data-title="Total"><strong><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no" dir="auto">$</span>523.26</bdi></span></strong></td></tr>
	</${checkout ? 'tfoot' : 'tbody'}>`
}

export const productTagsMarkup = `<form class="woocommerce-cart-form"><table>
	<tr class="cart_item"><td class="product-remove"><a data-product_id="101">Remove</a></td><td class="product-name"><span class="svntn-wdr-tag" data-wdr-coupon="live-rosin">Live Rosin Badder 3+</span></td></tr>
	<tr class="cart_item"><td class="product-remove"><a data-product_id="202">Remove</a></td><td class="product-name"><span class="svntn-wdr-tag" data-wdr-coupon="live-rosin-vapes-bulk-discount">Live Rosin Vapes 5+</span></td></tr>
	<tr class="cart_item"><td class="product-remove"><a data-product_id="303">Remove</a></td><td class="product-name">Below threshold</td></tr>
</table></form>`
