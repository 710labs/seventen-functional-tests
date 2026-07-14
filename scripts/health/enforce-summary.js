#!/usr/bin/env node
const fs = require('node:fs')

const summary = JSON.parse(fs.readFileSync(process.argv[2] || 'health-summary.json', 'utf8'))
if (summary.status === 'failed') {
	console.error('One or more required Daily System Health checks failed or did not report.')
	process.exit(1)
}
console.log(`Daily System Health conclusion: ${summary.status}`)
