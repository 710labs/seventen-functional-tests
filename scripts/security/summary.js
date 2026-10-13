const number = value => {
	if (!Number.isFinite(value) || value < 0) throw new Error('Invalid summary number')
	return value
}
function sanitizeSummary(input) {
	if (!['passed', 'failed'].includes(input.status) || input.schemaVersion !== 1 || !Array.isArray(input.tests)) throw new Error('Invalid summary')
	const counts = Object.fromEntries(['passed', 'failed', 'flaky', 'skipped'].map(key => [key, number(input.counts[key])]))
	const tests = input.tests.map(test => {
		if (!/^[a-f0-9]{16}$/.test(test.id) || !Object.hasOwn(counts, test.status)) throw new Error('Invalid test summary')
		return { id: test.id, status: test.status, durationMs: number(test.durationMs), retries: number(test.retries) }
	})
	return { schemaVersion: 1, status: input.status, counts, tests }
}
module.exports = { sanitizeSummary }
