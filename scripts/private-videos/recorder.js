const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { finished } = require('node:stream/promises')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { consoleUrl } = require('./session')

class PrivateVideoRecorder {
	constructor(session, roots, client) {
		this.session = session
		this.roots = roots.map(root => path.resolve(root))
		this.client = client || new S3Client({ region: session.region, maxAttempts: 2 })
		this.ownsClient = !client
		this.pending = Promise.resolve()
		this.entries = []
		this.uploaded = 0
		this.failed = 0
		this.missing = 0
	}

	collect(test, result) {
		if (!['failed', 'timedOut', 'interrupted'].includes(result.status) || result.status === test.expectedStatus) return
		const id = createHash('sha256').update(test.id).digest('hex').slice(0, 16)
		const videos = result.attachments.filter(item => item.contentType === 'video/webm' && item.path)
		if (!videos.length) this.missing++
		for (const [index, video] of videos.entries()) {
			const entry = { id, title: test.title, project: test.parent.project()?.name || '',
				retry: result.retry, status: result.status, durationMs: result.duration,
				key: `${this.session.prefix}${id}/attempt-${result.retry}/video-${index}.webm` }
			this.pending = this.pending.then(async () => {
				try {
					const filename = fs.realpathSync(video.path)
					if (!this.roots.some(root => fs.existsSync(root) && filename.startsWith(`${fs.realpathSync(root)}${path.sep}`)) || path.extname(filename) !== '.webm') {
						throw new Error('Unexpected video path')
					}
					const header = Buffer.alloc(4)
					const descriptor = fs.openSync(filename, 'r')
					try { fs.readSync(descriptor, header, 0, 4, 0) } finally { fs.closeSync(descriptor) }
					if (header.toString('hex') !== '1a45dfa3') throw new Error('Unexpected video content')
					const stream = fs.createReadStream(filename, { fd: fs.openSync(filename, 'r'), autoClose: true })
					const closed = finished(stream).catch(() => {})
					try {
						await this.put(entry.key, stream, 'video/webm', fs.statSync(filename).size)
					} finally { stream.destroy(); await closed }
					this.uploaded++
					this.entries.push(entry)
				} catch {
					this.failed++
				}
			})
		}
	}

	put(key, body, type, size) {
		return this.client.send(new PutObjectCommand({ Bucket: this.session.bucket, Key: key,
			Body: body, ContentType: type, ...(size === undefined ? {} : { ContentLength: size }),
			ServerSideEncryption: 'AES256' }), { abortSignal: AbortSignal.timeout(60000) })
	}

	async finish() {
		await this.pending
		try {
			if (this.entries.length) {
				// Human-readable test names stay in private storage, never in public metadata.
				await this.put(`${this.session.prefix}manifest.json`, JSON.stringify({ version: 1, recordings: this.entries }, null, 2), 'application/json')
			}
		} catch { this.failed++ }
		finally { if (this.ownsClient) this.client.destroy() }
		return { status: this.failed ? 'incomplete' : 'complete', uploaded: this.uploaded,
			failed: this.failed, missing: this.missing,
			...(this.uploaded ? { url: consoleUrl(this.session), videos: this.entries.map(entry => ({ id: entry.id,
				retry: entry.retry, url: consoleUrl(this.session, entry.key) })) } : {}) }
	}
}

module.exports = { PrivateVideoRecorder }
