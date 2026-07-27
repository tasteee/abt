import { execa } from 'execa'
import { PackageManager, detectPackageManager } from './detectPackageManager.js'
import type { PackageManagerT } from './detectPackageManager.js'
import type { TargetPackageT } from './types.js'

export type RunOutcomeT = {
	exitCode: number
}

// Only npm needs the `--` separator: without it npm eats the
// leading flags as its own. pnpm forwards a literal `--` straight
// into the script's argv, and yarn and bun pass extra arguments
// through untouched — so for those, handing the arguments over
// bare is what actually reaches the script.
const buildRunArguments = (
	packageManager: PackageManagerT,
	scriptName: string,
	forwardedArguments: string[]
): string[] => {
	const hasNoForwardedArguments = forwardedArguments.length === 0
	if (hasNoForwardedArguments) return ['run', scriptName]

	const needsSeparator = packageManager === PackageManager.npm
	if (needsSeparator) return ['run', scriptName, '--', ...forwardedArguments]

	return ['run', scriptName, ...forwardedArguments]
}

// Hand the terminal over completely: inherited stdio means the
// script keeps its own colors, prompts and progress output, and
// behaves exactly as if abt were never in the chain.
export const runScript = async (
	targetPackage: TargetPackageT,
	scriptName: string,
	workspaceRootDirectory: string,
	forwardedArguments: string[]
): Promise<RunOutcomeT> => {
	const packageManager = detectPackageManager(workspaceRootDirectory)
	const commandArguments = buildRunArguments(packageManager, scriptName, forwardedArguments)

	const result = await execa(packageManager, commandArguments, {
		cwd: targetPackage.directory,
		stdio: 'inherit',
		reject: false
	})

	const didReportExitCode = typeof result.exitCode === 'number'
	if (didReportExitCode) return { exitCode: result.exitCode as number }

	// No exit code means the process never started — usually the
	// package manager is not installed. Saying so beats exiting 0
	// and letting a green result hide a script that never ran.
	const isSpawnFailure = result.failed === true
	if (!isSpawnFailure) return { exitCode: 0 }

	process.stderr.write(`abt could not run "${packageManager}". Is it installed and on your PATH?\n`)
	return { exitCode: 127 }
}

export const describeRunCommand = (
	targetPackage: TargetPackageT,
	scriptName: string,
	workspaceRootDirectory: string
): string => {
	const packageManager = detectPackageManager(workspaceRootDirectory)
	const isRootPackage = targetPackage.relativePath === '.'
	const locationSuffix = isRootPackage ? '' : ` (${targetPackage.relativePath})`
	return `${packageManager} run ${scriptName}${locationSuffix}`
}
