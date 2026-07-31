export type ErrorCategoryT = 'usage' | 'cancelled' | 'environment' | 'runtime'

export class CliError extends Error {
	readonly category: ErrorCategoryT
	readonly code: string
	readonly exitCode: number
	readonly recovery?: string

	constructor(options: {
		message: string
		category?: ErrorCategoryT
		code?: string
		exitCode?: number
		recovery?: string
	}) {
		super(options.message)
		this.name = 'CliError'
		this.category = options.category ?? 'runtime'
		this.code = options.code ?? 'ABT_ERROR'
		this.exitCode = options.exitCode ?? 1
		this.recovery = options.recovery
	}
}

export class CancelledError extends CliError {
	constructor() {
		super({
			message: 'cancelled.',
			category: 'cancelled',
			code: 'ABT_CANCELLED',
			exitCode: 130
		})
	}
}

export const usageError = (message: string, recovery = 'Run "abt --help" for usage.'): CliError => {
	return new CliError({ message, category: 'usage', code: 'ABT_USAGE', exitCode: 2, recovery })
}
