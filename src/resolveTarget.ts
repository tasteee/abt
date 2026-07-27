import { findClosestName } from './findClosestName.js'
import { buildShortName, stripScope } from './packageNames.js'
import type { ContextT, TargetPackageT } from './types.js'

const buildPackageAliases = (targetPackage: TargetPackageT): string[] => {
	const rootAliases = targetPackage.isRoot ? ['root', '.'] : []
	return [targetPackage.name, stripScope(targetPackage.name), targetPackage.relativePath, ...rootAliases]
}

export const findPackageByName = (context: ContextT, typedName: string): TargetPackageT | undefined => {
	const normalizedTyped = typedName.toLowerCase()

	return context.workspace.packages.find(candidatePackage => {
		const aliases = buildPackageAliases(candidatePackage)

		return aliases.some(alias => {
			return alias.toLowerCase() === normalizedTyped
		})
	})
}

export const listPackageDisplayNames = (context: ContextT): string[] => {
	return context.workspace.packages.map(buildShortName)
}

export type ResolutionT =
	| { kind: 'run'; targetPackage: TargetPackageT; scriptName: string }
	| { kind: 'open'; targetPackage: TargetPackageT }
	| { kind: 'unknownScript'; targetPackage: TargetPackageT; typedName: string; suggestion?: string }
	| { kind: 'unknownPackage'; typedName: string; suggestion?: string }

const checkHasScript = (targetPackage: TargetPackageT, scriptName: string): boolean => {
	return Object.prototype.hasOwnProperty.call(targetPackage.scriptsByName, scriptName)
}

const buildUnknownScript = (targetPackage: TargetPackageT, typedName: string): ResolutionT => {
	const scriptNames = Object.keys(targetPackage.scriptsByName)
	const suggestion = findClosestName(typedName, scriptNames)
	return { kind: 'unknownScript', targetPackage, typedName, suggestion }
}

const buildUnknownPackage = (context: ContextT, typedName: string): ResolutionT => {
	const suggestion = findClosestName(typedName, listPackageDisplayNames(context))
	return { kind: 'unknownPackage', typedName, suggestion }
}

// `abt build` — a script in the package you are standing in,
// falling back to a package of that name.
const resolveSingleArgument = (context: ContextT, typedName: string): ResolutionT => {
	const isScriptHere = checkHasScript(context.currentPackage, typedName)
	if (isScriptHere) return { kind: 'run', targetPackage: context.currentPackage, scriptName: typedName }

	const matchedPackage = findPackageByName(context, typedName)
	if (matchedPackage !== undefined) return { kind: 'open', targetPackage: matchedPackage }

	return buildUnknownScript(context.currentPackage, typedName)
}

// `abt web build` — an explicit package and an explicit script.
const resolvePairedArguments = (context: ContextT, packageName: string, scriptName: string): ResolutionT => {
	const matchedPackage = findPackageByName(context, packageName)
	const hasNoPackage = matchedPackage === undefined
	if (hasNoPackage) return buildUnknownPackage(context, packageName)

	const isScriptThere = checkHasScript(matchedPackage, scriptName)
	if (isScriptThere) return { kind: 'run', targetPackage: matchedPackage, scriptName }

	return buildUnknownScript(matchedPackage, scriptName)
}

export const resolveTarget = (context: ContextT, positionals: string[]): ResolutionT | undefined => {
	const hasNoPositionals = positionals.length === 0
	if (hasNoPositionals) return undefined

	const isSingleArgument = positionals.length === 1
	if (isSingleArgument) return resolveSingleArgument(context, positionals[0])

	return resolvePairedArguments(context, positionals[0], positionals[1])
}
