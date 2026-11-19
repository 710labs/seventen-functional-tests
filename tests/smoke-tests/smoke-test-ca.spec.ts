import { runListProductionSmoke } from './list-production-smoke'

runListProductionSmoke({
	state: 'CA',
	address: () => ({ fullAddress: '440 N Rodeo Dr, Beverly Hills, CA 90210', zipcode: '90210' }),
	fulfillment: 'Delivery',
})
