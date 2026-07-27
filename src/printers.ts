import { accent, bold, dim, flattenCommand } from './theme.js'
import type { ContextT, TargetPackageT } from './types.js'

const writeLine = (line: string): void => {
	process.stdout.write(`${line}\n`)
}

export const printVersion = (version: string): void => {
	writeLine(version)
}

export const printHelp = (version: string): void => {
	const lines = [
		`${bold(accent('abt'))} ${dim(version)} ${dim('— list, pick, and run package scripts.')}`,
		'',
		bold('Usage'),
		`  abt                    ${dim('pick a script to run')}`,
		`  abt <script>           ${dim('run a script here by name')}`,
		`  abt <package>          ${dim('pick a script from a workspace package')}`,
		`  abt <package> <script> ${dim('run a script in a workspace package')}`,
		`  abt <script> -- <args> ${dim('forward arguments to the script')}`,
		'',
		bold('Flags'),
		`  -l, --list             ${dim('print every script, one per line')}`,
		`  -v, --version          ${dim('print the abt version')}`,
		`  -h, --help             ${dim('show this help')}`,
		'',
		bold('In the menu'),
		`  ↑ ↓                    ${dim('move')}`,
		`  enter                  ${dim('select')}`,
		`  tab                    ${dim('browse workspace packages')}`,
		`  escape                 ${dim('back')}`,
		`  ctrl+c                 ${dim('quit')}`
	]

	for (const line of lines) writeLine(line)
}

const buildQualifiedName = (targetPackage: TargetPackageT, scriptName: string, isWorkspace: boolean): string => {
	const isRootPackage = targetPackage.relativePath === '.'
	if (!isWorkspace) return scriptName
	if (isRootPackage) return scriptName
	return `${targetPackage.relativePath} ${scriptName}`
}

// Plain, one row per line, stdout only — so `abt --list | grep`
// and `abt --list > file` both behave.
export const printScriptList = (context: ContextT): void => {
	const packagesWithScripts = context.workspace.packages.filter(candidatePackage => {
		return Object.keys(candidatePackage.scriptsByName).length > 0
	})

	for (const candidatePackage of packagesWithScripts) {
		const scriptNames = Object.keys(candidatePackage.scriptsByName)

		for (const scriptName of scriptNames) {
			const command = flattenCommand(candidatePackage.scriptsByName[scriptName])
			const qualifiedName = buildQualifiedName(candidatePackage, scriptName, context.isWorkspace)
			writeLine(`${qualifiedName}\t${command}`)
		}
	}
}

export const printError = (message: string): void => {
	process.stderr.write(`${accent('abt')} ${message}\n`)
}
