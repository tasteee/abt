import type { PackageJsonT } from './readPackage.js';
import type { ScriptsByNameT } from './types.js';
export declare const loadScriptDescriptions: (packageDirectory: string, packageJson: PackageJsonT, scriptsByName: ScriptsByNameT) => Record<string, string>;
