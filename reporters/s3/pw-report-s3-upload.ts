import { Reporter } from '@playwright/test/reporter'
import s3 from 's3-lambo'
import path from 'path'

class ReportToS3 implements Reporter {
	async onEnd() {
		try {
			// Configure AWS credentials for s3-lambo
			process.env.AWS_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY
			process.env.AWS_SECRET_ACCESS_KEY = process.env.S3_SECRET
			process.env.AWS_REGION = process.env.S3_REGION

			// Use the correct path for playwright-report
			const reportPath = path.join(process.cwd(), 'playwright-report')
			
			await s3.uploadDirectory({
				path: reportPath,
				params: {
					Bucket: process.env.S3_BUCKET,
					CacheControl: `max-age=86400`,
				},
				rootKey: `${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`,
			})
			console.log(`Artifacts Uploaded to https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`)
		} catch (error) {
			console.log('S3 Upload Error:', error)
		}
	}
}

export default ReportToS3
