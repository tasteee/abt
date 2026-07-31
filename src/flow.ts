import {
	buildPackageMenuRows,
	buildScriptMenuRows,
	listBrowsablePackages,
	readOpenValue,
	readRunValue
} from './buildMenuRows.js'
import { runFuzzySelect } from './fuzzySelect.js'
import { describeRunCommand, runScript } from './runScript.js'
import { accent, dim } from './theme.js'
import type { ContextT, MenuRowT, TargetPackageT } from './types.js'

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g

const buildItems = (rows: MenuRowT[]) => {
	return rows.map(row => ({
		label: row.label,
		searchText: row.label.replace(ANSI_PATTERN, ''),
		value: row.value
	}))
}

const describeLocation = (targetPackage: TargetPackageT): string => {
	return targetPackage.relativePath === '.' ? 'root' : targetPackage.relativePath
}

const buildLocationHeader = (targetPackage: TargetPackageT): string => {
	return `${accent('abt')} ${dim('·')} ${describeLocation(targetPackage)}`
}

const CHOOSE_SCRIPT_HEADER = '[ abt ∆ choose a script ]'

export type FlowOutcomeT = {
	exitCode: number
	wasCancelled: boolean
}

export const runInteractiveFlow = async (
	context: ContextT,
	forwardedArguments: string[],
	header = CHOOSE_SCRIPT_HEADER
): Promise<FlowOutcomeT> => {
	const hasOtherPackages = context.isWorkspace && listBrowsablePackages(context).length > 1
	let targetPackage = context.currentPackage
	let screen: 'scripts' | 'packages' = 'scripts'
	let scriptsCanGoBack = false
	let scriptHeader = header

	for (;;) {
		if (screen === 'packages') {
			const packageOutcome = await runFuzzySelect({
				title: `${accent('abt')} ${dim('·')} packages`,
				items: buildItems(buildPackageMenuRows(context)),
				canGoBack: true
			})

			if (packageOutcome.kind === 'cancelled') return { exitCode: 0, wasCancelled: true }
			if (packageOutcome.kind === 'back') {
				targetPackage = context.currentPackage
				scriptHeader = header
				scriptsCanGoBack = false
				screen = 'scripts'
				continue
			}
			if (packageOutcome.kind !== 'selected') continue

			const selectedPath = readOpenValue(packageOutcome.value)
			const selectedPackage = context.workspace.packages.find(candidate => candidate.relativePath === selectedPath)
			if (selectedPackage === undefined) continue
			targetPackage = selectedPackage
			scriptHeader = buildLocationHeader(selectedPackage)
			scriptsCanGoBack = true
			screen = 'scripts'
			continue
		}

		const scriptOutcome = await runFuzzySelect({
			title: scriptHeader,
			items: buildItems(buildScriptMenuRows(targetPackage)),
			canGoBack: scriptsCanGoBack,
			canOpenPackages: hasOtherPackages
		})

		if (scriptOutcome.kind === 'cancelled') return { exitCode: 0, wasCancelled: true }
		if (scriptOutcome.kind === 'back' || scriptOutcome.kind === 'tab') {
			screen = 'packages'
			continue
		}
		if (scriptOutcome.kind !== 'selected') continue

		const scriptName = readRunValue(scriptOutcome.value)
		if (scriptName === undefined) continue
		process.stderr.write(`${dim(`› ${describeRunCommand(targetPackage, scriptName, context.workspace.rootDirectory)}`)}\n\n`)
		const outcome = await runScript(targetPackage, scriptName, context.workspace.rootDirectory, forwardedArguments)
		return { exitCode: outcome.exitCode, wasCancelled: false }
	}
}

export const runPackageScriptFlow = async (
	context: ContextT,
	targetPackage: TargetPackageT,
	forwardedArguments: string[]
): Promise<FlowOutcomeT> => {
	const scopedContext: ContextT = {
		workspace: context.workspace,
		currentPackage: targetPackage,
		isWorkspace: false
	}

	return await runInteractiveFlow(scopedContext, forwardedArguments, buildLocationHeader(targetPackage))
}
