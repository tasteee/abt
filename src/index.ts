#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildContext } from './buildContext.js'
import { parseArguments } from './parseArguments.js'
import { printError, printHelp, printScriptList, printVersion } from './printers.js'
import { resolveTarget } from './resolveTarget.js'
import { runInteractiveFlow, runPackageScriptFlow } from './flow.js'
import { describeRunCommand, runScript } from './runScript.js'
import { dim } from './theme.js'
import type { ResolutionT } from './resolveTarget.js'
import type { ContextT } from './types.js'

// abt's own version, resolved against this file rather than the
// package.json abt happens to be running inside.
const readSelfVersion = (): string => {
	const selfDirectory = path.dirname(fileURLToPath(import.meta.url))
	const selfPackagePath = path.join(selfDirectory, '..', 'package.json')
	const selfPackage = JSON.parse(fs.readFileSync(selfPackagePath, 'utf-8'))
	return selfPackage.version
}

const checkIsInteractiveTerminal = (): boolean => {
	return process.stdin.isTTY === true && process.stderr.isTTY === true
}

const describeSuggestion = (suggestion: string | undefined): string => {
	const hasNoSuggestion = suggestion === undefined
	if (hasNoSuggestion) return ''
	return ` ${dim(`did you mean "${suggestion}"?`)}`
}

const reportUnknownScript = (resolution: Extract<ResolutionT, { kind: 'unknownScript' }>): number => {
	const locationName = resolution.targetPackage.relativePath
	const isRootPackage = locationName === '.'
	const locationSuffix = isRootPackage ? '' : ` in ${locationName}`
	printError(`no script named "${resolution.typedName}"${locationSuffix}.${describeSuggestion(resolution.suggestion)}`)
	return 1
}

const reportUnknownPackage = (resolution: Extract<ResolutionT, { kind: 'unknownPackage' }>): number => {
	printError(`no workspace package named "${resolution.typedName}".${describeSuggestion(resolution.suggestion)}`)
	return 1
}

const runResolvedScript = async (
	context: ContextT,
	resolution: Extract<ResolutionT, { kind: 'run' }>,
	forwardedArguments: string[]
): Promise<number> => {
	const commandDescription = describeRunCommand(
		resolution.targetPackage,
		resolution.scriptName,
		context.workspace.rootDirectory
	)

	process.stderr.write(`${dim(`› ${commandDescription}`)}\n\n`)

	const outcome = await runScript(
		resolution.targetPackage,
		resolution.scriptName,
		context.workspace.rootDirectory,
		forwardedArguments
	)

	return outcome.exitCode
}

const handleResolution = async (
	context: ContextT,
	resolution: ResolutionT,
	forwardedArguments: string[]
): Promise<number> => {
	const isRun = resolution.kind === 'run'
	if (isRun) return await runResolvedScript(context, resolution, forwardedArguments)

	const isUnknownScript = resolution.kind === 'unknownScript'
	if (isUnknownScript) return reportUnknownScript(resolution)

	const isUnknownPackage = resolution.kind === 'unknownPackage'
	if (isUnknownPackage) return reportUnknownPackage(resolution)

	const canPrompt = checkIsInteractiveTerminal()

	if (!canPrompt) {
		printError(`"${resolution.targetPackage.relativePath}" is a package, not a script. Name a script to run.`)
		return 1
	}

	const outcome = await runPackageScriptFlow(context, resolution.targetPackage, forwardedArguments)
	return outcome.exitCode
}

const countScriptsInWorkspace = (context: ContextT): number => {
	const perPackageCounts = context.workspace.packages.map(candidatePackage => {
		return Object.keys(candidatePackage.scriptsByName).length
	})

	return perPackageCounts.reduce((total, count) => total + count, 0)
}

const main = async (): Promise<number> => {
	const split = parseArguments(process.argv.slice(2))

	if (split.parsed.wantsVersion) {
		printVersion(readSelfVersion())
		return 0
	}

	if (split.parsed.wantsHelp) {
		printHelp(readSelfVersion())
		return 0
	}

	const context = buildContext(process.cwd())

	if (split.parsed.wantsList) {
		printScriptList(context)
		return 0
	}

	const resolution = resolveTarget(context, split.parsed.positionals)
	const wasTargetNamed = resolution !== undefined
	if (wasTargetNamed) return await handleResolution(context, resolution, split.forwardedArguments)

	const totalScriptCount = countScriptsInWorkspace(context)
	const hasNoScripts = totalScriptCount === 0

	if (hasNoScripts) {
		printError('no scripts found in package.json.')
		return 0
	}

	// Nobody can answer a prompt in a pipe or in CI, so print the
	// list instead of blocking on a menu that will never resolve.
	const canPrompt = checkIsInteractiveTerminal()

	if (!canPrompt) {
		printScriptList(context)
		return 0
	}

	const outcome = await runInteractiveFlow(context, split.forwardedArguments)
	return outcome.exitCode
}

// Ctrl+C is an ordinary way to leave a menu, not a crash, and a
// user error never deserves a stack trace.
const handleError = (error: unknown): number => {
	const wasCancelled = error instanceof Error && error.name === 'ExitPromptError'
	if (wasCancelled) return 0

	const message = error instanceof Error ? error.message : String(error)
	printError(message)
	return 1
}

const start = async (): Promise<void> => {
	try {
		const exitCode = await main()
		process.exit(exitCode)
	} catch (error) {
		const exitCode = handleError(error)
		process.exit(exitCode)
	}
}

await start()
