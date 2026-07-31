import type { CliEnvironmentT } from './environment.js'
import type { DependencyEntryT, DependencySectionT } from './types.js'
import { ellipsis, symbols } from './theme.js'
import { writeDiagnostic, writeJsonResult, writeResult } from './output.js'

export type ScriptResultT = {
	package: string
	name: string
	command: string
	qualifiedName: string
}

export type DependencyChangeResultT = {
	name: string
	section: DependencySectionT
	from: string
	to: string
	lane?: 'installed' | 'major' | 'latest'
}

export type CliEventT =
	| { type: 'operation:start'; id: string; title: string }
	| { type: 'operation:complete'; id: string }
	| { type: 'command:run'; description: string }
	| { type: 'version'; version: string }
	| { type: 'script:list'; scripts: ScriptResultT[] }
	| { type: 'dependency:report'; package: string; dependencies: DependencyEntryT[] }
	| { type: 'dependency:empty'; package: string }
	| { type: 'dependency:changed'; package: string; dryRun: boolean; changes: DependencyChangeResultT[] }
	| { type: 'notice'; level: 'info' | 'warning' | 'error'; title: string; body?: string; verboseOnly?: boolean }

export interface CliRendererT {
	emit(event: CliEventT): void
	flush(): Promise<void>
	dispose(): Promise<void>
}

const friendlySectionName: Record<DependencySectionT, string> = {
	dependencies: 'dependencies',
	peerDependencies: 'peer dependencies',
	devDependencies: 'dev dependencies'
}

export class PlainRenderer implements CliRendererT {
	protected readonly environment: CliEnvironmentT

	constructor(environment: CliEnvironmentT) {
		this.environment = environment
	}

	emit(event: CliEventT): void {
		if (event.type === 'operation:start' || event.type === 'operation:complete') {
			if (this.environment.verbose && event.type === 'operation:start') writeDiagnostic(`${event.title}\n`)
			return
		}
		if (event.type === 'command:run') {
			if (!this.environment.quiet) writeDiagnostic(`${symbols().drill} ${event.description}\n\n`)
			return
		}
		if (event.type === 'notice') {
			if ((this.environment.quiet && event.level !== 'error') || (event.verboseOnly === true && !this.environment.verbose)) return
			writeDiagnostic(`${event.title}${event.body === undefined ? '' : `\n${event.body}`}\n`)
			return
		}
		if (event.type === 'script:list') {
			for (const script of event.scripts) writeResult(`${script.qualifiedName}\t${script.command}\n`)
			return
		}
		if (event.type === 'version') {
			writeResult(`${event.version}\n`)
			return
		}
		if (event.type === 'dependency:empty') {
			writeResult(`abt ${event.package} has no dependencies.\n`)
			return
		}
		if (event.type === 'dependency:report') {
			for (const section of ['dependencies', 'peerDependencies', 'devDependencies'] as const) {
				const entries = event.dependencies.filter(entry => entry.section === section)
				if (entries.length === 0) continue
				writeResult(`${friendlySectionName[section]}\npackage\tdeclared\tinstalled\tmajor\tlatest\n`)
				for (const entry of entries) {
					writeResult(
						`${entry.name}\t${entry.declaredVersion}\t${entry.installedVersion ?? 'not installed'}\t${entry.majorVersion ?? 'unavailable'}\t${entry.latestVersion ?? 'unavailable'}\n`
					)
				}
			}
			return
		}
		const verb = event.dryRun ? 'would update' : 'updated'
		if (event.changes.length === 0) writeResult('No dependency changes needed.\n')
		else {
			writeResult(`${verb} ${event.changes.length} dependenc${event.changes.length === 1 ? 'y' : 'ies'}:\n`)
			for (const change of event.changes) {
				const lane = change.lane === undefined ? '' : ` (${change.lane})`
				writeResult(`  ${change.name} ${change.from} ${symbols().arrow} ${change.to}${lane}\n`)
			}
			if (!event.dryRun) writeResult('Run your package manager install command to update installed packages and the lockfile.\n')
		}
	}

	async flush(): Promise<void> {}
	async dispose(): Promise<void> {}
}

export class InteractiveRenderer extends PlainRenderer {
	private transientId: string | undefined

	override emit(event: CliEventT): void {
		if (event.type === 'operation:start') {
			this.transientId = event.id
			writeDiagnostic(`${event.title}${ellipsis()}`)
			return
		}
		if (event.type === 'operation:complete' && event.id === this.transientId) {
			writeDiagnostic('\r\u001B[2K')
			this.transientId = undefined
			return
		}
		super.emit(event)
	}

	override async dispose(): Promise<void> {
		if (this.transientId !== undefined) writeDiagnostic('\r\u001B[2K')
		this.transientId = undefined
	}
}

export class JsonRenderer implements CliRendererT {
	private result: Record<string, unknown> | undefined

	emit(event: CliEventT): void {
		if (event.type === 'version') this.result = { command: 'version', version: event.version }
		else if (event.type === 'script:list') this.result = { command: 'list', scripts: event.scripts }
		else if (event.type === 'dependency:report') {
			this.result = { command: 'deps', package: event.package, dependencies: event.dependencies, changes: [] }
		} else if (event.type === 'dependency:empty') {
			this.result = { command: 'deps', package: event.package, dependencies: [], changes: [] }
		} else if (event.type === 'dependency:changed') {
			this.result = { command: 'deps', package: event.package, dryRun: event.dryRun, changes: event.changes }
		}
	}

	async flush(): Promise<void> {
		if (this.result !== undefined) writeJsonResult(this.result)
	}

	async dispose(): Promise<void> {}
}

export class SilentRenderer extends PlainRenderer {}

export class TestRenderer implements CliRendererT {
	readonly events: CliEventT[] = []
	emit(event: CliEventT): void {
		this.events.push(event)
	}
	async flush(): Promise<void> {}
	async dispose(): Promise<void> {}
}

export const createRenderer = (environment: CliEnvironmentT): CliRendererT => {
	if (environment.json) return new JsonRenderer()
	if (environment.interactive) return new InteractiveRenderer(environment)
	if (environment.quiet) return new SilentRenderer(environment)
	return new PlainRenderer(environment)
}
