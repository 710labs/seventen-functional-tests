import fs from 'fs/promises'
import path from 'path'

const csvToJson = require('csvtojson')

const menuUploadFixtureFiles = {
	'smoke-default': 'menu-upload-smoke-default.csv',
	'smoke-alt': 'menu-upload-smoke-alt.csv',
	'co-menu-4-7-25': 'co-menu-4-7-25.csv',
	'ca-menu-4-7-25': 'ca-menu-4-7-25.csv',
} as const

const defaultMenuUploadFixtureKey = 'smoke-default'
const menuUploadFixtureDirectory = path.join(
	__dirname,
	'../../tests/admin-drop-tests/fixtures/menu-upload',
)

export type ResolvedMenuUploadFixture = {
	fixtureKey: keyof typeof menuUploadFixtureFiles
	fileName: string
	filePath: string
	expectedProductNames: string[]
}

export async function resolveMenuUploadFixture(
	fixtureKeyInput = process.env.MENU_UPLOAD_FIXTURE,
): Promise<ResolvedMenuUploadFixture> {
	const normalizedFixtureKey =
		(fixtureKeyInput?.trim() as keyof typeof menuUploadFixtureFiles | undefined) ||
		defaultMenuUploadFixtureKey
	const fileName = menuUploadFixtureFiles[normalizedFixtureKey]

	if (!fileName) {
		throw new Error(
			`Unknown menu upload fixture "${fixtureKeyInput}". Supported fixtures: ${Object.keys(
				menuUploadFixtureFiles,
			).join(', ')}`,
		)
	}

	const filePath = path.join(menuUploadFixtureDirectory, fileName)
	const fileContents = await fs.readFile(filePath, 'utf8')
	const parsedRows = await csvToJson({
		trim: true,
	}).fromString(fileContents)
	const expectedProductNames = Array.from(
		new Set(parsedRows.map(row => `${row.Name || ''}`.trim()).filter(Boolean)),
	)

	if (!expectedProductNames.length) {
		throw new Error(`Menu upload fixture "${fileName}" did not contain any product names in the Name column`)
	}

	return {
		fixtureKey: normalizedFixtureKey,
		fileName,
		filePath,
		expectedProductNames,
	}
}
