const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const YAML_LOAD = yaml.load || yaml.safeLoad
const YAML_DUMP = yaml.dump || yaml.safeDump

function parseArgs(argv) {
	const args = {
		_: [],
		set: [],
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

		if (key === 'set') {
			args.set.push(value)
		} else {
			args[key] = value
		}
	}

	return args
}

function getOption(args, keys, envKeys, fallback) {
	for (const key of keys) {
		if (args[key] !== undefined) {
			return args[key]
		}
	}

	for (const key of envKeys) {
		if (process.env[key] !== undefined && process.env[key] !== '') {
			return process.env[key]
		}
	}

	return fallback
}

function parsePositiveInteger(value, label, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	const parsed = Number.parseInt(value, 10)

	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${label} must be a positive integer.`)
	}

	return parsed
}

function parseNonNegativeInteger(value, label, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	const parsed = Number.parseInt(value, 10)

	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${label} must be a non-negative integer.`)
	}

	return parsed
}

function parsePositiveNumber(value, label, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	const parsed = Number(value)

	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`${label} must be a positive number.`)
	}

	return parsed
}

function parseOptionalBoolean(value, fallback = false) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	if (typeof value === 'boolean') {
		return value
	}

	return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase())
}

function parseScalar(value) {
	const text = String(value).trim()

	if (text === 'true') {
		return true
	}

	if (text === 'false') {
		return false
	}

	if (text === 'null') {
		return null
	}

	if (/^-?\d+(\.\d+)?$/.test(text)) {
		return Number(text)
	}

	if (
		(text.startsWith('{') && text.endsWith('}')) ||
		(text.startsWith('[') && text.endsWith(']'))
	) {
		return JSON.parse(text)
	}

	return value
}

function parsePath(pathExpression) {
	const tokens = []

	for (const part of pathExpression.split('.')) {
		const matcher = /([^\[\]]+)|\[(\d+)\]/g
		let match = matcher.exec(part)

		while (match) {
			tokens.push(match[1] !== undefined ? match[1] : Number(match[2]))
			match = matcher.exec(part)
		}
	}

	return tokens
}

function setByPath(target, pathExpression, value) {
	const tokens = parsePath(pathExpression)

	if (tokens.length === 0) {
		throw new Error(`Invalid --set path: ${pathExpression}`)
	}

	let cursor = target

	for (let index = 0; index < tokens.length - 1; index += 1) {
		const token = tokens[index]
		const nextToken = tokens[index + 1]

		if (cursor[token] === undefined || cursor[token] === null) {
			cursor[token] = typeof nextToken === 'number' ? [] : {}
		}

		cursor = cursor[token]
	}

	cursor[tokens[tokens.length - 1]] = value
}

function parseSetExpression(expression) {
	const separatorIndex = String(expression).indexOf('=')

	if (separatorIndex === -1) {
		throw new Error(`--set must be path=value, received: ${expression}`)
	}

	return {
		path: String(expression).slice(0, separatorIndex),
		value: parseScalar(String(expression).slice(separatorIndex + 1)),
	}
}

