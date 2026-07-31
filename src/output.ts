import type { CliEnvironmentT } from './environment.js'
import type { CliError } from './errors.js'

let activeEnvironment: CliEnvironmentT | undefined

export const configureOutput = (environment: CliEnvironmentT): void => {
	activeEnvironment = environment
}

export const writeResult = (text: string): void => {
	process.stdout.write(text)
}

export const writeDiagnostic = (text: string): void => {
	if (activeEnvironment?.quiet === true) return
	process.stderr.write(text)
}

export const writeJsonResult = (result: Record<string, unknown>): void => {
	writeResult(`${JSON.stringify({ ok: true, ...result }, undefined, 2)}\n`)
}

export const writeJsonError = (error: CliError): void => {
	writeResult(
		`${JSON.stringify(
			{
				ok: false,
				error: {
					code: error.code,
					category: error.category,
					message: error.message,
					...(error.recovery === undefined ? {} : { recovery: error.recovery })
				}
			},
			undefined,
			2
		)}\n`
	)
}
