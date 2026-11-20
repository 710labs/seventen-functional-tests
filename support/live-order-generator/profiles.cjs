const orderProfiles = [
	{ sequence: 1, userType: 'rec', label: 'Rec', customerType: 'recreational' },
	{ sequence: 2, userType: 'med', label: 'Med', customerType: 'medical' },
]

const nameClock = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
	hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
let lastNameTime = 0

function namePrefix(pos, profile) {
	const posName = pos.charAt(0).toUpperCase() + pos.slice(1)
	return `Test_710Labs_${posName}_${profile.label}`
}

function customerName(pos, profile, date) {
	if (date === undefined) {
		lastNameTime = Math.max(Date.now(), lastNameTime + 1)
		date = new Date(lastNameTime)
	}
	const parts = Object.fromEntries(nameClock.formatToParts(date).map(part => [part.type, part.value]))
	const timestamp = `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}_${String(date.getMilliseconds()).padStart(3, '0')}`
	return `${namePrefix(pos, profile)}_${timestamp}`
}

function isCustomerName(name, pos, profile) {
	const prefix = `${namePrefix(pos, profile)}_`
	return typeof name === 'string' && name.startsWith(prefix) && /^\d{8}_\d{6}_\d{3}$/.test(name.slice(prefix.length))
}

module.exports = { orderProfiles, customerName, isCustomerName }
