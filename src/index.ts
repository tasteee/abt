#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildContext } from './buildContext.js'
import { detectEnvironment } from './environment.js'
import { CliError, usageError } from './errors.js'
import { parseArguments } from './parseArguments.js'
import { listScripts, printError, printHelp } from './printers.js'
import { resolveTarget } from './resolveTarget.js'
import { runInteractiveFlow, runPackageScriptFlow } from './flow.js'
import { describeRunCommand, runScript } from './runScript.js'
import { configureTheme, dim } from './theme.js'
import { runDependencyCommand } from './dependencyCommand.js'
import { configureOutput, writeJsonError } from './output.js'
import { createRenderer } from './renderer.js'
import type { CliRendererT } from './renderer.js'
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

const describeSuggestion = (suggestion: string | undefined): string => {
	const hasNoSuggestion = suggestion === undefined
	if (hasNoSuggestion) return ''
	return ` Did you mean "${suggestion}"?`
}

const reportUnknownScript = (
	resolution: Extract<ResolutionT, { kind: 'unknownScript' }>,
	renderer: CliRendererT
): number => {
	const locationName = resolution.targetPackage.relativePath
	const isRootPackage = locationName === '.'
	const locationSuffix = isRootPackage ? '' : ` in ${locationName}`
	renderer.emit({
		type: 'notice',
		level: 'error',
		title: `abt no script named "${resolution.typedName}"${locationSuffix}.${describeSuggestion(resolution.suggestion)}`,
		body: 'Run "abt --list" to see available scripts.'
	})
	return 1
}

const reportUnknownPackage = (
	resolution: Extract<ResolutionT, { kind: 'unknownPackage' }>,
	renderer: CliRendererT
): number => {
	renderer.emit({
		type: 'notice',
		level: 'error',
		title: `abt no workspace package named "${resolution.typedName}".${describeSuggestion(resolution.suggestion)}`,
		body: 'Run "abt --list" to see scripts and their package paths.'
	})
	return 1
}

const runResolvedScript = async (
	context: ContextT,
	resolution: Extract<ResolutionT, { kind: 'run' }>,
	forwardedArguments: string[],
	renderer: CliRendererT
): Promise<number> => {
	const commandDescription = describeRunCommand(
		resolution.targetPackage,
		resolution.scriptName,
		context.workspace.rootDirectory
	)

	renderer.emit({ type: 'command:run', description: commandDescription })

	const outcome = await runScript(
		resolution.targetPackage,
		resolution.scriptName,
		context.workspace.rootDirectory,
		forwardedArguments
	)
	if (outcome.error !== undefined) renderer.emit({ type: 'notice', level: 'error', title: outcome.error })

	return outcome.exitCode
}

const handleResolution = async (
	context: ContextT,
	resolution: ResolutionT,
	forwardedArguments: string[],
	canPrompt: boolean,
	renderer: CliRendererT
): Promise<number> => {
	const isRun = resolution.kind === 'run'
	if (isRun) return await runResolvedScript(context, resolution, forwardedArguments, renderer)

	const isUnknownScript = resolution.kind === 'unknownScript'
	if (isUnknownScript) return reportUnknownScript(resolution, renderer)

	const isUnknownPackage = resolution.kind === 'unknownPackage'
	if (isUnknownPackage) return reportUnknownPackage(resolution, renderer)

	if (!canPrompt) {
		renderer.emit({
			type: 'notice',
			level: 'error',
			title: `abt "${resolution.targetPackage.relativePath}" is a package, not a script.`,
			body: 'Name a script to run, or run "abt --list" to see available scripts.'
		})
		return 1
	}

	const outcome = await runPackageScriptFlow(context, resolution.targetPackage, forwardedArguments, renderer)
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
	const environment = detectEnvironment(split.parsed)
	configureTheme(environment)
	configureOutput(environment)
	const renderer = createRenderer(environment)
	try {

	if (split.parsed.wantsVersion) {
		renderer.emit({ type: 'version', version: readSelfVersion() })
		return 0
	}

	if (split.parsed.wantsHelp) {
		printHelp(readSelfVersion())
		return 0
	}
	const wantsDependencies = split.parsed.positionals[0] === 'deps'
	if (split.parsed.wantsList && split.parsed.positionals.length > 0) {
		throw usageError('--list cannot be combined with a command or script name.')
	}
	if ((split.parsed.updates.length > 0 || split.parsed.dryRun) && !wantsDependencies) {
		throw usageError('--update and --dry-run can only be used with abt deps.')
	}
	if (environment.json && !split.parsed.wantsList && !wantsDependencies) {
		throw usageError('--json requires --list or the deps command.')
	}

	const context = buildContext(process.cwd())
	if (environment.verbose) {
		renderer.emit({ type: 'notice', level: 'info', title: `abt workspace ${context.workspace.rootDirectory}`, verboseOnly: true })
		renderer.emit({ type: 'notice', level: 'info', title: `abt package ${context.currentPackage.relativePath}`, verboseOnly: true })
	}

	if (split.parsed.wantsList) {
		renderer.emit({ type: 'script:list', scripts: listScripts(context) })
		return 0
	}

	if (wantsDependencies) {
		return await runDependencyCommand(context, split.parsed.positionals.slice(1), {
			interactive: environment.interactive,
			dryRun: split.parsed.dryRun,
			updates: split.parsed.updates,
			renderer
		})
	}

	const resolution = resolveTarget(context, split.parsed.positionals)
	const wasTargetNamed = resolution !== undefined
	if (wasTargetNamed) {
		return await handleResolution(context, resolution, split.forwardedArguments, environment.interactive, renderer)
	}

	const totalScriptCount = countScriptsInWorkspace(context)
	const hasNoScripts = totalScriptCount === 0

	if (hasNoScripts) {
		renderer.emit({ type: 'script:list', scripts: [] })
		return 0
	}

	// Nobody can answer a prompt in a pipe or in CI, so print the
	// list instead of blocking on a menu that will never resolve.
	if (!environment.interactive) {
		renderer.emit({ type: 'script:list', scripts: listScripts(context) })
		return 0
	}

	const outcome = await runInteractiveFlow(context, split.forwardedArguments, renderer)
	return outcome.exitCode
	} finally {
		await renderer.flush()
		await renderer.dispose()
	}
}

const handleError = (error: unknown): number => {
	const cliError =
		error instanceof CliError
			? error
			: new CliError({
					message: error instanceof Error ? error.message : String(error),
					code: 'ABT_RUNTIME',
					recovery: 'Run again with --debug for diagnostic details.'
				})
	const wantsJson = process.argv.slice(2).includes('--json')
	if (wantsJson) writeJsonError(cliError)
	else {
		printError(cliError.message)
		if (cliError.recovery !== undefined) process.stderr.write(`    ${dim(cliError.recovery)}\n`)
		if (process.argv.slice(2).includes('--debug') && error instanceof Error && error.stack !== undefined) {
			process.stderr.write(`${error.stack}\n`)
		}
	}
	return cliError.exitCode
}

const start = async (): Promise<void> => {
	try {
		const exitCode = await main()
		process.exitCode = exitCode
	} catch (error) {
		const exitCode = handleError(error)
		process.exitCode = exitCode
	}
}

await start()
