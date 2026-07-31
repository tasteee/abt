import {
	buildPackageMenuRows,
	buildScriptMenuRows,
	listBrowsablePackages,
	readOpenValue,
	readRunValue
} from './buildMenuRows.js'
import { runFuzzySelect } from './fuzzySelect.js'
import type { FuzzySelectOutcomeT } from './fuzzySelect.js'
import { describeRunCommand, runScript } from './runScript.js'
import { listRecentScripts, recordScriptChoice } from './history.js'
import { loadScriptDescriptions } from './configuration.js'
import { readPackageJsonInDirectory } from './readPackage.js'
import { dim, symbols } from './theme.js'
import type { CliRendererT } from './renderer.js'
import type { ContextT, MenuRowT, TargetPackageT } from './types.js'

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g

const buildItems = (rows: MenuRowT[]) => {
	return rows.map(row => ({
		label: row.label,
		...(row.alternateLabel === undefined ? {} : { alternateLabel: row.alternateLabel }),
		searchText:
			row.searchText ?? `${row.label} ${row.alternateLabel ?? ''}`.replace(ANSI_PATTERN, ''),
		value: row.value
	}))
}

const chooseScriptHeader = (): string => `[ abt ${symbols().delta} choose a script ]`
const choosePackageHeader = (): string => `[ abt ${symbols().delta} choose a package ]`

export const buildScriptHeader = (targetPackage: TargetPackageT): string => {
	return `${chooseScriptHeader()}  ${dim(targetPackage.name)}`
}

export const buildPackageHeader = (targetPackage: TargetPackageT): string => {
	return `${choosePackageHeader()}  ${dim(targetPackage.name)}`
}

export type FlowOutcomeT = {
	exitCode: number
	wasCancelled: boolean
}

export const shouldReturnFromPackagePicker = (outcomeKind: FuzzySelectOutcomeT['kind']): boolean => {
	return outcomeKind === 'back' || outcomeKind === 'tab'
}

export const runInteractiveFlow = async (
	context: ContextT,
	forwardedArguments: string[],
	renderer: CliRendererT,
	header?: string
): Promise<FlowOutcomeT> => {
	const hasOtherPackages = context.isWorkspace && listBrowsablePackages(context).length > 1
	let targetPackage = context.currentPackage
	let screen: 'scripts' | 'packages' = 'scripts'
	let scriptsCanGoBack = false
	const initialScriptHeader = header ?? buildScriptHeader(context.currentPackage)
	let scriptHeader = initialScriptHeader
	const descriptionsByDirectory = new Map<string, Record<string, string>>()
	const withDescriptions = (candidatePackage: TargetPackageT): TargetPackageT => {
		let descriptions = descriptionsByDirectory.get(candidatePackage.directory)
		if (descriptions === undefined) {
			const packageJson = readPackageJsonInDirectory(candidatePackage.directory)
			descriptions =
				packageJson === undefined
					? {}
					: loadScriptDescriptions(candidatePackage.directory, packageJson, candidatePackage.scriptsByName)
			descriptionsByDirectory.set(candidatePackage.directory, descriptions)
		}
		return { ...candidatePackage, scriptDescriptionsByName: descriptions }
	}

	for (;;) {
		if (screen === 'packages') {
			const packageOutcome = await runFuzzySelect({
				title: buildPackageHeader(context.currentPackage),
				items: buildItems(buildPackageMenuRows(context)),
				canGoBack: true,
				tabActionLabel: 'scripts'
			})

			if (packageOutcome.kind === 'cancelled') return { exitCode: 0, wasCancelled: true }
			if (shouldReturnFromPackagePicker(packageOutcome.kind)) {
				targetPackage = context.currentPackage
				scriptHeader = initialScriptHeader
				scriptsCanGoBack = false
				screen = 'scripts'
				continue
			}
			if (packageOutcome.kind !== 'selected') continue

			const selectedPath = readOpenValue(packageOutcome.value)
			const selectedPackage = context.workspace.packages.find(candidate => candidate.relativePath === selectedPath)
			if (selectedPackage === undefined) continue
			targetPackage = selectedPackage
			scriptHeader = buildScriptHeader(selectedPackage)
			scriptsCanGoBack = true
			screen = 'scripts'
			continue
		}

		const describedPackage = withDescriptions(targetPackage)
		const scriptOutcome = await runFuzzySelect({
			title: scriptHeader,
			items: buildItems(buildScriptMenuRows(describedPackage, listRecentScripts(targetPackage))),
			canGoBack: scriptsCanGoBack,
			tabActionLabel: hasOtherPackages ? 'packages' : undefined
		})

		if (scriptOutcome.kind === 'cancelled') return { exitCode: 0, wasCancelled: true }
		if (scriptOutcome.kind === 'back' || scriptOutcome.kind === 'tab') {
			screen = 'packages'
			continue
		}
		if (scriptOutcome.kind !== 'selected') continue

		const scriptName = readRunValue(scriptOutcome.value)
		if (scriptName === undefined) continue
		recordScriptChoice(targetPackage, scriptName)
		renderer.emit({
			type: 'command:run',
			description: describeRunCommand(targetPackage, scriptName, context.workspace.rootDirectory)
		})
		const outcome = await runScript(targetPackage, scriptName, context.workspace.rootDirectory, forwardedArguments)
		if (outcome.error !== undefined) renderer.emit({ type: 'notice', level: 'error', title: outcome.error })
		return { exitCode: outcome.exitCode, wasCancelled: false }
	}
}

export const runPackageScriptFlow = async (
	context: ContextT,
	targetPackage: TargetPackageT,
	forwardedArguments: string[],
	renderer: CliRendererT
): Promise<FlowOutcomeT> => {
	const scopedContext: ContextT = {
		workspace: context.workspace,
		currentPackage: targetPackage,
		isWorkspace: false
	}

	return await runInteractiveFlow(scopedContext, forwardedArguments, renderer, buildScriptHeader(targetPackage))
}
