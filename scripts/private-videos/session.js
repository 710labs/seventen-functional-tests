const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const sessionVariable = 'PW_PRIVATE_VIDEO_SESSION'
const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
const regionPattern = /^[a-z]{2}-[a-z]+-\d$/
const segment = value => String(value || 'local').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)

function consoleUrl(session, key) {
	const url = new URL(`https://s3.console.aws.amazon.com/s3/${key ? 'object' : 'buckets'}/${session.bucket}`)
	url.searchParams.set('region', session.region)
	url.searchParams.set('prefix', key || session.prefix)
	return url.toString()
}

function readSession(env = process.env) {
	if (!env[sessionVariable]) return null
	const session = JSON.parse(fs.readFileSync(env[sessionVariable], 'utf8'))
	if (session.version !== 1 || !bucketPattern.test(session.bucket) || !regionPattern.test(session.region)
		|| !/^playwright\/[a-zA-Z0-9_/-]+\/$/.test(session.prefix)) {
		throw new Error('Invalid private video session')
	}
	return session
}

function privateVideoMode() {
	return readSession() ? 'retain-on-failure' : 'off'
}

async function verifyBucket(client, bucket) {
	const { GetPublicAccessBlockCommand, GetBucketPolicyStatusCommand, GetBucketOwnershipControlsCommand } = require('@aws-sdk/client-s3')
	const send = Command => client.send(new Command({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(15000) })
	const block = (await send(GetPublicAccessBlockCommand)).PublicAccessBlockConfiguration
	if (!['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(key => block?.[key] === true)) {
		throw new Error('Private video bucket must block all public access')
	}
	try {
		if ((await send(GetBucketPolicyStatusCommand)).PolicyStatus?.IsPublic !== false) {
			throw new Error('Private video bucket policy must not be public')
		}
	} catch (error) {
		if (error.name !== 'NoSuchBucketPolicy') throw error
	}
	const rules = (await send(GetBucketOwnershipControlsCommand)).OwnershipControls?.Rules || []
	if (!rules.some(rule => rule.ObjectOwnership === 'BucketOwnerEnforced')) {
		throw new Error('Private video bucket must disable ACLs')
	}
}

async function prepareSession(directory, env = process.env, client) {
	if (env.PRIVATE_VIDEO_RECORDING !== 'true') return null
	const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
	const bucket = env.PRIVATE_VIDEO_BUCKET || ''
	const region = env.PRIVATE_VIDEO_REGION || ''
	if (!bucketPattern.test(bucket) || !regionPattern.test(region)) throw new Error('Private video storage is not configured')
	const session = {
		version: 1, bucket, region,
		prefix: `playwright/${segment(env.GITHUB_RUN_ID)}/${segment(env.GITHUB_RUN_ATTEMPT || '1')}/${segment(env.GITHUB_JOB)}/${segment(env.HEALTH_CHECK_ID || env.ENV_ID)}/${randomUUID()}/`,
	}
	const ownedClient = !client
	client ||= new S3Client({ region, maxAttempts: 2 })
	try {
		await verifyBucket(client, bucket)
		// Confirm uploads are authorized before collecting any real browser data.
		await client.send(new PutObjectCommand({ Bucket: bucket, Key: `${session.prefix}preflight.json`,
			Body: JSON.stringify({ version: 1, purpose: 'private-video-upload-check' }),
			ContentType: 'application/json', ServerSideEncryption: 'AES256' }), { abortSignal: AbortSignal.timeout(15000) })
		const filename = path.join(directory, 'private-video-session.json')
		fs.writeFileSync(filename, JSON.stringify(session), { mode: 0o600 })
		return filename
	} finally {
		if (ownedClient) client.destroy()
	}
}

// Only non-authorizing AWS Console links are allowed in public reports.
function safeConsoleUrl(value) {
	try {
		const url = new URL(value)
		if (url.origin !== 'https://s3.console.aws.amazon.com' || url.username || url.password || url.hash) return null
		if (!/^\/s3\/(buckets|object)\/[a-z0-9-]+$/.test(url.pathname)) return null
		if ([...url.searchParams.keys()].sort().join(',') !== 'prefix,region') return null
		if (!regionPattern.test(url.searchParams.get('region')) || !/^playwright\/[a-zA-Z0-9_./-]+$/.test(url.searchParams.get('prefix'))) return null
		return url.toString()
	} catch { return null }
}

module.exports = { sessionVariable, prepareSession, verifyBucket, readSession, privateVideoMode, consoleUrl, safeConsoleUrl }
