import type { DependencyEntryT, DependencySectionT, TargetPackageT } from './types.js';
import type { PackageJsonT } from './readPackage.js';
export declare const listDependencySections: () => DependencySectionT[];
export declare const isRegistryDependency: (declaredVersion: string) => boolean;
export declare const readInstalledVersion: (packageName: string, packageDirectory: string, workspaceRootDirectory: string) => string | undefined;
export declare const buildDependencyEntries: (targetPackage: TargetPackageT, workspaceRootDirectory: string, packageJson: PackageJsonT) => DependencyEntryT[];
export declare const loadLatestVersions: (entries: DependencyEntryT[], registryUrl?: string) => Promise<DependencyEntryT[]>;
