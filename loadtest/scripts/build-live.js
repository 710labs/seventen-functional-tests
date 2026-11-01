const path = require('node:path')
const fs = require('node:fs')
const esbuild = require('esbuild-wasm')

async function buildLive() {
	const root = path.resolve(__dirname, '..')
	fs.mkdirSync(path.join(root, 'generated'), { recursive: true })
	await esbuild.build({
		entryPoints: [path.join(root, 'flows/live-funnel.ts')],
		outfile: path.join(root, 'generated/live-funnel.cjs'),
		bundle: true,
		platform: 'node',
		format: 'cjs',
		target: 'node22',
		external: ['@playwright/test'],
	})
}

if (require.main === module) buildLive().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { buildLive }
