#!/usr/bin/env node
const fs = require('node:fs')

const inputFile = process.argv[2] || 'order_ids.txt'
const ids = fs.existsSync(inputFile)
	? [...new Set(fs.readFileSync(inputFile, 'utf8').split(/\r?\n/).map(value => value.trim()).filter(Boolean))]
	: []
const json = JSON.stringify(ids)

console.log(`Collected ${ids.length} unique order ID(s): ${json}`)
if (process.env.GITHUB_OUTPUT) {
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `order_ids_json=${json}\n`)
}
if (process.argv[3]) {
	fs.writeFileSync(process.argv[3], `${json}\n`)
}
