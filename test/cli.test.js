import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { detectEnvironment } from '../bin/environment.js'
import { parseArguments } from '../bin/parseArguments.js'
import { configureTheme, symbols, truncate } from '../bin/theme.js'
import { InteractiveRenderer, JsonRenderer, PlainRenderer, SilentRenderer, TestRenderer } from '../bin/renderer.js'
import { LiveTerminal } from '../bin/liveTerminal.js'

const workspace = path.resolve(import.meta.dirname, '..')
const executable = path.join(workspace, 'bin', 'index.js')
const ansiPattern = /\u001B\[[0-?]*[ -/]*[@-~]/

const run = (arguments_, extraEnvironment = {}) => {
	return spawnSync(process.execPath, [executable, ...arguments_], {
		cwd: workspace,
		encoding: 'utf8',
		timeout: 5000,
		env: {
			...process.env,
			CI: '',
			NO_COLOR: '',
			FORCE_COLOR: '0',
			...extraEnvironment
		}
	})
}

test('redirected help, lists, and errors never contain terminal control sequences', () => {
	for (const arguments_ of [['--help'], ['--list'], ['--definitely-invalid']]) {
		const result = run(arguments_, { NO_COLOR: undefined })
		assert.equal(ansiPattern.test(result.stdout), false)
		assert.equal(ansiPattern.test(result.stderr), false)
	}
})

test('unknown options fail with a usage status and recovery action', () => {
	const result = run(['--definitely-invalid'])
	assert.equal(result.status, 2)
	assert.match(result.stderr, /unknown option/)
	assert.match(result.stderr, /abt --help/)
})

test('JSON list output is one stable parseable document', () => {
	const result = run(['--list', '--json'])
	assert.equal(result.status, 0)
	assert.equal(result.stderr, '')
	const document = JSON.parse(result.stdout)
	assert.equal(document.ok, true)
	assert.equal(document.command, 'list')
	assert.ok(Array.isArray(document.scripts))
	assert.ok(document.scripts.some(script => script.name === 'test'))
})

test('version output follows the selected renderer contract', () => {
	const plain = run(['--version'])
	assert.match(plain.stdout, /^\d+\.\d+\.\d+\n$/)
	const json = JSON.parse(run(['--version', '--json']).stdout)
	assert.deepEqual(json, { ok: true, command: 'version', version: '4.0.0' })
})

test('JSON failures remain machine-readable and use stderr only for human output', () => {
	const result = run(['--json', '--definitely-invalid'])
	assert.equal(result.status, 2)
	assert.equal(result.stderr, '')
	const document = JSON.parse(result.stdout)
	assert.equal(document.ok, false)
	assert.equal(document.error.category, 'usage')
})

test('CI and redirected streams disable interaction by default', () => {
	const parsed = parseArguments([]).parsed
	assert.equal(
		detectEnvironment(parsed, {
			stdinTTY: true,
			stdoutTTY: true,
			stderrTTY: true,
			environment: { CI: 'true' }
		}).interactive,
		false
	)
	assert.equal(
		detectEnvironment(parsed, {
			stdinTTY: true,
			stdoutTTY: false,
			stderrTTY: true,
			environment: {}
		}).interactive,
		false
	)
	const explicit = parseArguments(['--interactive']).parsed
	assert.equal(
		detectEnvironment(explicit, {
			stdinTTY: true,
			stdoutTTY: true,
			stderrTTY: true,
			environment: { CI: 'true' }
		}).interactive,
		true
	)
})

test('CI invocation exits with a stable script list instead of waiting for a prompt', () => {
	const result = run([], { CI: 'true' })
	assert.equal(result.status, 0)
	assert.equal(result.signal, null)
	assert.match(result.stdout, /^start\tnode bin/m)
	assert.equal(ansiPattern.test(result.stdout + result.stderr), false)
})

test('dependency reports remain plain and parseable through redirected streams', () => {
	const environment = { npm_config_registry: 'http://127.0.0.1:9' }
	const plain = run(['deps'], environment)
	assert.equal(plain.status, 0)
	assert.match(plain.stdout, /package\tdeclared\tinstalled\tmajor\tlatest/)
	assert.equal(ansiPattern.test(plain.stdout + plain.stderr), false)

	const json = run(['deps', '--json'], environment)
	assert.equal(json.status, 0)
	const document = JSON.parse(json.stdout)
	assert.equal(document.command, 'deps')
	assert.ok(Array.isArray(document.dependencies))
	assert.equal(json.stderr, '')
})

test('direct script execution preserves clean child output and exit status', () => {
	const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'abt-cli-'))
	fs.writeFileSync(
		path.join(fixture, 'package.json'),
		JSON.stringify({ name: 'fixture', scripts: { say: 'node -e "console.log(123)"' } })
	)
	const result = spawnSync(process.execPath, [executable, 'say'], {
		cwd: fixture,
		encoding: 'utf8',
		timeout: 5000,
		env: { ...process.env, NO_COLOR: '1' }
	})
	assert.equal(result.status, 0)
	assert.match(result.stdout, /123/)
	assert.equal(ansiPattern.test(result.stdout + result.stderr), false)
})

test('explicit interactive mode fails instead of attempting raw input through a pipe', () => {
	const result = run(['--interactive', '--list'])
	assert.equal(result.status, 2)
	assert.match(result.stderr, /requires stdin, stdout, and stderr/)
})

