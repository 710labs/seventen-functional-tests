import { faker } from '@faker-js/faker'
import { coloradoAddressess } from '../../utils/data-generator'
import { runListProductionSmoke } from './list-production-smoke'

runListProductionSmoke({
	state: 'CO',
	address: () => faker.helpers.arrayElement(coloradoAddressess),
	fulfillment: 'Pickup',
	cartDestination: '/reservations',
})
