import { buildDependencyEntries, isRegistryDependency, loadLatestVersions } from './dependencies.js'
import { runDependencyFlow } from './dependencyFlow.js'
import { usageError } from './errors.js'
import { findClosestName } from './findClosestName.js'
import { listPackageDisplayNames, findPackageByName } from './resolveTarget.js'
import { readPackageJsonInDirectory } from './readPackage.js'
import { updateDependencyVersions } from './updateDependency.js'
import type { CliRendererT } from './renderer.js'
import type { ContextT, DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js'

const resolveTargetPackage = (context: ContextT, packageArguments: string[]): TargetPackageT => {
	if (packageArguments.length === 0) return context.currentPackage
	if (packageArguments.length > 1) throw usageError('usage: abt deps [package]')

	const typedName = packageArguments[0]
	const targetPackage = findPackageByName(context, typedName)
	if (targetPackage !== undefined) return targetPackage

	const suggestion = findClosestName(typedName, listPackageDisplayNames(context))
	const suggestionSuffix = suggestion === undefined ? '' : ` Did you mean "${suggestion}"?`
	throw usageError(`no workspace package named "${typedName}".${suggestionSuffix}`)
}

type UpdateLaneT = 'installed' | 'major' | 'latest'

export type DependencyCommandOptionsT = {
	interactive: boolean
	dryRun: boolean
	updates: string[]
	renderer: CliRendererT
}

type DependencyChangeT = {
	name: string
	section: DependencySectionT
	from: string
	to: string
	lane: UpdateLaneT
}

const parseUpdate = (value: string): { name: string; lane: UpdateLaneT } => {
	const separator = value.lastIndexOf('=')
	const name = value.slice(0, separator)
	const lane = value.slice(separator + 1)
	if (separator <= 0 || !['installed', 'major', 'latest'].includes(lane)) {
		throw usageError(`invalid update "${value}". Expected PACKAGE=installed|major|latest.`)
	}
	return { name, lane: lane as UpdateLaneT }
}

const readLaneVersion = (entry: DependencyEntryT, lane: UpdateLaneT): string | undefined => {
	if (lane === 'installed') return entry.installedVersion
	if (lane === 'major') return entry.majorVersion
	return entry.latestVersion
}

export const resolveDependencyUpdates = (entries: DependencyEntryT[], requested: string[]): DependencyChangeT[] => {
	const seen = new Set<string>()
	return requested.map(value => {
		const { name, lane } = parseUpdate(value)
		if (seen.has(name)) throw usageError(`dependency "${name}" was specified more than once.`)
		seen.add(name)
		const matching = entries.filter(entry => entry.name === name)
		if (matching.length === 0) throw usageError(`no dependency named "${name}".`)
		if (matching.length > 1) throw usageError(`dependency "${name}" appears in more than one section and is ambiguous.`)
		const entry = matching[0]
		if (!isRegistryDependency(entry.declaredVersion)) {
			throw usageError(`dependency "${name}" uses a local or aliased spec and cannot be changed safely.`)
		}
		const to = readLaneVersion(entry, lane)
		if (to === undefined) throw usageError(`no ${lane} version is available for "${name}".`)
		return { name, section: entry.section, from: entry.declaredVersion, to, lane }
	})
}

export const runDependencyCommand = async (
	context: ContextT,
	packageArguments: string[],
	options: DependencyCommandOptionsT
): Promise<number> => {
	const targetPackage = resolveTargetPackage(context, packageArguments)
	const packageJson = readPackageJsonInDirectory(targetPackage.directory)
	if (packageJson === undefined) throw new Error(`no package.json found in ${targetPackage.relativePath}.`)
	if (options.dryRun && options.updates.length === 0) throw usageError('--dry-run requires at least one --update.')
	for (const value of options.updates) parseUpdate(value)

	const localEntries = buildDependencyEntries(targetPackage, context.workspace.rootDirectory, packageJson)
	if (localEntries.length === 0) {
		options.renderer.emit({
			type: 'dependency:empty',
			package: targetPackage.relativePath,
			packageName: targetPackage.name
		})
		return 0
	}
	options.renderer.emit({
		type: 'operation:start',
		id: 'dependency-versions',
		title: `abt checking ${localEntries.length} dependencies in ${targetPackage.relativePath}/package.json`
	})
	const entries = await loadLatestVersions(localEntries)
	options.renderer.emit({ type: 'operation:complete', id: 'dependency-versions' })

	if (options.updates.length > 0) {
		const changes = resolveDependencyUpdates(entries, options.updates)
		const actualChanges = changes.filter(change => change.from !== change.to)
		if (!options.dryRun && actualChanges.length > 0) {
			updateDependencyVersions(
				targetPackage.directory,
				actualChanges.map(change => ({
					section: change.section,
					packageName: change.name,
					currentVersion: change.from,
					nextVersion: change.to
				}))
			)
		}
		options.renderer.emit({
			type: 'dependency:changed',
			package: targetPackage.relativePath,
			dryRun: options.dryRun,
			changes: actualChanges
		})
		return 0
	}

	if (!options.interactive) {
		options.renderer.emit({ type: 'dependency:report', package: targetPackage.relativePath, dependencies: entries })
		return 0
	}

	const changes = await runDependencyFlow(entries, targetPackage)
	if (changes.length === 0) return 0

	options.renderer.emit({
		type: 'dependency:changed',
		package: targetPackage.relativePath,
		dryRun: false,
		changes: changes.map(change => {
			const entry = entries.find(candidate => candidate.name === change.name && candidate.declaredVersion === change.from)
			return { ...change, section: entry?.section ?? 'dependencies' }
		})
	})
	return 0
}
