import { runListProductionSmoke } from './list-production-smoke'

runListProductionSmoke({
	state: 'NJ',
	address: () => ({ fullAddress: '13 Huntley Rd, Summit, NJ 07901', zipcode: '07901' }),
	fulfillment: 'Pickup',
})
