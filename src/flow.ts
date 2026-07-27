import { Pathenger } from 'pathenger'
import {
	buildPackageMenuRows,
	buildScriptMenuRows,
	listBrowsablePackages,
	readOpenValue,
	readRunValue
} from './buildMenuRows.js'
import { describeRunCommand, runScript } from './runScript.js'
import { accent, dim } from './theme.js'
import type { KeyBindingsT } from 'pathenger'
import type { ContextT, MenuRowT, TargetPackageT } from './types.js'

type StoreT = {
	openedPackagePath: string
	selectedScriptName: string
	exitCode: number
}

type ResultsT = {
	pickScript?: string
	browsePackages?: string
	pickPackageScript?: string
}

const buildOptions = (rows: MenuRowT[]) => {
	return rows.map(row => {
		return { label: row.label, value: row.value }
	})
}

const describeLocation = (targetPackage: TargetPackageT): string => {
	const isRootPackage = targetPackage.relativePath === '.'
	if (isRootPackage) return 'root'
	return targetPackage.relativePath
}

// A plain repo has only one place to be, so naming it is noise.
// Anywhere a second location exists, the header says where you are.
const buildHeader = (context: ContextT, targetPackage: TargetPackageT): string => {
	const isSoleLocation = !context.isWorkspace && targetPackage.relativePath === '.'
	if (isSoleLocation) return accent('abt')
	return `${accent('abt')} ${dim('·')} ${describeLocation(targetPackage)}`
}

export type FlowOutcomeT = {
	exitCode: number
	wasCancelled: boolean
}

// The default menu is the scripts of the package you are standing
// in — nothing else. Tab opens the package list, selecting one
// shows its scripts, and escape walks back up either step.
export const runInteractiveFlow = async (context: ContextT, forwardedArguments: string[]): Promise<FlowOutcomeT> => {
	const flow = Pathenger.create<StoreT, ResultsT>({
		store: { openedPackagePath: '', selectedScriptName: '', exitCode: 0 }
	})

	const findOpenedPackage = (): TargetPackageT => {
		const openedPackage = context.workspace.packages.find(candidatePackage => {
			return candidatePackage.relativePath === flow.store.openedPackagePath
		})

		if (openedPackage === undefined) return context.currentPackage
		return openedPackage
	}

	const findTargetPackage = (): TargetPackageT => {
		const hasOpenedPackage = flow.store.openedPackagePath.length > 0
		if (hasOpenedPackage) return findOpenedPackage()
		return context.currentPackage
	}

	const rememberSelectedScript = (selectedValue: string): void => {
		const scriptName = readRunValue(selectedValue)
		if (scriptName === undefined) return
		flow.store.selectedScriptName = scriptName
	}

	const RunSelectedScript = Pathenger.createOutputStep({
		id: 'runSelectedScript',
		next: () => flow.exit(),

		message: () => {
			const targetPackage = findTargetPackage()
			const scriptName = flow.store.selectedScriptName
			return dim(describeRunCommand(targetPackage, scriptName, context.workspace.rootDirectory))
		},

		// The script owns the terminal outright while it runs.
		task: async () => {
			const targetPackage = findTargetPackage()
			const scriptName = flow.store.selectedScriptName

			const outcome = await flow.suspend(() => {
				return runScript(targetPackage, scriptName, context.workspace.rootDirectory, forwardedArguments)
			})

			flow.store.exitCode = outcome.exitCode
			return outcome
		}
	})

	const PickPackageScript = Pathenger.createSelectInputStep({
		id: 'pickPackageScript',
		canGoBack: true,
		tip: 'escape to go back',
		options: () => buildOptions(buildScriptMenuRows(findOpenedPackage())),
		next: () => RunSelectedScript,
		post: rememberSelectedScript,

		message: () => {
			const openedPackage = findOpenedPackage()
			return `${accent('abt')} ${dim('·')} ${describeLocation(openedPackage)}`
		}
	})

	const BrowsePackages = Pathenger.createSelectInputStep({
		id: 'browsePackages',
		canGoBack: true,
		tip: 'escape to go back',
		message: `${accent('abt')} ${dim('·')} packages`,
		options: () => buildOptions(buildPackageMenuRows(context)),
		next: () => PickPackageScript,

		post: selectedValue => {
			const openedPackagePath = readOpenValue(selectedValue)
			if (openedPackagePath === undefined) return
			flow.store.openedPackagePath = openedPackagePath
		}
	})

	// Only offer the tab route when there is somewhere to go.
	const hasOtherPackages = context.isWorkspace && listBrowsablePackages(context).length > 1
	const packageKeyBindings: KeyBindingsT = hasOtherPackages ? { tab: BrowsePackages } : {}
	const packageTip = hasOtherPackages ? 'tab to browse packages' : undefined

	const PickScript = Pathenger.createSelectInputStep({
		id: 'pickScript',
		message: buildHeader(context, context.currentPackage),
		tip: packageTip,
		options: () => buildOptions(buildScriptMenuRows(context.currentPackage)),
		keys: packageKeyBindings,
		next: () => RunSelectedScript,
		post: rememberSelectedScript
	})

	let wasCancelled = false

	await flow.start({
		firstStep: PickScript,
		steps: [PickScript, BrowsePackages, PickPackageScript, RunSelectedScript],
		onCancel: () => {
			wasCancelled = true
		}
	})

	return { exitCode: flow.store.exitCode, wasCancelled }
}

// Skipping the first menu when the developer already named the
// package, but still letting them pick the script.
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

	return await runInteractiveFlow(scopedContext, forwardedArguments)
}
