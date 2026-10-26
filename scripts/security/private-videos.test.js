const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { prepareSession, verifyBucket, consoleUrl, safeConsoleUrl } = require('../private-videos/session')
const { PrivateVideoRecorder } = require('../private-videos/recorder')
const { sanitizeRecordings } = require('./summary')
const root = path.resolve(__dirname, '../..')
const canary = 'PRIVATE_VIDEO_CANARY_DO_NOT_PUBLISH'
const session = { version: 1, bucket: 'private-video-fixture', region: 'us-east-1', prefix: 'playwright/123/1/job/dev-ca/run/' }
const privateBlock = { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true }

function fakeClient(overrides = {}) {
	const commands = []
	return { commands, async send(command) {
		const name = command.constructor.name
		commands.push(command)
		if (overrides[name]) return overrides[name](command)
		if (name === 'GetPublicAccessBlockCommand') return { PublicAccessBlockConfiguration: privateBlock }
		if (name === 'GetBucketPolicyStatusCommand') return { PolicyStatus: { IsPublic: false } }
		if (name === 'GetBucketOwnershipControlsCommand') return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } }
		if (name === 'PutObjectCommand') { if (command.input.Body?.pipe) for await (const _ of command.input.Body) {} return {} }
		throw new Error('Unexpected command')
	} }
}

