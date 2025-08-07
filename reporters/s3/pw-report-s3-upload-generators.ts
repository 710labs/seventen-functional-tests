import { FullResult, Reporter } from '@playwright/test/reporter'
import { v4 as uuidv4 } from 'uuid'
import s3 from 's3-lambo'
import path from 'path'

class ReportToS3 implements Reporter {
	async onEnd(result: FullResult) {
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
				rootKey: `generator-report-${uuidv4()}`,
			})
			console.log(
				`Artifacts Uploaded to https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/generator-report-${uuidv4()}`,
			)
		} catch (error) {
			console.log('S3 Upload Error:', error)
		}
	}
}

export default ReportToS3
