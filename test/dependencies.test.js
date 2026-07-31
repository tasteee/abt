import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
	buildDependencyEntries,
	isRegistryDependency,
	loadLatestVersions,
	readInstalledVersion
} from '../bin/dependencies.js'
import {
	buildDependencyScreen,
	buildReviewScreen,
	isMajorUpgrade,
	listVersionTrackChoices,
	moveVersionColumn
} from '../bin/dependencyFlow.js'
import { resolveDependencyUpdates } from '../bin/dependencyCommand.js'
import { updateDependencyVersion, updateDependencyVersions } from '../bin/updateDependency.js'
import { configureTheme } from '../bin/theme.js'

const makeTemporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'abt-deps-'))

test('identifies major upgrades from the declared manifest version', () => {
	assert.equal(isMajorUpgrade('^9.6.1', '10.0.1'), true)
	assert.equal(isMajorUpgrade('^9.6.1', '9.8.0'), false)
	assert.equal(isMajorUpgrade('workspace:*', '2.0.0'), false)
})

test('does not offer registry actions for local and aliased specs', () => {
	assert.equal(isRegistryDependency('workspace:*'), false)
	assert.equal(isRegistryDependency('file:../shared'), false)
	assert.equal(isRegistryDependency('https://example.com/package.tgz'), false)
	assert.equal(isRegistryDependency('npm:other-package@^1.0.0'), false)
	assert.equal(isRegistryDependency('^1.0.0'), true)
})

test('finds an installed package hoisted to the workspace root', () => {
	const workspaceRoot = makeTemporaryDirectory()
	const packageDirectory = path.join(workspaceRoot, 'packages', 'web')
	const installedDirectory = path.join(workspaceRoot, 'node_modules', '@scope', 'tool')
	fs.mkdirSync(packageDirectory, { recursive: true })
	fs.mkdirSync(installedDirectory, { recursive: true })
	fs.writeFileSync(path.join(installedDirectory, 'package.json'), '{"version":"3.4.5"}')

	assert.equal(readInstalledVersion('@scope/tool', packageDirectory, workspaceRoot), '3.4.5')
})

test('builds dependency entries in manifest order', () => {
	const packageDirectory = makeTemporaryDirectory()
	const targetPackage = {
		name: 'fixture',
		directory: packageDirectory,
		relativePath: '.',
		isRoot: true,
		scriptsByName: {}
	}

	const entries = buildDependencyEntries(targetPackage, packageDirectory, {
		devDependencies: { typescript: '^6.0.0' },
		dependencies: { zebra: '^1.0.0', alpha: '^2.0.0' },
		peerDependencies: { react: '^19.0.0' }
	})

	assert.deepEqual(
		entries.map(entry => `${entry.section}:${entry.name}`),
		['devDependencies:typescript', 'dependencies:zebra', 'dependencies:alpha', 'peerDependencies:react']
	)
})

