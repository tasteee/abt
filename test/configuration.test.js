import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildScriptMenuRows } from '../bin/buildMenuRows.js'
import { loadScriptDescriptions } from '../bin/configuration.js'
import { listRecentScripts, recordScriptChoice } from '../bin/history.js'
import { chooseDetailMode } from '../bin/fuzzySelect.js'

const temporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'abt-config-'))

const target = (directory, scriptsByName) => ({
	name: 'fixture',
	directory,
	relativePath: '.',
	isRoot: true,
	scriptsByName,
	scriptDescriptionsByName: {}
})

test('merges package.json descriptions with one nested abt.json and ignores unknown scripts', () => {
	const directory = temporaryDirectory()
	const nestedDirectory = path.join(directory, 'tooling')
	fs.mkdirSync(nestedDirectory)
	fs.writeFileSync(
		path.join(nestedDirectory, 'abt.json'),
		JSON.stringify({ scripts: { test: 'Run every test', build: 'Create production output', missing: 'Ignored' } })
	)
	const descriptions = loadScriptDescriptions(
		directory,
		{ abt: { scripts: { test: 'Base description', lint: 'Check formatting' } } },
		{ test: 'node --test', build: 'tsc', lint: 'eslint .' }
	)
	assert.deepEqual(descriptions, {
		test: 'Run every test',
		lint: 'Check formatting',
		build: 'Create production output'
	})
})

test('does not apply configuration owned by a nested package', () => {
	const directory = temporaryDirectory()
	const child = path.join(directory, 'packages', 'child')
	fs.mkdirSync(child, { recursive: true })
	fs.writeFileSync(path.join(child, 'package.json'), '{"name":"child"}')
	fs.writeFileSync(path.join(child, 'abt.json'), '{"scripts":{"test":"Child description"}}')
	assert.deepEqual(
		loadScriptDescriptions(directory, { abt: { scripts: { test: 'Parent description' } } }, { test: 'node --test' }),
		{ test: 'Parent description' }
	)
})

test('rejects ambiguous or malformed abt.json configuration', () => {
	const directory = temporaryDirectory()
	fs.mkdirSync(path.join(directory, 'one'))
	fs.mkdirSync(path.join(directory, 'two'))
	fs.writeFileSync(path.join(directory, 'one', 'abt.json'), '{"scripts":{}}')
	fs.writeFileSync(path.join(directory, 'two', 'abt.json'), '{"scripts":{}}')
	assert.throws(() => loadScriptDescriptions(directory, {}, { test: 'node --test' }), /multiple abt\.json files/)

	const malformedDirectory = temporaryDirectory()
	fs.writeFileSync(path.join(malformedDirectory, 'abt.json'), '{"scripts":{"test":false}}')
	assert.throws(
		() => loadScriptDescriptions(malformedDirectory, {}, { test: 'node --test' }),
		/scripts\.test must be a non-empty string/
	)
})

test('keeps a per-package most-recently-used script order', () => {
	const directory = temporaryDirectory()
	const otherDirectory = temporaryDirectory()
	const historyPath = path.join(temporaryDirectory(), 'history.json')
	const first = target(directory, { build: 'tsc', test: 'node --test', lint: 'eslint .' })
	const second = target(otherDirectory, { test: 'node --test' })
	recordScriptChoice(first, 'build', historyPath)
	recordScriptChoice(first, 'test', historyPath)
	recordScriptChoice(first, 'build', historyPath)
	recordScriptChoice(second, 'test', historyPath)
	assert.deepEqual(listRecentScripts(first, historyPath), ['build', 'test'])
	assert.deepEqual(listRecentScripts(second, historyPath), ['test'])

	const stored = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
	assert.equal(stored.version, 1)
	assert.equal(Object.keys(stored.packages).length, 2)
})

test('puts recent scripts first and offers commands as the alternate view', () => {
	const packageTarget = target('.', { build: 'tsc', test: 'node --test', lint: 'eslint .' })
	packageTarget.scriptDescriptionsByName = { test: 'Run the test suite', lint: 'Check source formatting' }
	const rows = buildScriptMenuRows(packageTarget, ['test'])
	const plain = value => value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
	assert.equal(rows[0].value, 'run:test')
	assert.match(plain(rows[0].label), /Run the test suite.*recent/)
	assert.match(plain(rows[0].alternateLabel), /node --test.*recent/)
	assert.equal(rows.find(row => row.value === 'run:build').alternateLabel, undefined)
	assert.equal(chooseDetailMode(false, 'right'), true)
	assert.equal(chooseDetailMode(true, 'left'), false)
})
