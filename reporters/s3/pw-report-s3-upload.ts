import {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestResult,
} from '@playwright/test/reporter'

import s3 from 's3-lambo'
import { v4 as uuidv4 } from 'uuid'

class ReportToS3 implements Reporter {
	onBegin(config: FullConfig, suite: Suite) {}

	onTestBegin(test: TestCase, result: TestResult) {}

	onTestEnd(test: TestCase, result: TestResult) {}

	async onEnd(result: FullResult) {
		await s3.uploadDirectory({
			path: '../seventen-functional-tests/playwright-report',
			params: {
				Bucket: process.env.S3_BUCKET,
				CacheControl: `max-age=86400`,
			},
			rootKey: `${process.env.RUN_UNIQUE_ID}-${process.env.RUN_ID}`,
		})
	}
}

export default ReportToS3
