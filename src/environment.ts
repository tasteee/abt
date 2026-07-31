import { CliError } from './errors.js'
import type { ParsedArgumentsT } from './types.js'

export type CliEnvironmentT = {
	interactive: boolean
	color: boolean
	unicode: boolean
	json: boolean
	quiet: boolean
	verbose: boolean
	debug: boolean
	columns: number | undefined
	rows: number | undefined
	ci: boolean
}

const isCiEnvironment = (environment: NodeJS.ProcessEnv): boolean => {
	return environment.CI !== undefined && environment.CI !== '' && environment.CI !== '0' && environment.CI !== 'false'
}

export const detectEnvironment = (
	parsed: ParsedArgumentsT,
	options: {
		stdinTTY?: boolean
		stdoutTTY?: boolean
		stderrTTY?: boolean
		columns?: number
		rows?: number
		environment?: NodeJS.ProcessEnv
	} = {}
): CliEnvironmentT => {
	const environment = options.environment ?? process.env
	const stdinTTY = options.stdinTTY ?? process.stdin.isTTY === true
	const stdoutTTY = options.stdoutTTY ?? process.stdout.isTTY === true
	const stderrTTY = options.stderrTTY ?? process.stderr.isTTY === true
	const ci = isCiEnvironment(environment)
	const supportsInteraction = stdinTTY && stdoutTTY && stderrTTY

	if (parsed.interactiveMode === 'always' && !supportsInteraction) {
		throw new CliError({
			message: 'interactive mode requires stdin, stdout, and stderr to be attached to a terminal.',
			category: 'environment',
			code: 'ABT_NOT_INTERACTIVE',
			exitCode: 2,
			recovery: 'Remove --interactive or run abt directly in a terminal.'
		})
	}

	const interactive =
		parsed.interactiveMode === 'always' ||
		(parsed.interactiveMode === 'auto' && supportsInteraction && !ci && !parsed.wantsJson)
	const forceColor =
		(environment.FORCE_COLOR !== undefined && environment.FORCE_COLOR !== '0') ||
		(environment.CLICOLOR_FORCE !== undefined && environment.CLICOLOR_FORCE !== '0')
	const noColor = environment.NO_COLOR !== undefined && environment.NO_COLOR !== ''
	const colorDefault = !noColor && environment.TERM !== 'dumb' && ((stdoutTTY && stderrTTY) || forceColor)
	const color = parsed.colorMode === 'always' || (parsed.colorMode === 'auto' && colorDefault)
	const unicodeDefault =
		environment.TERM !== 'dumb' && environment.ABT_ASCII === undefined && environment.NO_UNICODE === undefined
	const unicode = parsed.unicodeMode === 'always' || (parsed.unicodeMode === 'auto' && unicodeDefault)

	return {
		interactive,
		color: parsed.wantsJson ? false : color,
		unicode,
		json: parsed.wantsJson,
		quiet: parsed.quiet,
		verbose: parsed.verbose,
		debug: parsed.debug,
		columns: options.columns ?? process.stderr.columns,
		rows: options.rows ?? process.stderr.rows,
		ci
	}
}
