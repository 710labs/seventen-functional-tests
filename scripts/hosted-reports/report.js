const fs = require('node:fs')
const path = require('node:path')
const { finished } = require('node:stream/promises')
const { createClient, objectUrl, verifyReadable, reportError, errorCode } = require('./session')
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webm': 'video/webm', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.txt': 'text/plain' }

function reportFiles(directory, root = directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = path.join(directory, entry.name)
		if (entry.isDirectory()) return reportFiles(file, root)
		if (!entry.isFile()) throw reportError('report_failed')
		return [{ file, relative: path.relative(root, file).split(path.sep).join('/') }]
	})
}
async function uploadReport(session, { client, fetcher = fetch } = {}) {
	const result = { status: 'incomplete', uploaded: 0, failed: 1, bytes: 0 }
	const owned = !client
	try {
		client ||= createClient()
		const { PutObjectCommand } = require('@aws-sdk/client-s3')
		const files = reportFiles(session.reportDir)
		if (!files.some(item => item.relative === 'index.html')) throw reportError('report_failed')
		// Publish the entry page last, after all of its relative attachments exist.
		files.sort((a, b) => Number(a.relative === 'index.html') - Number(b.relative === 'index.html'))
		for (const { file, relative } of files) {
			const key = session.prefix + relative
			const size = fs.statSync(file).size
			const body = fs.createReadStream(file, { fd: fs.openSync(file, 'r'), autoClose: true })
			const closed = finished(body).catch(() => {})
			try {
				await client.send(new PutObjectCommand({ Bucket: session.bucket, Key: key, Body: body, ContentLength: size,
					ContentType: contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
					ServerSideEncryption: 'AES256', CacheControl: 'no-store' }), { abortSignal: AbortSignal.timeout(60000) })
			} finally { body.destroy(); await closed }
			result.uploaded++
			result.bytes += size
			await verifyReadable(objectUrl(session, key), fetcher)
		}
		return { ...result, status: 'complete', failed: 0, url: objectUrl(session, session.prefix + 'index.html') }
	} catch (error) { return { ...result, error: errorCode(error) } }
	finally { if (owned) client?.destroy() }
}
class HostedReport {
	constructor(session) {
		this.session = session
		// Adapter to the installed HTML reporter, exercised by the real-browser integration test.
		const HtmlReporter = require(path.join(path.dirname(require.resolve('playwright/package.json')), 'lib/reporters/html.js')).default
		this.html = new HtmlReporter({ outputFolder: session.reportDir, open: 'never', attachmentsBaseURL: 'data/' })
	}
	onBegin(config, suite) { this.html.onConfigure(config); this.html.onBegin(suite) }
	onError(error) { this.html.onError(error) }
	async finish(result) {
		try { await this.html.onEnd(result) }
		catch { return { status: 'incomplete', uploaded: 0, failed: 1, bytes: 0, error: 'report_failed' } }
		return uploadReport(this.session)
	}
}
module.exports = { HostedReport, reportFiles, uploadReport }
