import type { ParsedArgumentsT } from './types.js'

export type ArgumentSplitT = {
	parsed: ParsedArgumentsT
	forwardedArguments: string[]
}

const VERSION_FLAGS = ['--version', '-v']
const HELP_FLAGS = ['--help', '-h']
const LIST_FLAGS = ['--list', '-l']

// Everything after a bare `--` belongs to the script, not to abt.
export const parseArguments = (rawArguments: string[]): ArgumentSplitT => {
	const separatorIndex = rawArguments.indexOf('--')
	const hasSeparator = separatorIndex !== -1

	const ownArguments = hasSeparator ? rawArguments.slice(0, separatorIndex) : rawArguments
	const forwardedArguments = hasSeparator ? rawArguments.slice(separatorIndex + 1) : []

	const wantsVersion = ownArguments.some(argument => VERSION_FLAGS.includes(argument))
	const wantsHelp = ownArguments.some(argument => HELP_FLAGS.includes(argument))
	const wantsList = ownArguments.some(argument => LIST_FLAGS.includes(argument))

	const positionals = ownArguments.filter(argument => !argument.startsWith('-'))

	return {
		parsed: { wantsVersion, wantsHelp, wantsList, positionals },
		forwardedArguments
	}
}
