import fs from 'fs/promises'

const csvToJson = require('csvtojson')

export type ParsedOrderExport = {
	delimiter: ',' | '\t'
	rawHeaderLine: string
	headers: string[]
	rows: Record<string, string>[]
}

function normalizeHeaderCell(header: string) {
	const trimmedHeader = header.trim()

	if (trimmedHeader.startsWith('"') && trimmedHeader.endsWith('"')) {
		return trimmedHeader.slice(1, -1).replace(/""/g, '"')
	}

	return trimmedHeader
}

function parseHeaderLine(rawHeaderLine: string, delimiter: ',' | '\t') {
	const headers: string[] = []
	let currentHeader = ''
	let insideQuotes = false

	for (let index = 0; index < rawHeaderLine.length; index++) {
		const character = rawHeaderLine[index]
		const nextCharacter = rawHeaderLine[index + 1]

		if (character === '"') {
			if (insideQuotes && nextCharacter === '"') {
				currentHeader += '""'
				index++
				continue
			}

			insideQuotes = !insideQuotes
			currentHeader += character
			continue
		}

		if (character === delimiter && !insideQuotes) {
			headers.push(normalizeHeaderCell(currentHeader))
			currentHeader = ''
			continue
		}

		currentHeader += character
	}

	headers.push(normalizeHeaderCell(currentHeader))

	return headers
}

export async function parseOrderExport(filePath: string): Promise<ParsedOrderExport> {
	const fileContents = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')
	const [rawHeaderLine = ''] = fileContents.split(/\r?\n/)
	const delimiter: ',' | '\t' = rawHeaderLine.includes('\t') ? '\t' : ','
	const headers = parseHeaderLine(rawHeaderLine, delimiter)
	const rows = await csvToJson({
		delimiter,
		trim: true,
	}).fromString(fileContents)

	return {
		delimiter,
		rawHeaderLine,
		headers,
		rows,
	}
}
