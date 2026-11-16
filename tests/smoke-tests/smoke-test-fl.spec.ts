import { runListProductionSmoke } from './list-production-smoke'

runListProductionSmoke({
	state: 'FL',
	address: () => ({ fullAddress: '1845 Town Center Blvd, Fleming Island, FL 32003', zipcode: '32003' }),
	fulfillment: 'Delivery',
})
