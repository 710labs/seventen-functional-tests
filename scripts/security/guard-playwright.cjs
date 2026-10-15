// Loaded before test discovery, and inherited by Playwright workers. A reporter
// cannot validate test.use()/test.extend() overrides through its public API.
const playwright = require('@playwright/test')
const { assertRecordingOff } = require('./recording-policy')
const guarded = new WeakSet()

function guard(test) {
	if (guarded.has(test)) return test
	guarded.add(test)
	const use = test.use
	const extend = test.extend
	test.use = function (options) {
		assertRecordingOff(options)
		return use.call(this, options)
	}
	test.extend = function (fixtures) {
		assertRecordingOff(fixtures, false, true)
		return guard(extend.call(this, fixtures))
	}
	return test
}

guard(playwright.test)
const mergeTests = playwright.mergeTests
playwright.mergeTests = (...tests) => guard(mergeTests(...tests))
