const orderProfiles = [
	{ sequence: 1, userType: 'rec', label: 'Rec', customerType: 'recreational' },
	{ sequence: 2, userType: 'med', label: 'Med', customerType: 'medical' },
]

function customerName(pos, profile) {
	const posName = pos.charAt(0).toUpperCase() + pos.slice(1)
	return `Test_710Labs_${posName}_${profile.label}`
}

module.exports = { orderProfiles, customerName }