test('renders a responsive dependency table with staged values in the declared column', () => {
	const targetPackage = {
		name: 'fixture',
		directory: '.',
		relativePath: 'packages/web',
		isRoot: false,
		scriptsByName: {}
	}
	const entries = [
		{
			name: 'execa',
			section: 'dependencies',
			declaredVersion: '^9.6.1',
			installedVersion: '9.6.1',
			majorVersion: '9.8.0',
			latestVersion: '10.0.1'
		},
		{
			name: 'typescript',
			section: 'devDependencies',
			declaredVersion: '^6.0.3',
			installedVersion: '6.0.3',
			majorVersion: '6.4.2',
			latestVersion: '7.0.2'
		}
	]

	const screen = buildDependencyScreen(entries, targetPackage, 0, new Map(), '').join('\n')
	const plainScreen = screen.replace(/\u001B\[[0-?]*[ -\/]*[@-~]/g, '')

	assert.match(plainScreen, /"dependencies": \{/)
	assert.match(plainScreen, /filter: \(type to filter…\)/)
	assert.match(plainScreen, /execa:\s+"\^9\.6\.1"\s+9\.6\.1\s+9\.8\.0\s+10\.0\.1/)
	assert.match(plainScreen, /declared\s+installed\s+major\s+latest/)
	assert.match(plainScreen, /^\[ abt ∆ dependencies \]  packages\/web\/package\.json/m)
	assert.doesNotMatch(plainScreen, /i\/m\/l/)
	assert.match(plainScreen, /\},\n "devDependencies": \{/)
	assert.doesNotMatch(plainScreen, /\n  \{\n/)

	const stagedScreen = buildDependencyScreen(
		entries,
		targetPackage,
		0,
		new Map([
			[
				0,
				{
					entryIndex: 0,
					name: 'execa',
					from: '^9.6.1',
					to: '10.0.1',
					kind: 'latest'
				}
			]
		]),
		''
	)
		.join('\n')
		.replace(/\u001B\[[0-?]*[ -\/]*[@-~]/g, '')

	assert.match(stagedScreen, /execa:\s+"10\.0\.1" ←\s+9\.6\.1\s+9\.8\.0\s+10\.0\.1/)
	assert.match(stagedScreen, /1 staged/)
})

test('renders staged dependency changes on a separate review screen', () => {
	const review = buildReviewScreen(
		new Map([
			[0, { entryIndex: 0, name: '@types/node', from: '26.1.2', to: '26.0.1', kind: 'installed' }],
			[1, { entryIndex: 1, name: 'typescript', from: '7.0.2', to: '6.4.2', kind: 'major' }]
		])
	)
		.join('\n')
		.replace(/\u001B\[[0-?]*[ -\/]*[@-~]/g, '')

	assert.match(review, /Review 2 changes/)
	assert.match(review, /@types\/node\s+26\.1\.2\s+→\s+26\.0\.1/)
	assert.match(review, /typescript\s+7\.0\.2\s+→\s+6\.4\.2/)
	assert.match(review, /enter apply · esc go back/)
})

test('moves across all four version columns even when their values repeat', () => {
	const entry = {
		name: '@types/node',
		section: 'devDependencies',
		declaredVersion: '26.1.2',
		installedVersion: '26.0.1',
		majorVersion: '26.1.2',
		latestVersion: '26.1.2'
	}

	assert.deepEqual(
		listVersionTrackChoices(entry),
		[
			{ kind: 'declared', version: '26.1.2' },
			{ kind: 'installed', version: '26.0.1' },
			{ kind: 'major', version: '26.1.2' },
			{ kind: 'latest', version: '26.1.2' }
		]
	)
	assert.equal(moveVersionColumn(entry, 'declared', 1), 'installed')
	assert.equal(moveVersionColumn(entry, 'installed', 1), 'major')
	assert.equal(moveVersionColumn(entry, 'major', 1), 'latest')
	assert.equal(moveVersionColumn(entry, 'latest', -1), 'major')
})

test('resolves explicit non-interactive dependency lanes without guessing', () => {
	const entries = [
		{
			name: 'typescript',
			section: 'devDependencies',
			declaredVersion: '^6.0.0',
			installedVersion: '6.0.3',
			majorVersion: '6.4.2',
			latestVersion: '7.0.2'
		}
	]
	assert.deepEqual(resolveDependencyUpdates(entries, ['typescript=major']), [
		{
			name: 'typescript',
			section: 'devDependencies',
			from: '^6.0.0',
			to: '6.4.2',
			lane: 'major'
		}
	])
	assert.throws(() => resolveDependencyUpdates(entries, ['typescript=next']), /Expected PACKAGE=installed\|major\|latest/)
	assert.throws(() => resolveDependencyUpdates(entries, ['missing=latest']), /no dependency named/)
})

test('keeps every dependency interface line inside a constrained terminal', () => {
	configureTheme({
		interactive: true,
		color: true,
		unicode: false,
		json: false,
		quiet: false,
		verbose: false,
		debug: false,
		columns: 12,
		rows: 8,
		ci: false
	})
	const target = {
		name: 'fixture',
		directory: '.',
		relativePath: 'packages/a-very-long-name',
		isRoot: false,
		scriptsByName: {}
	}
	const entries = [
		{
			name: '@scope/a-very-long-dependency',
			section: 'dependencies',
			declaredVersion: '^123.456.789',
			installedVersion: '123.456.789',
			majorVersion: '123.999.999',
			latestVersion: '999.999.999'
		}
	]
	const ansi = /\u001B\[[0-?]*[ -/]*[@-~]/g
	const lines = buildDependencyScreen(entries, target, 0, new Map(), '')
	assert.ok(lines.every(line => line.replace(ansi, '').length <= 12))
	assert.match(lines.join('\n'), /declared/)

	configureTheme({
		interactive: false,
		color: false,
		unicode: true,
		json: false,
		quiet: false,
		verbose: false,
		debug: false,
		columns: 80,
		rows: 24,
		ci: false
	})
})

test('updates only the selected dependency string and preserves formatting', () => {
	const packageDirectory = makeTemporaryDirectory()
	const packageJson = [
		'{',
		'\t"name": "fixture",',
		'\t"files": ["bin"],',
		'\t"dependencies": {',
		'\t\t"@scope/tool": "^1.2.3",',
		'\t\t"other": "~4.0.0"',
		'\t},',
		'\t"private": true',
		'}',
		''
	].join('\r\n')
	fs.writeFileSync(path.join(packageDirectory, 'package.json'), packageJson)

	updateDependencyVersion(packageDirectory, 'dependencies', '@scope/tool', '^1.2.3', '1.2.3')

	const updated = fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf-8')
	assert.equal(updated, packageJson.replace('"@scope/tool": "^1.2.3"', '"@scope/tool": "1.2.3"'))
})

test('updates a dependency in a minified manifest', () => {
	const packageDirectory = makeTemporaryDirectory()
	const packageJson = '{"name":"fixture","dependencies":{"one":"^1.0.0"},"nested":{"one":"untouched"}}'
	fs.writeFileSync(path.join(packageDirectory, 'package.json'), packageJson)

	updateDependencyVersion(packageDirectory, 'dependencies', 'one', '^1.0.0', '2.0.0')

	assert.equal(
		fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf-8'),
		'{"name":"fixture","dependencies":{"one":"2.0.0"},"nested":{"one":"untouched"}}'
	)
})

test('refuses to overwrite a dependency that changed after inspection', () => {
	const packageDirectory = makeTemporaryDirectory()
	fs.writeFileSync(path.join(packageDirectory, 'package.json'), '{"dependencies":{"one":"^2.0.0"}}')

	assert.throws(
		() => updateDependencyVersion(packageDirectory, 'dependencies', 'one', '^1.0.0', '1.0.0'),
		/changed on disk/
	)
})

test('applies several staged dependency changes in one manifest write', () => {
	const packageDirectory = makeTemporaryDirectory()
	fs.writeFileSync(
		path.join(packageDirectory, 'package.json'),
		'{"dependencies":{"one":"^1.0.0"},"devDependencies":{"two":"^2.0.0"}}'
	)

	updateDependencyVersions(packageDirectory, [
		{ section: 'dependencies', packageName: 'one', currentVersion: '^1.0.0', nextVersion: '1.4.0' },
		{ section: 'devDependencies', packageName: 'two', currentVersion: '^2.0.0', nextVersion: '3.0.0' }
	])

	assert.equal(
		fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf-8'),
		'{"dependencies":{"one":"1.4.0"},"devDependencies":{"two":"3.0.0"}}'
	)
})

test('loads latest and installed-major versions from a registry endpoint', async () => {
	const http = await import('node:http')
	const server = http.createServer((_request, response) => {
		response.setHeader('content-type', 'application/json')
		response.end(
			JSON.stringify({
				'dist-tags': { latest: '2.0.0' },
				versions: { '1.0.0': {}, '1.8.7': {}, '1.9.0-beta.1': {}, '2.0.0': {} }
			})
		)
	})

	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
	const address = server.address()
	assert.notEqual(address, null)
	assert.equal(typeof address, 'object')

	try {
		const entries = await loadLatestVersions(
			[{ name: '@scope/tool', section: 'dependencies', declaredVersion: '^2.0.0', installedVersion: '1.0.0' }],
			`http://127.0.0.1:${address.port}`
		)
		assert.equal(entries[0].majorVersion, '1.8.7')
		assert.equal(entries[0].latestVersion, '2.0.0')
	} finally {
		server.close()
	}
})
