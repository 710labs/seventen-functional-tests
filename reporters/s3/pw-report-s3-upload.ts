import {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestResult,
} from '@playwright/test/reporter'

class ReportToS3 implements Reporter {
	onBegin(config: FullConfig, suite: Suite) {
		console.log(`Starting the run with ${suite.allTests().length} tests`)
	}

	onTestBegin(test: TestCase, result: TestResult) {
		console.log(`Starting test ${test.title}`)
	}

	onTestEnd(test: TestCase, result: TestResult) {
		console.log(`Finished test ${test.title}: ${result.status} [${result.duration / 1000} sec]`)
	}

	onEnd(result: FullResult) {
		console.log(`Finished the run: ${result.status}`)
		//upload html report to s3
	}
}

export default ReportToS3
