const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createBatch, readBatch, assertBatchId } = require('../../support/live-order-generator/batch.cjs')
const { targets } = require('../../support/live-order-generator/targets.cjs')
const { orderProfiles, customerName } = require('../../support/live-order-generator/profiles.cjs')
const { summarize } = require('./summarize.cjs')
const { runGenerator } = require('./run.cjs')

test('launcher supplies one persisted batch ID to independently loaded worker processes', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-batch-launcher-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	let invocations = 0
	const status = runGenerator({ directory, args: ['--grep', 'Rec order'], spawn(command, args, options) {
		invocations++
		assert.equal(command, process.execPath)
		assert.ok(args[0].endsWith('/scripts/run-public-playwright.js'))
		assert.ok(args[1].endsWith('/configs/live-order-generator.config.ts'))
		assert.deepEqual(args.slice(2), ['--grep', 'Rec order'])
		const { batchId } = readBatch(directory)
		assert.equal(options.env.LIVE_ORDER_BATCH_ID, batchId)
		const names = []
		for (const profile of orderProfiles) {
			// Each process has a fresh module cache, just like a new Playwright worker.
			const script = `const {targets}=require(${JSON.stringify(require.resolve('../../support/live-order-generator/targets.cjs'))}); const {customerName}=require(${JSON.stringify(require.resolve('../../support/live-order-generator/profiles.cjs'))}); process.stdout.write(JSON.stringify(targets.map(target=>customerName(target.pos,${JSON.stringify(profile)},process.env.LIVE_ORDER_BATCH_ID))))`
			const child = spawnSync(process.execPath, ['-e', script], { env: options.env, encoding: 'utf8' })
			assert.equal(child.status, 0)
			names.push(...JSON.parse(child.stdout))
		}
		assert.equal(new Set(names).size, 8)
		assert.deepEqual([...new Set(names.map(name => name.split('_').at(-1)))], [batchId])
		return { status: 0 }
	} })
	assert.equal(status, 0)
	assert.equal(invocations, 1)
	assert.throws(() => runGenerator({ directory, spawn() { invocations++ } }), /Existing batch/)
	assert.equal(invocations, 1)
})

test('launcher preserves test failures without replacing batch metadata', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-batch-failure-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	assert.equal(runGenerator({ directory, spawn() { return { status: 7 } } }), 7)
	assert.match(readBatch(directory).batchId, /^[A-Z0-9]{6}$/)
	for (const value of [undefined, '', 'lower1', 'TOO-LONG', 'BAD|ID']) assert.throws(() => assertBatchId(value))
})

test('reports reject mixed batches, wrong name suffixes, and missing or corrupt batch metadata while retaining order IDs', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-batch-report-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	const { batchId } = createBatch(directory)
	let orderId = 100
	for (const target of targets) for (const profile of orderProfiles) {
		fs.writeFileSync(path.join(directory, `${target.pos}-${profile.sequence}.json`), JSON.stringify({
			...target, sequence: profile.sequence, batchId, userType: profile.userType,
			customerName: customerName(target.pos, profile, batchId), medicalProfileVerified: profile.userType === 'med',
			orderId: String(orderId++), externalId: `pos-${orderId}`, status: 'verified',
		}))
	}
	assert.equal(summarize(directory).status, 'passed')
	assert.ok(summarize(directory).orders.every(order => order.batchId === batchId))
	const file = path.join(directory, 'dutchie-2.json')
	const record = JSON.parse(fs.readFileSync(file))
	const otherId = batchId === 'OTHER1' ? 'OTHER2' : 'OTHER1'
	fs.writeFileSync(file, JSON.stringify({ ...record, batchId: otherId }))
	assert.equal(summarize(directory).orders[1].status, 'invalid-evidence')
	fs.writeFileSync(file, JSON.stringify({ ...record, customerName: customerName('dutchie', orderProfiles[1], otherId) }))
	assert.equal(summarize(directory).orders[1].status, 'invalid-evidence')
	fs.writeFileSync(file, JSON.stringify(record))
	fs.writeFileSync(path.join(directory, 'batch.json'), '{incomplete')
	assert.equal(summarize(directory).status, 'failed')
	assert.equal(summarize(directory).orders.filter(order => order.orderId).length, 8)
	fs.unlinkSync(path.join(directory, 'batch.json'))
	assert.equal(summarize(directory).status, 'failed')
})
