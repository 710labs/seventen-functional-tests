import type { TestUsageType } from '../../utils/usage-types'
import type { ShopFulfillment } from '../../models/shop-page'

type StateProfile = {
	state: 'CA' | 'FL' | 'MI' | 'CO' | 'NJ'
	street: string
	city: string
	zip: string
	usage: TestUsageType
	fulfillment: ShopFulfillment
}

// Use the same addresses and registration modes as the existing state order tests.
export const bulkStateProfiles: StateProfile[] = [
	{ state: 'CA', street: '440 N Rodeo Dr', city: 'Beverly Hills', zip: '90210', usage: 'recreational', fulfillment: 'Pickup' },
	{ state: 'FL', street: '1845 Town Center Blvd', city: 'Fleming Island', zip: '32003', usage: 'medical', fulfillment: 'Delivery' },
	{ state: 'MI', street: '123 Eight Mile Rd', city: 'Detroit', zip: '48203', usage: 'recreational', fulfillment: 'Pickup' },
	{ state: 'CO', street: '933 Alpine Ave', city: 'Boulder', zip: '80304', usage: 'recreational', fulfillment: 'Pickup' },
	{ state: 'NJ', street: '13 Huntley Rd', city: 'Summit', zip: '07901', usage: 'recreational', fulfillment: 'Pickup' },
]
