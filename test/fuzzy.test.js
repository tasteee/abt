import assert from 'node:assert/strict'
import test from 'node:test'
import { isPrintableInput, listFilteredDependencyIndexes } from '../bin/dependencyFlow.js'
import { fuzzyFilter, fuzzyScore } from '../bin/fuzzy.js'
import { isPrintableFuzzyInput } from '../bin/fuzzySelect.js'

test('does not treat arrow keypresses without text payloads as filter input', () => {
	const rightArrow = { name: 'right' }
	assert.equal(isPrintableInput(undefined, rightArrow), false)
	assert.equal(isPrintableFuzzyInput(undefined, rightArrow), false)
	assert.equal(isPrintableInput('t', { name: 't' }), true)
})

test('scores exact, prefix, contained, and subsequence fuzzy matches in that order', () => {
	const exact = fuzzyScore('test', 'test')
	const prefix = fuzzyScore('test:unit', 'test')
	const contained = fuzzyScore('pretest', 'test')
	const subsequence = fuzzyScore('typecheck', 'tpc')

	assert.ok(exact > prefix)
	assert.ok(prefix > contained)
	assert.ok(contained > subsequence)
	assert.equal(fuzzyScore('build', 'xyz'), undefined)
})

test('fuzzy filters script names and commands with the best match first', () => {
	const scripts = [
		{ name: 'build', command: 'tsc' },
		{ name: 'test:unit', command: 'node --test' },
		{ name: 'typecheck', command: 'tsc --noEmit' }
	]

	const testMatches = fuzzyFilter(scripts, 'tst', script => `${script.name} ${script.command}`)
	assert.equal(testMatches[0].name, 'test:unit')
	assert.equal(fuzzyFilter(scripts, 'noemit', script => `${script.name} ${script.command}`)[0].name, 'typecheck')
})

test('fuzzy filters dependencies while retaining their original entry indexes', () => {
	const entries = [
		{ name: 'execa', section: 'dependencies', declaredVersion: '10.0.1' },
		{ name: '@types/node', section: 'devDependencies', declaredVersion: '26.1.2' },
		{ name: 'typescript', section: 'devDependencies', declaredVersion: '7.0.2' }
	]

	assert.deepEqual(listFilteredDependencyIndexes(entries, 'tsn'), [1])
	assert.deepEqual(listFilteredDependencyIndexes(entries, 'type'), [2, 1])
	assert.deepEqual(listFilteredDependencyIndexes(entries, ''), [0, 1, 2])
})
