const recordingOptions = ['trace', 'video', 'screenshot']
const { hostedVideoMode } = require('../hosted-reports/session')

function assertRecordingOff(options, requireDefaults = false, fixtureDefinitions = false) {
	for (const key of recordingOptions) {
		const value = fixtureDefinitions && Array.isArray(options[key]) ? options[key][0] : options[key]
		const allowedHostedVideo = key === 'video' && value === 'on' && hostedVideoMode() === 'on'
		if ((requireDefaults || Object.hasOwn(options, key)) && value !== 'off' && !allowedHostedVideo) {
			throw new Error('Browser recording is prohibited by the public reporting policy.')
		}
	}
}

module.exports = { assertRecordingOff }
