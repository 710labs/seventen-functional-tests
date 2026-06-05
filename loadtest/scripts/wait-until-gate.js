function parseArgs(argv) {
	const args = {
		_: [],
	}

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index]

		if (!token.startsWith('--')) {
			args._.push(token)
			continue
		}

		const withoutPrefix = token.slice(2)
		const equalsIndex = withoutPrefix.indexOf('=')
		const key = equalsIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalsIndex)
		let value = equalsIndex === -1 ? undefined : withoutPrefix.slice(equalsIndex + 1)

		if (value === undefined) {
			const next = argv[index + 1]

			if (next && !next.startsWith('--')) {
				value = next
				index += 1
			} else {
				value = true
			}
		}

		args[key] = value
	}

	return args
}

function parseBoolean(value, fallback = false) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	if (typeof value === 'boolean') {
		return value
	}

	return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase())
}

function parseNonNegativeInteger(value, label, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	const parsed = Number.parseInt(value, 10)

	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${label} must be a non-negative integer.`)
	}

	return parsed
}

function parseTimeOfDay(value, now) {
	const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)

	if (!match) {
		return null
	}

	const hours = Number(match[1])
	const minutes = Number(match[2])
	const seconds = Number(match[3] || 0)

	if (hours > 23 || minutes > 59 || seconds > 59) {
		throw new Error(`Invalid time of day: ${value}`)
	}

	const gate = new Date(now)

	gate.setHours(hours, minutes, seconds, 0)

	if (gate.getTime() < now.getTime()) {
		gate.setDate(gate.getDate() + 1)
	}

	return gate
}

function parseGateTime(value, now = new Date()) {
	if (!value) {
		throw new Error('No gate time provided.')
	}

	const text = String(value).trim()
	const timeOfDay = parseTimeOfDay(text, now)

	if (timeOfDay) {
		return timeOfDay
	}

	if (/^\d+$/.test(text)) {
		const numeric = Number(text)
		const timestampMs = numeric < 10000000000 ? numeric * 1000 : numeric
		const gate = new Date(timestampMs)

		if (Number.isNaN(gate.getTime())) {
			throw new Error(`Invalid gate timestamp: ${value}`)
		}

		return gate
	}

	const gate = new Date(text)

	if (Number.isNaN(gate.getTime())) {
		throw new Error(`Invalid gate time: ${value}`)
	}

	return gate
}

function formatDuration(ms) {
	if (ms <= 0) {
		return '0s'
	}

	const seconds = Math.ceil(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60

	if (minutes === 0) {
		return `${seconds}s`
	}

	return `${minutes}m ${remainingSeconds}s`
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

async function waitUntilGate(gateTime, options = {}) {
	const now = options.now || new Date()
	const leadMs = options.leadMs || 0
	const pollMs = options.pollMs || 1000
	const maxWaitMs = options.maxWaitMs
	const dryRun = options.dryRun || false
	const targetTime = gateTime.getTime() - leadMs
	const waitMs = targetTime - now.getTime()

	if (waitMs <= 0) {
		console.log(`Gate time has already arrived: ${gateTime.toISOString()}`)
		return {
			waitedMs: 0,
			gateTime,
		}
	}

	if (maxWaitMs !== undefined && waitMs > maxWaitMs) {
		throw new Error(
			`Gate wait ${waitMs}ms exceeds max wait ${maxWaitMs}ms for ${gateTime.toISOString()}.`,
		)
	}

	console.log(`Waiting ${formatDuration(waitMs)} until gate time ${gateTime.toISOString()}.`)

	if (dryRun) {
		return {
			waitedMs: 0,
			gateTime,
			dryRun: true,
		}
	}

	let remainingMs = waitMs

	while (remainingMs > 0) {
		await sleep(Math.min(pollMs, remainingMs))
		remainingMs = targetTime - Date.now()
	}

	console.log(`Gate time reached: ${gateTime.toISOString()}.`)

	return {
		waitedMs: waitMs,
		gateTime,
	}
}

function printUsage() {
	console.log(`Usage: node scripts/wait-until-gate.js --gate-time <time> [options]

Gate time may be ISO-8601, epoch seconds, epoch milliseconds, or HH:mm[:ss] local time.

Options:
  --lead-ms <ms>       Stop waiting this many milliseconds before gate time.
  --max-wait-ms <ms>   Fail if the computed wait exceeds this duration.
  --poll-ms <ms>       Sleep interval while waiting.
  --dry-run            Print computed wait without sleeping.`)
}

async function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv)

	if (args.help) {
		printUsage()
		return null
	}

	const rawGateTime =
		args['gate-time'] ||
		args.gate ||
		args._[0] ||
		process.env.LOADTEST_GATE_TIME ||
		process.env.DROP_GATE_TIME ||
		process.env.GATE_TIME
	const gateTime = parseGateTime(rawGateTime)

	return waitUntilGate(gateTime, {
		leadMs: parseNonNegativeInteger(args['lead-ms'] || process.env.LOADTEST_GATE_LEAD_MS, 'lead-ms', 0),
		maxWaitMs: parseNonNegativeInteger(
			args['max-wait-ms'] || process.env.LOADTEST_GATE_MAX_WAIT_MS,
			'max-wait-ms',
			undefined,
		),
		pollMs: parseNonNegativeInteger(args['poll-ms'] || process.env.LOADTEST_GATE_POLL_MS, 'poll-ms', 1000),
		dryRun: parseBoolean(args['dry-run']),
	})
}

if (require.main === module) {
	main().catch(error => {
		console.error(`[wait-until-gate] ${error.message}`)
		process.exitCode = 1
	})
}

module.exports = {
	formatDuration,
	parseArgs,
	parseGateTime,
	waitUntilGate,
}
