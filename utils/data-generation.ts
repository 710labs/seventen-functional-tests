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
		address: faker.helpers.arrayElement(coloradoAddressess),
		driversLicenseNumber: faker.string.alphanumeric({ length: 8 }),
		medCardNumber: faker.string.alphanumeric({ length: 8 }),
	}
}
export const randomUsAddresses: any[] = [
	{
		streetAddress: '350 5th Ave',
		city: 'New York',
		state: 'NY',
		zipcode: '10118',
		fullAddress: '350 5th Ave, New York, NY 10118',
	},
	{
		streetAddress: '200 Santa Monica Pier',
		city: 'Santa Monica',
		state: 'CA',
		zipcode: '90401',
		fullAddress: '200 Santa Monica Pier, Santa Monica, CA 90401',
	},
	{
		streetAddress: '201 E Randolph St',
		city: 'Chicago',
		state: 'IL',
		zipcode: '60602',
		fullAddress: '201 E Randolph St, Chicago, IL 60602',
	},
	{
		streetAddress: '6001 Fannin St',
		city: 'Houston',
		state: 'TX',
		zipcode: '77030',
		fullAddress: '6001 Fannin St, Houston, TX 77030',
	},
	{
		streetAddress: '2600 Benjamin Franklin Pkwy',
		city: 'Philadelphia',
		state: 'PA',
		zipcode: '19130',
		fullAddress: '2600 Benjamin Franklin Pkwy, Philadelphia, PA 19130',
	},
	{
		streetAddress: '1625 N Central Ave',
		city: 'Phoenix',
		state: 'AZ',
		zipcode: '85004',
		fullAddress: '1625 N Central Ave, Phoenix, AZ 85004',
	},
	{
		streetAddress: '300 Alamo Plaza',
		city: 'San Antonio',
		state: 'TX',
		zipcode: '78205',
		fullAddress: '300 Alamo Plaza, San Antonio, TX 78205',
	},
	{
		streetAddress: '2920 Zoo Dr',
		city: 'San Diego',
		state: 'CA',
		zipcode: '92101',
		fullAddress: '2920 Zoo Dr, San Diego, CA 92101',
	},
	{
		streetAddress: '2201 N Field St',
		city: 'Dallas',
		state: 'TX',
		zipcode: '75201',
		fullAddress: '2201 N Field St, Dallas, TX 75201',
	},
	{
		streetAddress: '180 Woz Way',
		city: 'San Jose',
		state: 'CA',
		zipcode: '95110',
		fullAddress: '180 Woz Way, San Jose, CA 95110',
	},
]

export const coloradoAddressess: any[] = [
	{
		streetAddress: '15509 East 7th Circle',
		city: 'Aurora',
		state: 'CO',
		zipcode: '80011',
		fullAddress: '15509 East 7th Circle, Aurora, CO 80011',
	},
	{
		streetAddress: '6021 Yarrow Street',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80004',
		fullAddress: '6021 Yarrow Street, Arvada, CO 80004',
	},
	{
		streetAddress: '3813 Sheffield Lane',
		city: 'Pueblo',
		state: 'CO',
		zipcode: '81005',
		fullAddress: '3813 Sheffield Lane, Pueblo, CO 81005',
	},
	{
		streetAddress: '15847 West 74th Place',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80007',
		fullAddress: '15847 West 74th Place, Arvada, CO 80007',
	},
	{
		streetAddress: '6740 Van Gordon Street',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80004',
		fullAddress: '6740 Van Gordon Street, Arvada, CO 80004',
	},
	{
		streetAddress: '6880 Xavier Circle',
		city: 'Westminster',
		state: 'CO',
		zipcode: '80030',
		fullAddress: '6880 Xavier Circle, Westminster, CO 80030',
	},
	{
		streetAddress: '6234 West 68th Circle',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80003',
		fullAddress: '6234 West 68th Circle, Arvada, CO 80003',
	},
	{
		streetAddress: '7854 Webster Way',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80003',
		fullAddress: '7854 Webster Way, Arvada, CO 80003',
	},
	{
		streetAddress: '5644 Kipling Parkway',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80002',
		fullAddress: '5644 Kipling Parkway, Arvada, CO 80002',
	},
	{
		streetAddress: '8671 West 78th Circle',
		city: 'Arvada',
		state: 'CO',
		zipcode: '80005',
		fullAddress: '8671 West 78th Circle, Arvada, CO 80005',
	},
]
