const { assertBatchId } = require('./batch.cjs')

const orderProfiles = [
	{ sequence: 1, userType: 'rec', label: 'Rec', customerType: 'recreational' },
	{ sequence: 2, userType: 'med', label: 'Med', customerType: 'medical' },
]

const posCodes = { dutchie: 'DUT', blaze: 'BLZ', treez: 'TRZ', meadow: 'MDW' }

function namePrefix(pos, profile) {
	if (!posCodes[pos] || !['rec', 'med'].includes(profile.userType)) throw new Error('Unknown customer profile')
	return `710_${posCodes[pos]}_${profile.label}`
}

function customerName(pos, profile, batchId) {
	return `${namePrefix(pos, profile)}_${assertBatchId(batchId)}`
}

function isCustomerName(name, pos, profile, batchId) {
	if (batchId !== undefined) return name === customerName(pos, profile, batchId)
	const prefix = `${namePrefix(pos, profile)}_`
	if (typeof name !== 'string') return false
	if (name.startsWith(prefix)) {
		const suffix = name.slice(prefix.length)
		return /^[0-9A-Z]{6}$/.test(suffix)
	}
	// Reports must still recognize customer names recorded by earlier runs.
	const compactLegacyPrefix = `710_${posCodes[pos]}_${profile.userType === 'med' ? 'M' : 'R'}_`
	if (name.startsWith(compactLegacyPrefix)) {
		const suffix = name.slice(compactLegacyPrefix.length)
		return /^[0-9A-Z]{1,10}$/.test(suffix) && parseInt(suffix, 36).toString(36).toUpperCase() === suffix
	}
	const posName = pos.charAt(0).toUpperCase() + pos.slice(1)
	const legacyPrefix = `Test_710Labs_${posName}_${profile.label}_`
	return name.startsWith(legacyPrefix) && /^\d{8}_\d{6}_\d{3}$/.test(name.slice(legacyPrefix.length))
}

module.exports = { orderProfiles, customerName, isCustomerName }
