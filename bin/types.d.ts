export type ScriptsByNameT = Record<string, string>;
export type TargetPackageT = {
    name: string;
    directory: string;
    relativePath: string;
    isRoot: boolean;
    scriptsByName: ScriptsByNameT;
};
export type WorkspaceT = {
    rootDirectory: string;
    packages: TargetPackageT[];
};
export type ContextT = {
    workspace: WorkspaceT;
    currentPackage: TargetPackageT;
    isWorkspace: boolean;
};
export type MenuRowT = {
    label: string;
    value: string;
};
export type ParsedArgumentsT = {
    wantsVersion: boolean;
    wantsHelp: boolean;
    wantsList: boolean;
    positionals: string[];
};
