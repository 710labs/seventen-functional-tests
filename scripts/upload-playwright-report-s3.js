#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3')

const reportDir = path.resolve(process.env.PLAYWRIGHT_REPORT_DIR || 'playwright-report')
const requiredEnv = [
	'S3_BUCKET',
	'S3_REGION',
	'S3_ACCESS_KEY',
	'S3_SECRET',
	'ENV_ID',
	'UNIQUE_RUN_ID',
	'RUN_ID',
]

const contentTypes = {
	'.css': 'text/css',
	'.gif': 'image/gif',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain',
	'.xml': 'application/xml',
}

function getMissingEnv() {
	return requiredEnv.filter(name => !process.env[name])
}

function getContentType(filePath) {
	return contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

async function getFiles(dir) {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true })
	const files = []

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			files.push(...(await getFiles(fullPath)))
		} else if (entry.isFile()) {
			files.push(fullPath)
		}
	}

	return files
}

async function main() {
	const missingEnv = getMissingEnv()

	if (missingEnv.length > 0) {
		console.log(`[admin-drop] Skipping S3 report upload. Missing env: ${missingEnv.join(', ')}`)
		return
	}

	const indexPath = path.join(reportDir, 'index.html')

	if (!fs.existsSync(indexPath)) {
		console.log(`[admin-drop] Skipping S3 report upload. Missing report: ${indexPath}`)
		return
	}

	const files = await getFiles(reportDir)
	const rootKey = `${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`
	const s3Client = new S3Client({
		region: process.env.S3_REGION,
		credentials: {
			accessKeyId: process.env.S3_ACCESS_KEY,
			secretAccessKey: process.env.S3_SECRET,
		},
	})

	for (const file of files) {
		const relativePath = path.relative(reportDir, file).split(path.sep).join('/')
		const key = `${rootKey}/${relativePath}`

		await s3Client.send(
			new PutObjectCommand({
				Bucket: process.env.S3_BUCKET,
				Key: key,
				Body: await fs.promises.readFile(file),
				ContentType: getContentType(file),
				CacheControl: 'max-age=86400',
			}),
		)

		console.log(`[admin-drop] Uploaded report file: ${key}`)
	}

	console.log(
		`[admin-drop] Playwright report uploaded: https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${rootKey}/index.html`,
	)
}

main().catch(error => {
	console.log('[admin-drop] S3 report upload failed:', error)
	process.exit(1)
})
