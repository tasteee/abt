import type { ParsedArgumentsT } from './types.js'
import { usageError } from './errors.js'

export type ArgumentSplitT = {
	parsed: ParsedArgumentsT
	forwardedArguments: string[]
}

const VERSION_FLAGS = ['--version', '-v']
const HELP_FLAGS = ['--help', '-h']
const LIST_FLAGS = ['--list', '-l']

const readMode = (argument: string): 'always' | 'never' | undefined => {
	if (argument === '--interactive' || argument === '--color' || argument === '--unicode') return 'always'
	if (argument === '--no-interactive' || argument === '--no-color' || argument === '--no-unicode') return 'never'
	return undefined
}

const chooseMode = <T extends 'auto' | 'always' | 'never'>(current: T, next: T, label: string): T => {
	if (current !== 'auto' && current !== next) throw usageError(`conflicting ${label} options.`)
	return next
}

// Everything after a bare `--` belongs to the script, not to abt.
export const parseArguments = (rawArguments: string[]): ArgumentSplitT => {
	const separatorIndex = rawArguments.indexOf('--')
	const hasSeparator = separatorIndex !== -1

	const ownArguments = hasSeparator ? rawArguments.slice(0, separatorIndex) : rawArguments
	const forwardedArguments = hasSeparator ? rawArguments.slice(separatorIndex + 1) : []

	let wantsVersion = false
	let wantsHelp = false
	let wantsList = false
	let interactiveMode: ParsedArgumentsT['interactiveMode'] = 'auto'
	let colorMode: ParsedArgumentsT['colorMode'] = 'auto'
	let unicodeMode: ParsedArgumentsT['unicodeMode'] = 'auto'
	let wantsJson = false
	let quiet = false
	let verbose = false
	let debug = false
	let dryRun = false
	const updates: string[] = []
	const positionals: string[] = []

	for (let index = 0; index < ownArguments.length; index += 1) {
		const argument = ownArguments[index]
		if (VERSION_FLAGS.includes(argument)) wantsVersion = true
		else if (HELP_FLAGS.includes(argument)) wantsHelp = true
		else if (LIST_FLAGS.includes(argument)) wantsList = true
		else if (argument === '--json') wantsJson = true
		else if (argument === '--quiet' || argument === '-q') quiet = true
		else if (argument === '--verbose') verbose = true
		else if (argument === '--debug') debug = true
		else if (argument === '--dry-run') dryRun = true
		else if (argument === '--interactive' || argument === '--no-interactive') {
			interactiveMode = chooseMode(interactiveMode, readMode(argument) ?? 'auto', 'interactive')
		} else if (argument === '--color' || argument === '--no-color') {
			colorMode = chooseMode(colorMode, readMode(argument) ?? 'auto', 'color')
		} else if (argument === '--unicode' || argument === '--no-unicode') {
			unicodeMode = chooseMode(unicodeMode, readMode(argument) ?? 'auto', 'Unicode')
		}
		else if (argument === '--update') {
			const value = ownArguments[index + 1]
			if (value === undefined || value.startsWith('-')) throw usageError('--update requires PACKAGE=installed|major|latest.')
			updates.push(value)
			index += 1
		} else if (argument.startsWith('--update=')) {
			updates.push(argument.slice('--update='.length))
		} else if (argument.startsWith('-')) {
			throw usageError(`unknown option "${argument}".`)
		} else positionals.push(argument)
	}

	if (quiet && verbose) throw usageError('--quiet and --verbose cannot be used together.')
	if (wantsJson && interactiveMode === 'always') throw usageError('--json and --interactive cannot be used together.')

	return {
		parsed: {
			wantsVersion,
			wantsHelp,
			wantsList,
			interactiveMode,
			colorMode,
			unicodeMode,
			wantsJson,
			quiet,
			verbose,
			debug,
			dryRun,
			updates,
			positionals
		},
		forwardedArguments
	}
}
