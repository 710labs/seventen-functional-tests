import { runListProductionSmoke } from './list-production-smoke'

runListProductionSmoke({
	state: 'MI',
	address: () => ({ fullAddress: '123 Eight Mile Rd, Detroit, MI 48203', zipcode: '48203' }),
	fulfillment: 'Pickup',
	cartDestination: '/reservations',
})
