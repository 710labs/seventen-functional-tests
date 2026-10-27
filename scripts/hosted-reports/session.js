const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const sessionVariable = 'PW_HOSTED_REPORT_SESSION'
const bucketPattern = /^(?!.*\.\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const regionPattern = /^[a-z]{2}-[a-z]+-\d$/
const segment = value => String(value || 'local').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
const errorCodes = new Set(['configuration', 'upload_failed', 'report_not_readable', 'report_failed'])
function reportError(code) { return Object.assign(new Error(code), { reportCode: code }) }
function errorCode(error, fallback = 'upload_failed') { return errorCodes.has(error?.reportCode) ? error.reportCode : fallback }
function createClient(env = process.env) {
	const { S3Client } = require('@aws-sdk/client-s3')
	return new S3Client({ region: env.S3_REGION, maxAttempts: 2,
		credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET } })
}
function objectUrl(session, key) {
	const base = session.bucket.includes('.')
		? `https://s3.${session.region}.amazonaws.com/${session.bucket}/`
		: `https://${session.bucket}.s3.${session.region}.amazonaws.com/`
	return base + key.split('/').map(encodeURIComponent).join('/')
}
async function verifyReadable(url, fetcher = fetch) {
	const response = await fetcher(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(15000) })
	if (!response.ok) throw reportError('report_not_readable')
}
async function prepareSession(directory, env = process.env, client, fetcher = fetch) {
	if (env.PLAYWRIGHT_HOSTED_REPORT !== 'true') return null
	if (!bucketPattern.test(env.S3_BUCKET || '') || !regionPattern.test(env.S3_REGION || '') || !env.S3_ACCESS_KEY || !env.S3_SECRET) throw reportError('configuration')
	const session = {
		version: 1, bucket: env.S3_BUCKET, region: env.S3_REGION,
		reportDir: path.join(directory, 'playwright-report'),
		prefix: `${segment(env.HEALTH_CHECK_ID || env.ENV_ID)}-${segment(env.GITHUB_RUN_ID || env.UNIQUE_RUN_ID)}-${segment(env.RUN_ID)}/${segment(env.GITHUB_RUN_ATTEMPT || '1')}/${segment(env.GITHUB_JOB)}/${segment(env.REPORT_INVOCATION || 'tests')}-${randomUUID()}/`,
	}
	const owned = !client
	client ||= createClient(env)
	try {
		const { PutObjectCommand } = require('@aws-sdk/client-s3')
		const key = `${session.prefix}storage-check.txt`
		await client.send(new PutObjectCommand({ Bucket: session.bucket, Key: key,
			Body: 'Playwright hosted report storage check\n', ContentType: 'text/plain', CacheControl: 'no-store', ServerSideEncryption: 'AES256' }), { abortSignal: AbortSignal.timeout(15000) })
		await verifyReadable(objectUrl(session, key), fetcher)
		const filename = path.join(directory, 'hosted-report-session.json')
		fs.writeFileSync(filename, JSON.stringify(session), { mode: 0o600 })
		return filename
	} finally { if (owned) client.destroy() }
}
function readSession(env = process.env) {
	if (!env[sessionVariable]) return null
	const session = JSON.parse(fs.readFileSync(env[sessionVariable], 'utf8'))
	if (session.version !== 1 || !bucketPattern.test(session.bucket) || !regionPattern.test(session.region)
		|| !/^[a-zA-Z0-9_/-]+\/$/.test(session.prefix)
		|| session.reportDir !== path.join(path.dirname(env[sessionVariable]), 'playwright-report')) throw reportError('configuration')
	return session
}
function hostedVideoMode() { return readSession() ? 'retain-on-failure' : 'off' }
// Keep arbitrary or signed URLs out of public status metadata.
function safeReportUrl(value) {
	try {
		const url = new URL(value)
		if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) return null
		const virtual = /^([a-z0-9-]+)\.s3\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$/.exec(url.hostname)
		const pathStyle = /^s3\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$/.exec(url.hostname)
		let key = url.pathname.slice(1)
		if (virtual) { if (!bucketPattern.test(virtual[1])) return null }
		else if (pathStyle) { const slash = key.indexOf('/'); if (!bucketPattern.test(key.slice(0, slash))) return null; key = key.slice(slash + 1) }
		else return null
		if (!/^[a-zA-Z0-9_/-]+\/index\.html$/.test(key)) return null
		return url.toString()
	} catch { return null }
}
module.exports = { sessionVariable, prepareSession, readSession, hostedVideoMode, createClient, objectUrl, verifyReadable, safeReportUrl, reportError, errorCode, errorCodes }
