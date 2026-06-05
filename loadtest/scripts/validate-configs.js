const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const YAML_LOAD = yaml.load || yaml.safeLoad
const YAML_EXTENSIONS = new Set(['.yml', '.yaml'])

function parseArgs(argv) {
	const args = {
		_: [],
	}

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index]

		if (!token.startsWith('--')) {
			args._.push(token)
			continue
		}

		const withoutPrefix = token.slice(2)
		const equalsIndex = withoutPrefix.indexOf('=')
		const key = equalsIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalsIndex)
		let value = equalsIndex === -1 ? undefined : withoutPrefix.slice(equalsIndex + 1)

		if (value === undefined) {
			const next = argv[index + 1]

			if (next && !next.startsWith('--')) {
				value = next
				index += 1
			} else {
				value = true
			}
		}

		args[key] = value
	}

	return args
}

function parseBoolean(value, fallback = false) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	if (typeof value === 'boolean') {
		return value
	}

	return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase())
}

function isYamlFile(filePath) {
	return YAML_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function collectYamlFiles(inputPath) {
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Path does not exist: ${inputPath}`)
	}

	const stats = fs.statSync(inputPath)

	if (stats.isFile()) {
		return isYamlFile(inputPath) ? [inputPath] : []
	}

	if (!stats.isDirectory()) {
		return []
	}

	const files = []
	const entries = fs.readdirSync(inputPath, { withFileTypes: true })

	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
			continue
		}

		const childPath = path.join(inputPath, entry.name)

		if (entry.isDirectory()) {
			files.push(...collectYamlFiles(childPath))
		} else if (entry.isFile() && isYamlFile(childPath)) {
			files.push(childPath)
		}
	}

	return files
}

function defaultInputs() {
	const cwd = process.cwd()
	const candidates = [
		path.join(cwd, 'config'),
		path.join(cwd, 'configs'),
		path.join(cwd, 'generated'),
		path.join(cwd, 'loadtest', 'config'),
		path.join(cwd, 'loadtest', 'configs'),
		path.join(cwd, 'loadtest', 'generated'),
	]

	return candidates.filter(candidate => fs.existsSync(candidate))
}

function readYaml(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8')
	const parsed = YAML_LOAD(raw)

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('YAML document must be an object.')
	}

	return parsed
}

function isPositiveNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPositiveNumericValue(value) {
	if (isPositiveNumber(value)) {
		return true
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value)

		return Number.isFinite(parsed) && parsed > 0
	}

	return false
}

function resolveRelativePath(baseFile, value) {
	if (!value || typeof value !== 'string') {
		return null
	}

	if (path.isAbsolute(value)) {
		return value
	}

	return path.resolve(path.dirname(baseFile), value)
}

function resolveExistingPath(baseFile, value) {
	const relativePath = resolveRelativePath(baseFile, value)

	if (relativePath && fs.existsSync(relativePath)) {
		return relativePath
	}

	const cwdPath = value && typeof value === 'string' ? path.resolve(value) : null

	if (cwdPath && fs.existsSync(cwdPath)) {
		return cwdPath
	}

	return relativePath
}

function loadProcessor(processorPath) {
	const resolved = require.resolve(processorPath)

	delete require.cache[resolved]

	return require(resolved)
}

function validatePhases(config, errors) {
	const phases = config.phases

	if (!Array.isArray(phases) || phases.length === 0) {
		errors.push('config.phases must be a non-empty array.')
		return
	}

	for (const [index, phase] of phases.entries()) {
		const label = `config.phases[${index}]`

		if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
			errors.push(`${label} must be an object.`)
			continue
		}

		if (!isPositiveNumericValue(phase.duration)) {
			errors.push(`${label}.duration must be a positive number.`)
		}

		const hasArrivalRate = phase.arrivalRate !== undefined
		const hasArrivalCount = phase.arrivalCount !== undefined
		const hasRampTo = phase.rampTo !== undefined

		if (!hasArrivalRate && !hasArrivalCount) {
			errors.push(`${label} must define arrivalRate or arrivalCount.`)
		}

		if (hasArrivalRate && !isPositiveNumericValue(phase.arrivalRate)) {
			errors.push(`${label}.arrivalRate must be a positive number.`)
		}

		if (hasArrivalCount && !isPositiveNumericValue(phase.arrivalCount)) {
			errors.push(`${label}.arrivalCount must be a positive number.`)
		}

		if (hasRampTo && !isPositiveNumericValue(phase.rampTo)) {
			errors.push(`${label}.rampTo must be a positive number.`)
		}

		if (phase.maxVusers !== undefined && !isPositiveNumericValue(phase.maxVusers)) {
			errors.push(`${label}.maxVusers must be a positive number when set.`)
		}
	}
}

function validateIncludeFiles(filePath, config, errors) {
	if (!Array.isArray(config.includeFiles)) {
		return
	}

	for (const includeFile of config.includeFiles) {
		if (typeof includeFile !== 'string') {
			errors.push('config.includeFiles entries must be strings.')
			continue
		}

		const resolved = resolveExistingPath(filePath, includeFile)

		if (!resolved || !fs.existsSync(resolved)) {
			errors.push(`config.includeFiles entry does not exist: ${includeFile}`)
		}
	}
}

function asStringArray(value) {
	if (value === undefined || value === null) {
		return []
	}

	if (typeof value === 'string') {
		return [value]
	}

	if (Array.isArray(value)) {
		return value.filter(item => typeof item === 'string')
	}

	return []
}

function collectRequestHooks(requestDefinition) {
	if (!requestDefinition || typeof requestDefinition !== 'object') {
		return []
	}

	return [
		...asStringArray(requestDefinition.beforeRequest),
		...asStringArray(requestDefinition.afterResponse),
	]
}

function collectScenarioProcessorFunctions(scenario) {
	const functions = [
		...asStringArray(scenario.beforeRequest),
		...asStringArray(scenario.afterResponse),
	]

	if (typeof scenario.testFunction === 'string') {
		functions.push(scenario.testFunction)
	}

	if (!Array.isArray(scenario.flow)) {
		return functions
	}

	const requestMethods = ['get', 'post', 'put', 'patch', 'delete', 'head']

	for (const step of scenario.flow) {
		if (!step || typeof step !== 'object' || Array.isArray(step)) {
			continue
		}

		if (typeof step.function === 'string') {
			functions.push(step.function)
		}

		for (const method of requestMethods) {
			if (step[method]) {
				functions.push(...collectRequestHooks(step[method]))
			}
		}
	}

	return functions
}

function validateProcessorExport(processorExports, exportName, label, errors) {
	if (!processorExports) {
		return
	}

	if (typeof processorExports[exportName] !== 'function') {
		errors.push(`${label} "${exportName}" is not exported by config.processor.`)
	}
}

function validateScenarios(document, processorExports, errors) {
	const scenarios = document.scenarios

	if (!Array.isArray(scenarios) || scenarios.length === 0) {
		errors.push('scenarios must be a non-empty array.')
		return
	}

	for (const [index, scenario] of scenarios.entries()) {
		const label = `scenarios[${index}]`

		if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
			errors.push(`${label} must be an object.`)
			continue
		}

		if (!['playwright', 'http'].includes(scenario.engine)) {
			errors.push(`${label}.engine must be "playwright" or "http".`)
		}

		if (scenario.engine === 'playwright') {
			if (typeof scenario.testFunction !== 'string' || scenario.testFunction.trim() === '') {
				errors.push(`${label}.testFunction must be a non-empty string for Playwright scenarios.`)
				continue
			}
		}

		if (scenario.engine === 'http' && !Array.isArray(scenario.flow)) {
			errors.push(`${label}.flow must be an array for HTTP scenarios.`)
		}

		for (const exportName of collectScenarioProcessorFunctions(scenario)) {
			validateProcessorExport(processorExports, exportName, label, errors)
		}
	}
}

function validateConfigFile(filePath) {
	const errors = []
	let document

	try {
		document = readYaml(filePath)
	} catch (error) {
		return {
			filePath,
			errors: [`YAML parse failed: ${error.message}`],
		}
	}

	if (!document.config || typeof document.config !== 'object' || Array.isArray(document.config)) {
		errors.push('config must be an object.')
	}

	const config = document.config || {}

	if (typeof config.target !== 'string' || config.target.trim() === '') {
		errors.push('config.target must be a non-empty string.')
	}

	validatePhases(config, errors)
	validateIncludeFiles(filePath, config, errors)

	let processorExports = null

	if (typeof config.processor !== 'string' || config.processor.trim() === '') {
		errors.push('config.processor must be a non-empty string.')
	} else {
		const processorPath = resolveExistingPath(filePath, config.processor)

		if (!processorPath || !fs.existsSync(processorPath)) {
			errors.push(`config.processor does not exist: ${config.processor}`)
		} else {
			try {
				processorExports = loadProcessor(processorPath)
			} catch (error) {
				errors.push(`config.processor could not be loaded: ${error.message}`)
			}
		}
	}

	validateScenarios(document, processorExports, errors)

	return {
		filePath,
		errors,
	}
}

function validateConfigFiles(filePaths) {
	return filePaths.map(validateConfigFile)
}

function printUsage() {
	console.log(`Usage: node scripts/validate-configs.js [config-or-directory ...]

Validates Artillery YAML files, processor paths, and scenario testFunction exports.

Options:
  --allow-empty   Exit successfully when no YAML files are found.`)
}

function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv)

	if (args.help) {
		printUsage()
		return []
	}

	const inputs = args._.length > 0 ? args._ : defaultInputs()
	const allowEmpty =
		parseBoolean(args['allow-empty']) || parseBoolean(process.env.LOADTEST_VALIDATE_ALLOW_EMPTY)
	const files = [...new Set(inputs.flatMap(input => collectYamlFiles(path.resolve(input))))].sort()

	if (files.length === 0) {
		if (allowEmpty) {
			console.log('No YAML configs found.')
			return []
		}

		throw new Error('No YAML configs found to validate.')
	}

	const results = validateConfigFiles(files)
	const failures = results.filter(result => result.errors.length > 0)

	for (const result of results) {
		if (result.errors.length === 0) {
			console.log(`[ok] ${result.filePath}`)
			continue
		}

		console.log(`[fail] ${result.filePath}`)
		for (const error of result.errors) {
			console.log(`  - ${error}`)
		}
	}

	if (failures.length > 0) {
		throw new Error(`${failures.length} config file(s) failed validation.`)
	}

	console.log(`Validated ${results.length} config file(s).`)

	return results
}

if (require.main === module) {
	try {
		main()
	} catch (error) {
		console.error(`[validate-configs] ${error.message}`)
		process.exitCode = 1
	}
}

module.exports = {
	collectYamlFiles,
	collectScenarioProcessorFunctions,
	parseArgs,
	validateConfigFile,
	validateConfigFiles,
}
