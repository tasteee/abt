export type ScriptsByNameT = Record<string, string>

// A package.json abt can run scripts from. The root of a
// workspace is itself a target, listed alongside its children.
export type TargetPackageT = {
	name: string
	directory: string
	relativePath: string
	isRoot: boolean
	scriptsByName: ScriptsByNameT
}

export type WorkspaceT = {
	rootDirectory: string
	packages: TargetPackageT[]
}

// Where abt was invoked from, resolved against the workspace.
export type ContextT = {
	workspace: WorkspaceT
	currentPackage: TargetPackageT
	isWorkspace: boolean
}

export type MenuRowT = {
	label: string
	value: string
}

export type ParsedArgumentsT = {
	wantsVersion: boolean
	wantsHelp: boolean
	wantsList: boolean
	positionals: string[]
}
