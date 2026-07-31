import { accent, bold, dim, flattenCommand, symbols } from './theme.js'
import { writeResult } from './output.js'
import type { ContextT, TargetPackageT } from './types.js'

const writeLine = (line: string): void => {
	writeResult(`${line}\n`)
}

export const printVersion = (version: string): void => {
	writeLine(version)
}

export const printHelp = (version: string): void => {
	const marks = symbols()
	const keyHelp = (key: string, description: string): string => `  ${key.padEnd(23)}${dim(description)}`
	const lines = [
		`${bold(accent('abt'))} ${dim(version)} ${dim(`${marks.missing} list, pick, and run package scripts.`)}`,
		'',
		bold('Usage'),
		`  abt                    ${dim('pick a script to run')}`,
		`  abt <script>           ${dim('run a script here by name')}`,
		`  abt <package>          ${dim('pick a script from a workspace package')}`,
		`  abt <package> <script> ${dim('run a script in a workspace package')}`,
		`  abt <script> -- <args> ${dim('forward arguments to the script')}`,
		`  abt deps               ${dim('inspect dependencies here')}`,
		`  abt deps <package>     ${dim('inspect a workspace package')}`,
		`  abt deps --update <p>=latest ${dim('update without a prompt')}`,
		'',
		bold('Flags'),
		`  -l, --list             ${dim('print every script, one per line')}`,
		`      --json             ${dim('emit one machine-readable JSON document')}`,
		`      --update <p>=<lane> ${dim('choose installed, major, or latest (repeatable)')}`,
		`      --dry-run          ${dim('preview dependency updates without writing')}`,
		`      --[no-]interactive  ${dim('force a menu or never open one')}`,
		`      --[no-]color       ${dim('force or disable terminal color')}`,
		`      --[no-]unicode     ${dim('force Unicode or ASCII symbols')}`,
		`  -q, --quiet            ${dim('suppress nonessential diagnostics')}`,
		`      --verbose          ${dim('show additional operational detail')}`,
		`      --debug            ${dim('include a stack trace when a failure occurs')}`,
		`  -v, --version          ${dim('print the abt version')}`,
		`  -h, --help             ${dim('show this help')}`,
		'',
		bold('In the script menu'),
		keyHelp('type', 'fuzzy-filter scripts'),
		keyHelp('backspace', 'edit the filter'),
		keyHelp(marks.upDown, 'move'),
		keyHelp(marks.right, 'show commands when descriptions exist'),
		keyHelp(marks.left, 'return to descriptions'),
		keyHelp('enter', 'select'),
		keyHelp('tab', 'browse workspace packages'),
		keyHelp('escape', 'clear the filter, then go back'),
		keyHelp('ctrl+c', 'quit'),
		'',
		bold('In the dependency list'),
		keyHelp('type', 'fuzzy-filter dependencies'),
		keyHelp('backspace', 'edit the filter'),
		keyHelp(marks.upDown, 'move'),
		keyHelp(marks.leftRight, 'choose a version'),
		keyHelp('enter', 'review staged changes'),
		keyHelp('escape', 'clear the filter, then cancel'),
		'',
		bold('Exit status'),
		`  0 success ${dim(marks.bullet)} 1 runtime failure ${dim(marks.bullet)} 2 usage/environment ${dim(marks.bullet)} 130 cancelled`,
		'',
		bold('Examples'),
		`  abt test -- --watch`,
		`  abt deps --update typescript=major --dry-run`,
		`  abt deps --json`
	]

	for (const line of lines) writeLine(line)
}

const buildQualifiedName = (targetPackage: TargetPackageT, scriptName: string, isWorkspace: boolean): string => {
	const isRootPackage = targetPackage.relativePath === '.'
	if (!isWorkspace) return scriptName
	if (isRootPackage) return scriptName
	return `${targetPackage.relativePath} ${scriptName}`
}

export type ScriptListEntryT = { package: string; name: string; command: string; qualifiedName: string }

export const listScripts = (context: ContextT): ScriptListEntryT[] => {
	return context.workspace.packages.flatMap(candidatePackage => {
		return Object.keys(candidatePackage.scriptsByName).map(scriptName => ({
			package: candidatePackage.relativePath,
			name: scriptName,
			command: flattenCommand(candidatePackage.scriptsByName[scriptName]),
			qualifiedName: buildQualifiedName(candidatePackage, scriptName, context.isWorkspace)
		}))
	})
}

// Plain, one row per line, stdout only — so `abt --list | grep`
// and `abt --list > file` both behave.
export const printScriptList = (context: ContextT): void => {
	for (const script of listScripts(context)) writeLine(`${script.qualifiedName}\t${script.command}`)
}

export const printError = (message: string): void => {
	process.stderr.write(`${accent('abt')} ${message}\n`)
}