test('private capture requires all public access blocks, private policy, disabled ACLs and write access', async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'private-video-preflight-'))
	const env = { PRIVATE_VIDEO_RECORDING: 'true', PRIVATE_VIDEO_BUCKET: session.bucket, PRIVATE_VIDEO_REGION: session.region }
	try {
		const client = fakeClient()
		const filename = await prepareSession(directory, env, client)
		assert.match(JSON.parse(fs.readFileSync(filename)).prefix, /^playwright\/local\/1\/local\/local\//)
		assert.equal(client.commands.at(-1).input.ServerSideEncryption, 'AES256')
		for (const key of Object.keys(privateBlock)) {
			await assert.rejects(verifyBucket(fakeClient({ GetPublicAccessBlockCommand: () => ({ PublicAccessBlockConfiguration: { ...privateBlock, [key]: false } }) }), session.bucket))
		}
		await assert.rejects(verifyBucket(fakeClient({ GetBucketPolicyStatusCommand: () => ({ PolicyStatus: { IsPublic: true } }) }), session.bucket))
		await assert.rejects(verifyBucket(fakeClient({ GetBucketOwnershipControlsCommand: () => ({ OwnershipControls: { Rules: [{ ObjectOwnership: 'ObjectWriter' }] } }) }), session.bucket))
		await assert.rejects(prepareSession(directory, env, fakeClient({ PutObjectCommand: () => { throw new Error('AccessDenied') } })))
		assert.equal(await prepareSession(directory, {}, { send() { throw new Error('must not contact AWS') } }), null)
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('public recording links never grant access or accept signed URLs', () => {
	assert.equal(safeConsoleUrl(consoleUrl(session)), consoleUrl(session))
	assert.equal(safeConsoleUrl(consoleUrl(session, session.prefix + '0123456789abcdef/attempt-0/video-0.webm')), consoleUrl(session, session.prefix + '0123456789abcdef/attempt-0/video-0.webm'))
	for (const bad of [
		'https://private-video-fixture.s3.amazonaws.com/video.webm?X-Amz-Signature=secret',
		consoleUrl(session) + '&X-Amz-Signature=secret',
		consoleUrl(session).replace('s3.console.aws.amazon.com', 'evil.example'),
		consoleUrl(session).replace('https://', 'https://user:secret@'),
	]) assert.equal(safeConsoleUrl(bad), null)
	assert.throws(() => sanitizeRecordings({ status: 'complete', uploaded: 1, failed: 0, missing: 0, url: 'https://example.com/secret' }))
})

test('recorder preserves failed retry attempts, rejects unrelated files, and exposes incomplete uploads', async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'private-video-recorder-'))
	try {
		const video = path.join(directory, 'recording.webm')
		fs.writeFileSync(video, Buffer.from('1a45dfa300000000', 'hex'))
		const privateTest = { id: 'test-id', title: canary, expectedStatus: 'passed', parent: { project: () => ({ name: 'Desktop Chrome' }) } }
		const failed = { status: 'failed', retry: 0, duration: 123, attachments: [{ path: video, contentType: 'video/webm' }] }
		const client = fakeClient()
		const recorder = new PrivateVideoRecorder(session, [directory], client)
		recorder.collect(privateTest, failed)
		recorder.collect(privateTest, { ...failed, status: 'passed', retry: 1 })
		const summary = await recorder.finish()
		assert.equal(summary.uploaded, 1)
		assert.equal(summary.failed, 0)
		assert.ok(!JSON.stringify(summary).includes(canary))
		const manifest = client.commands.find(command => command.input.Key.endsWith('manifest.json'))
		assert.ok(manifest.input.Body.includes(canary))
		const reject = new PrivateVideoRecorder(session, [directory], fakeClient({ PutObjectCommand: () => { throw new Error(canary) } }))
		reject.collect(privateTest, failed)
		assert.equal((await reject.finish()).status, 'incomplete')
		fs.writeFileSync(video, canary)
		const invalid = new PrivateVideoRecorder(session, [directory], fakeClient())
		invalid.collect(privateTest, failed)
		assert.equal((await invalid.finish()).uploaded, 0)
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('real browser videos upload privately for failures and retries while public outputs stay sanitized', { timeout: 120000 }, () => {
	const directory = fs.mkdtempSync(path.join(root, '.private-video-fixture-'))
	try {
		const uploads = path.join(directory, 'private-uploads')
		fs.mkdirSync(uploads)
		const shim = path.join(directory, 'fake-s3.cjs')
		fs.writeFileSync(shim, `
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module');
const sdk = require('@aws-sdk/client-s3'); const original = Module._load;
class S3Client {
 async send(command) {
  const name = command.constructor.name;
  if (name === 'GetPublicAccessBlockCommand') return { PublicAccessBlockConfiguration: ${JSON.stringify(privateBlock)} };
  if (name === 'GetBucketPolicyStatusCommand') return { PolicyStatus: { IsPublic: false } };
  if (name === 'GetBucketOwnershipControlsCommand') return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } };
  if (name !== 'PutObjectCommand') throw new Error('Unexpected S3 request');
  if (process.env.SYNTHETIC_UPLOAD_DENIED === 'true' && command.input.ContentType === 'video/webm') throw new Error(${JSON.stringify(canary)});
  const input = command.input; const file = path.join(${JSON.stringify(uploads)}, input.Key); fs.mkdirSync(path.dirname(file), { recursive: true });
  if (typeof input.Body === 'string') fs.writeFileSync(file, input.Body);
  else { const chunks=[]; for await (const chunk of input.Body) chunks.push(chunk); fs.writeFileSync(file, Buffer.concat(chunks)); }
  return {};
 }
 destroy() {}
}
Module._load = function(name, ...args) { return name === '@aws-sdk/client-s3' ? { ...sdk, S3Client } : original.call(this, name, ...args); };
`)
		const config = path.join(directory, 'config.cjs')
		const health = path.join(directory, 'health.json')
		const slack = path.join(directory, 'slack.json')
		const summaryFile = path.join(directory, 'summary.json')
		const stepSummary = path.join(directory, 'step.md')
		fs.writeFileSync(config, `
global.fetch = async (_url, options) => { require('fs').writeFileSync(${JSON.stringify(slack)}, options.body); return { ok: true } };
module.exports = {
 testDir: __dirname, testMatch: 'probe.spec.cjs', workers: 1, retries: 1, outputDir: ${JSON.stringify(path.join(directory, 'results'))},
 reporter: ${JSON.stringify(['reporters/security/public-summary-reporter.cjs', 'reporters/slack/pw-slack-webhook-reporter.ts', 'reporters/health/pw-health-json-reporter.ts'].map(file => [path.join(root, file)]))},
 use: { trace: 'off', screenshot: 'off', headless: true, video: require(${JSON.stringify(path.join(root, 'scripts/private-videos/session'))}).privateVideoMode() }
};
`)
		fs.writeFileSync(path.join(directory, 'probe.spec.cjs'), `
const {test,expect} = require('@playwright/test');
for (const mode of ['pass','fail','retry']) test(mode + ${JSON.stringify(canary)}, async ({page}, info) => {
 await page.setContent('<h1>Synthetic private video test</h1><p>' + ${JSON.stringify(canary)} + '</p>');
 await page.waitForTimeout(250);
 console.log(${JSON.stringify(canary)});
 if (mode === 'fail' || (mode === 'retry' && info.retry === 0)) expect(true).toBe(false);
});
`)
		const result = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config], {
			cwd: root, encoding: 'utf8', timeout: 110000,
			env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', NODE_OPTIONS: `--require=${shim}`,
				PRIVATE_VIDEO_RECORDING: 'true', PRIVATE_VIDEO_BUCKET: session.bucket, PRIVATE_VIDEO_REGION: session.region,
				PUBLIC_SUMMARY_FILE: summaryFile, HEALTH_RESULT_FILE: health, GITHUB_STEP_SUMMARY: stepSummary, SLACK_WEBHOOK_URL: 'https://notification.invalid/' },
		})
		assert.equal(result.status, 1, result.stdout + result.stderr)
		const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'))
		assert.deepEqual(summary.counts, { passed: 1, failed: 1, flaky: 1, skipped: 0 }, result.stdout + result.stderr)
		assert.equal(summary.recordings.uploaded, 3, result.stdout + result.stderr)
		assert.equal(summary.recordings.status, 'complete')
		assert.equal(summary.recordings.missing, 0)
		assert.equal(JSON.parse(fs.readFileSync(health, 'utf8')).reportUrl, summary.recordings.url)
		for (const file of [summaryFile, health, slack, stepSummary]) {
			const content = fs.readFileSync(file, 'utf8')
			assert.ok(!content.includes(canary), file)
			assert.ok(content.includes('s3.console.aws.amazon.com'), file)
			assert.ok(!content.includes('X-Amz-'), file)
		}
		assert.ok(!`${result.stdout}${result.stderr}`.includes(canary))
		// A recovered test must still report an upload failure instead of claiming
		// that a recording is available when the private destination rejected it.
		const denied = spawnSync(process.execPath, ['scripts/run-public-playwright.js', '--config', config, '--grep', 'retry'], {
			cwd: root, encoding: 'utf8', timeout: 30000,
			env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', NODE_OPTIONS: `--require=${shim}`,
				PRIVATE_VIDEO_RECORDING: 'true', PRIVATE_VIDEO_BUCKET: session.bucket, PRIVATE_VIDEO_REGION: session.region,
				SYNTHETIC_UPLOAD_DENIED: 'true', PUBLIC_SUMMARY_FILE: summaryFile, HEALTH_RESULT_FILE: health,
				SLACK_WEBHOOK_URL: 'https://notification.invalid/' },
		})
		assert.equal(denied.status, 1, denied.stdout + denied.stderr)
		const deniedSummary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'))
		assert.equal(deniedSummary.counts.flaky, 1)
		assert.equal(deniedSummary.status, 'failed')
		assert.equal(deniedSummary.recordings.status, 'incomplete')
		assert.equal(deniedSummary.recordings.uploaded, 0)
		assert.equal(JSON.parse(fs.readFileSync(health, 'utf8')).status, 'failed')
		assert.match(fs.readFileSync(slack, 'utf8'), /upload was incomplete/)
		assert.ok(!`${denied.stdout}${denied.stderr}`.includes(canary))
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
