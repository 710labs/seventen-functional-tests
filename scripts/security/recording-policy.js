const recordingOptions = ['trace', 'video', 'screenshot']

function assertRecordingOff(options, requireDefaults = false, fixtureDefinitions = false) {
	for (const key of recordingOptions) {
		const value = fixtureDefinitions && Array.isArray(options[key]) ? options[key][0] : options[key]
		if ((requireDefaults || Object.hasOwn(options, key)) && value !== 'off') {
			throw new Error('Browser recording is prohibited by the public reporting policy.')
		}
	}
}

module.exports = { assertRecordingOff }
