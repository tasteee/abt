import { buildDependencyEntries, listDependencySections, loadLatestVersions } from './dependencies.js'
import { runDependencyFlow } from './dependencyFlow.js'
import { findClosestName } from './findClosestName.js'
import { listPackageDisplayNames, findPackageByName } from './resolveTarget.js'
import { readPackageJsonInDirectory } from './readPackage.js'
import { accent, bold, dim } from './theme.js'
import type { ContextT, DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js'

const FRIENDLY_SECTION_NAME: Record<DependencySectionT, string> = {
	dependencies: 'dependencies',
	peerDependencies: 'peer dependencies',
	devDependencies: 'dev dependencies'
}

const resolveTargetPackage = (context: ContextT, packageArguments: string[]): TargetPackageT => {
	if (packageArguments.length === 0) return context.currentPackage
	if (packageArguments.length > 1) throw new Error('usage: abt deps [package]')

	const typedName = packageArguments[0]
	const targetPackage = findPackageByName(context, typedName)
	if (targetPackage !== undefined) return targetPackage

	const suggestion = findClosestName(typedName, listPackageDisplayNames(context))
	const suggestionSuffix = suggestion === undefined ? '' : ` ${dim(`did you mean "${suggestion}"?`)}`
	throw new Error(`no workspace package named "${typedName}".${suggestionSuffix}`)
}

const printableVersion = (version: string | undefined, fallback: string): string => version ?? fallback

export const printDependencyReport = (entries: DependencyEntryT[]): void => {
	for (const section of listDependencySections()) {
		const sectionEntries = entries.filter(entry => entry.section === section)
		if (sectionEntries.length === 0) continue

		process.stdout.write(`${FRIENDLY_SECTION_NAME[section]}\n`)
		process.stdout.write('package\tdeclared\tinstalled\tlatest\n')

		for (const entry of sectionEntries) {
			const installed = printableVersion(entry.installedVersion, 'not installed')
			const latest = printableVersion(entry.latestVersion, 'unavailable')
			process.stdout.write(`${entry.name}\t${entry.declaredVersion}\t${installed}\t${latest}\n`)
		}
	}
}

const clearCheckingMessage = (): void => {
	process.stderr.write('\r\u001B[2K')
}

export const runDependencyCommand = async (
	context: ContextT,
	packageArguments: string[],
	canPrompt: boolean
): Promise<number> => {
	const targetPackage = resolveTargetPackage(context, packageArguments)
	const packageJson = readPackageJsonInDirectory(targetPackage.directory)
	if (packageJson === undefined) throw new Error(`no package.json found in ${targetPackage.relativePath}.`)

	const localEntries = buildDependencyEntries(targetPackage, context.workspace.rootDirectory, packageJson)
	if (localEntries.length === 0) {
		process.stdout.write(`${accent('abt')} ${targetPackage.relativePath} has no dependencies.\n`)
		return 0
	}

	if (canPrompt) process.stderr.write(`${accent('abt')} ${dim('checking dependency versions…')}`)
	const entries = await loadLatestVersions(localEntries)
	if (canPrompt) clearCheckingMessage()

	if (!canPrompt) {
		printDependencyReport(entries)
		return 0
	}

	const changes = await runDependencyFlow(entries, targetPackage)
	if (changes.length === 0) return 0

	process.stderr.write(`${accent('abt')} ${bold('updated package.json')} ${dim(`(${changes.length} change${changes.length === 1 ? '' : 's'})`)}\n`)
	for (const change of changes) {
		process.stderr.write(`  ${change.name} ${dim(`${change.from} → ${change.to}`)}\n`)
	}
	process.stderr.write(`${dim('Run your package manager install command to update the lockfile and installed packages.')}\n`)
	return 0
}
