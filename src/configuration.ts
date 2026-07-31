import fs from 'node:fs'
import path from 'node:path'
import { CliError } from './errors.js'
import type { PackageJsonT } from './readPackage.js'
import type { ScriptsByNameT } from './types.js'

const CONFIG_FILENAME = 'abt.json'
const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.next',
	'.turbo',
	'.yarn',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'out',
	'target'
])

const configurationError = (source: string, message: string): CliError => {
	return new CliError({
		message: `${source}: ${message}`,
		category: 'usage',
		code: 'ABT_CONFIG_INVALID',
		exitCode: 2,
		recovery: 'Use an object shaped like { "scripts": { "script-name": "Description" } }.'
	})
}

const findConfigurationFiles = (packageDirectory: string): string[] => {
	const found: string[] = []
	const visit = (directory: string, isPackageRoot: boolean): void => {
		let entries: fs.Dirent[]
		try {
			entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
		} catch {
			return
		}

		if (!isPackageRoot && entries.some(entry => entry.isFile() && entry.name === 'package.json')) return
		for (const entry of entries) {
			if (entry.isFile() && entry.name.toLowerCase() === CONFIG_FILENAME) found.push(path.join(directory, entry.name))
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue
			visit(path.join(directory, entry.name), false)
		}
	}

	visit(packageDirectory, true)
	return found
}

const readDescriptionMap = (configuration: unknown, source: string): Record<string, string> => {
	if (configuration === undefined) return {}
	if (configuration === null || typeof configuration !== 'object' || Array.isArray(configuration)) {
		throw configurationError(source, 'configuration must be an object.')
	}
	const scripts = (configuration as { scripts?: unknown }).scripts
	if (scripts === undefined) return {}
	if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
		throw configurationError(source, 'scripts must be an object.')
	}

	const descriptions: Record<string, string> = {}
	for (const [scriptName, description] of Object.entries(scripts)) {
		if (typeof description !== 'string' || description.trim().length === 0) {
			throw configurationError(source, `scripts.${scriptName} must be a non-empty string.`)
		}
		descriptions[scriptName] = description.trim()
	}
	return descriptions
}

const readFileConfiguration = (configurationPath: string, packageDirectory: string): Record<string, string> => {
	const displayPath = path.relative(packageDirectory, configurationPath).split(path.sep).join('/') || CONFIG_FILENAME
	try {
		const contents = fs.readFileSync(configurationPath, 'utf8')
		return readDescriptionMap(JSON.parse(contents) as unknown, displayPath)
	} catch (error) {
		if (error instanceof CliError) throw error
		throw configurationError(displayPath, 'file is not valid JSON.')
	}
}

export const loadScriptDescriptions = (
	packageDirectory: string,
	packageJson: PackageJsonT,
	scriptsByName: ScriptsByNameT
): Record<string, string> => {
	const configurationFiles = findConfigurationFiles(packageDirectory)
	if (configurationFiles.length > 1) {
		const paths = configurationFiles.map(file => path.relative(packageDirectory, file).split(path.sep).join('/'))
		throw new CliError({
			message: `multiple abt.json files apply to ${packageDirectory}: ${paths.join(', ')}.`,
			category: 'usage',
			code: 'ABT_CONFIG_AMBIGUOUS',
			exitCode: 2,
			recovery: 'Keep one abt.json within each package boundary.'
		})
	}

	const packageDescriptions = readDescriptionMap(packageJson.abt, 'package.json#abt')
	const fileDescriptions =
		configurationFiles[0] === undefined ? {} : readFileConfiguration(configurationFiles[0], packageDirectory)
	const merged = { ...packageDescriptions, ...fileDescriptions }
	return Object.fromEntries(Object.entries(merged).filter(([scriptName]) => scriptsByName[scriptName] !== undefined))
}
