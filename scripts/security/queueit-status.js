const QUEUEIT_REASON = 'QueueIt active — checks deferred'

function isQueuedTest(test) {
	return test.outcome() === 'skipped' &&
		test.annotations?.some(annotation => annotation.type === 'queueit' && annotation.description === QUEUEIT_REASON) &&
		// A real failure on a previous attempt must not disappear behind a queue.
		!(test.results || []).some(result => ['failed', 'timedOut', 'interrupted'].includes(result.status))
}

function reportingOutcome(test) {
	if (test.outcome() === 'skipped' && test.annotations?.some(annotation => annotation.type === 'queueit') &&
		(test.results || []).some(result => ['failed', 'timedOut', 'interrupted'].includes(result.status))) return 'unexpected'
	return test.outcome()
}

module.exports = { isQueuedTest, reportingOutcome, QUEUEIT_REASON }
