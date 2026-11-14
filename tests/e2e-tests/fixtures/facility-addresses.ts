type FacilityAddress = {
	street: string
	city: string
	facility: string
}

type FacilityAddressScenario = {
	environment: string
	origin: string
	state: 'CA' | 'CO' | 'MI' | 'NJ'
	registration: Pick<FacilityAddress, 'street' | 'city'> & { zip: string }
	edits: readonly [FacilityAddress, FacilityAddress, ...FacilityAddress[]]
}

const losAngeles = {
	street: '735 S Broadway',
	city: 'Los Angeles',
	facility: 'Amuse Downtown LA',
}
const sanFrancisco = {
	street: '33 29th St',
	city: 'San Francisco',
	facility: 'Amuse San Francisco',
}
const sanJose = {
	street: '2943 Daylight Way',
	city: 'San Jose',
	facility: 'Amuse San Jose',
}
const sanDiego = {
	street: '7835 Camino del Rio S',
	city: 'San Diego',
	facility: 'March and Ash Mission Valley',
}
const eatontown = {
	street: '315 NJ-35',
	city: 'Eatontown',
	facility: 'Fresh Cannabis - Eatontown',
}
const elizabeth = {
	street: '460 Maple Ave',
	city: 'Elizabeth',
	facility: 'Fresh Cannabis - Elizabeth',
}

const westwood = {
	street: '2299 Westwood Blvd',
	city: 'Los Angeles',
	facility: 'Goat Global - Westwood',
}
const monroe = {
	street: '14750 Laplaisance Rd',
	city: 'Monroe',
	facility: 'House of Dank - Monroe',
}
const denver = {
	street: '1568 S Broadway',
	city: 'Denver',
	facility: 'Colorado Harvest Company - Denver (Green Mile)',
}

export const facilityAddressScenarios: readonly FacilityAddressScenario[] = [
	{
		environment: 'stage-ca',
		origin: 'https://thelist-stage.710labs.com',
		state: 'CA',
		registration: { ...sanFrancisco, zip: '94110' },
		edits: [losAngeles, sanFrancisco, sanJose],
	},
	{
		environment: 'dev-ca',
		origin: 'https://thelist-dev.710labs.com',
		state: 'CA',
		registration: { ...losAngeles, zip: '90014' },
		edits: [sanDiego, sanJose, losAngeles],
	},
	{
		environment: 'dev-nj',
		origin: 'https://thelist-dev.710labs.com',
		state: 'NJ',
		registration: { ...eatontown, zip: '07724' },
		edits: [elizabeth, eatontown],
	},
	{
		environment: 'prod-ca',
		origin: 'https://thelist.710labs.com',
		state: 'CA',
		registration: { ...westwood, zip: '90064' },
		edits: [
			{ street: '2675 N Ventura Rd', city: 'Port Hueneme', facility: 'From The Earth - Port Hueneme' },
			{ street: '4200 Lincoln Blvd', city: 'Marina del Rey', facility: 'Erba - Venice' },
			westwood,
		],
	},
	{
		environment: 'prod-mi',
		origin: 'https://thelist-mi.710labs.com',
		state: 'MI',
		registration: { street: '123 Eight Mile Rd', city: 'Detroit', zip: '48203' },
		edits: [
			{ street: '45411 Park Ave', city: 'Utica', facility: 'Bowdega - Utica' },
			{ street: '925 40th St SE', city: 'Grand Rapids', facility: 'Jars - Grand Rapids' },
			monroe,
		],
	},
	{
		environment: 'prod-nj',
		origin: 'https://thelist-nj.710labs.com',
		state: 'NJ',
		registration: { ...eatontown, zip: '07724' },
		edits: [
			{ street: '16 N Golfwood Ave', city: 'Penns Grove', facility: 'Frosted Nug - Penns Grove' },
			elizabeth,
			eatontown,
		],
	},
	{
		environment: 'prod-co',
		origin: 'https://thelist-co.710labs.com',
		state: 'CO',
		registration: { ...denver, zip: '80210' },
		edits: [
			{ street: '11002 E Yale Ave', city: 'Aurora', facility: 'Colorado Harvest Company - Aurora' },
			denver,
		],
	},
]
