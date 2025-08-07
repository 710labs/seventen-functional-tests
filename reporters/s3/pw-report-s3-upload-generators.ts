import { FullResult, Reporter } from '@playwright/test/reporter'
import { v4 as uuidv4 } from 'uuid'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs'

class ReportToS3 implements Reporter {
	async onEnd(result: FullResult) {
		try {
			// Configure AWS S3 client
			const s3Client = new S3Client({
				region: process.env.S3_REGION,
				credentials: {
					accessKeyId: process.env.S3_ACCESS_KEY!,
					secretAccessKey: process.env.S3_SECRET!,
				},
			})

			// Use the correct path for playwright-report
			const reportPath = path.join(process.cwd(), 'playwright-report')
			const rootKey = `generator-report-${uuidv4()}`
			
			console.log('S3 Upload Config:', {
				bucket: process.env.S3_BUCKET,
				region: process.env.S3_REGION,
				path: reportPath,
				rootKey: rootKey
			})

			// Upload the entire directory recursively
			await this.uploadDirectoryRecursive(s3Client, reportPath, rootKey, process.env.S3_BUCKET!)
			
			console.log(`Artifacts Uploaded to https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${rootKey}`)
		} catch (error) {
			console.log('S3 Upload Error:', error)
			console.log('Environment variables:', {
				S3_BUCKET: process.env.S3_BUCKET,
				S3_REGION: process.env.S3_REGION,
				S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ? '***SET***' : '***NOT SET***',
				S3_SECRET: process.env.S3_SECRET ? '***SET***' : '***NOT SET***'
			})
		}
	}

	private async uploadDirectoryRecursive(s3Client: S3Client, localPath: string, s3Key: string, bucket: string) {
		const items = fs.readdirSync(localPath)
		
		for (const item of items) {
			const localItemPath = path.join(localPath, item)
			const s3ItemKey = path.join(s3Key, item).replace(/\\/g, '/')
			const stats = fs.statSync(localItemPath)
			
			if (stats.isDirectory()) {
				// Recursively upload subdirectories
				await this.uploadDirectoryRecursive(s3Client, localItemPath, s3ItemKey, bucket)
			} else {
				// Upload file
				const fileContent = fs.readFileSync(localItemPath)
				const command = new PutObjectCommand({
					Bucket: bucket,
					Key: s3ItemKey,
					Body: fileContent,
					ContentType: this.getContentType(item),
					CacheControl: 'max-age=86400',
				})
				
				await s3Client.send(command)
				console.log(`Uploaded: ${s3ItemKey}`)
			}
		}
	}

	private getContentType(filename: string): string {
		const ext = path.extname(filename).toLowerCase()
		const contentTypes: { [key: string]: string } = {
			'.html': 'text/html',
			'.css': 'text/css',
			'.js': 'application/javascript',
			'.json': 'application/json',
			'.png': 'image/png',
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.gif': 'image/gif',
			'.svg': 'image/svg+xml',
			'.ico': 'image/x-icon',
			'.txt': 'text/plain',
			'.xml': 'application/xml',
		}
		return contentTypes[ext] || 'application/octet-stream'
	}
}

export default ReportToS3
