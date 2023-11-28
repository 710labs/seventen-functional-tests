import { faker } from '@faker-js/faker'

export function createUser(state) {
	var user = {
		lastname: faker.name.lastName(),
		firstName: faker.name.firstName(),
		email: function () {
			return this.firstName.toLowerCase() + '.' + this.lastName.toLowerCase()
		},
		birthday: faker.date.birthdate({ min: 21, max: 100 }),
		phone: faker.phone.number(),
		type: faker.helpers.arrayElement(['recreational', 'medical']),
		address: faker.helpers.arrayElement(),
		driversLicenseNumber: faker.string.alphanumeric({ length: 8 }),
		medCardNumber: faker.string.alphanumeric({ length: 8 }),
	}
}

export const coloradoAddressess: string[] = [
	'15509 East 7th Circle, Aurora CO 80011',
	'6021 Yarrow Street, Arvada CO 80004',
	'3813 Sheffield Lane, Pueblo CO 81005',
	'15847 West 74th Place, Arvada CO 80007',
	'6740 Van Gordon Street, Arvada CO 80004',
	'6880 Xavier Circle, Westminster CO 80030',
	'6234 West 68th Circle, Arvada CO 80003',
	'7854 Webster Way, Arvada CO 80003',
	'5644 Kipling Parkway, Arvada CO 80002',
	'8671 West 78th Circle, Arvada CO 80005',
]
