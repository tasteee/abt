import type { TargetPackageT } from './types.js';
export type RunOutcomeT = {
    exitCode: number;
};
export declare const runScript: (targetPackage: TargetPackageT, scriptName: string, workspaceRootDirectory: string, forwardedArguments: string[]) => Promise<RunOutcomeT>;
export declare const describeRunCommand: (targetPackage: TargetPackageT, scriptName: string, workspaceRootDirectory: string) => string;
