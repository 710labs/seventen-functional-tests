import { FullResult, Reporter } from '@playwright/test/reporter'
import { v4 as uuidv4 } from 'uuid'

import s3 from 's3-lambo'

class ReportToS3 implements Reporter {
	async onEnd(result: FullResult) {
		try {
			await s3.uploadDirectory({
				path: '../seventen-functional-tests/playwright-report',
				params: {
					Bucket: process.env.S3_BUCKET,
					CacheControl: `max-age=86400`,
				},
				rootKey: `generator-report-${uuidv4()}`,
			})
			console.log(
				`Artifacts Uploaded to https://tech-savagery-test-artifacts.s3.us-west-1.amazonaws.com/generator-report-${uuidv4()}`,
			)
		} catch (error) {
			console.log(error)
		}
	}
}

export default ReportToS3
