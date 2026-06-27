const smokeCartItemCountEnv = 'SMOKE_CART_ITEM_COUNT'
const defaultSmokeCartItemCount = 1
const minSmokeCartItemCount = 1
const maxSmokeCartItemCount = 10

export function getSmokeCartItemCount() {
	const configuredValue = process.env[smokeCartItemCountEnv]?.trim()

	if (!configuredValue) {
		return defaultSmokeCartItemCount
	}

	const itemCount = Number(configuredValue)

	if (
		!Number.isInteger(itemCount) ||
		itemCount < minSmokeCartItemCount ||
		itemCount > maxSmokeCartItemCount
	) {
		throw new Error(
			`${smokeCartItemCountEnv} must be an integer from ${minSmokeCartItemCount} to ${maxSmokeCartItemCount}. Received "${configuredValue}".`,
		)
	}

	return itemCount
}
