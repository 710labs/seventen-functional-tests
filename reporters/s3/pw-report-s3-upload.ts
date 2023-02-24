import {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestResult,
} from '@playwright/test/reporter'

class ReportToS3 implements Reporter {
	onBegin(config: FullConfig, suite: Suite) {}

	onTestBegin(test: TestCase, result: TestResult) {}

	onTestEnd(test: TestCase, result: TestResult) {}

	onEnd(result: FullResult) {
		console.log(result)
	}
}

export default ReportToS3