function readYamlFile(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8')
	const parsed = YAML_LOAD(raw)

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${filePath} must contain a YAML object.`)
	}

	return parsed
}

function clone(value) {
	return JSON.parse(JSON.stringify(value))
}

function toFixedNumber(value) {
	return Number(Number(value).toFixed(6))
}

function distributeInteger(total, workers, workerIndex, label) {
	const base = Math.floor(total / workers)
	const remainder = total % workers
	const value = base + (workerIndex < remainder ? 1 : 0)

	if (value <= 0) {
		throw new Error(`${label} cannot be split across ${workers} workers without zero-load workers.`)
	}

	return value
}

function distributePhaseLoad(phase, workers, workerIndex, options) {
	const rendered = { ...phase }

	if (options.duration !== undefined) {
		rendered.duration = options.duration
	}

	if (options.arrivalRate !== undefined) {
		rendered.arrivalRate = options.arrivalRate
		delete rendered.arrivalCount
	}

	if (options.arrivalCount !== undefined) {
		rendered.arrivalCount = options.arrivalCount
		delete rendered.arrivalRate
		delete rendered.rampTo
	}

	if (rendered.arrivalRate !== undefined && !options.keepArrivalRate) {
		rendered.arrivalRate = toFixedNumber(Number(rendered.arrivalRate) / workers)
	}

	if (rendered.rampTo !== undefined && !options.keepArrivalRate) {
		rendered.rampTo = toFixedNumber(Number(rendered.rampTo) / workers)
	}

	if (rendered.arrivalCount !== undefined) {
		rendered.arrivalCount = distributeInteger(
			Number(rendered.arrivalCount),
			workers,
			workerIndex,
			'arrivalCount',
		)
	}

	if (options.maxVusers !== undefined) {
		rendered.maxVusers = options.maxVusers
	}

	if (rendered.maxVusers !== undefined && !options.keepMaxVusers) {
		rendered.maxVusers = Math.max(1, Math.ceil(Number(rendered.maxVusers) / workers))
	}

	return rendered
}

function applyOverrides(config, worker, options) {
	const rendered = clone(config)

	rendered.config = rendered.config || {}

	if (options.target) {
		rendered.config.target = options.target
	}

	if (options.processor) {
		rendered.config.processor = options.processor
	}

	if (Array.isArray(rendered.config.phases)) {
		rendered.config.phases = rendered.config.phases.map(phase =>
			distributePhaseLoad(phase, worker.count, worker.index, options),
		)
	}

	rendered.config.variables = {
		...(rendered.config.variables || {}),
		workerIndex: worker.index,
		workerNumber: worker.index + 1,
		workerCount: worker.count,
	}

	if (options.gateTime) {
		rendered.config.variables.gateTime = options.gateTime
	}

	if (options.name) {
		rendered.config.name = `${options.name}-worker-${worker.index + 1}-of-${worker.count}`
	} else if (rendered.config.name) {
		rendered.config.name = `${rendered.config.name}-worker-${worker.index + 1}-of-${worker.count}`
	}

	for (const expression of options.setExpressions) {
		const parsed = parseSetExpression(expression)
		setByPath(rendered, parsed.path, parsed.value)
	}

	return rendered
}

function renderConfigs(inputPath, options) {
	const source = readYamlFile(inputPath)
	const workers = options.workers
	const workerIndexes =
		options.workerIndex === undefined
			? Array.from({ length: workers }, (_, index) => index)
			: [options.workerIndex]

	return workerIndexes.map(workerIndex => {
		if (workerIndex < 0 || workerIndex >= workers) {
			throw new Error(`workerIndex ${workerIndex} is outside worker count ${workers}.`)
		}

		return {
			workerIndex,
			config: applyOverrides(
				source,
				{
					index: workerIndex,
					count: workers,
				},
				options,
			),
		}
	})
}

function shouldRewritePath(value) {
	if (typeof value !== 'string' || value.trim() === '') {
		return false
	}

	if (path.isAbsolute(value)) {
		return false
	}

	return !value.includes('{{')
}

function relativeYamlPath(fromDir, targetPath) {
	const relativePath = path.relative(fromDir, targetPath).replace(/\\/g, '/')

	if (relativePath.startsWith('.')) {
		return relativePath
	}

	return `./${relativePath}`
}

function rewriteRelativeFileRefs(config, sourcePath, outputPath) {
	if (!sourcePath || !outputPath || !config.config) {
		return config
	}

	const sourceDir = path.dirname(sourcePath)
	const outputDir = path.dirname(outputPath)

	if (shouldRewritePath(config.config.processor)) {
		config.config.processor = relativeYamlPath(outputDir, path.resolve(sourceDir, config.config.processor))
	}

	if (Array.isArray(config.config.includeFiles)) {
		config.config.includeFiles = config.config.includeFiles.map(includeFile => {
			if (!shouldRewritePath(includeFile)) {
				return includeFile
			}

			return relativeYamlPath(outputDir, path.resolve(sourceDir, includeFile))
		})
	}

	return config
}

function writeRenderedConfigs(renderedConfigs, options) {
	const written = []

	if (options.outputPath && renderedConfigs.length !== 1) {
		throw new Error('--output can only be used when rendering one worker config.')
	}

	if (!options.outputPath) {
		fs.mkdirSync(options.outputDir, { recursive: true })
	} else {
		fs.mkdirSync(path.dirname(options.outputPath), { recursive: true })
	}

	for (const rendered of renderedConfigs) {
		const outputPath =
			options.outputPath ||
			path.join(
				options.outputDir,
				`${options.prefix}-worker-${rendered.workerIndex + 1}-of-${options.workers}.yml`,
			)
		const outputConfig = options.rewriteRelativePaths
			? rewriteRelativeFileRefs(clone(rendered.config), options.sourcePath, outputPath)
			: rendered.config
		const output = YAML_DUMP(outputConfig, {
			lineWidth: -1,
			noRefs: true,
		})

		fs.writeFileSync(outputPath, output)
		written.push(outputPath)
	}

	return written
}

function buildOptions(args) {
	const workers = parsePositiveInteger(
		getOption(args, ['workers', 'worker-count'], ['LOADTEST_WORKERS', 'WORKER_COUNT'], 1),
		'workers',
		1,
	)
	const indexBase = parseNonNegativeInteger(getOption(args, ['index-base'], ['LOADTEST_INDEX_BASE'], 0), 'index-base', 0)
	const workerNumber = getOption(args, ['worker-number'], ['LOADTEST_WORKER_NUMBER'], undefined)
	let workerIndex

	if (workerNumber !== undefined) {
		workerIndex = parsePositiveInteger(workerNumber, 'worker-number', undefined) - 1
	} else {
		const rawWorkerIndex = parseNonNegativeInteger(
			getOption(args, ['worker-index'], ['LOADTEST_WORKER_INDEX'], undefined),
			'worker-index',
			undefined,
		)

		workerIndex = rawWorkerIndex === undefined ? undefined : rawWorkerIndex - indexBase
	}

	return {
		workers,
		workerIndex,
		outputDir: path.resolve(
			getOption(args, ['out-dir', 'output-dir'], ['LOADTEST_OUTPUT_DIR'], 'generated'),
		),
		outputPath: args.output ? path.resolve(args.output) : undefined,
		prefix: getOption(args, ['prefix'], ['LOADTEST_OUTPUT_PREFIX'], 'loadtest'),
		target: getOption(args, ['target'], ['ARTILLERY_TARGET', 'LOADTEST_TARGET'], undefined),
		processor: getOption(args, ['processor'], ['LOADTEST_PROCESSOR'], undefined),
		gateTime: getOption(args, ['gate-time', 'gate'], ['LOADTEST_GATE_TIME', 'DROP_GATE_TIME'], undefined),
		name: getOption(args, ['name'], ['LOADTEST_NAME'], undefined),
		duration: parsePositiveInteger(args.duration, 'duration', undefined),
		arrivalRate: parsePositiveNumber(args['arrival-rate'], 'arrival-rate', undefined),
		arrivalCount: parsePositiveInteger(args['arrival-count'], 'arrival-count', undefined),
		maxVusers: parsePositiveInteger(args['max-vusers'], 'max-vusers', undefined),
		keepArrivalRate: parseOptionalBoolean(args['keep-arrival-rate'], false),
		keepMaxVusers: parseOptionalBoolean(args['keep-max-vusers'], false),
		rewriteRelativePaths: !parseOptionalBoolean(args['no-rewrite-relative-paths'], false),
		setExpressions: args.set,
	}
}

function printUsage() {
	console.log(`Usage: node scripts/render-config.js --config <template.yml> [options]

Options:
  --workers <n>              Number of worker YAML files to render.
  --worker-index <n>         Render one zero-based worker index.
  --worker-number <n>        Render one one-based worker number.
  --out-dir <dir>            Output directory for multi-worker rendering.
  --output <file>            Output file for single-worker rendering.
  --prefix <name>            Generated filename prefix.
  --target <url>             Override config.target.
  --gate-time <time>         Add gateTime to config.variables.
  --arrival-rate <n>         Override phase arrivalRate before splitting.
  --arrival-count <n>        Override phase arrivalCount before splitting.
  --duration <seconds>       Override phase duration.
  --max-vusers <n>           Override maxVusers before splitting.
  --set path=value           Set an arbitrary YAML value. Repeatable.
  --no-rewrite-relative-paths
                              Keep processor/includeFiles paths unchanged.
  --print                    Print generated file paths as JSON.`)
}

function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv)

	if (args.help) {
		printUsage()
		return []
	}

	const input = getOption(args, ['config', 'template'], ['LOADTEST_CONFIG', 'LOADTEST_TEMPLATE'], args._[0])

	if (!input) {
		throw new Error('A config template path is required. Pass --config <template.yml>.')
	}

	const inputPath = path.resolve(input)
	const options = buildOptions(args)
	options.sourcePath = inputPath
	const renderedConfigs = renderConfigs(inputPath, options)
	const written = writeRenderedConfigs(renderedConfigs, options)

	if (args.print) {
		console.log(JSON.stringify(written, null, 2))
	} else {
		console.log(`Rendered ${written.length} config(s).`)
		for (const filePath of written) {
			console.log(filePath)
		}
	}

	return written
}

if (require.main === module) {
	try {
		main()
	} catch (error) {
		console.error(`[render-config] ${error.message}`)
		process.exitCode = 1
	}
}

module.exports = {
	applyOverrides,
	buildOptions,
	distributeInteger,
	parseArgs,
	renderConfigs,
	writeRenderedConfigs,
}
