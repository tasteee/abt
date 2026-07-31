import type { ScriptsByNameT } from './types.js';
export type PackageJsonT = {
    name?: string;
    scripts?: ScriptsByNameT;
    workspaces?: string[] | {
        packages?: string[];
    };
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    abt?: unknown;
};
export declare const readPackageJson: (packageJsonPath: string) => PackageJsonT | undefined;
export declare const readPackageJsonInDirectory: (directory: string) => PackageJsonT | undefined;
export declare const listAncestorDirectories: (startDirectory: string) => string[];
export declare const findNearestPackageDirectory: (startDirectory: string) => string | undefined;