test('ASCII mode and very narrow terminal widths remain bounded', () => {
	const parsed = parseArguments(['--no-unicode']).parsed
	configureTheme(
		detectEnvironment(parsed, {
			stdinTTY: true,
			stdoutTTY: true,
			stderrTTY: true,
			columns: 12,
			rows: 8,
			environment: {}
		})
	)
	assert.equal(symbols().arrow, '->')
	assert.equal(symbols().cursor, '>')
	assert.equal(truncate('a long terminal row', 12).length, 12)
})

test('color detection honors NO_COLOR while allowing an explicit override', () => {
	const terminal = { stdinTTY: true, stdoutTTY: true, stderrTTY: true, environment: { NO_COLOR: '1' } }
	assert.equal(detectEnvironment(parseArguments([]).parsed, terminal).color, false)
	assert.equal(detectEnvironment(parseArguments(['--color']).parsed, terminal).color, true)
})

test('arguments after a bare separator are forwarded without interpretation', () => {
	const split = parseArguments(['test', '--', '--definitely-not-an-abt-option'])
	assert.deepEqual(split.parsed.positionals, ['test'])
	assert.deepEqual(split.forwardedArguments, ['--definitely-not-an-abt-option'])
})

test('contradictory terminal overrides fail clearly', () => {
	assert.throws(() => parseArguments(['--color', '--no-color']), /conflicting color options/)
	assert.throws(() => parseArguments(['--interactive', '--no-interactive']), /conflicting interactive options/)
})

test('options that would otherwise be ignored are rejected', () => {
	const listWithCommand = run(['deps', '--list'])
	assert.equal(listWithCommand.status, 2)
	assert.match(listWithCommand.stderr, /--list cannot be combined/)
	const updateOutsideDeps = run(['--list', '--update', 'typescript=major'])
	assert.equal(updateOutsideDeps.status, 2)
	assert.match(updateOutsideDeps.stderr, /can only be used with abt deps/)
})

const rendererEnvironment = overrides => ({
	interactive: false,
	color: false,
	unicode: false,
	json: false,
	quiet: false,
	verbose: false,
	debug: false,
	columns: 40,
	rows: 12,
	ci: false,
	...overrides
})

const captureWrites = async action => {
	let stdout = ''
	let stderr = ''
	const originalStdoutWrite = process.stdout.write
	const originalStderrWrite = process.stderr.write
	process.stdout.write = chunk => {
		stdout += String(chunk)
		return true
	}
	process.stderr.write = chunk => {
		stderr += String(chunk)
		return true
	}
	try {
		await action()
		return { stdout, stderr }
	} finally {
		process.stdout.write = originalStdoutWrite
		process.stderr.write = originalStderrWrite
	}
}

test('plain, silent, interactive, JSON, and test renderers honor their output contracts', async () => {
	const plain = new PlainRenderer(rendererEnvironment())
	const plainOutput = await captureWrites(async () => {
		plain.emit({
			type: 'script:list',
			scripts: [{ package: '.', name: 'test', command: 'node --test', qualifiedName: 'test' }]
		})
		plain.emit({ type: 'notice', level: 'warning', title: 'warning title', body: 'recovery' })
		plain.emit({ type: 'notice', level: 'error', title: 'error title' })
		await plain.flush()
		await plain.dispose()
	})
	assert.equal(plainOutput.stdout, 'test\tnode --test\n')
	assert.match(plainOutput.stderr, /warning title\nrecovery\nerror title/)

	const silent = new SilentRenderer(rendererEnvironment({ quiet: true }))
	const silentOutput = await captureWrites(async () => {
		silent.emit({ type: 'notice', level: 'info', title: 'hidden' })
		silent.emit({ type: 'notice', level: 'error', title: 'visible error' })
	})
	assert.equal(silentOutput.stderr, 'visible error\n')

	const interactive = new InteractiveRenderer(rendererEnvironment({ interactive: true }))
	const interactiveOutput = await captureWrites(async () => {
		interactive.emit({ type: 'operation:start', id: 'lookup', title: 'checking versions' })
		interactive.emit({ type: 'operation:complete', id: 'lookup' })
		await interactive.dispose()
	})
	assert.match(interactiveOutput.stderr, /^checking versions(?:\.\.\.|…)\r\u001B\[2K$/)

	const json = new JsonRenderer()
	const jsonOutput = await captureWrites(async () => {
		json.emit({ type: 'dependency:empty', package: '.' })
		await json.flush()
	})
	assert.deepEqual(JSON.parse(jsonOutput.stdout), {
		ok: true,
		command: 'deps',
		package: '.',
		dependencies: [],
		changes: []
	})
	assert.equal(ansiPattern.test(jsonOutput.stdout), false)

	const testRenderer = new TestRenderer()
	testRenderer.emit({ type: 'operation:start', id: 'one', title: 'one' })
	testRenderer.emit({ type: 'operation:complete', id: 'one' })
	assert.deepEqual(testRenderer.events.map(event => event.type), ['operation:start', 'operation:complete'])
})

test('live terminal cleanup restores raw mode and cursor exactly once', () => {
	const input = new PassThrough()
	const output = new PassThrough()
	const rawModes = []
	let rendered = ''
	input.isRaw = false
	input.setRawMode = value => {
		rawModes.push(value)
		input.isRaw = value
		return input
	}
	output.on('data', chunk => {
		rendered += chunk.toString()
	})

	const terminal = new LiveTerminal(input, output)
	terminal.start()
	terminal.render(['one', 'two'])
	terminal.dispose()
	terminal.dispose()

	assert.deepEqual(rawModes, [true, false])
	assert.match(rendered, /^\u001B\[\?25lone\ntwo/)
	assert.match(rendered, /\u001B\[\?25h$/)
})
