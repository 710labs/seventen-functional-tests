import { Reporter } from '@playwright/test/reporter'

import s3 from 's3-lambo'

class ReportToS3 implements Reporter {
	async onEnd() {
		try {
			await s3.uploadDirectory({
				path: '../seventen-functional-tests/playwright-report',
				params: {
					Bucket: process.env.S3_BUCKET,
					CacheControl: `max-age=86400`,
				},
				rootKey: `${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`,
			})
			console.log(`Artifacts Uploaded to https://tech-savagery-test-artifacts.s3.us-west-1.amazonaws.com/${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`)
		} catch (error) {
			console.log(error)
		}
	}
}

export default ReportToS3
