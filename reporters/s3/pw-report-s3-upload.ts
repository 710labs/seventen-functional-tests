import {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestResult,
} from '@playwright/test/reporter'
var s3 = require('s3')

class ReportToS3 implements Reporter {
	onBegin(config: FullConfig, suite: Suite) {}

	onTestBegin(test: TestCase, result: TestResult) {}

	onTestEnd(test: TestCase, result: TestResult) {}

	onEnd(result: FullResult) {
		const params = {
			localDir: './playwright-report',
			s3Params: {
				Bucket: process.env.S3_BUCKET,
				Prefix: `${process.env.RUN_UNIQUE_ID}-${process.env.RUN_ID}/`,
			},
		}
		var client = s3.createClient({
			maxAsyncS3: 20, // this is the default
			s3RetryCount: 3, // this is the default
			s3RetryDelay: 1000, // this is the default
			multipartUploadThreshold: 524288000, // this is the default (20 MB)
			multipartUploadSize: 524288000, // this is the default (15 MB)
			s3Options: {
				accessKeyId: process.env.S3_ACCESS_KEY,
				secretAccessKey: process.env.S3_SECRET,
				region: process.env.S3_REGION,
				sslEnabled: false,
			},
		})
		client.uploadDir(params)
	}
}

export default ReportToS3
